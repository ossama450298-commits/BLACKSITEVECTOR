/* =====================================================================
   textures.js — every texture is painted procedurally on a small canvas
   (64–128 px) to match the look of early-2000s PC shooters.
   ===================================================================== */
'use strict';
BV.Textures = (function () {
  const cache = {};
  const all = [];

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function speckle(g, w, h, n, rnd, cols, sMin, sMax) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const s = sMin + rnd() * (sMax - sMin);
      g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), s, s);
    }
  }
  function blotch(g, w, h, n, rnd, col, rMax) {
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * rMax;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function streaks(g, w, h, n, rnd, col) {
    for (let i = 0; i < n; i++) { g.fillStyle = col; const x = rnd() * w; g.fillRect(x, rnd() * h * 0.3, 1 + rnd() * 2, 10 + rnd() * h * 0.6); }
  }

  const painters = {
    concrete(g, w, h, r) {
      g.fillStyle = '#86857d'; g.fillRect(0, 0, w, h);
      const k = BV.classic ? 0.45 : 1;
      blotch(g, w, h, 14, r, `rgba(60,58,50,${0.25 * k})`, 30);
      blotch(g, w, h, 8, r, `rgba(170,168,155,${0.2 * k})`, 24);
      if (BV.classic) { g.fillStyle = 'rgba(40,40,36,0.12)'; for (let y = 32; y < h; y += 32) g.fillRect(0, y, w, 1); } // formwork board lines
      speckle(g, w, h, 1800, r, ['rgba(40,40,36,0.16)', 'rgba(200,198,185,0.12)', 'rgba(90,88,80,0.2)'], 0.5, 1.2);
      g.fillStyle = 'rgba(40,40,36,0.55)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
      g.fillStyle = 'rgba(220,220,210,0.18)'; g.fillRect(0, 2, w, 1);
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(30,30,30,0.4)'; g.beginPath(); g.arc(16 + (i % 2) * 96, 16 + Math.floor(i / 2) * 96, 2, 0, 7); g.fill(); }
    },
    concreteDark(g, w, h, r) { painters.concrete(g, w, h, r); g.fillStyle = 'rgba(25,28,30,0.38)'; g.fillRect(0, 0, w, h); streaks(g, w, h, 10, r, 'rgba(20,20,18,0.25)'); },
    brick(g, w, h, r) {
      g.fillStyle = '#5e5850'; g.fillRect(0, 0, w, h);
      const bw = 32, bh = 16;
      for (let y = 0; y < h / bh; y++) for (let x = -1; x < w / bw + 1; x++) {
        const ox = (y % 2) * bw / 2, v = r();
        const cr = 104 + v * 30, cg = 62 + v * 18, cb = 50 + v * 12;
        g.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
        g.fillRect(x * bw + ox + 1, y * bh + 1, bw - 2, bh - 2);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x * bw + ox + 1, y * bh + bh - 4, bw - 2, 3);
      }
      speckle(g, w, h, 1400, r, ['rgba(0,0,0,0.25)', 'rgba(255,220,200,0.12)'], 1, 2);
      blotch(g, w, h, 6, r, 'rgba(30,25,20,0.3)', 28);
    },
    plaster(g, w, h, r) {
      g.fillStyle = '#ad9f84'; g.fillRect(0, 0, w, h);
      blotch(g, w, h, 18, r, 'rgba(120,100,70,0.22)', 34);
      speckle(g, w, h, 1400, r, ['rgba(70,60,45,0.14)', 'rgba(240,230,210,0.12)'], 0.5, 1.2);
      streaks(g, w, h, 14, r, 'rgba(70,60,40,0.18)');
      for (let i = 0; i < 3; i++) { // cracks
        g.strokeStyle = 'rgba(60,50,40,0.5)'; g.lineWidth = 1; g.beginPath();
        let x = r() * w, y = r() * h; g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 18; y += r() * 12; g.lineTo(x, y); } g.stroke();
      }
    },
    metal(g, w, h, r) {
      for (let x = 0; x < w; x++) { const s = Math.sin(x / w * Math.PI * 16); const c = 96 + s * 20; g.fillStyle = `rgb(${c * 0.86 | 0},${c * 0.93 | 0},${c * 0.88 | 0})`; g.fillRect(x, 0, 1, h); }
      streaks(g, w, h, 18, r, 'rgba(110,60,30,0.28)');
      speckle(g, w, h, 900, r, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.08)'], 1, 2);
      g.fillStyle = 'rgba(30,30,30,0.6)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    },
    roof(g, w, h, r) { painters.metal(g, w, h, r); g.fillStyle = 'rgba(20,22,24,0.45)'; g.fillRect(0, 0, w, h); },
    crate(g, w, h, r) {
      g.fillStyle = '#87653a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = `rgba(${60 + r() * 30 | 0},${40 + r() * 20 | 0},20,0.35)`; g.fillRect(0, y, w, 1); g.fillStyle = 'rgba(255,220,160,0.08)'; g.fillRect(0, y + 1, w, 1); }
      speckle(g, w, h, 700, r, ['rgba(60,40,20,0.3)', 'rgba(200,160,100,0.2)'], 1, 3);
      g.fillStyle = '#5b4224'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12); g.fillRect(0, 0, 12, h); g.fillRect(w - 12, 0, 12, h);
      g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4); g.fillRect(-w * 0.7, -6, w * 1.4, 12); g.restore();
      g.fillStyle = 'rgba(30,30,30,0.7)'; [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]].forEach(p => { g.beginPath(); g.arc(p[0], p[1], 2.5, 0, 7); g.fill(); });
    },
    crateMil(g, w, h, r) {
      g.fillStyle = '#4e583a'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 900, r, ['rgba(0,0,0,0.2)', 'rgba(200,210,160,0.1)'], 1, 2);
      g.strokeStyle = '#353c28'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = 'rgba(225,220,190,0.75)'; g.font = 'bold 22px Impact, Arial Black, sans-serif'; g.textAlign = 'center';
      g.fillText('S-17', w / 2, h / 2 + 2); g.font = 'bold 10px Arial, sans-serif'; g.fillText('HANDLE WITH CARE', w / 2, h / 2 + 18);
      blotch(g, w, h, 4, r, 'rgba(20,20,10,0.25)', 20);
    },
    container(g, w, h, r) {
      for (let x = 0; x < w; x++) { const s = Math.abs(Math.sin(x / w * Math.PI * 10)); const c = 70 + s * 26; g.fillStyle = `rgb(${c * 0.55 | 0},${c * 0.95 | 0},${c * 0.9 | 0})`; g.fillRect(x, 0, 1, h); }
      streaks(g, w, h, 20, r, 'rgba(120,70,40,0.3)');
      g.fillStyle = 'rgba(230,230,220,0.7)'; g.font = 'bold 18px Impact, Arial Black, sans-serif'; g.fillText('VTX', 10, 30);
      g.font = '9px Arial'; g.fillText('MGW 30480 KG', 10, 44);
      g.fillStyle = 'rgba(20,20,20,0.6)'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    },
    asphalt(g, w, h, r) {
      g.fillStyle = '#414140'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 3000, r, ['rgba(20,20,20,0.22)', 'rgba(120,120,115,0.16)', 'rgba(70,70,68,0.25)'], 0.5, 1.2);
      blotch(g, w, h, 8, r, 'rgba(15,15,15,0.3)', 30);
      g.strokeStyle = 'rgba(15,15,15,0.55)'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
    },
    tile(g, w, h, r) {
      g.fillStyle = '#3a3b37'; g.fillRect(0, 0, w, h);
      const t = 32;
      for (let y = 0; y < h / t; y++) for (let x = 0; x < w / t; x++) {
        const v = 110 + r() * 25 - ((x + y) % 2) * 14;
        g.fillStyle = `rgb(${v | 0},${v * 1.02 | 0},${v * 0.94 | 0})`; g.fillRect(x * t + 1, y * t + 1, t - 2, t - 2);
      }
      speckle(g, w, h, 1500, r, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.06)'], 1, 2);
      blotch(g, w, h, 6, r, 'rgba(40,35,25,0.3)', 26);
    },
    dirt(g, w, h, r) {
      g.fillStyle = '#76684d'; g.fillRect(0, 0, w, h);
      blotch(g, w, h, 16, r, 'rgba(60,48,30,0.35)', 30);
      blotch(g, w, h, 10, r, 'rgba(150,135,100,0.25)', 24);
      speckle(g, w, h, 2400, r, ['rgba(40,32,20,0.25)', 'rgba(170,155,120,0.2)', 'rgba(100,90,70,0.3)'], 0.6, 2);
    },
    hazard(g, w, h) {
      g.fillStyle = '#d5a72a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d1d1b';
      for (let i = -h; i < w + h; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - h, h); g.lineTo(i - h, h); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 0, w, 3);
    },
    window(g, w, h, r) {
      g.fillStyle = '#2d2f2c'; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#4b5b63'); gr.addColorStop(0.5, '#222c31'); gr.addColorStop(1, '#3a464c');
      g.fillStyle = gr; g.fillRect(8, 8, w / 2 - 12, h - 16); g.fillRect(w / 2 + 4, 8, w / 2 - 12, h - 16);
      g.fillStyle = 'rgba(220,235,240,0.15)'; g.fillRect(12, 12, 6, h - 24);
      if (r() < 0.5) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.moveTo(w / 2 + 10, 20); g.lineTo(w - 20, 50); g.lineTo(w / 2 + 30, 70); g.fill(); }
    },
    door(g, w, h, r) {
      g.fillStyle = '#4c5248'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2c302a'; g.lineWidth = 6; g.strokeRect(10, 8, w - 20, h - 12);
      g.fillStyle = '#9a9a90'; g.fillRect(w - 26, h / 2, 10, 4);
      streaks(g, w, h, 10, r, 'rgba(110,60,30,0.3)');
    },
    car(g, w, h, r) { g.fillStyle = '#6a2b24'; g.fillRect(0, 0, w, h); blotch(g, w, h, 8, r, 'rgba(255,200,180,0.12)', 30); speckle(g, w, h, 400, r, ['rgba(0,0,0,0.25)'], 1, 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 10, w, 10); },
    car2(g, w, h, r) { g.fillStyle = '#4a5e6e'; g.fillRect(0, 0, w, h); blotch(g, w, h, 8, r, 'rgba(255,255,255,0.12)', 30); speckle(g, w, h, 400, r, ['rgba(0,0,0,0.25)'], 1, 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 10, w, 10); },
    glass(g, w, h) { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#59666b'); gr.addColorStop(1, '#1f2629'); g.fillStyle = gr; g.fillRect(0, 0, w, h); },
    trim(g, w, h, r) { g.fillStyle = '#383a36'; g.fillRect(0, 0, w, h); speckle(g, w, h, 500, r, ['rgba(0,0,0,0.3)', 'rgba(255,255,255,0.06)'], 1, 2); },
    /* diamond tread plate: regular raised lenses, worn tops */
    plate(g, w, h, r) {
      g.fillStyle = '#6c6f6b'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
        for (const [ox, oy, a] of [[4, 4, 0.785], [12, 12, -0.785]]) {
          g.save(); g.translate(x + ox, y + oy); g.rotate(a);
          g.fillStyle = '#3e403d'; g.fillRect(-4.5, -1.2, 9, 2.6);
          g.fillStyle = '#9a9d98'; g.fillRect(-4.5, -1.6, 9, 1.2); g.restore();
        }
      }
      for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(90,50,20,0.18)'; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 14, 3 + r() * 8, r() * 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    },
    /* painted lower wall band (wainscot): olive paint, darker top stripe, scuffs and chips */
    paintLow(g, w, h, r) {
      g.fillStyle = '#4c5640'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2d3327'; g.fillRect(0, 0, w, 10);
      g.fillStyle = 'rgba(255,255,230,0.08)'; g.fillRect(0, 10, w, 2);
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(150,145,130,0.65)'; g.beginPath(); const x = r() * w, y = 20 + r() * (h - 30); g.moveTo(x, y); for (let k = 0; k < 6; k++) g.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 9); g.fill(); }
      for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(20,20,15,0.35)'; g.lineWidth = 1; g.beginPath(); const x = r() * w, y = h - r() * 40; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 22, y + (r() - 0.5) * 4); g.stroke(); } // boot scuffs
      const gr = g.createLinearGradient(0, h, 0, h - 30); gr.addColorStop(0, 'rgba(30,25,15,0.45)'); gr.addColorStop(1, 'rgba(30,25,15,0)'); g.fillStyle = gr; g.fillRect(0, h - 30, w, 30);
    },
    roadLine(g, w, h, r) {
      g.fillStyle = '#d7cc9a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(60,60,58,0.85)'; g.fillRect(r() * w, r() * h, 2 + r() * 8, 2 + r() * 4); }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, h);
    },
    siteLine(g, w, h, r) {
      g.fillStyle = '#c9a02e'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(70,65,55,0.85)'; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 3); }
    },
    manhole(g, w, h, r) {
      g.fillStyle = '#414140'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b2b2a'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, 7); g.fill();
      g.fillStyle = '#4a4b49'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, 7); g.fill();
      g.strokeStyle = '#2f302e'; g.lineWidth = 3;
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(w / 2 - w * 0.36, h / 2 + k * 10); g.lineTo(w / 2 + w * 0.36, h / 2 + k * 10); g.stroke(); }
      g.fillStyle = '#5a5b58'; g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillText('S-17', w / 2, h / 2 + 4);
      g.fillStyle = 'rgba(100,60,30,0.3)'; g.beginPath(); g.arc(w * 0.4, h * 0.6, 18, 0, 7); g.fill();
    },
    drain(g, w, h, r) {
      g.fillStyle = '#3c3d3b'; g.fillRect(0, 0, w, h);
      for (let x = 10; x < w - 6; x += 12) { g.fillStyle = '#0e0e0e'; g.fillRect(x, 10, 6, h - 20); }
      g.strokeStyle = '#575854'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    },
    stain(g, w, h, r) {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        const x = w / 2 + (r() - 0.5) * w * 0.5, y = h / 2 + (r() - 0.5) * h * 0.5, rad = w * (0.12 + r() * 0.22);
        const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(18,15,10,0.22)'); gr.addColorStop(1, 'rgba(18,15,10,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    },
    sky(g, w, h, r) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2f3b46'); gr.addColorStop(0.45, '#6e7577'); gr.addColorStop(0.62, '#b39a76'); gr.addColorStop(0.75, '#8a7f70'); gr.addColorStop(1, '#4a4a46');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { // streaky overcast clouds
        const y = h * (0.15 + r() * 0.45), x = r() * w, cw = 30 + r() * 90;
        g.fillStyle = `rgba(${150 + r() * 60 | 0},${140 + r() * 50 | 0},${130 + r() * 40 | 0},${0.06 + r() * 0.1})`;
        g.fillRect(x, y, cw, 2 + r() * 5); g.fillRect(x - w, y, cw, 2 + r() * 5);
      }
      // low dusk sun (matches the shadow-casting light direction)
      [w * 0.926, w * 0.926 - w].forEach(sx => {
        const sy = h * 0.39;
        let gr = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.55);
        gr.addColorStop(0, 'rgba(255,214,150,0.75)'); gr.addColorStop(0.25, 'rgba(240,170,100,0.3)'); gr.addColorStop(1, 'rgba(240,170,100,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        gr = g.createRadialGradient(sx, sy, 0, sx, sy, 7); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
        g.fillStyle = gr; g.fillRect(sx - 8, sy - 8, 16, 16);
      });
      // distant industrial skyline silhouette
      g.fillStyle = '#3a3936';
      let x = 0; while (x < w) { const bw = 6 + r() * 18, bh = 6 + r() * 26; g.fillRect(x, h * 0.66 - bh, bw, bh + h); if (r() < 0.15) g.fillRect(x + bw / 2 - 1, h * 0.66 - bh - 18, 3, 18); x += bw; }
    }
  };

  /* Paint at a logical 128 px layout on a 2x canvas (256 px) for crisper
     detail, add per-pixel grain, then derive a normal map from luminance. */
  // world surfaces are painted at 4x (512 px) for HIGH/ULTRA, 2x otherwise
  // classic style: small painted textures (128 px, era-appropriate); modern: 256–512 px
  const SCALE = BV.classic ? 1 : (BV.settings.quality === 'high' || BV.settings.quality === 'ultra') ? 4 : 2;
  const imgData = {};
  /* ---------- photo-sourced surfaces (ambientCG, CC0) ----------
     Loaded from data URIs in js/tex_data.js, then lightly weathered with the
     same procedural layers so they match the rest of the level. */
  const pending = [];
  /* ---------- retro finish (Classic style) ----------
     Style rules measured from period texture sets (aggregate statistics only):
     ≤256 px, 8-bit palettes, mid luminance, moderate internal contrast, low and
     warm saturation. Each material is pulled toward its category's values and
     then reduced to its own 256-colour palette without dithering. */
  const RETRO = {   // [luminance, contrast (luma std-dev), saturation]
    concrete: [0.40, 0.090, 0.06], concreteDark: [0.30, 0.080, 0.05], brick: [0.42, 0.130, 0.18], brick2: [0.40, 0.130, 0.17],
    plaster: [0.46, 0.107, 0.16], metal: [0.36, 0.150, 0.16], roof: [0.28, 0.120, 0.10], container: [0.32, 0.140, 0.22],
    crate: [0.30, 0.113, 0.17], crateMil: [0.30, 0.110, 0.16], tile: [0.42, 0.118, 0.08], plate: [0.38, 0.140, 0.06],
    asphalt: [0.26, 0.100, 0.03], asphaltCracked: [0.28, 0.100, 0.04], sand: [0.52, 0.120, 0.20], adobe: [0.50, 0.115, 0.22], officewall: [0.62, 0.050, 0.08], carpet: [0.30, 0.070, 0.10], ceiling: [0.62, 0.060, 0.03], officetile: [0.50, 0.090, 0.04], dirt: [0.38, 0.120, 0.18], door: [0.28, 0.136, 0.20], paintLow: [0.34, 0.110, 0.18]
  };
  const TEXEL_PER_M = 64;
  function texPx(name) {        // power-of-two size giving ~64 texels per metre (128..256)
    const sc = (BV.TEX_SCALE && BV.TEX_SCALE[name]) || 2;
    return Math.max(128, Math.min(256, Math.pow(2, Math.round(Math.log2(sc * TEXEL_PER_M)))));
  }
  function retroFinish(g, w, h, name) {
    const id = g.getImageData(0, 0, w, h), d = id.data, n = d.length / 4;
    const tgt = RETRO[name];
    if (tgt) {
      let sl = 0, sl2 = 0, ss = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
        sl += l; sl2 += l * l; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); ss += mx - mn;
      }
      const mean = sl / n, sd = Math.sqrt(Math.max(1e-6, sl2 / n - mean * mean)), chroma = ss / n;
      const mT = mean + (tgt[0] - mean) * 0.6, sdT = sd + (tgt[1] - sd) * 0.75;
      const gain = BV.U.clamp(sdT / sd, 0.6, 2.4);
      const satK = BV.U.clamp((chroma + (tgt[2] * 0.75 - chroma) * 0.6) / Math.max(0.01, chroma), 0.4, 1.6);
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
        const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b, l2 = mT + (l - mean) * gain;
        r = l2 + (r - l) * satK; gg = l2 + (gg - l) * satK; b = l2 + (b - l) * satK;
        d[i] = BV.U.clamp(r * 255, 0, 255); d[i + 1] = BV.U.clamp(gg * 255, 0, 255); d[i + 2] = BV.U.clamp(b * 255, 0, 255);
      }
    }
    // 8-bit palette: popularity on a 5-bit cube, then nearest-colour lookup (no dithering)
    const hist = new Uint32Array(32768);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3)]++;
    const bins = []; for (let k = 0; k < 32768; k++) if (hist[k]) bins.push(k);
    bins.sort((a, b) => hist[b] - hist[a]);
    const pal = bins.slice(0, 256).map(k => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4]);
    const lut = new Int16Array(32768).fill(-1);
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
      let p = lut[k];
      if (p < 0) {
        let best = 1e9; const r = ((k >> 10) & 31) * 8 + 4, gg = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4;
        for (let j = 0; j < pal.length; j++) { const dr = r - pal[j][0], dg = gg - pal[j][1], db = b - pal[j][2], e = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (e < best) { best = e; p = j; } }
        lut[k] = p;
      }
      d[i] = pal[p][0]; d[i + 1] = pal[p][1]; d[i + 2] = pal[p][2];
    }
    g.putImageData(id, 0, 0);
  }
  const PHOTO_MIX = { concrete: 0.85, concreteDark: 0.85, plaster: 0.8, tile: 0.35, plate: 0.25, asphalt: 0.9, crate: 0.6 };
  const PHOTO_DIRECT = { brick: 1, brick2: 1, asphaltCracked: 1, sand: 1, adobe: 1, carpet: 1, ceiling: 1, officetile: 1, officewall: 1 };   // photo used as-is (+ light weathering)
  const CLEAN = { officewall: 1, carpet: 1, ceiling: 1, officetile: 1 };   // indoor office surfaces: photo only, no weathering
  function photoTex(name, kind) {
    const key = 'photo_' + name + kind; if (cache[key]) return cache[key];
    const D = BV.TEX_DATA && BV.TEX_DATA[name === 'officewall' ? 'plaster' : name]; if (!D || !D[kind]) return null;   // office walls: the plaster photo, clean
    const px = kind === 'color' ? (BV.classic ? texPx(name) : 512) : 256, k4 = px / 128;
    const c = canvas(px), g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = kind === 'normal' ? 'rgb(128,128,255)' : '#777'; g.fillRect(0, 0, c.width, c.height);
    if (kind === 'color' && painters[name] && !PHOTO_DIRECT[name]) {   // designed base layer (panels, seams, grime)...
      g.save(); g.scale(k4, k4); painters[name](g, 128, 128, BV.U.rng(name.length * 977 + name.charCodeAt(0) * 31)); g.restore();
      weather(g, px, px, name, k4);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (kind === 'color') t.encoding = THREE.sRGBEncoding;
    applyFilter(t); cache[key] = t; all.push(t);
    const img = new Image();
    pending.push(new Promise((res) => {
      img.onload = () => {
        if (kind === 'color' && painters[name] && !PHOTO_DIRECT[name]) {
          // ...with the photo blended on top as real-world micro detail
          g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = PHOTO_MIX[name] || 0.7; g.drawImage(img, 0, 0, c.width, c.height); g.restore();
        } else {
          g.drawImage(img, 0, 0, c.width, c.height);
          if (kind === 'color' && !CLEAN[name]) { g.save(); g.globalAlpha = 0.45; weather(g, c.width, c.height, name === 'asphaltCracked' ? 'asphalt' : 'brick', k4); g.restore(); }
        }
        if (kind === 'color' && BV.classic) retroFinish(g, c.width, c.height, name);
        t.needsUpdate = true; res(true);
      };
      img.onerror = () => res(false);
    }));
    img.src = D[kind];
    return t;
  }
  function whenReady() { return Promise.all(pending); }
  function make(name, opts) {
    if (cache[name]) return cache[name];
    const photo = photoTex(name, 'color'); if (photo) { cache[name] = photo; return photo; }
    const _t = performance.now(); try { return make2(name, opts); } finally { BV.timings = BV.timings || {}; BV.timings.tex = (BV.timings.tex || 0) + performance.now() - _t; }
  }
  function make2(name, opts) {
    const L = (opts && opts.size) || 128, LH = (opts && opts.h) || L;
    const sc = name === 'sky' ? 2 : (BV.classic && RETRO[name] ? texPx(name) / 128 : SCALE);
    const c = canvas(L * sc, LH * sc);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.save(); g.scale(sc, sc);
    painters[name](g, L, LH, BV.U.rng(name.length * 977 + name.charCodeAt(0) * 31));
    g.restore();
    if (name !== 'sky') { weather(g, c.width, c.height, name, sc); grain(g, c.width, c.height, name); }
    if (BV.classic && name !== 'sky') retroFinish(g, c.width, c.height, name);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    applyFilter(t);
    cache[name] = t; all.push(t);
    return t;
  }
  /* ---------- full-resolution weathering layers, per material ---------- */
  function crack(g, x, y, len, r, col, wdt) {
    g.strokeStyle = col; g.lineWidth = wdt; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y);
    let a = r() * Math.PI * 2;
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y);
      if (r() < 0.12) { const sx = x, sy = y; g.moveTo(sx, sy); let b = a + (r() - 0.5) * 2; for (let k = 0; k < 4; k++) { b += (r() - 0.5); g.lineTo(sx + Math.cos(b) * 6 * (k + 1), sy + Math.sin(b) * 6 * (k + 1)); } g.moveTo(x, y); }
    }
    g.stroke();
  }
  function stain(g, w, h, r, col, n, rmax) {
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, rad = rmax * (0.3 + r() * 0.7);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(x, y); g.scale(1, 0.5 + r()); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore();
    }
  }
  function drips(g, w, h, r, col, n) {
    for (let i = 0; i < n; i++) {
      const x = r() * w, y0 = r() * h * 0.4, len = h * (0.2 + r() * 0.6);
      const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x, y0, 1 + r() * 3, len);
    }
  }
  function pebbles(g, w, h, r, n, s) {
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, rad = (0.6 + r() * 1.8) * s, v = 70 + r() * 90;
      g.fillStyle = `rgba(${v | 0},${v * 0.96 | 0},${v * 0.9 | 0},0.85)`; g.beginPath(); g.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + rad * 0.3, y + rad * 0.4, rad, rad * 0.5, 0, 0, 7); g.fill();
    }
  }
  function peel(g, w, h, r, under, n, s) {
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h; g.fillStyle = under; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 9; k++) g.lineTo(x + (r() - 0.5) * 26 * s, y + (r() - 0.5) * 18 * s); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = s * 0.7; g.stroke();
    }
  }
  function weather(g, w, h, name, s) {
    const r = BV.U.rng(name.length * 389 + 17);
    switch (name) {
      case 'concrete': case 'concreteDark':
        stain(g, w, h, r, 'rgba(40,38,30,0.18)', 8, w * 0.22);           // damp patches
        stain(g, w, h, r, 'rgba(210,205,190,0.10)', 6, w * 0.18);        // dry dust
        for (let i = 0; i < 4; i++) crack(g, r() * w, r() * h, 10 + r() * 16, r, 'rgba(25,24,20,0.28)', 0.5 * s);
        pebbles(g, w, h, r, 90, s * 0.6);
        drips(g, w, h, r, 'rgba(30,28,22,0.18)', 10);
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(30,30,28,0.35)'; g.beginPath(); g.arc(r() * w, r() * h, (0.5 + r()) * s, 0, 7); g.fill(); } // air pockets
        break;
      case 'brick':
        drips(g, w, h, r, 'rgba(240,235,220,0.10)', 14);                  // efflorescence
        stain(g, w, h, r, 'rgba(20,15,10,0.22)', 6, w * 0.2);
        for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(60,40,30,0.5)'; const x = r() * w, y = r() * h; g.fillRect(x, y, (2 + r() * 6) * s, (1 + r() * 2) * s); } // chips
        break;
      case 'plaster':
        peel(g, w, h, r, 'rgba(120,110,95,0.55)', 6, s);
        drips(g, w, h, r, 'rgba(70,58,40,0.22)', 18);
        for (let i = 0; i < 3; i++) crack(g, r() * w, r() * h, 12, r, 'rgba(50,40,30,0.6)', 0.5 * s);
        break;
      case 'metal': case 'roof': case 'container': case 'door':
        drips(g, w, h, r, 'rgba(120,60,25,0.32)', name === 'container' ? 26 : 16);   // rust streaks
        stain(g, w, h, r, 'rgba(110,55,22,0.28)', 7, w * 0.08);
        peel(g, w, h, r, 'rgba(95,90,82,0.55)', name === 'roof' ? 3 : 7, s * 0.6);     // chipped paint -> bare metal
        for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(210,210,200,0.10)'; g.lineWidth = 0.4 * s; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30 * s, y + (r() - 0.5) * 6 * s); g.stroke(); } // scratches
        for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(40,40,38,0.8)'; const x = r() * w, y = r() * h; g.beginPath(); g.arc(x, y, 1.2 * s, 0, 7); g.fill(); g.fillStyle = 'rgba(200,200,190,0.25)'; g.beginPath(); g.arc(x - 0.4 * s, y - 0.4 * s, 0.6 * s, 0, 7); g.fill(); } // rivets
        break;
      case 'asphalt':
        pebbles(g, w, h, r, 260, s * 0.45);
        stain(g, w, h, r, 'rgba(8,8,10,0.45)', 5, w * 0.12);                          // oil
        for (let i = 0; i < 3; i++) crack(g, r() * w, r() * h, 18, r, 'rgba(10,10,10,0.7)', 0.8 * s);
        g.fillStyle = 'rgba(15,15,15,0.12)'; for (let t = 0; t < 2; t++) { const x = r() * w; g.fillRect(x, 0, 9 * s, h); g.fillRect(x + 22 * s, 0, 9 * s, h); } // tyre marks
        stain(g, w, h, r, 'rgba(180,170,150,0.08)', 6, w * 0.25);                     // dust
        break;
      case 'dirt':
        pebbles(g, w, h, r, 220, s * 0.8);
        stain(g, w, h, r, 'rgba(50,40,25,0.25)', 10, w * 0.15);
        stain(g, w, h, r, 'rgba(160,145,110,0.18)', 8, w * 0.2);
        for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(40,32,22,0.25)'; g.lineWidth = 6 * s; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 20, w * 0.6, y - 20, w, y + (r() - 0.5) * 30); g.stroke(); } // ruts
        break;
      case 'tile':
        stain(g, w, h, r, 'rgba(30,28,20,0.3)', 8, w * 0.12);
        for (let i = 0; i < 5; i++) crack(g, r() * w, r() * h, 6, r, 'rgba(20,20,20,0.6)', 0.5 * s);
        break;
      case 'crate': case 'crateMil':
        for (let i = 0; i < 24; i++) { g.fillStyle = 'rgba(30,20,10,0.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, (2 + r() * 3) * s, (0.8 + r()) * s, 0, 0, 7); g.fill(); } // knots / dents
        drips(g, w, h, r, 'rgba(30,25,15,0.2)', 8);
        for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(230,210,170,0.15)'; g.lineWidth = 0.5 * s; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 20 * s, y + (r() - 0.5) * 4 * s); g.stroke(); }
        break;
    }
  }
  /* roughness map: base roughness modulated by local luminance (dirt rougher, polish smoother) */
  function roughness(name, base, k) {
    const key = 'r_' + name; if (cache[key]) return cache[key];
    const pr = photoTex(name, 'rough'); if (pr) { cache[key] = pr; return pr; }
    make(name); const src = imgData[name]; if (!src) return null;
    const { d, w, h } = src;
    const c = canvas(w, h), g = c.getContext('2d'), out = g.createImageData(w, h), o = out.data;
    for (let i = 0; i < w * h; i++) {
      const l = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
      const v = Math.max(0, Math.min(1, base + (0.5 - l) * k)) * 255;
      o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v; o[i * 4 + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; applyFilter(t); cache[key] = t; all.push(t);
    return t;
  }
  function grain(g, w, h, name) {
    const id = g.getImageData(0, 0, w, h), d = id.data, r = BV.U.rng(name.length * 131 + 7);
    const amp = BV.classic ? 9 : (name === 'metal' || name === 'roof' || name === 'container' ? 5 : 7);
    const desat = BV.classic ? 0.18 : 0;  // muted era palette
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * amp;
      let R = d[i] + n, G = d[i + 1] + n, B = d[i + 2] + n;
      if (desat) { const l = R * 0.3 + G * 0.59 + B * 0.11; R += (l - R) * desat; G += (l - G) * desat; B += (l - B) * desat; }
      d[i] = R; d[i + 1] = G; d[i + 2] = B;
    }
    g.putImageData(id, 0, 0);
    imgData[name] = { d: id.data, w, h };
  }
  /* normal map from the colour texture's luminance (Sobel) */
  function normal(name, strength) {
    const key = 'n_' + name;
    if (cache[key]) return cache[key];
    const pn = photoTex(name, 'normal'); if (pn) { cache[key] = pn; return pn; }
    const _t = performance.now(); try { return normal2(name, strength, key); } finally { BV.timings.texN = (BV.timings.texN || 0) + performance.now() - _t; }
  }
  function normal2(name, strength, key) {
    make(name);
    const src = imgData[name]; if (!src) return null;
    const { d, w, h } = src, k = strength || 2;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
    const c = canvas(w, h), g = c.getContext('2d'), out = g.createImageData(w, h), o = out.data;
    const L = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1));
      const dy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1));
      let nx = -dx * k, ny = dy * k, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4; o[i] = (nx * 0.5 + 0.5) * 255; o[i + 1] = (ny * 0.5 + 0.5) * 255; o[i + 2] = (nz * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    applyFilter(t); cache[key] = t; all.push(t);
    return t;
  }
  function applyFilter(t) {
    if (t.userData && t.userData.noFilter) return;
    t.magFilter = BV.settings.retroFilter ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = BV.settings.retroFilter ? THREE.NearestMipmapNearestFilter : THREE.LinearMipmapLinearFilter;
    t.anisotropy = 2;
    t.needsUpdate = true;
  }
  function refreshFilters() { all.forEach(applyFilter); }

  /* ---------- sprites / decals ---------- */
  function radial(name, stops, size) {
    if (cache[name]) return cache[name];
    const c = canvas(size || 64), g = c.getContext('2d'), s = c.width / 2;
    const gr = g.createRadialGradient(s, s, 0, s, s, s);
    stops.forEach(st => gr.addColorStop(st[0], st[1]));
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.width);
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; cache[name] = t; return t;
  }
  function glow() { return radial('glow', [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); }
  function smoke() {
    if (cache.smoke) return cache.smoke;
    const c = canvas(64), g = c.getContext('2d'), r = BV.U.rng(7);
    for (let i = 0; i < 14; i++) {
      const x = 16 + r() * 32, y = 16 + r() * 32, rad = 8 + r() * 16;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; cache.smoke = t; return t;
  }
  function flash() {
    if (cache.flash) return cache.flash;
    const c = canvas(64), g = c.getContext('2d');
    g.translate(32, 32);
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3 + (i % 2) * 0.2);
      const gr = g.createLinearGradient(0, 0, 30, 0); gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -4); g.lineTo(30 - (i % 2) * 10, 0); g.lineTo(0, 4); g.fill();
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 14); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(1, 'rgba(255,180,60,0)');
    g.fillStyle = gr; g.fillRect(-14, -14, 28, 28);
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; cache.flash = t; return t;
  }
  function bulletHole() {
    return radial('hole', [[0, 'rgba(10,10,10,1)'], [0.3, 'rgba(25,22,20,0.95)'], [0.5, 'rgba(60,55,50,0.5)'], [1, 'rgba(60,55,50,0)']], 32);
  }
  function scorch() { return radial('scorch', [[0, 'rgba(5,5,5,0.9)'], [0.6, 'rgba(20,18,15,0.5)'], [1, 'rgba(20,18,15,0)']], 64); }
  /* painted letters / logos on transparent canvas */
  function stencil(text, color, size, font) {
    const key = 'st_' + text + color + size;
    if (cache[key]) return cache[key];
    const c = canvas(size || 128), g = c.getContext('2d');
    g.fillStyle = color; g.font = (font || 'bold ' + Math.floor(c.width * 0.8) + 'px Impact, "Arial Black", sans-serif');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 4);
    // weathering: erase random flecks
    g.globalCompositeOperation = 'destination-out';
    const r = BV.U.rng(text.length * 13 + 5);
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(0,0,0,' + (0.3 + r() * 0.7) + ')'; g.fillRect(r() * c.width, r() * c.height, 1 + r() * 3, 1 + r() * 3); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.userData = { noFilter: true }; cache[key] = t; return t;
  }
  function sign(lines, bg, fg, w, h) {
    const key = 'sign_' + lines.join('|');
    if (cache[key]) return cache[key];
    const c = canvas(w || 256, h || 64), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(5, 5, c.width - 10, c.height - 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = (c.height - 10) / lines.length;
    lines.forEach((l, i) => { g.font = (i === 0 ? 'bold ' : '') + Math.floor(lh * 0.62) + 'px Impact, "Arial Black", sans-serif'; g.fillText(l, c.width / 2, 5 + lh * (i + 0.5)); });
    const r = BV.U.rng(lines[0].length * 7);
    for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,' + r() * 0.35 + ')'; g.fillRect(r() * c.width, r() * c.height, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.userData = { noFilter: true }; cache[key] = t; return t;
  }
  /* team emblems drawn with simple geometric shapes */
  function emblem(team) {
    const key = 'emb_' + team; if (cache[key]) return cache[key];
    const c = canvas(128), g = c.getContext('2d');
    if (team === 'VANGUARD') {
      g.fillStyle = 'rgba(224,180,60,0.85)';
      for (let i = 0; i < 3; i++) { g.beginPath(); const y = 30 + i * 24; g.moveTo(20, y + 18); g.lineTo(64, y - 6); g.lineTo(108, y + 18); g.lineTo(108, y + 30); g.lineTo(64, y + 6); g.lineTo(20, y + 30); g.fill(); }
    } else {
      g.fillStyle = 'rgba(200,60,40,0.85)';
      g.beginPath(); g.moveTo(64, 14); g.lineTo(116, 70); g.lineTo(84, 64); g.lineTo(64, 114); g.lineTo(44, 64); g.lineTo(12, 70); g.fill();
      g.fillStyle = 'rgba(20,20,20,0.9)'; g.beginPath(); g.arc(64, 56, 7, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    const r = BV.U.rng(team.length * 3);
    for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(0,0,0,' + r() + ')'; g.fillRect(r() * 128, r() * 128, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.userData = { noFilter: true }; cache[key] = t; return t;
  }
  function nameTag(text, color) {
    const c = canvas(128, 32), g = c.getContext('2d');
    g.font = 'bold 18px "Chakra Petch", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(text, 64, 16);
    g.fillStyle = color; g.fillText(text, 64, 16);
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; return t;
  }

  return { make, normal, roughness, whenReady, refreshFilters, glow, smoke, flash, bulletHole, scorch, stencil, sign, emblem, nameTag };
})();
