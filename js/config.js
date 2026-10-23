/* =====================================================================
   BLACKSITE: VECTOR — config.js
   Static game data: teams, arsenal, difficulty profiles, economy and
   persistent user settings. Everything here is original data.
   ===================================================================== */
'use strict';
window.BV = window.BV || {};

BV.VERSION = '3.7.1';

/* Colour management: Three.js r128 treats hex colours as linear. The game is
   authored in sRGB and renders with sRGB output + ACES tone mapping, so every
   hex colour is converted to linear once, at creation. */
(function () {
  const setHex = THREE.Color.prototype.setHex;
  THREE.Color.prototype.setHex = function (h) { setHex.call(this, h); return this.convertSRGBToLinear(); };
})();

/* ---------- Teams -------------------------------------------------- */
BV.TEAMS = {
  VANGUARD: {
    id: 'VANGUARD', name: 'VANGUARD', css: '#78acd4', color: 0x78acd4,
    motto: 'Hold the line',
    uniform: 0x2e4677, uniformDark: 0x1f3157, vest: 0x26324a,          // police blue
    accent: 0xe0b43c, skin: 0xc79d7d, helmet: 0x3e4b52
  },
  RAVEN: {
    id: 'RAVEN', name: 'RAVEN', css: '#dd5a3f', color: 0xdd5a3f,
    motto: 'No flag, no trace',
    uniform: 0x37332e, uniformDark: 0x24221f, vest: 0x2c2d2b,
    accent: 0x7e2f22, skin: 0x9d7b60, helmet: 0x1e1e1e
  }
};
BV.otherTeam = (t) => (t === 'VANGUARD' ? 'RAVEN' : 'VANGUARD');

/* ---------- Arsenal ----------------------------------------------------
   damage: per bullet; head: headshot multiplier; armorPen: share of the
   damage that goes through armour; rate: seconds between shots;
   spread values are cone radii in radians; kick: vertical recoil per shot;
   drop: damage multiplier per 10 m; snd: procedural sound recipe.     */
BV.WEAPONS = {
  bladex:   { id: 'bladex', name: 'Blade-X', slot: 3, cls: 'melee', damage: 50, rate: 0.5, range: 2.1,
              price: 0, speed: 1.08, model: 'knife', reward: 1500 },

  viper9:   { id: 'viper9', name: 'Viper-9', slot: 2, cls: 'pistol', auto: false, damage: 26, head: 3.8, armorPen: 0.55,
              rate: 0.15, mag: 15, reserve: 60, reload: 2.1, spread: 0.006, moveSpread: 0.028, airSpread: 0.12,
              shotSpread: 0.012, kick: 0.010, drop: 0.93, price: 200, speed: 1.0, model: 'pistol',
              snd: { f: 2400, l: 0.16, t: 150, v: 0.8 }, reward: 300 },
  falcon45: { id: 'falcon45', name: 'Falcon .45', slot: 2, cls: 'pistol', auto: false, damage: 44, head: 3.2, armorPen: 0.7,
              rate: 0.30, mag: 8, reserve: 32, reload: 2.3, spread: 0.009, moveSpread: 0.04, airSpread: 0.15,
              shotSpread: 0.03, kick: 0.028, drop: 0.9, price: 650, speed: 0.98, model: 'pistolHeavy',
              snd: { f: 1500, l: 0.24, t: 110, v: 1.0 }, reward: 300 },

  specter9: { id: 'specter9', name: 'Specter-9', slot: 1, cls: 'smg', auto: true, damage: 23, head: 3.5, armorPen: 0.6,
              rate: 0.078, mag: 32, reserve: 128, reload: 2.4, spread: 0.012, moveSpread: 0.02, airSpread: 0.12,
              shotSpread: 0.0045, kick: 0.0065, drop: 0.9, price: 1300, speed: 0.98, model: 'smg',
              snd: { f: 2800, l: 0.12, t: 170, v: 0.7 }, reward: 600 },
  vectormp: { id: 'vectormp', name: 'Vector-MP', slot: 1, cls: 'smg', auto: true, damage: 20, head: 3.5, armorPen: 0.6,
              rate: 0.062, mag: 30, reserve: 120, reload: 2.2, spread: 0.014, moveSpread: 0.018, airSpread: 0.12,
              shotSpread: 0.005, kick: 0.0055, drop: 0.88, price: 1550, speed: 1.0, model: 'smgCompact',
              snd: { f: 3200, l: 0.10, t: 190, v: 0.65 }, reward: 600 },

  hammer12: { id: 'hammer12', name: 'Hammer-12', slot: 1, cls: 'shotgun', auto: false, damage: 15, pellets: 9, head: 2.0,
              armorPen: 0.5, rate: 0.9, mag: 7, reserve: 28, reload: 3.2, spread: 0.055, moveSpread: 0.02, airSpread: 0.08,
              shotSpread: 0, kick: 0.05, drop: 0.6, price: 1900, speed: 0.92, model: 'shotgun',
              snd: { f: 900, l: 0.35, t: 80, v: 1.2 }, reward: 900 },

  arx17:    { id: 'arx17', name: 'ARX-17', slot: 1, cls: 'rifle', auto: true, damage: 35, head: 4.0, armorPen: 0.78,
              rate: 0.10, mag: 30, reserve: 90, reload: 2.5, spread: 0.0035, moveSpread: 0.05, airSpread: 0.2,
              shotSpread: 0.0065, kick: 0.0115, drop: 0.97, price: 2700, speed: 0.9, model: 'rifle',
              snd: { f: 1700, l: 0.22, t: 120, v: 1.0 }, reward: 300 },
  halberd4: { id: 'halberd4', name: 'Halberd-4', slot: 1, cls: 'rifle', auto: true, damage: 31, head: 4.0, armorPen: 0.72,
              rate: 0.09, mag: 30, reserve: 90, reload: 2.3, spread: 0.0028, moveSpread: 0.042, airSpread: 0.18,
              shotSpread: 0.005, kick: 0.0095, drop: 0.97, price: 3000, speed: 0.92, model: 'rifleCarbine',
              snd: { f: 2000, l: 0.20, t: 130, v: 0.95 }, reward: 300 },
  kestrel5: { id: 'kestrel5', name: 'Kestrel-5', slot: 1, cls: 'dmr', auto: false, damage: 52, head: 3.6, armorPen: 0.82,
              rate: 0.22, mag: 20, reserve: 60, reload: 2.8, spread: 0.0018, scopedSpread: 0.0009, moveSpread: 0.06,
              airSpread: 0.2, shotSpread: 0.012, kick: 0.02, drop: 0.985, price: 3400, speed: 0.88, model: 'dmr', zoom: 2,
              snd: { f: 1400, l: 0.30, t: 100, v: 1.1 }, reward: 300 },

  lynx7:    { id: 'lynx7', name: 'Lynx-7', slot: 1, cls: 'sniper', auto: false, damage: 118, head: 2.5, armorPen: 0.97,
              rate: 1.45, mag: 5, reserve: 20, reload: 3.6, spread: 0.07, scopedSpread: 0.0008, moveSpread: 0.12,
              airSpread: 0.3, shotSpread: 0, kick: 0.06, drop: 0.99, price: 4750, speed: 0.8, model: 'sniper', zoom: 4,
              snd: { f: 1100, l: 0.50, t: 70, v: 1.4 }, reward: 150 },

  shard:    { id: 'shard', name: 'Shard-G', slot: 4, cls: 'grenade', damage: 98, radius: 6.5, rate: 1.0,
              price: 300, speed: 1.0, model: 'grenade', reward: 300 }
};

/* Buy menu layout (category -> items). 'armor' is special. */
BV.SHOP = [
  { name: 'Pistols',   items: ['viper9', 'falcon45'] },
  { name: 'SMGs',      items: ['specter9', 'vectormp'] },
  { name: 'Shotgun',   items: ['hammer12'] },
  { name: 'Rifles',    items: ['arx17', 'halberd4', 'kestrel5'] },
  { name: 'Precision', items: ['lynx7'] },
  { name: 'Gear',      items: ['armor', 'shard'] }
];
BV.ARMOR_PRICE = 650;

/* ---------- Bot difficulty profiles -------------------------------- */
BV.DIFFICULTY = {
  EASY:   { reaction: 0.80, aimError: 0.075, turn: 3.2, head: 0.08, view: 42, fov: 1.6, burst: [2, 4], strafe: 0.3,  hearing: 0.6 },
  NORMAL: { reaction: 0.45, aimError: 0.040, turn: 6.0, head: 0.22, view: 60, fov: 2.0, burst: [3, 6], strafe: 0.6,  hearing: 1.0 },
  HARD:   { reaction: 0.24, aimError: 0.018, turn: 11,  head: 0.42, view: 85, fov: 2.3, burst: [4, 9], strafe: 0.85, hearing: 1.3 }
};

/* ---------- Rules & economy ---------------------------------------- */
BV.RULES = {
  freezeTime: 5, roundTime: 115, buyTime: 20, chargeTime: 40, plantTime: 3.2, defuseTime: 6.5,
  endTime: 5.5, startMoney: 800, maxMoney: 16000, winReward: 3250, lossBase: 1400, lossStep: 500,
  plantBonus: 800
};

/* ---------- Settings (persisted) ----------------------------------- */
BV.DEFAULT_SETTINGS = {
  style: 'modern',        // modern (PBR, default since v3.0) | classic (GoldSrc-era)
  quality: 'medium',      // low | medium | high | ultra
  fov: 74,
  retroFilter: false,     // nearest-neighbour texture sampling
  showFps: false,
  effects: true,
  viewBob: true,
  master: 0.8, sfx: 0.9, music: 0.5,
  sensitivity: 1.0,
  invertY: false
};
BV.settings = (function () {
  const s = Object.assign({}, BV.DEFAULT_SETTINGS);
  try {
    const raw = window.localStorage && localStorage.getItem('blacksite-vector-settings');
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch (e) { /* storage unavailable (file:// in some browsers) */ }
  // v2.1: default field of view is now 74° vertical (= 90° horizontal at 4:3, the period standard)
  if (!s.fovV21) { if (s.fov === 85) s.fov = 74; s.fovV21 = true; }
  // v3.0: realistic assets -> Modern renderer by default (Classic stays available in Settings)
  if (!s.v30) { s.style = 'modern'; s.v30 = true; }
  // v3.4: lighter defaults (realistic assets are heavy on integrated GPUs); adaptive quality on
  if (!s.v34) { if (s.quality === 'high' || s.quality === 'ultra') s.quality = 'medium'; s.autoQuality = true; s.v34 = true; }
  return s;
})();
/* ---------- visual style ----------
   'classic' (default): GoldSrc-era look — baked vertex lightmaps with sun
   shadows, Lambert/Gouraud shading, small painted textures, low-poly models,
   no post-processing. 'modern': the v1.3 PBR pipeline. Changing the style
   reloads the page because materials are created at load time. */
BV.classic = BV.settings.style !== 'modern';
const LAMBERT_KEYS = ['color', 'map', 'emissive', 'emissiveMap', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'alphaTest', 'depthWrite', 'depthTest',
  'blending', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'vertexColors', 'fog', 'toneMapped', 'alphaMap', 'aoMap', 'lightMap'];
BV.mat = function (o) {
  o = o || {};
  if (!BV.classic) return new THREE.MeshStandardMaterial(o);
  const q = {}; for (const k of LAMBERT_KEYS) if (o[k] !== undefined) q[k] = o[k];
  return new THREE.MeshLambertMaterial(q);
};
BV.saveSettings = function () {
  try { localStorage.setItem('blacksite-vector-settings', JSON.stringify(BV.settings)); } catch (e) { /* ignore */ }
};

/* Bot call-signs (original) */
BV.BOT_NAMES = {
  VANGUARD: ['Harlow', 'Brennan', 'Okafor', 'Lindqvist', 'Marek', 'Sato', 'Delacroix'],
  RAVEN:    ['Kite', 'Ash', 'Moth', 'Grit', 'Wick', 'Sable', 'Rook']
};
