// @ts-check
'use strict';
// Planning de révision avant les examens (feuille de route R6)
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const H = 3600000, DAY = 24 * H;
const st = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const vev = (uid, title, a, b) => ['BEGIN:VEVENT', 'UID:' + uid, 'SUMMARY:' + title, 'CATEGORIES:ALG', `DTSTART:${st(a)}`, `DTEND:${st(b)}`, 'END:VEVENT'];

async function setup(page, { exam = true } = {}) {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const today = await page.evaluate(() => dayStart(Date.now()));
  const s = (d) => today - d * DAY + 8 * H;
  const evs = [...vev('c1', 'Algorithmique', s(14), s(14) + 2 * H), ...vev('c2', 'Algorithmique', s(7), s(7) + 2 * H)];
  if (exam) evs.push(...vev('ex', 'Examen Algorithmique', today + 10 * DAY + 9 * H, today + 10 * DAY + 12 * H));
  await page.evaluate((t) => saveAgendaText(t, 'file'), ['BEGIN:VCALENDAR', ...evs, 'END:VCALENDAR'].join('\r\n'));
  const crs = (d, uid) => ({ key: 'ALG', name: 'Algorithmique', kind: 'cours', start: s(d), end: s(d) + 2 * H, uid });
  await seedNotes(page, [note({ id: 'n1', title: 'Graphes', created: s(14), course: crs(14, 'c1') }), note({ id: 'n2', title: 'Tri fusion', created: s(7), course: crs(7, 'c2') })]);
  return today;
}

test.describe('Planning de révision', () => {
  test('examen trouvé dans l\'emploi du temps : compte à rebours, planning jour par jour, cases cochées gardées', async ({ page, mocks }) => {
    await setup(page);
    await expect(page.locator('#homeExam')).toContainText('Examen : Algorithmique, dans 10 jours');
    await expect(page.locator('#homeExam')).toContainText('Aujourd\'hui : faire la synthèse de la matière, relire « Graphes »');
    await page.locator('#heGo').click();
    const sh = page.locator('#sheet');
    await expect(sh).toContainText('Planning — Algorithmique');
    await expect(sh).toContainText('d\'après l\'emploi du temps');
    await expect(sh.locator('.pl-day')).toHaveCount(10);
    await expect(sh.locator('.pl-day').last()).toContainText('Examen blanc : quiz chronométré');
    await sh.locator('.pl-day').first().locator('.tck').nth(0).check();
    await sh.locator('.pl-day').first().locator('.tck').nth(1).check();
    await expect(page.locator('#homeExam')).toContainText('Aujourd\'hui : réviser les fiches du jour');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('#heGo').click();
    await expect(page.locator('#sheet .pl-day').first().locator('.tck').nth(0)).toBeChecked();
    // « Relire » ouvre la séance
    await page.locator('#sheet .pl-day').first().getByRole('button', { name: 'Relire « Graphes »' }).click();
    await expect(page.locator('#noteTitle')).toContainText('Graphes');
  });

  test('date saisie à la main sur la page de la matière ; examens à venir dans l\'onglet Cours', async ({ page, mocks }) => {
    const today = await setup(page, { exam: false });
    await expect(page.locator('#homeExam')).toBeEmpty();
    await page.locator('#tabbar [data-v=courses]').click();
    await page.locator('#crsBody .mat').first().click();
    await expect(page.locator('.crs-exam')).toContainText('Pas de date d\'examen');
    await page.locator('#cPlan').click();
    const iso = await page.evaluate((t) => dayKey(t + 5 * 86400000), today);
    await page.locator('#exIn').fill(iso);
    await page.locator('#exOk').click();
    await expect(page.locator('#sheet .pl-day')).toHaveCount(5);
    await expect(page.locator('#sheet')).not.toContainText('d\'après l\'emploi du temps');
    await page.keyboard.press('Escape');
    await expect(page.locator('.crs-exam')).toContainText('dans 5 jours');
    await page.locator('#backBtn').click();
    await expect(page.locator('#crsBody .ex-row')).toContainText('Algorithmique');
    await page.locator('#crsBody .ex-row').click();
    await expect(page.locator('#sheet')).toContainText('Planning — Algorithmique');
  });
});
