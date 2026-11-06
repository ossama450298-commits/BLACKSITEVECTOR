/* =====================================================================
   input.js — keyboard / mouse state with edge detection and pointer lock
   ===================================================================== */
'use strict';
BV.Input = (function () {
  const down = new Set(), pressed = new Set();
  const mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
  let locked = false, target = null;
  const listeners = { key: [] };

  function init(canvas) {
    target = canvas;
    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code) || (e.ctrlKey && ['KeyW', 'KeyS', 'KeyD', 'KeyA'].includes(e.code))) e.preventDefault();
      if (!down.has(e.code)) pressed.add(e.code);
      down.add(e.code);
      listeners.key.forEach(fn => fn(e.code, true, e));
    });
    window.addEventListener('keyup', (e) => { down.delete(e.code); listeners.key.forEach(fn => fn(e.code, false, e)); });
    window.addEventListener('blur', () => { down.clear(); mouse.left = mouse.right = false; });
    document.addEventListener('mousemove', (e) => { if (locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } });
    document.addEventListener('mousedown', (e) => {
      if (!locked) return;
      if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
      if (e.button === 2) { mouse.right = true; mouse.rightPressed = true; }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
    document.addEventListener('wheel', (e) => { if (locked) mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === target;
      if (!locked) { mouse.left = mouse.right = false; }
      if (BV.Input.onLockChange) BV.Input.onLockChange(locked);
    });
  }
  function lock() { if (target && target.requestPointerLock) { try { const r = target.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } } }
  function unlock() { if (document.exitPointerLock) document.exitPointerLock(); }
  function endFrame() { pressed.clear(); mouse.dx = mouse.dy = 0; mouse.leftPressed = mouse.rightPressed = false; mouse.wheel = 0; }

  return {
    init, lock, unlock, endFrame, mouse, listeners,
    down: (c) => down.has(c), pressed: (c) => pressed.has(c),
    get locked() { return locked; },
    /* test hooks */
    _press(c) { pressed.add(c); down.add(c); }, _release(c) { down.delete(c); }, _setLocked(v) { locked = v; }
  };
})();
