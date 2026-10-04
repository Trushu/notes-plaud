// @ts-check
'use strict';
// « En bref » et liens entre séances (feuille de route I5, R11)
const { test, expect, mp3, useSettings, seedNotes, note, SUMMARY } = require('./fixtures');

test('« En bref » : une phrase en tête de la note et dans l\'aperçu de l\'accueil', async ({ page, mocks }) => {
  mocks.summary = () => SUMMARY.replace('Type : cours', 'En bref : Les graphes et la récursivité, avec le tri fusion en exemple.\nType : cours');
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  expect(mocks.calls.chat).toHaveLength(0);
  await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
  await expect(page.locator('#noteSum .brief')).toContainText('Les graphes et la récursivité, avec le tri fusion en exemple.');
  expect(mocks.calls.chat[0].prompt).toContain('En bref : une seule phrase');
  await expect(page.locator('#noteSum')).not.toContainText('En bref : Les graphes');   // la ligne brute n'apparaît pas
  await page.locator('#backBtn').click();
  await expect(page.locator('#notesList .item .ex').first()).toHaveText('Les graphes et la récursivité, avec le tri fusion en exemple.');
});

test('liens entre séances : une notion définie ici, retrouvée dans une autre séance de la matière', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const c = (uid) => ({ key: 'ALG', name: 'Algorithmique', kind: 'cours', start: 0, end: 0, uid });
  await seedNotes(page, [
    note({ id: 'a', title: 'Séance 2', course: c('2'), summary: '## Résumé\nLes tas.\n## Définitions et formules\n- **Tas binaire** : arbre presque complet\n- **Pivot** : élément de partition' }),
    note({ id: 'b', title: 'Séance 5', course: c('5'), summary: '## Résumé\nTri par tas.', segments: [{ start: 0, end: 4, text: 'On réutilise le tas binaire vu en séance 2.' }] }),
    note({ id: 'z', title: 'Autre matière', course: { ...c('9'), key: 'PHY', name: 'Physique' }, summary: '## Résumé\nUn pivot.' }),
  ]);
  await page.locator('#notesList .item[data-id="a"]').click();
  const box = page.locator('#noteLinks');
  await expect(box).toBeVisible();
  await expect(box.locator('li')).toHaveCount(1);
  await expect(box).toContainText('Tas binaire : Séance 5');
  await box.locator('[data-lk="b"]').click();
  await expect(page.locator('#noteTitle')).toContainText('Séance 5');
  await expect(page.locator('#v-note mark').first()).toHaveText(/tas binaire/i);
});
