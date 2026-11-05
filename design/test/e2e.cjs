/* End-to-end checks in a real Chromium: every control on every screen, then the main user flows. */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
const URL_ = 'file:///home/claude/nova-dvb-studio/design/dist/nova-dvb-studio.html';
const VIEWS = ['live', 'satellites', 'scan', 'channels', 'epg', 'recordings', 'cam', 'biss', 'picons', 'skins', 'preferences', 'backup'];
const res = { pass: 0, fail: [] };
const ok = (c, name) => { if (c) res.pass++; else { res.fail.push(name); console.log('FAIL', name); } };
const tmp = '/tmp/claude-0/-home-claude/2f5b14f2-9766-563d-a40e-0da4bb5cca8c/scratchpad';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.g/, r => r.abort());
  await p.goto(URL_); await p.waitForTimeout(400);
  const go = v => p.evaluate(v => go(v), v);
  const clean = () => p.evaluate(() => { while (modals.length) closeModal(); closePop(); document.getElementById('minimized')?.remove(); });

  /* 1. Every control is wired, on every screen, in all three states */
  for (const mode of ['live', 'lost', 'nodevice']) {
    await p.evaluate(m => { S.mode = m; }, mode);
    for (const v of VIEWS) {
      await go(v); await p.waitForTimeout(40);
      const cats = v === 'preferences' ? await p.evaluate(() => CATS.map(c => c[0])) : [null];
      for (const c of cats) {
        if (c) { await p.evaluate(c => { setCat = c; refresh(); }, c); }
        const acts = await p.evaluate(() => [...document.querySelectorAll('[data-act]')].filter(e => e.offsetParent !== null || e.closest('svg')).map(e => e.dataset.act));
        const missing = acts.filter(a => !a.startsWith('c') || a.length < 18).length && await p.evaluate(list => list.filter(a => !A[a]), acts);
        ok(!missing || !missing.length, `${mode}/${v}/${c}: all actions defined ${missing}`);
        const unwired = await p.evaluate(() => [...document.querySelectorAll('button:not([data-act])')].filter(e => e.offsetParent !== null).map(e => e.outerHTML.slice(0, 80)));
        ok(!unwired.length, `${mode}/${v}/${c}: no button without action ${unwired[0] || ''}`);
        const chg = await p.evaluate(() => [...document.querySelectorAll('[data-chg]')].map(e => e.dataset.chg).filter(k => !CHG[k]));
        ok(!chg.length, `${mode}/${v}/${c}: change handlers ${chg}`);
      }
    }
  }
  await p.evaluate(() => { S.mode = 'live'; setCat = 'general'; });

  /* 2. Click everything once. Skips actions covered by flows below or that end the session. */
  const skip = /^(bk-reset|win-close|win-min|win-max|fullscreen|sat-import|sat-export|cm-import|cm-export|biss-import|biss-export|skin-install|skin-export|bk-restore|bk-make|pic-set|pic-bulk|bk-down|detect)$/;
  for (const v of VIEWS) {
    await go(v); await p.waitForTimeout(30);
    const n = await p.evaluate(() => document.querySelectorAll('[data-act]').length);
    const limit = Math.min(n, v === 'epg' ? 40 : 90);
    for (let i = 0; i < limit; i++) {
      await clean(); await go(v);
      const clicked = await p.evaluate(({ i, skip }) => {
        const el = [...document.querySelectorAll('[data-act]')][i];
        if (!el || el.disabled || new RegExp(skip).test(el.dataset.act) || !document.body.contains(el)) return null;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return el.dataset.act;
      }, { i, skip: skip.source });
      if (clicked) { await p.waitForTimeout(5); res.pass++; }
    }
    await clean();
  }
  await p.waitForTimeout(700);
  ok(!errs.length, 'no script errors after clicking everything: ' + errs.slice(0, 3).join(' | '));
  errs.length = 0;

  /* Fresh state for flows */
  await p.evaluate(k => { localStorage.clear(); }, 0);
  await p.goto(URL_ + '#live'); await p.evaluate(() => { localStorage.clear(); S = seedState(); recording = null; theater = false; CM.group = 'all'; CM.q = ''; CM.sel.clear(); EG.q = ''; EG.day = 0; EG.group = 'tv'; PM.filter = 'all'; PM.q = ''; liveBuilt = false; document.getElementById('view-live').innerHTML = ''; renderAll(); });
  await p.waitForTimeout(200);

  /* 3. Live flows */
  await p.fill('#ch-search', 'falcon'); await p.waitForTimeout(50);
  ok(await p.locator('#ch-list .ch').count() === 3, 'search filters channel list to 3');
  await p.fill('#ch-search', ''); await p.waitForTimeout(50);
  await p.click('[data-act="list-tab"][data-v="radio"]');
  ok((await p.locator('#ch-list .ch').count()) === 8, 'radio tab shows 8');
  await p.click('[data-act="list-tab"][data-v="all"]');
  await p.locator('#ch-list .ch').nth(3).click(); await p.waitForTimeout(700);
  ok(await p.textContent('#vid-head h2') === 'Aurora Sports 4 HD', 'clicking a channel tunes it');
  ok((await p.textContent('#p-now')).includes('Aurora Sports 4 HD'), 'now bar follows channel');
  await p.locator('#ch-list .ch').nth(4).locator('.star').click();
  ok(await p.evaluate(() => chById('ch5').fav.length === 1), 'star adds favorite');
  ok(await p.evaluate(() => S.player.ch === 'ch4'), 'star does not change channel');
  await p.keyboard.press('Escape');
  await p.click('[data-act="toggle-play"]'); ok(await p.evaluate(() => !S.player.playing), 'pause'); await p.click('#stage-over [data-act="toggle-play"]'); ok(await p.evaluate(() => S.player.playing), 'resume');
  await p.click('[data-act="toggle-mute"]'); ok(await p.evaluate(() => !S.player.muted), 'unmute');
  await p.evaluate(() => { const v = document.getElementById('vol'); v.value = 80; v.dispatchEvent(new Event('input', { bubbles: true })); }); ok(await p.evaluate(() => S.player.vol === 80), 'volume');
  await p.click('[data-act="aspect"]'); await p.click('.pop [data-v="4:3"]'); ok(await p.getAttribute('#stage', 'data-aspect') === '4:3', 'aspect');
  await p.click('[data-act="aspect"]'); await p.click('.pop [data-v="Fill"]');
  await p.click('[data-act="tracks"]'); ok((await p.locator('.pop [data-act="set-audio"]').count()) >= 1, 'audio tracks listed'); await p.keyboard.press('Escape');
  await p.click('[data-act="toggle-rec"]'); ok(await p.locator('.tag.rec').count() === 1, 'REC badge on'); await p.click('[data-act="toggle-rec"]'); ok(await p.evaluate(() => S.recordings.length === 4), 'recording saved');
  await p.click('[data-act="customize"]'); await p.check('#lay-tools', { force: true }).catch(() => {}); await p.evaluate(() => { const e = document.getElementById('lay-tools'); e.checked = false; e.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(await p.locator('#c-tools').count() === 0, 'hide tools card');
  await p.click('[data-act="lay-move"][data-v="epg|-1"]'); ok(await p.evaluate(() => S.layout.order[0] === 'epg'), 'reorder cards');
  await p.click('[data-act="lay-reset"]'); await p.click('.modal-foot [data-act="modal-close"]'); ok(await p.locator('#c-tools').count() === 1, 'reset layout');
  await p.evaluate(() => { chById('ch9').locked = true; renderList(); });
  await p.locator('#ch-list .ch[data-v="ch9"]').click(); await p.fill('#f-pin', '1111'); await p.click('.modal-foot .btn.primary'); ok(await p.textContent('[data-err="pin"]') !== '', 'wrong PIN refused');
  await p.fill('#f-pin', '0000'); await p.click('.modal-foot .btn.primary'); await p.waitForTimeout(650); ok(await p.textContent('#vid-head h2') === 'Falcon Sport 2 HD', 'right PIN opens locked channel');

  /* 4. Honest states */
  await p.evaluate(() => { S.mode = 'nodevice'; renderAll(); }); await p.waitForTimeout(60);
  const sigTxt = await p.textContent('#c-signal');
  ok(!/%|dB|\d\.\dE/.test(sigTxt), 'no-device state shows no signal numbers');
  ok((await p.textContent('#stage-over')).includes('No satellite tuner found'), 'no-device overlay');
  ok(await p.locator('#ch-list .ch').count() === 0, 'no-device shows no fake channels');
  await p.evaluate(() => { S.mode = 'lost'; renderAll(); }); ok((await p.textContent('#stage-over')).includes('Signal lost'), 'signal lost overlay');
  ok(await p.textContent('#m-qv') === '—', 'signal lost shows no quality number');
  await p.evaluate(() => { S.mode = 'live'; renderAll(); });

  /* 5. Satellites */
  await go('satellites'); await p.click('[data-act="sat-add"]'); await p.click('.modal-foot .btn.primary');
  ok((await p.textContent('[data-err="name"]')).length > 0, 'satellite name required');
  await p.fill('#f-name', 'Test Sat'); await p.fill('#f-pos', '200'); await p.click('.modal-foot .btn.primary'); ok((await p.textContent('[data-err="pos"]')).length > 0, 'position range');
  await p.fill('#f-pos', '4.8'); await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => S.sats.at(-1).name === 'Test Sat' && S.selSat === S.sats.at(-1).id), 'satellite added');
  await p.click('[data-act="tp-add"]'); await p.fill('#f-freq', '999'); await p.fill('#f-sr', '27500'); await p.click('.modal-foot .btn.primary'); ok((await p.textContent('[data-err="freq"]')).length > 0, 'frequency range');
  await p.fill('#f-freq', '11034'); await p.selectOption('#f-std', 'DVB-S'); await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => { const t = S.sats.at(-1).tps[0]; return t.freq === 11034 && t.mod === 'QPSK'; }), 'transponder added, DVB-S forced to QPSK');
  await p.click('[data-act="tp-del"]'); await p.click('.modal-foot .btn.danger'); ok(await p.evaluate(() => S.sats.at(-1).tps.length === 0), 'transponder deleted');
  await p.click('.card-head [data-act="sat-del"]'); await p.click('.modal-foot .btn.danger'); ok(await p.evaluate(() => S.sats.length === 5), 'satellite deleted');
  fs.writeFileSync(tmp + '/sats.json', JSON.stringify({ sats: [{ name: 'Imported', pos: 9, dir: 'E', tps: [] }] }));
  await p.click('[data-act="sat-import"]').catch(() => {}); await p.setInputFiles('#file-pick', tmp + '/sats.json'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => S.sats.some(s => s.name === 'Imported')), 'satellite import');
  fs.writeFileSync(tmp + '/bad.json', '{not json');
  await p.click('[data-act="sat-import"]'); await p.setInputFiles('#file-pick', tmp + '/bad.json'); await p.waitForTimeout(100);
  ok((await p.textContent('#toasts')).includes('not a NOVA satellite list'), 'bad import refused with a message');

  /* 6. Scan */
  await go('scan'); await p.click('[data-act="scan-start"]'); await p.waitForTimeout(650); await p.click('[data-act="scan-pause"]'); const pct = await p.evaluate(() => scan.pct); await p.waitForTimeout(800);
  ok(await p.evaluate(() => scan.status === 'paused') && pct === await p.evaluate(() => scan.pct), 'scan pauses');
  await p.click('[data-act="scan-resume"]'); await p.waitForFunction(() => scan.status === 'done', null, { timeout: 8000 });
  ok(await p.evaluate(() => scan.found.length > 5 && scan.pct === 100), 'scan completes');
  const before = await p.evaluate(() => S.channels.length), found = await p.evaluate(() => scan.found.length);
  await p.click('[data-act="scan-save"]'); ok(await p.evaluate(() => S.channels.length) === before + found, 'scan results saved');

  /* 7. Channels */
  await go('channels'); await p.fill('#cm-q', 'Terra'); await p.waitForTimeout(40); ok(await p.locator('#cm-body tr').count() === 2, 'manager search');
  ok(await p.evaluate(() => document.activeElement.id) === 'cm-q', 'search keeps focus'); await p.fill('#cm-q', '');
  await p.waitForTimeout(40);
  const r1 = p.locator('#cm-body tr').nth(0), r3 = p.locator('#cm-body tr').nth(4);
  await r1.dragTo(r3); await p.waitForTimeout(60);
  ok(await p.evaluate(() => S.channels[3].id === 'ch1' && S.channels[3].lcn === 4), 'drag and drop reorders');
  await p.check('#cm-ch2'); await p.check('#cm-ch3'); await p.click('[data-act="cm-bulk"][data-v="lock"]'); ok(await p.evaluate(() => chById('ch2').locked && chById('ch3').locked), 'bulk lock');
  await p.click('[data-act="cm-bulk"][data-v="del"]'); await p.click('.modal-foot .btn.danger'); ok(await p.evaluate(() => !chById('ch2') && !chById('ch3')), 'bulk delete');
  await p.click('[data-act="cm-rename"][data-v="ch4"]'); await p.fill('#f-name', 'Renamed'); await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => chById('ch4').name === 'Renamed'), 'rename');
  await p.click('[data-act="cm-flag"][data-v="ch5|hidden"]'); await go('live'); ok(await p.locator('#ch-list .ch[data-v="ch5"]').count() === 0, 'hidden channel leaves the list');
  await go('channels'); await p.click('[data-act="grp-add"]'); await p.fill('#f-name', 'News'); await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => S.groups.some(g => g.name === 'News')), 'new favorites group');
  await p.click('[data-act="cm-group"][data-v="all"]'); await p.click('[data-act="cm-export"]'); ok(await p.locator('.modal textarea').count() === 1, 'export gives the content when saving is unavailable');
  const exported = await p.inputValue('.modal textarea'); await p.keyboard.press('Escape');
  fs.writeFileSync(tmp + '/ch.json', exported); await p.evaluate(() => { S.channels = S.channels.slice(0, 2); });
  await p.click('[data-act="cm-import"]'); await p.setInputFiles('#file-pick', tmp + '/ch.json'); await p.waitForTimeout(100); ok(await p.evaluate(() => S.channels.length > 30), 'channel list import round-trip');

  /* 8. EPG and timers */
  await go('epg'); await p.locator('.epg-p.is-now').first().click(); ok(await p.locator('.modal').count() === 1, 'program details open');
  await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => S.timers.length === 1), 'schedule from guide');
  await go('epg'); await p.fill('#epg-q', 'review'); await p.waitForTimeout(50); ok(await p.locator('.list-item').count() > 0, 'program search'); await p.fill('#epg-q', '');
  await go('recordings'); ok((await p.textContent('.main')).includes('Scheduled'), 'timer visible'); await p.click('[data-act="tm-del"]'); ok(await p.evaluate(() => S.timers.length === 0), 'timer removed');
  await p.click('[data-act="tm-add"]'); await p.fill('#f-mins', '0'); await p.click('.modal-foot .btn.primary'); ok((await p.textContent('[data-err="mins"]')).length > 0, 'timer length validated'); await p.fill('#f-mins', '45'); await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => S.timers.length === 1), 'manual timer');

  /* 9. CAM */
  await go('cam'); await p.click('[data-act="srv-add"]'); await p.fill('#f-label', 'Mine'); await p.fill('#f-host', 'bad host!'); await p.click('.modal-foot .btn.primary'); ok((await p.textContent('[data-err="host"]')).length > 0, 'host validated');
  await p.fill('#f-host', 'cam.example.net'); await p.fill('#f-pass', 'secret-pass-xyz'); await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => S.servers.length === 2), 'server added');
  ok(!(await p.textContent('.main')).includes('secret-pass-xyz'), 'password not shown');
  await p.waitForTimeout(260); ok(!(await p.evaluate(k => localStorage.getItem(k), 'nova-dvb-studio.v1')).includes('secret-pass-xyz'), 'password not in browser storage');
  await p.locator('[data-act="srv-test"]').last().click(); await p.waitForTimeout(1000); ok((await p.textContent('#toasts')).includes('nothing was contacted'), 'test connection states it made no connection');

  /* 10. BISS */
  await go('biss'); await p.click('[data-act="biss-add"]'); await p.fill('#f-label', 'Feed'); await p.fill('#f-key', 'XYZ'); await p.click('.modal-foot .btn.primary'); ok((await p.textContent('[data-err="key"]')).includes('0-9'), 'hex validated');
  await p.fill('#f-key', '112233 445566'); await p.click('.modal-foot .btn.primary'); ok(await p.evaluate(() => S.biss.at(-1).key === '11223366445566FF'), '12 digits get BISS checksum bytes');
  ok(!(await p.textContent('.main')).includes('6644 5566'), 'key masked by default'); await p.locator('[data-act="biss-show"]').last().click(); ok((await p.textContent('.main')).includes('1122 3366 4455 66FF'), 'key can be revealed');
  ok(await p.evaluate(() => bissCheck('1122336644556600').warn === true), 'bad checksum flagged');

  /* 11. Picons */
  await go('picons'); await p.click('[data-act="pic-f"][data-v="missing"]'); const miss = await p.locator('.pic-cell').count(); ok(miss > 0, 'missing picons detected');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'); fs.writeFileSync(tmp + '/logo.png', png);
  await p.locator('[data-act="pic-set"]').first().click(); await p.setInputFiles('#file-pick', tmp + '/logo.png'); await p.waitForTimeout(120); ok(await p.locator('.pic-cell').count() === miss - 1, 'logo upload fills a missing picon');
  fs.writeFileSync(tmp + '/Cedar Music HD.png', png); await p.click('[data-act="pic-f"][data-v="all"]'); await p.click('[data-act="pic-bulk"]'); await p.setInputFiles('#file-pick', tmp + '/Cedar Music HD.png'); await p.waitForTimeout(120);
  ok(await p.evaluate(() => S.picons[S.channels.find(c => c.name === 'Cedar Music HD').id].startsWith('data:image/png')), 'logo set matched by file name');

  /* 12. Themes */
  await go('skins');
  for (const id of ['purple', 'blue', 'neon', 'light', 'midnight', 'dark']) { await p.click(`[data-act="skin-pick"][data-v="${id}"]`); ok(await p.getAttribute('html', 'data-nova-theme') === id, 'theme preview ' + id); }
  await p.click('[data-act="skin-pick"][data-v="blue"]'); await p.click('[data-act="skin-cancel"]'); ok(await p.getAttribute('html', 'data-nova-theme') === 'dark', 'cancel restores theme');
  await p.click('[data-act="skin-pick"][data-v="light"]'); await p.click('[data-act="skin-opt"][data-v="cards|round"]'); await p.click('[data-act="skin-apply"]'); ok(await p.evaluate(() => S.theme.id === 'light' && S.theme.cards === 'round'), 'theme applied');
  await p.waitForTimeout(260); await p.reload(); await p.waitForTimeout(300);
  ok(await p.getAttribute('html', 'data-nova-theme') === 'light', 'theme survives restart'); ok(await p.evaluate(() => S.channels.length > 30 && S.biss.length === 2), 'data survives restart');
  await p.evaluate(() => { S.theme = seedState().theme; renderAll(); });

  /* 13. Settings */
  await go('preferences'); await p.click('[data-act="set-cat"][data-v="satellite"]'); await p.selectOption('#set-voltage', '18V'); ok(await p.evaluate(() => S.settings.voltage === '18V'), 'setting saved');
  await p.click('[data-act="set-reset"]'); ok(await p.evaluate(() => S.settings.voltage === 'Auto'), 'section reset');
  await p.click('[data-act="set-cat"][data-v="language"]'); await p.selectOption('#set-lang', 'ar'); await p.waitForTimeout(40); ok(await p.getAttribute('html', 'dir') === 'rtl', 'Arabic switches to RTL');
  await p.selectOption('#set-lang', 'en');

  /* 14. Backup round trip */
  await go('backup'); await p.evaluate(() => { S.settings.lnbType = 'C-Band'; }); await p.click('[data-act="bk-make"]'); await p.waitForTimeout(60);
  const bk = await p.inputValue('.modal textarea'); await p.keyboard.press('Escape');
  ok(!/pass"/.test(bk) || !/secret/.test(bk), 'no passwords in backup'); ok(!bk.includes('parentalPin'), 'no PIN in backup');
  fs.writeFileSync(tmp + '/backup.json', bk); await p.evaluate(() => { S.settings.lnbType = 'Single'; S.channels = []; });
  await p.click('[data-act="bk-restore"]'); await p.setInputFiles('#file-pick', tmp + '/backup.json'); await p.waitForTimeout(100); await p.click('.modal-foot .btn.danger'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => S.settings.lnbType === 'C-Band' && S.channels.length > 30), 'backup restores');
  ok(!errs.length, 'no script errors in flows: ' + errs.slice(0, 3).join(' | '));

  /* 15. Arabic coverage: collect text that stayed English */
  await p.evaluate(() => { localStorage.clear(); S = seedState(); S.lang = 'ar'; liveBuilt = false; document.getElementById('view-live').innerHTML = ''; window.__miss = new Set(); renderAll(); });
  const missText = new Set();
  for (const v of VIEWS) {
    await go(v);
    const cats = v === 'preferences' ? await p.evaluate(() => CATS.map(c => c[0])) : [null];
    for (const c of cats) {
      if (c) await p.evaluate(c => { setCat = c; refresh(); }, c);
      const found = await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT); while (w.nextNode()) { const s = w.currentNode.textContent.trim(); if (/[a-z]{3}/.test(s) && !w.currentNode.parentElement.closest('.ltr,.mono,.brand,#ch-list,.ch,.nm')) out.push(s); } [...document.querySelectorAll('option')].forEach(o => { if (/^[A-Z][a-z]/.test(o.textContent)) out.push(o.textContent); }); return out; });
      found.forEach(s => missText.add(s));
    }
  }
  fs.writeFileSync('test/ar-miss.txt', [...missText].sort().join('\n'));
  console.log(`\nPassed ${res.pass}, failed ${res.fail.length}. Arabic leftovers: ${missText.size}`);
  if (res.fail.length) console.log(res.fail.join('\n'));
  await b.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
