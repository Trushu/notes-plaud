// @ts-check
'use strict';
// File d'attente visible, diagnostic, tout effacer (feuille de route F3, F5, S2, S3)
const { test, expect, mp3, useSettings, seedNotes, note } = require('./fixtures');

test('file d\'attente : en attente, en échec, retirer, tout réessayer', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await page.evaluate(() => { CONFIG.tpmBudget = 1e9; });
  await page.evaluate(async (bytes) => {
    const audio = new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' });
    const base = { created: Date.now(), addedAt: Date.now(), fileName: 'x.mp3', size: bytes.length, summary: '', segments: null, tags: [], duration: 0 };
    await db.put({ ...base, id: 'w1', title: 'Cours en attente', status: 'transcription', audio, queued: true });
    await db.put({ ...base, id: 'f1', title: 'Cours raté', status: 'err', error: 'Clé API Groq refusée', audio, created: Date.now() - 1000 });
    await renderHome();
  }, [...mp3(1)]);
  await expect(page.locator('#homeQueue')).toContainText('1 en attente · 1 en échec');
  await page.locator('#hqGo').click();
  const sh = page.locator('#sheet');
  await expect(sh).toContainText('Cours en attente');
  await expect(sh).toContainText('Clé API Groq refusée');
  await sh.locator('[data-qrm="w1"]').click();
  await expect(sh).toContainText('En échec (2)');
  await sh.locator('#qAll').click();
  await expect.poll(async () => page.evaluate(async () => (await loadNotes()).filter((n) => n.status === 'ok').length), { timeout: 20000 }).toBe(2);
  expect(mocks.calls.transcribe).toHaveLength(2);
  await page.evaluate(() => { closeSheet(); show('home'); });
  await expect(page.locator('#homeQueue')).toBeEmpty();
});

test('rapport de diagnostic : utile et sans clé', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_secretsecret', gkey: 'AIza_secretsecret', ptoken: 'eyJabc.def.ghi', prelay: 'https://relais.test' });
  await page.goto('./');
  await seedNotes(page, [note({ id: 'e', status: 'err', error: 'Erreur avec gsk_secretsecret dans le message' })]);
  const r = await page.evaluate(() => diagReport());
  expect(r).toContain('Version : ');
  expect(r).toContain('Clés présentes : Groq oui, Gemini oui');
  expect(r).toContain('[masqué]');
  expect(r).not.toMatch(/secretsecret|eyJabc/);
});

test('tout effacer : double confirmation, puis l\'app repart de zéro', async ({ page, mocks }) => {
  await page.goto('./');   // réglages posés à la main : le script de test useSettings les remettrait après l'effacement
  await page.evaluate(() => localStorage.setItem('np-settings', JSON.stringify({ key: 'gsk_test' })));
  await page.reload();
  await seedNotes(page, [note({ id: 'a' })]);
  await page.locator('#settingsBtn').click();
  let answers = ['', 'non'];
  page.on('dialog', (d) => d.accept(answers.shift()));
  await page.locator('#wipeBtn').click();
  await expect(page.locator('#toast')).toContainText('Rien n\'a été effacé');
  expect(await page.evaluate(async () => (await loadNotes()).length)).toBe(1);
  answers = ['', 'effacer'];
  await Promise.all([page.waitForEvent('load'), page.locator('#wipeBtn').click()]);
  await expect(page.locator('#onboard')).toBeVisible();
  expect(await page.evaluate(async () => [(await loadNotes()).length, localStorage.getItem('np-settings')])).toEqual([0, null]);
});
