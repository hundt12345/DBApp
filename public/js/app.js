// app.js – Frontend-Logik (vanilla JS)
const $ = (sel) => document.querySelector(sel);
const eur = (x) =>
  (Number(x) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dur = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std. ${m} min` : `${h} Std.`;
};

const state = {
  date: '2026-10-24',
  window: 'any',
  vrsAbo: false,
  ss: 'ab',
  lastLeg: 'auto',
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
      const ev = 'change';
      inp.addEventListener(ev, () => {
        if (inp.type === 'checkbox') p[attr] = inp.checked;
        else if (inp.type === 'number') p[attr] = parseInt(inp.value, 10) || 0;
        else p[attr] = inp.value;
        el.querySelector('[data-cat]').textContent = catLabel(p.age);
        // eigener-Kind-Checkbox neu rendern wenn Kategorie wechselt
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

// ---------- Berechnung ----------
async function compute() {
  const status = $('#status');
  status.textContent = 'Berechne …';
  try {
    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.date,
        window: state.window,
        vrsAbo: state.vrsAbo,
        ssScenario: state.ss,
        lastLeg: state.lastLeg,
        people: state.people
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

function renderResults(data) {
  const box = $('#results');
  box.innerHTML = '';
  const itinById = ROUTE_DATA ? ROUTE_DATA.route.itins : {};

  // Kopfzeile mit Meta
  const head = document.createElement('p');
  head.className = 'hint';
  head.innerHTML = `
    <strong>${data.meta.weekday}, ${data.meta.date}</strong> · Modell-Abfahrt ${data.meta.depart} ·
    ${data.meta.people} Reisende · SuperSparpreis:
    ${data.meta.ssAvailable ? `ab ${eur(data.meta.ssAb)}` : 'nicht verfügbar'} ·
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

    // Timeline (aus Route-Definition)
    const itin = itinById[o.itin] || { legs: [], conns: [] };
    let timeline = `<div class="timeline">
      <div class="step"><strong>${ROUTE_DATA ? ROUTE_DATA.route.originShort : 'Parkgürtel'}</strong> → <strong>${ROUTE_DATA ? ROUTE_DATA.route.hbf : 'Köln Hbf'}</strong>
        <span class="t">S 11 / Klapprad · ${ROUTE_DATA ? dur(ROUTE_DATA.route.firstLeg.s11Min) : '10 min'}</span></div>`;
    let t = 0;
    itin.legs.forEach((leg, i) => {
      t += (itin.conns[i] || 0);
      timeline += `<div class="step"><strong>${leg.from}</strong> → <strong>${leg.to}</strong>
        <span class="t">${leg.mode} · ${dur(leg.min)}${(itin.conns[i] || 0) ? ' (+ ' + (itin.conns[i] || 0) + ' min U)' : ''}</span>
        ${leg.note ? `<span class="note">${leg.note}</span>` : ''}</div>`;
    });
    timeline += '</div>';

    const rows = o.rows
      .map((r) => `<tr><td>${r.label}</td><td>${eur(r.amount)}</td></tr>`)
      .join('');
    const notes = o.notes
      .map((n) => `<li>${n}</li>`)
      .join('');

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
      ${o.available ? `
      <table class="breakdown">
        ${rows}
        <tr class="total"><td>Gesamt</td><td>${eur(o.total)}</td></tr>
      </table>` : ''}
      ${notes ? `<ul class="notes">${notes}</ul>` : ''}
      ${o.best && lastFlexTotal && lastFlexTotal > o.total ? `<p class="save">🏆 ${eur(lastFlexTotal - o.total)} günstiger als der DB-Flexpreis</p>` : ''}
    `;
    box.appendChild(el);
  });
}

// ---------- Annahmen laden ----------
async function loadMeta() {
  try {
    const res = await fetch('/api/data');
    ROUTE_DATA = await res.json();
    const dl = ROUTE_DATA.assumptions
      .map((a) => `<dt>${a.t}</dt><dd>${a.s}</dd>`)
      .join('');
    $('#assumptions').innerHTML = `<dl>${dl}</dl>`;
  } catch {
    $('#assumptions').innerHTML = '<dd>Annahmen konnten nicht geladen werden.</dd>';
  }
}

// ---------- Events ----------
function bind() {
  $('#f-date').addEventListener('change', (e) => { state.date = e.target.value; compute(); });
  $('#f-window').addEventListener('change', (e) => { state.window = e.target.value; compute(); });
  $('#f-vrsabo').addEventListener('change', (e) => { state.vrsAbo = e.target.checked; compute(); });
  $('#f-ss').addEventListener('change', (e) => { state.ss = e.target.value; compute(); });
  $('#f-lastleg').addEventListener('change', (e) => { state.lastLeg = e.target.value; compute(); });
  $('#calc').addEventListener('click', compute);
  $('#add-person').addEventListener('click', () => {
    if (state.people.length >= 5) return;
    state.people.push({ age: 30, bc25: 'none', bike: false, dtt: false, ownChild: true });
    renderPeople();
    compute();
  });
}

renderPeople();
loadMeta();
bind();
compute();
