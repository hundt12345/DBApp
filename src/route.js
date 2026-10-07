// route.js – Fixe Teststrecke: Köln Geldernstraße/Parkgürtel → Assmannshausen (bei Rüdesheim, HE)
//
// Ziel: Assmannshausen (Rheingau-Taunus-Kreis, HESSEN, RMV) – NICHT das Assmannshausen in Rheinhessen.
// Nächstgelegene Halte: „Assmannshausen“ an der rechten Rheinstrecke (RB/RE, 5 min ab Rüdesheim)
// + Anlegestelle „Assmannshausen KD“ (Fahrgastschiff ab Rüdesheim).
//
// STRUKTURELLER KLASSER (verifiziert, siehe fares.js):
//  - Rechte Rheinstrecke (Köln–Neuwied–Koblenz–Bingen–Rüdesheim–Assmannshausen):
//    NUR Regionalverkehr (RE 97 „Rheintalbahn“ u. a.) → KEIN Fernverkehr, KEIN Sparpreis nach Rüdesheim.
//  - Linksrheinisch (Köln–Bonn–Koblenz–Mainz): ICE/IC-Fernverkehr, mind. stündlich.
//  - Neubaustrecke (Köln–Frankfurt Hbf): ICE ~1 h 05.
// → Sparpreis-Segmente sind daher nur: Koblenz (links), Mainz (links), Frankfurt (SFS).
//
// Betriebslage 2026: Rechte Rheinstrecke (Wiesbaden–Rüdesheim–Koblenz) 10.07.–11.12.2026 vollgesperrt
// (Bus-Ersatz, RB10) → alle Abschnitte rechts des Rheins inkl. Assmannshausen sind länger.
//
// Fahrtzeiten sind Modellwerte (typische Fahrpläne 2026); Live-Modus ersetzt sie pro Abschnitt.
// conns[i] = Umsteige-/Verbindungspuffer (min) unmittelbar vor legs[i].

export const ROUTE = {
  origin: 'Köln Geldernstraße/Parkgürtel (S 6/S 11)',
  originShort: 'Parkgürtel',
  hbf: 'Köln Hbf',
  destination: 'Assmannshausen (Rüdesheim, Hesse / RMV)',
  destShort: 'Assmannshausen',
  destRail: 'Assmannshausen (rechter Rheinstrecke / Rheingau-Bahn)',
  destKD: 'Assmannshausen KD (Anlegestelle)',
  koelnAirKm: 6,
  firstLeg: { s11Min: 10, bikeMin: 25 }, // Parkgürtel → Köln Hbf (S 11 bzw. Klapprad, ~5,5 km)

  // Modell-Abfahrten je Zeitfenster
  departures: { any: '11:00', morning: '07:30', midday: '11:00', afternoon: '15:30' },

  // ---------- Live-Daten ----------
  // Station-IDs (DB-HDS, verifiziert über den Station-Datenbestand „db-stations“):
  stations: {
    koelnParkguertel: '8003360', // Köln Geldernstr./Parkgürtel (S 6/S 11)
    koelnHbf: '8000207',
    koblenz: '8000206', // Koblenz Hbf
    mainz: '8000240', // Mainz Hbf
    frankfurt: '8098105', // Frankfurt (Main) Hbf
    ruedesheim: '8005213', // Rüdesheim (Rhein)
    bingen: '8000039', // Bingen (Rhein) Hbf
    assmannshausen: '8000635',
    ahrweiler: '8000448',
    neuwied: '8000276',
    euskirchen: '8000100',
    lahnstein: '8000277' // aus ID-Folge abgeleitet (zwischen Neuwied 8000276 und Niederlahnstein 8000278)
  },
  // Live-Segmente: Fernpreis-Suche (ps.bahn.de) – NUR echte Fernverkehrs-Strecken –
  // und Nahverkehr-Verbindungen (DB API).
  liveSegments: {
    ss: {
      mainz: { from: 'koelnHbf', to: 'mainz' },
      frankfurt: { from: 'koelnHbf', to: 'frankfurt' },
      koblenz: { from: 'koelnHbf', to: 'koblenz' }
    },
    nv: {
      nv_koblenz_assmannshausen: { from: 'koblenz', to: 'assmannshausen' },
      nv_mainz_assmannshausen: { from: 'mainz', to: 'assmannshausen' },
      nv_frankfurt_assmannshausen: { from: 'frankfurt', to: 'assmannshausen' },
      nv_koln_ruedesheim: { from: 'koelnHbf', to: 'ruedesheim' },
      nv_ruedesheim_assmannshausen: { from: 'ruedesheim', to: 'assmannshausen' },
      nv_koln_assmannshausen_all: { from: 'koelnHbf', to: 'assmannshausen' }
    }
  },

  // Itinerar-Skelette:
  // A: Sparpreis→Mainz, Ausstieg Koblenz, linksrheinisch (RP bis Lorch)
  // B: Sparpreis→Mainz, durchgehend bis Assmannshausen (RP-Streckchen Mainz + RMV)
  // C: Sparpreis→Frankfurt (SFS) + RE 21 (VGN+RMV) + RMV – „längerer Umweg“
  // D: Flexpreis→Koblenz (links, keine Zugbindung) + RP + RMV – Referenz
  // E: 3-Verbund linksrheinisch, ganz ohne Fernverkehr (24h NRW + RP + RMV)
  // F: DEUTSCHLANDTICKET + 3-Verbund linksrheinisch (0 € zusätzlich)
  // G: RE „Rheintalbahn“ direkt rechtsrheinisch nach Rüdesheim + RMV – ohne Fernverkehr
  itins: {
    A: {
      label: 'Sparpreis nach Mainz, Ausstieg Koblenz (linksrheinisch), RP-Ticket bis Lorch',
      legs: [
        { from: 'Köln Hbf', to: 'Koblenz', mode: 'ICE linksrheinisch (Fernverkehr)', min: 85, note: 'Bis Mainz gebucht, in Koblenz ausgestiegen (gleiches Ticket, keine Mehrkosten). Kein Fernverkehr nach Rüdesheim!' },
        { from: 'Koblenz', to: 'Lorch', mode: 'RE/RB linksrheinisch', min: 40, note: 'Rheinland-Pfalz-Ticket; Rüdesheim & Assmannshausen liegen in Hessen → RP-Ticket gilt nur bis Lorch' },
        { from: 'Lorch', to: 'Assmannshausen', mode: 'Nahverkehr (RMV)', min: 15, note: 'über Rüdesheim – der „kleine Teil in Hessen“ (im Sommer 2026: Bus-Ersatz!)' }
      ],
      conns: [15, 20, 10]
    },
    B: {
      label: 'Sparpreis nach Mainz, durch bis Assmannshausen (RMV)',
      legs: [
        { from: 'Köln Hbf', to: 'Mainz (Hbf)', mode: 'ICE linksrheinisch (Fernverkehr)', min: 105 },
        { from: 'Mainz', to: 'Assmannshausen', mode: 'RE rechtsrheinisch (durchgehend)', min: 60, note: 'Kurz-RP-Streckchen ab Mainz (ZMB-Einzel) + RMV-Teil bis Assmannshausen; im Sommer 2026: Bus-Ersatz rechtsrheinisch!' }
      ],
      conns: [15, 20]
    },
    C: {
      label: 'Sparpreis nach Frankfurt (Neubaustrecke) + RE 21 über Wiesbaden',
      legs: [
        { from: 'Köln Hbf', to: 'Frankfurt (Main) Hbf', mode: 'ICE Neubaustrecke (SFS)', min: 65 },
        { from: 'Frankfurt (Main) Hbf', to: 'Rüdesheim (Rhein)', mode: 'RE 21 (VGN+RMV)', min: 75, note: 'Cross-Verbund-Ticket (VGN+RMV) nötig; durchfahrt bis Rüdesheim' },
        { from: 'Rüdesheim', to: 'Assmannshausen', mode: 'RB/RMV (5 min)', min: 5, note: 'der „kleine Teil in Hessen“ (im Sommer 2026: Bus-Ersatz!)' }
      ],
      conns: [15, 15, 8]
    },
    D: {
      label: 'Flexpreis nach Koblenz (linksrheinisch, keine Zugbindung) + RP + RMV',
      legs: [
        { from: 'Köln Hbf', to: 'Koblenz', mode: 'ICE/IC linksrheinisch (freie Zugwahl)', min: 85 },
        { from: 'Koblenz', to: 'Lorch', mode: 'RE/RB linksrheinisch', min: 40, note: 'Rheinland-Pfalz-Ticket (Mo–Fr ab 9:00!)' },
        { from: 'Lorch', to: 'Assmannshausen', mode: 'Nahverkehr (RMV)', min: 15, note: 'der „kleine Teil in Hessen“ (im Sommer 2026: Bus-Ersatz!)' }
      ],
      conns: [15, 20, 10]
    },
    E: {
      label: '3-Verbund linksrheinisch, ganz ohne Fernverkehr',
      legs: [
        { from: 'Köln Hbf', to: 'Koblenz', mode: 'RE linksrheinisch (über Bonn)', min: 90, note: '24hTicket NRW bis Bonn (NRW-Grenze), ab Unkel (1. RP-Halt) Rheinland-Pfalz-Ticket' },
        { from: 'Koblenz', to: 'Lorch', mode: 'RE/RB linksrheinisch', min: 40, note: 'Rheinland-Pfalz-Ticket' },
        { from: 'Lorch', to: 'Assmannshausen', mode: 'Nahverkehr (RMV)', min: 15, note: 'der „kleine Teil in Hessen“ (im Sommer 2026: Bus-Ersatz!)' }
      ],
      conns: [15, 15, 10]
    },
    F: {
      label: 'Deutschlandticket, linksrheinisch ohne Fernverkehr',
      legs: [
        { from: 'Köln Hbf', to: 'Koblenz', mode: 'RE linksrheinisch (über Bonn)', min: 90, note: 'DtT: alles bis Koblenz 0 €' },
        { from: 'Koblenz', to: 'Lorch', mode: 'RE/RB linksrheinisch', min: 40, note: 'DtT gilt auch in RP (Nahverkehr) – keine 9-Uhr-Regel' },
        { from: 'Lorch', to: 'Assmannshausen', mode: 'Nahverkehr (RMV)', min: 15, note: 'DtT gilt auch im hessischen RMV (im Sommer 2026: Bus-Ersatz!)' }
      ],
      conns: [15, 15, 10]
    },
    G: {
      label: 'RE „Rheintalbahn“ direkt rechtsrheinisch nach Rüdesheim',
      legs: [
        { from: 'Köln Hbf', to: 'Rüdesheim (Rhein)', mode: 'RE 97 rechtsrheinisch (kein Fernverkehr!)', min: 120, note: 'Direkt durch (keine Zugbindung). 2026: RECHTE RHEINSTRECKE 10.07.–11.12. VOLLGESPELLT → Ersatzbusse, deutlich länger!' },
        { from: 'Rüdesheim', to: 'Assmannshausen', mode: 'RB/RMV (5 min)', min: 5, note: 'der „kleine Teil in Hessen“ (im Sommer 2026: Bus-Ersatz!)' }
      ],
      conns: [15, 8]
    }
  },

  duration(itinId) {
    const t = this.itins[itinId];
    let total = this.firstLeg.s11Min; // Standard (ohne Rad)
    t.legs.forEach((leg, i) => {
      total += (t.conns[i] || 0) + leg.min;
    });
    return total;
  }
};
