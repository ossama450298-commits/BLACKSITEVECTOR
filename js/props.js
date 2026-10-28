/* =====================================================================
   props.js — set dressing for SECTOR-17. Hundreds of small industrial
   objects (pallets, electrical cabinets with LEDs, vents, wall pipe runs,
   cones, tyres, bins, extinguishers, gas bottles, cable trays, debris,
   warning signs, stencilled numbers) drawn with InstancedMesh so the
   whole set costs only a few draw calls. Groups are tagged with a
   detail level so LOW quality can hide the finest layers.
   ===================================================================== */
'use strict';
BV.Props = (function () {
  const groups = [];   // { obj, level }
  const r = BV.U.rng(1717);
  const V3 = THREE.Vector3;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new V3(), tmpP = new V3(), tmpE = new THREE.Euler();

  function ctex(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); paint(g, w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  const S = (o) => BV.mat(o);
  function add(scene, obj, level) { scene.add(obj); groups.push({ obj, level }); return obj; }
  /* instanced helper: list of {p:[x,y,z], ry, s:[sx,sy,sz], rx, rz} */
  function instanced(scene, geo, mat, list, level, cast) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      tmpE.set(it.rx || 0, it.ry || 0, it.rz || 0); tmpQ.setFromEuler(tmpE);
      tmpP.set(it.p[0], it.p[1], it.p[2]); const sc = it.s || [1, 1, 1]; tmpS.set(sc[0], sc[1], sc[2]);
      tmpM.compose(tmpP, tmpQ, tmpS); im.setMatrixAt(i, tmpM);
    });
    im.castShadow = cast !== false; im.receiveShadow = true;
    return add(scene, im, level);
  }
  /* merge several geometries (with local transforms) into one */
  function mergeGeos(parts) {
    const pos = [], nor = [], uv = [];
    for (const [geo, m] of parts) {
      let g = geo.clone(); if (m) g.applyMatrix4(m); if (g.index) g = g.toNonIndexed();
      pos.push(g.attributes.position.array); nor.push(g.attributes.normal.array); uv.push(g.attributes.uv.array);
    }
    const cat = (a) => { let n = 0; a.forEach(x => n += x.length); const o = new Float32Array(n); let k = 0; a.forEach(x => { o.set(x, k); k += x.length; }); return o; };
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(cat(pos), 3)); out.setAttribute('normal', new THREE.BufferAttribute(cat(nor), 3)); out.setAttribute('uv', new THREE.BufferAttribute(cat(uv), 2));
    out.computeBoundingSphere(); return out;
  }
  const T = (x, y, z, ry, sx, sy, sz) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new V3(sx || 1, sy || 1, sz || 1));

  /* ---------- textures ---------- */
  const woodT = () => ctex(128, 128, (g, w, h) => {
    g.fillStyle = '#8a6a42'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${60 + Math.random() * 30 | 0},${40 + Math.random() * 15 | 0},20,${0.12 + Math.random() * 0.12})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(40,25,10,0.35)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 4, 1.5, 0, 0, 7); g.fill(); }
    for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(30,20,10,0.15)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 1); }
  });
  const cabinetT = () => ctex(128, 160, (g, w, h) => {
    g.fillStyle = '#e4e5e0'; g.fillRect(0, 0, w, h);   // painted white (a grey/metal finish read as blue under HARBOR-9's night sky)
    g.strokeStyle = '#a3a59f'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12); g.beginPath(); g.moveTo(w / 2, 6); g.lineTo(w / 2, h - 6); g.stroke();
    g.fillStyle = '#e3b52c'; g.beginPath(); g.moveTo(w * 0.25, 30); g.lineTo(w * 0.36, 50); g.lineTo(w * 0.14, 50); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('!', w * 0.25, 48);
    g.font = 'bold 10px Arial'; g.fillText('400 V', w * 0.25, 66); g.fillText('S17-E' + (Math.random() * 90 + 10 | 0), w * 0.75, 30);
    g.fillStyle = '#2d2f2c'; g.fillRect(w / 2 - 14, h / 2 - 4, 8, 14); g.fillRect(w / 2 + 6, h / 2 - 4, 8, 14);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,60,25,${Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h * 0.4 + h * 0.6, 2, 10 + Math.random() * 30); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  const ventT = () => ctex(64, 64, (g, w, h) => {
    g.fillStyle = '#3a3d3a'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 4; y += 6) { g.fillStyle = '#121312'; g.fillRect(5, y, w - 10, 3); g.fillStyle = 'rgba(200,200,190,0.25)'; g.fillRect(5, y + 3, w - 10, 1); }
    g.strokeStyle = '#555952'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
  });
  const signT = (bg, fg, lines, icon) => ctex(256, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    if (icon) { g.fillStyle = fg; g.beginPath(); g.moveTo(48, 30); g.lineTo(80, 86); g.lineTo(16, 86); g.fill(); g.fillStyle = bg; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('!', 48, 80); }
    g.fillStyle = fg; g.textAlign = icon ? 'left' : 'center';
    lines.forEach((l, i) => { g.font = (i ? '' : 'bold ') + (i ? 20 : 30) + 'px Impact, Arial'; g.fillText(l, icon ? 96 : w / 2, 58 + i * 32); });
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(120,60,20,0.35)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 14); }
  });
  const coneT = () => ctex(32, 64, (g, w, h) => { g.fillStyle = '#d4521f'; g.fillRect(0, 0, w, h); g.fillStyle = '#e6e2d6'; g.fillRect(0, h * 0.3, w, h * 0.12); g.fillRect(0, h * 0.58, w, h * 0.1); });
  const paperT = () => ctex(32, 32, (g, w, h) => { g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(60,60,60,0.5)'; for (let y = 6; y < 28; y += 4) g.fillRect(4, y, 18 + Math.random() * 6, 1); });

  function onWallSpot(boxes, minH, need) {
    // returns positions on the outside of tall wall faces, avoiding collisions
    const out = [];
    let guard = 0;
    while (out.length < need && guard++ < need * 40) {
      const b = boxes[Math.floor(r() * boxes.length)];
      if (!b.solid || b.max[1] - b.min[1] < minH || b.min[1] > 0.1) continue;
      const face = Math.floor(r() * 4);
      let x, z, ry;
      if (face === 0) { x = b.min[0] + r() * (b.max[0] - b.min[0]); z = b.min[2]; ry = Math.PI; }
      else if (face === 1) { x = b.min[0] + r() * (b.max[0] - b.min[0]); z = b.max[2]; ry = 0; }
      else if (face === 2) { x = b.min[0]; z = b.min[2] + r() * (b.max[2] - b.min[2]); ry = -Math.PI / 2; }
      else { x = b.max[0]; z = b.min[2] + r() * (b.max[2] - b.min[2]); ry = Math.PI / 2; }
      const nx = Math.sin(ry), nz = Math.cos(ry);
      if (Math.abs(x) > 61.9 || Math.abs(z) > 43.9) continue;
      if (BV.Physics.collide(x + nx * 0.6, 0.3, z + nz * 0.6, 0.35, 1.6)) continue;
      out.push({ x, z, ry, nx, nz });
    }
    return out;
  }

  function build(scene, boxes, isIndoor) {
    const M = BV.Models.mat;
    /* --- pallets (stacked), solid-free decoration near walls --- */
    const wood = S({ map: woodT(), roughness: 0.85 });
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push([new THREE.BoxGeometry(1.2, 0.025, 0.14), T(0, 0.135, -0.48 + i * 0.24)]);
    for (let i = 0; i < 3; i++) parts.push([new THREE.BoxGeometry(1.2, 0.1, 0.1), T(0, 0.07, -0.45 + i * 0.45)]);
    for (let i = 0; i < 3; i++) parts.push([new THREE.BoxGeometry(1.2, 0.022, 0.1), T(0, 0.011, -0.45 + i * 0.45)]);
    const palletGeo = mergeGeos(parts);
    const palletList = [];
    onWallSpot(boxes, 3, 26).forEach(sp => {
      const n = 1 + Math.floor(r() * 4), ox = sp.x + sp.nx * 0.65, oz = sp.z + sp.nz * 0.65;
      for (let k = 0; k < n; k++) palletList.push({ p: [ox + (r() - 0.5) * 0.08, k * 0.148, oz + (r() - 0.5) * 0.08], ry: sp.ry + (r() - 0.5) * 0.15 });
    });
    instanced(scene, palletGeo, wood, palletList, 0);

    /* --- electrical cabinets with status LEDs --- */
    const cabMat = S({ map: cabinetT(), roughness: 0.62, metalness: 0.1 });   // low metalness: no sky reflection
    const cabGeo = new THREE.BoxGeometry(0.9, 1.15, 0.3);
    const cabs = onWallSpot(boxes, 3, 22), cabList = [], ledP = [], ledC = [];
    cabs.forEach(sp => {
      const y = 1.25 + r() * 0.3;
      cabList.push({ p: [sp.x + sp.nx * 0.15, y, sp.z + sp.nz * 0.15], ry: sp.ry });
      for (let k = 0; k < 3; k++) {
        const lx = Math.cos(sp.ry) * (-0.3 + k * 0.08), lz = -Math.sin(sp.ry) * (-0.3 + k * 0.08);
        ledP.push(sp.x + sp.nx * 0.31 + lx, y + 0.42, sp.z + sp.nz * 0.31 + lz);
        const c = new THREE.Color([0x30ff60, 0xff3020, 0xffb020][Math.floor(r() * 3)]); ledC.push(c.r, c.g, c.b);
      }
      // conduit from cabinet to the roofline
      cablesFrom.push([sp.x + sp.nx * 0.12, y + 0.57, sp.z + sp.nz * 0.12]);
    });
    instanced(scene, cabGeo, cabMat, cabList, 0);
    const ledGeo = new THREE.BufferGeometry(); ledGeo.setAttribute('position', new THREE.Float32BufferAttribute(ledP, 3)); ledGeo.setAttribute('color', new THREE.Float32BufferAttribute(ledC, 3));
    leds = new THREE.Points(ledGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, map: BV.Textures.glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    add(scene, leds, 1);
    const conduitList = cablesFrom.map(p => ({ p: [p[0], p[1] + 1.6, p[2]], s: [1, 3.2, 1] }));
    instanced(scene, new THREE.CylinderGeometry(0.035, 0.035, 1, 6), S({ color: 0x5a5d58, roughness: 0.5, metalness: 0.6 }), conduitList, 1, false);

    /* --- wall vents / grilles --- */
    const ventList = onWallSpot(boxes, 4, 30).map(sp => ({ p: [sp.x + sp.nx * 0.03, 2.6 + r() * 2.5, sp.z + sp.nz * 0.03], ry: sp.ry }));
    instanced(scene, new THREE.BoxGeometry(0.75, 0.55, 0.06), S({ map: ventT(), roughness: 0.6, metalness: 0.5 }), ventList, 1, false);

    /* --- horizontal pipe runs with brackets along long walls --- */
    const pipeList = [], bracketList = [];
    const runs = [[-40, -9.82, -15, 3.3], [-11, -9.82, 18, 3.6], [-40, 9.82, -5, 3.4], [-1, 9.82, 18, 3.1], [-40, 30.2, 22, 3.7], [22, 14.2, 52, 2.9], [32, -14.2, 52, 3.8]];
    for (const [x0, z, x1, y] of runs) {
      for (const dy of [0, 0.32]) pipeList.push({ p: [(x0 + x1) / 2, y + dy, z], rz: Math.PI / 2, s: [1, x1 - x0, 1] });
      for (let x = x0 + 1; x < x1; x += 2.5) bracketList.push({ p: [x, y + 0.16, z], s: [1, 1, 1] });
    }
    instanced(scene, new THREE.CylinderGeometry(0.09, 0.09, 1, 10), S({ color: 0x56604f, roughness: 0.45, metalness: 0.6 }), pipeList, 0);
    instanced(scene, new THREE.BoxGeometry(0.08, 0.6, 0.26), S({ color: 0x2b2d2a, roughness: 0.6, metalness: 0.6 }), bracketList, 1, false);

    /* --- tunnel cable tray + bundled cables --- */
    const trayGeo = mergeGeos([[new THREE.BoxGeometry(62, 0.03, 0.5), T(0, 0, 0)], [new THREE.BoxGeometry(62, 0.12, 0.03), T(0, 0.06, -0.25)], [new THREE.BoxGeometry(62, 0.12, 0.03), T(0, 0.06, 0.25)]]);
    instanced(scene, trayGeo, S({ color: 0x6a6e68, roughness: 0.5, metalness: 0.7 }), [{ p: [-9, 3.95, 31.2] }], 0, false);
    const cableMat = S({ color: 0x161616, roughness: 0.7 });
    for (let k = 0; k < 4; k++) instanced(scene, new THREE.CylinderGeometry(0.025, 0.025, 62, 6), cableMat, [{ p: [-9, 4.0, 31.05 + k * 0.1], rz: Math.PI / 2 }], 1, false);

    /* --- floor clutter: cones, tyres, bins, bags, extinguishers, gas bottles, buckets --- */
    const floorSpots = (n, inside) => {
      const out = []; let guard = 0;
      while (out.length < n && guard++ < n * 50) {
        const x = -60 + r() * 120, z = -42 + r() * 84;
        if (inside !== undefined && isIndoor(x, 0.5, z) !== inside) continue;
        if (BV.Physics.collide(x, 0.05, z, 0.45, 1)) continue;
        // keep clutter near walls so lanes stay readable
        if (!BV.Physics.collide(x, 0.05, z, 1.4, 1)) continue;
        out.push([x, z]);
      }
      return out;
    };
    const cone = S({ map: coneT(), roughness: 0.6 });
    instanced(scene, new THREE.ConeGeometry(0.17, 0.62, 12), cone, floorSpots(16).map(p => ({ p: [p[0], 0.31, p[1]], ry: r() * 6 })), 1);
    instanced(scene, new THREE.BoxGeometry(0.4, 0.04, 0.4), S({ color: 0xc2471c, roughness: 0.6 }), [], 1);
    instanced(scene, new THREE.TorusGeometry(0.33, 0.12, 8, 16), S({ color: 0x141414, roughness: 0.9 }),
      floorSpots(20).flatMap(p => { const n = 1 + Math.floor(r() * 3); return Array.from({ length: n }, (_, k) => ({ p: [p[0] + (r() - 0.5) * 0.1, 0.12 + k * 0.23, p[1] + (r() - 0.5) * 0.1], rx: Math.PI / 2, rz: r() })); }), 0);
    const bin = mergeGeos([[new THREE.CylinderGeometry(0.32, 0.28, 0.85, 14, 1, true), T(0, 0.425, 0)], [new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14), T(0, 0.86, 0)]]);
    instanced(scene, bin, S({ color: 0x3d4a3a, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), floorSpots(12).map(p => ({ p: [p[0], 0, p[1]], ry: r() * 6 })), 1);
    const bag = new THREE.SphereGeometry(0.3, 10, 8); bag.scale(1, 0.8, 0.9);
    instanced(scene, bag, S({ color: 0x18191a, roughness: 0.35, metalness: 0.1 }), floorSpots(28).map(p => ({ p: [p[0], 0.2, p[1]], ry: r() * 6, s: [0.8 + r() * 0.5, 0.7 + r() * 0.5, 0.8 + r() * 0.5] })), 1);
    const ext = mergeGeos([[new THREE.CylinderGeometry(0.075, 0.075, 0.45, 12), T(0, 0.225, 0)], [new THREE.SphereGeometry(0.075, 10, 6), T(0, 0.45, 0)], [new THREE.CylinderGeometry(0.02, 0.02, 0.08, 6), T(0, 0.53, 0)]]);
    instanced(scene, ext, S({ color: 0xb21f17, roughness: 0.35, metalness: 0.3 }), onWallSpot(boxes, 3, 14).map(sp => ({ p: [sp.x + sp.nx * 0.12, 0, sp.z + sp.nz * 0.12], ry: sp.ry })), 1);
    const bottle = mergeGeos([[new THREE.CylinderGeometry(0.11, 0.11, 1.25, 12), T(0, 0.625, 0)], [new THREE.SphereGeometry(0.11, 10, 6), T(0, 1.25, 0)], [new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), T(0, 1.38, 0)]]);
    instanced(scene, bottle, S({ color: 0x2f5f86, roughness: 0.3, metalness: 0.4 }), onWallSpot(boxes, 3, 12).flatMap(sp => [0, 1, 2].slice(0, 1 + Math.floor(r() * 3)).map(k => ({ p: [sp.x + sp.nx * 0.15 + Math.cos(sp.ry) * k * 0.24, 0, sp.z + sp.nz * 0.15 - Math.sin(sp.ry) * k * 0.24], ry: r() * 6 }))), 1);
    const bucket = new THREE.CylinderGeometry(0.16, 0.13, 0.32, 12, 1, true); bucket.translate(0, 0.16, 0);
    instanced(scene, bucket, S({ color: 0x9a9070, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), floorSpots(14).map(p => ({ p: [p[0], 0, p[1]], ry: r() * 6 })), 2);
    // paper / rubbish litter
    const paper = new THREE.PlaneGeometry(0.22, 0.3); paper.rotateX(-Math.PI / 2);
    instanced(scene, paper, S({ map: paperT(), roughness: 0.9, side: THREE.DoubleSide }), floorSpots(120).map(p => ({ p: [p[0], 0.008, p[1]], ry: r() * 6, rz: (r() - 0.5) * 0.1 })), 2, false);
    // concrete rubble chunks along walls
    instanced(scene, new THREE.DodecahedronGeometry(0.16, 0), S({ map: BV.Textures.make('concrete'), roughness: 0.95 }),
      floorSpots(160).map(p => ({ p: [p[0], 0.05, p[1]], rx: r() * 3, ry: r() * 3, s: [0.5 + r() * 1.4, 0.3 + r() * 0.6, 0.5 + r() * 1.2] })), 2);

    /* --- warning signs and stencilled numbers --- */
    const signs = [
      signT('#d6a72a', '#151515', ['DANGER', 'HIGH VOLTAGE'], true), signT('#2c3b2e', '#e5e0cc', ['ZONE 4', 'FORKLIFT ROUTE'], false),
      signT('#8a1f16', '#efe6d2', ['NO ENTRY', 'SECURITY AREA'], true), signT('#e6e1d3', '#1b1b1b', ['HARD HAT', 'AREA'], true),
      signT('#1f3a55', '#e5e0cc', ['ASSEMBLY', 'POINT  B'], false)
    ];
    onWallSpot(boxes, 3, 18).forEach((sp, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56), S({ map: signs[i % signs.length], roughness: 0.55, metalness: 0.3 }));
      m.position.set(sp.x + sp.nx * 0.02, 1.7 + r() * 0.6, sp.z + sp.nz * 0.02); m.rotation.y = sp.ry; m.receiveShadow = true; add(scene, m, 1);
    });
    const nums = ['17', 'B-02', '04', 'A-11', '09', '23', 'GATE 3', 'S-17'];
    onWallSpot(boxes, 4, 12).forEach((sp, i) => {
      const t = BV.Textures.stencil(nums[i % nums.length], 'rgba(220,214,195,0.75)', 256, 'bold 120px Impact, "Arial Black", sans-serif');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), S({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(sp.x + sp.nx * 0.015, 3.2 + r() * 1.2, sp.z + sp.nz * 0.015); m.rotation.y = sp.ry; m.receiveShadow = true; add(scene, m, 1);
    });
    /* --- floor stains: break up texture tiling on large floors --- */
    const stainTex = BV.Textures.make('stain'); stainTex.wrapS = stainTex.wrapT = THREE.ClampToEdgeWrapping;
    const stainMat = new THREE.MeshBasicMaterial({ map: stainTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, color: 0xffffff });
    const st = []; let gs = 0;
    while (st.length < 130 && gs++ < 3000) { const x = -61 + r() * 122, z = -43 + r() * 86; if (BV.Physics.collide(x, 0.05, z, 0.6, 0.5)) continue; const k = 1.5 + r() * 3.5; st.push({ p: [x, 0.004, z], rx: -Math.PI / 2, rz: r() * 6.28, s: [k, k * (0.6 + r() * 0.8), 1] }); }
    instanced(scene, new THREE.PlaneGeometry(1, 1), stainMat, st, 0, false);
    /* --- grime: dark streak decals at wall bases and corners --- */
    const grime = ctex(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(20,16,10,0.55)'); gr.addColorStop(1, 'rgba(20,16,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const grimeMat = S({ map: grime, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
    instanced(scene, new THREE.PlaneGeometry(2.6, 1.4), grimeMat, onWallSpot(boxes, 3, 90).map(sp => ({ p: [sp.x + sp.nx * 0.012, 0.7, sp.z + sp.nz * 0.012], ry: sp.ry, s: [0.6 + r(), 0.6 + r() * 0.8, 1] })), 1, false);
  }
  const cablesFrom = [];
  let leds = null;
  function update(t) { if (leds) leds.material.opacity = 0.75 + Math.sin(t * 6) * 0.25; }
  function setLevel(maxLevel) { for (const g of groups) g.obj.visible = g.level <= maxLevel; }
  return { build, update, setLevel };
})();
