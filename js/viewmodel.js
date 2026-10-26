/* =====================================================================
   viewmodel.js — first-person weapon & arms, rendered in their own scene
   on top of the world. Animation is procedural and spring-based:
   recoil/landing/switch impulses feed damped springs, so the weapon has
   weight and settles naturally. Includes figure-eight walk bob, sprint
   carry, idle breathing, mouse sway with lag, strafe tilt, choreographed
   reloads (mag out → hand to pouch → mag in → charge), shotgun pump,
   inspect (F), per-weapon volumetric muzzle flashes and ejected brass.
   ===================================================================== */
'use strict';
BV.Viewmodel = class {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group(); camera.add(this.root);
    this.holder = new THREE.Group(); this.root.add(this.holder);
    this.gun = null; this.arms = null; this.def = null;
    this.t = { bob: 0, draw: 0, drawMax: 0.5, reload: 0, reloadMax: 1, swing: 0, flash: 0, flashMax: 0.05, time: 0, inspect: 0, pump: 0 };
    // damped springs: position (x,y,z) + rotation (x,y,z)
    this.sp = { p: new THREE.Vector3(), pv: new THREE.Vector3(), r: new THREE.Vector3(), rv: new THREE.Vector3() };
    this.sway = { x: 0, y: 0 }; this.tilt = 0;
    // flash: star sprite + 3 crossed side planes (gives volume from any angle) + light
    const flashTex = BV.Textures.flash();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: 0xffe0b0, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.flash.visible = false; this.flash.renderOrder = 10;
    this.cone = new THREE.Group();
    const coneTex = this.coneTexture();
    const coneMat = new THREE.MeshBasicMaterial({ map: coneTex, color: 0xffd2a0, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    for (let i = 0; i < 3; i++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.26), coneMat); pl.rotation.set(Math.PI / 2, 0, i * Math.PI / 3); pl.position.z = -0.13; pl.renderOrder = 10; this.cone.add(pl); }
    this.cone.visible = false;
    this.flashLight = new THREE.PointLight(0xffb060, 0, 3); this.root.add(this.flashLight);
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }
  coneTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = 32 + (Math.random() - 0.5) * 26, w = 2 + Math.random() * 7;
      const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,250,220,0.95)'); gr.addColorStop(0.4, 'rgba(255,190,90,0.55)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(32 - 3, 128); g.lineTo(x - w, 128 - 40 - Math.random() * 88); g.lineTo(x + w, 128 - 40 - Math.random() * 80); g.lineTo(32 + 3, 128); g.fill();
    }
    const t = new THREE.CanvasTexture(c); return t;
  }
  /* per-class muzzle flash profile: size, duration, colour, cone length */
  flashProfile(def) {
    const P = {
      pistol: { s: 0.12, t: 0.035, c: 0xffd6a0, l: 0.6 }, smg: { s: 0.14, t: 0.03, c: 0xffe2b0, l: 0.7 }, shotgun: { s: 0.3, t: 0.06, c: 0xffb070, l: 1.6 },
      rifle: { s: 0.2, t: 0.04, c: 0xffd090, l: 1.0 }, dmr: { s: 0.22, t: 0.045, c: 0xffc880, l: 1.2 }, sniper: { s: 0.3, t: 0.06, c: 0xffc070, l: 1.6 }
    };
    const p = P[def.cls] || P.rifle;
    if (def.id === 'vectormp') return { s: 0.08, t: 0.025, c: 0xffeac0, l: 0.35 };   // suppressed-style shroud
    if (def.id === 'halberd4') return { s: 0.17, t: 0.035, c: 0xffe0a8, l: 0.8 };
    return p;
  }
  equip(def, team) {
    if (this.gun) this.holder.remove(this.gun.group);
    this.def = def; this.team = team;
    this.gun = BV.Models.gun(def.model);
    // ARX-17: hand-animated first-person arms + AK (draw, idle, fire, reload, empty reload)
    this.pack = null;
    if (!BV.classic && BV.Real && BV.Real.fpPack) { const P = BV.Real.fpPack(def.id); if (P) { this.pack = P; this.gun = P.gun; } }
    this.arms = BV.Models.viewArms(team);
    if (this.pack) this.arms.group.visible = false;
    const g = this.gun.group;
    if (def.cls === 'pistol') { this.arms.left.position.set(-0.024, -0.062, 0.03); this.arms.left.rotation.set(0.45, -0.25, 1.75); this.arms.right.position.set(0.012, -0.048, 0.042); this.arms.right.rotation.set(0.15, 0.1, -1.3); this.arms.group.scale.setScalar(0.85); }
    if (def.cls === 'melee') { this.arms.left.visible = false; }
    if (def.cls === 'grenade') { this.arms.left.position.set(-0.12, -0.08, 0.05); this.arms.left.rotation.set(0.4, -0.2, 0.3); }
    if (def.cls === 'shotgun') { this.arms.left.position.set(-0.04, -0.03, -0.4); }
    if (def.cls === 'sniper') { this.arms.left.position.set(-0.06, -0.03, -0.32); }
    this.leftHome = this.arms.left.position.clone(); this.leftRot = this.arms.left.rotation.clone();
    g.add(this.arms.group);
    // realistic arms: the operator's own sleeves and gloves, posed onto the weapon with IK
    // the full-body rig looked poor this close to the camera; dedicated procedural arms are used instead
    this.rig = null; if (this.rigs) for (const k in this.rigs) this.rigs[k].group.visible = false;
    if (this.rig) { this.arms.group.traverse(o => { if (o.isMesh) o.visible = false; }); this.rig.left = def.cls !== 'melee'; }
    this.gun.muzzle.add(this.flash); this.gun.muzzle.add(this.cone);
    this.fp = this.flashProfile(def);
    this.base = def.cls === 'pistol' ? [0.13, -0.13, -0.33] : def.cls === 'melee' ? [0.17, -0.2, -0.33] : def.cls === 'grenade' ? [0.17, -0.19, -0.34]
      : def.cls === 'sniper' ? [0.17, -0.165, -0.55] : [0.17, -0.185, -0.47];
    this.baseRot = def.cls === 'melee' ? [0.1, 0.25, -0.15] : [0, 0.03, 0];
    // imported meshes carry the bore higher above the grip: drop them so the sights line up
    if (this.gun.imported) { this.base = this.base.slice(); this.base[1] -= Math.max(0, this.gun.muzzle.position.y - 0.04) * 0.9; }
    if (this.gun.real && def.cls === 'pistol') { this.base = [0.15, -0.105, -0.45]; }
    if (this.gun.real && def.cls === 'grenade') { this.base = [0.15, -0.125, -0.33]; this.baseRot = [0.15, 0.25, -0.1]; }
    if (this.gun.real && def.cls === 'shotgun') { this.base = this.base.slice(); this.base[1] += 0.05; }
    if (this.gun.real && def.cls !== 'pistol' && def.cls !== 'melee' && def.cls !== 'grenade') { this.base = this.base.slice(); this.base[1] += 0.035; this.base[2] += 0.04; }
    // geometric framing for firearms: the grip sits at a per-class point in camera space and the
    // barrel is aimed at a far point on the crosshair, so every weapon reads as held and pointed at
    // the centre of the screen regardless of the model's size
    if (def.cls !== 'melee' && def.cls !== 'grenade') {
      const G = { pistol: [0.1, -0.112, -0.3], smg: [0.115, -0.14, -0.3], shotgun: [0.12, -0.15, -0.31], sniper: [0.125, -0.15, -0.32] }[def.cls] || [0.12, -0.148, -0.315];
      const aim = new THREE.Vector3(0, -0.035, -9), grip = new THREE.Vector3(G[0], G[1], G[2]);
      const d = aim.sub(grip).normalize();
      this.base = G.slice();
      this.baseRot = [Math.asin(BV.U.clamp(d.y, -1, 1)), Math.atan2(-d.x, -d.z), def.cls === 'pistol' ? 0 : -0.04];
      if (this.gun.real && def.cls !== 'pistol') {
        // support hand on the weapon's real handguard
        const mz = this.gun.muzzle.position.z, my = this.gun.muzzle.position.y;
        // support hand under the handguard (in front of the magazine), forearm running back-left
        this.arms.left.position.set(-0.012, my * 0.3 - 0.05, mz * (def.cls === 'shotgun' ? 0.62 : def.cls === 'smg' ? 0.66 : 0.6));
        this.arms.left.rotation.set(0.32, -0.42, 1.25);
        // firing hand wrapped round the pistol grip, wrist just behind it so it stays in frame
        this.arms.right.position.set(0.006, -0.05, 0.03);
        this.arms.right.rotation.set(0.22, 0.14, -1.32);
        this.leftHome = this.arms.left.position.clone(); this.leftRot = this.arms.left.rotation.clone();
      }
    }
    // classic: 90° (4:3) period field of view, weapon larger and further right in frame
    if (BV.classic) { const b = this.base; this.base = [b[0] * 0.85 + 0.03, b[1] * 0.85 - 0.004, b[2] * 0.85]; }
    this.holder.add(g);
    if (this.pack) this.pack.play('draw');
    this.t.draw = this.t.drawMax = def.cls === 'melee' ? 0.3 : (BV.classic ? 0.35 : 0.5); this.t.reload = 0; this.t.swing = 0; this.t.inspect = 0; this.t.pump = 0;
    this.sp.pv.y += 0.4; this.sp.rv.x += 2.5; // settle impulse after the raise
  }
  reload(time, empty) { this.t.reload = time; this.t.reloadMax = time; this.t.inspect = 0; if (this.pack) this.pack.play(empty ? 'reloadEmpty' : 'reload', time); }
  swing() { this.t.swing = 0.32; if (this.pack && this.def && this.def.cls === 'melee') this.pack.play('attack'); }
  inspect() { if (this.t.reload <= 0 && this.t.draw <= 0 && this.def && this.def.cls !== 'grenade') this.t.inspect = 2.6; }
  land(speed) { const k = Math.min(1, speed / 12); this.sp.pv.y -= 0.9 * k; this.sp.rv.x -= 3 * k; }
  shot(def) {
    const k = (def.cls === 'sniper' ? 2.6 : def.cls === 'shotgun' ? 2.2 : def.cls === 'dmr' ? 1.5 : def.cls === 'pistol' ? 1.2 : 1) * (BV.classic ? 1.35 : 1);
    // spring impulses: back, up and a little random yaw/roll
    this.sp.pv.z += 0.95 * k; this.sp.pv.y += 0.2 * k;
    this.sp.rv.x += 5.4 * k; this.sp.rv.y += (Math.random() - 0.5) * 2.2 * k; this.sp.rv.z += (Math.random() - 0.5) * 2.8 * k;
    // snappy kick (back + muzzle climb, recovers in ~70 ms) and heat that builds up during bursts
    this.t.slide = 1;
    if (this.pack) this.pack.play('fire');
    this.t.kick = 1; this.kickK = k; this.t.heat = Math.min(1, (this.t.heat || 0) + 0.18 * k);
    this.t.flash = this.t.flashMax = this.fp.t;
    this.flash.material.rotation = Math.random() * Math.PI * 2;
    this.flash.material.color.setHex(this.fp.c);
    const s = this.fp.s * (0.8 + Math.random() * 0.45); this.flash.scale.set(s, s, 1);
    this.cone.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, this.fp.l * (0.8 + Math.random() * 0.5));
    this.cone.rotation.z = Math.random() * Math.PI;
    if (def.cls === 'shotgun') this.t.pump = 0.55;
    this.t.inspect = 0;
  }
  /* world-space positions of view-model anchors (for tracers & brass) */
  anchorWorld(obj, out, cam) {
    this.camera.updateMatrixWorld(true); this.root.updateMatrixWorld(true);
    obj.getWorldPosition(out); this.camera.worldToLocal(out);
    return cam.localToWorld(out);
  }
  muzzleWorld(out, cam) { if (!this.gun) return out.set(0, 0, 0); return this.anchorWorld(this.gun.muzzle, out, cam); }
  ejectWorld(out, cam) { if (!this.gun || !this.gun.eject) return null; return this.anchorWorld(this.gun.eject, out, cam); }

  update(dt, st) {
    if (!this.gun) return;
    const t = this.t, def = this.def, sp = this.sp, cfg = BV.settings;
    t.time += dt;
    // ---- springs (critically-damped-ish) ----
    // fixed sub-steps keep the springs stable at any frame rate
    // classic: stiffer springs = quick, arcade snap-back like late-90s shooters
    const C = BV.classic, K = C ? 300 : 140, D = C ? 26 : 18, KR = C ? 260 : 120, DR = C ? 22 : 15, n = Math.min(14, Math.ceil(dt / 0.007)), h = dt / n;
    for (let i = 0; i < n; i++) {
      sp.pv.addScaledVector(sp.p, -K * h); sp.pv.multiplyScalar(1 - D * h); sp.p.addScaledVector(sp.pv, h);
      sp.rv.addScaledVector(sp.r, -KR * h); sp.rv.multiplyScalar(1 - DR * h); sp.r.addScaledVector(sp.rv, h);
    }
    if (!isFinite(sp.p.x + sp.r.x)) { sp.p.set(0, 0, 0); sp.pv.set(0, 0, 0); sp.r.set(0, 0, 0); sp.rv.set(0, 0, 0); }
    // ---- locomotion bob: figure-eight, stronger when sprinting ----
    const speed = st.speed, bobK = cfg.viewBob ? Math.min(1.3, speed / 4.6) * (BV.classic ? 0.8 : 1) : 0;
    t.bob += dt * (speed > 0.3 ? 3.2 + speed * 1.15 : 0);
    const sprintK = st.sprint ? 1.6 : 1;
    let bx = Math.sin(t.bob) * 0.011 * bobK * sprintK;
    let by = -Math.abs(Math.cos(t.bob)) * 0.012 * bobK * sprintK;
    let bRz = Math.sin(t.bob) * 0.025 * bobK * sprintK;
    // idle breathing
    const breathe = Math.sin(t.time * 1.7) * 0.0022, breatheR = Math.sin(t.time * 0.9) * 0.006;
    if (!st.onGround) by += 0.018;
    // ---- sway & strafe tilt ----
    this.sway.x += (BV.U.clamp(-st.mdx * 0.0005, -0.05, 0.05) - this.sway.x) * Math.min(1, dt * 9);
    this.sway.y += (BV.U.clamp(st.mdy * 0.0005, -0.05, 0.05) - this.sway.y) * Math.min(1, dt * 9);
    this.tilt += ((st.strafe || 0) * -0.05 - this.tilt) * Math.min(1, dt * 6);

    let px = this.base[0] + bx + this.sway.x + sp.p.x * 0.05, py = this.base[1] + by + breathe + this.sway.y + sp.p.y * 0.05, pz = this.base[2] + sp.p.z * 0.05;
    let rx = this.baseRot[0] + sp.r.x * 0.05 + breatheR, ry = this.baseRot[1] + this.sway.x * 2.2 + sp.r.y * 0.05, rz = this.baseRot[2] + bRz + this.tilt + sp.r.z * 0.05;
    if (st.sprint && !t.reload) { px -= 0.03; py -= 0.05; rx -= 0.3; ry += 0.6; rz += 0.2; }
    if (st.crouch) { py -= 0.008; rz -= 0.04; }
    if (this.pack) this.pack.update(dt);
    // ---- slide blowback (pistols with a separate slide): snaps back and returns in ~90 ms ----
    if (this.gun.slide) {
      const sl = this.gun.slide, e = t.slide > 0 ? Math.sqrt(t.slide) : 0;   // full travel at the shot, eases home
      sl.position.z = this.gun.slideHome.z + (t.slide > 0 ? e : 0) * this.gun.slideTravel;
      // locked back on an empty magazine during the reload until it is released
      if (t.reload > 0) { const pr = 1 - Math.max(0, t.reload) / t.reloadMax; if (pr < 0.84) sl.position.z = this.gun.slideHome.z + this.gun.slideTravel * 0.9; }
      t.slide = Math.max(0, (t.slide || 0) - dt / 0.09);
    }
    // ---- firing: sharp kick and burst shake ----
    if (t.kick > 0) { const e = t.kick * t.kick, kk = this.kickK || 1; pz += e * 0.028 * kk; py += e * 0.006 * kk; rx += e * 0.075 * kk; t.kick = Math.max(0, t.kick - dt / 0.07); }
    if (t.heat > 0) {
      const h = t.heat; px += (Math.random() - 0.5) * 0.004 * h; py += (Math.random() - 0.5) * 0.004 * h; rz += (Math.random() - 0.5) * 0.03 * h; rx += h * 0.02;
      t.heat = Math.max(0, t.heat - dt * 2.2);
    }
    // ---- draw: rise with overshoot ----
    if (t.draw > 0) {
      t.draw -= dt; const d = Math.max(0, t.draw) / t.drawMax, e = d * d;
      py -= e * 0.3; rx -= e * 1.1; rz += e * 0.4;
    }
    // ---- reload choreography ----
    const left = this.arms.left, mag = this.gun.mag;
    left.position.copy(this.leftHome); left.rotation.copy(this.leftRot);
    if (mag) { mag.position.copy(this.gun.magHome); mag.visible = true; }
    if (t.reload > 0) {
      t.reload -= dt;
      const p = 1 - Math.max(0, t.reload) / t.reloadMax;
      const ease = (a, b) => { const x = BV.U.clamp((p - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
      const tiltIn = this.pack ? 0 : ease(0.0, 0.14) * (1 - ease(0.82, 1.0));   // the animated pack does its own reload
      // raise and cant the weapon so the magazine well is in view
      rz += tiltIn * 0.3; ry += tiltIn * 0.38; rx += tiltIn * 0.06; py += tiltIn * 0.012; px -= tiltIn * 0.02; pz -= tiltIn * 0.07;
      if (def.cls === 'shotgun') {
        // load shells one by one: hand cycles under the receiver
        const cyc = (p * 5) % 1, inLoad = p > 0.1 && p < 0.85;
        if (inLoad) { left.position.y += -0.08 + Math.sin(cyc * Math.PI) * 0.06; left.position.z = 0.02 - Math.sin(cyc * Math.PI) * 0.06; left.rotation.x += 0.6; }
        if (p > 0.86 && p < 0.97) { const k = Math.sin((p - 0.86) / 0.11 * Math.PI); mag.position.z = this.gun.magHome.z + k * 0.07; left.position.z += k * 0.07; }
      } else if (mag) {
        const out = ease(0.14, 0.3), away = ease(0.3, 0.45), back = ease(0.45, 0.6), seat = ease(0.6, 0.68);
        // mag drops out, hand travels to the vest and back with a fresh mag, then seats it
        const drop = out * (1 - back);
        mag.position.y = this.gun.magHome.y - drop * 0.22 - away * (1 - back) * 0.15 + (1 - seat) * back * 0.03;
        mag.position.z = this.gun.magHome.z + drop * 0.06;
        mag.visible = !(p > 0.27 && p < 0.47);
        const hx = this.leftHome.x, hy = this.leftHome.y, hz = this.leftHome.z;
        const toMag = ease(0.1, 0.22) * (1 - ease(0.62, 0.75));
        left.position.set(hx + toMag * 0.02, hy - toMag * 0.05 - away * (1 - back) * 0.25, hz + toMag * (0.16 + (hz < -0.1 ? 0.12 : 0)) + away * (1 - back) * 0.12);
        left.rotation.x += toMag * 0.5;
        if (p > 0.6 && p < 0.7) { sp.pv.y += 3.5 * dt * 60 * 0.02; sp.rv.x -= 0.3; }      // seat bump
        // charging handle / slide release
        const charge = ease(0.74, 0.84) * (1 - ease(0.84, 0.92));
        rz -= charge * 0.25; ry -= charge * 0.15; pz += charge * 0.025;
        if (p > 0.84 && p < 0.86) { sp.rv.x += 1.5; sp.pv.z += 0.4; }
      }
    }
    // ---- shotgun pump after each shot ----
    if (t.pump > 0) {
      t.pump -= dt; const p = 1 - t.pump / 0.55;
      if (p > 0.25) { const k = Math.sin(BV.U.clamp((p - 0.25) / 0.7, 0, 1) * Math.PI); if (mag) mag.position.z = this.gun.magHome.z + k * 0.08; left.position.z += k * 0.08; rx -= k * 0.05; }
    }
    // ---- grenade pin: pulled at the start of the throw, back on the next grenade ----
    if (this.gun.pin) {
      const pin = this.gun.pin;
      pin.position.copy(this.gun.pinHome); pin.visible = true;
      if (t.swing > 0) { const p = 1 - Math.max(0, t.swing) / 0.32, k = BV.U.clamp(p / 0.35, 0, 1); pin.position.x += k * 0.05; pin.position.y += k * 0.035; pin.visible = p < 0.45; }
    }
    // ---- melee swing / grenade throw ----
    if (t.swing > 0) {
      t.swing -= dt; const p = 1 - Math.max(0, t.swing) / 0.32, s = Math.sin(p * Math.PI);
      if (def.cls === 'melee') { if (!this.pack) { ry += s * 1.1; rx -= s * 0.5; px -= s * 0.1; pz -= s * 0.12; } }   // the animated knife pack cuts by itself
      else { py += s * 0.08; rx += s * 0.9; pz -= s * 0.1; }
    }
    // ---- inspect ----
    if (t.inspect > 0) {
      t.inspect -= dt; const p = 1 - t.inspect / 2.6;
      const a = Math.sin(Math.min(1, p / 0.25) * Math.PI / 2) * (1 - Math.max(0, (p - 0.75) / 0.25));
      ry += a * 0.9; rz += a * 0.35; px -= a * 0.06; py += a * 0.03; rx += Math.sin(p * Math.PI * 2) * a * 0.12;
      if (p > 0.45 && p < 0.7) { const b = Math.sin((p - 0.45) / 0.25 * Math.PI); rz -= b * 0.9; ry -= b * 0.5; }
    }
    if (st.busy) { py -= 0.3; rx -= 0.8; }
    this.holder.position.set(px, py, pz); this.holder.rotation.set(rx, ry, rz);
    // ---- muzzle flash ----
    if (t.flash > 0) {
      t.flash -= dt; const k = Math.max(0, t.flash / t.flashMax);
      this.flash.visible = this.cone.visible = true; this.flash.material.opacity = k; this.cone.children[0].material.opacity = k;
      this.flashLight.intensity = 2.6 * k; this.flashLight.color.setHex(this.fp.c);
    } else { this.flash.visible = this.cone.visible = false; this.flashLight.intensity = 0; }
    this.root.visible = st.visible;
    if (this.rig) this.poseRig();
  }
  /* ---------- realistic first-person arms ---------- */
  armsRig(team) {
    if (!BV.Real || !BV.Real.ready || !BV.CharModels.ready || !BV.Real.soldier) return null;
    this.rigs = this.rigs || {};
    if (this.rigs[team]) { this.rigs[team].group.visible = true; for (const k in this.rigs) if (k !== team) this.rigs[k].group.visible = false; return this.rigs[team]; }
    const model = THREE.SkeletonUtils.clone(BV.Real.soldier.scene), bones = {};
    model.traverse(o => { if (o.isBone) bones[o.name.replace(/^mixamorig/, '').replace(/_\d+$/, '')] = o; });
    const tint = team === 'VANGUARD' ? null : new THREE.Color(0x8c7b66);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false;
      const fix = (m) => { const n = m.clone(); if (tint && n.color && !/skin|face|head|body_m|eye/i.test(n.name || '')) n.color.multiply(tint); return n; };
      o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    });
    // pose: two-handed pistol aim (natural elbows and curled fingers), captured once
    const mixer = new THREE.AnimationMixer(model), clip = BV.Real.clips.Pistol_Aim_Neutral;
    if (clip) { mixer.clipAction(clip).play(); mixer.update(0.2); }
    const chain = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'];
    const pose = {}; model.traverse(o => { if (o.isBone) pose[o.uuid] = o.quaternion.clone(); });
    // keep only the arms: triangles whose vertices are driven mainly by arm / forearm / hand bones
    model.traverse(o => {
      if (!o.isSkinnedMesh) { if (o.isMesh) o.visible = false; return; }
      const g = o.geometry.clone(), sk = o.skeleton, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
      if (!g.index) { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
      const armBone = sk.bones.map(b => /(Arm|ForeArm|Hand)/.test(b.name) && !/Shoulder/.test(b.name));
      const G4 = ['getX', 'getY', 'getZ', 'getW'];   // works for interleaved attributes too
      const isArm = (v) => { let wa = 0, wt = 0; for (let k = 0; k < 4; k++) { const w = SW[G4[k]](v), j = SI[G4[k]](v); wt += w; if (armBone[j]) wa += w; } return wt > 0 && wa / wt > 0.6; };
      const idx = g.index.array, groups = g.groups.length ? g.groups : [{ start: 0, count: idx.length, materialIndex: 0 }], out = [], ng = [];
      for (const gr of groups) {
        const st = out.length;
        for (let t = gr.start; t < gr.start + gr.count; t += 3) if (isArm(idx[t]) && isArm(idx[t + 1]) && isArm(idx[t + 2])) out.push(idx[t], idx[t + 1], idx[t + 2]);
        if (out.length > st) ng.push({ start: st, count: out.length - st, materialIndex: gr.materialIndex });
      }
      if (!out.length) { o.visible = false; return; }
      g.setIndex(out); g.clearGroups(); if (g.groups !== undefined && groups.length > 1) ng.forEach(x => g.addGroup(x.start, x.count, x.materialIndex));
      o.geometry = g;
    });
    // place the body so the eye sits at the camera: shoulders just below and behind the view
    const group = new THREE.Group(); group.add(model);
    model.rotation.y = Math.PI; model.position.set(0.0, -1.58, 0.16);
    this.root.add(group);
    // shift the body so the right shoulder sits just below/behind the eye (camera space)
    this.root.updateMatrixWorld(true);
    if (bones.RightArm) {
      const sh = bones.RightArm.getWorldPosition(new THREE.Vector3()); this.root.worldToLocal(sh);
      model.position.add(new THREE.Vector3(0.16, -0.2, 0.1).sub(sh));
    }
    const rig = { group, model, bones, pose, chain, left: true };
    this.rigs[team] = rig; for (const k in this.rigs) if (k !== team) this.rigs[k].group.visible = false;
    return rig;
  }
  poseRig() {
    const R = this.rig, B = R.bones, ik = BV.CharModels.ik;
    // restore the captured aim pose, then solve both arms onto the weapon
    R.model.traverse(o => { if (o.isBone && R.pose[o.uuid] && R.chain.includes(o.name.replace(/^mixamorig/, '').replace(/_\d+$/, ''))) o.quaternion.copy(R.pose[o.uuid]); });
    this.root.updateMatrixWorld(true);
    // wrist targets: behind and right of the grip (fingers wrap it), under the handguard for the support hand
    const pistol = this.def.cls === 'pistol';
    const grip = this.gun.group.localToWorld(new THREE.Vector3(0.03, pistol ? 0.005 : 0.0, pistol ? 0.06 : 0.08));
    ik(B.RightArm, B.RightForeArm, B.RightHand, grip, 1);
    if (this.handAlign) this.alignHand(B.RightHand, 0);
    if (R.left) {
      // support point: real handguard position for long guns, plus the animated reload offset
      const lp = this.arms.left.position, dl = lp.clone().sub(this.leftHome);
      const mz = this.gun.muzzle.position.z, my = this.gun.muzzle.position.y;
      const base = pistol ? lp.clone().sub(dl) : new THREE.Vector3(0, my * 0.35 - 0.02, mz * (this.def.cls === 'shotgun' ? 0.58 : 0.5));
      const sup = this.gun.group.localToWorld(base.add(dl).add(new THREE.Vector3(pistol ? -0.01 : -0.045, pistol ? -0.03 : -0.045, pistol ? 0.05 : 0.02)));
      ik(B.LeftArm, B.LeftForeArm, B.LeftHand, sup, 1);
      if (this.handAlign) this.alignHand(B.LeftHand, 1);
    }
  }
  // full hand orientation: fingers + palm directions expressed in the weapon's axes
  alignHand(hand, side) {
    const R = this.rig;
    if (!R.handAxes) {
      // local finger / palm axes from the T-pose bind (model faces +Z: right hand on -X, palms down)
      let sk = null; R.model.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o.skeleton; });
      R.handAxes = {};
      for (const [nm, fx] of [['RightHand', -1], ['LeftHand', 1]]) {
        const b = R.bones[nm], i = sk ? sk.bones.indexOf(b) : -1; if (i < 0) continue;
        const q = new THREE.Quaternion(); new THREE.Matrix4().copy(sk.boneInverses[i]).invert().decompose(new THREE.Vector3(), q, new THREE.Vector3());
        const qi = q.clone().invert();
        R.handAxes[nm] = { f: new THREE.Vector3(fx, 0, 0).applyQuaternion(qi).normalize(), p: new THREE.Vector3(0, -1, 0).applyQuaternion(qi).normalize() };
      }
    }
    const ax = R.handAxes[side === 0 ? 'RightHand' : 'LeftHand']; if (!ax) return;
    const gq = this.gun.group.getWorldQuaternion(new THREE.Quaternion());
    const F = new THREE.Vector3(0, 0, -1).applyQuaternion(gq), U = new THREE.Vector3(0, 1, 0).applyQuaternion(gq), X = new THREE.Vector3(1, 0, 0).applyQuaternion(gq);
    const pistol = this.def.cls === 'pistol';
    let wf, wp;
    if (side === 0) { wf = F.clone().multiplyScalar(0.55).addScaledVector(U, -0.83); wp = X.clone().negate(); }                       // grip: palm on the left of the hand, fingers forward-down
    else if (pistol) { wf = F.clone().multiplyScalar(0.6).addScaledVector(U, -0.6).addScaledVector(X, 0.3); wp = X.clone().multiplyScalar(0.75).addScaledVector(U, 0.65); } // cup the right hand
    else { wf = F.clone().multiplyScalar(0.45).addScaledVector(X, 0.9); wp = U.clone(); }                                         // under the handguard, palm up
    wf.normalize(); wp.addScaledVector(wf, -wp.dot(wf)).normalize();
    const lp = ax.p.clone().addScaledVector(ax.f, -ax.p.dot(ax.f)).normalize();
    const A = new THREE.Matrix4().makeBasis(ax.f, lp, new THREE.Vector3().crossVectors(ax.f, lp));
    const Bm = new THREE.Matrix4().makeBasis(wf, wp, new THREE.Vector3().crossVectors(wf, wp));
    const Rm = Bm.multiply(A.transpose());
    const want = new THREE.Quaternion().setFromRotationMatrix(Rm);
    const pq = hand.parent.getWorldQuaternion(new THREE.Quaternion());
    hand.quaternion.copy(pq.invert().multiply(want)); hand.updateMatrixWorld(true);
  }
};
