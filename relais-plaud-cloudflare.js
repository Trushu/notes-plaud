/*
 * Relais Notes Plaud ⇄ cloud Plaud (Cloudflare Worker, offre gratuite)
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
 *   ALLOWED_ORIGIN = https://TON-PSEUDO.github.io
 *   ICS_HOSTS      = (facultatif) autres hébergeurs de calendrier, séparés par des virgules, ex. : ade.univ.fr,calendar.google.com
 */

const API = { us: 'https://api.plaud.ai', eu: 'https://api-euc1.plaud.ai' };
// Chemins de l'API Plaud autorisés (lecture seule)
const ALLOWED_PATHS = [/^\/file\/simple\/web$/, /^\/file\/temp-url\/[\w-]+$/, /^\/file\/download\/[\w-]+$/, /^\/file\/detail\/[\w-]+$/, /^\/user\/me$/];
// Hébergeurs des liens de téléchargement signés
const AUDIO_HOSTS = /(^|\.)(amazonaws\.com|plaud\.ai|cloudfront\.net|aliyuncs\.com|googleapis\.com)$/;
// Hébergeurs de calendriers acceptés pour /ics (Moodle UNamur, Google Agenda, Outlook…), complétés par la variable ICS_HOSTS
const ICS_HOSTS = ['unamur.be', 'calendar.google.com', 'outlook.office365.com', 'outlook.live.com'];
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk && origin ? origin : allowed[0] || '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (body, status = 200, extra = {}) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...extra } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!originOk) return reply({ error: 'Origine refusée par le relais. Vérifie ALLOWED_ORIGIN.' }, 403);
    if (request.method !== 'GET') return reply({ error: 'Méthode non autorisée' }, 405);

    const url = new URL(request.url);

    if (url.pathname === '/ping') return reply({ ok: true, relay: 'notes-plaud', version: 2 });

    // Emploi du temps : lecture d'un calendrier .ics (lecture seule, hôtes autorisés uniquement)
    if (url.pathname === '/ics') {
      let target;
      try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return reply({ error: 'Adresse de calendrier invalide' }, 400); }
      const hosts = [...ICS_HOSTS, ...String(env.ICS_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)];
      const h = target.hostname.toLowerCase();
      if (target.protocol !== 'https:' || !hosts.some((x) => h === x || h.endsWith('.' + x))) return reply({ error: `Hébergeur de calendrier non autorisé (${h}) : ajoute-le à la variable ICS_HOSTS du relais` }, 400);
      const r = await fetch(target.toString(), { headers: { 'User-Agent': UA, Accept: 'text/calendar, */*' } });
      const text = await r.text();
      if (!r.ok || !/BEGIN:VCALENDAR/i.test(text)) return reply({ error: r.ok ? 'Cette adresse ne renvoie pas un calendrier (.ics). Vérifie le lien.' : `Le serveur du calendrier a répondu ${r.status}` }, 502);
      return new Response(text, { status: 200, headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    // Téléchargement d'un fichier audio depuis un lien signé fourni par Plaud
    if (url.pathname === '/audio') {
      let target;
      try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return reply({ error: 'Lien invalide' }, 400); }
      if (target.protocol !== 'https:' || !AUDIO_HOSTS.test(target.hostname)) return reply({ error: 'Hôte non autorisé' }, 400);
      const r = await fetch(target.toString(), { headers: { 'User-Agent': UA } });
      const h = { ...cors, 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg' };
      if (r.headers.get('Content-Length')) h['Content-Length'] = r.headers.get('Content-Length');
      return new Response(r.body, { status: r.status, headers: h });
    }

    // Appels à l'API Plaud : /api/<chemin>?region=eu|us
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice(4);
      if (!ALLOWED_PATHS.some((re) => re.test(path))) return reply({ error: 'Chemin non autorisé' }, 400);
      const auth = request.headers.get('Authorization') || '';
      if (!/^bearer\s+\S+/i.test(auth)) return reply({ error: 'Jeton Plaud manquant' }, 401);
      const base = API[url.searchParams.get('region')] || API.eu;
      const qs = new URLSearchParams(url.search); qs.delete('region');
      const q = qs.toString();
      const r = await fetch(base + path + (q ? '?' + q : ''), {
        headers: { Authorization: 'Bearer ' + auth.replace(/^bearer\s+/i, ''), 'User-Agent': UA, Accept: 'application/json, */*' },
      });
      const h = { ...cors, 'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream' };
      if (r.headers.get('Content-Length')) h['Content-Length'] = r.headers.get('Content-Length');
      return new Response(r.body, { status: r.status, headers: h });
    }

    return reply({ error: 'Introuvable' }, 404);
  },
};
