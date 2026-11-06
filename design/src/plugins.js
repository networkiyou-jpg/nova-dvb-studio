/* Plugins. Each one is a folder with plugin.json (id, name, version, permissions, settings, actions)
   and main.js, which receives a "nova" object and may use only what its permissions allow.
   Built-in plugins ship with NOVA; others go in %LOCALAPPDATA%\NOVA DVB Studio\plugins.
   All are off until turned on in Settings, Plugins. See plugins-guide.md for the full interface. */
const APP_VERSION = '0.3.0';
Object.assign(ICONS, {
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path>',
  cast: '<path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path><path d="M2 12a9 9 0 0 1 8 8"></path><path d="M2 16a5 5 0 0 1 4 4"></path><line x1="2" x2="2.01" y1="20" y2="20"></line>',
  terminal: '<polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line>',
});
function plugState() { return (S.plugins ||= { on: {}, cfg: {} }); }
const PL = { list: [], folder: '', loaded: false };
const PERMS = {
  channels: ['list', 'Read your channel list'],
  player: ['play', 'Change channel, volume and recording'],
  epg: ['cal', 'Add programs to the guide'],
  http: ['globe', 'Download from the internet'],
  recordings: ['rec', 'Read your recordings'],
  server: ['server', 'Accept connections from your home network'],
  exec: ['terminal', 'Run programs on this computer'],
};
const RISKY = ['exec', 'server'];
const plugById = id => PL.list.find(p => p.manifest.id === id);
const chInfo = c => ({ id: c.id, name: c.name, number: c.lcn, type: c.type, sid: c.sid, tsid: c.tsid, onid: c.onid, sat: c.sat, freq: c.f, pol: c.p });

function plog(p, text) {
  p.log.push(`${fmtTime(Date.now())}  ${text}`);
  if (p.log.length > 40) p.log.shift();
  plugRefresh();
}
function perr(p, e) {
  p.error = String(e?.message || e);
  plog(p, `${t('Error')}: ${p.error}`);
}
/* Runs plugin code so that a mistake in one plugin never stops NOVA or another plugin. */
function guard(p, fn, ...args) {
  try {
    const r = fn(...args);
    if (r && typeof r.catch === 'function') r.catch(e => perr(p, e));
    return r;
  } catch (e) { perr(p, e); return undefined; }
}
let plugTimer = 0;
function plugRefresh() {
  clearTimeout(plugTimer);
  plugTimer = setTimeout(() => { if (S.view === 'preferences' && setCat === 'plugins' && !document.activeElement?.matches?.('input,select,textarea')) refresh(); }, 120);
}

function makeApi(p) {
  const m = p.manifest, id = m.id, rt = p.rt;
  const need = k => { if (!(m.permissions || []).includes(k)) throw new Error(`${t('This plugin has no permission for')} "${k}"`); };
  const appOnly = () => { if (!NATIVE) throw new Error(t('This works in the Windows app.')); };
  const defaults = Object.fromEntries((m.settings || []).map(s => [s.key, s.default ?? (s.type === 'switch' ? false : '')]));
  const ask = (msg, ms) => hostAsk(msg, ms);
  return Object.freeze({
    id, appVersion: APP_VERSION, windowsApp: NATIVE, language: S.lang,
    get settings() { return { ...defaults, ...(plugState().cfg[id] || {}) }; },
    setSetting(k, v) { (plugState().cfg[id] ||= {})[k] = v; save(); plugRefresh(); },
    on(ev, fn) { rt.subs.push([ev, fn]); },
    onAction(a, fn) { rt.actions[a] = fn; },
    every(ms, fn) { const h = setInterval(() => guard(p, fn), Math.max(1000, Number(ms) || 0)); rt.timers.add(h); return h; },
    later(ms, fn) { const h = setTimeout(() => { rt.timers.delete(h); guard(p, fn); }, Number(ms) || 0); rt.timers.add(h); return h; },
    status(text) { p.status = String(text ?? ''); plugRefresh(); },
    toast(msg, kind) { toast(`${m.name}: ${msg}`, kind); },
    log(...a) { plog(p, a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); },
    t: s => t(s),
    channels() { need('channels'); return S.channels.filter(c => !c.hidden).map(chInfo); },
    current() { need('channels'); const c = curCh(); return c ? chInfo(c) : null; },
    player: Object.freeze({
      state() { need('player'); const c = curCh(); return { channel: c ? chInfo(c) : null, playing: !!S.player.playing, volume: S.player.vol, muted: !!S.player.muted, recording: NATIVE ? !!Engine.recording : !!recording, now: c ? nowNext(c)[0]?.title || '' : '' }; },
      tune(chId) { need('player'); if (!chById(chId)) throw new Error(t('No such channel')); tune(chId); },
      step(d) { need('player'); A['ch-step']({ dataset: { v: String(d > 0 ? 1 : -1) } }); },
      volume(v) { need('player'); S.player.vol = clamp(Math.round(Number(v) || 0), 0, 100); if (S.player.vol > 0) S.player.muted = false; Audio_.sync(); save(); if (S.view === 'live') renderPlayer(); },
      mute(on) { need('player'); S.player.muted = on === undefined ? !S.player.muted : !!on; Audio_.sync(); save(); if (S.view === 'live') renderPlayer(); },
      info() { need('player'); ibShow(); },
      record() { need('player'); A['toggle-rec'](); },
    }),
    epg: Object.freeze({
      add(chId, events) {
        need('epg');
        if (!chById(chId)) throw new Error(t('No such channel'));
        epgIngest('ch:' + chId, (events || []).map(e => ({ start: +new Date(e.start), end: +new Date(e.end), title: String(e.title || ''), desc: String(e.desc || '').slice(0, 600), genre: 0 })));
        epgPersist(true); epgRefreshViews();
      },
      importXmltv(text) { need('epg'); return applyXmltv(String(text)); },
    }),
    http: Object.freeze({
      async getText(url) {
        need('http');
        if (!/^https?:\/\//i.test(url)) throw new Error(t('Only http and https addresses are allowed'));
        const r = await getText(url);
        if (!r.ok) throw new Error(`${t('Download failed')}: ${url}`);
        return r.text;
      },
    }),
    recordings() { need('recordings'); return S.recordings.map(r => ({ ...r })); },
    async exec(file, args = []) {
      need('exec'); appOnly();
      const r = await ask({ cmd: 'pluginExec', file: String(file), args: [...args].map(String) }, 6 * 36e5 + 6e4);
      if (!r.ok) throw new Error(r.error || t('The program did not start'));
      return { code: r.code, output: r.out || '' };
    },
    server: Object.freeze({
      async stream(on, port) {
        need('server'); appOnly();
        const r = await ask({ cmd: 'serverStream', on: !!on, port: Number(port) || 8001 }, 15000);
        if (!r.ok) throw new Error(r.error || t('The port could not be opened'));
        return { channel: r.urls || [], transponder: r.whole || [] };
      },
      async remote(on, port, pin) {
        need('server'); appOnly();
        const r = await ask({ cmd: 'serverRemote', on: !!on, port: Number(port) || 8080, pin: String(pin || '') }, 15000);
        if (!r.ok) throw new Error(r.error || t('The port could not be opened'));
        return { urls: r.urls || [] };
      },
      remoteState(state) { need('server'); if (NATIVE) window.chrome.webview.postMessage({ cmd: 'remoteState', state }); },
    }),
  });
}

function startPlugin(p) {
  if (p.running || p.broken) return;
  p.rt = { subs: [], actions: {}, timers: new Set() };
  p.error = ''; p.status = '';
  p.running = true;
  try {
    const main = p.main || new Function('nova', `"use strict";\n${p.code}\n//# sourceURL=plugin-${p.manifest.id}.js`);
    guard(p, main, makeApi(p));
    plog(p, t('Started'));
  } catch (e) { perr(p, e); }
}
function stopPlugin(p) {
  if (!p.running) return;
  for (const [ev, fn] of p.rt.subs) if (ev === 'stop') guard(p, fn);
  p.rt.timers.forEach(h => { clearInterval(h); clearTimeout(h); });
  p.rt = { subs: [], actions: {}, timers: new Set() };
  p.running = false; p.status = '';
  plog(p, t('Stopped'));
}
function pluginEmit(ev, data) {
  for (const p of PL.list) if (p.running) for (const [e, fn] of p.rt.subs) if (e === ev) guard(p, fn, data);
}

/* Reads a manifest and checks the fields NOVA relies on. */
function readManifest(raw) {
  const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!m || !/^[a-z0-9][a-z0-9._-]{1,59}$/.test(m.id || '')) throw new Error(t('plugin.json needs an id of lower-case letters, digits, dots or dashes'));
  if (!m.name) throw new Error(t('plugin.json needs a name'));
  m.permissions = (m.permissions || []).filter(k => PERMS[k]);
  m.settings = Array.isArray(m.settings) ? m.settings.filter(s => s && s.key) : [];
  m.actions = Array.isArray(m.actions) ? m.actions.filter(a => a && a.id) : [];
  return m;
}
function addPlugin(def) {
  const old = plugById(def.manifest.id);
  if (old) { stopPlugin(old); PL.list.splice(PL.list.indexOf(old), 1); }
  const p = { ...def, log: old?.log || [], running: false, error: '', status: '', rt: { subs: [], actions: {}, timers: new Set() } };
  PL.list.push(p);
  return p;
}
function startEnabled() { PL.list.forEach(p => { if (plugState().on[p.manifest.id]) startPlugin(p); }); plugRefresh(); }

/* Folder plugins arrive from the Windows app as text. A broken one is listed with its error. */
function loadFolderPlugins(list, folder) {
  PL.folder = folder || '';
  PL.list.filter(p => !p.builtin).forEach(p => stopPlugin(p));
  PL.list = PL.list.filter(p => p.builtin);
  for (const f of list || []) {
    let manifest;
    try { manifest = readManifest(f.manifest); } catch (e) {
      PL.list.push({ manifest: { id: f.dir, name: f.dir, permissions: [], settings: [], actions: [] }, dir: f.dir, broken: true, error: `plugin.json: ${e.message}`, log: [], rt: { subs: [], actions: {}, timers: new Set() } });
      continue;
    }
    if (PL.list.some(p => p.builtin && p.manifest.id === manifest.id)) continue;
    addPlugin({ manifest, code: f.code || '', dir: f.dir, builtin: false });
  }
  PL.loaded = true;
  startEnabled();
}

/* ---------- Settings, Plugins ---------- */
const plugField = (p, s) => {
  const v = (plugState().cfg[p.manifest.id] || {})[s.key] ?? s.default ?? (s.type === 'switch' ? false : '');
  const attrs = `data-chg="plug-set" data-id="${esc(p.manifest.id)}" data-k="${esc(s.key)}" aria-label="${esc(s.label || s.key)}"`;
  const ctl = s.type === 'switch' ? `<label class="switch"><input type="checkbox" ${attrs} ${v ? 'checked' : ''}><i></i></label>`
    : s.type === 'select' ? `<select class="sel" ${attrs}>${(s.options || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(v) === String(ov) ? 'selected' : ''}>${esc(t(ol))}</option>`; }).join('')}</select>`
    : s.type === 'textarea' ? `<textarea class="field-ta" rows="3" dir="ltr" ${attrs}>${esc(v)}</textarea>`
    : `<span class="field" style="width:100%"><input ${attrs} value="${esc(v)}" ${s.type === 'number' ? 'inputmode="numeric"' : ''} ${s.ltr !== false ? 'dir="ltr"' : ''}></span>`;
  return sRow(s.label || s.key, s.help || '', ctl, s.type === 'switch');
};
function plugCard(p) {
  const m = p.manifest, on = !!plugState().on[m.id];
  const perms = (m.permissions || []).map(k => `<span class="perm ${RISKY.includes(k) ? 'risky' : ''}">${ic(PERMS[k][0])}${t(PERMS[k][1])}</span>`).join('');
  return `<article class="plug ${on ? 'on' : ''} ${p.broken ? 'broken' : ''}">
    <div class="plug-h"><span class="plug-ic">${ic(m.icon && ICONS[m.icon] ? m.icon : 'plug')}</span>
      <div class="plug-id"><b>${esc(t(m.name))}</b><small><span class="ltr">${esc(m.version || '')}</span>${m.author ? ` · ${esc(m.author)}` : ''} · ${t(p.builtin ? 'Built-in' : 'From the plugins folder')}</small></div>
      <span class="sp"></span>${p.running ? `<span class="tag good">${t('Running')}</span>` : ''}
      <label class="switch"><input type="checkbox" data-chg="plug-on" data-id="${esc(m.id)}" ${on ? 'checked' : ''} ${p.broken ? 'disabled' : ''} aria-label="${t('Turn on')} ${esc(t(m.name))}"><i></i></label></div>
    ${m.description ? `<p class="sub">${esc(t(m.description))}</p>` : ''}
    ${perms ? `<div class="perms">${perms}</div>` : ''}
    ${p.error ? `<div class="plug-err">${ic('alert')}<span>${esc(p.error)}</span></div>` : ''}
    ${on && !p.broken ? `<div class="plug-body">${m.settings.map(s => plugField(p, s)).join('')}
      ${m.actions.length ? `<div class="row">${m.actions.map(a => `<button class="btn sm" data-act="plug-act" data-v="${esc(m.id)}|${esc(a.id)}" ${p.running ? '' : 'disabled'}>${a.icon && ICONS[a.icon] ? ic(a.icon) : ''}${esc(t(a.label || a.id))}</button>`).join('')}</div>` : ''}
      ${p.status ? `<pre class="plug-status" dir="auto">${esc(p.status)}</pre>` : ''}</div>` : ''}
    <div class="row plug-foot">${p.log.length ? `<details><summary>${t('Activity')} (${p.log.length})</summary><pre class="plug-log" dir="ltr">${esc(p.log.slice(-12).join('\n'))}</pre></details>` : ''}<span class="sp"></span>
      ${!p.builtin && NATIVE ? `<button class="btn sm danger" data-act="plug-remove" data-v="${esc(p.dir || m.id)}">${ic('trash')}${t('Remove')}</button>` : ''}</div>
  </article>`;
}
CAT_BODY.plugins = () => `<div class="ib-sample">${ic('plug')}<span>${t('Plugins add features to NOVA. Each one asks only for what it needs, and stays off until you turn it on.')}</span></div>
  <div class="row">${NATIVE ? `<button class="btn sm primary" data-act="plug-install">${ic('upload')}${t('Install plugin (.zip)')}</button><button class="btn sm" data-act="plug-folder">${ic('folder')}${t('Open plugins folder')}</button><button class="btn sm" data-act="plug-reload">${ic('refresh')}${t('Reload plugins')}</button>` : `<span class="hint">${t('Plugins from a folder load in the Windows app.')}</span>`}<button class="btn sm" data-act="plug-guide">${ic('text')}${t('How to write a plugin')}</button></div>
  <div class="plugs">${PL.list.map(plugCard).join('') || `<div class="empty">${ic('plug')}<span>${t('No plugins')}</span></div>`}</div>`;
CATS.splice(CATS.findIndex(c => c[0] === 'picons') + 1, 0, ['plugins', 'plug', 'Plugins']);

function setPluginOn(p, on) {
  plugState().on[p.manifest.id] = on;
  save();
  if (on) startPlugin(p); else stopPlugin(p);
  refresh();
}
CHG['plug-on'] = el => {
  const p = plugById(el.dataset.id);
  if (!p) return;
  if (!el.checked) { setPluginOn(p, false); return; }
  const risky = (p.manifest.permissions || []).filter(k => RISKY.includes(k));
  if (!risky.length) { setPluginOn(p, true); return; }
  el.checked = false;
  confirmBox({ title: `${t('Turn on')} ${t(p.manifest.name)}?`,
    msg: `${t('This plugin asks to')}: ${risky.map(k => t(PERMS[k][1])).join(', ')}. ${t(p.builtin ? 'It comes with NOVA.' : 'Turn it on only if you trust where it came from.')}`,
    yes: t('Turn on'), danger: false, onYes: () => setPluginOn(p, true) });
};
CHG['plug-set'] = el => {
  const p = plugById(el.dataset.id);
  if (!p) return;
  const s = p.manifest.settings.find(x => x.key === el.dataset.k);
  const v = el.type === 'checkbox' ? el.checked : s?.type === 'number' ? Number(el.value) : el.value;
  (plugState().cfg[p.manifest.id] ||= {})[el.dataset.k] = v;
  save();
  /* Typing fires on every key; the plugin hears about it once the typing stops. */
  clearTimeout(p.setTimer);
  p.setTimer = setTimeout(() => { if (p.running) for (const [ev, fn] of p.rt.subs) if (ev === 'settings') guard(p, fn, { key: el.dataset.k, value: v }); }, 800);
};
A['plug-act'] = el => {
  const [id, act] = el.dataset.v.split('|');
  const p = plugById(id);
  const fn = p?.running && p.rt.actions[act];
  if (fn) guard(p, fn); else toast(t('Turn the plugin on first.'), 'warn');
};
A['plug-folder'] = () => window.chrome?.webview?.postMessage({ cmd: 'openFolder', key: 'plugins' });
A['plug-reload'] = () => { window.chrome?.webview?.postMessage({ cmd: 'pluginsList' }); toast(t('Plugins reloaded'), 'good'); };
A['plug-remove'] = el => confirmBox({ title: t('Remove this plugin?'), msg: t('Its folder is deleted. Its settings are kept in case you install it again.'), yes: t('Remove'),
  onYes: () => { const p = PL.list.find(x => (x.dir || x.manifest.id) === el.dataset.v); if (p) { stopPlugin(p); plugState().on[p.manifest.id] = false; save(); } window.chrome.webview.postMessage({ cmd: 'pluginRemove', dir: el.dataset.v }); } });
A['plug-install'] = async () => {
  const [f] = await pickFiles('.zip,application/zip');
  if (!f) return;
  if (f.size > 20 * 1024 * 1024) { toast(t('That file is too large for a plugin.'), 'bad'); return; }
  const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(f); });
  const r = await hostAsk({ cmd: 'pluginInstall', b64 }, 60000);
  if (r.ok) toast(`${t('Plugin installed')}: ${r.dir}. ${t('Turn it on below.')}`, 'good');
  else toast(`${t('The plugin could not be installed')}: ${r.error || ''}`, 'bad');
};
A['plug-guide'] = () => openModal({ title: t('How to write a plugin'), width: 640, body: `<p class="sub">${t('Make a folder in the plugins folder with two files. NOVA lists it after Reload plugins.')}</p>
  <pre class="plug-log" dir="ltr">plugin.json
{
  "id": "my-plugin",
  "name": "My plugin",
  "version": "1.0.0",
  "permissions": ["channels", "player"],
  "settings": [{ "key": "msg", "label": "Message", "default": "Hello" }],
  "actions": [{ "id": "hello", "label": "Say it" }]
}

main.js
nova.onAction('hello', () => nova.toast(nova.settings.msg));
nova.on('channel', ch => nova.log('Now on', ch.name));
nova.on('recordingDone', r => nova.log('Saved', r.path));
nova.on('stop', () => nova.log('Bye'));</pre>
  <p class="sub">${t('Permissions')}: ${Object.entries(PERMS).map(([k, v]) => `<b class="ltr">${k}</b> ${t(v[1])}`).join(' · ')}</p>
  <p class="sub">${t('The full list of functions is in README.md in the plugins folder.')}</p>`,
  foot: `<button class="btn" data-act="modal-close">${t('Close')}</button>` });

/* Events for plugins: channel change, recordings, phone remote commands */
const tuneWithInfo = tune;
tune = id => { tuneWithInfo(id); const c = chById(id); if (c && S.player.ch === id) pluginEmit('channel', chInfo(c)); };
if (NATIVE) {
  window.chrome.webview.addEventListener('message', e => {
    const m = e.data;
    if (m.evt === 'plugins') { loadFolderPlugins(m.list, m.folder); }
    else if (m.evt === 'remoteCmd') pluginEmit('remote', { act: m.act, value: m.v });
    else if (m.evt === 'pluginInstalled' && m.id && HostReq.has(m.id)) { HostReq.get(m.id)(m); HostReq.delete(m.id); }
    else if ((m.evt === 'serverStatus' || m.evt === 'pluginExecDone') && m.id && HostReq.has(m.id)) { HostReq.get(m.id)(m); HostReq.delete(m.id); }
  });
}
