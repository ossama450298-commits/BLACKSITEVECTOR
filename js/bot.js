/* =====================================================================
   bot.js — state-machine AI.
   States: IDLE, PATROL, SEARCH, ATTACK, DEFEND, RETREAT, OBJECTIVE, DEAD
   Perception (view cone + line of sight + hearing) runs at 10 Hz; aiming
   and steering run every frame. Bots navigate SECTOR-17 with A* over a
   hand-placed waypoint graph that is auto-linked by line-of-sight tests.
   ===================================================================== */
'use strict';
BV.Bot = class extends BV.Combatant {
  constructor(name, team, game) {
    super(name, team, true);
    this.game = game;
    this.state = 'IDLE';
    this.path = []; this.pathIdx = 0; this.goal = null; this.repathT = 0;
    this.target = null; this.lastSeenPos = new THREE.Vector3(); this.lastSeenTime = -99; this.reactAt = 0;
    this.aimPart = 'body'; this.aimOff = { y: 0, p: 0 }; this.aimOffT = 0;
    this.burstLeft = 0; this.burstPause = 0;
    this.strafe = 0; this.strafeT = 0;
    this.heard = null; this.thinkT = Math.random() * 0.1;
    this.role = null; this.spot = null; this.spotT = 0; this.lookYaw = 0; this.lookT = 0;
    this.stageReached = false; this.stageGoAt = 0; this.route = null;
    this.retreatUntil = 0; this.stuckT = 0; this.stuckN = 0; this.lastPos = new THREE.Vector3();
    this.wantMove = false; this.visible = null; this.grenadeT = 0; this.reactionBase = 0;
    this._v = new THREE.Vector3(); this._e = new THREE.Vector3(); this._t = new THREE.Vector3();
  }

  get D() { return this.game.diff; }

  resetBrain() {
    this.state = 'IDLE'; this.path = []; this.goal = null; this.target = null; this.lastSeenTime = -99;
    this.heard = null; this.spot = null; this.stageReached = false; this.retreatUntil = 0; this.burstLeft = 0;
    this.stuckN = 0; this.visible = null; this.wantCrouch = false;
  }

  /* --------------------------- perception --------------------------- */
  perceive() {
    const g = this.game, D = this.D, eye = this.eye(this._e);
    let best = null, bd = 1e9;
    const fwdx = -Math.sin(this.yaw), fwdz = -Math.cos(this.yaw);
    for (const e of g.ents) {
      if (!e.alive || e.team === this.team) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, dy = e.pos.y - this.pos.y;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
      if (d > D.view) continue;
      const recentlyHit = e === this.lastAttacker && g.time - this.lastHitTime < 1.5;
      if (d > 3 && !recentlyHit) {
        const dot = (dx * fwdx + dz * fwdz) / (Math.hypot(dx, dz) || 1);
        if (dot < Math.cos(D.fov / 2)) continue;
      }
      // check head first then chest (partial cover)
      if (!BV.Physics.los(eye, e.headPos(this._t)) && !BV.Physics.los(eye, e.chest(this._t))) continue;
      const score = d - (e === this.target ? 6 : 0);
      if (score < bd) { bd = score; best = e; }
    }
    this.visible = best;
    if (best) {
      if (best !== this.target || g.time - this.lastSeenTime > 1.2) {
        // new engagement: human-like reaction delay
        const surprise = this.state === 'DEFEND' ? 0.85 : 1.05;
        this.reactAt = g.time + D.reaction * surprise * BV.U.rand(0.8, 1.25);
        this.aimPart = Math.random() < D.head ? 'head' : 'body';
        this.rollAimOffset(1.6);
        this.burstLeft = 0;
      }
      this.target = best;
      this.lastSeenPos.copy(best.pos); this.lastSeenTime = g.time;
      g.spot(best, this.team);
    }
  }
  hear(pos, kind) {
    if (!this.alive) return;
    this.heard = { pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z), time: this.game.time, kind };
  }
  onDamaged(attacker) {
    if (!attacker || !this.alive) return;
    if (!this.visible) { this.heard = { pos: attacker.pos.clone(), time: this.game.time, kind: 'hit' }; }
  }
  rollAimOffset(mult) {
    const e = this.D.aimError * (mult || 1);
    this.aimOff.y = (Math.random() + Math.random() - 1) * e;
    this.aimOff.p = (Math.random() + Math.random() - 1) * e * 0.7;
    this.aimOffT = 0.35 + Math.random() * 0.3;
  }

  /* --------------------------- decisions --------------------------- */
  decide() {
    const g = this.game, now = g.time;
    const critical = this.planting || this.defusing;
    if (this.visible) {
      if (critical && (this.planting ? g.plantProgress > 0.55 : g.defuseProgress > 0.6)) return; // commit to the objective
      if (critical) { g.cancelObjective(this); }
      if (this.hp < 28 && now > this.retreatUntil + 4 && Math.random() < 0.08 && !this.hasCharge) {
        this.state = 'RETREAT'; this.retreatUntil = now + BV.U.rand(1.8, 3.0); this.pickCover(); return;
      }
      if (this.state === 'RETREAT' && now < this.retreatUntil) return;
      this.state = 'ATTACK'; return;
    }
    if (this.state === 'RETREAT' && now < this.retreatUntil) return;
    if (critical) return;
    // lost sight: hunt the last known position for a few seconds
    if (this.target && now - this.lastSeenTime < 5 && !this.hasCharge) {
      this.state = 'SEARCH'; this.setGoal(this.lastSeenPos.x, this.lastSeenPos.y, this.lastSeenPos.z);
      if (Math.hypot(this.pos.x - this.lastSeenPos.x, this.pos.z - this.lastSeenPos.z) < 1.5) this.lastSeenTime = -99;
      this.maybeGrenade(this.lastSeenPos);
      return;
    }
    this.target = null;
    if (this.heard && now - this.heard.time < 4 && !this.hasCharge && !this.isCommitted()) {
      const hp = this.heard.pos;
      const d = Math.hypot(hp.x - this.pos.x, hp.z - this.pos.z);
      if (d > 2 && d < 35) { this.state = 'SEARCH'; this.setGoal(hp.x, hp.y, hp.z); return; }
      this.heard = null;
    }
    this.roleBehaviour();
  }
  /* is the bot doing something the team relies on? */
  isCommitted() {
    const g = this.game;
    if (g.charge.state === 'planted' && this.team !== g.attackTeam) return true; // must retake
    if (g.charge.state === 'dropped' && this.team === g.attackTeam && g.chargeFetcher === this) return true;
    return false;
  }

  roleBehaviour() {
    const g = this.game, now = g.time, ch = g.charge, map = g.map;
    const attacking = this.team === g.attackTeam;
    if (attacking) {
      if (ch.state === 'planted') {
        this.state = 'DEFEND';
        if (!this.spot || this.spot.site !== ch.site) this.spot = this.pickSpot(ch.site);
        this.holdAt(this.spot, ch.site.threatsAtk);
        return;
      }
      if (ch.state === 'dropped' && g.chargeFetcher === this) { this.state = 'OBJECTIVE'; this.setGoal(ch.pos.x, ch.pos.y, ch.pos.z); return; }
      const site = g.plan.site;
      // staging: gather on the route, then execute together
      if (!this.stageReached) {
        const st = this.route.stage;
        this.state = 'OBJECTIVE';
        if (Math.hypot(this.pos.x - st[0], this.pos.z - st[1]) < 2.5) { this.stageReached = true; }
        else { this.setGoal(st[0], 0, st[1]); return; }
      }
      if (now < g.plan.goAt && !this.hasCharge) { this.state = 'PATROL'; this.holdAt({ x: this.route.stage[0], y: 0, z: this.route.stage[1] }, [[site.center[0], site.center[1]]]); return; }
      if (now < g.plan.goAt && this.hasCharge) { this.state = 'PATROL'; this.wantMove = false; return; }
      if (this.hasCharge) {
        this.state = 'OBJECTIVE';
        const ps = g.plan.plantSpot;
        if (Math.hypot(this.pos.x - ps[0], this.pos.z - ps[1]) < 1.0 && map.siteAt(this.pos.x, this.pos.z) && this.onGround) {
          this.wantMove = false; g.beginPlant(this);
        } else this.setGoal(ps[0], ps[2] || 0, ps[1]);
        return;
      }
      // escorts: take positions inside the site
      this.state = 'OBJECTIVE';
      if (!this.spot || this.spot.site !== site) this.spot = this.pickSpot(site);
      if (map.siteAt(this.pos.x, this.pos.z) && Math.hypot(this.pos.x - this.spot.x, this.pos.z - this.spot.z) < 1.5) this.state = 'DEFEND';
      this.holdAt(this.spot, site.threatsAtk);
      return;
    }
    // ----- defenders -----
    if (ch.state === 'planted') {
      this.state = 'OBJECTIVE';
      const d = Math.hypot(this.pos.x - ch.pos.x, this.pos.z - ch.pos.z);
      if (d < 1.2 && (!g.defuser || g.defuser === this)) { this.wantMove = false; g.beginDefuse(this); this.lookYaw = this.yaw; return; }
      if (g.defuser && g.defuser !== this && d < 9) {
        this.state = 'DEFEND'; if (!this.spot || this.spot.site !== ch.site) this.spot = this.pickSpot(ch.site);
        this.holdAt(this.spot, ch.site.threatsDef); return;
      }
      this.setGoal(ch.pos.x, ch.pos.y, ch.pos.z); return;
    }
    if (this.role === 'mid') {
      this.state = 'PATROL';
      if (!this.spot || (now > this.spotT && this.atGoal())) {
        const p = BV.U.pick(map.data.midPatrol); this.spot = { x: p[0], y: 0, z: p[1], site: null }; this.spotT = now + BV.U.rand(4, 9);
      }
      this.holdAt(this.spot, [[20, -36], [18, 0], [24, 35]]);
      return;
    }
    const site = map.data.sites.find(s => s.name === this.role) || map.data.sites[0];
    if (!this.spot || this.spot.site !== site || (now > this.spotT && this.atGoal() && Math.random() < 0.3)) { this.spot = this.pickSpot(site); this.spotT = now + BV.U.rand(10, 18); }
    this.state = this.atGoal() ? 'DEFEND' : 'PATROL';
    this.holdAt(this.spot, site.threatsDef);
  }
  pickSpot(site) {
    const taken = new Set(this.game.ents.filter(e => e !== this && e.isBot && e.spot && e.team === this.team).map(e => e.spot.key));
    const spots = site.defend.map((d, i) => ({ x: d[0], y: d[2] || 0, z: d[1], site, key: site.name + i }));
    const free = spots.filter(s => !taken.has(s.key));
    return BV.U.pick(free.length ? free : spots);
  }
  holdAt(spot, threats) {
    this.setGoal(spot.x, spot.y, spot.z);
    if (this.atGoal()) {
      this.wantMove = false;
      if (this.game.time > this.lookT) {
        const t = BV.U.pick(threats);
        this.lookYaw = Math.atan2(-(t[0] - this.pos.x), -(t[1] - this.pos.z)) + BV.U.rand(-0.3, 0.3);
        this.lookT = this.game.time + BV.U.rand(2, 5);
      }
    }
  }
  atGoal() { return this.goal && Math.hypot(this.pos.x - this.goal.x, this.pos.z - this.goal.z) < 1.0; }
  pickCover() {
    // nearest waypoint that the threat cannot see
    const th = this.target ? this.target.eye(this._t) : null; if (!th) return;
    let best = null, bd = 1e9;
    for (const n of this.game.map.data.nodes) {
      const d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z);
      if (d < 3 || d > 16) continue;
      if (BV.Physics.los(th, { x: n.x, y: n.y + 1.3, z: n.z })) continue;
      if (d < bd) { bd = d; best = n; }
    }
    if (best) this.setGoal(best.x, best.y, best.z);
  }
  maybeGrenade(p) {
    const g = this.game;
    if (!this.hasGrenade() || g.time < this.grenadeT) return;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (d < 8 || d > 24 || Math.random() > 0.08) return;
    this.grenadeT = g.time + 8;
    this.yaw = Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z));
    this.pitch = 0.32 + d * 0.006;
    g.switchSlot(this, 4); this._throwAt = g.time + 0.55;
  }

  /* --------------------------- navigation --------------------------- */
  setGoal(x, y, z) {
    const g = this.goal;
    if (g && Math.hypot(g.x - x, g.z - z) < 1.2 && this.path.length) return;
    this.goal = { x, y, z };
    this.computePath();
  }
  computePath() {
    if (!this.goal) return;
    const p = BV.Map.findPath(this.pos, this.goal);
    p.push({ x: this.goal.x, y: this.goal.y, z: this.goal.z });
    // drop leading nodes that are behind us
    while (p.length > 1 && Math.hypot(p[0].x - this.pos.x, p[0].z - this.pos.z) < 1.2) p.shift();
    this.path = p; this.pathIdx = 0; this.repathT = this.game.time + 4;
  }
  steer(out) {
    out.set(0, 0, 0);
    if (!this.path.length || !this.wantMove) return false;
    let n = this.path[this.pathIdx];
    while (n && Math.hypot(n.x - this.pos.x, n.z - this.pos.z) < (this.pathIdx === this.path.length - 1 ? 0.35 : 0.8)) {
      this.pathIdx++; n = this.path[this.pathIdx];
    }
    if (!n) { this.path = []; return false; }
    // skip ahead when the following node is directly reachable
    const nn = this.path[this.pathIdx + 1];
    if (nn && Math.abs(nn.y - this.pos.y) < 0.3 && this.game.frame % 6 === this.id % 6 &&
        BV.Physics.los({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z }, { x: nn.x, y: nn.y + 0.6, z: nn.z }) &&
        BV.Physics.los({ x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z }, { x: nn.x, y: nn.y + 1.4, z: nn.z })) { this.pathIdx++; n = nn; }
    out.set(n.x - this.pos.x, 0, n.z - this.pos.z);
    const l = out.length(); if (l > 0.001) out.multiplyScalar(1 / l);
    return true;
  }

  /* --------------------------- per-frame update --------------------------- */
  update(dt) {
    const g = this.game;
    if (!this.alive) { this.state = 'DEAD'; return; }
    if (g.phase === 'freeze' || g.phase === 'over') {
      this.state = 'IDLE'; this.vel.x = this.vel.z = 0; BV.Physics.moveEntity(this, dt); return;
    }
    if (g.training) { this.trainingUpdate(dt); return; }
    this.thinkT -= dt;
    this.wantMove = true;
    if (this.thinkT === undefined || isNaN(this.thinkT)) this.thinkT = Math.random() * 0.1;
    if (this.thinkT <= 0) {
      this.thinkT = 0.085 + Math.random() * 0.03;   // ~10 Hz, de-synchronised between bots
      this.perceive();
      this.decide();
      if (g.time > this.repathT && this.goal) this.computePath();
    } else if (this.state === 'DEFEND' || this.planting || this.defusing) this.wantMove = this.goal ? !this.atGoal() : false;
    if (this.planting || this.defusing) this.wantMove = false;

    const D = this.D, W = this.weapon;
    // ---------- aim ----------
    let tYaw = this.yaw, tPitch = 0;
    const tgt = this.visible;
    if (tgt && (this.state === 'ATTACK' || this.state === 'RETREAT')) {
      this.aimOffT -= dt; if (this.aimOffT <= 0) this.rollAimOffset(1);
      const eye = this.eye(this._e);
      const tp = this.aimPart === 'head' ? tgt.headPos(this._t) : tgt.chest(this._t);
      // lead slightly + compensate own movement
      tp.x += tgt.vel.x * 0.05; tp.z += tgt.vel.z * 0.05;
      const dx = tp.x - eye.x, dy = tp.y - eye.y, dz = tp.z - eye.z;
      tYaw = Math.atan2(-dx, -dz) + this.aimOff.y; tPitch = Math.atan2(dy, Math.hypot(dx, dz)) + this.aimOff.p;
    } else if (this.state === 'SEARCH' && this.target) {
      const dx = this.lastSeenPos.x - this.pos.x, dz = this.lastSeenPos.z - this.pos.z;
      tYaw = Math.atan2(-dx, -dz);
    } else if (this._throwAt) {
      tYaw = this.yaw; tPitch = this.pitch;
    } else if (!this.wantMove || !this.path.length) {
      tYaw = this.lookYaw;
    } else if (Math.hypot(this.vel.x, this.vel.z) > 0.5) {
      tYaw = Math.atan2(-this.vel.x, -this.vel.z);
    }
    const dyaw = BV.U.angDiff(this.yaw, tYaw), dpitch = tPitch - this.pitch;
    const k = Math.min(1, D.turn * dt * (tgt ? 1.0 : 0.6));
    this.yaw += BV.U.clamp(dyaw * k, -9 * dt, 9 * dt) || 0;
    this.pitch += dpitch * k;
    this.pitch = BV.U.clamp(this.pitch, -1.2, 1.2);

    // ---------- weapon handling ----------
    if (this._throwAt && g.time > this._throwAt) {
      this._throwAt = 0;
      if (this.slot === 4) { g.fire(this); }
    }
    if (W && W.def.cls !== 'melee' && W.def.cls !== 'grenade' && !this.reloading) {
      if (W.mag === 0 && W.reserve > 0) g.startReload(this);
      else if (W.mag === 0 && W.reserve === 0) g.switchSlot(this, this.slot === 1 && this.inv[2] ? 2 : 3);
      else if (!tgt && W.mag < W.def.mag * 0.4 && W.reserve > 0 && g.time - this.lastSeenTime > 2) g.startReload(this);
    }
    if (!tgt && this.slot !== 4 && this.slot !== this.bestSlot() && !this.reloading && (this.inv[this.bestSlot()].mag > 0 || this.inv[this.bestSlot()].reserve > 0)) g.switchSlot(this, this.bestSlot());

    let firing = false;
    if (tgt && this.state === 'ATTACK' && g.time >= this.reactAt && W && W.def.cls !== 'grenade') {
      const dist = this.pos.distanceTo(tgt.pos);
      const tol = (W.def.cls === 'sniper' ? 0.015 : 0.05) + 0.6 / Math.max(2, dist);
      if (Math.abs(dyaw) < tol && Math.abs(dpitch) < tol * 1.2) {
        if (W.def.cls === 'melee') { if (dist < 2.2) firing = true; }
        else if (this.burstPause > 0) this.burstPause -= dt;
        else {
          if (this.burstLeft <= 0) this.burstLeft = W.def.auto ? BV.U.randInt(D.burst[0], D.burst[1]) + (dist < 10 ? 4 : 0) : 1;
          firing = true;
        }
      }
    }
    if (firing && W.def.cls === 'sniper' && Math.hypot(this.vel.x, this.vel.z) > 1) firing = false;
    if (firing && g.time >= this.nextFire) {
      if (g.fire(this)) {
        this.burstLeft--;
        if (this.burstLeft <= 0) this.burstPause = W.def.auto ? BV.U.rand(0.15, 0.45) : BV.U.rand(0.05, 0.25) * (2 - D.strafe);
        if (Math.random() < 0.3) this.rollAimOffset(0.8);
      }
    }

    // ---------- movement ----------
    const move = this._v;
    let speed = 4.6 * this.speedMul();
    this.wantCrouch = false; this.sprint = false;
    if (this.state === 'ATTACK' && tgt) {
      const dist = this.pos.distanceTo(tgt.pos);
      const ideal = W && W.def.cls === 'shotgun' ? 6 : W && W.def.cls === 'melee' ? 1 : W && W.def.cls === 'sniper' ? 30 : 14;
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = BV.U.rand(0.35, 0.95);
        this.strafe = Math.random() < D.strafe ? (Math.random() < 0.5 ? -1 : 1) : 0;
        if (this.game.diffName === 'HARD' && dist > 18 && W && W.def.cls !== 'shotgun' && Math.random() < 0.35) this.strafe = 0;
      }
      move.set(0, 0, 0);
      if (dist > ideal + 6 && !this.hasCharge) { this.setGoal(tgt.pos.x, tgt.pos.y, tgt.pos.z); this.steer(move); move.multiplyScalar(0.8); }
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      move.x += rx * this.strafe; move.z += rz * this.strafe;
      if (this.game.diffName !== 'EASY' && this.strafe === 0 && dist > 16 && W && (W.def.cls === 'rifle' || W.def.cls === 'dmr')) this.wantCrouch = Math.random() < 0.02 ? !this.wantCrouch : this.crouch > 0.5;
      if (firing && this.game.diffName === 'HARD' && W.def.cls !== 'smg') move.multiplyScalar(0.25); // counter-strafe
      speed *= 0.85;
    } else if (this.state === 'RETREAT') {
      this.steer(move); speed *= 1.1;
    } else {
      this.steer(move);
      if (this.state === 'SEARCH') speed *= 0.8;
      if ((this.state === 'OBJECTIVE' || this.state === 'PATROL') && this.path.length - this.pathIdx > 3 && g.time - this.lastSeenTime > 3) { this.sprint = true; speed = 5.9 * this.speedMul(); }
    }
    if (this.planting || this.defusing) { move.set(0, 0, 0); this.wantCrouch = this.defusing; }
    // teammate separation
    for (const e of g.ents) {
      if (e === this || !e.alive || e.team !== this.team) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.1 && d > 0.01) { move.x += dx / d * (1.1 - d) * 1.5; move.z += dz / d * (1.1 - d) * 1.5; }
    }
    const ml = Math.hypot(move.x, move.z);
    if (ml > 1) { move.x /= ml; move.z /= ml; }
    if (this.crouch > 0.5) speed = 1.9;
    // accelerate toward desired velocity
    const accel = this.onGround ? 14 : 2;
    this.vel.x += (move.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (move.z * speed - this.vel.z) * Math.min(1, accel * dt);
    g.applyCrouch(this, dt);
    BV.Physics.moveEntity(this, dt);

    // ---------- stuck detection ----------
    this.stuckT += dt;
    if (this.stuckT > 1.0) {
      const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z);
      if (ml > 0.5 && moved < 0.35 && this.state !== 'ATTACK') {
        this.stuckN++;
        if (this.onGround) this.vel.y = 5.4; // hop over small obstacles
        if (this.stuckN > 2 && this.goal) {
          const n = BV.Map.nearestNode(this.pos.x, this.pos.y, this.pos.z, false);
          this.path = [{ x: n.x, y: n.y, z: n.z }].concat(BV.Map.findPath(n, this.goal)); this.path.push(this.goal); this.pathIdx = 0;
        }
        if (this.stuckN > 5) { this.pos.x += BV.U.rand(-0.3, 0.3); this.pos.z += BV.U.rand(-0.3, 0.3); this.stuckN = 0; }
      } else this.stuckN = Math.max(0, this.stuckN - 1);
      this.lastPos.copy(this.pos); this.stuckT = 0;
    }
  }

  /* training dummies wander slowly and never shoot */
  trainingUpdate(dt) {
    const g = this.game;
    this.wantMove = true;
    if (!this.goal || this.atGoal()) {
      const n = BV.U.pick(g.map.data.nodes.filter(n => n.x > -20 && n.x < 30 && Math.abs(n.z) < 12));
      this.setGoal(n.x, n.y, n.z);
    }
    const move = this._v; this.steer(move);
    const speed = 2.2;
    this.vel.x += (move.x * speed - this.vel.x) * Math.min(1, 10 * dt);
    this.vel.z += (move.z * speed - this.vel.z) * Math.min(1, 10 * dt);
    if (Math.hypot(this.vel.x, this.vel.z) > 0.3) this.yaw += BV.U.angDiff(this.yaw, Math.atan2(-this.vel.x, -this.vel.z)) * Math.min(1, 5 * dt);
    this.state = 'PATROL';
    BV.Physics.moveEntity(this, dt);
  }
};
