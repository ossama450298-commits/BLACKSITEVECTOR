/* =====================================================================
   charmodels.js — skinned, animated operators.
   Base mesh + skeleton + animation clips: "Swat" from the Ultimate Modular
   Men pack by Quaternius (CC0 1.0), embedded in js/char_data.js.
   Each team re-skins it: Vanguard keeps the visored helmet, Raven swaps the
   head for a hooded balaclava with goggles. Weapons are our own models,
   attached to the right-hand bone. Exposes the same API as the procedural
   soldier in models.js, so game logic and hitboxes are untouched.
   ===================================================================== */
'use strict';
BV.CharModels = (function () {
  let tpl = null; const clips = {};
  let ready = false;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

  function load() {
    return new Promise((resolve) => {
      try {
        if (!BV.CHAR_DATA || !THREE.GLTFLoader || !THREE.SkeletonUtils) return resolve(false);
        const bin = atob(BV.CHAR_DATA.operator), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        new THREE.GLTFLoader().parse(buf.buffer, '', (g) => {
          tpl = g; g.animations.forEach(a => { clips[a.name] = a; });
          ready = true; resolve(true);
        }, (err) => { console.warn('operator model failed to load', err); resolve(false); });
      } catch (e) { console.warn(e); resolve(false); }
    });
  }

  /* attach an object to a bone so that, in the bind pose, it sits at a given
     model-space transform (compensates the bone's own rotation and scale) */
  function attachAtBind(bone, model, obj, pos, rotY, rotX) {
    // bind-pose transform of the bone in mesh space = inverse(boneInverse)
    let sk = null; model.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o.skeleton; });
    const want = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX || 0, rotY || 0, 0)), new THREE.Vector3(1, 1, 1));
    let bind;
    const i = sk ? sk.bones.indexOf(bone) : -1;
    if (i >= 0) bind = new THREE.Matrix4().copy(sk.boneInverses[i]).invert();
    else { model.updateMatrixWorld(true); bind = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(model.matrixWorld).invert(), bone.matrixWorld); }
    const local = new THREE.Matrix4().copy(bind).invert().multiply(want);
    local.decompose(obj.position, obj.quaternion, obj.scale);
    bone.add(obj);
  }

  /* ---------- analytic two-bone IK (world space) ---------- */
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _ax = new THREE.Vector3();
  const _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _rq = new THREE.Quaternion();
  function rotWorld(bone, q) {
    bone.parent.getWorldQuaternion(_pq); bone.getWorldQuaternion(_bq);
    _bq.premultiply(q); bone.quaternion.copy(_pq.invert().multiply(_bq)); bone.updateMatrixWorld(true);
  }
  function ik(upper, lower, end, target, weight) {
    if (weight <= 0.001) return;
    upper.getWorldPosition(_a); lower.getWorldPosition(_b); end.getWorldPosition(_c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
    const t = _d1.copy(target).sub(_a); const d = BV.U.clamp(t.length(), 0.02, l1 + l2 - 0.002);
    // elbow: set interior angle from the law of cosines
    const want = Math.acos(BV.U.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    const ba = _d2.copy(_a).sub(_b).normalize(), bc = _ax.copy(_c).sub(_b).normalize();
    const cur = Math.acos(BV.U.clamp(ba.dot(bc), -1, 1));
    const axis = new THREE.Vector3().crossVectors(bc, ba); if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0); axis.normalize();
    rotWorld(lower, _rq.setFromAxisAngle(axis, -(want - cur) * weight));
    // shoulder: swing the chain so the hand reaches the target
    end.getWorldPosition(_c);
    const from = _d2.copy(_c).sub(_a).normalize(), to = _ax.copy(target).sub(_a).normalize();
    _rq.setFromUnitVectors(from, to); if (weight < 1) _rq.slerp(new THREE.Quaternion(), 1 - weight);
    rotWorld(upper, _rq);
  }

  function create(teamId) {
    const T = BV.TEAMS[teamId], V = teamId === 'VANGUARD';
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const model = THREE.SkeletonUtils.clone(tpl.scene);
    model.rotation.y = Math.PI;                  // source faces +Z, game faces -Z
    body.add(model);
    const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name] = o; });
    // ---- team re-skin ----
    const mats = [];
    // distinct team palettes (silhouette + colour, like classic CT/T skins)
    const pal = V ? { Swat: 0x6f7f8c, Swat_Black: 0x3a4148, Skin: T.skin, Visor: 0x26343e }
                  : { Swat: 0x8f7c58, Swat_Black: 0x4a3b2c, Skin: T.skin, Visor: 0x26343e };
    const camo = BV.Models.uniformSkinFor ? BV.Models.uniformSkinFor(teamId) : null;
    model.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
      const src = o.material, name = src.name;
      const opts = { color: pal[name] !== undefined ? pal[name] : src.color.getHex(), skinning: true };
      if (name === 'Swat' && camo) opts.map = camo;
      const m = BV.mat(Object.assign({ roughness: name === 'Visor' ? 0.2 : 0.85, metalness: name === 'Visor' ? 0.5 : 0 }, opts));
      m.skinning = true; m.userData.base = m.color.clone(); mats.push(m); o.material = m;
    });
    // ---- pose the rig in the aim clip, then attach props in world space ----
    const mixer = new THREE.AnimationMixer(model);
    if (clips.Idle_Gun_Pointing) { mixer.clipAction(clips.Idle_Gun_Pointing).play(); mixer.update(0.01); }
    root.updateMatrixWorld(true);
    const attachWorld = (bone, obj, pos, quat) => {
      const want = new THREE.Matrix4().compose(pos, quat || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(want);
      local.decompose(obj.position, obj.quaternion, obj.scale); bone.add(obj);
    };
    const wp = (b) => b.getWorldPosition(new THREE.Vector3());
    if (!V && bones.Head && BV.Models.ravenHead) {
      model.traverse(o => { if (o.isMesh && o.parent && o.parent.name === 'Swat_Head') o.visible = false; });
      const h = BV.Models.ravenHead(mats);
      attachWorld(bones.Head, h, wp(bones.Head).add(new THREE.Vector3(0, -0.07, 0.01)));
    }
    // load-bearing gear on the chest bone (moves with the torso)
    const chestBone = bones.Chest || bones.Torso;
    if (chestBone && BV.Models.rbox) {
      const M = BV.Models, gear = new THREE.Group();
      const mk = (o) => { const mm = BV.mat(Object.assign({ roughness: 0.8 }, o)); mm.userData.base = mm.color.clone(); mats.push(mm); return mm; };
      const webbing = mk({ map: M.vestSkin(V ? 0x4f5a62 : 0x5a4a34) }), strap = mk({ color: V ? 0x2b302d : 0x2a2420 }), accent = mk({ color: T.accent });
      const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; gear.add(me); return me; };
      for (let i = -1; i <= 1; i++) { add(M.rbox(0.075, 0.12, 0.05, 0.014), webbing, i * 0.085, -0.06, -0.03); add(M.rbox(0.078, 0.025, 0.055, 0.008), strap, i * 0.085, 0.0, -0.03); }
      add(M.rbox(0.06, 0.09, 0.045, 0.014), strap, 0.17, -0.02, 0.02);                      // radio
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.24, 4), strap, 0.18, 0.13, 0.03);       // antenna
      if (V) add(M.rbox(0.07, 0.04, 0.012, 0.004), accent, -0.1, 0.1, -0.035);               // ID patch
      else { const x1 = add(M.rbox(0.04, 0.42, 0.012, 0.005), strap, 0, 0.02, -0.04); x1.rotation.z = 0.6; const x2 = add(M.rbox(0.04, 0.42, 0.012, 0.005), strap, 0, 0.02, -0.04); x2.rotation.z = -0.6; }
      add(M.rbox(0.3, 0.05, 0.22, 0.015), strap, 0, -0.3, 0.05);                              // belt
      add(M.rbox(0.05, 0.14, 0.08, 0.015), strap, 0.17, -0.38, 0.04);                         // holster
      const cp = wp(chestBone);
      attachWorld(chestBone, gear, new THREE.Vector3(0, cp.y, cp.z - 0.12));
    }
    if (bones.UpperArmL && bones.LowerArmL) {        // team armband
      const a = wp(bones.UpperArmL), b = wp(bones.LowerArmL), dir = b.clone().sub(a).normalize();
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.06, 12, 1, true), BV.mat({ color: T.accent, side: THREE.DoubleSide }));
      band.material.userData.base = band.material.color.clone(); mats.push(band.material);
      attachWorld(bones.UpperArmL, band, a.clone().addScaledVector(dir, 0.11), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    }
    // weapon: follows the right hand's position every frame but always points
    // where the operator aims (classic shooter convention, no wrist wobble)
    const gunHolder = new THREE.Group(); body.add(gunHolder);
    const supportLocal = new THREE.Vector3(), _tw = new THREE.Vector3(), _belt = new THREE.Vector3();
    let kick = 0, relPh = 0, ikW = 0;
    const handOff = new THREE.Vector3(0, -0.03, -0.05), _hw = new THREE.Vector3();
    const placeGun = (pitch) => {
      if (!bones.WristR) { gunHolder.position.set(0.15, 1.3, -0.4); return; }
      root.updateMatrixWorld(true);
      bones.WristR.getWorldPosition(_hw); body.worldToLocal(_hw);
      gunHolder.position.copy(_hw).add(handOff);
      gunHolder.position.z += kick * 0.04; gunHolder.position.y += kick * 0.01;
      gunHolder.rotation.set(pitch * 0.8 + kick * 0.12, 0, relPh > 0 ? Math.sin(Math.min(1, relPh) * Math.PI * 0.5) * 0.45 : 0);
    };
    // ---- blob shadow ----
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; root.add(shadow);

    // ---- animation ----
    const act = (n, once) => { const c = clips[n]; if (!c) return null; const a = mixer.clipAction(c); if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } return a; };
    const A = { aim: act('Idle_Gun_Pointing'), run: act('Run_Shoot'), shoot: act('Idle_Gun_Shoot'), hit: act('HitRecieve', true), death: act('Death', true) };
    ['aim', 'run', 'shoot'].forEach(k => { if (A[k]) { A[k].play(); A[k].setEffectiveWeight(k === 'aim' ? 1 : 0); } });
    const w = { aim: 1, run: 0, shoot: 0 };
    let currentGun = null, dying = false, lastDie = 0;
    const api = {
      root, body, torso: body, head: body, gunHolder, shadow, flashAnchor: null, ejectAnchor: null, state: null, shade: 1, skinned: true,
      setWeapon(def) {
        if (currentGun) gunHolder.remove(currentGun.group);
        currentGun = BV.Models.gun(def.model);
        const s = def.cls === 'melee' ? 1.2 : 1.05; currentGun.group.scale.set(s, s, s);
        currentGun.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
        gunHolder.add(currentGun.group);
        api.flashAnchor = currentGun.muzzle; api.ejectAnchor = currentGun.eject;
        // where the support (left) hand goes: handguard for long guns, cupping the grip for pistols
        api.cls = def.cls;
        const len = -currentGun.muzzle.position.z * s;
        if (def.cls === 'pistol') supportLocal.set(-0.035, -0.05, 0.02);
        else if (def.cls === 'melee' || def.cls === 'grenade') supportLocal.set(0, 0, 0);
        else supportLocal.set(0, Math.min(0.06, currentGun.muzzle.position.y * s * 0.45), -len * (def.cls === 'shotgun' ? 0.55 : 0.5));
      },
      animate(dt, speed, crouch, pitch, phase, firing) {
        if (dying) return;
        const st = api.state || {};
        const moving = Math.min(1, speed / 1.2);
        w.run += (moving - w.run) * Math.min(1, dt * 10);
        w.shoot += ((firing && speed < 1 ? 1 : 0) - w.shoot) * Math.min(1, dt * 18);
        w.aim = Math.max(0, 1 - w.run - w.shoot);
        if (A.run) { A.run.setEffectiveWeight(w.run); A.run.timeScale = BV.U.clamp(speed / 4.4, 0.55, 1.5); }
        if (A.shoot) A.shoot.setEffectiveWeight(w.shoot);
        if (A.aim) A.aim.setEffectiveWeight(w.aim);
        mixer.update(dt);
        // procedural layers on top of the clips: crouch, aim pitch, sprint carry
        body.position.y = -crouch * 0.42;
        if (crouch > 0.01) {
          // bend around the character's own right axis (bone axes are mirrored L/R)
          root.updateMatrixWorld(true);
          _v.set(1, 0, 0).applyQuaternion(root.getWorldQuaternion(_q)).normalize();
          for (const s of ['L', 'R']) {
            const ul = bones['UpperLeg' + s], ll = bones['LowerLeg' + s];
            if (ul) ul.rotateOnWorldAxis(_v, 1.15 * crouch);
            if (ll) { ul && ul.updateMatrixWorld(true); ll.rotateOnWorldAxis(_v, -2.1 * crouch); }
          }
        }
        const chest = bones.Chest || bones.Torso;
        if (chest) chest.rotateX(-pitch * 0.55 + (st.sprint ? 0.15 : 0));
        if (bones.Head) bones.Head.rotateX(-pitch * 0.3);
        // weapon handling layers: recoil kick and reload motion
        if (firing) kick = Math.min(1, kick + dt * 30); else kick = Math.max(0, kick - dt * 9);
        if (st.reloading) relPh = Math.min(3, relPh + dt * 2.2); else relPh = Math.max(0, relPh - dt * 4);
        placeGun(pitch);
        // support hand: two-handed hold (IK), reaching to the belt and back while reloading
        const wantIK = api.cls && api.cls !== 'melee' && api.cls !== 'grenade' ? 1 : 0;
        ikW += (wantIK - ikW) * Math.min(1, dt * 8);
        if (ikW > 0.01 && bones.UpperArmL && bones.LowerArmL && bones.WristL) {
          gunHolder.updateMatrixWorld(true);
          _tw.copy(supportLocal); gunHolder.localToWorld(_tw);
          if (relPh > 0) {                                   // hand to the mag pouch and back
            _belt.set(-0.12, 1.0, -0.1); body.localToWorld(_belt);
            const k = Math.sin(BV.U.clamp(relPh / 1.4, 0, 1) * Math.PI);
            _tw.lerp(_belt, k);
          }
          ik(bones.UpperArmL, bones.LowerArmL, bones.WristL, _tw, ikW);
        }
      },
      flinch() { if (A.hit && !dying) { A.hit.reset(); A.hit.setEffectiveWeight(0.7); A.hit.fadeOut(0.35); A.hit.play(); } },
      die(t) {
        if (!dying) {
          dying = true; lastDie = 0;
          ['aim', 'run', 'shoot'].forEach(k => A[k] && A[k].fadeOut(0.15));
          if (A.death) { A.death.reset(); A.death.setEffectiveWeight(1); A.death.fadeIn(0.1); A.death.play(); }
        }
        const tt = t * 0.6, dt = Math.max(0, tt - lastDie); lastDie = tt;
        mixer.update(dt); placeGun(-0.6 * Math.min(1, t * 2));
        const e = Math.min(1, t); shadow.scale.set(1 + e * 0.6, 1 + e * 1.2, 1);
      },
      reset() {
        dying = false; lastDie = 0; body.position.y = 0;
        if (A.death) A.death.stop();
        ['aim', 'run', 'shoot'].forEach(k => { if (A[k]) { A[k].stop(); A[k].play(); } });
        w.aim = 1; w.run = 0; w.shoot = 0; shadow.scale.set(1, 1, 1);
      },
      setShade(k) {
        if (Math.abs(k - api.shade) < 0.01) return; api.shade = k;
        for (const m of mats) m.color.copy(m.userData.base).multiplyScalar(k);
      }
    };
    api.reset();
    return api;
  }
  return { load, create, get ready() { return ready; } };
})();
