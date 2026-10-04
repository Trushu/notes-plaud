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
