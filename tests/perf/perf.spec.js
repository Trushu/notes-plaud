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

test('500 notes dont 100 de 3 h : accueil, recherche, tâches, note, mémoire, nouvelles fonctions', async ({ page, mocks }, info) => {
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

  // 5. nouvelles fonctions (P1) : statistiques de révision, glossaire, recherche avancée, notes liées, planning, quiz, carte mentale
  const fx = await page.evaluate(async () => {
    const t = (f) => async () => { const a = performance.now(); const v = await f(); return [Math.round(performance.now() - a), v]; };
    const heads = [...(await ensureHeads()).values()], o = {};
    let v;
    [o.stats_revision_ms, v] = await t(async () => revStats(heads, await getRevLog()))(); o.fiches = v.total;
    [o.glossaire_matiere_ms, v] = await t(() => glossaryOf(heads.filter((h) => h.course && h.course.key === 'm0' && h.summary)))(); o.termes_glossaire = v.terms.length;
    [o.recherche_avancee_ms, v] = await t(() => searchNotes('matière:"Matière 3" après:2025-10-01 "est donc" -anticonstitutionnellement'))(); o.resultats_avances = v.size;
    [o.notes_liees_ms, v] = await t(async () => relatedFor(await db.get('p0008')))(); o.notes_liees = v.length;
    [o.planning_examen_ms, v] = await t(() => buildPlan(heads.filter((h) => h.course && h.course.key === 'm0'), Date.now() + 30 * 864e5))(); o.jours_planning = v.length;
    const big = await db.get('p0000');
    [o.source_quiz_ms] = await t(() => quizSource(big, 12000))();
    [o.carte_mentale_ms] = await t(() => mindSvg(mindData(big), new Set(), { bg: '#fff', surface: '#fff', ink: '#111', accent: '#36c', onAccent: '#fff', dark: false }))();
    const all = await fullNotes((h) => (h.cardDue || []).length);
    [o.export_anki_ms, v] = await t(() => ankiText(all))(); o.export_anki_Ko = Math.round(v.length / 1000);
    return o;
  });
  Object.assign(r, fx);
  await page.evaluate(() => show('home'));
  await page.locator('#tabbar [data-v=tasks]').click();
  await page.locator('#taskList .titem').first().waitFor();
  r.semaine_taches_ms = await since(async () => {
    await page.locator('#tMode [data-mode="week"]').click();
    await expect(page.locator('#taskList .wk-day')).toHaveCount(7);
  });

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
    expect(r.fiches).toBeGreaterThan(0);
    expect(r.termes_glossaire).toBeGreaterThan(50);
    expect(r.stats_revision_ms).toBeLessThan(300);
    expect(r.glossaire_matiere_ms).toBeLessThan(300);
    expect(r.recherche_avancee_ms).toBeLessThan(3000);
    expect(r.notes_liees_ms).toBeLessThan(1500);
    expect(r.planning_examen_ms).toBeLessThan(300);
    expect(r.source_quiz_ms).toBeLessThan(300);
    expect(r.carte_mentale_ms).toBeLessThan(300);
    expect(r.export_anki_ms).toBeLessThan(500);
    expect(r.resultats_avances).toBeGreaterThan(0);
    expect(r.export_anki_Ko).toBeGreaterThan(100);
    expect(r.semaine_taches_ms).toBeLessThan(1500);
  }
});
