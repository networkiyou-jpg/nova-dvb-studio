/* Info bar: the banner shown over the picture on every channel change, in the style of a satellite receiver.
   It shows the logo, number and name, clock and date, now and next with progress, satellite and transponder,
   signal meters, picture format badges, and the audio, subtitle and teletext buttons.
   In the browser it is drawn in HTML. In the Windows app the picture is a native window, so the same
   ready-made data goes to a transparent window that sits on top of it (OsdWindow.cs). */
const IB = { until: 0, pinned: false, timer: 0, last: '' };
/* Version 0.2.1 made the bar smaller: older saved settings move to the new compact size once. */
if (S.settings.osdSizeV !== 2) { S.settings.osdSize = 'compact'; S.settings.osdSizeV = 2; }
const pad3 = n => String(n ?? '').padStart(3, '0');
const resOf = ch => (ch?.res || '').split(/\s*[x\u00d7]\s*/).map(Number);
function qualityOf(ch) {
  if (ch.type === 'radio') return '';
  const [w, h] = resOf(ch);
  if (w >= 3800) return '4K';
  if (w >= 1900 || h >= 1000) return 'FHD';
  if (w >= 1200 || h >= 700) return 'HD';
  if (w) return 'SD';
  return { '4K': '4K', HD: 'HD', SD: 'SD' }[ch.q] || '';
}
function aspectOf(w, h) {
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.06) return '16:9';
  if (Math.abs(r - 4 / 3) < 0.06) return '4:3';
  if (Math.abs(r - 21 / 9) < 0.1) return '21:9';
  return '';
}
const fmtDayLong = d => new Date(d).toLocaleDateString(locale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const langName = code => ({ ara: 'Arabic', eng: 'English', fre: 'French', fra: 'French', ger: 'German', deu: 'German', spa: 'Spanish', tur: 'Turkish', ita: 'Italian', por: 'Portuguese', qaa: 'Original', und: '' }[String(code || '').toLowerCase()] ?? code);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* Signal for the meters. The Windows app has only what the driver reports: quality goes to SNR and
   strength to AGC when the driver gives it as a percentage. The browser preview shows simulated values. */
function ibSignal() {
  if (S.mode !== 'live') return { snr: null, agc: null };
  if (NATIVE) {
    const m = Engine.signal || {};
    const pct = v => (v == null || v < 0 || v > 100 ? null : Math.round(v));
    return { snr: pct(m.quality), agc: pct(m.strength) };
  }
  return { snr: Math.round(sig.q), agc: Math.round(sig.agc) };
}

function infobarData(ch = curCh()) {
  if (!ch || !hasDevice()) return null;
  const sat = satById(ch.sat), tp = tpOf(ch), now = Date.now();
  const [n, x] = nowNext(ch);
  const q = qualityOf(ch), [w, h] = resOf(ch);
  const badges = [];
  if (q) badges.push({ t: q, k: 'q' });
  if (ch.vcodec) badges.push({ t: ch.vcodec, k: '' });
  if (w && h && q !== 'SD' && aspectOf(w, h)) badges.push({ t: aspectOf(w, h), k: '' });
  if (w && h && (S.settings.osdSize || 'compact') !== 'compact') badges.push({ t: `${w}\u00d7${h}`, k: 'res' });   /* the small bar keeps room for the name */
  const sg = ibSignal();
  const audioLang = ch.audio?.[S.player.audio] ?? ch.audio?.[0];
  return {
    num: pad3(ch.lcn), name: ch.name, fav: !!ch.fav?.length, fta: !!ch.fta,
    access: `${t(ch.type === 'radio' ? 'Radio' : 'TV')} (${t(ch.fta ? 'Free' : 'Scrambled')})`,
    badges, time: fmtTime(now), date: fmtDayLong(now),
    now: n ? { time: `${fmtTime(n.start)} - ${fmtTime(n.end)}`, title: n.title, pct: clamp((now - n.start) / (n.end - n.start) * 100, 0, 100), left: `+${Math.max(0, Math.ceil((n.end - now) / 6e4))} ${t('min')}` } : null,
    next: x ? { time: `${fmtTime(x.start)} - ${fmtTime(x.end)}`, title: x.title } : null,
    noEpg: t('No program information for this channel yet'),
    sat: sat ? `${sat.name} (${sat.pos.toFixed(1)}°${sat.dir})` : '—',
    tp: tp ? `${tp.freq}  ${tp.pol}  ${tp.sr}  ${tp.fec}` : '—',
    snr: { label: 'SNR', pct: sg.snr }, agc: { label: 'AGC', pct: sg.agc },
    audio: { label: t('AUDIO'), sub: [ch.acodec, t(langName(audioLang) || '')].filter(Boolean).join(' · '), on: !!(ch.audio?.length || ch.acodec) },
    sub: { label: t('SUB'), sub: ch.subs?.length ? `${ch.subs.length}` : '', on: !!ch.subs?.length },
    txt: { label: t('TXT'), sub: '', on: !!ch.txt },
    picon: { src: S.picons[ch.id] && S.picons[ch.id] !== 'auto' ? S.picons[ch.id] : '', code: ch.code, num: ch.num || '', c1: ch.p1, c2: ch.p2 },
    accent: cssVar('--accent'), accent2: cssVar('--accent-2'), size: S.settings.osdSize || 'compact',
  };
}

/* ---------- Drawing ---------- */
const IBI = {   /* icons drawn for the bar only */
  dish: '<path d="M4 10a7.31 7.31 0 0 0 10 10Z"/><path d="m9 15 3-3"/><path d="M17 13a6 6 0 0 0-6-6"/><path d="M21 13A10 10 0 0 0 11 3"/>',
  tower: '<path d="M4.9 16.1a10 10 0 0 1 0-13.2"/><path d="M7.8 13.2a6 6 0 0 1 0-7.4"/><path d="M16.2 5.8a6 6 0 0 1 0 7.4"/><path d="M19.1 2.9a10 10 0 0 1 0 13.2"/><circle cx="12" cy="9.5" r="1.5"/><path d="M12 11v10M9 21h6"/>',
};
const ibIcon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IBI[n]}</svg>`;
function ibLogo(d) {
  const p = d.picon;
  const inner = p.src ? `<img src="${esc(p.src)}" alt="">` : `<span class="ib-mono" style="background:linear-gradient(130deg,${esc(p.c1 || '#3a4678')},${esc(p.c2 || '#1d2547')})">${esc(p.code || 'TV')}${p.num ? `<em>${esc(p.num)}</em>` : ''}</span>`;
  return `<div class="ib-logo">${d.fav ? `<span class="ib-star">${ic('star', 'fill')}</span>` : ''}${inner}</div>`;
}
function infobarHTML(d) {
  const meter = m => `<span class="ib-meter"><b>${m.label}</b><span class="ib-bar"><i style="width:${m.pct ?? 0}%"></i></span><b class="ltr">${m.pct == null ? '—' : m.pct + '%'}</b></span>`;
  const btn = (act, icon, b) => `<button class="ib-btn ${b.on ? '' : 'off'}" data-act="${act}" aria-label="${esc(b.label)}">${ic(icon)}<span>${esc(b.label)}</span>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</button>`;
  return `${ibLogo(d)}
    <div class="ib-head"><span class="ib-num ltr">${esc(d.num)}</span>
      <div class="ib-id"><b dir="auto">${esc(d.name)}</b><span class="ib-acc ${d.fta ? 'ok' : 'ca'}">${ic(d.fta ? 'unlock' : 'lock')}<span dir="auto">${esc(d.access)}</span></span></div>
      <div class="ib-badges">${d.badges.map(b => `<span class="ib-badge ${b.k}">${esc(b.t)}</span>`).join('')}</div>
      <div class="ib-clock"><b class="ltr">${esc(d.time)}</b><span>${ic('cal')}<span dir="auto">${esc(d.date)}</span></span></div></div>
    <div class="ib-epg">${d.now || d.next ? `
      <div class="ib-row cur"><span class="ib-t ltr">${esc(d.now?.time || '')}</span><div class="ib-title"><b dir="auto">${esc(d.now?.title || '—')}</b><span class="ib-prog"><i style="width:${d.now?.pct ?? 0}%"></i></span></div><span class="ib-left">${esc(d.now?.left || '')}</span></div>
      <div class="ib-row"><span class="ib-t ltr">${esc(d.next?.time || '')}</span><div class="ib-title"><b dir="auto">${esc(d.next?.title || '—')}</b></div></div>`
      : `<div class="ib-none">${esc(d.noEpg)}</div>`}</div>
    <div class="ib-sig"><span class="ib-sat">${ibIcon('dish')}<span>${esc(d.sat)}</span></span><span class="ib-tp ltr">${ibIcon('tower')}<span>${esc(d.tp)}</span></span>${meter(d.snr)}${meter(d.agc)}</div>
    <div class="ib-btns">${btn('ib-audio', 'vol', d.audio)}${btn('ib-sub', 'cc', d.sub)}${btn('ib-txt', 'text', d.txt)}</div>`;
}

/* ---------- Showing and hiding ---------- */
const ibOn = () => IB.pinned || Date.now() < IB.until;
function ibRender() {
  const visible = ibOn() && S.view === 'live' && S.layout.video && S.mode === 'live' && S.player.playing && !$('#stage-over')?.children.length;
  const d = visible ? infobarData() : null;
  if (NATIVE) {
    const msg = JSON.stringify(d);
    if (msg !== IB.last) { IB.last = msg; window.chrome.webview.postMessage({ cmd: 'osd', show: !!d, data: d }); }
    return;
  }
  const stage = $('#stage');
  if (!stage) return;
  let el = $('#ib');
  if (!el) { el = document.createElement('div'); el.id = 'ib'; el.className = 'ib-wrap'; el.setAttribute('role', 'status'); stage.append(el); }
  stage.classList.toggle('ib-on', !!d);
  el.classList.toggle('show', !!d);
  el.dataset.size = S.settings.osdSize || 'compact';
  if (d) el.innerHTML = `<div class="ib" dir="ltr">${infobarHTML(d)}</div>`;
}
function ibShow(sec) {
  const s = sec ?? Number(S.settings.osdSec ?? 5);
  IB.pinned = s === 0;
  IB.until = Date.now() + (s || 5) * 1000;
  clearTimeout(IB.timer);
  if (!IB.pinned) IB.timer = setTimeout(ibRender, s * 1000 + 30);
  ibRender();
}
function ibHide() { IB.pinned = false; IB.until = 0; clearTimeout(IB.timer); ibRender(); }
A.infobar = () => (ibOn() ? ibHide() : ibShow(Number(S.settings.osdSec) || 8));

/* A channel change shows the bar, when the setting allows it. */
const tuneBase = tune;
tune = id => { tuneBase(id); if (S.settings.osdZap !== false && chById(id)) ibShow(); };

A['ib-audio'] = el => {
  if (NATIVE) { window.chrome.webview.postMessage({ cmd: 'cycleAudio' }); return; }
  A.tracks(el);
};
A['ib-sub'] = el => {
  if (NATIVE) { window.chrome.webview.postMessage({ cmd: 'cycleSub' }); return; }
  A.tracks(el);
};
A['ib-txt'] = () => {
  if (NATIVE) { window.chrome.webview.postMessage({ cmd: 'teletext' }); return; }
  toast(t(curCh()?.txt ? 'Teletext shows in the Windows app.' : 'This channel carries no teletext.'), 'warn');
};

document.addEventListener('keydown', e => {
  if (e.target.matches?.('input,select,textarea') || modals.length || S.view !== 'live') return;
  const k = e.key.toLowerCase();
  if (k === 'i') A.infobar();
  else if (k === 'escape' && ibOn()) ibHide();
  else if (k === 'a' && NATIVE) A['ib-audio']();
  else if (k === 's' && NATIVE) A['ib-sub']();
  else if (k === 't' && NATIVE) A['ib-txt']();
});
/* Moving the mouse over the picture brings the bar back for a moment, like a receiver remote's info key. */
$('#main')?.addEventListener('mousemove', e => {
  if (S.settings.osdMouse === false || ibOn() || !e.target.closest?.('#stage') || e.target.closest?.('.controls')) return;
  ibShow(3);
});
setInterval(() => { if (ibOn()) ibRender(); }, 1000);
onPlayerDrawn = () => { if (ibOn() || IB.last !== 'null') ibRender(); };
