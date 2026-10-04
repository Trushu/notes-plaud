// @ts-check
'use strict';
// Sécurité : contenus piégés (IA, transcription, calendrier, sauvegarde), relais, KaTeX
const { test, expect, mp3, useSettings, seedNotes, note, serveKatex } = require('./fixtures');

const XSS = (k) => `<img src=x onerror="window.__xss=${k}">`;
const noXss = (page) => page.evaluate(() => window.__xss);

test.describe('Contenus piégés : rien n\'est exécuté, tout s\'affiche en texte', () => {
  test('réponse de l\'IA et transcription', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    mocks.transcript = () => ({ duration: 10, language: 'fr', segments: [{ start: 0, end: 5, text: `Bonjour ${XSS(1)} <script>window.__xss=2</script>`, no_speech_prob: 0, avg_logprob: 0 }] });
    mocks.summary = () => `# Titre ${XSS(3)}\n## Résumé\n<svg onload="window.__xss=4"></svg> **${XSS(5)}** $\\href{javascript:window.__xss=6}{lien}$\n## À faire\n- [ ] ${XSS(7)} 📅 2026-10-08\n| ${XSS(8)} | a |\n|---|---|\n| <iframe src="javascript:window.__xss=9"></iframe> | b |\n## Questions pour réviser\n- ${XSS(10)} ? → ${XSS(11)}\nTags : ${XSS(12)}`;
    await page.goto('./');
    await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect(page.locator('#noteTitle')).toContainText('<img src=x onerror=');
    await expect(page.locator('#noteSum')).toContainText('<svg onload=');
    await page.locator('#noteSum details summary').first().click();
    await page.getByRole('tab', { name: 'Transcription' }).click();
    await expect(page.locator('#noteTr')).toContainText('<script>window.__xss=2</script>');
    await page.locator('#trSearch').fill('img');
    await expect(page.locator('#noteTr .seg mark').first()).toHaveText('img');
    await page.locator('#backBtn').click();
    await page.locator('#search').fill('onerror');
    await expect(page.locator('#notesList .item')).toHaveCount(1);
    await page.locator('#tabbar [data-v=tasks]').click();
    await expect(page.locator('#taskList')).toContainText('<img src=x');
    expect(await noXss(page)).toBeUndefined();
    expect(await page.locator('img[src="x"], iframe, svg[onload]').count()).toBe(0);
    expect(await page.locator('script:not([src])').count()).toBe(2);   // seulement les deux scripts de l'app
  });

  test('calendrier .ics', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const now = Date.now(), st = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    // cours en cours AUJOURD'HUI quelle que soit l'heure (« dans 1 h » tombait le lendemain après 23 h)
    const t0 = Math.max(await page.evaluate(() => dayStart(Date.now())) + 60000, now - 1800000);
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', `UID:${XSS(20).replace(/"/g, '')}`, `SUMMARY:${XSS(21)}`, `LOCATION:${XSS(22)}`, `DESCRIPTION:${XSS(23)}\\nProf ${XSS(24)}`,
      `CATEGORIES:${XSS(25).replace(/,/g, '')}`, `DTSTART:${st(t0)}`, `DTEND:${st(now + 3600000)}`, 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:d', `SUMMARY:${XSS(26)} est dû`, `DTSTART:${st(now + 86400000)}`, `DTEND:${st(now + 86400000)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    await page.locator('#tabbar [data-v=courses]').click();
    await page.locator('#icsInput').setInputFiles({ name: 'cours.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
    await expect(page.locator('#crsBody .crs-now')).toContainText('<img src=x');
    await page.locator('#crsBody .ev', { hasText: 'xss=21' }).first().click();
    await expect(page.locator('#sheet')).toContainText('<img src=x');
    await page.locator('#evMat').click();
    await expect(page.locator('#courseBody h1')).toContainText('<img');
    await page.locator('#backBtn').click();
    await page.locator('#tabbar [data-v=tasks]').click();
    await expect(page.locator('#taskList')).toContainText('est dû');
    expect(await noXss(page)).toBeUndefined();
  });

  test('fausse sauvegarde : identifiants piégés écartés, clés et relais demandés avant d\'être repris', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_moi' });
    await page.goto('./');
    const backup = {
      app: 'notes-plaud', format: 1, notes: [
        { id: `x" autofocus onfocus="window.__xss=30" x="`, title: 'Piège', status: 'ok', summary: '## Résumé\nx', created: Date.now() },
        { id: 'nOk', title: `Note ${XSS(31)}`, status: 'ok', summary: `## Résumé\n${XSS(32)}`, created: Date.now(), duration: 600,
          segments: [{ start: 0, end: 5, text: 'Bonjour' }, { start: 70, end: 75, text: 'Suite' }],
          chapters: [{ t: `"><img src=x onerror="window.__xss=33">`, title: XSS(34) }, { t: 60, title: 'Deux' }],
          marks: [`"><img src=x onerror="window.__xss=35">`, 70], photos: [{ id: `p" onclick="window.__xss=36`, t: 3 }],
          course: { key: 'K', name: XSS(37), kind: `"><img src=x onerror="window.__xss=38">`, start: Date.now(), end: Date.now() } },
      ],
      settings: { pregion: XSS(39), prelay: 'https://relais-pirate.example', ptoken: 'eyJ.jeton.pirate', gkey: 'AIza_pirate', ctx: 'Contexte restauré', theme: '"><img>' },
    };
    let asked = '';
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await page.locator('#settingsBtn').click();
    await page.locator('#rsInput').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(page.locator('#toast')).toContainText('1 note restaurée');
    await expect(page.locator('#toast')).toContainText('1 ignorée');
    expect(asked).toContain('relais-pirate.example');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('np-settings')));
    expect(s.prelay).toBeUndefined();
    expect(s.ptoken).toBeUndefined();
    expect(s.gkey || '').toBe('');
    expect(s.pregion).toBeUndefined();
    expect(s.theme || 'auto').toBe('auto');
    expect(s.ctx).toBe('Contexte restauré');
    expect(s.key).toBe('gsk_moi');

    await page.locator('#backBtn').click();
    await page.locator('#notesList .item').click();
    await page.getByRole('tab', { name: 'Transcription' }).click();
    await expect(page.locator('#chapBox')).toContainText('<img src=x');
    await page.locator('#trMarks button').first().click();
    expect(await noXss(page)).toBeUndefined();
  });

  test('sauvegarde de confiance : les clés sont reprises si l\'utilisateur accepte', async ({ page, mocks }) => {
    await page.goto('./');
    page.once('dialog', (d) => d.accept());
    await page.locator('#settingsBtn').click();
    const backup = { app: 'notes-plaud', notes: [], settings: { key: 'gsk_a', prelay: 'https://plaud.moi.workers.dev', ptoken: 'eyJ.a.b', pregion: 'us' } };
    await page.locator('#rsInput').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(page.locator('#toast')).toContainText('0 note restaurée');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('np-settings')));
    expect([s.key, s.prelay, s.ptoken, s.pregion]).toEqual(['gsk_a', 'https://plaud.moi.workers.dev', 'eyJ.a.b', 'us']);
  });
});

test.describe('Relais et jeton Plaud', () => {
  test('un relais en http est refusé : le jeton ne part jamais en clair', async ({ page, mocks }) => {
    let leaked = false;
    await page.route('http://relais.test/**', (r) => { leaked = true; return r.abort(); });
    await useSettings(page, { key: 'gsk_test', prelay: 'http://relais.test', ptoken: 'eyJ.a.b' });   // ancien réglage
    await page.goto('./');
    await page.locator('#settingsBtn').click();
    await page.locator('#pTest').click();
    await expect(page.locator('#pTestState')).toContainText('https://');
    await page.locator('#sSave').click();
    await expect(page.locator('#toast')).toContainText('doit commencer par https://');
    await expect(page.locator('#v-settings')).toBeVisible();
    await page.waitForTimeout(1800);   // l'import automatique ne doit rien envoyer non plus
    expect(leaked).toBe(false);
  });

  test('relais d\'une ancienne version : invitation à le mettre à jour', async ({ page, mocks }) => {
    mocks.plaud.version = 2;
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await page.locator('#settingsBtn').click();
    await page.locator('#sPRelay').fill('https://relais.test');
    await page.locator('#sPToken').fill('eyJ.a.b');
    await page.locator('#pTest').click();
    await expect(page.locator('#pTestState')).toContainText('ancienne version');
  });

  test('le jeton n\'est envoyé qu\'au relais, et seulement pour l\'API Plaud', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test', prelay: 'https://relais.test', ptoken: 'eyJ.secret.jwt', pauto: false });
    mocks.plaud.list = [{ id: 'r1', filename: 'A', start_time: Date.now() - 3600000, duration: 60000 }];
    mocks.plaud.audio = { r1: mp3(1) };
    await page.goto('./');
    await page.locator('#plaudBtn').click();
    await page.locator('#pList .mrow input').check();
    await page.locator('#pGo').click();
    await expect(page.locator('#notesList .item')).toHaveCount(1, { timeout: 15000 });
    for (const c of mocks.calls.plaud) expect([c.path, c.auth]).toEqual([c.path, c.path.startsWith('/api/') ? 'Bearer eyJ.secret.jwt' : undefined]);
    expect(mocks.calls.chat.every((c) => !JSON.stringify(c).includes('eyJ.secret'))).toBe(true);
  });
});

test.describe('Fichier partagé', () => {
  test('un calendrier reçu par « Partager » n\'est importé qu\'après confirmation', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:z\r\nSUMMARY:Faux cours\r\nDTSTART:20261010T080000Z\r\nDTEND:20261010T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
    await page.evaluate(async (t) => {
      const buf = new TextEncoder().encode(t).buffer;
      await dbRun('pending', 'readwrite', (s) => s.put({ shared: { buf, name: 'piege.ics', type: 'text/calendar', size: buf.byteLength }, info: {} }, 'shared'));
    }, ics);
    let asked = '';
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await page.goto('./?shared=1');
    await expect(page.locator('#v-home')).toBeVisible();
    expect(asked).toContain('piege.ics');
    expect(await page.evaluate(() => AG.events.length)).toBe(0);
  });
});

test.describe('KaTeX', () => {
  const formula = (page) => seedNotes(page, [note({ id: 'nM', summary: '## Résumé\nLa formule $x^2 + y^2$.' })]).then(() => page.locator('#notesList .item').click());

  test('la bibliothèque officielle (empreinte vérifiée) dessine les formules', async ({ page, mocks }) => {
    await serveKatex(page);
    await page.goto('./');
    await formula(page);
    await expect(page.locator('#noteSum .katex')).toHaveCount(1);
  });

  test('un fichier KaTeX modifié sur le CDN est refusé', async ({ page, mocks }) => {
    await serveKatex(page, { tamper: true });
    const blocked = [];
    page.on('console', (m) => { if (/integrity/i.test(m.text())) blocked.push(m.text()); });
    await page.goto('./');
    await formula(page);
    await expect(page.locator('#noteSum .math')).toContainText('$x^2 + y^2$');
    await expect.poll(() => blocked.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => [window.katex, window.__pirate])).toEqual([undefined, undefined]);
  });
});
