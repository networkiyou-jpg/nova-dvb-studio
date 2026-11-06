/* Satellite Manager and Transponder Scan */
const lonOf = s => (s.dir === 'W' ? -s.pos : s.pos);
const FECS = ['1/2', '3/5', '2/3', '3/4', '4/5', '5/6', '6/7', '7/8', '8/9', '9/10', 'Auto'];
const curSat = () => satById(S.selSat) || S.sats[0];

function arcSVG() {
  const X = l => 40 + (clamp(l, -70, 70) + 70) / 140 * 820;
  const Y = x => 92 - 56 * (1 - Math.pow((x - 450) / 440, 2));
  const pts = []; for (let x = 40; x <= 860; x += 10) pts.push(`${x},${Y(x).toFixed(1)}`);
  const cur = curSat();
  return `<svg class="arc" viewBox="0 0 900 118" role="img" aria-label="${t('Orbital positions')}">
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--line-2)" stroke-width="1.5" stroke-dasharray="3 5"/>
    ${[-60, -30, 0, 30, 60].map(l => `<g><line x1="${X(l)}" x2="${X(l)}" y1="${Y(X(l)) - 5}" y2="${Y(X(l)) + 5}" stroke="var(--line-2)"/><text x="${X(l)}" y="112" text-anchor="middle">${Math.abs(l)}°${l < 0 ? 'W' : l > 0 ? 'E' : ''}</text></g>`).join('')}
    ${S.sats.map(s => { const x = X(lonOf(s)), y = Y(x), on = cur?.id === s.id; return `<g><title>${esc(satLabel(s))}</title><circle class="dot ${on ? 'on' : ''}" cx="${x}" cy="${y}" r="${on ? 7 : 5}" data-act="sat-pick" data-v="${s.id}"/>${on ? `<text class="lbl-on" x="${x}" y="${y - 13}" text-anchor="middle">${esc(s.name)}</text>` : ''}</g>`; }).join('')}
  </svg>`;
}
/* Satellite lists in the Enigma2 satellites.xml format. Keeps Ku-band transponders from 30W to 42E. */
const SAT_LIST_URL = 'https://raw.githubusercontent.com/OpenPLi/tuxbox-xml/master/xml/satellites.xml';
function parseSatXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('sat')) throw new Error('not a satellite list');
  const POL = ['H', 'V', 'L', 'R'], FEC = ['Auto', '1/2', '2/3', '3/4', '5/6', '7/8', '8/9', '3/5', '4/5', '9/10', '6/7'];
  const MOD = ['Auto', 'QPSK', '8PSK', 'QPSK', '16APSK', '32APSK'], RO = ['0.35', '0.25', '0.20'], PILOT = ['Off', 'On', 'Auto'];
  const byPos = new Map();
  $$('sat', doc).forEach(sat => {
    const lon = Number(sat.getAttribute('position')) / 10;
    if (!(lon >= -30 && lon <= 42)) return;
    const name = (sat.getAttribute('name') || '').replace(/^[\d.]+[EW]\s+/, '').replace(/^(Ku|C)-band\s+/, '').trim();
    $$('transponder', sat).forEach(t => {
      const at = k => Number(t.getAttribute(k) || 0), freq = Math.round(at('frequency') / 1000);
      if (freq < 10700 || freq > 12750 || t.getAttribute('is_id')) return;
      const key = Math.round(lon * 10);
      if (!byPos.has(key)) byPos.set(key, { name, lon, tps: new Map() });
      const s2 = at('system') === 1, pol = POL[at('polarization')] || 'H', mod = MOD[at('modulation')] || 'QPSK';
      byPos.get(key).tps.set(`${freq}${pol}`, { freq, pol, sr: Math.round(at('symbol_rate') / 1000), fec: FEC[at('fec_inner')] || 'Auto', mod: mod === 'Auto' ? 'QPSK' : mod, std: s2 ? 'DVB-S2' : 'DVB-S', ro: s2 ? RO[at('rolloff')] || '0.35' : '0.35', pilot: s2 ? PILOT[t.hasAttribute('pilot') ? at('pilot') : 2] : 'Off' });
    });
  });
  return [...byPos.values()].map(s => ({ ...s, tps: [...s.tps.values()].sort((a, b) => a.freq - b.freq) }));
}
/* Replaces list entries but keeps each satellite's DiSEqC setup, transponders you added, and any in use by a channel. */
function mergeSatList(list) {
  let count = 0;
  const used = (s, p) => S.channels.some(c => c.sat === s.id && c.f === p.freq && c.p === p.pol);
  list.forEach(n => {
    const dir = n.lon < 0 ? 'W' : 'E', pos = Math.abs(n.lon);
    let s = S.sats.find(x => Math.abs(lonOf(x) - n.lon) < 0.25);
    if (!s) { s = { id: `sat${Math.round(n.lon * 10)}`, name: n.name, pos, dir, tps: [] }; S.sats.push(s); }
    s.name = n.name; s.pos = pos; s.dir = dir;
    const keep = s.tps.filter(p => (p.u || used(s, p)) && !n.tps.some(q => q.freq === p.freq && q.pol === p.pol));
    s.tps = [...n.tps.map((p, i) => ({ id: `${s.id}t${p.freq}${p.pol}`, ...p })), ...keep].sort((a, b) => a.freq - b.freq);
    count += n.tps.length;
  });
  save();
  return { sats: list.length, tps: count };
}
function applySatXml(text) {
  const r = mergeSatList(parseSatXml(text));
  S.satListAt = Date.now();
  save();
  return r;
}
SCREENS.satellites = () => {
  const s = curSat();
  return `<div class="page">${pageHead('sat', 'Satellite Manager', 'Satellites and transponders stored on this computer. Entries here are examples to check before use.',
    `${NATIVE ? `<button class="btn" data-act="sat-update">${ic('refresh')}${t('Update from internet')}</button>` : ''}<button class="btn" data-act="sat-import">${ic('upload')}${t('Import')}</button><button class="btn" data-act="sat-export">${ic('download')}${t('Export')}</button><button class="btn primary" data-act="sat-add">${ic('plus')}${t('Add satellite')}</button>`)}
    <section class="card pane" style="padding-block:6px 4px">${arcSVG()}</section>
    <div class="panes" style="grid-template-columns:300px minmax(0,1fr)">
      <section class="card pane"><div class="card-head">${ic('sat')}<h2>${t('Satellites')}</h2><span class="sub">(${S.sats.length})</span></div>
        <div class="scroll" style="display:grid;gap:2px;align-content:start">${[...S.sats].sort((a, b) => lonOf(a) - lonOf(b)).map(x => `<button class="list-item ${x.id === s?.id ? 'on' : ''}" data-act="sat-pick" data-v="${x.id}"><div><b>${esc(x.name)}</b><small><span class="ltr">${x.pos.toFixed(1)}°${x.dir}</span> &nbsp;•&nbsp; ${x.tps.length} ${t('transponders')}</small></div></button>`).join('')}
        ${S.sats.length ? '' : `<div class="empty">${ic('sat')}<span>${t('No satellites yet. Add one to begin.')}</span></div>`}</div></section>
      <section class="card pane">${s ? `<div class="card-head"><h2>${esc(satLabel(s))}</h2><span class="sp"></span>
          <button class="btn sm" data-act="sat-edit" data-v="${s.id}">${ic('edit')}${t('Edit')}</button><button class="btn sm danger" data-act="sat-del" data-v="${s.id}">${ic('trash')}${t('Delete')}</button>
          <button class="btn sm" data-act="sat-scan" data-v="${s.id}">${ic('dish')}${t('Scan')}</button><button class="btn sm primary" data-act="tp-add">${ic('plus')}${t('Add transponder')}</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('Frequency')}</th><th>${t('Pol.')}</th><th>${t('Symbol Rate')}</th><th>FEC</th><th>${t('Modulation')}</th><th>${t('Standard')}</th><th>Roll-off</th><th>Pilot</th><th></th></tr></thead>
        <tbody>${s.tps.map(p => `<tr><td class="ltr">${p.freq} MHz</td><td>${p.pol}</td><td>${p.sr}</td><td>${p.fec}</td><td>${p.mod}</td><td>${p.std}</td><td>${p.ro}</td><td>${t(p.pilot)}</td>
          <td><div class="acts"><button class="icon-btn" data-act="tp-edit" data-v="${p.id}" aria-label="${t('Edit')}" data-tip="${t('Edit')}">${ic('edit')}</button><button class="icon-btn" data-act="tp-del" data-v="${p.id}" aria-label="${t('Delete')}" data-tip="${t('Delete')}">${ic('trash')}</button></div></td></tr>`).join('')}</tbody></table>
        ${s.tps.length ? '' : `<div class="empty">${ic('signal')}<span>${t('No transponders on this satellite yet.')}</span></div>`}</div>` : `<div class="empty">${ic('sat')}<span>${t('Select a satellite.')}</span></div>`}</section>
    </div></div>`;
};
A['sat-pick'] = el => { S.selSat = el.dataset.v; save(); refresh(); };
function satModal(sat) {
  const id = uid('sv');
  A[id] = () => {
    const m = modals[modals.length - 1], v = formVals(m), pos = parseFloat(v.pos);
    setErr(m, 'name', v.name.trim() ? '' : t('Enter a satellite name.'));
    const bad = !(pos >= 0 && pos <= 180);
    setErr(m, 'pos', bad ? t('Enter a position from 0 to 180 degrees.') : '');
    if (!v.name.trim() || bad) return;
    const data = { name: v.name.trim(), pos, dir: v.dir, port: v.port, uncommitted: v.uncommitted, motorPos: clamp(Number(v.motorPos) || 0, 0, 255) };
    if (sat) Object.assign(sat, data);
    else { const n = { id: uid('sat'), tps: [], ...data }; S.sats.push(n); S.selSat = n.id; }
    save(); closeModal(); refresh(); toast(t('Satellite saved'), 'good');
  };
  openModal({ title: t(sat ? 'Edit satellite' : 'Add satellite'), width: 440,
    body: `${field('Name', 'name', sat?.name)}<div class="grid2">${field('Orbital position (degrees)', 'pos', sat?.pos ?? '', 'inputmode="decimal"')}${selectF('Direction', 'dir', [['E', 'East'], ['W', 'West']], sat?.dir || 'E')}</div>
      <div class="set-h">${t('How this satellite is reached')}</div>
      <div class="grid3">${selectF('DiSEqC 1.0 port', 'port', ['None', 'A', 'B', 'C', 'D'], sat?.port || 'None')}${selectF('DiSEqC 1.1 port', 'uncommitted', ['None', ...Array.from({ length: 16 }, (_, i) => String(i + 1))], sat?.uncommitted || 'None')}${field('Motor position', 'motorPos', sat?.motorPos || 0, 'inputmode="numeric"')}</div>
      <p class="hint">${t('Choose the DiSEqC mode in Settings. Motor position 0 means no motor for this satellite.')}</p>`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
}
A['sat-add'] = () => satModal();
A['sat-edit'] = el => satModal(satById(el.dataset.v));
A['sat-del'] = el => {
  const s = satById(el.dataset.v), n = S.channels.filter(c => c.sat === s.id).length;
  confirmBox({ title: `${t('Delete')} ${s.name}?`, msg: `${t('This removes the satellite, its transponders and')} ${n} ${t('channels.')}`, yes: t('Delete'), onYes: () => {
    S.sats = S.sats.filter(x => x !== s); S.channels = S.channels.filter(c => c.sat !== s.id); S.selSat = S.sats[0]?.id; save(); refresh(); toast(t('Satellite deleted'), 'good'); } });
};
A['sat-scan'] = el => { scan.sat = el.dataset.v; go('scan'); };
function tpModal(tp) {
  const s = curSat(), id = uid('tv');
  A[id] = () => {
    const m = modals[modals.length - 1], v = formVals(m), f = Number(v.freq), r = Number(v.sr);
    const fok = (f >= 10700 && f <= 12750) || (f >= 3400 && f <= 4800);
    setErr(m, 'freq', fok ? '' : t('Use 10700 to 12750 MHz for Ku band, or 3400 to 4800 MHz for C band.'));
    const rok = r >= 1000 && r <= 67500;
    setErr(m, 'sr', rok ? '' : t('Enter a symbol rate from 1000 to 67500.'));
    if (!fok || !rok) return;
    const data = { freq: f, pol: v.pol, sr: r, fec: v.fec, mod: v.std === 'DVB-S' ? 'QPSK' : v.mod, std: v.std, ro: v.std === 'DVB-S' ? '0.35' : v.ro, pilot: v.std === 'DVB-S' ? 'Off' : v.pilot };
    if (tp) Object.assign(tp, data, { u: 1 }); else s.tps.push({ id: uid('tp'), u: 1, ...data });
    s.tps.sort((a, b) => a.freq - b.freq);
    save(); closeModal(); refresh(); toast(t('Transponder saved'), 'good');
  };
  openModal({ title: t(tp ? 'Edit transponder' : 'Add transponder'), width: 560,
    body: `<div class="grid2">${field('Frequency (MHz)', 'freq', tp?.freq, 'inputmode="numeric"')}${selectF('Polarization', 'pol', [['H', 'H (Horizontal)'], ['V', 'V (Vertical)'], ['L', 'L (Circular left)'], ['R', 'R (Circular right)']], tp?.pol || 'H')}
      ${field('Symbol Rate', 'sr', tp?.sr, 'inputmode="numeric"')}${selectF('FEC', 'fec', FECS, tp?.fec || '3/4')}
      ${selectF('Standard', 'std', ['DVB-S', 'DVB-S2', 'DVB-S2X'], tp?.std || 'DVB-S2')}${selectF('Modulation', 'mod', ['QPSK', '8PSK', '16APSK', '32APSK'], tp?.mod || '8PSK')}
      ${selectF('Roll-off', 'ro', ['0.35', '0.25', '0.20', '0.15', '0.10', '0.05'], tp?.ro || '0.35')}${selectF('Pilot', 'pilot', ['Auto', 'On', 'Off'], tp?.pilot || 'Auto')}</div>
      <p class="hint">${t('Roll-off and Pilot apply to DVB-S2 and newer. Your card and driver decide what can actually tune.')}</p>`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
}
A['tp-add'] = () => tpModal();
A['tp-edit'] = el => tpModal(curSat().tps.find(p => p.id === el.dataset.v));
A['tp-del'] = el => { const s = curSat(); confirmBox({ title: t('Delete transponder?'), msg: t('Channels on this transponder keep their records until you rescan.'), yes: t('Delete'), onYes: () => { s.tps = s.tps.filter(p => p.id !== el.dataset.v); save(); refresh(); } }); };
A['sat-export'] = () => saveFile('nova-satellites.json', JSON.stringify({ app: 'NOVA DVB Studio', kind: 'satellites', sats: S.sats }, null, 2));
A['sat-import'] = async () => {
  const [f] = await pickFiles('.json,.xml,application/json,text/xml'); if (!f) return;
  try {
    const text = await readText(f);
    if (text.trimStart().startsWith('<')) {
      const r = applySatXml(text);
      refresh(); toast(`${r.sats} ${t('satellites')}, ${r.tps} ${t('transponders')}`, 'good');
      return;
    }
    const d = JSON.parse(text);
    if (!Array.isArray(d.sats)) throw new Error('shape');
    let added = 0;
    d.sats.forEach(s => { if (s.name && Array.isArray(s.tps) && typeof s.pos === 'number') { S.sats.push({ ...s, id: uid('sat') }); added++; } });
    save(); refresh(); toast(`${added} ${t('satellites imported')}`, 'good');
  } catch (e) { toast(t('That file is not a NOVA satellite list.'), 'bad'); }
};

/* ---------- Transponder Scan ---------- */
const scan = { status: 'idle', pct: 0, i: 0, found: [], log: [], sat: null, mode: 'auto', tv: true, radio: true, fta: false, net: true, timer: 0, tps: [], mf: 11747, mp: 'H', ms: 27500 };
function spectrumSVG() {
  const sat = satById(scan.sat) || curSat(), W = 600, H = 86, lo = 10700, hi = 12750;
  const X = f => (f - lo) / (hi - lo) * W;
  const done = scan.tps.slice(0, scan.i);
  return `<svg class="spectrum" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t('Scanned transponders')}">
    ${(sat?.tps || []).map(p => `<rect x="${X(p.freq) - 3}" y="${H - 8}" width="6" height="8" fill="var(--line-2)"/>`).join('')}
    ${done.map(p => `<rect x="${X(p.freq) - 4}" y="${22 + (p.freq % 17)}" width="8" height="${H - 22 - (p.freq % 17)}" rx="2" fill="var(--accent-2)"/>`).join('')}
    ${scan.status === 'running' && scan.tps[scan.i] ? `<line x1="${X(scan.tps[scan.i].freq)}" x2="${X(scan.tps[scan.i].freq)}" y1="0" y2="${H}" stroke="var(--accent-3)" stroke-width="2"/>` : ''}</svg>
    <div class="row hint"><span class="ltr">10.70 GHz</span><span class="sp"></span><span class="ltr">12.75 GHz</span></div>`;
}
SCREENS.scan = () => {
  scan.sat = scan.sat && satById(scan.sat) ? scan.sat : curSat()?.id;
  const run = scan.status === 'running', pause = scan.status === 'paused', busy = run || pause;
  const r = 66, c = 2 * Math.PI * r;
  const devNote = NATIVE ? (hasDevice() ? '' : demoNote('No tuner is connected, so a scan cannot start.')) : !hasDevice() ? demoNote('No tuner is connected, so a scan cannot start. Connect a card, or switch the review state to Demo data to see the scan flow.')
    : S.mode === 'lost' ? demoNote('The tuner has no signal right now. Check the dish and cable before scanning.')
      : demoNote('Simulated scan with invented results. It shows the flow; it does not read a tuner.');
  return `<div class="page">${pageHead('dish', 'Transponder Scan', 'Find TV and radio channels and save them to your channel list.', stateTag(run ? 'good' : pause ? 'warn' : scan.status === 'done' ? 'good' : 'idle', { idle: 'Ready', running: 'Scanning', paused: 'Paused', done: 'Finished' }[scan.status]))}
    <div class="panes" style="grid-template-columns:300px minmax(0,1fr) 320px">
      <section class="card pane scroll"><div class="card-head">${ic('tune')}<h2>${t('Scan setup')}</h2></div>
        <fieldset style="all:unset;display:grid;gap:11px" ${busy ? 'disabled' : ''}>
        ${selectF('Satellite', 'scan-sat', S.sats.map(s => [s.id, satLabel(s)]), scan.sat, 'data-chg="scan-opt" data-k="sat"')}
        ${selectF('Scan mode', 'scan-mode', [['auto', 'Automatic: all known transponders'], ['manual', 'Manual: one transponder'], ...(NATIVE ? [] : [['blind', 'Blind scan: card must support it']])], scan.mode, 'data-chg="scan-opt" data-k="mode"')}
        ${scan.mode === 'manual' ? `<div class="grid2">${field('Frequency (MHz)', 'mf', scan.mf, 'data-chg="scan-opt" data-k="mf"')}${selectF('Polarization', 'mp', ['H', 'V'], scan.mp, 'data-chg="scan-opt" data-k="mp"')}</div>${field('Symbol Rate', 'ms', scan.ms, 'data-chg="scan-opt" data-k="ms"')}` : ''}
        ${scan.mode === 'blind' ? `<p class="hint">${t('Blind scan depends on the tuner chip and driver. NOVA enables it only when the card reports support.')}</p>` : ''}
        <div class="lbl">${t('Include')}</div>
        <label class="check"><input id="scan-tv" type="checkbox" data-chg="scan-opt" data-k="tv" ${scan.tv ? 'checked' : ''}>${t('TV channels')}</label>
        <label class="check"><input id="scan-radio" type="checkbox" data-chg="scan-opt" data-k="radio" ${scan.radio ? 'checked' : ''}>${t('Radio channels')}</label>
        <label class="check"><input id="scan-fta" type="checkbox" data-chg="scan-opt" data-k="fta" ${scan.fta ? 'checked' : ''}>${t('Free-to-air only')}</label>
        ${scan.mode === 'manual' ? '' : `<label class="check"><input id="scan-net" type="checkbox" data-chg="scan-opt" data-k="net" ${scan.net ? 'checked' : ''}>${t('Read network table (NIT) for new transponders')}</label>`}
        </fieldset>${devNote}</section>
      <section class="card pane"><div class="card-head">${ic('signal')}<h2>${t('Progress')}</h2><span class="sp"></span><span class="sub ltr">${scan.tps.length ? Math.min(scan.i, scan.tps.length) + ' / ' + scan.tps.length : ''}</span></div>
        <div class="scan-ring"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="9"/><circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--accent-2)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - scan.pct / 100)}"/></svg><b>${Math.round(scan.pct)}%</b></div>
        <div>${spectrumSVG()}</div>
        <div class="row" style="justify-content:center">
          ${!busy ? `<button class="btn primary" data-act="scan-start" ${hasDevice() && (NATIVE || S.mode !== 'lost') ? '' : 'disabled'}>${ic('play')}${t(scan.status === 'done' ? 'Scan again' : 'Start scan')}</button>` : ''}
          ${run ? `<button class="btn" data-act="scan-pause">${ic('pause')}${t('Pause')}</button>` : ''}${pause ? `<button class="btn primary" data-act="scan-resume">${ic('play')}${t('Resume')}</button>` : ''}
          ${busy ? `<button class="btn danger" data-act="scan-stop">${ic('stop')}${t('Stop')}</button>` : ''}</div>
        <div class="scroll log" id="scan-log" aria-live="polite">${scan.log.map(l => `<span class="ltr">${l}</span>`).join('') || `<span class="hint">${t('The scan log appears here.')}</span>`}</div></section>
      <section class="card pane"><div class="card-head">${ic('list')}<h2>${t('Found')}</h2><span class="sub">(${scan.found.length})</span><span class="sp"></span><button class="btn sm primary" data-act="scan-save" ${scan.found.length && !run ? '' : 'disabled'}>${t('Save')}</button></div>
        <div class="scroll" style="display:grid;gap:1px;align-content:start">${scan.found.map(f => `<div class="row nw" style="min-height:30px;font-size:13px">${ic(f.type === 'tv' ? 'tv' : 'radio')}<span class="sp" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span><span class="badge">${t(f.fta ? 'FTA' : 'CA')}</span></div>`).join('') || `<div class="empty">${ic('search')}<span>${t('Channels found during the scan appear here.')}</span></div>`}</div></section>
    </div></div>`;
};
CHG['scan-opt'] = el => { const k = el.dataset.k; scan[k] = el.type === 'checkbox' ? el.checked : el.value; if (k === 'mode' || k === 'sat') refresh(); };
function scanStep() {
  if (scan.status !== 'running') return;
  if (scan.i >= scan.tps.length) { scan.status = 'done'; scan.pct = 100; scan.log.unshift(`Done: ${scan.found.length} services`); if (S.view === 'scan') refresh(); toast(`${t('Scan finished')}: ${scan.found.length}`, 'good'); return; }
  const p = scan.tps[scan.i], n = 2 + (p.freq % 4);
  let added = 0;
  for (let i = 0; i < n; i++) {
    const radio = i === n - 1, fta = (p.freq + i) % 3 !== 0;
    if ((radio && !scan.radio) || (!radio && !scan.tv) || (scan.fta && !fta)) continue;
    scan.found.push({ name: `${radio ? 'Sample Radio' : 'Sample TV'} ${p.freq % 1000}-${i + 1}`, type: radio ? 'radio' : 'tv', fta, tp: p });
    added++;
  }
  scan.log.unshift(`${p.freq} ${p.pol} ${p.sr}  <b>lock</b>  +${added}`);
  scan.i++; scan.pct = scan.i / scan.tps.length * 100;
  if (S.view === 'scan') refresh();
  scan.timer = setTimeout(scanStep, 520);
}
A['scan-start'] = () => {
  const s = satById(scan.sat);
  const tps = scan.mode === 'manual' ? [{ freq: Number(scan.mf), pol: scan.mp, sr: Number(scan.ms), fec: 'Auto', mod: 'QPSK', std: 'DVB-S' }] : [...(s?.tps || [])];
  if (!tps.length) { toast(t('This satellite has no transponders to scan.'), 'warn'); return; }
  Object.assign(scan, { status: 'running', pct: 0, i: 0, found: [], log: [], tps });
  refresh(); scan.timer = setTimeout(scanStep, 300);
};
A['scan-pause'] = () => { scan.status = 'paused'; clearTimeout(scan.timer); refresh(); };
A['scan-resume'] = () => { scan.status = 'running'; refresh(); scanStep(); };
A['scan-stop'] = () => { scan.status = 'done'; clearTimeout(scan.timer); scan.log.unshift('Stopped by user'); refresh(); };
A['scan-save'] = () => {
  const sat = satById(scan.sat), base = S.channels.length;
  scan.found.forEach((f, i) => {
    let tpi = sat.tps.findIndex(p => p.freq === f.tp.freq && p.pol === f.tp.pol);
    if (tpi < 0) { sat.tps.push({ id: uid('tp'), ro: '0.35', pilot: 'Off', ...f.tp }); tpi = sat.tps.length - 1; }
    const q = f.type === 'radio' ? 'R' : 'SD';
    S.channels.push({ id: uid('ch'), lcn: base + i + 1, name: f.name, code: 'S', num: '', kind: f.type === 'radio' ? 'radio' : 'news', q, p1: '#3a4678', p2: '#1d2547', type: f.type, sat: sat.id, tp: tpi, vcodec: f.type === 'radio' ? '' : 'MPEG-2', acodec: 'MPEG Audio', res: f.type === 'radio' ? '' : '720 x 576', kbps: f.type === 'radio' ? 192 : 3600, sid: 5000 + i, vpid: f.type === 'radio' ? 0 : 900 + i, apid: 1200 + i, audio: ['Default'], subs: [], fta: f.fta, fav: [], locked: false, hidden: false });
  });
  const n = scan.found.length; scan.found = []; save(); refresh(); toast(`${n} ${t('channels saved to your list')}`, 'good');
};
