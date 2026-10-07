// Smoke-Tests der Preis-Engine (node --test)
//
// Wichtige strukturelle Fakten (verifiziert, vgl. docs/LIVE-DATEN.md):
//  - KEIN Fernverkehr nach Rüdesheim (rechte Rheinstrecke nur RE 97 „Rheintalbahn“)
//  - Fernverkehr-Segmente: linksrheinisch Koblenz/Mainz + Neubaustrecke Frankfurt
//  - City-Ticket: Sparpreis/Flexpreis >100 km (Köln teilnehmend) → erster Teil gratis;
//    SuperSparpreis → Köln-Kurzstrecke 2,90 €; VRS-Abo → 0 €
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

test('Standardfamilie (2 Erw. + Kind 8), Samstag, SuperSparpreis: Frankfurt-Umweg ist günstigste Option (73,05 €)', () => {
  const r = computeQuote({ ...SAT, people: P2 });
  // 2×17,90 SS + 7,25 Kurzstrecke (kein City-Ticket beim SS) + 20,00 VGN+RMV + 10,00 RMV
  assert.equal(best(r).id, 'sp_frankfurt_detour');
  assert.equal(best(r).total, 73.05);
  // Reihenfolge der restlichen verfügbaren Optionen
  assert.equal(opt(r, 'sp_mainz_direct').total, 82.55); // 35,80 + 7,25 + 9,50 ZMB + 30,00 RMV
  assert.equal(opt(r, 'sp_mainz_koblenz').total, 103.05); // 35,80 + 7,25 + 40 RP + 20,00 RMV
  assert.equal(opt(r, 'nv_rechtsrheinisch').total, 109.8); // 59,80 NRW + 40 RP + 10,00 RMV (1. Teil enthalten)
  assert.equal(opt(r, 'nv_linksrheinisch').total, 119.8); // 59,80 NRW + 40 RP + 20,00 RMV (1. Teil enthalten)
  assert.equal(opt(r, 'flex_koblenz').total, 217.25); // 60+60+30 (Kind 50 %) + 7,25 + 40 RP + 20,00 RMV
  assert.equal(opt(r, 'dtt_nahverkehr'), undefined); // keine DtT
  // 3-Verbund: erster Teil wird NICHT extra berechnet
  const e = opt(r, 'nv_linksrheinisch');
  assert.equal(e.rows.find((x) => /ENTHALTEN/.test(x.label)).amount, 0);
});

test('Sparpreis-Typ: City-Ticket macht ersten Teil gratis (Frankfurt-Umweg 73,80 €)', () => {
  const r = computeQuote({ ...SAT, ticketType: 'sp', people: P2 });
  const c = opt(r, 'sp_frankfurt_detour');
  // 2×21,90 SP + 0 (City-Ticket) + 20,00 VGN+RMV + 10,00 RMV
  assert.equal(c.total, 73.8);
  assert.equal(c.rows.find((x) => /City-Ticket im Fernfahrpreis/.test(x.label)).amount, 0);
  assert.equal(best(r).id, 'sp_frankfurt_detour');
});

test('SuperSparpreis ausverkauft: 3-Verbund rechtsrheinisch (109,80 €) gewinnt', () => {
  const r = computeQuote({ ...SAT, ssScenario: 'ausverkauft', people: P2 });
  assert.equal(opt(r, 'sp_mainz_koblenz').available, false);
  assert.equal(opt(r, 'sp_mainz_direct').available, false);
  assert.equal(opt(r, 'sp_frankfurt_detour').available, false);
  assert.match(opt(r, 'sp_mainz_koblenz').reason, /ausverkauft/i);
  assert.equal(best(r).id, 'nv_rechtsrheinisch');
  assert.equal(best(r).total, 109.8);
  // Flex bleibt verfügbar (Referenz)
  assert.equal(opt(r, 'flex_koblenz').available, true);
});

test('Zu kurzfristig (10.10., 3 Tage): Sparpreis-Optionen fallen weg', () => {
  const r = computeQuote({ ...SAT, date: '2026-10-10', people: P2 });
  assert.equal(r.meta.ssAvailable, false);
  assert.match(opt(r, 'sp_mainz_koblenz').reason, /14 Tage/);
  assert.equal(best(r).id, 'nv_rechtsrheinisch');
});

test('Werktags 06:00: 9-Uhr-Regel blockiert RP-Ticket-Optionen – Umwege ohne RP-Ticket bleiben', () => {
  const r = computeQuote({ ...SAT, date: '2026-10-28', window: 'morning', departHM: '06:00', people: P2 });
  assert.equal(opt(r, 'sp_mainz_koblenz').available, false);
  assert.match(opt(r, 'sp_mainz_koblenz').reason, /9:00/);
  assert.equal(opt(r, 'nv_linksrheinisch').available, false);
  assert.equal(opt(r, 'nv_rechtsrheinisch').available, false);
  // ohne RP-Ticket: Mainz-direkt + Frankfurt-Umweg bleiben
  assert.equal(opt(r, 'sp_mainz_direct').available, true);
  assert.equal(opt(r, 'sp_frankfurt_detour').available, true);
  assert.equal(best(r).id, 'sp_frankfurt_detour');
  assert.equal(best(r).total, 73.05);
});

test('Deutschlandticket für alle + Klapprad: Nahverkehr-Option kostet 0 € zusätzlich', () => {
  const people = [
    { age: 34, bc25: 'none', bike: true, dtt: true, ownChild: true },
    { age: 38, bc25: 'none', bike: true, dtt: true, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, people });
  const dtt = opt(r, 'dtt_nahverkehr');
  assert.equal(dtt.available, true);
  assert.equal(dtt.total, 0);
  assert.equal(best(r).id, 'dtt_nahverkehr');
  // DtT-Halter brauchen kein RP-Ticket mehr (Sparpreis-Option ohne RP/RMV-Zusatz)
  const a = opt(r, 'sp_mainz_koblenz');
  assert.equal(a.rows.find((x) => /Rheinland-Pfalz-Ticket/.test(x.label)).amount, 0);
});

test('5 Erwachsene: 3-Verbund rechtsrheinisch (149,30 €) schlägt Frankfurt-Umweg (162,50 €)', () => {
  const people = [34, 35, 36, 37, 38].map((age) => ({ age, bc25: 'none', bike: false, dtt: false, ownChild: true }));
  const r = computeQuote({ ...SAT, people });
  // C: 5×17,90 + 5×2,90 + 5×7,80 + 5×3,90 = 89,50 + 14,50 + 39,00 + 19,50 = 162,50
  assert.equal(opt(r, 'sp_frankfurt_detour').total, 162.5);
  // E: 59,80 NRW + 70,00 RP (5 zahlend) + 39,00 RMV (2 Waben) = 168,80
  assert.equal(opt(r, 'nv_linksrheinisch').total, 168.8);
  // G: 59,80 NRW + 70,00 RP + 19,50 RMV (1 Wabe) = 149,30 → best
  assert.equal(best(r).id, 'nv_rechtsrheinisch');
  assert.equal(best(r).total, 149.3);
});

test('Neue BahnCard 25 (Sparpreis): 25 % Rabatt + Kartenpreis 62,90 € (1 Pers.)', () => {
  const r = computeQuote({
    ...SAT,
    ticketType: 'sp',
    people: [{ age: 34, bc25: 'new', bike: false, dtt: false, ownChild: true }]
  });
  const b = opt(r, 'sp_mainz_koblenz');
  // 21,90×0,75≈16,42 + 62,90 + 0 (City) + 30 RP + 7,80 RMV
  assert.equal(b.total, 117.12);
  const rowBc = b.rows.find((x) => /BahnCard/.test(x.label));
  assert.equal(rowBc.amount, 62.9);
});

test('Klapprad: erster + letzter Teil gratis – Mainz-direkt ohne RMV-Zusatz gewinnt', () => {
  const people = [
    { age: 34, bc25: 'none', bike: true, dtt: false, ownChild: true },
    { age: 38, bc25: 'none', bike: true, dtt: false, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, people });
  const b = opt(r, 'sp_mainz_direct');
  // 2×17,90 + 0 (Rad) + 2×3,80 ZMB + 0 (Rad) = 43,40
  assert.equal(b.total, 43.4);
  assert.equal(best(r).id, 'sp_mainz_direct');
});

test('VRS-Abo: erster Teil gratis (auch ohne City-Ticket beim SuperSparpreis)', () => {
  const people = [
    { age: 34, bc25: 'none', bike: false, dtt: false, ownChild: true },
    { age: 3, bc25: 'none', bike: false, dtt: false, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, vrsAbo: true, people });
  const b = opt(r, 'sp_mainz_koblenz');
  // 1×17,90 SS + 0 (VRS-Abo + Kleinkind frei) + 30 RP (1 zahlend) + 7,80 RMV (2 Waben; Kind <6 frei)
  assert.equal(b.total, 55.7);
  assert.equal(b.rows.find((x) => /VRS-Abonnement/.test(x.label)).amount, 0);
});

test('Kein Fernverkehr nach Rüdesheim: Option „ss_direct“ existiert nicht mehr', () => {
  const r = computeQuote({ ...SAT, people: P2 });
  assert.equal(r.options.find((o) => o.id === 'ss_direct'), undefined);
  assert.equal(r.options.find((o) => o.id === 'faehre_bingen'), undefined);
  // Alle Fernverkehr-Optionen nutzen echte Fernverkehr-Segmente
  for (const id of ['sp_mainz_koblenz', 'sp_mainz_direct', 'sp_frankfurt_detour', 'flex_koblenz']) {
    assert.ok(r.options.find((o) => o.id === id), 'Option fehlt: ' + id);
  }
});

test('Live: echte Sparpreis-Angebote & konkrete Züge ersetzen Modell (Fallback pro Segment)', () => {
  const live = {
    status: 'live',
    asOf: '12:00',
    errors: [],
    ss: {
      frankfurt: {
        status: 'ok', asOf: '12:00',
        data: {
          minPrice: 19.9, offerName: 'SuperSparpreis', offerDesc: 'nur gültig am 24.10.', zb: true,
          journeys: [
            { price: 19.9, offerName: 'SuperSparpreis', offerDesc: 'nur gültig am 24.10.', zb: true, totalMin: 65, depStr: '11:02', arrStr: '12:07',
              trains: [{ from: 'Köln Hbf', to: 'Frankfurt (Main) Hbf', depMin: 662, arrMin: 727, train: 'ICE 458', product: 'ICE' }] },
            { price: 24.9, offerName: 'Sparpreis', offerDesc: '', zb: true, totalMin: 66, depStr: '12:04', arrStr: '13:10',
              trains: [{ from: 'Köln Hbf', to: 'Frankfurt (Main) Hbf', depMin: 724, arrMin: 790, train: 'ICE 460', product: 'ICE' }] }
          ]
        }
      },
      mainz: { status: 'error', error: 'CORS-Blockade' },
      koblenz: { status: 'error', error: 'CORS-Blockade' }
    },
    nv: {
      nv_frankfurt_assmannshausen: {
        status: 'ok', asOf: '12:00',
        data: { journeys: [{ totalMin: 90, depStr: '12:17', arrStr: '13:47', legs: [
          { from: 'Frankfurt (Main) Hbf', to: 'Rüdesheim (Rhein)', depMin: 737, arrMin: 812, train: 'RE 21 10204', product: 'regional' },
          { from: 'Rüdesheim (Rhein)', to: 'Assmannshausen', depMin: 817, arrMin: 827, train: 'RB 10 20202', product: 'regional' }
        ] }] }
      },
      nv_koln_assmannshausen_all: {
        status: 'ok', asOf: '12:00',
        data: { journeys: [{ totalMin: 300, depStr: '11:10', arrStr: '16:10', legs: [{ from: 'Köln Hbf', to: 'Assmannshausen', depMin: 670, arrMin: 970, train: 'RE 7008', product: 'regional' }] }] }
      }
    }
  };

  const r = computeQuote({ ...SAT, people: P2, live });
  const c = opt(r, 'sp_frankfurt_detour');

  // Live-Preis 19,90 p.P. ersetzt 17,90: 2×19,90 + 7,25 Kurzstrecke + 20,00 VGN+RMV + 10,00 RMV
  assert.equal(c.total, 77.05);
  assert.match(c.rows[0].label, /SuperSparpreis Köln→Frankfurt \(Main\) Hbf \(LIVE, 12:00/);
  assert.ok(c.notes.some((n) => /Live-Angebot \(DB-Preissuche, 12:00\)/.test(n)));

  // Live-Dauer: 10 (S 11) + 15 (U) + 65 (ICE 458) + 90 (live NV Frankfurt→Assmannshausen)
  assert.equal(c.minutes, 180);

  // Konkreter Fernzug + NV-Alternative (Zugbindung-Transparenz)
  assert.equal(c.liveInfo.fern.train, 'ICE 458');
  assert.equal(c.liveInfo.fern.depStr, '11:02');
  assert.equal(c.liveInfo.fern.durMin, 65);
  assert.equal(c.liveInfo.fern.alternatives[0].train, 'ICE 460');
  assert.equal(c.liveInfo.nvLeg.totalMin, 90);
  assert.equal(c.liveInfo.nvLeg.legs.length, 2);
  assert.equal(c.liveInfo.nvAlt.totalMin, 325); // 10 + 15 + 300
  assert.equal(c.liveInfo.nvAlt.diffMin, 145); // 325 - 180

  // Segment mit Fehler (Mainz) fällt auf Modell zurück
  const b = opt(r, 'sp_mainz_direct');
  assert.equal(b.minutes, 210); // Modell (Fernzug + Reststück)
  assert.equal(b.liveInfo.fern, undefined); // kein Live-Fernzug für Mainz
  assert.equal(b.liveInfo.nvAlt && b.liveInfo.nvAlt.diffMin, 115); // 325 (NV live) - 210 (Modell)

  // Meta trägt den Live-Status
  assert.equal(r.meta.live.status, 'live');
  assert.equal(r.meta.live.ss.mainz, 'error');
});

test('Live aus / fehlerfrei: Modell bleibt unverändert (Rückwärtskompatibilität)', () => {
  const r1 = computeQuote({ ...SAT, people: P2, live: { status: 'off' } });
  const r2 = computeQuote({ ...SAT, people: P2 });
  assert.equal(r1.options[0].total, r2.options[0].total);
  assert.equal(r1.meta.live, undefined);
  assert.equal(r2.meta.live, undefined);
});

test('ps.bahn.de-Parser: Angebote, Preise & Züge (zeitliche Formattoleranz)', () => {
  const { parsePreissuche } = liveParser;
  const body = {
    peTexte: { n1: { name: 'SuperSparpreis', hinweis: 'nur gültig am 24.10.' } },
    angebote: { o1: { tt: 'SP', p: '24,90', sids: ['j1', 'j2'], zb: 'Y', pky: 'n1' } },
    verbindungen: {
      j1: { sid: 'j1', trains: [{ s: '8000207', sn: 'Köln Hbf', dep: '11:02', pd: '3', d: '8005213', dn: 'Rüdesheim (Rhein)', arr: '13:17', pa: '7', tn: 'ICE 318', eg: 'ICE' }] },
      j2: { sid: 'j2', trains: [{ s: '8000207', sn: 'Köln Hbf', dep: 693, d: '8000206', dn: 'Koblenz', arr: 768, tn: 'ICE 161', eg: 'ICE' }] }
    }
  };
  const p = parsePreissuche(body);
  assert.equal(p.minPrice, 24.9);
  assert.equal(p.offerName, 'SuperSparpreis');
  assert.equal(p.zb, true);
  const j = p.journeys.find((x) => x.depStr === '11:02');
  assert.equal(j.arrStr, '13:17');
  assert.equal(j.totalMin, 135);
  assert.equal(j.trains[0].train, 'ICE 318');
  assert.equal(j.price, 24.9);
  const j2 = p.journeys.find((x) => x.depStr === '11:33');
  assert.equal(j2.totalMin, 75); // 768 - 693 (minutenbasierte Eingabe)
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
