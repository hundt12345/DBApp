# DBApp 🚆

**Die günstigste ÖPNV-Verbindung von A nach B.** Perspektivisch iOS/Android,
als Start eine Homepage (Web-App) mit einem Preis-Engine-API dahinter.

## Teststrecke (v1)

Feste Verbindung: **Köln Geldernstraße/Parkgürtel (S 6/S 11) → Assmannshausen (Rüdesheim, Hesse / RMV)**

Filter:

- **Datum** (Wochentag relevant: Rheinland-Pfalz-Ticket werktags erst ab 9:00)
- **Zeitfenster / Flexibilität** (morgens / mittags / nachmittags / beliebig)
- **Reisende** (max. 5): Alter (Tarifkategorie), eigene BC25 / neue BC25, Klapprad, Deutschlandticket, eigenes Kind
- **VRS-Abonnement** vorhanden (Köln-Anteil gratis)
- **SuperSparpreis-Szenario** (ab-Preis / +10 € / +25 € / ausverkauft) – weil Fernpreise dynamisch sind
- **Letzter Teil** (automatisch günstigste pro Person oder Fahrgastschiff KD)

## Modellierte Optionen („die Tricks“)

1. **SuperSparpreis direkt** (Köln→Rüdesheim, ICE) + Nahverkehr zum Schluss – inkl.
   „längere Strecke, gleich teuer“-Hinweis (SS nach Mainz/Mannheim, in Rüdesheim aussteigen)
2. **SuperSparpreis → Bingen + Rheinfähre** (2,90 €, 6 min) – hessisches Pocket umfahren
3. **SuperSparpreis → Koblenz + Rheinland-Pfalz-Ticket** (linksrheinisch, RP-Ticket bis Lorch + RMV-Teil)
4. **SuperSparpreis → Koblenz + rechtsrheinisch** (Lahn + Rheingau-Bahn, „keine Bindung“)
5. **3-Verbund-Variante ohne Fernverkehr**: 24hTicket NRW (Köln→Ahrweiler) + RP-Ticket (→Lahnstein) + RMV („kleiner Teil in Hessen“)
6. **SuperSparpreis + Deutschlandticket** (wenn alle ein DtT haben – alles weitere gratis)
7. **DB-Tarif: Flexpreis direkt** (Referenz/teuerste Variante)

Zu jeder Option: Gesamtpreis, Preis pro Kopf, Fahrzeit, Schritt-für-Schritt-Timeline,
Preisaufschlüsselung pro Ticket und Anmerkungen (Gültigkeit, 9-Uhr-Regel, Kinderregeln, Rad …).

## Start

```bash
npm start          # → http://localhost:8080
npm test           # Smoke-Tests der Engine (node --test)
```

Keine Abhängigkeiten (Node ≥ 18, zero dependencies).

## API

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/quote` | POST | `{ date, window, vrsAbo, ssScenario, lastLeg, people:[{age,bc25,bike,dtt,ownChild}] }` → `{ meta, options[] }` (sortiert, günstigste zuerst) |
| `/api/data` | GET | Tarifdaten, Routenmodell, Annahmen/Quellen (für UI & spätere Native-Apps) |

Die Engine (`src/engine.js`) ist UI-unabhängig und direkt nutzbar –
die spätere iOS/Android-App ruft dieselbe API auf (deshalb CORS enabled).

## Struktur

```
server.js           Zero-Dependency-HTTP-Server (statisch + API)
src/fares.js        Tarifdaten 2026 (mit Quellen)
src/route.js        Routen-/Itinerar-Modell (Fixe Teststrecke)
src/engine.js       Preisberechnung aller Optionen
public/             Web-UI (vanilla JS, kein Framework)
docs/TARIFE-2026.md Alle Preise, Regeln & Quellen im Detail
test/               Engine-Smoke-Tests
```

## Stand & Ehrlichkeit der Zahlen

- Tarifstand: **Oktober 2026** (Quellen in `docs/TARIFE-2026.md`).
- **SuperSparpreis/Flexpreis sind dynamisch** – im UI wird ein Szenario gewählt
  (ab-Preis 17,99 €, +10 €, +25 €, ausverkauft). Vor der Buchung: bahn.de.
- Markierte **Modellwerte**: Flexpreis Köln→Rüdesheim (~70 €), RMV-Wabenanzahl
  je Abschnitt, Fahrtzeiten (typische Fahrpläne, kein Live-Daten).
- 9-Uhr-Regel, Vorlaufzeit (SS ≥ 14 Tage), Kinderregeln und die
  Hessen-Pocket-Logik (RP-Ticket endet in Lorch/Lahnstein) sind modelliert.

## Roadmap

- [x] Teststrecke mit Preismodell + Web-UI
- [ ] Live-Sparpreise anbinden (DB-API/Scraping – zu klären)
- [ ] Beliebige A→B (Routen-Builder, Verbund-Abgrenzung automatisieren)
- [ ] Rückfahrt + Tageskalkulation (mehrere Abschnitte pro Tag)
- [ ] iOS/Android (selbe `/api/quote`-Kontrakte; Engine serverseitig)
