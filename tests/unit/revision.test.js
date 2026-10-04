'use strict';
// Révisions : statistiques, journal, export Anki (amélioration R1–R4, R7)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const NOW = new Date(2026, 9, 4, 12, 0).getTime();
const DAY = 86400000;
const { app } = loadApp({ now: NOW });

test.describe('revStats', () => {
  const heads = [
    { id: 'a', course: { name: 'Algèbre' }, cardDue: [0, NOW - 1000, NOW + DAY, NOW + 3 * DAY], cardBox: [0, 2, 4, 5] },
    { id: 'b', cardDue: [NOW + 20 * DAY], cardBox: [6] },
    { id: 'c', title: 'Sans fiches' },
  ];

  test('totaux, maîtrisées, prévision et matières', () => {
    const st = app.revStats(heads, null, NOW);
    assert.equal(st.total, 5);
    assert.equal(st.fresh, 1);
    assert.equal(st.due, 2);
    assert.equal(st.mastered, 3);
    assert.deepEqual(st.next7, [0, 1, 0, 1, 0, 0, 0]);
    assert.deepEqual(st.mats.map((m) => [m.name, m.total, m.due, m.mastered, m.ids]), [['Algèbre', 4, 2, 2, ['a']], ['Autres notes', 1, 0, 1, ['b']]]);
  });

  test('série de jours et taux de réussite sur 30 jours', () => {
    const k = (d) => app.dayKey(NOW - d * DAY);
    const log = { days: { [k(1)]: [10, 8], [k(2)]: [5, 5], [k(3)]: [0, 0], [k(4)]: [3, 1], [k(40)]: [100, 0] } };
    let st = app.revStats([], log, NOW);
    assert.equal(st.streak, 2, 'hier et avant-hier : la série tient encore aujourd\'hui');
    assert.equal(st.n30, 18);
    assert.equal(st.rate30, 78);
    log.days[k(0)] = [1, 1];
    st = app.revStats([], log, NOW);
    assert.equal(st.streak, 3);
    assert.equal(st.todayDone, 1);
    assert.equal(app.revStats([], { days: { [k(2)]: [4, 4] } }, NOW).streak, 0, 'un jour sauté casse la série');
    assert.equal(app.revStats([], null, NOW).rate30, null);
  });
});

test.describe('Export Anki', () => {
  test('champs : HTML échappé, formules MathJax, gras, retours à la ligne', () => {
    assert.equal(app.ankiField('Si $a<b$ alors **oui**\n$$x^2$$'), 'Si \\(a&lt;b\\) alors <b>oui</b><br>\\[x^2\\]');
    assert.equal(app.ankiField('a\tb <script>'), 'a b &lt;script&gt;');
  });

  test('fichier : en-têtes, paquet par matière, tags sans espaces', () => {
    const txt = app.ankiText([
      { title: 'Séance 1', course: { name: 'Algèbre linéaire' }, tags: ['maths', 'espaces vectoriels'], cards: [{ q: 'Q1', a: 'R1' }, { q: 'Q2', a: 'R2' }] },
      { title: 'Réunion\tprojet', tags: [], cards: [{ q: 'Q3', a: 'R3' }] },
    ]);
    const lines = txt.trim().split('\n');
    assert.deepEqual(lines.slice(0, 5), ['#separator:tab', '#html:true', '#notetype:Basic', '#deck column:3', '#tags column:4']);
    assert.equal(lines[5], 'Q1\tR1\tNotes Plaud::Algèbre linéaire\tnotes-plaud maths espaces_vectoriels');
    assert.equal(lines[7], 'Q3\tR3\tNotes Plaud::Réunion projet\tnotes-plaud');
    assert.equal(lines.length, 8);
    for (const l of lines.slice(5)) assert.equal(l.split('\t').length, 4);
  });
});

test.describe('Index des notes', () => {
  test('la fiche légère garde la boîte de chaque fiche', () => {
    const h = app.headOf({ id: 'n', title: 't', cards: [{ id: 'c1', q: 'q', a: 'a', box: 3, due: 5 }, { id: 'c2', q: 'q', a: 'a' }] });
    assert.deepEqual(h.cardBox, [3, 0]);
    assert.deepEqual(h.cardDue, [5, 0]);
  });
});

test.describe('Réglage du rappel quotidien', () => {
  test('heures valides seulement', () => {
    assert.equal(app.settingOk('revRemind', '19:00'), true);
    assert.equal(app.settingOk('revRemind', ''), true);
    assert.equal(app.settingOk('revRemind', '25:00'), false);
    assert.equal(app.settingOk('revRemind', '"><img>'), false);
  });
});
