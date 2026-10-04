// @ts-check
'use strict';
// Sauvegarde (fichier .json) et restauration sur un autre « téléphone » (navigateur vierge)
const fs = require('node:fs');
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

// On transmet le contenu du fichier plutôt que son chemin (les chemins accentués posent problème à Chromium)
const asUpload = (file) => ({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: fs.readFileSync(file) });

test.describe('Sauvegarde et restauration', () => {
  test('sauvegarde sans les clés, puis restauration sans rien écraser', async ({ page, browser, mocks }, info) => {
    await useSettings(page, { key: 'gsk_secret', gkey: 'AIza_secret', ptoken: 'eyJ.secret.jwt', icsUrl: 'https://webcampus.unamur.be/cal?key=perso', ctx: 'Étudiant en info' });
    await page.goto('./');
    await seedNotes(page, [
      note({ id: 'n1', title: 'Première note', chat: [{ q: 'Q ?', a: 'R', at: 1 }], cards: [{ id: 'c1', q: 'Q', a: 'A', box: 0, due: 0 }] }),
      note({ id: 'n2', title: 'Deuxième note', audio: undefined }),
    ]);
    await page.evaluate(() => addTask({ text: 'Tâche manuelle', tags: [], prio: 0 }));

    await page.locator('#settingsBtn').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bkBtn').click().then(() => page.locator('#bkDl').click())]);
    expect(download.suggestedFilename()).toMatch(/^notes-plaud-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    const file = info.outputPath('sauvegarde.json');
    await download.saveAs(file);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.app).toBe('notes-plaud');
    expect(data.notes.map((n) => n.id).sort()).toEqual(['__tasks__', 'n1', 'n2']);
    for (const k of ['key', 'gkey', 'ptoken', 'icsUrl']) expect(data.settings[k]).toBeUndefined();
    expect(data.settings.ctx).toBe('Étudiant en info');
    await expect(page.locator('#bkLast')).toContainText('Dernière sauvegarde');

    // autre téléphone : navigateur vierge
    const ctx2 = await browser.newContext({ ...info.project.use, serviceWorkers: 'block' });
    const page2 = await ctx2.newPage();
    await page2.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, (r) => r.abort());
    await page2.goto('./');
    await expect(page2.locator('#notesList')).toContainText('Aucune note pour l\'instant');
    await page2.locator('#settingsBtn').click();
    await page2.locator('#rsInput').setInputFiles(asUpload(file));
    await expect(page2.locator('#toast')).toContainText('3 notes restaurées');
    await page2.locator('#backBtn').click();
    await expect(page2.locator('#notesList .item')).toHaveCount(2);
    const restored = await page2.evaluate(async () => (await db.get('n1')));
    expect(restored.cards).toHaveLength(1);
    expect(restored.chat).toHaveLength(1);
    // les réglages manquants sont complétés, les clés ne sont pas là
    const s2 = await page2.evaluate(() => JSON.parse(localStorage.getItem('np-settings')));
    expect(s2.ctx).toBe('Étudiant en info');
    expect(s2.key || '').toBe('');

    // seconde restauration : rien n'est écrasé ni dupliqué
    await page2.locator('#settingsBtn').click();
    await page2.locator('#rsInput').setInputFiles(asUpload(file));
    await expect(page2.locator('#toast')).toContainText('0 note restaurée · 2 déjà présentes');
    const inbox = await page2.evaluate(async () => (await db.get('__tasks__')).summary);
    expect(inbox.match(/Tâche manuelle/g)).toHaveLength(1);
    await ctx2.close();
  });

  test('« inclure mes clés » les met dans le fichier', async ({ page, mocks }, info) => {
    await useSettings(page, { key: 'gsk_secret', ptoken: 'eyJ.secret.jwt' });
    await page.goto('./');
    await page.locator('#settingsBtn').click();
    await page.locator('#bkKeys').check();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bkBtn').click().then(() => page.locator('#bkDl').click())]);
    const file = info.outputPath('avec-cles.json');
    await download.saveAs(file);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.settings.key).toBe('gsk_secret');
    expect(data.settings.ptoken).toBe('eyJ.secret.jwt');
  });

  test('un fichier qui n\'est pas une sauvegarde est refusé', async ({ page, mocks }, info) => {
    await page.goto('./');
    await page.locator('#settingsBtn').click();
    const file = info.outputPath('autre.json');
    fs.writeFileSync(file, JSON.stringify({ hello: 'world' }));
    await page.locator('#rsInput').setInputFiles(asUpload(file));
    await expect(page.locator('#toast')).toContainText('n\'est pas une sauvegarde de Notes Plaud');
  });

  test('sauvegarde chiffrée par mot de passe : illisible sans lui, restaurée avec lui, préférences comprises', async ({ page, browser, mocks }, info) => {
    await useSettings(page, { key: 'gsk_secret' });
    await page.goto('./');
    await seedNotes(page, [note({ id: 'n1', title: 'Note secrète', summary: '## Résumé\nLe code du coffre est 1234.' })]);
    await page.evaluate(() => { lsSet('np-crs', JSON.stringify({ ALG: { exam: '2027-01-15', vocab: 'Dijkstra' } })); return dbRun('pending', 'readwrite', (st) => st.put({ days: { '2026-10-01': [5, 4] } }, 'revlog')); });
    await page.locator('#settingsBtn').click();
    await page.locator('#bkEnc').check();
    await page.locator('#bkBtn').click();
    await expect(page.locator('#pw1')).toBeFocused();   // le champ prend le focus à l'ouverture
    await page.locator('#pw1').fill('court');
    await page.locator('#pw2').fill('court');
    await page.locator('#pwOk').click();
    await expect(page.locator('#pwRes')).toContainText('Au moins 8 caractères');
    await page.locator('#pw1').fill('motdepasse-solide');
    await page.locator('#pw2').fill('motdepasse-solide');
    await page.locator('#pwOk').click();
    await expect(page.locator('#sheet')).toContainText('chiffrée par mot de passe');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bkDl').click()]);
    expect(download.suggestedFilename()).toMatch(/-chiffree\.json$/);
    const file = info.outputPath('chiffree.json');
    await download.saveAs(file);
    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).not.toContain('coffre');
    expect(JSON.parse(raw)).toMatchObject({ app: 'notes-plaud', format: 'enc1', kdf: 'PBKDF2-SHA256' });

    const ctx2 = await browser.newContext(); const page2 = await ctx2.newPage();
    const m2 = new (require('./fixtures').Mocks)(page2); await m2.install();
    await page2.goto('./');
    await page2.locator('#onboardSet').click();
    await page2.locator('#rsInput').setInputFiles(asUpload(file));
    await expect(page2.locator('#pw1')).toBeFocused();
    await page2.locator('#pw1').fill('mauvais');
    await page2.locator('#pwOk').click();
    await expect(page2.locator('#sheet')).toContainText('Mot de passe incorrect');
    await page2.locator('#pw1').fill('motdepasse-solide');
    await page2.locator('#pwOk').click();
    await expect(page2.locator('#toast')).toContainText('1 note restaurée');
    const n = await page2.evaluate(() => db.get('n1'));
    expect(n.summary).toContain('1234');
    expect(await page2.evaluate(() => crsPrefs())).toEqual({ ALG: { exam: '2027-01-15', vocab: 'Dijkstra' } });
    expect((await page2.evaluate(() => getRevLog())).days['2026-10-01']).toEqual([5, 4]);
    await ctx2.close();
  });

  test('rappel de sauvegarde : fréquence réglable', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk' });
    await page.goto('./');
    await seedNotes(page, [note({ id: 'a' }), note({ id: 'b' }), note({ id: 'c' })]);
    await page.evaluate(() => { lsSet('np-last-backup', String(Date.now() - 10 * 86400000)); renderBkRemind(); });
    await expect(page.locator('#bkRemind')).toBeHidden();   // 10 jours < 1 mois (par défaut)
    await page.locator('#settingsBtn').click();
    await page.locator('#bkEvery').selectOption('7');
    await page.locator('#backBtn').click();
    await expect(page.locator('#bkRemind')).toBeVisible();
    await expect(page.locator('#bkRemindTxt')).toContainText('il y a 10 jours');
  });
});
