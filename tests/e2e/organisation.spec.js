// @ts-check
'use strict';
// Archiver des notes, vue semestre d'une matière (feuille de route O3, O4)
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const H = 3600000, DAY = 24 * H;
const st = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

test('archiver : la note quitte l\'accueil, reste dans la recherche et le filtre « Archivées »', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await seedNotes(page, [note({ id: 'a', title: 'Ancien cours', summary: '## Résumé\nPhotosynthèse.' }), note({ id: 'b', title: 'Cours actuel' }), note({ id: 'c', title: 'Autre ancien' })]);
  await page.locator('#notesList .item[data-id="a"]').click();
  await page.locator('#archNote').click();
  await expect(page.locator('#toast')).toContainText('Note archivée');
  await expect(page.locator('#archNote')).toContainText('Désarchiver');
  await page.locator('#backBtn').click();
  await expect(page.locator('#notesList .item')).toHaveCount(2);
  await expect(page.locator('#archToggle')).toHaveText('Archivées (1)');
  // plusieurs d'un coup
  await page.locator('#selectBtn').click();
  await page.locator('#notesList .item[data-id="c"]').click();
  await page.locator('#selArch').click();
  await expect(page.locator('#notesList .item')).toHaveCount(1);
  await page.locator('#archToggle').click();
  await expect(page.locator('#archToggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#notesList .item')).toHaveCount(2);
  await expect(page.locator('#notesList .arch-lbl')).toHaveCount(2);
  await page.locator('#archToggle').click();
  // la recherche les trouve toujours
  await page.locator('#search').fill('photosynthese');
  await expect(page.locator('#notesList .item[data-id="a"]')).toBeVisible();
  await page.locator('#search').fill('');
  // désarchiver
  await page.locator('#archToggle').click();
  await page.locator('#notesList .item[data-id="a"]').click();
  await page.locator('#archNote').click();
  await expect(page.locator('#toast')).toContainText('désarchivée');
  expect(await page.evaluate(async () => (await db.get('a')).archived)).toBeUndefined();
});

test('vue semestre : séances enregistrées, manquées et à venir ; une séance manquée se complète', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const today = await page.evaluate(() => dayStart(Date.now()));
  const s = (d) => today + d * DAY + 8 * H;
  const ev = (uid, d) => ['BEGIN:VEVENT', 'UID:' + uid, 'SUMMARY:Algorithmique', 'CATEGORIES:ALG', `DTSTART:${st(s(d))}`, `DTEND:${st(s(d) + 2 * H)}`, 'END:VEVENT'];
  await page.evaluate((t) => saveAgendaText(t, 'file'), ['BEGIN:VCALENDAR', ...ev('p1', -14), ...ev('p2', -7), ...ev('f1', 7), 'END:VCALENDAR'].join('\r\n'));
  await seedNotes(page, [note({ id: 'n1', title: 'Séance 1', created: s(-14), course: { key: 'ALG', name: 'Algorithmique', kind: 'cours', start: s(-14), end: s(-14) + 2 * H, uid: 'p1' },
    cards: [{ id: 'k', q: 'q', a: 'a', box: 5, due: Date.now() + 9 * DAY }] })]);
  await page.locator('#tabbar [data-v=courses]').click();
  await page.locator('#crsBody .mat').first().click();
  const sem = page.locator('.sem');
  await expect(sem).toContainText('3 séances · 100 % des fiches maîtrisées');
  await expect(sem.locator('.sem-grid button')).toHaveCount(3);
  await expect(sem.locator('.sem-grid button.ok')).toHaveCount(1);
  await expect(sem.locator('.sem-grid button.miss')).toHaveCount(1);
  await expect(sem.locator('.sem-grid button.up')).toHaveCount(1);
  await expect(sem.locator('.sem-grid button.miss')).toHaveAttribute('aria-label', /non enregistrée$/);
  await sem.locator('.sem-grid button.miss').click();
  await expect(page.locator('#sheet')).toBeVisible();
});
