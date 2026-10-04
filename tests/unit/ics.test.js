'use strict';
// Emploi du temps : lecture des calendriers .ics, fuseaux horaires et récurrences
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const NOW = Date.UTC(2026, 9, 4, 10, 0, 0);   // dimanche 4 octobre 2026, 12 h à Bruxelles
const { app } = loadApp({ now: NOW });
const ics = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flat(), 'END:VCALENDAR'].join('\r\n');
const ev = (...lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
const iso = (t) => new Date(t).toISOString();

test.describe('icsParse', () => {
  test('lit les propriétés, leurs paramètres et les lignes repliées', () => {
    const [e] = app.icsParse(ics(ev('UID:abc@moodle', 'SUMMARY:Algo', ' rithmique', 'DTSTART;TZID=Europe/Brussels:20261005T083000', 'LOCATION:Salle L12')));
    assert.equal(e.UID.value, 'abc@moodle');
    assert.equal(e.SUMMARY.value, 'Algorithmique');
    assert.equal(e.DTSTART.value, '20261005T083000');
    assert.deepEqual(e.DTSTART.params, { TZID: 'Europe/Brussels' });
    assert.equal(e.LOCATION.value, 'Salle L12');
  });

  test('accepte les fins de ligne Unix et les tabulations de repli', () => {
    const [e] = app.icsParse('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Ana\n\tlyse\nDTSTART:20261005T080000Z\nEND:VEVENT\nEND:VCALENDAR');
    assert.equal(e.SUMMARY.value, 'Analyse');
  });

  test('rassemble toutes les dates EXDATE (plusieurs lignes, plusieurs valeurs)', () => {
    const [e] = app.icsParse(ics(ev('DTSTART:20261005T080000Z', 'EXDATE;TZID=Europe/Brussels:20261012T100000,20261019T100000', 'EXDATE:20261026T090000Z')));
    assert.deepEqual(e.EXDATE.map((x) => x.value), ['20261012T100000', '20261019T100000', '20261026T090000Z']);
    assert.equal(e.EXDATE[0].params.TZID, 'Europe/Brussels');
  });

  test('garde la première occurrence d\'une propriété et ignore ce qui est hors VEVENT', () => {
    const evs = app.icsParse(ics('SUMMARY:Calendrier', ev('SUMMARY:Premier', 'SUMMARY:Second', 'DTSTART:20261005T080000Z'), ev('SUMMARY:Autre', 'DTSTART:20261006T080000Z')));
    assert.equal(evs.length, 2);
    assert.equal(evs[0].SUMMARY.value, 'Premier');
    assert.equal(evs[1].SUMMARY.value, 'Autre');
  });

  test('enlève les guillemets autour des paramètres', () => {
    const [e] = app.icsParse(ics(ev('DTSTART;TZID="Europe/Paris":20261005T080000')));
    assert.equal(e.DTSTART.params.TZID, 'Europe/Paris');
  });

  test('icsText décode les caractères échappés', () => {
    assert.equal(app.icsText('Cours\\, TP\\; salle\\nB12 \\\\ fin'), 'Cours, TP; salle\nB12 \\ fin');
  });
});

test.describe('zonedToUtc', () => {
  test('heure d\'été et heure d\'hiver à Bruxelles', () => {
    assert.equal(iso(app.zonedToUtc(2026, 6, 1, 10, 0, 0, 'Europe/Brussels')), '2026-07-01T08:00:00.000Z');
    assert.equal(iso(app.zonedToUtc(2026, 0, 15, 10, 0, 0, 'Europe/Brussels')), '2026-01-15T09:00:00.000Z');
  });

  test('autres fuseaux, quel que soit celui du téléphone', () => {
    assert.equal(iso(app.zonedToUtc(2026, 9, 5, 9, 30, 0, 'America/New_York')), '2026-10-05T13:30:00.000Z');
    assert.equal(iso(app.zonedToUtc(2026, 9, 5, 9, 30, 0, 'Asia/Tokyo')), '2026-10-05T00:30:00.000Z');
    assert.equal(iso(app.zonedToUtc(2026, 9, 5, 9, 30, 0, 'UTC')), '2026-10-05T09:30:00.000Z');
  });

  test('autour des changements d\'heure', () => {
    // veille et lendemain du passage à l'heure d'été (29 mars 2026)
    assert.equal(iso(app.zonedToUtc(2026, 2, 28, 10, 0, 0, 'Europe/Brussels')), '2026-03-28T09:00:00.000Z');
    assert.equal(iso(app.zonedToUtc(2026, 2, 30, 10, 0, 0, 'Europe/Brussels')), '2026-03-30T08:00:00.000Z');
    // 2 h 30 n'existe pas ce jour-là : on obtient une heure voisine valide (pas de plantage)
    const gap = app.zonedToUtc(2026, 2, 29, 2, 30, 0, 'Europe/Brussels');
    assert.ok(Number.isFinite(gap));
    assert.ok(Math.abs(gap - Date.UTC(2026, 2, 29, 1, 0, 0)) <= 3600000);
  });

  test('fuseau inconnu : repli sur l\'heure du téléphone', () => {
    assert.equal(app.zonedToUtc(2026, 0, 1, 10, 0, 0, 'Pas/UneZone'), new Date(2026, 0, 1, 10, 0, 0).getTime());
  });
});

test.describe('icsDate et icsDur', () => {
  test('dates UTC, locales, avec fuseau et journées entières', () => {
    assert.equal(iso(app.icsDate({ value: '20261005T083000Z', params: {} })), '2026-10-05T08:30:00.000Z');
    assert.equal(iso(app.icsDate({ value: '20261005T083000', params: { TZID: 'America/New_York' } })), '2026-10-05T12:30:00.000Z');
    assert.equal(app.icsDate({ value: '20261005T0830', params: {} }), new Date(2026, 9, 5, 8, 30).getTime());
    assert.equal(app.icsDate({ value: '20261005', params: { VALUE: 'DATE' } }), new Date(2026, 9, 5).getTime());
    assert.equal(app.icsDate({ value: 'demain', params: {} }), null);
  });

  test('durées ISO 8601', () => {
    assert.equal(app.icsDur('PT1H30M'), 90 * 60000);
    assert.equal(app.icsDur('P1DT2H'), 26 * 3600000);
    assert.equal(app.icsDur('P1W'), 7 * 86400000);
    assert.equal(app.icsDur('-PT15M'), -15 * 60000);
    assert.equal(app.icsDur('n\'importe quoi'), 0);
  });
});

test.describe('expandRule', () => {
  const base = { uid: 'u1', title: 'Algo', start: new Date(2026, 8, 7, 8, 30).getTime(), end: new Date(2026, 8, 7, 10, 30).getTime() };
  const horizon = NOW + 240 * 86400000;

  test('hebdomadaire avec COUNT', () => {
    const out = app.expandRule(base, 'FREQ=WEEKLY;COUNT=4', [], horizon);
    assert.equal(out.length, 4);
    assert.deepEqual(out.map((e) => new Date(e.start).getDate()), [7, 14, 21, 28]);
    assert.deepEqual(out.map((e) => e.uid), ['u1#0', 'u1#1', 'u1#2', 'u1#3']);
    assert.ok(out.every((e) => e.end - e.start === 2 * 3600000));
  });

  test('garde l\'heure locale de part et d\'autre du passage à l\'heure d\'hiver', () => {
    const out = app.expandRule(base, 'FREQ=WEEKLY;COUNT=10', [], horizon);
    for (const e of out) {
      const d = new Date(e.start);
      assert.equal(`${d.getHours()}:${d.getMinutes()}`, '8:30', d.toString());
    }
  });

  test('INTERVAL et UNTIL', () => {
    const out = app.expandRule(base, 'FREQ=WEEKLY;INTERVAL=2;UNTIL=20261031T235959Z', [], horizon);
    assert.deepEqual(out.map((e) => new Date(e.start).getDate()), [7, 21, 5, 19]);
  });

  test('quotidien', () => {
    const out = app.expandRule(base, 'FREQ=DAILY;COUNT=3', [], horizon);
    assert.deepEqual(out.map((e) => new Date(e.start).getDate()), [7, 8, 9]);
  });

  test('les dates exclues (EXDATE) sont retirées', () => {
    const ex = [new Date(2026, 8, 14, 8, 30).getTime()];
    const out = app.expandRule(base, 'FREQ=WEEKLY;COUNT=3', ex, horizon);
    assert.deepEqual(out.map((e) => new Date(e.start).getDate()), [7, 21]);
  });

  test('s\'arrête à l\'horizon', () => {
    const out = app.expandRule(base, 'FREQ=WEEKLY', [], new Date(2026, 9, 1).getTime());
    assert.equal(out.length, 4);
  });

  test('fréquence non gérée : l\'événement reste seul', () => {
    const out = app.expandRule(base, 'FREQ=YEARLY', [], horizon);
    assert.deepEqual(out, [base]);
  });
});

test.describe('icsEvents', () => {
  test('construit les séances : matière, type, lieu, enseignant', () => {
    const text = ics(
      ev('UID:1', 'SUMMARY:Algorithmique - TP', 'CATEGORIES:INFOB231', 'DTSTART;TZID=Europe/Brussels:20261005T083000', 'DTEND;TZID=Europe/Brussels:20261005T103000',
        'LOCATION:Salle I21', 'DESCRIPTION:INFOB231 Algorithmique et structures de données\\nJean Dupont'),
      ev('UID:2', 'SUMMARY:Devoir 1 est dû', 'DTSTART:20261010T215900Z', 'DTEND:20261010T215900Z'),
      ev('UID:3', 'SUMMARY:Annulé', 'STATUS:CANCELLED', 'DTSTART:20261011T080000Z'),
      ev('UID:4', 'SUMMARY:Examen de chimie', 'DTSTART:20261012T080000Z', 'DURATION:PT3H'),
    );
    const evs = app.icsEvents(text);
    assert.equal(evs.length, 3);
    const [tp, due, exam] = evs;
    assert.equal(tp.base, 'Algorithmique');
    assert.equal(tp.kind, 'tp');
    assert.equal(tp.key, 'INFOB231');
    assert.equal(tp.location, 'Salle I21');
    assert.equal(tp.full, 'Algorithmique et structures de données');
    assert.equal(tp.prof, 'Jean Dupont');
    assert.equal(iso(tp.start), '2026-10-05T06:30:00.000Z');
    assert.equal(due.kind, 'due');
    assert.equal(exam.kind, 'exam');
    assert.equal(exam.end - exam.start, 3 * 3600000);
  });

  test('développe les événements récurrents', () => {
    const evs = app.icsEvents(ics(ev('UID:r', 'SUMMARY:Physique', 'DTSTART;TZID=Europe/Brussels:20261006T140000', 'DTEND;TZID=Europe/Brussels:20261006T160000', 'RRULE:FREQ=WEEKLY;COUNT=3')));
    assert.equal(evs.length, 3);
    assert.deepEqual(evs.map((e) => e.uid), ['r#0', 'r#1', 'r#2']);
  });

  test('ignore un événement sans date de début valide', () => {
    assert.equal(app.icsEvents(ics(ev('UID:x', 'SUMMARY:Sans date'))).length, 0);
  });
});
