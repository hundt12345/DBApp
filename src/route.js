// route.js – Routen-Modell für die fixe Teststrecke
//
// KERN-ERKENNTNISSEN (verifiziert):
//  1) Auf der rechten Rheinstrecke fährt kein Fernverkehr (nur RE 97/RB 10) –
//     aber: Der (Super)Sparpreis ist DIREKT nach Assmannshausen buchbar und
//     deckt die gesamte gebuchte Verbindung ab: Nahverkehrsvorlauf (S 11) +
//     Fernverkehr + Nahverkehrsnachlauf (letzter Abschnitt, z. B. RE/RB/Bus).
//     Zugbindung gilt NUR für den Fernverkehrszug; Nahverkehrsabschnitte
//     Vorher/Nachher frei wählbar (bahn.de-FAQ). Reiseende bis 10 Uhr Folgetag.
//  2) Fernverkehr läuft linksrheinisch (Köln–Bonn–Koblenz–Mainz) und über die
//     Neubaustrecke (Köln–Frankfurt Hbf, SFS).
//  3) Bau 2026: rechte Rheinstrecke 10.07.–11.12.2026 vollgesperrt (Bus-Ersatz).

export const ROUTE = {
  origin: 'Köln Geldernstraße/Parkgürtel (S 6 / S 11)',
  originShort: 'Parkgürtel',
  destination: 'Assmannshausen (Rüdesheim am Rhein, Hessen / RMV)',
  hbf: 'Köln Hbf',
  departures: { any: '11:00', morning: '07:00', midday: '12:00', afternoon: '14:00' },
  firstLeg: { s11Min: 10, bikeMin: 25 },

  // DB-Station-IDs (db-stations-Datenbestand; Lahnstein abgeleitet)
  stations: {
    koelnPark: '8003360',
    koelnHbf: '8000207',
    koblenz: '8000206',
    mainz: '8000240',
    frankfurt: '8098105',
    bingen: '8000039',
    ruedesheim: '8005213',
    assmannshausen: '8000635',
    lorch: '8000448',
    neuwied: '8000276',
    lahnstein: '8000277',
    euskirchen: '8000100'
  },

  // Live-Segmente:
  //  ss.all  = DIE eigentliche Buchungsfrage: Parkgürtel → Assmannshausen,
  //            24-h-Fenster = „Günstigster Tarif des Tages“ (exakt wie die
  //            bahn.de-Bestpreise-Ansicht). Die Angebote enthalten die ganze
  //            gebuchte Verbindung (S 11 + Fernzug + Nachlauf).
  //  nv.*    = reine Nahverkehrsalternativen (DB-API): Zugbindung-Δ und
  //            Fahrzeiten der Verbund-Optionen.
  liveSegments: {
    ss: {
      all: { from: 'koelnPark', to: 'assmannshausen' }
    },
    nv: {
      nv_koln_assmannshausen_all: { from: 'koelnPark', to: 'assmannshausen' },
      nv_koln_ruedesheim: { from: 'koelnPark', to: 'ruedesheim' },
      nv_ruedesheim_assmannshausen: { from: 'ruedesheim', to: 'assmannshausen' }
    }
  },

  // Modell-Itinerare (Dauer je Verbindung, inkl. S 11 ab Parkgürtel)
  itins: {
    // A: Direkt-Buchung, linksrheinische Verbindung (ICE über Mainz, Nachlauf RE/RB)
    A: {
      legs: [
        { from: 'Parkgürtel', to: 'Köln Hbf', mode: 'S 11', min: 10, note: 'im Ticket enthalten (Nahverkehrsvorlauf, frei wählbar)' },
        { from: 'Köln Hbf', to: 'Mainz Hbf', mode: 'ICE (linksrheinisch)', min: 105, note: 'Zugbindung: dieser Fernzug' },
        { from: 'Mainz Hbf', to: 'Assmannshausen', mode: 'RE/RB (Nachlauf)', min: 45, note: 'im Ticket enthalten, frei wählbar (in Bauzeit: Bus)' }
      ],
      conns: [0, 20]
    },
    // C: Direkt-Buchung, Umweg über Frankfurt (SFS + RE 21)
    C: {
      legs: [
        { from: 'Parkgürtel', to: 'Köln Hbf', mode: 'S 11', min: 10, note: 'im Ticket enthalten (Nahverkehrsvorlauf, frei wählbar)' },
        { from: 'Köln Hbf', to: 'Frankfurt (Main) Hbf', mode: 'ICE (Neubaustrecke SFS)', min: 65, note: 'Zugbindung: dieser Fernzug' },
        { from: 'Frankfurt (Main) Hbf', to: 'Rüdesheim (Rhein)', mode: 'RE 21 (Rheingau)', min: 75, note: 'im Ticket enthalten, frei wählbar' },
        { from: 'Rüdesheim (Rhein)', to: 'Assmannshausen', mode: 'RB 10 / Bus (Bau)', min: 5, note: 'im Ticket enthalten, frei wählbar' }
      ],
      conns: [0, 15, 8]
    },
    // D: Flexpreis (wie A, freie Zugwahl)
    D: { legs: null, conns: null, base: 'A' },
    // E: 3-Verbund linksrheinisch, ganz ohne Fernverkehr
    E: {
      legs: [
        { from: 'Parkgürtel', to: 'Köln Hbf', mode: 'S 11', min: 10, note: 'im 24hTicket NRW enthalten' },
        { from: 'Köln Hbf', to: 'Bonn Hbf', mode: 'RE (linksrheinisch)', min: 85, note: '24hTicket NRW' },
        { from: 'Bonn Hbf', to: 'Lorch', mode: 'RE/RB (linksrheinisch)', min: 45, note: 'RP-Ticket ab Unkel (1. RP-Halt)' },
        { from: 'Lorch', to: 'Assmannshausen', mode: 'RB 10 / Bus (Bau)', min: 55, note: 'RMV (2 Waben)' }
      ],
      conns: [0, 20, 20]
    },
    // F: Deutschlandticket (Route wie E)
    F: { base: 'E' },
    // G: RE „Rheintalbahn“ direkt rechtsrheinisch (Bau: Bus)
    G: {
      legs: [
        { from: 'Parkgürtel', to: 'Köln Hbf', mode: 'S 11', min: 10, note: 'im 24hTicket NRW enthalten' },
        { from: 'Köln Hbf', to: 'Rüdesheim (Rhein)', mode: 'RE 97 / Bus (Bau!)', min: 140, note: '24h NRW + RP-Ticket ab 1. RP-Halt (Neuwied-Bereich)' },
        { from: 'Rüdesheim (Rhein)', to: 'Assmannshausen', mode: 'RB 10 / Bus (Bau)', min: 8, note: 'RMV (1 Wabe)' }
      ],
      conns: [0, 8]
    }
  },

  duration(id) {
    const itin = this.itins[id] || { legs: [], conns: [] };
    const legs = itin.base ? this.itins[itin.base].legs : itin.legs;
    const conns = itin.base ? this.itins[itin.base].conns : itin.conns;
    return legs.reduce((s, l, i) => s + l.min + (conns[i] || 0), 0);
  }
};
