// Smoke-Tests der Preis-Engine (node --test)
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
const SAT = { date: '2026-10-24', window: 'any', ssScenario: 'ab', lastLeg: 'auto', vrsAbo: false };

function best(result) {
  return result.options.find((o) => o.best);
}
function opt(result, id) {
  return result.options.find((o) => o.id === id);
}

test('Standardfamilie (2 Erw. + Kind 8), Samstag: SuperSparpreis direkt ist günstigste Option (54,18 €)', () => {
  const r = computeQuote({ ...SAT, people: P2 });
  const b = best(r);
  assert.equal(b.id, 'ss_direct');
  assert.equal(b.total, 54.18); // 2×17,99 SS + 8,20 eezy + 10,00 RMV
  const flex = opt(r, 'flex_direct');
  assert.equal(flex.total, 193.2); // Referenz teurer
});

test('SuperSparpreis ausverkauft: 3-Verbund-Variante (128,00 €) gewinnt', () => {
  const r = computeQuote({ ...SAT, ssScenario: 'ausverkauft', people: P2 });
  assert.equal(best(r).id, 'nrw3verbund');
  assert.equal(best(r).total, 128.0); // 59,80 NRW + 40,00 RP + 20,00 RMV + 8,20 eezy
  assert.equal(opt(r, 'ss_direct').available, false);
  assert.match(opt(r, 'ss_direct').reason, /ausverkauft/i);
});

test('Zu kurzfristig (10.10., 3 Tage): SS-Optionen fallen weg, 3-Verbund bleibt', () => {
  const r = computeQuote({ ...SAT, date: '2026-10-10', people: P2 });
  assert.equal(r.meta.ssAvailable, false);
  assert.equal(opt(r, 'ss_direct').available, false);
  assert.match(opt(r, 'ss_direct').reason, /14 Tage/);
  assert.equal(best(r).id, 'nrw3verbund');
});

test('Werktags 06:00: 9-Uhr-Regel blockiert alle RP-Ticket-Optionen, Direktzug bleibt', () => {
  const r = computeQuote({ ...SAT, date: '2026-10-26', window: 'morning', departHM: '06:00', people: P2 });
  assert.equal(opt(r, 'ss_koblenz_rlp').available, false);
  assert.match(opt(r, 'ss_koblenz_rlp').reason, /9:00/);
  assert.equal(opt(r, 'nrw3verbund').available, false);
  assert.equal(best(r).id, 'ss_direct');
  assert.equal(best(r).total, 54.18);
});

test('Deutschlandticket + Klapprad für alle: Reststrecke kostenlos (nur 35,98 €)', () => {
  const people = [
    { age: 34, bc25: 'none', bike: true, dtt: true, ownChild: true },
    { age: 38, bc25: 'none', bike: true, dtt: true, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, people });
  const dtt = opt(r, 'dtt_koblenz');
  assert.equal(dtt.available, true);
  assert.equal(dtt.total, 35.98); // 2×17,99 SS, alles andere über DtT/Rad
});

test('5 Erwachsene: SS direkt (125,85 €) schlägt 3-Verbund (185,20 €)', () => {
  const people = [34, 35, 36, 37, 38].map((age) => ({ age, bc25: 'none', bike: false, dtt: false, ownChild: true }));
  const r = computeQuote({ ...SAT, people });
  assert.equal(best(r).id, 'ss_direct');
  assert.equal(best(r).total, 125.85); // 5×17,99 + 5×3,28 + 5×3,90
  assert.equal(opt(r, 'nrw3verbund').total, 185.2); // 59,80 + 70,00 (5 zahlend) + 39,00 + 16,40
});

test('Neue BahnCard 25: Rabatt 25 % + Kartenpreis 62,90 € (83,57 € gesamt, 1 Pers.)', () => {
  const r = computeQuote({
    ...SAT,
    people: [{ age: 34, bc25: 'new', bike: false, dtt: false, ownChild: true }]
  });
  const b = opt(r, 'ss_direct');
  assert.equal(b.total, 83.57); // 13,49 + 62,90 + 3,28 + 3,90
  const rowBc = b.rows.find((x) => /BahnCard/.test(x.label));
  assert.equal(rowBc.amount, 62.9);
});

test('Kind unter 6 + VRS-Abo: erste/r und Kleinkind gratis', () => {
  const people = [
    { age: 34, bc25: 'none', bike: false, dtt: false, ownChild: true },
    { age: 3, bc25: 'none', bike: false, dtt: false, ownChild: true }
  ];
  const r = computeQuote({ ...SAT, vrsAbo: true, people });
  const b = opt(r, 'ss_direct');
  // 1×17,99 SS + 0 (VRS-Abo + Kleinkind frei) + 3,90 RMV (Kind <6 frei)
  assert.equal(b.total, 21.89);
});

test('KD-Schiff als letzter Teil (Option ab Rüdesheim): 12,50 € pro Erw.', () => {
  const people = [{ age: 34, bc25: 'none', bike: false, dtt: false, ownChild: true }];
  const r = computeQuote({ ...SAT, lastLeg: 'kd', people });
  const b = opt(r, 'ss_direct');
  const row = b.rows.find((x) => /Letzter Teil/.test(x.label));
  assert.equal(row.amount, 12.5);
});

test('Live: echte Sparpreis-Angebote & konkrete Züge ersetzen Modell (Fallback pro Segment)', () => {
  const live = {
    status: 'live',
    asOf: '12:00',
    errors: [],
    ss: {
      ruedesheim: {
        status: 'ok', asOf: '12:00',
        data: {
          minPrice: 24.9, offerName: 'SuperSparpreis', offerDesc: 'nur gültig am 24.10.', zb: true,
          journeys: [
            { price: 24.9, offerName: 'SuperSparpreis', offerDesc: 'nur gültig am 24.10.', zb: true, totalMin: 135, depStr: '11:02', arrStr: '13:17',
              trains: [{ from: 'Köln Hbf', to: 'Rüdesheim (Rhein)', depMin: 662, arrMin: 797, train: 'ICE 318', product: 'ICE' }] },
            { price: 29.9, offerName: 'Sparpreis', offerDesc: '', zb: false, totalMin: 148, depStr: '11:33', arrStr: '13:24',
              trains: [{ from: 'Köln Hbf', to: 'Rüdesheim (Rhein)', depMin: 693, arrMin: 804, train: 'IC 2781', product: 'IC' }] }
          ]
        }
      },
      koblenz: { status: 'error', error: 'CORS-Blockade' },
      bingen: { status: 'error', error: 'CORS-Blockade' }
    },
    nv: {
      nv_ruedesheim_assmannshausen: {
        status: 'ok', asOf: '12:00',
        data: { journeys: [{ totalMin: 42, depStr: '13:25', arrStr: '14:07', legs: [{ from: 'Rüdesheim (Rhein)', to: 'Assmannshausen', depMin: 805, arrMin: 847, train: 'RE 22 5234', product: 'regional' }] }] }
      },
      nv_koln_assmannshausen_all: {
        status: 'ok', asOf: '12:00',
        data: { journeys: [{ totalMin: 300, depStr: '11:10', arrStr: '16:10', legs: [{ from: 'Köln Hbf', to: 'Assmannshausen', depMin: 670, arrMin: 970, train: 'RE 7008', product: 'regional' }] }] }
      }
    }
  };

  const r = computeQuote({ ...SAT, people: P2, live });
  const a = opt(r, 'ss_direct');

  // Live-Preis 24,90 p.P. ersetzt 17,99: 2×24,90 + 8,20 eezy + 10,00 RMV
  assert.equal(a.total, 68.0);
  assert.match(a.rows[0].label, /SuperSparpreis Köln→Rüdesheim \(LIVE, 12:00/);
  assert.ok(a.notes.some((n) => /Live-Angebot \(DB-Preissuche, 12:00\)/.test(n)));

  // Live-Dauer: 10 (S 11) + 15 (U) + 135 (ICE 318) + 42 (live NV Rüdesheim→Assmannshausen)
  assert.equal(a.minutes, 202);

  // Konkreter Fernzug + NV-Alternative (Zugbindung-Transparenz)
  assert.equal(a.liveInfo.fern.train, 'ICE 318');
  assert.equal(a.liveInfo.fern.depStr, '11:02');
  assert.equal(a.liveInfo.fern.durMin, 135);
  assert.equal(a.liveInfo.fern.alternatives[0].train, 'IC 2781');
  assert.equal(a.liveInfo.nvLeg.totalMin, 42);
  assert.equal(a.liveInfo.nvAlt.totalMin, 325); // 10 + 15 + 300
  assert.equal(a.liveInfo.nvAlt.diffMin, 123);  // 325 - 202

  // Segment mit Fehler (Koblenz/Bingen) fällt auf Modell zurück
  const b = opt(r, 'ss_koblenz_rlp');
  assert.equal(b.total, 104.18); // wie Modell: 2×17,99 + 40 RP + 8,20 + 10,00
  assert.equal(b.minutes, 235);
  assert.equal(b.liveInfo.fern, undefined); // kein Live-Fernzug für Koblenz
  assert.equal(b.liveInfo.nvAlt && b.liveInfo.nvAlt.diffMin, 90); // 325 (NV live) - 235 (Modell)

  // Meta trägt den Live-Status
  assert.equal(r.meta.live.status, 'live');
  assert.equal(r.meta.live.ss.koblenz, 'error');
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
