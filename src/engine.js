// engine.js – Preisberechnung der Kandidaten-Optionen für die fixe Teststrecke
//
// VERIFIZIERTE KERNREGELN (2026):
//  * (Super)Sparpreis und Flexpreis sind DIREKT nach Assmannshausen buchbar.
//    Das Ticket deckt die GESAMTE gebuchte Verbindung ab: Nahverkehrsvorlauf
//    (S 11 Parkgürtel→Hbf) + Fernverkehrszug (ICE, Zugbindung) + Nahverkehrsnachlauf
//    (letzter Abschnitt RE/RB/Bus – frei wählbar, keine Zugbindung).
//    Die Reise muss bis 10 Uhr des Folgetags beendet sein.
//    (bahn.de-FAQ „Mit welchen Zügen kann ich mit dem (Super)Sparpreis reisen?“)
//    → Fernverkehr-Optionen = 1 Ticket/Person, KEINE Zusatztickets (RP/RMV).
//  * Auf der rechten Rheinstrecke (→ Rüdesheim/Bingen) fährt kein Fernverkehr
//    (nur RE 97 „Rheintalbahn“ / RB 10) – Fernverkehr läuft linksrheinisch
//    (Köln–Bonn–Koblenz–Mainz) und über die Neubaustrecke (SFS) nach Frankfurt.
//  * City-Ticket ist eine GETRENNTES Extra (SS: kostenpflichtig zubuchbar;
//    SP/Flex: automatisch >100 km) und hier NICHT nötig, weil die S 11 bereits
//    Teil der gebuchten Verbindung ist.
//  * Bau 2026: rechte Rheinstrecke 10.7.–11.12.2026 vollgesperrt (Bus-Ersatz).

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

// ---------- Live-Daten ----------
// live = { status, asOf, via, errors,
//   ss: { all: { status:'ok', asOf, data:{ minPrice, offerName, journeys:[{price, offerName, offerDesc, zb, totalMin, depStr, arrStr, trains:[{from,to,depStr,arrStr,train,product}]}] } } },
//   nv: { nvKey: { status:'ok', asOf, data:{ journeys:[{totalMin, depStr, arrStr, legs:[...]}] } } } }
function ssSeg(live, key) {
  if (!live || !live.ss) return null;
  const s = live.ss[key];
  return s && s.status === 'ok' && s.data && Array.isArray(s.data.journeys) && s.data.journeys.length ? s : null;
}
function ssStatus(live, key) {
  const s = live && live.ss && live.ss[key];
  return s ? s.status : 'missing';
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

// ---------- Ticket-Bausteine ----------

function rpTicket(people) {
  // DtT-Halter brauchen KEIN RP-Ticket
  const payers = people.filter((p) => p.age >= F.rp.kidsFreeAge && !p.dtt).length;
  if (payers === 0) return { price: 0, payers: 0 };
  const n = Math.max(1, Math.min(payers, F.rp.max));
  return { price: r2(F.rp.base + F.rp.extra * (n - 1)), payers: n };
}

function nrwTicket(people) {
  const over6 = people.filter((p) => p.age >= F.nrw.kidsFreeAge && !p.dtt).length;
  if (over6 === 0) return { price: 0, n: 0 };
  if (over6 === 1) return { price: F.nrw.single, n: 1 };
  return { price: F.nrw.group, n: over6 };
}

function rmvPerPerson(p, strips) {
  if (!strips) return 0;
  if (p.dtt) return 0;
  if (p.age < 6) return 0;
  return r2((p.age < 15 ? F.rmv.childStrip : F.rmv.adultStrip) * strips);
}

function kdPerPerson(p) {
  if (p.age < 6) return 0;
  return p.age < 15 ? r2(F.kd.adult / 2) : F.kd.adult;
}

// Fernverkehrsticket pro Person – MODELL (ab-Preis + Szenario, BC25)
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

// Fernverkehrsticket pro Person – LIVE (reales Angebot p.P. als Basis;
// BC25 wird annähernd angerechnet: −25 % bzw. +Karte; exakt bei der Buchung)
function fernLivePerPerson(p, price) {
  const c = cat(p.age);
  if (c === 'u6' || c === 'c') return { ticket: 0, bc: 0 };
  let ticket = r2(price);
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
  let ticket = c === 'c' ? r2(F.flex.koelnAssmannshausen * F.flex.kidFactor) : F.flex.koelnAssmannshausen;
  let bc = 0;
  if (p.bc25 === 'own') ticket = r2(ticket * (1 - F.flex.bcDiscount));
  else if (p.bc25 === 'new') {
    ticket = r2(ticket * (1 - F.flex.bcDiscount));
    bc = F.bc25.price[c] || 0;
  }
  return { ticket, bc };
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
  const window = ['any', 'morning', 'midday', 'afternoon'].includes(params.window) ? params.window : 'any';
  const departMin = params.departHM ? parseHM(params.departHM) : parseHM(ROUTE.departures[window]);

  const leadDays = Math.round((date - todayStart()) / 86400000);
  const scenario = ['ab', 'plus10', 'plus25', 'ausverkauft'].includes(params.ssScenario) ? params.ssScenario : 'ab';
  const ticketType = params.ticketType === 'sp' ? 'sp' : 'ss';
  const lastLegMode = params.lastLeg === 'kd' ? 'kd' : 'auto';

  // Sparpreis-Preis je Tickettyp + Szenario (Modell; live ersetzt durch reale Angebote)
  const scenDelta = scenario === 'ab' ? 0 : scenario === 'plus10' ? 10 : 25;
  const ssAb = r2(F.ss.ab + scenDelta);
  const spAb = r2(Math.max(F.sp.ab + scenDelta, F.sp.ab));
  const fernBase = ticketType === 'sp' ? spAb : ssAb;
  const fernName = ticketType === 'sp' ? 'Sparpreis' : 'SuperSparpreis';

  // WICHTIG: Sparpreise sind für ALLE Reisedaten buchbar – KEIN harter Vorlauf-Cut.
  // Live „empty“ (Preissuche ohne Angebot für den Tag) = ehrlich nicht buchbar.
  const pastDate = leadDays < 0;
  const scenarioSoldOut = scenario === 'ausverkauft';
  const shortLead = !pastDate && leadDays < F.ss.minLeadDays;
  const shortLeadNote = shortLead
    ? `Kurzfrist (nur ${leadDays} Tag(e) Vorlauf): Der ab-Preis ${fmtEuro(fernBase)} ist in dieser Nähe oft nicht mehr verfügbar – Live-Modus bzw. bahn.de zeigen den echten Preis.`
    : null;
  const ssAvailable = !pastDate && !scenarioSoldOut;
  const ssReason = pastDate
    ? 'Reisedatum liegt in der Vergangenheit.'
    : scenarioSoldOut
      ? `${fernName}: als ausverkauft / nicht buchbar markiert (Szenario).`
      : null;

  // 9-Uhr-Regel RP-Ticket (nur für die Verbund-Optionen E/G)
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
  const bikeNote = anyBike ? 'Klapprad: gefaltet in allen Zügen/Bus frei; erster Abschnitt (Radtour statt S 11) dauert im Modell +15 min.' : null;
  const bauNote = bau ? 'BAUEN 2026: Rechte Rheinstrecke (Wiesbaden–Rüdesheim–Koblenz) 10.07.–11.12.2026 vollgesperrt → Bus-Ersatz, deutlich längere Fahrzeiten (RMV-Fahrplan 2026).' : null;

  const opts = [];
  const mk = (o) => opts.push(o);

  // ---------- Live-Daten ----------
  const live = params.live && params.live.status && params.live.status !== 'off' ? params.live : null;
  const liveS = ssSeg(live, 'all');
  const ssEmpty = live && ssStatus(live, 'all') === 'empty';
  const liveEmptyReason = ssEmpty
    ? `${fernName}: Live-Preissuche (Stand ${(live.ss.all || {}).asOf}) fand KEIN Sparpreis-Angebot für diesen Tag → nicht buchbar.`
    : null;

  // Route-Klassifikation der Live-Angebote: geht die Verbindung über Frankfurt
  // (SFS + RE 21) oder linksrheinisch (Mainz/Koblenz)?
  const journeyVia = (j) => {
    const via = (j.trains || []).map((t) => `${t.to || ''} ${t.from || ''}`).join(' | ');
    if (/Frankfurt/i.test(via)) return 'frankfurt';
    if (/Koblenz|Mainz/i.test(via)) return 'linksrheinisch';
    return 'unbekannt';
  };
  const journeysBy = (route) => {
    if (!liveS) return null;
    const js = liveS.data.journeys.filter((j) =>
      journeyVia(j) === route || (route === 'linksrheinisch' && journeyVia(j) === 'unbekannt'));
    return js.length ? js : null;
  };
  const L_A = journeysBy('linksrheinisch') ? journeysBy('linksrheinisch')[0] : null;
  const L_C = journeysBy('frankfurt') ? journeysBy('frankfurt')[0] : null;

  const connRow = (L, routeLabel, modelNote) => ({
    label: L
      ? `${L.offerName || fernName} Parkgürtel→Assmannshausen (LIVE, ${liveS.asOf}, 2. Kl., ${summary}) – ${routeLabel}`
      : `${fernName} Parkgürtel→Assmannshausen, 2. Kl. (${modelNote}, ${summary}) – ${routeLabel}`
  });
  const connNote = (L) => L
    ? `Live-Angebot (DB-Preissuche, ${liveS.asOf}): ${L.offerName || fernName} für ${fmtEuro(L.price)} p.P.${L.offerDesc ? ' – ' + L.offerDesc : ''}${L.zb ? ' · Zugbindung gilt nur für den Fernverkehrszug; Nahverkehrsvor-/nachlauf frei wählbar' : ''}`
    : null;
  const ticketRow = (title) => [
    { label: 'S 11 Parkgürtel→Köln Hbf: im Ticket enthalten (Nahverkehrsvorlauf, frei wählbar)', amount: 0 },
    { label: `Letzter Abschnitt bis Assmannshausen: im Ticket enthalten (Nahverkehrsnachlauf, frei wählbar) – ${title}`, amount: 0 }
  ];

  // --- 1) Direkt-Buchung, linksrheinische Verbindung (ICE via Mainz) ---
  {
    const f = L_A ? people.map((p) => fernLivePerPerson(p, L_A.price)) : people.map((p) => fernPerPerson(p, fernBase));
    const ticketSum = r2(f.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(f.reduce((s, x) => s + x.bc, 0));
    const minutes = L_A && L_A.totalMin != null ? L_A.totalMin : ROUTE.duration('A') + (anyBike ? 15 : 0);
    mk({
      id: 'sp_direct',
      name: `${fernName} DIREKT nach Assmannshausen – linkrheinische Verbindung (ganze Verbindung im Ticket)`,
      itin: 'A',
      available: ssAvailable && !ssEmpty,
      reason: ssReason || liveEmptyReason,
      badges: [L_A ? 'LIVE-Angebot' : 'Modell-Preis', '1 Ticket = ganze Verbindung', 'Zugbindung nur im Fernzug'],
      total: r2(ticketSum + bcSum),
      minutes,
      rows: [
        { ...connRow(L_A, 'linksrheinisch (ICE via Mainz)'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        ...ticketRow('RE/RB ab Mainz, in Bauzeit Bus')
      ],
      notes: [
        'EIN Ticket deckt die gesamte gebuchte Verbindung ab: S 11 + ICE (Zugbindung) + letzter Abschnitt (RE/RB/Bus, frei wählbar) – keine Zusatztickets nötig (bahn.de-FAQ). Reiseende bis 10 Uhr Folgetag.',
        'Es fährt KEIN Fernverkehr nach Rüdesheim – der ICE bleibt linksrheinisch (Mainz), der letzte Abschnitt läuft im Nahverkehr und ist im Ticket enthalten.',
        L_A ? `Live-Angebot (DB-Preissuche, ${liveS.asOf}): ${L_A.offerName || fernName} für ${fmtEuro(L_A.price)} p.P., ${L_A.depStr}→${L_A.arrStr} (${fmtDur(L_A.totalMin)}).${L_A.zb ? ' Zugbindung nur im Fernzug.' : ''}` : null,
        hasKids ? F.sp.kidsFree : null,
        shortLeadNote,
        bau ? '⚠️ Bau: Der Nachlauf Mainz→Assmannshausen verläuft rechtsrheinisch (via Eltville/Rüdesheim) → in der Bauzeit mit Bus-Ersatz, länger.' : null,
        bikeNote
      ].filter(Boolean),
      _live: { j: L_A, all: liveS, nvAlt: true }
    });
  }

  // --- 2) Direkt-Buchung, Umweg über Frankfurt (SFS + RE 21) ---
  {
    const f = L_C ? people.map((p) => fernLivePerPerson(p, L_C.price)) : people.map((p) => fernPerPerson(p, fernBase));
    const ticketSum = r2(f.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(f.reduce((s, x) => s + x.bc, 0));
    const kd = lastLegMode === 'kd' ? people.map(kdPerPerson) : null;
    const kdSum = kd ? r2(kd.reduce((s, x) => s + x, 0)) : 0;
    const minutes = L_C && L_C.totalMin != null
      ? L_C.totalMin + (kd ? F.kd.minutes - 5 : 0)
      : ROUTE.duration('C') + (anyBike ? 15 : 0) + (kd ? F.kd.minutes - 5 : 0);
    mk({
      id: 'sp_direct_frankfurt',
      name: `${fernName} DIREKT nach Assmannshausen – Umweg über Frankfurt (SFS + RE 21)`,
      itin: 'C',
      available: ssAvailable && !ssEmpty,
      reason: ssReason || liveEmptyReason,
      badges: [L_C ? 'LIVE-Angebot' : 'Modell-Preis', 'längerer Umweg', '1 Ticket = ganze Verbindung'],
      total: r2(ticketSum + bcSum + kdSum),
      minutes,
      rows: [
        { ...connRow(L_C, 'über Frankfurt (SFS + RE 21)'), amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        ...ticketRow('RE 21 + RB 10 via Rüdesheim, in Bauzeit Bus'),
        ...(kd ? [{ label: `Fahrgastschiff KD statt RB 10 (Rüdesheim→Assmannshausen, ${summary})`, amount: kdSum }] : [])
      ],
      notes: [
        'Der „längere, aber oft günstigere“ Umweg: ICE auf der Neubaustrecke nach Frankfurt, dann RE 21 (Rheingau) über Wiesbaden bis Rüdesheim, 5 min nach Assmannshausen – alles in EINEM Ticket.',
        'Zugbindung nur für den ICE; S 11, RE 21 und der letzte Abschnitt sind frei wählbar (bahn.de-FAQ).',
        L_C ? `Live-Angebot (DB-Preissuche, ${liveS.asOf}): ${L_C.offerName || fernName} für ${fmtEuro(L_C.price)} p.P., ${L_C.depStr}→${L_C.arrStr} (${fmtDur(L_C.totalMin)}).` : 'Kein Live-Angebot via Frankfurt im aktuellen Fenster → Modell-Preis (ab-Preis).',
        hasKids ? F.sp.kidsFree : null,
        shortLeadNote,
        bau ? '⚠️ Bau: Abschnitt Wiesbaden–Rüdesheim (RE 21) und Rüdesheim–Assmannshausen sind in der Bauzeit vollgesperrt → Bus-Ersatz, deutlich länger.' : null,
        kd ? 'Optional: statt RB 10 mit dem Fahrgastschiff KD (45 min, 12,50 €) – Ticket-Nachlauf ungenutzt, KD-Ticket separat.' : null,
        bikeNote
      ].filter(Boolean),
      _live: { j: L_C, all: liveS, nvAlt: true }
    });
  }

  // --- 3) Flexpreis direkt nach Assmannshausen (Referenz, freie Zugwahl) ---
  {
    const fx = people.map((p) => flexPerPerson(p));
    const ticketSum = r2(fx.reduce((s, x) => s + x.ticket, 0));
    const bcSum = r2(fx.reduce((s, x) => s + x.bc, 0));
    mk({
      id: 'flex_direct',
      name: 'Flexpreis DIREKT nach Assmannshausen (freie Zugwahl, keine Zugbindung)',
      itin: 'D',
      available: true,
      badges: ['Referenz', 'ohne Vorlauf', 'keine Zugbindung', '1 Ticket = ganze Verbindung'],
      total: r2(ticketSum + bcSum),
      minutes: ROUTE.duration('A') + (anyBike ? 15 : 0),
      rows: [
        { label: `Flexpreis Parkgürtel→Assmannshausen, 2. Kl. (Modellwert, ${summary})`, amount: ticketSum },
        ...(bcSum ? [{ label: 'Neue BahnCard 25 (12 Monate)', amount: bcSum }] : []),
        ...ticketRow('freie Zugwahl, ganzer Vor-/Nachlauf frei')
      ],
      notes: [
        F.flex.note,
        'Immer buchbar (auch spontan) – meist die teuerste Variante mit Fernverkehr; Referenz für „keine Zugbindung“.',
        bikeNote
      ].filter(Boolean),
      _live: { j: null, all: null, nvAlt: true }
    });
  }

  // --- 4) 3-Verbund linksrheinisch, ganz ohne Fernverkehr (24h NRW + RP + RMV) ---
  if (!allDtt) {
    const nrw = nrwTicket(people);
    const rp = rpTicket(people);
    const ll = people.map((p) => rmvPerPerson(p, 2));
    const llSum = r2(ll.reduce((s, x) => s + x, 0));
    const jAll = nvJ(live, 'nv_koln_assmannshausen_all');
    mk({
      id: 'nv_linksrheinisch',
      name: '3-Verbund linksrheinisch: 24hTicket NRW + RP-Ticket + RMV (ohne Fernverkehr)',
      itin: 'E',
      available: rpOk,
      reason: rpReason,
      badges: ['ohne Fernverkehr', '3 Verbundtickets', 'keine Zugbindung (alles Nahverkehr)'],
      total: r2(nrw.price + rp.price + llSum),
      minutes: jAll ? (jAll.data.journeys[0].totalMin ?? ROUTE.duration('E')) : ROUTE.duration('E') + (anyBike ? 15 : 0),
      rows: [
        { label: `Erster Teil: Parkgürtel→Köln Hbf – im 24hTicket NRW ENTHALTEN (${summary})`, amount: 0 },
        { label: `24hTicket NRW (Köln→Bonn, ${nrw.n} Pers., 24 h ohne 9-Uhr-Regel)`, amount: nrw.price },
        { label: `Rheinland-Pfalz-Ticket (ab Unkel→Lorch, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: `Letzter Teil: Lorch→Assmannshausen (2 Waben RMV, ${summary})`, amount: llSum }
      ],
      notes: [
        'Ganz ohne (Spar-)Preis-Buchung: RE linksrheinisch Köln→Bonn (24h NRW) → ab Unkel (1. RP-Halt) RP-Ticket über Koblenz nach Lorch → dann RMV.',
        'Keine Zugbindung (alles Nahverkehr), dafür längere Reisezeit und 2–3 Tickets.',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        bauNote,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 5) Deutschlandticket (0 € zusätzlich) ---
  if (allDtt) {
    const jAll = nvJ(live, 'nv_koln_assmannshausen_all');
    mk({
      id: 'dtt_nahverkehr',
      name: 'Deutschlandticket: komplett ohne Fernverkehr, alles 0 €',
      itin: 'F',
      available: true,
      badges: ['Deutschlandticket', '0 € zusätzlich', 'keine 9-Uhr-Regel'],
      total: 0,
      minutes: jAll ? (jAll.data.journeys[0].totalMin ?? ROUTE.duration('E')) : ROUTE.duration('E') + (anyBike ? 15 : 0),
      rows: [
        { label: 'S 11 Parkgürtel→Köln Hbf: DtT (0 €)', amount: 0 },
        { label: 'RE linksrheinisch Köln→Lorch: DtT (0 €)', amount: 0 },
        { label: 'RMV Lorch→Assmannshausen: DtT (0 €)', amount: 0 }
      ],
      notes: [
        'Das Deutschlandticket (66,80 €/Monat, 2026) gilt im Nahverkehr ganz Deutschlands – inkl. RE in RP und im hessischen RMV.',
        'Nur modelliert, wenn alle Reisenden ein DtT haben. Die Monatsgebühr ist hier NICHT eingerechnet.',
        bauNote,
        bikeNote
      ].filter(Boolean)
    });
  }

  // --- 6) RE „Rheintalbahn“ direkt rechtsrheinisch (Bau: Bus) ---
  if (!allDtt) {
    const nrw = nrwTicket(people);
    const rp = rpTicket(people);
    const ll = people.map((p) => rmvPerPerson(p, 1));
    const llSum = r2(ll.reduce((s, x) => s + x, 0));
    const j1 = nvJ(live, 'nv_koln_ruedesheim');
    const j2 = nvJ(live, 'nv_ruedesheim_assmannshausen');
    const min1 = j1 ? (j1.data.journeys[0].totalMin ?? 140) : 140;
    const min2 = j2 ? (j2.data.journeys[0].totalMin ?? 8) : 8;
    const kd = lastLegMode === 'kd' ? people.map(kdPerPerson) : null;
    const kdSum = kd ? r2(kd.reduce((s, x) => s + x, 0)) : 0;
    mk({
      id: 'nv_rechtsrheinisch',
      name: 'RE „Rheintalbahn“ direkt rechtsrheinisch nach Rüdesheim + RMV',
      itin: 'G',
      available: rpOk,
      reason: rpReason,
      badges: ['direkt (kein Fernverkehr)', 'keine Zugbindung', ...(bau ? ['⚠️ Bau: Bus-Ersatz'] : [])],
      total: r2(nrw.price + rp.price + llSum + kdSum),
      minutes: (j1 || j2) ? min1 + min2 + (kd ? F.kd.minutes - 5 : 0) : ROUTE.duration('G') + (anyBike ? 15 : 0) + (kd ? F.kd.minutes - 5 : 0),
      rows: [
        { label: `Erster Teil: Parkgürtel→Köln Hbf – im 24hTicket NRW ENTHALTEN (${summary})`, amount: 0 },
        { label: `24hTicket NRW (Köln, ${nrw.n} Pers.)`, amount: nrw.price },
        { label: `Rheinland-Pfalz-Ticket (ab 1. RP-Halt→Rüdesheim, ${rp.payers} zahlend, Kinder <14 frei)`, amount: rp.price },
        { label: `Letzter Teil: Rüdesheim→Assmannshausen (1 Wabe RMV, ${summary})`, amount: llSum },
        ...(kd ? [{ label: `Fahrgastschiff KD statt RB 10 (${summary})`, amount: kdSum }] : [])
      ],
      notes: [
        'Der „direkte“ Weg ohne Umwege: rechtsrheinisch durch nach Rüdesheim (kein Fernverkehr, keine Zugbindung) – das RP-Ticket kann ab dem ersten RP-Halt (Neuwied-Bereich) boarden.',
        bau ? '⚠️ BAUEN: Gerade ist die rechte Rheinstrecke vollgesperrt (10.07.–11.12.2026) → diese „direkte“ Route fährt mit Ersatzbussen und ist deutlich langsamer.' : 'Fußnote: Es gibt auf dieser Strecke KEINEN Fernverkehr – daher keine Sparpreise, nur Verbundtickets.',
        rpReason ? rpReason + ' (bei Flexibilität: einfach später abfahren.)' : null,
        bikeNote
      ].filter(Boolean),
      _live: { nv1: j1, nv2: j2 }
    });
  }

  // ---------- Live-Info anhängen ----------
  for (const o of opts) {
    if (!live || !o.available || !o._live) continue;
    const L = o._live;
    const info = {};
    if (L.j && L.all) {
      const j = L.j;
      info.fern = {
        price: j.price,
        train: (j.trains && j.trains.find((t) => /ICE|IC|EC/i.test(t.train || '')) || (j.trains && j.trains[0]) || {}).train || 'Fernzug',
        offerName: j.offerName,
        offerDesc: j.offerDesc,
        zb: j.zb,
        depStr: j.depStr,
        arrStr: j.arrStr,
        durMin: j.totalMin,
        legs: j.trains,
        asOf: L.all.asOf,
        alternatives: (L.all.data.journeys || []).filter((x) => x !== j).slice(0, 2).map((x) => ({
          depStr: x.depStr, arrStr: x.arrStr, price: x.price,
          train: (x.trains && x.trains[0] && x.trains[0].train) || ''
        }))
      };
    }
    if (L.nvAlt) {
      const n = nvJ(live, 'nv_koln_assmannshausen_all');
      if (n) {
        const j = n.data.journeys[0];
        info.nvAlt = {
          totalMin: j.totalMin,
          depStr: j.depStr,
          arrStr: j.arrStr,
          legs: j.legs,
          asOf: n.asOf,
          diffMin: j.totalMin != null ? j.totalMin - o.minutes : null
        };
      }
    }
    if (L.nv1 || L.nv2) {
      info.nvLegs = [L.nv1, L.nv2].filter(Boolean).map((n) => {
        const j = n.data.journeys[0];
        return { totalMin: j.totalMin, depStr: j.depStr, arrStr: j.arrStr, legs: j.legs, asOf: n.asOf };
      });
    }
    if (Object.keys(info).length) o.liveInfo = info;
    delete o._live;
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
    shortLead,
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
  { t: 'KERN-REGEL: Ticket deckt die ganze gebuchte Verbindung', s: 'Der (Super)Sparpreis (und Flexpreis) ist DIREKT nach Assmannshausen buchbar – das Ticket gilt für die gesamte gebuchte Verbindung: Nahverkehrsvorlauf (S 11 Parkgürtel→Hbf) + Fernverkehrszug (ICE, damit Zugbindung) + Nahverkehrsnachlauf (letzter Abschnitt RE/RB/Bus, frei wählbar, keine Zugbindung). Die Reise muss bis 10 Uhr des Folgetags beendet sein. → EINE Ticketzeile pro Person, keine Zusatz-RP-/RMV-Tickets. Quelle: bahn.de-FAQ „Mit welchen Zügen kann ich mit dem (Super)Sparpreis reisen?“ (Stand 2026).' },
  { t: 'KERN-ERKENNTNIS: kein Fernverkehr an der rechten Rheinstrecke', s: 'Nach Rüdesheim/Bingen (rechter Rhein) fährt NUR Regionalverkehr (RE 97 „Rheintalbahn“, RB 10 „Rheingau-Bahn“) – kein ICE/IC. Der Fernverkehr läuft linksrheinisch (Köln–Bonn–Koblenz–Mainz, mind. stündlich ICE) und über die Neubaustrecke (Köln–Frankfurt Hbf, ~1 h 05). Die Sparpreis-Optionen buchen daher über Mainz (linksrheinisch) oder Frankfurt (Umweg, RE 21 nach Rüdesheim).' },
  { t: 'SuperSparpreis / Sparpreis (2026)', s: 'SuperSparpreis ab 17,99 € (Zugbindung, kein Storno), Sparpreis ab 21,99 € (Zugbindung, Storno gegen 10 € Gebühr). Dynamische Preise – für ALLE Reisedaten buchbar, bei kurzem Vorlauf ist der ab-Preis i. d. R. erschwert. Kinder bis 14 frei (Alter bei Buchung angeben, max. 4 je Ticket, Begleitung 15+). BahnCard 25 = 25 % (annähernd angesetzt, exakt bei Buchung). Quellen: bahn.de, dbfahrplanauskunft.com (2026).' },
  { t: 'City-Ticket (DB)', s: 'GETRENNTES Extra: Beim SuperSparpreis kostenpflichtig zubuchbar, beim Sparpreis/Flexpreis automatisch >100 km (Köln teilnehmend) – erlaubt freie Nahverkehrsfahrten im Stadtgebiet am Geltungstag. HIER NICHT NÖTIG, weil die S 11 bereits Teil der gebuchten Verbindung ist (Modell rechnet deshalb KEIN Stadt-Ticket extra). Ggf. relevant für eine zweite Stadt-Fahrt am Reisetag.' },
  { t: 'Flexpreis (DB-Tarif)', s: 'Parkgürtel→Assmannshausen: 44,10 € BEOBSACHTET (bahn.de, 08.10.2026, Tagesslot „Unsere Bestpreise“) als Modellwert – der Flexpreis liegt in dieser Größenordnung; Kind 6–14: 50 %; BC25: 25 %. Freie Zugwahl, stornierbar. Vor Buchung auf bahn.de prüfen.' },
  { t: 'BahnCard 25', s: '62,90 € (27–64), My-BahnCard 39,90 € (unter 27), Senioren 40,90 € – Jahreskarte 12 Monate. 25 % auf DB-Fern- und -Nahverkehr zum DB-Tarif; kein Rabatt auf Verbund-/Ländertickets; RMV-BC entfällt seit 2026.' },
  { t: 'Rheinland-Pfalz-Ticket', s: '30 € + 10 € je weitere Person (max. 5), Kinder unter 14 frei. Mo–Fr erst ab 9:00 Uhr, Sa/So ganztägig. Gilt ab JEDEM Bahnhof in RP (auch mitten in der Strecke) – nicht in Köln (NRW), nicht in Hessen. Nur relevant für die Verbund-Optionen (3-Verbund linksrheinisch, RE rechtsrheinisch).' },
  { t: '24hTicket NRW', s: '39,80 € Single / 59,80 € bis 5 Personen (Stand 2026), 24 h ab Entwertung, keine 9-Uhr-Regel. Gilt auf ALLEN Nahverkehrsmitteln in NRW – der erste Teil Parkgürtel→Köln Hbf ist damit ENTHALTEN.' },
  { t: 'RMV / Nahverkehr Hessen', s: 'RMV-Einzelfahrschein ab 1.1.2026: 3,90 € (Kind 2,20 €) je Wabe (Wabenanzahl modelliert); BahnCard-Rabatt entfällt. Reiner Nahverkehr ohne Fernverkehr: Waben zählen. Vor Fahrt in der RMV-App prüfen.' },
  { t: 'Köln (Rheinland-Tarif VRS+AVV, ab 1.6.2026)', s: 'Kurzstrecke 2,90 € (2 Halte: Parkgürtel→Hbf, Kind 1,45 €), Einzelfahrt 4,00 €, 24 h Köln 9,60 € – NUR Referenz: Bei den Fernverkehr-Optionen ist die S 11 im Ticket enthalten, bei den Verbund-Optionen im 24hTicket NRW. eezy.nrw ~3,28 € teurer. Mit VRS-Abonnement: 0 € (redundant, da S 11 ohnehin enthalten).' },
  { t: 'Deutschlandticket', s: '66,80 €/Monat (2026), gilt im Nahverkehr bundesweit (inkl. RE in RP + RMV Hessen), nicht im Fernverkehr, keine 9-Uhr-Regel. Option nur, wenn alle Reisenden eines haben (Monatsgebühr nicht eingerechnet).' },
  { t: 'Klapprad', s: 'Gefaltetes Klapprad in Nah- und Fernverkehr frei ohne Reservierung. Im Modell ersetzt es den ersten Abschnitt (Radtour ~25 min statt S 11, +15 min); der letzte Abschnitt bleibt wie gebucht (Ticket gilt).' },
  { t: 'Schifffahrt (2026)', s: 'Fahrgastschiff (Rössler-Linie) Rüdesheim→Assmannshausen KD: 12,50 €, ~45 min (Kind 50 % modelliert) – optionales „letzter Abschnitt“-Upgrade bei den Optionen über Rüdesheim (Ticket-Nachlauf bleibt ungenutzt, KD-Ticket separat). Kein Nahverkehr → keine Verbundtickets.' },
  { t: 'BAUEN 2026 (Betriebslage)', s: 'Rechte Rheinstrecke (Wiesbaden–Rüdesheim–Koblenz) 10.07.–11.12.2026 vollgesperrt (RMV-Fahrplan 2026, RB10/RE 21-Abschnitte → Bus-Ersatz) → alle rechtsrheinischen Abschnitte inkl. Assmannshausen deutlich länger. Tickets bleiben dieselben.' },
  { t: 'Fahrzeiten (Modell)', s: 'S 11 Parkgürtel→Hbf ~10 min, ICE Köln→Mainz links ~1 h 45, Nachlauf Mainz→Assmannshausen ~45 min (Bau: Bus), ICE Köln→Frankfurt (SFS) ~1 h 05, RE 21 Frankfurt→Rüdesheim ~1 h 15 (Bau: Bus), RE 97 rechts Köln→Rüdesheim ~2 h 20 (Bau: Bus), RE links Köln→Lorch ~2 h 25, Lorch→Assmannshausen ~55 min, Umsteigepuffer 15–20 min. Live ersetzt durch echte Verbindungen.' },
  { t: 'Live-Daten', s: 'Live-Modus fragt die DB-Preissuche (ps.bahn.de) für die EIGENTLICHE Buchungsfrage ab: Parkgürtel→Assmannshausen, 24-h-Fenster = „Günstigster Tarif des Tages“ – exakt die Angebote, die bahn.de zeigt. Die Angebote enthalten die ganze gebuchte Verbindung (S 11 + Fernzug + Nachlauf) → konkretes Angebot p.P. mit allen Zügen. Route-Klassifikation (via Frankfurt / linksrheinisch) weist die Angebote den Optionen zu; „kein Angebot für den Tag“ (empty) = Option nicht buchbar. ps.bahn.de blockt direkte Browser-Calls (CORS) → automatischer Fallback über CORS-Proxys (UI zeigt die genutzte Quelle). Nahverkehrsalternativen (Zugbindung-Δ) via DB Navigator API (Key). Details: docs/LIVE-DATEN.md.' },
  { t: 'Quellen (Auszug)', s: 'bahn.de (FAQ Sparpreise/Züge, 2026: SS ab 17,99/SP ab 21,99), dbfahrplanauskunft.com (2026), RMV (Fahrplan 2026: Vollsperrung rechter Rheinstrecke, Einzelfahrschein 2026), kvb.koeln (Rheinland-Tarif 2026), bingen-ruedesheimer.de/roesslerlinie.de (Schifffahrt 2026), Beobachtung bahn.de 08.10.2026 (21,69 € Direkt-Angebot), DB-Station-Datenbestand (Station-IDs). Details: docs/TARIFE-2026.md + docs/LIVE-DATEN.md.' }
];
