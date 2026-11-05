/* Skins and Themes, Settings, Backup and Restore */
const THEMES = [
  ['dark', 'NOVA Dark', '#0b1020', '#16203d', '#7868f0', '#28b8ff', 'Default. Navy glass with purple and blue light.'],
  ['purple', 'NOVA Purple', '#130b22', '#27173f', '#a56bff', '#e879f9', 'Violet ground with warm magenta edges.'],
  ['blue', 'NOVA Blue', '#081426', '#12284a', '#2f9bff', '#25d9d0', 'Control-room blue with cyan meters.'],
  ['neon', 'NOVA Neon', '#070814', '#12142c', '#00e5d8', '#ff3cc8', 'The boldest look. Cyan and magenta on black.'],
  ['light', 'NOVA Light', '#eef0f9', '#ffffff', '#5a45e0', '#0b7fc4', 'Daylight rooms. Same layout on cool paper.'],
  ['midnight', 'NOVA Midnight', '#080b14', '#141928', '#8d9dd6', '#7fa8d9', 'Dark rooms. Almost no glow.'],
];
const ACCENTS = ['', '#7868f0', '#28b8ff', '#25d9d0', '#2fdc9a', '#ffb648', '#ff5f8f', '#e879f9'];
const draft = () => preview || S.theme;
function setPreview(patch) { preview = { ...draft(), ...patch }; applyTheme(preview); renderSkinBar(); if (S.view === 'skins') refresh(); }
function renderSkinBar() {
  $('#preview-bar')?.remove();
  if (!preview) return;
  const name = allThemes().find(x => x[0] === preview.sid || x[0] === preview.id)?.[1] || '';
  const el = document.createElement('div'); el.className = 'preview-bar'; el.id = 'preview-bar';
  el.innerHTML = `<span>${t('Previewing')}: <b>${esc(name)}</b></span><button class="btn sm" data-act="skin-cancel">${t('Cancel')}</button><button class="btn sm primary" data-act="skin-apply">${t('Apply theme')}</button>`;
  document.body.append(el);
}
const allThemes = () => [...THEMES, ...(S.customThemes || []).map(c => [c.sid, c.name, c.c1, c.c2, c.accent || '#7868f0', c.c3 || '#28b8ff', 'Installed theme'])];
SCREENS.skins = () => {
  const d = draft(), cur = d.sid || d.id;
  const opt = (k, v, l) => `<button data-act="skin-opt" data-v="${k}|${v}" aria-pressed="${String(d[k]) === String(v)}">${t(l)}</button>`;
  return `<div class="page">${pageHead('skin', 'Skins & Themes', 'Click a theme to try it on the whole app, then apply it or cancel.', `<button class="btn" data-act="skin-install">${ic('upload')}${t('Install theme')}</button><button class="btn" data-act="skin-export">${ic('download')}${t('Export current')}</button>`)}
    <div class="panes" style="grid-template-columns:minmax(0,1fr) 330px">
      <section class="card pane"><div class="scroll"><div class="skin-grid">${allThemes().map(([id, name, a, b, c, e, desc]) => `<button class="skin ${cur === id ? 'on' : ''}" data-act="skin-pick" data-v="${id}" aria-pressed="${cur === id}">
        <span class="mini" style="background:${a}"><i class="t" style="background:${b}"></i><i style="background:${b}"></i><i style="background:linear-gradient(120deg,${c},${e})"></i><i style="background:${b}"></i><i class="b" style="background:${b};box-shadow:inset 0 0 0 1px ${c}55"></i></span>
        <span class="lbl2"><b>${esc(name)}</b>${S.theme.id === id && !preview ? `<span class="state good">${t('In use')}</span>` : ''}</span><span class="hint" style="padding-inline:4px">${t(desc)}</span></button>`).join('')}</div></div></section>
      <section class="card pane scroll"><div class="card-head">${ic('sliders')}<h2>${t('Customize')}</h2></div>
        <div class="lbl">${t('Accent color')}</div><div class="swatch-row">${ACCENTS.map(c => `<button class="swatch ${(d.accent || '') === c ? 'on' : ''}" data-act="skin-accent" data-v="${c}" aria-label="${c || t('Theme default')}" data-tip="${c || t('Theme default')}" style="background:${c || 'var(--grad)'}"></button>`).join('')}</div>
        <div class="lbl">${t('Background')}</div><div class="seg">${opt('bg', 'aurora', 'Aurora')}${opt('bg', 'plain', 'Plain')}${opt('bg', 'grid', 'Grid')}</div>
        <div class="lbl">${t('Card shape')}</div><div class="seg">${opt('cards', 'sharp', 'Sharp')}${opt('cards', 'soft', 'Soft')}${opt('cards', 'round', 'Round')}</div>
        <div class="lbl">${t('Icon weight')}</div><div class="seg">${opt('icons', 'fine', 'Fine')}${opt('icons', 'line', 'Regular')}${opt('icons', 'bold', 'Bold')}</div>
        <div class="lbl">${t('Density')}</div><div class="seg">${opt('density', 'compact', 'Compact')}${opt('density', 'normal', 'Normal')}${opt('density', 'comfy', 'Comfortable')}</div>
        <label class="field"><span>${t('Text size')}: ${d.font}%</span><input id="skin-font" type="range" min="90" max="125" step="5" value="${d.font}" data-chg="skin-font" style="--val:${(d.font - 90) / 35 * 100}%;padding:0;border:0;background:none" aria-label="${t('Text size')}"></label>
      </section></div></div>`;
};
A['skin-pick'] = el => { const v = el.dataset.v, c = (S.customThemes || []).find(x => x.sid === v); setPreview(c ? { id: c.base, sid: c.sid, accent: c.accent || '' } : { id: v, sid: undefined, accent: '' }); };
A['skin-opt'] = el => { const [k, v] = el.dataset.v.split('|'); setPreview({ [k]: v }); };
A['skin-accent'] = el => setPreview({ accent: el.dataset.v });
CHG['skin-font'] = el => { preview = { ...draft(), font: Number(el.value) }; applyTheme(preview); renderSkinBar(); el.style.setProperty('--val', (el.value - 90) / 35 * 100 + '%'); el.closest('.field').querySelector('span').textContent = `${t('Text size')}: ${el.value}%`; };
A['skin-apply'] = () => { S.theme = preview; preview = null; save(); renderSkinBar(); renderAll(); toast(t('Theme applied'), 'good'); };
A['skin-cancel'] = () => { preview = null; renderSkinBar(); renderAll(); };
A['skin-export'] = () => { const d = draft(); saveFile('nova-theme.json', JSON.stringify({ app: 'NOVA DVB Studio', kind: 'theme', name: 'My NOVA theme', base: d.id, accent: d.accent || '', bg: d.bg, cards: d.cards, icons: d.icons, density: d.density, font: d.font }, null, 2)); };
A['skin-install'] = async () => {
  const [f] = await pickFiles('.json,application/json'); if (!f) return;
  try {
    const d = JSON.parse(await readText(f));
    if (d.kind !== 'theme' || !THEMES.some(x => x[0] === d.base)) throw new Error('shape');
    const b = THEMES.find(x => x[0] === d.base);
    S.customThemes = [...(S.customThemes || []), { sid: uid('th'), name: String(d.name || 'Custom theme').slice(0, 40), base: d.base, accent: /^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : '', c1: b[2], c2: b[3], c3: b[5] }];
    save(); refresh(); toast(t('Theme installed'), 'good');
  } catch (e) { toast(t('That file is not a NOVA theme.'), 'bad'); }
};

/* ---------- Settings ---------- */
let setCat = 'general';
const CATS = [['general', 'tune', 'General'], ['devices', 'cpu', 'DVB Devices'], ['satellite', 'sat', 'Satellite Settings'], ['diseqc', 'compass', 'DiSEqC & Motor'], ['playback', 'play', 'Playback'], ['audio', 'vol', 'Audio'], ['video', 'film', 'Video'],
  ['cam', 'card', 'CAM'], ['biss', 'key', 'BISS'], ['recording', 'rec', 'Recording'], ['epg', 'cal', 'EPG'], ['picons', 'pic', 'Picons'], ['themes', 'skin', 'Themes'], ['storage', 'drive', 'Storage'], ['backup', 'archive', 'Backup & Restore'], ['language', 'globe', 'Language']];
const sRow = (label, sub, ctl, free) => `<div class="set-row"><div><b>${t(label)}</b>${sub ? `<small>${t(sub)}</small>` : ''}</div><div class="ctl ${free ? 'free' : ''}">${ctl}</div></div>`;
const sSw = (k, label, sub, dis) => sRow(label, sub, `<label class="switch"><input id="set-${k}" type="checkbox" data-chg="set" data-k="${k}" ${S.settings[k] ? 'checked' : ''} ${dis ? 'disabled' : ''} aria-label="${t(label)}"><i></i></label>`, true);
const sSel = (k, label, opts, sub, dis) => sRow(label, sub, `<select class="sel" id="set-${k}" data-chg="set" data-k="${k}" aria-label="${t(label)}" ${dis ? 'disabled' : ''}>${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(S.settings[k]) === String(v) ? 'selected' : ''}>${esc(t(l))}</option>`; }).join('')}</select>`);
const sTxt = (k, label, sub, extra = '') => sRow(label, sub, `<span class="field" style="width:100%"><input id="set-${k}" data-chg="set" data-k="${k}" value="${esc(S.settings[k])}" aria-label="${t(label)}" ${extra}></span>`);
const CAT_BODY = {
  general: () => sSel('startup', 'When NOVA starts', [['last', 'Play the last channel'], ['list', 'Open the channel list'], ['none', 'Do nothing']]) + sSw('autostart', 'Start with Windows') + sSw('minimizeTray', 'Minimize to the notification area') + sSw('confirmExit', 'Ask before closing') + sSw('updateCheck', 'Check for updates') + sTxt('parentalPin', 'Parental PIN', 'Used for locked channels.', 'type="password" inputmode="numeric" maxlength="8"'),
  devices: () => `${hasDevice() ? `<div class="stat" style="gap:6px"><div class="row nw"><b class="sp">${t('Simulated tuner (design preview)')}</b>${stateTag('warn', 'Simulated')}</div><span class="sub">${t('This entry is not hardware. Real cards appear here with the name and maker reported by the driver.')}</span></div>` : `<div class="empty">${ic('unplug')}<b>${t('No DVB devices found')}</b><span>${t('Connect a card and install its BDA driver, then detect again.')}</span><button class="btn sm" data-act="detect2">${ic('refresh')}${t('Detect again')}</button></div>`}
    <div class="set-h">${t('What a real card must report')}</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('Capability')}</th><th>${t('How NOVA reads it')}</th><th>${t('Status')}</th></tr></thead><tbody>${[['DVB-S', 'Standard BDA tuning'], ['DVB-S2', 'Standard BDA tuning, plus maker extensions on some cards'], ['DVB-S2X', 'Only if the driver supports it'], ['DiSEqC 1.0 and 1.1', 'BDA or maker extension'], ['DiSEqC 1.2 and USALS', 'Maker extension on most cards'], ['Blind scan', 'Maker SDK on most cards'], ['Signal, SNR, BER', 'Whatever the driver reports']].map(([a, b]) => `<tr><td>${t(a)}</td><td style="white-space:normal">${t(b)}</td><td>${stateTag('idle', 'Not tested')}</td></tr>`).join('')}</tbody></table></div>
    ${sSel('tunerMode', 'Tuner use', ['Single', 'Dual (if supported)'])}`,
  satellite: () => sSel('lnbType', 'LNB type', ['Universal', 'Single', 'C-Band', 'Custom']) + sTxt('lof1', 'Low oscillator (MHz)', '', 'inputmode="numeric"') + sTxt('lof2', 'High oscillator (MHz)', '', 'inputmode="numeric"') + sTxt('lofSw', 'Switch frequency (MHz)', '', 'inputmode="numeric"') + sSel('voltage', 'LNB voltage', ['Auto', '13V', '18V', 'Off']) + sSel('tone', '22 kHz tone', ['Auto', 'On', 'Off']),
  diseqc: () => `${sSel('diseqc', 'DiSEqC mode', ['None', '1.0', '1.1', '1.2'], 'Ports and motor positions are set per satellite in Satellite Manager.')}
    <div class="set-h">${t('Move dish')}</div><div class="row">${[['West', 'Move west'], ['Stop', 'Stop motor'], ['East', 'Move east'], ['Reference', 'Go to reference'], ['Store', 'Store position']].map(([k, l]) => `<button class="btn sm" data-act="motor" data-v="${l}" ${hasDevice() ? '' : 'disabled'}>${t(l)}</button>`).join('')}</div>${hasDevice() ? '' : `<p class="hint">${t('Motor commands need a connected tuner.')}</p>`}`,
  playback: () => sSel('decoder', 'Decoder', ['Auto', 'LibVLC', 'Software only']) + sSw('hwAccel', 'Hardware decoding when available') + sTxt('buffer', 'Stream buffer (ms)', 'Higher is steadier, lower changes channel faster.', 'inputmode="numeric"') + sSw('reconnect', 'Reconnect after signal loss') + sTxt('reconnectSec', 'Retry every (seconds)', '', 'inputmode="numeric"') + sSw('resumeLast', 'Remember the last channel'),
  audio: () => sSel('audioDevice', 'Output device', ['System default']) + sSel('audioLang', 'Preferred audio language', ['Arabic', 'English', 'French']) + sSel('downmix', 'Channels', ['Stereo', '5.1']) + sSw('passthrough', 'Pass AC3 and E-AC3 to the receiver', 'For HDMI or optical amplifiers.') + sSw('normalize', 'Even out volume between channels'),
  video: () => sSel('deinterlace', 'Deinterlacing', ['Auto', 'Off', 'Bob', 'Yadif']) + sSel('aspect', 'Default aspect ratio', ['Fill', '16:9', '4:3', '21:9']) + sSel('subLang', 'Preferred subtitles', ['Off', 'Arabic', 'English', 'French']) + sTxt('subSize', 'Subtitle size (%)', '', 'inputmode="numeric"'),
  cam: () => sSw('camAuto', 'Connect enabled servers at startup') + sSw('camEncrypt', 'Encrypt saved passwords', 'Uses your Windows account.') + `<div class="row"><button class="btn sm" data-act="go" data-v="cam">${t('Open CAM Manager')}</button></div>`,
  biss: () => sSw('bissEncrypt', 'Encrypt saved keys', 'Uses your Windows account.') + `<div class="row"><button class="btn sm" data-act="go" data-v="biss">${t('Open BISS Manager')}</button></div>`,
  recording: () => (NATIVE ? sRow('Recording folder', S.settings.recFolder, `<button class="btn sm" data-act="pick-folder" data-v="recFolder">${ic('folder')}${t('Choose')}</button>`, true) : sTxt('recFolder', 'Recording folder', 'The desktop app opens a folder picker here.', 'dir="ltr"')) + sSel('recFormat', 'File format', ['TS', 'MKV']) + sTxt('recPad', 'Start early (minutes)', '', 'inputmode="numeric"') + sTxt('recPost', 'End late (minutes)', '', 'inputmode="numeric"') + sSw('recEpgName', 'Name files from the program guide'),
  epg: () => sSel('epgSource', 'Listings source', ['Broadcast (EIT)', 'XMLTV file', 'XMLTV address']) + sTxt('epgUrl', 'XMLTV address', 'Use a source you are allowed to use.', 'dir="ltr" placeholder="https://"') + sTxt('epgDays', 'Days to keep', '', 'inputmode="numeric"') + sSel('epgUpdate', 'Update listings', ['While tuned', 'On a schedule', 'Manually']),
  picons: () => sTxt('piconFolder', 'Logo folder', '', 'dir="ltr"') + sSel('piconFormat', 'Formats', ['PNG and SVG', 'PNG only', 'SVG only']) + `<div class="row"><button class="btn sm" data-act="go" data-v="picons">${t('Open Picon Manager')}</button></div>`,
  themes: () => `<p class="sub">${t('Themes live in their own screen so you can preview them across the app.')}</p><div class="row"><button class="btn sm" data-act="go" data-v="skins">${t('Open Skins & Themes')}</button></div>`,
  storage: () => sTxt('dbPath', 'Database file', 'Channels, satellites and settings.', 'dir="ltr"') + sTxt('logDays', 'Keep logs for (days)', '', 'inputmode="numeric"') + sSel('logLevel', 'Log detail', ['Errors only', 'Warnings', 'Information', 'Debug']),
  backup: () => `<p class="sub">${t('Create and restore backups from the Backup & Restore screen.')}</p><div class="row"><button class="btn sm" data-act="go" data-v="backup">${t('Open Backup & Restore')}</button></div>`,
  language: () => sRow('Language', 'Arabic switches the app to right-to-left.', `<select class="sel" id="set-lang" data-chg="lang" aria-label="${t('Language')}"><option value="en" ${S.lang === 'en' ? 'selected' : ''}>English</option><option value="ar" ${S.lang === 'ar' ? 'selected' : ''}>العربية</option></select>`),
};
SCREENS.preferences = () => `<div class="page">${pageHead('gear', 'Settings', 'Changes save as you make them.', `<button class="btn" data-act="set-reset">${ic('undo')}${t('Reset this section')}</button>`)}
  <div class="panes" style="grid-template-columns:232px minmax(0,1fr)"><section class="card pane"><nav class="set-nav scroll" aria-label="${t('Settings')}">${CATS.map(([k, i, l]) => `<button data-act="set-cat" data-v="${k}" aria-current="${setCat === k}">${ic(i)}<span>${t(l)}</span></button>`).join('')}</nav></section>
    <section class="card pane scroll"><div class="card-head"><h2>${t(CATS.find(c => c[0] === setCat)[2])}</h2></div>${CAT_BODY[setCat]()}</section></div></div>`;
A['set-cat'] = el => { setCat = el.dataset.v; refresh(); };
CHG.set = el => { const k = el.dataset.k; S.settings[k] = el.type === 'checkbox' ? el.checked : el.value; if (k === 'aspect') S.player.aspect = el.value; save(); };
CHG.lang = el => { S.lang = el.value; save(); renderAll(); };
A.motor = el => toast(`${t(el.dataset.v)}: ${t('simulated, no motor is connected')}`, 'warn');
A.detect2 = async () => { toast(t('No tuner found. This preview cannot reach hardware.'), 'warn'); };
A['set-reset'] = () => {
  const def = seedState().settings, html = CAT_BODY[setCat]();
  const keys = [...html.matchAll(/data-k="(\w+)"/g)].map(m => m[1]);
  keys.forEach(k => { S.settings[k] = def[k]; });
  save(); refresh(); toast(t('Section reset'), 'good');
};

/* ---------- Backup ---------- */
const BK = { settings: true, channels: true, sats: true, favorites: true, themes: true, picons: false };
const BK_ITEMS = [['settings', 'Settings', 'All preferences, without passwords.'], ['channels', 'Channels', 'List, order, names, locks.'], ['sats', 'Satellites and transponders', 'Your full satellite database.'], ['favorites', 'Favorites', 'Groups and their channels.'], ['themes', 'Themes', 'Current look and installed themes.'], ['picons', 'Picons', 'Logos you added. Can be large.']];
function buildBackup(scope) {
  const d = { app: 'NOVA DVB Studio', kind: 'backup', version: 1, at: new Date().toISOString(), scope: Object.keys(scope).filter(k => scope[k]) };
  if (scope.settings) { d.settings = { ...S.settings }; delete d.settings.parentalPin; d.layout = S.layout; d.lang = S.lang; }
  if (scope.channels) d.channels = S.channels;
  if (scope.sats) d.sats = S.sats;
  if (scope.favorites) d.groups = S.groups;
  if (scope.themes) { d.theme = S.theme; d.customThemes = S.customThemes || []; }
  if (scope.picons) d.picons = S.picons;
  return d;
}
SCREENS.backup = () => `<div class="page">${pageHead('disk', 'Backup & Restore', 'Keep a copy of your setup or move it to another computer.', `<button class="btn" data-act="bk-restore">${ic('restore')}${t('Restore from file')}</button><button class="btn primary" data-act="bk-make">${ic('archive')}${t('Create backup')}</button>`)}
  <div class="panes" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
    <section class="card pane scroll"><div class="card-head">${ic('layers')}<h2>${t('What to include')}</h2></div>${BK_ITEMS.map(([k, l, s]) => `<div class="set-row"><div><b>${t(l)}</b><small>${t(s)}</small></div><label class="switch"><input id="bk-${k}" type="checkbox" data-chg="bk" data-k="${k}" ${BK[k] ? 'checked' : ''} aria-label="${t(l)}"><i></i></label></div>`).join('')}
      <div class="note">${ic('shield')}<div>${t('Backups leave out server passwords and the parental PIN. BISS keys are left out too, so export them separately if you need them.')}</div></div></section>
    <section class="card pane"><div class="card-head">${ic('restore')}<h2>${t('Backups made here')}</h2></div><div class="scroll" style="display:grid;gap:2px;align-content:start">
      ${S.backups.map(b => `<div class="list-item">${ic('archive')}<div><b>${fmtDayShort(b.at)} <span class="ltr">${fmtTime(b.at)}</span></b><small>${b.scope.map(x => t(BK_ITEMS.find(i => i[0] === x)?.[1] || x)).join(', ')}</small></div><button class="icon-btn" data-act="bk-down" data-v="${b.id}" aria-label="${t('Export')}" data-tip="${t('Export')}">${ic('download')}</button><button class="icon-btn" data-act="bk-del" data-v="${b.id}" aria-label="${t('Delete')}" data-tip="${t('Delete')}">${ic('trash')}</button></div>`).join('') || `<div class="empty">${ic('archive')}<span>${t('No backups yet.')}</span></div>`}</div>
      ${NATIVE ? '' : `<div class="row"><span class="sp"></span><button class="btn sm danger" data-act="bk-reset">${ic('trash')}${t('Reset all preview data')}</button></div>`}</section></div></div>`;
CHG.bk = el => { BK[el.dataset.k] = el.checked; };
A['bk-make'] = () => {
  if (!Object.values(BK).some(Boolean)) { toast(t('Choose at least one item.'), 'warn'); return; }
  const d = buildBackup(BK), name = `nova-backup-${d.at.slice(0, 10)}.json`;
  S.backups.unshift({ id: uid('bk'), at: d.at, scope: d.scope, snapshot: BK.picons ? null : d });
  save(); refresh(); toast(t('Backup created'), 'good'); saveFile(name, JSON.stringify(d, null, 2));
};
A['bk-down'] = el => { const b = S.backups.find(x => x.id === el.dataset.v), d = b.snapshot || buildBackup(Object.fromEntries(b.scope.map(k => [k, true]))); saveFile(`nova-backup-${b.at.slice(0, 10)}.json`, JSON.stringify(d, null, 2)); };
A['bk-del'] = el => { S.backups = S.backups.filter(x => x.id !== el.dataset.v); save(); refresh(); };
function applyBackup(d) {
  if (d.settings) { S.settings = { ...S.settings, ...d.settings }; if (d.layout) S.layout = { ...S.layout, ...d.layout }; if (d.lang) S.lang = d.lang; }
  if (Array.isArray(d.channels)) { S.channels = d.channels; if (!chById(S.player.ch)) S.player.ch = S.channels[0]?.id; }
  if (Array.isArray(d.sats)) { S.sats = d.sats; S.selSat = S.sats[0]?.id; }
  if (Array.isArray(d.groups)) S.groups = d.groups;
  if (d.theme) { S.theme = { ...S.theme, ...d.theme }; S.customThemes = d.customThemes || []; }
  if (d.picons) S.picons = d.picons;
  save(); renderAll();
}
A['bk-restore'] = async () => {
  const [f] = await pickFiles('.json,application/json'); if (!f) return;
  try {
    const d = JSON.parse(await readText(f));
    if (d.app !== 'NOVA DVB Studio' || d.kind !== 'backup') throw new Error('shape');
    confirmBox({ title: t('Restore this backup?'), msg: `${t('This replaces:')} ${d.scope.map(x => t(BK_ITEMS.find(i => i[0] === x)?.[1] || x)).join(', ')}`, yes: t('Restore'), onYes: () => { applyBackup(d); toast(t('Backup restored'), 'good'); } });
  } catch (e) { toast(t('That file is not a NOVA backup.'), 'bad'); }
};
A['bk-reset'] = () => confirmBox({ title: t('Reset all preview data?'), msg: t('Everything you changed in this preview returns to the starting sample data.'), yes: t('Reset'), onYes: () => { const mode = S.mode; S = seedState(); S.mode = mode; S.view = 'backup'; preview = null; liveBuilt = false; $('#view-live').innerHTML = ''; save(); renderAll(); toast(t('Preview data reset'), 'good'); } });
