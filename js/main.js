/* =====================================================================
   main.js — engine bootstrap: renderer, scenes, cameras, game loop,
   UI state machine (menu / play / buy / pause / over) and the
   attract-mode camera that flies over SECTOR-17 behind the menu.
   ===================================================================== */
'use strict';
(function () {
  const canvas = document.getElementById('view');
  const E = window.BV.engine = {
    state: 'menu', thirdPerson: false, punch: 0, fpsT: 0, fpsN: 0, deathCam: 0,
    _v: new THREE.Vector3(), _v2: new THREE.Vector3()
  };

  /* ---------- height fog: ground haze that thickens near the floor ---------- */
  if (!BV.classic) {
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float fogDepth;\n\tvarying float vFogH;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tfogDepth = - mvPosition.z;\n\tvFogH = dot( viewMatrix[1].xyz, mvPosition.xyz - viewMatrix[3].xyz );\n#endif';
  THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment.replace('varying float fogDepth;', 'varying float fogDepth;\n\tvarying float vFogH;');
  THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n\tfloat fogFactor = smoothstep( fogNear, fogFar, fogDepth );\n\tfloat hFog = ( 1.0 - exp( - fogDepth * 0.02 ) ) * exp( - max( vFogH, 0.0 ) * 0.3 ) * 0.42;\n\tfogFactor = clamp( max( fogFactor, hFog ), 0.0, 1.0 );\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif';
  }

  /* ---------- renderer & scenes ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    document.getElementById('load-text').textContent = 'WebGL is not available in this browser. Enable hardware acceleration and reload.';
    return;
  }
  renderer.autoClear = false;
  renderer.setClearColor(0x55534d);
  renderer.outputEncoding = THREE.sRGBEncoding;
  // classic: plain sRGB output, no filmic tone curve (era-correct direct colour)
  renderer.toneMapping = BV.classic ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  if (BV.classic) document.body.classList.add('classic');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  E.renderer = renderer;
  const scene = E.scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8d8274, 35, 190);
  const camera = E.camera = new THREE.PerspectiveCamera(BV.settings.fov, 1, 0.05, 600);
  BV.camPos = camera.position;                // used by animation LOD
  camera.rotation.order = 'YXZ'; scene.add(camera);
  // lighting: sky/ground ambience + a low dusk sun with soft shadows
  // classic: these lights only shade models/props (Gouraud); the world uses its baked lightmap
  const hemi = E.hemi = new THREE.HemisphereLight(0xb4c2d2, 0x6a5840, BV.classic ? 0.75 : 0.95); scene.add(hemi);
  const sun = E.sun = new THREE.DirectionalLight(0xffd7a8, BV.classic ? 0.85 : 2.6);
  sun.position.set(-70, 28, -35); sun.target.position.set(0, 0, 0); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true;
  const SH_R = 46; // shadow frustum follows the camera; snapped to texels to avoid shimmering
  const sc = sun.shadow.camera; sc.left = -SH_R; sc.right = SH_R; sc.top = SH_R; sc.bottom = -SH_R; sc.near = 1; sc.far = 220;
  const sunDir = new THREE.Vector3(-70, 28, -35).normalize();
  function followShadow() {
    const texel = (SH_R * 2) / sun.shadow.mapSize.x, c = camera.position;
    const x = Math.round(c.x / texel) * texel, z = Math.round(c.z / texel) * texel;
    sun.target.position.set(x, 0, z); sun.position.set(x + sunDir.x * 90, sunDir.y * 90, z + sunDir.z * 90);
    sun.target.updateMatrixWorld();
  }
  sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2.5; sun.shadow.mapSize.set(2048, 2048);
  const vmScene = E.vmScene = new THREE.Scene();
  const vmCamera = E.vmCamera = new THREE.PerspectiveCamera(BV.classic ? 64 : 50, 1, 0.01, 10);   // narrower than the world FOV: weapons read larger and closer
  vmScene.add(vmCamera);
  const vmHemi = new THREE.HemisphereLight(0xc0c8d0, 0x4a4234, BV.classic ? 0.7 : 0.55); vmScene.add(vmHemi);
  const vmSun = new THREE.DirectionalLight(0xffe2bc, BV.classic ? 0.75 : 1.25); vmSun.position.set(-0.6, 1, 0.3); vmScene.add(vmSun);
  const vmRim = new THREE.DirectionalLight(0x8fb0d0, 0.45); vmRim.position.set(0.8, 0.2, 1); vmScene.add(vmRim);

  /* ---------- post-processing, muzzle light, dust ---------- */
  const post = E.post = new BV.PostFX(renderer);
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 10, 2); scene.add(muzzleLight);
  E.flashLight = (pos, k) => { muzzleLight.position.copy(pos); muzzleLight.intensity = Math.max(muzzleLight.intensity, 4 * (k || 1)); };
  const dustN = 420, dustPos = new Float32Array(dustN * 3), dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 24; dustPos[i * 3 + 1] = Math.random() * 6; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 24; dustSeed[i] = Math.random() * 100; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  dust.frustumCulled = false; scene.add(dust); dust.visible = !BV.classic;
  let dustT = 0;
  function updateDust(dt) {
    dustT += dt; const c = camera.position;
    for (let i = 0; i < dustN; i++) {
      let x = dustPos[i * 3], y = dustPos[i * 3 + 1], z = dustPos[i * 3 + 2]; const sd = dustSeed[i];
      x += Math.sin(dustT * 0.3 + sd) * 0.004 + 0.003; y += Math.sin(dustT * 0.5 + sd * 2) * 0.002; z += Math.cos(dustT * 0.25 + sd) * 0.004;
      // wrap around the camera
      if (x - c.x > 12) x -= 24; if (x - c.x < -12) x += 24; if (z - c.z > 12) z -= 24; if (z - c.z < -12) z += 24;
      if (y > 6) y = 0.1; if (y < 0) y = 6;
      dustPos[i * 3] = x; dustPos[i * 3 + 1] = y; dustPos[i * 3 + 2] = z;
    }
    dustGeo.attributes.position.needsUpdate = true;
    muzzleLight.intensity *= Math.exp(-dt * 30);
  }

  /* ---------- world ---------- */
  const t0 = performance.now();
  BV.Map.build(scene);
  // per-map environment (sky is picked by the map itself): light, fog colour, exposure, water
  (function applyMapEnv() {
    const env = BV.Map.data.env; if (!env) return;
    if (env.hemiSky !== undefined) { hemi.color.setHex(env.hemiSky); hemi.groundColor.setHex(env.hemiGround); hemi.intensity = env.hemi * (BV.classic ? 0.85 : 1); }
    if (env.sun !== undefined) { sun.color.setHex(env.sun); sun.intensity = env.sunI * (BV.classic ? 0.6 : 1); }
    if (env.fog !== undefined) scene.fog.color.setHex(env.fog);
    if (env.exposure) renderer.toneMappingExposure = env.exposure;
    if (BV.Map.data.water) {   // dark harbour water beyond the quay, with soft moving highlights
      const wm = new THREE.MeshStandardMaterial({ color: 0x0a1722, roughness: 0.18, metalness: 0.55 });
      wm.onBeforeCompile = (sh) => { sh.uniforms.uT = { value: 0 }; wm.userData.sh = sh;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; varying vec3 vWp;').replace('#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\n  { vec2 p = vWp.xz * 0.35; float a = sin(p.x * 1.7 + uT * 0.9) + sin(p.y * 2.3 - uT * 0.7) + sin((p.x + p.y) * 3.1 + uT * 1.3);\n    float b = cos(p.x * 2.1 - uT * 0.8) + cos(p.y * 1.5 + uT * 1.1); normal = normalize(normal + vec3(a, 0.0, b) * 0.06); }'); };
      const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), wm); water.rotation.x = -Math.PI / 2; water.position.set(0, -1.2, -45 - 150); scene.add(water);
      E.water = water;
    }
  })();
  BV.timings.mapTotal = performance.now() - t0; const tEnv = performance.now();
  // image-based lighting: capture the level once into a prefiltered env map (modern style only)
  if (!BV.classic) try {
    const shWas = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    const cubeRT = new THREE.WebGLCubeRenderTarget(96, { encoding: THREE.sRGBEncoding, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCam = new THREE.CubeCamera(0.5, 400, cubeRT); cubeCam.position.set(0, 4, 0); scene.add(cubeCam);
    cubeCam.update(renderer, scene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromCubemap(cubeRT.texture).texture;
    scene.environment = env; vmScene.environment = env; E.env = env;
    vmScene.traverse(o => { if (o.material) o.material.envMapIntensity = 0.8; });
    scene.remove(cubeCam); pmrem.dispose(); renderer.shadowMap.enabled = shWas;
  } catch (err) { console.warn('env map unavailable', err); }
  BV.timings.env = performance.now() - tEnv;
  BV.Effects.init(scene, vmScene);
  const game = E.game = new BV.Game(E);
  E.viewmodel = new BV.Viewmodel(vmScene, vmCamera);
  BV.HUD.init(game, E);
  BV.Menu.init(E);
  BV.Input.init(canvas);
  E.buildMs = Math.round(performance.now() - t0);

  /* ---------- settings ---------- */
  /* real point lights at interior lamps (count depends on quality) */
  const lampLights = [];
  function setLampLights(n) {
    while (lampLights.length > n) scene.remove(lampLights.pop());
    const cands = BV.Map.data.lamps.filter(L => BV.Map.isIndoor(L.x, L.y - 0.5, L.z) || L.sky).sort((a, b) => (b.sky ? 1 : 0) - (a.sky ? 1 : 0) || b.i - a.i);
    for (let i = lampLights.length; i < Math.min(n, cands.length); i++) {
      const L = cands[i];
      const pl = new THREE.PointLight(L.sky ? 0xc4d6ea : 0xffbe78, L.sky ? 1.5 : 1.25, L.r * 1.35, 2);
      pl.position.set(L.x, L.y - 0.3, L.z); scene.add(pl); lampLights.push(pl);
    }
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  E.QUALITY = {
    low:    { pr: 0.6,  shadow: 0,    far: 110, props: 0, lights: 0,  post: false, bloom: 0 },
    medium: { pr: 0.8,  shadow: 1024, far: 160, props: 1, lights: 2,  post: false, bloom: 0.45 },
    high:   { pr: 1.0,  shadow: 2048, far: 210, props: 2, lights: 8,  post: true,  bloom: 0.55 },
    ultra:  { pr: 1.0,  shadow: 4096, far: 260, props: 2, lights: 12, post: true,  bloom: 0.6 }
  };
  /* internal performance metrics: BV.stats() in the console */
  BV.stats = function () {
    const i = renderer.info;
    return { fps: Math.round(1000 / (E.frameMs || 16.7)), frameMs: +(E.frameMs || 0).toFixed(2), drawCalls: i.render.calls, triangles: i.render.triangles,
      geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0, quality: BV.settings.quality };
  };
  E.applySettings = function () {
    const s = BV.settings, Q = E.QUALITY[s.quality] || E.QUALITY.medium;
    if (!E.autoChanging) s.qualityMax = s.quality;   // a manual choice is the ceiling for automatic recovery
    const dpr = window.devicePixelRatio || 1;
    const q = s.quality === 'ultra' ? Math.min(dpr, 2) : s.quality === 'high' ? Math.min(dpr, 1.5) : Q.pr;
    renderer.setPixelRatio(q);
    const nLights = BV.classic ? 0 : Q.lights;
    if (lampLights.length !== nLights) setLampLights(nLights);
    BV.Props.setLevel(Q.props);
    post.mComp.uniforms.bloom.value = Q.bloom;
    post.enabled = !BV.classic && Q.post && s.postfx !== false;
    document.getElementById('vignette').style.display = post.enabled || BV.classic ? 'none' : '';
    const shadowSize = BV.classic ? 0 : Q.shadow;
    const wantShadows = shadowSize > 0;
    if (renderer.shadowMap.enabled !== wantShadows || sun.shadow.mapSize.x !== (shadowSize || sun.shadow.mapSize.x)) {
      renderer.shadowMap.enabled = wantShadows;
      if (wantShadows) sun.shadow.mapSize.set(shadowSize, shadowSize);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    canvas.style.imageRendering = 'auto';
    scene.fog.far = BV.classic ? Q.far * 0.85 : Q.far; scene.fog.near = BV.classic ? 30 : 35; camera.far = Q.far + 420; camera.updateProjectionMatrix();
    BV.HUD.fps(s.showFps, (E.fpsShown || 0) + ' FPS');
    resize();
  };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    post.setSize(w, h, renderer.getPixelRatio());
    camera.aspect = w / h; camera.updateProjectionMatrix();
    vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  E.applySettings();

  /* ---------- hooks used by game.js ---------- */
  E.uiBlocking = () => E.state !== 'play';
  E.zoomFov = () => {
    const p = game.player; const base = BV.settings.fov;
    if (!p || !p.alive || !p.zoom || !p.weapon) return base;
    const d = p.weapon.def;
    if (d.cls === 'sniper') return p.zoom === 1 ? 32 : 11;
    return 42;
  };
  E.onPlayerShot = (def, sil) => {
    E.viewmodel.shot(def, sil); E.punch += def.kick * (sil ? 0.75 : 0.9);
    const p = game.player, d = p.dir(E._v2); if (!sil) E.flashLight(p.eye(E._v).addScaledVector(d, 0.9), def.cls === 'pistol' ? 0.7 : 1.1);
    const mz = E.viewmodel.muzzleWorld(E._mz || (E._mz = new THREE.Vector3()), camera);
    BV.Effects.puff(mz.x, mz.y, mz.z, 0.12, 0.6, 0.18, 0xc8c4ba);
    const dx = d.x, dz = d.z;
    const eject = () => {
      const ej = E.viewmodel.ejectWorld(E._ej || (E._ej = new THREE.Vector3()), camera); if (!ej) return;
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      BV.Effects.ejectShell(ej, new THREE.Vector3(rx * (1.6 + Math.random() * 0.8) + p.vel.x - dx * 0.4, 1.7 + Math.random() * 0.7, rz * (1.6 + Math.random() * 0.8) + p.vel.z - dz * 0.4), def.cls);
    };
    if (def.cls === 'shotgun') setTimeout(eject, 260); else if (def.cls === 'sniper') setTimeout(eject, 520); else eject();
    if (BV.settings.viewBob !== false) E.camKick = (E.camKick || 0) + def.kick * 0.5;
  };
  E.playerMuzzle = (out) => E.viewmodel.muzzleWorld(out, camera);
  E.onRoundStart = () => {
    const p = game.player;
    E.viewmodel.equip(p.weapon.def, p.team); E.deathCam = 0; E.punch = 0;
  };
  E.onPlayerDeath = (att, def, head) => { BV.HUD.deathMessage(att, def, head); E.deathCam = 0; E.deathPos = game.player.pos.clone(); E.deathYaw = game.player.yaw; };
  E.onMatchOver = (winner) => {
    E.state = 'over'; BV.Input.unlock();
    const p = game.player, won = winner === p.team;
    const t = document.getElementById('mo-title');
    t.textContent = won ? 'VICTORY' : 'DEFEAT'; t.classList.toggle('lose', !won);
    document.getElementById('mo-score').innerHTML = `<span style="color:${BV.TEAMS.VANGUARD.css}">VANGUARD ${game.score.VANGUARD}</span> — <span style="color:${BV.TEAMS.RAVEN.css}">${game.score.RAVEN} RAVEN</span>`;
    const s = game.stats, acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
    document.getElementById('mo-stats').textContent = `Your record: ${p.kills} kills · ${p.deaths} deaths · ${s.heads} headshot hits · ${acc}% accuracy`;
    document.getElementById('matchover').classList.remove('hidden');
    BV.HUD.scoreboard(false); BV.HUD.buyMenu(false);
    BV.Audio.roundStinger(won);
  };

  /* ---------- UI state machine ---------- */
  const clickcatch = document.getElementById('clickcatch');
  function lockAndPlay() {
    E.state = 'play';
    clickcatch.classList.remove('hidden'); // shown until the lock succeeds
    BV.Input.lock();
  }
  clickcatch.addEventListener('click', () => { BV.Audio.resume(); BV.Input.lock(); });
  BV.Input.onLockChange = (locked) => {
    if (locked) { clickcatch.classList.add('hidden'); return; }
    if (E.state === 'play') pause();
  };
  E.startMatch = (opts) => {
    BV.Audio.resume(); BV.Audio.stopMusic(); BV.Audio.startAmbience();
    BV.Menu.hideMenu();
    document.getElementById('matchover').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    E.lastOpts = opts;
    game.newMatch(opts);
    BV.HUD.show(true);
    lockAndPlay();
  };
  function pause() {
    if (E.state !== 'play') return;
    E.state = 'pause';
    BV.HUD.scoreboard(false);
    document.getElementById('pause').classList.remove('hidden');
    clickcatch.classList.add('hidden');
  }
  E.resume = () => { document.getElementById('pause').classList.add('hidden'); lockAndPlay(); };
  E.restart = () => { document.getElementById('pause').classList.add('hidden'); E.startMatch(E.lastOpts || BV.Menu.opts); };
  E.toMenu = () => {
    E.state = 'menu';
    ['pause', 'matchover'].forEach(id => document.getElementById(id).classList.add('hidden'));
    clickcatch.classList.add('hidden');
    BV.HUD.show(false); BV.HUD.buyMenu(false); BV.HUD.scoreboard(false);
    game.clearEntities(); game.phase = 'menu'; game.chargeMesh.visible = false; BV.Effects.clear();
    BV.Audio.stopAmbience(); BV.Audio.startMusic();
    BV.Menu.showMenu('p-main');
    BV.Input.unlock();
  };
  E.openBuy = () => {
    if (E.state !== 'play' || game.canBuy() !== 'ok') { if (E.state === 'play') BV.HUD.notice(game.canBuy() === 'zone' ? 'Buying is only possible in your spawn zone' : 'Buy time is over', 'warn', 1.6); return; }
    E.state = 'buy'; BV.HUD.buyMenu(true); BV.Input.unlock();
  };
  E.closeBuy = () => { if (E.state !== 'buy') return; BV.HUD.buyMenu(false); lockAndPlay(); };

  BV.Input.listeners.key.push((code, down, ev) => {
    if (code === 'Tab' && (E.state === 'play' || E.state === 'buy')) BV.HUD.scoreboard(down);
    if (!down) return;
    // toggles (buy menu, camera) ignore the keyboard's auto-repeat: holding B used to open/close the menu ~30 times a second
    if (ev && ev.repeat && (code === 'KeyB' || code === 'KeyV')) return;
    if (code === 'KeyB') { const now = performance.now(); if (now - (E._buyToggleT || 0) < 300) return; E._buyToggleT = now; }
    if (code === 'KeyF' && E.state === 'play' && game.player && game.player.alive) E.viewmodel.inspect();
    if (code === 'KeyV' && E.state === 'play') { E.thirdPerson = !E.thirdPerson; BV.HUD.notice(E.thirdPerson ? 'Third-person view (V)' : 'First-person view (V)', '', 1.2); }
    if (code === 'KeyB') { if (E.state === 'play') E.openBuy(); else if (E.state === 'buy') E.closeBuy(); }
    if (code === 'Escape') {
      if (E.state === 'buy') E.closeBuy();
      else if (E.state === 'play' && !BV.Input.locked) pause();
    }
  });

  /* ---------- cameras ---------- */
  const flyPath = new THREE.CatmullRomCurve3([
    [-50, 7, -2], [-30, 9, -36], [5, 6, -38], [30, 11, -36], [46, 9, -22], [40, 8, 2], [12, 6, 0], [-20, 7, 4],
    [-30, 3, 35], [10, 3, 35], [34, 4.5, 30], [52, 4.5, 22], [44, 10, 6], [0, 14, -2], [-40, 10, 20]
  ].map(a => new THREE.Vector3(a[0], a[1], a[2])), true, 'centripetal');
  let flyT = Math.random();
  function menuCamera(dt) {
    flyT = (flyT + dt * 0.006) % 1;
    const p = flyPath.getPointAt(flyT), q = flyPath.getPointAt((flyT + 0.012) % 1);
    camera.position.copy(p); camera.lookAt(q.x, q.y - 0.8, q.z);
    camera.fov = 70; camera.updateProjectionMatrix();
  }
  function playCamera(dt) {
    const p = game.player;
    E.punch *= Math.exp(-dt * 12);
    const fov = E.zoomFov() + (game.player && game.player.sprint && !game.player.zoom ? 5 : 0);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 22); if (Math.abs(camera.fov - fov) < 0.3) camera.fov = fov; camera.updateProjectionMatrix(); }
    const sh = BV.Effects.shakeOffset();
    if (p.alive) {
      p.eye(camera.position);
      // weighty camera: head bob, landing dip (spring), strafe roll, recoil kick
      const spd = Math.hypot(p.vel.x, p.vel.z), bobOn = BV.settings.viewBob !== false && p.onGround;
      const bk = bobOn ? Math.min(1.2, spd / 4.6) * (p.sprint ? 1.5 : 1) : 0;
      E.camBobPh = (E.camBobPh || 0) + dt * (spd > 0.3 ? 3.2 + spd * 1.15 : 0);
      E.landY = E.landY || 0; E.landV = E.landV || 0;
      if (p.landSpeed > 3) { E.landV -= Math.min(0.9, p.landSpeed * 0.07); E.viewmodel.land(p.landSpeed); p.landSpeed = 0; }
      E.landV += -E.landY * 160 * dt; E.landV *= Math.max(0, 1 - 16 * dt); E.landY += E.landV * dt;
      camera.position.y += -Math.abs(Math.cos(E.camBobPh)) * 0.032 * bk + E.landY * 0.2;
      camera.position.x += Math.cos(p.yaw) * Math.sin(E.camBobPh) * 0.012 * bk; camera.position.z += -Math.sin(p.yaw) * Math.sin(E.camBobPh) * 0.012 * bk;
      const lateral = p.vel.x * Math.cos(p.yaw) - p.vel.z * Math.sin(p.yaw);
      E.roll = (E.roll || 0) + ((-lateral * 0.0045 + Math.sin(E.camBobPh) * 0.004 * bk) - (E.roll || 0)) * Math.min(1, dt * 8);
      E.camKick = (E.camKick || 0) * Math.exp(-dt * 14);
      E.strafe = BV.U.clamp(lateral / 4.6, -1, 1);
      camera.rotation.set(p.pitch + E.punch + E.camKick + (Math.random() - 0.5) * sh * 0.1, p.yaw + (Math.random() - 0.5) * sh * 0.1, E.roll);
      // third-person view (V): over the right shoulder, pulled in when a wall is behind
      if (E.thirdPerson) {
        const fwd = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation), right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation), eye = camera.position.clone();
        let d = 2.4; for (let s = 0.3; s <= 2.4; s += 0.15) { const c = eye.clone().addScaledVector(fwd, -s).addScaledVector(right, 0.55 * s / 2.4); if (!BV.Physics.los(eye, c)) { d = Math.max(0.35, s - 0.3); break; } }
        camera.position.addScaledVector(fwd, -d).addScaledVector(right, 0.55 * d / 2.4); camera.position.y += 0.12 * d / 2.4;
      }
      if (p.model) p.model.root.visible = !!E.thirdPerson;
    } else {
      const sp = game.spectate;
      if (sp && sp.t > 0 || !sp || !sp.target) {
        // death cam: rise above the body looking down at it
        E.deathCam += dt;
        const k = Math.min(1, E.deathCam / 1.5), dp = E.deathPos || p.pos;
        camera.position.set(dp.x + Math.sin(E.deathYaw) * 2.2 * k, dp.y + 0.6 + k * 2.6, dp.z + Math.cos(E.deathYaw) * 2.2 * k);
        camera.lookAt(dp.x, dp.y + 0.2, dp.z);
      } else {
        const t = sp.target, eye = t.eye(E._v);
        const fwd = t.dir(E._v2).setY(0).normalize();
        const back = new THREE.Vector3(-fwd.x, 0.28, -fwd.z).normalize();
        const hit = BV.Physics.raycast(eye, back, 2.8);
        const d = hit ? Math.max(0.3, hit.dist - 0.25) : 2.8;
        camera.position.copy(eye).addScaledVector(back, d);
        camera.lookAt(eye.x + fwd.x * 6, eye.y - 0.2, eye.z + fwd.z * 6);
      }
    }
    BV.Audio.setListener(camera.position.x, camera.position.y, camera.position.z, p.alive ? p.yaw : Math.atan2(-(E._v2.x || 0), -(E._v2.z || 1)));
  }

  /* ---------- main loop ---------- */
  let last = performance.now();
  E.frameErrors = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; if (dt <= 0) dt = 0.001;
    try { step(dt); } catch (err) { E.frameErrors++; if (E.frameErrors < 5) console.error(err); }
    E.fpsN++; E.fpsT += dt;
    if (E.fpsT >= 0.5) { E.fpsShown = Math.round(E.fpsN / E.fpsT); E.fpsN = 0; E.fpsT = 0; BV.HUD.fps(BV.settings.showFps, E.fpsShown + ' FPS'); }
    // frame-time metrics (exponential average) for adaptive quality and BV.stats()
    if (E.water && E.water.material.userData.sh) E.water.material.userData.sh.uniforms.uT.value += dt;
    E.frameMs = E.frameMs ? E.frameMs * 0.95 + dt * 1000 * 0.05 : dt * 1000;
    // adaptive quality with hysteresis: drop one level after ~4 s below 40 FPS, recover one level
    // after ~15 s above 58 FPS (never above the level the player chose), at most one change per 8 s
    if (E.state === 'play' && BV.settings.autoQuality !== false && document.visibilityState === 'visible') {
      const order = ['low', 'medium', 'high', 'ultra'], cur = order.indexOf(BV.settings.quality);
      if (BV.settings.qualityMax === undefined || order.indexOf(BV.settings.qualityMax) < 0) BV.settings.qualityMax = BV.settings.quality;
      const max = order.indexOf(BV.settings.qualityMax), fps = 1000 / E.frameMs;
      E.aqCool = Math.max(0, (E.aqCool || 0) - dt);
      E.aqLow = fps < 40 ? (E.aqLow || 0) + dt : Math.max(0, (E.aqLow || 0) - dt * 2);
      E.aqHigh = fps > 58 ? (E.aqHigh || 0) + dt : 0;
      let to = -1;
      if (E.aqLow > 4 && cur > 0) to = cur - 1;
      else if (E.aqHigh > 15 && cur < max) to = cur + 1;
      if (to >= 0 && E.aqCool <= 0) {
        BV.settings.quality = order[to]; E.autoChanging = true; BV.saveSettings && BV.saveSettings(); E.applySettings(); E.autoChanging = false;
        E.aqLow = E.aqHigh = 0; E.aqCool = 8;
        if (BV.HUD.notice) BV.HUD.notice('Calidad automática: ' + order[to].toUpperCase());
      }
    }
  }
  function step(dt) {
    renderer.info.autoReset = false; renderer.info.reset();   // per-frame totals (world + view-model) for BV.stats()
    const playing = E.state === 'play' || E.state === 'buy';
    if (E.state === 'menu') {
      menuCamera(dt);
      BV.Effects.update(dt);
    } else if (playing || E.state === 'over') {
      // fixed sub-steps keep physics stable on slow frames
      // fixed sub-steps only below 30 FPS, and only the simulation is sub-stepped: animation,
      // model sync and radar spotting run once per rendered frame (no slow-frame spiral)
      const n = dt > 1 / 30 ? 2 : 1, h = dt / n;
      const mdx = BV.Input.mouse.dx, mdy = BV.Input.mouse.dy;
      for (let i = 0; i < n; i++) {
        if (E.state !== 'over') BV.Player.update(game, h, E);
        game.lightStep = i < n - 1;
        game.update(h);
        if (i === 0 && n > 1) BV.Input.endFrame(); // edges/mouse deltas are consumed once
      }
      game.lightStep = false;
      BV.Effects.update(dt);
      playCamera(dt);
      const p = game.player;
      E.viewmodel.update(dt, {
        speed: Math.hypot(p.vel.x, p.vel.z), onGround: p.onGround, crouch: p.crouch > 0.5, sprint: p.sprint,
        mdx, mdy,
        kit: !!p.hasKit, silT: p.silT || 0, silOn: !!p.silOn, silenced: !!(p.weapon && p.weapon.def.silencer && p.weapon.silenced !== false),
        busy: p.planting || p.defusing, planting: !!p.planting, defusing: !!p.defusing, visible: p.alive && !E.thirdPerson && !(p.zoom && p.weapon && p.weapon.def.zoom), strafe: E.strafe || 0
      });
      BV.HUD.update(dt);
    } else if (E.state === 'pause') {
      // world frozen; keep rendering the current frame
    }
    BV.Input.endFrame();
    updateDust(dt);
    BV.Props.update(performance.now() / 1000);
    if (renderer.shadowMap.enabled) {
      // shadow map: every frame on High/Ultra, every 2nd frame on Low/Medium
      E.shadowFrame = (E.shadowFrame || 0) + 1;
      const every = (BV.settings.quality === 'high' || BV.settings.quality === 'ultra') ? 1 : 2;
      renderer.shadowMap.autoUpdate = false;
      if (E.shadowFrame % every === 0) { followShadow(); renderer.shadowMap.needsUpdate = true; }
    }
    const vm = playing && game.player && game.player.alive;
    if (post.enabled) {
      post.begin();
      renderer.render(scene, camera);
      if (vm) { renderer.clearDepth(); renderer.render(vmScene, vmCamera); }
      post.end(dt, 0);
    } else {
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
      if (vm) { renderer.clearDepth(); renderer.render(vmScene, vmCamera); }
    }
  }

  // skinned operator models are decoded asynchronously; the menu opens once they are ready
  document.getElementById('load-text').textContent = 'Deploying operators…';
  requestAnimationFrame(frame);
  Promise.all([BV.CharModels.load(), BV.Textures.whenReady()]).then(([ok]) => {
    E.operatorsLoaded = ok;
    // a match started before the animated packs finished loading: swap the weapon in hand for its animated version
    try { const V = E.viewmodel; if (V && V.def && !V.pack && BV.Real.fpPack && BV.Real.fpPack(V.def.id)) V.equip(V.def, V.team); } catch (err) { console.warn('re-equip skipped', err); }
    try {
      if (BV.Real.placeCity(scene) && BV.Map.data.skyline) BV.Map.data.skyline.visible = false;
      E.outpostPieces = BV.Real.placeOutpost(scene);
      BV.Real.placeWarehouse(scene);
      E.kitProps = BV.Real.dressMap(scene);
    } catch (err) { console.warn('scenery dressing failed', err); }
    // shader warm-up: compile operator, weapon and arm programs now instead of on first sight
    try {
      const tmp = new THREE.Group(); scene.add(tmp);
      for (const t of ['VANGUARD', 'RAVEN']) { const m = BV.CharModels.ready ? BV.CharModels.create(t) : null; if (m) { m.setWeapon(BV.WEAPONS.arx17); tmp.add(m.root); } }
      for (const id of ['viper9', 'specter9', 'hammer12', 'arx17', 'halberd4', 'lynx7']) { const w = BV.Models.gun(BV.WEAPONS[id].model); if (w) tmp.add(w.group); }
      tmp.position.set(0, -50, 0); renderer.compile(scene, camera); scene.remove(tmp);
    } catch (err) { console.warn('shader warm-up skipped', err); }
    document.getElementById('loading').classList.add('hidden');
    BV.Menu.showMenu('p-main');
  });

  /* debug/test handle */
  window.BV_DEBUG = { engine: E, game };
})();
