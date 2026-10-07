/* DBApp – Live-Daten-Layer (läuft IM BROWSER: kann bahn.de direkt erreichen)
 *
 * Quellen:
 *  1) ps.bahn.de/preissuche  – DB-Preis-Suche (Sparpreis-/SuperSparpreis-Angebote
 *     + konkrete Fernzüge) für ein Segment, 24 h-Fenster ab gewählter Zeit.
 *     UNOFFIZIELLES DB-Endpoint (Kontrakt dokumentiert u. a. im Open-Source-Projekt
 *     juliuste/db-prices). Kein API-Key nötig.
 *     WICHTIG: ps.bahn.de sendet KEINE CORS-Header → der direkte Browser-Call
 *     scheitert. Deshalb: 1. Versuch direkt (falls es je klappt), danach
 *     öffentliche CORS-Proxy-Chain (corsproxy.io, allorigins.win) parallel.
 *     Jeder erfolgreiche Call meldet sein `via`-Herkunftsnetz im Status.
 *  2) api.bahn.de (DB Navigator API) – offizielle API für Verbindungen
 *     (Nahverkehr) mit Live-Zügen. Benötigt kostenlosen Client-ID/Secret.
 *
 * Ergebnis: normalisiertes Objekt für den Engine-Quote:
 *   { status, asOf, via:[], errors:[], ss: {segKey: seg}, nv: {nvKey: conn} }
 */
(function (global) {
  'use strict';

  const PS_URL = 'https://ps.bahn.de/preissuche/preissuche/psc_service.go';
  const DB_TOKEN_URL = 'https://api.bahn.de/api/oauth2/token';
  const DB_CONN_URL = 'https://api.bahn.de/api/v1/connections';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 9000;
  const cache = new Map();

  // CORS-Proxy-Chain (nur öffentliche, keylose Proxys). `post`: ob der Proxy
  // POST/Body weiterleitet (corsproxy.io ja, allorigins nur GET).
  const PROXIES = [
    { name: 'direkt', get: (u) => u, post: false },
    { name: 'corsproxy.io', get: (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u), post: true },
    { name: 'allorigins.win', get: (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u), post: false }
  ];

  // ---------- Utilities ----------

  function msg(e) {
    if (!e) return 'unbekannt';
    if (e.name === 'AbortError') return 'Zeitüberschreitung';
    return String(e.message || e).slice(0, 160);
  }

  async function fetchOnce(url, opts, timeoutMs) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs || FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, Object.assign({ signal: ctl.signal }, opts || {}));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Fetch mit Fallback-Chain: zuerst direkt (schnellste Route, kein Dritter),
   * danach die CORS-Proxys PARALLEL – der erste erfolgreiche Call gewinnt.
   * Liefert { body, via } oder wirft (mit allen Einzel-Fehlern in message).
   */
  async function fetchSmart(url, opts, timeoutMs) {
    const isGet = !opts || !opts.method || opts.method.toUpperCase() === 'GET';
    const errors = [];
    try {
      const body = await fetchOnce(url, opts, timeoutMs);
      return { body, via: 'direkt' };
    } catch (e) {
      errors.push('direkt: ' + msg(e));
    }
    const cands = PROXIES.filter((p) => p.name !== 'direkt' && (isGet || p.post));
    const settled = await Promise.allSettled(
      cands.map((p) => fetchOnce(p.get(url), opts, timeoutMs))
    );
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === 'fulfilled') return { body: r.value, via: cands[i].name };
      errors.push(cands[i].name + ': ' + msg(r.reason));
    }
    const err = new Error('Alle Quellen nicht erreichbar – ' + errors.join(' | '));
    err.chain = errors;
    throw err;
  }

  // Zeit -> Minuten seit Mitternacht (Zonenvollstand: Europe/Berlin).
  // Akzeptiert: 0..1440 (Number/String), 'HH:mm', ISO-String mit Zeitversatz.
  function toMinutes(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v > 1440 ? null : Math.round(v);
    const s = String(v).trim();
    if (/^\d{1,4}$/.test(s)) {
      const n = parseInt(s, 10);
      return n <= 1440 ? n : null;
    }
    const hm = s.match(/^(\d{1,2}):(\d{2})/);
    if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat('de-DE', {
          timeZone: 'Europe/Berlin', hour: 'numeric', minute: '2-digit', hour12: false
        }).formatToParts(d);
        const hh = Number(parts.find((p) => p.type === 'hour').value) % 24;
        const mm = Number(parts.find((p) => p.type === 'minute').value);
        return hh * 60 + mm;
      } catch {
        return d.getHours() * 60 + d.getMinutes();
      }
    }
    return null;
  }

  const fmtMin = (m) => (m == null ? '–' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  const fmtDur = (m) => (m == null ? '–' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min');

  function nowHM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // ---------- 1) ps.bahn.de Preissuche ----------

  function preissucheUrl(seg, dateStr, timeStr, stations) {
    const data = {
      s: stations[seg.from],
      d: stations[seg.to],
      dt: dateStr,           // TT.MM.JJ
      t: timeStr,            // HH:mm
      c: 2,                  // 2. Klasse
      ohneICE: false,
      tct: 0,
      dur: 1440,             // 24 h-Fenster -> "Günstigster Tarif des Tages"
      travellers: [{ bc: 0, typ: 'E', alter: 30 }],
      sv: true,
      v: '16040000',
      dir: '1',
      bic: false,
      device: 'HANDY',
      os: 'iOS_9.3.1'
    };
    const q = new URLSearchParams({ lang: 'de', service: 'pscangebotsuche', data: JSON.stringify(data) });
    return PS_URL + '?' + q.toString();
  }

  // Robuster Parser für die ps.bahn.de-Antwort (Feldnamen können sich je API-Version ändern).
  function parsePreissuche(body) {
    const peTexte = body.peTexte || body.pex || {};
    const offersRaw = body.angebote || {};
    const connsRaw = body.verbindungen || body.connections || {};

    const offers = Object.values(offersRaw).map((o) => {
      const note = peTexte[o.pky] || peTexte[o.pn] || null;
      let price = parseFloat(String(o.p).replace(',', '.'));
      if (isNaN(price)) {
        // Fallback: Preisfeld in Sub-Objekt
        const p = o.price || o.pr;
        price = p != null ? (typeof p === 'string' ? parseFloat(p.replace(',', '.')) : p) : NaN;
      }
      return {
        key: o.pky || o.pn || null,
        price,
        tt: o.tt || null,
        zb: o.zb === 'Y' || o.zb === true,
        sids: Array.isArray(o.sids) ? o.sids : [],
        name: note ? note.name : (o.tt === 'SP' ? 'Sparpreis' : 'Normalpreis'),
        desc: note ? (note.hinweis || note.desc || '') : ''
      };
    }).filter((o) => isFinite(o.price));

    const journeys = Object.values(connsRaw).map((c) => {
      const trains = (c.trains || c.legs || []).map((t) => {
        const rawDep = t.dep != null && typeof t.dep === 'object' ? (t.dep.m != null ? t.dep.m : (t.dep.dateTime || t.dep.time)) : t.dep;
        const rawArr = t.arr != null && typeof t.arr === 'object' ? (t.arr.m != null ? t.arr.m : (t.arr.dateTime || t.arr.time)) : t.arr;
        const depMin = toMinutes(rawDep) != null ? toMinutes(rawDep) : toMinutes(t.m);
        const arrMin = toMinutes(rawArr);
        return {
          from: t.sn || (t.origin && t.origin.name) || '',
          to: t.dn || (t.destination && t.destination.name) || '',
          depMin, arrMin,
          depStr: fmtMin(depMin), arrStr: fmtMin(arrMin),
          train: t.tn || (t.line && t.line.name) || '',
          product: t.eg || (t.line && (t.line.mode || t.line.product)) || '',
          platform: t.pd || t.pa || null
        };
      }).filter((t) => t.depMin != null || t.arrMin != null);
      if (!trains.length) return null;
      const first = trains[0], last = trains[trains.length - 1];
      let totalMin = null;
      if (first.depMin != null && last.arrMin != null) {
        totalMin = last.arrMin - first.depMin;
        if (totalMin < 0) totalMin += 1440; // Nächste Nacht
        if (totalMin <= 0) totalMin = null;
      }
      // Günstigstes Angebot für diese Verbindung (Angebote referenzieren Verbindungen via sids)
      let price = null, offerName = null, offerDesc = null, zb = null;
      const cands = offers.filter((o) => o.sids.length === 0 || o.sids.includes(c.sid));
      if (cands.length) {
        const best = cands.reduce((a, b) => (b.price < a.price ? b : a));
        price = best.price; offerName = best.name; offerDesc = best.desc; zb = best.zb;
      }
      return { sid: c.sid, trains, totalMin, price, offerName, offerDesc, zb };
    }).filter(Boolean);

    if (!journeys.length) return null;
    journeys.sort((a, b) => (a.price == null ? 1 : 0) - (b.price == null ? 1 : 0) || (a.price || 0) - (b.price || 0));

    const best = journeys[0];
    return {
      minPrice: best.price,
      offerName: best.offerName,
      offerDesc: best.offerDesc,
      zb: best.zb,
      journeys: journeys.slice(0, 3).map((j) => ({
        price: j.price, offerName: j.offerName, offerDesc: j.offerDesc, zb: j.zb,
        totalMin: j.totalMin, depStr: j.trains[0].depStr, arrStr: j.trains[j.trains.length - 1].arrStr,
        trains: j.trains
      }))
    };
  }

  async function liveSparpreis(seg, dateStr, timeStr, stations) {
    const key = 'ss|' + seg.from + '|' + seg.to + '|' + dateStr + '|' + timeStr;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
    let v;
    try {
      const url = preissucheUrl(seg, dateStr, timeStr, stations);
      const { body, via } = await fetchSmart(url, { headers: { accept: 'application/json' } });
      const parsed = parsePreissuche(body);
      v = parsed
        ? { status: 'ok', via, asOf: nowHM(), data: parsed }
        : { status: 'empty', via, asOf: nowHM(), error: 'Die Live-Preissuche lieferte keine Sparpreis-Angebote für diesen Tag (Antwort ohne Verbindungen).' };
    } catch (e) {
      v = { status: 'error', asOf: nowHM(), error: msg(e) };
    }
    cache.set(key, { t: Date.now(), v });
    return v;
  }

  // ---------- 2) DB Navigator API (Verbindungen, u. a. Nahverkehr) ----------

  let dbToken = null, dbTokenExp = 0;

  async function dbTokenFor(clientId, clientSecret) {
    if (dbToken && Date.now() < dbTokenExp) return dbToken;
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    const { body: res } = await fetchSmart(DB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    dbToken = res.access_token;
    dbTokenExp = Date.now() + ((res.expires_in || 600) - 60) * 1000;
    return dbToken;
  }

  async function dbConnections(seg, dateStr, timeStr, stations, dbKey) {
    const key = 'nv|' + seg.from + '|' + seg.to + '|' + dateStr + '|' + timeStr;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
    let v;
    try {
      const parts = String(dbKey || '').split(':').map((s) => s.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) throw new Error('DB-API-Key fehlt oder ungültig (Format: Client-ID : Client-Secret)');
      const token = await dbTokenFor(parts[0], parts[1]);
      const q = new URLSearchParams({
        originId: stations[seg.from],
        destId: stations[seg.to],
        searchDateTime: dateStr + 'T' + timeStr + ':00',
        searchDuration: '1440',
        maxJourneys: '3',
        mode: '1' // nur Regionalzüge (Nahverkehr)
      });
      const { body, via } = await fetchSmart(DB_CONN_URL + '?' + q.toString(), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
      });
      v = { status: 'ok', via, asOf: nowHM(), data: parseConnections(body) };
    } catch (e) {
      v = { status: 'error', asOf: nowHM(), error: msg(e) };
    }
    cache.set(key, { t: Date.now(), v });
    return v;
  }

  function parseConnections(body) {
    // DB-API "neu" (2023+): { results: [ { itineraries: [...] } ] }; alt: { itineraries: [...] }
    const results = Array.isArray(body.results) ? body.results : [body];
    const out = [];
    for (const r of results) {
      const its = r.itineraries || (Array.isArray(r) ? r : []);
      for (const it of its) {
        const legs = (it.legs || it.hops || []).map((l) => {
          const dep = l.departure || {}, arr = l.arrival || {};
          const depMin = toMinutes(typeof dep === 'string' ? dep : (dep.dateTime || dep.date + 'T' + dep.time));
          const arrMin = toMinutes(typeof arr === 'string' ? arr : (arr.dateTime || arr.date + 'T' + arr.time));
          return {
            from: (l.origin && l.origin.name) || l.originName || '',
            to: (l.destination && l.destination.name) || l.destinationName || '',
            depMin, arrMin,
            depStr: fmtMin(depMin), arrStr: fmtMin(arrMin),
            train: (l.line && (l.line.name || l.line.code)) || l.lineName || '',
            product: (l.line && l.line.mode) || ''
          };
        }).filter((l) => l.depMin != null || l.arrMin != null);
        if (!legs.length) continue;
        const first = legs[0], last = legs[legs.length - 1];
        let totalMin = null;
        if (first.depMin != null && last.arrMin != null) {
          totalMin = last.arrMin - first.depMin;
          if (totalMin < 0) totalMin += 1440;
          if (totalMin <= 0) totalMin = null;
        }
        out.push({
          totalMin, depMin: first.depMin, arrMin: last.arrMin,
          depStr: first.depStr, arrStr: last.arrStr,
          legs
        });
      }
    }
    out.sort((a, b) => (a.totalMin == null ? 9999 : a.totalMin) - (b.totalMin == null ? 9999 : b.totalMin));
    if (!out.length) throw new Error('Keine Verbindungen gefunden (Antwortformat unerwartet)');
    return { journeys: out.slice(0, 3) };
  }

  // ---------- Sammler ----------

  function fmtDateDE(iso) {
    const p = String(iso).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0].slice(2) : iso;
  }

  /**
   * params: { date:'YYYY-MM-DD', window, stations, liveSegments, departures, liveMode, dbKey }
   * -> { status, asOf, via:[], errors, ss: {segKey: segResult}, nv: {nvKey: connResult} }
   *
   * Status je Segment:
   *  ok      – Quelle antwortete mit Daten
   *  empty   – Quelle antwortete, aber KEIN Angebot/keine Verbindung für diesen Tag
   *  error   – alle Quellen (direkt + Proxys) nicht erreichbar → Engine nutzt Modell
   *  skipped – Segment aktiviert nicht (z. B. NV ohne DB-API-Key)
   */
  async function collectLive(params) {
    const out = { status: 'live', asOf: nowHM(), via: [], errors: [], ss: {}, nv: {} };
    if (params.liveMode === 'off') { out.status = 'off'; return out; }
    const dateStr = fmtDateDE(params.date);
    const timeStr = (params.departures && params.departures[params.window]) || '11:00';
    const vias = new Set();
    const jobs = [];
    for (const segKey of Object.keys(params.liveSegments.ss)) {
      const seg = params.liveSegments.ss[segKey];
      jobs.push(liveSparpreis(seg, dateStr, timeStr, params.stations).then((r) => {
        out.ss[segKey] = r;
        if (r.via) vias.add(r.via);
        if (r.status !== 'ok') out.errors.push('Sparpreis ' + segKey + ': ' + (r.error || r.status));
      }));
    }
    const useNv = params.liveMode === 'dbapi';
    for (const nvKey of Object.keys(params.liveSegments.nv)) {
      if (!useNv) { out.nv[nvKey] = { status: 'skipped', error: 'Nur mit DB-API-Key aktiv' }; continue; }
      const seg = params.liveSegments.nv[nvKey];
      jobs.push(dbConnections(seg, dateStr, timeStr, params.stations, params.dbKey).then((r) => {
        out.nv[nvKey] = r;
        if (r.via) vias.add(r.via);
        if (r.status !== 'ok') out.errors.push('Verbindungen ' + nvKey + ': ' + (r.error || r.status));
      }));
    }
    await Promise.allSettled(jobs);
    out.via = Array.from(vias);
    const ssTotal = Object.keys(out.ss).length;
    const nvTotal = Object.keys(out.nv).length;
    const okCount = Object.values(out.ss).filter((s) => s.status === 'ok').length;
    const nvOk = Object.values(out.nv).filter((s) => s.status === 'ok').length;
    if (okCount === 0 && nvOk === 0) out.status = 'error';
    else if (okCount < ssTotal || (useNv && nvOk < nvTotal)) out.status = 'partial';
    else out.status = 'live';
    return out;
  }

  global.DBAppLive = {
    collectLive,
    fmtDur, fmtMin,
    _test: { parsePreissuche, parseConnections, toMinutes, fetchSmart, PROXIES }
  };
})(typeof window !== 'undefined' ? window : globalThis);
