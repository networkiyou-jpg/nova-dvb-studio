const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1672, height: 941 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.g/, r => r.abort());
  await p.goto('file:///home/claude/nova-dvb-studio/design/dist/nova-dvb-studio.html');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: process.argv[2] || 'test/live.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
