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
      blotch(g, w, h, 14, r, 'rgba(60,58,50,0.25)', 30);
      blotch(g, w, h, 8, r, 'rgba(170,168,155,0.2)', 24);
      speckle(g, w, h, 2600, r, ['rgba(40,40,36,0.35)', 'rgba(200,198,185,0.25)', 'rgba(90,88,80,0.4)'], 1, 2);
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
        const cr = 120 + v * 40, cg = 62 + v * 22, cb = 46 + v * 15;
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
      speckle(g, w, h, 1800, r, ['rgba(70,60,45,0.25)', 'rgba(240,230,210,0.2)'], 1, 2);
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
      speckle(g, w, h, 4000, r, ['rgba(20,20,20,0.4)', 'rgba(120,120,115,0.3)', 'rgba(70,70,68,0.5)'], 1, 2);
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
      speckle(g, w, h, 3000, r, ['rgba(40,32,20,0.4)', 'rgba(170,155,120,0.35)', 'rgba(100,90,70,0.5)'], 1, 3);
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
    sky(g, w, h, r) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2f3b46'); gr.addColorStop(0.45, '#6e7577'); gr.addColorStop(0.62, '#b39a76'); gr.addColorStop(0.75, '#8a7f70'); gr.addColorStop(1, '#4a4a46');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { // streaky overcast clouds
        const y = h * (0.15 + r() * 0.45), x = r() * w, cw = 30 + r() * 90;
        g.fillStyle = `rgba(${150 + r() * 60 | 0},${140 + r() * 50 | 0},${130 + r() * 40 | 0},${0.06 + r() * 0.1})`;
        g.fillRect(x, y, cw, 2 + r() * 5); g.fillRect(x - w, y, cw, 2 + r() * 5);
      }
      // distant industrial skyline silhouette
      g.fillStyle = '#3a3936';
      let x = 0; while (x < w) { const bw = 6 + r() * 18, bh = 6 + r() * 26; g.fillRect(x, h * 0.66 - bh, bw, bh + h); if (r() < 0.15) g.fillRect(x + bw / 2 - 1, h * 0.66 - bh - 18, 3, 18); x += bw; }
    }
  };

  function make(name, opts) {
    if (cache[name]) return cache[name];
    const size = (opts && opts.size) || 128;
    const c = canvas(size, (opts && opts.h) || size);
    const g = c.getContext('2d');
    painters[name](g, c.width, c.height, BV.U.rng(name.length * 977 + name.charCodeAt(0) * 31));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    applyFilter(t);
    cache[name] = t; all.push(t);
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
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; cache[key] = t; return t;
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
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; cache[key] = t; return t;
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
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; cache[key] = t; return t;
  }
  function nameTag(text, color) {
    const c = canvas(128, 32), g = c.getContext('2d');
    g.font = 'bold 18px "Chakra Petch", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(text, 64, 16);
    g.fillStyle = color; g.fillText(text, 64, 16);
    const t = new THREE.CanvasTexture(c); t.userData = { noFilter: true }; return t;
  }

  return { make, refreshFilters, glow, smoke, flash, bulletHole, scorch, stencil, sign, emblem, nameTag };
})();
