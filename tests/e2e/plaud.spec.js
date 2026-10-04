// @ts-check
'use strict';
// Import depuis le cloud Plaud, à travers le relais Cloudflare (simulé)
const { test, expect, mp3, useSettings } = require('./fixtures');

// jeton au format JWT (région européenne, expiration en 2027)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64({ alg: 'HS256' })}.${b64({ region: 'aws:eu-central-1', exp: 1806000000 })}.signature`;
const REC_START = new Date(2026, 9, 2, 14, 5).getTime();

test.describe('Import depuis Plaud', () => {
  test('bouton « Importer depuis Plaud » : choisir, télécharger, transcrire', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test', prelay: 'https://relais.test/', ptoken: `Bearer ${TOKEN}`, pauto: false, psince: Date.now() });
    mocks.plaud.list = [
      { id: 'rec1', filename: 'Cours de physique.mp3', start_time: REC_START, duration: 95000, filesize: 5000, is_trash: false },
      { id: 'rec0', filename: 'Ancien', start_time: REC_START - 86400000, duration: 60000, is_trash: false },
      { id: 'recT', filename: 'À la corbeille', start_time: REC_START, duration: 1000, is_trash: true },
    ];
    mocks.plaud.audio = { rec1: mp3(2) };
    await page.goto('./');
    await expect(page.locator('#plaudBtn')).toBeVisible();
    await page.locator('#plaudBtn').click();
    const rows = page.locator('#pList .mrow');
    await expect(rows).toHaveCount(2);                 // la corbeille est ignorée
    await expect(rows.first()).toContainText('Cours de physique');
    await expect(page.locator('#pGo')).toHaveText('Coche les enregistrements à importer');   // anciens : pas cochés d'office
    await rows.first().locator('input').check();
    await page.locator('#pGo').click();

    // la note est créée à la date de l'enregistrement, puis traitée
    const item = page.locator('#notesList .item', { hasText: 'Les graphes et la récursivité' });
    await expect(item).toBeVisible({ timeout: 15000 });
    const n = await page.evaluate(async () => (await loadNotes())[0]);
    expect(n.plaudId).toBe('rec1');
    expect(n.created).toBe(REC_START);
    expect(n.status).toBe('ok');

    // le jeton est envoyé au relais (sans « Bearer » en double), avec la région lue dans le jeton
    const list = mocks.calls.plaud.find((c) => c.path === '/api/file/simple/web');
    expect(list.auth).toBe(`Bearer ${TOKEN}`);
    expect(list.query).toContain('region=eu');
    expect(mocks.calls.plaud.some((c) => c.path === '/audio')).toBe(true);

    // déjà importé : marqué comme tel
    await page.locator('#plaudBtn').click();
    await expect(page.locator('#pList .mrow').first()).toContainText('déjà importé');
  });

  test('import automatique des nouveaux enregistrements à l\'ouverture', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test', prelay: 'https://relais.test', ptoken: TOKEN, psince: REC_START - 1000 });
    mocks.plaud.list = [{ id: 'recA', filename: 'TD de maths', start_time: REC_START, duration: 95000 }];
    mocks.plaud.audio = { recA: mp3(2) };
    await page.goto('./');
    await expect(page.locator('#notesList .item', { hasText: 'Les graphes et la récursivité' })).toBeVisible({ timeout: 15000 });
    expect(mocks.calls.transcribe).toHaveLength(1);
  });

  test('jeton expiré : message clair dans les réglages', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    mocks.fail = async (route) => { await route.fulfill({ status: 401, json: { status: 401, msg: 'token expired' } }); return true; };
    await page.goto('./');
    await page.locator('#settingsBtn').click();
    await page.locator('#sPRelay').fill('https://relais.test');
    await page.locator('#sPToken').fill(TOKEN);
    await page.locator('#pTest').click();
    await expect(page.locator('#pTestState')).toContainText('Jeton Plaud refusé ou expiré');
  });

  test('test de connexion réussi : nombre d\'enregistrements et expiration du jeton', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    mocks.plaud.list = [{ id: 'r1', filename: 'A', start_time: REC_START }, { id: 'r2', filename: 'B', start_time: REC_START }];
    await page.goto('./');
    await page.locator('#settingsBtn').click();
    await page.locator('#sPRelay').fill('https://relais.test');
    await page.locator('#sPToken').fill(TOKEN);
    await page.locator('#pTest').click();
    await expect(page.locator('#pTestState')).toContainText('Connecté : 2 enregistrements');
    await expect(page.locator('#pTestState')).toContainText('2027');
  });
});
