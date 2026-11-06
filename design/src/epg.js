/* Program guide data. In the Windows app it comes from the broadcast (EIT, read by the engine while a
   channel is tuned) or from an XMLTV file or address. The browser preview keeps its sample listings
   until real listings are loaded. Events are kept per service (transport stream and service id) or,
   for XMLTV, per channel. */
const EPGD = { map: new Map(), ver: 0, dirty: false };
const EPG_LIST = new Map();
const epgKey = (tsid, sid) => `${tsid}:${sid}`;

function epgIngest(key, events) {
  let m = EPGD.map.get(key);
  if (!m) EPGD.map.set(key, m = new Map());
  for (const e of events) {
    if (!(e.end > e.start) || !e.title) continue;
    for (const [s, o] of m) if (s !== e.start && o.start < e.end && e.start < o.end) m.delete(s);   /* a changed schedule replaces what overlaps */
    m.set(e.start, e);
  }
  EPGD.ver++; EPGD.dirty = true;
}
function liveEpg(ch) {
  const c = EPG_LIST.get(ch.id);
  if (c && c.v === EPGD.ver) return c.list;
  const out = [], seen = new Set();
  for (const k of ['ch:' + ch.id, ch.tsid != null && ch.sid != null ? epgKey(ch.tsid, ch.sid) : '']) {
    const m = k && EPGD.map.get(k);
    if (!m) continue;
    for (const e of m.values()) {
      if (seen.has(e.start)) continue;
      seen.add(e.start);
      out.push({ id: `${ch.id}-${e.start}`, ch: ch.id, title: e.title, start: e.start, end: e.end, desc: e.desc || '', genre: e.genre || 0 });
    }
  }
  out.sort((a, b) => a.start - b.start);
  EPG_LIST.set(ch.id, { v: EPGD.ver, list: out });
  return out;
}
const sampleEpgFor = epgFor;
epgFor = ch => {
  if (!ch) return [];
  const list = liveEpg(ch);
  return list.length || NATIVE ? list : sampleEpgFor(ch);
};
const hasLiveEpg = () => EPGD.map.size > 0;

function epgPrune() {
  const lo = Date.now() - 6 * 36e5, hi = Date.now() + (Number(S.settings.epgDays) || 7) * 864e5;
  for (const m of EPGD.map.values()) for (const [s, e] of m) if (e.end < lo || e.start > hi) m.delete(s);
  for (const [k, m] of EPGD.map) if (!m.size) EPGD.map.delete(k);
  EPGD.ver++;
}
function epgClear() { EPGD.map.clear(); EPGD.ver++; EPGD.dirty = true; epgPersist(true); }

/* Engine events: { onid, tsid, sid, id, start (Unix seconds), duration, title, text, genre } */
function epgFromEngine(events) {
  const by = new Map();
  for (const e of events) {
    const k = epgKey(e.tsid, e.sid);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push({ start: e.start * 1000, end: (e.start + e.duration) * 1000, title: e.title, desc: e.text || '', genre: e.genre || 0 });
  }
  for (const [k, list] of by) epgIngest(k, list);
  epgRefreshViews();
}
let epgViewTimer = 0;
function epgRefreshViews() {
  clearTimeout(epgViewTimer);
  epgViewTimer = setTimeout(() => {
    if (S.view === 'live') { renderNow(); renderCards(); } else if (S.view === 'epg') refresh();
  }, 400);
}

/* Saving: the Windows app keeps the guide in its database, the preview in this browser. */
const EPG_STORE = 'nova-dvb-studio.epg';
function epgPack() {
  epgPrune();
  return { v: 1, at: Date.now(), items: [...EPGD.map].map(([k, m]) => [k, [...m.values()].map(e => [e.start, e.end, e.title, (e.desc || '').slice(0, 400), e.genre || 0])]) };
}
function epgUnpack(d) {
  if (!d || d.v !== 1 || !Array.isArray(d.items)) return;
  for (const [k, list] of d.items) epgIngest(k, list.map(([start, end, title, desc, genre]) => ({ start, end, title, desc, genre })));
  epgPrune();
  EPGD.dirty = false;
}
function epgPersist(force) {
  if (!EPGD.dirty && !force) return;
  EPGD.dirty = false;
  if (NATIVE) { window.chrome.webview.postMessage({ cmd: 'epgSave', data: epgPack() }); return; }
  try { localStorage.setItem(EPG_STORE, JSON.stringify(epgPack())); } catch (e) { /* storage full or blocked: the guide stays in memory */ }
}
setInterval(() => epgPersist(false), 60000);
if (!NATIVE) { try { epgUnpack(JSON.parse(localStorage.getItem(EPG_STORE) || 'null')); } catch (e) { /* no saved guide */ } }

/* ---------- XMLTV ---------- */
const xmltvTime = s => {
  const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*([+-]\d{4})?/.exec(s || '');
  if (!m) return NaN;
  const off = m[7] ? (m[7][0] === '-' ? -1 : 1) * (Number(m[7].slice(1, 3)) * 60 + Number(m[7].slice(3))) : 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - off * 6e4;
};
const nameKey = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
const nameKeyLoose = s => nameKey(String(s || '').replace(/\b(f?hd|uhd|4k|sd|tv)\b/gi, ''));
/* Matches XMLTV channels to yours by name, with and without HD or TV in it. */
function applyXmltv(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('tv')) throw new Error('not xmltv');
  const ours = new Map();
  S.channels.forEach(c => { for (const k of [nameKey(c.name), nameKeyLoose(c.name)]) if (k && !ours.has(k)) ours.set(k, c); });
  const map = new Map();
  $$('channel', doc).forEach(x => {
    const id = x.getAttribute('id');
    for (const n of [...$$('display-name', x).map(d => d.textContent), id]) {
      const c = ours.get(nameKey(n)) || ours.get(nameKeyLoose(n));
      if (c) { map.set(id, c); break; }
    }
  });
  const by = new Map();
  $$('programme', doc).forEach(p => {
    const c = map.get(p.getAttribute('channel'));
    if (!c) return;
    const start = xmltvTime(p.getAttribute('start')), end = xmltvTime(p.getAttribute('stop'));
    if (!(end > start)) return;
    if (!by.has(c.id)) by.set(c.id, []);
    by.get(c.id).push({ start, end, title: p.querySelector('title')?.textContent?.trim() || '', desc: (p.querySelector('desc')?.textContent || '').trim().slice(0, 600), genre: 0 });
  });
  let progs = 0;
  for (const [id, list] of by) { epgIngest('ch:' + id, list); progs += list.length; }
  epgPrune(); epgPersist(true); epgRefreshViews();
  return { chans: by.size, progs };
}
/* Fetches text through the Windows app (no browser limits on other sites) or, in the preview, directly. */
const HostReq = new Map();
/* A request to the Windows app, answered by an event carrying the same id. It gives up after a while,
   so a lost answer never leaves the interface waiting. */
function hostAsk(msg, ms = 90000) {
  return new Promise(res => {
    const id = uid('rq');
    const timer = setTimeout(() => { if (HostReq.delete(id)) res({ ok: false, timeout: true }); }, ms);
    HostReq.set(id, m => { clearTimeout(timer); res(m); });
    window.chrome.webview.postMessage({ ...msg, id });
  });
}
function getText(url, opts = {}) {
  if (NATIVE) {
    return hostAsk({ cmd: 'fetchText', url, ...opts }, 120000);
  }
  return fetch(url).then(async r => ({ ok: r.ok, text: r.ok ? await r.text() : '' })).catch(() => ({ ok: false, text: '' }));
}
async function readMaybeGz(f) {
  if (!/\.gz$/i.test(f.name) || !window.DecompressionStream) return readText(f);
  return new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
async function loadXmltv(fromFile) {
  let text = '';
  if (fromFile) {
    const [f] = await pickFiles('.xml,.gz,.xmltv,application/xml,text/xml'); if (!f) return;
    try { text = await readMaybeGz(f); } catch (e) { toast(t('That file could not be read.'), 'bad'); return; }
  } else {
    const url = String(S.settings.epgUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) { toast(t('Enter an XMLTV address that starts with http:// or https://'), 'warn'); return; }
    toast(t('Downloading listings'));
    const r = await getText(url);
    if (!r.ok) { toast(t('Could not download the listings. Check the address and the internet connection.'), 'bad'); return; }
    text = r.text;
  }
  try {
    const r = applyXmltv(text);
    toast(`${r.progs} ${t('programs for')} ${r.chans} ${t('channels')}`, r.progs ? 'good' : 'warn');
  } catch (e) { toast(t('That is not an XMLTV guide.'), 'bad'); }
}
A['epg-xmltv-file'] = () => loadXmltv(true);
A['epg-xmltv-url'] = () => loadXmltv(false);
A['epg-clear'] = () => confirmBox({ title: t('Clear all listings?'), msg: t('Listings from the broadcast come back while a channel is tuned.'), yes: t('Clear'), onYes: () => { epgClear(); refresh(); toast(t('Listings cleared'), 'good'); } });

/* XMLTV from an address refreshes itself every six hours when the setting asks for it. */
setInterval(() => { if (S.settings.epgSource === 'XMLTV address' && S.settings.epgUpdate === 'On a schedule' && S.settings.epgUrl) loadXmltv(false); }, 6 * 36e5);
