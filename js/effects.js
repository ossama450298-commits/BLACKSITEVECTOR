/* =====================================================================
   effects.js — pooled, cheap visual effects: tracers, sparks, stylised
   blood, smoke puffs, bullet decals, muzzle flashes, explosions and
   shell casings. Everything is preallocated to avoid GC spikes.
   ===================================================================== */
'use strict';
BV.Effects = (function () {
  let scene = null, vmScene = null;
  const V = THREE.Vector3;

  /* ---------- point-particle system (sparks / blood / debris) ---------- */
  function PointPool(n, size, blending, opacity) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: opacity || 1, depthWrite: false, blending, map: blending === THREE.AdditiveBlending ? BV.Textures.glow() : null, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    const P = []; for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, grav: 9 });
    let next = 0;
    return {
      obj: pts,
      emit(x, y, z, vx, vy, vz, life, r, g, b, grav) {
        const p = P[next]; next = (next + 1) % n;
        p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.r = r; p.g = g; p.b = b; p.grav = grav === undefined ? 9 : grav;
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          const p = P[i];
          if (p.life > 0) {
            p.life -= dt;
            p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
            const k = Math.max(0, p.life / p.max);
            pos[i * 3] = p.x; pos[i * 3 + 1] = p.life > 0 ? p.y : -999; pos[i * 3 + 2] = p.z;
            col[i * 3] = p.r * k; col[i * 3 + 1] = p.g * k; col[i * 3 + 2] = p.b * k;
          } else if (pos[i * 3 + 1] !== -999) pos[i * 3 + 1] = -999;
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      },
      clear() { for (let i = 0; i < n; i++) { P[i].life = 0; pos[i * 3 + 1] = -999; } geo.attributes.position.needsUpdate = true; }
    };
  }

  let sparks, blood, debris, tracerGeo, tracerArr, tracerCol, tracerLife = [], tracerN = 48, tracerNext = 0;
  const smokes = [], flashes = [], decals = [], shells = [], fireballs = [];
  let decalNext = 0, smokeNext = 0, flashNext = 0, shellNext = 0;
  const shake = { t: 0, amp: 0 };
  let screenFlash = 0;

  function init(sc, vms) {
    scene = sc; vmScene = vms;
    sparks = PointPool(260, 0.12, THREE.AdditiveBlending); scene.add(sparks.obj);
    blood = PointPool(200, 0.09, THREE.NormalBlending, 0.95); scene.add(blood.obj);
    debris = PointPool(160, 0.07, THREE.NormalBlending, 1); scene.add(debris.obj);
    // tracers: one LineSegments buffer
    tracerGeo = new THREE.BufferGeometry();
    tracerArr = new Float32Array(tracerN * 6); tracerCol = new Float32Array(tracerN * 6);
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerArr, 3));
    tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerCol, 3));
    const tl = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    tl.frustumCulled = false; scene.add(tl);
    for (let i = 0; i < tracerN; i++) tracerLife.push(0);
    // smoke sprites
    const smokeTex = BV.Textures.smoke();
    for (let i = 0; i < 48; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9a9890, transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false; scene.add(s); smokes.push({ s, life: 0, max: 1, grow: 1, vy: 0.4, op: 0.5 });
    }
    // muzzle flash sprites (third person)
    const fl = BV.Textures.flash();
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fl, color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; scene.add(s); flashes.push({ s, life: 0 });
    }
    // fireballs
    const gl = BV.Textures.glow();
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gl, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; scene.add(s); fireballs.push({ s, life: 0, max: 1, size: 1 });
    }
    // bullet decals
    const holeMat = new THREE.MeshBasicMaterial({ map: BV.Textures.bulletHole(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const scorchMat = new THREE.MeshBasicMaterial({ map: BV.Textures.scorch(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const dg = new THREE.PlaneGeometry(0.12, 0.12);
    for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(dg, holeMat); m.visible = false; scene.add(m); decals.push(m); }
    decals.scorch = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), scorchMat); m.visible = false; scene.add(m); decals.scorch.push(m); }
    decals.scorchNext = 0;
    // shell casings live in the view-model scene
    const sg = new THREE.BoxGeometry(0.008, 0.008, 0.022), sm = new THREE.MeshLambertMaterial({ color: 0xc9a24a, emissive: 0x2a1e08 });
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(sg, sm); m.visible = false; vmScene.add(m); shells.push({ m, life: 0, v: new V(), spin: new V() }); }
  }

  const low = () => !BV.settings.effects;

  function tracer(a, b, bright) {
    const i = tracerNext; tracerNext = (tracerNext + 1) % tracerN;
    // shorten the tracer: draw a streak segment, not the full line
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const s0 = Math.min(len * 0.25, 1.5), s1 = Math.min(len, s0 + 6 + Math.random() * 6);
    tracerArr.set([a.x + dx / len * s0, a.y + dy / len * s0, a.z + dz / len * s0, a.x + dx / len * s1, a.y + dy / len * s1, a.z + dz / len * s1], i * 6);
    tracerLife[i] = bright ? 0.07 : 0.05;
  }
  function impact(p, n, kind) {
    const cnt = low() ? 3 : (kind === 'metal' ? 10 : 6);
    for (let i = 0; i < cnt; i++) {
      const sp = 2 + Math.random() * 3;
      sparks.emit(p.x + n[0] * 0.03, p.y + n[1] * 0.03, p.z + n[2] * 0.03,
        n[0] * sp + (Math.random() - 0.5) * 3, n[1] * sp + Math.random() * 2.5, n[2] * sp + (Math.random() - 0.5) * 3,
        0.25 + Math.random() * 0.25, 1, 0.75, 0.35, 12);
    }
    if (kind !== 'metal' && !low()) for (let i = 0; i < 5; i++) debris.emit(p.x, p.y, p.z, n[0] * 2 + (Math.random() - 0.5) * 2, n[1] * 2 + Math.random() * 2, n[2] * 2 + (Math.random() - 0.5) * 2, 0.6, 0.35, 0.33, 0.3, 9);
    puff(p.x + n[0] * 0.1, p.y + n[1] * 0.1, p.z + n[2] * 0.1, 0.35, 0.8, 0.35);
    // decal oriented to the surface normal
    const d = decals[decalNext]; decalNext = (decalNext + 1) % decals.length;
    d.position.set(p.x + n[0] * 0.01, p.y + n[1] * 0.01, p.z + n[2] * 0.01);
    d.lookAt(p.x + n[0], p.y + n[1], p.z + n[2]); d.rotation.z = Math.random() * 6;
    d.visible = true;
  }
  function bloodHit(p, dir, head) {
    const cnt = low() ? 4 : (head ? 16 : 9);
    for (let i = 0; i < cnt; i++) {
      blood.emit(p.x, p.y, p.z, dir.x * 1.5 + (Math.random() - 0.5) * 2.2, Math.random() * 2, dir.z * 1.5 + (Math.random() - 0.5) * 2.2,
        0.4 + Math.random() * 0.3, 0.5 + Math.random() * 0.15, 0.06, 0.04, 9);
    }
    puff(p.x, p.y, p.z, 0.25, 0.4, 0.25, 0x7a1d14);
  }
  function puff(x, y, z, size, life, op, color) {
    const s = smokes[smokeNext]; smokeNext = (smokeNext + 1) % smokes.length;
    s.s.position.set(x, y, z); s.s.scale.set(size, size, 1); s.s.visible = true;
    s.s.material.color.setHex(color || 0x9a9890);
    s.life = s.max = life; s.grow = size * 2.2; s.op = op; s.vy = 0.5;
    s.s.material.rotation = Math.random() * 6;
  }
  function muzzle(pos) {
    const f = flashes[flashNext]; flashNext = (flashNext + 1) % flashes.length;
    f.s.position.copy(pos); const s = 0.45 + Math.random() * 0.25; f.s.scale.set(s, s, 1);
    f.s.material.rotation = Math.random() * 6; f.s.visible = true; f.life = 0.05;
  }
  function explosion(p) {
    for (let i = 0; i < fireballs.length; i++) {
      const f = fireballs[i];
      f.s.position.set(p.x + (Math.random() - 0.5) * 2, p.y + 0.5 + Math.random() * 2, p.z + (Math.random() - 0.5) * 2);
      f.size = 3 + Math.random() * 5; f.life = f.max = 0.35 + Math.random() * 0.5; f.s.visible = true;
      f.s.material.color.setHex(i % 2 ? 0xffb050 : 0xff7a30);
    }
    const cnt = low() ? 40 : 120;
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.4, sp = 5 + Math.random() * 14;
      sparks.emit(p.x, p.y + 0.4, p.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp, 0.6 + Math.random() * 0.9, 1, 0.6, 0.2, 10);
    }
    for (let i = 0; i < 40; i++) debris.emit(p.x, p.y + 0.3, p.z, (Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 12, 1.4, 0.2, 0.19, 0.17, 12);
    for (let i = 0; i < 14; i++) puff(p.x + (Math.random() - 0.5) * 5, p.y + Math.random() * 3, p.z + (Math.random() - 0.5) * 5, 2.5 + Math.random() * 2, 2.5 + Math.random() * 2, 0.55, 0x4d4a45);
    const sc = decals.scorch[decals.scorchNext]; decals.scorchNext = (decals.scorchNext + 1) % decals.scorch.length;
    sc.position.set(p.x, 0.03, p.z); sc.rotation.set(-Math.PI / 2, 0, Math.random() * 6); sc.visible = true;
  }
  function addShake(amp, t) { shake.amp = Math.max(shake.amp, amp); shake.t = Math.max(shake.t, t); }
  function flashScreen(v) { screenFlash = Math.max(screenFlash, v); }

  /* shell ejected from the view-model (camera space) */
  function shell(origin, right) {
    if (low()) return;
    const s = shells[shellNext]; shellNext = (shellNext + 1) % shells.length;
    s.m.position.copy(origin); s.m.visible = true; s.life = 0.7;
    s.v.set(1.0 + Math.random() * 0.6, 1.4 + Math.random() * 0.6, 0.3 + Math.random() * 0.3);
    s.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
  }

  function update(dt, camera) {
    sparks.update(dt); blood.update(dt); debris.update(dt);
    let dirty = false;
    for (let i = 0; i < tracerN; i++) {
      if (tracerLife[i] > 0) {
        tracerLife[i] -= dt; const k = Math.max(0, tracerLife[i] / 0.07);
        for (let j = 0; j < 2; j++) { tracerCol[i * 6 + j * 3] = 1 * k; tracerCol[i * 6 + j * 3 + 1] = 0.85 * k; tracerCol[i * 6 + j * 3 + 2] = 0.5 * k; }
        if (tracerLife[i] <= 0) for (let j = 0; j < 6; j++) tracerArr[i * 6 + j] = 0;
        dirty = true;
      }
    }
    if (dirty) { tracerGeo.attributes.position.needsUpdate = true; tracerGeo.attributes.color.needsUpdate = true; }
    for (const s of smokes) if (s.life > 0) {
      s.life -= dt; const k = s.life / s.max;
      s.s.position.y += s.vy * dt; const sz = s.s.scale.x + s.grow * dt * 0.5; s.s.scale.set(sz, sz, 1);
      s.s.material.opacity = Math.max(0, k * s.op); if (s.life <= 0) s.s.visible = false;
    }
    for (const f of flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; }
    for (const f of fireballs) if (f.life > 0) {
      f.life -= dt; const k = f.life / f.max; const s = f.size * (1.4 - k * 0.6);
      f.s.scale.set(s, s, 1); f.s.material.opacity = k; if (f.life <= 0) f.s.visible = false;
    }
    for (const s of shells) if (s.life > 0) {
      s.life -= dt; s.v.y -= 6 * dt;
      s.m.position.addScaledVector(s.v, dt * 0.5);
      s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt;
      if (s.life <= 0) s.m.visible = false;
    }
    if (shake.t > 0) shake.t -= dt; else shake.amp = 0;
    if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - dt * 1.5);
  }
  function shakeOffset() { return shake.t > 0 ? shake.amp * Math.min(1, shake.t * 2) : 0; }
  function clear() {
    sparks.clear(); blood.clear(); debris.clear();
    smokes.forEach(s => { s.life = 0; s.s.visible = false; });
    flashes.forEach(f => { f.life = 0; f.s.visible = false; });
    fireballs.forEach(f => { f.life = 0; f.s.visible = false; });
    decals.forEach(d => { d.visible = false; }); decals.scorch.forEach(d => { d.visible = false; });
    tracerLife.fill(0); tracerArr.fill(0); tracerGeo.attributes.position.needsUpdate = true;
  }

  return { init, tracer, impact, bloodHit, puff, muzzle, explosion, shell, addShake, flashScreen, update, shakeOffset, clear, get screenFlash() { return screenFlash; } };
})();
