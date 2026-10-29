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
  const props = [];      // detailed visual models (cars, sandbags, puddles, lamp posts)
  const skylights = [];
  function sandbags(x0, z0, x1, z1, h) { B(x0, z0, x1, z1, 0, h, 'sandbag', { faces: [] }); props.push({ type: 'sandbags', x0, z0, x1, z1, h }); }

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
  function lamp(x, y, z, r, i, warm) { lamps.push({ x, y, z, r, i, c: warm === 'white' ? [1.0, 0.96, 0.9] : warm === false ? [0.55, 0.75, 1.0] : [1.0, 0.72, 0.38] }); }

  /* ---------------- geometry definition ---------------- */
  function defineSector17() {
    // floors
    floor(-62, -44, -40, 44, 'dirt');
    floor(-40, -44, 22, -28, 'asphalt');
    floor(-40, -10, 18, 10, 'concrete');
    floor(-15, -28, -11, -10, 'concreteDark');
    floor(-5, 10, -1, 30, 'concreteDark');
    floor(-40, 30, 22, 40, 'concreteDark');
    floor(22, -44, 62, -14, 'concrete');
    floor(18, -14, 62, 14, 'asphaltCracked');
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
    B(-1, 10, 18, 30, 0, 7, 'brick2');          // S2 workshop (factory brick)
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
    B(-28, -41, -24, -39, 0, 1.25, 'car', { faces: [] }); B(-27.3, -40.8, -25, -39.2, 1.25, 1.75, 'car', { faces: [] });
    B(2, -33, 6, -31, 0, 1.25, 'car2', { faces: [] }); B(2.8, -32.8, 5, -31.2, 1.25, 1.75, 'car2', { faces: [] });
    props.push({ type: 'car', x: -26, z: -40, rot: 0, color: 0x6e2a22 }, { type: 'car', x: 4, z: -32, rot: Math.PI, color: 0x3f5566 });
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
        const o = face > 0 ? 1 : -1, zw = face > 0 ? z : z - 0.02;
        B(x, zw, x + 1.8, zw + 0.02, y, y + 1.3, 'window', { solid: false, fit: true });
        const zf0 = face > 0 ? z : z - 0.11, zf1 = face > 0 ? z + 0.11 : z;
        B(x - 0.1, zf0, x + 1.9, zf1, y + 1.3, y + 1.44, 'trim', { solid: false });                 // lintel
        B(x - 0.08, zf0, x + 0.02, zf1, y, y + 1.3, 'trim', { solid: false });                      // jambs
        B(x + 1.78, zf0, x + 1.88, zf1, y, y + 1.3, 'trim', { solid: false });
        B(x + 0.86, zw, x + 0.94, zw + (face > 0 ? 0.05 : -0.03) * 1 + (face > 0 ? 0 : 0.05), y, y + 1.3, 'trim', { solid: false }); // mullion
        const zs0 = face > 0 ? z : z - 0.18, zs1 = face > 0 ? z + 0.18 : z;
        B(x - 0.14, zs0, x + 1.94, zs1, y - 0.12, y, 'concrete', { solid: false });               // sill
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

    /* ---- architectural detail: plinths, string courses, cornices ---- */
    const blds = [[-40, -28, -15, -10, 8], [-11, -28, 18, -10, 7], [-40, 10, -5, 30, 8], [-1, 10, 18, 30, 7], [18, -28, 22, -14, 7], [18, 14, 22, 30, 7]];
    for (const [x0, z0, x1, z1, h] of blds) {
      B(x0 - 0.07, z0 - 0.07, x1 + 0.07, z1 + 0.07, 0, 0.55, 'concreteDark', { solid: false });
      B(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, 4.25, 4.45, 'concreteDark', { solid: false, faces: ['px', 'nx', 'pz', 'nz', 'py', 'ny'] });
      B(x0 - 0.28, z0 - 0.28, x1 + 0.28, z1 + 0.28, h - 0.35, h, 'trim', { solid: false, faces: ['px', 'nx', 'pz', 'nz', 'py', 'ny'] });
      // downpipes at the corners
      [[x0 - 0.12, z0 - 0.12], [x1 + 0.12, z0 - 0.12], [x0 - 0.12, z1 + 0.12], [x1 + 0.12, z1 + 0.12]].forEach(c => cyls.push({ x: c[0], z: c[1], r: 0.07, h: h - 0.3, y: 0, mat: 'vpipe' }));
      // rooftop clutter (skyline silhouettes)
      const rx = (a) => x0 + (x1 - x0) * a, rz = (a) => z0 + (z1 - z0) * a;
      if (x1 - x0 > 6) {
        B(rx(0.25) - 0.9, rz(0.4) - 0.6, rx(0.25) + 0.9, rz(0.4) + 0.6, h, h + 1.1, 'metal', { solid: false });   // AC unit
        B(rx(0.6) - 0.7, rz(0.6) - 0.7, rx(0.6) + 0.7, rz(0.6) + 0.7, h, h + 1.4, 'roof', { solid: false });      // stair hut
        cyls.push({ x: rx(0.8), z: rz(0.3), r: 0.22, h: 1.6, y: h, mat: 'vpipe' });                            // vent stack
        cyls.push({ x: rx(0.42), z: rz(0.75), r: 1.1, h: 1.7, y: h + 1.1, mat: 'tank' });                      // water tank
        [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(l => B(rx(0.42) + l[0] - 0.06, rz(0.75) + l[1] - 0.06, rx(0.42) + l[0] + 0.06, rz(0.75) + l[1] + 0.06, h, h + 1.1, 'trim', { solid: false }));
        cyls.push({ x: rx(0.1), z: rz(0.15), r: 0.04, h: 4, y: h, mat: 'vpipe' });                             // antenna mast
      }
    }
    // A-deck railings
    for (let x = 40.1; x <= 48; x += 1.3) { B(x, -34, x + 0.06, -33.94, 1.2, 2.2, 'trim', { solid: false }); B(x, -26.06, x + 0.06, -26, 1.2, 2.2, 'trim', { solid: false }); }
    B(40, -34, 48, -33.94, 2.12, 2.2, 'hazard', { solid: false }); B(40, -26.06, 48, -26, 2.12, 2.2, 'hazard', { solid: false });
    // skylights in the B hall roof (bright panels + cool light below)
    skylights.push([34, 27], [46, 27], [34, 38], [46, 38]);
    for (const [x, z] of skylights) { lamp(x, 5.8, z, 8, 0.55, false); lamps[lamps.length - 1].sky = true; }
    /* ---- classic level dressing ---- */
    const band = (x0, z0, x1, z1) => B(x0, z0, x1, z1, 0.55, 1.4, 'paintLow', { solid: false, faces: ['px', 'nx', 'pz', 'nz', 'py'] });
    band(-40.06, 9.94, -20.1, 10); band(-18.5, 9.94, -5, 10); band(-40.06, 30, -5, 30.06); band(-11, -10, 4.9, -9.94); band(6.5, -10, 18, -9.94); band(-11, -28.06, 18, -28);   // S1 / N2
    // B hall interior wainscot (split at the doors)
    band(22, 15, 27, 15.06); band(31, 15, 52, 15.06); band(56, 15, 61.94, 15.06); band(61.94, 15, 62, 44); band(22, 43.94, 62, 44); band(22, 15, 22.06, 30); band(22, 40, 22.06, 44);
    // tread plate on the A deck top and machinery
    B(40, -34, 48, -26, 1.2, 1.205, 'plate', { solid: false, faces: ['py'] });
    B(56, 36, 60, 42, 2.2, 2.205, 'plate', { solid: false, faces: ['py'] });
    B(60.5, -3, 62, 3, 2.2, 2.205, 'plate', { solid: false, faces: ['py'] });
    // road markings along North Street and stop line at the long doors
    for (let x = -38; x < 16; x += 4) B(x, -36.08, x + 2, -35.92, 0, 0.006, 'roadLine', { solid: false, faces: ['py'], fit: true });
    B(17.6, -43.8, 17.9, -28.2, 0, 0.006, 'roadLine', { solid: false, faces: ['py'], fit: true });
    for (let z = -12; z <= 12; z += 3) B(48, z - 0.06, 51, z + 0.06, 0, 0.006, 'roadLine', { solid: false, faces: ['py'], fit: true }); // spawn bays
    // painted site boundaries
    for (const st of [[36, -40, 50, -22], [34, 24, 52, 42]]) {
      const [x0, z0, x1, z1] = st, w = 0.14;
      B(x0, z0, x1, z0 + w, 0, 0.007, 'siteLine', { solid: false, faces: ['py'], fit: true }); B(x0, z1 - w, x1, z1, 0, 0.007, 'siteLine', { solid: false, faces: ['py'], fit: true });
      B(x0, z0, x0 + w, z1, 0, 0.007, 'siteLine', { solid: false, faces: ['py'], fit: true }); B(x1 - w, z0, x1, z1, 0, 0.007, 'siteLine', { solid: false, faces: ['py'], fit: true });
    }
    // steel door frames around every opening (jambs + header)
    const frameX = (x0, x1, z0, z1, h) => { B(x0 - 0.2, z0 - 0.08, x0 + 0.02, z1 + 0.08, 0, h + 0.15, 'trim', { solid: false }); B(x1 - 0.02, z0 - 0.08, x1 + 0.2, z1 + 0.08, 0, h + 0.15, 'trim', { solid: false }); B(x0 - 0.2, z0 - 0.08, x1 + 0.2, z1 + 0.08, h, h + 0.18, 'trim', { solid: false }); };
    const frameZ = (z0, z1, x0, x1, h) => { B(x0 - 0.08, z0 - 0.2, x1 + 0.08, z0 + 0.02, 0, h + 0.15, 'trim', { solid: false }); B(x0 - 0.08, z1 - 0.02, x1 + 0.08, z1 + 0.2, 0, h + 0.15, 'trim', { solid: false }); B(x0 - 0.08, z0 - 0.2, x1 + 0.08, z1 + 0.2, h, h + 0.18, 'trim', { solid: false }); };
    frameX(27, 31, 14, 15, 3.4); frameX(52, 56, 14, 15, 3.4);
    frameZ(32, 38, 21, 23, 3.4); frameZ(-40, -32, 21, 23, 4.4);
    B(27.8, -15.1, 28.05, -13.9, 0, 5.1, 'hazard', { solid: false }); B(31.95, -15.1, 32.2, -13.9, 0, 5.1, 'hazard', { solid: false }); // A short posts
    B(51.8, -15.1, 52.05, -13.9, 0, 5.1, 'hazard', { solid: false }); B(55.95, -15.1, 56.2, -13.9, 0, 5.1, 'hazard', { solid: false });
    // manholes and drains
    [[-30, -33], [6, -38], [28, 2], [-20, 4], [40, -34.5]].forEach(([x, z]) => B(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, 0.006, 'manhole', { solid: false, faces: ['py'], fit: true }));
    [[-12.4, -27.6], [-2.5, 29.5], [24, -13.5], [55, 13.5], [-39.5, 30.6]].forEach(([x, z]) => B(x - 0.45, z - 0.2, x + 0.45, z + 0.2, 0, 0.006, 'drain', { solid: false, faces: ['py'], fit: true }));
    /* ---- sandbag positions & puddles ---- */
    sandbags(33.2, -29.5, 34.2, -26.5, 1.05);
    sandbags(46, 4.2, 49, 5.2, 1.05);
    sandbags(-46.5, -6, -45.5, -2.5, 1.05);
    sandbags(27, 31, 28, 34, 1.05);
    [[-20, -33, 2.4, 1.5], [12, -40, 3, 1.8], [30, 9, 2.2, 1.6], [-30, 4, 2, 1.3], [52, -30, 2.6, 1.6], [-52, 14, 3, 2]].forEach(p => props.push({ type: 'puddle', x: p[0], z: p[1], w: p[2], d: p[3] }));
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
  /* ================= HARBOR-9: night container port ================= */
  function defineHarbor() {
    const cont = (x, z, alongZ, lvl, y0) => { const y = (y0 || 0) + (lvl || 0) * 2.6, hx = alongZ ? 1.22 : 3.05, hz = alongZ ? 3.05 : 1.22; B(x - hx, z - hz, x + hx, z + hz, y, y + 2.6, 'container'); };
    const post = (x, z, warm) => { B(x - 0.13, z - 0.13, x + 0.13, z + 0.13, 0, 8, 'metal', { solid: true }); B(x - 0.5, z - 0.25, x + 0.5, z + 0.25, 7.8, 8.05, 'trim', { solid: false }); lamp(x, 7.6, z, 17, 1.5, warm !== false); };
    const crane = (cx) => {   // gantry crane straddling the quay: four legs (solid cover), beams overhead
      for (const lx of [cx - 5, cx + 5]) for (const lz of [-42, -32]) B(lx - 0.6, lz - 0.6, lx + 0.6, lz + 0.6, 0, 16, 'hazard');
      B(cx - 5.6, -42.6, cx + 5.6, -31.4, 15.2, 16.6, 'metal', { solid: false });
      B(cx - 1.5, -60, cx + 1.5, -24, 16.6, 18.2, 'metal', { solid: false });   // boom out over the water
      B(cx - 2.4, -38, cx + 2.4, -34, 12.6, 15.2, 'container', { solid: false }); // operator cab
    };
    // floors
    floor(-62, -44, 62, -26, 'concrete');
    floor(-62, -26, 62, 20, 'asphalt');
    floor(-62, 20, 30, 44, 'asphaltCracked');
    floor(30, 22, 54, 44, 'concrete');
    floor(54, 20, 62, 44, 'asphaltCracked'); floor(30, 20, 54, 22, 'asphaltCracked');
    // perimeter: quay edge railing over the water (north), port fence walls elsewhere
    B(-64, -44.6, 64, -44, 0, 1.05, 'trim');
    B(-64, -45.4, 64, -44.6, -1.8, 0, 'concrete', { solid: false });
    B(-64, 44, 64, 46, 0, 8, 'concreteDark');
    B(-64, -46, -62, 46, 0, 8, 'concreteDark');
    B(62, -46, 64, 46, 0, 8, 'concreteDark');
    for (let x = -58; x <= 58; x += 8) B(x - 0.22, -43.6, x + 0.22, -43.15, 0, 0.6, 'metal', { solid: false });   // bollards
    // quay: two gantry cranes (the east one stands over site A)
    crane(-12); crane(44);
    // quay cover
    cont(-34, -37, false); cont(-34, -37, false, 1); crate(-26, -32, 1.4, 1.4); crate(-24.6, -32, 1.4, 1.4); crate(-25.3, -32, 1.3, 1.3, 'crate', 1.4);
    cont(8, -39, false); cont(14, -32, true); crate(22, -38, 1.5, 1.5, 'crateMil');
    // site A (north-east quay)
    cont(41, -29, false); crate(48, -37, 1.6, 1.6, 'crateMil'); crate(48, -35.4, 1.6, 1.6, 'crateMil'); cont(36, -38, true);
    // container yard: three rows with gaps for the lanes, single and double stacks
    for (const [x, two] of [[-31, 0], [-21, 0], [-11, 1], [3, 0], [13, 1], [23, 0]]) { cont(x, -19.5, false); if (two) cont(x, -19.5, false, 1); }
    for (const [x, two] of [[-27, 1], [-13, 0], [-1, 1], [11, 0], [24, 1]]) { cont(x, -5.5, false); if (two) cont(x, -5.5, false, 1); }
    for (const [x, two] of [[-31, 0], [-19, 1], [-5, 0], [7, 1], [19, 0]]) { cont(x, 9.5, false); if (two) cont(x, 9.5, false, 1); }
    cont(-6, 1.8, true); cont(16, 2.2, true); crate(30, -6, 1.6, 1.6); crate(31.6, -6, 1.6, 1.6); crate(30.8, -6, 1.4, 1.4, 'crate', 1.6);
    // south: road to the warehouse, offices and a guard booth
    B(-20, 28, -6, 40, 0, 6, 'plaster'); B(-20, 27.6, -6, 28, 5.6, 6.4, 'trim', { solid: false });
    B(-44, -14, -40, -10, 0, 3, 'metal'); B(-44.3, -14.3, -39.7, -9.7, 3, 3.3, 'roof', { solid: false });
    cont(-36, 26, false); cont(4, 34, true); crate(12, 26, 1.5, 1.5); crate(13.5, 26, 1.5, 1.5);
    // warehouse = site B: walls with three doors, roof, racks and crates inside
    B(30, 22, 38, 22.5, 0, 7, 'brick2'); B(44, 22, 54, 22.5, 0, 7, 'brick2'); B(38, 22, 44, 22.5, 4.2, 7, 'brick2');
    B(30, 22, 30.5, 27, 0, 7, 'brick2'); B(30, 32, 30.5, 44, 0, 7, 'brick2'); B(30, 27, 30.5, 32, 4.2, 7, 'brick2');
    B(53.5, 22, 54, 33, 0, 7, 'brick2'); B(53.5, 37, 54, 44, 0, 7, 'brick2'); B(53.5, 33, 54, 37, 4.2, 7, 'brick2');
    B(30, 22, 54, 44, 7, 7.4, 'roof', { faces: ['ny', 'py'] }); indoor.push([30, 22, 54, 44, 7]);
    B(39, 31.5, 47, 32.5, 0, 2.6, 'metal'); B(39, 37.5, 47, 38.5, 0, 2.6, 'metal');
    crate(35, 26, 1.6, 1.6, 'crateMil'); crate(35, 27.6, 1.6, 1.6, 'crateMil'); crate(35, 26.8, 1.5, 1.5, 'crateMil', 1.6);
    cont(48, 41, false); crate(50, 27, 1.6, 1.6); crate(38, 41.5, 1.5, 1.5);
    // Vanguard pier and Raven docks cover
    crate(52, -14, 1.6, 1.6, 'crateMil'); cont(58, 14, true); crate(-50, 12, 1.6, 1.6); cont(-52, -24, false);
    // sodium street lamps (and a few cold floodlights on the cranes)
    for (const [x, z] of [[-48, -30], [-24, -28], [0, -28], [24, -28], [-40, 0], [-18, -12], [6, -12], [30, 0], [-30, 18], [-4, 18], [22, 18], [-50, 34], [14, 38], [58, 0], [58, 28]]) post(x, z);
    lamp(-12, 14, -37, 22, 1.2, 'white'); lamp(44, 14, -37, 22, 1.2, 'white');   // white crane floodlights (blue ones read as Vanguard)
    lamp(36, 6.5, 28, 12, 1.0); lamp(48, 6.5, 28, 12, 1.0); lamp(36, 6.5, 38, 12, 1.0); lamp(48, 6.5, 38, 12, 1.0);
    // navigation grid: points every 3 m clear of solid boxes, plus the doors
    const free = (x, z) => !boxes.some(b => b.solid && x > b.min[0] - 0.7 && x < b.max[0] + 0.7 && z > b.min[2] - 0.7 && z < b.max[2] + 0.7 && b.min[1] < 1.8 && b.max[1] > 0.2);
    const wp = [];
    for (let x = -60; x <= 60; x += 3) for (let z = -42; z <= 42; z += 3) if (free(x, z)) wp.push([x, z]);
    for (const p of [[41, 22.2], [41, 20.5], [41, 24], [30.2, 29.5], [28.5, 29.5], [32, 29.5], [53.8, 35], [55.5, 35], [52, 35]]) wp.push(p);
    Object.assign(data, HARBOR);
    data.waypoints = wp;
  }
  /* ================= DUSTLINE: desert town at midday ================= */
  /* ---------------- MERIDIAN: office tower floor (hostage rescue) ----------------
     Building x -36..24, z -22..22, ceiling at 3.6 m. Vanguard arrive from the east street (rescue zone);
     Raven hold the hostages in the conference room (A, north-west) and the executive suite (B, south-west). */
  function defineMeridian() {
    const H = 3.6, T = 0.15, office = [], doors = [];   // doors: navigation points through every opening
    // axis-aligned wall with door gaps ([from, to] along its length); lintel above each door
    const wallX = (x, z0, z1, gaps, mat) => { (gaps || []).forEach(([g0, g1]) => doors.push([x, (g0 + g1) / 2, 1, 0])); let a = z0; for (const [g0, g1] of (gaps || []).concat([[z1, z1]])) {
        if (g0 > a) B(x - T, a, x + T, g0, 0, H, mat || 'officewall'); if (g1 > g0) B(x - T, g0, x + T, g1, 2.4, H, mat || 'officewall', { solid: false }); a = g1; } };
    const wallZ = (z, x0, x1, gaps, mat) => { (gaps || []).forEach(([g0, g1]) => doors.push([(g0 + g1) / 2, z, 0, 1])); let a = x0; for (const [g0, g1] of (gaps || []).concat([[x1, x1]])) {
        if (g0 > a) B(a, z - T, g0, z + T, 0, H, mat || 'officewall'); if (g1 > g0) B(g0, z - T, g1, z + T, 2.4, H, mat || 'officewall', { solid: false }); a = g1; } };
    const room = (x0, z0, x1, z1, mat) => mat === 'officetile' ? floor(x0, z0, x1, z1, mat) : B(x0, z0, x1, z1, -0.19, 0.012, mat, { solid: false, faces: ['py'] });   // carpets sit 1 cm above the tiles (no z-fighting)
    const furn = (k, x, z, r, w, d, h) => { office.push({ k, x, z, r: r || 0 }); if (w) { const c = Math.abs(Math.cos(r || 0)) > 0.5, hw = (c ? w : d) / 2, hd = (c ? d : w) / 2; B(x - hw, z - hd, x + hw, z + hd, 0, h, 'crate', { solid: true, faces: [] }); } };
    const light = (x, z, i) => lamp(x, 3.35, z, 9, i || 1.0, 'white');
    // ground: street / parking / alley asphalt, back yard concrete
    floor(-50, -36, 48, 34, 'asphalt');
    floor(-50, -36, -36, 34, 'concrete');
    // perimeter (neighbouring buildings / fences)
    B(-52, -38, 50, -36, 0, 7, 'brick'); B(-52, 34, 50, 36, 0, 7, 'brick'); B(-52, -38, -50, 36, 0, 7, 'concreteDark'); B(48, -38, 50, 36, 0, 7, 'brick2');
    // building shell: concrete facade, plaster lining inside, ceiling and roof
    const shellX = (x, gaps) => { wallX(x, -22, 22, gaps, 'concrete'); };
    const shellZ = (z, gaps) => { wallZ(z, -36, 24, gaps, 'concrete'); };
    shellZ(-22, [[2, 4.5]]); shellZ(22, [[-6, -2.5]]); shellX(-36, [[-1.5, 1.5]]); shellX(24, [[-3, 3]]);
    B(-36.3, -22.3, 24.3, 22.3, H, H + 0.25, 'ceiling', { solid: true, faces: ['ny'] });
    B(-36.3, -22.3, 24.3, 22.3, H + 0.25, H + 0.6, 'roof', { solid: true, faces: ['py', 'px', 'nx', 'pz', 'nz'] });
    B(-36.5, -22.5, 24.5, 22.5, H + 0.6, H + 1.1, 'concrete', { solid: false, faces: ['px', 'nx', 'pz', 'nz'] });   // parapet
    // floors
    room(-36, -22, 24, 22, 'officetile');             // corridors, lobby, service areas
    room(-12, -22, 12, -2, 'carpet');                 // open-plan office
    room(-28, -22, -12, -9, 'carpet');                // A: conference room
    room(-28, 8, -10, 22, 'carpet');                  // B: executive suite
    room(-10, 2, 12, 12, 'carpet');                   // break room
    room(0, 12, 24, 22, 'carpet'); room(12, 9, 24, 12, 'carpet');   // south cubicles
    // main corridor (z -2..2) walls with doors
    wallZ(-2, -28, 12, [[-24, -22], [-6, -4], [6, 8]]);
    wallZ(2, -28, 12, [[-20, -18], [-3, -1], [7, 9]]);
    // lobby (x 12..24, z -9..9): reception
    wallX(12, -9, -2); wallX(12, 2, 9);
    wallZ(-9, 12, 24, [[17, 19]]); wallZ(9, 12, 24, [[17, 19]]);
    B(18.5, -6, 21.5, -4.6, 0, 1.1, 'crate'); B(18.5, -6, 19.1, -2.5, 0, 1.1, 'crate');   // reception counter
    // north wing: kitchen | open office | storage + conference (A)
    wallX(12, -22, -9, [[-14, -12]]);                 // kitchen / open office
    wallX(-12, -22, -2, [[-16, -13]]);                // open office / conference
    wallZ(-9, -28, -12, [[-16, -14]]);                // conference / storage
    // west hall (x -36..-28): Raven side
    wallX(-28, -22, 22, [[-18, -16], [-6, -4], [-2, 2], [12, 14]]);
    // south wing: server room | executive suite (B) | service | break room | cubicles
    wallZ(8, -28, -10, [[-14, -12]]);                 // server room / suite
    wallX(-10, 8, 22, [[16, 18]]);                    // suite / service
    wallX(-10, 2, 8);                                 // server room / break room
    wallZ(12, -10, 0, [[-6, -4]]);                    // break room / service
    wallZ(12, 0, 12, [[5, 7]]);                       // break room / cubicles
    wallX(0, 12, 22, [[15, 17]]);                     // service / cubicles
    // furniture (visual models placed by BV.Real.placeOffice; invisible solid boxes here)
    for (const x of [-8, -3, 2, 7]) for (const z of [-18.5, -13, -7.5]) { if (x === 2 && z === -18.5) continue; furn('desk', x, z, 0, 1.45, 0.9, 0.85); furn('chair', x, z + 0.9, Math.PI); }
    furn('bookcase', -2, -21.4, 0, 2.4, 0.45, 1.6); furn('bookcase', 8, -21.4, 0, 2.4, 0.45, 1.6);
    // A: conference table (three desks in a row) with chairs, cabinets
    for (const x of [-23.4, -20, -16.6]) { furn('desk', x, -15.5, 0, 1.45, 0.9, 0.85); furn('chair', x, -14.4, Math.PI); furn('chair', x, -16.6, 0); }
    furn('cabinet', -26.8, -11.5, Math.PI / 2, 2.2, 0.55, 1.6); furn('bookcase', -14, -21.4, 0, 2.4, 0.45, 1.6);
    // storage: cabinets and boxes
    furn('cabinet', -20, -8.5, Math.PI, 2.2, 0.55, 1.6); crate(-14.5, -5, 1.2, 1.2); crate(-14.5, -6.2, 1.0, 1.0, 'crate', 1.2); crate(-26, -4, 1.2, 1.2);
    // B: executive suite: big desk, bookcases, cabinet, sofa-like crates
    furn('desk', -19, 19.5, Math.PI, 1.45, 0.9, 0.85); furn('desk', -17.5, 19.5, Math.PI, 1.45, 0.9, 0.85); furn('chair', -18.3, 20.6, 0);
    furn('bookcase', -24, 21.4, Math.PI, 2.4, 0.45, 1.6); furn('bookcase', -13, 21.4, Math.PI, 2.4, 0.45, 1.6); furn('cabinet', -27.4, 14, -Math.PI / 2, 2.2, 0.55, 1.6);
    furn('chair', -22, 11, 0.4); furn('chair', -15, 11.5, -0.5);
    // server room: racks (metal boxes)
    for (const x of [-26, -23, -16, -13]) B(x - 0.5, 4.2, x + 0.5, 5.4, 0, 2.2, 'metal');
    // break room: tables, cabinets
    furn('desk', -6, 7, 0, 1.45, 0.9, 0.85); furn('desk', 4, 7, Math.PI / 2, 1.45, 0.9, 0.85); furn('chair', -6, 8, Math.PI); furn('chair', 3, 7, Math.PI / 2);
    furn('cabinet', 10.8, 6, -Math.PI / 2, 2.2, 0.55, 1.6);
    // south cubicles
    for (const x of [4, 9, 15, 20]) for (const z of [15, 19.5]) { furn('desk', x, z, Math.PI, 1.45, 0.9, 0.85); furn('chair', x, z - 0.9, 0); }
    // kitchen: counters
    B(13, -21.6, 23.6, -20.9, 0, 0.95, 'tile'); B(22.9, -20.9, 23.6, -14, 0, 0.95, 'tile'); crate(17, -15, 1.4, 0.9, 'crate');
    // service area: lockers
    for (const z of [13.2, 14.6]) B(-9.6, z - 0.6, -8.9, z + 0.6, 0, 2.0, 'metal');
    // ceiling lights
    for (const x of [-8, -2, 4, 10]) for (const z of [-18, -11, -5]) light(x, z, 0.95);
    for (const x of [-24, -16]) { light(x, -18); light(x, -12.5); light(x, 12); light(x, 18.5); light(x, 5); light(x, -5.5); }
    for (const x of [-32]) for (const z of [-16, -6, 4, 14]) light(x, z, 0.9);
    for (const x of [-20, -8, 4]) light(x, 0, 0.85);
    for (const [x, z] of [[18, -4], [18, 4], [18, -16], [18, 16], [6, 16], [-4, 7], [5, 7], [-5, 17], [12, 18.5]]) light(x, z);
    // outside: parked cars (crates as cover), barriers, bins
    crate(10, -30, 4.2, 1.5, 'container'); crate(-6, -30, 4.2, 1.5, 'container'); crate(-22, -30, 1.6, 1.6); barrel(-14, -26); barrel(-13.2, -26.6);
    B(30, -16, 31.2, -9, 0, 1.0, 'concreteDark'); B(30, 9, 31.2, 16, 0, 1.0, 'concreteDark');   // street barriers
    crate(38, -24, 1.6, 1.6); crate(39.6, -24, 1.6, 1.6); crate(38.8, -24, 1.5, 1.5, 'crate', 1.6); crate(40, 25, 4.2, 1.5, 'container');
    crate(-4, 28, 1.6, 1.6); barrel(2, 26); barrel(2.8, 26.8); crate(-20, 29, 4.2, 1.5, 'container');
    crate(-44, -12, 1.6, 1.6); crate(-44, 10, 1.6, 1.6, 'crateMil'); barrel(-41, -20); barrel(-41, 20);
    // navigation grid (2 m) over every free cell
    const free = (x, z) => !boxes.some(b => b.solid && x > b.min[0] - 0.45 && x < b.max[0] + 0.45 && z > b.min[2] - 0.45 && z < b.max[2] + 0.45 && b.min[1] < 1.8 && b.max[1] > 0.2);
    const wp = []; for (let x = -48; x <= 46; x += 2) for (let z = -34; z <= 32; z += 2) if (free(x, z)) wp.push([x, z]);
    // a node in each doorway plus one on either side, so the 2 m grid always connects through the openings
    for (const [x, z, nx, nz] of doors) for (const k of [0, -1.3, 1.3]) { const px = x + nx * k, pz = z + nz * k; if (free(px, pz) || k === 0) wp.push([px, pz]); }
    Object.assign(data, MERIDIAN); data.waypoints = wp; data.office = office;
  }
  const MERIDIAN = {
    name: 'MERIDIAN', mode: 'hostage', linkDist: 2.95, noCity: true, noWarehouse: true, noIndustrial: true,
    env: { sky: null, fog: 0xb9c2cc, hemiSky: 0xdce6f0, hemiGround: 0x8a8578, hemi: 0.95, sun: 0xfff1de, sunI: 2.4, exposure: 1.1 },
    spawns: {   // attack = the rescuers (Vanguard, east street), defend = the captors (Raven, west hall / yard)
      attack: [[38, -3], [38, 3], [41, 0], [35, 0], [41, -5], [41, 5], [35, -5]],
      defend: [[-32, -8], [-32, 8], [-32, 0], [-43, -4], [-43, 4], [-32, -14], [-32, 16]]
    },
    spawnCenter: { attack: [38, 0], defend: [-34, 0] },
    sites: [
      { name: 'A', min: [-28, -22], max: [-12, -9], center: [-20, -15.5], plant: [[-20, -12, 0]],
        defend: [[-13.5, -10.5, 0, -Math.PI * 0.75], [-26.5, -20.5, 0, Math.PI * 0.25], [-26.5, -10.5, 0, -Math.PI * 0.4], [-13.5, -20.5, 0, Math.PI * 0.6]] },
      { name: 'B', min: [-28, 8], max: [-10, 22], center: [-19, 15], plant: [[-19, 14, 0]],
        defend: [[-11.5, 9.5, 0, -Math.PI * 0.6], [-26.5, 20.5, 0, Math.PI * 0.75], [-26.5, 9.5, 0, -Math.PI * 0.3], [-11.5, 20.5, 0, Math.PI * 0.8]] }
    ],
    hostages: [[-23.5, -19.5, Math.PI * 0.85], [-16.5, -12, 0.15], [-22.5, 16.5, 0.3], [-14.5, 13.5, Math.PI * 0.9]],   // facing into their rooms
    rescue: { min: [28, -12], max: [47, 12] },
    routes: {
      A: [{ name: 'north', stage: [3, -27] }, { name: 'main', stage: [8, 0] }],
      B: [{ name: 'south', stage: [-4, 27] }, { name: 'main', stage: [8, 0] }]
    },
    midPatrol: [[0, 0], [-8, -12], [6, 16], [-24, 0], [16, 0]],
    links: [],
    zoneFn: (x, z) => {
      if (x > 24) return 'Street';
      if (x < -36) return 'Back Yard';
      if (z < -22) return 'Parking';
      if (z > 22) return 'Alley';
      const s = siteAt(x, z); if (s) return s.name === 'A' ? 'Conference (A)' : 'Executive Suite (B)';
      if (x < -28) return 'West Hall';
      if (Math.abs(z) < 2) return 'Main Corridor';
      if (x > 12 && Math.abs(z) < 9) return 'Lobby';
      if (z < -9 && x > 12) return 'Kitchen';
      if (z < -2 && x > -12) return 'Open Office';
      if (z < -2) return 'Storage';
      if (z < 8 && x < -10) return 'Server Room';
      if (z < 12 && x < 12) return 'Break Room';
      if (x < 0) return 'Service';
      return 'Cubicles';
    }
  };
  function defineDustline() {
    const house = (x0, z0, x1, z1, h) => { B(x0, z0, x1, z1, 0, h, 'adobe'); B(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, h, h + 0.35, 'adobe', { solid: false }); };   // flat roof with parapet lip
    const arch = (x, z0, z1) => { B(x - 0.6, z0, x + 0.6, z0 + 1.2, 0, 4.4, 'adobe'); B(x - 0.6, z1 - 1.2, x + 0.6, z1, 0, 4.4, 'adobe'); B(x - 0.6, z0, x + 0.6, z1, 3.5, 4.4, 'adobe', { solid: false }); };
    const stall = (x, z) => { for (const [dx, dz] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) B(x + dx - 0.07, z + dz - 0.07, x + dx + 0.07, z + dz + 0.07, 0, 2.5, 'crate', { solid: false });
      B(x - 1.7, z - 1.2, x + 1.7, z + 1.2, 2.5, 2.6, 'roof', { solid: false }); B(x - 1.3, z - 0.5, x + 1.3, z + 0.5, 0, 1.0, 'crate'); };
    const sandbags = (x0, z0, x1, z1) => B(x0, z0, x1, z1, 0, 1.25, 'dirt');
    // ground: sand everywhere, compacted streets
    floor(-62, -44, 62, 44, 'sand');
    // town wall
    B(-64, -46, 64, -44, 0, 7, 'adobe'); B(-64, 44, 64, 46, 0, 7, 'adobe'); B(-64, -46, -62, 46, 0, 7, 'adobe'); B(62, -46, 64, 46, 0, 7, 'adobe');
    // north row
    house(-44, -40, -32, -27, 5); house(-28, -43, -18, -30, 4.5); house(-12, -41, 0, -28, 6); house(6, -43, 18, -30, 5); house(20, -44, 28, -36, 4);
    // middle-north row (north alley between this row and the north one)
    house(-40, -22, -30, -9, 4); house(-24, -24, -13, -9, 5.5); house(-7, -22, 7, -9, 4.5); house(13, -24, 24, -8, 5);
    // middle-south row
    house(-40, 9, -28, 20, 5); house(-22, 8, -10, 22, 4); house(-4, 10, 10, 22, 6); house(16, 8, 26, 20, 4.5);
    // south row
    house(-44, 30, -30, 44, 5); house(-24, 28, -10, 40, 4.5); house(-4, 30, 12, 44, 5); house(18, 34, 28, 44, 4);
    // main street: arches, a well, carts and cover
    arch(-19, -9, 8); arch(10, -9, 8);
    B(-2.2, -2.2, 2.2, 2.2, 0, 0.9, 'adobe'); B(-1.6, -1.6, 1.6, 1.6, 0.9, 1.0, 'dirt', { solid: false });   // well
    crate(-32, 2, 1.5, 1.5); crate(-30.4, 2, 1.5, 1.5); crate(-31.2, 2, 1.4, 1.4, 'crate', 1.5);
    crate(18, -3, 1.5, 1.5, 'crateMil'); crate(24, 4, 1.6, 1.6); barrel(-10, -5); barrel(-9, -6); barrel(4, 6);
    sandbags(-46, -6, -44.5, 4);
    // site A: market square (north-east)
    stall(36, -36); stall(42, -30); stall(48, -38); crate(45, -25.5, 1.6, 1.6); barrel(38, -27); barrel(39, -26.4); crate(51, -30, 1.5, 1.5);
    house(30, -44, 36, -40, 4); house(54, -44, 62, -36, 5);
    // site B: military outpost (south-east): sandbag ring with gaps, concrete T-walls, a guard tower
    sandbags(31, 23, 40, 24.3); sandbags(45, 23, 53, 24.3); sandbags(31, 23, 32.3, 30); sandbags(31, 35, 32.3, 43);
    B(52.6, 26, 53.2, 31, 0, 3, 'concreteDark'); B(52.6, 34, 53.2, 40, 0, 3, 'concreteDark');
    B(38, 32, 41, 33.2, 0, 3, 'concreteDark'); crate(46, 36, 1.6, 1.6, 'crateMil'); crate(46, 37.6, 1.6, 1.6, 'crateMil'); crate(46, 36.8, 1.5, 1.5, 'crateMil', 1.6);
    for (const [tx, tz] of [[48, 28], [51, 28], [48, 31], [51, 31]]) B(tx - 0.15, tz - 0.15, tx + 0.15, tz + 0.15, 0, 5, 'metal');
    B(47.5, 27.5, 51.5, 31.5, 4.8, 5.1, 'crate', { solid: false }); B(47.5, 27.5, 51.5, 27.7, 5.1, 6.0, 'crate', { solid: false });
    B(36.9, 40.9, 37.1, 41.1, 0, 11, 'metal', { solid: false });   // radio mast
    // Raven dunes (west) and Vanguard camp (east) cover
    sandbags(-52, -18, -48, -16.7); crate(-50, 16, 1.6, 1.6); sandbags(52, -16, 56, -14.7); crate(57, 14, 1.6, 1.6, 'crateMil');
    // navigation grid
    const free = (x, z) => !boxes.some(b => b.solid && x > b.min[0] - 0.7 && x < b.max[0] + 0.7 && z > b.min[2] - 0.7 && z < b.max[2] + 0.7 && b.min[1] < 1.8 && b.max[1] > 0.2);
    const wp = []; for (let x = -60; x <= 60; x += 3) for (let z = -42; z <= 42; z += 3) if (free(x, z)) wp.push([x, z]);
    Object.assign(data, DUSTLINE); data.waypoints = wp;
  }
  const DUSTLINE = {
    name: 'DUSTLINE', linkDist: 7.5, noCity: true, noWarehouse: true,
    env: { sky: 'sky_desert', fog: 0xd9c8a2, hemiSky: 0xc8dcf0, hemiGround: 0xb08c5c, hemi: 1.0, sun: 0xfff0d4, sunI: 3.1, exposure: 1.02 },
    spawns: {
      attack: [[-56, -3], [-56, 3], [-53, 0], [-58, 0], [-53, -5], [-53, 5], [-58, -6]],
      defend: [[56, -3], [56, 3], [59, 0], [53, 0], [59, -6], [59, 6], [53, 6]]
    },
    spawnCenter: { attack: [-55, 0], defend: [56, 0] },
    sites: [
      { name: 'A', min: [32, -42], max: [54, -24], center: [43, -33], plant: [[43, -33, 0], [39, -38, 0], [47, -27, 0]],
        defend: [[51, -26, 0, Math.PI / 2], [50, -41, 0, Math.PI * 0.6], [44, -25, 0, Math.PI * 0.4], [34, -41, 0, Math.PI * 0.55], [52, -33, 0, Math.PI / 2]] },
      { name: 'B', min: [32, 24], max: [53, 43], center: [43, 33], plant: [[43, 34, 0], [36, 38, 0], [49, 26, 0]],
        defend: [[50, 25, 0, Math.PI * 0.75], [44, 41, 0, Math.PI * 0.6], [51, 38, 0, Math.PI * 0.5], [35, 26, 0, Math.PI * 0.85], [49, 33, 0, Math.PI * 0.7]] }
    ],
    routes: {
      A: [{ name: 'north', stage: [22, -26] }, { name: 'main', stage: [28, -6] }],
      B: [{ name: 'south', stage: [22, 25] }, { name: 'main', stage: [28, 6] }]
    },
    midPatrol: [[0, -5], [14, 0], [-14, 4], [3, -25], [4, 25]],
    links: [],
    zoneFn: (x, z) => {
      if (x < -44) return 'Raven Dunes';
      const s = siteAt(x, z); if (s) return s.name === 'A' ? 'Market (A)' : 'Outpost (B)';
      if (x > 54) return 'Vanguard Camp';
      if (Math.abs(z) < 8.5) return 'Main Street';
      if (z < -26) return 'North Quarter';
      if (z > 22) return 'South Quarter';
      return z < 0 ? 'North Alley' : 'South Alley';
    }
  };
  const HARBOR = {
    name: 'HARBOR-9',
    linkDist: 7.5,
    water: true,
    env: { sky: 'sky_harbor', fog: 0x1b2638, hemiSky: 0x9aaccc, hemiGround: 0x3a3c44, hemi: 1.25, sun: 0xc4d0f2, sunI: 1.35, exposure: 1.42 },   // brighter night (v4.7)
    spawns: {
      attack: [[-56, -3], [-56, 3], [-53, 0], [-58, 0], [-53, -5], [-53, 5], [-58, -6]],
      defend: [[56, -3], [56, 3], [59, 0], [53, 0], [59, -6], [59, 6], [53, 6]]
    },
    spawnCenter: { attack: [-55, 0], defend: [56, 0] },
    sites: [
      { name: 'A', min: [34, -42], max: [54, -26], center: [44, -34], plant: [[44, -35, 0], [40, -33, 0], [47, -40, 0]],
        defend: [[51, -28, 0, Math.PI / 2], [52, -40, 0, Math.PI * 0.6], [45, -27, 0, Math.PI * 0.4], [38, -41, 0, Math.PI * 0.55], [50, -33, 0, Math.PI / 2]] },
      { name: 'B', min: [31, 23], max: [53, 43], center: [42, 35], plant: [[42, 35, 0], [36, 40, 0], [49, 30, 0]],
        defend: [[50, 25, 0, Math.PI * 0.75], [45, 41, 0, Math.PI * 0.6], [51, 39, 0, Math.PI * 0.5], [37, 24, 0, Math.PI * 0.85], [48, 34, 0, Math.PI * 0.7]] }
    ],
    routes: {
      A: [{ name: 'quay', stage: [16, -36] }, { name: 'yard', stage: [28, -13] }],
      B: [{ name: 'road', stage: [18, 30] }, { name: 'yard', stage: [27, 15] }]
    },
    midPatrol: [[0, -12], [16, -12], [6, 2], [-10, 2], [28, 4]],
    links: [],
    zoneFn: (x, z) => {
      if (x < -44) return 'Raven Docks';
      const s = siteAt(x, z); if (s) return 'Site ' + s.name;
      if (z < -26) return 'Quay';
      if (x > 54) return 'Vanguard Pier';
      if (z > 20) return x < 30 ? 'South Road' : 'Warehouse';
      if (x > 28) return 'Pier Gate';
      return 'Container Yard';
    }
  };

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
  /* GoldSrc-style lightmap bake: ambient sky + sun with ray-cast shadows,
     contact occlusion and sodium lamps, all stored in vertex colours. */
  const BSUN = (() => { const v = [-0.55, 0.68, -0.48]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  const _o = { x: 0, y: 0, z: 0 }, _e = { x: 0, y: 0, z: 0 };
  function sunVisible(x, y, z, nx, ny, nz) {
    _o.x = x + nx * 0.06 + BSUN[0] * 0.02; _o.y = y + ny * 0.06 + 0.01; _o.z = z + nz * 0.06 + BSUN[2] * 0.02;
    _e.x = _o.x + BSUN[0] * 90; _e.y = _o.y + BSUN[1] * 90; _e.z = _o.z + BSUN[2] * 90;
    return BV.Physics.los(_o, _e) ? 1 : 0;
  }
  function bakeClassic(x, y, z, nx, ny, nz) {
    const inside = isIndoor(x, y, z);
    const sky = ny > 0.5 ? 1 : ny < -0.5 ? 0.55 : 0.8;
    let amb = (inside ? 0.36 : 0.5) * sky;
    let ao = 1;
    if (Math.abs(ny) < 0.5) ao *= 0.62 + 0.38 * Math.min(1, y / 2.2);
    if (ny > 0.5 && y < 0.05) ao *= floorAO(x, z);
    const nd = nx * BSUN[0] + ny * BSUN[1] + nz * BSUN[2];
    let sun = 0;
    if (!inside && nd > 0) sun = nd * sunVisible(x, y, z, nx, ny, nz) * 0.78;
    let r = amb * ao * 0.98 + sun * 1.0, g = amb * ao * 0.97 + sun * 0.9, b = amb * ao * 1.02 + sun * 0.74;
    for (const L of lamps) {
      const dx = x - L.x, dy = y - L.y, dz = z - L.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < L.r) {
        let k = (1 - d / L.r); k = k * k * L.i * (inside ? 3.0 : 1.3);
        const facing = d > 0.01 ? Math.max(0.2, -(dx * nx + dy * ny + dz * nz) / d) : 1;
        k *= facing * ao; r += k * L.c[0]; g += k * L.c[1]; b += k * L.c[2];
      }
    }
    // classic gamma: period renderers lifted lightmap mid-tones (brightness/gamma ramp)
    const gm = (v) => Math.min(1.6, Math.pow(Math.max(0, v), 0.82) * 1.05);
    return [gm(r), gm(g), gm(b)];
  }
  function bake(x, y, z, nx, ny, nz, mat) {
    if (BV.classic) return bakeClassic(x, y, z, nx, ny, nz);
    // Direct sunlight now comes from a real shadow-casting light; vertex colours
    // only carry ambient occlusion, interior darkening and sodium lamps.
    let c = ny < -0.5 ? 0.8 : 1.0;
    if (Math.abs(ny) < 0.5) c *= 0.55 + 0.45 * Math.min(1, y / 2.6);           // contact occlusion
    if (ny > 0.5 && y < 0.05) c *= floorAO(x, z);                               // floor AO near walls
    const inside = isIndoor(x, y, z);
    if (inside) c *= 0.5;
    let r = c, g = c * 0.98, b = c * 0.95;
    for (const L of lamps) {
      const dx = x - L.x, dy = y - L.y, dz = z - L.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < L.r) {
        let k = (1 - d / L.r); k = k * k * L.i * (inside ? 2.4 : 1.4);
        const facing = d > 0.01 ? Math.max(0.25, -(dx * nx + dy * ny + dz * nz) / d) : 1;
        k *= facing; r += k * L.c[0]; g += k * L.c[1]; b += k * L.c[2];
      }
    }
    return [Math.min(r, 2), Math.min(g, 2), Math.min(b, 2)];
  }

  /* ---------------- geometry building ---------------- */
  const TEX_SCALE = BV.TEX_SCALE = { officewall: 2.2, carpet: 2.5, ceiling: 1.2, officetile: 1.6, sand: 4, adobe: 2.6, brick2: 2.4, asphaltCracked: 3, plate: 1.2, paintLow: 1.5, roadLine: 1, siteLine: 1, manhole: 1, drain: 1, concrete: 4, concreteDark: 4, brick: 1.6, plaster: 3, metal: 3, roof: 4, crate: 1.4, crateMil: 1.6, container: 3,
    asphalt: 2.6, tile: 3, dirt: 5, hazard: 1.2, window: 1, door: 1, car: 2, car2: 2, glass: 2, trim: 2, barrel: 1 };

  const ROUGH = { metal: 0.5, roof: 0.6, container: 0.55, hazard: 0.7, trim: 0.6, glass: 0.08, window: 0.15, door: 0.6, tile: 0.7, crateMil: 0.75 };
  const METAL = { metal: 0.45, roof: 0.35, container: 0.3, trim: 0.35, glass: 0.2, window: 0.3, door: 0.3 };
  const NORMAL_STR = { officewall: 0.7, carpet: 0.8, ceiling: 1.0, officetile: 1.2, sand: 1.3, adobe: 1.0, brick2: 2.6, asphaltCracked: 1.0, brick: 2.6, concrete: 1.0, concreteDark: 1.0, metal: 3, roof: 3, container: 4, crate: 2.6, crateMil: 1.4, asphalt: 0.9, tile: 1.8, dirt: 1.3, plaster: 1.1, door: 2 };

  const NO_RMAP = { window: 1, glass: 1, hazard: 1, door: 0, roadLine: 1, siteLine: 1, manhole: 1, drain: 1, paintLow: 0, plate: 0 };

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
        const cell = BV.classic ? (fk === 'py' || fk === 'ny' ? 0.6 : 0.9) : (fk === 'py' || fk === 'ny' ? 2 : 2.5);
        const nu = b.fit ? 1 : Math.max(1, Math.ceil(lu / cell)), nv = b.fit ? 1 : Math.max(1, Math.ceil(lv / cell));
        const pt = (i, j) => [o[0] + U[0] * i / nu + V[0] * j / nv, o[1] + U[1] * i / nu + V[1] * j / nv, o[2] + U[2] * i / nu + V[2] * j / nv];
        const bi = boxes.indexOf(b), uo = ((bi * 0.618) % 1), vo = ((bi * 0.382) % 1);
        const uvOf = (p, i, j) => {
          if (b.fit) return [i / nu, j / nv];
          if (fk === 'py' || fk === 'ny') return [p[0] / sc + uo, p[2] / sc + vo];
          return [p[F.uc] * F.us / sc + uo, p[1] / sc];
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
      const ns = NORMAL_STR[mat];
      const m = BV.classic ? new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: BV.Textures.make(mat), vertexColors: true })) : new THREE.Mesh(geo, BV.mat({
        map: BV.Textures.make(mat), vertexColors: true,
        normalMap: ns ? BV.Textures.normal(mat, ns) : null, normalScale: new THREE.Vector2(1, 1),
        roughnessMap: NO_RMAP[mat] ? null : BV.Textures.roughness(mat, ROUGH[mat] !== undefined ? ROUGH[mat] : 0.92, 0.7),
        roughness: NO_RMAP[mat] ? (ROUGH[mat] !== undefined ? ROUGH[mat] : 0.92) : 1, metalness: METAL[mat] || 0, envMapIntensity: 0.6
      }));
      m.castShadow = true; m.receiveShadow = true;
      m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m); meshes.push(m);
    }
    // cylinders (barrels, pipes)
    const barrelTex = barrelTexture();
    for (const c of cyls) {
      let mesh;
      if (c.mat === 'barrel') {
        const shade = isIndoor(c.x, 0.5, c.z) ? 0.5 : 0.95;
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 18), BV.mat({ map: barrelTex, roughness: 0.55, metalness: 0.45, color: new THREE.Color(shade, shade * 0.97, shade * 0.9) }));
        const rim = new THREE.Mesh(new THREE.TorusGeometry(c.r, 0.025, 6, 18), BV.mat({ color: 0x2b3a36, roughness: 0.5, metalness: 0.6 }));
        rim.rotation.x = Math.PI / 2; rim.position.y = c.h / 2 - 0.02; mesh.add(rim);
        const rim2 = rim.clone(); rim2.position.y = -0.1; mesh.add(rim2);
        mesh.position.set(c.x, c.h / 2, c.z); mesh.rotation.y = Math.random() * 6;
      } else if (c.mat === 'vpipe' || c.mat === 'tank') {
        const tank = c.mat === 'tank';
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, tank ? 20 : 8), BV.mat({ color: tank ? 0x5b5e57 : 0x3c3f3b, roughness: 0.6, metalness: 0.5, map: tank ? BV.Textures.make('metal') : null }));
        mesh.position.set(c.x, c.y + c.h / 2, c.z);
        if (tank) { const cap = new THREE.Mesh(new THREE.ConeGeometry(c.r * 1.03, 0.5, 20), mesh.material); cap.position.y = c.h / 2 + 0.25; mesh.add(cap); }
      } else {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 10), BV.mat({ color: 0x3a3e3a, roughness: 0.5, metalness: 0.6 }));
        mesh.rotation.z = Math.PI / 2; mesh.position.set(c.x + c.h / 2, c.y, c.z);
      }
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.updateMatrixWorld(true); scene.add(mesh);
    }
    let t1 = performance.now();
    buildProps(scene); BV.timings.props1 = performance.now() - t1; t1 = performance.now();
    buildAtmosphere(scene); BV.timings.atmos = performance.now() - t1; t1 = performance.now();
    // industrial wall dressing (not in the office)
    if (!data.noIndustrial) BV.Props.build(scene, boxes, isIndoor); BV.timings.props2 = performance.now() - t1; data.boxes = boxes;
    // lamp fixtures + glow sprites
    const glowMat = new THREE.SpriteMaterial({ map: BV.Textures.glow(), color: 0xffc070, transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    const glowMatCool = glowMat.clone(); glowMatCool.color = new THREE.Color(0x9cc4ff);
    const fixMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
    const bracketMat = BV.mat({ color: 0x2a2c2a, roughness: 0.5, metalness: 0.6 });
    const fixGeo = new THREE.BoxGeometry(0.42, 0.05, 0.22);
    const coolFix = new THREE.MeshBasicMaterial({ color: 0xcfe2ff, toneMapped: false });
    const lampGroup = new THREE.Group();
    const gp = [], gc = [];
    for (const L of lamps) {
      if (L.sky) continue;
      const f = new THREE.Mesh(fixGeo, L.c[2] > 0.9 ? coolFix : fixMat);
      f.position.set(L.x, L.y + 0.05, L.z); lampGroup.add(f);
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 0.22, 10, 1, true), bracketMat);
      hood.position.set(L.x, L.y + 0.18, L.z); lampGroup.add(hood);
      gp.push(L.x, L.y - 0.05, L.z); const cc = new THREE.Color(L.c[2] > 0.9 ? 0x9cc4ff : 0xffc070); gc.push(cc.r, cc.g, cc.b);
    }
    BV.Models.mergeTree(lampGroup); scene.add(lampGroup);
    // all lamp glows in a single draw call
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    scene.add(new THREE.Points(gg, new THREE.PointsMaterial({ map: BV.Textures.glow(), size: 1.5, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    // decals
    for (const d of decals) {
      const mat = BV.mat({ map: d.tex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9 });
      const isLit = !isIndoor(d.pos[0], d.pos[1], d.pos[2]); mat.color = new THREE.Color(isLit ? 1 : 0.7, isLit ? 1 : 0.68, isLit ? 1 : 0.65);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size, d.h || d.size), mat);
      m.position.set(d.pos[0], d.pos[1], d.pos[2]);
      m.lookAt(d.pos[0] + d.n[0], d.pos[1] + d.n[1], d.pos[2] + d.n[2]);
      m.receiveShadow = true; scene.add(m);
    }
    return meshes;
  }
  /* ---------------- detailed props ---------------- */
  function buildProps(scene) {
    const S = (o) => BV.mat(o);
    const bagMat = S({ map: burlapTexture(), roughness: 0.95, color: 0xb8a27c });
    const bagGeo = new THREE.SphereGeometry(0.5, 10, 6); bagGeo.scale(0.55, 0.2, 0.3);
    for (const p of props) {
      if (p.type === 'sandbags') {
        const g = new THREE.Group();
        const alongX = (p.x1 - p.x0) > (p.z1 - p.z0), len = alongX ? p.x1 - p.x0 : p.z1 - p.z0;
        const n = Math.max(2, Math.round(len / 0.52)), rows = Math.round(p.h / 0.2);
        for (let r = 0; r < rows; r++) for (let i = 0; i < n - (r % 2); i++) {
          const b = new THREE.Mesh(bagGeo, bagMat);
          const t = (i + 0.5 + (r % 2) * 0.5) / n * len;
          const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
          if (alongX) b.position.set(p.x0 + t, 0.1 + r * 0.19, cz + (Math.random() - 0.5) * 0.06);
          else { b.position.set(cx + (Math.random() - 0.5) * 0.06, 0.1 + r * 0.19, p.z0 + t); b.rotation.y = Math.PI / 2; }
          b.rotation.y += (Math.random() - 0.5) * 0.25; b.rotation.z = (Math.random() - 0.5) * 0.08;
          b.castShadow = true; b.receiveShadow = true; g.add(b);
        }
        BV.Models.mergeTree(g); scene.add(g);
      } else if (p.type === 'car') {
        const g = carModel(p.color); g.position.set(p.x, 0, p.z); g.rotation.y = p.rot; BV.Models.mergeTree(g); scene.add(g);
      } else if (p.type === 'puddle') {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), S({ color: 0x16181a, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.7, envMapIntensity: 0.7, polygonOffset: true, polygonOffsetFactor: -1 }));
        m.scale.set(p.w, p.d, 1); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.012, p.z); m.receiveShadow = true; scene.add(m);
      }
    }
  }
  /* ---------------- atmosphere & far scenery ---------------- */
  function facadeTexture(seed) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'), r = BV.U.rng(seed);
    g.fillStyle = '#2a2b2a'; g.fillRect(0, 0, 128, 256);
    const e = document.createElement('canvas'); e.width = 128; e.height = 256; const ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 256);
    for (let y = 6; y < 250; y += 12) for (let x = 6; x < 124; x += 10) {
      const lit = r() < 0.22;
      g.fillStyle = lit ? '#6b5a3a' : '#1b1d1e'; g.fillRect(x, y, 6, 7);
      if (lit) { ge.fillStyle = r() < 0.7 ? '#ffcc80' : '#bcd8ff'; ge.fillRect(x, y, 6, 7); }
    }
    const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(e);
    t.encoding = te.encoding = THREE.sRGBEncoding; return [t, te];
  }
  function buildAtmosphere(scene) {
    // distant industrial skyline beyond the compound walls
    const sky = new THREE.Group();
    const [ft, fe] = facadeTexture(5);
    const fm = BV.mat({ map: ft, emissiveMap: fe, emissive: 0xffffff, emissiveIntensity: BV.classic ? 0.5 : 0.9, roughness: 0.9, color: BV.classic ? 0x8c949b : 0x8a8a88 });
    const r = BV.U.rng(77);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.08, dist = 95 + r() * 70;
      const w = 10 + r() * 22, d = 10 + r() * 18, h = 12 + r() * 38;
      const geo = new THREE.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 14, uv.getY(k) * h / 28);
      const m = new THREE.Mesh(geo, fm); m.position.set(Math.cos(a) * dist * 1.15, h / 2 - 1, Math.sin(a) * dist); m.rotation.y = r() * 0.6;
      sky.add(m);
      if (r() < 0.3) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 22, 10), fm); ch.position.set(m.position.x + 3, h + 10, m.position.z); sky.add(ch); }
    }
    BV.Models.mergeTree(sky); scene.add(sky); data.skyline = sky;
    if (data.noCity) sky.visible = false;   // open desert horizon
    // two harbour gantry cranes
    const cm = BV.mat({ color: 0x7a2a1c, roughness: 0.7, metalness: 0.4 });
    const crane = (x, z, rot) => {
      const g = new THREE.Group();
      const leg = (lx, lz) => { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 34, 1.2), cm); l.position.set(lx, 17, lz); g.add(l); };
      leg(-8, -6); leg(8, -6); leg(-8, 6); leg(8, 6);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 70), cm); beam.position.set(0, 35, 8); g.add(beam);
      const beam2 = beam.clone(); beam2.position.x = 6; g.add(beam2);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), cm); cab.position.set(3, 31, 18); g.add(cab);
      for (let k = 0; k < 8; k++) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 17), cm); br.position.set(-8 + (k % 2) * 16, 6 + Math.floor(k / 2) * 7.5, 0); br.rotation.x = 0.8 * (k % 4 < 2 ? 1 : -1); g.add(br); }
      g.position.set(x, 0, z); g.rotation.y = rot; BV.Models.mergeTree(g); scene.add(g);
    };
    if (!data.noCity) { crane(110, -95, 0.4); crane(140, -60, 0.4); }
    if (BV.MAP_ID === 'sector17') {
    // sagging overhead cables
    const wm = BV.mat({ color: 0x151515, roughness: 0.6 });
    const cable = (a, b, sag) => {
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 4), wm); scene.add(m);
    };
    cable([-34, 7.6, -28.3], [-34, 9.6, -44], 1.2); cable([-22, 7.6, -28.3], [-20, 9.6, -44], 1.3); cable([8, 6.6, -28.3], [10, 9.6, -44], 1.2);
    cable([-30, 7.6, -9.7], [-30, 7.6, 9.7], 1.6); cable([-18, 7.6, -9.7], [-16, 7.6, 9.7], 1.8); cable([4, 6.6, -9.7], [6, 6.6, 9.7], 1.5);
    cable([-40.3, 7.4, -20], [-62, 9.6, -24], 1.4); cable([-40.3, 7.4, 20], [-62, 9.6, 18], 1.4);
    }
    // dry grass tufts and gravel (instanced)
    const gc = document.createElement('canvas'); gc.width = 64; gc.height = 64; const gg = gc.getContext('2d');
    for (let i = 0; i < 40; i++) { gg.strokeStyle = `rgb(${78 + Math.random() * 30 | 0},${80 + Math.random() * 25 | 0},${48 + Math.random() * 15 | 0})`; gg.lineWidth = 2; gg.beginPath(); const x = 8 + Math.random() * 48; gg.moveTo(x, 64); gg.quadraticCurveTo(x + (Math.random() - 0.5) * 10, 40, x + (Math.random() - 0.5) * 22, 10 + Math.random() * 30); gg.stroke(); }
    const gt = new THREE.CanvasTexture(gc); gt.encoding = THREE.sRGBEncoding;
    const tuftGeo = new THREE.PlaneGeometry(0.7, 0.55); tuftGeo.translate(0, 0.27, 0);
    const tg2 = tuftGeo.clone(); tg2.rotateY(Math.PI / 2);
    const both = new THREE.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(k => { const a = tuftGeo.toNonIndexed().attributes[k].array, b2 = tg2.toNonIndexed().attributes[k].array; const o = new Float32Array(a.length + b2.length); o.set(a); o.set(b2, a.length); both.setAttribute(k, new THREE.BufferAttribute(o, k === 'uv' ? 2 : 3)); });
    const spots = [];
    const free = (x, z) => !BV.Physics.collide(x, 0.05, z, 0.3, 0.5);
    for (let i = 0; i < 1600 && spots.length < 700; i++) {
      let x, z;
      if (i % 3 === 0) { x = -61 + r() * 20; z = -43 + r() * 86; }                                   // plaza
      else { const b = boxes[Math.floor(r() * boxes.length)]; if (!b.solid || b.max[1] < 3 || b.min[1] > 0.1) continue;   // wall bases
        const side = Math.floor(r() * 4); x = side < 2 ? b.min[0] + r() * (b.max[0] - b.min[0]) : (side === 2 ? b.min[0] - 0.25 : b.max[0] + 0.25);
        z = side >= 2 ? b.min[2] + r() * (b.max[2] - b.min[2]) : (side === 0 ? b.min[2] - 0.25 : b.max[2] + 0.25); }
      if (Math.abs(x) > 61.6 || Math.abs(z) > 43.6 || !free(x, z) || isIndoor(x, 0.5, z)) continue;
      spots.push([x, z]);
    }
    const im = new THREE.InstancedMesh(both, BV.mat({ map: gt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), spots.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    spots.forEach((p, i) => { q.setFromAxisAngle(BV.UP, r() * 6.28); const k = 0.6 + r() * 0.9; sc.set(k, k * (0.7 + r() * 0.6), k); ps.set(p[0], 0, p[1]); mtx.compose(ps, q, sc); im.setMatrixAt(i, mtx); });
    im.receiveShadow = true; scene.add(im);
    const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.12, 0), BV.mat({ color: 0x6f6a60, roughness: 0.95 }), 260);
    for (let i = 0; i < 260; i++) { const p = spots[i % spots.length]; q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); const k = 0.4 + r() * 1.3; sc.set(k, k * 0.6, k); ps.set(p[0] + (r() - 0.5) * 1.2, 0.03, p[1] + (r() - 0.5) * 1.2); mtx.compose(ps, q, sc); rock.setMatrixAt(i, mtx); }
    rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
    if (BV.MAP_ID === 'sector17') {
    // skylight panels + volumetric light shafts in the B hall
    const shaftC = document.createElement('canvas'); shaftC.width = 32; shaftC.height = 128; const sg = shaftC.getContext('2d');
    const lg = sg.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, 'rgba(255,240,215,0.9)'); lg.addColorStop(1, 'rgba(255,240,215,0)');
    sg.fillStyle = lg; sg.fillRect(0, 0, 32, 128);
    const hg = sg.createLinearGradient(0, 0, 32, 0); hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.3, 'rgba(0,0,0,0)'); hg.addColorStop(0.7, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
    sg.globalCompositeOperation = 'destination-out'; sg.fillStyle = hg; sg.fillRect(0, 0, 32, 128);
    const st = new THREE.CanvasTexture(shaftC);
    const shaftMat = new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: BV.classic ? 0.09 : 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x9aa6b2, toneMapped: false });
    for (const [x, z] of skylights) {
      const pnl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), panelMat); pnl.rotation.x = Math.PI / 2; pnl.position.set(x, 5.98, z); scene.add(pnl);
      for (let k = 0; k < 3; k++) {
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7.2), shaftMat);
        sh.position.set(x + 1.1, 2.6, z + 0.6); sh.rotation.set(0.0, k * Math.PI / 3, -0.32);
        scene.add(sh);
      }
    }
    }
  }
  function carModel(color) {
    const g = new THREE.Group();
    const paint = BV.mat({ color, roughness: 0.35, metalness: 0.55 });
    const dark = BV.mat({ color: 0x151515, roughness: 0.8 });
    const glass = BV.mat({ color: 0x222a2e, roughness: 0.05, metalness: 0.6 });
    const chrome = BV.mat({ color: 0xbfc4c6, roughness: 0.2, metalness: 1 });
    // body: box with chamfered top edges (move top verts inward)
    const body = new THREE.BoxGeometry(4, 0.75, 1.9, 4, 1, 2);
    const pos = body.attributes.position;
    for (let i = 0; i < pos.count; i++) { if (pos.getY(i) > 0) { pos.setZ(i, pos.getZ(i) * 0.94); if (Math.abs(pos.getX(i)) > 1.9) pos.setY(i, pos.getY(i) - 0.12); } }
    body.computeVertexNormals();
    const b = new THREE.Mesh(body, paint); b.position.y = 0.72; g.add(b);
    // cabin: trapezoid
    const cab = new THREE.BoxGeometry(2.2, 0.62, 1.66);
    const cp = cab.attributes.position;
    for (let i = 0; i < cp.count; i++) if (cp.getY(i) > 0) { cp.setX(i, cp.getX(i) * 0.72 - 0.1); cp.setZ(i, cp.getZ(i) * 0.86); }
    cab.computeVertexNormals();
    const c = new THREE.Mesh(cab, glass); c.position.set(-0.15, 1.38, 0); g.add(c);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.4), paint); roof.position.set(-0.25, 1.7, 0); g.add(roof);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16); wheelGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.27, 10); hubGeo.rotateX(Math.PI / 2);
    for (const [x, z] of [[1.3, 0.86], [1.3, -0.86], [-1.3, 0.86], [-1.3, -0.86]]) {
      const w = new THREE.Mesh(wheelGeo, dark); w.position.set(x, 0.36, z); g.add(w);
      const h = new THREE.Mesh(hubGeo, chrome); h.position.set(x, 0.36, z); g.add(h);
    }
    const bump = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 1.84), chrome); bump.position.set(2.02, 0.55, 0); g.add(bump);
    const bump2 = bump.clone(); bump2.position.x = -2.02; g.add(bump2);
    const lightM = new THREE.MeshBasicMaterial({ color: 0x5a1a14 });
    [[-2.03, 0.78, 0.7], [-2.03, 0.78, -0.7]].forEach(p => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.3), lightM); l.position.set(p[0], p[1], p[2]); g.add(l); });
    const headM = BV.mat({ color: 0xd8d4c4, roughness: 0.1, metalness: 0.4 });
    [[2.03, 0.8, 0.65], [2.03, 0.8, -0.65]].forEach(p => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.32), headM); l.position.set(p[0], p[1], p[2]); g.add(l); });
    const under = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.6), dark); under.position.y = 0.32; g.add(under);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  function burlapTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#9b8562'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 64; i += 2) { g.fillStyle = 'rgba(60,45,25,0.25)'; g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,30,15' : '200,180,140'},0.25)`; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 1); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function barrelTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#5a3b24'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2f5a52'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 14, 64, 3); g.fillRect(0, 46, 64, 3);
    g.fillStyle = 'rgba(130,70,30,0.5)'; for (let i = 0; i < 12; i++) g.fillRect(Math.random() * 64, Math.random() * 30, 2, 10 + Math.random() * 20);
    g.fillStyle = 'rgba(230,200,60,0.85)'; g.fillRect(20, 24, 24, 14);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ---------------- sky ---------------- */
  function buildSky(scene) {
    const tex = (BV.Real && BV.Real.skyTexture(data.env && data.env.sky)) || BV.Textures.make('sky', { size: 512, h: 256 });
    tex.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.SphereGeometry(400, 24, 12);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
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
      const d = Math.hypot(a.x - b.x, a.z - b.z); if (d > (data.linkDist || 24)) continue;
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
    if (data.zoneFn) return data.zoneFn(x, z);
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
    if (!built) { (BV.MAP_ID === 'harbor9' ? defineHarbor : BV.MAP_ID === 'dustline' ? defineDustline : BV.MAP_ID === 'meridian' ? defineMeridian : defineSector17)(); built = true; }
    BV.Physics.setBoxes(boxes);
    const T = (BV.timings = BV.timings || {}); let t0 = performance.now();
    buildGeometry(scene); T.geometry = performance.now() - t0; t0 = performance.now();
    buildSky(scene);
    if (!data.nodes) buildGraph(); T.graph = performance.now() - t0;
    return data;
  }

  data.lamps = lamps;
  data.sunVisible = (x, y, z) => !isIndoor(x, y, z) && sunVisible(x, y, z, 0, 1, 0) === 1;
  return { build, data, findPath, nearestNode, siteAt, nearestSite, zoneName, isIndoor, get boxes() { return boxes; } };
})();
