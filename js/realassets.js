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
    mp5:    { f: [0, 0, 1],  u: [0, 1, 0], g: [0.0065, -0.013, -0.032], m: [0.0065, 0.013, 0.3258], s: 1.05 },
    r870:   { f: [1, 0, 0],  u: [0, 1, 0], g: [-0.362, -0.083, 0],      m: [1.1703, 0.016, 0],      s: 0.443 },
    sniper: { f: [0, 0, -1], u: [0, 1, 0], g: [0.334, -0.24, 6.9],      m: [0.334, 2.46, -16.29],   s: 0.0369 },
    g19:    { f: [0.70, 0, 0.71], u: [-0.71, 0, 0.70], g: [-0.037, -0.023, 0.151], m: [0.011, -0.023, 0.299], s: 0.92, clip: [-0.045, -0.15, -0.21, 0.045, 0.08, 0.065] }
  };
  // game weapon model id -> [asset, extra scale]
  const USE = { pistol: ['g19', 1], pistolHeavy: ['g19', 1.12], smg: ['mp5', 1], smgCompact: ['mp5', 0.9], shotgun: ['r870', 1],
    rifle: ['ak47', 1], rifleCarbine: ['m4a1', 1], dmr: ['m4a1', 1.05], sniper: ['sniper', 1] };
  const guns = {}, kit = {}; let soldier = null, city = null, clips = {}, ready = false;

  function decode(b64) { const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; }
  function parse(b64) { return new Promise((res, rej) => new THREE.GLTFLoader().parse(decode(b64), '', res, rej)); }
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
  function clipGeo(geo, b) {
    const P = geo.attributes.position, n = geo.index ? geo.index.count : P.count, src = geo.index ? geo.index.array : null, keep = [];
    for (let t = 0; t < n; t += 3) {
      const ia = src ? src[t] : t, ib = src ? src[t + 1] : t + 1, ic = src ? src[t + 2] : t + 2;
      const cx = (P.getX(ia) + P.getX(ib) + P.getX(ic)) / 3, cy = (P.getY(ia) + P.getY(ib) + P.getY(ic)) / 3, cz = (P.getZ(ia) + P.getZ(ib) + P.getZ(ic)) / 3;
      if (cx > b[0] && cx < b[3] && cy > b[1] && cy < b[4] && cz > b[2] && cz < b[5]) keep.push(ia, ib, ic);
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
      if (c.clip) clipGeo(geo, c.clip);      // drop stray pieces outside the weapon's real volume
      geo.computeBoundingSphere();
      const me = new THREE.Mesh(geo, o.material); tpl.add(me);
    });
    return { tpl, muzzle: new THREE.Vector3(...c.m).applyMatrix4(M) };
  }
  function load() {
    if (!BV.REAL || !THREE.GLTFLoader) return Promise.resolve(false);
    const jobs = Object.keys(BV.REAL.guns).map(k => parse(BV.REAL.guns[k]).then(g => { styleMaterials(g.scene); guns[k] = calibrate(g.scene, CAL[k]); }));
    jobs.push(parse(BV.REAL.soldier).then(g => { styleMaterials(g.scene); soldier = g; }));
    if (BV.REAL.city) jobs.push(parse(BV.REAL.city).then(g => { styleMaterials(g.scene); city = BV.Models.flatten(g.scene); city.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); }));
    if (BV.REAL.kit) jobs.push(parse(BV.REAL.kit).then(g => { styleMaterials(g.scene); g.scene.children.forEach(c => { c.traverse(o => { if (o.isMesh && o.material) o.material.side = THREE.DoubleSide; }); c.position.set(0, 0, 0); const f = BV.Models.flatten(c); f.name = c.name; kit[c.name] = f; }); }));
    return Promise.all(jobs).then(() => {
      JSON.parse(BV.REAL.anims).forEach(c => { clips[c.name] = buildClip(c); });
      ready = true; return true;
    }).catch(e => { console.warn('realistic assets failed to load', e); return false; });
  }
  function gun(model) {
    if (!ready || !USE[model]) return null;
    const [k, sc] = USE[model], G = guns[k]; if (!G) return null;
    const group = new THREE.Group(), body = G.tpl.clone(); body.scale.setScalar(sc); group.add(body);
    const muzzle = new THREE.Object3D(); muzzle.position.copy(G.muzzle).multiplyScalar(sc); group.add(muzzle);
    const eject = new THREE.Object3D(); eject.position.set(0.03, muzzle.position.y * 0.8 + 0.01, muzzle.position.z * (model.startsWith('pistol') ? 0.35 : 0.18)); group.add(eject);
    return { group, muzzle, mag: null, magHome: null, eject, imported: true, real: true };
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
  return { load, gun, skyTexture, placeCity, dressMap, get ready() { return ready; }, get soldier() { return soldier; }, get kit() { return kit; }, clips };
})();
