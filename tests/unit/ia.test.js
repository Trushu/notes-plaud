'use strict';
// Qualité de l'IA (feuille de route I1 à I4) : vocabulaire de la matière, IA au repos, consignes
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const NOW = new Date(2026, 9, 4, 12, 0).getTime();

test.describe('Vocabulaire de la matière', () => {
  const { app } = loadApp({ now: NOW });
  test('termes définis dans la rubrique « Définitions et formules » seulement', () => {
    const sum = '## Points clés\n- **Important** : pas un terme\n## Définitions et formules\n- **Tas binaire** : arbre presque complet\n- **Algorithme de Dijkstra** — plus courts chemins\n**NP-complet** : classe de problèmes\n- texte sans gras\n## Exemples traités\n- **Exemple** : non';
    assert.deepEqual(app.defTerms(sum), ['Tas binaire', 'Algorithme de Dijkstra', 'NP-complet']);
    assert.deepEqual(app.defTerms(''), []);
  });
  test('liste saisie : virgules, points-virgules ou lignes', () => {
    assert.deepEqual(app.splitTerms('Dijkstra, tas binaire;\nNP ,, '), ['Dijkstra', 'tas binaire', 'NP']);
  });
});

test.describe('IA au repos après une limite atteinte', () => {
  test('durée selon le message', () => {
    const { app } = loadApp({ now: NOW });
    assert.equal(app.coolFor('Gemini est indisponible pour le moment (quota du jour atteint pour « gemini-3.8-flash »).'), 6 * 3600000);
    assert.equal(app.coolFor('limite gratuite de Cerebras atteinte'), 15 * 60000);
    assert.equal(app.coolFor('clé API Mistral refusée'), 0);
  });
  test('en mode automatique, la première IA disponible qui n\'est pas au repos', () => {
    const { app, localStorage } = loadApp({ now: NOW, settings: { key: 'gsk', gkey: 'AIza', ckey: 'csk' } });
    assert.equal(app.primary(), 'gemini');
    localStorage.setItem('np-cool', JSON.stringify({ gemini: NOW + 60000 }));
    assert.equal(app.primary(), 'cerebras');
    localStorage.setItem('np-cool', JSON.stringify({ gemini: NOW + 60000, cerebras: NOW + 60000, groq: NOW + 60000 }));
    assert.equal(app.primary(), 'gemini', 'toutes au repos : on garde l\'ordre habituel');
    localStorage.setItem('np-cool', JSON.stringify({ gemini: NOW - 1 }));
    assert.equal(app.primary(), 'gemini', 'repos terminé');
  });
  test('une IA choisie à la main reste la première', () => {
    const { app, localStorage } = loadApp({ now: NOW, settings: { key: 'gsk', gkey: 'AIza', provider: 'gemini' } });
    localStorage.setItem('np-cool', JSON.stringify({ gemini: NOW + 60000 }));
    assert.equal(app.primary(), 'gemini');
  });
});

test.describe('Consignes du résumé', () => {
  test('rubrique « Questions posées en classe », chiffres et notations gardés', () => {
    const { app } = loadApp({ now: NOW });
    const p = app.P_FINAL('texte', false, 'cours', NOW);
    assert.match(p, /## Exemples traités[\s\S]*## Questions posées en classe[\s\S]*## À retravailler à la maison/);
    assert.match(p, /Garde les notations de l'enseignant/);
    assert.match(p, /Reprends exactement les chiffres/);
    assert.equal(app.kindOf('Questions posées en classe'), 'quiz');
  });
});
