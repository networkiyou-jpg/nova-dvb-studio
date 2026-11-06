# First test on the TBS6902

Before installing NOVA, install the TBS6902 driver from TBS and confirm that the card appears in
Device Manager under "Sound, video and game controllers". TBS lists Windows 10 for this card, not Windows 11.

## Test in this order

1. Start NOVA. The toast should name your tuner. Otherwise open Settings, DVB Devices.
2. Settings, Satellite Settings: check the LNB values (Universal: 9750, 10600, 11700).
3. Settings, DiSEqC & Motor: choose 1.0, 1.1 or 1.2.
4. Satellite Manager: edit your satellite and set its DiSEqC 1.0 port, DiSEqC 1.1 port and motor position.
5. Check the example transponder against a current list for your satellite. Add one you know is on air.
6. Transponder Scan: scan one transponder first, then the whole satellite. Save the results.
7. Pick a free-to-air channel and watch the signal card.
8. The info bar appears over the picture on every channel change. Press I to show or hide it,
   A for the next audio track, S for subtitles and T for teletext. Its options are in Settings, Info bar.
9. Leave a channel tuned for a minute, then open EPG. Listings come from the broadcast (EIT).
   An XMLTV file or address can be used instead: Settings, EPG.
10. Picons Manager, Download logos. Logos come from the picons project on GitHub. They match by
    service reference first, so scan again once with this version: it stores the network id they need.
11. Recordings, New schedule: set one for two minutes from now and leave NOVA open.

## What to send back

Open the About button (top right) and choose "Open log folder".
Send the newest `engine-*.log` and `app-*.log` files, and note:

- Did the tuner appear, and was it named correctly?
- Did a scan find channels?
- Did the picture and sound play?
- Did the signal values move, and what did they show?
- Did the DiSEqC switch and the motor respond?
- Did the info bar sit over the picture, and did its buttons work?
- Did program names appear in the info bar and the guide?
- How many logos were found, and for which channels were they missing?
- Did the scheduled recording start and stop by itself?
