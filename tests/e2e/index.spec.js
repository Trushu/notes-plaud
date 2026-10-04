// @ts-check
'use strict';
// Index léger des notes (chantier 4) : création après la mise à jour, et toujours à jour
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

test('notes d\'une version précédente (sans index) : liste, recherche et tâches fonctionnent', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await page.evaluate(async (list) => {
    for (const n of list) await dbRun('notes', 'readwrite', (s) => s.put(n));   // écriture « à l'ancienne » : pas de fiche ni de mots
  }, [
    note({ id: 'v1', title: 'Ancienne A', summary: '## À faire\n- [ ] Tâche ancienne' }),
    note({ id: 'v2', title: 'Ancienne B', segments: [{ start: 0, end: 5, text: 'Le mot zygomatique est ici.' }] }),
    note({ id: 'v3', title: 'Ancienne C' }),
  ]);
  await page.reload();
  await expect(page.locator('#notesList .item')).toHaveCount(3);
  await expect(page.locator('#stats')).toContainText('3 notes');
  await expect(page.locator('#stats')).toContainText('1 tâche à faire');
  await page.locator('#search').fill('zygomatique');
  await expect(page.locator('#notesList .item')).toHaveCount(1);
  await expect(page.locator('#notesList .item .snip')).toContainText('Transcription');
  const kept = await page.evaluate(async () => { const n = await db.get('v2'); return n.segments.length; });
  expect(kept).toBe(1);   // la note complète est intacte
});

test('l\'index suit chaque modification : titre, tag, tâche, suppression et annulation', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await seedNotes(page, [note({ id: 'm1', title: 'Avant', summary: '## À faire\n- [ ] Une tâche', segments: [{ start: 0, end: 3, text: 'Photosynthèse végétale.' }] })]);
  await page.locator('#notesList .item').click();
  page.once('dialog', (d) => d.accept('Après'));
  await page.locator('#noteTitle').click();
  await expect(page.locator('#noteTitle')).toContainText('Après');
  await page.locator('#noteSum li.task input').check();
  await page.locator('#backBtn').click();
  await expect(page.locator('#notesList .item')).toContainText('Après');
  await expect(page.locator('#stats')).not.toContainText('tâche');
  await page.locator('#search').fill('photosynthese');
  await expect(page.locator('#notesList .item')).toHaveCount(1);
  await page.locator('#search').fill('');
  await page.locator('#notesList .item').click();
  await page.locator('#delNote').click();
  await expect(page.locator('#notesList')).toContainText('Aucune note');
  await page.locator('#toast .toast-act').click();
  await expect(page.locator('#notesList .item')).toHaveCount(1);
  await page.locator('#search').fill('photosynthese');
  await expect(page.locator('#notesList .item')).toHaveCount(1);
});

test('liste longue : les notes s\'affichent par pages en défilant', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const base = new Date(2026, 0, 1).getTime();
  await seedNotes(page, Array.from({ length: 130 }, (_, i) => note({ id: 'L' + i, title: 'Note ' + i, created: base + i * 3600000 })));
  await expect(page.locator('#notesList .item')).toHaveCount(60);
  await expect(page.locator('#listMore')).toContainText('70 autres');
  // en faisant défiler jusqu'en bas, la suite arrive toute seule
  await expect.poll(async () => {
    await page.evaluate(() => { const b = document.getElementById('listMore'); if (b) b.scrollIntoView(); });
    return page.locator('#notesList .item').count();
  }).toBe(130);
  await expect(page.locator('#listMore')).toHaveCount(0);
});
