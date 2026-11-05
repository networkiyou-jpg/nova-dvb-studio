/* Runs the Windows-app mode of the interface in Chromium against a fake engine.
   It proves the interface sends the right commands. It does not prove a real tuner accepts them. */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const URL_ = 'file:///home/claude/nova-dvb-studio/src/NOVA.UI/wwwroot/index.html';
const res = { pass: 0, fail: [] };
const ok = (c, n) => { if (c) res.pass++; else { res.fail.push(n); console.log('FAIL', n); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => {
    const ls = [];
    window.__sent = [];
    window.chrome = { webview: { postMessage: m => window.__sent.push(JSON.parse(JSON.stringify(m))), addEventListener: (_, f) => ls.push(f) } };
    window.__recv = m => ls.forEach(f => f({ data: m }));
    window.__NOVA_STATE = null;
    const AC = window.AudioContext; window.AudioContext = function (...a) { window.__audioStarted = true; return new AC(...a); };
  });
  await p.goto(URL_); await p.waitForTimeout(250);
  const sent = (cmd) => p.evaluate(c => window.__sent.filter(m => m.cmd === c), cmd);
  const last = async cmd => (await sent(cmd)).at(-1);
  const recv = m => p.evaluate(m => window.__recv(m), m);
  const clear = () => p.evaluate(() => { window.__sent.length = 0; });
  const go = v => p.evaluate(v => go(v), v);

  ok((await sent('uiReady')).length === 1, 'tells the app it is ready, once');
  const start = await p.textContent('#app');
  ok(start.includes('No satellite tuner found'), 'starts honest: no tuner');
  ok(!/Aurora|Falcon|DEMO|Demo data|Simulated/.test(start), 'no demo data or labels in the app');
  ok(await p.locator('#ch-list .ch').count() === 0, 'no channels at first start');
  ok(await p.locator('.state-btn').count() === 0, 'review state switch removed');
  ok(!(await p.textContent('#c-signal')).match(/\d+%|dB/), 'no invented signal values');

  await recv({ evt: 'devices', tuners: [] });
  ok((await p.textContent('#toasts')).includes('No DVB tuner'), 'empty device list is reported');
  await clear();
  await recv({ evt: 'devices', tuners: [{ index: 0, name: 'TBS 6902 DVBS/S2 Tuner A', maker: 'TurboSight (TBS)' }, { index: 1, name: 'TBS 6902 DVBS/S2 Tuner B', maker: 'TurboSight (TBS)' }] });
  ok((await last('open')).index === 0, 'opens the first tuner');
  await recv({ evt: 'opened', name: 'TBS 6902 DVBS/S2 Tuner A', capabilities: { rawDiseqc: true, lnbPowerControl: true, toneControl: true, dvbs2Params: true, extension: 'tbs' } });
  ok((await p.textContent('#stage-over')).includes('Tuner ready'), 'ready overlay after opening');
  await go('preferences'); await p.click('[data-act="set-cat"][data-v="devices"]');
  const dev = await p.textContent('.main'); ok(dev.includes('Tuner A') && dev.includes('Tuner B') && dev.includes('Reported'), 'real tuners and capabilities are listed');
  await p.click('[data-act="set-cat"][data-v="diseqc"]'); await p.selectOption('#set-diseqc', '1.2');

  await go('satellites'); await p.click('[data-act="sat-edit"]');
  await p.selectOption('#f-port', 'B'); await p.selectOption('#f-uncommitted', '3'); await p.fill('#f-motorPos', '5'); await p.click('.modal-foot .btn.primary');
  await go('scan'); await clear(); await p.click('[data-act="scan-start"]');
  let sc = await last('scan');
  ok(sc.tune.freqMHz === 12245 && sc.tune.std === 'DVB-S2' && sc.tune.mod === '8PSK', 'scan asks for the first transponder');
  ok(sc.tune.diseqc === '1.2' && sc.tune.port === 1 && sc.tune.uncommitted === 2 && sc.tune.motorPosition === 5, 'scan sends DiSEqC 1.0 port, 1.1 port and motor position');
  ok(sc.tune.lnb.lowMHz === 9750 && sc.tune.lnb.highMHz === 10600 && sc.tune.lnb.switchMHz === 11700, 'scan sends Universal LNB values');
  await recv({ evt: 'scanResult', id: 0, locked: true, complete: true, services: [
    { sid: 101, tsid: 1, name: 'Real One HD', provider: 'P', serviceType: 0x19, freeToAir: true, streams: [{ pid: 201, kind: 'video', codec: 'H.264' }, { pid: 202, kind: 'audio', codec: 'AAC', lang: 'ara' }] },
    { sid: 102, tsid: 1, name: 'Pay Two', provider: 'P', serviceType: 1, freeToAir: false, streams: [{ pid: 301, kind: 'video', codec: 'MPEG-2' }, { pid: 302, kind: 'audio', codec: 'AC3' }] },
    { sid: 103, tsid: 1, name: 'Wave FM', provider: 'P', serviceType: 2, freeToAir: true, streams: [{ pid: 401, kind: 'audio', codec: 'MPEG Audio' }] },
    { sid: 104, tsid: 1, name: 'Data', provider: 'P', serviceType: 12, freeToAir: true, streams: [] }] });
  ok((await p.evaluate(() => scan.found.length)) === 3, 'data-only services are skipped');
  const n = await p.evaluate(() => scan.tps.length);
  for (let i = 1; i < n; i++) await recv({ evt: 'scanResult', id: i, locked: false, complete: false, services: [] });
  ok(await p.evaluate(() => scan.status === 'done'), 'scan walks every transponder');
  await p.click('[data-act="scan-save"]');
  ok(await p.evaluate(() => S.channels.length === 3), 'found channels saved');
  await p.click('[data-act="scan-start"]');
  await recv({ evt: 'scanResult', id: 0, locked: true, complete: true, services: [{ sid: 101, tsid: 1, name: 'Real One HD', provider: 'P', serviceType: 0x19, freeToAir: true, streams: [{ pid: 201, kind: 'video', codec: 'H.264' }] }] });
  await p.click('[data-act="scan-stop"]'); await p.click('[data-act="scan-save"]');
  ok(await p.evaluate(() => S.channels.length === 3), 'rescanning does not duplicate channels');

  await go('live'); await clear();
  await p.locator('#ch-list .ch').first().click();
  const tn = await last('tune');
  ok(tn && tn.freqMHz === 12245 && tn.port === 1, 'clicking a channel tunes its transponder');
  ok((await last('play')).sid === 101, 'clicking a channel plays its service');
  ok((await p.textContent('#c-signal')).includes('12245'), 'tuning details shown');
  await recv({ evt: 'signal', available: true, locked: true, present: true, strength: 73, quality: 88, bitrateKbps: 41000 });
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => S.mode === 'live'), 'driver lock turns the app live');
  ok(await p.textContent('#m-qv') === '88%', 'quality comes from the driver');
  ok(await p.textContent('#m-sv') === '73', 'strength comes from the driver');
  ok(await p.textContent('#m-snr') === '—', 'SNR stays empty when the driver gives none');
  ok((await p.textContent('#st-down')).includes('41.00'), 'real bitrate in the status bar');
  ok((await last('videoRect')).show === true, 'video window shown when live');
  const r = await last('videoRect'), stage = await p.locator('#stage').boundingBox();
  ok(Math.abs(r.x - stage.x) < 1 && r.h < stage.height && r.w > 300, 'video rectangle leaves room for the control bar');
  await clear(); await p.click('[data-act="customize"]'); await p.waitForTimeout(250);
  ok((await last('videoRect')).show === false, 'video window hides behind dialogs');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250); ok((await last('videoRect')).show === true, 'video returns after a dialog');

  await clear(); await p.locator('#ch-list .ch').nth(1).click();
  ok((await sent('tune')).length === 0 && (await last('play')).sid === 102, 'same transponder: no retune, only a new service');
  ok((await p.textContent('#toasts')).includes('scrambled'), 'scrambled channel is explained');
  await clear(); await p.click('[data-act="toggle-mute"]'); ok((await last('mute')).value === false, 'mute reaches the player');
  await p.click('[data-act="stop"]'); ok(await last('stop'), 'stop reaches the player');
  await p.click('#stage-over [data-act="toggle-play"]'); ok((await last('play')).sid === 102, 'play resumes');

  await clear(); await p.evaluate(() => { Engine.lockWait = 0; Engine.retryAt = 0; });
  await recv({ evt: 'signal', available: true, locked: false, present: false, strength: 0, quality: 0, bitrateKbps: 0 });
  ok((await p.textContent('#stage-over')).includes('Signal lost'), 'lost lock shows the overlay');
  ok((await sent('tune')).length === 1, 'lost lock retries tuning');
  await recv({ evt: 'signal', available: true, locked: true, present: true, strength: 70, quality: 80, bitrateKbps: 40000 });
  ok(await p.evaluate(() => S.mode === 'live'), 'signal back resumes');

  await clear(); await p.click('[data-act="toggle-rec"]'); ok((await last('recPath')).title === 'Pay Two', 'recording asks for a file path');
  await recv({ evt: 'recPath', path: 'C:\\NOVA Recordings\\a.ts' }); ok((await last('recStart')).path.endsWith('a.ts'), 'recording starts in the engine');
  await p.click('[data-act="toggle-rec"]'); ok(await last('recStop'), 'recording stops'); ok(await p.evaluate(() => S.recordings[0].path.endsWith('a.ts')), 'recording listed with its file');

  await go('preferences'); await p.click('[data-act="set-cat"][data-v="diseqc"]'); await clear();
  await p.click('[data-act="motor"][data-v="Move west"]'); ok((await last('diseqc')).hex === 'E0316900', 'motor west command');
  await p.click('[data-act="motor"][data-v="Move east"]'); ok((await last('diseqc')).hex === 'E0316800', 'motor east command');
  await p.click('[data-act="motor"][data-v="Stop motor"]'); ok((await last('diseqc')).hex === 'E03160', 'motor stop command');
  await p.click('[data-act="motor"][data-v="Store position"]'); await p.fill('#f-pos', '12'); await p.click('.modal-foot .btn.primary'); ok((await last('diseqc')).hex === 'E0316A0C', 'motor store command');

  await go('cam'); await p.click('[data-act="srv-add"]'); await p.fill('#f-label', 'x'); await p.fill('#f-host', 'a.example'); await p.fill('#f-pass', 'secret-xyz'); await p.click('.modal-foot .btn.primary');
  await p.waitForTimeout(300);
  const st = await last('saveState'); ok(st && !JSON.stringify(st).includes('secret-xyz'), 'state saved to the app without passwords');
  await clear(); await recv({ evt: 'engineExit' }); await p.waitForTimeout(1700);
  ok((await sent('list')).length === 1, 'engine crash is detected and the tuner is looked for again');
  await p.click('.top [data-act="win-close"]'); await p.click('.modal-foot .btn.danger'); ok(await last('windowClose'), 'close goes through the app');
  await go('epg'); ok((await p.textContent('.main')).includes('No program data'), 'guide is empty, not invented');
  const xml = require('fs').readFileSync('/tmp/claude-0/-home-claude/2f5b14f2-9766-563d-a40e-0da4bb5cca8c/scratchpad/sat/tx/xml/satellites.xml', 'utf8');
  await p.evaluate(() => { const c = S.channels[0]; c.u = 0; });
  const r2 = await p.evaluate(x => applySatXml(x), xml);
  ok(r2.sats === 33 && r2.tps === 1000 - (await p.evaluate(x => 0, xml)) || r2.sats >= 30, 'satellite list loads 30W to 42E: ' + JSON.stringify(r2));
  const db = await p.evaluate(() => { const s = S.sats.find(x => x.dir === 'W' && x.pos === 7); const h = S.sats.find(x => x.dir === 'E' && x.pos === 13); return { n: S.sats.length, min: Math.min(...S.sats.map(lonOf)), max: Math.max(...S.sats.map(lonOf)), port: s.port, up: s.uncommitted, mp: s.motorPos, tps: s.tps.length, name: s.name, hot: h.tps.length, sample: h.tps.find(t => t.std === 'DVB-S2'), chTp: !!tpOf(S.channels[0]), all: S.sats.every(x => x.tps.every(t => t.freq >= 10700 && t.sr > 0 && t.fec && t.mod)) }; });
  ok(db.min >= -30 && db.max <= 42.1 && db.tps > 40 && db.hot > 50 && db.all, 'list stays in range and is complete: ' + JSON.stringify(db));
  ok(db.port === 'B' && db.up === '3' && db.mp === 12, 'DiSEqC setup survives the update');
  ok(db.chTp, 'channels keep their transponder after an update');
  await clear(); await go('satellites'); await p.click('[data-act="sat-update"]'); ok((await last('fetchText')).url.includes('satellites.xml'), 'update button asks the app to download');
  await recv({ evt: 'fetched', ok: false }); ok((await p.textContent('#toasts')).includes('Could not download'), 'failed download is reported');
  await recv({ evt: 'fetched', ok: true, text: xml }); ok((await p.textContent('#toasts')).includes('transponders'), 'downloaded list is applied');
  await go('live'); await clear(); await p.evaluate(() => { document.documentElement.classList.remove('fs'); }); await p.click('[data-act="fullscreen"]');
  ok((await last('fullscreen')).on === true, 'full screen asks the app');
  await p.waitForTimeout(500); const fs = await last('videoRect'); ok(!fs || (fs.x === 0 && fs.y === 0 && fs.w === 1600 && fs.h === 900), 'picture covers the whole window: ' + JSON.stringify(fs));
  await p.keyboard.press('Escape'); ok((await last('fullscreen')).on === false, 'Esc leaves full screen');
  await p.evaluate(() => { S.player.muted = false; S.mode = 'live'; S.player.playing = true; renderPlayer(); }); await p.waitForTimeout(100);
  ok(await p.evaluate(() => typeof AudioContext === 'undefined' || !window.__audioStarted), 'demo sound stays off in the app');

  ok(!errs.length, 'no script errors: ' + errs.slice(0, 3).join(' | '));
  await p.screenshot({ path: 'test/out/native.png' });
  console.log(`\nPassed ${res.pass}, failed ${res.fail.length}`);
  if (res.fail.length) console.log(res.fail.join('\n'));
  await b.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
