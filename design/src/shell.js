/* App shell: top bar, sidebar, status strip, routing, and the Live TV screen. */
const NAV = [
  ['live', 'tv', 'Live TV'], ['satellites', 'sat', 'Satellites'], ['channels', 'list', 'Channels'], ['epg', 'cal', 'EPG'], ['recordings', 'rec', 'Recordings'],
  ['cam', 'tag', 'CAM / CCcam'], ['biss', 'key', 'BISS'], ['picons', 'pic', 'Picons'], ['skins', 'skin', 'Skins'], ['preferences', 'gear', 'Settings'],
];
const SIDE = [
  ['live', 'tv', 'Live TV'], ['channels', 'list', 'Channel Manager'], ['satellites', 'sat', 'Satellite Manager'], ['scan', 'dish', 'Transponder Scan'], ['cam', 'card', 'CAM / CCcam'],
  ['biss', 'key', 'BISS Manager'], ['picons', 'pic', 'Picons Manager'], ['recordings', 'rec', 'Recordings'], ['epg', 'cal', 'EPG (Program Guide)'], ['skins', 'skin', 'Skins & Themes'], ['backup', 'disk', 'Backup & Restore'],
];
const SCREENS = {};  /* filled by screens/*.js: name -> render() returning HTML */
const VIEWS = ['live', 'satellites', 'scan', 'channels', 'epg', 'recordings', 'cam', 'biss', 'picons', 'skins', 'preferences', 'backup'];
let preview = null;  /* skin being previewed before it is applied */

const LOGO = `<svg class="brand-mark" viewBox="0 0 96 80" aria-hidden="true"><defs>
  <linearGradient id="lgA" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#28B8FF"/><stop offset="1" stop-color="#7868F0"/></linearGradient>
  <linearGradient id="lgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E05CF0"/><stop offset=".55" stop-color="#7868F0"/><stop offset="1" stop-color="#28B8FF"/></linearGradient>
  <linearGradient id="lgC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#C9B8FF"/><stop offset="1" stop-color="#7868F0"/></linearGradient></defs>
  <path d="M4 72C8 44 16 16 30 7c7-4 12 2 16 12l13 31c2 5 4 7 6 7-3 11-11 16-19 9-5-5-7-11-10-19L28 28C21 38 16 54 15 72z" fill="url(#lgB)"/>
  <path d="M6 72C10 46 17 21 30 9c-3 8-9 29-11 63z" fill="url(#lgA)" opacity=".92"/>
  <path d="M92 6C86 30 79 56 66 68c-5 4-9 2-11-4 7-3 13-21 18-46 3-9 10-13 19-12z" fill="url(#lgC)"/></svg>`;
const DISH = `<svg class="dish" viewBox="0 0 220 190" aria-hidden="true"><defs>
  <radialGradient id="dA" cx=".62" cy=".42" r=".72"><stop offset="0" stop-color="#e9ecff"/><stop offset=".42" stop-color="#9aa5e4"/><stop offset=".8" stop-color="#5a44c8"/><stop offset="1" stop-color="#2a2170"/></radialGradient>
  <linearGradient id="dB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c7b8ff"/><stop offset="1" stop-color="#3a2c9e"/></linearGradient>
  <linearGradient id="dC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3f7a"/><stop offset="1" stop-color="#14183a"/></linearGradient>
  <radialGradient id="dD" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7868F0" stop-opacity=".85"/><stop offset="1" stop-color="#7868F0" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="112" cy="172" rx="100" ry="15" fill="url(#dD)"/>
  <path d="M88 170l12-52h26l14 52z" fill="url(#dC)"/><path d="M74 171c10-7 70-7 82 0-14 7-68 7-82 0z" fill="#2a2e66"/>
  <rect x="98" y="100" width="28" height="24" rx="5" fill="url(#dC)" stroke="#6b5fd6" stroke-width="1"/>
  <ellipse cx="104" cy="66" rx="66" ry="48" transform="rotate(-28 104 66)" fill="url(#dA)"/>
  <ellipse cx="104" cy="66" rx="66" ry="48" transform="rotate(-28 104 66)" fill="none" stroke="#dfe2ff" stroke-width="2.5"/>
  <g transform="rotate(-28 104 66)" fill="none" stroke="#3a2c9e" stroke-opacity=".38" stroke-width="1"><ellipse cx="104" cy="66" rx="54" ry="39"/><ellipse cx="104" cy="66" rx="41" ry="30"/><ellipse cx="104" cy="66" rx="28" ry="20"/><ellipse cx="104" cy="66" rx="14" ry="10"/><path d="M38 66h132M104 18v96M57 32l94 68M57 100l94-68"/></g>
  <circle cx="104" cy="66" r="5" fill="#2a2170"/>
  <path d="M110 76l52-32" stroke="url(#dB)" stroke-width="4" stroke-linecap="round"/><path d="M92 100l70-56M136 96l26-52" stroke="#7a70d8" stroke-width="2"/>
  <rect x="156" y="28" width="26" height="17" rx="5" transform="rotate(-30 169 36)" fill="url(#dB)"/><circle cx="178" cy="29" r="3" fill="#28B8FF"/></svg>`;
const TOPART = `<svg class="top-art" preserveAspectRatio="none" viewBox="0 0 1672 104" aria-hidden="true"><defs>
  <linearGradient id="tA" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0"/><stop offset=".4" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)" stop-opacity=".1"/></linearGradient>
  <linearGradient id="tB" x1="0" x2="1"><stop offset="0" stop-color="var(--accent-2)" stop-opacity=".1"/><stop offset=".6" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient>
  <filter id="tG" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
  <path d="M0 100H270C300 100 320 52 348 0" fill="none" stroke="url(#tA)" stroke-width="2.4"/>
  <path d="M0 100H270C300 100 320 52 348 0" fill="none" stroke="url(#tA)" stroke-width="7" filter="url(#tG)" opacity=".55"/>
  <path d="M1420 100C1470 98 1490 44 1520 0" fill="none" stroke="url(#tB)" stroke-width="2.4"/>
  <path d="M1420 100C1470 98 1490 44 1520 0" fill="none" stroke="url(#tB)" stroke-width="7" filter="url(#tG)" opacity=".55"/></svg>`;

function renderChrome() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  $('#app').className = `app ${S.layout.sidebar ? '' : 'no-side'} ${theater ? 'theater' : ''}`;
  $('#top').innerHTML = `${TOPART}
    <button class="brand" data-act="go" data-v="live" aria-label="NOVA DVB Studio">${LOGO}<span class="brand-word"><b>NOVA</b><span>DVB Studio</span><small>${t('Professional Satellite TV Solution')}</small></span></button>
    <nav class="nav" aria-label="${t('Main sections')}">${NAV.map(([v, i, l]) => `<button data-act="go" data-v="${v}" ${S.view === v ? 'aria-current="page"' : ''}>${ic(i)}<span>${t(l)}</span></button>`).join('')}</nav>
    <div class="top-end"><div class="winbar">
      <button data-act="about" aria-label="${t('About')}" data-tip="${t('About')}">${ic('info')}</button>
      <button data-act="win-min" aria-label="${t('Minimize')}" data-tip="${t('Minimize')}">${ic('min')}</button>
      <button data-act="win-max" aria-label="${t('Maximize')}" data-tip="${t('Maximize')}">${ic('max')}</button>
      <button class="x" data-act="win-close" aria-label="${t('Close')}" data-tip="${t('Close')}">${ic('x')}</button>
    </div><div class="clock ltr" id="clock"></div><div class="date" id="date"></div></div>`;
  $('#side').innerHTML = `<nav class="side-nav" aria-label="${t('Sections')}">${SIDE.map(([v, i, l]) => `<button data-act="go" data-v="${v}" ${S.view === v ? 'aria-current="page"' : ''} data-tip="${t(l)}">${ic(i)}<span>${t(l)}</span>${ic('chev', 'chev')}</button>`).join('')}</nav>
    <div class="side-foot">${DISH}<b>NOVA DVB Studio</b><small>v1.0.0 &nbsp;•&nbsp; ${t('Professional Edition')}</small></div>`;
  renderStatus();
  tickClock();
}
function tickClock() {
  const c = $('#clock'), d = $('#date');
  if (c) { const n = new Date(); c.textContent = fmtTime(n); d.textContent = fmtDay(n); }
}
function renderStatus() {
  const m = S.mode, ch = curCh();
  const std = hasDevice() ? tpOf(ch)?.std || '—' : '—';
  const st = m === 'live' ? stateTag('good', 'Running', 'circle') : m === 'lost' ? stateTag('bad', 'No signal', 'alert') : m === 'ready' ? stateTag('idle', 'Ready', 'circle') : stateTag('idle', 'No device', 'unplug');
  const sim = stat => (m === 'nodevice' ? '—' : stat);
  const es = NATIVE ? Engine.stats : {};
  const cpu = NATIVE ? es.cpu : m === 'nodevice' ? null : 12, ram = NATIVE ? es.ram : m === 'nodevice' ? null : 34;
  const rate = NATIVE ? (Engine.signal?.bitrateKbps || 0) / 1000 : m === 'live' ? ch.kbps / 1000 : 0;
  $('#status').innerHTML = `<span class="st-std ltr">${esc(std)}</span><span>${hasDevice() ? t('Tuner A') : t('No tuner')}</span>${st}
    ${NATIVE ? '' : `<button class="state-btn" data-act="mode-menu" data-tip="${t('Choose which app state to review')}">${ic('alert')}${t(MODE_LABEL[m])}${ic('down')}</button>`}
    <span class="sp"></span>
    <span class="st-meter"><span>CPU: <span id="st-cpu">${cpu == null ? '—' : `${cpu}%`}</span></span><span class="bar"><i id="st-cpu-b" style="width:${cpu || 0}%"></i></span></span>
    <span class="st-meter ram"><span>RAM: <span id="st-ram">${ram == null ? '—' : `${ram}%`}</span></span><span class="bar"><i id="st-ram-b" style="width:${ram || 0}%"></i></span></span>
    <span class="st-rate" ${NATIVE ? '' : `data-tip="${t('Sample figure in this preview')}"`}>${ic('drive')}<span class="ltr" id="st-disk">${NATIVE ? (es.drive ? `${es.drive} ${es.freeGb} GB` : '—') : `C: ${sim('120.5 GB')}`}</span> ${t('Free')}</span>
    <span class="st-rate" data-tip="${t('Stream bitrate')}">${ic('dl')}<span class="ltr" id="st-down">${rate.toFixed(2)} Mb/s</span></span>
    <span class="st-rate up">${ic('ul')}<span class="ltr">0.00 Mb/s</span></span>`;
}
const MODE_LABEL = { live: 'Demo data', lost: 'Demo: signal lost', nodevice: 'Real state: no device' };
A['mode-menu'] = el => openPop(el, `<h4>${t('Review state')}</h4>
  ${mi('set-mode', 'Demo data', { v: 'live', checked: S.mode === 'live', icon: 'tv' })}
  ${mi('set-mode', 'Demo: signal lost', { v: 'lost', checked: S.mode === 'lost', icon: 'alert' })}
  ${mi('set-mode', 'Real state: no device', { v: 'nodevice', checked: S.mode === 'nodevice', icon: 'unplug' })}
  <div class="hint" style="padding:6px 9px;max-width:270px">${t('No tuner is connected to this preview. Demo data is invented and exists only to review the design.')}</div>`);
A['set-mode'] = el => { S.mode = el.dataset.v; save(); closePop(); renderAll(); };

/* Routing. The hash keeps a screen bookmarkable. */
function go(v, push = true) {
  if (!VIEWS.includes(v)) v = 'live';
  closePop();
  S.view = v; save();
  if (push) { try { history.replaceState(null, '', '#' + v); } catch (e) { /* preview frames can refuse this */ } }
  renderAll();
}
A.go = el => { if (theater) setTheater(false); go(el.dataset.v); };
addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== S.view) go(v, false); });

function renderView() {
  const liveEl = $('#view-live'), host = $('#view-host');
  liveEl.hidden = S.view !== 'live';
  host.hidden = S.view === 'live';
  if (S.view === 'live') { renderLive(); return; }
  host.innerHTML = `<div class="view">${SCREENS[S.view]()}</div>`;
  SCREENS[S.view].mount?.();
}
function refresh() { if (S.view !== 'live') { const sc = {}; $$('#view-host .scroll, #view-host .tbl-wrap, #view-host .epg-grid').forEach((el, i) => { sc[i] = [el.scrollTop, el.scrollLeft]; }); renderView(); $$('#view-host .scroll, #view-host .tbl-wrap, #view-host .epg-grid').forEach((el, i) => { if (sc[i]) { el.scrollTop = sc[i][0]; el.scrollLeft = sc[i][1]; } }); } }
function renderAll() { applyTheme(preview || S.theme); renderChrome(); renderView(); }

/* Theme: only attributes and variables on the root change */
function applyTheme(th) {
  const r = document.documentElement;
  r.setAttribute('data-nova-theme', th.id);
  r.setAttribute('data-bg', th.bg);
  r.setAttribute('data-cards', th.cards);
  r.setAttribute('data-icons', th.icons);
  r.setAttribute('data-density', th.density);
  r.style.setProperty('--ui', th.font / 100);
  if (th.accent) { r.style.setProperty('--accent', th.accent); r.style.setProperty('--grad', `linear-gradient(100deg, color-mix(in srgb, ${th.accent} 80%, black), ${th.accent})`); }
  else { r.style.removeProperty('--accent'); r.style.removeProperty('--grad'); }
}

/* ---------- Live TV ---------- */
let theater = false, tuning = false, recording = null, liveBuilt = false;

function renderLive() {
  const L = S.layout, root = $('#view-live');
  if (!liveBuilt) {
    root.innerHTML = `<div class="live" id="live">
      <section class="card vid" id="p-video" aria-label="${t('Video player')}">
        <div class="vid-head" id="vid-head"></div>
        <div class="stage" id="stage"><canvas id="cv" aria-label="${t('Video picture')}"></canvas><div id="osd"></div><div id="stage-over"></div><div class="controls" id="controls"></div></div>
      </section>
      <section class="card list" id="p-list" aria-label="${t('Channel list')}"></section>
      <section class="card now" id="p-now"></section>
      <div class="cards3" id="p-cards"></div></div>`;
    Video.attach($('#cv'));
    liveBuilt = true;
  }
  const live = $('#live');
  live.classList.toggle('no-list', !L.list);
  live.classList.toggle('no-video', !L.video);
  $('#p-video').hidden = !L.video; $('#p-list').hidden = !L.list; $('#p-now').hidden = !L.now;
  renderPlayer(); renderList(); renderNow(); renderCards();
}
function renderPlayer() {
  if (!$('#p-video')) return;
  const ch = curCh(), p = S.player, m = S.mode;
  if (ch) Video.setKind(ch.kind);
  $('#vid-head').innerHTML = `${ic('tv', 'tv')}<h2>${ch && hasDevice() ? esc(ch.name) : t('No channel')}</h2>${NATIVE && m === 'live' && p.playing ? `<span class="tag live" style="font-size:12px">${t('LIVE')}</span>` : ''}${NATIVE && recording ? `<span class="tag rec"><i></i>REC</span>` : ''}<span class="sp"></span>
    <button class="icon-btn" data-act="customize" aria-label="${t('Customize layout')}" data-tip="${t('Customize layout')}">${ic('layout')}</button>
    <button class="icon-btn" data-act="vid-collapse" aria-label="${t('Hide video panel')}" data-tip="${t('Hide video panel')}">${ic('min')}</button>
    <button class="icon-btn" data-act="stop" aria-label="${t('Stop playback')}" data-tip="${t('Stop playback')}">${ic('x')}</button>`;
  const stage = $('#stage');
  stage.dataset.aspect = p.aspect;
  const showLive = m === 'live' && p.playing;
  $('#osd').innerHTML = !NATIVE && ch && hasDevice() && m === 'live' ? `<div class="osd-tl">${picon(ch)}<span class="osd-name">${esc(ch.name)}</span></div>
    <div class="osd-tr">${recording ? `<span class="tag rec"><i></i>REC</span>` : ''}<span class="tag demo">${t('DEMO')}</span>${showLive ? `<span class="tag live">${t('LIVE')}</span>` : ''}</div>` : '';
  let over = '';
  if (!hasDevice()) over = `<div class="overlay solid"><div>${ic('unplug').replace('class="i ', 'style="font-size:40px;color:#7868F0" class="i ')}<h3>${t('No satellite tuner found')}</h3>
    <p>${t('Connect a DVB-S/S2 card with a BDA driver, then detect it again. NOVA shows only what the driver reports.')}</p>
    <div class="row"><button class="btn primary" data-act="detect">${ic('refresh')}${t('Detect again')}</button><button class="btn" data-act="open-settings" data-v="devices">${t('Device settings')}</button></div></div></div>`;
  else if (m === 'ready' || !ch) over = `<div class="overlay solid"><div>${ic('dish').replace('class="i ', 'style="font-size:40px;color:#7868F0" class="i ')}<h3>${t('Tuner ready')}</h3>
    <p>${t(ch ? 'Pick a channel from the list.' : 'Set your LNB and DiSEqC, then scan a satellite to fill your channel list.')}</p>
    <div class="row"><button class="btn primary" data-act="go" data-v="scan">${t('Open Transponder Scan')}</button></div></div></div>`;
  else if (m === 'lost') over = `<div class="overlay solid"><div><div class="radar"></div><h3>${t('Signal lost')}</h3>
    <p>${t('The tuner lost lock on this transponder. NOVA keeps retrying and resumes the picture when the signal returns.')}</p>
    ${NATIVE ? '' : `<div class="row"><button class="btn" data-act="set-mode" data-v="live">${t('Simulate signal back')}</button></div>`}</div></div>`;
  else if (tuning) over = `<div class="overlay"><div><div class="radar"></div><h3>${t('Tuning')}</h3><p class="ltr">${esc(tuneLine(ch))}</p></div></div>`;
  else if (!p.playing) over = `<div class="overlay"><div><button class="icon-btn" style="width:66px;height:66px;font-size:32px;border-radius:50%;background:var(--grad);color:#fff" data-act="toggle-play" aria-label="${t('Play')}">${ic('play')}</button><h3>${t('Paused')}</h3></div></div>`;
  $('#stage-over').innerHTML = over;
  const off = !hasDevice() || m === 'lost' || m === 'ready' || !ch;
  $('#controls').innerHTML = `
    <button class="icon-btn" data-act="toggle-play" ${off ? 'disabled' : ''} aria-label="${p.playing ? t('Pause') : t('Play')}" data-tip="${p.playing ? t('Pause') : t('Play')}">${ic(p.playing ? 'pause' : 'play', 'fill')}</button>
    <button class="icon-btn" data-act="stop" ${off ? 'disabled' : ''} aria-label="${t('Stop')}" data-tip="${t('Stop')}">${ic('stop', 'fill')}</button>
    <button class="icon-btn" data-act="ch-step" data-v="1" ${off ? 'disabled' : ''} aria-label="${t('Next channel')}" data-tip="${t('Next channel')}">${ic('next', 'fill')}</button>
    <button class="icon-btn" data-act="toggle-mute" aria-label="${p.muted ? t('Unmute') : t('Mute')}" data-tip="${p.muted ? t('Unmute') : t('Mute')}">${ic(p.muted ? 'mute' : 'vol')}</button>
    <span class="vol"><input id="vol" type="range" min="0" max="100" value="${p.vol}" data-chg="vol" aria-label="${t('Volume')}" style="--val:${p.vol}%"></span><span class="sp"></span>
    ${ch ? `<button class="chip-btn solid ltr" data-act="info-pop" data-tip="${t('Stream information')}">${ch.q === 'R' ? 'AUD' : esc(ch.q)}</button>` : ''}
    <button class="icon-btn" data-act="tracks" data-tip="${t('Audio and subtitles')}" aria-label="${t('Audio and subtitles')}">${ic('cc')}</button>
    <button class="icon-btn" data-act="fullscreen" data-tip="${t('Fullscreen')}" aria-label="${t('Fullscreen')}">${ic('full')}</button>
    <button class="chip-btn outline ltr" data-act="aspect" data-tip="${t('Aspect ratio')}">${t(p.aspect)}</button>
    <button class="icon-btn" data-act="theater" data-tip="${t('Video only')}" aria-label="${t('Video only')}">${ic(theater ? 'collapse' : 'expand')}</button>`;
  Audio_.sync();
}
const tuneLine = ch => { const s = satById(ch.sat), tp = tpOf(ch); return `${s?.name || ''}  ${tp?.freq || ''} ${tp?.pol || ''}  ${tp?.sr || ''}`; };

function visibleChannels() {
  const f = S.filter, q = f.q.trim().toLowerCase();
  let list = S.channels.filter(c => !c.hidden);
  if (f.tab === 'tv') list = list.filter(c => c.type === 'tv');
  if (f.tab === 'radio') list = list.filter(c => c.type === 'radio');
  if (f.tab === 'fav') list = list.filter(c => c.fav.length);
  if (f.hd) list = list.filter(c => c.q === 'HD' || c.q === '4K');
  if (f.fta) list = list.filter(c => c.fta);
  if (f.sat) list = list.filter(c => c.sat === f.sat);
  if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
  if (f.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
function renderList(keepSearch) {
  const el = $('#p-list'); if (!el) return;
  const f = S.filter, list = hasDevice() ? visibleChannels() : [], cur = S.player.ch;
  const filtered = f.hd || f.fta || f.sat;
  if (!keepSearch) el.innerHTML = `<div class="list-pad">
      <div class="card-head">${ic('cal')}<h2>${t('Channel List')} <span class="sub" id="ch-count"></span></h2><span class="sp"></span>
        <button class="icon-btn" data-act="list-filter" aria-label="${t('Filter channels')}" data-tip="${t('Filter channels')}" style="${filtered ? 'color:var(--accent-2)' : ''}">${ic('filter')}</button>
        <button class="icon-btn" data-act="list-menu" aria-label="${t('Channel list options')}" data-tip="${t('Channel list options')}">${ic('menu')}</button></div>
      <label class="search">${ic('search')}<input id="ch-search" type="search" value="${esc(f.q)}" placeholder="${t('Search channels...')}" data-chg="ch-search" aria-label="${t('Search channels...')}"></label>
      <div class="seg" role="group" aria-label="${t('Channel type')}">${[['all', '', 'All'], ['tv', 'tv', 'TV'], ['radio', 'head', 'Radio'], ['fav', 'star', 'Favorites']].map(([v, i, l]) => `<button data-act="list-tab" data-v="${v}" aria-pressed="${f.tab === v}">${i ? ic(i) : ''}${t(l)}</button>`).join('')}</div>
    </div><ul class="ch-list" id="ch-list"></ul>`;
  $('#ch-count').textContent = hasDevice() ? `(${list.length})` : '(0)';
  $('#ch-list').innerHTML = !hasDevice() || !S.channels.length
    ? `<li class="empty">${ic('list')}<b>${t('No channels yet')}</b><span>${t('Run a scan after a tuner is connected. Your list will appear here.')}</span><button class="btn sm" data-act="go" data-v="scan">${t('Open Transponder Scan')}</button></li>`
    : list.length ? list.map(c => `<li class="ch ${c.id === cur ? 'on' : ''}" data-act="play-ch" data-v="${c.id}" tabindex="0" role="button" aria-current="${c.id === cur}" aria-label="${esc(c.name)}">
        ${picon(c)}<span class="nm">${esc(c.name)}</span>${c.locked ? ic('lock') : ''}<span class="badge ltr">${c.q === 'R' ? 'FM' : esc(c.q)}</span>
        <button class="icon-btn star ${c.fav.length ? 'on' : ''}" data-act="toggle-fav" data-v="${c.id}" aria-pressed="${!!c.fav.length}" aria-label="${t('Favorite')}: ${esc(c.name)}">${ic('star')}</button></li>`).join('')
      : `<li class="empty">${ic('search')}<b>${t('No channels match')}</b><button class="btn sm" data-act="clear-filter">${t('Clear filters')}</button></li>`;
}
function renderNow() {
  const el = $('#p-now'); if (!el) return;
  const ch = curCh();
  if (!hasDevice() || !ch) { el.innerHTML = `<div class="now-id"><b>${t('Nothing tuned')}</b><small>${t('Channel details appear here after a tuner locks a transponder.')}</small></div>`; return; }
  const [n, x] = nowNext(ch), pct = n ? clamp((Date.now() - n.start) / (n.end - n.start) * 100, 0, 100) : 0;
  if (NATIVE) { el.innerHTML = `${picon(ch)}<div class="now-id"><b>${esc(ch.name)}</b><small>${esc(ch.provider || '')}${ch.res ? ` &nbsp;|&nbsp; <span class="ltr">${ch.res}</span>` : ''}${ch.vcodec ? ` &nbsp;|&nbsp; ${ch.vcodec}` : ''}${ch.acodec ? ` &nbsp;|&nbsp; ${ch.acodec}` : ''}</small></div><span class="sp"></span><span class="hint">${t('Program data arrives in a later build')}</span>
    <button class="icon-btn star ${ch.fav.length ? 'on' : ''}" data-act="toggle-fav" data-v="${ch.id}" aria-label="${t('Favorite')}">${ic('star')}</button><button class="icon-btn" data-act="now-menu" aria-label="${t('Channel options')}">${ic('dots')}</button>`; return; }
  const cat = { sport: 'Sport', news: 'News', movie: 'Movies', docs: 'Documentary', kids: 'Kids', music: 'Music', radio: 'Radio' }[ch.kind];
  el.innerHTML = `${picon(ch)}<div class="now-id"><b>${esc(ch.name)}</b><small>${t(cat)}${ch.res ? ` &nbsp;|&nbsp; <span class="ltr">${ch.res}</span> &nbsp;|&nbsp; ${ch.vcodec}` : ''} &nbsp;|&nbsp; ${ch.acodec}</small></div><span class="vr"></span>
    <span class="pill now-p">${t('Now')}</span><div class="now-prog"><div class="col"><b>${esc(n?.title || '—')}</b><div class="prog"><i style="width:${pct}%" id="now-prog"></i></div></div><span class="tm ltr">${n ? fmtTime(n.start) + ' - ' + fmtTime(n.end) : ''}</span></div><span class="vr"></span>
    <span class="pill next-p">${t('Next')}</span><div class="now-prog nx"><div class="col"><b>${esc(x?.title || '—')}</b><small class="ltr" style="text-align:start">${x ? fmtTime(x.start) + ' - ' + fmtTime(x.end) : ''}</small></div></div>
    <button class="icon-btn star ${ch.fav.length ? 'on' : ''}" data-act="toggle-fav" data-v="${ch.id}" aria-label="${t('Favorite')}" data-tip="${t('Favorite')}">${ic('star')}</button>
    <button class="icon-btn" data-act="now-menu" aria-label="${t('Channel options')}" data-tip="${t('Channel options')}">${ic('dots')}</button>`;
}
/* Signal figures: in the real app these come only from the driver.
   In demo mode they are simulated; in other states they show as unavailable. */
const sig = { q: 92, s: 88, snr: 14.5, agc: 76 };
function signalHTML() {
  const ch = curCh(), m = S.mode, tp = tpOf(ch), sat = satById(ch?.sat);
  const has = hasDevice() && !!tp && (m !== 'ready' || (NATIVE && !!Engine.lastTune));
  const lock = m === 'live' ? stateTag('good', S.lang === 'ar' ? 'ملتقطة' : 'Locked') : m === 'lost' ? stateTag('bad', 'No lock') : m === 'ready' ? stateTag('idle', 'Ready') : stateTag('idle', 'No device');
  const val = (v, suffix = '') => (m === 'live' && !NATIVE ? v + suffix : `<span class="sub" data-tip="${t('Not available from the driver')}">—</span>`);
  const live = NATIVE ? Engine.signal || {} : { quality: Math.round(sig.q), strength: Math.round(sig.s) };
  const q = m === 'live' ? live.quality ?? null : null, s = m === 'live' ? live.strength ?? null : null;
  const num = (n, suffix = '') => (n == null ? `<span class="sub" data-tip="${t('Not available from the driver')}">—</span>` : n + suffix);
  const row = (k, v) => `<dt>${t(k)}</dt><dd>:&nbsp; ${v}</dd>`;
  return `<div class="card-head">${ic('dish')}<h2>${t('Signal & Tuner')}</h2><span style="margin-inline-start:34px">${lock}</span><span class="sp"></span>${m === 'live' && !NATIVE ? `<span class="hint" data-tip="${t('Simulated in this preview. The Windows app shows only driver values.')}">${t('Simulated')}</span>` : ''}</div>
    <div class="tune"><dl class="kv dl-plain">
      ${row('Satellite', has ? `<span class="ltr">${esc(sat?.name.split(' ')[0])} (${sat?.pos.toFixed(1)}°${sat?.dir})</span>` : '—')}
      ${row('Frequency', has ? `<span class="ltr">${tp?.freq} MHz</span>` : '—')}${row('Polarization', has ? t(polName(tp?.pol)) : '—')}
      ${row('Symbol Rate', has ? tp?.sr : '—')}${row('FEC', has ? tp?.fec : '—')}${row('Standard', has ? `<span class="ltr">${tp?.std} / ${tp?.mod}</span>` : '—')}</dl>
    <div class="meters">
      <div class="meter"><span>${t('Signal Quality')}</span><div class="bar ${q == null ? 'off' : ''}"><i id="m-q" style="width:${clamp(q || 0, 0, 100)}%"></i></div><b id="m-qv">${num(q, '%')}</b></div>
      <div class="meter"><span>${t('Signal Strength')}</span><div class="bar ${s == null ? 'off' : ''}"><i id="m-s" style="width:${clamp(s || 0, 0, 100)}%"></i></div><b id="m-sv">${num(s, NATIVE ? '' : '%')}</b></div>
      <div class="triple ltr"><div><small>SNR</small><b id="m-snr">${val(sig.snr.toFixed(1), ' dB')}</b></div><div><small>BER</small><b>${val('2.1E-08')}</b></div><div><small>AGC</small><b id="m-agc">${val(sig.agc, '%')}</b></div></div>
    </div></div>`;
}
function epgCardHTML() {
  const ch = curCh();
  const rows = ch && hasDevice() ? nowNext(ch, 4) : [];
  return `<div class="card-head">${ic('cal')}<h2>${t('EPG - Program Guide')}</h2></div>
    ${rows.length ? `<div class="epg-mini">${rows.map((p, i) => `<button class="${i === 0 ? 'on' : ''}" data-act="epg-open" data-v="${p.ch}|${p.id}"><span class="ltr">${fmtTime(p.start)}</span><span>${esc(p.title)}</span>${i === 0 ? ic('play', 'fill') : ''}</button>`).join('')}</div>`
    : `<div class="empty">${ic('cal')}<span>${t(NATIVE ? 'Program data arrives in a later build' : 'Program data appears after a channel is tuned.')}</span></div>`}`;
}
function toolsHTML() {
  const T = [['Scan', 'search', 'go', 'scan', ''], ['Record', 'dot', 'toggle-rec', '', 'c-rec'], ['CCcam', 'card', 'go', 'cam', ''], ['BISS', 'key', 'go', 'biss', ''],
    ['Favorites', 'star', 'quick-fav', '', 'c-star'], ['Picons', 'pic', 'go', 'picons', ''], ['Themes', 'skin', 'go', 'skins', ''], ['Settings', 'gear', 'go', 'preferences', 'c-acc']];
  return `<div class="card-head">${ic('rocket')}<h2>${t('Quick Tools')}</h2></div><div class="tools">${T.map(([l, i, a, v, c]) => `<button class="tool" data-act="${a}" ${v ? `data-v="${v}"` : ''} ${a === 'toggle-rec' ? `aria-pressed="${!!recording}"` : ''}>${ic(i, c)}<span>${t(a === 'toggle-rec' && recording ? 'Stop' : l)}</span></button>`).join('')}</div>`;
}
function renderCards() {
  const el = $('#p-cards'); if (!el) return;
  const L = S.layout, vis = L.order.filter(k => L[k]);
  const body = { signal: signalHTML, epg: epgCardHTML, tools: toolsHTML };
  el.className = `cards3 n${vis.length}`;
  el.hidden = !vis.length;
  el.innerHTML = vis.map(k => `<section class="card" id="c-${k}">${body[k]()}</section>`).join('');
}

/* Player actions */
function tune(id) {
  const ch = chById(id); if (!ch) return;
  if (ch.locked && !unlocked.has(id)) { askPin(ch); return; }
  S.player.ch = id; S.player.audio = 0; S.player.sub = -1; S.player.playing = true; save();
  tuning = true;
  if (S.view === 'live') { renderPlayer(); renderList(true); renderNow(); renderCards(); renderStatus(); }
  setTimeout(() => { tuning = false; if (S.view === 'live') renderPlayer(); }, 520);
}
const unlocked = new Set();
function askPin(ch) {
  const id = uid('pin');
  A[id] = () => {
    const v = formVals(modals[modals.length - 1]);
    if (v.pin === S.settings.parentalPin) { unlocked.add(ch.id); closeModal(); tune(ch.id); } else setErr(modals[modals.length - 1], 'pin', t('That PIN is not correct.'));
  };
  openModal({ title: `${t('Locked channel')}: ${ch.name}`, width: 380, body: `${field('Parental PIN', 'pin', '', 'type="password" inputmode="numeric" maxlength="8"')}<p class="hint">${t('The default PIN is 0000. Change it in Settings, General.')}</p>`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Unlock')}</button>` });
}
A['play-ch'] = el => tune(el.dataset.v);
A['toggle-play'] = () => { S.player.playing = !S.player.playing; save(); renderPlayer(); };
A.stop = () => { S.player.playing = false; save(); renderPlayer(); toast(t('Playback stopped')); };
A['ch-step'] = el => {
  const list = visibleChannels(); if (!list.length) return;
  const i = list.findIndex(c => c.id === S.player.ch);
  tune(list[(i + Number(el.dataset.v) + list.length) % list.length].id);
};
A['toggle-mute'] = () => { S.player.muted = !S.player.muted; save(); renderPlayer(); };
CHG.vol = el => { S.player.vol = Number(el.value); if (S.player.vol > 0) S.player.muted = false; el.style.setProperty('--val', el.value + '%'); save(); Audio_.sync(); const m = $('[data-act="toggle-mute"]'); if (m) m.innerHTML = ic(S.player.muted ? 'mute' : 'vol'); };
A.aspect = el => openPop(el, `<h4>${t('Aspect ratio')}</h4>${['Fill', '16:9', '4:3', '21:9'].map(a => mi('set-aspect', a, { v: a, checked: S.player.aspect === a })).join('')}`);
A['set-aspect'] = el => { S.player.aspect = el.dataset.v; save(); closePop(); renderPlayer(); };
A.tracks = el => {
  const ch = curCh(), p = S.player;
  openPop(el, `<h4>${t('Audio track')}</h4>${ch.audio.map((a, i) => mi('set-audio', `${a}`, { v: i, checked: p.audio === i })).join('')}
    <h4>${t('Subtitles')}</h4>${mi('set-sub', 'Off', { v: -1, checked: p.sub === -1 })}${ch.subs.map((a, i) => mi('set-sub', a, { v: i, checked: p.sub === i })).join('')}
    ${ch.subs.length ? '' : `<div class="hint" style="padding:4px 9px">${t('This channel carries no subtitle stream.')}</div>`}`);
};
A['set-audio'] = el => { S.player.audio = Number(el.dataset.v); save(); closePop(); toast(`${t('Audio track')}: ${curCh().audio[S.player.audio]}`, 'good'); };
A['set-sub'] = el => { S.player.sub = Number(el.dataset.v); save(); closePop(); toast(`${t('Subtitles')}: ${S.player.sub < 0 ? t('Off') : curCh().subs[S.player.sub]}`, 'good'); };
A['info-pop'] = el => {
  const c = curCh();
  openPop(el, `<h4>${t('Stream information')}</h4><dl class="kv dl-plain"><dt>${t('Video')}</dt><dd>${c.vcodec || '—'}</dd><dt>${t('Resolution')}</dt><dd class="ltr">${c.res || '—'}</dd><dt>${t('Audio')}</dt><dd>${c.acodec}</dd><dt>${t('Bitrate')}</dt><dd class="ltr">${((NATIVE ? Engine.signal?.bitrateKbps || 0 : c.kbps) / 1000).toFixed(1)} Mb/s</dd><dt>${t('Decoding')}</dt><dd>${S.settings.hwAccel ? t('Hardware') : t('Software')}</dd><dt>SID</dt><dd>${c.sid}</dd><dt>VPID / APID</dt><dd>${c.vpid || '—'} / ${c.apid}</dd></dl>`);
};
A.fullscreen = async () => {
  const s = $('#stage');
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await s.requestFullscreen(); }
  catch (e) { setTheater(true); toast(t('Fullscreen is not allowed here. Showing video only instead.'), 'warn'); }
};
function setTheater(v) { theater = v; $('#app').classList.toggle('theater', v); renderPlayer(); }
A.theater = () => setTheater(!theater);
A['vid-collapse'] = () => { S.layout.video = false; save(); renderLive(); toast(t('Video panel hidden. Turn it back on in Customize layout.')); };
A.detect = async el => {
  el.disabled = true; el.innerHTML = `<span class="radar sm" style="width:16px;height:16px"></span>${t('Detecting')}`;
  await new Promise(r => setTimeout(r, 1100));
  toast(t('No tuner found. This preview cannot reach hardware.'), 'warn');
  renderPlayer();
};
A['open-settings'] = el => { setCat = el.dataset.v || setCat; go('preferences'); };

/* Channel list actions */
A['list-tab'] = el => { S.filter.tab = el.dataset.v; save(); renderList(); };
CHG['ch-search'] = el => { S.filter.q = el.value; save(); renderList(true); };
A['clear-filter'] = () => { Object.assign(S.filter, { q: '', hd: false, fta: false, sat: '', tab: 'all' }); save(); renderList(); };
A['list-filter'] = el => {
  const f = S.filter;
  openPop(el, `<h4>${t('Filter channels')}</h4>${mi('flt', 'HD and 4K only', { v: 'hd', checked: f.hd })}${mi('flt', 'Free-to-air only', { v: 'fta', checked: f.fta })}
    <h4>${t('Satellite')}</h4>${mi('flt-sat', 'All satellites', { v: '', checked: !f.sat })}${S.sats.filter(s => S.channels.some(c => c.sat === s.id)).map(s => mi('flt-sat', s.name, { v: s.id, checked: f.sat === s.id })).join('')}`);
};
A.flt = el => { const k = el.dataset.v; S.filter[k] = !S.filter[k]; save(); closePop(); renderList(); };
A['flt-sat'] = el => { S.filter.sat = el.dataset.v; save(); closePop(); renderList(); };
A['list-menu'] = el => openPop(el, `<h4>${t('Sort by')}</h4>${mi('set-sort', 'Channel number', { v: 'lcn', checked: S.filter.sort === 'lcn' })}${mi('set-sort', 'Name', { v: 'name', checked: S.filter.sort === 'name' })}
  <h4>${t('Manage')}</h4>${mi('go', 'Channel Manager', { v: 'channels', icon: 'list' })}${mi('customize', 'Customize layout', { icon: 'layout' })}`);
A['set-sort'] = el => { S.filter.sort = el.dataset.v; save(); closePop(); renderList(); };
A['toggle-fav'] = el => {
  const c = chById(el.dataset.v);
  c.fav = c.fav.length ? [] : [S.groups[0]?.id || 'g1'];
  save(); if (S.view === 'live') { renderList(true); renderNow(); } else refresh();
};
A['quick-fav'] = () => { S.filter.tab = 'fav'; save(); renderList(); $('#p-list')?.scrollIntoView({ block: 'nearest' }); toast(t('Showing favorites')); };
A['now-menu'] = el => { const c = curCh(); openPop(el, `${mi('ch-info', 'Channel details', { icon: 'info', v: c.id })}${mi('fav-group', 'Add to favorites group', { icon: 'group', v: c.id })}${mi('go', 'Open in Channel Manager', { icon: 'list', v: 'channels' })}${mi('go', 'Open in Program Guide', { icon: 'cal', v: 'epg' })}`); };
A['ch-info'] = el => {
  closePop(); const c = chById(el.dataset.v), s = satById(c.sat), tp = tpOf(c);
  openModal({ title: c.name, width: 460, body: `<div class="row">${picon(c)}<span class="sub">${t('Sample record')}</span></div><dl class="kv dl-plain">
    <dt>${t('Satellite')}</dt><dd>${esc(satLabel(s))}</dd><dt>${t('Frequency')}</dt><dd class="ltr">${tp?.freq} MHz ${tp?.pol}</dd><dt>${t('Symbol Rate')}</dt><dd>${tp?.sr}</dd><dt>FEC</dt><dd>${tp?.fec}</dd><dt>${t('Standard')}</dt><dd>${tp?.std} / ${tp?.mod}</dd>
    <dt>SID</dt><dd>${c.sid}</dd><dt>VPID / APID</dt><dd>${c.vpid || '—'} / ${c.apid}</dd><dt>${t('Video')}</dt><dd>${c.vcodec || '—'}</dd><dt>${t('Audio')}</dt><dd>${c.acodec}</dd><dt>${t('Access')}</dt><dd>${t(c.fta ? 'Free-to-air' : 'Scrambled')}</dd></dl>`,
    foot: `<button class="btn" data-act="modal-close">${t('Close')}</button>` });
};
A['fav-group'] = el => {
  closePop(); const c = chById(el.dataset.v), id = uid('fg');
  A[id] = () => { c.fav = $$('[data-grp]', modals[modals.length - 1]).filter(x => x.checked).map(x => x.dataset.grp); save(); closeModal(); renderAll(); toast(t('Favorites updated'), 'good'); };
  openModal({ title: `${t('Favorites groups')}: ${c.name}`, width: 400, body: S.groups.map(g => `<label class="check"><input type="checkbox" data-grp="${g.id}" ${c.fav.includes(g.id) ? 'checked' : ''}>${esc(g.name)}</label>`).join('') || `<p class="sub">${t('No groups yet.')}</p>`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
};
A['epg-open'] = el => { const [cid, pid] = el.dataset.v.split('|'); openProgramme(chById(cid), epgFor(chById(cid)).find(p => p.id === pid)); };

/* Recording from the live picture */
A['toggle-rec'] = () => {
  if (!hasDevice() || S.mode === 'lost') { toast(t('Recording needs a tuner with a locked signal.'), 'warn'); return; }
  if (!recording) { recording = { ch: S.player.ch, at: Date.now() }; toast(`${t('Recording')}: ${curCh().name}`, 'good'); }
  else {
    const c = chById(recording.ch), mins = Math.max(1, Math.round((Date.now() - recording.at) / 6e4));
    S.recordings.unshift({ id: uid('r'), title: nowNext(c)[0]?.title || c.name, ch: c.id, at: recording.at, mins, gb: +(c.kbps * mins * 60 / 8e6).toFixed(2) });
    recording = null; save(); toast(t('Recording saved to Recordings'), 'good');
  }
  if (S.view === 'live') { renderPlayer(); renderCards(); }
};

/* Layout customization */
A.customize = el => {
  closePop();
  const names = { sidebar: 'Sidebar', video: 'Video player', list: 'Channel list', now: 'Channel information bar', signal: 'Signal & Tuner', epg: 'EPG - Program Guide', tools: 'Quick Tools' };
  const L = S.layout;
  const body = () => `<div>${['sidebar', 'video', 'list', 'now'].map(k => `<div class="set-row"><div><b>${t(names[k])}</b></div><label class="switch"><input id="lay-${k}" type="checkbox" data-chg="lay" data-v="${k}" ${L[k] ? 'checked' : ''} aria-label="${t(names[k])}"><i></i></label></div>`).join('')}</div>
    <div class="set-h">${t('Lower cards')}</div><div>${L.order.map((k, i) => `<div class="set-row"><div><b>${t(names[k])}</b></div>
      <button class="icon-btn" data-act="lay-move" data-v="${k}|-1" ${i === 0 ? 'disabled' : ''} aria-label="${t('Move earlier')}">${ic('up')}</button><button class="icon-btn" data-act="lay-move" data-v="${k}|1" ${i === L.order.length - 1 ? 'disabled' : ''} aria-label="${t('Move later')}">${ic('down')}</button>
      <label class="switch"><input id="lay-${k}" type="checkbox" data-chg="lay" data-v="${k}" ${L[k] ? 'checked' : ''} aria-label="${t(names[k])}"><i></i></label></div>`).join('')}</div>`;
  layoutBody = body;
  openModal({ title: t('Customize layout'), width: 460, body: `<div id="lay-body" style="display:grid;gap:8px">${body()}</div>`, id: 'lay-modal',
    foot: `<button class="btn" data-act="lay-reset">${t('Reset layout')}</button><button class="btn primary" data-act="modal-close">${t('Done')}</button>` });
};
let layoutBody = null;
const layRefresh = () => { save(); renderChrome(); if (S.view === 'live') renderLive(); const b = $('#lay-body'); if (b) b.innerHTML = layoutBody(); };
CHG.lay = el => { S.layout[el.dataset.v] = el.checked; layRefresh(); };
A['lay-move'] = el => { const [k, d] = el.dataset.v.split('|'), o = S.layout.order, i = o.indexOf(k), j = i + Number(d); [o[i], o[j]] = [o[j], o[i]]; layRefresh(); };
A['lay-reset'] = () => { S.layout = seedState().layout; layRefresh(); };

/* Window buttons. In the desktop build these map to the real window. */
A.about = () => openModal({ title: 'NOVA DVB Studio', width: 480, body: `<p class="sub">${t('Design preview 1.0. Real tuner support, decoding and the Windows installer come in later stages.')}</p>
  <dl class="kv dl-plain"><dt>${t('Stage')}</dt><dd>${t('Interface design')}</dd><dt>${t('Hardware access')}</dt><dd>${t('None in this preview')}</dd><dt>${t('Icons')}</dt><dd>Lucide (ISC)</dd></dl>`, foot: `<button class="btn primary" data-act="modal-close">${t('Close')}</button>` });
A['win-min'] = () => { const m = document.createElement('div'); m.className = 'minimized'; m.id = 'minimized'; m.innerHTML = `<div>${LOGO}<b>NOVA DVB Studio</b><span class="sub">${t('Minimized')}</span><button class="btn primary" data-act="win-restore">${t('Restore')}</button></div>`; document.body.append(m); };
A['win-restore'] = () => $('#minimized')?.remove();
A['win-max'] = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch (e) { toast(t('This preview frame cannot change window size.'), 'warn'); } };
A['win-close'] = () => {
  const close = () => { const m = document.createElement('div'); m.className = 'minimized'; m.id = 'minimized'; m.innerHTML = `<div>${LOGO}<b>${t('NOVA DVB Studio closed')}</b><span class="sub">${t('Your settings were saved.')}</span><button class="btn primary" data-act="win-restore">${t('Open again')}</button></div>`; document.body.append(m); };
  if (S.settings.confirmExit) confirmBox({ title: t('Close NOVA DVB Studio?'), msg: recording ? t('A recording is running. Closing stops it.') : t('Playback stops and the tuner is released.'), yes: t('Close'), onYes: close }); else close();
};

/* Global events */
document.addEventListener('click', e => {
  if (popEl && !e.target.closest('.pop') && !e.target.closest('[data-act]')) closePop();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (!fn) { console.error('Unhandled action', el.dataset.act); return; }
  const inPop = el.closest('.pop');
  if (!inPop) closePop();
  e.stopPropagation();
  fn(el, e);
});
const onChg = e => { const el = e.target.closest?.('[data-chg]'); if (el) CHG[el.dataset.chg]?.(el, e); };
document.addEventListener('input', onChg);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (popEl) closePop(); else if (modals.length) closeModal(); else if (theater) setTheater(false); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.ch')) { e.preventDefault(); tune(e.target.dataset.v); return; }
  if (e.target.matches?.('input,select,textarea') || modals.length || S.view !== 'live') return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); A['ch-step']({ dataset: { v: e.key === 'ArrowDown' ? 1 : -1 } }); }
  else if (e.key.toLowerCase() === 'm') A['toggle-mute']();
  else if (e.key.toLowerCase() === 'f') A.fullscreen();
  else if (e.key === ' ') { e.preventDefault(); A['toggle-play'](); }
});

/* Periodic updates */
setInterval(tickClock, 1000);
setInterval(() => {
  if (!NATIVE && S.view === 'live' && S.mode === 'live') {
    sig.q = clamp(sig.q + (Math.random() - .5) * 1.4, 88, 95); sig.s = clamp(sig.s + (Math.random() - .5) * 1.4, 84, 91);
    sig.snr = clamp(sig.snr + (Math.random() - .5) * .2, 13.8, 15); sig.agc = clamp(sig.agc + (Math.random() - .5), 74, 78);
    const set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
    const w = (id, v) => { const e = $('#' + id); if (e) e.style.width = v + '%'; };
    w('m-q', sig.q); w('m-s', sig.s); set('m-qv', Math.round(sig.q) + '%'); set('m-sv', Math.round(sig.s) + '%'); set('m-snr', sig.snr.toFixed(1) + ' dB'); set('m-agc', Math.round(sig.agc) + '%');
    const cpu = 10 + Math.random() * 6, ram = 33 + Math.random() * 2;
    set('st-cpu', Math.round(cpu) + '%'); set('st-ram', Math.round(ram) + '%'); w('st-cpu-b', cpu); w('st-ram-b', ram);
    set('st-down', (curCh().kbps / 1000 * (.96 + Math.random() * .08)).toFixed(2) + ' Mb/s');
  }
}, 1500);
setInterval(() => { if (S.view === 'live') { renderNow(); renderCards(); } }, 60000);
