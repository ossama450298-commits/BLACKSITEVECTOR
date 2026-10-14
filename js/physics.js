/* =====================================================================
   physics.js — axis-aligned box world: entity movement with step-up,
   gravity, ceiling checks and fast ray casting (slab method).
   ===================================================================== */
'use strict';
BV.Physics = (function () {
  let boxes = [];
  const STEP = 0.46;      // max climbable step height
  const GRAVITY = 15.5;
  const EPS = 0.001;

  function setBoxes(list) { boxes = list.filter(b => b.solid); }

  /* returns first solid box overlapping the entity AABB at (x,y,z) */
  function collide(x, y, z, r, h) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], mn = b.min, mx = b.max;
      if (x + r > mn[0] && x - r < mx[0] && y + h > mn[1] && y < mx[1] && z + r > mn[2] && z - r < mx[2]) return b;
    }
    return null;
  }

  /* horizontal move along one axis with step-up support */
  function moveAxis(e, axis, d, canStep) {
    const p = e.pos, r = e.radius, h = e.height;
    let nx = p.x, nz = p.z;
    if (axis === 0) nx += d; else nz += d;
    const b = collide(nx, p.y, nz, r, h);
    if (!b) { p.x = nx; p.z = nz; return false; }
    // try climbing onto the obstacle
    if (canStep) {
      const top = b.max[1];
      if (top - p.y <= STEP && top > p.y && !collide(nx, top + EPS, nz, r, h)) {
        p.x = nx; p.z = nz; p.y = top + EPS; e.vel.y = Math.max(0, e.vel.y); e.onGround = true; return false;
      }
    }
    // slide: clamp against the face
    if (axis === 0) nx = d > 0 ? b.min[0] - r - EPS : b.max[0] + r + EPS;
    else nz = d > 0 ? b.min[2] - r - EPS : b.max[2] + r + EPS;
    if (!collide(nx, p.y, nz, r, h)) { p.x = nx; p.z = nz; }
    if (axis === 0) e.vel.x = 0; else e.vel.z = 0;
    return true;
  }

  /* full movement step; returns true if it hit something horizontally */
  function moveEntity(e, dt, canStepInAir) {
    let blocked = false;
    const canStep = e.onGround || canStepInAir;
    // substeps keep fast movers from tunnelling
    const dx = e.vel.x * dt, dz = e.vel.z * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.3));
    for (let s = 0; s < steps; s++) {
      if (dx) blocked = moveAxis(e, 0, dx / steps, canStep) || blocked;
      if (dz) blocked = moveAxis(e, 2, dz / steps, canStep) || blocked;
    }
    // vertical
    e.vel.y -= GRAVITY * dt;
    const wasGround = e.onGround;
    e.onGround = false;
    const p = e.pos;
    let ny = p.y + e.vel.y * dt;
    if (ny <= 0) { ny = 0; e.onGround = true; }
    const b = collide(p.x, ny, p.z, e.radius, e.height);
    if (b) {
      if (e.vel.y <= 0) { ny = b.max[1] + EPS; e.onGround = true; }
      else { ny = b.min[1] - e.height - EPS; }
    }
    if (e.onGround && e.vel.y < 0) { e.landSpeed = wasGround ? 0 : -e.vel.y; e.vel.y = 0; } else e.landSpeed = 0;
    if (e.vel.y > 0 && b) e.vel.y = 0;
    p.y = ny;
    return blocked;
  }

  function headroom(e, h) { return !collide(e.pos.x, e.pos.y, e.pos.z, e.radius, h); }

  /* ray vs AABB (slab). returns distance or -1; writes face normal */
  const _n = [0, 0, 0];
  function rayBox(ox, oy, oz, dx, dy, dz, mn, mx, maxD, outN) {
    let tmin = 0, tmax = maxD, axis = -1, sign = 0;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return -1; continue; }
      const inv = 1 / d[a];
      let t1 = (mn[a] - o[a]) * inv, t2 = (mx[a] - o[a]) * inv, s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
    if (axis < 0) return -1; // origin inside box
    if (outN) { outN[0] = outN[1] = outN[2] = 0; outN[axis] = sign; }
    return tmin;
  }

  /* world raycast against boxes + ground plane */
  function raycast(o, d, maxD) {
    let best = maxD, hit = null; const n = [0, 0, 0];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, b.min, b.max, best, _n);
      if (t >= 0 && t < best) { best = t; hit = b; n[0] = _n[0]; n[1] = _n[1]; n[2] = _n[2]; }
    }
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t >= 0 && t < best) { best = t; hit = { ground: true, mat: 'ground' }; n[0] = 0; n[1] = 1; n[2] = 0; } }
    if (!hit) return null;
    return { dist: best, box: hit, normal: n, point: { x: o.x + d.x * best, y: o.y + d.y * best, z: o.z + d.z * best } };
  }

  /* line of sight test between two points */
  const _d = { x: 0, y: 0, z: 0 };
  function los(a, b) {
    _d.x = b.x - a.x; _d.y = b.y - a.y; _d.z = b.z - a.z;
    const len = Math.sqrt(_d.x * _d.x + _d.y * _d.y + _d.z * _d.z);
    if (len < 1e-4) return true;
    _d.x /= len; _d.y /= len; _d.z /= len;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const t = rayBox(a.x, a.y, a.z, _d.x, _d.y, _d.z, b.min, b.max, len, null);
      if (t >= 0 && t < len) return false;
    }
    return true;
  }

  return { setBoxes, collide, moveEntity, headroom, rayBox, raycast, los, STEP, GRAVITY, get boxes() { return boxes; } };
})();
