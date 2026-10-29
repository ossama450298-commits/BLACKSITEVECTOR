/* =====================================================================
   game.js — match flow and combat rules.
   Rounds (freeze → live → planted → end), economy, objective
   ("Vector Charge": attackers arm it on site A or B, defenders disarm it),
   hitscan weapons with spread/recoil/falloff, melee, grenades, damage and
   kills, spotting, hearing and halftime side switch.
   ===================================================================== */
'use strict';
BV.Game = class {
  constructor(engine) {
    this.engine = engine; this.scene = engine.scene; this.map = BV.Map;
    this.ents = []; this.player = null; this.grenades = []; this.smokes = [];
    this.time = 0; this.frame = 0; this.phase = 'menu'; this.phaseT = 0; this.timer = 0;
    this.score = { VANGUARD: 0, RAVEN: 0 }; this.lossStreak = { VANGUARD: 0, RAVEN: 0 };
    this.round = 0; this.attackTeam = 'RAVEN';
    this.charge = { state: 'none', pos: new THREE.Vector3(), site: null, carrier: null };
    this.planter = null; this.plantProgress = 0; this.defuser = null; this.defuseProgress = 0;
    this.chargeT = 0; this.beepT = 0; this.chargeFetcher = null;
    this.intel = {}; this.plan = null; this.playerUse = false; this.drops = []; this.dropHintT = 0;
    this.stats = { shots: 0, hits: 0, heads: 0, kills: 0 };
    this.T1 = new THREE.Vector3(); this.T2 = new THREE.Vector3(); this.T3 = new THREE.Vector3(); this.T4 = new THREE.Vector3();
    this.buildChargeMesh();
    // threat directions used by bots when holding angles
    const [A, B] = this.map.data.sites;
    A.threatsDef = [[22, -36], [30, -14], [26, -25]]; A.threatsAtk = [[54, -15], [30, -14], [22, -36]];
    B.threatsDef = [[22, 35], [29, 14], [27, 22]]; B.threatsAtk = [[54, 14], [29, 14], [22, 35]];
  }

  get diff() { return BV.DIFFICULTY[this.diffName]; }
  defendTeam() { return BV.otherTeam(this.attackTeam); }
  isAttacker(c) { return c.team === this.attackTeam; }

  /* ----------------------------- setup ----------------------------- */
  /* demolition charge: four wrapped explosive blocks, duct tape, control unit with keypad, a live
     LCD (countdown), blinking LED, coloured wires into detonators and a stub antenna (~30 x 22 cm) */
  buildChargeMesh() {
    const g = new THREE.Group(), S = (o) => new THREE.MeshStandardMaterial(o);
    const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
    // explosive block wrapper: olive film with stencilled lot markings and wear
    const wrap = canvasTex(256, 128, (x, w, h) => {
      x.fillStyle = '#5d6447'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,34,22' : '150,150,120'},${Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      x.fillStyle = '#e8e2c4'; x.font = 'bold 15px monospace'; x.fillText('CHARGE, DEMOLITION', 14, 36); x.font = '12px monospace'; x.fillText('BLOCK M-17  1.25 LB', 14, 58); x.fillText('LOT VX-0473-17', 14, 78);
      x.strokeStyle = 'rgba(20,22,14,0.55)'; x.lineWidth = 3; x.strokeRect(6, 6, w - 12, h - 12);
    });
    const tape = canvasTex(128, 32, (x, w, h) => { x.fillStyle = '#3d3e3b'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { x.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`; x.fillRect(i, 0, 1, h); } x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, w, 2); x.fillRect(0, h - 2, w, 2); });
    const keypad = canvasTex(128, 160, (x, w, h) => {
      x.fillStyle = '#1b1c1d'; x.fillRect(0, 0, w, h);
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
      keys.forEach((k, i) => { const cx = 14 + (i % 3) * 38, cy = 10 + Math.floor(i / 3) * 37; x.fillStyle = '#4a4c4f'; x.fillRect(cx, cy, 30, 30); x.fillStyle = '#6a6d70'; x.fillRect(cx, cy, 30, 3); x.fillStyle = '#e9e6dc'; x.font = 'bold 18px monospace'; x.fillText(k, cx + 9, cy + 22); });
    });
    // LCD: redrawn when the text changes
    const lcdC = document.createElement('canvas'); lcdC.width = 160; lcdC.height = 64; const lcdX = lcdC.getContext('2d');
    const lcd = new THREE.CanvasTexture(lcdC); lcd.encoding = THREE.sRGBEncoding;
    let lcdText = null;
    this.setChargeDisplay = (txt, armed) => {
      if (txt === lcdText) return; lcdText = txt;
      lcdX.fillStyle = armed ? '#2a0806' : '#0b1a0b'; lcdX.fillRect(0, 0, 160, 64);
      lcdX.fillStyle = armed ? '#ff3a26' : '#6dff5a'; lcdX.font = 'bold 40px "Courier New", monospace'; lcdX.textAlign = 'center'; lcdX.textBaseline = 'middle';
      lcdX.shadowColor = lcdX.fillStyle; lcdX.shadowBlur = 8; lcdX.fillText(txt, 80, 34); lcdX.shadowBlur = 0;
      lcdX.fillStyle = 'rgba(255,255,255,0.06)'; lcdX.fillRect(0, 0, 160, 18); lcd.needsUpdate = true;
    };
    this.setChargeDisplay('--:--', false);
    const rb = (w, h, d) => new THREE.BoxGeometry(w, h, d);   // centred boxes (keeps the top details exactly on the surfaces)
    const add = (geo, mat, x, y, z, ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
    const blockMat = S({ map: wrap, roughness: 0.82, metalness: 0 }), tapeMat = S({ map: tape, roughness: 0.6, metalness: 0.05 });
    for (const bx of [-0.075, 0.075]) for (const bz of [-0.056, 0.056]) add(rb(0.146, 0.062, 0.108, 0.012), blockMat, bx, 0.031, bz);
    for (const tz of [-0.06, 0.06]) add(new THREE.BoxGeometry(0.31, 0.066, 0.032), tapeMat, 0, 0.033, tz);   // tape bands around the bundle
    // control unit, keypad, LCD bezel, LED, antenna
    const plastic = S({ color: 0x2a2c2e, roughness: 0.55, metalness: 0.1 });
    add(rb(0.17, 0.032, 0.118, 0.008), plastic, 0, 0.078, 0);
    const kp = add(new THREE.PlaneGeometry(0.064, 0.08), S({ map: keypad, roughness: 0.6 }), 0.04, 0.0945, 0.004); kp.rotation.x = -Math.PI / 2;
    add(new THREE.BoxGeometry(0.076, 0.006, 0.044), S({ color: 0x111213, roughness: 0.4 }), -0.042, 0.0955, -0.02);
    const screen = add(new THREE.PlaneGeometry(0.068, 0.036), S({ map: lcd, emissive: 0xffffff, emissiveMap: lcd, emissiveIntensity: 0.9, roughness: 0.2 }), -0.042, 0.0992, -0.02); screen.rotation.x = -Math.PI / 2;
    const led = add(new THREE.SphereGeometry(0.0075, 10, 8), S({ color: 0x401010, emissive: 0xff2a14, emissiveIntensity: 0.4, roughness: 0.3 }), -0.07, 0.098, 0.036);
    add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.11, 6), S({ color: 0x151515, roughness: 0.5 }), 0.072, 0.15, -0.045);
    add(new THREE.SphereGeometry(0.0065, 8, 6), S({ color: 0x151515, roughness: 0.5 }), 0.072, 0.206, -0.045);
    // detonators in the blocks and the wires running to them
    const cap = S({ color: 0xb7b3a6, roughness: 0.3, metalness: 0.85 });
    const wires = [[0xc62d24, [-0.06, 0.09, 0.05], [-0.11, 0.1, 0.07], [-0.12, 0.065, 0.082]], [0x2e5bc4, [-0.02, 0.09, 0.055], [-0.03, 0.11, 0.09], [-0.035, 0.065, 0.11]],
      [0xd8b72a, [0.02, 0.09, -0.055], [0.06, 0.11, -0.09], [0.07, 0.065, -0.11]], [0x2f8a3a, [0.06, 0.09, -0.05], [0.11, 0.1, -0.07], [0.12, 0.065, -0.082]]];
    for (const [col, a, b, c] of wires) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...c)]);
      add(new THREE.TubeGeometry(curve, 14, 0.0028, 6, false), S({ color: col, roughness: 0.45 }), 0, 0, 0);
      add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 8), cap, c[0], c[1] - 0.008, c[2]);
    }
    this.chargeLed = led;
    this.chargeLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: BV.Textures.glow(), color: 0xff3020, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.chargeLight.position.set(-0.07, 0.11, 0.036); this.chargeLight.scale.set(0.16, 0.16, 1); g.add(this.chargeLight);
    g.scale.setScalar(1.3);    // a touch larger than life so it reads from a distance
    // the modelled time bomb (CC BY) replaces the procedural one when loaded: live timer on its
    // 7-segment display and its two board LEDs pulsing with the beeps
    this._chargeLcd = lcd;
    g.visible = false; this.scene.add(g); this.chargeMesh = g;
    this.upgradeChargeModel();
  }
  // swap in the modelled time bomb once the realistic assets are loaded (safe to call repeatedly)
  upgradeChargeModel() {
    if (this._chargeUpgraded) return;
    const TB = BV.Real && BV.Real.ready && BV.Real.chargeModel && BV.Real.chargeModel();
    if (!TB) return;
    this._chargeUpgraded = true;
    const g = this.chargeMesh, lcd = this._chargeLcd;
    {
      g.children.slice().forEach(ch => { if (ch !== this.chargeLight) g.remove(ch); });
      g.scale.setScalar(1.15); g.add(TB.group);
      if (TB.display) {
        // the model's own display stays as a dark bezel; our live LCD is laid exactly over its top face,
        // aligned with its long side, so the digits always read correctly
        TB.display.material = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.35 });
        g.updateMatrixWorld(true);
        const db = new THREE.Box3().setFromObject(TB.display), dmin = db.min.clone(), dmax = db.max.clone();
        g.worldToLocal(dmin); g.worldToLocal(dmax);
        const lb2 = new THREE.Box3().setFromPoints([dmin, dmax]), sz = lb2.getSize(new THREE.Vector3()), ctr = lb2.getCenter(new THREE.Vector3());
        const along = sz.x >= sz.z, Lw = (along ? sz.x : sz.z) * 0.9, Lh = (along ? sz.z : sz.x) * 0.82;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(Lw, Lh), new THREE.MeshStandardMaterial({ map: lcd, emissive: 0xffffff, emissiveMap: lcd, emissiveIntensity: 1.0, roughness: 0.2 }));
        face.rotation.x = -Math.PI / 2; face.rotation.z = (along ? 0 : Math.PI / 2) + Math.PI;   // read the same way as the keypad
        face.position.set(ctr.x, lb2.max.y + 0.0015, ctr.z); g.add(face);
        this.setChargeDisplay('--:--', false);
      }
      if (TB.leds.length) { const lm = new THREE.MeshStandardMaterial({ color: 0x501010, emissive: 0xff2a14, emissiveIntensity: 0.35, roughness: 0.3 }); TB.leds.forEach(l => { l.material = lm; }); this.chargeLed = TB.leds[0]; }
      const lb = new THREE.Box3().setFromObject(TB.leds[0] || TB.group), lc = lb.getCenter(new THREE.Vector3()); g.worldToLocal(lc);
      this.chargeLight.position.copy(lc).add(new THREE.Vector3(0, 0.02, 0)); this.chargeLight.scale.set(0.12, 0.12, 1);
    }
  }

  clearEntities() {
    for (const e of this.ents) { if (e.model) this.scene.remove(e.model.root); if (e.tag) this.scene.remove(e.tag); }
    this.ents = []; this.player = null;
    for (const gr of this.grenades) this.scene.remove(gr.mesh);
    this.grenades = []; (this.smokes || []).forEach(sm => this.scene.remove(sm.group)); this.smokes = [];
    this.clearDrops();
  }

  newMatch(opts) {
    this.clearEntities();
    this.opts = opts; this.diffName = opts.difficulty || 'NORMAL';
    this.training = !!opts.training;
    this.roundsToWin = opts.roundsToWin || 8;
    this.score = { VANGUARD: 0, RAVEN: 0 }; this.lossStreak = { VANGUARD: 0, RAVEN: 0 };
    this.round = 0; this.attackTeam = 'RAVEN'; this.halftimeDone = false; this.halftimePending = false;
    this.stats = { shots: 0, hits: 0, heads: 0, kills: 0 };
    this.time = 0; this.killfeedClear = true;
    const pTeam = opts.team === 'AUTO' || !opts.team ? BV.U.pick(['VANGUARD', 'RAVEN']) : opts.team;
    const p = new BV.Combatant('You', pTeam, false);
    p.variant = opts.team === pTeam ? (opts.character || 0) : 0;   // the character chosen in the menu
    this.addEnt(p); this.player = p;
    if (this.training) {
      const foe = BV.otherTeam(pTeam);
      for (let i = 0; i < 6; i++) this.addEnt(new BV.Bot('Target-' + (i + 1), foe, this));
      p.money = 16000;
    } else {
      const n = opts.teamSize || 5;
      const names = { VANGUARD: BV.U.shuffle(BV.BOT_NAMES.VANGUARD.slice()), RAVEN: BV.U.shuffle(BV.BOT_NAMES.RAVEN.slice()) };
      for (const t of ['VANGUARD', 'RAVEN']) {
        const count = t === pTeam ? n - 1 : n;
        for (let i = 0; i < count; i++) this.addEnt(new BV.Bot(names[t][i % names[t].length], t, this));
      }
    }
    for (const e of this.ents) e.defaultKit();
    BV.HUD.resetMatch(this);
    this.startRound();
  }

  addEnt(e) {
    if (e.variant === undefined) { this._vc = this._vc || {}; e.variant = this._vc[e.team] = (this._vc[e.team] || 0) + 1; } e.model = BV.Models.soldier(e.team, e.variant);
    this.scene.add(e.model.root);
    if (this.player && e.team === this.player.team && e !== this.player) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: BV.Textures.nameTag(e.name, BV.TEAMS[e.team].css), transparent: true, depthWrite: false, depthTest: true }));
      s.scale.set(0.5, 0.125, 1); this.scene.add(s); e.tag = s;
    }
    this.ents.push(e);
  }
  rebuildModels() {
    for (const e of this.ents) {
      this.scene.remove(e.model.root);
      if (e.variant === undefined) { this._vc = this._vc || {}; e.variant = this._vc[e.team] = (this._vc[e.team] || 0) + 1; } e.model = BV.Models.soldier(e.team, e.variant); this.scene.add(e.model.root);
      if (e.weapon) e.model.setWeapon(e.weapon.def);
    }
  }

  startRound() {
    this.round++;
    const R = BV.RULES;
    BV.Effects.clear();
    for (const gr of this.grenades) this.scene.remove(gr.mesh);
    this.grenades = []; (this.smokes || []).forEach(sm => this.scene.remove(sm.group)); this.smokes = [];
    this.clearDrops();                                   // weapons on the floor go away with the round
    const atk = this.attackTeam;
    const spawns = { attack: BV.U.shuffle(this.map.data.spawns.attack.slice()), defend: BV.U.shuffle(this.map.data.spawns.defend.slice()) };
    let ai = 0, di = 0;
    for (const e of this.ents) {
      if (!e.alive || this.round === 1 || e.stripGear) e.defaultKit();
      e.stripGear = false;
      const isAtk = e.team === atk;
      const sp = isAtk ? spawns.attack[ai++ % spawns.attack.length] : spawns.defend[di++ % spawns.defend.length];
      e.pos.set(sp[0] + BV.U.rand(-0.4, 0.4), 0, sp[1] + BV.U.rand(-0.4, 0.4)); e.vel.set(0, 0, 0);
      e.yaw = isAtk ? -Math.PI / 2 : Math.PI / 2; e.pitch = 0;
      e.hp = 100; e.alive = true; e.crouch = 0; e.height = 1.8; e.hasCharge = false; e.planting = e.defusing = false;
      e.reloading = false; e.zoom = 0; e.shotsFired = 0; e.switchT = 0; e.deathT = 0; e.lastAttacker = null; e.spottedBy = {};
      if (!e.inv[e.slot]) e.slot = e.bestSlot();
      e.slot = e.bestSlot();
      e.model.reset(); e.model.root.visible = !e.isPlayer; e.model.setWeapon(e.weapon.def);
      if (e.isBot) e.resetBrain();
      if (this.training) { e.refill(); }
    }
    if (this.training) this.setupTraining();
    // objective
    this.planter = null; this.defuser = null; this.plantProgress = this.defuseProgress = 0; this.chargeFetcher = null;
    this.chargeMesh.visible = false; this.intel = {};
    const attackers = this.ents.filter(e => e.team === atk);
    if (!this.training && attackers.length) {
      // the player carries the charge when playing on the attacking side (like the C4 in CS)
      const carrier = (this.player && this.player.alive && this.player.team === this.attackTeam) ? this.player : BV.U.pick(attackers); carrier.hasCharge = true;
      this.charge.state = 'carried'; this.charge.carrier = carrier; this.charge.site = null;
    } else this.charge.state = 'none';
    // attack plan for bots
    const sites = this.map.data.sites, site = BV.U.pick(sites);
    const routes = this.map.data.routes[site.name], main = BV.U.pick(routes);
    this.plan = { site, plantSpot: BV.U.pick(site.plant), goAt: this.time + R.freezeTime + BV.U.rand(14, 26) };
    attackers.forEach(b => { if (b.isBot) { b.route = Math.random() < 0.72 ? main : BV.U.pick(routes); } });
    const roles = ['A', 'B', 'mid', 'A', 'B', 'A', 'B'];
    let ri = 0;
    BV.U.shuffle(this.ents.filter(e => e.team !== atk && e.isBot)).forEach(b => { b.role = roles[ri++ % roles.length]; });
    // bot economy
    for (const e of this.ents) if (e.isBot && !this.training) this.botBuy(e);
    this.phase = 'freeze'; this.phaseT = this.training ? 0.01 : R.freezeTime; this.timer = R.roundTime;
    this.buyUntil = this.time + R.freezeTime + R.buyTime;
    this.spectate = null;
    BV.HUD.onRoundStart(this);
    if (this.engine.onRoundStart) this.engine.onRoundStart();
  }

  setupTraining() {
    const nodes = this.map.data.nodes.filter(n => n.x > -20 && n.x < 30 && Math.abs(n.z) < 12);
    for (const e of this.ents) if (e.isBot) { const n = BV.U.pick(nodes); e.pos.set(n.x, n.y, n.z); }
    this.player.pos.set(-36, 0, 0); this.player.yaw = -Math.PI / 2;
    this.player.money = 16000;
  }

  botBuy(b) {
    const W = BV.WEAPONS; let m = b.money;
    const buy = (id) => { const d = W[id]; if (d.team && d.team !== b.team) return false; if (m >= d.price) { m -= d.price; b.giveWeapon(id); return true; } return false; };
    if (!b.inv[1]) {
      const r = Math.random();
      const sniperTaken = this.ents.some(e => e !== b && e.team === b.team && e.inv[1] && e.inv[1].def.id === 'lynx7');
      if (m >= 5400 && r < 0.2 && !sniperTaken) buy('lynx7');
      else if (m >= 5200 && r < 0.32) buy('bastion60');
      else if (m >= 3650 && b.team === 'VANGUARD' && Math.random() < 0.4) buy('shade4');   // police: the AR-15
      else if (m >= 3650) buy(Math.random() < 0.2 ? 'kestrel5' : (b.team === 'RAVEN' ? 'arx17' : 'halberd4'));   // terrorists: the AK
      else if (m >= 3350) buy(b.team === 'RAVEN' ? 'arx17' : 'halberd4');
      else if (m >= 2550 && r < 0.35) buy('hammer12');
      else if (m >= 1950) buy(r < 0.5 ? 'specter9' : 'vectormp');
      else if (m >= 1300 && this.round > 1 && r < 0.4) buy('specter9');
    }
    if (b.armor < 60 && m >= BV.ARMOR_PRICE) { m -= BV.ARMOR_PRICE; b.armor = 100; }
    if (b.armor > 0 && !b.helmet && m >= BV.GEAR.helmet.price && Math.random() < 0.6) { m -= BV.GEAR.helmet.price; b.helmet = true; }
    if (b.team === this.defendTeam() && !b.hasKit && m >= BV.GEAR.kit.price && Math.random() < 0.45) { m -= BV.GEAR.kit.price; b.hasKit = true; }
    if (m >= 200 && !(b.nades && b.nades.flash) && Math.random() < 0.35) buy('flash');
    if (m >= 300 && !(b.nades && b.nades.smoke) && Math.random() < 0.2) buy('smoke');
    if (!b.inv[1] && m >= 650 && b.inv[2].def.id === 'viper9' && Math.random() < 0.6) buy('falcon45');
    if (m >= 300 && !b.hasGrenade() && Math.random() < 0.55) buy('shard');
    b.money = m;
    b.slot = b.bestSlot(); b.model.setWeapon(b.weapon.def);
  }

  /* player purchase from the buy menu; returns status string */
  canBuy() {
    const p = this.player;
    if (!p.alive) return 'dead';
    if (this.training) return 'ok';
    if (this.phase !== 'freeze' && !(this.phase === 'live' && this.time < this.buyUntil)) return 'time';
    const sc = this.map.data.spawnCenter[this.isAttacker(p) ? 'attack' : 'defend'];
    if (Math.hypot(p.pos.x - sc[0], p.pos.z - sc[1]) > 14) return 'zone';
    return 'ok';
  }
  buy(id) {
    const p = this.player, st = this.canBuy();
    if (st !== 'ok') return st;
    if (id === 'armor') {
      if (p.armor >= 100) return 'have';
      if (p.money < BV.ARMOR_PRICE) return 'money';
      p.money -= BV.ARMOR_PRICE; p.armor = 100; return 'bought';
    }
    if (id === 'helmet') {
      if (p.helmet) return 'have'; if (p.money < BV.GEAR.helmet.price) return 'money';
      p.money -= BV.GEAR.helmet.price; p.helmet = true; return 'bought';
    }
    if (id === 'kit') {
      if (p.team !== this.defendTeam()) return 'team';
      if (p.hasKit) return 'have'; if (p.money < BV.GEAR.kit.price) return 'money';
      p.money -= BV.GEAR.kit.price; p.hasKit = true; return 'bought';
    }
    const d = BV.WEAPONS[id];
    if (d.team && d.team !== p.team) return 'team';   // team-exclusive (AK: Raven, AR-15: Vanguard)
    if (p.money < d.price) return 'money';
    if (d.slot === 4 && p.nades && (p.nades[id] || 0) >= (d.max || 1)) return 'have';
    if (d.slot !== 4 && p.inv[d.slot] && p.inv[d.slot].def.id === id) { p.inv[d.slot].reserve = d.reserve; p.inv[d.slot].mag = d.mag; return 'have'; }
    p.money -= d.price; p.giveWeapon(id);
    if (d.slot !== 4) this.switchSlot(p, d.slot, true);
    return 'bought';
  }

  /* ----------------------------- weapons ----------------------------- */
  switchSlot(c, slot, force) {
    c.silT = 0;
    if (!c.inv[slot] || (slot === c.slot && !force)) return false;
    if (slot === 4 && !c.hasGrenade()) return false;
    if (c.planting || c.defusing) return false;
    if (slot !== c.slot) c.prevSlot = c.slot;
    c.slot = slot; c.reloading = false; c.zoom = 0;
    c.switchT = slot === 3 ? 0.3 : 0.5;
    c.model.setWeapon(c.weapon.def);
    if (c.isPlayer) { BV.Audio.draw(); this.engine.viewmodel.equip(c.weapon.def, c.team); }
    return true;
  }
  startReload(c) {
    const w = c.weapon;
    if (!w || !w.def.mag || c.reloading || w.mag >= w.def.mag || w.reserve <= 0 || c.switchT > 0) return false;
    c.reloading = true; c.reloadT = w.def.reload; c.zoom = 0;
    BV.Audio.reload(w.def, c.isPlayer ? null : c.pos);
    if (c.isPlayer) this.engine.viewmodel.reload(w.def.reload, w.mag === 0);
    return true;
  }
  updateWeapon(c, dt) {
    if (c.switchT > 0) c.switchT -= dt;
    if (c.reloading) {
      c.reloadT -= dt;
      if (c.reloadT <= 0) {
        const w = c.weapon; c.reloading = false;
        const take = Math.min(w.def.mag - w.mag, w.reserve);
        w.mag += take; w.reserve -= take;
        if (this.training && c.isPlayer) w.reserve = w.def.reserve;
      }
    }
    if (this.time - c.lastShot > 0.22) c.shotsFired = Math.max(0, c.shotsFired - dt * 14);
  }
  spreadFor(c) {
    const d = c.weapon.def;
    let s = (d.scopedSpread && c.zoom > 0) ? d.scopedSpread : d.spread;
    const sp = Math.hypot(c.vel.x, c.vel.z);
    s += d.moveSpread * BV.U.clamp((sp - 0.6) / 4.2, 0, 1.4);
    if (!c.onGround) s += d.airSpread;
    s += d.shotSpread * Math.min(c.shotsFired, 12);
    if (c.crouch > 0.5) s *= 0.72;
    return s;
  }

  fire(c) {
    const w = c.weapon; if (!w || !c.alive) return false;
    const def = w.def, now = this.time;
    if (c.switchT > 0 || c.reloading || now < c.nextFire || c.planting || c.defusing) return false;
    if (this.phase === 'freeze' || this.phase === 'over') return false;
    if (def.cls === 'melee') return this.melee(c);
    if (def.cls === 'grenade') return this.throwGrenade(c);
    if (w.mag <= 0) {
      c.nextFire = now + 0.25;
      if (c.isPlayer) { BV.Audio.dryFire(); if (w.reserve > 0) this.startReload(c); }
      return false;
    }
    w.mag--; c.nextFire = now + def.rate;
    const sil = !!(def.silencer && w.silenced !== false);   // suppressor on: quieter, no flash, a little tighter
    const spread = this.spreadFor(c) * (sil ? 0.85 : 1);
    // reusable per-shot temporaries (no allocations while firing)
    if (!this.S) this.S = { eye: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), dir: new THREE.Vector3(), shell: new THREE.Vector3() };
    const eye = this.S.eye.copy(c.eye(this.T1)), fwd = this.S.fwd.copy(c.dir(this.T2));
    const right = this.S.right.crossVectors(fwd, BV.UP).normalize();
    const up = this.S.up.crossVectors(right, fwd).normalize();
    const pellets = def.pellets || 1;
    const dir = this.S.dir;
    for (let i = 0; i < pellets; i++) {
      const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      dir.copy(fwd).addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      this.trace(c, eye, dir, def, i === 0);
    }
    c.shotsFired = Math.min(c.shotsFired + 1, 30); c.lastShot = now;
    if (c.isPlayer) {
      this.stats.shots++;
      const climb = def.kick * (1 + Math.min(c.shotsFired, 10) * 0.12);
      c.pitch = BV.U.clamp(c.pitch + climb, -1.5, 1.5);
      if (c.shotsFired > 4) c.yaw += (Math.random() - 0.5) * def.kick * 1.3;
      this.engine.onPlayerShot(def, sil);
    } else if (c.model.flashAnchor && !sil) {
      c.model.root.updateMatrixWorld(true);
      c.model.flashAnchor.getWorldPosition(this.T3); BV.Effects.muzzle(this.T3, def.cls === 'pistol' ? 0.35 : def.cls === 'smg' ? 0.42 : 0.6);
      const near = c.pos.distanceTo(this.player.pos);
      if (near < 45) this.engine.flashLight(this.T3, 0.7);
      if (near < 30) {
        BV.Effects.puff(this.T3.x, this.T3.y, this.T3.z, 0.2, 0.7, 0.22, 0xb0aca2);
        if (c.model.ejectAnchor && def.cls !== 'shotgun') {
          c.model.ejectAnchor.getWorldPosition(this.T4);
          const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
          BV.Effects.ejectShell(this.T4, this.S.shell.set(rx * 2 + (Math.random() - 0.5), 1.6 + Math.random(), rz * 2 + (Math.random() - 0.5)), def.cls);
        }
      }
    }
    BV.Audio.shot(def, c.isPlayer ? null : c.pos, sil);
    this.emitNoise(c.pos, sil ? 14 : 50, c);
    if (c.isBot && w.mag === 0 && w.reserve > 0) this.startReload(c);
    return true;
  }

  trace(c, eye, dir, def, primary) {
    const P = BV.Physics;
    const world = P.raycast(eye, dir, 260);
    let maxT = world ? world.dist : 260, hitE = null, hitPart = null;
    for (const e of this.ents) {
      if (!e.alive || e === c || e.team === c.team) continue;
      // cheap reject: distance from ray to the entity
      const ex = e.pos.x - eye.x, ey = e.pos.y + 0.9 - eye.y, ez = e.pos.z - eye.z;
      const t = ex * dir.x + ey * dir.y + ez * dir.z;
      if (t < 0 || t > maxT + 1) continue;
      const px = ex - dir.x * t, py = ey - dir.y * t, pz = ez - dir.z * t;
      if (px * px + py * py + pz * pz > 2.2) continue;
      for (const hb of e.hitboxes()) {
        const ht = P.rayBox(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, hb.min, hb.max, maxT, null);
        if (ht >= 0 && ht < maxT) { maxT = ht; hitE = e; hitPart = hb.part; }
      }
    }
    const end = this.T4.set(eye.x + dir.x * maxT, eye.y + dir.y * maxT, eye.z + dir.z * maxT).clone();
    if (hitE) {
      const mult = hitPart === 'head' ? def.head : hitPart === 'legs' ? 0.75 : 1;
      let dmg = def.damage * Math.pow(def.drop || 1, maxT / 10) * mult * (c.isBot && this.diff && this.diff.dmg ? this.diff.dmg : 1);   // very easy bots hit softer
      if (hitPart === 'head' && def.cls !== 'melee') {   // a bullet to the head is lethal... unless a helmet takes it (once; not sniper rounds)
        if (hitE.helmet && def.cls !== 'sniper') {
          hitE.helmet = false; dmg = Math.min(dmg, 34); BV.Audio.helmet && BV.Audio.helmet(hitE.isPlayer ? null : hitE.pos);
          if (hitE.isPlayer) BV.HUD.notice('Your helmet stopped a headshot', '', 1.6); else if (c.isPlayer) BV.HUD.notice('Helmet!', '', 0.9);
        } else dmg = 9999;
      }
      if (c.isPlayer) { this.stats.hits++; if (hitPart === 'head') this.stats.heads++; }
      if (!hitE.isPlayer) BV.Effects.bloodHit(end, dir, hitPart === 'head');
      if (primary) BV.Audio.impact(end, 'flesh');
      this.damage(hitE, dmg, c, def, hitPart, dir);
    } else if (world) {
      const kind = this.surfaceKind(world);
      BV.Effects.impact(world.point, world.normal, kind);
      if (primary) BV.Audio.impact(world.point, kind === 'metal' ? 'metal' : 'wall');
    }
    // near-miss: bullets passing close to a bot alert it
    for (const e of this.ents) {
      if (!e.isBot || !e.alive || e.team === c.team || e === hitE) continue;
      const ex = e.pos.x - eye.x, ez = e.pos.z - eye.z, t = ex * dir.x + ez * dir.z;
      if (t > 0 && t < maxT && Math.hypot(ex - dir.x * t, ez - dir.z * t) < 2.5) e.onDamaged(c);
    }
    if (primary && (c.isPlayer ? Math.random() < 0.55 : Math.random() < 0.6)) {
      let start;
      if (c.isPlayer) start = this.engine.playerMuzzle(this.T3).clone();
      else { c.model.flashAnchor.getWorldPosition(this.T3); start = this.T3.clone(); }
      BV.Effects.tracer(start, end, c.isPlayer);
    }
  }

  /* which impact effect a surface produces */
  surfaceKind(hit) {
    const m = hit.box.mat;
    if (m === 'ground') { const x = hit.point.x; return x < -40 ? 'dirt' : 'wall'; }
    if (m === 'metal' || m === 'container' || m === 'car' || m === 'car2' || m === 'barrel' || m === 'roof' || m === 'hazard' || m === 'trim' || m === 'door') return 'metal';
    if (m === 'crate' || m === 'crateMil') return 'wood';
    if (m === 'dirt' || m === 'sandbag') return 'dirt';
    if (m === 'glass' || m === 'window') return 'glass';
    return 'wall';
  }
  melee(c) {
    const def = c.weapon.def; c.nextFire = this.time + def.rate;
    BV.Audio.knife(c.isPlayer ? null : c.pos);
    if (c.isPlayer) this.engine.viewmodel.swing();
    const eye = c.eye(this.T1).clone(), fwd = c.dir(this.T2).clone();
    let best = null, bd = 1e9; const to = new THREE.Vector3();
    for (const e of this.ents) {
      if (!e.alive || e.team === c.team) continue;
      e.chest(to).sub(eye); const d = to.length();
      if (d > def.range + 0.5) continue;
      if (to.dot(fwd) / d < 0.72) continue;
      if (!BV.Physics.los(eye, e.chest(this.T3))) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const hx = best.pos.x - c.pos.x, hz = best.pos.z - c.pos.z, hl = Math.hypot(hx, hz) || 1;
      const bf = { x: -Math.sin(best.yaw), z: -Math.cos(best.yaw) };
      const back = (bf.x * hx + bf.z * hz) / hl > 0.45;
      const p = best.chest(this.T3).clone();
      if (!best.isPlayer) BV.Effects.bloodHit(p, fwd, false); BV.Audio.impact(p, 'flesh');
      this.damage(best, back ? 130 : def.damage, c, def, 'body', fwd);
      if (c.isPlayer) { this.stats.hits++; this.stats.shots++; }
    } else {
      const hit = BV.Physics.raycast(eye, fwd, def.range);
      if (hit) { BV.Effects.impact(hit.point, hit.normal, 'metal'); BV.Audio.impact(hit.point, 'metal'); }
    }
    this.emitNoise(c.pos, 8, c);
    return true;
  }

  throwGrenade(c) {
    const inv = c.inv[4]; if (!inv || inv.count <= 0) return false;
    c.nades[inv.def.id] = (c.nades[inv.def.id] || 1) - 1; c.syncNades(); c.nextFire = this.time + 0.9;
    const eye = c.eye(this.T1), fwd = c.dir(this.T2);
    const mesh = (BV.Real && BV.Real.thrownGrenade && BV.Real.thrownGrenade()) || new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), BV.Models.mat(0x4c5236));
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    const pos = eye.clone().addScaledVector(fwd, 0.5);
    mesh.position.copy(pos); this.scene.add(mesh);
    const vel = fwd.clone().multiplyScalar(14.5).add(new THREE.Vector3(c.vel.x * 0.5, 2.2, c.vel.z * 0.5));
    this.grenades.push({ pos, vel, fuse: inv.def.fuse || 1.7, owner: c, mesh, def: inv.def, bounces: 0 });
    BV.Audio.knife(c.isPlayer ? null : c.pos);
    if (c.isPlayer) this.engine.viewmodel.swing();
    if (!c.hasGrenade()) { const back = c.inv[c.prevSlot] && c.prevSlot !== 4 ? c.prevSlot : c.bestSlot(); setTimeout(() => { if (c.alive && c.slot === 4) this.switchSlot(c, back); }, 350); }
    return true;
  }
  updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt; g.vel.y -= 15 * dt;
      { const sp = Math.min(14, g.vel.length() * 1.4); g.mesh.rotation.x += sp * dt; g.mesh.rotation.z += sp * 0.45 * dt; }   // tumbling in flight
      const step = g.vel.clone().multiplyScalar(dt), len = step.length();
      if (len > 1e-5) {
        const hit = BV.Physics.raycast(g.pos, step.clone().divideScalar(len), len + 0.07);
        if (hit) {
          const n = new THREE.Vector3(hit.normal[0], hit.normal[1], hit.normal[2]);
          g.pos.set(hit.point.x, hit.point.y, hit.point.z).addScaledVector(n, 0.075);
          g.vel.addScaledVector(n, -2 * g.vel.dot(n)).multiplyScalar(0.42);
          if (g.vel.length() > 1.2) BV.Audio.bounce(g.pos);
        } else g.pos.add(step);
      }
      g.mesh.position.copy(g.pos); g.mesh.rotation.x += dt * 8; g.mesh.rotation.z += dt * 5;
      if (g.fuse <= 0) {
        if (g.def.kind === 'smoke') this.spawnSmoke(g.pos.clone(), g.def.radius);
        else if (g.def.kind === 'flash') this.flashBang(g.pos.clone(), g.def.radius, g.owner);
        else this.explode(g.pos, g.def.radius, g.def.damage, g.owner, g.def, true);
        this.scene.remove(g.mesh); this.grenades.splice(i, 1);
      }
    }
  }
  /* smoke screen: a cloud of soft sprites that blocks the bots' line of sight for ~15 s */
  spawnSmoke(pos, radius) {
    if (!this._smokeTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      this._smokeTex = new THREE.CanvasTexture(c); }
    const group = new THREE.Group(), sprites = [];
    for (let i = 0; i < 30; i++) {
      const m = new THREE.SpriteMaterial({ map: this._smokeTex, color: new THREE.Color().setHSL(0.1, 0.04, 0.62 + Math.random() * 0.12), transparent: true, opacity: 0, depthWrite: false, fog: true });
      const s = new THREE.Sprite(m), a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius * 0.7;
      s.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.4 + Math.random() * 2.4, sz: 2.6 + Math.random() * 2.2, spin: (Math.random() - 0.5) * 0.3 };
      group.add(s); sprites.push(s);
    }
    group.position.set(pos.x, Math.max(0, pos.y - 0.1), pos.z); this.scene.add(group);
    this.smokes.push({ pos: new THREE.Vector3(pos.x, pos.y + 1.3, pos.z), r: radius, t: 0, life: 15, group, sprites });
    BV.Audio.smoke && BV.Audio.smoke(pos); this.emitNoise(pos, 25, null);
  }
  updateSmokes(dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt;
      const grow = Math.min(1, s.t / 1.6), fade = s.t > s.life - 2 ? Math.max(0, (s.life - s.t) / 2) : 1;
      for (const sp of s.sprites) { const u = sp.userData; sp.position.set(u.x * (0.4 + 0.6 * grow), u.y * (0.5 + 0.5 * grow), u.z * (0.4 + 0.6 * grow));
        sp.scale.setScalar(u.sz * (0.35 + 0.65 * grow)); sp.material.opacity = 0.78 * grow * fade; sp.material.rotation += u.spin * dt; }
      if (s.t >= s.life) { this.scene.remove(s.group); s.sprites.forEach(sp => sp.material.dispose()); this.smokes.splice(i, 1); }
    }
  }
  smokeBlocks(a, b) {   // does any active smoke cloud sit across the segment a-b?
    for (const s of this.smokes) {
      if (s.t < 0.9 || s.t > s.life - 1.2) continue;
      const r = s.r * Math.min(1, s.t / 1.6) * 0.88, ax = b.x - a.x, ay = b.y - a.y, az = b.z - a.z, L = ax * ax + ay * ay + az * az || 1;
      const t = Math.max(0, Math.min(1, ((s.pos.x - a.x) * ax + (s.pos.y - a.y) * ay + (s.pos.z - a.z) * az) / L));
      const dx = a.x + ax * t - s.pos.x, dy = (a.y + ay * t - s.pos.y) * 1.4, dz = a.z + az * t - s.pos.z;
      if (dx * dx + dy * dy + dz * dz < r * r) return true;
    }
    return false;
  }
  /* flashbang: blinds whoever sees it, more when close and looking at it */
  flashBang(pos, radius, owner) {
    BV.Audio.flashbang && BV.Audio.flashbang(pos); this.engine.flashLight(new THREE.Vector3(pos.x, pos.y + 0.6, pos.z), 22);
    const src = new THREE.Vector3(pos.x, pos.y + 0.25, pos.z);
    for (const e of this.ents) {
      if (!e.alive) continue;
      const eye = e.eye(this.T3), d = eye.distanceTo(src); if (d > radius) continue;
      if (!BV.Physics.los(src, eye)) continue;
      const facing = e.dir(this.T4).dot(src.clone().sub(eye).normalize());
      const f = facing > 0.5 ? 1 : facing > -0.1 ? 0.6 : 0.22, amt = Math.min(1, (1 - d / radius) * 1.5) * f;
      if (amt < 0.05) continue;
      const dur = 0.4 + 4.2 * amt;
      if (e.isPlayer) { BV.HUD.flashed && BV.HUD.flashed(amt, dur); BV.Audio.ringing && BV.Audio.ringing(dur * 0.8, amt); }
      else { e.blindUntil = this.time + dur * 0.9; e.target = null; }
    }
    this.emitNoise(pos, 40, owner);
  }
  explode(pos, radius, damage, owner, def, needLos) {
    BV.Effects.explosion(pos); BV.Audio.explosion(pos); this.engine.flashLight(new THREE.Vector3(pos.x, pos.y + 1.5, pos.z), 12);
    const p = this.player, d = p ? p.pos.distanceTo(pos) : 99;
    BV.Effects.addShake(BV.U.clamp(0.35 - d / 80, 0.02, 0.35), 0.6);
    if (d < radius * 2.2) BV.Effects.flashScreen(0.35);
    const top = new THREE.Vector3(pos.x, pos.y + 0.35, pos.z);
    for (const e of this.ents) {
      if (!e.alive) continue;
      if (owner && e.team === owner.team && e !== owner) continue; // no team damage
      const c = e.chest(this.T3), dist = c.distanceTo(top);
      if (dist > radius) continue;
      if (needLos && !BV.Physics.los(top, c)) continue;
      const k = 1 - dist / radius;
      this.damage(e, damage * k * (needLos ? 1 : k + 0.2), owner, def, 'blast', c.clone().sub(top).normalize());
    }
    this.emitNoise(pos, 70, owner);
  }

  /* ----------------------------- damage ----------------------------- */
  damage(t, amount, attacker, def, part, dir) {
    if (!t.alive || this.phase === 'over') return;
    let dmg = amount;
    if (t.armor > 0 && part !== 'legs') {
      const pen = def && def.armorPen !== undefined ? def.armorPen : 0.6;
      const absorbed = dmg * (1 - pen);
      t.armor = Math.max(0, t.armor - absorbed * 0.8);
      dmg -= absorbed;
    }
    dmg = Math.max(1, Math.round(dmg));
    t.hp -= dmg; t.lastAttacker = attacker; t.lastHitTime = this.time;
    if (t.model && t.model.flinch && t.hp > 0) t.model.flinch();
    if (t.isBot) t.onDamaged(attacker);
    if (t.isPlayer) {
      BV.Audio.hurt(); BV.Effects.flashScreen(0.25 + Math.min(0.4, dmg / 120));
      t.pitch += 0.012 + dmg * 0.0004; // aim punch
      if (attacker && attacker !== t) BV.HUD.damageFrom(Math.atan2(-(attacker.pos.x - t.pos.x), -(attacker.pos.z - t.pos.z)) - t.yaw);
    }
    const head = part === 'head';
    if (attacker && attacker.isPlayer && attacker !== t) { BV.HUD.hitmarker(head, t.hp <= 0); BV.Audio.hitmarker(head); }
    if (this.training && t.isPlayer) t.hp = Math.max(t.hp, 1);
    if (t.hp <= 0) {
      if (head && attacker && attacker.isPlayer && attacker !== t) { BV.Audio.headshot ? BV.Audio.headshot() : BV.Audio.hitmarker(true); }   // sound only, no on-screen pop-up
      this.kill(t, attacker, def, head);
    }
  }
  kill(t, attacker, def, head) {
    t.helmet = false; t.hasKit = false; t.nades = {}; t.inv[4] = null;
    t.alive = false; t.hp = 0; t.deaths++; t.deathT = 0; t.planting = t.defusing = false;
    this.cancelObjective(t);
    if (attacker && attacker !== t) {
      attacker.kills++; attacker.score += 2;
      if (!this.training) attacker.money = Math.min(BV.RULES.maxMoney, attacker.money + (def.reward || 300));
      if (attacker.isPlayer) this.stats.kills++;
    } else { t.score -= 1; }
    BV.HUD.killfeed(attacker, t, def, head);
    BV.Audio.death(t.isPlayer ? null : t.pos);
    if (t.hasCharge) this.dropCharge(t);
    this.dropWeaponOf(t, true);
    if (t.tag) t.tag.visible = false;
    if (t.isPlayer) {
      this.engine.onPlayerDeath(attacker, def, head);
      this.spectate = { t: 2.2, target: null };
    }
    if (this.training && t.isBot) {
      setTimeout(() => {
        if (!this.training || !this.ents.includes(t)) return;
        const nodes = this.map.data.nodes.filter(n => n.x > -20 && n.x < 30 && Math.abs(n.z) < 12);
        const n = BV.U.pick(nodes); t.pos.set(n.x, n.y, n.z); t.hp = 100; t.alive = true; t.model.reset(); t.armor = 0; t.goal = null; t.path = [];
      }, 2500);
    }
  }

  /* ------------------------- dropped weapons (CS-style) ------------------------- */
  // on death a soldier leaves his primary (or a non-default pistol) on the floor with the ammo it had;
  // walking over it with that slot empty picks it up, E swaps it for yours, G drops the weapon in hand
  spawnDrop(inst, pos, dropper) {
    const def = inst.def, gm = BV.Models.gun(def.model); if (!gm) return null;
    const mesh = new THREE.Group(); mesh.add(gm.group);
    gm.group.rotation.set(0, 0, Math.PI / 2);                 // lying on its side
    mesh.position.set(pos.x, (pos.y || 0) + 0.035, pos.z); mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(mesh);
    const d = { inst, mesh, pos: mesh.position, dropper, cool: dropper ? 1.0 : 0 };
    this.drops.push(d);
    while (this.drops.length > 14) this.removeDrop(this.drops[0]);   // keep the floor (and the frame) light
    return d;
  }
  removeDrop(d) { this.scene.remove(d.mesh); const i = this.drops.indexOf(d); if (i >= 0) this.drops.splice(i, 1); }
  clearDrops() { for (const d of this.drops.slice()) this.removeDrop(d); this.drops = []; }
  dropWeaponOf(e, onDeath) {
    const slot = e.inv[1] ? 1 : (e.inv[2] && e.inv[2].def.id !== 'viper9' ? 2 : 0);
    if (!slot) return;
    const inst = e.inv[slot];
    if (inst.mag <= 0 && inst.reserve <= 0) { e.inv[slot] = null; return; }   // empty guns are not worth dropping
    e.inv[slot] = null;
    const fwd = onDeath ? null : e.dir(new THREE.Vector3());
    const at = fwd ? new THREE.Vector3(e.pos.x + fwd.x * 0.9, e.pos.y, e.pos.z + fwd.z * 0.9) : e.pos;
    this.spawnDrop(inst, at, onDeath ? null : e);
  }
  // G: drop the weapon in hand (primary or pistol), then switch to the best remaining one
  dropActive(p) {
    const slot = p.slot;
    if (slot === 5 && p.hasCharge) { this.dropCharge(p); return; }
    if (slot !== 1 && slot !== 2) return;
    const inst = p.inv[slot]; if (!inst || p.reloading) return;
    p.inv[slot] = null;
    const fwd = p.dir(new THREE.Vector3());
    this.spawnDrop(inst, new THREE.Vector3(p.pos.x + fwd.x * 0.9, p.pos.y, p.pos.z + fwd.z * 0.9), p);
    this.switchSlot(p, p.inv[1] ? 1 : p.inv[2] ? 2 : 3, true);
    if (p.isPlayer) BV.Audio.zoom && BV.Audio.zoom();
  }
  takeDrop(e, d, swap) {
    const slot = d.inst.def.slot;
    if (swap && e.inv[slot]) { const mine = e.inv[slot]; e.inv[slot] = null; this.spawnDrop(mine, e.pos, e); }
    e.inv[slot] = d.inst; this.removeDrop(d);
    if (e.isPlayer) {
      BV.HUD.notice('Picked up ' + d.inst.def.name, 'good', 1.6);
      if (swap || slot === 1 && e.slot !== 1) this.switchSlot(e, slot, true);
      else if (slot === e.slot) this.switchSlot(e, slot, true);
    } else if (slot === 1) this.switchSlot(e, 1, true);
  }
  // E pressed: swap with the closest weapon at your feet (only when one is there)
  tryPickupSwap(p) {
    let best = null, bd = 1.5;
    for (const d of this.drops) { const dd = Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z); if (dd < bd && d.cool <= 0) { bd = dd; best = d; } }
    if (!best) return false;
    this.takeDrop(p, best, true); return true;
  }
  updateDrops(dt) {
    if (!this.drops.length) return;
    this.dropHintT -= dt;
    for (const d of this.drops.slice()) {
      if (d.cool > 0) d.cool -= dt;
      for (const e of this.ents) {
        if (!e.alive) continue;
        const dd = Math.hypot(d.pos.x - e.pos.x, d.pos.z - e.pos.z);
        if (dd > 1.1 || Math.abs(d.pos.y - e.pos.y) > 1.2) continue;
        if (d.cool > 0 && d.dropper === e) continue;
        const slot = d.inst.def.slot;
        if (!e.inv[slot]) { this.takeDrop(e, d, false); break; }                       // empty slot: walk over it
        if (e.isPlayer && this.dropHintT <= 0) { BV.HUD.notice('Press E to swap for ' + d.inst.def.name, '', 1.4); this.dropHintT = 1.6; }
      }
    }
  }

  /* ----------------------------- objective ----------------------------- */
  dropCharge(c) {
    c.hasCharge = false;
    this.charge.state = 'dropped'; this.charge.carrier = null;
    this.charge.pos.set(c.pos.x, c.pos.y, c.pos.z);
    this.upgradeChargeModel();
    this.chargeMesh.position.copy(this.charge.pos); this.chargeMesh.visible = true; this.chargeMesh.rotation.y = Math.random() * 6;
    if (this.setChargeDisplay) this.setChargeDisplay('--:--', false); if (this.chargeLed) this.chargeLed.material.emissiveIntensity = 0.35;
    this.chargeLight.visible = false;
    this.pickFetcher();
    if (this.player && this.player.team === this.attackTeam) BV.HUD.notice('The charge has been dropped', 'warn');
  }
  pickFetcher() {
    let best = null, bd = 1e9;
    for (const e of this.ents) if (e.isBot && e.alive && e.team === this.attackTeam) { const d = e.pos.distanceTo(this.charge.pos); if (d < bd) { bd = d; best = e; } }
    this.chargeFetcher = best;
  }
  beginPlant(c) {
    if (this.phase !== 'live' || !c.hasCharge || !c.alive || !(c.onGround || this.time - (c._groundT || -9) < 0.35)) return false;
    if (!this.map.siteAt(c.pos.x, c.pos.z)) return false;
    if (this.planter !== c) { this.planter = c; this.plantProgress = 0; c.planting = true; c.reloading = false; c.zoom = 0; }
    return true;
  }
  beginDefuse(c) {
    if (this.phase !== 'planted' || !c.alive || c.team === this.attackTeam) return false;
    if (c.pos.distanceTo(this.charge.pos) > 1.6) return false;
    if (this.defuser && this.defuser !== c) return false;
    if (this.defuser !== c) { this.defuser = c; this.defuseProgress = 0; c.defusing = true; c.reloading = false; c.zoom = 0; }
    return true;
  }
  cancelObjective(c) {
    if (this.planter === c) { this.planter = null; this.plantProgress = 0; c.planting = false; }
    if (this.defuser === c) { this.defuser = null; this.defuseProgress = 0; c.defusing = false; }
  }
  updateObjective(dt) {
    // the charge lives in slot 5 while carried (selectable like a weapon)
    for (const e of this.ents) {
      if (!e.alive) continue;
      if (e.hasCharge && !e.inv[5]) e.inv[5] = new BV.WeaponInstance('charge');
      else if (!e.hasCharge && e.inv[5]) { e.inv[5] = null; if (e.slot === 5) { e.planting = false; this.switchSlot(e, e.bestSlot(), true); } }
      if (e.onGround) e._groundT = this.time;
    }
    const R = BV.RULES, ch = this.charge;
    if (this.planter) {
      const p = this.planter;
      const keep = p.alive && p.hasCharge && this.phase === 'live' && (p.isBot || this.playerUse) && Math.hypot(p.vel.x, p.vel.z) < 1.2;
      if (!keep) this.cancelObjective(p);
      else {
        const before = Math.floor(this.plantProgress * 8);
        this.plantProgress += dt / R.plantTime;
        if (Math.floor(this.plantProgress * 8) > before && p.pos.distanceTo(this.player.pos) < 30) BV.Audio.keypad();
        if (this.plantProgress >= 1) this.plant(p);
      }
    }
    if (this.defuser) {
      const d = this.defuser;
      const keep = d.alive && this.phase === 'planted' && (d.isBot || this.playerUse) && d.pos.distanceTo(ch.pos) < 1.8;
      if (!keep) this.cancelObjective(d);
      else {
        this.defuseProgress += dt / (R.defuseTime * (this.defuser && this.defuser.hasKit ? 0.54 : 1));   // kit: 3.5 s
        if (this.defuseProgress >= 1) { BV.Audio.defused(); this.defuser.score += 2; this.defuser.defusing = false; this.endRound(this.defendTeam(), 'defused'); }
      }
    }
    this.updateDrops(dt);
    if (ch.state === 'dropped') {
      if (this.frame % 30 === 0) this.pickFetcher();
      for (const e of this.ents) {
        if (e.alive && e.team === this.attackTeam && e.pos.distanceTo(ch.pos) < 1.2) {
          e.hasCharge = true; ch.state = 'carried'; ch.carrier = e; this.chargeMesh.visible = false; this.chargeFetcher = null;
          if (e.isPlayer) BV.HUD.notice('You picked up the charge', 'good');
          break;
        }
      }
    }
    if (this.phase === 'planted') {
      this.chargeT -= dt; this.beepT -= dt;
      const k = Math.max(0, this.chargeT / R.chargeTime);
      if (this.beepT <= 0) {
        this.beepT = 0.12 + 0.9 * k;
        BV.Audio.beep(ch.pos, k < 0.25); this.chargeLight.visible = true;
        this._lightOff = this.time + 0.08;
      }
      if (this.time > this._lightOff) this.chargeLight.visible = false;
      // live countdown on the LCD and the LED pulsing with each beep
      { const t = Math.max(0, this.chargeT), mm = Math.floor(t / 60), ss = Math.floor(t % 60), cs = Math.floor((t % 1) * 10);
        if (this.setChargeDisplay) this.setChargeDisplay(t < 10 ? `0${Math.floor(t)}.${cs}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, true);
        if (this.chargeLed) this.chargeLed.material.emissiveIntensity = this.chargeLight.visible ? 3.2 : 0.35; }
      if (this.chargeT <= 0) {
        ch.state = 'exploded'; this.chargeMesh.visible = false;
        this.explode(ch.pos, 26, 520, null, { name: 'Vector Charge', armorPen: 0.85, reward: 0 }, false);
        this.endRound(this.attackTeam, 'exploded');
      }
    }
  }
  plant(p) {
    const ch = this.charge, R = BV.RULES;
    p.hasCharge = false; p.planting = false; this.planter = null; this.plantProgress = 0;
    ch.state = 'planted'; ch.carrier = null; ch.pos.set(p.pos.x, p.pos.y, p.pos.z); ch.site = this.map.siteAt(p.pos.x, p.pos.z) || this.map.nearestSite(p.pos.x, p.pos.z).site;
    this.chargeMesh.position.copy(ch.pos); this.chargeMesh.rotation.y = p.yaw; this.chargeMesh.visible = true;
    this.upgradeChargeModel();
    this.phase = 'planted'; this.chargeT = R.chargeTime; this.beepT = 0; this._lightOff = 0;
    if (this.setChargeDisplay) this.setChargeDisplay('ARMED', true);
    p.money = Math.min(R.maxMoney, p.money + 300); p.score += 2;
    BV.Audio.chargeArmed();
    BV.HUD.notice('Vector Charge armed at Site ' + ch.site.name, 'alert', 3);
    for (const e of this.ents) if (e.isBot && e.team !== this.attackTeam) { e.spot = null; e.heard = { pos: ch.pos.clone(), time: this.time }; }
  }

  /* ----------------------------- awareness ----------------------------- */
  emitNoise(pos, radius, src) {
    for (const e of this.ents) {
      if (!e.isBot || !e.alive || (src && e.team === src.team)) continue;
      const d = e.pos.distanceTo(pos);
      if (d < radius * this.diff.hearing) e.hear(pos, 'noise');
    }
  }
  spot(e, byTeam) {
    if (!e.spottedBy) e.spottedBy = {};
    e.spottedBy[byTeam] = this.time + 2.5;
    // relay where the enemy was seen to the rest of the team
    const ns = this.map.nearestSite(e.pos.x, e.pos.z);
    if (ns.dist < 24 && byTeam !== this.attackTeam) {
      const prev = this.intel[byTeam];
      if (!prev || prev.site !== ns.site || this.time - prev.time > 8) {
        this.intel[byTeam] = { site: ns.site, time: this.time };
        for (const b of this.ents) {
          if (!b.isBot || !b.alive || b.team !== byTeam || b.role === ns.site.name || b.visible) continue;
          if (b.role === 'mid' || Math.random() < 0.55) { b.role = ns.site.name; b.spot = null; }
        }
      }
    }
  }
  applyCrouch(c, dt) {
    let target = c.wantCrouch ? 1 : 0;
    if (target < c.crouch && !BV.Physics.headroom(c, 1.8)) target = c.crouch;
    c.crouch = BV.U.clamp(c.crouch + Math.sign(target - c.crouch) * dt * 7, 0, 1);
    if (Math.abs(target - c.crouch) < 0.02) c.crouch = target;
    c.height = 1.8 - 0.55 * c.crouch;
  }

  /* ----------------------------- round end ----------------------------- */
  endRound(winner, reason) {
    if (this.phase === 'end' || this.phase === 'over') return;
    const R = BV.RULES, loser = BV.otherTeam(winner);
    this.phase = 'end'; this.phaseT = R.endTime;
    this.score[winner]++;
    this.lossStreak[winner] = 0; this.lossStreak[loser] = Math.min(4, this.lossStreak[loser] + 1);
    for (const e of this.ents) {
      let add = e.team === winner ? R.winReward : R.lossBase + R.lossStep * (this.lossStreak[loser] - 1);
      if (e.team !== winner && e.team === this.attackTeam && (reason === 'defused' || this.charge.state === 'planted')) add += R.plantBonus;
      e.money = Math.min(R.maxMoney, e.money + add);
      if (e.planting || e.defusing) this.cancelObjective(e);
    }
    const matchOver = this.score[winner] >= this.roundsToWin;
    if (!matchOver && !this.halftimeDone && this.round === this.roundsToWin - 1) this.halftimePending = true;
    this.lastResult = { winner, reason, matchOver };
    BV.HUD.roundEnd(this, winner, reason, matchOver, this.halftimePending);
    BV.Audio.roundStinger(this.player && winner === this.player.team);
  }
  nextRound() {
    if (this.lastResult && this.lastResult.matchOver) {
      this.phase = 'over';
      this.engine.onMatchOver(this.lastResult.winner);
      return;
    }
    if (this.halftimePending) {
      this.halftimePending = false; this.halftimeDone = true;
      this.attackTeam = BV.otherTeam(this.attackTeam);
      for (const e of this.ents) { e.money = BV.RULES.startMoney; e.stripGear = true; }
      BV.HUD.notice('Halftime — sides switched. You are now ' + (this.isAttacker(this.player) ? 'attacking' : 'defending'), 'alert', 4);
    }
    this.startRound();
  }

  aliveCount(team) { let n = 0; for (const e of this.ents) if (e.alive && e.team === team) n++; return n; }

  checkWin() {
    if (this.training) return;
    const atk = this.attackTeam, def = this.defendTeam();
    const a = this.aliveCount(atk), d = this.aliveCount(def);
    if (this.phase === 'live') {
      if (a === 0) this.endRound(def, 'eliminated');
      else if (d === 0) this.endRound(atk, 'eliminated');
      else if (this.timer <= 0) this.endRound(def, 'time');
    } else if (this.phase === 'planted') {
      if (d === 0) this.endRound(atk, 'eliminated');
    }
  }

  /* ----------------------------- main tick ----------------------------- */
  update(dt) {
    this.time += dt; this.frame++;
    const R = BV.RULES;
    if (this.phase === 'freeze') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) { this.phase = 'live'; this.timer = R.roundTime; if (!this.training) BV.HUD.notice('Go! Go! Go!', 'good', 1.5); }
    } else if (this.phase === 'live') {
      if (!this.training) this.timer -= dt;
    } else if (this.phase === 'end') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.nextRound();
    }
    for (const e of this.ents) {
      if (e.isBot) e.update(dt);
      if (e.alive) this.updateWeapon(e, dt);
      if (e.isBot && e.alive) this.movementFx(e, dt);
    }
    this.updateObjective(dt);
    this.updateGrenades(dt); this.updateSmokes(dt);
    if (this.phase === 'live' || this.phase === 'planted') this.checkWin();
    // player spotting (for the radar), staggered
    if (this.lightStep) return;                  // extra physics sub-step: no spotting / model sync
    if (this.player && this.player.alive && this.frame % 6 === 0) {
      const eye = this.player.eye(this.T1).clone();
      for (const e of this.ents) {
        if (!e.alive || e.team === this.player.team) continue;
        const d = e.pos.distanceTo(this.player.pos); if (d > 90) continue;
        const to = e.chest(this.T2).clone().sub(eye).normalize();
        if (to.dot(this.player.dir(this.T3)) < 0.55) continue;
        if (BV.Physics.los(eye, e.chest(this.T2))) this.spot(e, this.player.team);
      }
    }
    this.syncModels(dt);
  }
  movementFx(e, dt) {
    const sp = Math.hypot(e.vel.x, e.vel.z);
    if (e.onGround && sp > 2.7 && e.crouch < 0.5) {
      e.stepDist += sp * dt;
      if (e.stepDist > (e.sprint ? 2.6 : 2.2)) {
        e.stepDist = 0;
        BV.Audio.step(e.isPlayer ? null : e.pos, e.sprint);
        this.emitNoise(e.pos, e.sprint ? 24 : 15, e);
      }
    }
    if (e.landSpeed > 6.5) { BV.Audio.land(e.isPlayer ? null : e.pos); this.emitNoise(e.pos, 14, e); }
  }
  syncModels(dt) {
    for (const e of this.ents) {
      const m = e.model; if (!m) continue;
      m.root.position.copy(e.pos); m.root.rotation.y = e.yaw;
      if (this.frame % 10 === e.id % 10) {
        if (BV.classic) { // models pick up the baked lighting of the spot they stand on (GoldSrc style)
          const ind = this.map.isIndoor(e.pos.x, e.pos.y + 1, e.pos.z);
          m.setShade(ind ? 0.5 : (this.map.data.sunVisible(e.pos.x, e.pos.y + 1.2, e.pos.z) ? 1 : 0.6));
        } else m.setShade(this.map.isIndoor(e.pos.x, e.pos.y + 1, e.pos.z) ? 0.55 : 1);
      }
      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (e.alive) {
        e.walkPhase += sp * dt * 2.1;
        m.state = m.state || {}; m.state.kneel = (this.planter === e && this.phase === 'live') || this.defuser === e; m.state.sprint = e.sprint && sp > 4; m.state.reloading = e.reloading; m.state.back = sp > 0.5 && (-Math.sin(e.yaw) * e.vel.x - Math.cos(e.yaw) * e.vel.z) < -0.4 * sp;
        m.animate(dt, sp, e.crouch, e.pitch, e.walkPhase, this.time - e.lastShot < 0.08);
        if (m.silObj) m.silObj.visible = !!(e.weapon && e.weapon.def.silencer && e.weapon.silenced !== false);
        m.root.visible = !e.isPlayer || (this.engine.thirdPerson === true);
      } else {
        e.deathT += dt; m.die(e.deathT / 0.6); m.root.visible = true;
      }
      if (e.tag) { e.tag.visible = e.alive; e.tag.position.set(e.pos.x, e.pos.y + e.height + 0.35, e.pos.z); }
    }
  }
};
BV.UP = new THREE.Vector3(0, 1, 0);
