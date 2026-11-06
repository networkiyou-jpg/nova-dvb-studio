/* Channel logos from the internet. The default source is the picons project (github.com/picons/picons),
   which publishes logos with two indexes: srp.index maps a service reference (SID_TSID_ONID_NAMESPACE)
   to a logo, and utf8snp.index maps a lower-case channel name to a logo. NOVA tries the service
   reference first, then the name. A custom server works with an address pattern such as
   https://example.com/picon/{srp}.png, where {srp} is the Enigma2 picon file name. */
const PIC = { srp: null, snp: null, norm: null, logos: null, loading: null, busy: false, done: 0, total: 0, hit: 0 };
const PICON_SITE = 'https://github.com/picons/picons';
const piconBase = () => String(S.settings.piconBase || seedState().settings.piconBase).replace(/\/?$/, '/');
const hex = n => Number(n).toString(16).toUpperCase();

async function piconIndex(force = false) {
  if (PIC.srp && !force) return PIC;
  if (PIC.loading) return PIC.loading;
  PIC.loading = (async () => {
    const opt = name => ({ cache: name, preferCache: !force });
    const [a, b] = await Promise.all([getText(piconBase() + 'srp.index', opt('srp.index')), getText(piconBase() + 'utf8snp.index', opt('utf8snp.index'))]);
    if (!a.ok && !b.ok) throw new Error('index');
    const srp = new Map(), snp = new Map(), norm = new Map(), logos = new Map();
    const lines = (text, fn) => { for (const line of (text || '').split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) fn(line.slice(0, i).trim(), line.slice(i + 1).trim()); } };
    lines(a.text, (k, v) => { srp.set(k.toUpperCase(), v); logos.set(nameKey(v), v); });
    lines(b.text, (k, v) => { snp.set(k.toLowerCase(), v); const n = nameKey(k); if (n && !norm.has(n)) norm.set(n, v); logos.set(nameKey(v), v); });
    Object.assign(PIC, { srp, snp, norm, logos });
    return PIC;
  })();
  try { return await PIC.loading; } finally { PIC.loading = null; }
}

/* Service reference as the picons project writes it: SID_TSID_ONID_NAMESPACE in hex. The namespace of a
   satellite service is its orbital position in tenths of a degree (west counted from 360) shifted 16 bits. */
function srpKey(ch) {
  const s = satById(ch.sat);
  if (!s || ch.sid == null || ch.tsid == null || ch.onid == null) return null;
  const lon = Math.round(lonOf(s) * 10);
  return `${hex(ch.sid)}_${hex(ch.tsid)}_${hex(ch.onid)}_${hex((lon < 0 ? 3600 + lon : lon) * 65536)}`;
}
const e2Picon = ch => { const k = srpKey(ch); return k ? `1_0_${hex(ch.svcType || (ch.type === 'radio' ? 2 : 1))}_${k}_0_0_0` : null; };

function matchLogo(ch) {
  const k = srpKey(ch);
  if (k && PIC.srp.has(k)) return PIC.srp.get(k);
  const lower = ch.name.toLowerCase().trim();
  if (PIC.snp.has(lower)) return PIC.snp.get(lower);
  for (const n of [nameKey(ch.name), nameKeyLoose(ch.name)]) {
    if (!n) continue;
    if (PIC.norm.has(n)) return PIC.norm.get(n);
    if (PIC.logos.has(n)) return PIC.logos.get(n);
  }
  return null;
}
function logoUrls(logo) {
  const order = [...new Set([S.settings.piconStyle || 'default', 'default', 'light', 'dark'])];
  return order.flatMap(v => [`${piconBase()}logos/${logo}.${v}.svg`, `${piconBase()}logos/${logo}.${v}.png`]);
}
function customUrls(ch) {
  const pat = String(S.settings.piconCustom || '').trim();
  if (!/^https?:\/\//i.test(pat)) return [];
  const srp = e2Picon(ch);
  if (pat.includes('{srp}') && !srp) return [];
  return [pat.replace('{srp}', srp || '').replace('{snp}', nameKey(ch.name)).replace('{name}', encodeURIComponent(ch.name))];
}

/* Logos become PNG files: the info bar window in the Windows app cannot draw SVG. */
function drawContain(img, W = 400, H = 240) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), iw = img.naturalWidth || W, ih = img.naturalHeight || H, k = Math.min(W / iw, H / ih);
  g.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  return c.toDataURL('image/png');
}
async function svgToPng(svg) {
  let src = svg;
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
  if (vb && !/<svg[^>]*\swidth\s*=/i.test(svg)) src = svg.replace(/<svg\b/i, `<svg width="${vb[1]}" height="${vb[2]}"`);
  const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
  try { const img = new Image(); img.src = url; await img.decode(); return drawContain(img); } finally { URL.revokeObjectURL(url); }
}
async function blobToPng(blob) {
  const url = URL.createObjectURL(blob);
  try { const img = new Image(); img.src = url; await img.decode(); return drawContain(img); } finally { URL.revokeObjectURL(url); }
}
const hostCall = msg => hostAsk(msg);

/* Returns the picon address to store for the channel, or null. */
async function fetchLogo(urls, file) {
  if (!urls.length) return null;
  if (NATIVE) {
    const r = await hostCall({ cmd: 'piconFetch', name: file, urls });
    if (!r.ok) return null;
    if (r.file) return `https://picons.nova.app/${r.file}?v=${Date.now()}`;
    const png = await svgToPng(r.svg).catch(() => null);
    if (!png) return null;
    const w = await hostCall({ cmd: 'piconWrite', name: file, b64: png.slice(png.indexOf(',') + 1) });
    return w.file ? `https://picons.nova.app/${w.file}?v=${Date.now()}` : null;
  }
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const blob = await r.blob();
      return /\.svg$/i.test(url) || blob.type.includes('svg') ? await svgToPng(await blob.text()) : await blobToPng(blob);
    } catch (e) { /* try the next address */ }
  }
  return null;
}
async function logoFor(ch, logo) {
  if (S.settings.piconSource === 'custom') return fetchLogo(customUrls(ch), e2Picon(ch) || ch.id);
  if (!logo) return null;
  return fetchLogo(logoUrls(logo), `${logo}-${S.settings.piconStyle || 'default'}`);
}

async function piconDownload(list, quiet = false) {
  if (PIC.busy) { toast(t('Logos are already downloading.'), 'warn'); return; }
  if (!list.length) { if (!quiet) toast(t('Every channel has a logo.'), 'good'); return; }
  if (S.settings.piconSource !== 'custom') {
    try { await piconIndex(); } catch (e) { toast(t('Could not load the logo index. Check the internet connection.'), 'bad'); return; }
  }
  Object.assign(PIC, { busy: true, done: 0, total: list.length, hit: 0 });
  if (S.view === 'picons') refresh();
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const ch = list[i++];
      const logo = S.settings.piconSource === 'custom' ? null : matchLogo(ch);
      const src = await logoFor(ch, logo).catch(() => null);
      if (src) { S.picons[ch.id] = src; PIC.hit++; }
      PIC.done++;
      if (S.view === 'picons' && PIC.done % 4 === 0) refresh();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  PIC.busy = false;
  save();
  if (S.view === 'live') renderAll(); else if (S.view === 'picons') refresh();
  toast(`${PIC.hit} ${t('of')} ${PIC.total} ${t('logos downloaded')}`, PIC.hit ? 'good' : 'warn');
}
/* After a scan, new channels get logos without asking, when the setting allows it. */
function piconAfterScan(ids) {
  if (!S.settings.piconAuto) return;
  const list = ids.map(chById).filter(c => c && !S.picons[c.id]);
  if (list.length) piconDownload(list, true);
}

A['pic-online'] = () => {
  const all = chans(), missing = all.filter(c => !S.picons[c.id] || S.picons[c.id] === 'auto');
  const id = uid('po');
  A[id] = () => { const v = formVals(modals[modals.length - 1]); closeModal(); piconDownload(v.scope === 'all' ? all : missing); };
  openModal({ title: t('Download logos'), width: 470,
    body: `<p class="sub">${t(S.settings.piconSource === 'custom' ? 'Logos come from your own server, using the address pattern in Settings.' : 'Logos come from the picons project, a free collection made by its contributors.')}</p>
      ${selectF('Channels', 'scope', [['missing', `${t('Without a logo')} (${missing.length})`], ['all', `${t('All channels, replace existing')} (${all.length})`]], 'missing')}`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${ic('download')}${t('Download')}</button>` });
};
A['pic-index'] = async () => {
  toast(t('Downloading the logo index'));
  try { const p = await piconIndex(true); toast(`${t('Logo index ready')}: ${p.logos.size}`, 'good'); }
  catch (e) { toast(t('Could not load the logo index. Check the internet connection.'), 'bad'); }
};
A['pic-site'] = () => { if (NATIVE) window.chrome.webview.postMessage({ cmd: 'openUrl', url: PICON_SITE }); else window.open(PICON_SITE, '_blank', 'noopener'); };
A['pic-folder'] = () => window.chrome?.webview?.postMessage({ cmd: 'openFolder', key: 'picons' });

/* Search the index by hand for one channel */
const PF = { ch: null, q: '' };
function pfResults() {
  if (!PIC.logos) return `<div class="hint">${t('Loading the logo index')}</div>`;
  const q = nameKey(PF.q);
  if (q.length < 2) return `<div class="hint">${t('Type at least two letters.')}</div>`;
  const hits = [...new Set([...PIC.logos.values()])].filter(l => nameKey(l).includes(q)).slice(0, 36);
  return hits.length ? `<div class="pf-grid">${hits.map(l => `<button class="pf-cell" data-act="pic-pick" data-v="${esc(l)}" data-tip="${esc(l)}"><img loading="lazy" src="${esc(`${piconBase()}logos/${l}.default.svg`)}" alt="" onerror="this.onerror=null;this.src='${esc(`${piconBase()}logos/${l}.default.png`)}'"><span>${esc(l)}</span></button>`).join('')}</div>`
    : `<div class="hint">${t('No logos match')}</div>`;
}
A['pic-find'] = async el => {
  PF.ch = chById(el.dataset.v); PF.q = PF.ch.name.replace(/\b(f?hd|uhd|4k)\b/gi, '').trim();
  openModal({ title: `${t('Find a logo')}: ${PF.ch.name}`, width: 640,
    body: `<label class="search">${ic('search')}<input id="pf-q" type="search" value="${esc(PF.q)}" data-chg="pf-q" aria-label="${t('Search logos')}" placeholder="${t('Search logos')}"></label><div id="pf-res" class="pf-res">${pfResults()}</div>`,
    foot: `<button class="btn" data-act="modal-close">${t('Close')}</button>` });
  if (!PIC.logos) {
    try { await piconIndex(); } catch (e) { toast(t('Could not load the logo index. Check the internet connection.'), 'bad'); }
    const r = $('#pf-res'); if (r) r.innerHTML = pfResults();
  }
};
CHG['pf-q'] = el => { PF.q = el.value; const r = $('#pf-res'); if (r) r.innerHTML = pfResults(); };
A['pic-pick'] = async el => {
  const ch = PF.ch, logo = el.dataset.v;
  el.disabled = true;
  const src = await fetchLogo(logoUrls(logo), `${logo}-${S.settings.piconStyle || 'default'}`).catch(() => null);
  if (!src) { el.disabled = false; toast(t('That logo could not be downloaded.'), 'bad'); return; }
  S.picons[ch.id] = src; save(); closeModal(); refresh(); toast(t('Logo updated'), 'good');
};
