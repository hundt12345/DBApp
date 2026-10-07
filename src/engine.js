// engine.js – Preisberechnung der Kandidaten-Optionen für die fixe Teststrecke
// Eingabe: { date, window, people[], vrsAbo, ssScenario, lastLeg }
// Ausgabe: { meta, options[] } (sortiert, günstigste zuerst)

import { F } from './fares.js';
import { ROUTE } from './route.js';

const r2 = (x) => Math.round(x * 100) / 100;
const cat = (age) => (age < 6 ? 'u6' : age < 15 ? 'c' : age < 27 ? 'y' : age < 65 ? 'a' : 's');
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function parseHM(s) {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + m;
}
function todayStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
export function fmtEuro(x) {
  return x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} min`;
}

// ---------- Live-Daten (ps.bahn.de Preissuche / DB-API-Verbindungen) ----------
// live = { status, asOf, errors,
//   ss: { segKey: { status:'ok', asOf, data:{ minPrice, offerName, offerDesc, zb, journeys:[{price, offerName, offerDesc, zb, totalMin, depStr, arrStr, trains:[{from,to,depStr,arrStr,train,product}]}] } } },
//   nv: { nvKey: { status:'ok', asOf, data:{ journeys:[{ totalMin, depStr, arrStr, legs:[{from,to,depStr,arrStr,train,product}]}] } } } }
function ssJ(live, key) {
  if (!live || !live.ss) return null;
  const s = live.ss[key];
  return s && s.status === 'ok' && s.data && Array.isArray(s.data.journeys) && s.data.journeys.length ? s : null;
}
function nvJ(live, key) {
  if (!live || !live.nv) return null;
  const s = live.nv[key];
  return s && s.status === 'ok' && s.data && Array.isArray(s.data.journeys) && s.data.journeys.length ? s : null;
}

function pplSummary(people) {
  const a = people.filter((p) => cat(p.age) !== 'c' && cat(p.age) !== 'u6').length;
  const c = people.filter((p) => cat(p.age) === 'c').length;
  const u6 = people.filter((p) => cat(p.age) === 'u6').length;
  const parts = [];
  if (a) parts.push(`${a} Erw.`);
  if (c) parts.push(`${c} Kind${c > 1 ? 'er' : ''} (6–14)`);
  if (u6) parts.push(`${u6} Kleinkind${u6 > 1 ? 'er' : ''} (<6)`);
  return parts.join(', ') || '–';
}

// ---------- Ticket-/Funktionsbausteine ----------

function firstLeg(p, params) {
  const min = p.bike ? ROUTE.firstLeg.bikeMin : ROUTE.firstLeg.s11Min;
  if (p.bike) return { price: 0, minutes: min, label: 'Klapprad zum Hbf (0 €)' };
  if (params.vrsAbo) return { price: 0, minutes: min, label: 'S 11, VRS-Abo (0 €)' };
  if (p.dtt) return { price: 0, minutes: min, label: 'S 11, Deutschlandticket (0 €)' };
  const adult = r2(F.koeln.eezyBase + F.koeln.eezyKm * Math.ceil(ROUTE.koelnAirKm));
  const price = p.age < 6 ? 0 : r2(p.age < 15 ? adult / 2 : adult);
  return { price, minutes: min, label: 'eezy.nrw Parkgürtel→Hbf' };
}

function ssPerPerson(p, ab) {
  const c = cat(p.age);
  if (c === 'u6' || c === 'c') return { ticket: 0, bc: 0 }; // Kinder: frei (siehe fares.js)
  let ticket = ab;
  let bc = 0;
  if (p.bc25 === 'own') ticket = r2(ticket * (1 - F.ss.bcDiscount));
  else if (p.bc25 === 'new') {
    ticket = r2(ticket * (1 - F.ss.bcDiscount));
    bc = F.bc25.price[c];
  }
  return { ticket, bc };
}

function flexPerPerson(p) {
  const c = cat(p.age);
  if (c === 'u6') return { ticket: 0, bc: 0 };
  let ticket = c === 'c' ? r2(F.flex.koelnRuedesheim * F.flex.kidFactor) : F.flex.koelnRuedesheim;
  let bc = 0;
  if (p.bc25 === 'own') ticket = r2(ticket * (1 - F.flex.bcDiscount));
  else if (p.bc25 === 'new') {
    ticket = r2(ticket * (1 - F.flex.bcDiscount));
    bc = F.bc25.price[c] || 0;
  }
  return { ticket, bc };
}

function rpTicket(people) {
  const payers = people.filter((p) => p.age >= F.rp.kidsFreeAge).length;
  const n = Math.max(1, Math.min(payers, F.rp.max));
  return { price: r2(F.rp.base + F.rp.extra * (n - 1)), payers: Math.max(payers, 1) };
}

function nrwTicket(people) {
  const over6 = people.filter((p) => p.age >= 6).length;
  if (over6 === 0) return { price: 0, n: 0 };
  if (over6 === 1) return { price: F.nrw.single, n: 1 };
  return { price: F.nrw.group, n: over6 }; // UI begrenzt auf 5 Personen
}

function rmvPerPerson(p, strips) {
  if (!strips) return 0;
  if (p.dtt) return 0;
  if (p.age < 6) return 0;
  return r2((p.age < 15 ? F.rmv.childStrip : F.rmv.adultStrip) * strips);
}
function faehrePerPerson(p) {
  if (p.age < 6) return 0;
  return p.age < 15 ? F.faehre.child : F.faehre.adult;
}
function kdPerPerson(p) {
  if (p.age < 6) return 0;
  return p.age < 15 ? r2(F.kd.adult / 2) : F.kd.adult;
}

function lastLeg(p, fromKey, params) {
  const from = ROUTE.lastLegs[fromKey];
  if (params.lastLeg === 'kd' && from.kd)
    return { price: kdPerPerson(p), minutes: F.kd.minutes, label: 'Fahrgastschiff → Assmannshausen KD' };
  if (p.bike) return { price: 0, minutes: from.bikeMin, label: 'Klapprad entlang des Rheins (0 €)' };
  if (p.dtt) return { price: 0, minutes: from.trainMin, label: 'Nahverkehr, Deutschlandticket (0 €)' };
  return {
    price: rmvPerPerson(p, from.strips),
    minutes: from.trainMin,
    label: `Nahverkehr ${from.from}→Assmannshausen (${from.strips} Wabe${from.strips > 1 ? 'n' : ''} RMV)`
  };
}

// ---------- Hauptfunktion ----------

export function computeQuote(params) {
  const people = ((params.people) || [])
    .map((p) => ({
      age: Math.max(0, Math.min(99, Number(p.age) || 0)),
      bc25: ['none', 'own', 'new'].includes(p.bc25) ? p.bc25 : 'none',
      bike: !!p.bike,
      dtt: !!p.dtt,
      ownChild: p.ownChild !== false
    }))
    .slice(0, 5);
  if (people.length === 0) people.push({ age: 30, bc25: 'none', bike: false, dtt: false, ownChild: true });

  const dateStr = params.date || '2026-10-24';
  const date = parseDate(dateStr);
  const weekday = date.getDay();
  const isWeekday = weekday >= 1 && weekday <= 5;
  const window = ROUTE.departures[params.window] ? params.window : 'any';
  // Abfahrtszeit (Modelle) – überparam "departHM" erlaubt Overrides (z. B. für Tests)
  const departMin = params.departHM ? parseHM(params.departHM) : parseHM(ROUTE.departures[window]);

  const leadDays = Math.round((date - todayStart()) / 86400000);
  const scenario = ['ab', 'plus10', 'plus25', 'ausverkauft'].includes(params.ssScenario) ? params.ssScenario : 'ab';
  const ssAb = scenario === 'ab' ? F.ss.ab : scenario === 'plus10' ? r2(F.ss.ab + 10) : r2(F.ss.ab + 25);
  const ssAvailable = leadDays >= F.ss.minLeadDays && scenario !== 'ausverkauft';
  const ssReason =
    leadDays < 0
      ? 'Reisedatum liegt in der Vergangenheit.'
      : scenario === 'ausverkauft'
        ? 'SuperSparpreis: als ausverkauft / nicht buchbar markiert (Szenario).'
        : leadDays < F.ss.minLeadDays
          ? `SuperSparpreis: Modell-Annahme „ab 14 Tage im Voraus“ – Reisetag ist nur ${leadDays} Tag(e) entfernt.`
          : null;

  // 9-Uhr-Regel RP-Ticket: Boarding des ersten RP-Zugs (Modell: 1. Fernzug 75 min + Puffer 20 min)
  const rpBoardMin = departMin + ROUTE.firstLeg.s11Min + 75 + ROUTE.connBufferMin;
  const rpOk = !isWeekday || rpBoardMin >= F.rp.weekdayFromMin;
  const rpReason = isWeekday && !rpOk
    ? `Rheinland-Pfalz-Ticket werktags erst ab 9:00 Uhr – erster RP-Zug würde um ${fmtTime(rpBoardMin)} boarden.`
    : null;

  const allDtt = people.every((p) => p.dtt);
  const anyBike = people.some((p) => p.bike);
  const hasKids = people.some((p) => cat(p.age) === 'c' || cat(p.age) === 'u6');
  const summary = pplSummary(people);
  const bikeNote = anyBike ? 'Klapprad: +15–20 min beim ersten/letzten Teil, aber kostenlos (gefaltet in Zügen frei).' : null;

  const fl = people.map((p) => firstLeg(p, params));
  const flSum = r2(fl.reduce((s, x) => s + x.price, 0));
  const flRow = { label: `Erster Teil: Parkgürtel→Köln Hbf (${summary})`, amount: flSum };

  // ---------- Live-Daten: Preise/Fernzüge/Nahverkehr live, sonst Modell ----------
  const live = params.live && params.live.status && params.live.status !== 'off' ? params.live : null;
  const firstMin = anyBike ? ROUTE.firstLeg.bikeMin : ROUTE.firstLeg.s11Min;
  const IA = ROUTE.itins.A, IB = ROUTE.itins.B, IC = ROUTE.itins.C, ID = ROUTE.itins.D, IE = ROUTE.itins.E;
  // Fernverkehr-Dauer: live (tatsächliche Verbindung) sonst Modell
  const fernDur = (segKey, modelMin) => {
    const s = ssJ(live, segKey);
    const j = s ? s.data.journeys[0] : null;
    return j && j.totalMin != null ? j.totalMin : modelMin;
  };
  // Reststücke nach dem Fernzug: live (DB-Verbindungen) sonst Modell (conns+legs)
  const restA = () => { const j = nvJ(live, 'nv_ruedesheim_assmannshausen'); return j ? j.data.journeys[0].totalMin ?? IA.conns[1] + IA.legs[1].min : IA.conns[1] + IA.legs[1].min; };
  const restB = () => { const j = nvJ(live, 'nv_koblenz_assmannshausen'); return j ? j.data.journeys[0].totalMin ?? IB.conns[1] + IB.legs[1].min + IB.conns[2] + IB.legs[2].min : IB.conns[1] + IB.legs[1].min + IB.conns[2] + IB.legs[2].min; };
  const restC = () => { const j = nvJ(live, 'nv_lahnstein_assmannshausen'); const last = j && j.data.journeys[0].totalMin != null ? j.data.journeys[0].totalMin : IC.legs[2].min; return IC.conns[1] + IC.legs[1].min + IC.conns[2] + last; };
  const restE = () => { const j = nvJ(live, 'nv_ruedesheim_assmannshausen'); const last = j && j.data.journeys[0].totalMin != null ? j.data.journeys[0].totalMin : IE.legs[2].min; return IE.conns[1] + IE.legs[1].min + IE.conns[2] + last; };
  const restD = () => { const j = nvJ(live, 'nv_koln_assmannshausen_all'); return j ? j.data.journeys[0].totalMin ?? ID.conns[0] + ID.legs[0].min + ID.conns[1] + ID.legs[1].min + ID.conns[2] + ID.legs[2].min : ID.conns[0] + ID.legs[0].min + ID.conns[1] + ID.legs[1].min + ID.conns[2] + ID.legs[2].min; };
  const ssRowLabel = (segKey, target) => {
    const s = ssJ(live, segKey);
    if (s) return `${s.data.offerName || 'Sparpreis'} Köln→${target} (LIVE, ${s.asOf}, 2. Kl., ${summary})`;
    return `SuperSparpreis Köln→${target}, 2. Kl. (${summary})`;
  };
  const liveFernNote = (segKey) => {
    const s = ssJ(live, segKey);
    if (!s) return null;
    return `Live-Angebot (DB-Preissuche, ${s.asOf}): ${s.data.offerName || 'Sparpreis'} für ${fmtEuro(s.data.minPrice)} p.P.${s.data.offerDesc ? ' – ' + s.data.offerDesc : ''}${s.data.zb ? ' · mit Zugbindung' : ' · ohne Zugbindung'}`;
  };

  const opts = [];

  const mk = (o) => opts.push(o);

  // --- 1) SuperSparpreis direkt (Itinerar A) ---
  {
    const liveA = ssJ(live, 'ruedesheim');
    const abA = liveA && liveA.data.minPrice != null ? liveA.data.minPrice : ssAb;
    const ss = people.map((p) => ssPerPerson(p, abA));
    const ll = people.map((p) => lastLeg(p, 'ruedesheim', params));
    const ticketSum = r2(ss.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(ss.reduce((s, x) => s + x.bc, 0));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'ss_direct',
      name: 'SuperSparpreis direkt (Köln → Rüdesheim)',
      itin: 'A',
      available: ssAvailable,
      reason: ssReason,
      badges: ['Direkt', 'letzer Teil ohne Zugbindung'],
      total: r2(ticketSum + bcSum + flSum + llSum),
      minutes: live ? firstMin + IA.conns[0] + fernDur('ruedesheim', IA.legs[0].min) + restA() : ROUTE.duration('A'),
      rows: [
        { label: ssRowLabel('ruedesheim', 'Rüdesheim'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: 'Letzter Teil: Rüdesheim→Assmannshausen', amount: llSum }
      ],
      notes: [
        F.ss.note,
        liveFernNote('ruedesheim'),
        'Trick: Ein SuperSparpreis nach einem längeren Ziel (Mainz/Mannheim) ist oft gleich teuer – einfach in Rüdesheim aussteigen.',
        'Letzter Teil (Rüdesheim→Assmannshausen) ist Nahverkehr (RMV) – keine Zugbindung, Klapprad frei.',
        hasKids ? F.ss.kidsFree : null,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 2) SuperSparpreis nach Bingen + Rheinfähre (Itinerar E) ---
  {
    const liveB = ssJ(live, 'bingen');
    const abB = liveB && liveB.data.minPrice != null ? liveB.data.minPrice : ssAb;
    const ss = people.map((p) => ssPerPerson(p, abB));
    const fh = people.map((p) => faehrePerPerson(p));
    const ll = people.map((p) => lastLeg(p, 'ruedesheim', params));
    const ticketSum = r2(ss.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(ss.reduce((s, x) => s + x.bc, 0));
    const fhSum = r2(fh.reduce((s, x) => s + x, 0));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'faehre_bingen',
      name: 'SuperSparpreis nach Bingen + Rheinfähre',
      itin: 'E',
      available: ssAvailable,
      reason: ssReason,
      badges: ['Fähre (2,90 €)', 'keine 9-Uhr-Regel'],
      total: r2(ticketSum + bcSum + fhSum + flSum + llSum),
      minutes: live ? firstMin + IE.conns[0] + fernDur('bingen', IE.legs[0].min) + restE() : ROUTE.duration('E'),
      rows: [
        { label: ssRowLabel('bingen', 'Bingen'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: `Rheinfähre Bingen→Rüdesheim (${summary})`, amount: fhSum },
        { label: 'Letzter Teil: Rüdesheim→Assmannshausen', amount: llSum }
      ],
      notes: [
        'Überfahrt mit der Personenfähre ca. 6 min – umgeht den hessischen Abschnitt komplett ohne Verbundticket.',
        liveFernNote('bingen'),
        liveB ? null : 'Achtung: Der reale SS-Preis nach Bingen (längere Strecke) ist oft höher als nach Rüdesheim – hier gleicher ab-Preis angesetzt.',
        'Fähre fährt planmäßig im Stundenraster (Fahrplan prüfen). Fahrrad mit: 2,70 €.',
        hasKids ? F.ss.kidsFree : null,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 3) SuperSparpreis → Koblenz + RP-Ticket, linksrheinisch (Itinerar B) ---
  {
    const liveK = ssJ(live, 'koblenz');
    const abK = liveK && liveK.data.minPrice != null ? liveK.data.minPrice : ssAb;
    const ss = people.map((p) => ssPerPerson(p, abK));
    const rp = rpTicket(people);
    const ll = people.map((p) => lastLeg(p, 'lorch', params));
    const ticketSum = r2(ss.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(ss.reduce((s, x) => s + x.bc, 0));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'ss_koblenz_rlp',
      name: 'SuperSparpreis → Koblenz + Rheinland-Pfalz-Ticket (linksrheinisch)',
      itin: 'B',
      available: ssAvailable && rpOk,
      reason: ssReason || rpReason,
      badges: ['ohne Zugbindung (Nahverkehr)', '9-Uhr-Regel werktags'],
      total: r2(ticketSum + bcSum + rp.price + flSum + llSum),
      minutes: live ? firstMin + IB.conns[0] + fernDur('koblenz', IB.legs[0].min) + restB() : ROUTE.duration('B'),
      rows: [
        { label: ssRowLabel('koblenz', 'Koblenz'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: `Rheinland-Pfalz-Ticket (Koblenz→Lorch, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: 'Letzter Teil: Lorch→Assmannshausen (über Rüdesheim, 2 Waben RMV)', amount: llSum }
      ],
      notes: [
        'Der Sparpreis gilt nur im Fernverkehr – der Rest läuft als Nahverkehr (RE/RB) ohne Zugbindung, dafür mit eigenem Ticket.',
        liveFernNote('koblenz'),
        'RP-Ticket endet in Lorch, weil Rüdesheim & Assmannshausen in Hessen liegen → kurzer RMV-Teil (der „kleine Teil in Hessen“).',
        'Stichwort „längere aber günstigere Strecke“: Gilt hier analog – man kann den SS auch nach Mainz buchen und in Koblenz aussteigen, wenn das billiger ist.',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        hasKids ? F.ss.kidsFree : null,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 4) SuperSparpreis → Koblenz + rechtsrheinisch (Itinerar C) ---
  {
    const liveK2 = ssJ(live, 'koblenz');
    const abK2 = liveK2 && liveK2.data.minPrice != null ? liveK2.data.minPrice : ssAb;
    const ss = people.map((p) => ssPerPerson(p, abK2));
    const rp = rpTicket(people);
    const ll = people.map((p) => lastLeg(p, 'eltville', params));
    const ticketSum = r2(ss.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(ss.reduce((s, x) => s + x.bc, 0));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'ss_rechtsrheinisch',
      name: 'SuperSparpreis → Koblenz + rechtsrheinisch (Lahn + Rheingau-Bahn)',
      itin: 'C',
      available: ssAvailable && rpOk,
      reason: ssReason || rpReason,
      badges: ['rechtsrheinisch', 'ohne Zugbindung', '9-Uhr-Regel werktags'],
      total: r2(ticketSum + bcSum + rp.price + flSum + llSum),
      minutes: live ? firstMin + IC.conns[0] + fernDur('koblenz', IC.legs[0].min) + restC() : ROUTE.duration('C'),
      rows: [
        { label: ssRowLabel('koblenz', 'Koblenz'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: `Rheinland-Pfalz-Ticket (Koblenz→Lahnstein, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: 'Letzter Teil: Eltville→Assmannshausen (Rheingau-Bahn, 2 Waben RMV)', amount: llSum }
      ],
      notes: [
        'Die rechtsrheinische Alternative: über die Lahntalstrecke nach Lahnstein, dann RB 10 (Rheingau-Bahn) rechtsrheinisch nach Assmannshausen.',
        liveFernNote('koblenz'),
        'RP-Ticket gilt bis Lahnstein (letzter RP-Halt), ab Eltville Hessen → kurzer RMV-Teil.',
        'Keine Zugbindung im Nahverkehr; längere Fahrzeit als linksrheinisch.',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        hasKids ? F.ss.kidsFree : null,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 5) 3-Verbund-Variante ohne Fernverkehr (Itinerar D) ---
  {
    const nrw = nrwTicket(people);
    const rp = rpTicket(people);
    const ll = people.map((p) => lastLeg(p, 'eltville', params));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'nrw3verbund',
      name: '3-Verbund-Variante: 24hTicket NRW + RP-Ticket + RMV (ohne Fernverkehr)',
      itin: 'D',
      available: rpOk,
      reason: rpReason,
      badges: ['ohne Fernverkehr', '3 Verbundtickets', '9-Uhr-Regel (RP-Teil) werktags'],
      total: r2(nrw.price + rp.price + flSum + llSum),
      minutes: live ? firstMin + restD() : ROUTE.duration('D'),
      rows: [
        flRow,
        { label: `24hTicket NRW (Köln→Ahrweiler, ${nrw.n} Pers., 24 h ohne 9-Uhr-Regel)`, amount: nrw.price },
        { label: `Rheinland-Pfalz-Ticket (Ahrweiler→Lahnstein, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: 'Letzter Teil: Eltville→Assmannshausen (Rheingau-Bahn, 2 Waben RMV)', amount: llSum }
      ],
      notes: [
        'Ganz ohne (Spar-)Preis-Buchung: Ahr-Eifel-Bahn Köln→Ahrweiler (NRW-Teil) → über Neuwied nach Lahnstein (RP-Teil) → Rheingau-Bahn rechtsrheinisch (kleiner Teil in Hessen/RMV).',
        'Zwei bis drei Verbundtickets, dafür längere Reisezeit und mehr Umstiege.',
        '24hTicket NRW: 39,80 € Single / 59,80 € bis 5 Personen (Stand 2026, keine 9-Uhr-Regel mehr).',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null
      ].filter(Boolean)
    });
  }

  // --- 6) SuperSparpreis + Deutschlandticket (Itinerar B, nur wenn alle DtT haben) ---
  {
    if (allDtt) {
      const liveT = ssJ(live, 'koblenz');
      const abT = liveT && liveT.data.minPrice != null ? liveT.data.minPrice : ssAb;
      const ss = people.map((p) => ssPerPerson(p, abT));
      const ticketSum = r2(ss.reduce((s, x) => s + x.ticket, 0));
      const bcSum = r2(ss.reduce((s, x) => s + x.bc, 0));
      mk({
        id: 'dtt_koblenz',
        name: 'SuperSparpreis → Koblenz + Deutschlandticket für alles weitere',
        itin: 'B',
        available: ssAvailable,
        reason: ssReason,
        badges: ['Deutschlandticket', 'keine 9-Uhr-Regel', 'ohne Zugbindung'],
        total: r2(ticketSum + bcSum),
        minutes: live ? firstMin + IB.conns[0] + fernDur('koblenz', IB.legs[0].min) + restB() : ROUTE.duration('B'),
        rows: [
          { label: ssRowLabel('koblenz', 'Koblenz'), amount: ticketSum },
          ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
          { label: 'Erster + letzter Teil + hessischer Abschnitt: Deutschlandticket (0 €)', amount: 0 }
        ],
        notes: [
          'Das Deutschlandticket (66,80 €/Monat, 2026) gilt im Nahverkehr ganz Deutschlands – auch in RP und im hessischen RMV-Abschnitt. Kein RP-Ticket, keine 9-Uhr-Regel.',
          liveFernNote('koblenz'),
          'Nur modelliert, wenn alle Reisenden ein DtT haben. Fahrrad: Klapprad frei; großes Rad im Nahverkehr je nach Tarif (nicht modelliert).',
          hasKids ? F.ss.kidsFree : null
        ].filter(Boolean)
      });
    }
  }

  // --- 7) DB-Tarif: Flexpreis direkt (Referenz) ---
  {
    const fx = people.map((p) => flexPerPerson(p));
    const ll = people.map((p) => lastLeg(p, 'ruedesheim', params));
    const ticketSum = r2(fx.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(fx.reduce((s, x) => s + x.bc, 0));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'flex_direct',
      name: 'DB-Tarif: Flexpreis (Normalpreis) direkt',
      itin: 'A',
      available: true,
      badges: ['Referenz', 'ohne Vorlauf'],
      total: r2(ticketSum + bcSum + flSum + llSum),
      minutes: live ? firstMin + IA.conns[0] + fernDur('ruedesheim', IA.legs[0].min) + restA() : ROUTE.duration('A'),
      rows: [
        { label: `Flexpreis Köln→Rüdesheim, 2. Kl. (Modellwert, ${summary})`, amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: 'Letzter Teil: Rüdesheim→Assmannshausen', amount: llSum }
      ],
      notes: [
        F.flex.note,
        'Immer buchbar (auch spontan) – meist die teuerste Variante, dient hier als Referenz.',
        bikeNote
      ].filter(Boolean)
    });
  }

  // ---------- Live-Info anhängen: konkreter Fernzug, Live-Nahverkehr, NV-Alternative ----------
  const attachLive = (o, cfg) => {
    if (!live || !o.available) return;
    const info = {};
    if (cfg.fern) {
      const s = ssJ(live, cfg.fern);
      if (s) {
        const j = s.data.journeys[0];
        info.fern = {
          train: (j.trains && j.trains[0] && j.trains[0].train) || 'Fernzug',
          product: (j.trains && j.trains[0] && j.trains[0].product) || '',
          depStr: j.depStr,
          arrStr: j.arrStr,
          durMin: j.totalMin,
          offerName: j.offerName,
          offerDesc: j.offerDesc,
          zb: j.zb,
          asOf: s.asOf,
          alternatives: s.data.journeys.slice(1, 3).map((x) => ({
            depStr: x.depStr,
            arrStr: x.arrStr,
            train: (x.trains && x.trains[0] && x.trains[0].train) || '',
            price: x.price
          }))
        };
      }
    }
    if (cfg.nvSeg) {
      const n = nvJ(live, cfg.nvSeg);
      if (n) {
        const j = n.data.journeys[0];
        info.nvLeg = { totalMin: j.totalMin, depStr: j.depStr, arrStr: j.arrStr, legs: j.legs, asOf: n.asOf };
      }
    }
    if (cfg.nvAlt) {
      const n = nvJ(live, 'nv_koln_assmannshausen_all');
      if (n) {
        const j = n.data.journeys[0];
        const tot = j.totalMin != null ? firstMin + 15 + j.totalMin : null;
        info.nvAlt = {
          totalMin: tot,
          depStr: j.depStr,
          arrStr: j.arrStr,
          legs: j.legs,
          asOf: n.asOf,
          diffMin: tot != null ? tot - o.minutes : null
        };
      }
    }
    if (Object.keys(info).length) o.liveInfo = info;
  };
  const liveCfg = {
    ss_direct: { fern: 'ruedesheim', nvSeg: 'nv_ruedesheim_assmannshausen', nvAlt: true },
    faehre_bingen: { fern: 'bingen', nvSeg: 'nv_ruedesheim_assmannshausen', nvAlt: true },
    ss_koblenz_rlp: { fern: 'koblenz', nvSeg: 'nv_koblenz_assmannshausen', nvAlt: true },
    ss_rechtsrheinisch: { fern: 'koblenz', nvSeg: 'nv_lahnstein_assmannshausen', nvAlt: true },
    nrw3verbund: {},
    dtt_koblenz: { fern: 'koblenz', nvSeg: 'nv_koblenz_assmannshausen', nvAlt: true },
    flex_direct: { fern: 'ruedesheim', nvSeg: 'nv_ruedesheim_assmannshausen', nvAlt: true }
  };
  for (const o of opts) {
    if (liveCfg[o.id]) attachLive(o, liveCfg[o.id]);
  }

  opts.forEach((o) => {
    o.total = r2(o.total);
    o.perPerson = r2(o.total / people.length);
  });
  opts.sort((a, b) => (a.available === b.available ? a.total - b.total : a.available ? -1 : 1));
  const first = opts.find((o) => o.available);
  if (first) first.best = true;

  const meta = {
    date: dateStr,
    weekday: WD[weekday],
    isWeekday,
    depart: fmtTime(departMin),
    window,
    ssAb,
    ssAvailable,
    leadDays,
    people: people.length,
    origin: ROUTE.origin,
    destination: ROUTE.destination
  };
  if (live) {
    meta.live = {
      status: live.status,
      asOf: live.asOf,
      errors: live.errors || [],
      ss: Object.keys(live.ss || {}).reduce((acc, k) => { acc[k] = (live.ss[k] || {}).status || 'missing'; return acc; }, {}),
      nv: Object.keys(live.nv || {}).reduce((acc, k) => { acc[k] = (live.nv[k] || {}).status || 'missing'; return acc; }, {})
    };
  }
  return { meta, options: opts };
}

// Annahmen/Quellen für UI & Doku
export const ASSUMPTIONS = [
  { t: 'Ziel-Interpretation', s: 'Assmannshausen bei Rüdesheim (Hessen, RMV) – der „kleine Teil in Hessen“. Nächstgelegener Halt: „Assmannshausen“ an der Rheintalstrecke (rechtsrheinisch) + Anlegestelle „Assmannshausen KD“.' },
  { t: 'SuperSparpreis', s: 'ab 17,99 € (2026; Jan 2026: 17,49 €), dynamisch nach Nachfrage/Strecke – deshalb Szenario im Formular. Modell: frühestens 14 Tage vor Abreise buchbar. Kinder bis 14 frei (bei Buchung angeben, max. 4 je Ticket). BahnCard 25 = 25 % Rabatt.' },
  { t: 'Flexpreis (DB-Tarif)', s: 'Köln→Rüdesheim: 70,00 € Modellwert (2. Kl.) – vor Buchung auf bahn.de prüfen.' },
  { t: 'Rheinland-Pfalz-Ticket', s: '30 € + 10 € je weitere Person (max. 5), Kinder unter 14 frei. Mo–Fr erst ab 9:00 Uhr, Sa/So ganztägig. Nur innerhalb RP – der hessische Abschnitt braucht ein RMV-Ticket.' },
  { t: '24hTicket NRW', s: '39,80 € Single / 59,80 € bis 5 Personen (Stand 2026), 24 h ab Entwertung, keine 9-Uhr-Regel mehr. Alle Nahverkehrsmittel in NRW, 2. Klasse.' },
  { t: 'RMV (Hessen)', s: 'Einzelfahrschein ab 1.1.2026: 3,90 € (Kind 6–14: 2,20 €) je Wabe. Wabenanzahl je Abschnitt ist modelliert (1–2). BahnCard-Rabatt auf RMV-Einzelfahrten entfällt seit 1.1.2026.' },
  { t: 'Köln (Rheinland-Tarif VRS+AVV, ab 1.6.2026)', s: 'Einzelfahrt Köln 4,00 €, Kurzstrecke 2,90 €, 24h-Ticket Köln 9,60 €. eezy.nrw: 1,66 € + 0,27 €/Luftlinien-km – wird für den ersten Teil benutzt (Parkgürtel→Hbf, ~6 Luft-km ≈ 3,28 €).' },
  { t: 'Schifffahrt (2026)', s: 'Rheinfähre Bingen↔Rüdesheim (Personenfähre, ~6 min): 2,90 € (Kind 6–14: 1,45 €, Rad 2,70 €). Fahrgastschiff Rüdesheim/Bingen→Assmannshausen KD: 12,50 €, ~45 min (Kinderrabatt 50 % modelliert – prüfen). Kein Nahverkehr → keine Verbundtickets.' },
  { t: 'BahnCard 25', s: '62,90 € (27–64), My-BahnCard 39,90 € (unter 27), Senioren 40,90 € – Jahreskarte 12 Monate. „Neue BC25“ rechnet den Kartenpreis in die Option ein; „eigene BC25“ nur den 25 %-Rabatt.' },
  { t: 'Deutschlandticket', s: '66,80 €/Monat (2026), gilt im Nahverkehr bundesweit (inkl. hessischer Abschnitt), nicht im Fernverkehr. Nur wenn alle Reisenden eines haben, wird die Kombination modelliert.' },
  { t: 'Klapprad', s: 'Gefaltetes Klapprad ist in Nah- und Fernverkehr frei ohne Reservierung. Im Modell ersetzt es den ersten Teil (~5,5 km, 25 min) und den letzten Abschnitt (entlang des Rheins) – plus 15–20 min.' },
  { t: 'Fahrzeiten', s: 'Modellwerte typischer Fahrpläne (kein Live-Daten): ICE Köln→Rüdesheim ~2 h 15 (nicht jeder ICE hält in Rüdesheim), Köln→Koblenz ~1 h 15, Umsteigepuffer 10–20 min.' },
  { t: 'Live-Daten', s: 'Bei aktivierter Live-Ansicht ersetzt die App: Sparpreis-Ab-Preise durch reale Angebote der DB-Preissuche (ps.bahn.de, 24-h-Fenster ab gewählter Zeit – „Günstigster Tarif des Tages“), Modell-Fahrzeiten durch tatsächliche Verbindungen (DB-API). Fernzug (Name/Abfahrt) und die reine-Nahverkehr-Alternative (ohne Zugbindung) werden transparent angezeigt. Live nicht erreichbar → automatischer Rückfall auf Modell (pro Abschnitt gekennzeichnet).' },
  { t: 'Quellen (Auszug)', s: 'bahn.de (Sparpreise, BahnCard-Vergleich), db-fahrplan.com (RLP-Ticket, 24hTicket NRW), kvb.koeln (Rheinland-Tarif, eezy), mainzer-mobilitaet.de (RMV-Preise), bingen-ruedesheimer.de / roesslerlinie.de (Fähre/Fahrgastschiff 2026), t-online/ksta (KVB-Preise 2026). Details in docs/TARIFE-2026.md.' }
];
