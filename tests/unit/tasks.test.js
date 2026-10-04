'use strict';
// Tâches : format Obsidian Tasks dans le Markdown des résumés
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const NOW = new Date(2026, 9, 4, 12, 0).getTime();
const { app } = loadApp({ now: NOW });

test.describe('parseTask', () => {
  test('texte seul', () => {
    assert.deepEqual(app.parseTask('Refaire l\'exercice 3 du TD 2'),
      { text: 'Refaire l\'exercice 3 du TD 2', due: null, remind: null, prio: 0, doneAt: null, tags: [] });
  });

  test('échéance, rappel, date de fin, priorité et tags', () => {
    const t = app.parseTask('Rendre le DM 2 #algo #théorie-des-graphes ⏫ ⏰ 2026-10-04 18:00 📅 2026-10-05 ✅ 2026-10-03');
    assert.equal(t.text, 'Rendre le DM 2');
    assert.equal(t.due, '2026-10-05');
    assert.equal(t.remind, '2026-10-04T18:00');
    assert.equal(t.doneAt, '2026-10-03');
    assert.equal(t.prio, 2);
    assert.deepEqual(t.tags, ['algo', 'théorie des graphes']);
  });

  test('rappel sans heure : 9 h ; heure sur un chiffre complétée', () => {
    assert.equal(app.parseTask('A ⏰ 2026-10-06').remind, '2026-10-06T09:00');
    assert.equal(app.parseTask('A ⏰ 2026-10-06 8:15').remind, '2026-10-06T08:15');
    assert.equal(app.parseTask('A ⏰ 2026-10-06T07:45').remind, '2026-10-06T07:45');
  });

  test('les trois niveaux de priorité', () => {
    assert.equal(app.parseTask('A 🔺').prio, 2);
    assert.equal(app.parseTask('A 🔼').prio, 1);
    assert.equal(app.parseTask('A 🔽').prio, -1);
  });

  test('un # au milieu d\'un mot n\'est pas un tag', () => {
    const t = app.parseTask('Exercice C#5 et page#2');
    assert.deepEqual(t.tags, []);
    assert.equal(t.text, 'Exercice C#5 et page#2');
  });

  test('un tag doit commencer par une lettre', () => {
    assert.deepEqual(app.parseTask('Voir #3 et #été').tags, ['été']);
  });
});

test.describe('buildTask', () => {
  test('aller-retour avec parseTask', () => {
    const o = { text: 'Relire le chapitre 4', tags: ['analyse', 'cours de maths'], prio: 1, remind: '2026-10-07T18:00', due: '2026-10-08', doneAt: null };
    const s = app.buildTask(o);
    assert.equal(s, 'Relire le chapitre 4 #analyse #cours-de-maths 🔼 ⏰ 2026-10-07 18:00 📅 2026-10-08');
    const back = app.parseTask(s);
    assert.deepEqual({ ...back, tags: back.tags }, { text: o.text, due: o.due, remind: o.remind, prio: 1, doneAt: null, tags: ['analyse', 'cours de maths'] });
  });
});

test.describe('tasksOf', () => {
  test('liste les tâches d\'une note avec leur rubrique et leurs tags', () => {
    const n = { id: 'n1', title: 'Cours', created: 1, tags: ['algo'], summary: '## Résumé\nTexte\n## À retravailler à la maison\n- [ ] Refaire l\'exercice 3 📅 2026-10-06\n- [x] Lire le chapitre 2 #lecture\n* [ ] Préparer le TP ⏫\n## Autre\n- pas une tâche' };
    const ts = app.tasksOf(n);
    assert.equal(ts.length, 3);
    assert.deepEqual(ts.map((t) => [t.id, t.done, t.section]), [['n1:0', false, 'À retravailler à la maison'], ['n1:1', true, 'À retravailler à la maison'], ['n1:2', false, 'À retravailler à la maison']]);
    assert.deepEqual(ts[1].allTags, ['algo', 'lecture']);
    assert.equal(ts[2].prio, 2);
  });

  test('note sans résumé', () => {
    assert.deepEqual(app.tasksOf({ id: 'x' }), []);
    assert.deepEqual(app.tasksOf(null), []);
  });
});

test.describe('autoRemind et remindFor', () => {
  test('ajoute un rappel la veille à 18 h aux tâches datées', () => {
    const out = app.autoRemind('- [ ] Rendre le DM 📅 2026-10-08\n- [x] Fait 📅 2026-10-08\n- [ ] Déjà ⏰ 2026-10-07 10:00 📅 2026-10-08');
    const lines = out.split('\n');
    assert.equal(lines[0], '- [ ] Rendre le DM ⏰ 2026-10-07 18:00 📅 2026-10-08');
    assert.equal(lines[1], '- [x] Fait 📅 2026-10-08');
    assert.equal(lines[2], '- [ ] Déjà ⏰ 2026-10-07 10:00 📅 2026-10-08');
  });

  test('échéance trop proche : rappel le jour même à 8 h, ou aucun', () => {
    assert.equal(app.remindFor('2026-10-05'), '2026-10-04T18:00');
    assert.equal(app.remindFor('2026-10-04'), null);   // 18 h la veille et 8 h le jour même sont passés
    assert.equal(app.remindFor(null), null);
  });
});
