'use strict';
// Quiz type examen (feuille de route R5) : lecture de la réponse de l'IA, texte envoyé
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const { app } = loadApp({ now: new Date(2026, 9, 4, 12, 0).getTime() });

test.describe('parseQuiz', () => {
  test('questions valides, bonne réponse en indice, en lettre ou en texte', () => {
    const out = 'Voici le quiz :\n' + JSON.stringify([
      { q: 'Q1 ?', choices: ['a', 'b', 'c', 'd'], ok: 2, why: 'Parce que.', t: '12:34' },
      { q: 'Q2 ?', choices: ['A) un', 'B) deux', 'C) trois', 'D) quatre'], ok: 'B', why: '' },
      { q: 'Q3 ?', choices: ['x', 'y', 'z', 'w'], ok: 'z', t: '1:02:03' },
    ]) + '\nBonne chance';
    const r = app.parseQuiz(out, false);
    assert.equal(r.length, 3);
    assert.deepEqual(r[0], { q: 'Q1 ?', choices: ['a', 'b', 'c', 'd'], ok: 2, why: 'Parce que.', t: 754, n: null });
    assert.deepEqual(r[1].choices, ['un', 'deux', 'trois', 'quatre']);
    assert.equal(r[1].ok, 1);
    assert.equal(r[2].ok, 2);
    assert.equal(r[2].t, 3723);
  });

  test('écarte les questions mal formées ou en double', () => {
    const r = app.parseQuiz(JSON.stringify([
      { q: 'Sans choix', ok: 0 },
      { q: 'Bonne réponse hors liste', choices: ['a', 'b'], ok: 5 },
      { q: 'Propositions identiques', choices: ['a', 'A', 'b'], ok: 0 },
      { q: 'OK', choices: ['a', 'b', 'c'], ok: 0 },
      { q: 'ok', choices: ['d', 'e', 'f'], ok: 1 },
      { q: '  ', choices: ['a', 'b'], ok: 0 },
    ]), false);
    assert.deepEqual(r.map((x) => x.q), ['OK']);
    assert.deepEqual(app.parseQuiz('pas de JSON', false), []);
  });

  test('quiz d\'une matière : numéro de séance gardé, pas d\'horodatage', () => {
    const r = app.parseQuiz(JSON.stringify([{ q: 'Q', choices: ['a', 'b'], ok: 0, t: '01:00', n: 3 }]), true);
    assert.equal(r[0].n, 3);
    assert.equal(r[0].t, null);
  });
});

test.describe('Texte envoyé pour le quiz', () => {
  test('résumé puis transcription horodatée, raccourcie régulièrement si elle est trop longue', () => {
    const segments = Array.from({ length: 200 }, (_, i) => ({ start: i * 20, end: i * 20 + 19, text: `Phrase numéro ${i} du cours, avec un peu de contenu pour remplir.` }));
    const n = { title: 'T', summary: '## Résumé\nLe cours.', segments };
    const full = app.quizSource(n, 1e6);
    assert.match(full, /^RÉSUMÉ\n## Résumé/);
    assert.match(full, /\[0:00\] Phrase numéro 0/);
    assert.match(full, /\[1:06:00\] Phrase numéro 198/);
    const short = app.quizSource(n, 4000);
    assert.ok(short.length <= 4000);
    assert.match(short, /\[1:06:00\]/, 'la fin du cours est encore représentée');
  });
  test('horloges', () => {
    assert.equal(app.parseClock('12:34'), 754);
    assert.equal(app.parseClock(''), null);
    assert.equal(app.parseClock('abc'), null);
  });
});
