/* Plugins that come with NOVA. They use the same "nova" interface as plugins from the folder,
   so they double as working examples. */
const BUILTIN_PLUGINS = [
  {
    manifest: {
      id: 'nova.guide-sources', name: 'Extra guide sources', version: '1.0.0', author: 'NOVA', icon: 'cal',
      description: 'Adds programs from one or more XMLTV addresses to the guide, next to the broadcast listings, and refreshes them on a schedule.',
      permissions: ['epg', 'http'],
      settings: [
        { key: 'urls', label: 'XMLTV addresses', type: 'textarea', default: '', help: 'One address per line. Gzip files work too. Use sources you are allowed to use.' },
        { key: 'hours', label: 'Refresh every', type: 'select', default: '12', options: [['6', '6 hours'], ['12', '12 hours'], ['24', '24 hours'], ['0', 'Only when I ask']] },
      ],
      actions: [{ id: 'load', label: 'Load now', icon: 'download' }],
    },
    main(nova) {
      const load = async () => {
        const urls = String(nova.settings.urls || '').split(/\s+/).filter(u => /^https?:\/\//i.test(u));
        if (!urls.length) { nova.status(nova.t('Add at least one address.')); return; }
        let progs = 0, chans = 0;
        for (const url of urls) {
          try {
            const r = nova.epg.importXmltv(await nova.http.getText(url));
            progs += r.progs; chans += r.chans;
            nova.log(url, '→', r.progs, 'programs');
          } catch (e) { nova.log(url, '→', e.message); }
        }
        nova.status(`${progs} ${nova.t('programs for')} ${chans} ${nova.t('channels')} · ${new Date().toLocaleTimeString()}`);
        if (progs) nova.toast(`${progs} ${nova.t('programs for')} ${chans} ${nova.t('channels')}`, 'good');
      };
      nova.onAction('load', load);
      const hours = Number(nova.settings.hours);
      if (hours > 0) { nova.later(5000, load); nova.every(hours * 36e5, load); }
    },
  },
  {
    manifest: {
      id: 'nova.lan-stream', name: 'Stream to the network', version: '1.0.0', author: 'NOVA', icon: 'cast',
      description: 'Sends the channel on screen to other devices at home. Open the address in VLC, Kodi or a TV app. The transponder address carries every channel on it.',
      permissions: ['server', 'channels'],
      settings: [{ key: 'port', label: 'Port', type: 'number', default: 8001, help: 'Change it if another program uses this port.' }],
      actions: [{ id: 'restart', label: 'Restart the stream', icon: 'refresh' }],
    },
    main(nova) {
      const start = async () => {
        if (!nova.windowsApp) { nova.status(nova.t('This works in the Windows app.')); return; }
        try {
          const r = await nova.server.stream(true, nova.settings.port);
          nova.status(`${nova.t('Channel on screen')}:\n${r.channel.join('\n')}\n\n${nova.t('Whole transponder')}:\n${r.transponder.join('\n')}`);
        } catch (e) { nova.status(e.message); nova.toast(e.message, 'bad'); }
      };
      nova.onAction('restart', start);
      nova.on('settings', start);
      nova.on('stop', () => { if (nova.windowsApp) nova.server.stream(false); });
      start();
    },
  },
  {
    manifest: {
      id: 'nova.phone-remote', name: 'Phone remote', version: '1.0.0', author: 'NOVA', icon: 'phone',
      description: 'Control NOVA from a phone on the same network: channel list, up and down, volume, info bar and recording. The phone needs the PIN shown here.',
      permissions: ['server', 'channels', 'player'],
      settings: [
        { key: 'port', label: 'Port', type: 'number', default: 8080 },
        { key: 'pin', label: 'PIN', default: '', help: 'Four to eight digits. A new one is made when empty.' },
      ],
      actions: [{ id: 'restart', label: 'Restart the remote', icon: 'refresh' }, { id: 'newpin', label: 'New PIN', icon: 'key' }],
    },
    main(nova) {
      const state = () => {
        const s = nova.player.state();
        return { app: 'NOVA DVB Studio', channel: s.channel, playing: s.playing, volume: s.volume, muted: s.muted, recording: s.recording, now: s.now,
          channels: nova.channels().slice(0, 800).map(c => ({ id: c.id, name: c.name, number: c.number, type: c.type })) };
      };
      const push = () => nova.server.remoteState(state());
      const start = async () => {
        if (!nova.windowsApp) { nova.status(nova.t('This works in the Windows app.')); return; }
        let pin = String(nova.settings.pin || '');
        if (!/^\d{4,8}$/.test(pin)) { pin = String(Math.floor(1000 + Math.random() * 9000)); nova.setSetting('pin', pin); }
        try {
          const r = await nova.server.remote(true, nova.settings.port, pin);
          push();
          nova.status(`${nova.t('Open on your phone')}:\n${r.urls.join('\n')}\n\nPIN: ${pin}`);
        } catch (e) { nova.status(e.message); nova.toast(e.message, 'bad'); }
      };
      nova.on('remote', ({ act, value }) => {
        if (act === 'up') nova.player.step(-1);
        else if (act === 'down') nova.player.step(1);
        else if (act === 'tune') nova.player.tune(String(value));
        else if (act === 'volume') nova.player.volume(value);
        else if (act === 'mute') nova.player.mute();
        else if (act === 'info') nova.player.info();
        else if (act === 'record') nova.player.record();
        nova.later(300, push);
      });
      nova.on('channel', push);
      nova.every(2000, push);
      nova.onAction('restart', start);
      nova.onAction('newpin', () => { nova.setSetting('pin', ''); start(); });
      nova.on('settings', start);
      nova.on('stop', () => { if (nova.windowsApp) nova.server.remote(false); });
      start();
    },
  },
  {
    manifest: {
      id: 'nova.after-recording', name: 'After recording', version: '1.0.0', author: 'NOVA', icon: 'terminal',
      description: 'When a recording ends, turns it into MP4 with FFmpeg (no quality loss), or runs a program of your choice on it.',
      permissions: ['exec', 'recordings'],
      settings: [
        { key: 'mode', label: 'What to do', type: 'select', default: 'mp4', options: [['mp4', 'Make an MP4 copy with FFmpeg'], ['run', 'Run my program']] },
        { key: 'ffmpeg', label: 'FFmpeg program', default: 'ffmpeg', help: 'Full path to ffmpeg.exe, or just ffmpeg when it is on the PATH.' },
        { key: 'program', label: 'My program', default: '', help: 'For "Run my program". Full path to an .exe.' },
        { key: 'args', label: 'Arguments', default: '"{path}"', help: '{path} is the recording file, {title} its title, {folder} its folder.' },
      ],
      actions: [{ id: 'last', label: 'Run on the last recording', icon: 'play' }],
    },
    main(nova) {
      const split = s => (String(s).match(/"[^"]*"|\S+/g) || []).map(a => a.replace(/^"|"$/g, ''));
      const run = async rec => {
        if (!rec?.path) { nova.toast(nova.t('No recording file to work on.'), 'warn'); return; }
        const cfg = nova.settings, folder = rec.path.replace(/[\\/][^\\/]*$/, '');
        let file, args;
        if (cfg.mode === 'mp4') {
          file = cfg.ffmpeg || 'ffmpeg';
          args = ['-hide_banner', '-y', '-i', rec.path, '-map', '0:v?', '-map', '0:a?', '-c', 'copy', '-movflags', '+faststart', rec.path.replace(/\.ts$/i, '') + '.mp4'];
        } else {
          if (!cfg.program) { nova.toast(nova.t('Choose the program to run first.'), 'warn'); return; }
          file = cfg.program;
          args = split(cfg.args).map(a => a.replaceAll('{path}', rec.path).replaceAll('{title}', rec.title || '').replaceAll('{folder}', folder));
        }
        nova.status(`${nova.t('Working on')} ${rec.path}`);
        try {
          const r = await nova.exec(file, args);
          nova.log(file, '→', 'exit', r.code);
          nova.status(`${r.code === 0 ? nova.t('Done') : nova.t('Finished with errors')} (${r.code})\n${r.output.slice(-600)}`);
          nova.toast(r.code === 0 ? nova.t('Recording processed') : nova.t('The program reported an error'), r.code === 0 ? 'good' : 'warn');
        } catch (e) { nova.status(e.message); nova.toast(e.message, 'bad'); }
      };
      nova.on('recordingDone', run);
      nova.onAction('last', () => run(nova.recordings()[0]));
    },
  },
];
BUILTIN_PLUGINS.forEach(def => addPlugin({ manifest: readManifest(def.manifest), main: def.main, builtin: true }));
setTimeout(startEnabled, 400);
