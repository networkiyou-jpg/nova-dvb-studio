/* Demo picture source. It stands in for the decoded video surface during the design review.
   All scenes are drawn in code: no broadcast footage, logos or real team marks.
   In the Windows app this canvas is replaced by the LibVLC video surface. */
const Video = (() => {
  const W = 1280, H = 620;
  let cv, ctx, raf = 0, last = 0, t0 = performance.now(), kind = 'sport', cache = {}, players = [], ball = null;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function P(u, v) { /* pitch to screen: u across, v depth */
    const top = 318, y = top + (H - top + 40) * Math.pow(v, 1.35);
    const spread = 0.86 + v * 0.85;
    return [W / 2 + (u - .5) * W * spread, y, .35 + v * .95];
  }
  function stadium() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    let gr = g.createLinearGradient(0, 0, 0, 320);
    gr.addColorStop(0, '#04060f'); gr.addColorStop(.5, '#0a1026'); gr.addColorStop(1, '#141c3c');
    g.fillStyle = gr; g.fillRect(0, 0, W, 330);
    /* stands: three tiers of crowd, densest near the pitch */
    const tiers = [[62, 134, 6400, .55], [150, 298, 15000, .85]];
    const cols = ['#d8dbe8', '#8ea0d0', '#3f58b8', '#c74654', '#e8c9a8', '#a97d5e', '#5c4632', '#2a3a78', '#f2f2f2', '#6d4fc4'];
    tiers.forEach(([a, b, n, alpha]) => {
      g.fillStyle = '#121933'; g.fillRect(0, a, W, b - a);
      for (let i = 0; i < n; i++) {
        const x = Math.random() * W, y = a + Math.random() * (b - a) + Math.pow((x - W / 2) / (W / 2), 2) * -6;
        g.globalAlpha = alpha * rnd(.35, .95); g.fillStyle = cols[i % cols.length];
        const s = 1.2 + (y / 300) * 1.3; g.fillRect(x, y, s, s * 1.4);
      }
    });
    g.globalAlpha = 1;
    /* LED ribbons: the text says what this feed is */
    const led = (y, h, size) => {
      const l = g.createLinearGradient(0, 0, W, 0);
      l.addColorStop(0, '#2333b8'); l.addColorStop(.5, '#3e6be8'); l.addColorStop(1, '#5a2fd0');
      g.fillStyle = l; g.fillRect(0, y, W, h);
      g.fillStyle = 'rgba(255,255,255,.92)'; g.font = `600 ${size}px Outfit, Inter, sans-serif`; g.textBaseline = 'middle';
      for (let x = 12; x < W; x += size * 15) g.fillText('NOVA DEMO FEED', x, y + h / 2 + 1);
    };
    led(134, 16, 11); led(298, 22, 15);
    /* roof line and floodlights */
    g.fillStyle = '#03050c'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 44); g.quadraticCurveTo(W / 2, 74, 0, 44); g.fill();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const x = 12 + i * (W - 24) / 45, y = 44 + 15 * (1 - Math.pow((x - W / 2) / (W / 2), 2)) - 8 + (i % 2) * 5;
      const r = g.createRadialGradient(x, y, 0, x, y, 34);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.09, 'rgba(235,240,255,.9)'); r.addColorStop(.34, 'rgba(160,185,255,.2)'); r.addColorStop(1, 'rgba(120,140,255,0)');
      g.fillStyle = r; g.fillRect(x - 34, y - 34, 68, 68);
    }
    const haze = g.createLinearGradient(0, 40, 0, 330);
    haze.addColorStop(0, 'rgba(130,160,255,.13)'); haze.addColorStop(1, 'rgba(130,160,255,0)');
    g.fillStyle = haze; g.fillRect(0, 40, W, 290);
    g.globalCompositeOperation = 'source-over';
    /* pitch with mowing stripes */
    const stripes = 14;
    for (let i = -8; i < stripes + 8; i++) {
      const a = P(i / stripes, 0), b = P((i + 1) / stripes, 0), d = P((i + 1) / stripes, 1.2), e = P(i / stripes, 1.2);
      const mod = ((i % 2) + 2) % 2;
      const pg = g.createLinearGradient(0, 318, 0, H);
      pg.addColorStop(0, mod ? '#2f7d38' : '#2a7233'); pg.addColorStop(1, mod ? '#3f9a3f' : '#368a39');
      g.fillStyle = pg; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.fill();
    }
    g.strokeStyle = 'rgba(245,250,245,.82)'; g.lineWidth = 2.2; g.lineCap = 'round';
    const poly = pts => { g.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); };
    poly([[-.14, .05], [1.14, .05]]); poly([[-.14, .05], [-.42, 1.1]]); poly([[1.14, .05], [1.46, 1.1]]);
    poly([[.42, .05], [.40, 1.1]]);
    const circ = []; for (let a = 0; a <= 64; a++) { const th = a / 64 * Math.PI * 2; circ.push([.415 + Math.cos(th) * .13, .42 + Math.sin(th) * .24]); }
    poly(circ);
    poly([[.98, .2], [.8, .2], [.82, .74], [1.1, .74]]); poly([[1.03, .3], [.94, .3], [.95, .55], [1.06, .55]]);
    /* goal, far right */
    const gA = P(1.09, .3), gB = P(1.11, .52);
    g.lineWidth = 2.5; g.strokeStyle = '#f4f6fa';
    g.strokeRect(gA[0] - 8, gA[1] - 38, 34, gB[1] - gA[1] + 34);
    g.strokeStyle = 'rgba(255,255,255,.26)'; g.lineWidth = 1;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(gA[0] - 8 + i * 4.2, gA[1] - 38); g.lineTo(gA[0] - 8 + i * 4.2, gB[1] - 4); g.stroke(); }
    /* vignette */
    const v = g.createRadialGradient(W / 2, H * .55, W * .26, W / 2, H * .55, W * .72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,.5)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c;
  }
  function seedPlayers() {
    players = [];
    for (let i = 0; i < 20; i++) {
      players.push({ u: rnd(.1, .95), v: rnd(.12, .9), hu: rnd(.15, .9), hv: rnd(.15, .85), team: i % 2, ph: rnd(0, 6), sp: rnd(.016, .03) });
    }
    ball = { u: .5, v: .5, tu: .6, tv: .4, wait: 0 };
  }
  function sport(dt, now) {
    if (!cache.stadium) { cache.stadium = stadium(); seedPlayers(); }
    ctx.drawImage(cache.stadium, 0, 0);
    ball.wait -= dt;
    if (ball.wait <= 0) { const p = players[Math.floor(Math.random() * players.length)]; ball.tu = p.u; ball.tv = p.v; ball.wait = rnd(.9, 2.2); }
    ball.u += (ball.tu - ball.u) * dt * 1.6; ball.v += (ball.tv - ball.v) * dt * 1.6;
    const draw = [...players.map(p => ({ p, v: p.v })), { b: 1, v: ball.v }].sort((a, b) => a.v - b.v);
    for (const d of draw) {
      if (d.b) { const q = P(ball.u, ball.v); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(q[0], q[1] + 1, 5 * q[2], 2 * q[2], 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1] - 2 * q[2], 3.1 * q[2], 0, 7); ctx.fill(); continue; }
      const p = d.p, near = Math.hypot(ball.u - p.u, ball.v - p.v) < .32;
      const tu = near ? ball.u + Math.sin(p.ph) * .08 : p.hu, tv = near ? ball.v + Math.cos(p.ph) * .08 : p.hv;
      p.u += (tu - p.u) * dt * p.sp * 40; p.v += (tv - p.v) * dt * p.sp * 40;
      const q = P(p.u, p.v), s = q[2], step = Math.sin(now / 130 + p.ph) * 3.2 * s;
      ctx.fillStyle = 'rgba(0,10,0,.34)'; ctx.beginPath(); ctx.ellipse(q[0] + 5 * s, q[1], 10 * s, 3 * s, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 2.9 * s; ctx.lineCap = 'round';
      ctx.strokeStyle = p.team ? '#10172f' : '#f3f4f8';
      ctx.beginPath(); ctx.moveTo(q[0] - 2 * s, q[1] - 12 * s); ctx.lineTo(q[0] - 3 * s + step, q[1]); ctx.moveTo(q[0] + 2 * s, q[1] - 12 * s); ctx.lineTo(q[0] + 3 * s - step, q[1]); ctx.stroke();
      ctx.fillStyle = p.team ? '#2a4bd7' : '#f4f6fb'; ctx.fillRect(q[0] - 5 * s, q[1] - 26 * s, 10 * s, 15 * s);
      ctx.fillStyle = '#c99a78'; ctx.beginPath(); ctx.arc(q[0], q[1] - 30 * s, 4 * s, 0, 7); ctx.fill();
    }
  }
  function studio(now) {
    const g = ctx, gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#081433'); gr.addColorStop(1, '#1b2f6e'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,170,255,.18)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const x = (i * 62 + now / 60) % W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 180, H); g.stroke(); }
    const R = 190, cx = 860, cy = 270;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip(); g.fillStyle = '#0d2558'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.fillStyle = 'rgba(150,200,255,.8)';
    for (let la = -80; la <= 80; la += 8) for (let lo = 0; lo < 360; lo += 8) {
      const a = (lo + now / 90) * Math.PI / 180, b = la * Math.PI / 180, x = Math.cos(b) * Math.sin(a), z = Math.cos(b) * Math.cos(a);
      if (z > 0 && (Math.sin(a * 3 + b * 4) + Math.cos(a * 2 - b * 3)) > .2) g.fillRect(cx + x * R, cy + Math.sin(b) * R, 2.4, 2.4);
    }
    g.restore();
    g.strokeStyle = 'rgba(40,184,255,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R + 8, 0, 7); g.stroke();
    g.fillStyle = 'rgba(8,14,40,.88)'; g.fillRect(0, 462, W, 74);
    g.fillStyle = '#c62838'; g.fillRect(0, 462, 12, 74);
    g.fillStyle = '#fff'; g.font = '600 32px Outfit, Inter, sans-serif'; g.textBaseline = 'middle'; g.fillText('DEMO BULLETIN', 42, 490);
    g.font = '400 18px Figtree, Inter, sans-serif'; g.fillStyle = '#b8c4e6'; g.fillText('Sample picture. No real broadcast is shown.', 42, 518);
    g.fillStyle = '#0a1230'; g.fillRect(0, 536, W, 84);
  }
  function landscape(now, pal) {
    const g = ctx, gr = g.createLinearGradient(0, 0, 0, H);
    pal.sky.forEach((c, i) => gr.addColorStop(i / (pal.sky.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const sx = 860, sy = 300, r = g.createRadialGradient(sx, sy, 0, sx, sy, 330);
    r.addColorStop(0, pal.sun); r.addColorStop(.16, pal.sun); r.addColorStop(.18, pal.sun + '66'); r.addColorStop(1, pal.sun + '00');
    g.fillStyle = r; g.fillRect(0, 0, W, H);
    pal.hills.forEach((c, i) => {
      const off = now / (70 - i * 18), base = 320 + i * 72, amp = 54 - i * 7;
      g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, base + Math.sin((x + off) / (150 - i * 22)) * amp + Math.sin((x + off) / 57) * amp * .3);
      g.lineTo(W, H); g.fill();
    });
    g.fillStyle = '#000'; g.fillRect(0, 0, W, 34); g.fillRect(0, H - 34, W, 34);
  }
  function kids(now) {
    const g = ctx; g.fillStyle = '#ffd05a'; g.fillRect(0, 0, W, H);
    const cs = ['#ff7a59', '#35b8e8', '#7c5cf0', '#39c98a', '#ff5fa2'];
    for (let i = 0; i < 18; i++) {
      const x = (i * 149 + now / (12 + i % 5 * 4)) % (W + 120) - 60, y = 310 + Math.sin(now / 520 + i) * (120 + i * 7);
      g.fillStyle = cs[i % 5]; g.beginPath();
      if (i % 3 === 0) g.arc(x, y, 42, 0, 7); else if (i % 3 === 1) g.rect(x - 34, y - 34, 68, 68); else { g.moveTo(x, y - 44); g.lineTo(x + 42, y + 30); g.lineTo(x - 42, y + 30); }
      g.fill();
    }
  }
  function equalizer(now, c1, c2) {
    const g = ctx, gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#0a0f24'); gr.addColorStop(1, '#141a3e'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const n = 64, bw = W / n, l = g.createLinearGradient(0, H, 0, 140);
    l.addColorStop(0, c1); l.addColorStop(1, c2); g.fillStyle = l;
    for (let i = 0; i < n; i++) {
      const v = .5 + .5 * Math.sin(now / 240 + i * .7) * Math.sin(now / 410 + i * .23);
      const h = 40 + v * 340 * (1 - Math.abs(i - n / 2) / n);
      g.beginPath(); g.roundRect(i * bw + 3, 500 - h, bw - 6, h, 4); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, 500, W, 1);
  }
  const PAL = {
    movie: { sky: ['#1a0d24', '#6b2348', '#e0703a', '#f6c26b'], sun: '#ffe6a8', hills: ['#7a3a2c', '#4f2320', '#2b1216', '#140a0e'] },
    docs: { sky: ['#071a2c', '#14506a', '#3f9d9a', '#bfe6c8'], sun: '#f4fbd8', hills: ['#2f6f66', '#1d5048', '#103630', '#07201c'] },
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!cv || !cv.isConnected || document.hidden) return;
    const dt = Math.min(.1, (now - last) / 1000);
    if (now - last < 38) return;                 /* about 25 fps, like the broadcast */
    last = now;
    if (!S.player.playing || !hasDevice() || S.mode === 'lost') return;
    const tt = now - t0;
    if (kind === 'sport') sport(dt, tt);
    else if (kind === 'news') studio(tt);
    else if (kind === 'movie' || kind === 'docs') landscape(tt, PAL[kind]);
    else if (kind === 'kids') kids(tt);
    else if (kind === 'music') equalizer(tt, '#ff4f9a', '#7c5cf0');
    else equalizer(tt, '#25d9d0', '#28b8ff');
  }
  return {
    attach(el) { cv = el; cv.width = W; cv.height = H; ctx = cv.getContext('2d'); if (!raf) raf = requestAnimationFrame(frame); },
    setKind(k) { kind = k; },
  };
})();

/* Demo audio: filtered noise, so the volume and mute controls act on a real signal.
   It starts only after the viewer unmutes. */
const Audio_ = (() => {
  let ac = null, gain = null;
  function init() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < len; i++) { b = .985 * b + .015 * (Math.random() * 2 - 1); d[i] = b * 3.2; }
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      gain = ac.createGain(); gain.gain.value = 0;
      src.connect(lp).connect(gain).connect(ac.destination); src.start();
    } catch (e) { ac = null; }
  }
  return {
    sync() {
      if (NATIVE) return;                        /* demo sound only: real audio comes from the player */
      const p = S.player, on = !p.muted && p.playing && S.mode === 'live';
      if (on) init();
      if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); gain.gain.setTargetAtTime(on ? p.vol / 100 * .5 : 0, ac.currentTime, .05); }
    },
  };
})();
