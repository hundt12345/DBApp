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

## Live-Daten (DB)

Die UI holt optional **echte DB-Daten** (aktivierbar im Kasten „Live-Daten“):

- **Sparpreis-Angebote + konkreter Fernzug** (Zugname, Abfahrt/Ankunft, Zugbindung):
  direkt aus der DB-Preissuche (`ps.bahn.de`, 24-h-Fenster ab gewählter Zeit –
  „Günstigster Tarif des Tages“). **Kein Key nötig.** Endpoint unoffiziell –
  Details & Grenzen: [`docs/LIVE-DATEN.md`](docs/LIVE-DATEN.md).
- **Nahverkehrs-Verbindungen** (letzter Teil live + „Ohne Fernzug“-Vergleich):
  offizielle **DB Navigator API** (`api.bahn.de`, kostenlos zu registrieren).
  Key (Client-ID : Client-Secret) oben in die UI eintragen – wird nur lokal
  im Browser gespeichert.
- Ist eine Quelle nicht erreichbar, fällt **jeder Abschnitt einzeln** auf die
  Modellwerte zurück (`meta.live.status`: `live`/`partial`/`error`).
- Jede Preiszeile verlinkt das **Preisblatt des Anbieters**; pro Option gibt
  es einen „Auf bahn.de buchen/live prüfen“-Link.

## API

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/quote` | POST | `{ date, window, vrsAbo, ssScenario, lastLeg, people:[{age,bc25,bike,dtt,ownChild}], live? }` → `{ meta, options[] }` (sortiert, günstigste zuerst). `live` (optional) = Ergebnis des Browser-Live-Layers `{ status, asOf, ss:{seg}, nv:{seg} }` – wird pro Abschnitt gegen das Modell aufgelöst |
| `/api/data` | GET | Tarifdaten (inkl. Anbieter-Links), Routenmodell (inkl. Station-IDs & Live-Segmente), Annahmen/Quellen (für UI & spätere Native-Apps) |

Die Engine (`src/engine.js`) ist UI-unabhängig und direkt nutzbar –
die spätere iOS/Android-App ruft dieselbe API auf (deshalb CORS enabled).
Der Live-Adapter (`public/js/live.js`) ist framework-freies `fetch`-JS und
kann später serverseitig (Node) bzw. nativ wiederverwendet werden.

## Struktur

```
server.js           Zero-Dependency-HTTP-Server (statisch + API)
src/fares.js        Tarifdaten 2026 (mit Quellen + Anbieter-Preisblatt-Links)
src/route.js        Routen-/Itinerar-Modell (inkl. Station-IDs, Live-Segmente)
src/engine.js       Preisberechnung aller Optionen (Live || Modell pro Abschnitt)
public/js/live.js   Browser-Adapter: DB-Preissuche + DB Navigator API
public/             Web-UI (vanilla JS, kein Framework)
docs/TARIFE-2026.md Alle Preise, Regeln & Quellen im Detail
docs/LIVE-DATEN.md  Live-Architektur, Endpunkte, Station-IDs, Grenzen
test/               Engine- + Parser-Smoke-Tests
```

## Stand & Ehrlichkeit der Zahlen

- Tarifstand: **Oktober 2026** (Quellen in `docs/TARIFE-2026.md`).
- **SuperSparpreis/Flexpreis sind dynamisch** – im UI wird ein Szenario gewählt
  (ab-Preis 17,99 €, +10 €, +25 €, ausverkauft). Vor der Buchung: bahn.de.
- **Live-Modus** ersetzt ab-/Sparpreis, Fernzug-Termine und (mit DB-API-Key)
  Nahverkehrs-Verbindungen durch echte DB-Daten – mit Fallback je Abschnitt.
  Ohne Live-Modus gelten die markierten **Modellwerte**: Flexpreis
  Köln→Rüdesheim (~70 €), RMV-Wabenanzahl je Abschnitt, Fahrtzeiten
  (typische Fahrpläne). Der Zug ist dann **nicht** verbindlich benannt.
- 9-Uhr-Regel, Vorlaufzeit (SS ≥ 14 Tage), Kinderregeln und die
  Hessen-Pocket-Logik (RP-Ticket endet in Lorch/Lahnstein) sind modelliert.

## Roadmap

- [x] Teststrecke mit Preismodell + Web-UI
- [x] Live-Sparpreise + konkrete Züge anbinden (DB-Preissuche, DB Navigator API)
- [ ] Beliebige A→B (Routen-Builder, Verbund-Abgrenzung automatisieren)
- [ ] Rückfahrt + Tageskalkulation (mehrere Abschnitte pro Tag)
- [ ] iOS/Android (selbe `/api/quote`-Kontrakte; Engine serverseitig)
