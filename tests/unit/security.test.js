'use strict';
// Sécurité : données venant d'une sauvegarde, d'un calendrier ou d'une IA, et rendu des formules
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const { app, run } = loadApp();

test.describe('sanitizeNote (restauration d\'une sauvegarde)', () => {
  test('identifiant dangereux : note refusée', () => {
    for (const id of ['x" onfocus="alert(1)', '<img src=x>', '', 'a'.repeat(200), 42, null]) assert.equal(app.sanitizeNote({ id, title: 'T' }), null, String(id));
    assert.equal(app.sanitizeNote('pas un objet'), null);
  });

  test('note normale conservée', () => {
    const n = { id: 'n1abc', created: 1760000000000, title: 'Cours', status: 'ok', summary: '## Résumé', tags: ['algo'], segments: [{ start: 0, end: 2, text: 'Bonjour' }], pinned: true, kind: 'cours' };
    assert.deepEqual(app.sanitizeNote(n), { ...n, fileName: '' });
    assert.deepEqual(app.sanitizeNote({ id: '__tasks__', title: 'Mes tâches', status: 'tasks', summary: '- [ ] A', segments: null }).id, '__tasks__');
  });

  test('nombres et identifiants internes nettoyés (ils finissent dans des attributs HTML)', () => {
    const n = app.sanitizeNote({
      id: 'n2', title: 'T', summary: 'S', created: '1760000000000', duration: '"><img src=x onerror=alert(1)>',
      chapters: [{ t: '"><img src=x onerror=alert(1)>', title: 'A' }, { t: 60, title: 'B' }],
      marks: [12, '"><b>', 30], photos: [{ id: 'p1', t: 5 }, { id: 'p" onclick="x', t: 3 }],
      segments: [{ start: '<i>', end: 3, text: 42 }, 'pas un segment'],
      cards: [{ id: 'c1', q: 'Q', a: 'A', box: 'x', due: 0 }, { id: '"', q: 'Q', a: 'A' }],
      chat: [{ q: 'Q', a: 'R', at: 1, notes: ['n2', '"><img>'] }],
      course: { key: 'INFO', name: 'Algo', kind: '"><script>', start: 'x' },
      mergedFrom: [{ id: 'n1', parts: [{ id: 'n1', off: 0 }, { id: '<x>', off: 3 }] }, { id: '"bad"' }],
      audio: { faux: 'fichier' }, partial: { n: 3 }, queued: true, inconnu: { objet: 1 }, aussi: 'texte',
    });
    assert.equal(n.created, 1760000000000);
    assert.equal(n.duration, 0);
    assert.deepEqual(n.chapters, [{ t: 0, title: 'A' }, { t: 60, title: 'B' }]);
    assert.deepEqual(n.marks, [12, 30]);
    assert.deepEqual(n.photos.map((p) => p.id), ['p1']);
    assert.deepEqual(n.segments, [{ start: 0, end: 3, text: '42' }]);
    assert.deepEqual(n.cards.map((c) => [c.id, c.box]), [['c1', 0]]);
    assert.deepEqual(n.chat[0].notes, ['n2']);
    assert.equal(n.course.kind, 'cours');
    assert.equal(n.course.start, 0);
    assert.deepEqual(n.mergedFrom.map((m) => [m.id, m.parts.map((p) => p.id)]), [['n1', ['n1']]]);
    for (const k of ['audio', 'partial', 'queued', 'inconnu']) assert.equal(k in n, false, k);
    assert.equal(n.aussi, 'texte');
  });

  test('statut inconnu remplacé', () => {
    assert.equal(app.sanitizeNote({ id: 'n3', status: '<b>', summary: 'x' }).status, 'ok');
    assert.equal(app.sanitizeNote({ id: 'n4', status: 'ok', summary: '' , segments: null }).segments, null);
  });
});

test.describe('settingOk (réglages d\'une sauvegarde)', () => {
  test('valeurs possibles seulement', () => {
    assert.equal(app.settingOk('pregion', 'eu'), true);
    assert.equal(app.settingOk('pregion', '<img src=x onerror=alert(1)>'), false);
    assert.equal(app.settingOk('prelay', 'https://plaud.moi.workers.dev'), true);
    assert.equal(app.settingOk('prelay', 'http://plaud.moi.workers.dev'), false);
    assert.equal(app.settingOk('prelay', 'javascript:alert(1)'), false);
    assert.equal(app.settingOk('theme', 'prune'), true);
    assert.equal(app.settingOk('theme', 'x"]'), false);
    assert.equal(app.settingOk('fs', 'xxl'), false);
    assert.equal(app.settingOk('courseRemind', 15), true);
    assert.equal(app.settingOk('courseRemind', '15'), false);
    assert.equal(app.settingOk('bg', 'oui'), false);
    assert.equal(app.settingOk('ctx', 'Étudiant en informatique'), true);
    assert.equal(app.settingOk('key', 'gsk_abc'), true);
    assert.equal(app.settingOk('key', { objet: 1 }), false);
    assert.equal(app.settingOk('inconnu', 'x'), false);
    for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(app.settingOk(k, 'x'), false, k);
  });
});

test.describe('Relais', () => {
  test('https obligatoire', () => {
    assert.equal(app.relayOk('https://plaud.moi.workers.dev'), true);
    assert.equal(app.relayOk(' https://plaud.moi.workers.dev/ '), true);
    assert.equal(app.relayOk('http://plaud.moi.workers.dev'), false);
    assert.equal(app.relayOk('plaud.moi.workers.dev'), false);
    assert.equal(app.relayOk(''), false);
  });
});

test.describe('Tâches venant d\'un calendrier ou d\'une IA', () => {
  test('une tâche reste sur une seule ligne (pas de fausses lignes Markdown)', () => {
    const s = app.buildTask({ text: 'Devoir\n## Faux titre\n- [ ] fausse tâche', tags: ['a b'], prio: 0 });
    assert.equal(s.includes('\n'), false);
    assert.equal(s, 'Devoir ## Faux titre - [ ] fausse tâche #a-b');
  });
});

test.describe('Formules (KaTeX)', () => {
  test('version figée, empreintes d\'intégrité, commandes dangereuses désactivées', () => {
    assert.match(app.KATEX_BASE, /katex@\d+\.\d+\.\d+\/dist\/$/);
    assert.match(app.KATEX_SRI.js, /^sha384-[A-Za-z0-9+/=]{64}$/);
    assert.match(app.KATEX_SRI.css, /^sha384-[A-Za-z0-9+/=]{64}$/);
    assert.equal(app.KATEX_OPTS.trust, false);
    assert.ok(Number.isFinite(app.KATEX_OPTS.maxSize));
  });

  test('renderMath transmet bien ces options', async () => {
    run(`window.katex = { render: (tex, el, o) => { globalThis.__opts = o; } };`);
    await run(`renderMath({ querySelectorAll: () => [{ dataset: { tex: '\\\\href{javascript:alert(1)}{x}', display: '0' }, classList: { add() {} } }] })`);
    const o = run('__opts');
    assert.equal(o.trust, false);
    assert.equal(o.displayMode, false);
  });
});
