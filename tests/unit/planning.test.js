'use strict';
// Planning de révision avant un examen (feuille de route R6)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const NOW = new Date(2026, 9, 4, 12, 0).getTime();
const DAY = 86400000;
const { app } = loadApp({ now: NOW });
const day0 = new Date(2026, 9, 4).getTime();
const sess = (n, weak = 0) => Array.from({ length: n }, (_, i) => ({ id: 's' + (i + 1), title: 'Séance ' + (i + 1), summary: 'x', weak: i === 0 ? weak : 0 }));
const kinds = (d) => d.items.map((x) => x.k + (x.id ? ':' + x.id : '') + (x.exam ? '!' : '') + (x.again ? '+' : ''));

test.describe('buildPlan', () => {
  test('10 jours, 6 séances : synthèse, lectures sur les premiers jours, quiz, examen blanc la veille, fiches chaque jour', () => {
    const p = app.buildPlan(sess(6, 3), day0 + 10 * DAY + 9 * 3600000, NOW);
    assert.equal(p.length, 10);
    assert.equal(p[0].day, day0);
    assert.equal(p[9].day, day0 + 9 * DAY);
    assert.deepEqual(kinds(p[0]), ['synth', 'read:s1', 'cards']);
    const reads = p.flatMap((d, i) => d.items.filter((x) => x.k === 'read' && !x.again).map(() => i));
    assert.deepEqual(reads, [0, 1, 2, 3, 4, 5], 'une séance par jour sur les 60 % premiers jours');
    assert.ok(p[6].items.some((x) => x.k === 'read' && x.again && x.id === 's1'), 'seconde lecture de la séance la moins maîtrisée');
    assert.ok(p[7].items.some((x) => x.k === 'quiz' && !x.exam));
    assert.deepEqual(kinds(p[9]), ['quiz!', 'cards']);
    assert.ok(p.every((d) => d.items.at(-1).k === 'cards'));
  });

  test('examen très proche : tout tient dans les jours restants', () => {
    const p = app.buildPlan(sess(5), day0 + 2 * DAY, NOW, { hasSynth: true });
    assert.equal(p.length, 2);
    assert.deepEqual(p.flatMap((d) => d.items.filter((x) => x.k === 'read').map((x) => x.id)), ['s1', 's2', 's3', 's4', 's5']);
    assert.ok(!p.flat().some((d) => d.items.some((x) => x.k === 'synth')), 'synthèse déjà faite');
    assert.deepEqual(kinds(p[1]).slice(-2), ['quiz!', 'cards']);
  });

  test('examen aujourd\'hui ou passé : pas de planning', () => {
    assert.deepEqual(app.buildPlan(sess(3), day0 + 8 * 3600000, NOW), []);
    assert.deepEqual(app.buildPlan(sess(3), day0 - DAY, NOW), []);
  });

  test('textes relatifs', () => {
    assert.equal(app.relDays(day0, NOW), 'aujourd\'hui');
    assert.equal(app.relDays(day0 + DAY + 5, NOW), 'demain');
    assert.equal(app.relDays(day0 + 12 * DAY, NOW), 'dans 12 jours');
  });
});
