// fares.js – Tarifdaten, Stand: Oktober 2026
// Alle Preise in EUR, 2. Klasse, einfache Fahrten.
// Quellen & Details: docs/TARIFE-2026.md
//
// Wichtig: Die DB-Fernverkehrspreise (SuperSparpreis/Flexpreis) sind dynamisch.
// Hier stehen "ab-"/Modellpreise. Der Reale Preis hängt von Nachfrage,
// Strecke und Buchungszeitpunkt ab (daher das SS-Szenario im Frontend).

export const F = {
  // ---------- DB Fernverkehr ----------
  ss: {
    ab: 17.99,                 // SuperSparpreis ab-Preis (Stand 2026; Jan/2026 noch 17,49 €)
    bcDiscount: 0.25,          // BahnCard 25: 25 % auf Spar-/SuperSparpreise (2026)
    minLeadDays: 14,           // MODELLANNAHME: nicht mehr buchbar < 14 Tage vor Abreise
    kidsFree: 'Kinder bis einschl. 14 Jahre fahren mit einem SS-Ticket kostenlos (bei Buchung angeben, max. 4 Kinder je Ticket, Begleitperson ab 15 J.); unter 6 immer frei',
    note: 'SuperSparpreis: nur Fernverkehr (ICE/IC/EC), Preis dynamisch (ab-Preis). Nicht kombinierbar mit weiteren Rabatten außer BahnCard.'
  },
  flex: {
    koelnRuedesheim: 70.00,    // MODELLWERT (Normalpreis Köln→Rüdesheim, 2. Kl.) – vor Buchung prüfen
    kidFactor: 0.5,            // Kinder 6–14: 50 %
    bcDiscount: 0.25,
    note: 'Flexpreis (DB-Tarif, Normalpreis) – Modellwert, bitte gegen bahn.de prüfen.'
  },
  bc25: {
    price: { y: 39.90, a: 62.90, s: 40.90 }, // My BahnCard 25 (<27), BahnCard 25 (27–64), Senioren-BC25 (65+)
    note: 'BahnCard 25 (Jahreskarte, 12 Monate, 25 % auf Flex-/Spar-/SuperSparpreis). Jugend-BahnCard 25 (6–18 J.) kostet nur 7,90 €/Jahr – wird hier nicht extra modelliert.'
  },
  dtt: {
    price: 66.80,
    note: 'Deutschlandticket 2026: 66,80 €/Monat – gilt in ganz Deutschland im Nahverkehr (RB/RE/S-Bahn/Bus/U-Bahn/Tram), NICHT im Fernverkehr.'
  },

  // ---------- Länder-/Gruppentickets ----------
  rp: {
    base: 30.00, extra: 10.00, max: 5,
    kidsFreeAge: 14,           // Kinder unter 14 reisen kostenlos (nicht mitgezählt)
    weekdayFromMin: 9 * 60,    // Mo–Fr ab 9:00 Uhr
    weekendFromMin: 0,         // Sa/So/Feiertag ab 0:00 Uhr
    note: 'Rheinland-Pfalz-Ticket 2026: 30 € (1. Person) + 10 € je weitere (max. 5), Kinder unterm 14 frei. Gültig Mo–Fr erst ab 9:00 Uhr, Sa/So ganztägig. Alle Züge des Nahverkehrs in RP (auch bis ins Saarland). Keine Zugbindung.'
  },
  nrw: {
    single: 39.80, group: 59.80, max: 5,
    note: '24hTicket NRW (früher NRW-Tarif/SchönerTagTicket), 2026: 39,80 € Single, 59,80 € für bis zu 5 Personen (11,96 €/P.), 24 h ab Entwertung OHNE 9-Uhr-Regel. Alle Nahverkehrsmittel in NRW (RE/RB/S/U-Bahn/Tram/Bus), 2. Klasse. Familienregel: 1 Erwachsener + beliebige eigene Kinder ≤14 + 1 weitere Person. Kinder unter 6 frei.'
  },

  // ---------- Nahverkehr Köln (Rheinland-Tarif VRS+AVV ab 1.6.2026) ----------
  koeln: {
    airKm: 6,                  // Luftlinie Parkgürtel → Köln Hbf (ca. 5,5 km, aufgerundet)
    eezyBase: 1.66,            // eezy.nrw Grundpreis (Rheinland-Tarif-Ausgabe)
    eezyKm: 0.27,              // eezy.nrw Arbeitspreis je angefangenem Luftlinien-km
    einzelfahrt1b: 4.00,       // Preisstufe 1b: Einzelfahrt im Kölner Stadtgebiet
    tageskarte: 9.60,          // 24h-Ticket Köln (ab 1.6.2026; davor 9,20 €)
    note: 'Rheinland-Tarif (VRS+AVV fusioniert, ab 1.6.2026): Einzelfahrt Köln 4,00 €, Kurzstrecke 2,90 €, 24h-Ticket Köln 9,60 €. eezy.nrw: 1,66 € + 0,27 €/Luftlinien-km (nie teurer als das Einzelticket der Stufe).'
  },

  // ---------- RMV (Hessen, Zielabschnitt) ----------
  rmv: {
    adultStrip: 3.90, childStrip: 2.20,
    note: 'RMV-Einzelfahrschein ab 1.1.2026: 3,90 € (Kind 6–14: 2,20 €) pro Wabe. Die Anzahl der Waben hängt von der Zonenkombination ab (Modellwerte pro Abschnitt, siehe route.js). BahnCard-Rabatt auf RMV-Einzelfahrten entfällt seit 1.1.2026.'
  },

  // ---------- Schifffahrt & Rad ----------
  faehre: {
    adult: 2.90, child: 1.45, bike: 2.70, minutes: 6,
    note: 'Rheinfähre Bingen↔Rüdesheim (Personenfähre mit Fahrgastschiffen, ca. 6 min Überfahrt), Preisstand 2026. Kinder 6–14: 1,45 €; Fahrrad: 2,70 €.'
  },
  kd: {
    adult: 12.50, minutes: 45,
    note: 'Fahrgastschiff (Rössler-Linie) Rüdesheim/Bingen → Assmannshausen KD, ca. 45 min, 12,50 € (2026). Kinderrabatt modelliert mit 50 % – bitte prüfen. Nicht Nahverkehr (kein DtT/Verbundticket).'
  }
};
