'use strict';
// Date d'un enregistrement reprise du nom du fichier
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const NOW = new Date(2026, 9, 4, 12, 0).getTime();
const { app } = loadApp({ now: NOW });
const local = (...a) => new Date(...a).getTime();

test.describe('dateFromName', () => {
  test('formats année-mois-jour avec heure', () => {
    assert.equal(app.dateFromName('2025-03-12 14-30.mp3'), local(2025, 2, 12, 14, 30));
    assert.equal(app.dateFromName('2025-03-12 14-30-05.mp3'), local(2025, 2, 12, 14, 30, 5));
    assert.equal(app.dateFromName('20250312_143005.m4a'), local(2025, 2, 12, 14, 30, 5));
    assert.equal(app.dateFromName('REC 2025.03.12 9h05.wav'.replace('9h05', '09h05')), local(2025, 2, 12, 9, 5));
    assert.equal(app.dateFromName('enregistrement-2026-10-01-08h15.webm'), local(2026, 9, 1, 8, 15));
  });

  test('sans heure : midi', () => {
    assert.equal(app.dateFromName('cours 2025-03-12.mp3'), local(2025, 2, 12, 12, 0));
    assert.equal(app.dateFromName('12-03-2025.mp3'), local(2025, 2, 12, 12, 0));
  });

  test('format jour-mois-année avec heure', () => {
    assert.equal(app.dateFromName('Réunion 12-03-2025 14-30.mp3'), local(2025, 2, 12, 14, 30));
    assert.equal(app.dateFromName('12.03.2025 09h05.mp3'), local(2025, 2, 12, 9, 5));
  });

  test('dates impossibles, trop anciennes ou dans le futur', () => {
    assert.equal(app.dateFromName('2025-02-30 10-00.mp3'), null);
    assert.equal(app.dateFromName('2009-05-01.mp3'), null);
    assert.equal(app.dateFromName('2027-01-01.mp3'), null);
    assert.equal(app.dateFromName('2026-10-05 09-00.mp3'), local(2026, 9, 5, 9, 0));   // demain : accepté (décalage horaire)
  });

  test('pas de date', () => {
    assert.equal(app.dateFromName('Partage.mp3'), null);
    assert.equal(app.dateFromName(''), null);
    assert.equal(app.dateFromName(undefined), null);
    assert.equal(app.dateFromName('piste 123456789.mp3'), null);
  });
});

test.describe('Bugs corrigés', () => {
  test('« 12.03.2025_0905 » est le 12 mars 2025 à 9 h 05, pas le 5 septembre', () => {
    assert.equal(app.dateFromName('12.03.2025_0905.mp3'), local(2025, 2, 12, 9, 5));
    assert.equal(app.dateFromName('Cours 12-03-2025_1430.m4a'), local(2025, 2, 12, 14, 30));
    // le format année-mois-jour reste prioritaire quand il commence en premier
    assert.equal(app.dateFromName('2025-03-12_0905.mp3'), local(2025, 2, 12, 9, 5));
  });
});
