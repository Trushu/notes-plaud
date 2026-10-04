'use strict';
// Relais Cloudflare (relais-plaud-cloudflare.js) : contrôle d'origine, chemins autorisés, redirections, en-têtes
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('../helpers/load-app');

const ORIGIN = 'https://moi.github.io';
const ENV = { ALLOWED_ORIGIN: ORIGIN + '/' };
let relay;
const calls = [];
let upstream = () => new Response('{}', { headers: { 'Content-Type': 'application/json' } });

test.before(async () => {
  // le relais est un module ES (format Cloudflare) : on en charge une copie .mjs
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'relais-')), 'relais.mjs');
  fs.copyFileSync(path.join(ROOT, 'relais-plaud-cloudflare.js'), tmp);
  relay = (await import(pathToFileURL(tmp).href)).default;
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return upstream(String(url), init); };
});
test.beforeEach(() => { calls.length = 0; upstream = () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }); });

const call = (p, { origin = ORIGIN, method = 'GET', headers = {}, env = ENV } = {}) =>
  relay.fetch(new Request('https://relais.workers.dev' + p, { method, headers: { ...(origin ? { Origin: origin } : {}), ...headers } }), env);
const json = async (r) => JSON.parse(await r.text());

test.describe('Contrôle d\'origine', () => {
  test('ton site : accepté, avec les en-têtes CORS', async () => {
    const r = await call('/ping');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.deepEqual(await json(r), { ok: true, relay: 'notes-plaud', version: 3 });
  });

  test('autre site, ou aucun en-tête Origin : refusé', async () => {
    for (const origin of ['https://pirate.example', 'https://moi.github.io.pirate.example', '']) {
      const r = await call('/api/user/me', { origin, headers: { Authorization: 'Bearer abc' } });
      assert.equal(r.status, 403, origin);
      assert.match((await json(r)).error, /Origine refusée/);
    }
    assert.equal(calls.length, 0);
  });

  test('ALLOWED_ORIGIN vide : tout est refusé (avant : tout était accepté)', async () => {
    const r = await call('/api/user/me', { env: {}, headers: { Authorization: 'Bearer abc' } });
    assert.equal(r.status, 403);
    assert.match((await json(r)).error, /ALLOWED_ORIGIN/);
    assert.equal(calls.length, 0);
  });

  test('pré-requête CORS', async () => {
    assert.equal((await call('/api/user/me', { method: 'OPTIONS' })).status, 204);
    assert.equal((await call('/api/user/me', { method: 'OPTIONS', origin: 'https://pirate.example' })).status, 403);
  });

  test('seules les lectures (GET) sont permises', async () => {
    assert.equal((await call('/api/user/me', { method: 'POST' })).status, 405);
  });

  test('plusieurs sites autorisés', async () => {
    const env = { ALLOWED_ORIGIN: 'https://a.github.io, https://b.github.io' };
    assert.equal((await call('/ping', { origin: 'https://b.github.io', env })).status, 200);
  });
});

test.describe('API Plaud', () => {
  test('chemin autorisé : transmis à Plaud avec le jeton, la région choisit le serveur', async () => {
    const r = await call('/api/file/temp-url/abc-123?is_opus=false&region=us', { headers: { Authorization: 'Bearer eyJ.t.k' } });
    assert.equal(r.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.plaud.ai/file/temp-url/abc-123?is_opus=false');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer eyJ.t.k');
    assert.equal(calls[0].init.redirect, 'manual');
    assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  });

  test('chemins refusés (écriture, autres pages, chemins détournés)', async () => {
    for (const p of ['/api/file/delete/abc', '/api/user/me/../../admin', '/api/file/temp-url/..%2F..%2Fuser', '/api/file/simple/web/x', '/api//user/me']) {
      const r = await call(p, { headers: { Authorization: 'Bearer abc' } });
      assert.equal(r.status, 400, p);
    }
    assert.equal(calls.length, 0);
  });

  test('sans jeton : refusé', async () => {
    assert.equal((await call('/api/user/me')).status, 401);
  });

  test('redirection renvoyée par Plaud : jamais suivie (le jeton ne part pas ailleurs)', async () => {
    upstream = () => new Response(null, { status: 302, headers: { Location: 'https://pirate.example/vol' } });
    const r = await call('/api/user/me', { headers: { Authorization: 'Bearer abc' } });
    assert.equal(r.status, 502);
    assert.equal(calls.length, 1);
  });

  test('une réponse HTML n\'est pas renvoyée comme page web', async () => {
    upstream = () => new Response('<script>alert(1)</script>', { headers: { 'Content-Type': 'text/html' } });
    const r = await call('/api/user/me', { headers: { Authorization: 'Bearer abc' } });
    assert.equal(r.headers.get('Content-Type'), 'application/octet-stream');
    assert.match(r.headers.get('Content-Security-Policy'), /sandbox/);
  });
});

test.describe('Calendrier (/ics)', () => {
  const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR';
  test('hôte autorisé', async () => {
    upstream = () => new Response(ICS);
    const r = await call('/ics?u=' + encodeURIComponent('https://webcampus.unamur.be/calendar/export_execute.php?k=1'));
    assert.equal(r.status, 200);
    assert.equal(await r.text(), ICS);
  });

  test('hôte non autorisé, http, adresse invalide : refusés sans appel', async () => {
    for (const u of ['https://pirate.example/a.ics', 'http://webcampus.unamur.be/a.ics', 'https://unamur.be.pirate.example/a.ics', 'pas une adresse']) {
      const r = await call('/ics?u=' + encodeURIComponent(u));
      assert.equal(r.status, 400, u);
    }
    assert.equal(calls.length, 0);
  });

  test('redirection vers un hôte non autorisé : refusée', async () => {
    upstream = () => new Response(null, { status: 302, headers: { Location: 'https://pirate.example/x' } });
    const r = await call('/ics?u=' + encodeURIComponent('https://webcampus.unamur.be/a.ics'));
    assert.equal(r.status, 400);
    assert.match((await json(r)).error, /pirate\.example/);
    assert.equal(calls.length, 1);
  });

  test('redirection vers un hôte autorisé : suivie', async () => {
    upstream = (u) => (u.includes('/a.ics') ? new Response(null, { status: 301, headers: { Location: '/b.ics' } }) : new Response(ICS));
    const r = await call('/ics?u=' + encodeURIComponent('https://webcampus.unamur.be/a.ics'));
    assert.equal(r.status, 200);
    assert.deepEqual(calls.map((c) => c.url), ['https://webcampus.unamur.be/a.ics', 'https://webcampus.unamur.be/b.ics']);
  });

  test('autres hôtes ajoutés par la variable ICS_HOSTS', async () => {
    upstream = () => new Response(ICS);
    const r = await call('/ics?u=' + encodeURIComponent('https://ade.univ-exemple.fr/cal.ics'), { env: { ...ENV, ICS_HOSTS: 'ade.univ-exemple.fr' } });
    assert.equal(r.status, 200);
  });

  test('pas un calendrier : refusé', async () => {
    upstream = () => new Response('<html>connexion</html>');
    assert.equal((await call('/ics?u=' + encodeURIComponent('https://calendar.google.com/x.ics'))).status, 502);
  });
});

test.describe('Audio (/audio)', () => {
  test('lien signé autorisé : type forcé à de l\'audio ou des octets bruts', async () => {
    upstream = () => new Response('ID3...', { headers: { 'Content-Type': 'text/html' } });
    const r = await call('/audio?u=' + encodeURIComponent('https://bucket.s3.amazonaws.com/x.mp3?sig=1'));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'application/octet-stream');
    upstream = () => new Response('ID3...', { headers: { 'Content-Type': 'audio/mpeg' } });
    assert.equal((await call('/audio?u=' + encodeURIComponent('https://bucket.s3.amazonaws.com/x.mp3'))).headers.get('Content-Type'), 'audio/mpeg');
  });

  test('hôte non autorisé ou redirection vers un autre hôte : refusé', async () => {
    assert.equal((await call('/audio?u=' + encodeURIComponent('https://pirate.example/x.mp3'))).status, 400);
    upstream = () => new Response(null, { status: 302, headers: { Location: 'https://pirate.example/x' } });
    assert.equal((await call('/audio?u=' + encodeURIComponent('https://bucket.s3.amazonaws.com/x.mp3'))).status, 400);
  });

  test('chemin inconnu', async () => {
    assert.equal((await call('/autre')).status, 404);
  });
});
