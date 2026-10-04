// @ts-check
'use strict';
/*
 * Mesures de performance avec 500 notes, dont 100 enregistrements de 3 h.
 * Lancement : npm run test:perf  (résultats affichés et joints au rapport)
 */
const { test, expect, useSettings } = require('../e2e/fixtures');
const { generate } = require('./dataset');

test.use({ bypassCSP: true, launchOptions: { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] } });
test.describe.configure({ mode: 'serial', timeout: 240000 });

const LIMITS = process.env.PERF_LIMITS !== '0';

test('500 notes dont 100 de 3 h : accueil, recherche, tâches, note, mémoire', async ({ page, mocks }, info) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const tSeed = Date.now();
  const stats = await page.evaluate(async ({ src, opts }) => {
    const gen = (0, eval)('(' + src + ')');
    const notes = gen(opts);
    let chars = 0;
    for (const n of notes) { chars += JSON.stringify(n).length; await db.put(n); }
    return { notes: notes.length, chars };
  }, { src: generate.toString(), opts: { n: 500, long: 100 } });
  const r = { donnees: `${stats.notes} notes, ${(stats.chars / 1e6).toFixed(1)} M caractères`, ecriture_s: Math.round((Date.now() - tSeed) / 100) / 10 };

  // processeur ralenti (×4 par défaut) pour se rapprocher d'un téléphone Android milieu de gamme
  const cpu = +(process.env.PERF_CPU || 4);
  r.cpu = `×${cpu}`;
  if (cpu > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  const mem = () => page.evaluate(() => { if (window.gc) window.gc(); return Math.round(performance.memory.usedJSHeapSize / 1e6); });
  const since = async (fn) => { const t = Date.now(); await fn(); return Date.now() - t; };

  // 1. ouverture de l'app jusqu'à l'affichage de la liste
  await page.reload();
  await page.locator('#notesList .item').first().waitFor();
  r.ouverture_ms = await page.evaluate(() => Math.round(performance.now()));
  r.memoire_accueil_Mo = await mem();
  r.reaffichage_accueil_ms = await page.evaluate(async () => { const t = performance.now(); await renderHome(); return Math.round(performance.now() - t); });

  // 2. recherche
  r.recherche_mot_rare_ms = await since(async () => {
    await page.locator('#search').fill('anticonstitutionnellement');
    await expect(page.locator('#notesList .item')).toHaveCount(1, { timeout: 60000 });
  });
  await expect(page.locator('#notesList .item .snip')).toContainText('Transcription', { timeout: 60000 });
  r.recherche_expression_ms = await since(async () => {
    await page.locator('#search').fill('est donc');
    await expect(page.locator('#notesList .item').first()).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#notesList')).not.toContainText('anticonstitutionnellement', { timeout: 60000 });
  });
  r.recherche_effacee_ms = await since(async () => {
    await page.locator('#search').fill('');
    await expect(page.locator('#notesList .item').first()).toBeVisible();
  });
  r.memoire_apres_recherche_Mo = await mem();

  // 3. onglet Tâches et pastille
  r.onglet_taches_ms = await since(async () => {
    await page.locator('#tabbar [data-v=tasks]').click();
    await page.locator('#taskList .titem').first().waitFor();
  });
  r.pastille_taches_ms = await page.evaluate(async () => { const t = performance.now(); await updateBadge(); return Math.round(performance.now() - t); });
  await page.locator('#tabbar [data-v=home]').click();

  // 4. ouvrir une note de 3 h, puis sa transcription
  r.ouvrir_note_3h_ms = await since(async () => {
    await page.evaluate(() => openNote('p0000'));
    await expect(page.locator('#noteTitle')).toContainText('Cours 0');
  });
  r.transcription_3h_ms = await since(async () => {
    await page.getByRole('tab', { name: 'Transcription' }).click();
    await page.locator('#noteTr .seg').last().waitFor({ state: 'attached' });
  });
  r.memoire_note_3h_Mo = await mem();

  console.log('\nMESURES ' + JSON.stringify(r, null, 2));
  await info.attach('mesures.json', { body: JSON.stringify(r, null, 2), contentType: 'application/json' });
  if (LIMITS) {
    // seuils larges (machines d'intégration continue lentes) : ils détectent une régression nette, pas une variation
    expect(r.ouverture_ms).toBeLessThan(5000);
    expect(r.reaffichage_accueil_ms).toBeLessThan(1000);
    expect(r.recherche_mot_rare_ms).toBeLessThan(1500);
    expect(r.recherche_expression_ms).toBeLessThan(15000);
    expect(r.onglet_taches_ms).toBeLessThan(1500);
    expect(r.pastille_taches_ms).toBeLessThan(500);
    expect(r.memoire_accueil_Mo).toBeLessThan(40);
  }
});
