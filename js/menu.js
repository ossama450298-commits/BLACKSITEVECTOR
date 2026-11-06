/* =====================================================================
   menu.js — main menu, match setup, settings, about, pause and
   match-over screens. Settings apply live and persist locally.
   ===================================================================== */
'use strict';
BV.Menu = (function () {
  const $ = (id) => document.getElementById(id);
  let engine = null, returnTo = 'menu';
  const opts = { team: 'RAVEN', difficulty: 'VERY_EASY', teamSize: 5, roundsToWin: 16 };   // every match: first to 16 of 30   // Very easy selected by default

  function panel(id) {
    document.querySelectorAll('#menu .panel').forEach(p => p.classList.toggle('hidden', p.id !== id));
    const first = $(id).querySelector('button'); if (first) first.focus({ preventScroll: true });
  }
  function syncSeg(seg, val) { seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(val))); }
  function syncSettings() {
    const s = BV.settings;
    document.querySelectorAll('[data-set]').forEach(n => {
      const k = n.dataset.set;
      if (n.classList.contains('seg')) syncSeg(n, s[k]);
      else { n.value = s[k]; const lab = $('v-' + k); if (lab) lab.textContent = k === 'fov' ? s[k] + '°' : (k === 'sensitivity' ? (+s[k]).toFixed(2) : Math.round(s[k] * 100) + '%'); }
    });
  }
  function applySetting(k, v) {
    const s = BV.settings;
    if (typeof BV.DEFAULT_SETTINGS[k] === 'boolean') v = (v === true || v === 'true');
    else if (typeof BV.DEFAULT_SETTINGS[k] === 'number') v = parseFloat(v);
    s[k] = v; BV.saveSettings(); syncSettings();
    if (k === 'style') { setTimeout(() => location.reload(), 150); return; }
    if (k === 'retroFilter') BV.Textures.refreshFilters();
    if (k === 'master' || k === 'sfx' || k === 'music') BV.Audio.applyVolumes();
    engine.applySettings();
  }

  function init(e) {
    engine = e;
    $('ver').textContent = BV.VERSION;
    // character pick: the chosen team's operators, with a portrait
    function buildCharSeg() {
      const seg = document.getElementById('char-seg'), row = document.getElementById('char-row'), img = document.getElementById('char-thumb'); if (!seg) return;
      const list = BV.CHARACTERS[opts.team]; row.style.display = list ? '' : 'none'; if (!list) return;
      if (!(opts.character < list.length)) opts.character = 0;
      seg.innerHTML = '';
      list.forEach((c, i) => { const b = document.createElement('button'); b.textContent = c.name; b.classList.toggle('on', i === opts.character);
        b.addEventListener('click', () => { opts.character = i; BV.Audio && BV.Audio.ui && BV.Audio.ui('click'); buildCharSeg(); }); seg.appendChild(b); });
      const th = BV.CHAR_THUMBS && BV.CHAR_THUMBS[opts.team] && BV.CHAR_THUMBS[opts.team][opts.character]; img.src = th || '';
    }
    window.__buildCharSeg = buildCharSeg; buildCharSeg();
    // map selector: the chosen map is built at start-up, so switching saves the choice and reloads
    // subtitle, status line and team roles follow the selected map
    { const M = BV.MAPS.find(m => m.id === BV.MAP_ID) || BV.MAPS[0], hostage = BV.MAP_ID === 'meridian';
      const WX = { sector17: 'dusk, wind 12 km/h NW', harbor9: 'night, light sea breeze', dustline: 'midday, dry and hot', meridian: 'daylight, building locked down' };
      const sub = document.querySelector('.brand-sub'); if (sub) sub.textContent = 'Vanguard versus Raven · ' + M.name + ' — ' + M.desc.toLowerCase();
      const st = document.getElementById('status-line'); if (st) st.textContent = 'Uplink established · ' + M.name + ' · ' + (WX[M.id] || '');
      document.querySelectorAll('[data-key=team] button').forEach(b => {
        if (b.dataset.v === 'VANGUARD') b.textContent = hostage ? 'Vanguard · rescue' : 'Vanguard · defend';
        if (b.dataset.v === 'RAVEN') b.textContent = hostage ? 'Raven · guard' : 'Raven · attack'; }); }
    const mapSeg = document.getElementById('map-seg');
    if (mapSeg) {
      // one button per map in BV.MAPS (new maps appear here on their own)
      mapSeg.innerHTML = BV.MAPS.map(m => `<button data-map="${m.id}" title="${m.desc}">${m.name.charAt(0) + m.name.slice(1).toLowerCase()}</button>`).join('');
      mapSeg.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', b.dataset.map === BV.MAP_ID);
        b.addEventListener('click', () => {
          if (b.dataset.map === BV.MAP_ID) return;
          BV.settings.map = b.dataset.map; BV.saveSettings();
          const lt = document.getElementById('load-text'), ld = document.getElementById('loading');
          if (ld) ld.classList.remove('hidden'); if (lt) lt.textContent = 'Loading ' + b.textContent + '…';
          setTimeout(() => location.reload(), 60);
        });
      });
    }
    // keep the title inside the menu frame at any window size: shrink until no word overflows
    const fitTitle = () => {
      const t = document.querySelector('#menu .brand-title'); if (!t) return;
      t.style.fontSize = '';
      let size = parseFloat(getComputedStyle(t).fontSize);
      while (t.scrollWidth > t.clientWidth + 1 && size > 20) { size -= 2; t.style.fontSize = size + 'px'; }
    };
    fitTitle(); window.addEventListener('resize', fitTitle);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);
    document.querySelectorAll('[data-key]').forEach(seg => {
      syncSeg(seg, opts[seg.dataset.key]);
      seg.addEventListener('click', (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        const k = seg.dataset.key; opts[k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; if (k === 'team') buildCharSeg();
        syncSeg(seg, opts[k]); BV.Audio.ui('click');
      });
    });
    document.querySelectorAll('[data-set]').forEach(n => {
      if (n.classList.contains('seg')) n.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { applySetting(n.dataset.set, b.dataset.v); BV.Audio.ui('click'); } });
      else n.addEventListener('input', () => applySetting(n.dataset.set, n.value));
    });
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
      document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('hidden', p.id !== t.dataset.tab));
      BV.Audio.ui('click');
    }));
    document.body.addEventListener('click', (ev) => {
      const go = ev.target.closest('[data-go]'), act = ev.target.closest('[data-act]');
      BV.Audio.resume();
      if (go) { panel(go.dataset.go); BV.Audio.ui(go.classList.contains('ghost') ? 'back' : 'click'); BV.Audio.startMusic(); }
      if (act) action(act.dataset.act);
    });
    document.body.addEventListener('mouseover', (ev) => { if (ev.target.closest('.btn, .seg button, .buy-item')) BV.Audio.ui('hover'); });
    // first interaction starts audio/music
    const kick = () => { BV.Audio.resume(); if (engine.state === 'menu') BV.Audio.startMusic(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
    window.addEventListener('pointerdown', kick); window.addEventListener('keydown', kick);
    syncSettings();
  }

  function action(a) {
    switch (a) {
      case 'start': BV.Audio.ui('click'); engine.startMatch(Object.assign({}, opts)); break;
      case 'training': BV.Audio.ui('click'); engine.startMatch({ training: true, team: 'VANGUARD', difficulty: 'NORMAL' }); break;
      case 'quit': BV.Audio.ui('back'); panel('p-quit'); try { window.close(); } catch (e) { } break;
      case 'resume': engine.resume(); break;
      case 'restart': engine.restart(); break;
      case 'next-map': engine.goNextMap(); break;
      case 'to-menu': engine.toMenu(); break;
      case 'pause-settings': returnTo = 'pause'; $('pause').classList.add('hidden'); showMenu('p-settings'); break;
      case 'settings-back':
        if (returnTo === 'pause') { returnTo = 'menu'; hideMenu(); $('pause').classList.remove('hidden'); }
        else panel('p-main');
        BV.Audio.ui('back'); break;
      case 'close-buy': engine.closeBuy(); break;
    }
  }
  function showMenu(p) { $('menu').classList.remove('hidden'); panel(p || 'p-main'); }
  function hideMenu() { $('menu').classList.add('hidden'); }

  return { init, showMenu, hideMenu, panel, opts };
})();
