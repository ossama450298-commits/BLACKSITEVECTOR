/* =====================================================================
   player.js — local player controller: movement (walk/sprint/crouch/
   jump with classic ground acceleration and air control), weapon input,
   objective interaction and spectator camera after death.
   ===================================================================== */
'use strict';
BV.Player = (function () {
  const I = () => BV.Input;
  const wish = new THREE.Vector3();
  let lastFireDown = false;

  function update(game, dt, engine) {
    const p = game.player; if (!p) return;
    const inp = I(), s = BV.settings;
    const uiOpen = engine.uiBlocking();
    if (!p.alive) { spectate(game, dt, engine); return; }

    // ---------- look ----------
    if (!uiOpen) {
      const zoomK = engine.zoomFov() / s.fov;
      const sens = 0.0021 * s.sensitivity * zoomK;
      p.yaw -= inp.mouse.dx * sens;
      p.pitch -= inp.mouse.dy * sens * (s.invertY ? -1 : 1);
      p.pitch = BV.U.clamp(p.pitch, -1.52, 1.52);
    }
    // ---------- movement ----------
    const frozen = game.phase === 'freeze' || game.phase === 'over' || p.planting || p.defusing;
    let fx = 0, fz = 0;
    if (!uiOpen && !frozen) {
      if (inp.down('KeyW')) fz -= 1; if (inp.down('KeyS')) fz += 1;
      if (inp.down('KeyA')) fx -= 1; if (inp.down('KeyD')) fx += 1;
    }
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    wish.set(fx * cy + fz * sy, 0, -fx * sy + fz * cy);
    const wl = wish.length(); if (wl > 0) wish.multiplyScalar(1 / wl);
    p.wantCrouch = !uiOpen && (inp.down('ControlLeft') || inp.down('ControlRight') || inp.down('KeyC'));
    if (p.defusing) p.wantCrouch = true;
    p.sprint = !uiOpen && (inp.down('ShiftLeft') || inp.down('ShiftRight')) && fz < 0 && p.crouch < 0.3 && !p.zoom && !p.reloading;
    let speed = (p.sprint ? 6.2 : 4.6) * p.speedMul();
    if (p.crouch > 0.5) speed = 1.9 * p.speedMul();
    if (p.zoom) speed *= 0.6;
    if (p.onGround) {
      const acc = Math.min(1, (wl > 0 ? 11 : 9) * dt);
      p.vel.x += (wish.x * speed - p.vel.x) * acc;
      p.vel.z += (wish.z * speed - p.vel.z) * acc;
      if (!uiOpen && !frozen && inp.pressed('Space')) { p.vel.y = 5.6; p.onGround = false; BV.Audio.jump(null); game.emitNoise(p.pos, 10, p); }
    } else {
      // limited air control
      p.vel.x += wish.x * speed * dt * 1.6; p.vel.z += wish.z * speed * dt * 1.6;
      const h = Math.hypot(p.vel.x, p.vel.z), lim = Math.max(speed, 4.6) * 1.05;
      if (h > lim) { p.vel.x *= lim / h; p.vel.z *= lim / h; }
    }
    if (frozen) { p.vel.x *= 0.5; p.vel.z *= 0.5; }
    game.applyCrouch(p, dt);
    BV.Physics.moveEntity(p, dt, true);
    game.movementFx(p, dt);
    // stay inside the map even in odd cases
    const b = game.map.data.bounds;
    p.pos.x = BV.U.clamp(p.pos.x, b.minX + 0.4, b.maxX - 0.4); p.pos.z = BV.U.clamp(p.pos.z, b.minZ + 0.4, b.maxZ - 0.4);

    if (uiOpen) { lastFireDown = false; game.playerUse = false; return; }
    // ---------- weapons ----------
    const w = p.weapon;
    for (let i = 1; i <= 5; i++) if (inp.pressed('Digit' + i)) {
      if (i === 4 && p.slot === 4 && p.cycleNade()) { game.engine.viewmodel.equip(p.weapon.def, p.team); BV.HUD.notice(p.weapon.def.name, '', 0.8); continue; }   // 4 again: next grenade type
      game.switchSlot(p, i);
    }
    if (inp.pressed('KeyQ')) game.switchSlot(p, p.prevSlot);
    if (inp.mouse.wheel) {
      const order = [1, 2, 3, 4, 5].filter(sl => p.inv[sl] && (sl !== 4 || p.hasGrenade()));
      let i = order.indexOf(p.slot); i = (i + (inp.mouse.wheel > 0 ? 1 : -1) + order.length) % order.length;
      game.switchSlot(p, order[i]);
    }
    // right click with a suppressed pistol: screw the suppressor on / off
    if (inp.mouse.rightPressed && w && w.def.silencer && !p.reloading && p.switchT <= 0 && !(p.silT > 0)) {
      p.silT = BV.SIL_TIME; p.silOn = w.silenced === false; p.silW = w;
    }
    if (p.silT > 0) {
      const half = BV.SIL_TIME * 0.5, was = p.silT; p.silT = Math.max(0, p.silT - dt);
      if (p.silW !== w) p.silT = 0;
      else if (was > half && p.silT <= half) { w.silenced = p.silOn; BV.HUD.notice(p.silOn ? 'Suppressor on' : 'Suppressor off', '', 1.2); }
    }
    if (inp.pressed('KeyR') && !(p.silT > 0)) game.startReload(p);
    if (inp.pressed('KeyG')) game.dropActive(p);                                     // drop the weapon in hand
    if (inp.pressed('KeyE') && !p.planting && !p.defusing) game.tryPickupSwap(p);   // swap with a weapon at your feet
    if (inp.mouse.rightPressed && w && w.def.zoom && !p.reloading && p.switchT <= 0) {
      const max = w.def.cls === 'sniper' ? 2 : 1;
      p.zoom = (p.zoom + 1) % (max + 1); BV.Audio.zoom();
    }
    const fireDown = inp.mouse.left;
    const holdingCharge = w && w.def.cls === 'charge';
    if (fireDown && w && !holdingCharge && !(p.silT > 0)) {
      const auto = w.def.auto || w.def.cls === 'melee';
      if (auto || !lastFireDown) game.fire(p);
    }
    lastFireDown = fireDown;
    // sniper bolt: drop out of scope briefly after a shot
    if (w && w.def.cls === 'sniper' && p.zoom && game.time - p.lastShot < 0.05) { p._rezoom = p.zoom; p.zoom = 0; }
    if (p._rezoom && game.time - p.lastShot > w.def.rate * 0.9) { p.zoom = p._rezoom; p._rezoom = 0; }
    if (p.reloading || p.slot !== 1) p._rezoom = 0;

    // ---------- objective ----------
    game.playerUse = inp.down('KeyE') || (holdingCharge && inp.mouse.left);   // hold E, or hold fire with the charge in hand
    // clear feedback when E does nothing (no charge, outside the site, moving, freeze time)
    if (inp.pressed('KeyE') && p.team === game.attackTeam && game.phase !== 'planted' && !game.drops.some(d => Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z) < 1.5)) {
      const site = game.map.siteAt(p.pos.x, p.pos.z);
      let msg = null;
      if (!p.hasCharge) { const c = game.charge.carrier; msg = c ? (c.name + ' carries the charge — escort them to site A or B') : 'The charge is on the ground — pick it up'; }
      else if (game.phase === 'freeze') msg = 'Wait for the round to start to arm the charge';
      else if (!site) msg = 'Get inside site A or B to arm the charge';
      else if (Math.hypot(p.vel.x, p.vel.z) >= 0.6) msg = 'Stand still while arming the charge';
      if (msg) BV.HUD.notice(msg, 'warn', 2.2);
    }
    if (game.playerUse) {
      if (p.hasCharge) game.beginPlant(p);
      else if (game.phase === 'planted' && p.team !== game.attackTeam) game.beginDefuse(p);
    }
  }

  /* chase camera on a living teammate */
  function spectate(game, dt, engine) {
    const sp = game.spectate; if (!sp) return;
    sp.t -= dt;
    if (sp.t > 0) return;
    const inp = I();
    const pool = game.ents.filter(e => e.alive && e.team === game.player.team);
    const list = pool.length ? pool : game.ents.filter(e => e.alive);
    if (!list.length) { sp.target = null; return; }
    if (!sp.target || !sp.target.alive || inp.mouse.leftPressed || inp.pressed('Space')) {
      let i = list.indexOf(sp.target); sp.target = list[(i + 1) % list.length];
    }
  }

  return { update };
})();
