// @ts-check
'use strict';
// Recherche avancée (feuille de route O1, O2)
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const D = (m, d) => new Date(2026, m - 1, d, 10).getTime();
const crs = (name) => ({ key: name.toUpperCase(), name, kind: 'cours', start: 0, end: 0, uid: null });

test('opérateurs, fiches et questions cherchables, aide', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await seedNotes(page, [
    note({ id: 'a', title: 'Algo 1', created: D(9, 20), course: crs('Algorithmique'), tags: ['graphes'], summary: '## Résumé\nLe tas binaire et les graphes.', segments: [{ start: 0, end: 5, text: 'On parle du tas binaire.' }] }),
    note({ id: 'b', title: 'Algo 2', created: D(10, 10), course: crs('Algorithmique'), tags: ['tri'], summary: '## Résumé\nTri fusion, pas de tas.', segments: [{ start: 0, end: 5, text: 'Examen : le tas binaire tombe souvent.' }] }),
    note({ id: 'c', title: 'Physique 1', created: D(10, 12), course: crs('Physique'), summary: '## Résumé\nForces.', kind: 'cours',
      cards: [{ id: 'k1', q: 'Unité de la force ?', a: 'Le newton', box: 0, due: 0 }], chat: [{ q: 'Qui est Coulomb ?', a: 'Un physicien français', at: 1, by: 'x' }] }),
    note({ id: 'd', title: 'Réunion projet', created: D(10, 13), kind: 'reunion', summary: '## Résumé\nPlanning du tas de tâches.' }),
  ]);
  const ids = async (q) => {
    await page.locator('#search').fill(q);
    await expect(page.locator('#srLive')).not.toBeEmpty();
    await page.waitForTimeout(250);
    return page.locator('#notesList .item').evaluateAll((els) => els.map((e) => e.dataset.id).sort());
  };
  expect(await ids('"tas binaire"')).toEqual(['a', 'b']);
  expect(await ids('"tas binaire" -examen')).toEqual(['a']);
  expect(await ids('matière:algo après:2026-10-01')).toEqual(['b']);
  expect(await ids('tag:graphes tas')).toEqual(['a']);
  expect(await ids('type:réunion')).toEqual(['d']);
  expect(await ids('a:fiches')).toEqual(['c']);
  expect(await ids('newton')).toEqual(['c']);   // dans une fiche
  await expect(page.locator('#notesList .snip')).toContainText('Fiches');
  expect(await ids('coulomb')).toEqual(['c']);   // dans une question posée
  expect(await ids('avant:2026-10-01 -graphes')).toEqual([]);
  await expect(page.locator('#notesList')).toContainText('Essaie en retirant un filtre');
  await page.locator('#shHelp2').click();
  await expect(page.locator('#sheet')).toContainText('Recherche avancée');
  await page.keyboard.press('Escape');
  // en ouvrant un résultat, seule l'expression est surlignée (pas les opérateurs)
  await ids('matière:algo "tas binaire" -examen');
  await page.locator('#notesList .item').first().click();
  await expect(page.locator('#v-note mark').first()).toHaveText(/tas binaire/i);
});

test('index des mots d\'une version précédente : recalculé une fois pour inclure les fiches', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await seedNotes(page, [note({ id: 'c', title: 'Physique', cards: [{ id: 'k1', q: 'Unité ?', a: 'Le newton', box: 0, due: 0 }] })]);
  // simule l'ancien index : mots sans les fiches, sans numéro de version
  await page.evaluate(() => dbRun('pending', 'readwrite', (st) => { st.put(' physique ', 'words:c'); st.delete('words-v'); }));
  await page.reload();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  await page.locator('#search').fill('newton');
  await expect(page.locator('#notesList .item')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => dbRun('pending', 'readonly', (st) => st.get('words-v')))).toBe(2);
});
