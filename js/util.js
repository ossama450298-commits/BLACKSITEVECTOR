/* =====================================================================
   util.js — small math helpers shared by every module
   ===================================================================== */
'use strict';
BV.U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  /* wrap an angle difference to [-PI, PI] */
  angDiff: (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
  dist2D: (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz),
  /* deterministic RNG for texture generation */
  rng: function (seed) {
    let s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  },
  fmtTime: (t) => { t = Math.max(0, Math.ceil(t)); const m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; },
  shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
};
