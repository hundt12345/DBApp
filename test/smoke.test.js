// Smoke-Tests der Preis-Engine (node --test)
//
// KERN-REGELN (verifiziert):
//  * (Super)Sparpreis ist DIREKT nach Assmannshausen buchbar und deckt die
//    GESAMTE gebuchte Verbindung ab (S 11 + ICE [Zugbindung] + Nachlauf, frei wählbar)
//    → EINE Ticketzeile, keine Zusatz-RP-/RMV-Tickets (bahn.de-FAQ).
//  * Kein Fernverkehr an der rechten Rheinstrecke (Rüdesheim/Bingen = RE/RB).
//  * City-Ticket = getrenntes Extra, hier nicht nötig (S 11 im Ticket).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { computeQuote } from '../src/engine.js';

// Browser-Script (live.js) in Node laden, um die Parser testen zu können
vm.runInThisContext(readFileSync(new URL('../public/js/live.js', import.meta.url), 'utf8'));
const liveParser = globalThis.DBAppLive._test;

const P2 = [
  { age: 34, bc25: 'none', bike: false, dtt: false, ownChild: true },
  { age: 38, bc25: 'none', bike: false, dtt: false, ownChild: true },
  { age: 8, bc25: 'none', bike: false, dtt: false, ownChild: true }
];
const SAT = { date: '2026-10-24', window: 'any', ssScenario: 'ab', lastLeg: 'auto', vrsAbo: false, ticketType: 'ss' };

function best(result) {
  return result.options.find((o) => o.best);
}
function opt(result, id) {
  return result.options.find((o) => o.id === id);
}

test('Standardfamilie (2 Erw. + Kind 8), Samstag, SS: Direktticket linkrheinisch gewinnt (35,98 €)', () => {
  const r = computeQuote({ ...SAT, people: P2 });
  // EINE Ticketzeile pro Person, ganze Verbindung enthalten, Kind frei
  assert.equal(best(r).id, 'sp_direct');
  assert.equal(best(r).total, 35.98); // 2×17,99
  assert.equal(opt(r, 'sp_direct_frankfurt').total, 35.98); // gleiches Modell-Ab-Preis, anderer Umweg
  assert.equal(opt(r, 'flex_direct').total, 110.25); // 2×44,10 + 22,05 (Kind 50 %)
  assert.equal(opt(r, 'nv_linksrheinisch').total, 119.8); // 59,80 + 40 RP + 20,00 RMV (2 Waben, Kind 2,20)
  assert.equal(opt(r, 'nv_rechtsrheinisch').total, 109.8); // 59,80 + 40 RP + 10,00 RMV (1 Wabe)
  assert.equal(opt(r, 'dtt_nahverkehr'), undefined);
  // S 11 und Nachlauf werden NICHT extra berechnet (im Ticket)
  const a = opt(r, 'sp_direct');
  assert.equal(a.rows.find((x) => /S 11/.test(x.label)).amount, 0);
  assert.equal(a.rows.find((x) => /Letzter Abschnitt/.test(x.label)).amount, 0);
});

test('Sparpreis-Typ: Ab-Preis 21,99 (ganze Verbindung, ohne Extra-Stadt-Ticket)', () => {
  const r = computeQuote({ ...SAT, ticketType: 'sp', people: P2 });
  assert.equal(best(r).id, 'sp_direct');
  assert.equal(best(r).total, 43.98); // 2×21,99
  // Kein 2,90-€-Stadt-Ticket: die S 11 ist Teil der gebuchten Verbindung
  assert.equal(best(r).rows.find((x) => /Kurzstrecke/.test(x.label)), undefined);
});

test('SuperSparpreis ausverkauft: Fernverkehr-Optionen weg – RE rechtsrheinisch gewinnt', () => {
  const r = computeQuote({ ...SAT, ssScenario: 'ausverkauft', people: P2 });
  assert.equal(opt(r, 'sp_direct').available, false);
  assert.equal(opt(r, 'sp_direct_frankfurt').available, false);
  assert.match(opt(r, 'sp_direct').reason, /ausverkauft/i);
  assert.equal(opt(r, 'flex_direct').available, true);
  assert.equal(best(r).id, 'nv_rechtsrheinisch');
  assert.equal(best(r).total, 109.8);
});

test('Kurzfristig (10.10., 3 Tage Vorlauf): Sparpreise bleiben buchbar + Hinweis zum ab-Preis', () => {
  const r = computeQuote({ ...SAT, date: '2026-10-10', people: P2 });
  assert.equal(r.meta.ssAvailable, true);
  assert.equal(r.meta.shortLead, true);
  for (const id of ['sp_direct', 'sp_direct_frankfurt']) {
    assert.equal(opt(r, id).available, true, id);
    assert.match(opt(r, id).notes.join('\n'), /Kurzfrist/);
  }
  assert.equal(best(r).id, 'sp_direct');
  assert.equal(best(r).total, 35.98);
});

test('Werktags 06:00: 9-Uhr-Regel blockiert nur die RP-Ticket-Optionen (E/G)', () => {
  const r = computeQuote({ ...SAT, date: '2026-10-28', window: 'morning', departHM: '06:00', people: P2 });
  assert.equal(opt(r, 'nv_linksrheinisch').available, false);
  assert.equal(opt(r, 'nv_rechtsrheinisch').available, false);
  assert.match(opt(r, 'nv_rechtsrheinisch').reason, /9:00/);
  // Direktgebuchte Fernverkehr-Optionen brauchen kein RP-Ticket → verfügbar
  assert.equal(opt(r, 'sp_direct').available, true);
  assert.equal(opt(r, 'sp_direct_frankfurt').available, true);
  assert.equal(opt(r, 'flex_direct').available, true);
  assert.equal(best(r).id, 'sp_direct');
  assert.equal(best(r).total, 35.98);
});

test('Deutschlandticket für alle: Nahverkehr-Option 0 € – aber Direktticket wäre teurer', () => {
  const people = [
    { age: 34, bc25: 'none', bike: true, dtt: true, ownChild: true },
    { age: 38, bc25: 'none', bike: true, dtt: true, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, people });
  assert.equal(opt(r, 'dtt_nahverkehr').total, 0);
  assert.equal(best(r).id, 'dtt_nahverkehr');
});

test('5 Erwachsene: Direktticket (89,95 €) schlägt alle Verbund-Kombis', () => {
  const people = [34, 35, 36, 37, 38].map((age) => ({ age, bc25: 'none', bike: false, dtt: false, ownChild: true }));
  const r = computeQuote({ ...SAT, people });
  assert.equal(opt(r, 'sp_direct').total, 89.95); // 5×17,99
  assert.equal(opt(r, 'nv_linksrheinisch').total, 168.8); // 59,80 + 70 RP + 39,00 RMV
  assert.equal(opt(r, 'nv_rechtsrheinisch').total, 149.3); // 59,80 + 70 RP + 19,50 RMV
  assert.equal(best(r).id, 'sp_direct');
});

test('Neue BahnCard 25 (Sparpreis): 25 % Rabatt + Kartenpreis 62,90 €', () => {
  const r = computeQuote({
    ...SAT,
    ticketType: 'sp',
    people: [{ age: 34, bc25: 'new', bike: false, dtt: false, ownChild: true }]
  });
  const b = opt(r, 'sp_direct');
  // 21,99×0,75≈16,49 + 62,90 = 79,39
  assert.equal(b.total, 79.39);
  assert.equal(b.rows.find((x) => /BahnCard/.test(x.label)).amount, 62.9);
});

test('Klapprad: Preis bleibt gleich (gefaltet überall frei), erster Abschnitt +15 min', () => {
  const people = [
    { age: 34, bc25: 'none', bike: true, dtt: false, ownChild: true },
    { age: 38, bc25: 'none', bike: true, dtt: false, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, people });
  const a = opt(r, 'sp_direct');
  assert.equal(a.total, 35.98);
  assert.equal(a.minutes, 195); // Modell 180 + 15 (Radtour statt S 11)
});

test('VRS-Abo: redundant (S 11 ist im Ticket) – Kinder <6 frei', () => {
  const people = [
    { age: 34, bc25: 'none', bike: false, dtt: false, ownChild: true },
    { age: 3, bc25: 'none', bike: false, dtt: false, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, vrsAbo: true, people });
  const b = opt(r, 'sp_direct');
  // 1×17,99 (Kleinkind frei), keine sonstigen Kosten
  assert.equal(b.total, 17.99);
});

test('Alt-Optionen existieren nicht mehr (Mainz-Ausstieg-Trick, Bingen-Fähre, Flex Köln→Rüdesheim)', () => {
  const r = computeQuote({ ...SAT, people: P2 });
  for (const id of ['ss_direct', 'sp_mainz_koblenz', 'sp_mainz_direct', 'sp_frankfurt_detour', 'flex_koblenz', 'faehre_bingen']) {
    assert.equal(r.options.find((o) => o.id === id), undefined, id);
  }
  // 5 Fern/Verbund-Optionen (A, C, D, E, G) verfügbar, F fehlt (nicht alle DtT)
  assert.equal(r.options.filter((o) => o.available).length, 5);
});

test('Live: echte bahn.de-Angebote (Parkgürtel→Assmannshausen) ersetzen Modell + Route-Klassifikation', () => {
  const live = {
    status: 'live',
    asOf: '12:00',
    via: ['corsproxy.io'],
    errors: [],
    ss: {
      all: {
        status: 'ok', asOf: '12:00',
        data: {
          minPrice: 21.69,
          offerName: 'SuperSparpreis',
          zb: true,
          journeys: [
            { price: 21.69, offerName: 'SuperSparpreis', offerDesc: 'nur gültig am 24.10.', zb: true, totalMin: 143, depStr: '10:18', arrStr: '12:41',
              trains: [
                { from: 'Köln Parkgürtel', to: 'Köln Hbf', depMin: 618, arrMin: 628, train: 'S 11 90110', product: 'S-Bahn' },
                { from: 'Köln Hbf', to: 'Mainz Hbf', depMin: 640, arrMin: 725, train: 'ICE 318', product: 'ICE' },
                { from: 'Mainz Hbf', to: 'Assmannshausen', depMin: 745, arrMin: 761, train: 'RE 7008', product: 'regional' }
              ] },
            { price: 24.9, offerName: 'SuperSparpreis', offerDesc: '', zb: true, totalMin: 168, depStr: '11:02', arrStr: '13:50',
              trains: [
                { from: 'Köln Parkgürtel', to: 'Köln Hbf', depMin: 662, arrMin: 672, train: 'S 11 90120', product: 'S-Bahn' },
                { from: 'Köln Hbf', to: 'Frankfurt (Main) Hbf', depMin: 685, arrMin: 750, train: 'ICE 458', product: 'ICE' },
                { from: 'Frankfurt (Main) Hbf', to: 'Rüdesheim (Rhein)', depMin: 765, arrMin: 840, train: 'RE 21 10204', product: 'regional' },
                { from: 'Rüdesheim (Rhein)', to: 'Assmannshausen', depMin: 848, arrMin: 858, train: 'RB 10 20202', product: 'regional' }
              ] }
          ]
        }
      }
    },
    nv: {
      nv_koln_assmannshausen_all: {
        status: 'ok', asOf: '12:00',
        data: { journeys: [{ totalMin: 250, depStr: '10:32', arrStr: '14:42', legs: [
          { from: 'Köln Parkgürtel', to: 'Köln Hbf', depMin: 632, arrMin: 642, train: 'S 11', product: 'regional' },
          { from: 'Köln Hbf', to: 'Assmannshausen', depMin: 655, arrMin: 882, train: 'RE 7008', product: 'regional' }
        ] }] }
      }
    }
  };

  const r = computeQuote({ ...SAT, people: P2, live });
  const a = opt(r, 'sp_direct');
  const c = opt(r, 'sp_direct_frankfurt');

  // Live-Preise p.P. ersetzen Modell-Ab-Preis: 2×21,69 bzw. 2×24,90
  assert.equal(a.total, 43.38);
  assert.equal(c.total, 49.8);
  // Ganze Verbindung im Ticket: exakt EINE kostenpflichtige Zeile (das Ticket)
  assert.equal(a.rows.filter((x) => x.amount > 0).length, 1);
  assert.equal(c.rows.filter((x) => x.amount > 0).length, 1);

  // Konkrete gebuchte Verbindung (ALLE Züge) + Zugbindung nur im Fernzug
  assert.equal(a.liveInfo.fern.train, 'ICE 318');
  assert.equal(a.liveInfo.fern.legs.length, 3); // S 11 + ICE + RE
  assert.equal(a.liveInfo.fern.price, 21.69);
  assert.equal(a.liveInfo.fern.alternatives[0].price, 24.9);
  assert.equal(a.minutes, 143);

  // Route-Klassifikation: Frankfurt-Angebot geht zur Umweg-Option
  assert.equal(c.liveInfo.fern.train, 'ICE 458');
  assert.equal(c.liveInfo.fern.legs.length, 4);
  assert.equal(c.minutes, 168);

  // Zugbindung-Transparenz: reine NV-Verbindung (250 min) vs. Option (143 min)
  assert.equal(a.liveInfo.nvAlt.totalMin, 250);
  assert.equal(a.liveInfo.nvAlt.diffMin, 107);

  // Meta: Status des einen Segments
  assert.equal(r.meta.live.ss.all, 'ok');
});

test('Live „empty“ (Preissuche ohne Angebot für den Tag): Fernverkehr-Optionen NICHT buchbar', () => {
  const live = {
    status: 'error',
    asOf: '12:00',
    via: ['corsproxy.io'],
    errors: ['Sparpreis all: keine Angebote'],
    ss: { all: { status: 'empty', asOf: '12:00', error: 'keine Verbindungen' } },
    nv: {}
  };
  const r = computeQuote({ ...SAT, people: P2, live });
  const a = opt(r, 'sp_direct');
  assert.equal(a.available, false);
  assert.match(a.reason, /Live-Preissuche.*KEIN Sparpreis-Angebot/);
  assert.equal(opt(r, 'sp_direct_frankfurt').available, false);
  // Ohne Fernverkehr bleibt der Verbund-Weg + Flex (Modell)
  assert.equal(opt(r, 'nv_linksrheinisch').available, true);
  assert.equal(opt(r, 'flex_direct').available, true);
  assert.equal(best(r).id, 'nv_rechtsrheinisch');
});

test('Live aus: Modell bleibt unverändert (Rückwärtskompatibilität)', () => {
  const r1 = computeQuote({ ...SAT, people: P2, live: { status: 'off' } });
  const r2 = computeQuote({ ...SAT, people: P2 });
  assert.equal(r1.options[0].total, r2.options[0].total);
  assert.equal(r1.meta.live, undefined);
  assert.equal(r2.meta.live, undefined);
});

test('ps.bahn.de-Parser: Angebote, Preise & ganze Verbindung (zeitliche Formattoleranz)', () => {
  const { parsePreissuche } = liveParser;
  const body = {
    peTexte: { n1: { name: 'SuperSparpreis', hinweis: 'nur gültig am 24.10.' } },
    angebote: { o1: { tt: 'SP', p: '21,69', sids: ['j1', 'j2'], zb: 'Y', pky: 'n1' } },
    verbindungen: {
      j1: { sid: 'j1', trains: [
        { s: '8003360', sn: 'Köln Parkgürtel', dep: '10:18', d: '8000207', dn: 'Köln Hbf', arr: '10:28', tn: 'S 11', eg: 'S-Bahn' },
        { s: '8000207', sn: 'Köln Hbf', dep: '10:40', d: '8000240', dn: 'Mainz Hbf', arr: '12:05', tn: 'ICE 318', eg: 'ICE' },
        { s: '8000240', sn: 'Mainz Hbf', dep: 745, d: '8000635', dn: 'Assmannshausen', arr: 761, tn: 'RE 7008', eg: 'regional' }
      ] },
      j2: { sid: 'j2', trains: [{ s: '8000207', sn: 'Köln Hbf', dep: 693, d: '8000206', dn: 'Koblenz', arr: 768, tn: 'ICE 161', eg: 'ICE' }] }
    }
  };
  const p = parsePreissuche(body);
  assert.equal(p.minPrice, 21.69);
  assert.equal(p.offerName, 'SuperSparpreis');
  assert.equal(p.zb, true);
  const j = p.journeys.find((x) => x.depStr === '10:18');
  assert.equal(j.arrStr, '12:41');
  assert.equal(j.totalMin, 143);
  assert.equal(j.trains.length, 3);
  assert.equal(j.trains[1].train, 'ICE 318');
  assert.equal(j.price, 21.69);
});

test('DB-API-Parser: Verbindungen (itineraries-Format, Europe/Berlin-Zeiten)', () => {
  const { parseConnections, toMinutes } = liveParser;
  assert.equal(toMinutes('2026-10-24T11:10:00.000+02:00'), 11 * 60 + 10);
  assert.equal(toMinutes('09:00'), 540);
  assert.equal(toMinutes('45'), 45);
  const body = {
    results: [{
      itineraries: [{
        departure: { dateTime: '2026-10-24T11:10:00.000+02:00' },
        arrival: { dateTime: '2026-10-24T13:35:00.000+02:00' },
        legs: [{
          origin: { name: 'Koblenz' },
          destination: { name: 'Assmannshausen' },
          departure: { dateTime: '2026-10-24T11:10:00.000+02:00' },
          arrival: { dateTime: '2026-10-24T13:35:00.000+02:00' },
          line: { name: 'RE 7008', mode: 'rail' }
        }]
      }]
    }]
  };
  const c = parseConnections(body);
  assert.equal(c.journeys[0].legs[0].train, 'RE 7008');
  assert.equal(c.journeys[0].legs[0].depStr, '11:10');
  assert.equal(c.journeys[0].legs[0].arrStr, '13:35');
  assert.equal(c.journeys[0].totalMin, 145);
});
