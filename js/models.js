/* =====================================================================
   models.js — procedural models: weapons (first & third person) and the
   two factions' soldiers. Soldiers use tapered limbs, rounded torsos,
   textured fabric camouflage, painted faces, helmets/hoods and load-bearing
   gear; weapons use worn-metal PBR materials that pick up the environment.
   ===================================================================== */
'use strict';
BV.Models = (function () {
  const matCache = {};
  /* ---------- procedural textures for gear ---------- */
  const texCache = {};
  function ctex(key, w, h, paint) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    paint(g, w, h, BV.U.rng(key.length * 53 + 11));
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    texCache[key] = t; return t;
  }
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  function shadeHex(n, k) { const r = Math.min(255, ((n >> 16) & 255) * k), g = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k); return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function fabric(base, pattern) {
    return ctex('fab_' + base + pattern, 128, 128, (g, w, h, r) => {
      g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      if (pattern === 'digital') {          // urban pixel camouflage
        const cols = [shadeHex(base, 0.7), shadeHex(base, 1.12), 'rgb(70,74,66)'];
        for (let i = 0; i < 260; i++) { g.fillStyle = cols[i % 3]; const s = 4 + Math.floor(r() * 3) * 4; g.fillRect(Math.floor(r() * 32) * 4, Math.floor(r() * 32) * 4, s, s * (r() < 0.5 ? 1 : 2)); }
      } else if (pattern === 'blot') {      // dark woodland blotches
        const cols = [shadeHex(base, 0.6), shadeHex(base, 1.3), 'rgb(58,48,36)'];
        for (let i = 0; i < 26; i++) {
          g.fillStyle = cols[i % 3]; g.beginPath(); const x = r() * w, y = r() * h;
          g.moveTo(x, y); for (let k = 0; k < 7; k++) g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 30); g.fill();
        }
      }
      for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, y, w, 1); }   // weave
      for (let x = 0; x < w; x += 3) { g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(x, 0, 1, h); }
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 2, 2); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h / 2, w, 1);                                  // seam
    });
  }
  function faceTex(skin, kind) {
    return ctex('face_' + skin + kind, 256, 128, (g, w, h, r) => {
      const fx = w * 0.75; // front of a THREE.SphereGeometry faces -Z at u = 0.75
      if (kind === 'mask') {
        g.fillStyle = '#1c1c1d'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 1); }
        g.fillStyle = hex(skin); g.fillRect(fx - 26, h * 0.4, 52, h * 0.11);         // eye slot
        g.fillStyle = '#1a1210'; g.fillRect(fx - 20, h * 0.43, 12, 5); g.fillRect(fx + 8, h * 0.43, 12, 5);
        return;
      }
      g.fillStyle = hex(skin); g.fillRect(0, 0, w, h);
      const sh = (a) => `rgba(60,30,20,${a})`;
      g.fillStyle = shadeHex(skin, 0.75); g.fillRect(0, 0, w, h * 0.12);              // hairline / cropped hair
      g.fillStyle = '#2a2018'; g.fillRect(0, 0, w, h * 0.2);
      g.fillStyle = sh(0.35); g.fillRect(fx - 24, h * 0.36, 18, 4); g.fillRect(fx + 6, h * 0.36, 18, 4);   // brows
      g.fillStyle = '#efe8dc'; g.fillRect(fx - 20, h * 0.42, 12, 6); g.fillRect(fx + 8, h * 0.42, 12, 6);  // eyes
      g.fillStyle = '#2b2620'; g.fillRect(fx - 16, h * 0.42, 5, 6); g.fillRect(fx + 12, h * 0.42, 5, 6);
      g.fillStyle = sh(0.3); g.fillRect(fx - 3, h * 0.46, 6, h * 0.14);                // nose shadow
      g.fillStyle = sh(0.45); g.fillRect(fx - 11, h * 0.67, 22, 3);                    // mouth
      g.fillStyle = 'rgba(40,30,25,0.35)'; g.fillRect(fx - 30, h * 0.6, 60, h * 0.25); // stubble
    });
  }
  function wearTex(base) {
    return ctex('wear_' + base, 128, 128, (g, w, h, r) => {
      g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.06})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
      g.strokeStyle = 'rgba(200,200,200,0.16)';
      for (let i = 0; i < 40; i++) { g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 18, y + (r() - 0.5) * 6); g.stroke(); }
    });
  }
  function woodTex() {
    return ctex('wood', 128, 128, (g, w, h, r) => {
      g.fillStyle = '#4a3220'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${20 + r() * 20 | 0},10,4,${0.12 + Math.abs(Math.sin(y * 0.35 + r() * 0.6)) * 0.22})`; g.fillRect(0, y, w, 1); }
      for (let i = 0; i < 10; i++) { g.strokeStyle = 'rgba(20,10,4,0.35)'; g.lineWidth = 1; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + (r() - 0.5) * 8); g.stroke(); }
    });
  }
  function S(o) { return BV.mat(o); }
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache[key]) matCache[key] = S(Object.assign({ color, roughness: 0.7, metalness: 0 }, opts || {}));
    return matCache[key];
  }
  /* ---------- weapon materials ----------
     Every gun material gets an "edge wear" shader patch: a per-vertex wear
     value (bevel/edge vertices score high) blends the surface toward bare,
     polished metal (or a pale scuff on polymer/wood) and lowers roughness.
     A grime texture breaks up colour and a scratch-driven roughness map
     makes highlights uneven. */
  function grimeTex(base, scratch) {
    return ctex('grime_' + base + scratch, 256, 256, (g, w, h, r) => {
      g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rad = 10 + r() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.06})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.07})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
      g.lineCap = 'round';
      for (let i = 0; i < scratch; i++) { g.strokeStyle = `rgba(215,215,210,${0.08 + r() * 0.16})`; g.lineWidth = 0.4 + r() * 0.8; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 10); g.stroke(); }
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(20,16,10,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, 7); g.fill(); } // grease / powder residue
    });
  }
  function stippleNormal() {
    if (texCache.stip) return texCache.stip;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i++) { const x = Math.random() * 128, y = Math.random() * 128; const gr = g.createRadialGradient(x - 0.6, y - 0.6, 0, x, y, 1.8); gr.addColorStop(0, 'rgb(90,90,255)'); gr.addColorStop(0.5, 'rgb(160,160,240)'); gr.addColorStop(1, 'rgba(128,128,255,0)'); g.fillStyle = gr; g.fillRect(x - 2, y - 2, 4, 4); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache.stip = t; return t;
  }
  function scratchRough(base) {
    return ctex('sr_' + base, 256, 256, (g, w, h, r) => {
      const v = Math.round(base * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) { const k = Math.round(Math.max(0, base - 0.3 + r() * 0.2) * 255); g.strokeStyle = `rgb(${k},${k},${k})`; g.lineWidth = 0.6; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 8); g.stroke(); }
      for (let i = 0; i < 60; i++) { const k = Math.round(Math.min(1, base + 0.3) * 255); g.fillStyle = `rgb(${k},${k},${k})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 8, 0, 7); g.fill(); }
    });
  }
  function wearMat(key, o, wear) {
    if (matCache[key]) return matCache[key];
    if (BV.classic && o.keepColor) {
      wear = Object.assign({}, wear, { amt: wear.amt * 0.55, color: new THREE.Color(wear.color).multiplyScalar(0.72).getHex() });
    } else if (BV.classic) {
      // Gouraud/Lambert has no specular: darken metals and keep edge wear subtle, like painted skins
      const metal = (o.metalness || 0) > 0.5;
      o = Object.assign({}, o, { color: metal ? 0x7c7f82 : 0xb4b4b4 });
      wear = Object.assign({}, wear, { amt: wear.amt * (metal ? 0.55 : 0.45), color: new THREE.Color(wear.color).multiplyScalar(0.72).getHex() });
    }
    const { keepColor, ...oo } = o;
    const m = S(oo);
    m.userData.wear = wear;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWearColor = { value: new THREE.Color(wear.color) };
      sh.uniforms.uWearAmt = { value: wear.amt };
      sh.uniforms.uWearMetal = { value: wear.metal };
      sh.vertexShader = 'attribute float wear;\nvarying float vWear;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWear = wear;');
      sh.fragmentShader = 'uniform vec3 uWearColor;\nuniform float uWearAmt;\nuniform float uWearMetal;\nvarying float vWear;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n float wk = clamp(vWear * uWearAmt, 0.0, 1.0);\n diffuseColor.rgb = mix(diffuseColor.rgb, uWearColor, wk);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.22, wk);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 1.0, wk * uWearMetal);');
    };
    m.customProgramCacheKey = () => 'wear-' + key;
    matCache[key] = m; return m;
  }
  const M = {
    // blued steel receiver parts
    dark: () => wearMat('gdark', { map: grimeTex(0x2a2d30, 120), roughnessMap: scratchRough(0.42), roughness: 1, metalness: 0.8 }, { color: 0x9aa0a4, amt: 0.9, metal: 1 }),
    // bare / worn steel: barrels, bolts, pins
    steel: () => wearMat('gsteel', { map: grimeTex(0x6c7175, 200), roughnessMap: scratchRough(0.32), roughness: 1, metalness: 0.95 }, { color: 0xc8ccd0, amt: 0.7, metal: 1 }),
    // polymer furniture with stippled grip texture
    poly: () => wearMat('gpoly', { map: grimeTex(0x202122, 40), normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.72, metalness: 0.02 }, { color: 0x4a4b4c, amt: 0.6, metal: 0 }),
    wood: () => wearMat('gwood', { map: woodTex(), roughness: 0.5, metalness: 0 }, { color: 0x7a5636, amt: 0.5, metal: 0 }),
    olive: () => wearMat('golive', { map: grimeTex(0x4a5034, 80), roughness: 0.62, metalness: 0.15 }, { color: 0x8a8f86, amt: 0.85, metal: 0.8 }),
    bright: () => matCache.gbright || (matCache.gbright = S({ color: BV.classic ? 0x6f7376 : 0xd2d6da, roughness: 0.16, metalness: 1 })),
    tan: () => wearMat('gtan', { map: grimeTex(0x8a7656, 60), normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.74, metalness: 0.04 }, { color: 0xb8a684, amt: 0.6, metal: 0 }),
    alu: () => wearMat('galu', { map: grimeTex(0x3b3e41, 160), roughnessMap: scratchRough(0.38), roughness: 1, metalness: 0.85 }, { color: 0xb0b4b8, amt: 0.9, metal: 1 }),
    rubber: () => matCache.grub || (matCache.grub = S({ color: 0x141414, roughness: 0.95, metalness: 0, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.3, 0.3) })),
    brass: () => matCache.gbrass || (matCache.gbrass = S({ color: 0xc9a14a, roughness: 0.3, metalness: 1 }))
  };
  function box(g, w, h, d, x, y, z, m, rx, ry, rz) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z); if (rx) me.rotation.x = rx; if (ry) me.rotation.y = ry; if (rz) me.rotation.z = rz;
    me.castShadow = true; g.add(me); return me;
  }
  function cyl(g, r, len, x, y, z, m, seg) {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 14), m);
    me.rotation.x = Math.PI / 2; me.position.set(x, y, z); me.castShadow = true; g.add(me); return me;
  }
  /* generic mesh helper for organic parts */
  function part(parent, geo, m, x, y, z, sx, sy, sz) {
    const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0);
    if (sx) me.scale.set(sx, sy || sx, sz || sx); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me;
  }
  // classic style: angular low-poly segment counts (Gouraud-shaded like late-90s models)
  const seg = (n) => BV.classic ? Math.max(5, Math.round(n * 0.55)) : n;
  const geo = {
    cyl: (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, seg(s || 12)),
    sph: (r, ws, hs) => new THREE.SphereGeometry(r, seg(ws || 14), Math.max(4, seg(hs || 10))),
    cap: (r, ts) => new THREE.SphereGeometry(r, seg(16), Math.max(4, seg(10)), 0, Math.PI * 2, 0, ts)
  };
  /* ---------------- weapons (pointing -Z, origin at the grip) ----------------
     Each firearm is built from side-view profiles extruded with a bevel, so
     silhouettes are smooth and chamfered instead of box-shaped. Profiles are
     written as [forward, up] pairs; forward +f maps to world -Z.            */
  function prof(parent, pts, thick, m, x) {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    const bt = Math.min(0.006, thick * 0.18);
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, thick - bt * 2), bevelEnabled: true, bevelThickness: bt, bevelSize: bt * 0.8, bevelSegments: BV.classic ? 1 : 2, curveSegments: BV.classic ? 2 : 4 });
    g.rotateY(Math.PI / 2); g.translate(-(thick - bt * 2) / 2 + (x || 0), 0, 0);
    g.computeVertexNormals();
    addWear(g, 1);
    const me = new THREE.Mesh(g, m); me.castShadow = true; parent.add(me); return me;
  }
  /* edge wear: vertices whose normal is not axis-aligned sit on bevels/edges */
  function addWear(g, k) {
    const n = g.attributes.normal, w = new Float32Array(n.count);
    for (let i = 0; i < n.count; i++) {
      const ax = Math.max(Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i)));
      w[i] = Math.min(1, Math.max(0, (1 - ax) * 3.2 * k + (Math.random() - 0.5) * 0.15));
    }
    g.setAttribute('wear', new THREE.BufferAttribute(w, 1)); return g;
  }
  function tube(parent, r, f0, f1, y, m, seg, x) {
    const cg = new THREE.CylinderGeometry(r, r, Math.abs(f1 - f0), BV.classic ? Math.max(6, Math.round((seg || 14) * 0.55)) : (seg || 14));
    // wear on the cylinder rims only
    const p = cg.attributes.position, w = new Float32Array(p.count), hh = Math.abs(f1 - f0) / 2;
    for (let i = 0; i < p.count; i++) w[i] = Math.abs(Math.abs(p.getY(i)) - hh) < 1e-4 ? 0.8 : 0.12 * Math.random();
    cg.setAttribute('wear', new THREE.BufferAttribute(w, 1));
    const me = new THREE.Mesh(cg, m);
    me.rotation.x = Math.PI / 2; me.position.set(x || 0, y, -(f0 + f1) / 2); me.castShadow = true; parent.add(me); return me;
  }
  function magGroup(parent, pts, thick, m, home) {
    const g = new THREE.Group(); prof(g, pts, thick, m); g.position.copy(home); parent.add(g); return g;
  }
  function rail(parent, f0, f1, y, m) {
    prof(parent, [[f0, y], [f1, y], [f1, y + 0.012], [f0, y + 0.012]], 0.024, m);
    for (let f = f0 + 0.01; f < f1 - 0.005; f += 0.02) prof(parent, [[f, y + 0.012], [f + 0.009, y + 0.012], [f + 0.009, y + 0.018], [f, y + 0.018]], 0.026, m);
  }
  function scope(parent, f0, f1, y, r, m) {
    tube(parent, r, f0 + 0.05, f1 - 0.05, y, m, 16);
    const bell = (fa, fb) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r, 0.05, 16), m); me.rotation.x = fa < fb ? -Math.PI / 2 : Math.PI / 2; me.position.set(0, y, -(fa + fb) / 2); parent.add(me); };
    bell(f1 - 0.05, f1); bell(f0 + 0.05, f0);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 16), new THREE.MeshBasicMaterial({ color: 0x0a1218 }));
    lens.position.set(0, y, -f1 - 0.001); lens.rotation.y = Math.PI; parent.add(lens);
    tube(parent, r * 0.45, f0 + 0.12, f0 + 0.16, y + r + 0.012, m, 10); // turret
    prof(parent, [[f0 + 0.08, y - r], [f0 + 0.12, y - r], [f0 + 0.12, y - r - 0.03], [f0 + 0.08, y - r - 0.03]], 0.02, m);
    prof(parent, [[f1 - 0.12, y - r], [f1 - 0.08, y - r], [f1 - 0.08, y - r - 0.03], [f1 - 0.12, y - r - 0.03]], 0.02, m);
  }
  /* ---------- mechanical detail kit: pins, screws, ports, levers ---------- */
  const THICK = { pistol: 0.032, pistolHeavy: 0.038, smg: 0.048, smgCompact: 0.06, rifle: 0.052, rifleCarbine: 0.05, dmr: 0.054, sniper: 0.06, shotgun: 0.054 };
  function pin(g, f, y, r, len, m) { const c = new THREE.CylinderGeometry(r, r, len, 10); addWear(c, 0.4); const me = new THREE.Mesh(c, m); me.rotation.z = Math.PI / 2; me.position.set(0, y, -f); g.add(me); return me; }
  function screw(g, th, f, y, side) {
    const c = new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 10); addWear(c, 0.6);
    const me = new THREE.Mesh(c, M.steel()); me.rotation.z = Math.PI / 2; me.position.set(side * (th / 2 + 0.0015), y, -f); g.add(me);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.0065, 0.0012), M.poly()); sl.position.set(side * (th / 2 + 0.003), y, -f); sl.rotation.x = Math.random() * 3; g.add(sl);
  }
  function port(g, th, f0, f1, y0, y1) {
    const dark = mat(0x050505, { roughness: 0.9 });
    const pb = new THREE.Mesh(new THREE.BoxGeometry(0.003, y1 - y0, f1 - f0), dark); pb.position.set(th / 2 + 0.0008, (y0 + y1) / 2, -(f0 + f1) / 2); g.add(pb);
    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.003, (y1 - y0) * 0.55, (f1 - f0) * 0.85), M.steel()); bolt.position.set(th / 2 + 0.0016, (y0 + y1) / 2, -(f0 + f1) / 2); g.add(bolt);
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.006), M.steel()); lug.position.set(th / 2 + 0.002, (y0 + y1) / 2, -(f0 + (f1 - f0) * 0.3)); g.add(lug);
  }
  function selector(g, th, f, y) {
    const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), M.steel()); ax.rotation.z = Math.PI / 2; ax.position.set(-(th / 2 + 0.002), y, -f); g.add(ax);
    const lv = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.004, 0.022), M.dark()); lv.position.set(-(th / 2 + 0.004), y + 0.004, -f + 0.008); lv.rotation.x = -0.5; g.add(lv);
    // painted fire-mode marks
    [['#e9e2cf', -0.012], ['#c4442c', 0.012]].forEach(([c, df]) => { const mk = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.003, 0.003), mat(parseInt(c.slice(1), 16), { roughness: 0.6 })); mk.position.set(-(th / 2 + 0.0008), y + 0.009, -(f + df)); g.add(mk); });
  }
  function magDetail(mag, th) {
    if (!mag || !mag.children.length) return;
    const bb = new THREE.Box3().setFromObject(mag); // in parent space (mag at home)
    mag.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(mag.matrixWorld).invert();
    const lo = bb.min.clone().applyMatrix4(inv), hi = bb.max.clone().applyMatrix4(inv);
    const bp = new THREE.Mesh(new THREE.BoxGeometry(th + 0.006, 0.01, Math.abs(hi.z - lo.z) * 0.55 + 0.01), M.poly());
    bp.position.set(0, lo.y + 0.004, (lo.z + hi.z) / 2 + (hi.z - lo.z) * 0.12); mag.add(bp);
    for (let i = 0; i < 3; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(th + 0.002, 0.004, Math.abs(hi.z - lo.z) * 0.4), mat(0x1a1a1a, { roughness: 0.8 })); rib.position.set(0, hi.y - 0.03 - i * 0.025, (lo.z + hi.z) / 2); mag.add(rib); }
    const wind = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.03, 0.006), M.brass()); wind.position.set(th / 2 + 0.0012, hi.y - 0.04, (lo.z + hi.z) / 2 - 0.006); mag.add(wind); // witness hole showing rounds
  }
  function addKit(model, g, mag) {
    const th = THICK[model]; if (!th) return;
    const rifleLike = model === 'rifle' || model === 'rifleCarbine' || model === 'dmr';
    if (rifleLike) {
      port(g, th, 0.07, 0.17, 0.03, 0.058);
      pin(g, -0.07, 0.012, 0.004, th + 0.008, M.steel()); pin(g, 0.2, 0.012, 0.004, th + 0.008, M.steel());
      selector(g, th, -0.015, 0.035);
      [0.3, 0.38, 0.46].forEach(f => { screw(g, th + 0.006, f, 0.035, 1); screw(g, th + 0.006, f, 0.035, -1); });
      if (model === 'rifle') { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.01), M.steel()); ch.position.set(th / 2 + 0.01, 0.06, -0.2); g.add(ch); }
      if (model === 'rifleCarbine') {
        const ch = prof(g, [[-0.12, 0.07], [-0.08, 0.07], [-0.08, 0.08], [-0.12, 0.08]], 0.03, M.dark()); // charging handle
        const ch2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.012), M.dark()); ch2.position.set(0, 0.075, 0.12); g.add(ch2);
        // flip-up front sight + side flashlight with lens
        prof(g, [[0.47, 0.082], [0.49, 0.082], [0.488, 0.115], [0.472, 0.115]], 0.012, M.dark());
        tube(g, 0.014, 0.36, 0.48, 0.045, M.alu(), 14, 0.045);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.012, 14), new THREE.MeshBasicMaterial({ color: 0xcfd8dc })); lens.position.set(0.045, 0.045, -0.481); lens.rotation.y = Math.PI; g.add(lens);
        const sw = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.02), M.rubber()); sw.position.set(0.045, 0.06, -0.38); g.add(sw);
      }
      // rubber butt pad
      const bp = new THREE.Mesh(new THREE.BoxGeometry(th + 0.004, 0.13, 0.018), M.rubber());
      bp.position.set(0, -0.02, model === 'dmr' ? 0.468 : model === 'rifle' ? 0.438 : 0.385); g.add(bp);
    }
    if (model === 'smg' || model === 'smgCompact') {
      port(g, th, 0.04, 0.12, 0.03, 0.055);
      selector(g, th, -0.02, 0.03);
      pin(g, -0.05, 0.01, 0.0035, th + 0.006, M.steel()); pin(g, 0.17, 0.02, 0.0035, th + 0.006, M.steel());
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), M.steel()); knob.position.set(-(th / 2 + 0.008), 0.06, -0.15); g.add(knob);
    }
    if (model === 'pistol' || model === 'pistolHeavy') {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.03), mat(0x050505, { roughness: 0.9 })); ep.position.set(th / 2 - 0.001, 0.05, -0.04); g.add(ep);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.009, 0.026), M.brass()); br.position.set(th / 2 - 0.0005, 0.049, -0.04); g.add(br); // barrel hood
      const ham = prof(g, [[-0.045, 0.03], [-0.035, 0.03], [-0.04, 0.055], [-0.052, 0.05]], 0.01, M.steel());
      const ss = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.006, 0.03), M.dark()); ss.position.set(-(th / 2 + 0.0015), 0.016, -0.03); g.add(ss); // slide stop
      const mr = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10), M.dark()); mr.rotation.z = Math.PI / 2; mr.position.set(-(th / 2 + 0.002), -0.01, 0.005); g.add(mr);
      [[-0.07, 1], [-0.07, -1], [-0.03, 1], [-0.03, -1]].forEach(([y, sd]) => screw(g, th + 0.004, -0.025, y, sd));
    }
    if (model === 'sniper') {
      [0.1, 0.25, 0.42].forEach(f => { screw(g, 0.066, f, 0.03, 1); screw(g, 0.066, f, 0.03, -1); });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.16, 0.025), M.rubber()); pad.position.set(0, -0.02, 0.52); g.add(pad);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), M.dark()); knob.position.set(0.075, 0.075, 0.04); g.add(knob);
      selector(g, 0.06, -0.05, 0.075);
    }
    if (model === 'shotgun') {
      port(g, th, 0.06, 0.17, 0.035, 0.065);
      const lp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.09), mat(0x050505, { roughness: 0.9 })); lp.position.set(0, -0.001, -0.12); g.add(lp);
      const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, th + 0.006, 10), M.steel()); sb.rotation.z = Math.PI / 2; sb.position.set(0, 0.0, 0.03); g.add(sb);
      pin(g, 0.02, 0.05, 0.0035, th + 0.006, M.steel()); pin(g, 0.18, 0.05, 0.0035, th + 0.006, M.steel());
      [0.25, 0.38].forEach(f => { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.003, 6, 16), M.dark()); ring.position.set(0, 0.036, -f - 0.15); g.add(ring); });
    }
    magDetail(mag, th - 0.022 > 0.02 ? th - 0.022 : 0.026);
  }
  function gun(model) {
    const g = new THREE.Group(); const muzzle = new THREE.Object3D(); let mag = null;
    const D = M.dark(), St = M.steel(), P = M.poly(), W = M.wood(), O = M.olive(), Br = M.bright(), Tn = M.tan();
    const grip = (m, f, th) => prof(g, [[f - 0.03, -0.005], [f + 0.02, -0.005], [f + 0.005, -0.06], [f - 0.005, -0.115], [f - 0.05, -0.12], [f - 0.045, -0.06]], th || 0.034, m);
    switch (model) {
      case 'pistol':
        prof(g, [[-0.04, 0.012], [0.15, 0.012], [0.155, 0.05], [-0.035, 0.05], [-0.045, 0.035]], 0.032, St);           // slide
        for (let i = 0; i < 5; i++) prof(g, [[-0.03 + i * 0.008, 0.02], [-0.026 + i * 0.008, 0.02], [-0.026 + i * 0.008, 0.045], [-0.03 + i * 0.008, 0.045]], 0.034, D);
        prof(g, [[-0.035, -0.012], [0.13, -0.012], [0.13, 0.014], [-0.04, 0.014]], 0.029, P);                         // frame
        prof(g, [[-0.035, -0.008], [0.015, -0.008], [0.0, -0.11], [-0.06, -0.115], [-0.055, -0.05]], 0.031, P);        // grip
        mag = magGroup(g, [[-0.02, 0], [0.02, 0], [0.005, -0.02], [-0.035, -0.02]], 0.026, D, new THREE.Vector3(0, -0.1, 0));
        prof(g, [[0.135, 0.05], [0.145, 0.05], [0.145, 0.06], [0.135, 0.06]], 0.006, D);
        prof(g, [[-0.03, 0.05], [-0.015, 0.05], [-0.015, 0.06], [-0.03, 0.06]], 0.02, D);
        muzzle.position.set(0, 0.032, -0.16); break;
      case 'pistolHeavy':
        prof(g, [[-0.05, 0.014], [0.17, 0.014], [0.175, 0.058], [-0.045, 0.058], [-0.055, 0.04]], 0.038, D);
        prof(g, [[-0.045, -0.014], [0.15, -0.014], [0.15, 0.016], [-0.05, 0.016]], 0.034, St);
        prof(g, [[-0.045, -0.01], [0.01, -0.01], [-0.005, -0.12], [-0.07, -0.125], [-0.065, -0.05]], 0.036, W);
        mag = magGroup(g, [[-0.03, 0], [0.01, 0], [0.0, -0.02], [-0.045, -0.02]], 0.03, D, new THREE.Vector3(0, -0.11, 0));
        tube(g, 0.012, 0.16, 0.185, 0.036, St);
        prof(g, [[0.16, 0.058], [0.17, 0.058], [0.17, 0.07], [0.16, 0.07]], 0.008, Br);
        muzzle.position.set(0, 0.036, -0.19); break;
      case 'smg':
        prof(g, [[-0.1, 0.0], [0.24, 0.0], [0.24, 0.07], [0.0, 0.075], [-0.1, 0.06]], 0.048, D);                      // receiver
        tube(g, 0.013, 0.24, 0.36, 0.04, St); tube(g, 0.02, 0.18, 0.26, 0.035, P);
        grip(P, 0.0);
        mag = magGroup(g, [[-0.02, 0], [0.025, 0], [0.04, -0.16], [0.0, -0.165]], 0.026, P, new THREE.Vector3(0, 0.0, -0.1));
        prof(g, [[-0.1, 0.055], [-0.32, 0.05], [-0.32, 0.0], [-0.3, 0.0], [-0.3, 0.035], [-0.1, 0.02]], 0.018, St);   // wire stock
        prof(g, [[-0.33, 0.06], [-0.3, 0.06], [-0.3, -0.01], [-0.33, -0.01]], 0.04, P);
        prof(g, [[0.15, 0.075], [0.17, 0.075], [0.17, 0.095], [0.15, 0.095]], 0.008, D);
        muzzle.position.set(0, 0.04, -0.37); break;
      case 'smgCompact':
        prof(g, [[-0.08, -0.01], [0.2, -0.01], [0.24, 0.03], [0.22, 0.09], [-0.06, 0.09], [-0.09, 0.05]], 0.06, O);   // angular body
        rail(g, -0.05, 0.18, 0.09, D);
        tube(g, 0.022, 0.2, 0.34, 0.035, D, 16);
        grip(P, 0.0, 0.034);
        mag = magGroup(g, [[-0.035, 0], [0.005, 0], [-0.005, -0.15], [-0.045, -0.15]], 0.028, P, new THREE.Vector3(0, -0.1, 0));
        prof(g, [[-0.08, 0.06], [-0.2, 0.05], [-0.2, -0.01], [-0.08, 0.0]], 0.035, P);
        muzzle.position.set(0, 0.035, -0.35); break;
      case 'rifle':
        prof(g, [[-0.1, 0.0], [0.26, -0.005], [0.26, 0.065], [0.0, 0.075], [-0.1, 0.065]], 0.052, D);               // receiver
        prof(g, [[0.04, 0.075], [0.2, 0.072], [0.2, 0.09], [0.06, 0.092]], 0.044, D);                                // dust cover
        prof(g, [[0.26, 0.0], [0.5, 0.008], [0.52, 0.03], [0.5, 0.062], [0.26, 0.066]], 0.058, W);                    // handguard
        tube(g, 0.012, 0.26, 0.56, 0.09, St, 10);                                                                     // gas tube
        tube(g, 0.012, 0.5, 0.74, 0.035, St);
        prof(g, [[0.66, 0.045], [0.68, 0.045], [0.685, 0.11], [0.665, 0.11]], 0.008, D);                              // front sight
        prof(g, [[0.12, 0.09], [0.16, 0.09], [0.16, 0.105], [0.12, 0.105]], 0.03, D);                                  // rear sight
        grip(P, 0.0, 0.036);
        mag = magGroup(g, [[0.07, 0], [0.135, 0], [0.155, -0.07], [0.19, -0.15], [0.13, -0.18], [0.1, -0.11], [0.075, -0.05]], 0.03, St, new THREE.Vector3(0, 0, 0));
        prof(g, [[-0.1, 0.065], [-0.42, 0.04], [-0.43, -0.09], [-0.37, -0.095], [-0.18, -0.02], [-0.1, 0.0]], 0.044, W); // stock
        prof(g, [[-0.435, 0.045], [-0.415, 0.045], [-0.415, -0.095], [-0.435, -0.095]], 0.046, P);                    // butt pad
        muzzle.position.set(0, 0.035, -0.75); break;
      case 'rifleCarbine':
        prof(g, [[-0.1, 0.0], [0.25, 0.0], [0.25, 0.07], [-0.1, 0.07]], 0.05, P);                                      // lower+upper
        prof(g, [[-0.02, -0.0], [0.17, -0.0], [0.16, -0.035], [0.0, -0.035]], 0.046, P);                               // mag well
        prof(g, [[0.25, 0.005], [0.52, 0.005], [0.52, 0.068], [0.25, 0.068]], 0.056, D);                              // handguard
        for (let f = 0.28; f < 0.5; f += 0.04) prof(g, [[f, 0.02], [f + 0.02, 0.02], [f + 0.02, 0.05], [f, 0.05]], 0.058, P); // vents
        rail(g, -0.08, 0.52, 0.07, D);
        tube(g, 0.011, 0.52, 0.68, 0.035, St);
        prof(g, [[0.04, 0.088], [0.1, 0.088], [0.1, 0.12], [0.04, 0.12]], 0.03, D); tube(g, 0.016, 0.03, 0.11, 0.105, D, 14); // red-dot
        grip(P, 0.0, 0.036);
        mag = magGroup(g, [[0.0, 0], [0.06, 0], [0.075, -0.15], [0.015, -0.155]], 0.028, O, new THREE.Vector3(0, -0.03, 0));
        tube(g, 0.012, -0.1, -0.3, 0.04, St, 10);
        prof(g, [[-0.22, 0.07], [-0.38, 0.06], [-0.38, -0.06], [-0.33, -0.06], [-0.22, 0.01]], 0.04, P);              // stock
        muzzle.position.set(0, 0.035, -0.69); break;
      case 'dmr':
        prof(g, [[-0.12, 0.0], [0.3, 0.0], [0.3, 0.075], [-0.12, 0.075]], 0.054, O);
        prof(g, [[0.3, 0.005], [0.58, 0.01], [0.58, 0.065], [0.3, 0.07]], 0.05, D);
        tube(g, 0.013, 0.58, 0.86, 0.04, St);
        rail(g, -0.06, 0.28, 0.075, D);
        scope(g, -0.04, 0.24, 0.13, 0.024, D);
        grip(P, 0.0, 0.036);
        mag = magGroup(g, [[0.05, 0], [0.13, 0], [0.135, -0.1], [0.055, -0.1]], 0.03, D, new THREE.Vector3(0, 0, 0));
        prof(g, [[-0.12, 0.075], [-0.46, 0.06], [-0.47, -0.08], [-0.41, -0.085], [-0.3, -0.02], [-0.12, 0.0]], 0.046, O);
        prof(g, [[-0.4, 0.075], [-0.25, 0.075], [-0.25, 0.09], [-0.4, 0.085]], 0.03, P);                               // cheek rest
        muzzle.position.set(0, 0.04, -0.87); break;
      case 'sniper':
        prof(g, [[-0.15, -0.005], [0.34, -0.01], [0.6, 0.0], [0.6, 0.055], [0.3, 0.065], [-0.15, 0.06]], 0.06, Tn);      // stock/forend
        prof(g, [[-0.15, 0.06], [0.24, 0.06], [0.24, 0.09], [-0.12, 0.09]], 0.044, D);                                 // action
        tube(g, 0.017, 0.4, 1.0, 0.065, St, 16);
        tube(g, 0.026, 0.98, 1.06, 0.065, D, 12);
        scope(g, -0.08, 0.3, 0.15, 0.032, D);
        const bolt = tube(g, 0.008, -0.07, -0.02, 0.075, Br, 8, 0.045); bolt.rotation.set(0, 0, Math.PI / 2); bolt.position.set(0.05, 0.075, 0.04);
        grip(Tn, 0.0, 0.04);
        mag = magGroup(g, [[0.05, 0], [0.13, 0], [0.13, -0.06], [0.05, -0.06]], 0.034, D, new THREE.Vector3(0, 0, 0));
        prof(g, [[-0.15, 0.06], [-0.5, 0.06], [-0.52, -0.1], [-0.44, -0.11], [-0.3, -0.03], [-0.15, -0.005]], 0.05, Tn);
        prof(g, [[-0.5, 0.06], [-0.3, 0.07], [-0.3, 0.095], [-0.5, 0.085]], 0.032, Tn);
        for (const s of [-1, 1]) { const leg = prof(g, [[0.5, 0.0], [0.51, 0.0], [0.53, -0.2], [0.52, -0.2]], 0.01, D, s * 0.02); leg.rotation.z = s * 0.15; }
        muzzle.position.set(0, 0.065, -1.07); break;
      case 'shotgun':
        prof(g, [[-0.1, 0.0], [0.22, 0.0], [0.22, 0.075], [-0.08, 0.075], [-0.1, 0.06]], 0.054, D);
        tube(g, 0.017, 0.22, 0.75, 0.055, St, 16);
        tube(g, 0.015, 0.22, 0.66, 0.018, D, 14);
        mag = new THREE.Group(); g.add(mag);
        prof(mag, [[0.32, -0.01], [0.5, -0.01], [0.5, 0.045], [0.32, 0.045]], 0.06, W);
        for (let f = 0.34; f < 0.49; f += 0.03) prof(mag, [[f, -0.012], [f + 0.012, -0.012], [f + 0.012, 0.047], [f, 0.047]], 0.062, D);
        grip(W, 0.0, 0.038);
        prof(g, [[-0.1, 0.06], [-0.43, 0.035], [-0.44, -0.1], [-0.38, -0.105], [-0.16, -0.03], [-0.1, 0.0]], 0.046, W);
        prof(g, [[0.73, 0.072], [0.745, 0.072], [0.745, 0.085], [0.73, 0.085]], 0.008, Br);
        muzzle.position.set(0, 0.055, -0.76); break;
      case 'knife':
        prof(g, [[-0.08, -0.016], [0.04, -0.016], [0.04, 0.016], [-0.08, 0.016], [-0.095, 0.0]], 0.026, P);          // handle
        for (let i = 0; i < 4; i++) prof(g, [[-0.07 + i * 0.025, -0.018], [-0.062 + i * 0.025, -0.018], [-0.062 + i * 0.025, 0.018], [-0.07 + i * 0.025, 0.018]], 0.028, D);
        prof(g, [[0.04, -0.03], [0.055, -0.03], [0.055, 0.03], [0.04, 0.03]], 0.03, St);                               // guard
        prof(g, [[0.055, -0.016], [0.2, -0.012], [0.24, 0.006], [0.2, 0.02], [0.055, 0.018]], 0.006, Br);             // blade
        prof(g, [[0.09, 0.012], [0.19, 0.012], [0.19, 0.016], [0.09, 0.016]], 0.007, D);
        muzzle.position.set(0, 0, -0.24); break;
      case 'grenade': {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), O); s.scale.set(1, 1.15, 1); s.castShadow = true; g.add(s);
        for (let i = -1; i <= 1; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.043 - Math.abs(i) * 0.008, 0.003, 4, 16), D); r.rotation.x = Math.PI / 2; r.position.y = i * 0.022; g.add(r); }
        tube(g, 0.014, -0.012, 0.012, 0.055, St, 10).rotation.set(0, 0, 0);
        prof(g, [[-0.005, 0.06], [0.02, 0.06], [0.03, -0.03], [0.022, -0.03], [0.012, 0.05], [-0.005, 0.05]], 0.012, St, 0.0);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 4, 12), Br); ring.position.set(0.02, 0.07, 0); g.add(ring);
        muzzle.position.set(0, 0, -0.05); break;
      }
      default: tube(g, 0.02, 0, 0.3, 0, D); muzzle.position.set(0, 0, -0.3);
    }
    addKit(model, g, mag);
    mergeTree(g);
    g.add(muzzle);
    // ejection-port anchor for world-space brass
    const ej = new THREE.Object3D(); ej.position.set((THICK[model] || 0.04) / 2 + 0.01, 0.045, model === 'pistol' || model === 'pistolHeavy' ? 0.04 : -0.12); g.add(ej);
    return { group: g, muzzle, mag, magHome: mag ? mag.position.clone() : null, eject: ej };
  }

  /* ---------- imported weapon meshes (Quaternius Ultimate Guns Pack, CC0) ----------
     Decoded from js/gun_data.js. Each source material keeps its own colour but
     gets our grime map + edge-wear shader; the magazine (or shotgun pump) is a
     separate part so reloads can animate it. */
  const GUN_MAT = {
    Black: ['poly', 0x1c1d1e], DarkMetal: ['dark', 0x2c2f31], Metal: ['dark', 0x3e4245], LightMetal: ['dark', 0x4a4e52], Grey: ['alu', 0x4a4e51],
    Wood: ['wood', 0x6b4a30], DarkWood: ['wood', 0x4a3220], Main: ['dark', 0x2f3234], MainDark: ['poly', 0x1d1e1f], MainLight: ['alu', 0x5c6064]
  };
  const gunGeoCache = {};
  function dec16(b64, scale) { const bin = atob(b64), n = bin.length >> 1, out = new Float32Array(n); for (let i = 0; i < n; i++) { let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8); if (v > 32767) v -= 65536; out[i] = v / scale; } return out; }
  function dec8(b64) { const bin = atob(b64), out = new Float32Array(bin.length); for (let i = 0; i < bin.length; i++) { let v = bin.charCodeAt(i); if (v > 127) v -= 256; out[i] = v / 127; } return out; }
  function decU8(b64) { const bin = atob(b64), out = new Float32Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) / 255; return out; }
  function importedMat(mname, kd) {
    const key = 'imp_' + mname + kd.join(',');
    if (matCache[key]) return matCache[key];
    if (mname === 'Glass') return (matCache[key] = new THREE.MeshBasicMaterial({ color: 0x0c151c }));
    const spec = GUN_MAT[mname] || ['dark', 0x333333];
    const base = M[spec[0]]();                                    // reuse wear settings of the family
    const neutral = spec[0] === 'wood' ? woodTex() : grimeTex(0xa9a9a9, spec[0] === 'poly' ? 120 : 240);
    const m = wearMat(key, { map: neutral, roughnessMap: base.roughnessMap, normalMap: base.normalMap, normalScale: base.normalScale,
      roughness: base.roughness, metalness: base.metalness, color: spec[0] === 'wood' ? 0xd0b090 : spec[1], keepColor: true }, base.userData.wear);
    return m;
  }
  function importedGun(model) {
    const D = BV.GUN_DATA && BV.GUN_DATA[model]; if (!D) return null;
    const g = new THREE.Group(), muzzle = new THREE.Object3D();
    let mag = null;
    for (const part of ['body', 'mag']) {
      const list = D.parts[part]; if (!list) continue;
      const parent = part === 'mag' ? (mag = new THREE.Group()) : g;
      for (const L of list) {
        const ck = model + part + L.mat;
        let geo = gunGeoCache[ck];
        if (!geo) {
          geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(dec16(L.p, 16384), 3));
          geo.setAttribute('normal', new THREE.BufferAttribute(dec8(L.nrm), 3));
          geo.setAttribute('uv', new THREE.BufferAttribute(dec16(L.uv, 2048), 2));
          geo.setAttribute('wear', new THREE.BufferAttribute(decU8(L.w), 1));
          geo.computeBoundingSphere(); gunGeoCache[ck] = geo;
        }
        const me = new THREE.Mesh(geo, importedMat(L.mat, L.kd)); me.castShadow = true; parent.add(me);
      }
    }
    if (mag) g.add(mag);
    muzzle.position.set(D.muzzle[0], D.muzzle[1], D.muzzle[2] - 0.01); g.add(muzzle);
    const len = -D.muzzle[2];
    const ej = new THREE.Object3D(); ej.position.set(0.03, D.muzzle[1] * 0.8 + 0.01, model === 'pistol' || model === 'pistolHeavy' ? -len * 0.35 : -len * 0.18); g.add(ej);
    return { group: g, muzzle, mag, magHome: mag ? mag.position.clone() : null, eject: ej, imported: true };
  }

  /* extra detail common to firearms: trigger guard + muzzle device */
  function detailGun(model, res) {
    if (model === 'knife' || model === 'grenade') return res;
    const g = res.group;
    const tg = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 14, Math.PI), M.dark());
    tg.rotation.set(0, Math.PI / 2, Math.PI); tg.position.set(0, -0.012, -0.02); g.add(tg);
    const trig = box(g, 0.006, 0.022, 0.006, 0, -0.018, -0.02, M.steel());
    if (model !== 'pistol' && model !== 'pistolHeavy') {
      const mz = res.muzzle.position;
      const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.06, 12), M.dark());
      brake.rotation.x = Math.PI / 2; brake.position.set(mz.x, mz.y, mz.z + 0.03); g.add(brake);
      // sling swivels
      const sw = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 4, 10), M.steel());
      sw.position.set(0, -0.03, -0.25); sw.rotation.y = Math.PI / 2; g.add(sw);
    }
    mergeTree(g);
    return res;
  }

  /* Merge the direct mesh children of every group in a tree (per material)
     into single meshes: keeps the hierarchy for animation, cuts draw calls. */
  function mergeTree(root) {
    const groups = [];
    root.traverse(o => { if (o.children && o.children.length) groups.push(o); });
    for (const grp of groups) {
      const byMat = new Map();
      for (const c of grp.children) {
        if (!c.isMesh || c.userData.keep || c.material.transparent) continue;
        if (!byMat.has(c.material)) byMat.set(c.material, []);
        byMat.get(c.material).push(c);
      }
      for (const [m, list] of byMat) {
        if (list.length < 2) continue;
        const pos = [], nor = [], uv = [], wr = [];
        for (const me of list) {
          me.updateMatrix();
          let gg = me.geometry.clone(); gg.applyMatrix4(me.matrix); if (gg.index) gg = gg.toNonIndexed();
          pos.push(gg.attributes.position.array); nor.push(gg.attributes.normal.array);
          uv.push(gg.attributes.uv ? gg.attributes.uv.array : new Float32Array(gg.attributes.position.count * 2));
          wr.push(gg.attributes.wear ? gg.attributes.wear.array : new Float32Array(gg.attributes.position.count));
          grp.remove(me);
        }
        const cat = (arrs) => { let n = 0; arrs.forEach(a => n += a.length); const o = new Float32Array(n); let k = 0; arrs.forEach(a => { o.set(a, k); k += a.length; }); return o; };
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(cat(pos), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(cat(nor), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(cat(uv), 2));
        if (m.userData.wear) geo.setAttribute('wear', new THREE.BufferAttribute(cat(wr), 1));
        geo.computeBoundingSphere();
        const mm = new THREE.Mesh(geo, m); mm.castShadow = true; mm.receiveShadow = true; grp.add(mm);
      }
    }
    return root;
  }

  /* ---------- character "skins": painted textures in the style of 2000s player models ---------- */
  function uniformSkin(base, pattern, team) {
    return ctex('skin_' + base + pattern, 256, 256, (g, w, h, r) => {
      const fab = fabric(base, pattern).image; g.drawImage(fab, 0, 0, w, h); g.drawImage(fab, 0, 0, w, h / 2); // camo base
      // painted folds and creases (dark lines with light edge), the main trick of period skins
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = r() * h, len = 20 + r() * 50, a = (r() < 0.6 ? Math.PI / 2 : 0.4) + (r() - 0.5) * 0.6;
        g.strokeStyle = 'rgba(0,0,0,0.32)'; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 6, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
        g.strokeStyle = 'rgba(255,255,240,0.10)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 2, y + 1); g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 8, y + Math.sin(a) * len * 0.5 + 1, x + Math.cos(a) * len + 2, y + Math.sin(a) * len + 1); g.stroke();
      }
      // seams with stitching
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.5, h); g.stroke();
      g.setLineDash([3, 3]); g.strokeStyle = 'rgba(230,225,200,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w * 0.5 + 3, 0); g.lineTo(w * 0.5 + 3, h); g.stroke(); g.setLineDash([]);
      // cargo pocket with flap on the outer side (u≈0.25 / 0.75 are the sides of a lathe)
      for (const cx of [w * 0.25, w * 0.75]) {
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(cx - 22, h * 0.42, 44, 46);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(cx - 22, h * 0.42, 44, 46);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 24, h * 0.42 - 4, 48, 12);
        g.fillStyle = 'rgba(255,255,240,0.12)'; g.fillRect(cx - 24, h * 0.42 - 4, 48, 2);
      }
      // dirt and wear toward the bottom
      const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(60,45,25,0)'); gr.addColorStop(1, 'rgba(60,45,25,0.35)'); g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
    });
  }
  function vestSkin(base) {
    return ctex('vest_' + base, 256, 256, (g, w, h, r) => {
      g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.1})`; g.fillRect(r() * w, r() * h, 2, 1); }
      // MOLLE webbing rows
      for (let y = 14; y < h; y += 22) {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 8, w, 2);
        g.fillStyle = shadeHex(base, 0.82); g.fillRect(0, y, w, 8);
        for (let x = 0; x < w; x += 24) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, y, 2, 8); }
        g.fillStyle = 'rgba(255,255,240,0.10)'; g.fillRect(0, y, w, 1);
      }
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
      g.setLineDash([4, 3]); g.strokeStyle = 'rgba(220,215,190,0.25)'; g.lineWidth = 1; g.strokeRect(7, 7, w - 14, h - 14); g.setLineDash([]);
    });
  }
  /* faces painted for lathe heads (front of a LatheGeometry faces -Z at u = 0.5) */
  function headSkin(skin, kind) {
    return ctex('head_' + skin + kind, 256, 128, (g, w, h, r) => {
      const fx = w * 0.5;
      g.fillStyle = hex(skin); g.fillRect(0, 0, w, h);
      // shading: cheeks, temples, under-chin
      let gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(60,30,20,0.35)'); gr.addColorStop(0.3, 'rgba(60,30,20,0)'); gr.addColorStop(0.7, 'rgba(60,30,20,0)'); gr.addColorStop(1, 'rgba(60,30,20,0.35)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (kind === 'mask') {
        g.fillStyle = '#1c1c1d'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 1); }
        g.fillStyle = hex(skin); g.fillRect(fx - 34, h * 0.4, 68, h * 0.13);
        g.fillStyle = 'rgba(60,30,20,0.4)'; g.fillRect(fx - 34, h * 0.4, 68, 3);
        g.fillStyle = '#f0ebe0'; g.fillRect(fx - 26, h * 0.44, 15, 6); g.fillRect(fx + 11, h * 0.44, 15, 6);
        g.fillStyle = '#2a2016'; g.fillRect(fx - 21, h * 0.44, 6, 6); g.fillRect(fx + 15, h * 0.44, 6, 6);
        for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(fx - 30 + k * 22, h * 0.72, 16, 2); } // knit ribs
        return;
      }
      g.fillStyle = '#2b2118'; g.fillRect(0, 0, w, h * 0.24);                              // cropped hair
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.3})`; g.fillRect(r() * w, r() * h * 0.26, 1, 2); }
      // larger, higher-contrast features so they read at game distance
      g.fillStyle = 'rgba(70,40,30,0.45)'; g.beginPath(); g.ellipse(fx - 20, h * 0.45, 17, 9, 0, 0, 7); g.ellipse(fx + 20, h * 0.45, 17, 9, 0, 0, 7); g.fill();   // sockets
      g.fillStyle = '#2a1c12'; g.fillRect(fx - 36, h * 0.35, 30, 6); g.fillRect(fx + 6, h * 0.35, 30, 6);                                  // brows
      g.fillStyle = '#f2ece2'; g.beginPath(); g.ellipse(fx - 20, h * 0.46, 10, 5, 0, 0, 7); g.ellipse(fx + 20, h * 0.46, 10, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#3b2a1a'; g.beginPath(); g.arc(fx - 19, h * 0.46, 4.5, 0, 7); g.arc(fx + 21, h * 0.46, 4.5, 0, 7); g.fill();
      g.fillStyle = '#0d0907'; g.beginPath(); g.arc(fx - 19, h * 0.46, 2, 0, 7); g.arc(fx + 21, h * 0.46, 2, 0, 7); g.fill();
      g.fillStyle = 'rgba(60,30,20,0.55)'; g.beginPath(); g.moveTo(fx - 2, h * 0.47); g.lineTo(fx - 9, h * 0.64); g.lineTo(fx + 1, h * 0.65); g.fill();          // nose shadow
      g.fillStyle = 'rgba(255,235,215,0.35)'; g.fillRect(fx + 1, h * 0.48, 3, h * 0.15);
      g.fillStyle = 'rgba(70,30,25,0.6)'; g.beginPath(); g.ellipse(fx, h * 0.64, 9, 3, 0, 0, 7); g.fill();                                     // nostrils
      g.fillStyle = '#6a2c24'; g.fillRect(fx - 17, h * 0.73, 34, 4); g.fillStyle = 'rgba(255,225,205,0.3)'; g.fillRect(fx - 14, h * 0.78, 28, 2);
      g.fillStyle = 'rgba(40,30,25,0.35)'; g.beginPath(); g.ellipse(fx, h * 0.8, 46, 20, 0, 0, 7); g.fill();                                   // stubble
      gr = g.createRadialGradient(fx, h * 0.5, 10, fx, h * 0.5, 90); gr.addColorStop(0, 'rgba(255,230,210,0.12)'); gr.addColorStop(1, 'rgba(60,30,20,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      gr = g.createLinearGradient(0, h * 0.85, 0, h); gr.addColorStop(0, 'rgba(50,25,15,0)'); gr.addColorStop(1, 'rgba(50,25,15,0.5)'); g.fillStyle = gr; g.fillRect(0, h * 0.85, w, h * 0.15);
    });
  }
  /* lathe helper: profile [[radius, y], ...] revolved; ex/ez give an elliptical cross-section */
  function lathe(pts, segs, ex, ez) {
    // profiles must run bottom -> top so faces point outward
    const sorted = pts.slice().sort((p, q) => p[1] - q[1]);
    const g = new THREE.LatheGeometry(sorted.map(p => new THREE.Vector2(p[0], p[1])), segs || 12);
    if (ex !== 1 || ez !== 1) g.scale(ex || 1, 1, ez || 1);
    return g;
  }
  /* rounded box via extruded rounded rectangle (no hard cube corners) */
  function rbox(w, h, d, r) {
    r = Math.min(r || 0.012, w / 2.2, h / 2.2);
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const bt = Math.min(r, d / 3);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, d - bt * 2), bevelEnabled: true, bevelThickness: bt, bevelSize: bt * 0.8, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(d - bt * 2) / 2);
    // texture coordinates in metres -> scale to ~0.3 m per texture tile
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.3 + 0.5, uv.getY(i) * 3.3 + 0.5);
    g.computeVertexNormals();
    return g;
  }

  /* ---------------- soldiers ----------------
     Anatomical low-poly bodies: every limb is a lathe with a muscle profile
     (thigh, calf, deltoid, forearm), the torso tapers from chest to waist, the
     head has jaw, nose and ears, and gear uses rounded boxes. Painted skins add
     folds, seams, pockets, webbing and faces — the way 2000s player models
     looked detailed without many polygons. */
  /* painted "skins" for the skinned operators: box-projected, so no pockets or seams
     that would repeat oddly; camo + creases + grime + scuffs, period-style contrast */
  function operatorFabric(base, pattern) {
    return ctex('opfab_' + base + pattern, 256, 256, (g, w, h, r) => {
      g.drawImage(fabric(base, pattern).image, 0, 0, w, h);
      for (let i = 0; i < 40; i++) {                       // creases: dark fold + lit edge
        const x = r() * w, y = r() * h, len = 18 + r() * 40, a = Math.PI / 2 + (r() - 0.5) * 1.2;
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, cx = (x + ex) / 2 + (r() - 0.5) * 14, cy = (y + ey) / 2;
        g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
        g.strokeStyle = 'rgba(255,250,235,0.12)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 2, y); g.quadraticCurveTo(cx + 2, cy, ex + 2, ey); g.stroke();
      }
      for (let i = 0; i < 6; i++) {                        // dirt / sweat patches
        const x = r() * w, y = r() * h, rr = 20 + r() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, 'rgba(55,42,25,0.30)'); gr.addColorStop(1, 'rgba(55,42,25,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.setLineDash([3, 2]);  // stitched seams
      for (let k = 0; k < 2; k++) { const y = (0.3 + k * 0.45) * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 6); g.stroke(); }
      g.setLineDash([]);
      for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,240'},${r() * 0.07})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
    });
  }
  function gearTex(base) {
    return ctex('opgear_' + base, 256, 256, (g, w, h, r) => {
      g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 2, 1); }   // nylon weave
      for (let y = 10; y < h; y += 26) {                      // webbing rows + bar-tacks
        g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(0, y + 9, w, 2); g.fillStyle = shadeHex(base, 0.85); g.fillRect(0, y, w, 9);
        g.fillStyle = 'rgba(255,255,240,0.08)'; g.fillRect(0, y, w, 1);
        for (let x = (y * 7) % 30; x < w; x += 30) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, y, 2, 9); }
      }
      for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(200,195,175,${0.08 + r() * 0.1})`; g.lineWidth = 1; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 10); g.stroke(); } // scuffs
      for (let i = 0; i < 5; i++) { const x = r() * w, y = r() * h, rr = 25 + r() * 35, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(70,58,40,0.28)'); gr.addColorStop(1, 'rgba(70,58,40,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    });
  }
  /* helpers shared with the skinned operators (charmodels.js) */
  function uniformSkinFor(teamId) { const T = BV.TEAMS[teamId]; return uniformSkin(T.uniform, teamId === 'VANGUARD' ? 'digital' : 'blot'); }
  function ravenHead(mats) {
    const T = BV.TEAMS.RAVEN, g = new THREE.Group();
    const m = (o) => { const mm = BV.mat(Object.assign({ roughness: 0.85 }, o)); mm.userData.base = mm.color.clone(); mats.push(mm); return mm; };
    const mHead = m({ map: headSkin(T.skin, 'mask') }), mHood = m({ map: uniformSkin(0x3b362f, 'blot'), color: 0xa8a8a8 }), mStrap = m({ color: 0x2a2924 });
    const gm = m({ color: 0x15171a });
    part(g, lathe([[0.0, 0.0], [0.055, 0.01], [0.085, 0.045], [0.1, 0.1], [0.11, 0.16], [0.108, 0.21], [0.092, 0.25], [0.06, 0.275], [0.0, 0.282]], 12, 0.9, 1.0), mHead, 0, 0, 0);
    part(g, new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mHood, 0, 0.15, 0.03, 1.02, 1.04, 1.1);
    for (const sx of [-1, 1]) { const lens = part(g, new THREE.CylinderGeometry(0.031, 0.034, 0.03, 12), gm, sx * 0.042, 0.165, -0.098); lens.rotation.x = Math.PI / 2; }
    part(g, rbox(0.03, 0.018, 0.02, 0.005), mStrap, 0, 0.165, -0.105);
    const strap = part(g, new THREE.TorusGeometry(0.11, 0.008, 4, 20), mStrap, 0, 0.165, 0); strap.rotation.x = Math.PI / 2;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function soldier(teamId, variant) {
    if (BV.CharModels && BV.CharModels.ready) return BV.CharModels.create(teamId, variant);
    const T = BV.TEAMS[teamId], V = teamId === 'VANGUARD';
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const mats = [];
    const m = (o) => { const mm = S(Object.assign({ roughness: 0.85, metalness: 0 }, o)); mm.userData.base = mm.color.clone(); mats.push(mm); return mm; };
    const skinTex = uniformSkin(T.uniform, V ? 'digital' : 'blot');
    const mU = m({ map: skinTex }), mUd = m({ map: skinTex, color: 0xa8a8a8 });
    const mRub = m({ color: 0x1b1b1a, roughness: 0.95 });
    const mV = m({ map: vestSkin(T.vest), roughness: 0.75 }), mA = m({ color: T.accent, roughness: 0.6 });
    const mHead = m({ map: headSkin(T.skin, V ? 'face' : 'mask'), roughness: 0.65 });
    const mSkinPlain = m({ color: V ? T.skin : 0x1c1c1d, roughness: 0.65 });
    const mH = m({ color: T.helmet, roughness: 0.75 });
    const mBoot = m({ color: 0x1d1b18, roughness: 0.6 }), mGlove = m({ color: 0x24211d, roughness: 0.7 });
    const mStrap = m({ color: 0x2a2924, roughness: 0.8 }), mMetal = m({ color: 0x8b8b80, metalness: 0.8, roughness: 0.3 });
    const SEG = 10;

    const mkLeg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.92, 0);
      part(p, lathe([[0.0, 0.03], [0.09, 0.02], [0.097, -0.06], [0.093, -0.2], [0.083, -0.34], [0.068, -0.45], [0.064, -0.48]], SEG, 1, 1.05), mU, 0, 0, 0);       // thigh
      const knee = new THREE.Group(); knee.position.set(0, -0.47, 0); p.add(knee);
      part(knee, lathe([[0.063, 0.02], [0.066, -0.05], [0.07, -0.12], [0.06, -0.24], [0.048, -0.36], [0.046, -0.42]], SEG, 1, 1.08), mUd, 0, 0, 0);               // calf
      part(knee, rbox(0.11, 0.12, 0.06, 0.02), V ? mV : mRub, 0, -0.01, -0.06);                                                                                    // knee pad
      part(knee, rbox(0.14, 0.022, 0.03, 0.008), mStrap, 0, 0.03, -0.01);
      const boot = new THREE.Group(); boot.position.set(0, -0.4, 0); knee.add(boot);
      part(boot, lathe([[0.058, 0.07], [0.062, 0.0], [0.06, -0.04]], SEG, 1, 1.1), mBoot, 0, 0, 0);                                                               // ankle collar
      part(boot, rbox(0.115, 0.09, 0.27, 0.03), mBoot, 0, -0.035, -0.045);                                                                                        // foot
      part(boot, rbox(0.125, 0.025, 0.29, 0.01), mRub, 0, -0.08, -0.045);                                                                                         // sole
      for (let k = 0; k < 3; k++) part(boot, rbox(0.07, 0.006, 0.012, 0.003), mStrap, 0, 0.02 - k * 0.025, -0.06 - k * 0.02);                                      // laces
      body.add(p); return { hip: p, knee };
    };
    const L = mkLeg(-0.105), R = mkLeg(0.105);

    const torso = new THREE.Group(); torso.position.set(0, 0.92, 0); body.add(torso);
    // pelvis -> waist -> rib cage -> chest -> shoulders as one tapered lathe, flattened front-to-back
    part(torso, lathe([[0.0, -0.02], [0.15, -0.0], [0.168, 0.08], [0.158, 0.2], [0.148, 0.28], [0.17, 0.38], [0.2, 0.48], [0.205, 0.55], [0.17, 0.62], [0.09, 0.66], [0.0, 0.665]], 12, 1, 0.66), mU, 0, 0, 0);
    for (const sx of [-1, 1]) part(torso, new THREE.SphereGeometry(0.085, 10, 8), mU, sx * 0.205, 0.555, 0, 1.05, 0.9, 1);                                         // deltoids
    part(torso, rbox(0.33, 0.055, 0.25, 0.015), mStrap, 0, 0.12, 0);                                                                                               // belt
    part(torso, rbox(0.055, 0.04, 0.02, 0.006), mMetal, 0, 0.12, -0.13);                                                                                           // buckle
    // belt kit
    part(torso, rbox(0.06, 0.17, 0.1, 0.02), mStrap, 0.19, 0.0, -0.02);                                                                                            // holster
    part(torso, rbox(0.04, 0.09, 0.06, 0.01), mRub, 0.205, 0.04, -0.03);                                                                                           // pistol grip
    part(torso, lathe([[0.0, 0.07], [0.055, 0.06], [0.06, -0.02], [0.045, -0.07], [0.0, -0.075]], 8, 1, 0.8), mV, -0.19, 0.04, 0.03);                            // dump pouch
    part(torso, rbox(0.15, 0.1, 0.06, 0.02), m({ color: V ? 0x7a2a22 : 0x3a3a34, roughness: 0.8 }), 0, 0.14, 0.15);                                             // IFAK
    if (V) {
      part(torso, rbox(0.36, 0.34, 0.07, 0.03), mV, 0, 0.43, -0.13);                                                                                               // front plate carrier
      part(torso, rbox(0.36, 0.36, 0.07, 0.03), mV, 0, 0.43, 0.13);                                                                                                // back plate
      part(torso, rbox(0.44, 0.13, 0.28, 0.04), mV, 0, 0.31, 0);                                                                                                   // cummerbund
      for (let i = -1; i <= 1; i++) { part(torso, rbox(0.085, 0.13, 0.05, 0.015), mV, i * 0.1, 0.33, -0.18); part(torso, rbox(0.088, 0.03, 0.055, 0.01), mStrap, i * 0.1, 0.39, -0.18); } // mag pouches + flaps
      part(torso, rbox(0.07, 0.1, 0.05, 0.015), mStrap, 0.2, 0.33, -0.05);                                                                                         // radio
      part(torso, geo.cyl(0.006, 0.006, 0.28, 4), mStrap, 0.21, 0.55, 0.06);
      part(torso, rbox(0.08, 0.045, 0.012, 0.005), mA, -0.11, 0.55, -0.168);                                                                                       // ID patch
      for (const sx of [-1, 1]) { part(torso, rbox(0.06, 0.09, 0.3, 0.02), mV, sx * 0.13, 0.58, 0); part(torso, new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), mV, sx * 0.21, 0.56, 0, 1, 0.7, 1); }
    } else {
      const xs = rbox(0.05, 0.48, 0.014, 0.006);
      const s1 = part(torso, xs, mStrap, 0, 0.42, -0.138); s1.rotation.z = 0.55;
      const s2 = part(torso, xs, mStrap, 0, 0.42, -0.138); s2.rotation.z = -0.55;
      for (let i = -1; i <= 1; i += 2) { part(torso, rbox(0.1, 0.12, 0.06, 0.02), mV, i * 0.1, 0.29, -0.15); part(torso, rbox(0.104, 0.03, 0.065, 0.01), mStrap, i * 0.1, 0.35, -0.15); }
      part(torso, rbox(0.3, 0.36, 0.15, 0.04), mV, 0, 0.42, 0.18);                                                                                                // pack
      const roll = part(torso, geo.cyl(0.06, 0.06, 0.32, 10), mStrap, 0, 0.64, 0.17); roll.rotation.z = Math.PI / 2;
      part(torso, geo.cyl(0.006, 0.006, 0.34, 4), mStrap, -0.1, 0.72, 0.2);
      const sc = part(torso, new THREE.TorusGeometry(0.075, 0.03, 8, 16), m({ map: fabric(0x5a4a38, 'blot'), roughness: 0.95 }), 0, 0.63, 0); sc.rotation.x = Math.PI / 2; // shemagh
    }
    part(torso, lathe([[0.062, -0.01], [0.055, 0.04], [0.056, 0.1]], 10, 1, 1), mSkinPlain, 0, 0.6, 0);                                                            // neck
    // head: skull + jaw profile, ears, nose
    const head = new THREE.Group(); head.position.set(0, 0.66, 0); torso.add(head);
    part(head, lathe([[0.0, 0.0], [0.055, 0.01], [0.085, 0.045], [0.1, 0.1], [0.11, 0.16], [0.108, 0.21], [0.092, 0.25], [0.06, 0.275], [0.0, 0.282]], 12, 0.9, 1.0), mHead, 0, 0, 0);
    if (V) {
      part(head, new THREE.ConeGeometry(0.018, 0.045, 4), mSkinPlain, 0, 0.13, -0.106).rotation.x = -Math.PI / 2 + 0.25;                                          // nose
      for (const sx of [-1, 1]) part(head, new THREE.SphereGeometry(0.026, 6, 6), mSkinPlain, sx * 0.1, 0.15, 0.005, 0.45, 1, 0.8);                               // ears
      part(head, new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mH, 0, 0.165, 0.005, 1, 0.92, 1.08);                                     // helmet shell
      const rim = part(head, new THREE.TorusGeometry(0.139, 0.011, 6, 20), mH, 0, 0.168, 0.005, 1, 1, 1.08); rim.rotation.x = Math.PI / 2;
      part(head, rbox(0.05, 0.04, 0.03, 0.008), m({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }), 0, 0.27, -0.13);                                           // NVG mount
      for (const sx of [-1, 1]) { const ear = part(head, geo.cyl(0.046, 0.046, 0.045, 12), mStrap, sx * 0.115, 0.13, 0.005); ear.rotation.z = Math.PI / 2; }      // ear defenders
      part(head, rbox(0.17, 0.012, 0.012, 0.004), mStrap, 0, 0.035, -0.06);                                                                                         // chin strap
    } else {
      part(head, new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mUd, 0, 0.15, 0.03, 1.02, 1.04, 1.1);                                   // hood
      const gm = m({ color: 0x281310, emissive: 0x5a1208, roughness: 0.1, metalness: 0.5 });
      for (const sx of [-1, 1]) { const lens = part(head, geo.cyl(0.031, 0.034, 0.03, 12), gm, sx * 0.042, 0.165, -0.098); lens.rotation.x = Math.PI / 2; }
      part(head, rbox(0.03, 0.018, 0.02, 0.005), mStrap, 0, 0.165, -0.105);                                                                                         // goggle bridge
      const strap = part(head, new THREE.TorusGeometry(0.11, 0.008, 4, 20), mStrap, 0, 0.165, 0); strap.rotation.x = Math.PI / 2;
    }
    // arms (rifle hold pose): deltoid -> bicep -> elbow -> forearm -> gloved hand with thumb
    const mkArm = (sx) => {
      const a = new THREE.Group(); a.position.set(sx * 0.22, 0.53, 0); torso.add(a);
      part(a, lathe([[0.06, 0.03], [0.063, -0.03], [0.062, -0.12], [0.052, -0.24], [0.05, -0.29]], SEG, 1, 1), mU, 0, 0, 0);
      const f = new THREE.Group(); f.position.set(0, -0.28, 0); a.add(f);
      part(f, new THREE.SphereGeometry(0.05, 8, 6), mU, 0, 0, 0);
      part(f, rbox(0.075, 0.07, 0.04, 0.015), mRub, 0, -0.01, 0.035);                                                                                               // elbow pad
      part(f, lathe([[0.05, 0.0], [0.054, -0.06], [0.046, -0.17], [0.038, -0.25]], SEG, 1, 1), mUd, 0, 0, 0);
      part(f, rbox(0.07, 0.09, 0.05, 0.02), mGlove, 0, -0.29, -0.005);                                                                                             // palm
      part(f, rbox(0.022, 0.05, 0.022, 0.009), mGlove, sx * -0.03, -0.27, -0.03).rotation.z = 0.4 * sx;                                                           // thumb
      return { a, f };
    };
    const AR = mkArm(1), AL = mkArm(-1);
    const armR = AR.a, foreR = AR.f, armL = AL.a, foreL = AL.f;
    armR.rotation.set(-0.6, 0, 0.15); foreR.rotation.x = -1.0;
    armL.rotation.set(-1.1, 0, -0.5); foreL.rotation.x = -0.6;
    if (!V) part(armL, geo.cyl(0.067, 0.067, 0.06, 12), mA, 0, -0.1, 0);                                                                                           // armband
    else part(armL, rbox(0.06, 0.08, 0.015, 0.006), mA, 0, -0.1, -0.062);

    const gunHolder = new THREE.Group(); gunHolder.position.set(0.1, 0.3, -0.32); torso.add(gunHolder);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; root.add(shadow);

    mergeTree(root);
    root.traverse(o => { if (o.isMesh && o.parent !== torso && o.parent !== L.hip && o.parent !== R.hip && o.parent !== L.knee && o.parent !== R.knee) o.castShadow = false; });
    let currentGun = null;
    const api = {
      root, body, torso, head, gunHolder, shadow, flashAnchor: null,
      setWeapon(def) {
        if (currentGun) gunHolder.remove(currentGun.group);
        currentGun = gun(def.model);
        const s = def.cls === 'melee' ? 1.3 : def.cls === 'grenade' ? 1.2 : 1.12;
        currentGun.group.scale.set(s, s, s);
        if (def.cls === 'pistol' || def.cls === 'melee' || def.cls === 'grenade') { gunHolder.position.set(0.1, 0.33, -0.42); armL.rotation.set(-1.3, 0, -0.35); }
        else { gunHolder.position.set(0.1, 0.3, -0.3); armL.rotation.set(-1.1, 0, -0.5); }
        api.armLBase = armL.rotation.x; api.switchT = 0.4;
        currentGun.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
        gunHolder.add(currentGun.group);
        api.flashAnchor = currentGun.muzzle; api.ejectAnchor = currentGun.eject;
      },
      armLBase: -1.1, flinchT: 0, sprintK: 0, relPh: 0, switchT: 0, deathV: 0, state: null,
      flinch() { api.flinchT = 0.28; api.flinchDir = Math.random() < 0.5 ? -1 : 1; },
      animate(dt, speed, crouch, pitch, phase, firing) {
        const st = api.state || {};
        const k = Math.min(1, speed / 4), run = st.sprint ? 1.35 : 1;
        const sw = Math.sin(phase) * 0.55 * k * run;
        L.hip.rotation.x = sw - crouch * 1.1; R.hip.rotation.x = -sw - crouch * 1.1;
        L.knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.75 * k * run + crouch * 1.9;
        R.knee.rotation.x = Math.max(0, Math.sin(phase)) * 0.75 * k * run + crouch * 1.9;
        body.position.y = -crouch * 0.42 + Math.abs(Math.cos(phase)) * 0.035 * k * run;
        body.rotation.z = Math.sin(phase) * 0.025 * k;
        api.sprintK += ((st.sprint ? 1 : 0) - api.sprintK) * Math.min(1, dt * 7);
        const sk = api.sprintK;
        torso.rotation.x = -pitch * 0.45 * (1 - sk) + crouch * 0.15 + sk * 0.22;
        torso.rotation.y = Math.sin(phase) * 0.07 * k;
        head.rotation.x = -pitch * 0.4 * (1 - sk) - sk * 0.15;
        head.rotation.y = -torso.rotation.y * 0.8;
        armR.rotation.x = -0.6 - pitch * 0.4 * (1 - sk) + (firing ? 0.07 : 0) + sk * 0.55;
        gunHolder.rotation.x = sk * 0.7; gunHolder.rotation.y = sk * 0.5;
        armL.rotation.x = api.armLBase + sk * 0.5;
        // reload: off hand dips to the vest and back, gun cants
        if (st.reloading) { api.relPh += dt * 4.2; const r = Math.sin(api.relPh); armL.rotation.x = api.armLBase + 0.6 + r * 0.45; gunHolder.rotation.z = 0.45; torso.rotation.x += 0.08; }
        else { api.relPh = 0; gunHolder.rotation.z *= 0.8; }
        // weapon switch dip
        if (api.switchT > 0) { api.switchT -= dt; const d = Math.sin(api.switchT / 0.4 * Math.PI); gunHolder.rotation.x += d * 0.9; armR.rotation.x += d * 0.4; }
        // hit flinch
        if (api.flinchT > 0) { api.flinchT -= dt; const f = Math.sin(api.flinchT / 0.28 * Math.PI); torso.rotation.x -= f * 0.22; torso.rotation.z = f * 0.12 * api.flinchDir; head.rotation.x -= f * 0.3; } else torso.rotation.z = 0;
      },
      die(t) {
        const e = 1 - Math.pow(1 - Math.min(1, t), 3), buckle = Math.min(1, t * 3);
        L.knee.rotation.x = R.knee.rotation.x = buckle * 1.2 * (1 - e * 0.6);
        L.hip.rotation.x = R.hip.rotation.x = -buckle * 0.5 * (1 - e * 0.5);
        torso.rotation.x = api.deathV === 1 ? 0.5 * buckle : -0.3 * buckle; head.rotation.x = api.deathV === 1 ? 0.6 : -0.5 * e;
        if (api.deathV === 0) { body.rotation.x = -e * 1.48; body.position.y = -e * 0.12; }
        else if (api.deathV === 1) { body.rotation.x = e * 1.45; body.position.y = -e * 0.1; armR.rotation.x = -2.6 * e; armL.rotation.x = -2.4 * e; }
        else { body.rotation.z = e * 1.42 * api.deathSide; body.position.y = -e * 0.15; armL.rotation.z = -1.2 * e; }
        shadow.scale.set(1 + e * 0.6, 1 + e * 1.4, 1);
      },
      reset() {
        body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); shadow.scale.set(1, 1, 1); torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
        armL.rotation.z = currentGun && api.armLBase ? armL.rotation.z : armL.rotation.z;
        api.deathV = Math.floor(Math.random() * 3); api.deathSide = Math.random() < 0.5 ? -1 : 1; api.flinchT = 0;
      },
      shade: 1,
      setShade(k) {
        if (Math.abs(k - api.shade) < 0.01) return; api.shade = k;
        for (const mm of mats) mm.color.copy(mm.userData.base).multiplyScalar(k);
      }
    };
    return api;
  }

  /* first-person arms: sleeves, cuffs and gloved hands with fingers */
  /* flatten a static hierarchy into one mesh per material (fewer draw calls) */
  const GET4 = ['getX', 'getY', 'getZ', 'getW'];
  // read an attribute as real floats (r128 does not de-normalize quantized data on the CPU)
  function floatAttr(at) {
    const arr = at.isInterleavedBufferAttribute ? at.data.array : at.array;
    const div = !at.normalized ? 1 : arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : arr instanceof Int8Array ? 127 : arr instanceof Uint8Array ? 255 : 1;
    if (div === 1 && !at.isInterleavedBufferAttribute) return at;
    const n = at.count, sz = at.itemSize, f = new Float32Array(n * sz);
    for (let i = 0; i < n; i++) for (let c = 0; c < sz; c++) { const v = at[GET4[c]](i) / div; f[i * sz + c] = div === 1 ? v : Math.max(-1, v); }
    return new THREE.BufferAttribute(f, sz);
  }
  function flatten(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), byMat = new Map();
    root.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
      let g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) g.setAttribute(k, floatAttr(g.attributes[k]));
      if (g.index) g = g.toNonIndexed();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(g);
    });
    const out = new THREE.Group();
    for (const [mat, list] of byMat) {
      const keys = ['position', 'normal', 'uv'].filter(k => list.every(g => g.attributes[k]));
      const merged = new THREE.BufferGeometry();
      for (const k of keys) {
        const size = list[0].attributes[k].itemSize, n = list.reduce((a, g) => a + g.attributes[k].count, 0), arr = new Float32Array(n * size); let off = 0;
        for (const g of list) { const at = g.attributes[k]; for (let i = 0; i < at.count; i++) for (let c = 0; c < size; c++) arr[off++] = at[GET4[c]](i); }
        merged.setAttribute(k, new THREE.BufferAttribute(arr, size));
      }
      merged.computeBoundingSphere();
      out.add(new THREE.Mesh(merged, mat));
    }
    return out;
  }
  /* first-person arms: tapered camo sleeve, rolled cuff, tactical glove with padded palm,
     knuckle guard and three-segment fingers that close around the grip */
  function viewArms(teamId) {
    const T = BV.TEAMS[teamId], V = teamId === 'VANGUARD';
    const g = new THREE.Group();
    const sleeve = S({ map: operatorFabric(V ? 0x2c4378 : 0x6f6551, V ? 'digital' : 'blot'), roughness: 0.92 });   // Vanguard: police blue
    const glove = S({ map: gearTex(0x262421), roughness: 0.78 });
    const leather = S({ color: 0x1b1a18, roughness: 0.6 });
    const rubber = S({ color: 0x121212, roughness: 0.5 });
    const capsule = (r, len) => {           // finger segment: cylinder with a rounded tip, base at origin, pointing -Z
      const grp = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, len, 8), glove); c.rotation.x = Math.PI / 2; c.position.z = -len / 2; grp.add(c);
      const t = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 8, 6), glove); t.position.z = -len; grp.add(t);
      return grp;
    };
    const finger = (x, curl, lens, r) => {   // chain of three segments, each curling about X
      const root = new THREE.Group(); root.position.set(x, 0, -0.072);
      let parent = root;
      lens.forEach((L, k) => { const seg = capsule(r, L); seg.rotation.x = -curl[k]; parent.add(seg); const nxt = new THREE.Group(); nxt.position.z = -L; seg.add(nxt); parent = nxt; });
      return root;
    };
    const mkHand = (grip) => {
      const h = new THREE.Group();
      // forearm: tapered sleeve (wrist -> elbow) with folds, rolled cuff
      const sl = new THREE.Mesh(lathe([[0.037, 0.0], [0.042, 0.06], [0.047, 0.18], [0.05, 0.3], [0.05, 0.36]], 14, 1, 0.9), sleeve);
      sl.rotation.x = Math.PI / 2; sl.position.z = 0.025; h.add(sl);
      const roll = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.011, 8, 18), sleeve); roll.position.z = 0.05; h.add(roll);
      // glove cuff with velcro strap
      const gc = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.05, 14), glove); gc.rotation.x = Math.PI / 2; gc.position.z = 0.0; h.add(gc);
      const strap = new THREE.Mesh(rbox(0.05, 0.016, 0.024, 0.006), leather); strap.position.set(0, 0.034, 0.0); h.add(strap);
      // padded palm + back of hand + knuckle guard
      const palm = new THREE.Mesh(rbox(0.078, 0.034, 0.085, 0.014), glove); palm.position.set(0, 0, -0.035); h.add(palm);
      const pad = new THREE.Mesh(rbox(0.06, 0.012, 0.05, 0.005), leather); pad.position.set(0, -0.018, -0.03); h.add(pad);
      const knuckle = new THREE.Mesh(rbox(0.07, 0.014, 0.022, 0.006), rubber); knuckle.position.set(0, 0.02, -0.066); h.add(knuckle);
      // fingers: closed around the grip (right) or half-closed under the handguard (support)
      const curl = grip ? [1.25, 1.35, 0.9] : [0.75, 0.85, 0.55];
      [-0.027, -0.009, 0.009, 0.027].forEach((x, k) => h.add(finger(x, curl, k === 3 ? [0.022, 0.016, 0.014] : [0.026, 0.02, 0.016], k === 3 ? 0.0078 : 0.0088)));
      // thumb: from the side of the palm, wrapping across
      const th = new THREE.Group(); th.position.set(-0.038, -0.006, -0.024); th.rotation.set(0.35, grip ? 0.55 : 0.35, grip ? 0.9 : 0.5);
      const t1 = capsule(0.0098, 0.03); th.add(t1); const t2g = new THREE.Group(); t2g.position.z = -0.03; t1.add(t2g); const t2 = capsule(0.0092, 0.024); t2.rotation.x = -0.5; t2g.add(t2);
      h.add(th);
      const flat = flatten(h);
      flat.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      return flat;
    };
    const right = mkHand(true); g.add(right);
    right.position.set(0.02, -0.07, 0.08); right.rotation.set(0.28, 0.12, -1.25);
    const left = mkHand(false); g.add(left);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.035, 14, 1, true), S({ color: T.accent, roughness: 0.6, side: THREE.DoubleSide }));
    band.rotation.x = Math.PI / 2; band.position.z = 0.2; left.add(band);
    left.position.set(-0.07, -0.03, -0.2); left.rotation.set(0.25, -0.55, 1.2);
    return { group: g, right, left };
  }

  const nadeAlias = (m) => (m === 'flashbang' || m === 'smokegren') ? 'grenade' : m;
  return { gun: (m) => (BV.Real && BV.Real.gun(m)) || importedGun(nadeAlias(m)) || detailGun(nadeAlias(m), gun(nadeAlias(m))), soldier, viewArms, mat, mergeTree, uniformSkinFor, ravenHead, rbox, vestSkin, operatorFabric, gearTex, flatten };
})();
