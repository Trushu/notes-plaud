// @ts-check
'use strict';
// Design et confort : tablette, police de lecture, contraste élevé, accueil limité à deux cartes (U4, D1, D2, D3, A1)
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

test('tablette : liste des notes et résumé sur deux colonnes', async ({ page, mocks }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await seedNotes(page, [note({ id: 'a', title: 'A', summary: '## Résumé\nx\n## Points clés\n- a\n## Définitions et formules\n- **b** : c' }), note({ id: 'b', title: 'B' })]);
  const cols = (sel) => page.locator(sel).evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  expect(await cols('#notesList')).toBe(2);
  await page.locator('#notesList .item[data-id="a"]').click();
  expect(await page.locator('#noteSum').evaluate((e) => getComputedStyle(e).columnCount)).toBe('2');
  await page.setViewportSize({ width: 412, height: 860 });
  expect(await page.locator('#noteSum').evaluate((e) => getComputedStyle(e).columnCount)).toBe('auto');
});

test('police de lecture et thème « Contraste élevé », gardés au rechargement', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await seedNotes(page, [note({ id: 'a', title: 'A' })]);
  await page.locator('#settingsBtn').click();
  await page.locator('#sRf').selectOption('serif');
  await page.locator('#themeGrid [data-t="contraste"]').click();
  await page.reload();
  expect(await page.evaluate(() => [document.documentElement.dataset.rf, document.documentElement.dataset.theme])).toEqual(['serif', 'contraste']);
  await page.locator('#notesList .item').first().click();
  expect(await page.locator('#noteSum .md').first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/Fraunces|serif/);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
});

test('accueil : au plus deux cartes d\'information à la fois, la plus importante d\'abord', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const now = Date.now();
  await seedNotes(page, [
    note({ id: 'f', title: 'Raté', status: 'err', error: 'x', segments: [{ start: 0, end: 1, text: 'a' }], summary: '' }),
    note({ id: 'c', title: 'Fiches', cards: [{ id: 'k', q: 'q', a: 'a', box: 0, due: 0 }] }),
    note({ id: 'd' }), note({ id: 'e' }),
  ]);
  await page.evaluate(async () => { await db.put({ ...(await db.get('f')), status: 'resume-err' }); lsSet('np-last-backup', '1'); await renderHome(); });
  await expect(page.locator('#homeQueue')).toContainText('en échec');
  await expect(page.locator('#homeRev')).toBeVisible();
  await expect(page.locator('#bkRemind')).toBeHidden();   // 3e carte : cachée
  await page.evaluate(async () => { const n = await db.get('f'); n.status = 'ok'; await db.put(n); await renderHome(); });
  await expect(page.locator('#bkRemind')).toBeVisible();
});
