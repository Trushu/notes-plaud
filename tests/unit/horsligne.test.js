'use strict';
// Questions hors ligne (F4) : file d'attente gardée dans le téléphone, robuste aux données abîmées
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

test.describe('File des questions en attente (F4)', () => {
  test('lecture tolérante : contenu abîmé ou entrées incomplètes ignorés', () => {
    const { app, localStorage, stop } = loadApp();
    localStorage.setItem('np-askq', '{pas du json');
    assert.deepEqual(app.getAskQ(), []);
    localStorage.setItem('np-askq', JSON.stringify({ q: 'objet seul' }));
    assert.deepEqual(app.getAskQ(), []);
    localStorage.setItem('np-askq', JSON.stringify([null, { q: 'sans id' }, { id: 'a', q: 42 }, { id: 'b', q: 'ok', scope: 'all' }]));
    assert.deepEqual(app.getAskQ().map((x) => x.id), ['b']);
    stop();
  });

  test('au plus 20 questions gardées ; retirer une question', () => {
    const { app, localStorage, stop } = loadApp();
    app.setAskQ(Array.from({ length: 25 }, (_, i) => ({ id: 'q' + i, q: 'Q' + i, scope: 'all' })));
    assert.equal(app.getAskQ().length, 20);
    assert.equal(app.getAskQ()[0].id, 'q5');   // les plus anciennes partent en premier
    app.unqueueAsk('q7');
    assert.ok(!app.getAskQ().some((x) => x.id === 'q7'));
    assert.equal(JSON.parse(localStorage.getItem('np-askq')).length, 19);
    stop();
  });

  test('même portée : même note, même matière, ou toutes les notes', () => {
    const { app, stop } = loadApp();
    assert.equal(app.sameSpec({ scope: 'note', noteId: 'a' }, { scope: 'note', noteId: 'a', course: null }), true);
    assert.equal(app.sameSpec({ scope: 'note', noteId: 'a' }, { scope: 'note', noteId: 'b' }), false);
    assert.equal(app.sameSpec({ scope: 'course', course: 'm1' }, { scope: 'course', course: 'm2' }), false);
    assert.equal(app.sameSpec({ scope: 'all' }, { scope: 'all', noteId: null, course: null }), true);
    assert.equal(app.specChatKey({ scope: 'course', course: 'm1' }), 'np-chat-crs-m1');
    assert.equal(app.specChatKey({ scope: 'all' }), 'np-chat-all');
    stop();
  });
});
