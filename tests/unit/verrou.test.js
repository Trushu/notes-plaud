'use strict';
// Verrouillage par code (S1) : règles du code, pauses après des erreurs, réglage abîmé
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

test.describe('Verrouillage par code (S1)', () => {
  test('un code fait de 4 à 8 chiffres ; les suites évidentes sont refusées', () => {
    const { app, stop } = loadApp();
    for (const ok of ['2580', '73914', '19370428']) assert.equal(app.PIN_OK(ok), true, ok);
    for (const ko of ['258', '123456789', '25a0', ' 2580', '']) assert.equal(app.PIN_OK(ko), false, ko);
    for (const easy of ['0000', '1111', '1234', '4321', '123456', '98765', '0123']) assert.equal(app.pinTooEasy(easy), true, easy);
    for (const fine of ['2580', '1357', '9021', '19370428']) assert.equal(app.pinTooEasy(fine), false, fine);
    stop();
  });

  test('pause après 5 erreurs : 30 s, doublée toutes les 5 erreurs, 15 min au plus', () => {
    const { app, stop } = loadApp();
    assert.deepEqual([1, 4, 5, 9, 10, 15, 30, 100].map(app.lockWaitFor), [0, 0, 30000, 30000, 60000, 120000, 900000, 900000]);
    stop();
  });

  test('réglage abîmé ou incomplet : pas de verrouillage (l\'app reste utilisable)', () => {
    const { app, localStorage, stop } = loadApp();
    assert.equal(app.lockCfg(), null);
    localStorage.setItem('np-lock', '{abîmé');
    assert.equal(app.lockCfg(), null);
    localStorage.setItem('np-lock', JSON.stringify({ h: 'x' }));
    assert.equal(app.lockCfg(), null);
    localStorage.setItem('np-lock', JSON.stringify({ h: 'x', s: 'y', n: 4, d: 0 }));
    assert.equal(app.lockCfg().n, 4);
    localStorage.setItem('np-lock-fail', 'n');
    assert.deepEqual(app.lockFails(), { n: 0, u: 0 });
    stop();
  });

  test('les sauvegardes n\'emportent pas le code (propre à ce téléphone)', () => {
    const { run, stop } = loadApp();
    for (const f of ['backupPrefs', 'restorePrefs']) assert.doesNotMatch(run(`${f}.toString()`), /np-lock/, f);
    stop();
  });
});
