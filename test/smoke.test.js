// Smoke-Tests der Preis-Engine (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeQuote } from '../src/engine.js';

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
