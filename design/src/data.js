/* Sample records for the design review.
   Every channel name here is invented. Nothing below came from a tuner.
   In the Windows app this file does not exist: records come from SQLite and the DVB engine. */

const SATS_SEED = [
  { id: 'sat1', name: 'Nilesat 201', pos: 7.0, dir: 'W', tps: [
    [12245, 'H', 27500, '5/6', '8PSK', 'DVB-S2', '0.35', 'Auto'], [11747, 'H', 27500, '3/4', 'QPSK', 'DVB-S', '0.35', 'Off'],
    [11900, 'V', 27500, '5/6', 'QPSK', 'DVB-S', '0.35', 'Off'], [12015, 'H', 27500, '3/4', '8PSK', 'DVB-S2', '0.25', 'Auto'],
    [12207, 'V', 27500, '5/6', '8PSK', 'DVB-S2', '0.35', 'Auto'], [12380, 'V', 27500, '3/4', 'QPSK', 'DVB-S', '0.35', 'Off'] ] },
  { id: 'sat2', name: 'Eutelsat Hot Bird 13', pos: 13.0, dir: 'E', tps: [
    [10971, 'H', 29900, '3/4', '8PSK', 'DVB-S2', '0.35', 'Auto'], [11034, 'V', 27500, '3/4', 'QPSK', 'DVB-S', '0.35', 'Off'],
    [11604, 'H', 29900, '5/6', '8PSK', 'DVB-S2', '0.25', 'Auto'], [12111, 'V', 27500, '3/4', 'QPSK', 'DVB-S', '0.35', 'Off'] ] },
  { id: 'sat3', name: 'Astra 1 Group', pos: 19.2, dir: 'E', tps: [
    [11362, 'H', 22000, '2/3', '8PSK', 'DVB-S2', '0.20', 'Auto'], [11494, 'H', 22000, '2/3', '8PSK', 'DVB-S2', '0.20', 'Auto'],
    [12188, 'H', 27500, '3/4', 'QPSK', 'DVB-S', '0.35', 'Off'] ] },
  { id: 'sat4', name: 'Badr Group', pos: 26.0, dir: 'E', tps: [
    [11881, 'V', 27500, '3/4', 'QPSK', 'DVB-S', '0.35', 'Off'], [12073, 'H', 27500, '3/4', 'QPSK', 'DVB-S', '0.35', 'Off'],
    [12341, 'V', 27500, '2/3', '8PSK', 'DVB-S2', '0.35', 'Auto'] ] },
  { id: 'sat5', name: 'Eutelsat 7 West A', pos: 7.3, dir: 'W', tps: [
    [11595, 'V', 27500, '5/6', 'QPSK', 'DVB-S', '0.35', 'Off'], [11785, 'H', 27500, '5/6', '8PSK', 'DVB-S2', '0.35', 'Auto'] ] },
];

const CH_SEED = [
  ['Aurora Sports 1 HD', 'AS', '1', 'sport', 'HD', '#4b3bd6', '#2a7be0'], ['Aurora Sports 2 HD', 'AS', '2', 'sport', 'HD', '#4b3bd6', '#2a7be0'],
  ['Aurora Sports 3 HD', 'AS', '3', 'sport', 'HD', '#4b3bd6', '#2a7be0'], ['Aurora Sports 4 HD', 'AS', '4', 'sport', 'HD', '#4b3bd6', '#2a7be0'],
  ['Aurora Sports 5 HD', 'AS', '5', 'sport', 'HD', '#4b3bd6', '#2a7be0'], ['Aurora Sports News HD', 'AS', 'N', 'news', 'HD', '#4b3bd6', '#2a7be0'],
  ['Aurora 4K', 'AS', '4K', 'sport', '4K', '#4b3bd6', '#2a7be0'], ['Falcon Sport 1 HD', 'FS', '1', 'sport', 'HD', '#0f6d70', '#0d3f6b'],
  ['Falcon Sport 2 HD', 'FS', '2', 'sport', 'HD', '#0f6d70', '#0d3f6b'], ['Falcon Sport 3 HD', 'FS', '3', 'sport', 'HD', '#0f6d70', '#0d3f6b'],
  ['Lumen News HD', 'LN', '', 'news', 'HD', '#a3262e', '#5d1524'], ['Lumen Business HD', 'LB', '', 'news', 'HD', '#a3262e', '#5d1524'],
  ['Meridian 24', 'M24', '', 'news', 'SD', '#27457f', '#172a52'], ['Meridian World HD', 'MW', '', 'news', 'HD', '#27457f', '#172a52'],
  ['Kestrel Cinema 1 HD', 'KC', '1', 'movie', 'HD', '#7b3f14', '#3a1d0d'], ['Kestrel Cinema 2 HD', 'KC', '2', 'movie', 'HD', '#7b3f14', '#3a1d0d'],
  ['Kestrel Cinema 3 HD', 'KC', '3', 'movie', 'HD', '#7b3f14', '#3a1d0d'], ['Kestrel Drama HD', 'KD', '', 'movie', 'HD', '#7b3f14', '#3a1d0d'],
  ['Dune Movies HD', 'DM', '', 'movie', 'HD', '#a06a1f', '#59350e'], ['Dune Classics', 'DC', '', 'movie', 'SD', '#a06a1f', '#59350e'],
  ['Saffron Series HD', 'SS', '', 'movie', 'HD', '#9a3b76', '#4a1a48'], ['Saffron Family', 'SF', '', 'movie', 'SD', '#9a3b76', '#4a1a48'],
  ['Terra Docs HD', 'TD', '', 'docs', 'HD', '#2f6e3f', '#173a26'], ['Terra Wild HD', 'TW', '', 'docs', 'HD', '#2f6e3f', '#173a26'],
  ['Tidal History', 'TH', '', 'docs', 'SD', '#1c6480', '#0e3345'], ['Tidal Science HD', 'TS', '', 'docs', 'HD', '#1c6480', '#0e3345'],
  ['Comet Kids HD', 'CK', '', 'kids', 'HD', '#d0701a', '#b2342f'], ['Comet Junior', 'CJ', '', 'kids', 'SD', '#d0701a', '#b2342f'],
  ['Pixel Play HD', 'PP', '', 'kids', 'HD', '#2a8ec9', '#5b3dd6'], ['Cedar Music HD', 'CM', '', 'music', 'HD', '#1f7a5c', '#0f3f46'],
  ['Pulse Hits', 'PH', '', 'music', 'SD', '#b02a78', '#54205e'], ['Pulse Classics', 'PC', '', 'music', 'SD', '#b02a78', '#54205e'],
  ['Radio Mistral', 'RM', '', 'radio', 'R', '#3a4678', '#1d2547'], ['Radio Solstice', 'RS', '', 'radio', 'R', '#3a4678', '#1d2547'],
  ['Harbor FM', 'HF', '', 'radio', 'R', '#25607c', '#123244'], ['Atlas Waves', 'AW', '', 'radio', 'R', '#6e4a22', '#38240f'],
  ['Dune Radio', 'DR', '', 'radio', 'R', '#a06a1f', '#59350e'], ['Nocturne FM', 'NF', '', 'radio', 'R', '#46307e', '#221743'],
  ['Oasis Talk', 'OT', '', 'radio', 'R', '#2f6e3f', '#173a26'], ['Lumen Radio', 'LR', '', 'radio', 'R', '#a3262e', '#5d1524'],
];

const EPG_TITLES = {
  sport: ['Championship Night Live', 'Studio Analysis', 'The Football Review', 'European Football Highlights', 'Courtside Tonight', 'Road to the Final'],
  news: ['Evening Bulletin', 'World Desk', 'Market Watch', 'The Interview', 'Morning Briefing', 'Weekly Digest'],
  movie: ['The Long Road North', 'Glass Harbour', 'Night Train to Fes', 'The Cartographer', 'Summer of Salt', 'Paper Lanterns'],
  docs: ['Deep Ocean Giants', 'Cities Under Sand', 'Wild Atlas', 'How Bridges Stand', 'The Silk Route', 'Rivers of Ice'],
  kids: ['Comet and Friends', 'Robo Garden', 'Story Hour', 'Little Explorers', 'Draw With Me', 'Tiny Inventors'],
  music: ['Top 20 Countdown', 'Studio Sessions', 'Oud Nights', 'Retro Hour', 'Fresh Tracks', 'Live at the Hall'],
  radio: ['Morning Drive', 'Open Lines', 'Afternoon Mix', 'Evening Jazz', 'The Night Shift', 'News on the Hour'],
};
const EPG_DESC = 'Sample listing for the design review. Real listings come from the broadcast EIT tables or an EPG source you authorize.';

/* True only inside the NOVA Windows app. */
const NATIVE = !!window.chrome?.webview;

function seedChannels() {
  return CH_SEED.map((c, i) => {
    const [name, code, num, kind, q, p1, p2] = c;
    const radio = kind === 'radio';
    const sat = i < 22 ? 'sat1' : i < 30 ? 'sat2' : 'sat4';
    const hd = q === 'HD' || q === '4K';
    return {
      id: 'ch' + (i + 1), lcn: i + 1, name, code, num, kind, q, p1, p2,
      type: radio ? 'radio' : 'tv', sat, tp: i % 4,
      vcodec: radio ? '' : q === '4K' ? 'H.265' : hd ? 'H.264' : 'MPEG-2',
      acodec: i % 3 === 0 ? 'AC3' : i % 3 === 1 ? 'AAC' : 'MPEG Audio',
      res: radio ? '' : q === '4K' ? '3840 x 2160' : hd ? '1920 x 1080' : '720 x 576',
      kbps: radio ? 192 : q === '4K' ? 18400 : hd ? 7800 : 3600,
      sid: 1000 + i * 7, vpid: radio ? 0 : 501 + i, apid: 601 + i,
      audio: i % 2 === 0 ? ['Arabic', 'English'] : ['Arabic'],
      subs: i % 5 === 0 ? ['Arabic', 'French'] : [],
      fta: i % 3 !== 0, fav: i < 2 ? ['g1'] : [], locked: false, hidden: false,
    };
  });
}

function seedState() {
  const channels = NATIVE ? [] : seedChannels();
  const picons = {};
  channels.forEach((c, i) => { if (i % 6 !== 5) picons[c.id] = 'auto'; });
  const base = {
    v: 1, view: 'live', mode: 'live', lang: 'en',
    theme: { id: 'dark', bg: 'aurora', cards: 'soft', icons: 'line', font: 100, density: 'normal' },
    layout: { sidebar: true, video: true, list: true, now: true, signal: true, epg: true, tools: true, order: ['signal', 'epg', 'tools'] },
    player: { ch: 'ch1', playing: true, muted: true, vol: 37, aspect: 'Fill', audio: 0, sub: -1, hw: true },
    filter: { tab: 'all', q: '', hd: false, fta: false, sat: '', sort: 'lcn' },
    groups: [{ id: 'g1', name: 'Sport' }, { id: 'g2', name: 'Family' }],
    channels, picons, piconSize: 74,
    sats: SATS_SEED.map(s => ({ ...s, tps: s.tps.map((t, i) => ({ id: s.id + 't' + i, freq: t[0], pol: t[1], sr: t[2], fec: t[3], mod: t[4], std: t[5], ro: t[6], pilot: t[7] })) })),
    selSat: 'sat1',
    servers: [{ id: 's1', label: 'Example: my provider', type: 'CCcam', host: 'server.example.com', port: 12000, user: 'demo-user', pass: 'example-only', enabled: false, status: 'untested' }],
    biss: [{ id: 'b1', label: 'Example: my own feed', key: '11223366445566FF', target: 'ch12', status: 'unverified' }],
    recordings: [
      { id: 'r1', title: 'Championship Night Live', ch: 'ch1', at: Date.now() - 864e5, mins: 120, gb: 7.8 },
      { id: 'r2', title: 'Deep Ocean Giants', ch: 'ch23', at: Date.now() - 2.6e8, mins: 55, gb: 2.9 },
      { id: 'r3', title: 'Evening Bulletin', ch: 'ch11', at: Date.now() - 4.1e8, mins: 30, gb: 1.2 },
    ],
    timers: [],
    backups: [],
    settings: {
      startup: 'last', minimizeTray: false, autostart: false, resumeLast: true, confirmExit: true, parentalPin: '0000',
      device: 'auto', tunerMode: 'Single', retune: 'On', lnbType: 'Universal', lof1: 9750, lof2: 10600, lofSw: 11700,
      voltage: 'Auto', tone: 'Auto', diseqc: 'None', port: 'A', uncommitted: 'None', motor: 'Off', usals: false, lat: 33.57, lon: -7.59, stepSize: 1,
      decoder: 'Auto', hwAccel: true, deinterlace: 'Auto', buffer: 400, reconnect: true, reconnectSec: 5, aspect: 'Fill',
      audioDevice: 'System default', passthrough: false, downmix: 'Stereo', audioLang: 'Arabic', normalize: false,
      subLang: 'Off', subSize: 100, recFolder: 'C:\\NOVA Recordings', recFormat: 'TS', recPad: 2, recPost: 5, recEpgName: true,
      epgSource: 'Broadcast (EIT)', epgDays: 7, epgUpdate: 'While tuned', epgUrl: '',
      piconFolder: 'C:\\ProgramData\\NOVA\\Picons', piconFormat: 'PNG and SVG',
      dbPath: 'C:\\ProgramData\\NOVA\\nova.db', logDays: 14, logLevel: 'Information', camEncrypt: true, camAuto: false, bissEncrypt: true, updateCheck: true,
    },
  };
  /* The Windows app starts empty: nothing here pretends to come from a tuner. */
  if (NATIVE) Object.assign(base, { mode: 'nodevice', servers: [], biss: [], recordings: [] });
  return base;
}
