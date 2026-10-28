/* =====================================================================
   audio.js — 100% procedural sound (Web Audio API). No sample files.
   Gunshots, reloads, steps, impacts, explosions, UI, ambience and a
   small sequenced menu theme are synthesised at runtime.
   ===================================================================== */
'use strict';
BV.Audio = (function () {
  let ctx = null, master, sfxBus, musicBus, ambBus, noiseBuf = null;
  const listener = { x: 0, y: 0, z: 0, yaw: 0 };
  let musicTimer = null, ambNodes = null;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    // gentle limiter so many simultaneous shots don't clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    sfxBus = ctx.createGain(); sfxBus.connect(comp); comp.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
  }
  function resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function applyVolumes() {
    if (!ctx) return;
    const s = BV.settings;
    master.gain.value = s.master;
    sfxBus.gain.value = s.sfx;
    musicBus.gain.value = s.music * 0.55;
    ambBus.gain.value = s.sfx * 0.5;
  }
  function setListener(x, y, z, yaw) { listener.x = x; listener.y = y; listener.z = z; listener.yaw = yaw; }

  /* distance attenuation + stereo pan relative to the listener */
  function spatial(pos, range) {
    if (!pos) return { g: 1, pan: 0, far: 0 };
    const dx = pos.x - listener.x, dz = pos.z - listener.z, dy = (pos.y || 0) - listener.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
    const g = Math.max(0, 1 - d / range); // linear falloff
    // right vector of listener = (cos yaw, 0, -sin yaw)
    const rx = Math.cos(listener.yaw), rz = -Math.sin(listener.yaw);
    const pan = d > 0.5 ? BV.U.clamp((dx * rx + dz * rz) / d, -1, 1) * 0.85 : 0;
    return { g: g * g, pan, far: BV.U.clamp(d / range, 0, 1) };
  }
  function out(gainNode, pan) {
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan; gainNode.connect(p); p.connect(sfxBus);
    } else gainNode.connect(sfxBus);
  }
  /* filtered noise burst */
  function noise(t, dur, type, f0, f1, q, vol, pan, attack) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); out(g, pan);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  /* oscillator sweep */
  function tone(t, type, f0, f1, dur, vol, pan, dest) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    if (dest) g.connect(dest); else out(g, pan);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const ok = () => ctx && ctx.state !== 'closed';

  /* ---------- weapons ---------- */
  function shot(def, pos, sil) {
    if (!ok() || !def.snd) return;
    if (sil) {   // suppressed: a dull, short 'thup' with a little mechanical clack, heard only nearby
      const sp = spatial(pos, 35); if (sp.g <= 0.001) return; const t = ctx.currentTime, v = def.snd.v * sp.g;
      noise(t, 0.09, 'lowpass', 1400, 380, 0.8, v * 0.42, sp.pan);
      noise(t, 0.02, 'bandpass', 2600, 2600, 2.5, v * 0.16, sp.pan);
      tone(t, 'sine', 90, 40, 0.08, v * 0.25, sp.pan);
      noise(t + 0.045, 0.025, 'bandpass', 3800, 3800, 4, v * 0.12, sp.pan);   // slide clack
      return;
    }
    const sp = spatial(pos, 120); if (sp.g <= 0.001) return;
    const t = ctx.currentTime, s = def.snd, v = s.v * sp.g;
    const lp = 1 - sp.far * 0.75; // distant shots lose high end
    noise(t, 0.035, 'highpass', 3500 * lp + 500, 3500 * lp + 500, 0.7, v * 0.9, sp.pan);             // crack
    noise(t, s.l, 'bandpass', s.f * lp, s.f * 0.35 * lp, 0.9, v * 0.9, sp.pan);                       // body
    tone(t, 'sine', s.t, 38, 0.16 + s.l * 0.3, v * 0.75, sp.pan);                                    // thump
    if (sp.far > 0.25) noise(t + 0.05, s.l * 2.2, 'lowpass', 700, 150, 0.5, v * 0.35 * sp.far, sp.pan); // echo tail
  }
  function knife(pos) {
    if (!ok()) return; const sp = spatial(pos, 20); if (sp.g <= 0) return;
    noise(ctx.currentTime, 0.18, 'bandpass', 900, 4200, 2, 0.35 * sp.g, sp.pan, 0.05);
  }
  function click(t, f, v, pan) { noise(t, 0.03, 'bandpass', f, f, 3, v, pan); tone(t, 'square', f * 0.25, f * 0.2, 0.025, v * 0.15, pan); }
  function reload(def, pos) {
    if (!ok()) return; const sp = spatial(pos, 25); if (sp.g <= 0) return;
    const t = ctx.currentTime, r = def.reload || 2, v = 0.45 * sp.g;
    if (def.cls === 'shotgun') {
      for (let i = 0; i < 4; i++) click(t + 0.35 + i * (r - 0.8) / 4, 1500, v, sp.pan);
      click(t + r - 0.25, 900, v * 1.2, sp.pan); click(t + r - 0.12, 1300, v * 1.2, sp.pan);
      return;
    }
    click(t + r * 0.18, 1800, v, sp.pan);               // mag release
    noise(t + r * 0.22, 0.12, 'lowpass', 900, 300, 1, v * 0.5, sp.pan); // mag out
    click(t + r * 0.62, 1200, v * 1.2, sp.pan);         // mag seat
    click(t + r * 0.68, 2200, v * 0.6, sp.pan);
    click(t + r * 0.86, 1000, v * 1.1, sp.pan);         // bolt
    click(t + r * 0.9, 2600, v * 0.8, sp.pan);
  }
  function dryFire() { if (!ok()) return; click(ctx.currentTime, 2600, 0.3, 0); }
  function draw() { if (!ok()) return; const t = ctx.currentTime; click(t, 1400, 0.22, 0); click(t + 0.12, 2400, 0.18, 0); }
  function zoom() { if (!ok()) return; click(ctx.currentTime, 3000, 0.15, 0); }

  /* ---------- movement & impacts ---------- */
  function step(pos, loud) {
    if (!ok()) return; const sp = spatial(pos, 28); if (sp.g <= 0.002) return;
    const t = ctx.currentTime, v = (loud ? 0.32 : 0.2) * sp.g;
    noise(t, 0.07, 'lowpass', 480 + Math.random() * 200, 160, 1.2, v, sp.pan);
    noise(t + 0.01, 0.025, 'bandpass', 2600 + Math.random() * 1500, 2600, 1, v * 0.35, sp.pan);
  }
  function land(pos) { if (!ok()) return; const sp = spatial(pos, 25); noise(ctx.currentTime, 0.12, 'lowpass', 300, 90, 1, 0.4 * sp.g, sp.pan); }
  function jump(pos) { if (!ok()) return; const sp = spatial(pos, 20); noise(ctx.currentTime, 0.05, 'lowpass', 600, 200, 1, 0.12 * sp.g, sp.pan); }
  function impact(pos, kind) {
    if (!ok()) return; const sp = spatial(pos, 40); if (sp.g <= 0.002) return;
    const t = ctx.currentTime;
    if (kind === 'flesh') { noise(t, 0.09, 'lowpass', 500, 140, 2, 0.5 * sp.g, sp.pan); }
    else if (kind === 'metal') { tone(t, 'triangle', 2400 + Math.random() * 900, 1500, 0.12, 0.12 * sp.g, sp.pan); noise(t, 0.04, 'highpass', 4000, 4000, 1, 0.15 * sp.g, sp.pan); }
    else { noise(t, 0.05, 'bandpass', 1800 + Math.random() * 1500, 900, 1.5, 0.22 * sp.g, sp.pan); }
  }
  // headshot kill: a sharp metallic 'tink' over a low thump
  function headshot() {
    if (!ctx) return; const t = ctx.currentTime, g = ctx.createGain(); g.connect(sfxBus || master || ctx.destination);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.12);
    const g1 = ctx.createGain(); g1.gain.setValueAtTime(0.0001, t); g1.gain.exponentialRampToValueAtTime(0.35, t + 0.005); g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g1); g1.connect(g); o.start(t); o.stop(t + 0.3);
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.setValueAtTime(140, t); b.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.4, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); b.connect(g2); g2.connect(g); b.start(t); b.stop(t + 0.2);
  }
  function hitmarker(head) {
    if (!ok()) return; const t = ctx.currentTime;
    tone(t, 'square', head ? 1900 : 1300, head ? 1700 : 1150, 0.05, 0.08, 0);
    if (head) tone(t + 0.045, 'square', 2500, 2300, 0.06, 0.07, 0);
  }
  function hurt() { if (!ok()) return; const t = ctx.currentTime; noise(t, 0.16, 'lowpass', 400, 90, 1.5, 0.5, 0); tone(t, 'sine', 160, 70, 0.18, 0.3, 0); }
  function death(pos) { if (!ok()) return; const sp = spatial(pos, 30); const t = ctx.currentTime; noise(t, 0.3, 'lowpass', 350, 60, 1, 0.45 * sp.g, sp.pan); tone(t, 'sine', 110, 45, 0.35, 0.3 * sp.g, sp.pan); }
  function shell(pos, heavy) {
    if (!ok()) return; const sp = spatial(pos, 14); if (sp.g <= 0.01) return; const t = ctx.currentTime + Math.random() * 0.02;
    if (heavy) { noise(t, 0.05, 'bandpass', 900, 600, 2, 0.12 * sp.g, sp.pan); return; }
    const f = 5200 + Math.random() * 2600;
    tone(t, 'triangle', f, f * 0.96, 0.09, 0.05 * sp.g, sp.pan); tone(t + 0.004, 'sine', f * 1.51, f * 1.5, 0.06, 0.025 * sp.g, sp.pan);
  }
  function bounce(pos) { if (!ok()) return; const sp = spatial(pos, 25); tone(ctx.currentTime, 'triangle', 900 + Math.random() * 400, 600, 0.07, 0.12 * sp.g, sp.pan); }
  function explosion(pos) {
    if (!ok()) return; const sp = spatial(pos, 160); const t = ctx.currentTime, g = Math.max(0.12, sp.g);
    noise(t, 1.9, 'lowpass', 2600, 60, 0.7, 1.4 * g, sp.pan, 0.005);
    noise(t, 0.25, 'highpass', 2000, 800, 0.6, 0.7 * g, sp.pan);
    tone(t, 'sine', 90, 24, 1.3, 1.1 * g, sp.pan);
    noise(t + 0.35, 2.6, 'lowpass', 500, 60, 0.6, 0.5 * g, sp.pan, 0.2); // rumble
  }

  /* ---------- objective & UI ---------- */
  function beep(pos, hi) { if (!ok()) return; const sp = spatial(pos, 60); tone(ctx.currentTime, 'square', hi ? 2100 : 1650, hi ? 2100 : 1650, 0.08, 0.16 * Math.max(0.25, sp.g), sp.pan); }
  function keypad() { if (!ok()) return; tone(ctx.currentTime, 'square', 1200 + Math.random() * 900, 1200, 0.06, 0.08, 0); }
  function chargeArmed() { if (!ok()) return; const t = ctx.currentTime; [0, 0.12, 0.24].forEach((d, i) => tone(t + d, 'square', 1500 + i * 300, 1500 + i * 300, 0.09, 0.14, 0)); }
  function defused() { if (!ok()) return; const t = ctx.currentTime; tone(t, 'square', 1800, 900, 0.4, 0.15, 0); click(t + 0.05, 1500, 0.3, 0); }
  function ui(kind) {
    if (!ok()) return; const t = ctx.currentTime;
    if (kind === 'hover') tone(t, 'square', 880, 880, 0.03, 0.035, 0);
    else if (kind === 'back') tone(t, 'square', 520, 330, 0.08, 0.06, 0);
    else if (kind === 'buy') { tone(t, 'square', 700, 700, 0.05, 0.06, 0); tone(t + 0.06, 'square', 1050, 1050, 0.07, 0.06, 0); }
    else if (kind === 'deny') tone(t, 'sawtooth', 180, 140, 0.18, 0.08, 0);
    else { tone(t, 'square', 660, 990, 0.06, 0.06, 0); }
  }
  function roundStinger(win) {
    if (!ok()) return; const t = ctx.currentTime;
    const notes = win ? [220, 277, 330, 440] : [220, 208, 175, 147];
    notes.forEach((f, i) => { tone(t + i * 0.16, 'sawtooth', f, f, 0.5, 0.07, 0, musicBus); tone(t + i * 0.16, 'square', f / 2, f / 2, 0.5, 0.05, 0, musicBus); });
  }

  /* ---------- ambience: wind + industrial hum ---------- */
  function startAmbience() {
    if (!ok() || ambNodes) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.10;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(ambBus);
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 120;
    const hg = ctx.createGain(); hg.gain.value = 0.018; hum.connect(hf); hf.connect(hg); hg.connect(ambBus);
    src.start(); lfo.start(); hum.start();
    ambNodes = [src, lfo, hum];
  }
  function stopAmbience() { if (ambNodes) { ambNodes.forEach(n => { try { n.stop(); } catch (e) { } }); ambNodes = null; } }

  /* ---------- menu theme: a slow industrial loop ----------
     A minor-key bass ostinato, filtered pad and ticking hats,
     scheduled with a look-ahead timer. */
  function startMusic() {
    if (!ok() || musicTimer) return;
    const bpm = 88, step16 = 60 / bpm / 4;
    const bass = [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 40, 0, 43, 0]; // MIDI notes, 0 = rest
    const chords = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 55, 59]];
    let stepN = 0, next = ctx.currentTime + 0.1;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    musicTimer = setInterval(() => {
      if (!ok()) return;
      while (next < ctx.currentTime + 0.25) {
        const i = stepN % 16, bar = Math.floor(stepN / 16) % 4;
        const n = bass[i];
        if (n) {
          const f = mtof(n - 12);
          tone(next, 'sawtooth', f, f, step16 * 1.8, 0.11, 0, musicBus);
          tone(next, 'square', f / 2, f / 2, step16 * 1.8, 0.06, 0, musicBus);
        }
        if (i === 0) chords[bar].forEach(m => { const f = mtof(m); tone(next, 'triangle', f, f, step16 * 15, 0.028, 0, musicBus); });
        if (i % 2 === 1) { // hats
          const s = ctx.createBufferSource(); s.buffer = noiseBuf;
          const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 7000;
          const hg = ctx.createGain(); hg.gain.setValueAtTime(i % 4 === 3 ? 0.05 : 0.025, next); hg.gain.exponentialRampToValueAtTime(0.0001, next + 0.05);
          s.connect(hf); hf.connect(hg); hg.connect(musicBus); s.start(next, Math.random()); s.stop(next + 0.06);
        }
        if (i === 0 || i === 10) tone(next, 'sine', 70, 35, 0.25, 0.18, 0, musicBus); // kick
        if (i === 4 || i === 12) { // metallic snare
          const s = ctx.createBufferSource(); s.buffer = noiseBuf;
          const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1800; bf.Q.value = 0.8;
          const sg = ctx.createGain(); sg.gain.setValueAtTime(0.07, next); sg.gain.exponentialRampToValueAtTime(0.0001, next + 0.18);
          s.connect(bf); bf.connect(sg); sg.connect(musicBus); s.start(next, Math.random()); s.stop(next + 0.2);
        }
        next += step16; stepN++;
      }
    }, 40);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  return { headshot, 
    init, resume, applyVolumes, setListener, shot, knife, reload, dryFire, draw, zoom, step, land, jump,
    impact, hitmarker, hurt, death, bounce, shell, explosion, beep, keypad, chargeArmed, defused, ui, roundStinger,
    startAmbience, stopAmbience, startMusic, stopMusic,
    get ready() { return !!ctx; }
  };
})();
