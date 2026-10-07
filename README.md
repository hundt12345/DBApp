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
- **Fernverkehrsticket-Typ** (SuperSparpreis ab 17,90 € **ohne** City-Ticket / Sparpreis ab 21,90 € **mit** City-Ticket >100 km)
- **Verfügbarkeits-Szenario** (ab-Preis / +10 € / +25 € / ausverkauft) – weil Fernpreise dynamisch sind
- **Letzter Teil** (automatisch günstigste pro Person oder Fahrgastschiff KD)

**Wichtiges Modell-Faktum (verifiziert):** Auf der rechten Rheinstrecke nach
Rüdesheim/Assmannshausen fährt **kein Fernverkehr** (nur RE 97 „Rheintalbahn“ &
RB 10) – es gibt also keinen Sparpreis „direkt“. Der Fernverkehr läuft linksrheinisch
(Köln–Bonn–Koblenz–Mainz) und über die Neubaustrecke nach Frankfurt. Außerdem ist die
rechte Rheinstrecke **10.07.–11.12.2026 vollgesperrt (Bau, Bus-Ersatz)** – der
entsprechende Status wird im UI markiert. Details: [`docs/TARIFE-2026.md`](docs/TARIFE-2026.md).

## Modellierte Optionen („die Tricks“)

1. **Sparpreis/SS nach Mainz, Ausstieg Koblenz** (linksrheinischer ICE, Ticket >100 km
   buchen) + Rheinland-Pfalz-Ticket (bis Lorch) + RMV
2. **Sparpreis/SS nach Mainz, durch bis Assmannshausen** (ZMB-Streckchen + RMV, kein RP-Ticket)
3. **Sparpreis/SS nach Frankfurt (SFS) + RE 21 über Wiesbaden nach Rüdesheim** –
   „längere, aber oft günstigere“ Umweg
4. **Flexpreis nach Koblenz** (freie Zugwahl, Referenz/teuerste Variante)
5. **3-Verbund linksrheinisch ohne Fernverkehr**: 24hTicket NRW (inkl. erster Teil!) +
   RP-Ticket (ab Unkel, erst. RP-Halt) + RMV
6. **Deutschlandticket-Option** (wenn alle Reisenden ein DtT haben: 0 € zusätzlich, linksrheinisch)
7. **RE „Rheintalbahn“ direkt rechtsrheinisch** nach Rüdesheim + RMV (in der Bauzeit: Bus)

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
| `/api/quote` | POST | `{ date, window, vrsAbo, ticketType: 'ss'|'sp', ssScenario, lastLeg, people:[{age,bc25,bike,dtt,ownChild}], live? }` → `{ meta, options[] }` (sortiert, günstigste zuerst). `live` (optional) = Ergebnis des Browser-Live-Layers `{ status, asOf, ss:{seg}, nv:{seg} }` – wird pro Abschnitt gegen das Modell aufgelöst |
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
- **SuperSparpreis/Sparpreis/Flexpreis sind dynamisch** – im UI werden Ticket-Typ
  (SS ohne City-Ticket / SP mit City-Ticket) und Szenario gewählt
  (ab-Preise SS 17,99 € / SP 21,99 €, +10 €, +25 €, ausverkauft). Vor der Buchung: bahn.de.
  Für kurze Vorlaufszeiten gelten die ab-Preise i. d. R. nicht mehr – der Live-Modus
  holt die echten Angebote (und meldet „kein Angebot“ ehrlich statt zu raten).
- **City-Ticket-Logik:** beim Sparpreis/Flexpreis (>100 km) ist der erste Teil
  Parkgürtel→Köln Hbf **enthalten**; beim SuperSparpreis gilt Köln-Kurzstrecke 2,90 €;
  beim 3-Verbund/NRW-Ticket & DtT ist der erste Teil enthalten (nie Doppelabrechnung).
- **Live-Modus** ersetzt ab-/Sparpreis, Fernzug-Termine und (mit DB-API-Key)
  Nahverkehrs-Verbindungen durch echte DB-Daten – mit Fallback je Abschnitt.
  Ohne Live-Modus gelten die markierten **Modellwerte**: Flexpreis
  Köln→Koblenz (60 €), RMV-Wabenanzahl je Abschnitt, Fahrtzeiten
  (typische Fahrpläne). Der Zug ist dann **nicht** verbindlich benannt.
- 9-Uhr-Regel, Kinderregeln, die Hessen-Pocket-Logik (RP-Ticket endet in
  Lorch/Lahnstein) und die **Vollsperrung der rechten Rheinstrecke (Bau 2026)**
  sind modelliert. Es gibt **keine harte Vorlaufzeit** – Sparpreise sind für alle
  Daten buchbar; bei kurzem Vorlauf wird im UI gewarnt, dass der ab-Preis
  real oft nicht mehr verfügbar ist.

## Roadmap

- [x] Teststrecke mit Preismodell + Web-UI
- [x] Live-Sparpreise + konkrete Züge anbinden (DB-Preissuche, DB Navigator API)
- [ ] Beliebige A→B (Routen-Builder, Verbund-Abgrenzung automatisieren)
- [ ] Rückfahrt + Tageskalkulation (mehrere Abschnitte pro Tag)
- [ ] iOS/Android (selbe `/api/quote`-Kontrakte; Engine serverseitig)
