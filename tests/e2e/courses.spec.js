// @ts-check
'use strict';
// Emploi du temps : import d'un .ics, onglet Cours, rangement automatique des notes, et tour de tous les écrans
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const pad = (x) => String(x).padStart(2, '0');
const stamp = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; };

function calendar(now) {
  const h = 3600000;
  const past = now - 26 * h, next = now + 2 * h;
  const ev = (uid, title, a, b, extra = []) => ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART:${stamp(a)}`, `DTEND:${stamp(b)}`, 'CATEGORIES:INFOB231', ...extra, 'END:VEVENT'];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0',
    ...ev('c1', 'Algorithmique', past, past + 2 * h, ['LOCATION:Salle I21', 'DESCRIPTION:INFOB231 Algorithmique et structures de données\\nJean Dupont']),
    ...ev('c2', 'Algorithmique - TP', next, next + 2 * h, ['LOCATION:Labo 3']),
    ...ev('d1', 'Projet 1 est dû', now + 48 * h, now + 48 * h),
    'END:VCALENDAR'].join('\r\n');
}

test.describe('Emploi du temps', () => {
  test('import d\'un .ics : séances, matière, note rangée, échéance en tâche', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const now = Date.now();
    await seedNotes(page, [note({ id: 'nCrs', title: 'enregistrement-du-cours', created: now - 25 * 3600000 })]);
    await page.locator('#tabbar [data-v=courses]').click();
    await expect(page.locator('#crsBody')).toContainText('Ajoute ton emploi du temps');
    await page.locator('#icsInput').setInputFiles({ name: 'cours.ics', mimeType: 'text/calendar', buffer: Buffer.from(calendar(now)) });
    await expect(page.locator('#toast')).toContainText('Emploi du temps importé');
    await expect(page.locator('#toast')).toContainText('1 note rangée');
    await expect(page.locator('#crsBody .crs-now')).toContainText('Prochain cours');
    await expect(page.locator('#crsBody .crs-now')).toContainText('Labo 3');
    await expect(page.locator('#crsBody .mat')).toContainText('Algorithmique');

    // page de la matière
    await page.locator('#crsBody .mat').first().click();
    await expect(page.locator('#courseBody h1')).toHaveText('Algorithmique');
    await expect(page.locator('#courseBody')).toContainText('1/1');
    await expect(page.locator('#courseBody')).toContainText('Jean Dupont');

    // la note est rangée dans la matière, l'échéance est devenue une tâche
    const n = await page.evaluate(async () => db.get('nCrs'));
    expect(n.course.key).toBe('INFOB231');
    expect(n.tags).toContain('algorithmique');
    const inbox = await page.evaluate(async () => (await db.get('__tasks__')).summary);
    expect(inbox).toContain('Projet 1 est dû');
  });

  test('tour des écrans sans erreur JavaScript', async ({ page, mocks }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await seedNotes(page, [note({ id: 'nX', title: 'Note complète', summary: '# T\n## Résumé\nTexte $x^2$\n## Questions pour réviser\n- Q ? → R', lecture: '## Partie\nTexte', clean: [{ start: 0, text: 'Propre.' }], chapters: [{ t: 0, title: 'Début' }, { t: 5, title: 'Suite' }], mine: 'Mes **notes**' })]);
    await page.locator('#notesList .item').click();
    for (const tab of ['Transcription', 'Cours', 'Résumé']) await page.getByRole('tab', { name: tab }).click();
    await page.locator('#askBtn').click();
    await expect(page.locator('#v-ask')).toBeVisible();
    await page.locator('#backBtn').click();
    await page.locator('#backBtn').click();
    await page.locator('#tabbar [data-v=tasks]').click();
    await page.locator('#tabbar [data-v=courses]').click();
    await page.locator('#tabbar [data-v=home]').click();
    await page.locator('#homeMode [data-mode=cal]').click();
    await expect(page.locator('#calGrid .day').first()).toBeVisible();
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#v-settings')).toBeVisible();
    for (const t of ['dark', 'parchemin', 'ocean', 'foret', 'nuit', 'prune', 'light', 'auto']) await page.locator(`#themeGrid [data-t=${t}]`).click();
    expect(errors).toEqual([]);
  });
});
