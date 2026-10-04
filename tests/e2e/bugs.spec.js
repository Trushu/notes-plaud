// @ts-check
'use strict';
// Bugs corrigés au chantier 2 : un test par bug, qui échouait avant la correction
const { test, expect, mp3, useSettings, seedNotes, note, SUMMARY } = require('./fixtures');

const H = 3600000;
const pad = (x) => String(x).padStart(2, '0');
const stamp = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; };
const vevent = (uid, title, a, b) => ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART:${stamp(a)}`, `DTEND:${stamp(b)}`, 'CATEGORIES:INFOB231', 'END:VEVENT'];
const vcal = (...evs) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...evs.flat(), 'END:VCALENDAR'].join('\r\n');

/** Simule un fichier reçu par le menu « Partager » d'Android (ce que fait le service worker), puis ouvre l'app. */
async function shareFile(page, { name, type, bytes }) {
  await page.evaluate(async ({ name, type, bytes }) => {
    const buf = new Uint8Array(bytes).buffer;
    // @ts-ignore
    await dbRun('pending', 'readwrite', (s) => s.put({ shared: { buf, name, type, size: buf.byteLength }, info: { at: Date.now(), files: [{ name, type, size: buf.byteLength }], texts: [], error: '' } }, 'shared'));
  }, { name, type, bytes: [...bytes] });
  await page.goto('./?shared=1');
}

test.describe('Recherche', () => {
  test('sans accent : la transcription ouverte montre bien le passage trouvé', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await seedNotes(page, [note({ id: 'nA', title: 'Algorithmique', segments: [{ start: 0, end: 5, text: 'Bonjour.' }, { start: 65, end: 70, text: 'La récursivité & les piles.' }] })]);
    await page.locator('#search').fill('recursivite');
    await expect(page.locator('#notesList .item')).toHaveCount(1);
    await page.locator('#notesList .item').click();
    await expect(page.locator('#noteTr .seg')).toHaveCount(1);
    await expect(page.locator('#noteTr .seg mark')).toHaveText('récursivité');
    // chercher « amp » ne casse plus l'affichage du « & »
    await page.locator('#trSearch').fill('les piles');
    await expect(page.locator('#noteTr .seg span')).toHaveText('La récursivité & les piles.');
  });
});

test.describe('Fichier partagé depuis une autre app', () => {
  test('un .ics partagé garde l\'historique des séances passées', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const now = Date.now();
    const old = vcal(vevent('old', 'Algorithmique', now - 30 * 24 * H, now - 30 * 24 * H + 2 * H));
    await page.evaluate((t) => saveAgendaText(t, 'url'), old);   // historique déjà dans l'app
    const fresh = vcal(vevent('new', 'Algorithmique', now + 24 * H, now + 26 * H));
    page.once('dialog', (d) => d.accept());   // « Importer … comme emploi du temps ? » (chantier 3)
    await shareFile(page, { name: 'calendrier.ics', type: 'text/calendar', bytes: Buffer.from(fresh) });
    await expect(page.locator('#toast')).toContainText('Emploi du temps importé');
    const uids = await page.evaluate(() => AG.events.map((e) => e.uid));
    expect(uids).toEqual(['old', 'new']);
  });

  test('un enregistrement partagé pendant un cours est rangé dans sa matière', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const start = Date.UTC(2026, 9, 1, 6, 0);   // 8 h à Bruxelles
    await page.evaluate((t) => saveAgendaText(t, 'url'), vcal(vevent('c1', 'Algorithmique', start, start + 2 * H)));
    await shareFile(page, { name: '2026-10-01 08-30.mp3', type: 'audio/mpeg', bytes: mp3(1) });
    await expect(page.locator('#noteTitle')).toContainText('Les graphes');
    const n = await page.evaluate(async () => (await loadNotes())[0]);
    expect(n.course && n.course.key).toBe('INFOB231');
  });
});

test.describe('Fichier choisi pendant un traitement', () => {
  test('il est gardé et traité ensuite, au lieu d\'être ignoré', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    let release;
    const gate = new Promise((r) => { release = r; });
    mocks.fail = async (route, kind) => { if (kind === 'transcribe' && mocks.calls.transcribe.length === 1) { await gate; } return false; };
    await page.goto('./');
    await page.evaluate(() => { CONFIG.tpmBudget = 1e9; });   // pas de pause « limite gratuite » de Groq entre les deux résumés
    await page.locator('#fileInput').setInputFiles({ name: 'premier.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect(page.locator('#v-job')).toBeVisible();
    await page.locator('#backBtn').click();
    await page.locator('#fileInput').setInputFiles({ name: 'second.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect(page.locator('#toast')).toContainText('Fichier gardé');
    release();
    await expect.poll(() => mocks.calls.transcribe.length, { timeout: 15000 }).toBe(2);
    await expect.poll(async () => page.evaluate(async () => (await loadNotes()).map((n) => n.status).join()), { timeout: 15000 }).toBe('ok,ok');
  });
});

test.describe('Réseau', () => {
  test('hors connexion : le traitement attend le retour du réseau au lieu d\'échouer', async ({ page, context, mocks }) => {
    test.setTimeout(60000);
    await useSettings(page, { key: 'gsk_test' });
    let offline = false;
    // hors connexion : navigator.onLine passe à false et les appels échouent
    mocks.fail = async (route) => { if (offline) { await route.abort('internetdisconnected'); return true; } return false; };
    await page.goto('./');
    offline = true; await context.setOffline(true);
    await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect(page.locator('#jobStatus')).toContainText('Hors connexion', { timeout: 15000 });
    await page.waitForTimeout(12000);   // avant, le traitement abandonnait au bout de 10 s
    await expect(page.locator('#jobError')).toBeHidden();
    offline = false; await context.setOffline(false);
    await expect(page.locator('#noteTitle')).toContainText('Les graphes', { timeout: 15000 });
  });

  test('téléchargement Plaud bloqué : abandon après le délai, l\'import n\'est pas figé', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test', prelay: 'https://relais.test', ptoken: 'a.b.c', pauto: false });
    mocks.plaud.list = [{ id: 'rec1', filename: 'Cours bloqué', start_time: Date.now() - H, duration: 60000 }];
    mocks.fail = async (route) => (new URL(route.request().url()).pathname === '/audio' ? new Promise(() => {}) : false);   // ne répond jamais
    await page.goto('./');
    await page.evaluate(() => { CONFIG.dlTimeout = 1500; });
    await page.locator('#plaudBtn').click();
    await page.locator('#pList .mrow input').check();
    await page.locator('#pGo').click();
    await expect(page.locator('#pErr')).toContainText('pas encore prête', { timeout: 15000 });
    expect(await page.evaluate(() => plaudBusy)).toBe(false);
  });

  test('calendrier qui ne répond pas : la synchronisation s\'arrête avec un message', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test', prelay: 'https://relais.test' });
    await page.route('https://webcampus.unamur.be/**', () => new Promise(() => {}));   // serveur muet
    mocks.fail = async (route) => (new URL(route.request().url()).pathname === '/ics' ? new Promise(() => {}) : false);
    await page.goto('./');
    await page.evaluate(() => { CONFIG.netTimeout = 1000; });
    await page.locator('#settingsBtn').click();
    await page.locator('#sIcsUrl').fill('https://webcampus.unamur.be/calendar/export.ics');
    await page.locator('#agSync').click();
    await expect(page.locator('#agState')).toContainText('ne répond pas', { timeout: 10000 });
    expect(await page.evaluate(() => syncing)).toBe(false);
  });
});

test.describe('Reprise après interruption', () => {
  test('résumé d\'un long enregistrement : les parties déjà résumées ne sont pas refaites', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    const segments = Array.from({ length: 6 }, (_, i) => ({ start: i * 60, end: i * 60 + 50, text: `Passage numéro ${i + 1} du cours, assez long pour remplir un morceau.` }));
    let failPart3 = true;
    mocks.summary = (prompt) => (/^Voici la partie/.test(prompt) ? '- point' : SUMMARY);
    mocks.fail = async (route, kind) => {
      if (kind === 'chat' && failPart3 && /^Voici la partie 3\//.test(route.request().postDataJSON().messages[0].content)) {
        await route.fulfill({ status: 401, json: { error: { message: 'Invalid API Key' } } }); return true;
      }
      return false;
    };
    await page.goto('./');
    await page.evaluate(() => { CONFIG.singleShotChars = 100; CONFIG.chunkChars = 140; CONFIG.tpmBudget = 1e9; });
    await seedNotes(page, [note({ id: 'nL', title: 'Long cours', status: 'resume', summary: '', segments, duration: 360 })]);
    await page.evaluate(async () => { run(await db.get('nL')); });
    await expect(page.locator('#jobErrorMsg')).toContainText('Clé API Groq refusée');
    const parts = () => mocks.calls.chat.map((c) => (/^Voici la partie (\d+)\//.exec(c.prompt) || [])[1]).filter(Boolean);
    expect(parts()).toEqual(['1', '2', '3']);

    failPart3 = false;
    await page.locator('#jobRetry').click();
    await expect(page.locator('#noteTitle')).toContainText('Les graphes');
    expect(parts()).toEqual(['1', '2', '3', '3']);   // seules les parties manquantes sont refaites
    const n = await page.evaluate(async () => db.get('nL'));
    expect(n.sumPartial).toBeUndefined();
  });
});

test.describe('Stockage', () => {
  test('stockage plein : message clair au lieu d\'un fichier perdu en silence', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await page.evaluate(() => { db.put = () => Promise.reject(new DOMException('Quota exceeded', 'QuotaExceededError')); });
    await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect(page.locator('#shareDiag')).toBeVisible();
    await expect(page.locator('#shareDiag')).toContainText('Plus assez de place');
    expect(mocks.calls.transcribe).toHaveLength(0);
  });

  test('stockage illisible : l\'accueil l\'explique au lieu de rester vide', async ({ page, mocks }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => ({
        open() { const r = {}; setTimeout(() => { r.error = new DOMException('The user denied permission to access the database.', 'SecurityError'); if (r.onerror) r.onerror(); }, 10); return r; },
      }) });
    });
    await page.goto('./');
    await expect(page.locator('#notesList')).toContainText('Impossible de lire tes notes');
  });
});
