'use strict';
// Traitement des textes : découpage, réponses de l'IA (chapitres, fiches, amélioration, résumé)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const { app } = loadApp();

test.describe('splitText', () => {
  test('texte court : un seul morceau', () => {
    assert.deepEqual(app.splitText('ligne 1\nligne 2', 100), ['ligne 1\nligne 2\n']);
  });

  test('coupe entre les lignes sans dépasser la taille', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Phrase numéro ${i} de la transcription.`);
    const chunks = app.splitText(lines.join('\n'), 200);
    assert.ok(chunks.length > 5);
    for (const c of chunks) assert.ok(c.length <= 200, `morceau de ${c.length} caractères`);
    assert.equal(chunks.join(''), lines.join('\n') + '\n');   // rien n'est perdu ni dupliqué
  });

  test('une ligne plus longue que la taille est coupée en tranches', () => {
    assert.deepEqual(app.splitText('a\nbb\nccc\n' + 'x'.repeat(25), 10), ['a\nbb\nccc\n', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxx']);
  });

  test('texte vide', () => {
    assert.deepEqual(app.splitText('', 100), []);
    assert.deepEqual(app.splitText('\n\n', 100), []);
  });
});

test.describe('parseChapters', () => {
  test('lit le JSON, nettoie les titres, garde l\'ordre et la durée', () => {
    const out = 'Voici : [{"t":"0:30","titre":"1. Introduction"},{"t":"05:00","title":"La récursivité"},{"t":"04:00","titre":"retour en arrière"},{"t":"99:00","titre":"trop loin"},{"t":"1:02:03","titre":"Fin"}]';
    assert.deepEqual(app.parseChapters(out, 3800), [{ t: 0, title: 'Introduction' }, { t: 300, title: 'La récursivité' }, { t: 3723, title: 'Fin' }]);
  });

  test('accepte « time » et « debut », ignore les entrées invalides', () => {
    const out = '```json\n[{"time":"00:00","title":"A"},{"debut":"10:00","titre":"B"},{"t":"abc","titre":"C"},{"t":"12:00","titre":""},null]\n```';
    assert.deepEqual(app.parseChapters(out, 0), [{ t: 0, title: 'A' }, { t: 600, title: 'B' }]);
  });

  test('moins de deux chapitres ou réponse illisible : aucun chapitre', () => {
    assert.deepEqual(app.parseChapters('[{"t":"0:00","titre":"Seul"}]', 600), []);
    assert.deepEqual(app.parseChapters('Je ne peux pas.', 600), []);
    assert.deepEqual(app.parseChapters('[pas du json]', 600), []);
  });

  test('un premier chapitre tardif n\'est pas ramené à 0', () => {
    assert.deepEqual(app.parseChapters('[{"t":"2:00","titre":"A"},{"t":"5:00","titre":"B"}]', 600), [{ t: 120, title: 'A' }, { t: 300, title: 'B' }]);
  });

  test('titres limités à 80 caractères', () => {
    const long = 'x'.repeat(120);
    assert.equal(app.parseChapters(`[{"t":"0:00","titre":"${long}"},{"t":"1:00","titre":"B"}]`, 600)[0].title.length, 80);
  });
});

test.describe('parseCards', () => {
  test('tableau JSON, même dans un bloc de code', () => {
    assert.deepEqual(app.parseCards('```json\n[{"q":" Q1 ? ","a":"R1"},{"q":" ","a":"x"},{"q":"Q3","a":3}]\n```'), [{ q: 'Q1 ?', a: 'R1' }]);
  });

  test('JSON cassé : récupère les paires « q »/« a » une à une', () => {
    const out = 'Voici : {"q": "Que vaut $\\\\frac{1}{2}$ ?", "a": "Un \\"demi\\""} {"q":"Q2","a":"A2"';
    assert.deepEqual(app.parseCards(out), [{ q: 'Que vaut $\\frac{1}{2}$ ?', a: 'Un "demi"' }, { q: 'Q2', a: 'A2' }]);
  });

  test('rien d\'exploitable', () => {
    assert.deepEqual(app.parseCards('Désolé, je ne peux pas.'), []);
    assert.deepEqual(app.parseCards('[]'), []);
  });
});

test.describe('splitQA', () => {
  test('question → réponse, avec les variantes de flèche', () => {
    assert.deepEqual(app.splitQA('Qu\'est-ce qu\'un graphe ? → Un ensemble de sommets'), ['Qu\'est-ce qu\'un graphe ?', 'Un ensemble de sommets']);
    assert.deepEqual(app.splitQA('Q ? -> R'), ['Q ?', 'R']);
    assert.deepEqual(app.splitQA('Q ? => R'), ['Q ?', 'R']);
  });

  test('la flèche d\'une formule n\'est pas un séparateur', () => {
    assert.deepEqual(app.splitQA('Que vaut $a -> b$ ? → $c$'), ['Que vaut $a -> b$ ?', '$c$']);
  });

  test('pas de réponse', () => {
    assert.equal(app.splitQA('Une simple puce'), null);
    assert.equal(app.splitQA('→ réponse sans question'), null);
  });
});

test.describe('parseClean (transcription améliorée)', () => {
  test('paragraphes horodatés', () => {
    const out = '[0:05] Premier paragraphe.\n- **[1:02:03]** Deuxième, en gras.\nsuite du deuxième\n\n[12:30] – Troisième';
    assert.deepEqual(app.parseClean(out, 0), [
      { start: 5, text: 'Premier paragraphe.' },
      { start: 3723, text: 'Deuxième, en gras. suite du deuxième' },
      { start: 750, text: 'Troisième' },
    ]);
  });

  test('texte sans horodatage : rattaché au début du morceau', () => {
    assert.deepEqual(app.parseClean('Texte libre', 42), [{ start: 42, text: 'Texte libre' }]);
  });
});

test.describe('résumé : titre, type et tags', () => {
  test('splitTitle', () => {
    assert.deepEqual(app.splitTitle('# **Les graphes**\n## Résumé\nTexte', 'secours'), { title: 'Les graphes', body: '## Résumé\nTexte' });
    assert.deepEqual(app.splitTitle('## Résumé\nTexte', 'secours'), { title: 'secours', body: '## Résumé\nTexte' });
  });

  test('splitMeta lit les lignes « Type » et « Tags » ajoutées par l\'IA', () => {
    const r = app.splitMeta('## Résumé\nTexte\n\n**Type :** Réunion\nTags : #Projet X, budget; ÉQUIPE, a, b');
    assert.equal(r.body, '## Résumé\nTexte');
    assert.equal(r.kind, 'reunion');
    assert.deepEqual(r.tags, ['projet x', 'budget', 'équipe', 'a']);
    assert.equal(app.splitMeta('Type : cours').kind, 'cours');
    assert.equal(app.splitMeta('Type : note').kind, 'perso');
  });

  test('cleanOut retire la clôture de code autour de la réponse', () => {
    assert.equal(app.cleanOut('```markdown\n# Titre\n```'), '# Titre');
  });
});

test.describe('utilitaires', () => {
  test('hms et toSec', () => {
    assert.equal(app.hms(0), '0:00');
    assert.equal(app.hms(65.9), '1:05');
    assert.equal(app.hms(3723), '1:02:03');
    assert.equal(app.toSec('1:02:03'), 3723);
    assert.equal(app.toSec('12:30'), 750);
  });

  test('dur', () => {
    assert.equal(app.dur(42), '42 s');
    assert.equal(app.dur(600), '10 min');
    assert.equal(app.dur(3 * 3600 + 5 * 60), '3 h 05');
  });

  test('parseWait comprend les délais de Groq', () => {
    assert.equal(app.parseWait('Please try again in 1m30.5s.'), 91.5);
    assert.equal(app.parseWait('try again in 2h5m'), 7501);
    assert.equal(app.parseWait('', '12'), 13);
    assert.equal(app.parseWait('', null), 20);
  });

  test('esc échappe le HTML', () => {
    assert.equal(app.esc('<a href="x">l\'œuf & co</a>'), '&lt;a href=&quot;x&quot;&gt;l&#39;œuf &amp; co&lt;/a&gt;');
  });

  test('extFor et baseName', () => {
    assert.equal(app.extFor({ name: 'cours.M4A', type: '' }), 'm4a');
    assert.equal(app.extFor({ name: 'partage', type: 'audio/x-wav' }), 'wav');
    assert.equal(app.extFor({ name: '', type: 'application/octet-stream' }), 'mp3');
    assert.equal(app.baseName('2025-03-12 14-30.mp3'), '2025-03-12 14-30');
  });
});

test.describe('En bref (feuille de route I5)', () => {
  const { app } = require('../helpers/load-app').loadApp({ now: Date.now() });
  test('ligne « En bref » lue et retirée du résumé', () => {
    const m = app.splitMeta('## Résumé\nTexte\nEn bref : Les graphes modélisent des relations.\nType : cours\nTags : graphes, algo');
    assert.equal(m.brief, 'Les graphes modélisent des relations.');
    assert.equal(m.body, '## Résumé\nTexte');
    assert.equal(m.kind, 'cours');
    assert.equal(app.splitMeta('## Résumé\nx').brief, null);
  });
  test('l\'aperçu de l\'accueil préfère « En bref »', () => {
    assert.equal(app.excerpt({ summary: '## Résumé\nLong texte.', brief: 'Court.' }), 'Court.');
    assert.equal(app.excerpt({ summary: '## Résumé\nLong texte.' }), 'Long texte.');
  });
});
