// engine.js – Preisberechnung der Kandidaten-Optionen für die fixe Teststrecke
//
// WICHTIG (verifiziert): Auf der rechten Rheinstrecke (→ Rüdesheim/Assmannshausen)
// fährt KEIN Fernverkehr – nur Regionalzüge (RE 97 „Rheintalbahn“).
// Fernverkehr (Sparpreis-fähig): linksrheinisch nach Koblenz/Mainz + Neubaustrecke nach Frankfurt.
// City-Ticket: im Sparpreis/Flexpreis (>100 km, Köln teilnehmend) inklusive → erster Teil gratis;
// im SuperSparpreis NICHT → günstigstes Stadt-Ticket = Köln-Kurzstrecke 2,90 € (2 Halte).
//
// Eingabe: { date, window, people[], vrsAbo, ssScenario, ticketType, lastLeg, live? }
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
  if (min == null) return '–';
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

// Erster Teil Parkgürtel→Köln Hbf. cityIncluded = DB City-Ticket ist im
// Fernverkehrsticket dabei (Sparpreis/Flexpreis, >100 km, Köln nimmt teil).
function firstLeg(p, params, cityIncluded) {
  const min = p.bike ? ROUTE.firstLeg.bikeMin : ROUTE.firstLeg.s11Min;
  if (p.bike) return { price: 0, minutes: min, label: 'Klapprad zum Hbf (0 €)' };
  if (params.vrsAbo) return { price: 0, minutes: min, label: 'S 11, VRS-Abonnement (0 €)' };
  if (p.dtt) return { price: 0, minutes: min, label: 'S 11, Deutschlandticket (0 €)' };
  if (cityIncluded) return { price: 0, minutes: min, label: 'S 11, City-Ticket im Fernfahrpreis (0 €)' };
  const price = p.age < 6 ? 0 : p.age < 15 ? F.koeln.kurzstreckeKind : F.koeln.kurzstrecke;
  return { price, minutes: min, label: 'Kurzstrecke Köln Parkgürtel→Hbf (2,90 €)' };
}

// Fernverkehrsticket pro Person (Sparpreis/SuperSparpreis): Kinder <15 frei (mit Angabe),
// BC25: eigene = 25 % Rabatt, neu = 25 % + Kartenpreis.
function fernPerPerson(p, price) {
  const c = cat(p.age);
  if (c === 'u6' || c === 'c') return { ticket: 0, bc: 0 };
  let ticket = price;
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
  let ticket = c === 'c' ? r2(F.flex.koelnKoblenz * F.flex.kidFactor) : F.flex.koelnKoblenz;
  let bc = 0;
  if (p.bc25 === 'own') ticket = r2(ticket * (1 - F.flex.bcDiscount));
  else if (p.bc25 === 'new') {
    ticket = r2(ticket * (1 - F.flex.bcDiscount));
    bc = F.bc25.price[c] || 0;
  }
  return { ticket, bc };
}

function rpTicket(people) {
  // DtT-Halter brauchen KEIN RP-Ticket (DtT gilt im RP-Nahverkehr)
  const payers = people.filter((p) => p.age >= F.rp.kidsFreeAge && !p.dtt).length;
  if (payers === 0) return { price: 0, payers: 0 };
  const n = Math.max(1, Math.min(payers, F.rp.max));
  return { price: r2(F.rp.base + F.rp.extra * (n - 1)), payers: n };
}

function nrwTicket(people) {
  const over6 = people.filter((p) => p.age >= F.nrw.kidsFreeAge && !p.dtt).length;
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

function zmbPerPerson(p) {
  if (p.dtt) return 0;
  if (p.age < 6) return 0;
  return p.age < 15 ? F.zmb.child : F.zmb.adult;
}

function vgnRmvPerPerson(p) {
  if (p.dtt) return 0;
  if (p.age < 6) return 0;
  return p.age < 15 ? F.vgnRmv.child : F.vgnRmv.adult;
}

function kdPerPerson(p) {
  if (p.age < 6) return 0;
  return p.age < 15 ? r2(F.kd.adult / 2) : F.kd.adult;
}

// Letzter Abschnitt je Ankunftspunkt (strips = RMV-Waben)
function lastLeg(p, fromKey, params) {
  const from = LASTLEGS[fromKey];
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
const LASTLEGS = {
  lorch: { from: 'Lorch (RP)', trainMin: 15, bikeMin: 25, strips: 2, kd: false },
  ruedesheim: { from: 'Rüdesheim (Rhein)', trainMin: 5, bikeMin: 15, strips: 1, kd: true },
  mainz: { from: 'Eltville (ab RMV)', trainMin: 35, bikeMin: 35, strips: 3, kd: false }
};

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
  const window = ['any', 'morning', 'midday', 'afternoon'].includes(params.window) ? params.window : 'any';
  const departMin = params.departHM ? parseHM(params.departHM) : parseHM(ROUTE.departures[window]);

  const leadDays = Math.round((date - todayStart()) / 86400000);
  const scenario = ['ab', 'plus10', 'plus25', 'ausverkauft'].includes(params.ssScenario) ? params.ssScenario : 'ab';
  const ticketType = params.ticketType === 'sp' ? 'sp' : 'ss';
  // Sparpreis-Preis je Tickettyp + Szenario (Modell; live ersetzt durch reale Angebote)
  const scenDelta = scenario === 'ab' ? 0 : scenario === 'plus10' ? 10 : 25;
  const ssAb = r2(F.ss.ab + scenDelta);
  const spAb = r2(Math.max(F.sp.ab + scenDelta, F.sp.ab));
  const fernBase = ticketType === 'sp' ? spAb : ssAb;
  const fernName = ticketType === 'sp' ? 'Sparpreis' : 'SuperSparpreis';
  const ssAvailable = leadDays >= F.ss.minLeadDays && scenario !== 'ausverkauft';
  const ssReason =
    leadDays < 0
      ? 'Reisedatum liegt in der Vergangenheit.'
      : scenario === 'ausverkauft'
        ? `${fernName}: als ausverkauft / nicht buchbar markiert (Szenario).`
        : leadDays < F.ss.minLeadDays
          ? `${fernName}: Modell-Annahme „ab 14 Tage im Voraus“ – Reisetag ist nur ${leadDays} Tag(e) entfernt.`
          : null;

  // City-Ticket: nur Sparpreis (nicht SuperSparpreis/Flex unter 100 km); hier gilt es für
  // alle Fernverkehr-Segmente außer Köln→Koblenz (~95 km < 100 km).
  const cityFor = (segKey) => ticketType === 'sp' && segKey !== 'koblenz';

  // 9-Uhr-Regel RP-Ticket: Boarding des ersten RP-Zugs (Modell: 1. Fernzug + Puffer)
  const rpBoardMin = departMin + ROUTE.firstLeg.s11Min + 85 + 20;
  const rpOk = !isWeekday || rpBoardMin >= F.rp.weekdayFromMin;
  const rpReason = isWeekday && !rpOk
    ? `Rheinland-Pfalz-Ticket werktags erst ab 9:00 Uhr – erster RP-Zug würde um ${fmtTime(rpBoardMin)} boarden.`
    : null;

  const allDtt = people.every((p) => p.dtt);
  const anyBike = people.some((p) => p.bike);
  const hasKids = people.some((p) => cat(p.age) === 'c' || cat(p.age) === 'u6');
  const bau = date >= parseDate(F.bau.from) && date <= parseDate(F.bau.until);
  const summary = pplSummary(people);
  const bikeNote = anyBike ? 'Klapprad: +15 min beim ersten/letzten Teil, aber kostenlos (gefaltet in Zügen frei).' : null;
  const bauNote = bau ? 'BAUEN 2026: Rechte Rheinstrecke (inkl. Abschnitt nach Assmannshausen) ist 10.07.–11.12.2026 vollgesperrt → Bus-Ersatz, deutlich längere Fahrzeiten (RMV-Fahrplan 2026).' : null;

  const opts = [];
  const mk = (o) => opts.push(o);

  // ---------- Live-Daten: Preise/Fernzüge/Nahverkehr live, sonst Modell ----------
  const live = params.live && params.live.status && params.live.status !== 'off' ? params.live : null;
  const firstMin = anyBike ? ROUTE.firstLeg.bikeMin : ROUTE.firstLeg.s11Min;
  const IA = ROUTE.itins.A, IB = ROUTE.itins.B, IC = ROUTE.itins.C, ID = ROUTE.itins.D, IE = ROUTE.itins.E, IG = ROUTE.itins.G;
  // Fernverkehr-Dauer: live (tatsächliche Verbindung) sonst Modell
  const fernDur = (segKey, modelMin) => {
    const s = ssJ(live, segKey);
    const j = s ? s.data.journeys[0] : null;
    return j && j.totalMin != null ? j.totalMin : modelMin;
  };
  // Reststücke nach dem Fernzug / reine NV-Stücke: live (DB-Verbindungen) sonst Modell
  const restKoblenz = () => {
    const j = nvJ(live, 'nv_koblenz_assmannshausen');
    return j ? (j.data.journeys[0].totalMin ?? IA.conns[1] + IA.legs[1].min + IA.conns[2] + IA.legs[2].min) : IA.conns[1] + IA.legs[1].min + IA.conns[2] + IA.legs[2].min;
  };
  const restMainz = () => {
    const j = nvJ(live, 'nv_mainz_assmannshausen');
    return j ? (j.data.journeys[0].totalMin ?? IB.conns[1] + IB.legs[1].min) : IB.conns[1] + IB.legs[1].min;
  };
  const restFrankfurt = () => {
    const j = nvJ(live, 'nv_frankfurt_assmannshausen');
    return j ? (j.data.journeys[0].totalMin ?? IC.conns[1] + IC.legs[1].min + IC.conns[2] + IC.legs[2].min) : IC.conns[1] + IC.legs[1].min + IC.conns[2] + IC.legs[2].min;
  };
  const restKolnAll = () => {
    const j = nvJ(live, 'nv_koln_assmannshausen_all');
    return j ? (j.data.journeys[0].totalMin ?? IE.conns[0] + IE.legs[0].min + IE.conns[1] + IE.legs[1].min + IE.conns[2] + IE.legs[2].min) : IE.conns[0] + IE.legs[0].min + IE.conns[1] + IE.legs[1].min + IE.conns[2] + IE.legs[2].min;
  };
  const restRechts = () => {
    const j1 = nvJ(live, 'nv_koln_ruedesheim');
    const j2 = nvJ(live, 'nv_ruedesheim_assmannshausen');
    const t1 = j1 ? (j1.data.journeys[0].totalMin ?? IG.conns[0] + IG.legs[0].min) : IG.conns[0] + IG.legs[0].min;
    const t2 = j2 ? (j2.data.journeys[0].totalMin ?? IG.conns[1] + IG.legs[1].min) : IG.conns[1] + IG.legs[1].min;
    return t1 + t2;
  };
  const ssRowLabel = (segKey, target) => {
    const s = ssJ(live, segKey);
    if (s) return `${s.data.offerName || 'Sparpreis'} Köln→${target} (LIVE, ${s.asOf}, 2. Kl., ${summary})`;
    return `${fernName} Köln→${target}, 2. Kl. (${summary})`;
  };
  const flRowFor = (city, flSum, fl) => {
    const allFree = fl.every((x) => x.price === 0);
    let label;
    if (!allFree) label = `Erster Teil: Parkgürtel→Köln Hbf – Köln-Kurzstrecke 2,90 €/Kind 1,45 € (${summary})`;
    else if (city) label = `Erster Teil: Parkgürtel→Köln Hbf – City-Ticket im Fernfahrpreis (${summary})`;
    else if (people.every((p) => p.bike)) label = `Erster Teil: Parkgürtel→Köln Hbf – Klapprad (${summary})`;
    else if (params.vrsAbo) label = `Erster Teil: Parkgürtel→Köln Hbf – VRS-Abonnement (${summary})`;
    else label = `Erster Teil: Parkgürtel→Köln Hbf – Deutschlandticket (${summary})`;
    return { label, amount: flSum };
  };
  const liveFernNote = (segKey) => {
    const s = ssJ(live, segKey);
    if (!s) return null;
    return `Live-Angebot (DB-Preissuche, ${s.asOf}): ${s.data.offerName || 'Sparpreis'} für ${fmtEuro(s.data.minPrice)} p.P.${s.data.offerDesc ? ' – ' + s.data.offerDesc : ''}${s.data.zb ? ' · mit Zugbindung (nur dieser Zug!)' : ' · ohne Zugbindung (gilt am Tag)'}`;
  };
  // Fernverkehrsticket je Person: live (tatsächlicher Sparpreis pro Person, Kinder frei)
  // sonst Modell (ab-Preis + BC25). BC25-Rabatt wird live NICHT zusätzlich angesetzt
  // (real würde er bei der Buchung ins Angebot eingepflegt).
  const fWithLive = (segKey) => {
    const s = ssJ(live, segKey);
    if (s) {
      const j = s.data.journeys[0];
      return people.map((p) => {
        const c = cat(p.age);
        return c === 'u6' || c === 'c' ? { ticket: 0, bc: 0 } : { ticket: j.price, bc: 0 };
      });
    }
    return people.map((p) => fernPerPerson(p, fernBase));
  };

  // --- 1) Sparpreis nach Mainz, Ausstieg Koblenz, linksrheinisch + RP-Ticket + RMV ---
  {
    const city = cityFor('mainz');
    const fl = people.map((p) => firstLeg(p, params, city));
    const flSum = r2(fl.reduce((s, x) => s + x.price, 0));
    const flRow = flRowFor(city, flSum, fl);
    const f = fWithLive('koblenz');
    const rp = rpTicket(people);
    const ll = people.map((p) => lastLeg(p, 'lorch', params));
    const ticketSum = r2(f.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(f.reduce((s, x) => s + x.bc, 0));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'sp_mainz_koblenz',
      name: `${fernName} nach Mainz, Ausstieg Koblenz + RP-Ticket + RMV`,
      itin: 'A',
      available: ssAvailable && rpOk,
      reason: ssReason || rpReason,
      badges: [city ? 'City-Ticket inkl.' : 'City-Ticket NICHT inkl. (SS)', 'Ausstieg vor Buchungsziel', '9-Uhr-Regel werktags'],
      total: r2(ticketSum + bcSum + rp.price + flSum + llSum),
      minutes: live ? firstMin + IA.conns[0] + fernDur('koblenz', IA.legs[0].min) + restKoblenz() : ROUTE.duration('A'),
      rows: [
        { label: ssRowLabel('koblenz', 'Koblenz'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: `Rheinland-Pfalz-Ticket (Koblenz→Lorch, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: 'Letzter Teil: Lorch→Assmannshausen (über Rüdesheim, 2 Waben RMV)', amount: llSum }
      ],
      notes: [
        'KEIN Fernverkehr nach Rüdesheim (rechter Rheinstrecke nur Regionalverkehr!) – daher linksrheinischer ICE bis Koblenz, Ticket bis Mainz gebucht (gleicher Zug, meist gleicher Preis).',
        city ? 'City-Ticket im Sparpreis (>100 km) inklusive: Parkgürtel→Köln Hbf gratis.' : 'SuperSparpreis hat KEIN City-Ticket → günstiges Stadt-Ticket: Köln-Kurzstrecke 2,90 € (Parkgürtel→Hbf, 2 Halte).',
        liveFernNote('koblenz'),
        'Der Sparpreis gilt nur im Fernverkehr – der Rest läuft als Nahverkehr ohne Zugbindung, dafür mit eigenem Ticket (RP + RMV).',
        hasKids ? F.sp.kidsFree : null,
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        bauNote,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 2) Sparpreis nach Mainz, durch bis Assmannshausen (ZMB-Streckchen + RMV) ---
  {
    const city = cityFor('mainz');
    const fl = people.map((p) => firstLeg(p, params, city));
    const flSum = r2(fl.reduce((s, x) => s + x.price, 0));
    const flRow = flRowFor(city, flSum, fl);
    const f = fWithLive('mainz');
    const zmb = people.map((p) => zmbPerPerson(p));
    const ll = people.map((p) => lastLeg(p, 'mainz', params));
    const rmv = ll.map((x) => x.price);
    const ticketSum = r2(f.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(f.reduce((s, x) => s + x.bc, 0));
    const zmbSum = r2(zmb.reduce((s, x) => s + x, 0));
    const rmvSum = r2(rmv.reduce((s, x) => s + x, 0));
    mk({
      id: 'sp_mainz_direct',
      name: `${fernName} nach Mainz, durch bis Assmannshausen (RMV)`,
      itin: 'B',
      available: ssAvailable,
      reason: ssReason,
      badges: ['durch bis Assmannshausen', city ? 'City-Ticket inkl.' : 'City-Ticket NICHT inkl. (SS)', 'kein RP-Ticket'],
      total: r2(ticketSum + bcSum + zmbSum + rmvSum + flSum),
      minutes: live ? firstMin + IB.conns[0] + fernDur('mainz', IB.legs[0].min) + restMainz() : ROUTE.duration('B'),
      rows: [
        { label: ssRowLabel('mainz', 'Mainz'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: `Kurzer RP-Teil ab Mainz (ZMB-Einzel, ${summary})`, amount: zmbSum },
        { label: `RMV Eltville→Assmannshausen (3 Waben, ${summary})`, amount: rmvSum }
      ],
      notes: [
        'Ein Zug durch (ICE → Mainz, dann RE rechtsrheinisch bis Assmannshausen) – kein Umstieg in Koblenz/Lorch.',
        'Der Mainzer Stadtbereich (1–2 Halte) braucht ein kleines RP-Zeug (ZMB-Einzel, Modellwert); ab Eltville gilt RMV. 9-Uhr-Regel: keine (Einzelfahrscheine, nicht das RP-Ticket).',
        city ? 'City-Ticket im Sparpreis (>100 km) inklusive: Parkgürtel→Köln Hbf gratis.' : 'SuperSparpreis hat KEIN City-Ticket → Köln-Kurzstrecke 2,90 €.',
        liveFernNote('mainz'),
        F.zmb.note,
        hasKids ? F.sp.kidsFree : null,
        bauNote,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 3) Sparpreis nach Frankfurt (SFS) + RE 21 über Wiesbaden – „längerer Umweg“ ---
  {
    const city = cityFor('frankfurt');
    const fl = people.map((p) => firstLeg(p, params, city));
    const flSum = r2(fl.reduce((s, x) => s + x.price, 0));
    const flRow = flRowFor(city, flSum, fl);
    const f = fWithLive('frankfurt');
    const vgn = people.map((p) => vgnRmvPerPerson(p));
    const ll = people.map((p) => lastLeg(p, 'ruedesheim', params));
    const rmv = ll.map((x) => x.price);
    const ticketSum = r2(f.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(f.reduce((s, x) => s + x.bc, 0));
    const vgnSum = r2(vgn.reduce((s, x) => s + x, 0));
    const rmvSum = r2(rmv.reduce((s, x) => s + x, 0));
    mk({
      id: 'sp_frankfurt_detour',
      name: `${fernName} nach Frankfurt (Neubaustrecke) + RE 21 nach Rüdesheim`,
      itin: 'C',
      available: ssAvailable,
      reason: ssReason,
      badges: ['längerer Umweg', city ? 'City-Ticket inkl.' : 'City-Ticket NICHT inkl. (SS)', 'kein RP-Ticket'],
      total: r2(ticketSum + bcSum + vgnSum + rmvSum + flSum),
      minutes: live ? firstMin + IC.conns[0] + fernDur('frankfurt', IC.legs[0].min) + restFrankfurt() : ROUTE.duration('C'),
      rows: [
        { label: ssRowLabel('frankfurt', 'Frankfurt (Main) Hbf'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: `RE 21 Frankfurt→Rüdesheim (VGN+RMV, ${summary})`, amount: vgnSum },
        { label: 'Letzter Teil: Rüdesheim→Assmannshausen (1 Wabe RMV)', amount: rmvSum }
      ],
      notes: [
        'Der „längere, aber günstigere“ Umweg: ICE auf der Neubaustrecke nach Frankfurt, dann RE 21 (Rheingau) über Wiesbaden direkt bis Rüdesheim – und 5 min nach Assmannshausen.',
        'RE 21 Frankfurt→Rüdesheim quert VGN + RMV → Cross-Verbund-Ticket (Modellwert – exakt bei RMV/VGN prüfen).',
        city ? 'City-Ticket im Sparpreis (>100 km) inklusive: Parkgürtel→Köln Hbf gratis.' : 'SuperSparpreis hat KEIN City-Ticket → Köln-Kurzstrecke 2,90 €.',
        liveFernNote('frankfurt'),
        hasKids ? F.sp.kidsFree : null,
        bauNote,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 4) Flexpreis nach Koblenz (keine Zugbindung) + RP + RMV – Referenz ---
  {
    const city = cityFor('koblenz'); // ~95 km → auch im Sparpreis/Flex kein City-Ticket
    const fl = people.map((p) => firstLeg(p, params, city));
    const flSum = r2(fl.reduce((s, x) => s + x.price, 0));
    const flRow = flRowFor(city, flSum, fl);
    const fx = people.map((p) => flexPerPerson(p));
    const rp = rpTicket(people);
    const ll = people.map((p) => lastLeg(p, 'lorch', params));
    const ticketSum = r2(fx.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(fx.reduce((s, x) => s + x.bc, 0));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'flex_koblenz',
      name: 'Flexpreis nach Koblenz (freie Zugwahl, keine Zugbindung) + RP + RMV',
      itin: 'D',
      available: rpOk,
      reason: rpReason,
      badges: ['Referenz', 'ohne Vorlauf', 'keine Zugbindung'],
      total: r2(ticketSum + bcSum + rp.price + flSum + llSum),
      minutes: live ? firstMin + ID.conns[0] + fernDur('koblenz', ID.legs[0].min) + restKoblenz() : ROUTE.duration('D'),
      rows: [
        { label: `Flexpreis Köln→Koblenz, 2. Kl. (Modellwert, ${summary})`, amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        flRow,
        { label: `Rheinland-Pfalz-Ticket (Koblenz→Lorch, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: 'Letzter Teil: Lorch→Assmannshausen (über Rüdesheim, 2 Waben RMV)', amount: llSum }
      ],
      notes: [
        F.flex.note,
        'Immer buchbar (auch spontan) – meist die teuerste Variante mit Fernverkehr; hier als Referenz für „keine Zugbindung“.',
        'Kein City-Ticket: Köln→Koblenz ist ~95 km (< 100 km-Schwelle) → Köln-Kurzstrecke 2,90 €.',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        bauNote,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 5) 3-Verbund linksrheinisch, ganz ohne Fernverkehr (24h NRW + RP + RMV) ---
  if (!allDtt) {
    const nrw = nrwTicket(people);
    const rp = rpTicket(people);
    const ll = people.map((p) => lastLeg(p, 'lorch', params));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'nv_linksrheinisch',
      name: '3-Verbund linksrheinisch: 24hTicket NRW + RP-Ticket + RMV (ohne Fernverkehr)',
      itin: 'E',
      available: rpOk,
      reason: rpReason,
      badges: ['ohne Fernverkehr', '3 Verbundtickets', '9-Uhr-Regel (RP-Teil) werktags'],
      total: r2(nrw.price + rp.price + llSum),
      minutes: live ? firstMin + restKolnAll() : ROUTE.duration('E'),
      rows: [
        { label: `Erster Teil: Parkgürtel→Köln Hbf – im 24hTicket NRW ENTHALTEN (${summary})`, amount: 0 },
        { label: `24hTicket NRW (Köln→Bonn, ${nrw.n} Pers., 24 h ohne 9-Uhr-Regel)`, amount: nrw.price },
        { label: `Rheinland-Pfalz-Ticket (ab Unkel→Lorch, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: 'Letzter Teil: Lorch→Assmannshausen (über Rüdesheim, 2 Waben RMV)', amount: llSum }
      ],
      notes: [
        'Ganz ohne (Spar-)Preis-Buchung: RE linksrheinisch Köln→Bonn (24h NRW) → ab Unkel (1. RP-Halt) RP-Ticket über Koblenz nach Lorch → dann RMV (der „kleine Teil in Hessen“).',
        'Wichtig: Der erste Teil (Parkgürtel→Hbf) wird NICHT extra berechnet – er gilt mit dem 24hTicket NRW.',
        'Keine Zugbindung (alles Nahverkehr), dafür längere Reisezeit und 2–3 Tickets.',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        bauNote,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 6) Deutschlandticket, linksrheinisch ohne Fernverkehr (0 € zusätzlich) ---
  {
    if (allDtt) {
      mk({
        id: 'dtt_nahverkehr',
        name: 'Deutschlandticket: komplett ohne Fernverkehr, alles 0 €',
        itin: 'F',
        available: true,
        badges: ['Deutschlandticket', '0 € zusätzlich', 'keine 9-Uhr-Regel'],
        total: 0,
        minutes: live ? firstMin + restKolnAll() : ROUTE.duration('E'),
        rows: [
          { label: 'S 11 Parkgürtel→Köln Hbf: DtT (0 €)', amount: 0 },
          { label: 'RE linksrheinisch Köln→Koblenz→Lorch: DtT (0 €)', amount: 0 },
          { label: 'RMV Lorch→Assmannshausen: DtT (0 €)', amount: 0 }
        ],
        notes: [
          'Das Deutschlandticket (66,80 €/Monat, 2026) gilt im Nahverkehr ganz Deutschlands – inkl. RE in RP und im hessischen RMV. Kein RP-Ticket, keine 9-Uhr-Regel, kein City-Ticket nötig.',
          'Nur modelliert, wenn alle Reisenden ein DtT haben. Fahrrad: Klapprad frei; Großrad je nach Verbund.',
          'Die Monatsgebühr (66,80 €/Pers.) ist hier NICHT eingerechnet – lohnt sich ab ca. 2 Fahrten/Monat.',
          bauNote,
          bikeNote
        ].filter(Boolean)
      });
    }
  }

  // --- 7) RE „Rheintalbahn“ direkt rechtsrheinisch nach Rüdesheim + RMV ---
  if (!allDtt) {
    const nrw = nrwTicket(people);
    const rp = rpTicket(people);
    const ll = people.map((p) => lastLeg(p, 'ruedesheim', params));
    const llSum = r2(ll.reduce((s, x) => s + x.price, 0));
    mk({
      id: 'nv_rechtsrheinisch',
      name: 'RE „Rheintalbahn“ direkt rechtsrheinisch nach Rüdesheim + RMV',
      itin: 'G',
      available: rpOk,
      reason: rpReason,
      badges: ['direkt (kein Fernverkehr)', 'keine Zugbindung', '9-Uhr-Regel (RP-Teil) werktags'],
      total: r2(nrw.price + rp.price + llSum),
      minutes: live ? firstMin + restRechts() : ROUTE.duration('G'),
      rows: [
        { label: `Erster Teil: Parkgürtel→Köln Hbf – im 24hTicket NRW ENTHALTEN (${summary})`, amount: 0 },
        { label: `24hTicket NRW (Köln, ${nrw.n} Pers.)`, amount: nrw.price },
        { label: `Rheinland-Pfalz-Ticket (ab 1. RP-Halt→Lorch, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: `Letzter Teil: Rüdesheim→Assmannshausen (1 Wabe RMV, ${summary})`, amount: llSum }
      ],
      notes: [
        'Der „direkte“ Weg ohne Umwege: RE 97 rechtsrheinisch durch nach Rüdesheim (kein Fernverkehr, keine Zugbindung) – das RP-Ticket kann ab dem ersten RP-Halt (Neuwied-Bereich) boarden.',
        'Der erste Teil (Parkgürtel→Hbf) gilt mit dem 24hTicket NRW und wird NICHT extra berechnet.',
        bau ? '⚠️ BAUEN: Gerade ist die rechte Rheinstrecke vollgesperrt (10.07.–11.12.2026) → dieser „direkte“ Weg fährt jetzt mit Ersatzbussen und ist deutlich langsamer. Linksrheinisch (Option Nr. …) oder der Umweg über Frankfurt sind in der Bauzeit oft schneller.' : 'Fußnote: Es gibt auf dieser Strecke KEINEN Fernverkehr – daher keine Sparpreise, nur Verbundtickets.',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        bikeNote
      ].filter(Boolean)
    });
  }

  // ---------- Live-Info anhängen: konkreter Fernzug, Live-NV, NV-Alternative ----------
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
    sp_mainz_koblenz: { fern: 'koblenz', nvSeg: 'nv_koblenz_assmannshausen', nvAlt: true },
    sp_mainz_direct: { fern: 'mainz', nvSeg: 'nv_mainz_assmannshausen', nvAlt: true },
    sp_frankfurt_detour: { fern: 'frankfurt', nvSeg: 'nv_frankfurt_assmannshausen', nvAlt: true },
    flex_koblenz: { fern: 'koblenz', nvSeg: 'nv_koblenz_assmannshausen', nvAlt: true },
    nv_linksrheinisch: { allNv: true },
    dtt_nahverkehr: { allNv: true },
    nv_rechtsrheinisch: { nvSeg: 'nv_koln_ruedesheim' }
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
    ticketType,
    fernName,
    ssAb,
    spAb,
    ssAvailable,
    leadDays,
    bau,
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
  { t: 'Ziel-Interpretation', s: 'Assmannshausen bei Rüdesheim (Hessen, RMV) – der „kleine Teil in Hessen“. Nächstgelegener Halt: „Assmannshausen“ an der rechten Rheinstrecke (rechtsrheinisch, 5 min ab Rüdesheim) + Anlegestelle „Assmannshausen KD“.' },
  { t: 'KERN-ERKENNTNIS: kein Fernverkehr nach Rüdesheim', s: 'Auf der rechten Rheinstrecke (Köln–Neuwied–Koblenz–Bingen–Rüdesheim–Assmannshausen) fährt NUR Regionalverkehr (RE 97 „Rheintalbahn“ u. a.) – KEINE ICE/IC, daher KEIN Sparpreis direkt nach Rüdesheim. Fernverkehr gibt es linksrheinisch (Köln–Bonn–Koblenz–Mainz, mind. stündlich ICE) und über die Neubaustrecke nach Frankfurt Hbf (~1 h 05). Deshalb buchen die Sparpreis-Optionen nach Mainz (Ausstieg Koblenz), nach Mainz durch oder nach Frankfurt (Umweg).' },
  { t: 'City-Ticket (DB)', s: 'City-Ticket im Sparpreis/Flexpreis automatisch inklusive bei >100 km Reiseweite (Köln nimmt teil) → Parkgürtel→Köln Hbf gratis am Geltungstag (einmalig, wie Einzelfahrschein). Im SuperSparpreis NICHT enthalten → dann gilt: Köln-Kurzstrecke 2,90 € (Parkgürtel→Hbf = 2 Halte, Kind 1,45 €) als günstigstes Stadt-Ticket. VRS-Abonnement: 0 €.' },
  { t: 'SuperSparpreis / Sparpreis', s: '2026: SuperSparpreis ab 17,90 € (Zugbindung, kein Storno, kein City-Ticket), Sparpreis ab 21,90 € (Zugbindung, Storno gegen Gebühr, City-Ticket >100 km). Modell: ab 14 Tage im Voraus buchbar. Kinder bis 14 frei (Alter bei Buchung angeben, max. 4 je Ticket, Begleitung 15+). BahnCard 25 = 25 % Rabatt.' },
  { t: 'Flexpreis (DB-Tarif)', s: 'Köln→Koblenz: 60,00 € Modellwert (2. Kl.) – vor Buchung auf bahn.de prüfen. Freie Zugwahl, stornierbar, City-Ticket nur >100 km (Köln→Koblenz ~95 km → KEIN City-Ticket).' },
  { t: 'Rheinland-Pfalz-Ticket', s: '30 € + 10 € je weitere Person (max. 5), Kinder unter 14 frei. Mo–Fr erst ab 9:00 Uhr, Sa/So ganztägig. Gilt ab JEDEM Bahnhof in RP (auch mitten in der Strecke) – nicht in Köln (NRW), nicht in Hessen.' },
  { t: '24hTicket NRW', s: '39,80 € Single / 59,80 € bis 5 Personen (Stand 2026), 24 h ab Entwertung, keine 9-Uhr-Regel. Gilt auf ALLEN Nahverkehrsmitteln in NRW – der erste Teil Parkgürtel→Köln Hbf ist damit ENTHALTEN (wird nicht extra berechnet).' },
  { t: 'RMV / VGN / ZMB (Hessen & Rhein-Main)', s: 'RMV-Einzelfahrschein ab 1.1.2026: 3,90 € (Kind 2,20 €) je Wabe (Wabenanzahl modelliert). RE 21 Frankfurt→Rüdesheim: VGN+RMV-Cross-Verbund-Ticket (Modellwert 7,80 €/4,40 €). ZMB-Einzel (Mainzer Abschnitt): Modellwert 3,80 €/1,90 €. BahnCard-Rabatt auf RMV entfällt seit 1.1.2026. Vor Fahrt im RMV-App prüfen.' },
  { t: 'Köln (Rheinland-Tarif VRS+AVV, ab 1.6.2026)', s: 'Kurzstrecke 2,90 € (2 Halte: Parkgürtel→Hbf), Einzelfahrt 4,00 €, 24 h Köln 9,60 €. eezy.nrw ~3,28 € (1,66 € + 0,27 €/km) – teurer, daher nur alternativ. Mit VRS-Abo: 0 €.' },
  { t: 'Schifffahrt (2026)', s: 'Fahrgastschiff (Rössler-Linie) Rüdesheim→Assmannshausen KD: 12,50 €, ~45 min (Kind 50 % modelliert) – Option „letzter Teil“ ab Rüdesheim. Rheinfähre Bingen↔Rüdesheim 2,90 € (nur interessant, wenn man nach Bingen kommt – KEIN Fernverkehr dorthin). Kein Nahverkehr → keine Verbundtickets.' },
  { t: 'BahnCard 25', s: '62,90 € (27–64), My-BahnCard 39,90 € (unter 27), Senioren 40,90 € – Jahreskarte 12 Monate. 25 % nur auf DB-Fernverkehr; kein Rabatt auf Länder-/Verbundtickets; RMV-BC entfällt seit 2026.' },
  { t: 'Deutschlandticket', s: '66,80 €/Monat (2026), gilt im Nahverkehr bundesweit (inkl. RE in RP + RMV Hessen), nicht im Fernverkehr, keine 9-Uhr-Regel. Nur wenn alle Reisenden eines haben (Monatsgebühr nicht eingerechnet).' },
  { t: 'Klapprad', s: 'Gefaltetes Klapprad in Nah- und Fernverkehr frei ohne Reservierung. Im Modell ersetzt es den ersten Teil (~5,5 km, 25 min) und den letzten Abschnitt (entlang des Rheins).' },
  { t: 'BAUEN 2026 (Betriebslage)', s: 'Rechte Rheinstrecke (Wiesbaden–Rüdesheim–Koblenz) ist 10.07.–11.12.2026 vollgesperrt (RMV-Fahrplan 2026, RB10 → Bus-Ersatz) → alle Abschnitte rechts des Rheins inkl. Assmannshausen deutlich länger. Tickets bleiben dieselben.' },
  { t: 'Fahrzeiten (Modell)', s: 'ICE Köln→Koblenz links ~1 h 25, Köln→Mainz links ~1 h 45, Köln→Frankfurt (SFS) ~1 h 05, RE 21 Frankfurt→Rüdesheim ~1 h 15, RE links Köln→Koblenz ~1 h 30, RE 97 rechts Köln→Rüdesheim ~2 h (vor Bau), Umsteigepuffer 15–20 min.' },
  { t: 'Live-Daten', s: 'Live-Modus ersetzt: Sparpreis-Ab-Preise durch reale DB-Preissuche-Angebote (ps.bahn.de, 24-h-Fenster = „Günstigster Tarif des Tages“) inkl. konkreter Züge mit Zugbindungs-Info; Modell-Fahrzeiten durch tatsächliche DB-Verbindungen (DB-API, mit Key). Fallback pro Abschnitt auf Modell (Status im UI).' },
  { t: 'Quellen (Auszug)', s: 'bahn.de (Sparpreise 2026: SS 17,90/SP 21,90, City-Ticket-Regeln), RMV (Fahrplan 2026: Vollsperrung rechter Rheinstrecke, Einzelfahrschein 2026), kvb.koeln (Rheinland-Tarif 2026), bingen-ruedesheimer.de/roesslerlinie.de (Schifffahrt 2026), DB-Station-Datenbestand (Station-IDs). Details: docs/TARIFE-2026.md + docs/LIVE-DATEN.md.' }
];
