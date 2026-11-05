/* Channel Manager, Program Guide, Recordings */
const CM = { group: 'all', q: '', sel: new Set() };
const chans = () => (NATIVE || hasDevice() ? S.channels : []);
function cmList() {
  const q = CM.q.trim().toLowerCase();
  let l = chans();
  if (CM.group === 'tv') l = l.filter(c => c.type === 'tv');
  else if (CM.group === 'radio') l = l.filter(c => c.type === 'radio');
  else if (CM.group === 'hidden') l = l.filter(c => c.hidden);
  else if (CM.group === 'locked') l = l.filter(c => c.locked);
  else if (CM.group !== 'all') l = l.filter(c => c.fav.includes(CM.group));
  if (q) l = l.filter(c => c.name.toLowerCase().includes(q));
  return l;
}
SCREENS.channels = () => {
  const all = chans(), l = cmList(), n = CM.sel.size;
  const g = (id, label, count, icon) => `<button class="list-item ${CM.group === id ? 'on' : ''}" data-act="cm-group" data-v="${id}">${ic(icon)}<div><b>${esc(t(label))}</b></div><small>${count}</small></button>`;
  const dragOk = CM.group === 'all' && !CM.q;
  return `<div class="page">${pageHead('list', 'Channel Manager', 'Rename, reorder, group, lock and hide your channels. Drag a row to move it.',
    `<button class="btn" data-act="cm-import">${ic('upload')}${t('Import')}</button><button class="btn" data-act="cm-export" ${all.length ? '' : 'disabled'}>${ic('download')}${t('Export')}</button>`)}
    <div class="panes" style="grid-template-columns:236px minmax(0,1fr)">
      <section class="card pane"><div class="scroll" style="display:grid;gap:2px;align-content:start">
        ${g('all', 'All channels', all.length, 'layers')}${g('tv', 'TV', all.filter(c => c.type === 'tv').length, 'tv')}${g('radio', 'Radio', all.filter(c => c.type === 'radio').length, 'head')}
        ${g('locked', 'Locked', all.filter(c => c.locked).length, 'lock')}${g('hidden', 'Hidden', all.filter(c => c.hidden).length, 'eyeoff')}
        <div class="row nw" style="margin-block:10px 2px;padding-inline:6px"><span class="lbl sp">${t('Favorites groups')}</span><button class="icon-btn" style="width:28px;height:28px;font-size:16px" data-act="grp-add" aria-label="${t('New group')}" data-tip="${t('New group')}">${ic('plus')}</button></div>
        ${S.groups.map(x => g(x.id, x.name, all.filter(c => c.fav.includes(x.id)).length, 'star')).join('')}
        ${!['all', 'tv', 'radio', 'locked', 'hidden'].includes(CM.group) ? `<div class="row" style="padding-inline:6px;margin-block-start:4px"><button class="btn sm" data-act="grp-rename">${ic('edit')}${t('Rename')}</button><button class="btn sm danger" data-act="grp-del">${ic('trash')}${t('Delete')}</button></div>` : ''}
      </div></section>
      <section class="card pane">
        <div class="row"><label class="search" style="flex:1 1 220px">${ic('search')}<input id="cm-q" type="search" value="${esc(CM.q)}" placeholder="${t('Search channels...')}" data-chg="cm-q" aria-label="${t('Search channels...')}"></label>
          ${n ? `<span class="sub">${n} ${t('selected')}</span><button class="btn sm" data-act="cm-bulk" data-v="fav">${ic('star')}${t('Add to group')}</button><button class="btn sm" data-act="cm-bulk" data-v="lock">${ic('lock')}${t('Lock')}</button><button class="btn sm" data-act="cm-bulk" data-v="hide">${ic('eyeoff')}${t('Hide')}</button><button class="btn sm danger" data-act="cm-bulk" data-v="del">${ic('trash')}${t('Delete')}</button>` : `<span class="hint">${t(dragOk ? 'Tip: drag rows to reorder.' : 'Open All channels to drag rows.')}</span>`}</div>
        <div class="tbl-wrap">${!all.length ? `<div class="empty">${ic('list')}<b>${t('No channels yet')}</b><span>${t('Scan a satellite or import a saved list.')}</span><button class="btn sm" data-act="go" data-v="scan">${t('Open Transponder Scan')}</button></div>` : `<table class="tbl"><thead><tr><th style="width:30px"><input id="cm-all" type="checkbox" aria-label="${t('Select all')}" data-chg="cm-all" ${n && n === l.length ? 'checked' : ''} style="accent-color:var(--accent)"></th><th></th><th>#</th><th>${t('Name')}</th><th>${t('Type')}</th><th>${t('Satellite')}</th><th>${t('Frequency')}</th><th>${t('Access')}</th><th></th></tr></thead>
        <tbody id="cm-body">${l.map(c => { const tp = tpOf(c), s = satById(c.sat); return `<tr data-id="${c.id}" draggable="${dragOk}" class="${CM.sel.has(c.id) ? 'sel' : ''}"><td><input id="cm-${c.id}" type="checkbox" data-chg="cm-sel" data-v="${c.id}" ${CM.sel.has(c.id) ? 'checked' : ''} aria-label="${esc(c.name)}" style="accent-color:var(--accent)"></td>
          <td>${dragOk ? `<span class="handle">${ic('grip')}</span>` : ''}</td><td>${c.lcn}</td><td><span class="row nw">${picon(c)}<span>${esc(c.name)}</span></span></td><td>${t(c.type === 'tv' ? 'TV' : 'Radio')}</td><td>${esc(s?.name || '—')}</td><td class="ltr">${tp ? `${tp.freq} ${tp.pol}` : '—'}</td><td><span class="badge">${t(c.fta ? 'FTA' : 'CA')}</span></td>
          <td><div class="acts"><button class="icon-btn" data-act="cm-play" data-v="${c.id}" aria-label="${t('Play')}" data-tip="${t('Play')}">${ic('play')}</button><button class="icon-btn star ${c.fav.length ? 'on' : ''}" data-act="fav-group" data-v="${c.id}" aria-label="${t('Favorites groups')}" data-tip="${t('Favorites groups')}">${ic('star')}</button><button class="icon-btn flag ${c.locked ? 'on' : ''}" data-act="cm-flag" data-v="${c.id}|locked" aria-label="${t('Lock')}" data-tip="${t(c.locked ? 'Unlock' : 'Lock')}">${ic(c.locked ? 'lock' : 'unlock')}</button><button class="icon-btn flag ${c.hidden ? 'on' : ''}" data-act="cm-flag" data-v="${c.id}|hidden" aria-label="${t('Hide')}" data-tip="${t(c.hidden ? 'Show' : 'Hide')}">${ic(c.hidden ? 'eyeoff' : 'eye')}</button><button class="icon-btn" data-act="cm-rename" data-v="${c.id}" aria-label="${t('Rename')}" data-tip="${t('Rename')}">${ic('edit')}</button><button class="icon-btn" data-act="cm-del" data-v="${c.id}" aria-label="${t('Delete')}" data-tip="${t('Delete')}">${ic('trash')}</button></div></td></tr>`; }).join('')}</tbody></table>${l.length ? '' : `<div class="empty">${ic('search')}<span>${t('No channels match')}</span></div>`}`}</div>
      </section></div></div>`;
};
A['cm-group'] = el => { CM.group = el.dataset.v; CM.sel.clear(); refresh(); };
CHG['cm-q'] = el => { CM.q = el.value; const pos = el.selectionStart; refresh(); const i = $('#cm-q'); i.focus(); i.setSelectionRange(pos, pos); };
CHG['cm-all'] = el => { CM.sel = new Set(el.checked ? cmList().map(c => c.id) : []); refresh(); };
CHG['cm-sel'] = el => { el.checked ? CM.sel.add(el.dataset.v) : CM.sel.delete(el.dataset.v); refresh(); };
A['cm-play'] = el => { go('live'); tune(el.dataset.v); };
A['cm-flag'] = el => { const [id, k] = el.dataset.v.split('|'), c = chById(id); c[k] = !c[k]; save(); refresh(); toast(t(k === 'locked' ? (c.locked ? 'Channel locked' : 'Channel unlocked') : (c.hidden ? 'Channel hidden' : 'Channel visible')), 'good'); };
const renumber = () => S.channels.forEach((c, i) => { c.lcn = i + 1; });
A['cm-rename'] = el => {
  const c = chById(el.dataset.v), id = uid('rn');
  A[id] = () => { const m = modals[modals.length - 1], v = formVals(m); if (!v.name.trim()) { setErr(m, 'name', t('Enter a name.')); return; } c.name = v.name.trim(); save(); closeModal(); refresh(); toast(t('Channel renamed'), 'good'); };
  openModal({ title: t('Rename channel'), width: 420, body: field('Name', 'name', c.name), foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
};
function removeChannels(ids) {
  S.channels = S.channels.filter(c => !ids.has(c.id));
  ids.forEach(i => { delete S.picons[i]; });
  if (!chById(S.player.ch)) S.player.ch = S.channels[0]?.id;
  renumber(); CM.sel.clear(); save(); refresh();
}
A['cm-del'] = el => { const c = chById(el.dataset.v); confirmBox({ title: `${t('Delete')} ${c.name}?`, msg: t('A rescan can find it again.'), yes: t('Delete'), onYes: () => removeChannels(new Set([c.id])) }); };
A['cm-bulk'] = el => {
  const op = el.dataset.v, ids = [...CM.sel], list = ids.map(chById);
  if (op === 'del') { confirmBox({ title: `${t('Delete')} ${ids.length} ${t('channels')}?`, msg: t('A rescan can find them again.'), yes: t('Delete'), onYes: () => removeChannels(new Set(ids)) }); return; }
  if (op === 'lock') { const v = !list.every(c => c.locked); list.forEach(c => { c.locked = v; }); }
  if (op === 'hide') { const v = !list.every(c => c.hidden); list.forEach(c => { c.hidden = v; }); }
  if (op === 'fav') { openPop(el, `<h4>${t('Add to group')}</h4>${S.groups.map(g => mi('cm-to-grp', g.name, { v: g.id, icon: 'star' })).join('') || `<div class="hint" style="padding:6px 9px">${t('No groups yet.')}</div>`}`); return; }
  save(); refresh(); toast(t('Channels updated'), 'good');
};
A['cm-to-grp'] = el => { const g = el.dataset.v; [...CM.sel].map(chById).forEach(c => { if (!c.fav.includes(g)) c.fav.push(g); }); closePop(); save(); refresh(); toast(t('Favorites updated'), 'good'); };
function grpModal(g) {
  const id = uid('gm');
  A[id] = () => { const m = modals[modals.length - 1], v = formVals(m); if (!v.name.trim()) { setErr(m, 'name', t('Enter a name.')); return; } if (g) g.name = v.name.trim(); else { const n = { id: uid('g'), name: v.name.trim() }; S.groups.push(n); CM.group = n.id; } save(); closeModal(); refresh(); };
  openModal({ title: t(g ? 'Rename group' : 'New group'), width: 400, body: field('Name', 'name', g?.name), foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
}
A['grp-add'] = () => grpModal();
A['grp-rename'] = () => grpModal(S.groups.find(g => g.id === CM.group));
A['grp-del'] = () => { const g = S.groups.find(x => x.id === CM.group); confirmBox({ title: `${t('Delete')} ${g.name}?`, msg: t('Channels stay in your list. Only the group is removed.'), yes: t('Delete'), onYes: () => { S.groups = S.groups.filter(x => x !== g); S.channels.forEach(c => { c.fav = c.fav.filter(f => f !== g.id); }); CM.group = 'all'; save(); refresh(); } }); };
A['cm-export'] = () => saveFile('nova-channels.json', JSON.stringify({ app: 'NOVA DVB Studio', kind: 'channels', channels: S.channels, groups: S.groups }, null, 2));
A['cm-import'] = async () => {
  const [f] = await pickFiles('.json,application/json'); if (!f) return;
  try {
    const d = JSON.parse(await readText(f));
    if (!Array.isArray(d.channels) || !d.channels.every(c => c.id && c.name)) throw new Error('shape');
    S.channels = d.channels; if (Array.isArray(d.groups)) S.groups = d.groups; S.player.ch = S.channels[0]?.id;
    save(); refresh(); toast(`${S.channels.length} ${t('channels imported')}`, 'good');
  } catch (e) { toast(t('That file is not a NOVA channel list.'), 'bad'); }
};
/* Drag and drop inside the channel table */
let dragId = null;
document.addEventListener('dragstart', e => { const tr = e.target.closest?.('#cm-body tr[draggable="true"]'); if (tr) { dragId = tr.dataset.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) { /* some browsers */ } } });
document.addEventListener('dragover', e => { const tr = e.target.closest?.('#cm-body tr'); if (!dragId || !tr) return; e.preventDefault(); $$('.drop-before').forEach(x => x.classList.remove('drop-before')); tr.classList.add('drop-before'); });
document.addEventListener('drop', e => {
  const tr = e.target.closest?.('#cm-body tr'); if (!dragId || !tr) return; e.preventDefault();
  const from = S.channels.findIndex(c => c.id === dragId), [m] = S.channels.splice(from, 1), to = S.channels.findIndex(c => c.id === tr.dataset.id);
  S.channels.splice(to < 0 ? S.channels.length : to, 0, m); renumber(); dragId = null; save(); refresh(); toast(t('Channel moved'), 'good');
});
document.addEventListener('dragend', () => { dragId = null; $$('.drop-before').forEach(x => x.classList.remove('drop-before')); });

/* ---------- Program Guide ---------- */
const EG = { day: 0, q: '', group: 'tv' };
const PX = 3.4;
SCREENS.epg = () => {
  const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() + EG.day);
  const d0 = base.getTime(), d1 = d0 + 864e5, list = chans().filter(c => !c.hidden && (EG.group === 'all' || (EG.group === 'fav' ? c.fav.length : c.type === EG.group))).slice(0, 26);
  const q = EG.q.trim().toLowerCase();
  const hits = q ? list.flatMap(c => epgFor(c).filter(p => p.end > Date.now() && p.title.toLowerCase().includes(q)).map(p => ({ c, p }))).sort((a, b) => a.p.start - b.p.start).slice(0, 60) : [];
  const nowX = (Date.now() - d0) / 6e4 * PX;
  const offs = 176, grid = `<div class="epg-grid" id="epg-grid"><div class="epg-inner" style="width:${offs + 1440 * PX}px">
    <div class="epg-times">${Array.from({ length: 24 }, (_, h) => `<span class="ltr" style="inset-inline-start:${offs + h * 60 * PX}px">${String(h).padStart(2, '0')}:00</span>`).join('')}</div>
    ${list.map(c => `<div class="epg-row"><button class="epg-ch" data-act="cm-play" data-v="${c.id}" data-tip="${t('Watch')}">${picon(c)}<span>${esc(c.name)}</span></button>
      ${epgFor(c).filter(p => p.end > d0 && p.start < d1).map(p => { const a = Math.max(p.start, d0), b = Math.min(p.end, d1), x = offs + (a - d0) / 6e4 * PX, w = (b - a) / 6e4 * PX - 3, now = p.start <= Date.now() && p.end > Date.now(), tm = S.timers.some(k => k.pid === p.id);
    return `<button class="epg-p ${now ? 'is-now' : ''} ${tm ? 'timer' : ''}" style="inset-inline-start:${x}px;width:${w}px" data-act="epg-open" data-v="${c.id}|${p.id}"><b>${esc(p.title)}</b><small class="ltr">${fmtTime(p.start)} - ${fmtTime(p.end)}</small></button>`; }).join('')}</div>`).join('')}
    ${EG.day === 0 ? `<div class="epg-line" style="inset-inline-start:${offs + nowX}px"></div>` : ''}</div></div>`;
  return `<div class="page">${pageHead('cal', 'Program Guide', 'What is on now and next. Pick a program to watch it or schedule a recording.', `<span class="hint">${t(!NATIVE && hasDevice() ? 'Sample listings' : 'No listings yet')}</span>`)}
    <section class="card pane" style="flex:1"><div class="row">
      <button class="icon-btn" data-act="epg-day" data-v="-1" aria-label="${t('Previous day')}" data-tip="${t('Previous day')}" ${EG.day <= -1 ? 'disabled' : ''}>${ic('prev')}</button><b style="min-width:128px;text-align:center">${EG.day === 0 ? t('Today') : fmtDayShort(d0)}</b><button class="icon-btn" data-act="epg-day" data-v="1" aria-label="${t('Next day')}" data-tip="${t('Next day')}" ${EG.day >= 1 ? 'disabled' : ''}>${ic('next')}</button>
      <div class="seg" style="width:260px">${[['tv', 'TV'], ['radio', 'Radio'], ['fav', 'Favorites']].map(([v, l]) => `<button data-act="epg-grp" data-v="${v}" aria-pressed="${EG.group === v}">${t(l)}</button>`).join('')}</div>
      <span class="sp"></span><label class="search" style="width:min(300px,100%)">${ic('search')}<input id="epg-q" type="search" value="${esc(EG.q)}" placeholder="${t('Search programs...')}" data-chg="epg-q" aria-label="${t('Search programs...')}"></label></div>
      ${NATIVE || !list.length ? `<div class="empty">${ic('cal')}<b>${t('No program data')}</b><span>${t('Listings arrive with the broadcast once a channel is tuned.')}</span></div>` : q ? `<div class="scroll" style="display:grid;gap:2px;align-content:start;flex:1">${hits.map(({ c, p }) => `<button class="list-item" data-act="epg-open" data-v="${c.id}|${p.id}">${picon(c)}<div><b>${esc(p.title)}</b><small>${esc(c.name)} &nbsp;•&nbsp; <span class="ltr">${fmtDayShort(p.start)} ${fmtTime(p.start)}</span></small></div></button>`).join('') || `<div class="empty">${ic('search')}<span>${t('No programs match')}</span></div>`}</div>` : grid}
    </section></div>`;
};
SCREENS.epg.mount = () => { const g = $('#epg-grid'); if (g && EG.day === 0) g.scrollLeft = Math.max(0, (Date.now() - new Date().setHours(0, 0, 0, 0)) / 6e4 * PX - 120) * (S.lang === 'ar' ? -1 : 1); };
A['epg-day'] = el => { EG.day = clamp(EG.day + Number(el.dataset.v), -1, 1); renderView(); };
A['epg-grp'] = el => { EG.group = el.dataset.v; renderView(); };
CHG['epg-q'] = el => { EG.q = el.value; const pos = el.selectionStart; renderView(); const i = $('#epg-q'); i.focus(); i.setSelectionRange(pos, pos); };
function openProgramme(ch, p) {
  if (!ch || !p) return;
  const has = S.timers.find(k => k.pid === p.id), past = p.end < Date.now(), id = uid('ep'), id2 = uid('ew');
  A[id] = () => {
    if (has) S.timers = S.timers.filter(k => k !== has);
    else S.timers.push({ id: uid('t'), ch: ch.id, title: p.title, start: p.start, mins: (p.end - p.start) / 6e4, repeat: 'Once', pid: p.id });
    save(); closeModal(); if (S.view !== 'live') refresh(); toast(t(has ? 'Recording canceled' : 'Recording scheduled'), 'good');
  };
  A[id2] = () => { closeModal(); go('live'); tune(ch.id); };
  openModal({ title: p.title, width: 480, body: `<div class="row">${picon(ch)}<b>${esc(ch.name)}</b></div>
    <dl class="kv dl-plain"><dt>${t('Date')}</dt><dd>${fmtDay(p.start)}</dd><dt>${t('Time')}</dt><dd class="ltr" style="text-align:start">${fmtTime(p.start)} - ${fmtTime(p.end)}</dd><dt>${t('Length')}</dt><dd>${Math.round((p.end - p.start) / 6e4)} ${t('min')}</dd></dl><p class="sub">${t(p.desc)}</p>`,
    foot: `<button class="btn" data-act="modal-close">${t('Close')}</button><button class="btn" data-act="${id2}">${ic('play')}${t('Watch channel')}</button>${past ? '' : `<button class="btn primary" data-act="${id}">${ic('dot')}${t(has ? 'Cancel recording' : 'Schedule recording')}</button>`}` });
}

/* ---------- Recordings ---------- */
const DISK = { total: 931.5, free: 120.5 };
const diskFree = () => (NATIVE ? Engine.stats.freeGb ?? '—' : DISK.free);
SCREENS.recordings = () => {
  const used = S.recordings.reduce((a, r) => a + r.gb, 0);
  const conflict = k => S.timers.some(o => o !== k && o.start < k.start + k.mins * 6e4 && k.start < o.start + o.mins * 6e4 && tpOf(chById(o.ch)) !== tpOf(chById(k.ch)));
  return `<div class="page">${pageHead('rec', 'Recordings', 'Saved programs and scheduled recordings.', `<button class="btn" data-act="open-settings" data-v="recording">${ic('folder')}${t('Recording folder')}</button><button class="btn primary" data-act="tm-add">${ic('plus')}${t('New schedule')}</button>`)}
    <section class="card pane" style="flex:none"><div class="grid4">
      <div class="stat"><small>${t('Free space')}</small><b class="ltr" style="text-align:start">${diskFree()} GB</b>${NATIVE ? '' : `<span class="bar"><i style="width:${(1 - DISK.free / DISK.total) * 100}%;background:var(--grad)"></i></span>`}</div>
      <div class="stat"><small>${t('Used by recordings')}</small><b class="ltr" style="text-align:start">${used.toFixed(1)} GB</b></div>
      <div class="stat"><small>${t('Recorded programs')}</small><b>${S.recordings.length}</b></div><div class="stat"><small>${t('Scheduled')}</small><b>${S.timers.length}</b></div></div>
      <div class="row hint">${ic('folder')}<span class="ltr">${esc(S.settings.recFolder)}</span><span class="sp"></span><span>${t(NATIVE ? 'Scheduled recordings do not start by themselves in this build.' : 'Sample figures in this preview')}</span></div></section>
    <div class="panes" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
      <section class="card pane"><div class="card-head">${ic('film')}<h2>${t('Recorded')}</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('Program')}</th><th>${t('Channel')}</th><th>${t('Date')}</th><th>${t('Length')}</th><th>${t('Size')}</th><th></th></tr></thead><tbody>
        ${S.recordings.map(r => `<tr><td>${esc(r.title)}</td><td>${esc(chById(r.ch)?.name || '—')}</td><td>${fmtDayShort(r.at)}</td><td>${r.mins} ${t('min')}</td><td class="ltr">${r.gb} GB</td><td><div class="acts"><button class="icon-btn" data-act="rec-play" data-v="${r.id}" aria-label="${t('Play')}" data-tip="${t('Play')}">${ic('play')}</button><button class="icon-btn" data-act="rec-del" data-v="${r.id}" aria-label="${t('Delete')}" data-tip="${t('Delete')}">${ic('trash')}</button></div></td></tr>`).join('')}</tbody></table>
        ${S.recordings.length ? '' : `<div class="empty">${ic('film')}<span>${t('No recordings yet.')}</span></div>`}</div></section>
      <section class="card pane"><div class="card-head">${ic('clock')}<h2>${t('Scheduled')}</h2></div><div class="scroll" style="display:grid;gap:2px;align-content:start">
        ${S.timers.map(k => `<div class="list-item">${ic('clock')}<div><b>${esc(k.title)}</b><small>${esc(chById(k.ch)?.name || '—')} &nbsp;•&nbsp; <span class="ltr">${fmtDayShort(k.start)} ${fmtTime(k.start)}</span> &nbsp;•&nbsp; ${k.mins} ${t('min')} &nbsp;•&nbsp; ${t(k.repeat)}</small></div>${conflict(k) ? `<span class="state warn" data-tip="${t('Overlaps another recording on a different transponder. A single tuner cannot record both.')}">${t('Conflict')}</span>` : ''}<button class="icon-btn" data-act="tm-del" data-v="${k.id}" aria-label="${t('Delete')}" data-tip="${t('Delete')}">${ic('trash')}</button></div>`).join('') || `<div class="empty">${ic('clock')}<span>${t('Nothing scheduled. Pick a program in the guide or add a schedule.')}</span></div>`}</div></section>
    </div></div>`;
};
A['rec-play'] = el => { const r = S.recordings.find(x => x.id === el.dataset.v), c = chById(r.ch); if (c) { go('live'); tune(c.id); toast(`${t('Playing sample of')} ${r.title}`); } };
A['rec-del'] = el => { const r = S.recordings.find(x => x.id === el.dataset.v); confirmBox({ title: `${t('Delete')} ${r.title}?`, msg: t('The file is removed from disk and cannot be recovered.'), yes: t('Delete'), onYes: () => { S.recordings = S.recordings.filter(x => x !== r); save(); refresh(); } }); };
A['tm-del'] = el => { S.timers = S.timers.filter(k => k.id !== el.dataset.v); save(); refresh(); toast(t('Recording canceled'), 'good'); };
A['tm-add'] = () => {
  const id = uid('tm'), d = new Date(Date.now() + 36e5), pad = n => String(n).padStart(2, '0');
  const def = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  A[id] = () => {
    const m = modals[modals.length - 1], v = formVals(m), mins = Number(v.mins), start = new Date(v.when).getTime();
    const okM = mins >= 1 && mins <= 720, okT = start > Date.now();
    setErr(m, 'mins', okM ? '' : t('Enter 1 to 720 minutes.')); setErr(m, 'when', okT ? '' : t('Choose a time in the future.'));
    if (!okM || !okT) return;
    S.timers.push({ id: uid('t'), ch: v.ch, title: v.title.trim() || chById(v.ch)?.name, start, mins, repeat: v.repeat });
    save(); closeModal(); refresh(); toast(t('Recording scheduled'), 'good');
  };
  openModal({ title: t('New schedule'), width: 460, body: `${selectF('Channel', 'ch', S.channels.map(c => [c.id, c.name]), S.player.ch)}${field('Title (optional)', 'title')}<div class="grid2">${field('Start', 'when', def, 'type="datetime-local"')}${field('Length (minutes)', 'mins', 60, 'inputmode="numeric"')}</div>${selectF('Repeat', 'repeat', ['Once', 'Daily', 'Weekly'], 'Once')}`,
    foot: `<button class="btn" data-act="modal-close">${t('Cancel')}</button><button class="btn primary" data-act="${id}">${t('Save')}</button>` });
};
