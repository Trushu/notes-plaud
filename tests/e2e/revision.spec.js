// @ts-check
'use strict';
// Révisions (feuille de route R1 à R4, R7) : réviser tout depuis l'accueil, statistiques, fiches écrites à la main, Anki, rappel
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const DAY = 86400000;
const card = (id, q, a, over = {}) => ({ id, q, a, box: 0, due: 0, ...over });

async function setup(page) {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const now = Date.now();
  await seedNotes(page, [
    note({ id: 'nA', title: 'Algèbre — séance 1', tags: ['maths'], course: { key: 'ALG', name: 'Algèbre', kind: 'cours', start: now - DAY, end: now - DAY + 7200000, uid: 'u1' },
      cards: [card('a1', 'Qu\'est-ce qu\'un groupe ?', 'Un ensemble muni d\'une loi associative…'), card('a2', 'Formule du binôme ?', '$(a+b)^n$', { box: 4, due: now + 3 * DAY })] }),
    note({ id: 'nB', title: 'Physique — séance 2', tags: ['physique'], course: { key: 'PHY', name: 'Physique', kind: 'cours', start: now - DAY, end: now - DAY + 7200000, uid: 'u2' },
      cards: [card('b1', 'Unité de la force ?', 'Le newton (N)', { box: 1, due: now - 1000 })] }),
  ]);
}

test.describe('Révisions', () => {
  test('l\'accueil propose les fiches dues de toutes les matières ; la séance remplit les statistiques', async ({ page, mocks }) => {
    await setup(page);
    await expect(page.locator('#homeRev')).toContainText('2 fiches à réviser');
    await expect(page.locator('#homeRev')).toContainText('2 matières');
    await page.locator('#hrGo').click();
    await expect(page.locator('#rvProg')).toHaveText('1 / 2');
    for (let i = 0; i < 2; i++) { await page.locator('#rvShow').click(); await page.locator('[data-g="2"]').click(); }
    await expect(page.locator('.rv-done')).toContainText('Session terminée');
    await page.locator('#rvEnd').click();
    await expect(page.locator('#homeRev')).toBeEmpty();

    await page.evaluate(() => revStatsSheet());
    const sh = page.locator('#sheet');
    await expect(sh).toContainText('Statistiques de révision');
    await expect(sh.locator('.rs-tiles')).toContainText('0à réviser');
    await expect(sh.locator('.rs-tiles')).toContainText('1jour d\'affilée');
    await expect(sh.locator('.rs-tiles')).toContainText('100 %');
    await expect(sh.locator('.rs-mat')).toHaveCount(2);
    await expect(sh).toContainText('2 revues aujourd\'hui');
  });

  test('écrire une fiche, en corriger une, la corriger pendant la révision', async ({ page, mocks }) => {
    await setup(page);
    await page.locator('#notesList .item[data-id="nA"]').click();
    await page.locator('#stCards').click();
    await page.locator('#cmAdd').click();
    await page.locator('#ceQ').fill('Définition d\'un sous-groupe ?');
    await page.locator('#ceA').fill('Partie stable non vide, contenant les inverses');
    await page.locator('#ceOk').click();
    await expect(page.locator('#toast')).toContainText('Fiche ajoutée');
    await expect(page.locator('#stCardsInfo')).toContainText('3 fiches');

    await page.locator('#cmList').click();
    await page.locator('[data-ed="a1"]').click();
    await expect(page.locator('#ceQ')).toHaveValue('Qu\'est-ce qu\'un groupe ?');
    await page.locator('#ceA').fill('Un ensemble muni d\'une loi associative, avec neutre et inverses');
    await page.locator('#ceOk').click();
    await expect(page.locator('#toast')).toContainText('Fiche modifiée');
    const cards = await page.evaluate(async () => (await db.get('nA')).cards);
    expect(cards.find((c) => c.id === 'a1').a).toContain('neutre et inverses');
    expect(cards.find((c) => c.id === 'a2').box).toBe(4);   // la progression des autres fiches ne bouge pas
    expect(cards.filter((c) => c.own)).toHaveLength(1);

    await page.keyboard.press('Escape');
    await page.locator('#stCards').click();
    await page.locator('#cmGo').click();
    await page.locator('#rvEdit').click();
    await page.locator('#ceQ').fill('Question corrigée en révision');
    await page.locator('#ceOk').click();
    await expect(page.locator('.rv-q')).toHaveText('Question corrigée en révision');
  });

  test('export Anki d\'une note : fichier texte importable', async ({ page, mocks }) => {
    await setup(page);
    await page.locator('#notesList .item[data-id="nA"]').click();
    await page.locator('#stCards').click();
    const dl = page.waitForEvent('download');
    await page.locator('#cmAnki').click();
    const d = await dl;
    expect(d.suggestedFilename()).toBe('anki-algebre-seance-1.txt');
    const txt = require('node:fs').readFileSync(await d.path(), 'utf8');
    expect(txt.split('\n').slice(0, 2)).toEqual(['#separator:tab', '#html:true']);
    expect(txt).toContain('Formule du binôme ?\t\\((a+b)^n\\)\tNotes Plaud::Algèbre\tnotes-plaud maths');
  });

  test('rappel quotidien : enregistré pour le service worker, une seule notification par jour', async ({ page, mocks }) => {
    await setup(page);
    await page.locator('#settingsBtn').click();
    await page.locator('#sRevRem').selectOption('07:30');
    await page.locator('#sSave').click();
    expect(await page.evaluate(() => dbRun('pending', 'readonly', (st) => st.get('rev-remind')))).toEqual({ at: '07:30' });
    // l'app est en arrière-plan à 20 h : notification ; une seconde vérification le même jour ne renvoie rien
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'granted' });   // autorisation simulée
    });
    const at = await page.evaluate(() => { const d = new Date(); d.setHours(20, 0, 0, 0); return d.getTime(); });
    expect(await page.evaluate((t) => checkRevRemind(t), at)).toBe(true);
    expect(await page.evaluate((t) => checkRevRemind(t), at + 3600000)).toBe(false);
    const early = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0); return d.getTime(); });
    expect(await page.evaluate((t) => checkRevRemind(t), early)).toBe(false);   // avant l'heure choisie
  });
});
