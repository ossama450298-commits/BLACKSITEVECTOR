/* =====================================================================
   map.js — SECTOR-17, an original tactical map.
   A decommissioned rail-freight compound on the edge of a port city.

   Layout (top view, north = -Z):
        x=-62                                  x=22              x=62
   z=-44 ┌──────────┬───────── NORTH STREET ────┬──── A YARD ───────┐
         │          │  N1  ║alley║   N2         │   (site A, deck)  │
   z=-10 │ RAVEN    ├────────────────────────── ┴─ A short ─────────┤
         │  PLAZA   │          MID ─────────►   MID-EAST   │ VANG. │
   z=+10 │ (attack  ├──────────║alley║──────── ┬─ connector ─┤ spawn │
         │  spawn)  │  S1          S2          │   B HALL (site B)  │
   z=+30 │          ├══════ SOUTH TUNNEL ══════╧═►                  │
   z=+44 └──────────┴──────────────────────────────────────────────┘
   Static geometry is merged per material and lit with baked vertex
   colours (sun, ambient occlusion, sodium lamps) — like an old lightmap.
   ===================================================================== */
'use strict';
BV.Map = (function () {
  const boxes = [];      // {min:[x,y,z], max:[x,y,z], mat, solid, faces, fit}
  const cyls = [];       // decorative/solid cylinders (barrels, pipes)
  const lamps = [];      // {x,y,z,r,i,c:[r,g,b]}
  const decals = [];     // painted signs {tex, pos, normal, size}
  const indoor = [];     // regions with a roof: [x0,z0,x1,z1,yRoof]

  function B(x0, z0, x1, z1, y0, y1, mat, o) {
    o = o || {};
    boxes.push({
      min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)],
      mat, solid: o.solid !== false, faces: o.faces || null, fit: !!o.fit, noBake: !!o.noBake
    });
  }
  function floor(x0, z0, x1, z1, mat) { B(x0, z0, x1, z1, -0.2, 0, mat, { solid: false, faces: ['py'] }); }
  function crate(x, z, s, h, mat, y) { B(x - s / 2, z - s / 2, x + s / 2, z + s / 2, y || 0, (y || 0) + (h || s), mat || 'crate'); }
  function barrel(x, z) { cyls.push({ x, z, r: 0.42, h: 1.15, mat: 'barrel' }); B(x - 0.42, z - 0.42, x + 0.42, z + 0.42, 0, 1.15, 'barrel', { solid: true, faces: [] }); }
  function lamp(x, y, z, r, i, warm) { lamps.push({ x, y, z, r, i, c: warm === false ? [0.55, 0.75, 1.0] : [1.0, 0.72, 0.38] }); }

  /* ---------------- geometry definition ---------------- */
  function define() {
    // floors
    floor(-62, -44, -40, 44, 'dirt');
    floor(-40, -44, 22, -28, 'asphalt');
    floor(-40, -10, 18, 10, 'concrete');
    floor(-15, -28, -11, -10, 'concreteDark');
    floor(-5, 10, -1, 30, 'concreteDark');
    floor(-40, 30, 22, 40, 'concreteDark');
    floor(22, -44, 62, -14, 'concrete');
    floor(18, -14, 62, 14, 'asphalt');
    floor(22, 14, 62, 44, 'tile');

    // outer walls
    B(-64, -46, 64, -44, 0, 10, 'concrete');
    B(-64, 44, 64, 46, 0, 10, 'concrete');
    B(-64, -46, -62, 46, 0, 10, 'concrete');
    B(62, -46, 64, 46, 0, 10, 'concrete');

    // building blocks
    B(-40, -28, -15, -10, 0, 8, 'brick');       // N1 warehouse
    B(-11, -28, 18, -10, 0, 7, 'concrete');     // N2 depot
    B(18, -28, 22, -14, 0, 7, 'concrete');      // NE block
    B(-40, 10, -5, 30, 0, 8, 'plaster');        // S1 offices
    B(-1, 10, 18, 30, 0, 7, 'brick');           // S2 workshop
    B(18, 14, 22, 30, 0, 7, 'brick');           // SE block
    B(-40, 40, 22, 44, 0, 10, 'concrete');      // tunnel back block
    B(-40, 30, 22, 40, 4.2, 5.0, 'roof', { faces: ['ny', 'py'] }); // tunnel roof
    indoor.push([-40, 30, 22, 40, 4.2]);
    // roof parapets (silhouette detail)
    B(-40, -28.4, -15, -28, 8, 8.6, 'trim', { solid: false }); B(-40, -10, -15, -9.6, 8, 8.6, 'trim', { solid: false });
    B(-40, 9.6, -5, 10, 8, 8.6, 'trim', { solid: false });

    // long doors to A yard
    B(21, -44, 23, -40, 0, 6, 'metal'); B(21, -32, 23, -28, 0, 6, 'metal');
    B(21, -40, 23, -32, 4.4, 6, 'metal');

    // tunnel portal into B hall
    B(21, 30, 23, 32, 0, 6, 'concrete'); B(21, 38, 23, 40, 0, 6, 'concrete'); B(21, 32, 23, 38, 3.4, 6, 'concrete');
    // tunnel west portal frame
    B(-41, 30, -40, 31, 0, 5, 'trim'); B(-41, 39, -40, 40, 0, 5, 'trim'); B(-41, 31, -40, 39, 4.2, 5, 'hazard', { solid: false });

    // A yard / mid-east wall with A short and spawn gap
    B(22, -15, 28, -14, 0, 5, 'concrete'); B(32, -15, 52, -14, 0, 5, 'concrete'); B(56, -15, 62, -14, 0, 5, 'concrete');

    // B hall north wall with connector + spawn doors, and roof
    B(22, 14, 27, 15, 0, 6, 'metal'); B(31, 14, 52, 15, 0, 6, 'metal'); B(56, 14, 62, 15, 0, 6, 'metal');
    B(27, 14, 31, 15, 3.4, 6, 'metal'); B(52, 14, 56, 15, 3.4, 6, 'metal');
    B(22, 14, 62, 44, 6, 6.6, 'roof', { faces: ['ny', 'py'] });
    indoor.push([22, 15, 62, 44, 6]);

    /* ---- A site ---- */
    B(40, -34, 48, -26, 0, 1.2, 'metal');                        // deck
    B(40, -34, 48, -33.8, 0, 1.2, 'hazard', { solid: false });
    B(40, -26.2, 48, -26, 0, 1.2, 'hazard', { solid: false });
    [0.3, 0.6, 0.9].forEach((h, i) => B(37.75 + i * 0.75, -32, 38.5 + i * 0.75, -28, 0, h, 'concrete'));
    B(37, -32, 37.75, -28, 0, 0.15, 'concrete', { solid: false });
    crate(46.7, -33.3, 1.4, 1.2, 'crate', 1.2);
    crate(30.75, -39.25, 1.5, 1.5); crate(30.75, -39.25, 1.1, 1.1, 'crate', 1.5);
    crate(35, -23, 2, 1.4);
    crate(53, -37, 2, 1.6, 'crateMil'); crate(52.9, -35.3, 1.4, 1.1);
    B(26, -26, 32, -23.6, 0, 2.6, 'container');
    crate(57, -27, 2, 1.3);
    barrel(48.9, -42); barrel(50, -42.3); barrel(58.8, -18.5);
    crate(40.5, -19, 1.6, 1.2, 'crateMil');

    /* ---- north street ---- */
    B(-28, -41, -24, -39, 0, 1.25, 'car'); B(-27.3, -40.8, -25, -39.2, 1.25, 1.85, 'glass');
    B(2, -33, 6, -31, 0, 1.25, 'car2'); B(2.8, -32.8, 5, -31.2, 1.25, 1.85, 'glass');
    B(-18, -37, -14, -36.4, 0, 1.1, 'concrete');
    B(10, -42, 10.6, -38, 0, 1.1, 'concrete');
    B(-36, -30, -33.5, -28.5, 0, 1.5, 'container');
    crate(-14.2, -19.4, 1.2, 1.2);           // alley N clutter
    barrel(16.8, -42.6);

    /* ---- mid ---- */
    crate(-29, -2, 2, 1.4); crate(-29.4, -0.4, 1.2, 1.0);
    B(-10, -1.5, -6, 1.5, 0, 1.6, 'concrete');
    crate(3, 5, 2, 1.5, 'crateMil'); crate(4.6, 4.8, 1.2, 1.0);
    crate(9, -7, 2, 1.4);
    crate(-21, 7, 2, 1.4);
    B(13, -3, 14, 3, 0, 1.8, 'concrete');
    barrel(-38.8, 8.6); barrel(16.8, 8.7);

    /* ---- mid-east ---- */
    B(30, -4, 36, -1.6, 0, 2.6, 'container');
    crate(24.75, 4.75, 1.5, 1.3);
    crate(41, 7, 2, 1.5, 'crateMil');
    crate(41, -10, 2, 1.3);

    /* ---- Vanguard spawn ---- */
    crate(59, -11, 2, 1.5, 'crateMil'); crate(59, 11, 2, 1.5, 'crateMil');
    B(60.5, -3, 62, 3, 0, 2.2, 'metal');

    /* ---- B hall ---- */
    [31, 41, 51].forEach(x => { B(x - 0.6, 21.4, x + 0.6, 22.6, 0, 6, 'concrete'); B(x - 0.6, 33.4, x + 0.6, 34.6, 0, 6, 'concrete'); });
    crate(39, 37, 2, 1.4); crate(45, 28, 2, 1.3, 'crateMil'); crate(48.7, 30.7, 1.4, 1.0);
    B(42, 40, 45, 42.5, 0, 1.6, 'container');
    B(56, 36, 60, 42, 0, 2.2, 'metal');
    B(23.5, 24, 24.5, 29, 0, 2.4, 'metal');
    barrel(26.5, 42.6); barrel(60.8, 17.2);

    /* ---- Raven plaza ---- */
    B(-50, -22, -44, -19.6, 0, 2.6, 'container');
    B(-49, 20, -43, 22.4, 0, 2.6, 'container'); B(-48.6, 20.2, -43.4, 22.2, 2.6, 5.2, 'container');
    crate(-44, -34, 2, 1.5); crate(-44, 36, 2, 1.5, 'crateMil');
    barrel(-60.8, -8); barrel(-60.8, 8); barrel(-55, 42.5);

    /* ---- decorative windows / doors on facades ---- */
    function windows(x0, x1, z, face, rows, step) {
      for (let x = x0 + 2; x <= x1 - 3; x += step) rows.forEach(y => {
        const zz = face > 0 ? z : z - 0.06;
        B(x, zz, x + 1.8, zz + 0.06, y, y + 1.3, 'window', { solid: false, fit: true, noBake: false });
      });
    }
    windows(-40, -15, -28, -1, [2.4, 5.2], 4);
    windows(-11, 18, -28, -1, [2.4], 5);
    windows(-40, -15, -10, 1, [2.4, 5.2], 4);
    windows(-11, 18, -10, 1, [2.6], 5);
    windows(-40, -5, 10, -1, [2.4, 5.2], 4);
    windows(-1, 18, 10, -1, [2.6], 5);
    // doors
    B(-30, -10, -28.6, -9.94, 0, 2.3, 'door', { solid: false, fit: true });
    B(5, -10, 6.4, -9.94, 0, 2.3, 'door', { solid: false, fit: true });
    B(-20, 9.94, -18.6, 10, 0, 2.3, 'door', { solid: false, fit: true });
    B(-35, -28.06, -33.6, -28, 0, 2.3, 'door', { solid: false, fit: true });
    // pipes along tunnel wall
    cyls.push({ x: -40, z: 39.6, r: 0.18, h: 62, axis: 'x', y: 3.4, mat: 'pipe' });
    cyls.push({ x: -40, z: 39.1, r: 0.12, h: 62, axis: 'x', y: 3.0, mat: 'pipe' });

    /* ---- lamps (baked lighting + glow sprites) ---- */
    for (let x = -34; x <= 18; x += 8) lamp(x, 4.0, 35, 7, 0.6);
    for (let x = 28; x <= 58; x += 10) { lamp(x, 5.8, 20, 9, 0.45); lamp(x, 5.8, 32, 9, 0.45); lamp(x, 5.8, 41, 8, 0.4); }
    lamp(-27, 4.5, -28.2, 9, 0.5); lamp(6, 4.5, -28.2, 9, 0.5);
    lamp(-20, 4.5, -9.8, 9, 0.5); lamp(8, 4.5, -9.8, 9, 0.45); lamp(-25, 4.5, 9.8, 9, 0.45);
    lamp(44, 4.2, -14.8, 9, 0.5); lamp(30, 4.2, -14.2, 7, 0.45); lamp(55, 4.2, 13.8, 8, 0.45);
    lamp(-61.8, 4.5, 0, 12, 0.5); lamp(61.8, 4.5, 0, 12, 0.5, false);
    lamp(-3, 4.5, 29.8, 6, 0.4); lamp(-13, 4.5, -27.8, 6, 0.4);

    /* ---- painted decals ---- */
    decals.push({ tex: () => BV.Textures.stencil('A', 'rgba(232,190,60,0.9)'), pos: [44, 0.02, -38], n: [0, 1, 0], size: 4 });
    decals.push({ tex: () => BV.Textures.stencil('A', 'rgba(232,190,60,0.9)'), pos: [35, 2.6, -13.94], n: [0, 0, 1], size: 2.4 });
    decals.push({ tex: () => BV.Textures.stencil('A', 'rgba(232,190,60,0.9)'), pos: [20.94, 2.6, -42], n: [-1, 0, 0], size: 2.2 });
    decals.push({ tex: () => BV.Textures.stencil('B', 'rgba(232,190,60,0.9)'), pos: [43, 0.02, 33], n: [0, 1, 0], size: 4 });
    decals.push({ tex: () => BV.Textures.stencil('B', 'rgba(232,190,60,0.9)'), pos: [29, 4.6, 13.94], n: [0, 0, -1], size: 2.2 });
    decals.push({ tex: () => BV.Textures.stencil('B', 'rgba(232,190,60,0.9)'), pos: [20.94, 2.2, 31], n: [-1, 0, 0], size: 1.6 });
    decals.push({ tex: () => BV.Textures.emblem('RAVEN'), pos: [-61.94, 3, -14], n: [1, 0, 0], size: 4 });
    decals.push({ tex: () => BV.Textures.emblem('VANGUARD'), pos: [61.94, 3.2, 8], n: [-1, 0, 0], size: 3.6 });
    decals.push({ tex: () => BV.Textures.sign(['SECTOR-17', 'FREIGHT YARD 4'], '#2a2f2a', '#d8cfa8'), pos: [-39.94, 4.6, 0], n: [-1, 0, 0], size: 5, h: 1.25 });
    decals.push({ tex: () => BV.Textures.sign(['NO ENTRY', 'AUTHORISED STAFF'], '#8a2b1f', '#eadfc0'), pos: [61.94, 3.4, -8], n: [-1, 0, 0], size: 3.6, h: 0.9 });
    decals.push({ tex: () => BV.Textures.sign(['TUNNEL 2', 'HEADROOM 4.2 M'], '#c99a22', '#1b1b18'), pos: [-39.0, 4.6, 35], n: [-1, 0, 0], size: 4, h: 0.6 });
  }

  /* ---------------- gameplay data ---------------- */
  const data = {
    name: 'SECTOR-17',
    bounds: { minX: -62, maxX: 62, minZ: -44, maxZ: 44 },
    spawns: {
      attack: [[-56, -3], [-56, 3], [-53, 0], [-58, 0], [-53, -5], [-53, 5], [-58, -6]],
      defend: [[55, -3], [55, 3], [58, 0], [52, 0], [58, -6], [58, 6], [52, 6]]
    },
    spawnCenter: { attack: [-55, 0], defend: [55, 0] },
    sites: [
      { name: 'A', min: [36, -40], max: [50, -22], center: [43, -31], plant: [[44, -30, 1.2], [38, -36, 0], [42, -24, 0]],
        defend: [[44, -28, 1.2, -Math.PI / 2], [30.5, -36, 0, Math.PI * 0.75], [54, -22, 0, Math.PI * 0.25], [35, -26, 0, 0.3], [45, -32, 1.2, Math.PI * 0.6]] },
      { name: 'B', min: [34, 24, ], max: [52, 42], center: [43, 33], plant: [[43, 33, 0], [38, 28, 0], [48, 38, 0]],
        defend: [[47, 36, 0, Math.PI * 0.6], [36, 28, 0, Math.PI * 0.9], [56, 26, 0, Math.PI * 0.2], [44, 25, 0, Math.PI * 0.5], [40, 39, 0, Math.PI * 0.75]] }
    ],
    // attack routes: list of staging points for each site
    routes: {
      A: [{ name: 'long', stage: [14, -36] }, { name: 'short', stage: [26, -2] }],
      B: [{ name: 'tunnel', stage: [10, 35] }, { name: 'connector', stage: [24, 6] }]
    },
    midPatrol: [[26, -8], [34, 6], [42, 0], [22, 0], [38, -10]],
    waypoints: [
      // plaza
      [-55, 0], [-55, -20], [-55, 20], [-48, -36], [-48, 36], [-45, -10], [-45, 10], [-52, -30], [-52, 30], [-42, -30], [-42, 34],
      // north street
      [-35, -36], [-25, -36], [-13, -36], [-5, -36], [5, -36], [14, -36], [19, -36], [-13, -31], [-30, -42], [0, -41],
      // alley N
      [-13, -24], [-12.3, -16], [-13, -11.5],
      // mid
      [-35, 0], [-25, -5], [-25, 5], [-13, -5], [-13, 5], [-3, 0], [-3, 6], [8, -4], [8, 4], [15, -6], [15, 6], [-36, -7], [-36, 7],
      // alley S
      [-3, 12], [-3, 20], [-3, 28],
      // tunnel
      [-38, 35], [-25, 35], [-13, 35], [-3, 35], [8, 35], [17, 35],
      // A long doors / yard
      [25, -36], [28, -42], [28, -30], [30, -20], [36, -42], [36, -19], [52, -41], [56, -32], [55, -20], [36, -30], [34, -36], [50, -30], [50, -24], [44, -38], [44, -22],
      // A deck
      [42, -30, 1.2], [46, -28, 1.2], [46, -31, 1.2],
      // A short
      [30, -17], [30, -11],
      // mid-east
      [21, 0], [26, -8], [26, 8], [34, 6], [38, -7], [44, 0], [29, 11], [24, -11], [45, 10], [45, -11],
      // Vanguard spawn
      [54, -10], [54, 0], [54, 10], [58, -5], [58, 5],
      [54, -17], [54, 12], [54, 17],
      // B connector
      [29, 17],
      // B hall
      [26, 21], [26, 35], [36, 19], [36, 30], [36, 40], [46, 24], [46, 35], [56, 22], [56, 31], [52, 40], [28, 42], [24, 33], [41, 30], [33, 26]
    ],
    links: [[[36, -30], [42, -30, 1.2]], [[34, -36], [42, -30, 1.2]], [[44, -38], [46, -31, 1.2]], [[50, -30], [46, -28, 1.2]], [[44, -22], [46, -28, 1.2]]]
  };

  /* ---------------- baked lighting ---------------- */
  const SUN = (() => { const v = [-0.45, 0, -0.7]; const l = Math.hypot(v[0], v[2]); return [v[0] / l, 0, v[2] / l]; })();
  let wallBoxes = null;
  function isIndoor(x, y, z) {
    for (const r of indoor) if (x >= r[0] - 0.05 && x <= r[2] + 0.05 && z >= r[1] - 0.05 && z <= r[3] + 0.05 && y <= r[4] + 0.01) return true;
    return false;
  }
  function floorAO(x, z) {
    let dmin = 3;
    for (const b of wallBoxes) {
      const dx = Math.max(b.min[0] - x, 0, x - b.max[0]), dz = Math.max(b.min[2] - z, 0, z - b.max[2]);
      const d = Math.hypot(dx, dz); if (d < dmin) dmin = d;
    }
    return 0.62 + 0.38 * Math.min(1, dmin / 1.6);
  }
  function bake(x, y, z, nx, ny, nz, mat) {
    let c;
    if (ny > 0.5) c = 1.0; else if (ny < -0.5) c = 0.5;
    else c = 0.6 + 0.32 * Math.max(0, nx * SUN[0] + nz * SUN[2]) + 0.06 * Math.max(0, -(nx * SUN[0] + nz * SUN[2]));
    if (Math.abs(ny) < 0.5) c *= 0.7 + 0.3 * Math.min(1, y / 2.4);              // ground contact darkening
    if (ny > 0.5 && y < 0.05) c *= floorAO(x, z);                               // floor AO near walls
    const inside = isIndoor(x, y, z);
    if (inside) c *= 0.42;
    let r = c, g = c * 0.97, b = c * 0.9;                                       // warm dusk tint
    if (!inside && ny > 0.5) { r *= 1.02; b *= 0.96; }
    for (const L of lamps) {
      const dx = x - L.x, dy = y - L.y, dz = z - L.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < L.r) {
        let k = (1 - d / L.r); k = k * k * L.i * 1.6;
        const facing = d > 0.01 ? Math.max(0.25, -(dx * nx + dy * ny + dz * nz) / d) : 1;
        k *= facing; r += k * L.c[0]; g += k * L.c[1]; b += k * L.c[2];
      }
    }
    return [Math.min(r, 1.5), Math.min(g, 1.5), Math.min(b, 1.5)];
  }

  /* ---------------- geometry building ---------------- */
  const TEX_SCALE = { concrete: 4, concreteDark: 4, brick: 3, plaster: 3, metal: 3, roof: 4, crate: 1.4, crateMil: 1.6, container: 3,
    asphalt: 4, tile: 3, dirt: 5, hazard: 1.2, window: 1, door: 1, car: 2, car2: 2, glass: 2, trim: 2, barrel: 1 };

  const FACES = {
    px: { n: [1, 0, 0], o: (a, b) => [b[0], a[1], b[2]], u: (a, b) => [0, 0, -(b[2] - a[2])], v: (a, b) => [0, b[1] - a[1], 0], uc: 2, us: -1, vc: 1 },
    nx: { n: [-1, 0, 0], o: (a) => [a[0], a[1], a[2]], u: (a, b) => [0, 0, b[2] - a[2]], v: (a, b) => [0, b[1] - a[1], 0], uc: 2, us: 1, vc: 1 },
    pz: { n: [0, 0, 1], o: (a, b) => [a[0], a[1], b[2]], u: (a, b) => [b[0] - a[0], 0, 0], v: (a, b) => [0, b[1] - a[1], 0], uc: 0, us: 1, vc: 1 },
    nz: { n: [0, 0, -1], o: (a, b) => [b[0], a[1], a[2]], u: (a, b) => [-(b[0] - a[0]), 0, 0], v: (a, b) => [0, b[1] - a[1], 0], uc: 0, us: -1, vc: 1 },
    py: { n: [0, 1, 0], o: (a, b) => [a[0], b[1], a[2]], u: (a, b) => [0, 0, b[2] - a[2]], v: (a, b) => [b[0] - a[0], 0, 0], uc: 0, us: 1, vc: 2, swap: true },
    ny: { n: [0, -1, 0], o: (a) => [a[0], a[1], a[2]], u: (a, b) => [b[0] - a[0], 0, 0], v: (a, b) => [0, 0, b[2] - a[2]], uc: 0, us: 1, vc: 2 }
  };

  function buildGeometry(scene) {
    const groups = {};
    wallBoxes = boxes.filter(b => b.solid && b.max[1] - b.min[1] > 0.9 && b.min[1] < 0.5);
    for (const b of boxes) {
      const faces = b.faces || (b.min[1] <= 0.001 ? ['px', 'nx', 'pz', 'nz', 'py'] : ['px', 'nx', 'pz', 'nz', 'py', 'ny']);
      if (!faces.length) continue;
      const G = groups[b.mat] || (groups[b.mat] = { p: [], n: [], c: [], uv: [] });
      const sc = TEX_SCALE[b.mat] || 3;
      for (const fk of faces) {
        const F = FACES[fk];
        const o = F.o(b.min, b.max), U = F.u(b.min, b.max), V = F.v(b.min, b.max);
        const lu = Math.hypot(U[0], U[1], U[2]), lv = Math.hypot(V[0], V[1], V[2]);
        if (lu < 1e-4 || lv < 1e-4) continue;
        const cell = fk === 'py' || fk === 'ny' ? 2 : 2.5;
        const nu = b.fit ? 1 : Math.max(1, Math.ceil(lu / cell)), nv = b.fit ? 1 : Math.max(1, Math.ceil(lv / cell));
        const pt = (i, j) => [o[0] + U[0] * i / nu + V[0] * j / nv, o[1] + U[1] * i / nu + V[1] * j / nv, o[2] + U[2] * i / nu + V[2] * j / nv];
        const uvOf = (p, i, j) => {
          if (b.fit) return [i / nu, j / nv];
          if (fk === 'py' || fk === 'ny') return [p[0] / sc, p[2] / sc];
          return [p[F.uc] * F.us / sc, p[1] / sc];
        };
        const verts = [];
        for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
          const p = pt(i, j);
          const col = b.noBake ? [1, 1, 1] : bake(p[0], p[1], p[2], F.n[0], F.n[1], F.n[2], b.mat);
          verts.push({ p, col, uv: uvOf(p, i, j) });
        }
        const idx = (i, j) => verts[j * (nu + 1) + i];
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
          const a = idx(i, j), bb = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
          [a, bb, c, a, c, d].forEach(v => { G.p.push(v.p[0], v.p[1], v.p[2]); G.n.push(F.n[0], F.n[1], F.n[2]); G.c.push(v.col[0], v.col[1], v.col[2]); G.uv.push(v.uv[0], v.uv[1]); });
        }
      }
    }
    const meshes = [];
    for (const mat in groups) {
      const G = groups[mat];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(G.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(G.c, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: BV.Textures.make(mat), vertexColors: true }));
      m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m); meshes.push(m);
    }
    // cylinders (barrels, pipes)
    const barrelTex = barrelTexture();
    for (const c of cyls) {
      let mesh;
      if (c.mat === 'barrel') {
        const shade = isIndoor(c.x, 0.5, c.z) ? 0.5 : 0.95;
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 10), new THREE.MeshBasicMaterial({ map: barrelTex, color: new THREE.Color(shade, shade * 0.97, shade * 0.9) }));
        mesh.position.set(c.x, c.h / 2, c.z); mesh.rotation.y = Math.random() * 6;
      } else {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 8), new THREE.MeshBasicMaterial({ color: 0x2c2f2c }));
        mesh.rotation.z = Math.PI / 2; mesh.position.set(c.x + c.h / 2, c.y, c.z);
      }
      mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh);
    }
    // lamp fixtures + glow sprites
    const glowMat = new THREE.SpriteMaterial({ map: BV.Textures.glow(), color: 0xffc070, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    const glowMatCool = glowMat.clone(); glowMatCool.color = new THREE.Color(0x9cc4ff);
    const fixMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
    const fixGeo = new THREE.BoxGeometry(0.7, 0.12, 0.35);
    for (const L of lamps) {
      const f = new THREE.Mesh(fixGeo, L.c[2] > 0.9 ? new THREE.MeshBasicMaterial({ color: 0xcfe2ff }) : fixMat);
      f.position.set(L.x, L.y + 0.05, L.z); f.matrixAutoUpdate = false; f.updateMatrix(); scene.add(f);
      const s = new THREE.Sprite(L.c[2] > 0.9 ? glowMatCool : glowMat); s.position.set(L.x, L.y - 0.05, L.z); s.scale.set(1.4, 1.4, 1); scene.add(s);
    }
    // decals
    for (const d of decals) {
      const mat = new THREE.MeshBasicMaterial({ map: d.tex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
      const isLit = !isIndoor(d.pos[0], d.pos[1], d.pos[2]); mat.color = new THREE.Color(isLit ? 0.95 : 0.6, isLit ? 0.92 : 0.58, isLit ? 0.85 : 0.55);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size, d.h || d.size), mat);
      m.position.set(d.pos[0], d.pos[1], d.pos[2]);
      m.lookAt(d.pos[0] + d.n[0], d.pos[1] + d.n[1], d.pos[2] + d.n[2]);
      scene.add(m);
    }
    return meshes;
  }
  function barrelTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#5a3b24'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2f5a52'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 14, 64, 3); g.fillRect(0, 46, 64, 3);
    g.fillStyle = 'rgba(130,70,30,0.5)'; for (let i = 0; i < 12; i++) g.fillRect(Math.random() * 64, Math.random() * 30, 2, 10 + Math.random() * 20);
    g.fillStyle = 'rgba(230,200,60,0.85)'; g.fillRect(20, 24, 24, 14);
    const t = new THREE.CanvasTexture(c); return t;
  }

  /* ---------------- sky ---------------- */
  function buildSky(scene) {
    const tex = BV.Textures.make('sky', { size: 512, h: 256 });
    tex.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.SphereGeometry(400, 24, 12);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(geo, mat); sky.renderOrder = -1;
    scene.add(sky); return sky;
  }

  /* ---------------- waypoint graph ---------------- */
  function buildGraph() {
    const nodes = data.waypoints.map((w, i) => ({ id: i, x: w[0], y: w[2] || 0, z: w[1], nb: [] }));
    const link = (a, b) => {
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (!a.nb.find(n => n.id === b.id)) a.nb.push({ id: b.id, d });
      if (!b.nb.find(n => n.id === a.id)) b.nb.push({ id: a.id, d });
    };
    const P = BV.Physics;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (Math.abs(a.y - b.y) > 0.1) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z); if (d > 24) continue;
      // three parallel rays (body width) at knee and chest height
      const px = -(b.z - a.z) / d * 0.42, pz = (b.x - a.x) / d * 0.42;
      let clear = true;
      for (const off of [-1, 0, 1]) for (const h of [0.6, 1.4]) {
        if (!P.los({ x: a.x + px * off, y: a.y + h, z: a.z + pz * off }, { x: b.x + px * off, y: b.y + h, z: b.z + pz * off })) { clear = false; break; }
        if (!clear) break;
      }
      if (clear) link(a, b);
    }
    const find = (p) => nodes.find(n => Math.abs(n.x - p[0]) < 0.01 && Math.abs(n.z - p[1]) < 0.01);
    for (const l of data.links) { const a = find(l[0]), b = find(l[1]); if (a && b) link(a, b); }
    data.nodes = nodes;
    return nodes;
  }

  function nearestNode(x, y, z, requireLos) {
    let best = null, bd = 1e9;
    for (const n of data.nodes) {
      const d = Math.hypot(n.x - x, n.z - z) + Math.abs(n.y - y) * 3;
      if (d < bd) {
        if (requireLos && d > 1 && !BV.Physics.los({ x, y: y + 0.9, z }, { x: n.x, y: n.y + 0.9, z: n.z })) continue;
        bd = d; best = n;
      }
    }
    return best || nearestNode(x, y, z, false);
  }

  /* A* path between world positions -> array of {x,y,z} */
  function findPath(from, to) {
    const s = nearestNode(from.x, from.y, from.z, true), g = nearestNode(to.x, to.y, to.z, true);
    if (!s || !g) return [];
    const N = data.nodes, open = [s.id], came = {}, gS = { [s.id]: 0 }, fS = { [s.id]: 0 };
    const h = (n) => Math.hypot(n.x - g.x, n.z - g.z);
    const closed = new Set();
    let guard = 0;
    while (open.length && guard++ < 2000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (fS[open[i]] < fS[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === g.id) {
        const path = []; let c = cur;
        while (c !== undefined) { const n = N[c]; path.unshift({ x: n.x, y: n.y, z: n.z, id: n.id }); c = came[c]; }
        return path;
      }
      closed.add(cur);
      for (const e of N[cur].nb) {
        if (closed.has(e.id)) continue;
        const t = gS[cur] + e.d * (0.9 + Math.random() * 0.25); // small noise = varied routes
        if (gS[e.id] === undefined || t < gS[e.id]) {
          came[e.id] = cur; gS[e.id] = t; fS[e.id] = t + h(N[e.id]);
          if (!open.includes(e.id)) open.push(e.id);
        }
      }
    }
    return [];
  }

  function siteAt(x, z) {
    for (const s of data.sites) if (x >= s.min[0] && x <= s.max[0] && z >= s.min[1] && z <= s.max[1]) return s;
    return null;
  }
  function nearestSite(x, z) {
    let best = null, bd = 1e9;
    for (const s of data.sites) { const d = Math.hypot(s.center[0] - x, s.center[1] - z); if (d < bd) { bd = d; best = s; } }
    return { site: best, dist: bd };
  }
  /* zone label for HUD/radio */
  function zoneName(x, z) {
    if (x < -40) return 'Raven Plaza';
    const s = siteAt(x, z); if (s) return 'Site ' + s.name;
    if (z < -28 && x < 22) return 'North Street';
    if (x >= 22 && z < -14) return 'A Yard';
    if (x >= 22 && z > 14) return 'B Hall';
    if (z > 30) return 'South Tunnel';
    if (x > -15 && x < -11 && z < -10) return 'North Alley';
    if (x > -5 && x < -1 && z > 10) return 'South Alley';
    if (x > 46) return 'Vanguard Gate';
    if (x > 18) return 'Market';
    return 'Mid';
  }

  let built = false;
  function build(scene) {
    if (!built) { define(); built = true; }
    BV.Physics.setBoxes(boxes);
    buildGeometry(scene);
    buildSky(scene);
    if (!data.nodes) buildGraph();
    return data;
  }

  return { build, data, findPath, nearestNode, siteAt, nearestSite, zoneName, isIndoor, get boxes() { return boxes; } };
})();
