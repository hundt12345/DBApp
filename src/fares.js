// fares.js – Tarifdaten 2026 (Stand: Oktober 2026) mit Quellen.
// Nur einfache Beträge + Regeln. Details/Quellen: docs/TARIFE-2026.md + docs/LIVE-DATEN.md

export const F = {
  // ---------- DB-Fernverkehr ----------
  // KLASSEN-ERKENNTNIS (verifiziert): Auf der rechten Rheinstrecke (Köln–Koblenz–
  // Bingen–Rüdesheim–Assmannshausen) fährt KEIN Fernverkehr – nur Regionalzüge
  // (RE 97 „Rheintalbahn“, u. a.). Fernverkehr (ICE/IC) läuft linksrheinisch
  // (Köln–Bonn–Koblenz–Mainz) und über die Neubaustrecke (Köln–Frankfurt Hbf).
  // → Sparpreise nur buchbar auf: Köln→Koblenz (links), Köln→Mainz (links), Köln→Frankfurt (SFS).
  ss: {
    ab: 17.99, // SuperSparpreis ab-Preis 2. Kl. (offiziell 2026: ab 17,99 €; Quelle bahn.de/dbfahrplanauskunft)
    minLeadDays: 14, // NUR Referenzwert für Hinweis: unter ~14 Tagen Vorlauf ab-Preis i. d. R. erschwert (kein harter Cut – Sparpreise sind für alle Daten buchbar)
    bcDiscount: 0.25,
    kidsFree: 'Kinder bis 14: mitreise frei, wenn Alter bei Buchung angegeben (max. 4 je Ticket, Begleitperson 15+).',
    note: 'SuperSparpreis: streng an den gebuchten Zug gebunden (Zugbindung), nicht stornierbar, KEIN City-Ticket. Für ALLE Reisedaten buchbar – bei kurzem Vorlauf sind die ab-Preise aber oft nicht verfügbar (Preis steigt). Live-Modus zeigt den echten Buchungsstatus.'
  },
  sp: {
    ab: 21.99, // regulärer Sparpreis ab-Preis 2. Kl. (offiziell 2026: ab 21,99 €; Quelle bahn.de/dbfahrplanauskunft)
    bcDiscount: 0.25,
    kidsFree: 'Kinder bis 14: mitreise frei, wenn Alter bei Buchung angegeben (max. 4 je Ticket, Begleitperson 15+).',
    note: 'Sparpreis: an den gebuchten Zug gebunden (Zugbindung), Storno gegen Gebühr. Ab 100 km Reiseweite (Start/Ziel in teilnehmender Stadt) ist das CITY-TICKET inklusive → An-/Abfahrt mit Nahverkehr am Tag der Fahrt kostenlos (Köln nimmt teil).'
  },
  cityTicket: {
    minKm: 100, // gilt ab 100 km Reiseweite
    includedIn: ['sp', 'flex'], // nicht im SuperSparpreis
    city: 'Köln (teilnehmende Stadt)',
    note: 'DB City-Ticket: einmalige Fahrt (wie Einzelfahrschein) am Geltungstag mit S-Bahn/Bahn/Bus/Tram im Verbundgebiet – z. B. Parkgürtel→Köln Hbf gratis. Im Sparpreis/Flexpreis automatisch dabei (>100 km), im SuperSparpreis NICHT.'
  },
  flex: {
    koelnAssmannshausen: 44.1, // BEOBACHTET: bahn.de 08.10.2026, Tagesslot „Unsere Bestpreise“ (günstigste Verbindung Parkgürtel→Assmannshausen); Flexpreis in dieser Größenordnung – vor Buchung prüfen
    bcDiscount: 0.25,
    kidFactor: 0.5,
    note: 'Flexpreis Parkgürtel→Assmannshausen: ganze gebuchte Verbindung im Ticket (wie Sparpreis). Modellwert 44,10 € = bahn.de-Beobachtung 08.10.2026 (Tagesslot); freie Zugwahl, stornierbar.'
  },
  bc25: {
    price: { y: 39.9, a: 62.9, s: 40.9 }, // My-BahnCard (<27) / 27–64 / Senioren (65+), Jahreskarte
    note: 'BahnCard 25: 25 % auf DB-Fernverkehr (Sparpreis/SuperSparpreis/Flexpreis). KEIN Rabatt auf Länder-/Verbundtickets; RMV-BahnCard-Rabatt entfällt seit 1.1.2026.'
  },

  // ---------- 9-Uhr-Regel & Länder-Tickets ----------
  rp: {
    base: 30.0,
    extra: 10.0,
    max: 5,
    kidsFreeAge: 14,
    weekdayFromMin: 9 * 60, // Mo–Fr erst ab 9:00 Uhr
    note: 'Rheinland-Pfalz-Ticket: 30 € + 10 €/Person (max. 5), Kinder <14 frei. Mo–Fr ab 9:00 Uhr. Nur Nahverkehr in RP – gilt ab JEDEM rp-Startbahnhof (auch mitten in der Strecke, z. B. Unkel/Neuwied), aber nicht in Köln (NRW) und nicht in Hessen.'
  },
  nrw: {
    single: 39.8,
    group: 59.8, // bis 5 Personen
    kidsFreeAge: 6,
    note: '24hTicket NRW: 39,80 € Single / 59,80 € bis 5 Pers. (2026), 24 h ab Entwertung, keine 9-Uhr-Regel. Gilt auf ALLEN Nahverkehrsmitteln in NRW – inkl. S-Bahn Parkgürtel→Köln Hbf (also: erster Teil NICHT extra berechnen!).'
  },
  dtt: {
    monthly: 66.8,
    note: 'Deutschlandticket (66,80 €/Monat, 2026): Nahverkehr bundesweit (inkl. RE/RB in RP + RMV in Hessen), kein Fernverkehr. Fahrrad: Klapprad frei, Großrad je nach Verkehrsverbund.'
  },

  // ---------- Nahverkehr (Hessen / Rhein-Main / Rhein-Mosel) ----------
  rmv: {
    adultStrip: 3.9, // Einzelfahrschein ab 1.1.2026 je Wabe
    childStrip: 2.2, // Kind 6–14
    note: 'RMV: Einzelfahrschein ab 1.1.2026: 3,90 € (Kind 6–14: 2,20 €) je Wabe. Wabenanzahl je Abschnitt ist modelliert – vor Fahrt im RMV-App/Fahrplan prüfen.'
  },
  vgnRmv: {
    adult: 7.8, // Modellwert: VGN (Frankfurt) + RMV (Mainz→Rüdesheim) Kombi, RE 21
    child: 4.4,
    note: 'RE 21 Frankfurt→Rüdesheim quert VGN + RMV → Cross-Verbund-Ticket. Modellwert 7,80 €/4,40 € – exakt bei RMV/VGN oder in der DB-Reiseauskunft prüfen.'
  },
  zmb: {
    adult: 3.8, // Modellwert: ZMB-Einzel (Verkehrsverbund Rhein-Mosel), Mainz-Hbf-Abschnitt
    child: 1.9,
    note: 'ZMB (Rhein-Mosel): kurzere Strecke im Mainzer Stadtgebiet (RE Mainz→Hessen-Grenze). Modellwert Einzelfahrkarte 3,80 €/Kind 1,90 € – prüfen.'
  },

  // ---------- Köln (Rheinland-Tarif VRS+AVV, ab 1.6.2026) ----------
  koeln: {
    einzelfahrt: 4.0,
    kurzstrecke: 2.9, // Parkgürtel→Hbf = 2 Halte → Kurzstrecke gültig
    kurzstreckeKind: 1.45,
    day24: 9.6,
    eezyBase: 1.66,
    eezyKm: 0.27,
    note: 'Köln (Rheinland-Tarif): Kurzstrecke 2,90 € (Kind 1,45 €) = günstigster Stadt-Ticketweg Parkgürtel→Hbf (2 Halte). Einzelfahrt 4,00 €, 24 h Köln 9,60 €. eezy.nrw: 1,66 € + 0,27 €/Luft-km (~6 km ≈ 3,28 €) – teurer, daher nur alternativ. Mit VRS-Abonnement: 0 €.'
  },

  // ---------- Schifffahrt (2026) ----------
  faehre: {
    adult: 2.9,
    child: 1.45,
    bike: 2.7,
    minutes: 6,
    note: 'Rheinfähre Bingen↔Rüdesheim (Personenfähre, ~6 min): 2,90 € (Kind 6–14: 1,45 €, Rad 2,70 €). Kein Nahverkehr → keine Verbundtickets. (Für die Strecke nur interessant, wenn man nach Bingen gelangt – es gibt KEINEN Fernverkehr nach Bingen.)'
  },
  kd: {
    adult: 12.5,
    minutes: 45,
    note: 'Fahrgastschiff (Rössler-Linie) Rüdesheim→Assmannshausen KD, ca. 45 min, 12,50 € (2026), Kinderrabatt 50 % modelliert – prüfen. Alternative zum 5-min-Zug; kein Nahverkehr (kein DtT/Verbundticket).'
  },

  // ---------- Betriebslage ----------
  bau: {
    from: '2026-07-10',
    until: '2026-12-11',
    note: 'BAUEN: Die rechte Rheinstrecke (Wiesbaden–Rüdesheim–Koblenz) ist vom 10.07. bis 11.12.2026 VOLLGESPELLT (RMV-Fahrplan 2026); RB10 & Co. durch Busse ersetzt → Abschnitte rechts des Rheins (auch Eltville/Rüdesheim/Assmannshausen!) deutlich länger. Tickets bleiben dieselben (RMV).'
  },

  // ---------- Links: Preistabellen der Anbieter & Buchung ----------
  links: {
    supersparpreis: 'https://www.bahn.de/angebot/sparpreis-flexpreis/super-sparpreis',
    sparpreis: 'https://www.bahn.de/angebot/sparpreis-flexpreis',
    flexpreis: 'https://www.bahn.de/angebot/sparpreis-flexpreis',
    bahncard: 'https://www.bahn.de/angebot/bahncard/vergleich',
    laenderticket: 'https://www.bahn.de/laender-ticket',
    rmv: 'https://www.rmv.de',
    koeln: 'https://www.kvb.koeln/rheinlandtarif',
    faehre: 'https://www.bingen-ruedesheimer.de/fahrpreise/',
    kd: 'https://roesslerlinie.de/schifffahrt/planmaessige-fahrten/',
    dtt: 'https://www.deutschlandticket.de',
    cityticket: 'https://www.bahn.de'
  },
  bookBaseUrl: 'https://www.bahn.de/web/foe/suchen'
};
