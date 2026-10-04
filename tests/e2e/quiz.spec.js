// @ts-check
'use strict';
// Quiz type examen (feuille de route R5)
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const QUIZ = [
  { q: 'Qu\'est-ce qu\'un graphe orienté ?', choices: ['Des arcs avec un sens', 'Des arêtes sans sens', 'Un arbre', 'Une liste'], ok: 0, why: 'Chaque arc va d\'un sommet à un autre.', t: '0:40' },
  { q: 'Complexité du tri fusion ?', choices: ['$O(n)$', '$O(n \\log n)$', '$O(n^2)$', '$O(1)$'], ok: 1, why: 'Récurrence $T(n)=2T(n/2)+n$.', t: '1:05' },
  { q: 'Que vaut $T(1)$ ?', choices: ['0', '1', '2', 'n'], ok: 1, why: 'Cas de base.', t: '' },
];
const segments = [{ start: 0, end: 40, text: 'Bonjour.' }, { start: 40, end: 60, text: 'Un graphe orienté a des arcs.' }, { start: 60, end: 90, text: 'Le tri fusion est en n log n.' }];

async function setup(page, mocks) {
  mocks.summary = (prompt) => (/^Tu prépares un quiz/.test(prompt) ? JSON.stringify(QUIZ) : '## Résumé\nx');
  await useSettings(page, { key: 'gsk_test' });
  await page.goto('./');
  await page.evaluate(() => { Math.random = () => 0.999; });   // ordre des propositions inchangé (A, B, C, D)
  await seedNotes(page, [note({ id: 'nQ', title: 'Algorithmique 3', summary: '## Résumé\nGraphes et tri fusion.', segments })]);
  await page.locator('#notesList .item[data-id="nQ"]').click();
}
const choice = (page, text) => page.locator('.qz-ch', { hasText: text });

test.describe('Quiz type examen', () => {
  test('entraînement : correction immédiate, passage à réécouter, score gardé, fiches pour les erreurs', async ({ page, mocks }) => {
    await setup(page, mocks);
    await page.locator('#stQuiz').click();
    await page.locator('#qzNew').click();
    await expect(page.locator('#qzProg')).toHaveText('1 / 3');
    expect(mocks.calls.chat.at(-1).prompt).toContain('[0:40] Un graphe orienté a des arcs.');

    await choice(page, 'Des arcs avec un sens').click();
    await expect(page.locator('#qzWhy')).toContainText('Bonne réponse');
    await expect(page.locator('#qzWhy .ts')).toHaveText('▷ 0:40');
    await page.locator('#qzNext').click();
    await choice(page, 'O(n^2)').click();   // erreur
    await expect(page.locator('#qzWhy')).toContainText('Raté');
    await expect(page.locator('.qz-ch.ok')).toContainText('n \\log n');
    await page.locator('#qzNext').click();
    await choice(page, '0').first().click();   // erreur
    await page.locator('#qzNext').click();
    await expect(page.locator('.qz-score .big')).toHaveText('1/3');
    await expect(page.locator('.qz-item')).toHaveCount(3);

    await page.locator('#qzCards').click();
    await expect(page.locator('#toast')).toContainText('2 fiches ajoutées');
    const n = await page.evaluate(() => db.get('nQ'));
    expect(n.cards.map((c) => c.q)).toEqual(['Complexité du tri fusion ?', 'Que vaut $T(1)$ ?']);
    expect(n.cards[0].a).toContain('$O(n \\log n)$');
    expect(n.quiz.hist).toHaveLength(1);
    expect(n.quiz.hist[0]).toMatchObject({ score: 1, total: 3, timed: false });

    // le passage à réécouter ouvre la transcription au bon endroit
    await page.locator('.qz-item [data-qt="0"]').click();
    await expect(page.locator('#noteTr .seg.flash')).toContainText('graphe orienté');
    await page.locator('#backBtn').click();
    await expect(page.locator('#v-quiz')).toBeVisible();
  });

  test('mode examen : chronomètre, correction seulement à la fin ; le quiz se rejoue sans l\'IA', async ({ page, mocks }) => {
    await setup(page, mocks);
    await page.locator('#stQuiz').click();
    await page.locator('#qzTimed').check();
    await page.locator('#qzNew').click();
    await expect(page.locator('#qzTime')).toHaveText(/^[23]:\d\d$/);
    await choice(page, 'Des arcs avec un sens').click();
    await expect(page.locator('#qzProg')).toHaveText('2 / 3');   // pas de correction pendant l'examen
    await choice(page, 'O(n \\log n)').click();
    await choice(page, '1').first().click();
    await expect(page.locator('.qz-score .big')).toHaveText('3/3');
    await expect(page.locator('#qzCards')).toHaveCount(0);
    await page.locator('#qzEnd').click();

    const calls = mocks.calls.chat.length;
    await expect(page.locator('#stQuizInfo')).toContainText('dernier score 3/3');
    await page.locator('#stQuiz').click();
    await expect(page.locator('#sheet')).toContainText('meilleur score 3/3');
    await page.locator('#qzReplay').click();
    await expect(page.locator('#qzProg')).toHaveText('1 / 3');
    expect(mocks.calls.chat.length).toBe(calls);
  });

  test('temps écoulé : les questions sans réponse comptent comme fausses', async ({ page, mocks }) => {
    await setup(page, mocks);
    await page.locator('#stQuiz').click();
    await page.locator('#qzTimed').check();
    await page.locator('#qzNew').click();
    await choice(page, 'Des arcs avec un sens').click();
    await page.evaluate(() => { qz.end = Date.now(); });
    await expect(page.locator('.qz-score .big')).toHaveText('1/3');
    await expect(page.locator('.qz-item').nth(1)).toContainText('Sans réponse');
  });

  test('quiz d\'une matière : questions sur toutes les séances', async ({ page, mocks }) => {
    mocks.summary = (prompt) => (/^Tu prépares un quiz/.test(prompt) ? JSON.stringify([{ ...QUIZ[0], n: 2 }, { ...QUIZ[1], n: 1 }, { ...QUIZ[2], n: 2 }]) : 'x');
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const now = Date.now(), c = (d) => ({ key: 'ALG', name: 'Algorithmique', kind: 'cours', start: now - d * 86400000, end: now - d * 86400000 + 7200000, uid: 'u' + d });
    await seedNotes(page, [note({ id: 's1', title: 'Séance 1', created: now - 7 * 86400000, course: c(7), summary: '## Résumé\nTri fusion.' }),
      note({ id: 's2', title: 'Séance 2', created: now - 86400000, course: c(1), summary: '## Résumé\nGraphes.' })]);
    const st = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ev = (d) => ['BEGIN:VEVENT', 'UID:u' + d, 'SUMMARY:Algorithmique', 'CATEGORIES:ALG', `DTSTART:${st(c(d).start)}`, `DTEND:${st(c(d).end)}`, 'END:VEVENT'];
    await page.evaluate((t) => saveAgendaText(t, 'file'), ['BEGIN:VCALENDAR', ...ev(7), ...ev(1), 'END:VCALENDAR'].join('\r\n'));
    await page.locator('#tabbar [data-v=courses]').click();
    await page.locator('#crsBody .mat').first().click();
    await page.locator('#cQuiz').click();
    await page.locator('#qzNew').click();
    const prompt = mocks.calls.chat.at(-1).prompt;
    expect(prompt).toContain('SÉANCE 1 — Séance 1');
    expect(prompt).toContain('SÉANCE 2 — Séance 2');
    await expect(page.locator('.qz-card .rv-deck')).toHaveText('Algorithmique');
    for (const t of ['Des arcs avec un sens', 'O(n)', '1']) { await choice(page, t).first().click(); await page.locator('#qzNext').click(); }
    await expect(page.locator('.qz-score .big')).toHaveText('2/3');
    await page.locator('#qzCards').click();
    await expect(page.locator('#toast')).toContainText('1 fiche ajoutée');
    expect((await page.evaluate(() => db.get('s1'))).cards.map((x) => x.q)).toEqual(['Complexité du tri fusion ?']);
    const saved = await page.evaluate(() => dbRun('pending', 'readonly', (st) => st.get('quiz:mat:ALG')));
    expect(saved.hist[0]).toMatchObject({ score: 2, total: 3 });
  });
});
