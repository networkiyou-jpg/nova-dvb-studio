# NOVA DVB Studio: interface design stage

`dist/nova-dvb-studio.html` is the interactive interface, built from `src/` by `python3 build.py`.
`test/e2e.cjs` clicks every control and runs the main flows in Chromium.

This stage has no tuner access, no video decoding and no installer. Channels, signal values, scans and
connection tests are simulated and labelled as such. `src/tokens.css` holds the design tokens for the WPF port.
