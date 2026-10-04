// @ts-check
'use strict';
/*
 * Outils communs aux tests de bout en bout :
 * - API simulées (Groq, Gemini, relais Plaud) : aucun appel ne sort de la machine de test ;
 * - réglages et notes préparés à l'avance ;
 * - petits fichiers audio valides générés à la volée.
 */
const base = require('@playwright/test');

const SUMMARY = `# Les graphes et la récursivité
## Résumé
Le cours présente les graphes orientés et la récursivité.
## Points clés
- Un graphe est un ensemble de sommets et d'arêtes.
- La formule $T(n) = 2T(n/2) + n$ décrit le tri fusion.
## À retravailler à la maison
- [ ] Refaire l'exercice 3 du TD 2 📅 2026-10-08
- [ ] Relire le chapitre 4 sur les récurrences
## Questions pour réviser
- Qu'est-ce qu'un graphe ? → Un ensemble de sommets reliés par des arêtes
Type : cours
Tags : algorithmique, graphes`;

const TRANSCRIPT = {
  text: 'Bonjour à tous. Aujourd\'hui on parle de récursivité et de graphes.',
  language: 'french',
  duration: 95,
  segments: [
    { start: 0, end: 4.2, text: ' Bonjour à tous.', no_speech_prob: 0.01, avg_logprob: -0.2 },
    { start: 4.2, end: 40, text: ' Aujourd\'hui on parle de récursivité et de graphes orientés.', no_speech_prob: 0.01, avg_logprob: -0.2 },
    { start: 40, end: 95, text: ' Pour la semaine prochaine, refaites l\'exercice 3 du TD 2.', no_speech_prob: 0.01, avg_logprob: -0.2 },
  ],
};

class Mocks {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.calls = { transcribe: [], chat: [], gemini: [], plaud: [] };
    /** @type {(i: number) => any} réponse de Groq Whisper pour le i-ème envoi */
    this.transcript = () => TRANSCRIPT;
    /** @type {(prompt: string) => string} réponse des IA de résumé (Groq ou Gemini) */
    this.summary = () => SUMMARY;
    /** @type {null | ((route: import('@playwright/test').Route, kind: string) => Promise<boolean>)} pour simuler des pannes */
    this.fail = null;
    this.plaud = { list: [], audio: {}, version: 3 };
    /** violations de la politique de sécurité (CSP) et erreurs JavaScript non rattrapées, vérifiées à la fin de chaque test */
    this.cspErrors = [];
    this.pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) this.cspErrors.push(m.text()); });
    page.on('pageerror', (e) => this.pageErrors.push(e.message));
  }

  async install() {
    const { page } = this;
    // polices et KaTeX : hors ligne pendant les tests (l'app sait s'en passer)
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route(/cdn\.jsdelivr\.net/, (r) => r.abort());
    await page.route(/api\.(cerebras\.ai|mistral\.ai)/, (r) => r.abort());

    await page.route('https://api.groq.com/openai/v1/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/audio/transcriptions')) {
        const body = (route.request().postDataBuffer() || Buffer.alloc(0)).toString('latin1');
        const field = (name) => { const m = new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(body); return m ? m[1] : null; };
        const fm = /name="file"; filename="([^"]*)"(?:\r\nContent-Type: ([^\r]*))?\r\n\r\n/.exec(body);
        const head = fm ? body.slice(fm.index + fm[0].length, fm.index + fm[0].length + 44) : '';
        this.calls.transcribe.push({ model: field('model'), language: field('language'), prompt: field('prompt'), filename: fm ? fm[1] : null, type: fm ? fm[2] : null,
          size: body.length, riff: head.slice(0, 4) === 'RIFF' ? Buffer.from(head, 'latin1').readUInt32LE(40) : null });
        if (this.fail && await this.fail(route, 'transcribe')) return;
        return route.fulfill({ json: this.transcript(this.calls.transcribe.length - 1) });
      }
      if (url.endsWith('/models')) {   // « Tester la clé » : clé valide si elle commence par gsk_ (sauf gsk_bad)
        const k = (route.request().headers().authorization || '').replace(/^Bearer /, '');
        this.calls.models = (this.calls.models || []).concat({ p: 'groq', k });
        if (this.fail && await this.fail(route, 'models')) return;
        return /^gsk_/.test(k) && k !== 'gsk_bad' ? route.fulfill({ json: { data: [{ id: 'whisper-large-v3' }] } }) : route.fulfill({ status: 401, json: { error: { message: 'Invalid API Key' } } });
      }
      if (url.endsWith('/chat/completions')) {
        const body = route.request().postDataJSON();
        const prompt = body.messages[0].content;
        this.calls.chat.push({ model: body.model, prompt, auth: route.request().headers().authorization });
        if (this.fail && await this.fail(route, 'chat')) return;
        return route.fulfill({ json: { choices: [{ message: { role: 'assistant', content: this.summary(prompt) } }] } });
      }
      return route.fulfill({ status: 404, json: { error: { message: 'inconnu' } } });
    });

    await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
      if (route.request().method() === 'GET') {   // « Tester la clé »
        const k = route.request().headers()['x-goog-api-key'] || '';
        this.calls.models = (this.calls.models || []).concat({ p: 'gemini', k });
        if (this.fail && await this.fail(route, 'models')) return;
        return /^AIza/.test(k) && k !== 'AIza_bad' ? route.fulfill({ json: { models: [{ name: 'models/gemini' }] } }) : route.fulfill({ status: 400, json: { error: { message: 'API key not valid. Please pass a valid API key.' } } });
      }
      const body = route.request().postDataJSON();
      const model = decodeURIComponent(/models\/([^:]+):/.exec(route.request().url())[1]);
      const prompt = body.contents[0].parts.map((p) => p.text || '').join('');
      this.calls.gemini.push({ model, prompt, key: route.request().headers()['x-goog-api-key'] });
      if (this.fail && await this.fail(route, 'gemini')) return;
      return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: this.summary(prompt) }] }, finishReason: 'STOP' }] } });
    });

    await page.route('https://relais.test/**', async (route) => {
      const url = new URL(route.request().url());
      this.calls.plaud.push({ path: url.pathname, query: url.search, auth: route.request().headers().authorization });
      if (this.fail && await this.fail(route, 'plaud')) return;
      const cors = { 'Access-Control-Allow-Origin': '*' };
      if (url.pathname === '/ping') return route.fulfill({ headers: cors, json: { ok: true, relay: 'notes-plaud', version: this.plaud.version } });
      if (url.pathname === '/api/file/simple/web') return route.fulfill({ headers: cors, json: { status: 0, data_file_list: this.plaud.list } });
      let m = /^\/api\/file\/temp-url\/(.+)$/.exec(url.pathname);
      if (m) return route.fulfill({ headers: cors, json: { status: 0, temp_url: `https://bucket.s3.amazonaws.com/${m[1]}.mp3?sig=1` } });
      if (url.pathname === '/audio') {
        const id = /\/([^/]+)\.mp3/.exec(url.searchParams.get('u') || '')[1];
        const buf = this.plaud.audio[id];
        return buf ? route.fulfill({ headers: { ...cors, 'Content-Type': 'audio/mpeg' }, body: buf }) : route.fulfill({ status: 404, headers: cors, body: '' });
      }
      return route.fulfill({ status: 404, headers: cors, json: { error: 'Introuvable' } });
    });
  }
}

/** Sert la vraie bibliothèque KaTeX (dossier node_modules) à la place du CDN ; tamper : fichier modifié. */
async function serveKatex(page, { tamper = false } = {}) {
  const dir = require('node:path').join(__dirname, '..', 'node_modules', 'katex', 'dist');
  await page.unroute(/cdn\.jsdelivr\.net/);
  await page.route(/cdn\.jsdelivr\.net\/npm\/katex@[^/]+\/dist\/(.+)$/, (route) => {
    const file = /dist\/([^?]+)/.exec(route.request().url())[1];
    let body = require('node:fs').readFileSync(require('node:path').join(dir, file));
    if (tamper && file === 'katex.min.js') body = Buffer.concat([body, Buffer.from('\n;window.__pirate = 1;')]);
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'font/woff2';
    return route.fulfill({ body, headers: { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' } });
  });
}

/** Un MP3 valide (MPEG-1 Layer III, 128 kb/s, 44,1 kHz) fait de trames silencieuses, précédé d'une étiquette ID3. */
function mp3(seconds = 2) {
  const frame = Buffer.alloc(417); frame[0] = 0xFF; frame[1] = 0xFB; frame[2] = 0x90; frame[3] = 0x00;
  const n = Math.ceil(seconds * 44100 / 1152);
  const id3 = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]);
  return Buffer.concat([id3, ...Array.from({ length: n }, () => frame)]);
}

/** Un WAV PCM 16 bits mono silencieux. */
function wav(seconds = 1, rate = 16000, channels = 1) {
  const data = Buffer.alloc(Math.round(seconds * rate) * 2 * channels);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2 * channels, 28); h.writeUInt16LE(2 * channels, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Réglages enregistrés avant le premier chargement de la page (une seule fois par onglet). */
async function useSettings(page, settings) {
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('__np-seeded')) return;
    sessionStorage.setItem('__np-seeded', '1');
    localStorage.setItem('np-settings', JSON.stringify(s));
  }, settings);
}

/** Ajoute des notes dans IndexedDB puis réaffiche l'accueil. */
async function seedNotes(page, notes) {
  await page.evaluate(async (list) => {
    // @ts-ignore — fonctions globales de l'app
    for (const n of list) await db.put(n);
    // @ts-ignore
    await renderHome();
  }, notes);
}

/** Une note complète, prête à l'emploi. */
function note(over = {}) {
  const created = over.created || new Date(2026, 9, 1, 8, 30).getTime();
  return {
    id: 'n' + Math.random().toString(36).slice(2, 9), created, addedAt: created, fileName: 'cours.mp3', size: 1000,
    title: 'Note de test', status: 'ok', summary: '## Résumé\nTexte du résumé.', duration: 600, tags: [],
    segments: [{ start: 0, end: 10, text: 'Bonjour.' }], ...over,
  };
}

const test = base.test.extend({
  mocks: async ({ page }, use) => {
    const m = new Mocks(page);
    await m.install();
    await use(m);
    base.expect(m.cspErrors, 'violation de la politique de sécurité (CSP)').toEqual([]);
    base.expect(m.pageErrors, 'erreur JavaScript non rattrapée').toEqual([]);
  },
});

module.exports = { test, expect: base.expect, Mocks, mp3, wav, useSettings, seedNotes, note, serveKatex, SUMMARY, TRANSCRIPT };
