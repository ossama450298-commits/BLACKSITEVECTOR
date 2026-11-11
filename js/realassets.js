/* =====================================================================
   realassets.js — realistic weapons, soldier and sky (v3.0)
   Decodes js/real_data.js (all CC BY / CC0, see CREDITS.md):
   - weapons are calibrated so the grip sits at the origin, the barrel points
     down -Z, +Y is up and sizes are real-world metres;
   - the soldier template + animation clips retargeted offline from the
     Universal Animation Library to the soldier's Mixamo skeleton.
   ===================================================================== */
'use strict';
BV.Real = (function () {
  const CAL = {
    ak47:   { f: [1, 0, 0],  u: [0, 1, 0], g: [-0.18, -0.015, 0],       m: [0.50, 0.086, 0],        s: 0.88 },
    m4a1:   { f: [0, 0, -1], u: [0, 1, 0], g: [0, -0.17, 0.675],        m: [0, 0.31, -2.4715],      s: 0.174 },
    mp5:    { f: [0, 0, 1],  u: [0, 1, 0], g: [0.0065, -0.013, -0.032], m: [0.0065, 0.047, 0.3258], s: 1.05 },
    r870:   { f: [1, 0, 0],  u: [0, 1, 0], g: [-0.362, -0.083, 0],      m: [1.1703, 0.016, 0],      s: 0.443 },
    sniper: { f: [0, 0, -1], u: [0, 1, 0], g: [0.334, -0.24, 6.9],      m: [0.334, 2.46, -16.29],   s: 0.0369 },
    g19:    { f: [0.70, 0, 0.71], u: [-0.71, 0, 0.70], g: [-0.037, -0.023, 0.151], m: [0.011, -0.023, 0.299], s: 0.92, clip: [-0.04, -0.17, -0.17, 0.04, 0.09, 0.065], clipAll: true }
  };
  // game weapon model id -> [asset, extra scale]
  // pistols: the G19 source is a display scene (rotated pistol + loose parts); the clean CC0
  // Quaternius pistols from js/gun_data.js are used instead until a better realistic pistol arrives
  const USE = { smg: ['mp5', 1], smgCompact: ['mp5', 0.9], shotgun: ['r870', 1],
    rifle: ['ak47', 1], rifleCarbine: ['m4a1', 1], dmr: ['m4a1', 1.05], sniper: ['sniper', 1] };
  const guns = {}, kit = {}, outpost = {}, packs = {}, chars = {}; const carTpl = {}, trainTpl = {}; let sg2 = null, mp5Tpl = null, mp5Len = 29381, spr = null, ak12 = null, gaussTpl = null, gaussBox = null, awm = null, shieldTpl = null, dks = null, colt = null, ar15 = null, flashN = null, smokeN = null, cutter = null, officeKit = null, officeChair = null, hostages = {}; let timebomb = null, ak74 = null, frag = null, makarov = null, soldier = null, city = null, warehouse = null, clips = {}, ready = false;

  function decode(b64) { const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; }
  // models are stored meshopt-compressed with WebP textures (about 60 % smaller); after decoding, every
  // quantized attribute is turned back into plain floats so the CPU-side code (clipping, merging, pack
  // measurements, baking) sees exactly the same data as before
  function toFloat(geo) {
    const G = ['getX', 'getY', 'getZ', 'getW'];
    for (const key of Object.keys(geo.attributes)) {
      if (key === 'skinIndex') continue;
      const at = geo.attributes[key], arr = at.isInterleavedBufferAttribute ? at.data.array : at.array;
      if (arr instanceof Float32Array && !at.isInterleavedBufferAttribute) continue;
      const div = !at.normalized ? 1 : arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : arr instanceof Int8Array ? 127 : arr instanceof Uint8Array ? 255 : 1;
      const n = at.count, sz = at.itemSize, f = new Float32Array(n * sz);
      for (let i = 0; i < n; i++) for (let c = 0; c < sz; c++) { const v = at[G[c]](i) / div; f[i * sz + c] = div === 1 ? v : Math.max(-1, v); }
      geo.setAttribute(key, new THREE.BufferAttribute(f, sz));
    }
  }
  /* a model is either a '@url' (web: one binary file, fetched only when needed, cached by the browser)
     or base64 text (single-file and desktop builds, everything inside) */
  function parse(src) {
    const bytes = typeof src === 'string' && src[0] === '@'
      ? fetch(src.slice(1)).then(r => { if (!r.ok) throw new Error('model ' + src + ': ' + r.status); return r.arrayBuffer(); })
      : Promise.resolve(decode(src));
    return bytes.then(buf => new Promise((res, rej) => {
      const L = new THREE.GLTFLoader();
      if (window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
      L.parse(buf, '', g => { g.scene.traverse(o => { if (o.isMesh && o.geometry) toFloat(o.geometry); }); res(g); }, rej);
    }));
  }
  function unpack(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Int16Array(u.buffer); }
  function buildClip(c) {
    const times = []; for (let f = 0; f < c.frames; f++) times.push(f / c.fps);
    const tracks = c.bones.map((b, i) => { const a = unpack(c.q[i]), v = new Float32Array(a.length); for (let k = 0; k < a.length; k++) v[k] = a[k] / 32767; return new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, v); });
    const h = unpack(c.hip), hv = new Float32Array(h.length), hk = c.hipK || 1000; for (let k = 0; k < h.length; k++) hv[k] = h[k] / hk;
    tracks.push(new THREE.VectorKeyframeTrack(c.hipBone + '.position', times, hv));
    return new THREE.AnimationClip(c.name, (c.frames - 1) / c.fps, tracks);
  }
  // classic style keeps the authored textures but uses period Lambert shading
  // cloth with no metalness map and no metallicFactor defaults to fully metallic in glTF -> black indoors (Night Ops)
  // (some also ship a metalness map that marks the whole uniform as metal): characters' cloth is never metal
  function unmetal(root) { root.traverse(o => { if (!o.isMesh) return; [].concat(o.material).forEach(m => { if (m && m.metalness > 0.5) { m.metalness = 0.05; m.metalnessMap = null; m.needsUpdate = true; } }); }); }
  // hand pieces (gloves) whose transfer left some vertices on the hips / legs / torso stretch when the arm moves:
  // a mesh that mostly follows hand bones keeps only hand (and forearm) influences
  function fixHandWeights(root) {
    root.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight, bones = o.skeleton.bones; if (!SI || !SW) return;
      const isHand = (b) => /Hand/.test(b.name), isArm = (b) => /Hand|ForeArm/.test(b.name), cnt = new Map(); let tot = 0;
      const gi = (A, i, k) => k === 0 ? A.getX(i) : k === 1 ? A.getY(i) : k === 2 ? A.getZ(i) : A.getW(i);
      const si = (A, i, k, v) => k === 0 ? A.setX(i, v) : k === 1 ? A.setY(i, v) : k === 2 ? A.setZ(i, v) : A.setW(i, v);
      for (let i = 0; i < SI.count; i++) for (let k = 0; k < 4; k++) { const w = gi(SW, i, k); if (w > 0.3) { const b = gi(SI, i, k); cnt.set(b, (cnt.get(b) || 0) + 1); tot++; } }
      let hand = 0, top = -1, topN = 0; cnt.forEach((n, b) => { if (isHand(bones[b])) { hand += n; if (n > topN) { topN = n; top = b; } } });
      if (!tot || hand / tot < 0.5 || top < 0) return;            // not a hand piece
      const glove = hand / tot > 0.8 || SI.count < 1500;   // a glove is a small piece; a whole-body skin has thousands of vertices   // a real glove: every stray vertex goes to the hand; otherwise (a skin mesh with dense hands) only mixed ones
      let fixed = 0;
      for (let i = 0; i < SI.count; i++) {
        let best = -1, bw = 0, stray = 0;
        for (let k = 0; k < 4; k++) { const b = gi(SI, i, k), w = gi(SW, i, k); if (w <= 0) continue; if (isArm(bones[b])) { if (w > bw) { bw = w; best = k; } } else stray += w; }
        if (stray <= 0) continue;
        if (best < 0 && !glove) continue;   // face / arm skin of a whole-body mesh: leave it alone
        if (best < 0) { si(SI, i, 0, top); si(SW, i, 0, 1); for (let k = 1; k < 4; k++) si(SW, i, k, 0); }
        else { for (let k = 0; k < 4; k++) if (!isArm(bones[gi(SI, i, k)])) si(SW, i, k, 0); si(SW, i, best, gi(SW, i, best) + stray); }
        fixed++;
      }
      if (fixed) { SI.needsUpdate = true; SW.needsUpdate = true; }
    });
  }
  /* several frame ranges of one animation chained into a single clip (e.g. skip an unwanted part of a reload);
     between two ranges the pose glides linearly over 'gap' seconds (no snap) */
  function joinClips(src, name, ranges, fps, gap) {
    const U = THREE.AnimationUtils, parts = ranges.map(([a, b], i) => U.subclip(src, name + i, a, b, fps)), tracks = {};
    let offset = 0;
    parts.forEach((clip, i) => {
      for (const t of clip.tracks) {
        const e = tracks[t.name] || (tracks[t.name] = { T: t.constructor, times: [], values: [] });
        for (let j = 0; j < t.times.length; j++) e.times.push(t.times[j] + offset);
        for (let j = 0; j < t.values.length; j++) e.values.push(t.values[j]);
      }
      offset += clip.duration + (i < parts.length - 1 ? gap : 0);
    });
    return new THREE.AnimationClip(name, offset, Object.keys(tracks).map(n => new tracks[n].T(n, tracks[n].times, tracks[n].values)));
  }
  function styleMaterials(root) {
    if (!BV.classic) { root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return; }
    root.traverse(o => {
      if (!o.isMesh) return;
      const conv = (m) => { const n = new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, transparent: m.transparent, alphaTest: m.alphaTest, side: m.side, skinning: !!o.isSkinnedMesh }); n.name = m.name; return n; };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    });
  }
  /* classic (2000s) look for the first-person packs: low-res, posterized textures (period hardware,
     8-bit-ish palette) on the Lambert materials styleMaterials() already set up */
  function retroMaps(root) {
    if (!BV.classic) return;
    const done = new Map();
    root.traverse(o => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (!m.map || !m.map.image) return;
        if (!done.has(m.map)) {
          const img = m.map.image, S = 128, c = document.createElement('canvas'); c.width = c.height = S;
          const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(img, 0, 0, S, S);
          const d = x.getImageData(0, 0, S, S), a = d.data, q = 8;               // 32 levels per channel
          for (let i = 0; i < a.length; i += 4) { a[i] = Math.round(a[i] / q) * q; a[i + 1] = Math.round(a[i + 1] / q) * q; a[i + 2] = Math.round(a[i + 2] / q) * q; }
          x.putImageData(d, 0, 0);
          const t = new THREE.CanvasTexture(c); t.encoding = m.map.encoding; t.flipY = m.map.flipY; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT;
          t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 1;
          done.set(m.map, t);
        }
        m.map = done.get(m.map); m.needsUpdate = true;
      });
    });
  }
  // r128 does not de-normalize quantized attributes on the CPU: convert before transforming
  function deNorm(geo) {
    for (const key of Object.keys(geo.attributes)) {
      const at = geo.attributes[key], arr = at.isInterleavedBufferAttribute ? at.data.array : at.array;
      if (!at.normalized && !at.isInterleavedBufferAttribute) continue;
      if (arr instanceof Float32Array && !at.isInterleavedBufferAttribute) continue;
      const div = !at.normalized ? 1 : arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : arr instanceof Int8Array ? 127 : arr instanceof Uint8Array ? 255 : 1;
      const n = at.count, sz = at.itemSize, f = new Float32Array(n * sz), get = ['getX', 'getY', 'getZ', 'getW'];
      for (let i = 0; i < n; i++) for (let k = 0; k < sz; k++) f[i * sz + k] = Math.max(-1, at[get[k]](i) / div) * (div === 1 ? 1 : 1);
      geo.setAttribute(key, new THREE.BufferAttribute(f, sz));
    }
    return geo;
  }
  function clipGeo(geo, b, all) {
    const P = geo.attributes.position, n = geo.index ? geo.index.count : P.count, src = geo.index ? geo.index.array : null, keep = [];
    for (let t = 0; t < n; t += 3) {
      const ia = src ? src[t] : t, ib = src ? src[t + 1] : t + 1, ic = src ? src[t + 2] : t + 2;
      const cx = (P.getX(ia) + P.getX(ib) + P.getX(ic)) / 3, cy = (P.getY(ia) + P.getY(ib) + P.getY(ic)) / 3, cz = (P.getZ(ia) + P.getZ(ib) + P.getZ(ic)) / 3;
      const inside = (i) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return x > b[0] && x < b[3] && y > b[1] && y < b[4] && z > b[2] && z < b[5]; };
      if (all ? (inside(ia) && inside(ib) && inside(ic)) : (cx > b[0] && cx < b[3] && cy > b[1] && cy < b[4] && cz > b[2] && cz < b[5])) keep.push(ia, ib, ic);
    }
    geo.setIndex(keep);
  }
  function calibrate(scene, c) {
    const f = new THREE.Vector3(...c.f).normalize(), u = new THREE.Vector3(...c.u).normalize();
    const r = new THREE.Vector3().crossVectors(f, u).normalize(); u.crossVectors(r, f).normalize();
    const R = new THREE.Matrix4().makeBasis(r, u, f.clone().negate()).transpose();
    const M = new THREE.Matrix4().makeScale(c.s, c.s, c.s).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-c.g[0], -c.g[1], -c.g[2]));
    // bake the calibration (and the file's own node transforms) into a flat template
    scene.updateMatrixWorld(true);
    const tpl = new THREE.Group();
    scene.traverse(o => {
      if (!o.isMesh) return;
      const geo = deNorm(o.geometry.clone()); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld));
      if (c.clip) clipGeo(geo, c.clip, c.clipAll);      // drop stray pieces outside the weapon's real volume
      geo.computeBoundingSphere();
      const me = new THREE.Mesh(geo, o.material); tpl.add(me);
    });
    // muzzle point from the geometry that is actually drawn: centre of the front-most vertices
    // (within 1.2 cm of the tip, close to the bore line); falls back to the calibrated point
    const muzzle = new THREE.Vector3(...c.m).applyMatrix4(M);
    let minZ = Infinity; const pts = [];
    tpl.children.forEach(me => { const P = me.geometry.attributes.position, IX = me.geometry.index, n = IX ? IX.count : P.count; for (let t = 0; t < n; t++) { const i = IX ? IX.getX(t) : t, z = P.getZ(i); if (z < minZ) minZ = z; pts.push(i, me); } });
    let sx = 0, sy = 0, k = 0;
    for (let j = 0; j < pts.length; j += 2) { const P = pts[j + 1].geometry.attributes.position, i = pts[j]; if (P.getZ(i) < minZ + 0.012 && Math.abs(P.getY(i) - muzzle.y) < 0.06) { sx += P.getX(i); sy += P.getY(i); k++; } }
    if (k > 3 && isFinite(minZ)) muzzle.set(sx / k, sy / k, minZ - 0.005);
    return { tpl, muzzle };
  }
  function load() {
    if (!BV.REAL || !THREE.GLTFLoader) return Promise.resolve(false);
    const jobs = Object.keys(BV.REAL.guns).map(k => parse(BV.REAL.guns[k]).then(g => { styleMaterials(g.scene); guns[k] = calibrate(g.scene, CAL[k]); }));
    jobs.push(parse(BV.REAL.soldier).then(g => { styleMaterials(g.scene); soldier = g; }));
    // map-specific assets are decoded only for the map being played (faster start on slower PCs)
    const MID = BV.MAP_ID || 'sector17', need = {
      city: MID !== 'dustline' && MID !== 'meridian', warehouse: MID === 'sector17' || MID === 'harbor9', outpost: MID === 'dustline',
      kit: MID !== 'meridian' && MID !== 'railyard12', office: MID === 'meridian'
    };
    if (BV.REAL.city && need.city) jobs.push(parse(BV.REAL.city).then(g => { styleMaterials(g.scene); city = BV.Models.flatten(g.scene); city.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); }));
    for (const id in PACKS) { const c = PACKS[id]; if (BV.REAL[c.data] && !packs[c.data]) { packs[c.data] = 'loading'; jobs.push(parse(BV.REAL[c.data]).then(g => { styleMaterials(g.scene); packs[c.data] = prepPack(g, c); })); } }
    if (BV.REAL.ak74fp) jobs.push(parse(BV.REAL.ak74fp).then(g => { styleMaterials(g.scene); ak74 = prepAk74(g); }));
    if (BV.REAL.nade_flash) jobs.push(parse(BV.REAL.nade_flash).then(g => { styleMaterials(g.scene); flashN = buildNade(g.scene, 0.135, /^(Pin|Split|PinConnect)_low/); }));
    if (BV.REAL.nade_smoke) jobs.push(parse(BV.REAL.nade_smoke).then(g => { styleMaterials(g.scene); smokeN = buildNade(g.scene, 0.145, null); }));
    if (BV.REAL.cutter) jobs.push(parse(BV.REAL.cutter).then(g => { styleMaterials(g.scene); cutter = g.scene; }));
    if (BV.REAL.office_props && need.office) jobs.push(parse(BV.REAL.office_props).then(g => { styleMaterials(g.scene); officeKit = buildOfficeKit(g.scene); }));
    if (BV.REAL.office_chair && need.office) jobs.push(parse(BV.REAL.office_chair).then(g => { styleMaterials(g.scene); officeChair = bakeUpright(g.scene, 1.05); }));
    for (const k of ['hostage_business', 'hostage_worker']) if (BV.REAL[k] && need.office) jobs.push(parse(BV.REAL[k]).then(g => { styleMaterials(g.scene); unmetal(g.scene); hostages[k] = g.scene; }));
    if (BV.REAL.riot_shield) jobs.push(parse(BV.REAL.riot_shield).then(g => { styleMaterials(g.scene); g.scene.updateMatrixWorld(true);
      let m = null; g.scene.traverse(o => { if (o.isMesh && /riot1/.test(o.name)) m = o; });   // the black ballistic one with a viewport
      if (m) { const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new THREE.Vector3()); geo.translate(-c.x, -c.y, -c.z);
        shieldTpl = new THREE.Mesh(geo, m.material); shieldTpl.castShadow = true; } }));
    if (BV.REAL.gauss) jobs.push(parse(BV.REAL.gauss).then(g => { styleMaterials(g.scene); g.scene.updateMatrixWorld(true);
      // a single skinned mesh: bake its posed shape into static geometry (world space)
      const grp = new THREE.Group(), v = new THREE.Vector3(); gaussBox = new THREE.Box3();
      g.scene.traverse(o => { if (!o.isMesh) return; const geo = o.geometry.clone(); for (const k of ['skinIndex', 'skinWeight']) if (geo.attributes[k]) geo.deleteAttribute(k);
        const P = geo.attributes.position;
        if (o.isSkinnedMesh) { o.skeleton.update(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(o.geometry.attributes.position, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); P.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); }
        else geo.applyMatrix4(o.matrixWorld);
        geo.computeBoundingBox(); gaussBox.union(geo.boundingBox); const m = new THREE.Mesh(geo, o.material); m.name = 'gauss'; grp.add(m); });
      gaussTpl = grp; }));
    if (BV.REAL.mp5) jobs.push(parse(BV.REAL.mp5).then(g => { styleMaterials(g.scene); mp5Tpl = g.scene; }));   // gun only (pre-baked: base, mag, trigger)
    // trains (RAILYARD-12): one template per vehicle kind, built from its parts (named 'kind|part')
    if (MID === 'railyard12' && BV.REAL.trains) jobs.push(parse(BV.REAL.trains).then(g => {
      styleMaterials(g.scene); g.scene.updateMatrixWorld(true); const parts = {};
      g.scene.traverse(o => { if (!o.isMesh) return; let n = o, k = null; while (n && !k) { const m = /^(tank|gondola|flat|diesel)\|/.exec(n.name || ''); if (m) k = m[1]; n = n.parent; } if (k) (parts[k] = parts[k] || []).push(o); });
      for (const k in parts) { if (k === 'diesel' && BV.REAL.loco) continue;   // the SD40 replaces the pack's diesel
        const grp = new THREE.Group(); for (const o of parts[k]) { const c = o.clone(); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); grp.add(c); } trainTpl[k] = grp; }
    }));
    // RAILYARD-12 locomotive: EMD SD40 (Heataker, CC BY), simplified; weathered a little so it does not look factory-new at night
    if (MID === 'railyard12' && BV.REAL.loco) jobs.push(parse(BV.REAL.loco).then(g => {
      // one material shared by all 74 parts: adjust each material ONCE. The author also put the texture in the emissive channel
      // (self-lit): remove that so the yard's lamps light it, then weather it slightly (not factory-new at night)
      styleMaterials(g.scene);
      const seen = new Set();
      g.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { if (seen.has(m)) continue; seen.add(m);
        if (m.emissiveMap) { if (!m.map) m.map = m.emissiveMap; m.emissiveMap = null; } if (m.emissive) m.emissive.setRGB(0, 0, 0);
        if (m.color) m.color.setRGB(0.88, 0.88, 0.86); if ('roughness' in m) m.roughness = Math.max(m.roughness, 0.7); if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.1); m.needsUpdate = true; } });
      trainTpl.diesel = g.scene;
    }));
    // cars: only the map that parks them loads them
    for (const k of (MID === 'sector17' ? ['car_audi', 'car_vaz'] : MID === 'meridian' ? ['car_rusty1', 'car_rusty2'] : []))
      if (BV.REAL[k]) jobs.push(parse(BV.REAL[k]).then(g => { styleMaterials(g.scene); carTpl[k] = g.scene; }));
    if (BV.REAL.shotgun2) jobs.push(parse(BV.REAL.shotgun2).then(g => { styleMaterials(g.scene); sg2 = g.scene; }));
    if (BV.REAL.spr) jobs.push(parse(BV.REAL.spr).then(g => { styleMaterials(g.scene); spr = g.scene; }));
    if (BV.REAL.ak12) jobs.push(parse(BV.REAL.ak12).then(g => { styleMaterials(g.scene); ak12 = g.scene; }));
    if (BV.REAL.awm) jobs.push(parse(BV.REAL.awm).then(g => { styleMaterials(g.scene); awm = g.scene; }));
    if (BV.REAL.dks) jobs.push(parse(BV.REAL.dks).then(g => { styleMaterials(g.scene); dks = g.scene; }));
    if (BV.REAL.ar15) jobs.push(parse(BV.REAL.ar15).then(g => { styleMaterials(g.scene); ar15 = g.scene; }));
    if (BV.REAL.colt) jobs.push(parse(BV.REAL.colt).then(g => { styleMaterials(g.scene); colt = g.scene; }));
    for (const k of ['char_swat', 'char_swat2', 'char_merc']) if (BV.REAL[k]) jobs.push(parse(BV.REAL[k]).then(g => { styleMaterials(g.scene); unmetal(g.scene); fixHandWeights(g.scene); chars[k] = g.scene; }));
    if (BV.REAL.timebomb) jobs.push(parse(BV.REAL.timebomb).then(g => { styleMaterials(g.scene); timebomb = g.scene; }));
    if (BV.REAL.frag) jobs.push(parse(BV.REAL.frag).then(g => { styleMaterials(g.scene); frag = buildFrag(g.scene); }));
    if (BV.REAL.makarov) jobs.push(parse(BV.REAL.makarov).then(g => { styleMaterials(g.scene); makarov = buildMakarov(g.scene); }));
    if (BV.REAL.outpost && need.outpost) jobs.push(parse(BV.REAL.outpost).then(g => { styleMaterials(g.scene); g.scene.children.forEach(c => { c.position.set(0, 0, 0); const f = BV.Models.flatten(c); f.name = c.name; outpost[c.name] = f; }); }));
    if (BV.REAL.warehouse && need.warehouse) jobs.push(parse(BV.REAL.warehouse).then(g => { styleMaterials(g.scene); g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } }); warehouse = g.scene; }));
    if (BV.REAL.kit && need.kit) jobs.push(parse(BV.REAL.kit).then(g => { styleMaterials(g.scene); g.scene.children.forEach(c => { c.traverse(o => { if (o.isMesh && o.material) o.material.side = THREE.DoubleSide; }); c.position.set(0, 0, 0); const f = BV.Models.flatten(c); f.name = c.name; kit[c.name] = f; }); }));
    // character animations: JSON text (web: a .json file; single file: inline)
    const A = BV.REAL.anims;
    if (A) jobs.push((A[0] === '@' ? fetch(A.slice(1)).then(r => r.text()) : Promise.resolve(A)).then(t => { JSON.parse(t).forEach(c => { clips[c.name] = buildClip(c); }); }));
    return Promise.all(jobs).then(() => {
      ready = true; return true;
    }).catch(e => { console.warn('realistic assets failed to load', e); return false; });
  }
  /* ---- first-person packs (DJMaesen, CC BY): arms + weapon + one hand-animated timeline each ----
     frames at 30 fps, cut by watching base / slide / bolt / magazine motion (the pistol follows the
     author's own key list). len = real weapon length (m): the pack is scaled from its own geometry. */
  const PACKS = {
    talon44:  { data: 'fp_revolver', len: 0.27, gy: 0.62, gz: 0.22, world: 'revolver', clips: { fire: [0, 14], reload: [16, 226], reloadEmpty: [16, 226], draw: [244, 268], idle: [268, 296] } },
    warden45: { data: 'fp_pistol',  len: 0.21, gy: 0.62, gz: 0.22, swap: 'colt', clips: { fire: [0, 11], reload: [12, 82], reloadEmpty: [95, 175], draw: [187, 233], idle: [234, 264] } },
    viper9:   { data: 'fp_pistol',  len: 0.21, gy: 0.62, gz: 0.22, clips: { fire: [0, 11], reload: [12, 82], reloadEmpty: [95, 175], draw: [187, 233], idle: [234, 264] } },
    falcon45: { data: 'fp_heavy',   len: 0.23, gy: 0.62, gz: 0.22, clips: { fire: [0, 9], reloadEmpty: [9, 84], reload: [87, 147], idle: [195, 219], draw: [222, 248] } },
    mp5:      { data: 'fp_mac10',   world: 'mac10', yaw: Math.PI, len: 0.5,  gy: 0.5,  gz: 0.3,  clips: { fire: [0, 9], reloadEmpty: [9, 54], reload: [9, 54], idle: [78, 102], draw: [105, 124] } },     // user77 dual MAC-10
    specter9: { data: 'fp_smg',     len: 0.62, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 4], reloadEmpty: [4, 80], reload: [84, 129], idle: [180, 207], draw: [216, 234] } },
    vectormp: { data: 'fp_smg',     len: 0.58, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 4], reloadEmpty: [4, 80], reload: [84, 129], idle: [180, 207], draw: [216, 234] } },
    breaker8: { data: 'fp_r870',    world: 'r870',  yaw: Math.PI, len: 0.95, gy: 0.5,  gz: 0.22, clips: { fire: [0, 27], reload: [[27, 72], [87, 102]], idle: [105, 123], draw: [126, 140] } },                  // user77 Remington 870   // reload = load shells + pump, skipping the sudden 50-degree twist in between (frames 72-87)
    hammer12: { data: 'fp_shotgun', len: 0.95, gy: 0.5,  gz: 0.22, clips: { fire: [0, 27], reload: [[27, 72], [87, 102]], idle: [105, 123], draw: [126, 140] } },   // reload = load shells + pump, skipping the sudden 50-degree twist in between (frames 72-87)
    shade4:   { data: 'fp_m16', world: 'm16', yaw: Math.PI, len: 0.86, gy: 0.5,  gz: 0.3,  sd: true, clips: { fire: [0, 6], reloadEmpty: [6, 69], reload: [72, 135], idle: [177, 204], draw: [207, 222] } },
    halberd4: { data: 'fp_carbine', len: 0.82, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 6], reloadEmpty: [6, 69], reload: [72, 135], idle: [177, 204], draw: [207, 222] } },
    kestrel5: { data: 'fp_carbine', len: 0.86, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 6], reloadEmpty: [6, 69], reload: [72, 135], idle: [177, 204], draw: [207, 222] } },
    ak484:    { data: 'fp_akm',     world: 'akm',   yaw: Math.PI, len: 0.86, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 9], reloadEmpty: [9, 99], reload: [99, 153], idle: [198, 222], draw: [222, 249] } },   // user77 AKM (DJMaesen arms)
    gauss:    { data: 'fp_carbine', swap: 'gauss', len: 0.86, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 6], reloadEmpty: [6, 69], reload: [72, 135], idle: [177, 204], draw: [207, 222] } },
    titan50:  { data: 'fp_l96',     world: 'l96',   yaw: Math.PI, len: 1.3,  gy: 0.5,  gz: 0.3,  clips: { fire: [0, 60], reload: [63, 117], reloadEmpty: [24, 117], idle: [144, 165], draw: [166, 199] } },   // user77 L96A1 (its own timeline, measured: bolt 24-42, magazine 75-99, draw from 168)
    lynx7:    { data: 'fp_sniper',  len: 1.12, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 48], reload: [48, 96], reloadEmpty: [48, 147], idle: [147, 180], draw: [183, 200] } },
    bastion60: { data: 'fp_lmg',    len: 1.05, gy: 0.5,  gz: 0.3,  world: 'lmg', clips: { fire: [0, 9], reload: [27, 168], idle: [216, 249], draw: [252, 276], reloadEmpty: [294, 432] } },
    // knife: same convention as the AK pack (centimetres, +Z forward, right hand at about x -21, shoulders ~60 cm behind)
    bladex:   { data: 'fp_knife', knife: true, fixedScale: 0.0085, place: [0.03, -0.13, -0.44], clips: { idle: [0, 39], attack1: [42, 60], attack2: [63, 81], attack3: [84, 120], draw: [123, 135] } }
  };
  function prepPack(g, c) {
    if (c.yaw) { const w = new THREE.Group(); g.scene.rotation.y = c.yaw; w.add(g.scene); g.scene = w; }   // packs whose barrel is not along +Z (user77's M16: along -X)
    retroMaps(g.scene);
    const src = g.animations[0], U = THREE.AnimationUtils, clips = {};
    for (const k in c.clips) clips[k] = Array.isArray(c.clips[k][0]) ? joinClips(src, k, c.clips[k], 30, 0.15) : U.subclip(src, k, c.clips[k][0], c.clips[k][1], 30);
    g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
    // rest pose (start of idle): measure the weapon body to get scale, grip and muzzle
    const mix = new THREE.AnimationMixer(g.scene); mix.clipAction(clips.idle).play(); mix.update(0); g.scene.updateMatrixWorld(true);
    let base = null; g.scene.traverse(o => { if (!base && (o.name === 'base' || o.name === 'knife' || /^[a-z0-9]+_base$/i.test(o.name))) base = o; });
    const box = new THREE.Box3(), v = new THREE.Vector3(), pts = [];
    (base || g.scene).traverse(o => { if (!o.isMesh || o.isSkinnedMesh) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i += 2) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); box.expandByPoint(v); pts.push(v.clone()); } });
    mix.stopAllAction(); mix.uncacheRoot(g.scene);
    const sz = box.getSize(new THREE.Vector3());
    // the knife blade is not laid along the barrel axis: scale it by its longest side
    const L = Math.max(1e-6, c.knife ? Math.max(sz.x, sz.y, sz.z) : sz.z), h = sz.y, cx = (box.min.x + box.max.x) / 2;
    const grip = new THREE.Vector3(cx, box.min.y + c.gy * h, box.min.z + c.gz * L);
    const front = pts.filter(p => p.z > box.max.z - L * 0.02), tip = new THREE.Vector3(cx, box.max.y - h * 0.25, box.max.z);
    if (front.length) { tip.set(0, 0, 0); front.forEach(p => tip.add(p)); tip.multiplyScalar(1 / front.length); tip.z = box.max.z; }
    // weapon-only template (no arms) for packs that also provide the third-person model
    let worldTpl = null;
    if (c.world && base) {
      mix.clipAction(clips.idle).play(); mix.update(0); g.scene.updateMatrixWorld(true); worldTpl = new THREE.Group();
      base.traverse(o => { if (!o.isMesh || o.isSkinnedMesh) return; const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, o.material); m.castShadow = true; worldTpl.add(m); });
      mix.stopAllAction(); mix.uncacheRoot(g.scene);
    }
    return { scene: g.scene, clips, s: c.fixedScale || c.len / L, grip, tip, knife: !!c.knife, place: c.place || null, worldTpl };
  }
  /* replace the pistol pack's Beretta with the Colt M1911: every Colt part hangs from the pack bone that moves
     the matching Beretta part (slide, magazine, hammer, trigger, frame), so draw/fire/reload animate the Colt */
  function swapColt(inner) {
    inner.updateMatrixWorld(true);
    const B = {}; inner.traverse(o => { if (['base', 'slide', 'mag', 'hammer', 'trigger'].includes(o.name) && !B[o.name]) B[o.name] = o; });
    if (!B.base) return null;
    inner.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && /_beretta_/.test(o.name)) o.visible = false; });
    const src = colt.clone(true); src.updateMatrixWorld(true);
    // Colt space -> pack space: turned 180 deg (its barrel points the other way), scaled up a touch, grips aligned
    const s = 1.15, R = new THREE.Matrix4().makeRotationY(Math.PI), RS = new THREE.Matrix4().multiplyMatrices(R, new THREE.Matrix4().makeScale(s, s, s));
    const cm = new THREE.Vector3(0, -0.028, 0.074).applyMatrix4(RS), pm = new THREE.Vector3(0, 0.038, 0.181);
    const T = new THREE.Matrix4().makeTranslation(pm.x - cm.x, pm.y - cm.y, pm.z - cm.z).multiply(RS);
    const toBase = new THREE.Matrix4().copy(B.base.matrixWorld).invert().multiply(inner.matrixWorld).multiply(T);
    const map = { Shutter: 'slide', Magazine: 'mag', MagFollower: 'mag', Round: 'mag', Shell: 'mag', Hammer: 'hammer', Trigger: 'trigger' };
    const info = {}, list = []; src.traverse(o => { if (o.isMesh) list.push(o); });
    for (const o of list) {
      const key = o.name.replace(/_lowTris.*$/, ''), bone = B[map[key]] || B.base;
      const W = new THREE.Matrix4().copy(inner.matrixWorld).multiply(T).multiply(o.matrixWorld);
      const m = new THREE.Mesh(o.geometry, o.material); m.name = 'colt_' + key; m.frustumCulled = false; m.castShadow = false;
      new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(W).decompose(m.position, m.quaternion, m.scale);
      bone.add(m); if (key === 'Silencer') info.silencer = m;
    }
    const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(toBase);
    info.muzzleOff = P(0, 0.04, -0.097); info.muzzleOn = P(0, 0.041, -0.243); info.pivot = P(0, 0.0405, -0.17);
    info.axis = P(0, 0.0405, -1).sub(P(0, 0.0405, 0)).normalize();   // barrel direction, in base space
    if (info.silencer) info.home = { pos: info.silencer.position.clone(), quat: info.silencer.quaternion.clone() };
    info.base = B.base;
    return info.silencer ? info : null;
  }
  /* a built suppressor tube on a rifle pack: hung from the weapon bone at the muzzle, along the barrel */
  let sdTex = null;
  function suppressorMesh(len, rad) {
    if (!sdTex) { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#1e201f'; x.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, 20 + i * 26, 64, 3); }
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`; x.fillRect(Math.random() * 64, Math.random() * 256, 2, 2); }
      sdTex = new THREE.CanvasTexture(c); sdTex.encoding = THREE.sRGBEncoding; }
    const g = new THREE.CylinderGeometry(rad, rad, len, 18, 1); g.rotateX(Math.PI / 2);   // along Z
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: sdTex, roughness: 0.55, metalness: 0.55 }));
  }
  function addSuppressor(inner, base, tip) {
    inner.updateMatrixWorld(true);
    const ws = base.getWorldScale(new THREE.Vector3()).x, u = 1 / ws;
    const tw = base.localToWorld(tip.clone()), fw = base.worldToLocal(tw.clone().add(new THREE.Vector3(0, 0, -1)));
    const axis = fw.sub(tip.clone()).normalize(), len = 0.19 * u;
    const m = suppressorMesh(0.19, 0.019); m.scale.setScalar(u); m.frustumCulled = false; m.name = 'suppressor';
    m.position.copy(tip).addScaledVector(axis, len * 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis); base.add(m);
    return { silencer: m, home: { pos: m.position.clone(), quat: m.quaternion.clone() }, pivot: m.position.clone(), axis, unit: u,
             muzzleOff: tip.clone(), muzzleOn: tip.clone().addScaledVector(axis, len), base };
  }
  /* the AR-15 (wafla) on the carbine pack: parts hang from the bones that animate the pack's own rifle
     (magazine -> clip, bolt carrier -> bolt, charging handle -> handle, ejection port cover -> lid...) */
  function swapAR(inner) {
    inner.updateMatrixWorld(true);
    const want = ['base', 'clip', 'bolt', 'handle', 'lid', 'trigger', 'release', 'boltcatch'], B = {};
    inner.traverse(o => { if (want.includes(o.name) && !B[o.name]) B[o.name] = o; });
    if (!B.base) return null;
    inner.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && (/_carbine_0$/.test(o.name) || /^lens/.test(o.name))) o.visible = false; });
    const src = ar15.clone(true); src.updateMatrixWorld(true);
    // AR space (barrel along +X, decimetre-ish units) -> pack space (barrel along +Z): turn, scale, magazines aligned
    const s = 0.215, RS = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeRotationY(-Math.PI / 2), new THREE.Matrix4().makeScale(s, s, s));
    const cm = new THREE.Vector3(0.738, -0.798, 0).applyMatrix4(RS), pm = new THREE.Vector3(0, 0.064, 0.329);
    const T = new THREE.Matrix4().makeTranslation(pm.x - cm.x, pm.y - cm.y, pm.z - cm.z).multiply(RS);
    const toBase = new THREE.Matrix4().copy(B.base.matrixWorld).invert().multiply(inner.matrixWorld).multiply(T);
    const rules = [[/pmag/, 'clip'], [/boltcarrier/, 'bolt'], [/ejectionport/, 'lid'], [/charginghandle/, 'handle'], [/^trigger/, 'trigger'], [/magazinecatch/, 'release'], [/boltcatch/, 'boltcatch']];
    const info = {}, list = []; src.traverse(o => { if (o.isMesh) list.push(o); });
    for (const o of list) {
      const key = (o.parent && o.parent.name || o.name).toLowerCase().replace(/[^a-z0-9]/g, ''), r = rules.find(([re]) => re.test(key)), bone = B[r ? r[1] : 'base'] || B.base;
      const W = new THREE.Matrix4().copy(inner.matrixWorld).multiply(T).multiply(o.matrixWorld);
      const m = new THREE.Mesh(o.geometry, o.material); m.name = 'ar15_' + key; m.frustumCulled = false; m.castShadow = false;
      new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(W).decompose(m.position, m.quaternion, m.scale);
      bone.add(m); if (/gemtech/.test(key)) info.silencer = m;
    }
    const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(toBase);
    info.muzzleOff = P(4.13, 0.242, 0); info.muzzleOn = P(4.95, 0.242, 0); info.pivot = P(4.327, 0.242, 0);
    info.axis = P(5, 0.242, 0).sub(P(4, 0.242, 0)).normalize(); info.unit = P(4.9, 0.242, 0).distanceTo(P(4.3, 0.242, 0)) / 0.16;
    if (info.silencer) info.home = { pos: info.silencer.position.clone(), quat: info.silencer.quaternion.clone() };
    info.base = B.base;
    return info.silencer ? info : null;
  }
  /* the DKS-501 (TrevorLaws, CC BY) on the sniper pack: magazine and rounds on the clip bone, the rest on the frame;
     the pack's own rifle (and its suppressor) hidden. Returns the real muzzle in base space. */
  /* generic: put a static weapon model on an animated pack. cfg.s scale, cfg.src -> cfg.dst anchor (magazine centres),
     cfg.rot (Y turn, default none), cfg.rules [[regex, bone]] for the parts that the pack animates; the rest go on 'base'.
     The pack's own rifle is hidden. Returns the muzzle (cfg.muzzle, model space) in base space. */
  function swapOnto(inner, model, cfg) {
    inner.updateMatrixWorld(true);
    const B = {}; inner.traverse(o => { if (!o.isMesh && o.name && !B[o.name]) B[o.name] = o; });
    if (!B.base) return null;
    inner.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });
    const src = model.clone(true); src.updateMatrixWorld(true);
    const RS = new THREE.Matrix4().makeRotationY(cfg.rot || 0).multiply(new THREE.Matrix4().makeRotationZ(cfg.rotZ || 0));
    if (cfg.basis) RS.multiply(new THREE.Matrix4().set(...cfg.basis, 0, 0, 0, 1));   // any axis change (3 rows of 4)
    RS.multiply(new THREE.Matrix4().makeScale(cfg.s, cfg.s, cfg.s));
    const cm = new THREE.Vector3(...cfg.src).applyMatrix4(RS), pm = new THREE.Vector3(...cfg.dst);
    const T = new THREE.Matrix4().makeTranslation(pm.x - cm.x, pm.y - cm.y, pm.z - cm.z).multiply(RS);
    const list = []; src.traverse(o => { if (o.isMesh) list.push(o); });
    for (const o of list) {
      // the part's own name and its parent's (Sketchfab wraps meshes in 'Object_N' nodes)
      const key = ((o.parent && o.parent.name || '') + '|' + o.name).toLowerCase().replace(/[^a-z0-9|]/g, ''), r = (cfg.rules || []).find(([re]) => re.test(key)), bone = (r && B[r[1]]) || B.base;
      const W = new THREE.Matrix4().copy(inner.matrixWorld).multiply(T);
      // optional reshaping of a part in model space about a pivot (e.g. a cheek riser too tall for the view)
      for (const tw of cfg.tweak || []) if (tw.re.test(key)) { const pv = new THREE.Vector3(...tw.pivot);
        W.multiply(new THREE.Matrix4().makeTranslation(pv.x, pv.y, pv.z)).multiply(new THREE.Matrix4().makeScale(...tw.scale)).multiply(new THREE.Matrix4().makeTranslation(-pv.x, -pv.y, -pv.z)); }
      W.multiply(o.matrixWorld);
      // optional split of a one-piece model: triangles whose centre (model space) lies in a box go to another bone (e.g. the magazine)
      const parts = [[o.geometry, bone, '']];
      for (const sp of cfg.split || []) {
        const g = o.geometry, P = g.attributes.position, I = g.index; if (!I) continue;
        const inside = [], rest = [], c = new THREE.Vector3(), q = new THREE.Vector3();
        for (let t = 0; t < I.count; t += 3) { c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(q.fromBufferAttribute(P, I.getX(t + k)).applyMatrix4(o.matrixWorld)); c.multiplyScalar(1 / 3);
          const inBox = c.x > sp.min[0] && c.x < sp.max[0] && c.y > sp.min[1] && c.y < sp.max[1] && c.z > sp.min[2] && c.z < sp.max[2];
          (inBox ? inside : rest).push(I.getX(t), I.getX(t + 1), I.getX(t + 2)); }
        if (!inside.length) continue;
        const mk = (idx) => { const n = new THREE.BufferGeometry(); for (const k in g.attributes) n.setAttribute(k, g.attributes[k]); n.setIndex(idx); return n; };
        parts[0][0] = mk(rest); parts.push([mk(inside), B[sp.bone] || B.base, '_' + sp.bone]);
      }
      for (const [geo, bn, tag] of parts) {
        const m = new THREE.Mesh(geo, o.material); m.name = 'swap_' + key + tag; m.frustumCulled = false; m.castShadow = false;
        new THREE.Matrix4().copy(bn.matrixWorld).invert().multiply(W).decompose(m.position, m.quaternion, m.scale); bn.add(m);
      }
    }
    return new THREE.Vector3(...cfg.muzzle).applyMatrix4(new THREE.Matrix4().copy(B.base.matrixWorld).invert().multiply(inner.matrixWorld).multiply(T));
  }
  function swapDKS(inner) {
    inner.updateMatrixWorld(true);
    const B = {}; inner.traverse(o => { if (['base', 'clip'].includes(o.name) && !B[o.name]) B[o.name] = o; });
    if (!B.base) return null;
    inner.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });
    const src = dks.clone(true); src.updateMatrixWorld(true);
    // DKS space (barrel along +X) -> pack space (barrel along +Z), scaled up a touch, magazines aligned
    const s = 1.35, RS = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeRotationY(-Math.PI / 2), new THREE.Matrix4().makeScale(s, s, s));
    const cm = new THREE.Vector3(21.954, -4.115, 0.007).applyMatrix4(RS), pm = new THREE.Vector3(0, 5.778, 18.468);
    const T = new THREE.Matrix4().makeTranslation(pm.x - cm.x, pm.y - cm.y, pm.z - cm.z).multiply(RS);
    const list = []; src.traverse(o => { if (o.isMesh) list.push(o); });
    for (const o of list) {
      const key = (o.parent && o.parent.name || o.name).toLowerCase(), bone = /magazine|bullet/.test(key) && B.clip ? B.clip : B.base;
      const W = new THREE.Matrix4().copy(inner.matrixWorld).multiply(T).multiply(o.matrixWorld);
      const m = new THREE.Mesh(o.geometry, o.material); m.name = 'dks_' + key; m.frustumCulled = false; m.castShadow = false;
      new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(W).decompose(m.position, m.quaternion, m.scale); bone.add(m);
    }
    return new THREE.Vector3(74.6, -1.47, 0).applyMatrix4(new THREE.Matrix4().copy(B.base.matrixWorld).invert().multiply(inner.matrixWorld).multiply(T));
  }
  function fpPack(id) {
    if (id === 'arx17') return akPack();
    const c = PACKS[id]; if (!c) return null; const D = packs[c.data]; if (!D || D === 'loading') return null;
    const group = new THREE.Group(), inner = THREE.SkeletonUtils.clone(D.scene);
    inner.scale.setScalar(D.s); inner.rotation.y = Math.PI;               // barrel along -Z, real size
    if (D.place) inner.position.set(D.place[0], D.place[1], D.place[2]);  // placed straight in view space (knife)
    else inner.position.set(D.grip.x * D.s, -D.grip.y * D.s, D.grip.z * D.s);   // grip at the weapon origin
    group.add(inner);
    const dksMuzzle = c.swap === 'dks' && dks ? swapDKS(inner)
      : c.swap === 'mp5' && mp5Tpl ? swapOnto(inner, mp5Tpl, { s: 75.4 / mp5Len, basis: [1, 0, 0, 0,  0, 0, 1, 0,  0, -1, 0, 0],   // muzzle at -Y, top +Z -> muzzle +Z, top +Y
          src: [-150.68, -16575.6, 70360.57], dst: [0.193, 9.764, 11.884], muzzle: [-150.68, -31266, 72000], rules: [[/mag/, 'clip'], [/trigger/, 'trigger']] })   // body on the SMG's body
      : c.swap === 'shotgun2' && sg2 ? swapOnto(inner, sg2, { s: 0.76, src: [0, 4.861, 7.715], dst: [0, -2.59, 3.732], muzzle: [0, 12, 128.8],   // same axes as the pack; grips aligned
          rules: [[/pump/, 'pump'], [/slug/, 'slug'], [/trigger/, 'trigger'], [/loader/, 'lid']] })
      : c.swap === 'spr' && spr ? swapOnto(inner, spr, Object.assign({}, { s: 50, rot: Math.PI, src: [0, -0.009, 0.041], dst: [0, 5.778, 18.468], muzzle: [0, -0.02, -0.998],
          rules: [[/bolt/, 'bolt'], [/\|mag|follower/, 'clip'], [/bullet/, 'bullet']],
          tweak: [{ re: /stuck/, pivot: [0, -0.02, 0.36], scale: [1, 0.6, 0.85] }] }))   // lower, shorter stock: its cheek riser blocked the view
      : c.swap === 'ak12' && ak12 ? swapOnto(inner, ak12, { s: 1.72, rot: -Math.PI / 2, rotZ: -0.2133,   // along +X, tilted 12 deg -> level, along +Z
          src: [0.251, -0.055, -0.023], dst: [0, 0.064, 0.329], muzzle: [0.842, 0.205, -0.01],
          rules: [[/object2$/, 'handle']],                                                          // bolt carrier + charging handle: racks with the hand
          split: [{ min: [0.13, -9, -9], max: [0.36, 0.025, 9], bone: 'clip' }] })
      : c.swap === 'gauss' && gaussTpl ? (() => { const b = gaussBox, L = b.max.z - b.min.z, cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, H = b.max.y - b.min.y;
          return swapOnto(inner, gaussTpl, { s: 2.0 / L, src: [cx, cy - 0.12 * H, b.min.z + 0.5 * L], dst: [0, 0.12, 0.33], muzzle: [cx, cy + 0.02 * H, b.max.z] }); })()
      : c.swap === 'awm' && awm ? swapOnto(inner, awm, { s: 76, src: [0, -0.037, 0.135], dst: [0, 5.778, 18.468], muzzle: [0, 0.052, 0.992],
          rules: [[/bolt/, 'bolt'], [/mag|cartridgebkd001/, 'clip'], [/cartridgebkd002/, 'bullet']] }) : null;
    const coltInfo = c.swap === 'colt' && colt ? swapColt(inner) : c.swap === 'ar15' && ar15 ? swapAR(inner) : null;
    const mixer = new THREE.AnimationMixer(inner), actions = {};
    for (const k in D.clips) actions[k] = mixer.clipAction(D.clips[k]);
    actions.idle.play(); mixer.update(0); group.updateMatrixWorld(true);
    let base = null; inner.traverse(o => { if (!base && (o.name === 'base' || o.name === 'knife' || /^[a-z0-9]+_base$/i.test(o.name))) base = o; });
    if (D.knife && base) base.scale.multiplyScalar(0.75);   // the source blade is long: bring it to a combat-knife size
    const muzzle = new THREE.Object3D();
    if (base) { const tip = inner.localToWorld(D.tip.clone()); muzzle.position.copy(base.worldToLocal(tip)); const ws = base.getWorldScale(new THREE.Vector3()); muzzle.scale.setScalar(1 / ws.x); base.add(muzzle); }
    else { muzzle.position.set(0, 0.05, -c.len * 0.7); group.add(muzzle); }
    let sdInfo = coltInfo;
    if (c.sd && base && !coltInfo) sdInfo = addSuppressor(inner, base, muzzle.position.clone());   // built tube only if no real model   // rifle with a screw-on suppressor
    if (sdInfo) muzzle.position.copy(sdInfo.muzzleOn);
    if (dksMuzzle && base) muzzle.position.copy(dksMuzzle);
    const eject = new THREE.Object3D(); eject.position.set(0.03, 0.06, -0.1); group.add(eject);
    let cur = actions.idle, atk = 0;
    const pack = {
      gun: { group, muzzle, mag: null, magHome: null, eject, imported: true, real: true, pack: true },
      play(name, dur) {
        if (name === 'attack') { const n = ['attack1', 'attack2', 'attack3'].filter(k => actions[k]); if (!n.length) return; name = n[atk++ % n.length]; }
        if (name === 'reloadEmpty' && !actions.reloadEmpty) name = 'reload';
        const a = actions[name]; if (!a) return;
        a.reset(); a.enabled = true;
        a.setLoop(name === 'idle' ? THREE.LoopRepeat : THREE.LoopOnce, name === 'idle' ? Infinity : 1);
        a.clampWhenFinished = name !== 'idle';
        a.timeScale = dur ? D.clips[name].duration / dur : 1;
        a.setEffectiveWeight(1); a.play();
        if (cur && cur !== a) cur.crossFadeTo(a, name === 'fire' ? 0.03 : 0.1, false);
        cur = a;
      },
      update(dt) {
        mixer.update(dt);
        if (cur !== actions.idle && !cur.isRunning()) { const a = actions.idle; a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = 1; a.play(); cur.crossFadeTo(a, 0.15, false); cur = a; }
      },
      get busy() { return cur !== actions.idle && cur.isRunning(); },
      _mixer: mixer, _actions: actions, get _cur() { return cur; }, colt: sdInfo, inner
    };
    return pack;
  }
  /* realistic first-person arms (from the pistol pack, weapon removed) for hand-posed actions such as
     planting and defusing. Returns the arms in view space at their idle pose plus their bones. */
  function armsRig() {
    const D = packs.fp_pistol; if (!D || D === 'loading') return null;
    const group = new THREE.Group(), inner = THREE.SkeletonUtils.clone(D.scene);
    inner.scale.setScalar(D.s); inner.rotation.y = Math.PI; inner.position.set(D.grip.x * D.s, -D.grip.y * D.s, D.grip.z * D.s);
    group.add(inner);
    inner.traverse(o => { if (o.isMesh) { if (!o.isSkinnedMesh) o.visible = false; o.frustumCulled = false; o.castShadow = false; } });
    const mixer = new THREE.AnimationMixer(inner); mixer.clipAction(D.clips.idle).play(); mixer.update(0); mixer.stopAllAction();
    const bones = {}; inner.traverse(o => { if (o.isBone) bones[o.name.replace(/_\d+$/, '')] = o; });
    const base = {}; for (const k in bones) base[k] = bones[k].quaternion.clone();
    return { group, inner, bones, base };
  }
  /* first-person AK74 with arms and hand-made animations (DJMaesen, CC BY). The source has a single
     8.1 s timeline; it is cut into actions by watching the bolt and magazine (30 fps frames) */
  function prepAk74(g) {
    retroMaps(g.scene);
    const src = g.animations[0], U = THREE.AnimationUtils, fps = 30;
    const clips = { fire: U.subclip(src, 'fire', 0, 6, fps), reloadEmpty: U.subclip(src, 'reloadEmpty', 6, 96, fps),
      reload: U.subclip(src, 'reload', 99, 153, fps), idle: U.subclip(src, 'idle', 198, 222, fps), draw: U.subclip(src, 'draw', 225, 243, fps) };
    g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
    return { scene: g.scene, clips };
  }
  function akPack() {
    if (!ak74) return null;
    const group = new THREE.Group(), inner = THREE.SkeletonUtils.clone(ak74.scene);
    inner.scale.setScalar(0.01); inner.rotation.y = Math.PI;          // centimetres, barrel along +Z  ->  metres, barrel along -Z
    inner.position.set(0, -0.055, 0.03);                                // pistol grip of the pack at the weapon origin
    group.add(inner);
    const mixer = new THREE.AnimationMixer(inner), actions = {};
    for (const k in ak74.clips) actions[k] = mixer.clipAction(ak74.clips[k]);
    // idle pose, then hang the muzzle on the receiver node at the barrel tip
    actions.idle.play(); mixer.update(0); group.updateMatrixWorld(true);
    let base = null; inner.traverse(o => { if (!base && (o.name === 'base' || /^[a-z0-9]+_base$/i.test(o.name))) base = o; });
    const muzzle = new THREE.Object3D();
    if (base) {
      const tip = inner.localToWorld(new THREE.Vector3(-0.01, 14.54, 74.77));
      muzzle.position.copy(base.worldToLocal(tip.clone()));
      const ws = base.getWorldScale(new THREE.Vector3()); muzzle.scale.setScalar(1 / ws.x);
      base.add(muzzle);
    } else { muzzle.position.set(0, 0.07, -0.72); group.add(muzzle); }
    const eject = new THREE.Object3D(); eject.position.set(0.03, 0.07, -0.12); group.add(eject);
    let cur = actions.idle;
    const pack = {
      gun: { group, muzzle, mag: null, magHome: null, eject, imported: true, real: true, pack: true },
      play(name, dur) {
        const a = actions[name]; if (!a) return;
        a.reset(); a.enabled = true;
        a.setLoop(name === 'idle' ? THREE.LoopRepeat : THREE.LoopOnce, name === 'idle' ? Infinity : 1);
        a.clampWhenFinished = name !== 'idle';
        a.timeScale = dur ? ak74.clips[name].duration / dur : 1;
        a.setEffectiveWeight(1); a.play();
        if (cur && cur !== a) cur.crossFadeTo(a, name === 'fire' ? 0.03 : 0.1, false);
        cur = a;
      },
      update(dt) {
        mixer.update(dt);
        if (cur !== actions.idle && !cur.isRunning()) { const a = actions.idle; a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = 1; a.play(); cur.crossFadeTo(a, 0.15, false); cur = a; }
      },
      get busy() { return cur !== actions.idle && cur.isRunning(); },
      _mixer: mixer, _actions: actions, get _cur() { return cur; }
    };
    return pack;
  }
  /* frag grenade (CC0): body with the spoon, and the pull ring as its own part; origin at the body centre */
  function buildFrag(scene) {
    scene.updateMatrixWorld(true);
    const C = new THREE.Vector3(0, 0.046, -0.004), body = new THREE.Group(), pin = new THREE.Group();
    scene.traverse(o => {
      if (!o.isMesh) return;
      let part = o, name = ''; while (part && !name) { if (/^(Grenade|Pin)$/.test(part.name)) name = part.name; part = part.parent; }
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.translate(-C.x, -C.y, -C.z); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, o.material); m.castShadow = true;
      (name === 'Pin' ? pin : body).add(m);
    });
    return { body, pin };
  }
  /* the charge (Time bomb, CC BY): dynamite under a circuit board with keypad, batteries and a 7-segment
     timer. Returns the model sized to ~30 cm, resting on y = 0, plus its display mesh and LEDs */
  function chargeModel() {
    if (!timebomb) return null;
    const root = timebomb.clone(true), g = new THREE.Group(); g.add(root);
    root.updateMatrixWorld(true);
    let ref = null, display = null; const leds = [];
    root.traverse(o => { if (!o.isMesh) return; if (/pcb1/i.test(o.name)) ref = o; if (/display/i.test(o.name)) display = o; if (/^led/i.test(o.name)) leds.push(o);
      if (/pCylinder2[4-7]/.test(o.name)) o.visible = false;   // stray cable pieces modelled far outside the bomb
      o.castShadow = true; });
    const box = new THREE.Box3(); root.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
    const size = box.getSize(new THREE.Vector3()), s = 0.3 / Math.max(size.x, size.z);
    root.scale.multiplyScalar(s); root.updateMatrixWorld(true);
    const b2 = new THREE.Box3(); root.traverse(o => { if (o.isMesh && o.visible) b2.expandByObject(o); });
    const c = b2.getCenter(new THREE.Vector3()); root.position.set(-c.x, -b2.min.y, -c.z);
    return { group: g, display, leds };
  }
  /* flashbang / smoke grenade (Vanillatography, CC BY): body + pull ring, centred, scaled to real height */
  function buildNade(scene, height, pinRe) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3(); scene.traverse(o => { if (o.isMesh) box.expandByObject(o); });
    const C = box.getCenter(new THREE.Vector3()), s = height / (box.max.y - box.min.y), body = new THREE.Group(), pin = new THREE.Group();
    scene.traverse(o => { if (!o.isMesh) return;
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.translate(-C.x, -C.y, -C.z); g.scale(s, s, s); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, o.material); m.castShadow = true; (pinRe && pinRe.test(o.name) ? pin : body).add(m); });
    return { body, pin };
  }
  const nadeOf = (model) => model === 'flashbang' ? (flashN || frag) : model === 'smokegren' ? (smokeN || frag) : frag;
  /* wire cutter (Thomas Vansteelandt, CC BY) for the defuse kit: upper and lower halves pivot on the bolt */
  function cutterModel() {
    if (!cutter) return null;
    const src = cutter.clone(true); src.updateMatrixWorld(true);
    const group = new THREE.Group(), up = new THREE.Group(), down = new THREE.Group(), pivot = new THREE.Vector3(0.01, 0, 0);
    up.position.copy(pivot); down.position.copy(pivot); group.add(up, down);
    const list = []; src.traverse(o => { if (o.isMesh) list.push(o); });
    for (const o of list) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.translate(-pivot.x, -pivot.y, -pivot.z);
      const m = new THREE.Mesh(g, o.material); m.castShadow = true; (/_Up_/.test(o.name) ? up : down).add(m); }
    return { group, setOpen(a) { up.rotation.z = a; down.rotation.z = -a; } };
  }
  /* office props (Paolo Mercogliano, CC BY): split into desk / bookcase / cabinet / chair / lamp, in metres,
     centred on x/z with the feet at y = 0 */
  function buildOfficeKit(scene) {
    scene.updateMatrixWorld(true);
    const parts = { desk: [], bookcase: [], cabinet: [], chairS: [], lamp: [] };
    scene.traverse(o => { if (!o.isMesh) return; const n = o.name;
      const k = /bookcase/.test(n) ? 'bookcase' : /archivio/.test(n) ? 'cabinet' : /sedia/.test(n) ? 'chairS' : /lamp/.test(n) ? 'lamp' : /desk/.test(n) ? 'desk' : null; if (k) parts[k].push(o); });
    const out = {};
    for (const k in parts) {
      if (!parts[k].length) continue; const g = new THREE.Group(), box = new THREE.Box3();
      for (const o of parts[k]) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.scale(0.1, 0.1, 0.1); const m = new THREE.Mesh(geo, o.material); m.castShadow = true; m.receiveShadow = true; g.add(m); box.expandByObject(m); }
      const c = box.getCenter(new THREE.Vector3()); g.children.forEach(m => m.geometry.translate(-c.x, -box.min.y, -c.z)); out[k] = g;
    }
    return out;
  }
  // a (possibly skinned) model baked to static geometry, turned upright (its height is along -Z) and scaled to a height
  function bakeUpright(scene, height) {
    scene.updateMatrixWorld(true); const g = new THREE.Group(), box = new THREE.Box3(), v = new THREE.Vector3(), R = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    scene.traverse(o => { if (!o.isMesh) return; const geo = o.geometry.clone(); for (const k of ['skinIndex', 'skinWeight']) if (geo.attributes[k]) geo.deleteAttribute(k);
      const P = geo.attributes.position;
      if (o.isSkinnedMesh) { o.skeleton.update(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(o.geometry.attributes.position, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); P.setXYZ(i, v.x, v.y, v.z); } }
      else geo.applyMatrix4(o.matrixWorld);
      geo.applyMatrix4(R); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, o.material); m.castShadow = true; g.add(m); box.expandByObject(m); });
    const s = height / (box.max.y - box.min.y), c = box.getCenter(new THREE.Vector3());
    g.children.forEach(m => { m.geometry.translate(-c.x, -box.min.y, -c.z); m.geometry.scale(s, s, s); });
    return g;
  }
  function placeOffice(scene) {
    const L = BV.Map && BV.Map.data && BV.Map.data.office; if (!L || !officeKit) return 0;
    let n = 0;
    for (const it of L) {
      const tpl = it.k === 'chair' ? (officeChair || officeKit.chairS) : officeKit[it.k]; if (!tpl) continue;
      const o = tpl.clone(); o.position.set(it.x, 0, it.z); o.rotation.y = (it.r || 0) + (it.k === 'chair' ? 0 : Math.PI); scene.add(o); n++;   // the kit's fronts face -Z
    }
    return n;
  }
  /* thrown grenade: the body only (the pin has been pulled) */
  function thrownGrenade(model) { const N = nadeOf(model); if (!N) return null; const g = new THREE.Group(); g.add(N.body.clone()); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
  function thrownGrenade_old() { if (!frag) return null; const g = new THREE.Group(); g.add(frag.body.clone()); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
  /* Makarov (CC0): real separate parts. Body/barrel/trigger fixed, slide (+hammer, safety) moves on
     each shot, magazine seated in the grip (the source shows it beside the pistol, exploded) */
  function buildMakarov(scene) {
    scene.updateMatrixWorld(true);
    const GRIP = new THREE.Vector3(0.004, 0.004, 0.018);          // web of the hand, behind the trigger guard
    const MAG_SEAT = new THREE.Vector3(0, -0.012, -0.09);          // exploded position -> inside the grip
    const body = new THREE.Group(), slide = new THREE.Group(), mag = new THREE.Group();
    scene.traverse(o => {
      if (!o.isMesh) return;
      let part = o, name = ''; while (part && !name) { if (/^(Magazine|Slide|Hammer|Safety|Trigger|Barrel|Body)$/.test(part.name)) name = part.name; part = part.parent; }
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.translate(-GRIP.x, -GRIP.y, -GRIP.z);
      if (name === 'Magazine') g.translate(MAG_SEAT.x, MAG_SEAT.y, MAG_SEAT.z);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, o.material);
      (name === 'Magazine' ? mag : (name === 'Slide' || name === 'Hammer' || name === 'Safety') ? slide : body).add(m);
    });
    // muzzle: centre of the slide/barrel front face
    const bb = new THREE.Box3().setFromObject(slide);
    const muzzle = new THREE.Vector3(0.0005, (bb.min.y + bb.max.y) / 2 + 0.002, bb.min.z - 0.004);
    return { body, slide, mag, muzzle };
  }
  /* detachable magazine: triangles inside a per-weapon box (grip at origin, barrel along -Z, metres)
     become their own mesh so the reload can pull it out and seat a fresh one */
  const MAGBOX = { smg: [-0.2, -0.105, 0.0], smgCompact: [-0.185, -0.09, 0.0], rifle: [-0.285, -0.105, 0.015],
    rifleCarbine: [-0.135, -0.03, -0.005], dmr: [-0.15, -0.03, -0.005], sniper: [-0.235, -0.145, 0.0] };
  const split = {};
  function splitMag(model, tpl, sc) {
    if (split[model]) return split[model];
    const B = MAGBOX[model], body = new THREE.Group(), mag = new THREE.Group();
    tpl.updateMatrixWorld(true);
    tpl.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().makeScale(sc, sc, sc).multiply(o.matrixWorld));
      const P = g.attributes.position, IX = g.index, n = IX ? IX.count : P.count, inB = [], outB = [];
      for (let t = 0; t < n; t += 3) {
        const a = IX ? IX.getX(t) : t, b = IX ? IX.getX(t + 1) : t + 1, c = IX ? IX.getX(t + 2) : t + 2;
        const cy = (P.getY(a) + P.getY(b) + P.getY(c)) / 3, cz = (P.getZ(a) + P.getZ(b) + P.getZ(c)) / 3;
        (cz > B[0] && cz < B[1] && cy < B[2] ? inB : outB).push(a, b, c);
      }
      const gb = g.clone(); gb.setIndex(outB); gb.computeBoundingSphere(); body.add(new THREE.Mesh(gb, o.material));
      if (inB.length) { const gm = g.clone(); gm.setIndex(inB); gm.computeBoundingSphere(); mag.add(new THREE.Mesh(gm, o.material)); }
    });
    return (split[model] = { body, mag: mag.children.length ? mag : null });
  }
  function gun(model) {
    if (model === 'mp5' && mp5Tpl) {   // third person: ~0.55 m, upright (Z half turn), muzzle to -Z, grip near the origin
      const k = 0.55 / mp5Len, group = new THREE.Group(), inner = mp5Tpl.clone(true); inner.scale.setScalar(k);
      const M = new THREE.Matrix4().set(-1, 0, 0, 0,  0, 0, 1, 0,  0, 1, 0, 0,  0, 0, 0, 1);   // muzzle at -Y -> -Z (forward for a character), top +Z -> +Y
      inner.quaternion.setFromRotationMatrix(M); const tf = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M).multiplyScalar(k);
      inner.position.copy(tf(-863, -26054, 70000)).negate(); group.add(inner); inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const muzzle = new THREE.Object3D(); muzzle.position.copy(tf(-150.68, -31266, 72000)).add(inner.position); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.06, -0.1); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'shotgun2' && sg2) {   // third person: ~1 m, muzzle turned to -Z, grip near the origin
      const k = 0.0072, group = new THREE.Group(), inner = sg2.clone(true); inner.scale.setScalar(k); inner.rotation.y = Math.PI;
      inner.position.set(0, -4.86 * k, 7.7 * k); group.add(inner); inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, (12 - 4.86) * k, (-128.8 + 7.7) * k); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.06, -0.1); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'spr' && spr) {   // third person: ~1.15 m, barrel already along -Z, pistol grip at the origin
      const k = 0.6, group = new THREE.Group(), inner = spr.clone(true); inner.scale.setScalar(k); inner.position.set(0, 0.03 * k, -0.327 * k); group.add(inner);
      inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.05 * k, (-0.998 - 0.327) * k); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.08, -0.1); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'm16sd') {   // third person: the M16 (pack world model) with the suppressor tube at its muzzle
      const g = gun('m16') || (BV.Models && BV.Models.gun('rifleCarbine')); if (!g) return null;
      const s = suppressorMesh(0.19, 0.019); g.group.add(s); s.position.copy(g.muzzle.position).add(new THREE.Vector3(0, 0, -0.095));
      g.muzzle.position.z -= 0.19; g.group.userData.silencer = s; return g;
    }
    if (model === 'ak12' && ak12) {   // third person: ~0.94 m, levelled, muzzle to -Z, pistol grip near the origin
      const k = 0.835, group = new THREE.Group(), inner = ak12.clone(true); inner.scale.setScalar(k);
      inner.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.2133));
      const tf = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(inner.quaternion).multiplyScalar(k);
      inner.position.copy(tf(0.0, -0.09, -0.02)).negate(); group.add(inner); inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const muzzle = new THREE.Object3D(); muzzle.position.copy(tf(0.842, 0.205, -0.01)).add(inner.position); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.08, -0.12); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'gauss' && gaussTpl) {   // third person: about 1.15 m long, muzzle along -Z, grip near the origin
      const b = gaussBox, L = b.max.z - b.min.z, k = 1.15 / L, c = b.getCenter(new THREE.Vector3());
      const group = new THREE.Group(), inner = gaussTpl.clone(); inner.scale.setScalar(k); inner.rotation.y = Math.PI;
      inner.position.set(c.x * k, 0.06 - c.y * k, (c.z - 0.1 * L) * k); group.add(inner); inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.06, inner.position.z - (b.max.z - c.z) * k); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.09, -0.15); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'awm' && awm) {   // third person: the AWM (already along -Z after a half turn), grip near the origin
      const group = new THREE.Group(), inner = awm.clone(true); inner.rotation.y = Math.PI; inner.position.set(0, 0.07, -0.02); group.add(inner);
      inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.07 + 0.052, -0.02 - 0.992); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.1, -0.12); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'dks' && dks) {   // third person: the DKS-501, barrel along -Z, grip near the origin
      const group = new THREE.Group(), inner = dks.clone(true), k = 0.0148; inner.scale.setScalar(k); inner.rotation.y = Math.PI / 2;
      inner.position.set(0, 0.07, -0.18); group.add(inner); inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.07 - 1.47 * k, -0.18 - 74.6 * k); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.09, -0.3); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'm4sd' && ar15) {   // third person: the AR-15, barrel along -Z, grip at the origin
      const group = new THREE.Group(), inner = ar15.clone(true), k = 0.112; inner.scale.setScalar(k); inner.rotation.y = Math.PI / 2;
      inner.position.set(0, 0.084, -0.095); group.add(inner);
      let silencer = null; inner.traverse(o => { if (o.isMesh) { o.castShadow = true; if (/gemtech/i.test(o.parent && o.parent.name || '')) silencer = o; } });
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.111, -0.65); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.09, -0.16); group.add(eject);
      group.userData.silencer = silencer;
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'm4sd') {   // third person: the carbine plus the suppressor tube at its muzzle
      const g = gun('rifleCarbine') || (BV.Models && BV.Models.gun('rifleCarbine')); if (!g) return null;
      const s = suppressorMesh(0.19, 0.019); g.group.add(s); s.position.copy(g.muzzle.position).add(new THREE.Vector3(0, 0, -0.095));
      g.muzzle.position.z -= 0.19; g.group.userData.silencer = s; return g;
    }
    if (model === 'colt' && colt) {   // third person: the Colt, origin at the grip, suppressor as a separate piece
      const group = new THREE.Group(), inner = colt.clone(true); inner.position.set(0, 0.028, -0.077); group.add(inner);
      let silencer = null; inner.traverse(o => { if (o.isMesh) { o.castShadow = true; if (/^Silencer/.test(o.name)) silencer = o; } });
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.069, -0.32); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.02, 0.07, -0.05); group.add(eject);
      group.userData.silencer = silencer;
      return { group, muzzle, mag: null, magHome: null, eject, real: true, imported: true };
    }
    if (model === 'charge' && timebomb) {   // the charge carried in the hands (third person)
      const C = chargeModel(), group = new THREE.Group(); C.group.scale.setScalar(0.62); C.group.rotation.set(-1.15, 0, 0); C.group.position.set(0, -0.03, -0.12); group.add(C.group);
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.25); group.add(muzzle); const eject = new THREE.Object3D(); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, real: true };
    }
    // weapons whose third-person model comes from their first-person pack (e.g. the LMG)
    for (const id in PACKS) { const c = PACKS[id]; if (c.world === model && packs[c.data] && packs[c.data].worldTpl) {
      const D = packs[c.data], group = new THREE.Group(), inner = D.worldTpl.clone();
      inner.scale.setScalar(D.s); inner.rotation.y = Math.PI; inner.position.set(D.grip.x * D.s, -D.grip.y * D.s, D.grip.z * D.s); group.add(inner);
      group.updateMatrixWorld(true);
      const muzzle = new THREE.Object3D(); muzzle.position.copy(inner.localToWorld(D.tip.clone())); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.06, -0.12); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, imported: true, real: true };
    } }
    if (ready && frag && (model === 'grenade' || model === 'flashbang' || model === 'smokegren')) {
      const N = nadeOf(model), group = new THREE.Group(), pin = N.pin.clone(); group.add(N.body.clone()); group.add(pin);
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.05, -0.03); group.add(muzzle);
      return { group, muzzle, mag: null, magHome: null, pin, pinHome: pin.position.clone(), eject: muzzle, imported: true, real: true };
    }
    if (ready && makarov && (model === 'pistol' || model === 'pistolHeavy')) {
      const sc = model === 'pistolHeavy' ? 1.12 : 1, group = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(sc); group.add(inner);
      inner.add(makarov.body.clone()); const slide = makarov.slide.clone(), mag = makarov.mag.clone(); inner.add(slide); inner.add(mag);
      const muzzle = new THREE.Object3D(); muzzle.position.copy(makarov.muzzle).multiplyScalar(sc); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.02 * sc, 0.045 * sc, -0.03 * sc); group.add(eject);
      return { group, muzzle, mag, magHome: mag.position.clone(), slide, slideHome: slide.position.clone(), slideTravel: 0.022, eject, imported: true, real: true };
    }
    if (!ready || !USE[model]) return null;
    const [k, sc] = USE[model], G = guns[k]; if (!G) return null;
    const group = new THREE.Group();
    let mag = null, magHome = null;
    if (MAGBOX[model]) {
      const S = splitMag(model, G.tpl, sc); group.add(S.body.clone());
      if (S.mag) { mag = S.mag.clone(); group.add(mag); magHome = mag.position.clone(); }
    } else { const body = G.tpl.clone(); body.scale.setScalar(sc); group.add(body); }
    const muzzle = new THREE.Object3D(); muzzle.position.copy(G.muzzle).multiplyScalar(sc); group.add(muzzle);
    const eject = new THREE.Object3D(); eject.position.set(0.03, muzzle.position.y * 0.8 + 0.01, muzzle.position.z * (model.startsWith('pistol') ? 0.35 : 0.18)); group.add(eject);
    return { group, muzzle, mag, magHome, eject, imported: true, real: true };
  }
  function skyTexture(key) {
    const src = BV.REAL && (BV.REAL[key || 'sky'] || BV.REAL.sky); if (!src) return null;
    const img = new Image(), t = new THREE.Texture(img);
    img.onload = () => { t.needsUpdate = true; }; img.src = src[0] === '@' ? src.slice(1) : src;   // web: image file; single file: data URL
    t.encoding = THREE.sRGBEncoding; return t;
  }
  /* realistic city around the compound (four rotated copies, beyond the play area) */
  function placeCity(scene) {
    if (!city || (BV.Map.data && BV.Map.data.noCity)) return false;
    const box = new THREE.Box3().setFromObject(city), c = box.getCenter(new THREE.Vector3()), y = -box.min.y - 0.5;
    let spots = [[0, 0, -315], [Math.PI, 0, 315], [Math.PI / 2, 365, 0], [-Math.PI / 2, -365, 0]];
    if (BV.Map.data.water) spots = spots.slice(1);   // the harbour faces open water to the north
    for (const [rot, x, z] of spots) {
      const g = new THREE.Group(), inner = city.clone(); inner.position.set(-c.x, y, -c.z); g.add(inner);
      g.rotation.y = rot; g.position.set(x, 0, z); scene.add(g);
    }
    return true;
  }
  /* kit props along the foot of walls (decorative only: no collision, never in walkways) */
  function dressMap(scene) {
    if (!Object.keys(kit).length || !BV.Map || !BV.Map.data || BV.Map.data.noIndustrial || BV.Map.data.noWallDress) return 0;
    const D = BV.Map.data, boxes = D.boxes || [], r = BV.U.rng(1717);
    const pieces = [['pallet_broken', 1.6], ['barrel3', 1.9], ['pipe_support', 2.4], ['box', 1.7], ['pallet16', 1.6], ['gas_tank1', 0.75], ['debris', 1.5], ['plank1', 1.6]];
    const blocked = (x, z, rad) => boxes.some(b => b.solid && x > b.min[0] - rad && x < b.max[0] + rad && z > b.min[2] - rad && z < b.max[2] + rad && b.max[1] > 0.2 && b.min[1] < 1.6);
    let n = 0;
    for (const b of boxes) {
      if (!b.solid || (b.max[1] - b.min[1]) < 3 || !/brick|plaster|concrete|metal/.test(b.mat || '')) continue;
      const faces = [[b.min[0], b.max[0], b.min[2] - 0.45, 0], [b.min[0], b.max[0], b.max[2] + 0.45, Math.PI], [b.min[2], b.max[2], b.min[0] - 0.45, Math.PI / 2], [b.min[2], b.max[2], b.max[0] + 0.45, -Math.PI / 2]];
      faces.forEach(([a0, a1, off, rot], fi) => {
        for (let t = a0 + 2.5 + r() * 4; t < a1 - 2.5; t += 9 + r() * 9) {
          const x = fi < 2 ? t : off, z = fi < 2 ? off : t;
          if (Math.abs(x) > 60 || Math.abs(z) > 42 || blocked(x, z, 0.35) || r() < 0.35) continue;
          const [name, sc] = pieces[Math.floor(r() * pieces.length)]; const tpl = kit[name]; if (!tpl) continue;
          const o = tpl.clone(); o.scale.setScalar(sc); o.position.set(x, b.min[1] > 0.5 ? b.min[1] : 0, z); o.rotation.y = rot + (r() - 0.5) * 0.5;
          o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
          scene.add(o); n++;
        }
      });
    }
    return n;
  }
  /* outpost cover at both spawns: real colliders, placed only where they cannot block bot routes */
  function placeOutpost(scene) {
    if (!Object.keys(outpost).length || !BV.Map || !BV.Map.data || BV.Map.data.noIndustrial) return 0;
    const D = BV.Map.data, solids = (D.boxes || []).filter(b => b.solid), nodes = D.nodes || [], r = BV.U.rng(4242), placed = [];
    const spawns = [].concat(D.spawns.attack || [], D.spawns.defend || []);
    const edges = []; nodes.forEach(n => (n.nb || []).forEach(j => { const m = nodes[typeof j === 'number' ? j : j.id]; if (m && m.id > n.id) edges.push([n.x, n.z, m.x, m.z]); }));
    const segDist = (px, pz, e) => { const dx = e[2] - e[0], dz = e[3] - e[1], L = dx * dx + dz * dz || 1, t = BV.U.clamp(((px - e[0]) * dx + (pz - e[1]) * dz) / L, 0, 1); return Math.hypot(px - e[0] - dx * t, pz - e[1] - dz * t); };
    const size = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const overlaps = (x0, z0, x1, z1, h) => solids.concat(placed).some(b => x0 < b.max[0] + 0.1 && x1 > b.min[0] - 0.1 && z0 < b.max[2] + 0.1 && z1 > b.min[2] - 0.1 && b.min[1] < h && b.max[1] > 0.05);
    const nearWall = (x0, z0, x1, z1) => solids.some(b => b.max[1] > 1.5 && x0 < b.max[0] + 0.3 && x1 > b.min[0] - 0.3 && z0 < b.max[2] + 0.3 && z1 > b.min[2] - 0.3);
    const MAT = { hesco: 'dirt', hesco_small: 'dirt', sandbags: 'dirt', twall: 'concrete', twall_long: 'concrete', twall_tall: 'concrete', crate_big: 'metal', case: 'metal', ammo_can: 'metal' };
    const plan = ['hesco', 'hesco', 'twall_long', 'twall', 'sandbags', 'crate_big', 'case', 'ammo_can'];
    let n = 0;
    for (const [rx0, rx1] of [[-61.5, -46], [46, 61.5]]) {
      for (const name of plan) {
        const tpl = outpost[name]; if (!tpl) continue;
        const sz = size(tpl); let best = null;
        for (let k = 0; k < 260; k++) {
          const rot = r() < 0.5 ? 0 : Math.PI / 2, w = rot ? sz.z : sz.x, d = rot ? sz.x : sz.z;
          const x = rx0 + r() * (rx1 - rx0), z = -15 + r() * 30, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
          if (x0 < D.bounds.minX + 0.3 || x1 > D.bounds.maxX - 0.3 || overlaps(x0, z0, x1, z1, sz.y)) continue;
          const rad = Math.hypot(w, d) / 2;
          if (nodes.some(nd => Math.hypot(nd.x - x, nd.z - z) < rad + 1.8)) continue;
          if (edges.some(e => segDist(x, z, e) < rad + 1.1)) continue;
          if (spawns.some(sp => Math.hypot(sp[0] - x, sp[1] - z) < rad + 1.6)) continue;
          const score = (nearWall(x0, z0, x1, z1) ? 10 : 0) + r();
          if (!best || score > best.score) best = { x, z, rot, x0, x1, z0, z1, score };
        }
        if (!best) continue;
        const o = tpl.clone(); o.position.set(best.x, 0, best.z); o.rotation.y = best.rot + (r() < 0.5 ? 0 : Math.PI);
        o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        scene.add(o);
        placed.push({ min: [best.x0, 0, best.z0], max: [best.x1, sz.y, best.z1], solid: true, mat: MAT[name] || 'concrete', outpost: name });
        n++;
      }
    }
    if (placed.length) { D.boxes.push(...placed); BV.Physics.setBoxes(D.boxes); }
    return n;
  }
  /* the abandoned warehouse as a landmark south of the compound, outside the play area */
  // swap the simple street cars for the real models: drop ground planes, scale to the car's length, wheels on the ground,
  // length turned onto the X axis (the simple car's long side)
  function placeCars(scene) {
    const list = (BV.Map.data && BV.Map.data.cars) || []; let n = 0;
    for (const { g, p } of list) {
      const tpl = carTpl[p.model]; if (!tpl) continue;
      const inner = tpl.clone(true), rm = []; inner.traverse(o => { if (o.isMesh && /plane/i.test((o.parent && o.parent.name || '') + o.name)) rm.push(o); }); rm.forEach(o => o.parent.remove(o));
      inner.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(inner), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const k = (p.len || 4.2) / Math.max(sz.x, sz.z), wrap = new THREE.Group(), spin = new THREE.Group();
      inner.position.set(-c.x, -bb.min.y, -c.z); spin.add(inner); spin.scale.setScalar(k); spin.rotation.y = sz.z > sz.x ? Math.PI / 2 : 0;
      wrap.add(spin); wrap.position.set(p.x, 0, p.z); wrap.rotation.y = p.rot;
      wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(wrap); g.visible = false; p.real = wrap; n++;
    }
    return n;
  }
  // swap the simple wagons of RAILYARD-12 for the real vehicles: length along X, real length, wheels on the rails
  function placeTrains(scene) {
    const list = (BV.Map.data && BV.Map.data.wagons) || []; let n = 0;
    for (const { g, p } of list) {
      const tpl = trainTpl[p.kind]; if (!tpl) continue;
      const inner = tpl.clone(true); inner.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(inner), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const k = p.len / Math.max(sz.x, sz.z), wrap = new THREE.Group(), spin = new THREE.Group();
      inner.position.set(-c.x, -bb.min.y, -c.z); spin.add(inner); spin.scale.setScalar(k); spin.rotation.y = sz.z > sz.x ? Math.PI / 2 : 0;
      wrap.add(spin); wrap.position.set(p.x, 0, p.z); wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(wrap); g.visible = false; p.real = wrap; n++;
    }
    return n;
  }
  function placeWarehouse(scene) {
    if (!warehouse || (BV.Map.data && BV.Map.data.noWarehouse)) return false;
    const box = new THREE.Box3().setFromObject(warehouse), c = box.getCenter(new THREE.Vector3());
    const g = new THREE.Group(), inner = warehouse; inner.position.set(-c.x, -box.min.y - 0.2, -c.z); g.add(inner);
    g.position.set(-14, 0, 76); g.rotation.y = Math.PI * 0.5; scene.add(g);
    return true;
  }
  // operator variety: every model shares the operator skeleton and animations
  function characters(team) {
    const base = soldier ? [{ scene: soldier.scene, id: 'operator' }] : [];
    const extra = team === 'VANGUARD' ? ['char_swat', 'char_swat2'] : ['char_merc'];   // stalker held back until its boots skin cleanly
    return base.concat(extra.filter(k => chars[k]).map(k => ({ scene: chars[k], id: k })));
  }
  return { _packs: packs, characters, load, gun, akPack, fpPack, armsRig, thrownGrenade, cutterModel, placeCars, placeTrains, shieldModel: () => shieldTpl ? shieldTpl.clone() : null, placeOffice, hostageScene: (k) => hostages[k] || null, chargeModel, skyTexture, placeCity, dressMap, placeOutpost, placeWarehouse, get ready() { return ready; }, get soldier() { return soldier; }, get kit() { return kit; }, clips };
})();
