// @ts-check
'use strict';
// Onglet Tâches : tâches issues des résumés, cocher, ajouter, modifier
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (k) => { const d = new Date(today); d.setDate(d.getDate() + k); return iso(d); };

test.describe('Tâches', () => {
  test.beforeEach(async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await seedNotes(page, [note({
      id: 'nT', title: 'Cours de maths', tags: ['analyse'],
      summary: `## Résumé\nTexte.\n## À retravailler à la maison\n- [ ] Refaire l'exercice 3 📅 ${inDays(-1)}\n- [ ] Relire le chapitre 4 ⏫ 📅 ${inDays(3)}\n- [x] Imprimer le TD ✅ ${inDays(-2)}\n- [ ] Préparer l'exposé #oral`,
    })]);
  });

  test('regroupe par échéance, filtre et coche', async ({ page }) => {
    await page.locator('#tabbar [data-v=tasks]').click();
    await expect(page.locator('#v-tasks')).toBeVisible();
    await expect(page.locator('#tStats')).toContainText('3 à faire · 1 terminée');
    await expect(page.locator('#taskList .group').first()).toContainText('En retard · 1');
    await expect(page.locator('#taskList')).toContainText('Cette semaine');
    await expect(page.locator('#taskList')).toContainText('Sans échéance');
    await expect(page.locator('#tabbar [data-v=tasks] .badge')).toHaveText('1');

    // tuile « En retard »
    await page.locator('#tTiles .tstat.late').click();
    await expect(page.locator('#taskList .titem')).toHaveCount(1);
    await page.locator('#tTiles .tstat.late').click();

    // filtre par tag (le tag de la tâche, et celui de la note)
    await page.locator('#tTagBar .tag', { hasText: 'oral' }).click();
    await expect(page.locator('#taskList .titem')).toHaveCount(1);
    await page.locator('#tTagBar .tag.all').click();

    // cocher : la ligne du résumé est mise à jour (date de fin ajoutée)
    await page.locator('#taskList .titem', { hasText: 'Refaire l\'exercice 3' }).locator('.tck').check();
    await expect(page.locator('#tStats')).toContainText('2 à faire · 2 terminées');
    const summary = await page.evaluate(async () => (await db.get('nT')).summary);
    expect(summary).toContain(`- [x] Refaire l'exercice 3 📅 ${inDays(-1)} ✅ ${inDays(0)}`);
    await expect(page.locator('#tabbar [data-v=tasks] .badge')).toBeHidden();
  });

  test('ajouter une tâche à la main', async ({ page }) => {
    await page.locator('#tabbar [data-v=tasks]').click();
    await page.locator('#fab').click();
    await page.locator('#tText').fill('Envoyer le mail au professeur');
    await page.locator('#qDue .tag', { hasText: 'Demain' }).click();
    await page.locator('#tPrio [data-p="2"]').click();
    await page.locator('#tNewTag').fill('Admin');
    await page.locator('#tAddTag').click();
    await page.locator('#tSave').click();
    const item = page.locator('#taskList .titem', { hasText: 'Envoyer le mail' });
    await expect(item).toBeVisible();
    await expect(item).toContainText('Demain');
    await expect(item).toContainText('Important');
    await expect(item).toContainText('admin');
    const inbox = await page.evaluate(async () => (await db.get('__tasks__')).summary);
    expect(inbox).toMatch(new RegExp(`- \\[ \\] Envoyer le mail au professeur #admin ⏫ (⏰ \\S+ \\S+ )?📅 ${inDays(1)}`));
  });

  test('modifier puis supprimer une tâche', async ({ page }) => {
    await page.locator('#tabbar [data-v=tasks]').click();
    await page.locator('#taskList .titem', { hasText: 'Préparer l\'exposé' }).locator('.tbody').click();
    await expect(page.locator('#tText')).toHaveValue('Préparer l\'exposé');
    await page.locator('#tText').fill('Préparer l\'exposé oral sur Gauss');
    await page.locator('#tSave').click();
    await expect(page.locator('#taskList')).toContainText('Préparer l\'exposé oral sur Gauss');

    page.once('dialog', (d) => d.accept());
    await page.locator('#taskList .titem', { hasText: 'Gauss' }).locator('.tbody').click();
    await page.locator('#tDel').click();
    await expect(page.locator('#taskList')).not.toContainText('Gauss');
    const summary = await page.evaluate(async () => (await db.get('nT')).summary);
    expect(summary).not.toContain('exposé');
  });

  test('cocher dans la note revient au même', async ({ page }) => {
    await page.locator('#notesList .item').click();
    await page.locator('#noteSum li.task', { hasText: 'Relire le chapitre 4' }).locator('input').check();
    await page.locator('#backBtn').click();
    await page.locator('#tabbar [data-v=tasks]').click();
    await expect(page.locator('#tStats')).toContainText('2 à faire · 2 terminées');
  });
});

test.describe('Tâches qui se répètent et vue « Semaine » (O5, O6)', () => {
  test('cocher une tâche hebdomadaire crée la suivante ; la semaine jour par jour', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const iso = await page.evaluate(() => toISODate(Date.now() + 2 * 86400000));
    await page.locator('#tabbar [data-v=tasks]').click();
    // les 4 onglets d'affichage tiennent sur un téléphone étroit (pas de dézoom de la page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    await page.locator('#fab').click();
    await page.locator('#tText').fill('Relire le cours de la semaine');
    await page.locator('#tDue').fill(iso);
    await page.locator('#tRec').selectOption('week');
    await page.locator('#tSave').click();
    const row = page.locator('.titem', { hasText: 'Relire le cours de la semaine' });
    await expect(row).toContainText('🔁 chaque semaine');
    await row.locator('.tck').check();
    await expect.poll(() => page.evaluate(async () => (await allTasks()).filter((t) => /Relire le cours/.test(t.text)).map((t) => [t.done, t.due]))).toEqual([
      [false, await page.evaluate((d) => toISODate(isoDay(d) + 7 * 86400000), iso)], [true, iso]]);
    // décocher puis recocher ne crée pas de doublon
    const done = await page.evaluate(async () => (await allTasks()).find((t) => /Relire le cours/.test(t.text) && t.done));
    await page.evaluate(async (t) => { await updateTask(t.noteId, t.idx, (x) => ({ ...x, done: false })); await updateTask(t.noteId, t.idx, (x) => ({ ...x, done: true })); }, done);
    expect(await page.evaluate(async () => (await allTasks()).filter((t) => /Relire le cours/.test(t.text)).length)).toBe(2);
    await page.locator('#tMode [data-mode="week"]').click();
    await expect(page.locator('#taskList .wk-day')).toHaveCount(7);
    await expect(page.locator('#taskList .wk-day').first()).toHaveText('Aujourd\'hui');
    await expect(page.locator('#taskList')).toContainText('1 tâche plus tard');
  });
});

test('vue Semaine : beaucoup de retards ne cachent pas la semaine', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  const late = Array.from({ length: 8 }, (_, i) => `- [ ] Retard ${i + 1} 📅 ${inDays(-1 - i)}`).join('\n');
  await seedNotes(page, [note({ id: 'nL', title: 'Cours en retard', summary: `## Résumé\nTexte.\n## À retravailler à la maison\n${late}\n- [ ] Pour demain 📅 ${inDays(1)}` })]);
  await page.locator('#tabbar [data-v=tasks]').click();
  await page.locator('#tMode [data-mode="week"]').click();
  await expect(page.locator('#taskList .wk-day')).toHaveCount(7);
  await expect(page.locator('#taskList')).toContainText('En retard · 8');
  await expect(page.locator('#taskList .titem', { hasText: /Retard \d/ })).toHaveCount(5);
  await expect(page.locator('#taskList .titem', { hasText: 'Pour demain' })).toBeVisible();
  await page.locator('#wkLate').click();
  await expect(page.locator('#tMode [data-mode="due"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tTiles .tstat.late')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#taskList .titem', { hasText: /Retard \d/ })).toHaveCount(8);
});
