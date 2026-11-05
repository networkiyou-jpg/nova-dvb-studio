/* Core: state, persistence, helpers, shared UI (toasts, modals, popovers, tooltips, files). */
const STORE_KEY = 'nova-dvb-studio.v1';
const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => [...r.querySelectorAll(q)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const A = {};       /* click actions, keyed by data-act */
const CHG = {};     /* change/input actions, keyed by data-chg */

let S = load();
function load() {
  const base = seedState();
  if (NATIVE) return window.__NOVA_STATE?.v === 1 ? mergeState(base, window.__NOVA_STATE) : base;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 1) return mergeState(base, d);
    }
  } catch (e) { /* storage may be blocked; run from defaults */ }
  return base;
}
function mergeState(base, d) {
  const out = { ...base, ...d };
  for (const k of ['theme', 'layout', 'player', 'filter', 'settings']) out[k] = { ...base[k], ...(d[k] || {}) };
  return out;
}
/* Server passwords are never written to browser storage in this preview. */
const secretFilter = (k, v) => (k === 'pass' ? undefined : v);
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (NATIVE) { window.chrome.webview.postMessage({ cmd: 'saveState', state: JSON.parse(JSON.stringify(S, secretFilter)) }); return; }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S, secretFilter)); } catch (e) { /* see load() */ }
  }, 180);
}
const chById = id => S.channels.find(c => c.id === id);
const satById = id => S.sats.find(s => s.id === id);
const curCh = () => chById(S.player.ch) || S.channels[0];
const satLabel = s => s ? `${s.name} (${s.pos.toFixed(1)}°${s.dir})` : '—';
function tpOf(ch) {
  const s = satById(ch?.sat);
  if (!s) return null;
  if (ch.f) return s.tps.find(p => p.freq === ch.f && p.pol === ch.p) || null;
  return s.tps[ch.tp % Math.max(1, s.tps.length)];
}
const polName = p => ({ H: 'H (Horizontal)', V: 'V (Vertical)', L: 'L (Circular left)', R: 'R (Circular right)' }[p] || p);
const isDemoLive = () => S.mode === 'live';
const hasDevice = () => S.mode !== 'nodevice';

/* Time formatting uses the viewer's clock, so now/next is always current. */
const locale = () => (S.lang === 'ar' ? 'ar-MA-u-nu-latn' : 'en-GB');
const fmtTime = d => new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDay = d => new Date(d).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayShort = d => new Date(d).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });

/* Sample EPG, generated from the current date so now/next and progress stay truthful to the clock. */
const EPG_CACHE = {};
function epgFor(ch) {
  if (NATIVE || !ch) return [];
  const dayKey = new Date().toDateString() + ch.id;
  if (EPG_CACHE[dayKey]) return EPG_CACHE[dayKey];
  const titles = EPG_TITLES[ch.kind] || EPG_TITLES.news;
  const seed = parseInt(ch.id.slice(2), 10) || 1;
  const list = [];
  const durs = [60, 90, 45, 120, 30, 60];
  let t;
  if (ch.id === 'ch1') { t = Math.floor(Date.now() / 72e5) * 72e5 - 864e5 / 4; }
  else { const d = new Date(); d.setHours(0, 0, 0, 0); t = d.getTime() - 3 * 36e5; }
  const end = Date.now() + 2 * 864e5;
  let i = 0;
  while (t < end) {
    const dur = ch.id === 'ch1' ? [120, 60, 60, 60][i % 4] : durs[(i + seed) % durs.length];
    const title = ch.id === 'ch1' ? titles[i % 4] : titles[(i * 5 + seed) % titles.length];
    list.push({ id: `${ch.id}-${t}`, ch: ch.id, title, start: t, end: t + dur * 6e4, desc: EPG_DESC });
    t += dur * 6e4; i++;
  }
  EPG_CACHE[dayKey] = list;
  return list;
}
function nowNext(ch, n = 2) {
  const list = epgFor(ch), now = Date.now();
  const i = list.findIndex(p => p.end > now);
  return list.slice(Math.max(0, i), i + n);
}

/* Toasts */
function toast(msg, kind = 'info') {
  const icon = { good: 'check', bad: 'alert', warn: 'alert', info: 'info' }[kind];
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${ic(icon)}<div>${esc(msg)}</div>`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3800);
}

/* Modals */
const modals = [];
function openModal({ title, body, foot = '', width = 520, onOpen, id = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'scrim';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="--mw:${width}px" ${id ? `id="${id}"` : ''}>
    <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="modal-close" aria-label="${t('Close')}" data-tip="${t('Close')}">${ic('x')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeModal(); });
  document.body.append(wrap);
  modals.push(wrap);
  const f = wrap.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
  if (f) f.focus();
  onOpen?.(wrap);
  return wrap;
}
function closeModal() { modals.pop()?.remove(); hideTip(); }
A['modal-close'] = () => closeModal();
function confirmBox({ title, msg, yes, danger = true, onYes }) {
  const id = uid('c');
  A[id] = () => { closeModal(); delete A[id]; onYes(); };
  openModal({ title, width: 430, body: `<p class="sub">${esc(msg)}</p>`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="${id}">${esc(yes)}</button>` });
}
function formVals(root) {
  const o = {};
  $$('[name]', root).forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
  return o;
}
const field = (label, name, val = '', extra = '') => `<label class="field"><span>${t(label)}</span><input id="f-${name}" name="${name}" value="${esc(val)}" autocomplete="off" ${extra}><small class="err" data-err="${name}"></small></label>`;
const selectF = (label, name, opts, val, extra = '') => `<label class="field"><span>${t(label)}</span><select id="f-${name}" name="${name}" ${extra}>${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t(l))}</option>`; }).join('')}</select></label>`;
function setErr(root, name, msg) {
  const el = $(`[data-err="${name}"]`, root), inp = $(`[name="${name}"]`, root);
  if (el) { el.textContent = msg || ''; el.className = 'err'; }
  inp?.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

/* Popover menus anchored to a control */
let popEl = null;
function openPop(anchor, html) {
  closePop();
  popEl = document.createElement('div');
  popEl.className = 'pop';
  popEl.innerHTML = html;
  document.body.append(popEl);
  const r = anchor.getBoundingClientRect(), p = popEl.getBoundingClientRect();
  let x = r.right - p.width, y = r.bottom + 6;
  if (S.lang === 'ar') x = r.left;
  if (y + p.height > innerHeight - 8) y = Math.max(8, r.top - p.height - 6);
  popEl.style.left = clamp(x, 8, innerWidth - p.width - 8) + 'px';
  popEl.style.top = y + 'px';
  return popEl;
}
function closePop() { popEl?.remove(); popEl = null; }
const mi = (act, label, opts = {}) => `<button class="mi" role="menuitem" data-act="${act}" ${opts.v !== undefined ? `data-v="${esc(opts.v)}"` : ''} ${opts.checked !== undefined ? `role="menuitemradio" aria-checked="${opts.checked}"` : ''}>${opts.icon ? ic(opts.icon) : ''}<span>${esc(t(label))}</span>${opts.checked ? `<span class="sp"></span>${ic('check')}` : ''}</button>`;

/* Tooltip */
let tipEl = null, tipTimer = 0;
function hideTip() { clearTimeout(tipTimer); tipEl?.remove(); tipEl = null; }
document.addEventListener('mouseover', e => {
  const el = e.target.closest?.('[data-tip]');
  if (!el) { hideTip(); return; }
  if (tipEl?.dataset.for === el.dataset.tip) return;
  hideTip();
  tipTimer = setTimeout(() => {
    if (!el.isConnected) return;
    tipEl = document.createElement('div');
    tipEl.id = 'tip'; tipEl.dataset.for = el.dataset.tip; tipEl.textContent = el.dataset.tip;
    document.body.append(tipEl);
    const r = el.getBoundingClientRect(), p = tipEl.getBoundingClientRect();
    tipEl.style.left = clamp(r.left + r.width / 2 - p.width / 2, 6, innerWidth - p.width - 6) + 'px';
    let y = r.bottom + 7; if (y + p.height > innerHeight - 6) y = r.top - p.height - 7;
    tipEl.style.top = y + 'px';
  }, 380);
});

/* Files. A published page cannot start its own download, so saving goes through the
   viewer's downloads capability, with a copy box as the fallback. */
async function saveFile(filename, text) {
  let dl = null;
  try {
    if (window.claude?.use) dl = await Promise.race([window.claude.use('downloads'), new Promise(r => setTimeout(() => r(null), 2500))]);
  } catch (e) { dl = null; }
  if (dl) {
    try {
      await dl.save({ filename, data: new Blob([text], { type: 'application/json' }) });
      toast(`${t('Saved')} ${filename}`, 'good');
      return;
    } catch (e) { if (e?.code === 'declined' || e?.name === 'AbortError') return; }
  }
  const id = uid('cp');
  A[id] = async () => {
    const ta = $(`#${id}-t`);
    try { await navigator.clipboard.writeText(ta.value); toast(t('Copied to clipboard'), 'good'); }
    catch (e) { ta.select(); toast(t('Text selected. Press Ctrl+C to copy.')); }
  };
  openModal({ title: `${t('Export')}: ${filename}`, width: 640,
    body: `<p class="sub">${t('This preview cannot save files directly here. Copy the content and keep it as a file.')}</p>
      <label class="field"><span>${esc(filename)}</span><textarea id="${id}-t" rows="12" class="mono" readonly>${esc(text)}</textarea></label>`,
    foot: `<button class="btn" data-act="modal-close">${t('Close')}</button><button class="btn primary" data-act="${id}">${ic('copy')}${t('Copy')}</button>` });
}
function pickFiles(accept, multiple = false) {
  return new Promise(res => {
    const i = $('#file-pick');
    i.value = ''; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res([...i.files]);
    i.click();
  });
}
const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
const readURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

/* Picon */
function picon(ch, opts = {}) {
  const v = S.picons[ch.id];
  if (v && v !== 'auto') return `<span class="picon"><img src="${esc(v)}" alt="${esc(ch.name)}"></span>`;
  if (v === 'auto') return `<span class="picon" style="background:linear-gradient(120deg,${ch.p1},${ch.p2})" aria-hidden="true">${esc(ch.code)}${ch.num ? `<em>${esc(ch.num)}</em>` : ''}</span>`;
  return `<span class="picon missing" aria-hidden="true">${esc(ch.code)}</span>`;
}

/* Common page header */
const pageHead = (icon, title, sub, actions = '') => `<header class="card page-head"><span class="ph-ic">${ic(icon)}</span><div class="titles"><h1>${t(title)}</h1><p>${t(sub)}</p></div><div class="row">${actions}</div></header>`;
const stateTag = (kind, label, icon) => `<span class="state ${kind}">${icon ? ic(icon) : ''}${t(label)}</span>`;
const needDevice = () => (hasDevice() ? '' : 'disabled');
const demoNote = msg => `<div class="note warn">${ic('alert')}<div>${t(msg)}</div></div>`;
