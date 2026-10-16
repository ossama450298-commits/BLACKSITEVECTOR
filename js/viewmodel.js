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
    this.arms = BV.Models.viewArms(team);
    const g = this.gun.group;
    if (def.cls === 'pistol') { this.arms.left.position.set(-0.035, -0.08, 0.04); this.arms.left.rotation.set(0.5, -0.3, 0.6); }
    if (def.cls === 'melee') { this.arms.left.visible = false; }
    if (def.cls === 'grenade') { this.arms.left.position.set(-0.12, -0.08, 0.05); this.arms.left.rotation.set(0.4, -0.2, 0.3); }
    if (def.cls === 'shotgun') { this.arms.left.position.set(-0.04, -0.03, -0.4); }
    if (def.cls === 'sniper') { this.arms.left.position.set(-0.06, -0.03, -0.32); }
    this.leftHome = this.arms.left.position.clone(); this.leftRot = this.arms.left.rotation.clone();
    g.add(this.arms.group);
    this.gun.muzzle.add(this.flash); this.gun.muzzle.add(this.cone);
    this.fp = this.flashProfile(def);
    this.base = def.cls === 'pistol' ? [0.13, -0.13, -0.33] : def.cls === 'melee' ? [0.17, -0.2, -0.33] : def.cls === 'grenade' ? [0.17, -0.19, -0.34]
      : def.cls === 'sniper' ? [0.17, -0.165, -0.55] : [0.17, -0.185, -0.47];
    this.baseRot = def.cls === 'melee' ? [0.1, 0.25, -0.15] : [0, 0.03, 0];
    // imported meshes carry the bore higher above the grip: drop them so the sights line up
    if (this.gun.imported) { this.base = this.base.slice(); this.base[1] -= Math.max(0, this.gun.muzzle.position.y - 0.04) * 0.9; }
    this.holder.add(g);
    this.t.draw = this.t.drawMax = def.cls === 'melee' ? 0.3 : 0.5; this.t.reload = 0; this.t.swing = 0; this.t.inspect = 0; this.t.pump = 0;
    this.sp.pv.y += 0.4; this.sp.rv.x += 2.5; // settle impulse after the raise
  }
  reload(time) { this.t.reload = time; this.t.reloadMax = time; this.t.inspect = 0; }
  swing() { this.t.swing = 0.32; }
  inspect() { if (this.t.reload <= 0 && this.t.draw <= 0 && this.def && this.def.cls !== 'grenade') this.t.inspect = 2.6; }
  land(speed) { const k = Math.min(1, speed / 12); this.sp.pv.y -= 0.9 * k; this.sp.rv.x -= 3 * k; }
  shot(def) {
    const k = (def.cls === 'sniper' ? 2.6 : def.cls === 'shotgun' ? 2.2 : def.cls === 'dmr' ? 1.5 : def.cls === 'pistol' ? 1.2 : 1) * (BV.classic ? 1.35 : 1);
    // spring impulses: back, up and a little random yaw/roll
    this.sp.pv.z += 0.9 * k; this.sp.pv.y += 0.12 * k;
    this.sp.rv.x += 4.2 * k; this.sp.rv.y += (Math.random() - 0.5) * 1.6 * k; this.sp.rv.z += (Math.random() - 0.5) * 2.0 * k;
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
      const tiltIn = ease(0.0, 0.14) * (1 - ease(0.82, 1.0));
      rz += tiltIn * 0.5; rx += tiltIn * 0.18; py -= tiltIn * 0.04; px -= tiltIn * 0.02;
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
    // ---- melee swing / grenade throw ----
    if (t.swing > 0) {
      t.swing -= dt; const p = 1 - Math.max(0, t.swing) / 0.32, s = Math.sin(p * Math.PI);
      if (def.cls === 'melee') { ry += s * 1.1; rx -= s * 0.5; px -= s * 0.1; pz -= s * 0.12; }
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
  }
};
