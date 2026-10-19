/* =====================================================================
   charmodels.js — realistic operators (v3.0)
   Model: "Rigged and Textured Mid-Poly Soldier" by DenisAlbu (CC BY-SA),
   Mixamo skeleton. Animations: Universal Animation Library (Quaternius,
   CC0) retargeted offline to this skeleton (see realassets.js).
   Layered animation: legs = locomotion, upper body = aim (blended by pitch),
   shoot, reload, hit; death is full body. Long guns are shouldered with
   two-hand IK. Same API as before; hitboxes are untouched.
   ===================================================================== */
'use strict';
BV.CharModels = (function () {
  const LOWER = /(Hips|UpLeg|Leg|Foot|ToeBase)_\d+\.(quaternion|position)$/;
  const upper = {}, lower = {}; let ready = false;
  function load() {
    return BV.Real.load().then(ok => {
      if (!ok || !BV.Real.soldier) return false;
      for (const n in BV.Real.clips) {
        const c = BV.Real.clips[n];
        upper[n] = new THREE.AnimationClip(n + '_up', c.duration, c.tracks.filter(t => !LOWER.test(t.name)));
        lower[n] = new THREE.AnimationClip(n + '_lo', c.duration, c.tracks.filter(t => LOWER.test(t.name)));
      }
      ready = true; return true;
    });
  }
  /* ---------- analytic two-bone IK (world space) ---------- */
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _ax = new THREE.Vector3();
  const _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _id = new THREE.Quaternion();
  function rotWorld(bone, q) { bone.parent.getWorldQuaternion(_pq); bone.getWorldQuaternion(_bq); _bq.premultiply(q); bone.quaternion.copy(_pq.invert().multiply(_bq)); bone.updateMatrixWorld(true); }
  function ik(upperB, lowerB, end, target, weight) {
    if (weight <= 0.001) return;
    upperB.getWorldPosition(_a); lowerB.getWorldPosition(_b); end.getWorldPosition(_c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
    const d = BV.U.clamp(_d1.copy(target).sub(_a).length(), 0.02, l1 + l2 - 0.002);
    const want = Math.acos(BV.U.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    const ba = _d2.copy(_a).sub(_b).normalize(), bc = _ax.copy(_c).sub(_b).normalize();
    const cur = Math.acos(BV.U.clamp(ba.dot(bc), -1, 1));
    const axis = new THREE.Vector3().crossVectors(bc, ba); if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0); axis.normalize();
    rotWorld(lowerB, _rq.setFromAxisAngle(axis, -(want - cur) * weight));
    end.getWorldPosition(_c);
    const from = _d2.copy(_c).sub(_a).normalize(), to = _ax.copy(target).sub(_a).normalize();
    _rq.setFromUnitVectors(from, to); if (weight < 1) _rq.slerp(_id, 1 - weight);
    rotWorld(upperB, _rq);
  }

  function create(teamId) {
    const T = BV.TEAMS[teamId], V = teamId === 'VANGUARD', M = BV.Models;
    const root = new THREE.Group(), bodyG = new THREE.Group(); root.add(bodyG);
    const model = THREE.SkeletonUtils.clone(BV.Real.soldier.scene);
    model.rotation.y = Math.PI;
    bodyG.add(model);
    const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name.replace(/^mixamorig/, '').replace(/_\d+$/, '')] = o; });
    const mats = [];
    // per-instance materials; Raven gets a darker, earthier uniform tint
    const tint = V ? null : new THREE.Color(0x8c7b66);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
      const fix = (m) => { const n = m.clone(); const skin = /skin|face|head|body_m|eye/i.test(n.name || ''); if (tint && !skin && n.color) n.color.multiply(tint); n.userData.base = n.color ? n.color.clone() : null; mats.push(n); return n; };
      o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    });
    const mixer = new THREE.AnimationMixer(model);
    if (BV.Real.clips.Pistol_Aim_Neutral) { mixer.clipAction(BV.Real.clips.Pistol_Aim_Neutral).play(); mixer.update(0.01); mixer.stopAllAction(); }
    root.updateMatrixWorld(true);
    const attachWorld = (bone, obj, pos, quat) => {
      const want = new THREE.Matrix4().compose(pos, quat || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(want);
      local.decompose(obj.position, obj.quaternion, obj.scale); bone.add(obj);
    };
    const wp = (b) => b.getWorldPosition(new THREE.Vector3());
    // team armband (only team marker: the soldier model already carries its own gear)
    if (bones.LeftArm && bones.LeftForeArm) {
      const a = wp(bones.LeftArm), b = wp(bones.LeftForeArm), dir = b.clone().sub(a).normalize();
      const bm = BV.mat({ color: T.accent, side: THREE.DoubleSide }); bm.userData.base = bm.color.clone(); mats.push(bm);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.07, 12, 1, true), bm);
      attachWorld(bones.LeftArm, band, a.clone().addScaledVector(dir, 0.11), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    }
    const gunHolder = new THREE.Group(); bodyG.add(gunHolder);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; root.add(shadow);
    const act = (clip) => { if (!clip) return null; const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); return a; };
    const L = { idle: act(lower.Idle_Loop), walk: act(lower.Walk_Loop), jog: act(lower.Jog_Fwd_Loop), sprint: act(lower.Sprint_Loop), cidle: act(lower.Crouch_Idle_Loop), cwalk: act(lower.Crouch_Fwd_Loop) };
    const U = { aim: act(upper.Pistol_Aim_Neutral), up: act(upper.Pistol_Aim_Up), down: act(upper.Pistol_Aim_Down), shoot: act(upper.Pistol_Shoot), reload: act(upper.Pistol_Reload), run: act(upper.Sprint_Loop) };
    const hit = upper.Hit_Chest ? mixer.clipAction(upper.Hit_Chest) : null; if (hit) hit.setLoop(THREE.LoopOnce, 1);
    const death = BV.Real.clips.Death01 ? mixer.clipAction(BV.Real.clips.Death01) : null; if (death) { death.setLoop(THREE.LoopOnce, 1); death.clampWhenFinished = true; }
    const wL = {}, wU = {}; for (const k in L) wL[k] = 0; for (const k in U) wU[k] = 0;
    const supportLocal = new THREE.Vector3(), _tw = new THREE.Vector3(), _belt = new THREE.Vector3(), _sh = new THREE.Vector3(), _v = new THREE.Vector3();
    let currentGun = null, dying = false, lastDie = 0, kick = 0, relPh = 0, ikW = 0, cls = 'rifle';
    const api = {
      root, body: bodyG, torso: bodyG, head: bodyG, gunHolder, shadow, flashAnchor: null, ejectAnchor: null, state: null, shade: 1, skinned: true,
      setWeapon(def) {
        if (currentGun) gunHolder.remove(currentGun.group);
        currentGun = M.gun(def.model);
        const s = def.cls === 'melee' ? 1.2 : 1.0; currentGun.group.scale.set(s, s, s);
        currentGun.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
        gunHolder.add(currentGun.group);
        api.flashAnchor = currentGun.muzzle; api.ejectAnchor = currentGun.eject;
        cls = def.cls;
        const len = -currentGun.muzzle.position.z * s;
        supportLocal.set(0, Math.min(0.06, currentGun.muzzle.position.y * s * 0.45), -len * (def.cls === 'shotgun' ? 0.6 : 0.52));
      },
      animate(dt, speed, crouch, pitch, phase, firing) {
        if (dying) return;
        const st = api.state || {}, k = Math.min(1, dt * 9);
        const crouching = crouch > 0.5, moving = speed > 0.35;
        const tL = { idle: 0, walk: 0, jog: 0, sprint: 0, cidle: 0, cwalk: 0 };
        if (crouching) tL[moving ? 'cwalk' : 'cidle'] = 1; else if (!moving) tL.idle = 1; else if (st.sprint) tL.sprint = 1; else if (speed < 2.6) tL.walk = 1; else tL.jog = 1;
        for (const n in L) { if (!L[n]) continue; wL[n] += (tL[n] - wL[n]) * k; L[n].setEffectiveWeight(wL[n]); }
        const dir = st.back ? -1 : 1;
        if (L.walk) L.walk.timeScale = dir * BV.U.clamp(speed / 1.6, 0.6, 1.6);
        if (L.jog) L.jog.timeScale = dir * BV.U.clamp(speed / 4.2, 0.7, 1.5);
        if (L.sprint) L.sprint.timeScale = BV.U.clamp(speed / 6.5, 0.8, 1.3);
        if (L.cwalk) L.cwalk.timeScale = dir * BV.U.clamp(speed / 1.4, 0.6, 1.6);
        if (firing) kick = Math.min(1, kick + dt * 30); else kick = Math.max(0, kick - dt * 9);
        if (st.reloading) relPh = Math.min(3, relPh + dt * 2.2); else relPh = Math.max(0, relPh - dt * 4);
        const tU = { aim: 0, up: 0, down: 0, shoot: 0, reload: 0, run: 0 };
        const pu = BV.U.clamp(pitch / 0.9, -1, 1);
        if (st.sprint && !firing) tU.run = 1; else if (st.reloading && cls === 'pistol') tU.reload = 1; else if (firing && cls === 'pistol') tU.shoot = 1;
        else { tU.aim = 1 - Math.abs(pu); if (pu > 0) tU.up = pu; else tU.down = -pu; }
        if (U.reload && tU.reload && wU.reload < 0.05) U.reload.time = 0;
        for (const n in U) { if (!U[n]) continue; wU[n] += (tU[n] - wU[n]) * Math.min(1, dt * 14); U[n].setEffectiveWeight(wU[n]); }
        mixer.update(dt);
        api.place(pitch, st);
      },
      place(pitch, st) {
        root.updateMatrixWorld(true);
        if (!currentGun) return;
        if (cls === 'pistol' || cls === 'melee' || cls === 'grenade' || (st && st.sprint)) {
          ikW = Math.max(0, ikW - 0.25);
          if (bones.RightHand) { bones.RightHand.getWorldPosition(_tw); bodyG.worldToLocal(_tw); gunHolder.position.copy(_tw).add(_v.set(0.0, -0.03, -0.07)); }
          gunHolder.rotation.set((st && st.sprint ? -0.5 : pitch * 0.85) + kick * 0.15, 0, 0);
          return;
        }
        if (bones.Spine2) { bones.Spine2.getWorldPosition(_sh); bodyG.worldToLocal(_sh); }
        const p = BV.U.clamp(pitch, -1.1, 1.1);
        gunHolder.position.set(_sh.x + 0.14, _sh.y + 0.1 + Math.sin(p) * 0.25, _sh.z - 0.3 * Math.cos(p) + kick * 0.04);
        gunHolder.rotation.set(p + kick * 0.1, 0, relPh > 0 ? Math.sin(Math.min(1, relPh) * Math.PI * 0.5) * 0.45 : 0);
        gunHolder.updateMatrixWorld(true);
        ikW += (1 - ikW) * 0.3;
        if (bones.RightArm && bones.RightForeArm && bones.RightHand) { _tw.set(0, -0.02, 0.04); gunHolder.localToWorld(_tw); ik(bones.RightArm, bones.RightForeArm, bones.RightHand, _tw, ikW); }
        if (bones.LeftArm && bones.LeftForeArm && bones.LeftHand) {
          _tw.copy(supportLocal); gunHolder.localToWorld(_tw);
          if (relPh > 0) { _belt.set(-0.15, 1.0, -0.12); bodyG.localToWorld(_belt); _tw.lerp(_belt, Math.sin(BV.U.clamp(relPh / 1.4, 0, 1) * Math.PI)); }
          ik(bones.LeftArm, bones.LeftForeArm, bones.LeftHand, _tw, ikW);
        }
      },
      flinch() { if (hit && !dying) { hit.reset(); hit.setEffectiveWeight(0.8); hit.fadeOut(0.3); hit.play(); } },
      die(t) {
        if (!dying) {
          dying = true; lastDie = 0;
          for (const n in L) if (L[n]) L[n].setEffectiveWeight(0);
          for (const n in U) if (U[n]) U[n].setEffectiveWeight(0);
          if (death) { death.reset(); death.setEffectiveWeight(1); death.play(); }
        }
        const tt = t * 0.6, dt = Math.max(0, tt - lastDie); lastDie = tt;
        mixer.update(dt);
        if (currentGun) { root.updateMatrixWorld(true); if (bones.RightHand) { bones.RightHand.getWorldPosition(_tw); bodyG.worldToLocal(_tw); gunHolder.position.copy(_tw); } gunHolder.rotation.set(-0.8 * Math.min(1, t * 2), 0, 0); }
        const e = Math.min(1, t); shadow.scale.set(1 + e * 0.6, 1 + e * 1.2, 1);
      },
      reset() {
        dying = false; lastDie = 0; bodyG.position.y = 0;
        if (death) death.stop();
        for (const n in L) if (L[n]) { L[n].stop(); L[n].play(); wL[n] = n === 'idle' ? 1 : 0; L[n].setEffectiveWeight(wL[n]); }
        for (const n in U) if (U[n]) { U[n].stop(); U[n].play(); wU[n] = n === 'aim' ? 1 : 0; U[n].setEffectiveWeight(wU[n]); }
        shadow.scale.set(1, 1, 1);
      },
      setShade(k) {
        if (Math.abs(k - api.shade) < 0.01) return; api.shade = k;
        for (const m of mats) if (m.color && m.userData.base) m.color.copy(m.userData.base).multiplyScalar(k);
      }
    };
    api.reset();
    return api;
  }
  return { load, create, ik, get ready() { return ready; } };
})();
