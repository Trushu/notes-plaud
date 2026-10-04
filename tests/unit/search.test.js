'use strict';
// Recherche sans accents : repérage des passages et surlignage
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const { app } = loadApp();

test.describe('Bugs corrigés : recherche sans accents', () => {
  test('findAll repère les passages quelle que soit l\'accentuation', () => {
    assert.deepEqual(app.findAll('La récursivité, encore la RÉCURSIVITÉ.', 'recursivite'), [[3, 14], [26, 37]]);
    assert.deepEqual(app.findAll('Élève', 'eleve'), [[0, 5]]);
    assert.deepEqual(app.findAll('rien', 'xyz'), []);
    assert.deepEqual(app.findAll('abc', ''), []);
  });

  test('findAll gère les lettres déjà décomposées (e + accent séparé)', () => {
    const t = 'café noir';   // « café » avec l'accent en caractère séparé
    assert.deepEqual(app.findAll(t, 'cafe'), [[0, 5]]);
    assert.deepEqual(app.findAll(t, 'noir'), [[6, 10]]);
  });

  test('markHits surligne sans casser le HTML échappé', () => {
    assert.equal(app.markHits('a < b & c', 'lt'), 'a &lt; b &amp; c');
    assert.equal(app.markHits('Tom & Léa', 'lea'), 'Tom &amp; <mark>Léa</mark>');
    assert.equal(app.markHits('x <script>', 'script'), 'x &lt;<mark>script</mark>&gt;');
  });
});

test.describe('Index léger (chantier 4)', () => {
  const full = {
    id: 'n1', title: 'Cours d\'Algèbre', tags: ['maths'], created: 1, status: 'ok', summary: '## Résumé\n- [ ] Refaire l\'exo 3', mine: 'Mes notes',
    segments: [{ start: 0, end: 5, text: 'La matrice inversée, déterminant non nul.' }], clean: [{ start: 0, text: 'La matrice inversée.' }],
    lecture: '## Cours\nThéorème de Cramer', chat: [{ q: 'Q', a: 'R' }], cards: [{ id: 'c1', q: 'Q', a: 'A', due: 5 }, { id: 'c2', q: 'Q', a: 'A', due: 0 }],
    photos: [{ id: 'p1', t: 3, text: 'Tableau : rang' }], audio: { faux: 1 }, mergedFrom: [{ id: 'a', parts: [{ id: 'a', off: 0 }] }],
  };

  test('la fiche garde le léger et résume le lourd', () => {
    const h = app.headOf(full);
    for (const k of ['segments', 'clean', 'lecture', 'chat', 'cards', 'photos', 'audio']) assert.equal(k in h, false, k);
    assert.equal(h.summary, full.summary);
    assert.equal(h.mine, 'Mes notes');
    assert.deepEqual(h.mergedFrom, full.mergedFrom);
    assert.deepEqual([h.hasSegs, h.hasClean, h.hasLecture, h.hasAudio], [true, true, true, true]);
    assert.deepEqual(h.photoIds, ['p1']);
    assert.deepEqual(h.cardDue, [5, 0]);
    assert.ok(h.__head);
  });

  test('les mots de la note : sans accents ni majuscules, sans doublon, de tous les textes', () => {
    const w = app.wordsOf(full);
    for (const m of ['algebre', 'maths', 'refaire', 'matrice', 'inversee', 'determinant', 'cramer', 'theoreme', 'rang', 'notes']) assert.ok(w.includes(` ${m} `), m);
    assert.equal(w.match(/ matrice /g).length, 1);
    assert.ok(!/[A-ZÀ-ÿ]/.test(w));
  });

  test('une fiche ne peut jamais remplacer une note complète', async () => {
    await assert.rejects(app.db.put(app.headOf(full)), /note incomplète/);
  });
});
