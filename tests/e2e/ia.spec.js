// @ts-check
'use strict';
// Qualité de l'IA (feuille de route I1, I2) : vocabulaire de la matière, IA au repos après une limite
const { test, expect, mp3, useSettings, seedNotes, note } = require('./fixtures');

const H = 3600000;
const st = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

test('vocabulaire de la matière : saisi ou appris dans les résumés, donné à la transcription et à l\'IA', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const now = Date.now();
  await page.evaluate((t) => saveAgendaText(t, 'file'), ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:live', 'SUMMARY:Algorithmique', 'CATEGORIES:ALG',
    `DTSTART:${st(now - H / 2)}`, `DTEND:${st(now + H)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
  await seedNotes(page, [note({ id: 'old', title: 'Séance 1', course: { key: 'ALG', name: 'Algorithmique', kind: 'cours', start: now - 7 * 24 * H, end: now - 7 * 24 * H + H, uid: 'x' },
    summary: '## Résumé\nx\n## Définitions et formules\n- **Tas binaire** : arbre presque complet' })]);
  await page.locator('#tabbar [data-v=courses]').click();
  await page.locator('#crsBody .mat').first().click();
  await page.locator('#cVocab').click();
  await expect(page.locator('#sheet')).toContainText('Appris dans tes résumés (1)');
  await expect(page.locator('#sheet .tag')).toHaveText('Tas binaire');
  await page.locator('#vocIn').fill('Dijkstra, Bellman-Ford');
  await page.locator('#vocOk').click();

  await page.locator('#backBtn').click();
  await page.locator('#tabbar [data-v=home]').click();
  await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
  await expect(page.locator('#noteTitle')).toContainText('Les graphes');
  const wp = mocks.calls.transcribe[0].prompt;
  expect(wp).toBe('Dijkstra, Bellman-Ford, Tas binaire. Cours de Algorithmique.');
  expect(mocks.calls.chat.at(-1).prompt).toContain('Vocabulaire de la matière (orthographe à respecter) : Dijkstra, Bellman-Ford, Tas binaire.');
  expect(mocks.calls.chat.at(-1).prompt).toContain('## Questions posées en classe');
});

test('IA au repos : après un quota épuisé, les traitements suivants commencent par l\'IA suivante', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test', gkey: 'AIza_test' });
  mocks.fail = async (route, kind) => {
    if (kind !== 'gemini') return false;
    await route.fulfill({ status: 429, json: { error: { message: 'Quota exceeded for quota metric GenerateRequestsPerDay', details: [] } } });
    return true;
  };
  await page.goto('./');
  await page.evaluate(() => { CONFIG.tpmBudget = 1e9; });
  await page.locator('#fileInput').setInputFiles({ name: 'a.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
  await expect(page.locator('#noteTitle')).toContainText('Les graphes', { timeout: 20000 });
  const gem = mocks.calls.gemini.length;
  expect(gem).toBeGreaterThan(0);
  expect(mocks.calls.chat.length).toBeGreaterThan(0);   // secours : Groq

  await page.locator('#backBtn').click();
  await page.locator('#fileInput').setInputFiles({ name: 'b.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
  await expect.poll(async () => page.evaluate(async () => (await loadNotes()).filter((n) => n.status === 'ok').length), { timeout: 20000 }).toBe(2);
  expect(mocks.calls.gemini.length).toBe(gem);   // Gemini n'est même pas réessayé
  await expect(page.locator('#v-note')).toBeVisible();
  await expect(page.locator('#noteTitle')).toContainText('Les graphes');

  await page.locator('#backBtn').click();
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#provCool')).toContainText('Gemini au repos jusqu\'à');
  await page.locator('#provWake').click();
  await expect(page.locator('#provCool')).toBeEmpty();
});
