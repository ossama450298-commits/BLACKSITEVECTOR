/* =====================================================================
   models.js — low-poly procedural models: weapons (first & third person)
   and the two factions' soldiers. All geometry is built from boxes and
   low-segment cylinders, roughly 200–400 triangles per character.
   ===================================================================== */
'use strict';
BV.Models = (function () {
  const matCache = {};
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache[key]) matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
    return matCache[key];
  }
  const M = {
    dark: () => mat(0x26292a), steel: () => mat(0x4a4e50), poly: () => mat(0x1c1d1d), wood: () => mat(0x6e4a2a),
    olive: () => mat(0x4c5236), bright: () => mat(0xb9bec2), tan: () => mat(0x8a7656), glove: () => mat(0x2a2620), sleeve: (c) => mat(c)
  };
  function box(g, w, h, d, x, y, z, m, rx, ry, rz) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z); if (rx) me.rotation.x = rx; if (ry) me.rotation.y = ry; if (rz) me.rotation.z = rz;
    g.add(me); return me;
  }
  function cyl(g, r, len, x, y, z, m, seg) {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8), m);
    me.rotation.x = Math.PI / 2; me.position.set(x, y, z); g.add(me); return me;
  }

  /* ---------------- weapons (pointing -Z, origin at grip) ---------------- */
  function gun(model) {
    const g = new THREE.Group(); const muzzle = new THREE.Object3D(); let mag = null;
    switch (model) {
      case 'pistol':
        box(g, 0.034, 0.04, 0.2, 0, 0.03, -0.06, M.steel());
        box(g, 0.03, 0.026, 0.17, 0, 0.002, -0.055, M.poly());
        box(g, 0.032, 0.11, 0.046, 0, -0.05, 0.02, M.poly(), 0.22);
        mag = box(g, 0.026, 0.02, 0.036, 0, -0.105, 0.03, M.dark());
        box(g, 0.006, 0.012, 0.01, 0, 0.055, -0.15, M.dark());
        muzzle.position.set(0, 0.03, -0.17); break;
      case 'pistolHeavy':
        box(g, 0.04, 0.046, 0.23, 0, 0.033, -0.07, M.dark());
        box(g, 0.036, 0.03, 0.2, 0, 0.0, -0.06, M.steel());
        box(g, 0.036, 0.12, 0.05, 0, -0.055, 0.025, M.wood(), 0.2);
        mag = box(g, 0.03, 0.02, 0.04, 0, -0.115, 0.035, M.dark());
        box(g, 0.008, 0.015, 0.012, 0, 0.062, -0.17, M.bright());
        muzzle.position.set(0, 0.033, -0.19); break;
      case 'smg':
        box(g, 0.05, 0.07, 0.32, 0, 0.03, -0.08, M.dark());
        cyl(g, 0.012, 0.12, 0, 0.04, -0.29, M.steel());
        mag = box(g, 0.028, 0.16, 0.045, 0, -0.07, -0.1, M.poly(), -0.15);
        box(g, 0.034, 0.1, 0.045, 0, -0.05, 0.04, M.poly(), 0.25);
        box(g, 0.026, 0.035, 0.2, 0, 0.03, 0.17, M.steel());
        box(g, 0.012, 0.02, 0.05, 0, 0.075, -0.05, M.dark());
        muzzle.position.set(0, 0.04, -0.36); break;
      case 'smgCompact':
        box(g, 0.06, 0.09, 0.27, 0, 0.035, -0.07, M.olive());
        box(g, 0.05, 0.02, 0.2, 0, 0.09, -0.07, M.dark());
        cyl(g, 0.02, 0.14, 0, 0.04, -0.27, M.dark());
        mag = box(g, 0.03, 0.15, 0.04, 0, -0.08, 0.02, M.poly(), 0.12);
        box(g, 0.035, 0.05, 0.12, 0, 0.02, 0.12, M.poly());
        muzzle.position.set(0, 0.04, -0.35); break;
      case 'rifle':
        box(g, 0.055, 0.08, 0.42, 0, 0.03, -0.05, M.dark());
        box(g, 0.06, 0.065, 0.26, 0, 0.022, -0.38, M.wood());
        cyl(g, 0.012, 0.24, 0, 0.04, -0.6, M.steel());
        box(g, 0.012, 0.05, 0.012, 0, 0.075, -0.62, M.dark());
        mag = new THREE.Group(); box(mag, 0.03, 0.1, 0.06, 0, -0.04, 0, M.steel(), -0.18); box(mag, 0.03, 0.09, 0.06, 0, -0.12, 0.03, M.steel(), -0.45); mag.position.set(0, -0.02, -0.14); g.add(mag);
        box(g, 0.036, 0.1, 0.045, 0, -0.05, 0.08, M.poly(), 0.3);
        box(g, 0.05, 0.1, 0.26, 0, 0.0, 0.3, M.wood(), -0.08);
        box(g, 0.02, 0.03, 0.04, 0, 0.085, 0.05, M.dark());
        muzzle.position.set(0, 0.04, -0.73); break;
      case 'rifleCarbine':
        box(g, 0.055, 0.075, 0.4, 0, 0.03, -0.06, M.poly());
        box(g, 0.058, 0.06, 0.24, 0, 0.026, -0.37, M.dark());
        box(g, 0.02, 0.012, 0.6, 0, 0.075, -0.2, M.dark());
        cyl(g, 0.011, 0.2, 0, 0.035, -0.57, M.steel());
        box(g, 0.03, 0.04, 0.03, 0, 0.1, -0.02, M.dark());
        mag = box(g, 0.028, 0.15, 0.055, 0, -0.08, -0.13, M.olive(), -0.12);
        box(g, 0.034, 0.1, 0.045, 0, -0.05, 0.07, M.poly(), 0.3);
        box(g, 0.035, 0.07, 0.2, 0, 0.01, 0.28, M.poly());
        box(g, 0.012, 0.012, 0.2, 0, 0.04, 0.2, M.steel());
        muzzle.position.set(0, 0.035, -0.68); break;
      case 'dmr':
        box(g, 0.055, 0.08, 0.46, 0, 0.03, -0.08, M.olive());
        box(g, 0.05, 0.06, 0.3, 0, 0.02, -0.44, M.dark());
        cyl(g, 0.013, 0.28, 0, 0.04, -0.72, M.steel());
        cyl(g, 0.03, 0.24, 0, 0.12, -0.08, M.dark(), 10);
        cyl(g, 0.036, 0.04, 0, 0.12, -0.21, M.dark(), 10);
        box(g, 0.02, 0.03, 0.03, 0, 0.08, -0.08, M.dark());
        mag = box(g, 0.03, 0.11, 0.07, 0, -0.06, -0.15, M.dark(), -0.08);
        box(g, 0.036, 0.1, 0.045, 0, -0.05, 0.07, M.poly(), 0.3);
        box(g, 0.05, 0.11, 0.26, 0, 0.0, 0.3, M.olive(), -0.06);
        muzzle.position.set(0, 0.04, -0.87); break;
      case 'sniper':
        box(g, 0.06, 0.07, 0.5, 0, 0.03, -0.08, M.dark());
        box(g, 0.065, 0.06, 0.34, 0, 0.0, -0.45, M.tan());
        cyl(g, 0.016, 0.42, 0, 0.04, -0.8, M.steel());
        cyl(g, 0.026, 0.06, 0, 0.04, -1.02, M.dark());
        cyl(g, 0.034, 0.32, 0, 0.13, -0.1, M.dark(), 10);
        cyl(g, 0.044, 0.06, 0, 0.13, -0.28, M.dark(), 10);
        box(g, 0.012, 0.012, 0.05, 0.045, 0.05, 0.08, M.bright(), 0, 0.6);
        mag = box(g, 0.034, 0.07, 0.08, 0, -0.04, -0.12, M.dark());
        box(g, 0.04, 0.11, 0.05, 0, -0.06, 0.08, M.tan(), 0.35);
        box(g, 0.055, 0.13, 0.3, 0, -0.01, 0.32, M.tan(), -0.05);
        muzzle.position.set(0, 0.04, -1.05); break;
      case 'shotgun':
        box(g, 0.055, 0.07, 0.34, 0, 0.03, -0.05, M.dark());
        cyl(g, 0.016, 0.55, 0, 0.05, -0.45, M.steel());
        cyl(g, 0.014, 0.45, 0, 0.012, -0.4, M.dark());
        mag = box(g, 0.05, 0.05, 0.16, 0, 0.01, -0.42, M.wood());
        box(g, 0.036, 0.1, 0.045, 0, -0.05, 0.08, M.wood(), 0.3);
        box(g, 0.052, 0.11, 0.3, 0, -0.01, 0.3, M.wood(), -0.08);
        muzzle.position.set(0, 0.05, -0.73); break;
      case 'knife':
        box(g, 0.028, 0.03, 0.11, 0, 0, 0.03, M.poly());
        box(g, 0.05, 0.012, 0.012, 0, 0.0, -0.03, M.steel());
        box(g, 0.007, 0.034, 0.17, 0, 0.004, -0.12, M.bright());
        box(g, 0.006, 0.012, 0.05, 0, 0.022, -0.19, M.bright(), 0.5);
        muzzle.position.set(0, 0, -0.22); break;
      case 'grenade': {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), M.olive()); g.add(s);
        box(g, 0.02, 0.025, 0.02, 0, 0.05, 0, M.steel());
        box(g, 0.012, 0.07, 0.01, 0.022, 0.025, 0, M.steel(), 0, 0, 0.15);
        muzzle.position.set(0, 0, -0.05); break;
      }
      default: box(g, 0.05, 0.05, 0.3, 0, 0, 0, M.dark()); muzzle.position.set(0, 0, -0.16);
    }
    g.add(muzzle);
    return { group: g, muzzle, mag, magHome: mag ? mag.position.clone() : null };
  }

  /* ---------------- soldiers ---------------- */
  function soldier(teamId) {
    const T = BV.TEAMS[teamId];
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    // per-soldier materials so each one can be shaded by its surroundings
    const mats = [];
    const mat = (color, opts) => { const m = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {})); m.userData.base = new THREE.Color(color); mats.push(m); return m; };
    const mU = mat(T.uniform), mUd = mat(T.uniformDark), mV = mat(T.vest), mA = mat(T.accent), mS = mat(T.skin), mH = mat(T.helmet);
    const mBoot = mat(0x1b1a18), mGlove = mat(0x221f1b);

    const mkLeg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.9, 0);
      box(p, 0.17, 0.47, 0.19, 0, -0.235, 0, mU);
      const knee = new THREE.Group(); knee.position.set(0, -0.47, 0); p.add(knee);
      box(knee, 0.155, 0.38, 0.17, 0, -0.19, 0, mUd);
      box(knee, 0.17, 0.08, 0.27, 0, -0.39, -0.04, mBoot);
      if (teamId === 'VANGUARD') box(knee, 0.165, 0.1, 0.06, 0, -0.03, -0.09, mV); // knee pads
      body.add(p); return { hip: p, knee };
    };
    const L = mkLeg(-0.115), R = mkLeg(0.115);

    const torso = new THREE.Group(); torso.position.set(0, 0.9, 0); body.add(torso);
    box(torso, 0.4, 0.2, 0.22, 0, 0.08, 0, mUd);                                     // hips/belt
    box(torso, 0.44, 0.42, 0.24, 0, 0.36, 0, mU);                                     // chest
    if (teamId === 'VANGUARD') {
      box(torso, 0.5, 0.36, 0.3, 0, 0.36, -0.01, mV);                                 // plate carrier
      box(torso, 0.12, 0.1, 0.06, -0.13, 0.28, -0.17, mUd); box(torso, 0.12, 0.1, 0.06, 0.13, 0.28, -0.17, mUd); // pouches
      box(torso, 0.08, 0.06, 0.02, 0.17, 0.48, -0.165, mA);                            // ID patch
    } else {
      box(torso, 0.46, 0.3, 0.26, 0, 0.34, 0.0, mV);                                  // chest rig
      box(torso, 0.34, 0.36, 0.14, 0, 0.36, 0.19, mUd);                               // backpack
      box(torso, 0.42, 0.06, 0.27, 0, 0.18, 0, mA);                                    // red sash/belt band
    }
    const head = new THREE.Group(); head.position.set(0, 0.6, 0); torso.add(head);
    box(head, 0.09, 0.08, 0.09, 0, 0.02, 0, mS);                                      // neck
    box(head, 0.21, 0.24, 0.23, 0, 0.16, 0, mS);
    if (teamId === 'VANGUARD') {
      box(head, 0.26, 0.12, 0.28, 0, 0.29, 0.0, mH);                                  // helmet
      box(head, 0.27, 0.05, 0.3, 0, 0.23, 0.0, mH);
      box(head, 0.2, 0.06, 0.03, 0, 0.19, -0.125, mat(0x2b3a40, { emissive: 0x0b1418 })); // visor
    } else {
      box(head, 0.23, 0.2, 0.25, 0, 0.18, 0.01, mH);                                  // balaclava
      box(head, 0.25, 0.13, 0.27, 0, 0.3, 0.03, mUd);                                 // hood
      box(head, 0.18, 0.05, 0.03, 0, 0.19, -0.125, mat(0x150c08, { emissive: 0x3a0d06 })); // goggles
    }
    // arms (rifle hold pose)
    const armR = new THREE.Group(); armR.position.set(0.26, 0.52, 0); torso.add(armR);
    box(armR, 0.12, 0.3, 0.13, 0, -0.14, 0, mU);
    const foreR = new THREE.Group(); foreR.position.set(0, -0.28, 0); armR.add(foreR);
    box(foreR, 0.11, 0.27, 0.12, 0, -0.13, 0, mUd); box(foreR, 0.1, 0.08, 0.1, 0, -0.29, 0, mGlove);
    armR.rotation.set(-0.6, 0, 0.15); foreR.rotation.x = -1.0;
    const armL = new THREE.Group(); armL.position.set(-0.26, 0.52, 0); torso.add(armL);
    box(armL, 0.12, 0.3, 0.13, 0, -0.14, 0, mU);
    const foreL = new THREE.Group(); foreL.position.set(0, -0.28, 0); armL.add(foreL);
    box(foreL, 0.11, 0.27, 0.12, 0, -0.13, 0, mUd); box(foreL, 0.1, 0.08, 0.1, 0, -0.29, 0, mGlove);
    armL.rotation.set(-1.1, 0, -0.5); foreL.rotation.x = -0.6;
    if (teamId === 'RAVEN') box(armL, 0.13, 0.06, 0.14, 0, -0.1, 0, mA);               // armband
    else box(armL, 0.06, 0.08, 0.02, 0, -0.1, -0.07, mA);

    const gunHolder = new THREE.Group(); gunHolder.position.set(0.1, 0.3, -0.32); torso.add(gunHolder);
    // blob shadow
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);

    let currentGun = null;
    const api = {
      root, body, torso, head, gunHolder, shadow, flashAnchor: null,
      setWeapon(def) {
        if (currentGun) gunHolder.remove(currentGun.group);
        currentGun = gun(def.model);
        const s = def.cls === 'melee' ? 1.3 : def.cls === 'grenade' ? 1.2 : 1.12;
        currentGun.group.scale.set(s, s, s);
        if (def.cls === 'pistol' || def.cls === 'melee' || def.cls === 'grenade') { gunHolder.position.set(0.1, 0.33, -0.42); armL.rotation.set(-1.3, 0, -0.35); }
        else { gunHolder.position.set(0.1, 0.3, -0.3); armL.rotation.set(-1.1, 0, -0.5); }
        gunHolder.add(currentGun.group);
        api.flashAnchor = currentGun.muzzle;
      },
      /* animation: phase advances with distance walked */
      animate(dt, speed, crouch, pitch, phase, firing) {
        const k = Math.min(1, speed / 4);
        const sw = Math.sin(phase) * 0.55 * k;
        L.hip.rotation.x = sw - crouch * 1.1; R.hip.rotation.x = -sw - crouch * 1.1;
        L.knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.7 * k + crouch * 1.9;
        R.knee.rotation.x = Math.max(0, Math.sin(phase)) * 0.7 * k + crouch * 1.9;
        body.position.y = -crouch * 0.42 + Math.abs(Math.cos(phase)) * 0.03 * k;
        torso.rotation.x = -pitch * 0.45 + crouch * 0.15;
        head.rotation.x = -pitch * 0.4;
        armR.rotation.x = -0.6 - pitch * 0.4 + (firing ? 0.06 : 0);
      },
      die(t) { // t: 0..1 progress
        const e = 1 - Math.pow(1 - Math.min(1, t), 3);
        body.rotation.x = -e * 1.48; body.position.y = -e * 0.12;
        shadow.scale.set(1 + e * 0.6, 1 + e * 1.4, 1);
      },
      reset() { body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); shadow.scale.set(1, 1, 1); },
      shade: 1,
      setShade(k) {
        if (Math.abs(k - api.shade) < 0.01) return; api.shade = k;
        for (const m of mats) m.color.copy(m.userData.base).multiplyScalar(k);
      }
    };
    return api;
  }

  /* first-person arms holding a weapon */
  function viewArms(teamId) {
    const T = BV.TEAMS[teamId];
    const g = new THREE.Group();
    const sleeve = mat(T.uniform), glove = mat(0x241f1a);
    const right = new THREE.Group(); g.add(right);
    box(right, 0.07, 0.07, 0.34, 0, 0, 0.17, sleeve); box(right, 0.065, 0.065, 0.09, 0, 0, -0.02, glove);
    right.position.set(0.02, -0.07, 0.08); right.rotation.set(0.28, 0.12, 0);
    const left = new THREE.Group(); g.add(left);
    box(left, 0.07, 0.07, 0.36, 0, 0, 0.18, sleeve); box(left, 0.065, 0.065, 0.09, 0, 0, -0.03, glove);
    if (teamId === 'RAVEN') box(left, 0.075, 0.03, 0.075, 0, 0, 0.14, mat(T.accent));
    left.position.set(-0.07, -0.03, -0.2); left.rotation.set(0.25, -0.55, 0.2);
    return { group: g, right, left };
  }

  return { gun, soldier, viewArms, mat };
})();
