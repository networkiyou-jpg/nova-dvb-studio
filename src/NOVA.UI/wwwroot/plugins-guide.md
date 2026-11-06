# NOVA DVB Studio plugins

Put each plugin in its own folder here, with two files:

```
plugins\
  my-plugin\
    plugin.json
    main.js
```

Then open NOVA, Settings, Plugins, and press **Reload plugins**. A plugin is off until you turn it on.
You can also install a `.zip` that holds these files with **Install plugin (.zip)**.

## plugin.json

```json
{
  "id": "my-plugin",
  "name": "My plugin",
  "version": "1.0.0",
  "author": "Me",
  "icon": "plug",
  "description": "What it does, in one or two sentences.",
  "permissions": ["channels", "player"],
  "settings": [
    { "key": "msg", "label": "Message", "default": "Hello", "help": "Shown when you press the button." },
    { "key": "loud", "label": "Loud", "type": "switch", "default": false },
    { "key": "when", "label": "When", "type": "select", "default": "zap", "options": [["zap", "On channel change"], ["never", "Never"]] },
    { "key": "port", "label": "Port", "type": "number", "default": 9000 },
    { "key": "notes", "label": "Notes", "type": "textarea" }
  ],
  "actions": [{ "id": "hello", "label": "Say it", "icon": "play" }]
}
```

`id` uses lower-case letters, digits, dots and dashes. Settings appear under the plugin in Settings
and are saved by NOVA. Actions appear as buttons.

## Permissions

| Permission   | Allows |
|--------------|--------|
| `channels`   | `nova.channels()`, `nova.current()` |
| `player`     | `nova.player.*`: change channel, volume, mute, info bar, record |
| `epg`        | `nova.epg.add()`, `nova.epg.importXmltv()` |
| `http`       | `nova.http.getText()` |
| `recordings` | `nova.recordings()` |
| `server`     | `nova.server.*`: network stream and phone remote (Windows app) |
| `exec`       | `nova.exec()`: run a program on this computer (Windows app) |

NOVA asks before turning on a plugin that wants `server` or `exec`.

## main.js

The file runs when the plugin is turned on, with one object, `nova`:

```js
nova.onAction('hello', () => nova.toast(nova.settings.msg, 'good'));
nova.on('channel', ch => nova.log('Now on', ch.number, ch.name));
nova.on('recordingDone', rec => nova.log('Saved', rec.path));
nova.on('stop', () => nova.log('Turned off'));
```

### Always available

- `nova.id`, `nova.appVersion`, `nova.windowsApp` (false in the browser preview), `nova.language`
- `nova.settings` — current values, defaults filled in. `nova.setSetting(key, value)` saves one.
- `nova.on(event, fn)` — events:
  - `channel` — a channel was chosen: `{ id, name, number, type, sid, tsid, onid, sat, freq, pol }`
  - `recordingDone` — `{ title, path, ch, at, mins, gb }`
  - `remote` — a phone remote command: `{ act, value }`
  - `settings` — the viewer changed a setting: `{ key, value }`
  - `stop` — the plugin is being turned off
- `nova.onAction(id, fn)` — a button from `actions`.
- `nova.every(ms, fn)`, `nova.later(ms, fn)` — timers, cleared when the plugin stops (1 second minimum for `every`).
- `nova.status(text)` — text shown under the plugin in Settings (addresses, results).
- `nova.toast(text, kind)` — `kind` is `good`, `warn` or `bad`.
- `nova.log(...)` — the plugin's activity list in Settings.
- `nova.t(text)` — NOVA's translation of an English text, if it has one.

### With permissions

- `nova.channels()`, `nova.current()`
- `nova.player.state()` → `{ channel, playing, volume, muted, recording, now }`
- `nova.player.tune(channelId)`, `.step(+1 | -1)`, `.volume(0..100)`, `.mute(onOrToggle)`, `.info()`, `.record()`
- `nova.epg.add(channelId, [{ start, end, title, desc }])` — `start` and `end` as dates or milliseconds
- `nova.epg.importXmltv(text)` → `{ chans, progs }`
- `await nova.http.getText(url)` — http and https only
- `nova.recordings()`
- `await nova.exec(file, [args])` → `{ code, output }` — no shell; each argument is passed as is
- `await nova.server.stream(on, port)` → `{ channel: [urls], transponder: [urls] }`
- `await nova.server.remote(on, port, pin)` → `{ urls }`, and `nova.server.remoteState(object)` for what
  the phone page shows

A mistake in a plugin is shown under it in Settings and does not stop NOVA or other plugins.
Plugins run with the same rights as NOVA itself, so install only plugins you trust.

## Built-in plugins

- **Extra guide sources** — XMLTV addresses merged into the guide, refreshed on a schedule.
- **Stream to the network** — `http://<this PC>:8001/live.ts` (channel on screen) and `/transponder.ts`.
- **Phone remote** — open `http://<this PC>:8080/` on a phone on the same network and enter the PIN.
- **After recording** — MP4 copy with FFmpeg, or your own program, when a recording ends.

The installer allows NOVA through Windows Firewall on private networks only. On a network marked
public, Windows blocks the stream and the remote.
