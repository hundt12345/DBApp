# Live-Daten (DB) – Architektur, Quellen, Grenzen

## Was ist live, was ist Modell?

| Datenpunkt | Quelle (live) | Fallback (Modell) |
|---|---|---|
| Sparpreis-/SuperSparpreis-Angebote (Preis p.P., Tarifname, Zugbindung) | DB-Preissuche `ps.bahn.de` (unoffizielles DB-Endpoint, 24-h-Fenster ab gewählter Zeit = „Günstigster Tarif des Tages“) | `src/fares.js` (SS ab 17,90 € / SP ab 21,90 €, Szenario +10/+25/ausverkauft) |
| Konkreter Fernzug (Name, Ab-/Ankunft, Fahrzeit) + weitere Angebote | Gleiche Preissuche (Verbindungen inkl. `tn` = Zugname) | Modell-Itinerare `src/route.js` (ICE ~105 min etc.) |
| Nahverkehrs-Verbindungen (Reststück live, NV-Alternative ohne Fernzug) | DB Navigator API `api.bahn.de` (`/api/v1/connections`, `mode=1` = Regionalzüge) – nur mit API-Key | Modell-Fahrzeiten + Puffer |
| Verbund-/Köln-/Schiffspreise | – (nicht über DB-API) | `src/fares.js` (2026-Quellen in `TARIFE-2026.md`) |

Regel: **pro Abschnitt** wird live verwendet, wenn die Quelle `status: ok` liefert; sonst
fällt das Einzelsegment auf Modell zurück (`meta.live.status = live | partial | error`,
pro Segment in `meta.live.ss/nv`).

## Live-Segmente (in `src/route.js → liveSegments`)

**Fernverkehr (DB-Preissuche, je Segment 1 Call, Abfahrt Köln Hbf 8000207):**

| Segment | Von → Bis (Station-ID) | Option(en) |
|---|---|---|
| `koblenz` | Köln Hbf → Koblenz Hbf (8000206) | A (Ausstieg), D |
| `mainz` | Köln Hbf → Mainz Hbf (8000240) | A (Buchungsziel), B |
| `frankfurt` | Köln Hbf → Frankfurt (Main) Hbf (8098105) | C |

**Nahverkehr (DB Navigator API, je Segment 1 Call):**

| Segment | Von → Bis (Station-ID) | Option(en) |
|---|---|---|
| `nv_koblenz_assmannshausen` | Koblenz (8000206) → Assmannshausen (8000635) | A, D |
| `nv_mainz_assmannshausen` | Mainz (8000240) → Assmannshausen (8000635) | B |
| `nv_frankfurt_assmannshausen` | Frankfurt (8098105) → Assmannshausen (8000635) | C |
| `nv_koln_ruedesheim` | Köln Hbf (8000207) → Rüdesheim (Rhein) (8005213) | G (Stück 1) |
| `nv_ruedesheim_assmannshausen` | Rüdesheim (8005213) → Assmannshausen (8000635) | G (Stück 2) |
| `nv_koln_assmannshausen_all` | Köln Hbf (8000207) → Assmannshausen (8000635) | E, F + **Zugbindung-Transparenz** (NV-Alternative für A–D) |

Wichtig: Es gibt **kein** Preissuche-Segment „Köln→Rüdesheim“ – dort fährt kein Fernverkehr
(→ `docs/TARIFE-2026.md`, Kern-Erkenntnis).

## Endpunkte

### 1) DB-Preissuche (Sparpreise + Fernzüge) – ohne Key
```
GET https://ps.bahn.de/preissuche/preissuche/psc_service.go
  ?lang=de&service=pscangebotsuche
  &data={"s":"8000207","d":"8000240","dt":"24.10.26","t":"11:00","c":2,
         "ohneICE":false,"tct":0,"dur":1440,
         "travellers":[{"bc":0,"typ":"E","alter":30}],
         "sv":true,"v":"16040000","dir":"1","bic":false,"device":"HANDY","os":"iOS_9.3.1"}
```
(d = 8000240 Mainz / 8000206 Koblenz / 8098105 Frankfurt je Segment)

Antwort (vereinfacht):
```json
{
  "peTexte":      { "n1": { "name": "SuperSparpreis", "hinweis": "nur gültig am 24.10." } },
  "angebote":     { "o1": { "tt": "SP", "p": "24,90", "sids": ["j1"], "zb": "Y", "pky": "n1" } },
  "verbindungen": { "j1": { "sid": "j1", "trains": [
      { "s": "8000207", "sn": "Köln Hbf", "dep": "11:02", "d": "8000240",
        "dn": "Mainz Hbf", "arr": "13:17", "tn": "ICE 318", "eg": "ICE" } ] } }
}
```
- `angebote[].p` = Preis pro Erwachsenem (1. Reisender), `zb` = Zugbindung, `sids` verweist auf `verbindungen`.
- Zeitfelder können je API-Version String (`HH:mm`), Minuten-seit-Mitternacht oder Objekte
  sein → der Parser in `public/js/live.js` (`parsePreissuche`, `toMinutes`) ist bewusst tolerant.
- **Kontrakt-Nachweis:** Open-Source-Client [`juliuste/db-prices`](https://github.com/juliuste/db-prices)
  (npm, 2022) benutzt exakt dieses Endpoint; auch [`tpt-research/DB-SparpreisProxy`](https://github.com/tpt-research/DB-SparpreisProxy).
- **Grenzen:** unoffiziell (keine SLA/ToS-Garantie), Client-String `v`/`os` könnten
  irgendwann relevant werden, CORS *kann* in manchen Browsern blockiert sein → dann
  DB-API-Key oder Modell-Modus. Für Produktion: bei der DB um Erlaubnis fragen.

### 2) DB Navigator API (offiziell, für Nahverkehrs-Verbindungen) – Key nötig
- Registrieren: https://api.bahn.de (kostenlos, Client-ID + Client-Secret).
```
POST https://api.bahn.de/api/oauth2/token      grant_type=client_credentials
GET  https://api.bahn.de/api/v1/connections
  ?originId=8000206&destId=8000635
  &searchDateTime=2026-10-24T11:00:00&searchDuration=1440
  &maxJourneys=3&mode=1                        # mode 1 = nur Regionalverkehr
Header: Authorization: Bearer <access_token>
```
Antwortformat `results[].itineraries[]` (`departure/arrival.dateTime`, `legs[].line.name`)
– defensive geparst in `parseConnections` (Deutschland/Europe-Berlin-Zeiten, mehrere
Zeit-Formate).

## Station-IDs (DB-HDS, verifiziert)

| Station | ID | Herkunft |
|---|---|---|
| Köln Geldernstr./Parkgürtel | 8003360 | Station-Datenbestand `db-stations` (npm `find-db-station-by-name`) |
| Köln Hbf | 8000207 | dito |
| Rüdesheim (Rhein) | 8005213 | dito |
| Koblenz Hbf | 8000206 | dito |
| Bingen (Rhein) Hbf | 8000039 | dito |
| Assmannshausen | 8000635 | dito |
| Ahrweiler | 8000448 | dito |
| Neuwied | 8000276 | dito |
| Euskirchen | 8000100 | dito |
| **Mainz Hbf** | 8000240 | dito |
| **Frankfurt (Main) Hbf** | 8098105 | dito |
| Lahnstein | 8000277 | **abgeleitet** (ID-Lücke zwischen Neuwied 8000276 und Niederlahnstein 8000278) |

## Datenfluss

```
Browser (live.js)                 Server (engine.js)
┌──────────────────────────┐      ┌──────────────────────────────┐
│ collectLive(params)      │      │ computeQuote({...params,     │
│  3× ps.bahn.de (SS):     │ HTTP │  live: {ss, nv, status})     │
│  koblenz/mainz/frankfurt │─────▶│  pro Segment: live || Modell │
│  6× api.bahn.de (NV):    │      │  liveInfo: Fernzug, nvLeg,   │
│  Koblenz/Mainz/Frankfurt │      │  nvAlt (Zugbindung-Δ)        │
│  →Assmannshausen,        │      └──────────────────────────────┘
│  Köln→Rüdesheim→Assm.,   │
│  Köln→Assmannshausen     │
│  Cache 10 min, Timeout   │
│  10 s je Call            │
└──────────────────────────┘
```
Der Server selbst ruft **keine** externen Dienste auf (keine Key-Pflicht serverseitig,
kein CORS-Problem für die App selbst) – die Browser-Side ruft die DB direkt an.
Später (iOS/Android, eigener Hosting) derselbe Adapter serverseitig lauffähig
(reines `fetch`, keine Browser-APIs außer `Intl`/`URLSearchParams`).

## UI-Bezug (Transparenz-Zusage)

- **Fernzug-Box:** Zugname, Abfahrt/Ankunft, Fahrzeit, Tarifart, Zugbindung ja/nein,
  Stand-Uhrzeit, weitere günstige Fernzug-Alternativen (2 weitere Angebote der Preissuche).
- **NV-Box (letzter Teil):** konkrete Züge des live ermittelten Nahverkehrsabschnitts –
  „hier gilt keine Zugbindung“.
- **Zugbindung-Transparenz-Box:** beste reine-Nahverkehr-Verbindung (ohne Fernzug) mit
  konkreter Summenfahrzeit und **Δ in Minuten** gegenüber der Option.
- **Preisblatt-Links:** jede Preiszeile verlinkt auf die Preistabelle des Anbieters
  (DB, Länder-Tickets, RMV, Köln, KD, DtT – URLs in `src/fares.js → links`).
- **Buchung:** „Auf bahn.de buchen/live prüfen“ (Such-Deep-Link mit Datum) – Checkout bleibt bei der DB.

## Testen ohne echten DB-Zugriff

`test/smoke.test.js` (15 Tests) enthält Mock-Live-Daten (Segment ok / Segment error →
Fallback) und Parser-Tests (`parsePreissuche`, `parseConnections`) – der gesamte
Live-Pfad ist auch offline abgedeckt.
