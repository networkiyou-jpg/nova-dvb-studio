const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const [w, h, tag] = [Number(process.argv[2] || 1440), Number(process.argv[3] || 900), process.argv[4] || 'd'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.g/, r => r.abort());
  const url = 'file:///home/claude/nova-dvb-studio/design/dist/nova-dvb-studio.html';
  await p.goto(url); await p.waitForTimeout(500);
  if (process.argv[5] === 'ar') { await p.evaluate(() => { S.lang = 'ar'; renderAll(); }); }
  for (const v of ['live','satellites','scan','channels','epg','recordings','cam','biss','picons','skins','preferences','backup']) {
    await p.evaluate(v => go(v), v); await p.waitForTimeout(350);
    await p.screenshot({ path: `test/out/${tag}-${v}.png` });
    const over = await p.evaluate(() => { const r=[]; const de=document.documentElement; if (de.scrollWidth>innerWidth+1) r.push('page overflow x '+de.scrollWidth);
      document.querySelectorAll('h1,h2,b,button,td,dd,small,span').forEach(e=>{ const cs=getComputedStyle(e); if(e.offsetParent&&e.scrollWidth>e.clientWidth+1&&cs.overflow==='visible'&&cs.display!=='inline'&&e.children.length===0) r.push(e.tagName+':'+e.textContent.slice(0,30)); }); return r.slice(0,6); });
    if (over.length) console.log(v, over);
  }
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
