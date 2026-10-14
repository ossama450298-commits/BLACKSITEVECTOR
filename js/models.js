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
      g.fillStyle = '#6a4526'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${30 + r() * 20 | 0},15,5,${0.1 + Math.abs(Math.sin(y * 0.4 + r())) * 0.18})`; g.fillRect(0, y, w, 1); }
    });
  }
  function S(o) { return new THREE.MeshStandardMaterial(o); }
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache[key]) matCache[key] = S(Object.assign({ color, roughness: 0.7, metalness: 0 }, opts || {}));
    return matCache[key];
  }
  const M = {
    dark: () => matCache.gdark || (matCache.gdark = S({ map: wearTex(0x2c2f31), roughness: 0.42, metalness: 0.75 })),
    steel: () => matCache.gsteel || (matCache.gsteel = S({ map: wearTex(0x707578), roughness: 0.32, metalness: 0.9 })),
    poly: () => matCache.gpoly || (matCache.gpoly = S({ map: wearTex(0x222324), roughness: 0.68, metalness: 0.05 })),
    wood: () => matCache.gwood || (matCache.gwood = S({ map: woodTex(), roughness: 0.55, metalness: 0 })),
    olive: () => matCache.golive || (matCache.golive = S({ map: wearTex(0x4c5236), roughness: 0.6, metalness: 0.15 })),
    bright: () => matCache.gbright || (matCache.gbright = S({ color: 0xd2d6da, roughness: 0.16, metalness: 1 })),
    tan: () => matCache.gtan || (matCache.gtan = S({ map: wearTex(0x8a7656), roughness: 0.7, metalness: 0.05 }))
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
  const geo = {
    cyl: (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 12),
    sph: (r, ws, hs) => new THREE.SphereGeometry(r, ws || 14, hs || 10),
    cap: (r, ts) => new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, ts)
  };
  /* ---------------- weapons (pointing -Z, origin at the grip) ----------------
     Each firearm is built from side-view profiles extruded with a bevel, so
     silhouettes are smooth and chamfered instead of box-shaped. Profiles are
     written as [forward, up] pairs; forward +f maps to world -Z.            */
  function prof(parent, pts, thick, m, x) {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    const bt = Math.min(0.006, thick * 0.18);
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, thick - bt * 2), bevelEnabled: true, bevelThickness: bt, bevelSize: bt * 0.8, bevelSegments: 2, curveSegments: 4 });
    g.rotateY(Math.PI / 2); g.translate(-(thick - bt * 2) / 2 + (x || 0), 0, 0);
    g.computeVertexNormals();
    const me = new THREE.Mesh(g, m); me.castShadow = true; parent.add(me); return me;
  }
  function tube(parent, r, f0, f1, y, m, seg, x) {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(f1 - f0), seg || 14), m);
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
    mergeTree(g);
    g.add(muzzle);
    return { group: g, muzzle, mag, magHome: mag ? mag.position.clone() : null };
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
        const pos = [], nor = [], uv = [];
        for (const me of list) {
          me.updateMatrix();
          let gg = me.geometry.clone(); gg.applyMatrix4(me.matrix); if (gg.index) gg = gg.toNonIndexed();
          pos.push(gg.attributes.position.array); nor.push(gg.attributes.normal.array);
          uv.push(gg.attributes.uv ? gg.attributes.uv.array : new Float32Array(gg.attributes.position.count * 2));
          grp.remove(me);
        }
        const cat = (arrs) => { let n = 0; arrs.forEach(a => n += a.length); const o = new Float32Array(n); let k = 0; arrs.forEach(a => { o.set(a, k); k += a.length; }); return o; };
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(cat(pos), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(cat(nor), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(cat(uv), 2));
        geo.computeBoundingSphere();
        const mm = new THREE.Mesh(geo, m); mm.castShadow = true; mm.receiveShadow = true; grp.add(mm);
      }
    }
    return root;
  }

  /* ---------------- soldiers ---------------- */
  function soldier(teamId) {
    const T = BV.TEAMS[teamId], V = teamId === 'VANGUARD';
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const mats = [];
    const m = (o) => { const mm = S(Object.assign({ roughness: 0.85, metalness: 0 }, o)); mm.userData.base = mm.color.clone(); mats.push(mm); return mm; };
    const fab = fabric(T.uniform, V ? 'digital' : 'blot');
    const mU = m({ map: fab }), mUd = m({ map: fab, color: 0xb0b0b0 });
    const mV = m({ map: wearTex(T.vest), roughness: 0.75 }), mA = m({ color: T.accent, roughness: 0.6 });
    const mSkin = m({ map: faceTex(T.skin, V ? 'face' : 'mask'), roughness: 0.65 });
    const mSkinPlain = m({ color: T.skin, roughness: 0.65 });
    const mH = m({ color: T.helmet, roughness: 0.75, metalness: 0.0 });
    const mBoot = m({ color: 0x1d1b18, roughness: 0.6 }), mGlove = m({ color: 0x24211d, roughness: 0.7 });
    const mStrap = m({ color: 0x2a2924, roughness: 0.8 });

    const mkLeg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.92, 0);
      part(p, geo.cyl(0.088, 0.07, 0.47, 10), mU, 0, -0.235, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.47, 0); p.add(knee);
      part(knee, geo.sph(0.07, 10, 8), mU, 0, 0, 0);
      part(knee, geo.cyl(0.068, 0.054, 0.4, 10), mUd, 0, -0.2, 0);
      if (V) part(knee, geo.sph(0.066, 10, 6), mV, 0, 0.0, -0.05, 1, 1.1, 0.6);
      const boot = new THREE.Group(); boot.position.set(0, -0.4, 0); knee.add(boot);
      part(boot, new THREE.BoxGeometry(0.12, 0.13, 0.2), mBoot, 0, -0.01, 0.01);
      part(boot, geo.sph(0.07, 10, 6), mBoot, 0, -0.03, -0.1, 0.9, 0.7, 1.1);
      part(boot, new THREE.BoxGeometry(0.13, 0.03, 0.29), mStrap, 0, -0.075, -0.035);
      body.add(p); return { hip: p, knee };
    };
    const L = mkLeg(-0.105), R = mkLeg(0.105);

    const torso = new THREE.Group(); torso.position.set(0, 0.92, 0); body.add(torso);
    part(torso, geo.cyl(0.165, 0.155, 0.2, 14), mUd, 0, 0.06, 0, 1, 1, 0.72);              // pelvis
    part(torso, geo.cyl(0.15, 0.162, 0.2, 14), mU, 0, 0.23, 0, 1, 1, 0.7);                 // abdomen
    part(torso, geo.cyl(0.205, 0.155, 0.34, 14), mU, 0, 0.44, 0, 1, 1, 0.64);              // chest
    part(torso, geo.sph(0.09), mU, -0.2, 0.55, 0); part(torso, geo.sph(0.09), mU, 0.2, 0.55, 0); // shoulders
    part(torso, new THREE.BoxGeometry(0.34, 0.05, 0.25), mStrap, 0, 0.14, 0);              // belt
    part(torso, new THREE.BoxGeometry(0.05, 0.04, 0.02), m({ color: 0x8b8b80, metalness: 0.8, roughness: 0.3 }), 0, 0.14, -0.13);
    if (V) {
      part(torso, new THREE.BoxGeometry(0.34, 0.34, 0.07), mV, 0, 0.43, -0.13);            // front plate
      part(torso, new THREE.BoxGeometry(0.34, 0.36, 0.07), mV, 0, 0.43, 0.13);             // back plate
      part(torso, new THREE.BoxGeometry(0.42, 0.14, 0.27), mV, 0, 0.32, 0);                // cummerbund
      for (let i = -1; i <= 1; i++) part(torso, new THREE.BoxGeometry(0.085, 0.13, 0.05), mV, i * 0.1, 0.33, -0.18); // mag pouches
      part(torso, new THREE.BoxGeometry(0.07, 0.09, 0.05), mStrap, 0.2, 0.33, -0.05);       // radio
      part(torso, geo.cyl(0.006, 0.006, 0.28, 4), mStrap, 0.21, 0.55, 0.06);                // antenna
      part(torso, new THREE.BoxGeometry(0.07, 0.04, 0.012), mA, -0.11, 0.55, -0.168);        // ID patch
      part(torso, new THREE.BoxGeometry(0.06, 0.09, 0.3), mV, -0.14, 0.58, 0); part(torso, new THREE.BoxGeometry(0.06, 0.09, 0.3), mV, 0.14, 0.58, 0); // straps
    } else {
      const xs = new THREE.BoxGeometry(0.05, 0.46, 0.012);
      const s1 = part(torso, xs, mStrap, 0, 0.42, -0.135); s1.rotation.z = 0.55;
      const s2 = part(torso, xs, mStrap, 0, 0.42, -0.135); s2.rotation.z = -0.55;
      for (let i = -1; i <= 1; i += 2) part(torso, new THREE.BoxGeometry(0.1, 0.12, 0.06), mV, i * 0.1, 0.29, -0.15);
      part(torso, new THREE.BoxGeometry(0.3, 0.34, 0.15), mV, 0, 0.42, 0.18);                 // pack
      const roll = part(torso, geo.cyl(0.06, 0.06, 0.32, 10), mStrap, 0, 0.64, 0.17); roll.rotation.z = Math.PI / 2;
      part(torso, geo.cyl(0.006, 0.006, 0.34, 4), mStrap, -0.1, 0.72, 0.2);                   // antenna
    }
    part(torso, geo.cyl(0.055, 0.062, 0.1, 10), mSkinPlain, 0, 0.64, 0);                      // neck
    const head = new THREE.Group(); head.position.set(0, 0.66, 0); torso.add(head);
    const hs = part(head, geo.sph(0.112, 18, 14), mSkin, 0, 0.13, 0, 0.92, 1.06, 1.0); hs.rotation.y = 0;
    if (V) {
      part(head, geo.cap(0.138, Math.PI * 0.5), mH, 0, 0.15, 0.005, 1, 0.95, 1.06);           // helmet shell
      const rim = part(head, new THREE.TorusGeometry(0.137, 0.01, 6, 20), mH, 0, 0.152, 0.005, 1, 1, 1.06); rim.rotation.x = Math.PI / 2;
      part(head, new THREE.BoxGeometry(0.05, 0.04, 0.03), m({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }), 0, 0.25, -0.13); // NVG mount
      for (const sx of [-1, 1]) { const ear = part(head, geo.cyl(0.045, 0.045, 0.04, 12), mStrap, sx * 0.112, 0.12, 0.005); ear.rotation.z = Math.PI / 2; }
      part(head, new THREE.BoxGeometry(0.16, 0.012, 0.012), mStrap, 0, 0.03, -0.06);         // chin strap
    } else {
      part(head, geo.cap(0.135, Math.PI * 0.62), mUd, 0, 0.14, 0.03, 1.04, 1.04, 1.1);       // hood
      const gm = m({ color: 0x281310, emissive: 0x5a1208, roughness: 0.1, metalness: 0.5 });
      for (const sx of [-1, 1]) { const lens = part(head, geo.cyl(0.03, 0.032, 0.03, 12), gm, sx * 0.04, 0.155, -0.1); lens.rotation.x = Math.PI / 2; }
      const strap = part(head, new THREE.TorusGeometry(0.113, 0.008, 4, 20), mStrap, 0, 0.155, 0); strap.rotation.x = Math.PI / 2;
    }
    // arms (rifle hold pose)
    const mkArm = (sx) => {
      const a = new THREE.Group(); a.position.set(sx * 0.22, 0.53, 0); torso.add(a);
      part(a, geo.cyl(0.062, 0.052, 0.29, 10), mU, 0, -0.14, 0);
      const f = new THREE.Group(); f.position.set(0, -0.28, 0); a.add(f);
      part(f, geo.sph(0.054, 10, 8), mU, 0, 0, 0);
      part(f, geo.cyl(0.052, 0.042, 0.26, 10), mUd, 0, -0.13, 0);
      part(f, geo.sph(0.048, 10, 8), mGlove, 0, -0.29, -0.01, 0.85, 1.15, 1.1);
      return { a, f };
    };
    const AR = mkArm(1), AL = mkArm(-1);
    const armR = AR.a, foreR = AR.f, armL = AL.a, foreL = AL.f;
    armR.rotation.set(-0.6, 0, 0.15); foreR.rotation.x = -1.0;
    armL.rotation.set(-1.1, 0, -0.5); foreL.rotation.x = -0.6;
    if (!V) part(armL, geo.cyl(0.066, 0.066, 0.06, 10), mA, 0, -0.1, 0);                    // armband
    else part(armL, new THREE.BoxGeometry(0.06, 0.08, 0.015), mA, 0, -0.1, -0.06);

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
        currentGun.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
        gunHolder.add(currentGun.group);
        api.flashAnchor = currentGun.muzzle;
      },
      animate(dt, speed, crouch, pitch, phase, firing) {
        const k = Math.min(1, speed / 4);
        const sw = Math.sin(phase) * 0.55 * k;
        L.hip.rotation.x = sw - crouch * 1.1; R.hip.rotation.x = -sw - crouch * 1.1;
        L.knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.7 * k + crouch * 1.9;
        R.knee.rotation.x = Math.max(0, Math.sin(phase)) * 0.7 * k + crouch * 1.9;
        body.position.y = -crouch * 0.42 + Math.abs(Math.cos(phase)) * 0.03 * k;
        torso.rotation.x = -pitch * 0.45 + crouch * 0.15;
        torso.rotation.y = Math.sin(phase) * 0.06 * k;
        head.rotation.x = -pitch * 0.4;
        armR.rotation.x = -0.6 - pitch * 0.4 + (firing ? 0.06 : 0);
      },
      die(t) {
        const e = 1 - Math.pow(1 - Math.min(1, t), 3);
        body.rotation.x = -e * 1.48; body.position.y = -e * 0.12;
        shadow.scale.set(1 + e * 0.6, 1 + e * 1.4, 1);
      },
      reset() { body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); shadow.scale.set(1, 1, 1); },
      shade: 1,
      setShade(k) {
        if (Math.abs(k - api.shade) < 0.01) return; api.shade = k;
        for (const mm of mats) mm.color.copy(mm.userData.base).multiplyScalar(k);
      }
    };
    return api;
  }

  /* first-person arms: sleeves, cuffs and gloved hands with fingers */
  function viewArms(teamId) {
    const T = BV.TEAMS[teamId];
    const g = new THREE.Group();
    const sleeve = S({ map: fabric(T.uniform, teamId === 'VANGUARD' ? 'digital' : 'blot'), roughness: 0.9 });
    const glove = S({ color: 0x2a2620, roughness: 0.72 });
    const cuff = S({ color: 0x1f1e1b, roughness: 0.8 });
    const mkHand = (grip) => {
      const h = new THREE.Group();
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.36, 12), sleeve); sl.rotation.x = Math.PI / 2; sl.position.z = 0.2; h.add(sl);
      const cf = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.04, 12), cuff); cf.rotation.x = Math.PI / 2; cf.position.z = 0.03; h.add(cf);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.07, 0.085), glove); palm.position.set(0, -0.005, -0.03); h.add(palm);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.009, 0.05, 6), glove);
        f.position.set(-0.035 + (grip ? 0.0 : 0.0), -0.02 - i * 0.0, -0.06 - i * 0.0);
        f.position.set(0.028, 0.022 - i * 0.017, -0.055); f.rotation.set(0, 0, grip ? Math.PI / 2 : 1.2);
        h.add(f);
      }
      const th = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.05, 6), glove); th.position.set(-0.03, 0.02, -0.06); th.rotation.set(0.8, 0, 0.4); h.add(th);
      return h;
    };
    const right = mkHand(true); g.add(right);
    right.position.set(0.02, -0.07, 0.08); right.rotation.set(0.28, 0.12, 0);
    const left = mkHand(true); g.add(left);
    if (teamId === 'RAVEN') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 12), S({ color: T.accent, roughness: 0.6 })); b.rotation.x = Math.PI / 2; b.position.z = 0.16; left.add(b); }
    left.position.set(-0.07, -0.03, -0.2); left.rotation.set(0.25, -0.55, 0.2);
    return { group: g, right, left };
  }

  return { gun: (m) => detailGun(m, gun(m)), soldier, viewArms, mat, mergeTree };
})();
