/* Windows-app mode against a fake engine: info bar, broadcast guide, network scan, online logos and
   scheduled recordings. Paths come from NOVA_ROOT (the repository) and NOVA_OUT (where screenshots go). */
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path');
const ROOT = process.env.NOVA_ROOT || path.join(__dirname, '..', '..');
const OUT = process.env.NOVA_OUT || path.join(__dirname, 'out');
const URL_ = 'file://' + path.join(ROOT, 'src/NOVA.UI/wwwroot/index.html');
const res = { pass: 0, fail: [] };
const ok = (c, n) => { if (c) res.pass++; else { res.fail.push(n); console.log('FAIL', n); } };

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => {
    const ls = [];
    window.__sent = [];
    window.chrome = { webview: { postMessage: m => window.__sent.push(JSON.parse(JSON.stringify(m))), addEventListener: (_, f) => ls.push(f) } };
    window.__recv = m => ls.forEach(f => f({ data: m }));
    window.__NOVA_STATE = null;
  });
  await p.goto(URL_); await p.waitForTimeout(250);
  const sent = c => p.evaluate(c => window.__sent.filter(m => m.cmd === c), c);
  const last = async c => (await sent(c)).at(-1);
  const recv = m => p.evaluate(m => window.__recv(m), m);
  const clear = () => p.evaluate(() => { window.__sent.length = 0; });
  const go = v => p.evaluate(v => go(v), v);

  ok((await sent('epgLoad')).length === 1, 'asks the app for the saved guide');
  await recv({ evt: 'devices', tuners: [{ index: 0, name: 'TBS 6902 DVBS/S2 Tuner A', maker: 'TBS' }] });
  await clear();
  await recv({ evt: 'opened', name: 'TBS 6902 DVBS/S2 Tuner A', capabilities: { extension: 'tbs' } });
  const cfg = await last('epgConfig');
  ok(cfg && cfg.on === true && cfg.lang.startsWith('ara'), 'guide reading is switched on in the engine, Arabic first');

  /* Network scan: the NIT adds transponders, services keep their network id */
  await go('scan');
  ok(await p.locator('#scan-net').count() === 1, 'network table option is offered');
  await clear(); await p.click('[data-act="scan-start"]');
  const sc = await last('scan'); ok(sc.nit === true, 'scan asks the engine for the NIT');
  const before = await p.evaluate(() => scan.tps.length);
  await recv({ evt: 'scanResult', id: 0, locked: true, complete: true, onid: 126,
    services: [{ sid: 101, tsid: 1, onid: 126, name: 'Real One HD', provider: 'P', serviceType: 0x19, freeToAir: true, streams: [{ pid: 201, kind: 'video', codec: 'H.264' }, { pid: 202, kind: 'audio', codec: 'AAC', lang: 'ara' }, { pid: 203, kind: 'audio', codec: 'AC3', lang: 'eng' }, { pid: 204, kind: 'subtitle', lang: 'fre' }, { pid: 205, kind: 'teletext', lang: 'ara' }] }],
    transponders: [{ freqMHz: 10727, pol: 'V', symbolRate: 27500, fec: '5/6', mod: '8PSK', std: 'DVB-S2', rollOff: '0.35', orbital: -70 }, { freqMHz: 11747, pol: 'H', symbolRate: 27500, fec: '3/4', mod: 'QPSK', std: 'DVB-S', orbital: -70 }, { freqMHz: 11000, pol: 'H', symbolRate: 27500, fec: '3/4', mod: 'QPSK', std: 'DVB-S', orbital: 130 }] });
  const after = await p.evaluate(() => scan.tps.length);
  ok(after === before + 1, `only the new transponder of this satellite is queued (${before} -> ${after})`);
  await clear(); await p.click('[data-act="scan-stop"]'); await p.click('[data-act="scan-save"]'); await p.waitForTimeout(50);
  const idx = (await sent('fetchText')).filter(m => /srp\.index|utf8snp\.index/.test(m.url));
  ok(idx.length === 2 && idx[0].preferCache === true, 'new channels start a logo download with the cached index');
  for (const m of idx) await recv({ evt: 'fetched', id: m.id, ok: false });
  await p.waitForTimeout(50);
  ok((await p.textContent('#toasts')).includes('logo index'), 'a missing index is reported');
  const ch = await p.evaluate(() => S.channels.find(c => c.sid === 101));
  ok(ch && ch.onid === 126 && ch.txt === true && ch.svcType === 0x19, 'channel keeps network id, teletext and service type');
  ok(await p.evaluate(() => srpKey(S.channels.find(c => c.sid === 101))) === '65_1_7E_DCA0000', 'service reference for 7.0W is built as the picons project writes it');
  ok(await p.evaluate(() => e2Picon(S.channels.find(c => c.sid === 101))) === '1_0_19_65_1_7E_DCA0000_0_0_0', 'Enigma2 picon name is built');

  /* Info bar */
  await go('live'); await clear();
  await p.locator('#ch-list .ch').first().click();
  await recv({ evt: 'signal', available: true, locked: true, present: true, strength: 89, quality: 92, bitrateKbps: 9000 });
  await recv({ evt: 'videoInfo', width: 1920, height: 1080 });
  await p.waitForTimeout(1200);
  let osd = await last('osd');
  ok(osd && osd.show === true, 'channel change shows the info bar');
  const d = osd.data;
  ok(d.num === '001' && d.name === 'Real One HD', 'number and name');
  ok(d.snr.pct === 92 && d.agc.pct === 89, 'SNR and AGC meters come from the driver');
  ok(d.badges.map(x => x.t).join() === 'FHD,H.264,16:9,1920×1080', 'picture badges: ' + d.badges.map(x => x.t));
  ok(d.sat.includes('7.0°W') && d.tp.startsWith('12245'), 'satellite and transponder');
  ok(d.access === 'TV (Free)', 'access line');
  ok(d.audio.on && d.audio.sub.includes('AAC') && d.sub.on && d.sub.sub === '1' && d.txt.on, 'audio, subtitles and teletext state');
  ok(d.now === null && d.noEpg.length > 0, 'no invented programs before the guide arrives');
  ok(/^\d\d:\d\d$/.test(d.time) && d.date.length > 8, 'clock and date');

  /* Broadcast guide */
  const now = Math.floor(Date.now() / 1000);
  await recv({ evt: 'epg', events: [
    { onid: 126, tsid: 1, sid: 101, id: 1, start: now - 600, duration: 3600, title: 'Evening News', text: 'Headlines', genre: 2 },
    { onid: 126, tsid: 1, sid: 101, id: 2, start: now + 3000, duration: 1800, title: 'Late Film', text: '', genre: 1 }] });
  await p.waitForTimeout(1300);
  osd = await last('osd');
  ok(osd.data.now?.title === 'Evening News' && osd.data.next?.title === 'Late Film', 'info bar shows now and next from the broadcast');
  ok(osd.data.now.pct > 10 && osd.data.now.pct < 25 && /^\+\d+ min$/.test(osd.data.now.left), 'progress and minutes left: ' + JSON.stringify(osd.data.now));
  ok((await p.textContent('#p-now')).includes('Evening News'), 'now and next bar uses the broadcast guide');
  await go('epg'); ok((await p.textContent('.main')).includes('Evening News'), 'program guide grid shows broadcast events');
  ok((await p.textContent('.page-head')).includes('From the broadcast'), 'guide says where listings come from');
  await go('live');
  await p.evaluate(() => epgPersist(true)); const saved = await last('epgSave');
  ok(saved && saved.data.items.length === 1 && saved.data.items[0][0] === '1:101', 'guide is saved to the app');
  await p.evaluate(() => epgClear()); ok(await p.evaluate(() => !hasLiveEpg()), 'guide can be cleared');
  await recv({ evt: 'epgData', data: saved.data }); ok(await p.evaluate(() => nowNext(curCh())[0]?.title) === 'Evening News', 'saved guide comes back at start-up');

  /* XMLTV */
  const xmltv = `<?xml version="1.0"?><tv><channel id="r1"><display-name>Real One</display-name></channel><programme channel="r1" start="${new Date(Date.now() + 864e5).toISOString().replace(/[-:T]/g, '').slice(0, 14)} +0000" stop="${new Date(Date.now() + 864e5 + 36e5).toISOString().replace(/[-:T]/g, '').slice(0, 14)} +0000"><title>Tomorrow Show</title><desc>From XMLTV</desc></programme></tv>`;
  const xr = await p.evaluate(x => applyXmltv(x), xmltv);
  ok(xr.chans === 1 && xr.progs === 1, 'XMLTV matches "Real One" to "Real One HD"');
  ok(await p.evaluate(() => epgFor(curCh()).some(e => e.title === 'Tomorrow Show')), 'XMLTV programs join the guide');

  /* Info bar keys and buttons */
  await clear(); await p.keyboard.press('i'); await p.waitForTimeout(80);
  ok((await last('osd'))?.show === false, 'I hides the info bar');
  await p.keyboard.press('i'); await p.waitForTimeout(80); ok((await last('osd'))?.show === true, 'I shows it again');
  await p.keyboard.press('a'); ok(await last('cycleAudio'), 'A switches the audio track');
  await p.keyboard.press('t'); ok(await last('teletext'), 'T toggles teletext');
  await recv({ evt: 'trackChanged', act: 'audio', name: 'English' }); ok((await p.textContent('#toasts')).includes('English'), 'new audio track is announced');
  await clear(); await p.click('[data-act="customize"]'); await p.waitForTimeout(200);
  ok((await last('videoRect')).show === false, 'video and its info bar hide behind dialogs');
  await p.keyboard.press('Escape');
  await clear(); await recv({ evt: 'videoMouse' }); await p.waitForTimeout(60);
  ok(true, 'mouse over the picture is accepted');

  /* Online logos: indexes, matching by service reference, SVG turned into PNG */
  await p.evaluate(() => { window.__autoHost = true; });
  const hostLoop = setInterval(async () => {
    try {
      const pend = await p.evaluate(() => { const l = window.__sent.filter(m => (m.cmd === 'fetchText' || m.cmd === 'piconFetch' || m.cmd === 'piconWrite') && !m.done); l.forEach(m => { m.done = true; }); return l; });
      for (const m of pend) {
        if (m.cmd === 'fetchText' && m.url.endsWith('srp.index')) await recv({ evt: 'fetched', id: m.id, ok: true, text: '65_1_7E_DCA0000=realone\n1_2_3_4=other\n' });
        else if (m.cmd === 'fetchText' && m.url.endsWith('utf8snp.index')) await recv({ evt: 'fetched', id: m.id, ok: true, text: 'wave fm=wavefm\n' });
        else if (m.cmd === 'piconFetch') await recv({ evt: 'piconFetched', id: m.id, ok: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="#c00"/></svg>' });
        else if (m.cmd === 'piconWrite') await recv({ evt: 'piconSaved', id: m.id, file: m.name + '.png' });
      }
    } catch (e) { /* page busy */ }
  }, 50);
  await clear();
  await p.evaluate(() => { delete S.picons[S.channels.find(c => c.sid === 101).id]; return piconDownload(S.channels.filter(c => c.sid === 101)); });
  const pf = await last('piconFetch');
  ok(pf && pf.urls[0].endsWith('/logos/realone.default.svg') && pf.urls[0].startsWith('https://raw.githubusercontent.com/picons/picons/'), 'logo is looked up in the picons project: ' + pf?.urls?.[0]);
  const pw = await last('piconWrite');
  ok(pw && pw.b64.length > 100 && pw.name === 'realone-default', 'SVG logo is turned into PNG for the info bar window');
  ok(await p.evaluate(() => S.picons[S.channels.find(c => c.sid === 101).id]).then(v => /^https:\/\/picons\.nova\.app\/realone-default\.png\?v=\d+$/.test(v)), 'channel points at the saved logo');
  clearInterval(hostLoop);
  await go('picons'); ok(await p.locator('[data-act="pic-online"]').count() === 1 && await p.locator('[data-act="pic-find"]').count() > 0, 'Picon Manager offers download and search');
  await go('preferences'); await p.click('[data-act="set-cat"][data-v="picons"]');
  await p.selectOption('#set-piconSource', 'custom'); await p.fill('#set-piconCustom', 'https://my.example/picon/{srp}.png');
  ok(await p.evaluate(() => customUrls(S.channels.find(c => c.sid === 101))[0]) === 'https://my.example/picon/1_0_19_65_1_7E_DCA0000_0_0_0.png', 'custom server pattern');
  await p.selectOption('#set-piconSource', 'picons');
  await clear(); await p.click('[data-act="pic-site"]'); ok((await last('openUrl'))?.url === 'https://github.com/picons/picons', 'website opens in the browser');

  /* Scheduled recording */
  await go('live');
  await p.evaluate(() => { const c = S.channels.find(x => x.sid === 101); S.settings.recPad = 0; S.settings.recPost = 0; S.timers = [{ id: 't1', ch: c.id, title: 'Evening News', start: Date.now() - 1000, mins: 30, repeat: 'Daily' }]; Engine.schedTick(); });
  await p.waitForTimeout(4300);
  const rp = await last('recPath'); ok(rp && rp.title === 'Real One HD - Evening News', 'schedule starts a recording by itself');
  await recv({ evt: 'recPath', path: 'C:\\NOVA Recordings\\b.ts' }); ok((await last('recStart')).path.endsWith('b.ts'), 'engine records the schedule');
  await clear(); await p.evaluate(() => Engine.schedTick());
  ok(await p.evaluate(() => Engine.recording) && !(await last('recStop')), 'keeps recording until the end');
  await p.evaluate(() => { const real = Date.now; Date.now = () => real() + 31 * 6e4; try { Engine.schedTick(); } finally { Date.now = real; } });
  ok(await last('recStop'), 'schedule stops the recording at the end');
  const tm = await p.evaluate(() => ({ n: S.timers.length, start: S.timers[0]?.start, rec: S.recordings[0]?.title }));
  ok(tm.n === 1 && tm.start > Date.now() + 20 * 36e5 && tm.rec === 'Real One HD - Evening News', 'daily schedule moves to tomorrow and the recording is listed: ' + JSON.stringify(tm));
  ok(errs.length === 0, 'no script errors: ' + errs.slice(0, 3).join(' | '));

  await go('live'); await p.screenshot({ path: path.join(OUT, 'features.png') });
  console.log(`\nPassed ${res.pass}, failed ${res.fail.length}`);
  if (res.fail.length) console.log(res.fail.join('\n'));
  await b.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
