/* CAM Manager, BISS Manager, Picon Manager */
const CAM_TYPES = ['CCcam', 'Newcamd', 'Other plugin'];
SCREENS.cam = () => `<div class="page">${pageHead('card', 'CAM Manager', 'Connection profiles for services you are subscribed to and modules you own.', `<button class="btn primary" data-act="srv-add">${ic('plus')}${t('Add server')}</button>`)}
  <div class="note"> ${ic('shield')}<div>${t('Use only with subscriptions and connections you are authorized to use. NOVA does not bypass encryption or access control.')}</div></div>
  <div class="panes" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
    <section class="card pane"><div class="card-head">${ic('server')}<h2>${t('Servers')}</h2><span class="sub">(${S.servers.length})</span></div>
      <div class="scroll" style="display:grid;gap:8px;align-content:start">${S.servers.map(s => `<article class="stat" style="gap:8px"><div class="row nw"><div class="sp" style="min-width:0"><b style="font-size:16px">${esc(s.label)}</b><div class="sub ltr" style="text-align:start;overflow:hidden;text-overflow:ellipsis">${esc(s.type)} &nbsp;•&nbsp; ${esc(s.host)}:${s.port} &nbsp;•&nbsp; ${esc(s.user)}</div></div>
          ${s.status === 'testing' ? stateTag('warn', 'Testing') : s.status === 'checked' ? stateTag('idle', 'Details valid, not connected') : stateTag('idle', 'Not tested')}<label class="switch" data-tip="${t(s.enabled ? 'Enabled' : 'Disabled')}"><input id="srv-${s.id}" type="checkbox" data-chg="srv-on" data-v="${s.id}" ${s.enabled ? 'checked' : ''} aria-label="${t('Enabled')}"><i></i></label></div>
        <div class="row"><span class="sub" style="flex:1">${t('Password')}: <span class="mono">••••••••</span></span><button class="btn sm" data-act="srv-test" data-v="${s.id}">${ic('zap')}${t('Test connection')}</button><button class="btn sm" data-act="srv-edit" data-v="${s.id}">${ic('edit')}${t('Edit')}</button><button class="btn sm danger" data-act="srv-del" data-v="${s.id}">${ic('trash')}${t('Delete')}</button></div></article>`).join('') || `<div class="empty">${ic('server')}<span>${t('No servers yet. Add the details your provider gave you.')}</span></div>`}</div></section>
    <section class="card pane scroll"><div class="card-head">${ic('plug')}<h2>${t('Decoding interfaces')}</h2></div>
      <div class="set-row"><div><b>${t('CI slot and CAM module')}</b><small>${t('Depends on the card and its driver.')}</small></div>${stateTag('idle', hasDevice() ? 'Not tested' : 'No device')}</div>
      <div class="set-row"><div><b>BISS</b><small>${t('Fixed keys for feeds you are authorized to receive.')}</small></div>${stateTag('idle', 'Not tested')}</div>
      <div class="set-row"><div><b>${t('Add-on interface')}</b><small>${t('Other CAM systems plug in here as separate modules.')}</small></div>${stateTag('idle', 'Planned')}</div>
      <p class="hint">${t(NATIVE ? 'This build saves connection details but does not connect yet. Passwords are not stored.' : 'Passwords stay out of logs and backups. The Windows app encrypts them with your Windows account. This preview keeps them only until the page closes.')}</p></section>
  </div></div>`;
function srvModal(s) {
  const id = uid('sv');
  A[id] = () => {
    const m = modals[modals.length - 1], v = formVals(m), port = Number(v.port);
    const hostOk = /^[a-z0-9.-]+$/i.test(v.host.trim()), portOk = Number.isInteger(port) && port > 0 && port < 65536;
    setErr(m, 'label', v.label.trim() ? '' : t('Enter a name for this profile.')); setErr(m, 'host', hostOk ? '' : t('Enter a host name or IP address.')); setErr(m, 'port', portOk ? '' : t('Enter a port from 1 to 65535.'));
    if (!v.label.trim() || !hostOk || !portOk) return;
    const data = { label: v.label.trim(), type: v.type, host: v.host.trim(), port, user: v.user.trim(), pass: v.pass || s?.pass || '', status: 'untested' };
    if (s) Object.assign(s, data); else S.servers.push({ id: uid('s'), enabled: false, ...data });
    save(); closeModal(); refresh(); toast(t('Server saved'), 'good');
  };
  openModal({ title: t(s ? 'Edit server' : 'Add server'), width: 500, body: `${field('Profile name', 'label', s?.label)}<div class="grid2">${selectF('Type', 'type', CAM_TYPES, s?.type || 'CCcam')}${field('Port', 'port', s?.port ?? 12000, 'inputmode="numeric"')}</div>${field('Host', 'host', s?.host, 'dir="ltr"')}<div class="grid2">${field('User name', 'user', s?.user, 'dir="ltr"')}${field('Password', 'pass', '', `type="password" dir="ltr" placeholder="${s ? t('Unchanged') : ''}"`)}</div>
    <div class="note">${ic('lock')}<div>${t(NATIVE ? 'Passwords are never written to logs. This build does not store them yet.' : 'Passwords are never written to logs. This preview does not store them after you close the page.')}</div></div>`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
}
A['srv-add'] = () => srvModal();
A['srv-edit'] = el => srvModal(S.servers.find(s => s.id === el.dataset.v));
A['srv-del'] = el => { const s = S.servers.find(x => x.id === el.dataset.v); confirmBox({ title: `${t('Delete')} ${s.label}?`, msg: t('The profile and its password are removed.'), yes: t('Delete'), onYes: () => { S.servers = S.servers.filter(x => x !== s); save(); refresh(); } }); };
CHG['srv-on'] = el => { const s = S.servers.find(x => x.id === el.dataset.v); s.enabled = el.checked; save(); toast(t(s.enabled ? 'Server enabled' : 'Server disabled')); };
A['srv-test'] = async el => {
  const s = S.servers.find(x => x.id === el.dataset.v); s.status = 'testing'; refresh();
  await new Promise(r => setTimeout(r, 900));
  s.status = 'checked'; save(); if (S.view === 'cam') refresh();
  toast(t('Details look valid. This preview cannot open a network connection, so nothing was contacted.'), 'warn');
};

/* ---------- BISS ---------- */
const hexOnly = v => v.replace(/[\s-]/g, '').toUpperCase();
function bissCheck(raw) {
  const k = hexOnly(raw);
  if (!k) return { ok: false, msg: 'Enter a key.' };
  if (!/^[0-9A-F]+$/.test(k)) return { ok: false, msg: 'Use only 0-9 and A-F.' };
  if (k.length !== 12 && k.length !== 16) return { ok: false, msg: 'A BISS key has 12 or 16 hex digits.' };
  const b = k.match(/../g).map(x => parseInt(x, 16));
  const sum = a => (a[0] + a[1] + a[2]) & 255, hx = n => n.toString(16).toUpperCase().padStart(2, '0');
  if (k.length === 12) return { ok: true, key: hx(b[0]) + hx(b[1]) + hx(b[2]) + hx(sum(b)) + hx(b[3]) + hx(b[4]) + hx(b[5]) + hx(sum(b.slice(3))), msg: 'Checksum bytes added.' };
  const good = b[3] === sum(b) && b[7] === sum(b.slice(4));
  return { ok: true, key: k, warn: !good, msg: good ? 'Format and checksum are valid.' : 'Format is valid, but the checksum bytes do not match. Check the key.' };
}
const maskKey = k => `${k.slice(0, 2)}•• •••• •••• ••${k.slice(-2)}`;
const fmtKey = k => k.match(/.{1,4}/g).join(' ');
const bissTarget = v => { if (!v) return '—'; const c = chById(v); if (c) return c.name; for (const s of S.sats) { const p = s.tps.find(x => x.id === v); if (p) return `${s.name} ${p.freq} ${p.pol}`; } return '—'; };
const shown = new Set();
SCREENS.biss = () => `<div class="page">${pageHead('key', 'BISS Manager', 'Keys for fixed-key feeds you are authorized to receive.', `<button class="btn" data-act="biss-import">${ic('upload')}${t('Import')}</button><button class="btn" data-act="biss-export" ${S.biss.length ? '' : 'disabled'}>${ic('download')}${t('Export')}</button><button class="btn primary" data-act="biss-add">${ic('plus')}${t('Add key')}</button>`)}
  <section class="card pane" style="flex:1"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('Name')}</th><th>${t('Key')}</th><th>${t('Linked to')}</th><th>${t('Status')}</th><th></th></tr></thead><tbody>
    ${S.biss.map(b => { const c = bissCheck(b.key); return `<tr><td>${esc(b.label)}</td><td class="mono ltr">${shown.has(b.id) ? fmtKey(b.key) : maskKey(b.key)}</td><td>${esc(bissTarget(b.target))}</td><td>${c.warn ? stateTag('warn', 'Check key') : stateTag('idle', 'Format valid, not tested on air')}</td>
      <td><div class="acts"><button class="icon-btn" data-act="biss-show" data-v="${b.id}" aria-label="${t(shown.has(b.id) ? 'Hide key' : 'Show key')}" data-tip="${t(shown.has(b.id) ? 'Hide key' : 'Show key')}">${ic(shown.has(b.id) ? 'eyeoff' : 'eye')}</button><button class="icon-btn" data-act="biss-edit" data-v="${b.id}" aria-label="${t('Edit')}" data-tip="${t('Edit')}">${ic('edit')}</button><button class="icon-btn" data-act="biss-del" data-v="${b.id}" aria-label="${t('Delete')}" data-tip="${t('Delete')}">${ic('trash')}</button></div></td></tr>`; }).join('')}</tbody></table>
    ${S.biss.length ? '' : `<div class="empty">${ic('key')}<span>${t('No keys yet.')}</span></div>`}</div>
    <div class="note">${ic('shield')}<div>${t(NATIVE ? 'This build checks and stores the key format only. It does not decode channels yet.' : 'NOVA checks the key format here. Whether a key decodes depends on an authorized descrambler in your card or CAM. The Windows app encrypts stored keys.')}</div></div></section></div>`;
function bissModal(b) {
  const id = uid('bk');
  A[id] = () => {
    const m = modals[modals.length - 1], v = formVals(m), c = bissCheck(v.key);
    setErr(m, 'label', v.label.trim() ? '' : t('Enter a name.')); setErr(m, 'key', c.ok ? '' : t(c.msg));
    if (!v.label.trim() || !c.ok) return;
    const data = { label: v.label.trim(), key: c.key, target: v.target };
    if (b) Object.assign(b, data); else S.biss.push({ id: uid('b'), status: 'unverified', ...data });
    save(); closeModal(); refresh(); toast(t('Key saved'), 'good');
  };
  const opts = [['', 'Not linked'], ...S.channels.map(c => [c.id, c.name]), ...S.sats.flatMap(s => s.tps.map(p => [p.id, `${s.name} ${p.freq} ${p.pol}`]))];
  openModal({ title: t(b ? 'Edit key' : 'Add key'), width: 480, body: `${field('Name', 'label', b?.label)}
    <label class="field"><span>${t('Key (12 or 16 hex digits)')}</span><input id="f-key" name="key" class="mono" dir="ltr" value="${esc(b ? fmtKey(b.key) : '')}" data-chg="biss-live" autocomplete="off" spellcheck="false" placeholder="1122 3366 4455 66FF"><small class="err" data-err="key"></small></label>
    ${selectF('Link to channel or transponder', 'target', opts, b?.target || '')}`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
}
CHG['biss-live'] = el => { const e = $('[data-err="key"]', el.closest('.modal')); const c = bissCheck(el.value); if (!el.value.trim()) { e.textContent = ''; return; } e.className = c.ok && !c.warn ? 'ok' : 'err'; e.textContent = t(c.msg); };
A['biss-add'] = () => bissModal();
A['biss-edit'] = el => bissModal(S.biss.find(b => b.id === el.dataset.v));
A['biss-show'] = el => { const i = el.dataset.v; shown.has(i) ? shown.delete(i) : shown.add(i); refresh(); };
A['biss-del'] = el => { const b = S.biss.find(x => x.id === el.dataset.v); confirmBox({ title: `${t('Delete')} ${b.label}?`, msg: t('This key is removed from this computer.'), yes: t('Delete'), onYes: () => { S.biss = S.biss.filter(x => x !== b); save(); refresh(); } }); };
A['biss-export'] = () => saveFile('nova-biss-keys.json', JSON.stringify({ app: 'NOVA DVB Studio', kind: 'biss', biss: S.biss }, null, 2));
A['biss-import'] = async () => {
  const [f] = await pickFiles('.json,application/json'); if (!f) return;
  try {
    const d = JSON.parse(await readText(f)); if (!Array.isArray(d.biss)) throw new Error('shape');
    let added = 0, skipped = 0;
    d.biss.forEach(b => { const c = bissCheck(b.key || ''); if (c.ok) { S.biss.push({ id: uid('b'), label: String(b.label || 'Imported key'), key: c.key, target: b.target || '', status: 'unverified' }); added++; } else skipped++; });
    save(); refresh(); toast(`${added} ${t('keys imported')}${skipped ? `, ${skipped} ${t('skipped')}` : ''}`, skipped ? 'warn' : 'good');
  } catch (e) { toast(t('That file is not a NOVA key list.'), 'bad'); }
};

/* ---------- Picons ---------- */
const PM = { filter: 'all', q: '' };
const norm = s => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]/g, '');
SCREENS.picons = () => {
  const all = chans(), missing = all.filter(c => !S.picons[c.id]);
  const list = (PM.filter === 'missing' ? missing : all).filter(c => c.name.toLowerCase().includes(PM.q.toLowerCase()));
  return `<div class="page">${pageHead('pic', 'Picon Manager', 'Channel logos from your own files. PNG and SVG, transparent backgrounds supported.', `<button class="btn primary" data-act="pic-bulk" ${all.length ? '' : 'disabled'}>${ic('upload')}${t('Import logo set')}</button>`)}
    <section class="card pane" style="flex:1"><div class="row">
      <div class="seg" style="width:240px"><button data-act="pic-f" data-v="all" aria-pressed="${PM.filter === 'all'}">${t('All')} (${all.length})</button><button data-act="pic-f" data-v="missing" aria-pressed="${PM.filter === 'missing'}">${t('Missing')} (${missing.length})</button></div>
      <label class="search" style="flex:1 1 180px">${ic('search')}<input id="pic-q" type="search" value="${esc(PM.q)}" placeholder="${t('Search channels...')}" data-chg="pic-q" aria-label="${t('Search channels...')}"></label>
      <label class="row nw"><span class="lbl">${t('Size')}</span><input id="pic-size" type="range" min="44" max="110" value="${S.piconSize}" style="width:130px;--val:${(S.piconSize - 44) / 66 * 100}%" data-chg="pic-size" aria-label="${t('Size')}"></label></div>
      <div class="scroll" style="--ps:${S.piconSize}px" id="pic-scroll">${all.length ? `<div class="pic-grid">${list.map(c => `<div class="pic-cell">${picon(c)}<span class="nm" data-tip="${esc(c.name)}">${esc(c.name)}</span><div class="acts">
        <button class="icon-btn" data-act="pic-view" data-v="${c.id}" aria-label="${t('Preview')}" data-tip="${t('Preview')}" ${S.picons[c.id] ? '' : 'disabled'}>${ic('eye')}</button><button class="icon-btn" data-act="pic-set" data-v="${c.id}" aria-label="${t('Replace')}" data-tip="${t('Choose a logo file')}">${ic('upload')}</button><button class="icon-btn" data-act="pic-del" data-v="${c.id}" aria-label="${t('Delete')}" data-tip="${t('Delete')}" ${S.picons[c.id] ? '' : 'disabled'}>${ic('trash')}</button></div></div>`).join('')}</div>${list.length ? '' : `<div class="empty">${ic('check')}<span>${t('Every channel has a logo.')}</span></div>`}` : `<div class="empty">${ic('pic')}<b>${t('No channels yet')}</b><span>${t('Logos attach to channels. Scan or import channels first.')}</span></div>`}</div></section></div>`;
};
A['pic-f'] = el => { PM.filter = el.dataset.v; refresh(); };
CHG['pic-q'] = el => { PM.q = el.value; const p = el.selectionStart; refresh(); const i = $('#pic-q'); i.focus(); i.setSelectionRange(p, p); };
CHG['pic-size'] = el => { S.piconSize = Number(el.value); el.style.setProperty('--val', (S.piconSize - 44) / 66 * 100 + '%'); $('#pic-scroll')?.style.setProperty('--ps', S.piconSize + 'px'); save(); };
A['pic-set'] = async el => {
  const [f] = await pickFiles('image/png,image/svg+xml,.png,.svg'); if (!f) return;
  if (!/\.(png|svg)$/i.test(f.name)) { toast(t('Choose a PNG or SVG file.'), 'bad'); return; }
  if (f.size > 1.5e6) { toast(t('That logo is over 1.5 MB. Use a smaller file.'), 'bad'); return; }
  S.picons[el.dataset.v] = await readURL(f); save(); refresh(); toast(t('Logo updated'), 'good');
};
A['pic-del'] = el => { delete S.picons[el.dataset.v]; save(); refresh(); toast(t('Logo removed')); };
A['pic-view'] = el => { const c = chById(el.dataset.v); openModal({ title: c.name, width: 420, body: `<div style="display:grid;place-items:center;padding:20px;--s:0px"><span style="--ps:110px" class="pic-cell">${picon(c)}</span></div>`, foot: `<button class="btn" data-act="modal-close">${t('Close')}</button>` }); };
A['pic-bulk'] = async () => {
  const files = await pickFiles('image/png,image/svg+xml,.png,.svg', true); if (!files.length) return;
  const map = new Map(S.channels.map(c => [norm(c.name), c.id])); let hit = 0;
  for (const f of files) { const id = map.get(norm(f.name)); if (id && f.size <= 1.5e6) { S.picons[id] = await readURL(f); hit++; } }
  save(); refresh(); toast(`${hit} ${t('of')} ${files.length} ${t('logos matched by file name')}`, hit ? 'good' : 'warn');
};
