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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  E.renderer = renderer;
  const scene = E.scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8d8274, 35, 190);
  const camera = E.camera = new THREE.PerspectiveCamera(BV.settings.fov, 1, 0.05, 600);
  camera.rotation.order = 'YXZ'; scene.add(camera);
  // lighting: sky/ground ambience + a low dusk sun with soft shadows
  scene.add(new THREE.HemisphereLight(0xb4c2d2, 0x6a5840, 0.95));
  const sun = E.sun = new THREE.DirectionalLight(0xffd7a8, 2.6);
  sun.position.set(-70, 28, -35); sun.target.position.set(0, 0, 0); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -82; sc.right = 82; sc.top = 82; sc.bottom = -82; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.045; sun.shadow.mapSize.set(2048, 2048);
  const vmScene = E.vmScene = new THREE.Scene();
  const vmCamera = E.vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
  vmScene.add(vmCamera);
  const vmHemi = new THREE.HemisphereLight(0xc8d0d8, 0x5a5040, 0.9); vmScene.add(vmHemi);
  const vmSun = new THREE.DirectionalLight(0xffe2bc, 1.8); vmSun.position.set(-0.6, 1, 0.3); vmScene.add(vmSun);
  const vmRim = new THREE.DirectionalLight(0x8fb0d0, 0.6); vmRim.position.set(0.8, 0.2, 1); vmScene.add(vmRim);

  /* ---------- post-processing, muzzle light, dust ---------- */
  const post = E.post = new BV.PostFX(renderer);
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 10, 2); scene.add(muzzleLight);
  E.flashLight = (pos, k) => { muzzleLight.position.copy(pos); muzzleLight.intensity = Math.max(muzzleLight.intensity, 4 * (k || 1)); };
  const dustN = 420, dustPos = new Float32Array(dustN * 3), dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 24; dustPos[i * 3 + 1] = Math.random() * 6; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 24; dustSeed[i] = Math.random() * 100; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  dust.frustumCulled = false; scene.add(dust);
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
  // image-based lighting: capture the level once into a prefiltered env map
  try {
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { encoding: THREE.sRGBEncoding, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCam = new THREE.CubeCamera(0.5, 400, cubeRT); cubeCam.position.set(0, 4, 0); scene.add(cubeCam);
    cubeCam.update(renderer, scene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromCubemap(cubeRT.texture).texture;
    scene.environment = env; vmScene.environment = env; E.env = env;
    scene.remove(cubeCam); pmrem.dispose();
  } catch (err) { console.warn('env map unavailable', err); }
  BV.Effects.init(scene, vmScene);
  const game = E.game = new BV.Game(E);
  E.viewmodel = new BV.Viewmodel(vmScene, vmCamera);
  BV.HUD.init(game, E);
  BV.Menu.init(E);
  BV.Input.init(canvas);
  E.buildMs = Math.round(performance.now() - t0);

  /* ---------- settings ---------- */
  E.applySettings = function () {
    const s = BV.settings;
    const q = { low: 0.55, medium: 0.8, high: Math.min(window.devicePixelRatio || 1, 2) }[s.quality] || 0.8;
    renderer.setPixelRatio(q);
    post.enabled = s.quality !== 'low' && s.postfx !== false;
    document.getElementById('vignette').style.display = post.enabled ? 'none' : '';
    const shadowSize = { low: 0, medium: 2048, high: 4096 }[s.quality];
    const wantShadows = shadowSize > 0;
    if (renderer.shadowMap.enabled !== wantShadows || sun.shadow.mapSize.x !== (shadowSize || sun.shadow.mapSize.x)) {
      renderer.shadowMap.enabled = wantShadows;
      if (wantShadows) sun.shadow.mapSize.set(shadowSize, shadowSize);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    canvas.style.imageRendering = 'auto';
    scene.fog.far = s.quality === 'low' ? 120 : 170;
    camera.far = s.quality === 'low' ? 160 : 600; camera.updateProjectionMatrix();
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
  E.onPlayerShot = (def) => {
    E.viewmodel.shot(def); E.punch += def.kick * 0.9;
    const p = game.player, d = p.dir(E._v2); E.flashLight(p.eye(E._v).addScaledVector(d, 0.9), 1);
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

  BV.Input.listeners.key.push((code, down) => {
    if (code === 'Tab' && (E.state === 'play' || E.state === 'buy')) BV.HUD.scoreboard(down);
    if (!down) return;
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
    const fov = E.zoomFov();
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 22); if (Math.abs(camera.fov - fov) < 0.3) camera.fov = fov; camera.updateProjectionMatrix(); }
    const sh = BV.Effects.shakeOffset();
    if (p.alive) {
      p.eye(camera.position);
      camera.rotation.set(p.pitch + E.punch + (Math.random() - 0.5) * sh * 0.1, p.yaw + (Math.random() - 0.5) * sh * 0.1, 0);
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
  }
  function step(dt) {
    const playing = E.state === 'play' || E.state === 'buy';
    if (E.state === 'menu') {
      menuCamera(dt);
      BV.Effects.update(dt);
    } else if (playing || E.state === 'over') {
      // fixed sub-steps keep physics stable on slow frames
      const n = dt > 1 / 45 ? 2 : 1, h = dt / n;
      const mdx = BV.Input.mouse.dx, mdy = BV.Input.mouse.dy;
      for (let i = 0; i < n; i++) {
        if (E.state !== 'over') BV.Player.update(game, h, E);
        game.update(h);
        if (i === 0 && n > 1) BV.Input.endFrame(); // edges/mouse deltas are consumed once
      }
      BV.Effects.update(dt);
      playCamera(dt);
      const p = game.player;
      E.viewmodel.update(dt, {
        speed: Math.hypot(p.vel.x, p.vel.z), onGround: p.onGround, crouch: p.crouch > 0.5, sprint: p.sprint,
        mdx, mdy,
        busy: p.planting || p.defusing, visible: p.alive && !(p.zoom && p.weapon && p.weapon.def.zoom)
      });
      BV.HUD.update(dt);
    } else if (E.state === 'pause') {
      // world frozen; keep rendering the current frame
    }
    BV.Input.endFrame();
    updateDust(dt);
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

  document.getElementById('loading').classList.add('hidden');
  BV.Menu.showMenu('p-main');
  requestAnimationFrame(frame);

  /* debug/test handle */
  window.BV_DEBUG = { engine: E, game };
})();
