/* =====================================================================
   viewmodel.js — first-person weapon & arms, rendered in their own scene
   on top of the world (classic "view model" technique). Handles bob,
   sway, recoil kick, reload/draw/melee animations, muzzle flash and
   ejected casings.
   ===================================================================== */
'use strict';
BV.Viewmodel = class {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group(); camera.add(this.root);
    this.holder = new THREE.Group(); this.root.add(this.holder);
    this.gun = null; this.arms = null; this.def = null;
    this.t = { bob: 0, draw: 0, reload: 0, reloadMax: 1, swing: 0, kick: 0, kickR: 0, flash: 0 };
    this.sway = { x: 0, y: 0 };
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: BV.Textures.flash(), color: 0xffe0b0, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    this.flash.visible = false; this.flash.renderOrder = 10;
    this.flashLight = new THREE.PointLight(0xffb060, 0, 3);
    this.root.add(this.flashLight);
    this._v = new THREE.Vector3();
  }
  equip(def, team) {
    if (this.gun) this.holder.remove(this.gun.group);
    this.def = def;
    this.gun = BV.Models.gun(def.model);
    this.arms = BV.Models.viewArms(team);
    const g = this.gun.group;
    if (def.cls === 'pistol') { this.arms.left.position.set(-0.035, -0.08, 0.04); this.arms.left.rotation.set(0.5, -0.3, 0.6); }
    if (def.cls === 'melee') { this.arms.left.visible = false; }
    if (def.cls === 'grenade') { this.arms.left.position.set(-0.12, -0.08, 0.05); this.arms.left.rotation.set(0.4, -0.2, 0.3); }
    g.add(this.arms.group);
    if (this.flash.parent) this.flash.parent.remove(this.flash);
    this.gun.muzzle.add(this.flash);
    this.base = def.cls === 'pistol' ? [0.15, -0.17, -0.36] : def.cls === 'melee' ? [0.17, -0.2, -0.33] : def.cls === 'grenade' ? [0.17, -0.19, -0.34]
      : def.cls === 'sniper' ? [0.16, -0.18, -0.46] : [0.17, -0.185, -0.47];
    this.baseRot = def.cls === 'melee' ? [0.1, 0.25, -0.15] : [0, 0.03, 0];
    this.holder.add(g);
    this.t.draw = def.cls === 'melee' ? 0.3 : 0.5; this.t.reload = 0; this.t.swing = 0;
  }
  reload(time) { this.t.reload = time; this.t.reloadMax = time; }
  swing() { this.t.swing = 0.32; }
  shot(def) {
    const k = def.cls === 'sniper' ? 2.5 : def.cls === 'shotgun' ? 2 : def.cls === 'pistol' ? 1.1 : 1;
    this.t.kick = Math.min(0.06, this.t.kick + 0.022 * k);
    this.t.kickR = Math.min(0.25, this.t.kickR + 0.05 * k);
    this.t.flash = 0.045;
    this.flash.material.rotation = Math.random() * Math.PI * 2;
    const s = (def.cls === 'pistol' ? 0.14 : def.cls === 'smg' || def.cls === 'smgCompact' ? 0.16 : 0.22) * (0.8 + Math.random() * 0.4);
    this.flash.scale.set(s, s, 1);
    // casing ejected to the right
    if (this.gun && def.cls !== 'shotgun' && def.cls !== 'sniper') {
      this.gun.group.updateMatrixWorld(true);
      const p = this._v.set(0.03, 0.04, -0.05);
      this.gun.group.localToWorld(p); this.camera.worldToLocal(p);
      BV.Effects.shell(p);
    }
  }
  /* world-space muzzle position (used for tracers) */
  muzzleWorld(out, cam) {
    if (!this.gun) return out.set(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    this.gun.muzzle.getWorldPosition(out); // in vm-camera space parented to vmCamera
    this.camera.worldToLocal(out);
    // map from view-model camera space to world camera space
    out.multiplyScalar(1.0);
    return cam.localToWorld(out);
  }
  update(dt, st) {
    if (!this.gun) return;
    const t = this.t, def = this.def;
    // bob
    const sp = st.speed;
    const k = BV.settings.viewBob ? Math.min(1, sp / 5) : 0;
    t.bob += dt * (sp > 0.3 ? 2 + sp * 1.25 : 0);
    let bx = Math.sin(t.bob) * 0.012 * k, by = -Math.abs(Math.cos(t.bob)) * 0.014 * k;
    if (!st.onGround) by += 0.02;
    // sway (lags behind mouse)
    this.sway.x += (BV.U.clamp(-st.mdx * 0.00045, -0.04, 0.04) - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (BV.U.clamp(st.mdy * 0.00045, -0.04, 0.04) - this.sway.y) * Math.min(1, dt * 10);
    // recoil spring back
    t.kick *= Math.exp(-dt * 16); t.kickR *= Math.exp(-dt * 12);
    let px = this.base[0] + bx + this.sway.x, py = this.base[1] + by + this.sway.y, pz = this.base[2] + t.kick;
    let rx = this.baseRot[0] + t.kickR, ry = this.baseRot[1] + this.sway.x * 2, rz = this.baseRot[2];
    if (st.sprint && !t.reload) { px -= 0.02; py -= 0.04; rx -= 0.25; ry += 0.55; rz += 0.15; }
    if (st.crouch) { py -= 0.006; }
    // draw
    if (t.draw > 0) { t.draw -= dt; const d = Math.max(0, t.draw) / 0.5; py -= d * 0.28; rx -= d * 0.9; }
    // reload: dip, tilt, mag out/in
    if (t.reload > 0) {
      t.reload -= dt;
      const p = 1 - Math.max(0, t.reload) / t.reloadMax;
      const dip = Math.sin(Math.min(1, p) * Math.PI);
      py -= dip * 0.07; rx += dip * 0.25; rz += dip * 0.55;
      if (this.gun.mag) {
        const h = this.gun.magHome, mp = p < 0.2 ? 0 : p < 0.42 ? (p - 0.2) / 0.22 : p < 0.6 ? 1 : p < 0.72 ? 1 - (p - 0.6) / 0.12 : 0;
        this.gun.mag.position.set(h.x, h.y - mp * 0.22, h.z + mp * 0.05);
        this.gun.mag.visible = !(p > 0.42 && p < 0.55);
      }
    } else if (this.gun.mag) { this.gun.mag.position.copy(this.gun.magHome); this.gun.mag.visible = true; }
    // melee swing / throw
    if (t.swing > 0) {
      t.swing -= dt; const p = 1 - Math.max(0, t.swing) / 0.32, s = Math.sin(p * Math.PI);
      if (def.cls === 'melee') { ry += s * 1.1; rx -= s * 0.5; px -= s * 0.1; pz -= s * 0.12; }
      else { py += s * 0.08; rx += s * 0.9; pz -= s * 0.1; }
    }
    if (st.busy) { py -= 0.3; rx -= 0.8; }
    this.holder.position.set(px, py, pz); this.holder.rotation.set(rx, ry, rz);
    // muzzle flash
    if (t.flash > 0) { t.flash -= dt; this.flash.visible = true; this.flashLight.intensity = 2.2; }
    else { this.flash.visible = false; this.flashLight.intensity = 0; }
    this.root.visible = st.visible;
  }
};
