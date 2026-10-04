// @ts-check
'use strict';
// Glossaire de la matière, carte mentale, révision audio (feuille de route R8, R9, R10)
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const H = 3600000, DAY = 24 * H;
const st = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

async function setup(page) {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const now = Date.now(), c = (d) => ({ key: 'ALG', name: 'Algorithmique', kind: 'cours', start: now - d * DAY, end: now - d * DAY + H, uid: 'u' + d });
  await page.evaluate((t) => saveAgendaText(t, 'file'), ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:u7', 'SUMMARY:Algorithmique', 'CATEGORIES:ALG', `DTSTART:${st(now - 7 * DAY)}`, `DTEND:${st(now - 7 * DAY + H)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
  await seedNotes(page, [
    note({ id: 's1', title: 'Graphes', created: now - 7 * DAY, course: c(7), summary: '## Résumé\nLes graphes.\n## Points clés\n- Sommets et arêtes\n- Degré d\'un sommet\n## Définitions et formules\n- **Graphe orienté** : arêtes avec un sens\n- **Degré** : nombre d\'arêtes incidentes',
      cards: [{ id: 'k1', q: 'Que vaut $x^2$ pour x = 3 ?', a: '9', box: 0, due: 0 }, { id: 'k2', q: 'Un arbre ?', a: 'Un graphe connexe sans cycle', box: 0, due: 0 }] }),
    note({ id: 's2', title: 'Arbres', created: now - DAY, course: c(1), summary: '## Définitions et formules\n- **Arbre** : graphe connexe sans cycle' }),
  ]);
}

test('glossaire de la matière : alphabétique, recherche, lien vers la séance, fiches créées', async ({ page, mocks }) => {
  await setup(page);
  await page.locator('#tabbar [data-v=courses]').click();
  await page.locator('#crsBody .mat').first().click();
  await page.locator('#cGloss').click();
  const sh = page.locator('#sheet');
  await expect(sh).toContainText('3 notions');
  await expect(sh.locator('.gl-it b')).toHaveText(['Arbre', 'Degré', 'Graphe orienté']);
  await page.locator('#glQ').fill('sans cycle');
  await expect(sh.locator('.gl-it:not(.hidden)')).toHaveCount(1);
  await page.locator('#glCards').click();
  await expect(page.locator('#toast')).toContainText('3 fiches de définition ajoutées');
  expect((await page.evaluate(() => db.get('s2'))).cards[0]).toMatchObject({ q: 'Que signifie « Arbre » ?', a: 'graphe connexe sans cycle', from: 'glossaire' });
  await page.locator('#glCards').click();
  await expect(page.locator('#toast')).toContainText('déjà dans tes fiches');
  await sh.locator('.gl-it:not(.hidden) [data-open]').click();
  await expect(page.locator('#noteTitle')).toContainText('Arbres');
});

test('carte mentale : rubriques et points, repli, image', async ({ page, mocks }) => {
  await setup(page);
  await page.locator('#notesList .item[data-id="s1"]').click();
  await page.locator('#stMind').click();
  const box = page.locator('#mmBox');
  await expect(box.locator('svg')).toHaveAttribute('aria-label', 'Carte mentale de Graphes');
  await expect(box).toContainText('Sommets et arêtes');
  await box.locator('.mm-sec', { hasText: 'Points clés' }).click();
  await expect(box).not.toContainText('Sommets et arêtes');
  await expect(box.locator('.mm-sec', { hasText: 'Points clés' })).toHaveAttribute('aria-expanded', 'false');
  const dl = page.waitForEvent('download');
  await page.locator('#mmPng').click();
  expect((await dl).suggestedFilename()).toBe('carte-mentale-graphes.png');
});

test('révision audio : question lue, pause, réponse, fiche suivante, sans changer le calendrier', async ({ page, mocks }) => {
  await page.addInitScript(() => {
    // moteur vocal simulé : enregistre ce qui est dit et « parle » instantanément
    window.__said = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 20); } } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: function (t) { this.text = t; } });
  });
  await setup(page);
  await page.evaluate(() => { CONFIG.rvThink = 50; });
  await page.locator('#hrGo').click();
  await page.locator('#rvListen').click();
  await expect.poll(() => page.evaluate(() => window.__said.length), { timeout: 10000 }).toBe(5);
  const said = await page.evaluate(() => window.__said);
  // ordre des fiches nouvelles tiré au hasard : on vérifie chaque paire question → réponse
  const pairs = [[said[0], said[1]], [said[2], said[3]]].map((p) => p.join(' | ')).sort();
  expect(pairs).toEqual(['Question. Que vaut x au carré pour x = 3 ? | Réponse. 9', 'Question. Un arbre ? | Réponse. Un graphe connexe sans cycle']);
  expect(said[4]).toBe('Fin des fiches.');
  await expect(page.locator('#rvListen')).toHaveText('🔊 Écouter');
  const cards = await page.evaluate(async () => (await db.get('s1')).cards.map((c) => c.due));
  expect(cards).toEqual([0, 0]);
});
