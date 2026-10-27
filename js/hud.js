/* =====================================================================
   hud.js — DOM heads-up display: vitals, ammo, timer, score, alive pips,
   radar, kill feed, hit markers, damage direction, scoreboard, buy menu.
   Values are written only when they change to keep layout work low.
   ===================================================================== */
'use strict';
BV.HUD = (function () {
  const $ = (id) => document.getElementById(id);
  const cache = {};
  let el = null, game = null, engine = null;
  let noticeT = 0, centerT = 0, hitT = 0, radarT = 0, radarBg = null;
  const RADAR_SCALE = 1.9; // px per metre

  function set(key, node, val, prop) {
    if (cache[key] === val) return; cache[key] = val;
    if (prop === 'html') node.innerHTML = val; else node.textContent = val;
  }
  function init(g, e) {
    game = g; engine = e;
    el = {};
    ['hud', 'hud-hp', 'hud-ar', 'hp-fill', 'ar-fill', 'hud-money', 'ammo-mag', 'ammo-res', 'hud-ammo', 'hud-wname', 'hud-slots', 'hud-timer', 'hud-round',
      'tm-l-name', 'tm-r-name', 'tm-l-score', 'tm-r-score', 'pips-l', 'pips-r', 'hud-obj', 'radar', 'radar-zone', 'killfeed', 'center-big', 'center-sub',
      'hud-notice', 'hud-progress', 'progress-label', 'progress-fill', 'crosshair', 'hitmarker', 'dmg-ind', 'flash-dmg', 'flash-white', 'scope',
      'charge-icon', 'hud-hint', 'death-msg', 'scoreboard', 'sb-a', 'sb-b', 'sb-sub', 'buymenu', 'buy-grid', 'buy-money', 'buy-status', 'training-stats', 'fps']
      .forEach(id => { el[id] = $(id); });
    buildBuyMenu();
  }
  function show(v) { el.hud.classList.toggle('hidden', !v); }

  /* ---------- match / round events ---------- */
  function resetMatch(g) {
    for (const k in cache) delete cache[k];
    el.killfeed.innerHTML = '';
    el['training-stats'].classList.toggle('hidden', !g.training);
    radarBg = null;
  }
  function onRoundStart(g) {
    el['death-msg'].classList.add('hidden');
    if (g.training) { center('Training', 'Shoot the targets · buy anything with B · Esc for menu', 3.5); return; }
    const role = g.isAttacker(g.player) ? 'Arm the Vector Charge at site A or B' : 'Defend sites A and B';
    center('Round ' + g.round, role, 3);
  }
  function center(big, sub, dur) { el['center-big'].textContent = big; el['center-sub'].textContent = sub || ''; centerT = dur || 2.5; el['hud-center'] && (el['hud-center'].style.opacity = 1); }
  function notice(text, kind, dur) {
    const n = el['hud-notice']; n.textContent = text; n.className = 'show ' + (kind || ''); noticeT = dur || 2.5;
  }
  const REASONS = {
    eliminated: (w, g) => (w === g.attackTeam ? 'Defenders eliminated' : 'Attackers eliminated'),
    time: () => 'Time expired — the sites held',
    exploded: () => 'The Vector Charge detonated',
    defused: () => 'The Vector Charge was disarmed'
  };
  function roundEnd(g, winner, reason, matchOver, halftime) {
    const mine = g.player && winner === g.player.team;
    center(BV.TEAMS[winner].name + ' win the round', REASONS[reason](winner, g) + (halftime ? ' · Halftime: sides switch next round' : ''), BV.RULES.endTime);
    el['center-big'].style.color = mine ? '#a9e38d' : '#ff7a52';
  }
  function killfeed(att, vic, def, head) {
    const d = document.createElement('div');
    d.className = 'kf' + ((att && att.isPlayer) || vic.isPlayer ? ' me' : '');
    const name = (c) => `<span style="color:${BV.TEAMS[c.team].css}">${c.name}</span>`;
    d.innerHTML = (att && att !== vic ? name(att) : '') + `<span class="w">${def ? def.name : 'world'}</span>` + (head ? '<span class="hs">HEADSHOT</span>' : '') + name(vic);
    el.killfeed.prepend(d);
    while (el.killfeed.children.length > 6) el.killfeed.lastChild.remove();
    setTimeout(() => d.remove(), 7000);
  }
  function hitmarker(head, kill) { el.hitmarker.className = (head ? 'head' : '') + (kill ? ' kill' : ''); hitT = kill ? 0.35 : 0.18; }
  function damageFrom(angle) {
    const a = document.createElement('div'); a.className = 'dmg-arc';
    a.style.transform = `rotate(${-angle}rad)`;
    el['dmg-ind'].appendChild(a);
    a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1100, easing: 'ease-in' }).onfinish = () => a.remove();
  }
  function deathMessage(att, def, head) {
    const m = el['death-msg'];
    if (att && att !== game.player) m.innerHTML = `Killed by <b style="color:${BV.TEAMS[att.team].css}">${att.name}</b> with ${def ? def.name : '—'}${head ? ' (headshot)' : ''}<small>Click to switch the spectated teammate</small>`;
    else m.innerHTML = 'You died<small>Click to switch the spectated teammate</small>';
    m.classList.remove('hidden');
  }

  /* ---------- per-frame refresh ---------- */
  function update(dt) {
    const g = game, p = g.player; if (!p) return;
    const target = p.alive ? p : (g.spectate && g.spectate.target) || p;
    // vitals
    set('hp', el['hud-hp'], String(Math.max(0, Math.ceil(target.hp))));
    set('ar', el['hud-ar'], String(Math.ceil(target.armor)));
    el['hp-fill'].style.width = Math.max(0, target.hp) + '%'; el['ar-fill'].style.width = target.armor + '%';
    el['hud-hp'].parentNode.classList.toggle('low', target.hp <= 25);
    set('money', el['hud-money'], '$' + p.money);
    // weapon
    const w = target.weapon;
    if (w) {
      set('wname', el['hud-wname'], w.def.name);
      if (w.def.cls === 'melee') { set('mag', el['ammo-mag'], '—'); set('res', el['ammo-res'], ''); }
      else if (w.def.cls === 'grenade') { set('mag', el['ammo-mag'], String(w.count)); set('res', el['ammo-res'], ''); }
      else { set('mag', el['ammo-mag'], String(w.mag)); set('res', el['ammo-res'], '/ ' + w.reserve); }
      el['hud-ammo'].classList.toggle('low', !!w.def.mag && w.mag <= Math.ceil(w.def.mag * 0.2));
    }
    const slots = [1, 2, 3, 4].map(s => {
      const it = target.inv[s]; const has = it && (s !== 4 || it.count > 0);
      return `<span class="slot${target.slot === s ? ' on' : ''}${has ? '' : ' empty'}">${s}</span>`;
    }).join('');
    set('slots', el['hud-slots'], slots, 'html');
    // top bar: Vanguard on the left, Raven on the right
    set('lsc', el['tm-l-score'], String(g.score.VANGUARD)); set('rsc', el['tm-r-score'], String(g.score.RAVEN));
    set('lnm', el['tm-l-name'], 'VANGUARD' + (g.attackTeam === 'VANGUARD' ? ' · ATK' : ' · DEF'));
    set('rnm', el['tm-r-name'], (g.attackTeam === 'RAVEN' ? 'ATK · ' : 'DEF · ') + 'RAVEN');
    const pips = (team) => g.ents.filter(e => e.team === team).map(e => `<i class="pip${e.alive ? '' : ' dead'}" style="color:${BV.TEAMS[team].css}"></i>`).join('');
    set('pl', el['pips-l'], pips('VANGUARD'), 'html'); set('pr', el['pips-r'], pips('RAVEN'), 'html');
    let tstr, tcls = '';
    if (g.training) tstr = '∞';
    else if (g.phase === 'freeze') tstr = BV.U.fmtTime(g.phaseT);
    else if (g.phase === 'planted') { tstr = BV.U.fmtTime(g.chargeT); tcls = 'planted'; }
    else if (g.phase === 'end' || g.phase === 'over') tstr = '—';
    else { tstr = BV.U.fmtTime(g.timer); if (g.timer < 15) tcls = 'urgent'; }
    set('timer', el['hud-timer'], tstr); if (cache.tcls !== tcls) { cache.tcls = tcls; el['hud-timer'].className = tcls; }
    set('round', el['hud-round'], g.training ? 'TRAINING' : (g.phase === 'freeze' ? 'BUY PHASE · ' : '') + 'ROUND ' + g.round + ' · FIRST TO ' + g.roundsToWin);
    // objective line
    let obj = '';
    const atk = g.isAttacker(p);
    if (g.training) obj = 'Training range — targets respawn, ammo is unlimited';
    else if (g.phase === 'planted') obj = atk ? `Charge armed at site ${g.charge.site.name} — protect it` : `Charge armed at site ${g.charge.site.name} — disarm it (hold E)`;
    else if (atk) obj = g.charge.state === 'dropped' ? 'The charge is on the ground — recover it' : (p.hasCharge ? 'You carry the charge — reach site A or B and hold E' : 'Escort the charge carrier to site A or B');
    else obj = 'Hold sites A and B until the timer runs out';
    set('obj', el['hud-obj'], obj);
    el['charge-icon'].classList.toggle('hidden', !p.hasCharge || !p.alive);
    if (p.hasCharge && p.alive) {
      const site = g.phase === 'live' ? g.map.siteAt(p.pos.x, p.pos.z) : null;
      el['charge-icon'].classList.toggle('insite', !!site);
      const lbl = document.getElementById('charge-label'); const t = site ? 'IN SITE ' + site.name : 'CHARGE';
      if (lbl && lbl.textContent !== t) lbl.textContent = t;
    }
    // progress bar (planting / defusing)
    const prog = g.planter === p ? g.plantProgress : g.defuser === p ? g.defuseProgress : -1;
    el['hud-progress'].classList.toggle('hidden', prog < 0);
    if (prog >= 0) { set('plab', el['progress-label'], g.planter === p ? 'ARMING CHARGE' : 'DISARMING CHARGE'); el['progress-fill'].style.width = (prog * 100).toFixed(1) + '%'; }
    // hint
    let hint = '';
    if (p.alive && !g.training) {
      if (p.hasCharge && g.map.siteAt(p.pos.x, p.pos.z) && g.phase === 'live' && g.planter !== p) hint = 'Hold E to arm the charge';
      else if (g.phase === 'planted' && !atk && p.pos.distanceTo(g.charge.pos) < 1.6 && g.defuser !== p) hint = 'Hold E to disarm';
      else if (g.canBuy() === 'ok' && g.phase !== 'end') hint = 'Press B to buy';
    } else if (p.alive && g.training) hint = 'Press B to buy';
    set('hint', el['hud-hint'], hint);
    // crosshair spread
    if (p.alive && w && w.def.cls !== 'melee' && w.def.cls !== 'grenade') {
      const spread = g.spreadFor(p);
      const px = Math.min(80, 4 + spread * (innerHeight / 2) / Math.tan(engine.camera.fov * Math.PI / 360));
      const c = el.crosshair.children;
      c[0].style.top = (-px - 8) + 'px'; c[1].style.top = px + 'px'; c[2].style.left = (-px - 8) + 'px'; c[3].style.left = px + 'px';
      el.crosshair.style.display = p.zoom ? 'none' : '';
    } else el.crosshair.style.display = p.alive ? '' : 'none';
    const scoped = !!(p.alive && p.zoom && w && w.def.zoom);
    el.scope.classList.toggle('on', scoped);
    if (scoped) { const kind = w.def.cls === 'sniper' ? 'sniper' : 'dmr'; if (el.scope.dataset.kind !== kind) el.scope.dataset.kind = kind; }
    // hit marker / flashes
    if (hitT > 0) { hitT -= dt; el.hitmarker.style.opacity = Math.min(1, hitT * 8); } else el.hitmarker.style.opacity = 0;
    el['flash-dmg'].style.opacity = Math.min(0.9, BV.Effects.screenFlash * 1.6 + (p.alive && p.hp < 25 ? 0.25 : 0));
    el['flash-white'].style.opacity = g._whiteFlash > 0 ? g._whiteFlash : 0;
    if (centerT > 0) { centerT -= dt; $('hud-center').style.opacity = Math.min(1, centerT * 2); if (centerT <= 0) el['center-big'].style.color = ''; }
    if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) el['hud-notice'].classList.remove('show'); }
    // spectating label
    if (!p.alive && g.spectate && g.spectate.target && g.spectate.t <= 0) set('hint', el['hud-hint'], 'Spectating ' + g.spectate.target.name);
    // training stats
    if (g.training) {
      const s = g.stats, acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
      set('ts', el['training-stats'], `Shots <b>${s.shots}</b><br>Hits <b>${s.hits}</b> · ${acc}%<br>Headshots <b>${s.heads}</b><br>Kills <b>${s.kills}</b>`, 'html');
    }
    // radar 15 Hz
    radarT -= dt; if (radarT <= 0) { radarT = 1 / 15; drawRadar(target); set('zone', el['radar-zone'], g.map.zoneName(target.pos.x, target.pos.z)); }
    if (!el.scoreboard.classList.contains('hidden')) drawScoreboard();
    if (!el.buymenu.classList.contains('hidden')) refreshBuy();
  }

  /* ---------- radar: pre-rendered map, rotated with the view ---------- */
  function buildRadarBg() {
    const b = game.map.data.bounds, s = 3;
    const c = document.createElement('canvas'); c.width = (b.maxX - b.minX) * s; c.height = (b.maxZ - b.minZ) * s;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(70,74,62,0.85)'; x.fillRect(0, 0, c.width, c.height);
    for (const bx of BV.Map.boxes) {
      if (!bx.solid || bx.max[1] - bx.min[1] < 0.9) continue;
      const tall = bx.max[1] > 2.5;
      x.fillStyle = tall ? 'rgba(18,20,16,0.95)' : 'rgba(40,43,36,0.95)';
      x.fillRect((bx.min[0] - b.minX) * s, (bx.min[2] - b.minZ) * s, (bx.max[0] - bx.min[0]) * s, (bx.max[2] - bx.min[2]) * s);
    }
    x.font = 'bold 30px Impact, sans-serif'; x.fillStyle = 'rgba(227,167,47,0.85)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const st of game.map.data.sites) {
      x.strokeStyle = 'rgba(227,167,47,0.5)'; x.lineWidth = 2;
      x.strokeRect((st.min[0] - b.minX) * s, (st.min[1] - b.minZ) * s, (st.max[0] - st.min[0]) * s, (st.max[1] - st.min[1]) * s);
      x.fillText(st.name, (st.center[0] - b.minX) * s, (st.center[1] - b.minZ) * s);
    }
    radarBg = { c, s };
  }
  function drawRadar(viewer) {
    if (!radarBg) buildRadarBg();
    const cv = el.radar, x = cv.getContext('2d'), W = cv.width, R = W / 2, b = game.map.data.bounds, k = RADAR_SCALE / radarBg.s;
    x.clearRect(0, 0, W, W);
    x.save(); x.beginPath(); x.arc(R, R, R - 1, 0, 7); x.clip();
    x.translate(R, R); x.rotate(viewer.yaw);
    x.drawImage(radarBg.c, (b.minX - viewer.pos.x) * RADAR_SCALE, (b.minZ - viewer.pos.z) * RADAR_SCALE, radarBg.c.width * k, radarBg.c.height * k);
    const g = game, my = g.player.team;
    const dot = (wx, wz, col, r, shape) => {
      const px = (wx - viewer.pos.x) * RADAR_SCALE, pz = (wz - viewer.pos.z) * RADAR_SCALE;
      x.fillStyle = col;
      if (shape === 'sq') x.fillRect(px - r, pz - r, r * 2, r * 2); else { x.beginPath(); x.arc(px, pz, r, 0, 7); x.fill(); }
    };
    if (g.charge.state === 'dropped' || g.charge.state === 'planted') {
      if (my === g.attackTeam || g.charge.state === 'planted') dot(g.charge.pos.x, g.charge.pos.z, (g.time * 4 | 0) % 2 ? '#ff5030' : '#ffd0a0', 4, 'sq');
    }
    for (const e of g.ents) {
      if (e === viewer) continue;
      const friend = e.team === my;
      if (!e.alive) { if (friend) { x.fillStyle = 'rgba(200,200,190,0.5)'; x.font = 'bold 10px sans-serif'; x.fillText('×', (e.pos.x - viewer.pos.x) * RADAR_SCALE - 3, (e.pos.z - viewer.pos.z) * RADAR_SCALE + 3); } continue; }
      if (friend) dot(e.pos.x, e.pos.z, BV.TEAMS[e.team].css, 3.4);
      else if (e.spottedBy && e.spottedBy[my] > g.time) dot(e.pos.x, e.pos.z, '#ff3b25', 3.4);
      if (friend && e.hasCharge) dot(e.pos.x, e.pos.z, '#ffd0a0', 1.6, 'sq');
    }
    x.restore();
    // viewer arrow (always pointing up)
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(R, R - 6); x.lineTo(R + 4.5, R + 5); x.lineTo(R, R + 2.5); x.lineTo(R - 4.5, R + 5); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 1; x.beginPath(); x.moveTo(R, R); x.lineTo(R - R * 0.62, 0); x.moveTo(R, R); x.lineTo(R + R * 0.62, 0); x.stroke();
  }

  /* ---------- scoreboard ---------- */
  function scoreboard(v) { el.scoreboard.classList.toggle('hidden', !v); if (v) drawScoreboard(); }
  let sbT = 0;
  function drawScoreboard() {
    if (performance.now() - sbT < 250) return; sbT = performance.now();
    const g = game;
    const col = (team, node) => {
      const list = g.ents.filter(e => e.team === team).sort((a, b) => b.score - a.score || b.kills - a.kills);
      const role = team === g.attackTeam ? 'attacking' : 'defending';
      const showMoney = team === g.player.team;
      let h = `<h4 style="color:${BV.TEAMS[team].css}"><span>${BV.TEAMS[team].name} <small style="color:#8a8576">· ${role}</small></span><span>${g.score[team]}</span></h4><table><tr><th>Operator</th><th>K</th><th>D</th><th>Score</th>${showMoney ? '<th>Cash</th>' : ''}</tr>`;
      for (const e of list) h += `<tr class="${e.isPlayer ? 'me' : ''}${e.alive ? '' : ' dead'}"><td>${e.name}${e.isBot ? ' <small style="color:#77725f">BOT</small>' : ''}${e.hasCharge ? ' ◆' : ''}</td><td>${e.kills}</td><td>${e.deaths}</td><td>${e.score}</td>${showMoney ? `<td>$${e.money}</td>` : ''}</tr>`;
      node.innerHTML = h + '</table>';
    };
    col('VANGUARD', el['sb-a']); col('RAVEN', el['sb-b']);
    el['sb-sub'].textContent = g.training ? 'Training' : `Round ${g.round} · ${g.diffName.toLowerCase().replace('_', ' ')} bots · first to ${g.roundsToWin}`;
  }

  /* ---------- buy menu ---------- */
  function statLine(d) {
    if (d === 'armor') return 'Absorbs a share of damage to head and body';
    if (d.cls === 'grenade') return `Fragmentation · ${d.radius} m radius`;
    const rpm = Math.round(60 / d.rate);
    return `${d.damage}${d.pellets ? '×' + d.pellets : ''} dmg · ${rpm} rpm · ${d.mag}/${d.reserve}${d.zoom ? ' · scope' : ''}`;
  }
  function buildBuyMenu() {
    let h = '';
    for (const cat of BV.SHOP) {
      h += `<div class="buy-col"><h5>${cat.name}</h5>`;
      for (const id of cat.items) {
        const d = id === 'armor' ? null : BV.WEAPONS[id];
        h += `<button class="buy-item" data-buy="${id}"><span class="n">${d ? d.name : 'Plate armour'}</span><span class="p">$${d ? d.price : BV.ARMOR_PRICE}</span><span class="s">${statLine(d || 'armor')}</span></button>`;
      }
      h += '</div>';
    }
    el['buy-grid'].innerHTML = h;
    el['buy-grid'].addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]'); if (!b) return;
      const r = game.buy(b.dataset.buy);
      const msg = { bought: 'Purchased', money: 'Not enough cash', time: 'Buy time is over', zone: 'Return to your spawn zone to buy', have: 'Already equipped — ammo refilled', dead: 'You are dead' }[r] || '';
      el['buy-status'].textContent = msg;
      BV.Audio.ui(r === 'bought' ? 'buy' : 'deny');
      refreshBuy(true);
    });
  }
  let buyT = 0;
  function refreshBuy(force) {
    if (!force && performance.now() - buyT < 200) return; buyT = performance.now();
    const p = game.player;
    el['buy-money'].textContent = '$' + p.money;
    el['buy-grid'].querySelectorAll('[data-buy]').forEach(b => {
      const id = b.dataset.buy, price = id === 'armor' ? BV.ARMOR_PRICE : BV.WEAPONS[id].price;
      b.classList.toggle('cant', price > p.money);
      const owned = id === 'armor' ? p.armor >= 100 : (BV.WEAPONS[id].slot === 4 ? false : p.inv[BV.WEAPONS[id].slot] && p.inv[BV.WEAPONS[id].slot].def.id === id);
      b.classList.toggle('owned', !!owned);
    });
  }
  function buyMenu(v) { el.buymenu.classList.toggle('hidden', !v); if (v) { el['buy-status'].textContent = ''; refreshBuy(true); } }
  function fps(v, txt) { el.fps.classList.toggle('hidden', !v); if (v) el.fps.textContent = txt; }

  return { init, show, resetMatch, onRoundStart, center, notice, roundEnd, killfeed, hitmarker, damageFrom, deathMessage, update, scoreboard, buyMenu, fps,
    get buyOpen() { return el && !el.buymenu.classList.contains('hidden'); } };
})();
