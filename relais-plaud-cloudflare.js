/*
 * Relais Notes Plaud ⇄ cloud Plaud (Cloudflare Worker, offre gratuite) — version 3
 *
 * Le serveur de Plaud refuse les appels venant d'autres sites que le sien (CORS).
 * Ce petit relais transmet UNIQUEMENT les quelques requêtes utiles à l'import
 * (liste des enregistrements, lien MP3, téléchargement audio) et n'accepte que
 * ton site Notes Plaud. Il ne stocke rien : ton jeton Plaud passe juste au travers.
 *
 * Il sert aussi à lire ton emploi du temps (.ics) : les serveurs d'université n'autorisent pas
 * une app web à le lire directement. Seuls les hôtes listés dans ICS_HOSTS sont acceptés.
 *
 * Variables à définir dans Cloudflare (Settings → Variables and Secrets) :
 *   ALLOWED_ORIGIN = https://TON-PSEUDO.github.io      (obligatoire depuis la version 3)
 *   ICS_HOSTS      = (facultatif) autres hébergeurs de calendrier, séparés par des virgules, ex. : ade.univ.fr,calendar.google.com
 *
 * Sécurité (version 3) :
 *   - sans ALLOWED_ORIGIN, le relais refuse tout (avant, il acceptait n'importe quel site) ;
 *   - les redirections ne sont suivies que vers des hôtes autorisés (calendrier, audio), jamais pour l'API Plaud
 *     (le jeton ne peut pas partir ailleurs) ;
 *   - les réponses ne peuvent pas être interprétées comme une page web (nosniff, sandbox).
 */

const VERSION = 3;
const API = { us: 'https://api.plaud.ai', eu: 'https://api-euc1.plaud.ai' };
// Chemins de l'API Plaud autorisés (lecture seule)
const ALLOWED_PATHS = [/^\/file\/simple\/web$/, /^\/file\/temp-url\/[\w-]+$/, /^\/file\/download\/[\w-]+$/, /^\/file\/detail\/[\w-]+$/, /^\/user\/me$/];
// Hébergeurs des liens de téléchargement signés
const AUDIO_HOSTS = /(^|\.)(amazonaws\.com|plaud\.ai|cloudfront\.net|aliyuncs\.com|googleapis\.com)$/;
// Hébergeurs de calendriers acceptés pour /ics (Moodle UNamur, Google Agenda, Outlook…), complétés par la variable ICS_HOSTS
const ICS_HOSTS = ['unamur.be', 'calendar.google.com', 'outlook.office365.com', 'outlook.live.com'];
const MAX_ICS = 10 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
// Ces réponses ne sont jamais des pages web : le navigateur ne doit ni deviner leur type ni y exécuter quoi que ce soit
const SAFE = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer' };

// Suit les redirections à la main, en vérifiant chaque nouvelle adresse (https + hôte autorisé)
async function fetchChecked(url, init, allowed, hops = 5) {
  let target = url;
  for (let i = 0; i <= hops; i++) {
    if (target.protocol !== 'https:' || !allowed(target.hostname.toLowerCase())) return { refused: target.hostname };
    const r = await fetch(target.toString(), { ...init, redirect: 'manual' });
    const loc = r.status >= 300 && r.status < 400 && r.headers.get('Location');
    if (!loc) return { r };
    try { target = new URL(loc, target); } catch (e) { return { refused: 'adresse de redirection invalide' }; }
  }
  return { refused: 'trop de redirections' };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
    const originOk = allowed.length > 0 && allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : allowed[0] || 'null',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
      ...SAFE,
    };
    const reply = (body, status = 200, extra = {}) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...extra } });

    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (!allowed.length) return reply({ error: 'Origine refusée : la variable ALLOWED_ORIGIN du relais est vide. Mets-y l\'adresse de ton site (ex. https://ton-pseudo.github.io).' }, 403);
    if (!originOk) return reply({ error: 'Origine refusée par le relais. Vérifie ALLOWED_ORIGIN.' }, 403);
    if (request.method !== 'GET') return reply({ error: 'Méthode non autorisée' }, 405);

    const url = new URL(request.url);

    if (url.pathname === '/ping') return reply({ ok: true, relay: 'notes-plaud', version: VERSION });

    // Emploi du temps : lecture d'un calendrier .ics (lecture seule, hôtes autorisés uniquement)
    if (url.pathname === '/ics') {
      let target;
      try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return reply({ error: 'Adresse de calendrier invalide' }, 400); }
      const hosts = [...ICS_HOSTS, ...String(env.ICS_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)];
      const okHost = (h) => hosts.some((x) => h === x || h.endsWith('.' + x));
      const res = await fetchChecked(target, { headers: { 'User-Agent': UA, Accept: 'text/calendar, */*' } }, okHost);
      if (res.refused) return reply({ error: `Hébergeur de calendrier non autorisé (${res.refused}) : ajoute-le à la variable ICS_HOSTS du relais` }, 400);
      const r = res.r;
      if (+(r.headers.get('Content-Length') || 0) > MAX_ICS) return reply({ error: 'Calendrier trop volumineux' }, 502);
      const text = await r.text();
      if (!r.ok || !/BEGIN:VCALENDAR/i.test(text) || text.length > MAX_ICS) return reply({ error: r.ok ? 'Cette adresse ne renvoie pas un calendrier (.ics). Vérifie le lien.' : `Le serveur du calendrier a répondu ${r.status}` }, 502);
      return new Response(text, { status: 200, headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    // Téléchargement d'un fichier audio depuis un lien signé fourni par Plaud
    if (url.pathname === '/audio') {
      let target;
      try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return reply({ error: 'Lien invalide' }, 400); }
      const res = await fetchChecked(target, { headers: { 'User-Agent': UA } }, (h) => AUDIO_HOSTS.test(h));
      if (res.refused) return reply({ error: 'Hôte non autorisé' }, 400);
      const r = res.r, type = r.headers.get('Content-Type') || '';
      // jamais renvoyé comme page web : seulement de l'audio ou des octets bruts
      const h = { ...cors, 'Content-Type': /^(audio|video)\//i.test(type) ? type : 'application/octet-stream' };
      if (r.headers.get('Content-Length')) h['Content-Length'] = r.headers.get('Content-Length');
      return new Response(r.body, { status: r.status, headers: h });
    }

    // Appels à l'API Plaud : /api/<chemin>?region=eu|us
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice(4);
      if (!ALLOWED_PATHS.some((re) => re.test(path))) return reply({ error: 'Chemin non autorisé' }, 400);
      const auth = request.headers.get('Authorization') || '';
      if (!/^bearer\s+\S+$/i.test(auth)) return reply({ error: 'Jeton Plaud manquant' }, 401);
      const base = API[url.searchParams.get('region')] || API.eu;
      const qs = new URLSearchParams(url.search); qs.delete('region');
      const q = qs.toString();
      // redirect: 'manual' : le jeton n'est jamais renvoyé vers une autre adresse
      const r = await fetch(base + path + (q ? '?' + q : ''), {
        redirect: 'manual',
        headers: { Authorization: 'Bearer ' + auth.replace(/^bearer\s+/i, ''), 'User-Agent': UA, Accept: 'application/json, */*' },
      });
      if (r.status >= 300 && r.status < 400) return reply({ error: 'Le cloud Plaud a renvoyé une redirection inattendue', status: r.status }, 502);
      const type = r.headers.get('Content-Type') || '';
      const h = { ...cors, 'Content-Type': /json|audio|video|octet-stream/i.test(type) ? type : 'application/octet-stream' };
      if (r.headers.get('Content-Length')) h['Content-Length'] = r.headers.get('Content-Length');
      return new Response(r.body, { status: r.status, headers: h });
    }

    return reply({ error: 'Introuvable' }, 404);
  },
};
