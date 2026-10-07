// route.js – Fixe Teststrecke: Köln Geldernstraße/Parkgürtel → Assmannshausen (bei Rüdesheim, HE)
//
// Ziel: Assmannshausen (Rheingau-Taunus-Kreis, HESSEN, RMV) – NICHT das Assmannshausen in Rheinhessen.
// Der nächste Bahn-Halt ist "Assmannshausen" an der Rheintalstrecke (rechtsrheinisch,
// Regionalverkehr: RE/RB + Rheingau-Bahn RB 10). Alternativ die Schiffsanlegestelle
// "Assmannshausen KD" (Fähre/Fahrgastschiff ab Rüdesheim oder Bingen).
//
// Fahrtzeiten sind Modellwerte auf Basis typischer Fahrpläne (2026), kein Live-Daten.
// conns[i] = Umsteige-/Verbindungspuffer (min) unmittelbar vor legs[i].

export const ROUTE = {
  origin: 'Köln Geldernstraße/Parkgürtel (S 6/S 11)',
  originShort: 'Parkgürtel',
  hbf: 'Köln Hbf',
  destination: 'Assmannshausen (Rüdesheim, Hesse / RMV)',
  destShort: 'Assmannshausen',
  destRail: 'Assmannshausen (Rheintalstrecke / Rheingau-Bahn)',
  destKD: 'Assmannshausen KD (Anlegestelle)',
  koelnAirKm: 6,
  firstLeg: { s11Min: 10, bikeMin: 25 }, // Parkgürtel → Köln Hbf (S 11 bzw. Klapprad, ~5,5 km)
  connBufferMin: 20,

  // Letzter Abschnitt je nach Ankunftspunkt (strips = RMV-Waben des Einzelfahrschein)
  lastLegs: {
    ruedesheim: { from: 'Rüdesheim (Rhein)', trainMin: 7, bikeMin: 15, strips: 1, kd: true },
    lorch: { from: 'Lorch (RH)', trainMin: 15, bikeMin: 25, strips: 2, kd: false },
    eltville: { from: 'Eltville (rechtsrheinisch)', trainMin: 35, bikeMin: 35, strips: 2, kd: false }
  },

  // Modell-Abfahrten je Zeitfenster
  departures: { any: '11:00', morning: '07:30', midday: '11:00', afternoon: '15:30' },

  // ---------- Live-Daten ----------
  // Station-IDs (DB-HDS, verifiziert über das Station-Datenbestand "db-stations"):
  stations: {
    koelnParkguertel: '8003360', // Köln Geldernstr./Parkgürtel (S 6/S 11)
    koelnHbf: '8000207',
    ruedesheim: '8005213', // Rüdesheim (Rhein)
    koblenz: '8000206', // Koblenz Hbf
    bingen: '8000039', // Bingen (Rhein) Hbf
    assmannshausen: '8000635',
    ahrweiler: '8000448',
    neuwied: '8000276',
    euskirchen: '8000100',
    lahnstein: '8000277' // aus ID-Folge abgeleitet (zwischen Neuwied 8000276 und Niederlahnstein 8000278)
  },
  // Live-Segmente: Fernpreis-Suche (ps.bahn.de) und Nahverkehr-Verbindungen (DB API)
  liveSegments: {
    ss: {
      ruedesheim: { from: 'koelnHbf', to: 'ruedesheim' },
      koblenz: { from: 'koelnHbf', to: 'koblenz' },
      bingen: { from: 'koelnHbf', to: 'bingen' }
    },
    nv: {
      nv_ruedesheim_assmannshausen: { from: 'ruedesheim', to: 'assmannshausen' },
      nv_koblenz_assmannshausen: { from: 'koblenz', to: 'assmannshausen' },
      nv_lahnstein_assmannshausen: { from: 'lahnstein', to: 'assmannshausen' },
      nv_koln_assmannshausen_all: { from: 'koelnHbf', to: 'assmannshausen' }
    }
  },

  // Itinerar-Skelette (A: direkt, B: linksrheinisch, C/D: rechtsrheinisch, E: Fähre)
  // legs[i] ist ein ganzer Tarifabschnitt; letzter Leg = letzter Abschnitt bis Assmannshausen.
  itins: {
    A: {
      label: 'ICE direkt nach Rüdesheim',
      legs: [
        { from: 'Köln Hbf', to: 'Rüdesheim (Rhein)', mode: 'ICE (Fernverkehr)', min: 135, note: 'Nicht jeder ICE hält in Rüdesheim – ggf. IC oder Umstieg in Koblenz' },
        { from: 'Rüdesheim', to: 'Assmannshausen', mode: 'Nahverkehr (RMV) / Rad / Schiff', min: 7 }
      ],
      conns: [15, 10]
    },
    B: {
      label: 'über Koblenz, linksrheinisch (RP-Ticket bis Lorch)',
      legs: [
        { from: 'Köln Hbf', to: 'Koblenz', mode: 'ICE (Fernverkehr)', min: 75 },
        { from: 'Koblenz', to: 'Lorch', mode: 'RE/RB linksrheinisch', min: 90, note: 'Rheinland-Pfalz-Ticket; Rüdesheim & Assmannshausen liegen in Hessen → RP-Ticket gilt nur bis Lorch' },
        { from: 'Lorch', to: 'Assmannshausen', mode: 'Nahverkehr (RMV)', min: 15, note: 'über Rüdesheim – der „kleine Teil in Hessen“' }
      ],
      conns: [15, 20, 10]
    },
    C: {
      label: 'Rechtsrheinisch über Lahnstein (Lahn + Rheingau-Bahn)',
      legs: [
        { from: 'Köln Hbf', to: 'Koblenz', mode: 'ICE (Fernverkehr)', min: 75 },
        { from: 'Koblenz', to: 'Lahnstein', mode: 'RB Lahntalstrecke', min: 40, note: 'Rheinland-Pfalz-Ticket, keine Zugbindung' },
        { from: 'Lahnstein', to: 'Assmannshausen', mode: 'RB 10 Rheingau-Bahn (rechtsrheinisch)', min: 75, note: 'RP-Ticket bis Lahnstein, ab Eltville RMV-Ticket' }
      ],
      conns: [15, 20, 15]
    },
    D: {
      label: '3-Verbund-Variante, ganz ohne Fernverkehr',
      legs: [
        { from: 'Köln Hbf', to: 'Ahrweiler', mode: 'RE Ahr-Eifel-Bahn (über Euskirchen)', min: 75, note: 'NRW-Teil → 24hTicket NRW' },
        { from: 'Ahrweiler', to: 'Lahnstein', mode: 'RE Ahr-Eifel-Bahn (über Neuwied, durchgehend)', min: 70, note: 'RP-Teil → Rheinland-Pfalz-Ticket (werktags ab 9 Uhr!)' },
        { from: 'Lahnstein', to: 'Assmannshausen', mode: 'RB 10 Rheingau-Bahn (rechtsrheinisch)', min: 75, note: 'Hessen-Teil → RMV (der „kleine Teil in Hessen“)' }
      ],
      conns: [15, 0, 15]
    },
    E: {
      label: 'über Bingen mit der Rheinfähre',
      legs: [
        { from: 'Köln Hbf', to: 'Bingen (Rhein)', mode: 'ICE (Fernverkehr)', min: 145 },
        { from: 'Bingen', to: 'Rüdesheim', mode: 'Rheinfähre (Personenfähre)', min: 6, note: 'ca. 6 min, 2,90 €' },
        { from: 'Rüdesheim', to: 'Assmannshausen', mode: 'Nahverkehr (RMV) / Rad / Schiff', min: 7 }
      ],
      conns: [15, 10, 10]
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
