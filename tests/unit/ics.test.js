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

/* ---------- Bugs corrigés (chantier 2) ---------- */
test.describe('Bugs corrigés : récurrences et fuseaux', () => {
  const days = (evs) => evs.map((e) => new Date(e.start).toISOString().slice(5, 16));

  test('BYDAY : un cours deux fois par semaine donne bien les deux séances', () => {
    const evs = app.icsEvents(ics(ev('UID:bd', 'SUMMARY:Analyse', 'DTSTART;TZID=Europe/Brussels:20260907T083000', 'DTEND;TZID=Europe/Brussels:20260907T103000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=4')));
    assert.deepEqual(days(evs), ['09-07T06:30', '09-10T06:30', '09-14T06:30', '09-17T06:30']);
    assert.deepEqual(evs.map((e) => e.uid), ['bd#0', 'bd#1', 'bd#2', 'bd#3']);
  });

  test('BYDAY avec INTERVAL et UNTIL', () => {
    const evs = app.icsEvents(ics(ev('UID:bi', 'SUMMARY:Labo', 'DTSTART;TZID=Europe/Brussels:20260909T140000', 'DTEND;TZID=Europe/Brussels:20260909T160000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,FR;UNTIL=20261002T235959Z')));
    assert.deepEqual(days(evs), ['09-09T12:00', '09-11T12:00', '09-23T12:00', '09-25T12:00']);
  });

  test('DAILY limité aux jours ouvrés (BYDAY)', () => {
    const evs = app.icsEvents(ics(ev('UID:dd', 'SUMMARY:Stage', 'DTSTART;TZID=Europe/Brussels:20261002T090000', 'DTEND;TZID=Europe/Brussels:20261002T120000', 'RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=3')));
    assert.deepEqual(days(evs), ['10-02T07:00', '10-05T07:00', '10-06T07:00']);
  });

  test('EXDATE en date seule (VALUE=DATE) retire bien la séance', () => {
    const evs = app.icsEvents(ics(ev('UID:ex', 'SUMMARY:Algo', 'DTSTART;TZID=Europe/Brussels:20260907T083000', 'DTEND;TZID=Europe/Brussels:20260907T103000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'EXDATE;VALUE=DATE:20260914')));
    assert.deepEqual(days(evs), ['09-07T06:30', '09-21T06:30']);
    assert.deepEqual(evs.map((e) => e.uid), ['ex#0', 'ex#2']);
  });

  test('UNTIL en date seule inclut le dernier jour', () => {
    const evs = app.icsEvents(ics(ev('UID:ud', 'SUMMARY:Algo', 'DTSTART;TZID=Europe/Brussels:20260907T083000', 'DTEND;TZID=Europe/Brussels:20260907T103000', 'RRULE:FREQ=WEEKLY;UNTIL=20260921')));
    assert.deepEqual(days(evs), ['09-07T06:30', '09-14T06:30', '09-21T06:30']);
  });

  test('séance déplacée (RECURRENCE-ID) : pas de doublon, l\'identifiant de la séance est gardé', () => {
    const evs = app.icsEvents(ics(
      ev('UID:mv', 'SUMMARY:Physique', 'DTSTART;TZID=Europe/Brussels:20260907T083000', 'DTEND;TZID=Europe/Brussels:20260907T103000', 'RRULE:FREQ=WEEKLY;COUNT=3'),
      ev('UID:mv', 'RECURRENCE-ID;TZID=Europe/Brussels:20260914T083000', 'SUMMARY:Physique', 'DTSTART;TZID=Europe/Brussels:20260915T100000', 'DTEND;TZID=Europe/Brussels:20260915T120000', 'LOCATION:Auditoire A'),
    ));
    assert.deepEqual(days(evs), ['09-07T06:30', '09-15T08:00', '09-21T06:30']);
    assert.equal(evs[1].uid, 'mv#1');
    assert.equal(evs[1].location, 'Auditoire A');
  });

  test('séance annulée dans une série (RECURRENCE-ID + CANCELLED)', () => {
    const evs = app.icsEvents(ics(
      ev('UID:cx', 'SUMMARY:Physique', 'DTSTART;TZID=Europe/Brussels:20260907T083000', 'DTEND;TZID=Europe/Brussels:20260907T103000', 'RRULE:FREQ=WEEKLY;COUNT=3'),
      ev('UID:cx', 'RECURRENCE-ID;TZID=Europe/Brussels:20260914T083000', 'STATUS:CANCELLED', 'SUMMARY:Physique', 'DTSTART;TZID=Europe/Brussels:20260914T083000'),
    ));
    assert.deepEqual(days(evs), ['09-07T06:30', '09-21T06:30']);
  });

  test('récurrence calculée dans le fuseau du calendrier, pas celui du téléphone', () => {
    // New York change d'heure le 1er novembre, Bruxelles le 25 octobre : 9 h 30 à New York reste 9 h 30
    const evs = app.icsEvents(ics(ev('UID:ny', 'SUMMARY:Seminar', 'DTSTART;TZID=America/New_York:20261019T093000', 'DTEND;TZID=America/New_York:20261019T103000', 'RRULE:FREQ=WEEKLY;COUNT=4')));
    assert.deepEqual(days(evs), ['10-19T13:30', '10-26T13:30', '11-02T14:30', '11-09T14:30']);
  });

  test('récurrence en heure UTC : même heure UTC chaque semaine', () => {
    const evs = app.icsEvents(ics(ev('UID:z', 'SUMMARY:Cours', 'DTSTART:20261019T083000Z', 'DTEND:20261019T100000Z', 'RRULE:FREQ=WEEKLY;COUNT=3')));
    assert.deepEqual(days(evs), ['10-19T08:30', '10-26T08:30', '11-02T08:30']);
  });

  test('fuseaux au format Outlook ou avec préfixe', () => {
    const [a] = app.icsEvents(ics(ev('UID:w', 'SUMMARY:A', 'DTSTART;TZID="Romance Standard Time":20260707T100000', 'DTEND;TZID="Romance Standard Time":20260707T110000')));
    const [b] = app.icsEvents(ics(ev('UID:p', 'SUMMARY:B', 'DTSTART;TZID=/freeassociation.sourceforge.net/America/New_York:20260707T100000', 'DTEND;TZID=/freeassociation.sourceforge.net/America/New_York:20260707T110000')));
    assert.equal(iso(a.start), '2026-07-07T08:00:00.000Z');
    assert.equal(iso(b.start), '2026-07-07T14:00:00.000Z');
  });

  test('le texte d\'une alarme (VALARM) ne devient pas la description du cours', () => {
    const [e] = app.icsParse(ics(ev('UID:al', 'SUMMARY:Algo', 'DTSTART:20261005T080000Z', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:This is an event reminder', 'TRIGGER:-PT10M', 'END:VALARM')));
    assert.equal(e.DESCRIPTION, undefined);
    assert.equal(e.TRIGGER, undefined);
    assert.equal(e.SUMMARY.value, 'Algo');
  });

  test('journées entières : les congés sont ignorés, les échéances et examens gardés sans être pris pour un cours en cours', () => {
    const evs = app.icsEvents(ics(
      ev('UID:h', 'SUMMARY:Congé de Toussaint', 'DTSTART;VALUE=DATE:20261102', 'DTEND;VALUE=DATE:20261103'),
      ev('UID:d', 'SUMMARY:Remise du rapport de stage', 'DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261106'),
      ev('UID:x', 'SUMMARY:Examen de chimie', 'DTSTART;VALUE=DATE:20261106'),
    ));
    assert.deepEqual(evs.map((e) => [e.uid, e.kind, e.allDay]), [['d', 'due', true], ['x', 'exam', true]]);
  });
});

test.describe('Bugs corrigés : rangement des notes avec une journée entière', () => {
  test('un examen sur toute la journée ne capte pas les enregistrements du jour', () => {
    const { app: a2, run } = loadApp({ now: NOW });
    run(`AG = { events: icsEvents(${JSON.stringify(ics(
      ev('UID:x', 'SUMMARY:Examen de chimie', 'DTSTART;VALUE=DATE:20261006'),
      ev('UID:c', 'SUMMARY:Algorithmique', 'DTSTART:20261006T080000Z', 'DTEND:20261006T100000Z'),
    ))}), at: 1, src: 'file' }; MATS = null;`);
    assert.equal(a2.courseAt(Date.UTC(2026, 9, 6, 9, 0)).uid, 'c');
    assert.equal(a2.courseAt(Date.UTC(2026, 9, 6, 15, 0)), null);
  });
});
