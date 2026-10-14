/* =====================================================================
   combatant.js — shared state for every soldier (player and bots):
   transform, health/armour, inventory, hit boxes and model sync.
   ===================================================================== */
'use strict';
BV.WeaponInstance = function (id) {
  const def = BV.WEAPONS[id];
  this.def = def; this.mag = def.mag || 0; this.reserve = def.reserve || 0;
};

BV.Combatant = class {
  constructor(name, team, isBot) {
    this.id = BV.Combatant._next = (BV.Combatant._next || 0) + 1;
    this.name = name; this.team = team; this.isBot = !!isBot; this.isPlayer = !isBot;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.38; this.height = 1.8; this.crouch = 0; this.wantCrouch = false;
    this.onGround = true; this.landSpeed = 0;
    this.hp = 100; this.armor = 0; this.alive = true;
    this.money = BV.RULES.startMoney; this.kills = 0; this.deaths = 0; this.score = 0;
    this.inv = { 1: null, 2: null, 3: null, 4: null };
    this.slot = 2; this.prevSlot = 3;
    this.nextFire = 0; this.shotsFired = 0; this.lastShot = -9; this.switchT = 0;
    this.reloading = false; this.reloadT = 0; this.zoom = 0;
    this.hasCharge = false; this.planting = false; this.defusing = false;
    this.stepDist = 0; this.walkPhase = 0; this.deathT = 0; this.spottedUntil = 0;
    this.lastAttacker = null; this.lastHitTime = -9; this.sprint = false;
    this.model = null; this.tag = null;
    this._hb = [
      { part: 'head', min: [0, 0, 0], max: [0, 0, 0] },
      { part: 'body', min: [0, 0, 0], max: [0, 0, 0] },
      { part: 'legs', min: [0, 0, 0], max: [0, 0, 0] }
    ];
  }
  get weapon() { return this.inv[this.slot]; }
  get eyeHeight() { return this.height - 0.15; }
  eye(out) { return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }
  chest(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.68, this.pos.z); }
  headPos(out) { return out.set(this.pos.x, this.pos.y + this.height - 0.16, this.pos.z); }
  dir(out) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  hitboxes() {
    const p = this.pos, h = this.height, hb = this._hb;
    const hd = hb[0], bd = hb[1], lg = hb[2];
    hd.min[0] = p.x - 0.15; hd.max[0] = p.x + 0.15; hd.min[2] = p.z - 0.15; hd.max[2] = p.z + 0.15;
    hd.min[1] = p.y + h - 0.32; hd.max[1] = p.y + h + 0.02;
    bd.min[0] = p.x - 0.27; bd.max[0] = p.x + 0.27; bd.min[2] = p.z - 0.24; bd.max[2] = p.z + 0.24;
    bd.min[1] = p.y + h * 0.5; bd.max[1] = p.y + h - 0.32;
    lg.min[0] = p.x - 0.21; lg.max[0] = p.x + 0.21; lg.min[2] = p.z - 0.2; lg.max[2] = p.z + 0.2;
    lg.min[1] = p.y; lg.max[1] = p.y + h * 0.5;
    return hb;
  }
  giveWeapon(id) {
    const def = BV.WEAPONS[id];
    if (def.slot === 4) {
      if (!this.inv[4]) this.inv[4] = { def, count: 0 };
      this.inv[4].count = Math.min(2, this.inv[4].count + 1);
      return;
    }
    this.inv[def.slot] = new BV.WeaponInstance(id);
  }
  hasGrenade() { return this.inv[4] && this.inv[4].count > 0; }
  /* strip to default kit (after death or halftime) */
  defaultKit() {
    this.inv = { 1: null, 2: new BV.WeaponInstance('viper9'), 3: new BV.WeaponInstance('bladex'), 4: null };
    this.slot = 2; this.armor = 0;
  }
  refill() { [1, 2].forEach(s => { const w = this.inv[s]; if (w) { w.mag = w.def.mag; w.reserve = w.def.reserve; } }); }
  bestSlot() { return this.inv[1] ? 1 : 2; }
  speedMul() { const w = this.weapon; return w ? w.def.speed : 1; }
};
