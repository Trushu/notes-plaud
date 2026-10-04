'use strict';
// Glossaire, carte mentale, révision audio (feuille de route R8, R9, R10)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const { app } = loadApp({ now: new Date(2026, 9, 4, 12, 0).getTime() });
const SUM = `# Les graphes
## Résumé
Le cours présente les graphes.
## Points clés
- Un graphe a des **sommets**.
- Les arêtes relient les sommets.
## Définitions et formules
- **Graphe orienté** : graphe dont les arêtes ont un sens
- **Degré** — nombre d'arêtes incidentes
- $\\sum_v d(v) = 2|E|$ : lemme des poignées de main
- Aucune autre
## À retravailler à la maison
- [ ] Refaire l'exercice 3
## Questions pour réviser
- Qu'est-ce qu'un graphe ? → Des sommets et des arêtes
Type : cours
Tags : graphes`;

test.describe('Glossaire', () => {
  test('définitions et formules d\'un résumé', () => {
    assert.deepEqual(app.defEntries(SUM), [
      { term: 'Graphe orienté', def: 'graphe dont les arêtes ont un sens' },
      { term: 'Degré', def: 'nombre d\'arêtes incidentes' },
      { formula: '$\\sum_v d(v) = 2|E|$', def: 'lemme des poignées de main' },
    ]);
  });
  test('toutes les séances, ordre alphabétique, origine gardée ; export Markdown', () => {
    const g = app.glossaryOf([
      { id: 'b', title: 'Séance 2', created: 2, summary: '## Définitions et formules\n- **Arbre** : graphe connexe sans cycle' },
      { id: 'a', title: 'Séance 1', created: 1, summary: SUM },
    ]);
    assert.deepEqual(g.terms.map((e) => [e.term, e.id]), [['Arbre', 'b'], ['Degré', 'a'], ['Graphe orienté', 'a']]);
    assert.equal(g.formulas.length, 1);
    const md = app.glossaryMd('Algo', g);
    assert.match(md, /^# Glossaire — Algo\n\n- \*\*Arbre\*\* : graphe connexe sans cycle _\(Séance 2\)_/);
    assert.match(md, /## Formules\n\n- \$\\sum_v d\(v\) = 2\|E\|\$ : lemme/);
  });
});

test.describe('Carte mentale', () => {
  test('rubriques et points, sans tâches, questions ni méta', () => {
    const d = app.mindData({ title: 'Les graphes', summary: SUM });
    assert.deepEqual(d.secs.map((s) => s.h), ['Résumé', 'Points clés', 'Définitions et formules', 'Questions pour réviser']);
    assert.deepEqual(d.secs[1].items, ['Un graphe a des sommets.', 'Les arêtes relient les sommets.']);
    assert.deepEqual(d.secs[3].items, ['Qu\'est-ce qu\'un graphe ?']);
  });
  test('dessin : une rubrique repliée cache ses points ; texte échappé', () => {
    const d = { title: 'T <b>', secs: [{ h: 'A', items: ['x', 'y'] }, { h: 'B', items: ['z'] }] };
    const css = { bg: '#fff', surface: '#fff', ink: '#000', accent: '#a00', onAccent: '#fff' };
    const open = app.mindSvg(d, new Set(), css), closed = app.mindSvg(d, new Set([0]), css);
    assert.equal((open.svg.match(/<text/g) || []).length, 1 + 2 + 3);
    assert.equal((closed.svg.match(/<text/g) || []).length, 1 + 2 + 1);
    assert.match(open.svg, /T &lt;b&gt;/);
    assert.ok(closed.h < open.h);
  });
});

test('révision audio : formules dites en français', () => {
  assert.equal(app.speakMd('Que vaut $x^2$ si **x** = 3 ?'), 'Que vaut x au carré si x = 3 ?');
});
