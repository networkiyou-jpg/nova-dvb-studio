# NOVA DVB Studio

Satellite TV for Windows 10 and 11 (64-bit).

| Folder | Contents |
| --- | --- |
| `design/` | Interface source, bundled into `src/NOVA.UI/wwwroot/index.html` by `python3 design/build.py` |
| `src/NOVA.Core` | Tuning model, DiSEqC, LNB, transport stream and service parsing |
| `src/NOVA.DVB` | BDA tuner graph, TBS driver extension, test-only mock tuner |
| `src/NOVA.DVB.Host` | The engine process, so a driver failure cannot freeze the app |
| `src/NOVA.Media` | LibVLC playback |
| `src/NOVA.Database` | SQLite storage |
| `src/NOVA.UI` | Windows app: WPF window hosting the interface in WebView2 |
| `tests/` | Automated tests |
| `installer/` | Inno Setup script |

The GitHub workflow builds, tests and produces `NOVA-DVB-Studio-Setup`. See `docs/first-test-tbs6902.md`.

## Version 0.2.0

- **Info bar** over the picture on every channel change: logo, number and name, clock and date, now and
  next with progress and minutes left, satellite and transponder, SNR and AGC, HD / FHD / 4K, codec,
  aspect and size, audio, subtitle and teletext buttons. In the app it is a transparent window above the
  video window (`OsdWindow.cs`), so it can sit on the native picture.
- **Program guide from the broadcast**: the engine reads EIT while tuned (`SiMonitor`), in the preferred
  language, and keeps it in the database. XMLTV files and addresses (gzip too) also work.
- **Channel logos from the internet**: the picons project (github.com/picons/picons), matched by service
  reference (`SID_TSID_ONID_NAMESPACE`) and then by name, or your own server with an address pattern.
  SVG logos are stored as PNG so the info bar window can draw them.
- **Scheduled recordings** start, stop and repeat by themselves while NOVA is open.
- **Network search**: a scan can read the NIT and add the transponders it lists.
- Teletext, audio track and subtitle switching from the info bar or the keyboard.

Not included: blind scan (needs the TBS SDK), and connecting to card-sharing servers or decoding
scrambled channels. NOVA plays free-to-air channels, and scrambled ones only through an authorized decoder.

Interface tests: `node design/test/features.cjs` (app mode against a fake engine).
Third-party licences: LibVLC (LGPL), Lucide icons (ISC), Figtree, Outfit and IBM Plex Sans Arabic fonts (OFL).
Channel logos downloaded at run time come from the picons project and keep that project's terms.
