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
  const guns = {}, kit = {}, outpost = {}, packs = {}; let ak74 = null, frag = null, makarov = null, soldier = null, city = null, warehouse = null, clips = {}, ready = false;

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
  function parse(b64) {
    return new Promise((res, rej) => {
      const L = new THREE.GLTFLoader();
      if (window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
      L.parse(decode(b64), '', g => { g.scene.traverse(o => { if (o.isMesh && o.geometry) toFloat(o.geometry); }); res(g); }, rej);
    });
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
    if (BV.REAL.city) jobs.push(parse(BV.REAL.city).then(g => { styleMaterials(g.scene); city = BV.Models.flatten(g.scene); city.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); }));
    for (const id in PACKS) { const c = PACKS[id]; if (BV.REAL[c.data] && !packs[c.data]) { packs[c.data] = 'loading'; jobs.push(parse(BV.REAL[c.data]).then(g => { styleMaterials(g.scene); packs[c.data] = prepPack(g, c); })); } }
    if (BV.REAL.ak74fp) jobs.push(parse(BV.REAL.ak74fp).then(g => { styleMaterials(g.scene); ak74 = prepAk74(g); }));
    if (BV.REAL.frag) jobs.push(parse(BV.REAL.frag).then(g => { styleMaterials(g.scene); frag = buildFrag(g.scene); }));
    if (BV.REAL.makarov) jobs.push(parse(BV.REAL.makarov).then(g => { styleMaterials(g.scene); makarov = buildMakarov(g.scene); }));
    if (BV.REAL.outpost) jobs.push(parse(BV.REAL.outpost).then(g => { styleMaterials(g.scene); g.scene.children.forEach(c => { c.position.set(0, 0, 0); const f = BV.Models.flatten(c); f.name = c.name; outpost[c.name] = f; }); }));
    if (BV.REAL.warehouse) jobs.push(parse(BV.REAL.warehouse).then(g => { styleMaterials(g.scene); g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } }); warehouse = g.scene; }));
    if (BV.REAL.kit) jobs.push(parse(BV.REAL.kit).then(g => { styleMaterials(g.scene); g.scene.children.forEach(c => { c.traverse(o => { if (o.isMesh && o.material) o.material.side = THREE.DoubleSide; }); c.position.set(0, 0, 0); const f = BV.Models.flatten(c); f.name = c.name; kit[c.name] = f; }); }));
    return Promise.all(jobs).then(() => {
      JSON.parse(BV.REAL.anims).forEach(c => { clips[c.name] = buildClip(c); });
      ready = true; return true;
    }).catch(e => { console.warn('realistic assets failed to load', e); return false; });
  }
  /* ---- first-person packs (DJMaesen, CC BY): arms + weapon + one hand-animated timeline each ----
     frames at 30 fps, cut by watching base / slide / bolt / magazine motion (the pistol follows the
     author's own key list). len = real weapon length (m): the pack is scaled from its own geometry. */
  const PACKS = {
    viper9:   { data: 'fp_pistol',  len: 0.21, gy: 0.62, gz: 0.22, clips: { fire: [0, 11], reload: [12, 82], reloadEmpty: [95, 175], draw: [187, 233], idle: [234, 264] } },
    falcon45: { data: 'fp_heavy',   len: 0.23, gy: 0.62, gz: 0.22, clips: { fire: [0, 9], reloadEmpty: [9, 84], reload: [87, 147], idle: [195, 219], draw: [222, 248] } },
    specter9: { data: 'fp_smg',     len: 0.62, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 4], reloadEmpty: [4, 80], reload: [84, 129], idle: [180, 207], draw: [216, 234] } },
    vectormp: { data: 'fp_smg',     len: 0.58, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 4], reloadEmpty: [4, 80], reload: [84, 129], idle: [180, 207], draw: [216, 234] } },
    hammer12: { data: 'fp_shotgun', len: 0.95, gy: 0.5,  gz: 0.22, clips: { fire: [0, 27], reload: [27, 102], idle: [105, 123], draw: [126, 140] } },
    halberd4: { data: 'fp_carbine', len: 0.82, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 6], reloadEmpty: [6, 69], reload: [72, 135], idle: [177, 204], draw: [207, 222] } },
    kestrel5: { data: 'fp_carbine', len: 0.86, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 6], reloadEmpty: [6, 69], reload: [72, 135], idle: [177, 204], draw: [207, 222] } },
    lynx7:    { data: 'fp_sniper',  len: 1.12, gy: 0.5,  gz: 0.3,  clips: { fire: [0, 48], reload: [48, 96], reloadEmpty: [99, 147], idle: [147, 180], draw: [183, 200] } },
    bastion60: { data: 'fp_lmg',    len: 1.05, gy: 0.5,  gz: 0.3,  world: 'lmg', clips: { fire: [0, 9], reload: [27, 168], idle: [216, 249], draw: [252, 276], reloadEmpty: [294, 432] } },
    // knife: same convention as the AK pack (centimetres, +Z forward, right hand at about x -21, shoulders ~60 cm behind)
    bladex:   { data: 'fp_knife', knife: true, fixedScale: 0.0085, place: [0.03, -0.13, -0.44], clips: { idle: [0, 39], attack1: [42, 60], attack2: [63, 81], attack3: [84, 120], draw: [123, 135] } }
  };
  function prepPack(g, c) {
    retroMaps(g.scene);
    const src = g.animations[0], U = THREE.AnimationUtils, clips = {};
    for (const k in c.clips) clips[k] = U.subclip(src, k, c.clips[k][0], c.clips[k][1], 30);
    g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
    // rest pose (start of idle): measure the weapon body to get scale, grip and muzzle
    const mix = new THREE.AnimationMixer(g.scene); mix.clipAction(clips.idle).play(); mix.update(0); g.scene.updateMatrixWorld(true);
    let base = null; g.scene.traverse(o => { if (!base && (o.name === 'base' || o.name === 'knife')) base = o; });
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
  function fpPack(id) {
    if (id === 'arx17') return akPack();
    const c = PACKS[id]; if (!c) return null; const D = packs[c.data]; if (!D || D === 'loading') return null;
    const group = new THREE.Group(), inner = THREE.SkeletonUtils.clone(D.scene);
    inner.scale.setScalar(D.s); inner.rotation.y = Math.PI;               // barrel along -Z, real size
    if (D.place) inner.position.set(D.place[0], D.place[1], D.place[2]);  // placed straight in view space (knife)
    else inner.position.set(D.grip.x * D.s, -D.grip.y * D.s, D.grip.z * D.s);   // grip at the weapon origin
    group.add(inner);
    const mixer = new THREE.AnimationMixer(inner), actions = {};
    for (const k in D.clips) actions[k] = mixer.clipAction(D.clips[k]);
    actions.idle.play(); mixer.update(0); group.updateMatrixWorld(true);
    let base = null; inner.traverse(o => { if (!base && (o.name === 'base' || o.name === 'knife')) base = o; });
    if (D.knife && base) base.scale.multiplyScalar(0.75);   // the source blade is long: bring it to a combat-knife size
    const muzzle = new THREE.Object3D();
    if (base) { const tip = inner.localToWorld(D.tip.clone()); muzzle.position.copy(base.worldToLocal(tip)); const ws = base.getWorldScale(new THREE.Vector3()); muzzle.scale.setScalar(1 / ws.x); base.add(muzzle); }
    else { muzzle.position.set(0, 0.05, -c.len * 0.7); group.add(muzzle); }
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
      _mixer: mixer, _actions: actions, get _cur() { return cur; }
    };
    return pack;
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
    let base = null; inner.traverse(o => { if (!base && o.name === 'base') base = o; });
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
  /* thrown grenade: the body only (the pin has been pulled) */
  function thrownGrenade() { if (!frag) return null; const g = new THREE.Group(); g.add(frag.body.clone()); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
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
    // weapons whose third-person model comes from their first-person pack (e.g. the LMG)
    for (const id in PACKS) { const c = PACKS[id]; if (c.world === model && packs[c.data] && packs[c.data].worldTpl) {
      const D = packs[c.data], group = new THREE.Group(), inner = D.worldTpl.clone();
      inner.scale.setScalar(D.s); inner.rotation.y = Math.PI; inner.position.set(D.grip.x * D.s, -D.grip.y * D.s, D.grip.z * D.s); group.add(inner);
      group.updateMatrixWorld(true);
      const muzzle = new THREE.Object3D(); muzzle.position.copy(inner.localToWorld(D.tip.clone())); group.add(muzzle);
      const eject = new THREE.Object3D(); eject.position.set(0.03, 0.06, -0.12); group.add(eject);
      return { group, muzzle, mag: null, magHome: null, eject, imported: true, real: true };
    } }
    if (ready && frag && model === 'grenade') {
      const group = new THREE.Group(), pin = frag.pin.clone(); group.add(frag.body.clone()); group.add(pin);
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
  function skyTexture() {
    if (!BV.REAL || !BV.REAL.sky) return null;
    const img = new Image(), t = new THREE.Texture(img);
    img.onload = () => { t.needsUpdate = true; }; img.src = BV.REAL.sky;
    t.encoding = THREE.sRGBEncoding; return t;
  }
  /* realistic city around the compound (four rotated copies, beyond the play area) */
  function placeCity(scene) {
    if (!city) return false;
    const box = new THREE.Box3().setFromObject(city), c = box.getCenter(new THREE.Vector3()), y = -box.min.y - 0.5;
    const spots = [[0, 0, -315], [Math.PI, 0, 315], [Math.PI / 2, 365, 0], [-Math.PI / 2, -365, 0]];
    for (const [rot, x, z] of spots) {
      const g = new THREE.Group(), inner = city.clone(); inner.position.set(-c.x, y, -c.z); g.add(inner);
      g.rotation.y = rot; g.position.set(x, 0, z); scene.add(g);
    }
    return true;
  }
  /* kit props along the foot of walls (decorative only: no collision, never in walkways) */
  function dressMap(scene) {
    if (!Object.keys(kit).length || !BV.Map || !BV.Map.data) return 0;
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
    if (!Object.keys(outpost).length || !BV.Map || !BV.Map.data) return 0;
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
  function placeWarehouse(scene) {
    if (!warehouse) return false;
    const box = new THREE.Box3().setFromObject(warehouse), c = box.getCenter(new THREE.Vector3());
    const g = new THREE.Group(), inner = warehouse; inner.position.set(-c.x, -box.min.y - 0.2, -c.z); g.add(inner);
    g.position.set(-14, 0, 76); g.rotation.y = Math.PI * 0.5; scene.add(g);
    return true;
  }
  return { _packs: packs, load, gun, akPack, fpPack, thrownGrenade, skyTexture, placeCity, dressMap, placeOutpost, placeWarehouse, get ready() { return ready; }, get soldier() { return soldier; }, get kit() { return kit; }, clips };
})();
