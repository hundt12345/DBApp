# Tarifdaten & Quellen (Stand: Oktober 2026)

Alle im Modell verwendeten Preise, Regeln und ihre Quellen. Modellwerte sind als solche
gekennzeichnet – vor einer echten Buchung bitte verifizieren.

## ⚠️ KERN-REGEL: Ticket deckt die ganze gebuchte Verbindung ab (Stand 2026)

Der **(Super)Sparpreis (und Flexpreis) ist DIREKT nach Assmannshausen buchbar** – bahn.de
zeigt exakt diese Verbindungen und bucht die **gesamte Strecke ab Parkgürtel als EINES
Tickets** (Beobachtung 08.10.2026: 21,69 € für S 11 + ICE 921 + Bus 10X, 02:08→06:34).
Regel nach bahn.de-FAQ („Mit welchen Zügen kann ich mit dem (Super)Sparpreis reisen?“):

- Nur die **gebuchte Verbindung** (ICE, IC/EC) darf gefahren werden → **Zugbindung im Fernzug**.
- **Nahverkehr im Vor- und Nachlauf (RE, RB, IRE, S-Bahn, NE) darf frei gewählt werden,
  wenn er mitgebucht ist** → S 11 (Parkgürtel→Hbf) und der letzte Abschnitt (RE/RB/Bus)
  sind im Ticket enthalten, **keine Zugbindung** dort.
- Die Reise muss bis **10 Uhr des Folgetags** beendet sein.
- ⇒ Im Modell: **eine Ticketzeile pro Person**, keine Zusatz-RP-/RMV-Tickets,
  S 11/Kurzstrecke wird NICHT extra berechnet.

## KERN-ERKENNTNIS: Kein Fernverkehr nach Rüdesheim

Die rechte Rheinstrecke (Köln–Neuwied–Koblenz–Bingen–Rüdesheim–**Assmannshausen**) wird
**ausschließlich vom Regionalverkehr** bedient (RE 97 „Rheintalbahn“, RB 10 „Rheingau-Bahn“).
**Es gibt keinen ICE/IC nach Rüdesheim oder Bingen** – der Fernzug fährt also nicht bis
zum Ziel, sondern der **Nachlauf läuft im Nahverkehr** (den das Ticket abdeckt).

Der Fernverkehr (Sparpreis-Abschnitt) in dieser Region verläuft:

- **linksrheinisch**: Köln–Bonn–Montabaur–**Koblenz**–Mainz (mind. stündlich ICE, auch in der
  Bauzeit weiter, dann nur 1 ICE/rh → [ADAC](https://www.adac.de/reisen/reiseziele/),
  [SWR](https://www.swr.de/)),
- **Neubaustrecke (SFS)**: Köln–Frankfurt Hbf (~1 h 05).

Daher buchen die Sparpreis-Optionen **direkt nach Assmannshausen** – je nach Verbindung
mit Fernzug-Abschnitt über **Mainz** (linksrheinisch) oder über **Frankfurt**
(SFS + RE 21 nach Rüdesheim); die letzten Abschnitte (ab Mainz bzw. Rüdesheim)
sind Nahverkehr im Ticket.

**BAU 2026:** Rechte Rheinstrecke Wiesbaden–Rüdesheim–Koblenz
**10.07.–11.12.2026 vollgesperrt**, RB 10 durch Busse ersetzt → alle rechtsrheinischen
Abschnitte (inkl. nach Assmannshausen) deutlich länger.
→ [RMV-Fahrplan 2026 (Vollsperrung)](https://www.rmv.de/faehrdienste/fahrplaene-und-baustellen/),
Fahrplanbuch VRM (RE 97: „Rechte Rhein-Neuwied–Koblenz–Rüdesheim–Wiesbaden, Kursbuch 466“;
Rüdesheim→Assmannshausen 5 min).

## DB Fernverkehr (2026)

| Tarif | Preis | Regel | Quelle |
|---|---|---|---|
| **SuperSparpreis** (2. Kl.) | **ab 17,99 €** | Nur ICE/IC/EC; dynamischer Preis; **kein** Storno/Umtausch; **City-Ticket kostenpflichtig zubuchbar**; ganzer gebuchter Vor-/Nachlauf (Nahverkehr) im Ticket enthalten | [dbfahrplanauskunft (2026)](https://www.dbfahrplanauskunft.com/de/artikel/sparpreise-der-deutschen-bahn.html), [bahngebote.de (03/2026)](https://bahngebote.de/super-sparpreis-aktion/), [rbb24 (DB, 10/2024: Einstiegspreise stabil 17,99/21,99)](https://www.rbb24.de/wirtschaft/beitrag/2024/10/deutsche-bahn-fernverkehr-preiserhoehung-flexpreis-bahncard-100.html) |
| **Sparpreis** (2. Kl.) | **ab 21,99 €** | Zugbindung, Storno gegen 10 € Gebühr; **City-Ticket >100 km automatisch inklusive**; ganzer gebuchter Vor-/Nachlauf (Nahverkehr) im Ticket enthalten | dito |
| Kinder 6–14 | **frei** (Alter bei Buchung angeben, max. 4 je Ticket, Begleitung 15+) | unter 6 frei | [bahn.de SS-Gruppe](https://www.bahn.de/angebot/sparpreis-flexpreis/super-sparpreis-gruppe) |
| BahnCard 25 | 25 % auf SS/SP/Flex | kein Rabatt auf Verbund/Länder-Tickets | [bahn.de](https://www.bahn.de/angebot/bahncard/vergleich) |
| Vorlauf | **keine harte Grenze** – buchbar für alle Daten | Bei kurzem Vorlauf (<14 Tage) ist der **ab-Preis i. d. R. nicht** verfügbar (Preis steigt); Live-Modus zeigt den echten Status („kein Angebot“ wird ehrlich als nicht buchbar gemeldet) | [bahn.de](https://www.bahn.de/angebot/sparpreis-flexpreis/super-sparpreis-gruppe) |
| **Flexpreis Parkgürtel→Assmannshausen** (2. Kl.) | **44,10 € (BEOBACHTET 08.10.2026, Tagesslot bahn.de)** | Kind 6–14: 50 %; BC25: 25 %; freie Zugwahl; **City-Ticket automatisch inklusive** (>100 km) | – (Beobachtung bahn.de, Modellwert) |
| Zugbindung | **Gilt nur für den Fernverkehrszug** der gebuchten Verbindung | **Nahverkehr im Vor-/Nachlauf (RE, RB, S-Bahn, NE) darf frei gewählt werden, wenn mitgebucht**; Reiseende bis 10 Uhr Folgetag | [bahn.de FAQ](https://www.bahn.de/faq/zuege-sparpreis) |
| Nahverkehr im Ticket | S 11 (Parkgürtel→Hbf) und letzter Abschnitt sind Teil der gebuchten Verbindung → **im Ticket enthalten, 0 €** extra | keine Zusatz-RP-/RMV-Tickets bei den Fernverkehr-Optionen | [bahn.de FAQ](https://www.bahn.de/faq/zuege-sparpreis), Beobachtung bahn.de 08.10.2026 (21,69 € all-in) |

## City-Ticket (DB) – getrenntes Extra (verifiziert)

- **SuperSparpreis:** City-Ticket **kostenpflichtig zubuchbar** (keines automatisch).
- **Sparpreis & Flexpreis:** City-Ticket **automatisch inklusive**, wenn die
  **Fernverkehrsdistanz >100 km** beträgt und die Startstadt teilnimmt (Köln nimmt teil,
  ~126–130 Städte). Einmalige Fahrt am Geltungstag bis Betriebsschluss (wie Einzelfahrschein).
  → [bahn.de FAQ Sparpreis vs. Flexpreis](https://www.bahn.de/faq/was-ist-der-unterschied-zwischen-sparpreis-und-flexpreis)
- **HIER NICHT NÖTIG:** Bei Parkgürtel→Assmannshausen ist die S 11 bereits Teil der
  gebuchten Verbindung (im Ticket enthalten) – ein City-Ticket würde nur eine
  **zusätzliche** Stadt-Fahrt am Reisetag ermöglichen, das Modell rechnet es deshalb
  nicht ein.

**Konsequenz im Modell:** Erster Teil Parkgürtel→Köln Hbf (2 Halte):

| Fall | Preis |
|---|---|
| Fernverkehr-Optionen (SS/SP/Flex) | **0 €** (S 11 im Ticket der gebuchten Verbindung) |
| 3-Verbund / RE rechtsrheinisch | **0 €** (im 24hTicket NRW enthalten) |
| Deutschlandticket | **0 €** |
| (Referenz, wenn gar nichts deckt) | Köln-Kurzstrecke **2,90 €** (Kind 1,45 €; unter 6 frei) |

Beim 3-Verbund (24h NRW) und bei den DtT-Optionen ist der erste Teil **enthalten**
(wird nie extra berechnet).

## BahnCard 25 (2026)

| Variante | Preis | Quelle |
|---|---|---|
| BahnCard 25 (27–64 J.) | 62,90 €/Jahr | [bahn.de Vergleich](https://www.bahn.de/angebot/bahncard/vergleich) |
| My BahnCard 25 (unter 27) | 39,90 €/Jahr | dito |
| Senioren-/Ermäßigte BC25 | 40,90 €/Jahr | dito |
| Jugend BahnCard 25 (6–18 J.) | 7,90 €/Jahr | [bahnpedia.de](https://bahnpedia.de/jugend-bahncard-25/) – im Modell nicht separat berücksichtigt |

Rabatt: 25 % auf Flex-, Spar- und SuperSparpreise; **nicht** auf Verbund-/Ländertickets und
(seit 1.1.2026) nicht auf RMV-Einzelfahrten.

## Ländertickets / Gruppentickets

| Ticket | Preis 2026 | Gültigkeit | Quelle |
|---|---|---|---|
| **Rheinland-Pfalz-Ticket** (RP + Saarland) | 30 € (1. Pers.) + 10 € je weitere (max. 5); Kinder unter 14 frei | Mo–Fr **ab 9:00**, Sa/So/Feiertag ab 0:00, bis 3:00 Folgetag; alle NV in RP, **keine Zugbindung**; gilt ab **jedem** RP-Bahnhof (nicht Köln/NRW, nicht Hessen); an der Rheintalstrecke endet es in **Lorch** bzw. **Lahnstein** (Hessen-Pocket: Rüdesheim, Assmannshausen, Eltville …) | [db-fahrplan.com (08/2026)](https://www.db-fahrplan.com/db-fahrkarten/rheinland-pfalz-ticket/), [bahndampf.de (01/2026)](https://www.bahndampf.de/deutsche-bahn/rheinland-pfalz-ticket) |
| **24hTicket NRW** (früher NRW-Tarif) | 39,80 € Single / **59,80 €** bis 5 Pers. | 24 h ab Entwertung, **keine 9-Uhr-Regel**; alle NV in NRW, 2. Kl.; **deckt den ersten Teil Parkgürtel→Köln Hbf ab** | [db-fahrplan.com (08/2026)](https://www.db-fahrplan.com/db-fahrkarten/nrw-ticket/), [bahn.de/fahr-mit](https://www.fahr-mit.de/fahr-mit/Ticketangebot/Gruppen.php) |

## Nahverkehr

| Tarif | Preis 2026 | Quelle |
|---|---|---|
| RMV Einzelfahrschein (ab 1.1.2026) | 3,90 €/Wabe (Kind 6–14: 2,20 €); unter 6 frei; **BahnCard-Rabatt entfällt** | [mainzer-mobilitaet.de (11/2025)](https://www.mainzer-mobilitaet.de/news/2025/11/tarifwechsel) |
| **RE 21 Frankfurt→Rüdesheim** (VGN+RMV-Cross) | **7,80 €/4,40 € (MODELLWERT)** – Cross-Verbund-Ticket, exakt in RMV/VGN-App prüfen | – (Modell) |
| **ZMB-Einzel (Mainzer Stadtteil)** | **3,80 €/1,90 € (MODELLWERT)** – für den kurzen RP-Abschnitt ab Mainz; ab Eltville gilt RMV | – (Modell) |
| Rheinland-Tarif VRS+AVV (ab 1.6.2026) | Einzelfahrt Köln (1b) 4,00 €; **Kurzstrecke 2,90 € (Kind 1,45 €)**; Stufe 2: 5,50 €; 24 h Köln: 9,60 € | [kvb.koeln/rheinlandtarif](https://www.kvb.koeln/rheinlandtarif), [ksta.de (06/2026)](https://www.ksta.de/koeln/neuer-verkehrsverbund-das-aendert-sich-bei-der-kvb-1-1280462) |
| eezy.nrw (Rheinland-Tarif-Ausgabe) | 1,66 € + 0,27 €/Luftlinien-km → Parkgürtel→Hbf ≈ 3,28 € (teurer als Kurzstrecke, nur alternativ) | [kvb.koeln/rheinlandtarif](https://www.kvb.koeln/rheinlandtarif) |
| Deutschlandticket | **66,80 €/Monat**; NV bundesweit (inkl. RP-RE + RMV Hessen), nicht im Fernverkehr | [ksta.de (06/2026)](https://www.ksta.de/koeln/neuer-verkehrsverbund-das-aendert-sich-bei-der-kvb-1-1280462) |

## Schifffahrt (2026)

| Verbindung | Preis | Dauer | Quelle |
|---|---|---|---|
| **Fahrgastschiff Rüdesheim → Assmannshausen KD** | 12,50 € einfach (Kind 50 % modelliert) | ~45 min | [roesslerlinie.de](https://roesslerlinie.de/schifffahrt/planmaessige-fahrten/), [bingen-ruedesheimer.de](https://www.bingen-ruedesheimer.de/fahrpreise/) |
| Rheinfähre Bingen↔Rüdesheim | 2,90 € (Rad 2,70 €) | ~6 min | [bingen-ruedesheimer.de/fahrpreise](https://www.bingen-ruedesheimer.de/fahrpreise/) – **nicht modelliert als Option**: es fährt kein Fernverkehr nach Bingen, daher bringt die Fähre keinen Sparpreis-Vorteil |

## Streckenmodell (Optionen A–G, `src/route.js`)

| Opt. | Name | Verbindung (Modell, ganze gebuchte Verbindung) | Dauer |
|---|---|---|---|
| A | **(Super)Sparpreis DIREKT Parkgürtel→Assmannshausen – linksrheinisch** (1 Ticket: S 11 + ICE via Mainz + Nachlauf, alle im Ticket) | S 11 (10) → ICE linksrheinisch (105) → U (20) → RE/RB ab Mainz (45) | 180 min |
| C | **(Super)Sparpreis DIREKT – Umweg über Frankfurt** (1 Ticket: S 11 + ICE SFS + RE 21 + RB 10, alle im Ticket) | S 11 (10) → ICE SFS (65) → U (15) → RE 21 Frankfurt→Rüdesheim (75) → RB 10 (5) | 178 min |
| D | **Flexpreis DIREKT** (Referenz, keine Zugbindung, ganze Verbindung im Ticket) | wie A | 180 min |
| E | 3-Verbund linksrheinisch: **24h NRW + RP-Ticket + RMV** (ohne Fernverkehr; S 11 im NRW-Ticket) | S 11 (10) → RE links Köln→Bonn (85) → RE/Koblenz→Lorch (45) → RB 10 (55) | 235 min |
| F | **Deutschlandticket** (alle haben eins): linksrheinisch, 0 € zusätzlich | wie E | 235 min |
| G | RE „Rheintalbahn“ direkt **rechtsrheinisch** nach Rüdesheim + RMV (S 11 im NRW-Ticket) | S 11 (10) → RE 97 (140) → RB 10 Rüdesheim→Assmannshausen (8) | 166 min (vor Bau; in der Bauzeit Bus, deutlich länger) |

Abfahrt je Zeitfenster: beliebig 11:00, morgens 07:00, mittags 12:00, nachmittags 14:00
(modelliert; live ersetzt durch tatsächliche Zug-Empfehlungen).

## Bewusst nicht modelliert (v1)

- Rückfahrt / Tageskalkulation
- Fahrradmitnahme mit großem Rad (Reservierung 6–7,50 € Fernverkehr)
- Feiertags-Kalender (Wochenende-Logik genügt für v1)
- exakte Cross-Verbund-Zonen VGN/RMV (Modellwert, in der RMV-App prüfen)
