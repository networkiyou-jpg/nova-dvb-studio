#!/usr/bin/env python3
"""Bundles the source files into one self-contained page."""
from pathlib import Path
root = Path(__file__).parent
src = root / 'src'
css = (src / 'tokens.css').read_text() + (src / 'app.css').read_text()
js = ''.join((src / f).read_text() + '\n' for f in [
    'icons.js', 'data.js', 'i18n.js', 'i18n-more.js', 'i18n-plugins.js', 'core.js', 'video.js', 'shell.js',
    'screens/tuning.js', 'screens/library.js', 'screens/access.js', 'screens/system.js',
    'epg.js', 'picons-online.js', 'native.js', 'infobar.js', 'plugins.js', 'plugins-builtin.js', 'boot.js'])
WEB_HEAD = '''<title>NOVA DVB Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap">'''
fonts = src / 'fonts.css'
APP_HEAD = '''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOVA DVB Studio</title><style>[hidden]{display:none!important}''' + (fonts.read_text() if fonts.exists() else '') + '''</style></head><body>'''
body = f'''<style>
{css}
</style>
<div class="backdrop" aria-hidden="true"></div>
<div class="app" id="app">
  <header class="top" id="top"></header>
  <div class="body">
    <aside class="card side" id="side" aria-label="Sections"></aside>
    <main class="main" id="main"><div class="view" id="view-live" hidden></div><div id="view-host" hidden></div></main>
  </div>
  <footer class="status" id="status"></footer>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<input type="file" id="file-pick" hidden aria-label="Choose a file">
<script>
{js}
</script>
'''
out = root / 'dist' / 'nova-dvb-studio.html'
out.write_text(WEB_HEAD + '\n' + body)
print(out, len(body) // 1024, 'KB')
app = root.parent / 'src' / 'NOVA.UI' / 'wwwroot' / 'index.html'
if app.parent.exists():
    app.write_text(APP_HEAD + body + '</body></html>')
    print(app)
    # Files the Windows app serves or copies: the phone remote page and the plugin guide.
    (app.parent / 'remote').mkdir(exist_ok=True)
    (app.parent / 'remote' / 'index.html').write_text((src / 'remote.html').read_text(encoding='utf-8'), encoding='utf-8')
    (app.parent / 'plugins-guide.md').write_text((root.parent / 'docs' / 'plugins.md').read_text(encoding='utf-8'), encoding='utf-8')
