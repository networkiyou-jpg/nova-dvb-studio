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
Third-party licences: LibVLC (LGPL), Lucide icons (ISC), Figtree, Outfit and IBM Plex Sans Arabic fonts (OFL).
