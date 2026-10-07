// app.js – Frontend-Logik (vanilla JS)
const $ = (sel) => document.querySelector(sel);
const eur = (x) =>
  (Number(x) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dur = (min) => {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std. ${m} min` : `${h} Std.`;
};
const dateDE = (iso) => {
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0].slice(2) : iso;
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};

const state = {
  date: '2026-10-24',
  window: 'any',
  vrsAbo: false,
  ticketType: 'ss',
  ss: 'ab',
  lastLeg: 'auto',
  liveMode: store.get('dbapp_live_mode') || 'auto',
  dbKey: store.get('dbapp_dbkey') || '',
  people: [
    { age: 34, bc25: 'none', bike: false, dtt: false, ownChild: true },
    { age: 38, bc25: 'none', bike: false, dtt: false, ownChild: true },
    { age: 8, bc25: 'none', bike: false, dtt: false, ownChild: true }
  ]
};

let ROUTE_DATA = null;
let lastBestTotal = null;
let lastFlexTotal = null;

// ---------- Personen-Editor ----------
function catLabel(age) {
  if (age < 6) return 'Kleinkind (frei)';
  if (age < 15) return 'Kind 6–14';
  if (age < 27) return '15–26 (My-BC)';
  if (age < 65) return 'Erw. 27–64';
  return 'Senior 65+';
}

function renderPeople() {
  const box = $('#people');
  box.innerHTML = '';
  state.people.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'person';
    el.innerHTML = `
      <div class="person-top">
        <strong>Person ${i + 1}</strong>
        <span class="cat" data-cat></span>
        <button class="x" title="Entfernen" aria-label="Person entfernen">✕</button>
      </div>
      <div class="person-row">
        <label>Alter <input type="number" min="0" max="99" value="${p.age}" data-attr="age"></label>
        <label>BC25
          <select data-attr="bc25">
            <option value="none">keine</option>
            <option value="own">eigene BC25 vorhanden</option>
            <option value="new">neue BC25 kaufen</option>
          </select>
        </label>
        <label><input type="checkbox" data-attr="bike" ${p.bike ? 'checked' : ''}> 🚲 Klapprad</label>
        <label><input type="checkbox" data-attr="dtt" ${p.dtt ? 'checked' : ''}> 🎫 hat Deutschlandticket</label>
      </div>
      ${p.age < 15 ? `<div class="person-row" style="margin-top:6px">
        <label><input type="checkbox" data-attr="ownChild" ${p.ownChild ? 'checked' : ''}> eigenes Kind (Familientickets)</label>
      </div>` : ''}
    `;
    el.querySelector('[data-cat]').textContent = catLabel(p.age);
    el.querySelectorAll('[data-attr]').forEach((inp) => {
      const attr = inp.dataset.attr;
      inp.addEventListener('change', () => {
        if (inp.type === 'checkbox') p[attr] = inp.checked;
        else if (inp.type === 'number') p[attr] = parseInt(inp.value, 10) || 0;
        else p[attr] = inp.value;
        el.querySelector('[data-cat]').textContent = catLabel(p.age);
        renderPeople();
        compute();
      });
    });
    el.querySelector('.x').addEventListener('click', () => {
      if (state.people.length <= 1) return;
      state.people.splice(i, 1);
      renderPeople();
      compute();
    });
    box.appendChild(el);
  });
}

// ---------- Live-Daten ----------
function liveStatus(text, cls) {
  const el = $('#live-status');
  if (el) { el.textContent = text; el.className = 'hint' + (cls ? ' live-' + cls : ''); }
}

async function fetchLive() {
  if (state.liveMode === 'off' || !window.DBAppLive || !ROUTE_DATA) return null;
  const p = {
    date: state.date,
    window: state.window,
    stations: ROUTE_DATA.route.stations,
    liveSegments: ROUTE_DATA.route.liveSegments,
    departures: ROUTE_DATA.route.departures,
    liveMode: state.liveMode,
    dbKey: state.dbKey
  };
  const timeout = new Promise((res) => setTimeout(() => res(null), 32000));
  const job = window.DBAppLive.collectLive(p);
  const live = await Promise.race([job, timeout]);
  const viaTxt = live && live.via && live.via.length ? ' · über ' + live.via.join('/') : '';
  if (!live) {
    liveStatus('Live nicht erreichbar (Zeitüberschreitung) – es gelten die Modell-Preise.', 'err');
    return null;
  }
  if (live.status === 'live') liveStatus(`✔ LIVE-DATEN (Stand ${live.asOf}${viaTxt}): echte DB-Sparpreis-Angebote & Verbindungen.`, 'ok');
  else if (live.status === 'partial') {
    liveStatus(`⚠ TEILWEISE LIVE (Stand ${live.asOf}${viaTxt}): ${(live.errors || []).slice(0, 2).join(' · ')} – fehlende Abschnitte als Modell.`, 'warn');
  } else {
    // Detailansicht: welche der 6 Quellen (direkt + 5 Proxys) ist wie fehlgeschlagen?
    const el = $('#live-status');
    const first = (live.errors || [])[0] || 'unbekannter Fehler';
    el.textContent = '✖ LIVE NICHT ERREICHBAR (alle Quellen) – es gelten die Modell-Preise. ' + first;
    el.className = 'hint live-err';
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'Quellen im Detail (für Support/Debuggen aufklappen)';
    det.appendChild(sum);
    const srcLine = document.createElement('div');
    srcLine.className = 'live-err-line';
    const proxies = (window.DBAppLive && window.DBAppLive._test && window.DBAppLive._test.PROXIES) || [];
    srcLine.textContent = 'Versucht wurden (parallel): direkt → ' + proxies.filter((p) => p.name !== 'direkt').map((p) => p.name).join(' → ');
    det.appendChild(srcLine);
    (live.errors || []).forEach((e) => {
      const line = document.createElement('div');
      line.className = 'live-err-line';
      line.textContent = '• ' + e;
      det.appendChild(line);
    });
    el.appendChild(det);
  }
  return live;
}

// ---------- Berechnung ----------
async function compute() {
  const status = $('#status');
  // Route-Daten (Timeline, bahn.de-Deep-Link) müssen vor dem Render vorhanden sein –
  // sonst Racing-Bug: compute() startet parallel zu loadMeta() → ROUTE_DATA null → Crash
  if (!ROUTE_DATA) {
    status.textContent = 'Lade Streckendaten …';
    await Promise.race([ensureMeta(), new Promise((r) => setTimeout(r, 5000))]);
  }
  status.textContent = state.liveMode !== 'off' ? 'Lade Live-Daten von der DB …' : 'Berechne …';
  try {
    const live = await fetchLive();
    status.textContent = 'Berechne …';
    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.date,
        window: state.window,
        vrsAbo: state.vrsAbo,
        ticketType: state.ticketType,
        ssScenario: state.ss,
        lastLeg: state.lastLeg,
        people: state.people,
        live: live || undefined
      })
    });
    const data = await res.json();
    lastBestTotal = data.options.find((o) => o.available)?.total ?? null;
    lastFlexTotal = data.options.find((o) => o.id === 'flex_direct')?.total ?? null;
    renderResults(data);
    status.textContent = '';
  } catch (e) {
    status.textContent = 'Fehler: ' + e.message;
  }
}

// ---------- Links ----------
function rowLink(label) {
  const l = ROUTE_DATA && ROUTE_DATA.fares ? ROUTE_DATA.fares.links : null;
  if (!l) return '';
  const s = label.toLowerCase();
  let href = null;
  if (s.includes('city-ticket')) href = l.cityticket;
  else if (s.includes('sparpreis') || s.includes('flexpreis')) href = s.includes('flexpreis') ? l.flexpreis : (s.includes('super') ? l.supersparpreis : l.sparpreis);
  else if (s.includes('bahncard')) href = l.bahncard;
  else if (s.includes('rheinland-pfalz')) href = l.laenderticket;
  else if (s.includes('24hticket') || s.includes('24h-ticket')) href = l.laenderticket;
  else if (s.includes('fahrgastschiff')) href = l.kd;
  else if (s.includes('fähre') || s.includes('fähr')) href = l.faehre;
  else if (s.includes('rmv') || s.includes('wabe') || s.includes('assmannshausen')) href = l.rmv;
  else if (s.includes('eezy') || s.includes('parkgürtel') || s.includes('kölner')) href = l.koeln;
  else if (s.includes('deutschlandticket')) href = l.dtt;
  if (!href) return '';
  return ` <a class="src" href="${href}" target="_blank" rel="noopener" title="Preistabelle des Anbieters">Preisblatt ↗</a>`;
}

function bookUrl() {
  const b = ROUTE_DATA && ROUTE_DATA.fares ? ROUTE_DATA.fares.bookBaseUrl : 'https://www.bahn.de/web/foe/suchen';
  const dep = (ROUTE_DATA && ROUTE_DATA.route && ROUTE_DATA.route.departures && ROUTE_DATA.route.departures[state.window]) || '11:00';
  const q = new URLSearchParams({
    origin: 'Köln Geldernstraße/Parkgürtel',
    destination: 'Assmannshausen',
    date: dateDE(state.date),
    time: dep
  });
  return b + '?' + q.toString();
}

// ---------- Live-Boxen (Fernzug, Live-NV, NV-Alternative) ----------
function liveBox(o) {
  const li = o.liveInfo;
  if (!li) return '';
  let h = '<div class="live">';
  if (li.fern) {
    const legs = (li.fern.legs || []).map((l) => `${l.train || 'Verbindung'} ${l.depStr}→${l.arrStr} (${l.from}→${l.to})`).join(' · ');
    h += `<div class="live-row live-fern"><strong>🚄 Gebuchte Verbindung (LIVE, Stand ${li.fern.asOf}):</strong> ${li.fern.depStr}→${li.fern.arrStr} · ${dur(li.fern.durMin)} · ${li.fern.offerName || 'Sparpreis'}${li.fern.price != null ? ' ' + eur(li.fern.price) + ' p.P.' : ''} · <strong>Zugbindung nur für ${li.fern.train || 'den Fernzug'}</strong>${li.fern.zb ? '' : ' (ohne Zugbindung)'} – S 11 und der letzte Abschnitt sind frei wählbar.${legs ? `<div class="live-sub">${legs}</div>` : ''}</div>`;
    if (li.fern.alternatives && li.fern.alternatives.length) {
      h += '<div class="live-row live-sub">Weitere günstige Angebote: ' + li.fern.alternatives.map((a) => `${a.depStr}→${a.arrStr}${a.price != null ? ' · ' + eur(a.price) : ''}`).join(' &nbsp;·&nbsp; ') + '</div>';
    }
  }
  if (li.nvLegs && li.nvLegs.length) {
    const legs = li.nvLegs.map((n) => (n.legs || []).map((l) => `${l.train || 'Nahverkehr'} ${l.depStr}→${l.arrStr} (${l.from}→${l.to})`).join(' · ')).join(' &nbsp;→&nbsp; ');
    h += `<div class="live-row live-nv"><strong>🚋 Nahverkehr (LIVE, Stand ${li.nvLegs[0].asOf}):</strong> ${legs} – hier gilt KEINE Zugbindung, es kann jeder passende Zug genommen werden.</div>`;
  }
  if (li.nvAlt) {
    const d = li.nvAlt.diffMin;
    const dTxt = d == null ? 'Vergleich nicht möglich' : d >= 0 ? `= ${dur(Math.abs(d))} LANGSAMER als diese Option` : `= ${dur(Math.abs(d))} schneller`;
    const legs = (li.nvAlt.legs || []).map((l) => `${l.train || 'NV'} ${l.depStr}→${l.arrStr}`).join(' · ');
    h += `<div class="live-row live-nv-alt"><strong>🚏 Zugbindung-Transparenz – komplett ohne Fernzug (reiner Nahverkehr, LIVE, Stand ${li.nvAlt.asOf}):</strong> beste Verbindung ${legs} · gesamt ${dur(li.nvAlt.totalMin)} → ${dTxt}. Der Sparticket-Vorteil erkauft sich also den festen Fernzug-Termin.</div>`;
  }
  h += '</div>';
  return h;
}

// ---------- Anzeige ----------
function renderResults(data) {
  const box = $('#results');
  box.innerHTML = '';
  const itinById = ROUTE_DATA ? ROUTE_DATA.route.itins : {};

  const head = document.createElement('p');
  head.className = 'hint';
  const liveMeta = data.meta.live
    ? ` · <strong>Live:</strong> ${data.meta.live.status === 'live' ? 'alle Abschnitte live' : data.meta.live.status === 'partial' ? 'teilweise live (Rest Modell)' : 'nicht verfügbar'} (Stand ${data.meta.live.asOf})`
    : '';
  const bauMeta = data.meta.bau ? ' · <strong>⚠️ Bau: rechte Rheinstrecke gesperrt (Bus-Ersatz)</strong>' : '';
  const shortMeta = data.meta.shortLead && !data.meta.live ? ' · <em>kurzfristig – ab-Preis nicht garantiert</em>' : '';
  head.innerHTML = `
    <strong>${data.meta.weekday}, ${data.meta.date}</strong> · Modell-Abfahrt ${data.meta.depart} ·
    ${data.meta.people} Reisende · ${data.meta.fernName}:
    ${data.meta.ssAvailable ? `ab ${eur(data.meta.ticketType === 'sp' ? data.meta.spAb : data.meta.ssAb)}` : 'nicht verfügbar'}${shortMeta}${liveMeta}${bauMeta} ·
    Strecke: ${data.meta.origin} → ${data.meta.destination}
  `;
  box.appendChild(head);

  let rank = 0;
  data.options.forEach((o) => {
    rank += o.available ? 1 : 0;
    const el = document.createElement('article');
    el.className = 'option' + (o.best ? ' best' : '') + (o.available ? '' : ' unavailable');

    const badges = (o.best
      ? ['<span class="badge best-badge">Günstigste Option</span>']
      : []
    ).concat((o.badges || []).map((b) => `<span class="badge">${b}</span>`)).join('');

    // Timeline (Modell-Skelett; Live-Daten kommen in den Live-Boxen unten)
    // itin.base (z. B. D verweist auf A) → auf die Basis-Routen-Daten auflösen
    const itinRaw = itinById[o.itin] || { legs: [], conns: [] };
    const itin = itinRaw.base ? (itinById[itinRaw.base] || { legs: [], conns: [] }) : itinRaw;
    const itinLegs = itin.legs || [];
    const itinConns = itin.conns || [];
    let timeline = `<div class="timeline">
      <div class="step"><strong>${ROUTE_DATA ? ROUTE_DATA.route.originShort : 'Parkgürtel'}</strong> → <strong>${ROUTE_DATA ? ROUTE_DATA.route.hbf : 'Köln Hbf'}</strong>
        <span class="t">S 11 / Klapprad · ${ROUTE_DATA ? dur(ROUTE_DATA.route.firstLeg.s11Min) : '10 min'}</span></div>`;
    itinLegs.forEach((leg, i) => {
      const c = itinConns[i] || 0;
      timeline += `<div class="step"><strong>${leg.from}</strong> → <strong>${leg.to}</strong>
        <span class="t">${leg.mode} · ${dur(leg.min)}${c ? ' (+ ' + c + ' min U)' : ''}</span>
        ${leg.note ? `<span class="note">${leg.note}</span>` : ''}</div>`;
    });
    timeline += '</div>';

    const rows = o.rows
      .map((r) => `<tr><td>${r.label}${rowLink(r.label)}</td><td>${eur(r.amount)}</td></tr>`)
      .join('');
    const notes = o.notes.filter(Boolean).map((n) => `<li>${n}</li>`).join('');

    el.innerHTML = `
      <div class="opt-head">
        ${o.available ? `<span class="rank">Nr. ${rank}</span>` : '<span class="rank">nicht verfügbar</span>'}
        <span class="opt-name">${o.name}</span>
        ${o.available ? `<span class="opt-price">${eur(o.total)}</span>` : ''}
        <span class="opt-sub">
          ${o.available ? `${eur(o.perPerson)} pro Kopf · ca. ${dur(o.minutes)} · ${o.meta ?? ''}` : ''}
        </span>
      </div>
      <div class="badges">${badges}</div>
      ${o.reason && !o.available ? `<p class="reason">⚠️ ${o.reason}</p>` : ''}
      ${o.available ? timeline : ''}
      ${o.available ? liveBox(o) : ''}
      ${o.available ? `
      <table class="breakdown">
        ${rows}
        <tr class="total"><td>Gesamt</td><td>${eur(o.total)}</td></tr>
      </table>` : ''}
      ${notes ? `<ul class="notes">${notes}</ul>` : ''}
      ${o.available ? `<p class="book"><a href="${bookUrl()}" target="_blank" rel="noopener">Auf bahn.de buchen / live prüfen ↗</a></p>` : ''}
      ${o.best && lastFlexTotal && lastFlexTotal > o.total ? `<p class="save">🏆 ${eur(lastFlexTotal - o.total)} günstiger als der DB-Flexpreis</p>` : ''}
    `;
    box.appendChild(el);
  });
}

// ---------- Annahmen laden ----------
let metaPromise = null;
function ensureMeta() {
  if (!metaPromise) metaPromise = loadMeta();
  return metaPromise;
}
async function loadMeta() {
  try {
    const res = await fetch('/api/data');
    ROUTE_DATA = await res.json();
    const dl = ROUTE_DATA.assumptions
      .map((a) => `<dt>${a.t}</dt><dd>${a.s}</dd>`)
      .join('');
    $('#assumptions').innerHTML = `<dl>${dl}</dl>`;
  } catch {
    metaPromise = null; // beim nächsten Versuch erneut laden
    $('#assumptions').innerHTML = '<dd>Annahmen konnten nicht geladen werden.</dd>';
  }
}

// ---------- Events ----------
function bind() {
  $('#f-date').addEventListener('change', (e) => { state.date = e.target.value; compute(); });
  $('#f-window').addEventListener('change', (e) => { state.window = e.target.value; compute(); });
  $('#f-vrsabo').addEventListener('change', (e) => { state.vrsAbo = e.target.checked; compute(); });
  $('#f-ticket').addEventListener('change', (e) => { state.ticketType = e.target.value; compute(); });
  $('#f-ss').addEventListener('change', (e) => { state.ss = e.target.value; compute(); });
  $('#f-lastleg').addEventListener('change', (e) => { state.lastLeg = e.target.value; compute(); });
  $('#calc').addEventListener('click', compute);
  $('#add-person').addEventListener('click', () => {
    if (state.people.length >= 5) return;
    state.people.push({ age: 30, bc25: 'none', bike: false, dtt: false, ownChild: true });
    renderPeople();
    compute();
  });

  // Live-Modus
  const radios = document.querySelectorAll('input[name="live-mode"]');
  radios.forEach((r) => {
    if (r.value === state.liveMode) r.checked = true;
    r.addEventListener('change', () => {
      state.liveMode = r.value;
      store.set('dbapp_live_mode', r.value);
      document.getElementById('dbapi-wrap').style.display = r.value === 'dbapi' ? '' : 'none';
      compute();
    });
  });
  document.getElementById('dbapi-wrap').style.display = state.liveMode === 'dbapi' ? '' : 'none';
  const keyEl = document.getElementById('f-dbapi-key');
  if (keyEl) {
    keyEl.value = state.dbKey;
    keyEl.addEventListener('change', () => {
      state.dbKey = keyEl.value.trim();
      store.set('dbapp_dbkey', state.dbKey || null);
      compute();
    });
  }
}

renderPeople();
loadMeta();
bind();
compute();
