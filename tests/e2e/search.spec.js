// @ts-check
'use strict';
// Recherche dans les notes (titres, résumés, cours, transcriptions, mes notes), sans tenir compte des accents
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

test.describe('Recherche', () => {
  test.beforeEach(async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await seedNotes(page, [
      note({ id: 'nA', title: 'Algorithmique', summary: '## Résumé\nLes tris et leur complexité.', segments: [{ start: 0, end: 5, text: 'Bonjour.' }, { start: 65, end: 70, text: 'La récursivité est une fonction qui s\'appelle elle-même.' }] }),
      note({ id: 'nB', title: 'Chimie organique', summary: '## Résumé\nLes alcanes.', lecture: '## Les alcènes\nUne double liaison carbone-carbone.', created: new Date(2026, 8, 20, 10).getTime() }),
      note({ id: 'nC', title: 'Réunion projet', summary: '## Résumé\nBudget validé.', mine: 'Demander le devis à Éloïse', created: new Date(2026, 8, 10, 10).getTime() }),
    ]);
  });

  test('trouve un mot de la transcription sans tenir compte des accents', async ({ page }) => {
    await expect(page.locator('#notesList .item')).toHaveCount(3);
    await page.locator('#search').fill('recursivite');
    const items = page.locator('#notesList .item');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('Algorithmique');
    await expect(items.first().locator('.snip')).toContainText('Transcription');
    await expect(items.first().locator('.snip mark')).toHaveText('récursivité');
  });

  test('ouvre la transcription filtrée sur le passage trouvé', async ({ page }) => {
    await page.locator('#search').fill('récursivité');
    await expect(page.locator('#notesList .item')).toHaveCount(1);
    await page.locator('#notesList .item').first().click();
    await expect(page.locator('#noteTrWrap')).toBeVisible();
    await expect(page.locator('#trSearch')).toHaveValue('récursivité');
    await expect(page.locator('#noteTr .seg')).toHaveCount(1);
    await expect(page.locator('#noteTr .seg mark')).toHaveText('récursivité');
  });

  test('cherche aussi dans le cours rédigé et dans « Mes notes »', async ({ page }) => {
    await page.locator('#search').fill('double liaison');
    await expect(page.locator('#notesList .item')).toHaveCount(1);
    await expect(page.locator('#notesList .item .snip')).toContainText('Cours');
    await page.locator('#search').fill('eloise');
    await expect(page.locator('#notesList .item')).toHaveCount(1);
    await expect(page.locator('#notesList .item')).toContainText('Réunion projet');
    await expect(page.locator('#notesList .item .snip')).toContainText('Mes notes');
  });

  test('ouvre le résumé avec le passage surligné', async ({ page }) => {
    await page.locator('#search').fill('complexite');
    await expect(page.locator('#notesList .item')).toHaveCount(1);   // la recherche se fait juste après la frappe
    await page.locator('#notesList .item').click();
    await expect(page.locator('#noteSum mark.hit')).toHaveText('complexité');
  });

  test('aucun résultat, puis effacement', async ({ page }) => {
    await page.locator('#search').fill('zzzz');
    await expect(page.locator('#notesList')).toContainText('Aucune note ne contient « zzzz »');
    await page.locator('#search').fill('');
    await expect(page.locator('#notesList .item')).toHaveCount(3);
  });

  test('le titre suffit (pas d\'extrait)', async ({ page }) => {
    await page.locator('#search').fill('chimie');
    await expect(page.locator('#notesList .item')).toHaveCount(1);
    await expect(page.locator('#notesList .item .snip')).toHaveCount(0);
  });
});
