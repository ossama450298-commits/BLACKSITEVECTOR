/* =====================================================================
   charmodels.js — skinned, animated operators (v2.3)
   Body: "Superhero_Male" from Universal Base Characters by Quaternius (CC0),
   realistic proportions. Animations: Universal Animation Library by
   Quaternius (CC0), same skeleton. Both embedded in js/char_data.js.

   - Clothing: the base body is dressed per region (jacket, trousers, gloves,
     boots, head) computed from the T-pose bind; clothing materials sample
     painted skins with box projection in bind space (shader injection), so
     the fabric sticks to the body while it animates.
   - Layered animation: legs play locomotion (idle / walk / jog / sprint /
     crouch), the upper body plays aiming (pistol aim up/neutral/down blended
     by pitch), shooting, reloading and hit reactions. Death is full-body.
   - Long guns are shouldered: the weapon sits at a chest/shoulder anchor and
     both hands are placed on it with two-bone IK.
   Same API as the procedural soldier in models.js; hitboxes are untouched.
   ===================================================================== */
'use strict';
BV.CharModels = (function () {
  let body = null; const clips = {}, upper = {}, lower = {};
  let ready = false;
  const LOWER = /^(root|pelvis|thigh_[lr]|calf_[lr]|foot_[lr]|ball_[lr])\./;
  const _v = new THREE.Vector3();

  function decode(b64) { const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; }
  function parse(b64) { return new Promise((res, rej) => new THREE.GLTFLoader().parse(decode(b64), '', res, rej)); }

  function load() {
    if (!BV.CHAR_DATA || !BV.CHAR_DATA.body || !THREE.GLTFLoader || !THREE.SkeletonUtils) return Promise.resolve(false);
    return Promise.all([parse(BV.CHAR_DATA.body), parse(BV.CHAR_DATA.anims)]).then(([b, a]) => {
      body = b;
      for (const c of a.animations) {
        clips[c.name] = c;
        upper[c.name] = new THREE.AnimationClip(c.name + '_up', c.duration, c.tracks.filter(t => !LOWER.test(t.name)));
        lower[c.name] = new THREE.AnimationClip(c.name + '_lo', c.duration, c.tracks.filter(t => LOWER.test(t.name)));
      }
      prepareBody(body.scene);
      ready = true; return true;
    }).catch((e) => { console.warn('operator model failed to load', e); return false; });
  }

  /* ---------- dressing: per-triangle regions + bind-space attributes ---------- */
  const R_JACKET = 0, R_PANTS = 1, R_GLOVES = 2, R_BOOTS = 3, R_HEAD = 4;
  function prepareBody(scene) {
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!o.isSkinnedMesh || o.geometry.userData.dressed) return;
      // quantized skinned meshes dequantize through the bind matrices, so evaluate the
      // skin itself (rest pose = T-pose bind) to get real-world bind positions in metres
      const geo = o.geometry;
      // r128 does not de-normalize quantized attributes on the CPU side: convert them once
      for (const key of ['position', 'normal', 'uv', 'skinWeight']) {
        const at = geo.attributes[key]; if (!at || !at.normalized || at.array instanceof Float32Array) continue;
        const arr = at.array, div = arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : arr instanceof Int8Array ? 127 : 255;
        const f = new Float32Array(arr.length); for (let i = 0; i < arr.length; i++) f[i] = Math.max(-1, arr[i] / div);
        geo.setAttribute(key, new THREE.BufferAttribute(f, at.itemSize));
      }
      const P = geo.attributes.position;
      o.skeleton.pose(); o.updateMatrixWorld(true);
      const bp = new Float32Array(P.count * 3), bn = new Float32Array(P.count * 3), v = new THREE.Vector3();
      // manual linear-blend skinning in the rest (= bind) pose, guarding bad indices
      const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, sk = o.skeleton;
      const bm = sk.bones.map((b, j) => b ? new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[j]) : null);
      const base = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3(), inv = new THREE.Matrix4().copy(o.bindMatrixInverse);
      for (let i = 0; i < P.count; i++) {
        base.fromBufferAttribute(P, i).applyMatrix4(o.bindMatrix); acc.set(0, 0, 0); let wsum = 0;
        for (let k = 0; k < 4; k++) {
          const j = SI.getComponent ? SI.getComponent(i, k) : SI.array[i * 4 + k], w = SW.array[i * 4 + k];
          if (!w || !bm[j]) continue; tmp.copy(base).applyMatrix4(bm[j]).multiplyScalar(w); acc.add(tmp); wsum += w;
        }
        if (wsum > 0) acc.multiplyScalar(1 / wsum); else acc.copy(base);
        v.copy(acc).applyMatrix4(inv).applyMatrix4(o.matrixWorld);
        bp[i * 3] = v.x; bp[i * 3 + 1] = v.y; bp[i * 3 + 2] = v.z;
      }
      if (geo.index) {                                   // smooth normals from the bind positions
        const ix = geo.index.array, e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
        for (let t = 0; t < ix.length; t += 3) {
          const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
          e1.set(bp[b] - bp[a], bp[b + 1] - bp[a + 1], bp[b + 2] - bp[a + 2]); e2.set(bp[c] - bp[a], bp[c + 1] - bp[a + 1], bp[c + 2] - bp[a + 2]);
          fn.crossVectors(e1, e2);
          for (const q of [a, b, c]) { bn[q] += fn.x; bn[q + 1] += fn.y; bn[q + 2] += fn.z; }
        }
        for (let i = 0; i < P.count; i++) { const l = Math.hypot(bn[i * 3], bn[i * 3 + 1], bn[i * 3 + 2]) || 1; bn[i * 3] /= l; bn[i * 3 + 1] /= l; bn[i * 3 + 2] /= l; }
      }
      geo.setAttribute('bpos', new THREE.BufferAttribute(bp, 3)); geo.setAttribute('bnrm', new THREE.BufferAttribute(bn, 3));
      if (o.material.name === 'MI_Superhero_Male' && geo.index) {
        // T-pose bind: head above the neck, hands beyond the wrists, boots below the ankles, trousers below the belt
        const idx = geo.index.array, tris = idx.length / 3, buckets = [[], [], [], [], []];
        for (let t = 0; t < tris; t++) {
          let cx = 0, cy = 0;
          for (let k = 0; k < 3; k++) { const vi = idx[t * 3 + k]; cx += bp[vi * 3]; cy += bp[vi * 3 + 1]; }
          cx /= 3; cy /= 3; const ax = Math.abs(cx);
          const r = cy > 1.535 && ax < 0.2 ? R_HEAD : ax > 0.665 ? R_GLOVES : cy < 0.15 ? R_BOOTS : (cy < 0.985 && ax < 0.3) ? R_PANTS : R_JACKET;
          buckets[r].push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
        }
        const out = new (idx.constructor)(idx.length); let off = 0; geo.clearGroups();
        buckets.forEach((b, r) => { out.set(b, off); geo.addGroup(off, b.length, r); off += b.length; });
        geo.setIndex(new THREE.BufferAttribute(out, 1));
      }
      geo.userData.dressed = true;
    });
  }
  /* box-projected sampling in bind space (fabric follows the animated body) */
  function dressMat(map, K) {
    const m = BV.mat({ map, color: 0xffffff, roughness: 0.9 }); m.skinning = true;
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec3 bpos;\nattribute vec3 bnrm;\nvarying vec3 vBpos;\nvarying vec3 vBnrm;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBpos = bpos; vBnrm = bnrm;');
      sh.fragmentShader = 'varying vec3 vBpos;\nvarying vec3 vBnrm;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
  vec3 bAn = abs(vBnrm);
  vec2 bUv = bAn.x > bAn.y && bAn.x > bAn.z ? vBpos.zy : (bAn.z > bAn.y ? vBpos.xy : vBpos.xz);
  vec4 texelColor = texture2D( map, bUv * ${K.toFixed(2)} );
  texelColor = mapTexelToLinear( texelColor );
  diffuseColor *= texelColor;`);
    };
    m.customProgramCacheKey = () => 'dress' + K;
    m.userData.base = m.color.clone();
    return m;
  }

  /* ---------- analytic two-bone IK (world space) ---------- */
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _ax = new THREE.Vector3();
  const _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _id = new THREE.Quaternion();
  function rotWorld(bone, q) {
    bone.parent.getWorldQuaternion(_pq); bone.getWorldQuaternion(_bq);
    _bq.premultiply(q); bone.quaternion.copy(_pq.invert().multiply(_bq)); bone.updateMatrixWorld(true);
  }
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
    const model = THREE.SkeletonUtils.clone(body.scene);
    model.rotation.y = Math.PI;                      // source faces +Z, game faces -Z
    bodyG.add(model);
    const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name] = o; });
    const mats = [];
    const reg = (m) => { if (m.color && !m.userData.base) m.userData.base = m.color.clone(); mats.push(m); return m; };
    // ---- clothing ----
    const jacket = reg(dressMat(M.operatorFabric(V ? 0x59636a : 0x6f6551, V ? 'digital' : 'blot'), 2.6));
    const pants = reg(dressMat(M.operatorFabric(V ? 0x4d565c : 0x5f5646, V ? 'digital' : 'blot'), 2.6));
    const gloves = reg(dressMat(M.gearTex(0x262626), 4));
    const boots = reg(dressMat(M.gearTex(0x221f1b), 4));
    model.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
      if (o.material.name === 'MI_Eyes') { const em = reg(BV.mat({ map: o.material.map })); em.skinning = true; o.material = em; o.visible = V; return; }
      const src = o.material;
      const headMat = reg(BV.mat({ map: src.map, color: 0xb3aaa2, roughness: 0.7 })); headMat.skinning = true;
      const hidden = new THREE.MeshBasicMaterial({ visible: false }); hidden.skinning = true;
      o.material = [jacket, pants, gloves, boots, V ? headMat : hidden];
    });
    // pose in the neutral aim to attach gear in world space
    const mixer = new THREE.AnimationMixer(model);
    if (clips.Pistol_Aim_Neutral) { mixer.clipAction(clips.Pistol_Aim_Neutral).play(); mixer.update(0.01); mixer.stopAllAction(); }
    root.updateMatrixWorld(true);
    const attachWorld = (bone, obj, pos, quat) => {
      const want = new THREE.Matrix4().compose(pos, quat || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(want);
      local.decompose(obj.position, obj.quaternion, obj.scale); bone.add(obj);
    };
    const wp = (b) => b.getWorldPosition(new THREE.Vector3());
    const mk = (o) => reg(BV.mat(Object.assign({ roughness: 0.8 }, o)));
    const add = (g, geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
    const webbing = mk({ map: M.vestSkin(V ? 0x46505a : 0x564733) }), strap = mk({ color: V ? 0x2b302d : 0x2a2420 }), accent = mk({ color: T.accent });
    // ---- torso gear (plate carrier / chest rig) on spine_03 ----
    if (bones.spine_03) {
      const g = new THREE.Group(), c = wp(bones.spine_03);
      if (V) {
        add(g, M.rbox(0.36, 0.36, 0.07, 0.03), webbing, 0, -0.02, -0.15);
        add(g, M.rbox(0.36, 0.38, 0.07, 0.03), webbing, 0, -0.02, 0.15);
        add(g, M.rbox(0.44, 0.13, 0.32, 0.04), webbing, 0, -0.16, 0);
        for (const sx of [-1, 1]) add(g, M.rbox(0.07, 0.05, 0.32, 0.015), webbing, sx * 0.12, 0.17, 0);
        for (let i = -1; i <= 1; i++) { add(g, M.rbox(0.08, 0.13, 0.05, 0.014), webbing, i * 0.095, -0.07, -0.205); add(g, M.rbox(0.083, 0.028, 0.055, 0.008), strap, i * 0.095, 0.0, -0.205); }
        add(g, M.rbox(0.06, 0.09, 0.045, 0.014), strap, 0.2, -0.05, -0.08);
        add(g, new THREE.CylinderGeometry(0.005, 0.005, 0.26, 4), strap, 0.21, 0.12, -0.06);
        add(g, M.rbox(0.075, 0.045, 0.012, 0.004), accent, -0.11, 0.08, -0.19);
      } else {
        add(g, M.rbox(0.34, 0.2, 0.08, 0.03), webbing, 0, -0.1, -0.13);
        for (let i = -1; i <= 1; i++) { add(g, M.rbox(0.085, 0.12, 0.055, 0.016), webbing, i * 0.1, -0.1, -0.19); add(g, M.rbox(0.088, 0.028, 0.06, 0.008), strap, i * 0.1, -0.03, -0.19); }
        for (const sx of [-1, 1]) { const x = add(g, M.rbox(0.045, 0.5, 0.014, 0.006), strap, 0, 0.02, -0.14); x.rotation.z = sx * 0.55; }
        add(g, M.rbox(0.3, 0.38, 0.16, 0.04), webbing, 0, -0.04, 0.2);
        const roll = add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.32, 10), strap, 0, 0.19, 0.2); roll.rotation.z = Math.PI / 2;
      }
      attachWorld(bones.spine_03, g, c);
    }
    if (bones.pelvis) {
      const g = new THREE.Group(), c = wp(bones.pelvis);
      add(g, M.rbox(0.36, 0.055, 0.25, 0.015), strap, 0, 0.03, 0);
      add(g, M.rbox(0.055, 0.17, 0.09, 0.015), strap, 0.2, -0.08, -0.02);
      add(g, M.rbox(0.1, 0.1, 0.06, 0.02), webbing, -0.2, -0.02, 0.0);
      attachWorld(bones.pelvis, g, c);
    }
    for (const s of ['l', 'r']) if (bones['calf_' + s]) {
      const p = new THREE.Mesh(M.rbox(0.12, 0.13, 0.06, 0.02), V ? webbing : strap); p.castShadow = true;
      attachWorld(bones['calf_' + s], p, wp(bones['calf_' + s]).add(new THREE.Vector3(0, -0.02, -0.07)));
    }
    if (bones.upperarm_l && bones.lowerarm_l) {
      const a = wp(bones.upperarm_l), b = wp(bones.lowerarm_l), dir = b.clone().sub(a).normalize();
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.06, 12, 1, true), reg(BV.mat({ color: T.accent, side: THREE.DoubleSide })));
      attachWorld(bones.upperarm_l, band, a.clone().addScaledVector(dir, 0.1), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    }
    if (bones.Head) {
      const h = wp(bones.Head);
      if (V) {
        const g = new THREE.Group();
        const mH = mk({ color: T.helmet, roughness: 0.75 }), mBlk = mk({ color: 0x1a1a1a });
        const shell = add(g, new THREE.SphereGeometry(0.135, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), mH, 0, 0.06, 0.005); shell.scale.set(1, 0.95, 1.1);
        const rim = add(g, new THREE.TorusGeometry(0.133, 0.012, 6, 20), mH, 0, 0.065, 0.005); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.1, 1);
        add(g, M.rbox(0.05, 0.04, 0.03, 0.008), mBlk, 0, 0.17, -0.13);
        for (const sx of [-1, 1]) { const e = add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.045, 12), strap, sx * 0.105, 0.01, 0.01); e.rotation.z = Math.PI / 2; }
        attachWorld(bones.Head, g, h);
      } else if (M.ravenHead) {
        attachWorld(bones.Head, M.ravenHead(mats), h.clone().add(new THREE.Vector3(0, -0.1, 0.01)));
      }
    }
    const gunHolder = new THREE.Group(); bodyG.add(gunHolder);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; root.add(shadow);

    // ---- animation layers ----
    const act = (clip) => { if (!clip) return null; const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); return a; };
    const L = { idle: act(lower.Idle_Loop), walk: act(lower.Walk_Loop), jog: act(lower.Jog_Fwd_Loop), sprint: act(lower.Sprint_Loop), cidle: act(lower.Crouch_Idle_Loop), cwalk: act(lower.Crouch_Fwd_Loop) };
    const U = { aim: act(upper.Pistol_Aim_Neutral), up: act(upper.Pistol_Aim_Up), down: act(upper.Pistol_Aim_Down), shoot: act(upper.Pistol_Shoot), reload: act(upper.Pistol_Reload), run: act(upper.Sprint_Loop) };
    const hit = upper.Hit_Chest ? mixer.clipAction(upper.Hit_Chest) : null; if (hit) hit.setLoop(THREE.LoopOnce, 1);
    const death = clips.Death01 ? mixer.clipAction(clips.Death01) : null; if (death) { death.setLoop(THREE.LoopOnce, 1); death.clampWhenFinished = true; }
    const wL = {}, wU = {}; for (const k in L) wL[k] = 0; for (const k in U) wU[k] = 0;
    const supportLocal = new THREE.Vector3(), gripLocal = new THREE.Vector3(), _tw = new THREE.Vector3(), _belt = new THREE.Vector3(), _sh = new THREE.Vector3();
    let currentGun = null, dying = false, lastDie = 0, kick = 0, relPh = 0, ikW = 0, cls = 'rifle';
    const api = {
      root, body: bodyG, torso: bodyG, head: bodyG, gunHolder, shadow, flashAnchor: null, ejectAnchor: null, state: null, shade: 1, skinned: true,
      setWeapon(def) {
        if (currentGun) gunHolder.remove(currentGun.group);
        currentGun = M.gun(def.model);
        const s = def.cls === 'melee' ? 1.2 : 1.05; currentGun.group.scale.set(s, s, s);
        currentGun.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
        gunHolder.add(currentGun.group);
        api.flashAnchor = currentGun.muzzle; api.ejectAnchor = currentGun.eject;
        cls = def.cls;
        const len = -currentGun.muzzle.position.z * s;
        supportLocal.set(0, Math.min(0.06, currentGun.muzzle.position.y * s * 0.45), -len * (def.cls === 'shotgun' ? 0.55 : 0.5));
        gripLocal.set(0, 0, 0);
      },
      animate(dt, speed, crouch, pitch, phase, firing) {
        if (dying) return;
        const st = api.state || {}, k = Math.min(1, dt * 9);
        const crouching = crouch > 0.5, moving = speed > 0.35;
        const tL = { idle: 0, walk: 0, jog: 0, sprint: 0, cidle: 0, cwalk: 0 };
        if (crouching) tL[moving ? 'cwalk' : 'cidle'] = 1;
        else if (!moving) tL.idle = 1;
        else if (st.sprint) tL.sprint = 1;
        else if (speed < 2.6) tL.walk = 1; else tL.jog = 1;
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
        if (st.sprint && !firing) tU.run = 1;
        else if (st.reloading && cls === 'pistol') tU.reload = 1;
        else if (firing && cls === 'pistol') tU.shoot = 1;
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
          if (bones.hand_r) { bones.hand_r.getWorldPosition(_tw); bodyG.worldToLocal(_tw); gunHolder.position.copy(_tw).add(_v.set(0.0, -0.035, -0.06)); }
          gunHolder.rotation.set((st && st.sprint ? -0.5 : pitch * 0.85) + kick * 0.15, 0, 0);
          return;
        }
        // long guns: shouldered at a chest anchor, both hands placed with IK
        if (bones.spine_03) { bones.spine_03.getWorldPosition(_sh); bodyG.worldToLocal(_sh); }
        const p = BV.U.clamp(pitch, -1.1, 1.1);
        gunHolder.position.set(_sh.x + 0.13, _sh.y + 0.08 + Math.sin(p) * 0.25, _sh.z - 0.32 * Math.cos(p) + kick * 0.04);
        gunHolder.rotation.set(p + kick * 0.1, 0, relPh > 0 ? Math.sin(Math.min(1, relPh) * Math.PI * 0.5) * 0.45 : 0);
        gunHolder.updateMatrixWorld(true);
        ikW += (1 - ikW) * 0.3;
        if (bones.upperarm_r && bones.lowerarm_r && bones.hand_r) { _tw.copy(gripLocal); gunHolder.localToWorld(_tw); ik(bones.upperarm_r, bones.lowerarm_r, bones.hand_r, _tw, ikW); }
        if (bones.upperarm_l && bones.lowerarm_l && bones.hand_l) {
          _tw.copy(supportLocal); gunHolder.localToWorld(_tw);
          if (relPh > 0) { _belt.set(-0.15, 1.0, -0.12); bodyG.localToWorld(_belt); _tw.lerp(_belt, Math.sin(BV.U.clamp(relPh / 1.4, 0, 1) * Math.PI)); }
          ik(bones.upperarm_l, bones.lowerarm_l, bones.hand_l, _tw, ikW);
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
        if (currentGun) { root.updateMatrixWorld(true); if (bones.hand_r) { bones.hand_r.getWorldPosition(_tw); bodyG.worldToLocal(_tw); gunHolder.position.copy(_tw); } gunHolder.rotation.set(-0.8 * Math.min(1, t * 2), 0, 0); }
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
  return { load, create, get ready() { return ready; } };
})();
