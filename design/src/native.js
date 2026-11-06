/* Windows app mode. Runs only inside the NOVA window, where the page talks to the real engine.
   In a browser this file does nothing and the demo stays as it was reviewed. */
const Engine = { tuners: [], opened: false, name: '', caps: null, signal: null, stats: {}, lastTune: null, lockWait: 0, retryAt: 0, recording: false, recStart: 0 };
if (NATIVE) (() => {
  const post = o => window.chrome.webview.postMessage(o);
  const engine = (cmd, data = {}) => post({ to: 'engine', cmd, ...data });
  document.documentElement.classList.add('native');

  /* ---------- Tuning ---------- */
  const portIndex = p => ({ A: 0, B: 1, C: 2, D: 3 }[p] ?? -1);
  function tuneRequest(sat, tp) {
    const s = S.settings, mode = s.diseqc;
    return {
      freqMHz: tp.freq, pol: tp.pol, symbolRate: tp.sr, fec: tp.fec, mod: tp.mod, std: tp.std, rollOff: tp.ro, pilot: tp.pilot,
      lnb: { lowMHz: Number(s.lof1), highMHz: Number(s.lof2), switchMHz: Number(s.lofSw) },
      diseqc: mode,
      port: mode === 'None' ? -1 : portIndex(sat.port || 'None'),
      uncommitted: (mode === '1.1' || mode === '1.2') && sat.uncommitted && sat.uncommitted !== 'None' ? Number(sat.uncommitted) - 1 : -1,
      motorPosition: mode === '1.2' ? Number(sat.motorPos) || 0 : 0,
    };
  }
  const sameTp = (a, b) => a && b && a.freqMHz === b.freqMHz && a.pol === b.pol && a.symbolRate === b.symbolRate && a.port === b.port && a.uncommitted === b.uncommitted;

  const sendAudio = () => { post({ cmd: 'volume', value: S.player.vol }); post({ cmd: 'mute', value: S.player.muted }); };
  tune = id => {
    const ch = chById(id);
    if (!ch) return;
    if (ch.locked && !unlocked.has(id)) { askPin(ch); return; }
    if (!Engine.opened) { toast(t('No satellite tuner found'), 'warn'); return; }
    const sat = satById(ch.sat), tp = tpOf(ch);
    if (!sat || !tp) { toast(t('This channel has no transponder. Scan it again.'), 'bad'); return; }
    const req = tuneRequest(sat, tp);
    if (Engine.recording && !sameTp(req, Engine.lastTune)) { toast(t('A recording is running on another transponder. Stop it first, or pick a channel on the same transponder.'), 'warn'); return; }
    S.player.ch = id; S.player.audio = 0; S.player.sub = -1; S.player.playing = true; save();
    if (!sameTp(req, Engine.lastTune)) { engine('tune', req); Engine.lastTune = req; Engine.lockWait = Date.now() + 8000; }
    sendAudio();
    post({ cmd: 'aspect', value: S.player.aspect });
    post({ cmd: 'play', sid: ch.sid });
    tuning = true;
    if (S.view === 'live') { renderPlayer(); renderList(true); renderNow(); renderCards(); renderStatus(); }
    if (!ch.fta) toast(t('This channel is scrambled. It shows a picture only with an authorized decoder.'), 'warn');
    setTimeout(() => { tuning = false; if (S.view === 'live') renderPlayer(); }, 700);
  };
  A['toggle-play'] = () => {
    const p = S.player; p.playing = !p.playing; save();
    if (p.playing) { const c = curCh(); if (c) post({ cmd: 'play', sid: c.sid }); } else post({ cmd: 'stop' });
    renderPlayer();
  };
  A.stop = () => { S.player.playing = false; save(); post({ cmd: 'stop' }); renderPlayer(); };
  const baseMute = A['toggle-mute'];
  A['toggle-mute'] = () => { baseMute(); post({ cmd: 'mute', value: S.player.muted }); };
  const baseVol = CHG.vol;
  CHG.vol = el => { baseVol(el); post({ cmd: 'volume', value: S.player.vol }); post({ cmd: 'mute', value: S.player.muted }); };
  A['set-aspect'] = el => { S.player.aspect = el.dataset.v; save(); closePop(); post({ cmd: 'aspect', value: el.dataset.v }); renderPlayer(); };
  let trackAnchor = null;
  A.tracks = el => { trackAnchor = el; post({ cmd: 'tracks' }); };
  function showTracks(m) {
    if (!trackAnchor?.isConnected) return;
    const list = (items, act) => items.map(i => mi(act, i.name, { v: i.id })).join('');
    openPop(trackAnchor, `<h4>${t('Audio track')}</h4>${list(m.audio, 'set-audio') || `<div class="hint" style="padding:4px 9px">${t('Not available')}</div>`}<h4>${t('Subtitles')}</h4>${list(m.subs, 'set-sub') || `<div class="hint" style="padding:4px 9px">${t('This channel carries no subtitle stream.')}</div>`}`);
  }
  A['set-audio'] = el => { post({ cmd: 'setAudio', id: Number(el.dataset.v) }); closePop(); };
  A['set-sub'] = el => { post({ cmd: 'setSub', id: Number(el.dataset.v) }); closePop(); };
  A.fullscreen = () => {
    const on = document.documentElement.classList.toggle('fs');
    post({ cmd: 'fullscreen', on });
    if (on) toast(t('Press Esc or double-click the picture to leave full screen'));
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.documentElement.classList.contains('fs')) A.fullscreen(); });
  A['sat-update'] = el => { el.disabled = true; el.textContent = t('Updating'); post({ cmd: 'fetchText', url: SAT_LIST_URL }); };
  function onSatList(m) {
    if (!m.ok) { toast(t('Could not download the transponder list. Check the internet connection.'), 'bad'); if (S.view === 'satellites') refresh(); return; }
    try {
      const r = applySatXml(m.text);
      if (S.view === 'satellites' || S.view === 'scan') refresh();
      toast(`${r.sats} ${t('satellites')}, ${r.tps} ${t('transponders')}`, 'good');
    } catch (e) { toast(t('That file is not a NOVA satellite list.'), 'bad'); }
  }
  A.detect = el => { if (el?.disabled !== undefined) el.disabled = true; engine('list'); };
  A.detect2 = () => engine('list');

  /* ---------- Scan ---------- */
  const SVC_HD = [0x11, 0x19, 0x20, 0x1F];
  const HD_NAME = /\b(F?HD|1080[ip]?|720p)\b/i;
  /* Many HD channels still announce a plain TV service type, so names fix saved lists at start-up. */
  S.channels.forEach(c => { if (c.q === 'SD' && !c.res && HD_NAME.test(c.name)) c.q = 'HD'; });
  A['scan-start'] = () => {
    const s = satById(scan.sat);
    if (!Engine.opened) { toast(t('No satellite tuner found'), 'warn'); return; }
    if (scan.mode === 'blind') { toast(t('Blind scan is not available in this build.'), 'warn'); return; }
    const tps = scan.mode === 'manual' ? [{ freq: Number(scan.mf), pol: scan.mp, sr: Number(scan.ms), fec: 'Auto', mod: 'QPSK', std: 'DVB-S', ro: '0.35', pilot: 'Auto' }] : [...(s?.tps || [])];
    if (!tps.length) { toast(t('This satellite has no transponders to scan.'), 'warn'); return; }
    post({ cmd: 'stop' });
    Engine.lastTune = null;
    Object.assign(scan, { status: 'running', pct: 0, i: 0, found: [], log: [], tps });
    refresh(); scanNext();
  };
  function scanNext() {
    if (scan.status !== 'running') return;
    if (scan.i >= scan.tps.length) { scan.status = 'done'; scan.pct = 100; if (S.view === 'scan') refresh(); toast(`${t('Scan finished')}: ${scan.found.length}`, 'good'); return; }
    engine('scan', { id: scan.i, timeoutMs: 12000, nit: !!scan.net, tune: tuneRequest(satById(scan.sat), scan.tps[scan.i]) });
  }
  function onScanResult(m) {
    const p = scan.tps[scan.i];
    if (!p) return;
    let added = 0;
    (m.services || []).forEach(sv => {
      const video = sv.streams.find(x => x.kind === 'video'), audio = sv.streams.filter(x => x.kind === 'audio');
      const radio = sv.serviceType === 2 || sv.serviceType === 0x0A || (!video && audio.length > 0);
      if (!video && !audio.length) return;
      if ((radio && !scan.radio) || (!radio && !scan.tv) || (scan.fta && !sv.freeToAir)) return;
      scan.found.push({ name: sv.name || `Service ${sv.sid}`, provider: sv.provider, type: radio ? 'radio' : 'tv', fta: sv.freeToAir, tp: p, sid: sv.sid, tsid: sv.tsid, onid: sv.onid || m.onid || 0, svcType: sv.serviceType, video, audio, subs: sv.streams.filter(x => x.kind === 'subtitle'), txt: sv.streams.some(x => x.kind === 'teletext') });
      added++;
    });
    scan.log.unshift(`${p.freq} ${p.pol} ${p.sr}  ${m.locked ? '<b>lock</b>' : 'no lock'}  +${added}`);
    /* Network search: the NIT lists the other transponders of the network on this satellite. */
    if (scan.net && scan.mode !== 'manual' && Array.isArray(m.transponders)) {
      const lon = lonOf(satById(scan.sat));
      let more = 0;
      m.transponders.forEach(x => {
        if (x.orbital && Math.abs(x.orbital / 10 - lon) > 0.6) return;
        if (x.freqMHz < 10700 || x.freqMHz > 12750 || !x.symbolRate) return;
        if (scan.tps.some(q => Math.abs(q.freq - x.freqMHz) <= 3 && q.pol === x.pol)) return;
        scan.tps.push({ freq: x.freqMHz, pol: x.pol, sr: x.symbolRate, fec: x.fec, mod: x.mod, std: x.std, ro: x.rollOff, pilot: 'Auto' });
        more++;
      });
      if (more) scan.log.unshift(`NIT: +${more} ${t('transponders')}`);
    }
    scan.i++; scan.pct = scan.i / scan.tps.length * 100;
    if (S.view === 'scan') refresh();
    scanNext();
  }
  A['scan-pause'] = () => { scan.status = 'paused'; refresh(); };
  A['scan-resume'] = () => { scan.status = 'running'; refresh(); scanNext(); };
  A['scan-stop'] = () => { scan.status = 'done'; scan.log.unshift('Stopped by user'); refresh(); };
  A['scan-save'] = () => {
    const sat = satById(scan.sat);
    let added = 0;
    const newIds = [];
    scan.found.forEach(f => {
      const old = S.channels.find(c => c.sat === sat.id && c.f === f.tp.freq && c.p === f.tp.pol && c.sid === f.sid);
      if (old) { Object.assign(old, { tsid: f.tsid, onid: f.onid, svcType: f.svcType, txt: f.txt }); return; }
      if (!sat.tps.some(p => p.freq === f.tp.freq && p.pol === f.tp.pol)) sat.tps.push({ id: uid('tp'), ...f.tp });
      const radio = f.type === 'radio', hd = SVC_HD.includes(f.svcType) || HD_NAME.test(f.name) || f.video?.codec === 'H.265';
      const words = f.name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/);
      S.channels.push({ id: uid('ch'), lcn: S.channels.length + 1, name: f.name, provider: f.provider || '', code: words.slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'TV', num: '', kind: radio ? 'radio' : 'news', q: radio ? 'R' : f.svcType === 0x1F || /\b(4K|UHD)\b/i.test(f.name) ? '4K' : hd ? 'HD' : 'SD', p1: '#3a4678', p2: '#1d2547', type: f.type, sat: sat.id, f: f.tp.freq, p: f.tp.pol, tp: 0,
        vcodec: f.video?.codec || '', acodec: f.audio[0]?.codec || '', res: '', kbps: 0, sid: f.sid, tsid: f.tsid, vpid: f.video?.pid || 0, apid: f.audio[0]?.pid || 0,
        audio: f.audio.map(a => a.lang || a.codec), subs: f.subs.map(a => a.lang), fta: f.fta, fav: [], locked: false, hidden: false, onid: f.onid, svcType: f.svcType, txt: f.txt });
      newIds.push(S.channels[S.channels.length - 1].id);
      added++;
    });
    scan.found = []; save(); refresh(); toast(`${added} ${t('channels saved to your list')}`, 'good');
    piconAfterScan(newIds);
  };

  /* ---------- DiSEqC motor, DiSEqC 1.2 ---------- */
  const MOTOR = { 'Move west': 'E0316900', 'Move east': 'E0316800', 'Stop motor': 'E03160', 'Go to reference': 'E0316B00' };
  A.motor = el => {
    const name = el.dataset.v;
    if (name === 'Store position') {
      const id = uid('mp'), sat = curSat();
      A[id] = () => {
        const m = modals[modals.length - 1], v = Number(formVals(m).pos);
        if (!(v >= 1 && v <= 255)) { setErr(m, 'pos', t('Enter a position from 1 to 255.')); return; }
        engine('diseqc', { hex: 'E0316A' + v.toString(16).toUpperCase().padStart(2, '0') });
        sat.motorPos = v; save(); closeModal(); toast(`${t('Store position')}: ${sat.name} = ${v}`, 'good');
      };
      openModal({ title: `${t('Store position')}: ${sat?.name || ''}`, width: 380, body: field('Motor position (1 to 255)', 'pos', sat?.motorPos || 1, 'inputmode="numeric"'), foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
      return;
    }
    if (!Engine.opened) { toast(t('Motor commands need a connected tuner.'), 'warn'); return; }
    engine('diseqc', { hex: MOTOR[name] });
  };

  /* ---------- Recording ---------- */
  const recTitle = () => {
    const c = curCh(), n = S.settings.recEpgName ? nowNext(c)[0] : null;
    return n ? `${c.name} - ${n.title}` : c.name;
  };
  function startRec(title) { Engine.recTitle = title; post({ cmd: 'recPath', folder: S.settings.recFolder, title }); }
  function stopRec() {
    if (!Engine.recording) return;
    engine('recStop');
    const c = chById(Engine.recCh) || curCh(), mins = Math.max(1, Math.round((Date.now() - Engine.recStart) / 6e4));
    S.recordings.unshift({ id: uid('r'), title: Engine.recTitle || c.name, ch: c.id, at: Engine.recStart, mins, gb: +((Engine.signal?.bitrateKbps || 0) * mins * 60 / 8e6).toFixed(2), path: Engine.recPath });
    Engine.recording = false; recording = null; save(); toast(t('Recording saved to Recordings'), 'good');
    if (S.view === 'live') { renderPlayer(); renderCards(); } else if (S.view === 'recordings') refresh();
  }
  A['toggle-rec'] = () => {
    if (Engine.recording) { if (Sched.active) Sched.active.stopAt = 0; stopRec(); return; }
    if (S.mode !== 'live') { toast(t('Recording needs a tuner with a locked signal.'), 'warn'); return; }
    startRec(recTitle());
  };

  /* ---------- Scheduled recordings ----------
     Checked every few seconds while NOVA is open. A due schedule tunes its channel, records from the
     early margin to the late margin, then repeats daily or weekly, or is removed. */
  const Sched = { active: null };
  function finishTimer(k) {
    if (k.repeat === 'Daily' || k.repeat === 'Weekly') {
      const step = k.repeat === 'Daily' ? 864e5 : 7 * 864e5;
      while (k.start + k.mins * 6e4 <= Date.now()) k.start += step;
      delete k.pid;
    } else S.timers = S.timers.filter(x => x !== k);
    save();
    if (S.view === 'recordings') refresh();
  }
  function schedTick() {
    const now = Date.now(), early = (Number(S.settings.recPad) || 0) * 6e4, late = (Number(S.settings.recPost) || 0) * 6e4;
    const a = Sched.active;
    if (a) {
      if (now >= a.stopAt) { if (Engine.recording) stopRec(); Sched.active = null; finishTimer(a.timer); }
      return;
    }
    const due = S.timers.find(k => now >= k.start - early && now < k.start + k.mins * 6e4);
    if (!due) return;
    const ch = chById(due.ch);
    if (!ch) { finishTimer(due); return; }
    if (!Engine.opened) return;
    if (Engine.recording && Engine.recCh !== ch.id) { toast(`${t('Scheduled recording skipped, the tuner is busy')}: ${due.title}`, 'warn'); finishTimer(due); return; }
    Sched.active = { timer: due, stopAt: due.start + due.mins * 6e4 + late };
    if (Engine.recording) return;                         /* already recording this channel by hand */
    unlocked.add(ch.id);                                  /* a schedule set by the owner is not stopped by the PIN */
    if (S.player.ch !== ch.id || !Engine.lastTune) tune(ch.id);
    toast(`${t('Scheduled recording')}: ${due.title}`, 'good');
    setTimeout(() => { if (Sched.active?.timer === due && !Engine.recording) startRec(`${ch.name} - ${due.title}`); }, 4000);
  }
  setInterval(schedTick, 5000);
  Engine.schedTick = schedTick;      /* lets the tests run a check without waiting */
  A['rec-play'] = el => { const r = S.recordings.find(x => x.id === el.dataset.v); if (r?.path) { go('live'); post({ cmd: 'playFile', path: r.path }); S.player.playing = true; } };

  /* ---------- Window and files ---------- */
  A['win-min'] = () => post({ cmd: 'windowMin' });
  A['win-max'] = () => post({ cmd: 'windowMax' });
  const reallyClose = () => { save(); epgPersist(true); post({ cmd: 'saveState', state: JSON.parse(JSON.stringify(S, secretFilter)) }); post({ cmd: 'windowClose' }); };
  A['win-close'] = () => {
    if (S.settings.confirmExit) confirmBox({ title: t('Close NOVA DVB Studio?'), msg: Engine.recording ? t('A recording is running. Closing stops it.') : S.timers.length ? t('Scheduled recordings run only while NOVA is open.') : t('Playback stops and the tuner is released.'), yes: t('Close'), onYes: reallyClose });
    else reallyClose();
  };
  A.about = () => openModal({ title: 'NOVA DVB Studio', width: 480, body: `<dl class="kv dl-plain"><dt>${t('Version')}</dt><dd class="ltr">0.2.0</dd><dt>${t('Tuner')}</dt><dd>${esc(Engine.name || t('No tuner'))}</dd><dt>${t('Extension')}</dt><dd>${esc(Engine.caps?.extension || '—')}</dd><dt>${t('Icons')}</dt><dd>Lucide (ISC)</dd><dt>${t('Video')}</dt><dd>LibVLC (LGPL)</dd><dt>${t('Logos')}</dt><dd>picons project (github.com/picons/picons)</dd></dl>`, foot: `<button class="btn" data-act="logs">${t('Open log folder')}</button><button class="btn primary" data-act="modal-close">${t('Close')}</button>` });
  A.logs = () => post({ cmd: 'openLogs' });
  saveFile = async (filename, text) => post({ cmd: 'saveFile', name: filename, text });
  A['pick-folder'] = el => post({ cmd: 'pickFolder', key: el.dataset.v });

  /* ---------- Settings: devices ---------- */
  CAT_BODY.devices = () => {
    const rows = Engine.tuners.map(tn => `<div class="stat" style="gap:6px"><div class="row nw"><b class="sp">${esc(tn.name)}</b>${Engine.opened && Engine.index === tn.index ? stateTag('good', 'In use') : `<button class="btn sm" data-act="open-tuner" data-v="${tn.index}">${t('Use this tuner')}</button>`}</div><span class="sub">${esc(tn.maker || t('Maker not reported'))}</span></div>`).join('');
    const c = Engine.caps;
    const yes = v => stateTag(v ? 'good' : 'idle', v ? 'Reported' : 'Not reported');
    return `${rows || `<div class="empty">${ic('unplug')}<b>${t('No DVB devices found')}</b><span>${t('Connect a card and install its BDA driver, then detect again.')}</span></div>`}
      <div class="row"><button class="btn sm" data-act="detect2">${ic('refresh')}${t('Detect again')}</button></div>
      ${c ? `<div class="set-h">${t('Reported by this tuner')}</div>
      ${sRow('Maker extension', '', `<span class="ltr">${esc(c.extension)}</span>`, true)}${sRow('DiSEqC messages', '', yes(c.rawDiseqc), true)}${sRow('LNB power control', '', yes(c.lnbPowerControl), true)}${sRow('22 kHz control', '', yes(c.toneControl), true)}${sRow('DVB-S2 parameters', '', yes(c.dvbs2Params), true)}` : ''}`;
  };
  A['open-tuner'] = el => { S.settings.device = el.dataset.v; save(); engine('open', { index: Number(el.dataset.v) }); };

  /* ---------- Events from the engine and the app ---------- */
  function setMode(m) {
    if (S.mode === m) return;
    S.mode = m;
    if (S.view === 'live') { renderPlayer(); renderList(true); renderNow(); renderCards(); } else if (S.view === 'scan') refresh();
    renderStatus();
  }
  function onDevices(m) {
    Engine.tuners = m.tuners || [];
    if (!Engine.tuners.length) {
      Engine.opened = false; setMode('nodevice');
      if (S.view === 'preferences') refresh();
      toast(t('No DVB tuner was found on this computer.'), 'warn');
      return;
    }
    if (!Engine.opened && !Engine.opening) { const want = Number(S.settings.device); Engine.opening = true; engine('open', { index: Number.isInteger(want) && Engine.tuners[want] ? want : 0 }); }
    if (S.view === 'preferences') refresh();
  }
  function onSignal(m) {
    Engine.signal = m;
    const now = Date.now();
    if (Engine.lastTune) {
      if (m.locked) { Engine.lockWait = 0; setMode('live'); }
      else if (now > Engine.lockWait) {
        setMode('lost');
        if (S.settings.reconnect && now > Engine.retryAt) { Engine.retryAt = now + Number(S.settings.reconnectSec || 5) * 1000; engine('tune', Engine.lastTune); }
      }
    }
    updateSignalView();
  }
  function updateSignalView() {
    const m = Engine.signal, set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; }, w = (id, v) => { const e = $('#' + id); if (e) e.style.width = v + '%'; };
    if (!m) return;
    const q = m.quality, st = m.strength;
    set('m-qv', q == null ? '—' : `${q}%`); w('m-q', q == null ? 0 : clamp(q, 0, 100));
    set('m-sv', st == null ? '—' : String(st)); w('m-s', st == null ? 0 : clamp(st, 0, 100));
    set('st-down', `${(m.bitrateKbps / 1000).toFixed(2)} Mb/s`);
  }
  function onStats(m) {
    Engine.stats = m;
    const set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; }, w = (id, v) => { const e = $('#' + id); if (e) e.style.width = v + '%'; };
    if (m.cpu != null) { set('st-cpu', `${m.cpu}%`); w('st-cpu-b', m.cpu); }
    if (m.ram != null) { set('st-ram', `${m.ram}%`); w('st-ram-b', m.ram); }
    set('st-disk', `${m.drive} ${m.freeGb} GB`);
  }
  const epgConfig = () => engine('epgConfig', { on: (S.settings.epgSource || 'Broadcast (EIT)') === 'Broadcast (EIT)' && S.settings.epgUpdate !== 'Manually', lang: S.settings.epgLang || 'ara,eng,fre,fra' });
  settingsChanged = () => { if (Engine.opened) epgConfig(); };
  let txtOn = false;
  window.chrome.webview.addEventListener('message', e => {
    const m = e.data;
    if (m.id && HostReq.has(m.id) && (m.evt === 'fetched' || m.evt === 'piconFetched' || m.evt === 'piconSaved')) { HostReq.get(m.id)(m); HostReq.delete(m.id); return; }
    switch (m.evt) {
      case 'epg': if (Array.isArray(m.events)) epgFromEngine(m.events); break;
      case 'epgData': epgUnpack(m.data); epgRefreshViews(); break;
      case 'videoMouse': if (S.settings.osdMouse !== false && !ibOn()) ibShow(3); break;
      case 'trackChanged': {
        if (m.act === 'audio') toast(m.name ? `${t('Audio track')}: ${m.name}` : t('This channel has one audio track.'));
        else if (m.act === 'sub') toast(`${t('Subtitles')}: ${m.name === 'Off' ? t('Off') : m.name}`);
        else { toast(t(m.name === 'on' ? 'Teletext on' : txtOn ? 'Teletext off' : 'This channel carries no teletext.')); txtOn = m.name === 'on'; }
        break;
      }
      case 'ready': engine('list'); break;
      case 'devices': onDevices(m); break;
      case 'opened': epgConfig(); Engine.opening = false; Engine.opened = true; Engine.name = m.name; Engine.caps = m.capabilities; Engine.index = Number(S.settings.device) || 0; Engine.lastTune = null; setMode('ready'); renderStatus(); if (S.view === 'preferences') refresh(); toast(`${t('Tuner ready')}: ${m.name}`, 'good'); if (S.settings.startup === 'last' && S.channels.length && chById(S.player.ch)) tune(S.player.ch); break;
      case 'closed': Engine.opened = false; setMode('nodevice'); break;
      case 'signal': onSignal(m); break;
      case 'scanResult': onScanResult(m); break;
      case 'stats': onStats(m); break;
      case 'fetched': onSatList(m); break;
      case 'toggleFs': A.fullscreen(); break;
      case 'videoInfo': {
        const c = curCh();
        if (c) {
          c.res = `${m.width} x ${m.height}`;
          c.q = m.width >= 3000 ? '4K' : m.width >= 1200 ? 'HD' : 'SD';      /* the decoded picture is the final word */
          save();
          if (S.view === 'live') { renderNow(); renderList(true); renderPlayer(); }
        }
        break;
      }
      case 'tracks': showTracks(m); break;
      case 'recPath': Engine.recPath = m.path; Engine.recCh = S.player.ch; engine('recStart', { path: m.path }); Engine.recording = true; Engine.recStart = Date.now(); recording = { ch: S.player.ch, at: Date.now() }; if (S.view === 'live') { renderPlayer(); renderCards(); } toast(`${t('Recording')}: ${curCh().name}`, 'good'); break;
      case 'diseqcResult': toast(t(m.ok ? 'DiSEqC command sent' : 'The driver refused the DiSEqC command'), m.ok ? 'good' : 'bad'); break;
      case 'fileSaved': toast(`${t('Saved')} ${m.path}`, 'good'); break;
      case 'folderPicked': S.settings[m.key] = m.path; save(); refresh(); break;
      case 'player': if (m.state === 'error') toast(t('The player could not open this stream.'), 'bad'); break;
      case 'engineExit': Engine.opening = false; Engine.opened = false; Engine.lastTune = null; setMode('nodevice'); toast(t('The tuner engine stopped. Restarting it.'), 'bad'); setTimeout(() => engine('list'), 1500); break;
      case 'error': if (m.cmd === 'open') Engine.opening = false; toast(m.message || t('The tuner reported an error.'), 'bad'); break;
    }
  });

  /* ---------- Keeping the video window over the picture ---------- */
  let lastRect = '';
  function reportVideo() {
    const stage = $('#stage'), overlay = $('#stage-over')?.children.length;
    const show = !!stage && S.view === 'live' && S.layout.video && !overlay && !modals.length && !popEl && S.player.playing && S.mode === 'live' && !document.hidden;
    const r = stage?.getBoundingClientRect(), bar = $('#controls')?.getBoundingClientRect().height || 0;
    const msg = { cmd: 'videoRect', x: r?.left || 0, y: r?.top || 0, w: r?.width || 0, h: Math.max(0, (r?.height || 0) - bar), dpr: window.devicePixelRatio, show };
    const key = JSON.stringify(msg);
    if (key !== lastRect) { lastRect = key; post(msg); }
  }
  setInterval(reportVideo, 120);
  addEventListener('resize', reportVideo);

  /* First contact */
  S.mode = 'nodevice';
  setTimeout(() => {
    post({ cmd: 'uiReady' });
    post({ cmd: 'epgLoad' });
    if (!S.satListAt) post({ cmd: 'fetchText', url: SAT_LIST_URL });
    if (S.settings.epgSource === 'XMLTV address' && S.settings.epgUrl && S.settings.epgUpdate !== 'Manually') setTimeout(() => loadXmltv(false), 4000);
  }, 0);
})();
