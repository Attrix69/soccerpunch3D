  /* =============== ENTRÉES =============== */
  const LI = { mx: 0, my: 0, a: false, b: false, sp: false, d: false, aN: 0, bN: 0, dN: 0 };
  const joy = { id: null, ox: 0, oy: 0, vx: 0, vy: 0, R: 56 };
  const joyEl = $('joy'), knobEl = $('knob');
  const btns = { A: $('bA'), B: $('bB'), C: $('bC'), D: $('bD') };
  const ptr = new Map();
  let rects = {};
  function layoutButtons() { for (const k in btns) rects[k] = btns[k].getBoundingClientRect(); }
  function hitBtn(x, y) {
    let best = null, bd = 1e9;
    for (const k of ['A', 'B', 'C', 'D']) {
      const r = rects[k]; if (!r || !r.width) continue;
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, rad = r.width / 2 * 1.2;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d <= rad * rad && d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function press(k, on) {
    btns[k].classList.toggle('on', on);
    if (k === 'A') { if (on && !LI.a) LI.aN++; LI.a = on; }
    else if (k === 'B') { if (on && !LI.b) LI.bN++; LI.b = on; }
    else if (k === 'C') LI.sp = on;
    else if (k === 'D') { if (on && !LI.d) LI.dN++; LI.d = on; }
    if (on) { AU.init(); vibeTap(); }
  }
  function vibeTap() { if (navigator.vibrate && app.mode !== 'menu' && OPT.vib) try { navigator.vibrate(8); } catch (e) { /* rien */ } }
  function setJoyPos() {
    joyEl.style.left = joy.ox + 'px'; joyEl.style.top = joy.oy + 'px';
    knobEl.style.transform = `translate(${joy.vx * joy.R}px,${joy.vy * joy.R}px)`;
  }
  function resetJoy() {
    joy.id = null; joy.vx = 0; joy.vy = 0; joyEl.classList.remove('act');
    joyEl.style.left = ''; joyEl.style.top = ''; knobEl.style.transform = '';
  }
  ctl.addEventListener('pointerdown', e => {
    e.preventDefault();
    const k = hitBtn(e.clientX, e.clientY);
    if (k) { ptr.set(e.pointerId, k); press(k, true); }
    else if (e.clientX < CW * 0.55 && joy.id === null) {
      joy.id = e.pointerId; ptr.set(e.pointerId, 'joy');
      joy.ox = clamp(e.clientX, 70, CW * 0.55); joy.oy = clamp(e.clientY, 70 + SAFE.t, CH - 66 - SAFE.b);
      joy.vx = 0; joy.vy = 0; joyEl.classList.add('act'); setJoyPos(); AU.init();
    }
    try { ctl.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
  }, { passive: false });
  ctl.addEventListener('pointermove', e => {
    if (ptr.get(e.pointerId) !== 'joy') return;
    e.preventDefault();
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = len(dx, dy);
    if (d > joy.R * 1.35) { // le joystick suit le pouce
      const ex = d - joy.R * 1.35; joy.ox += dx / d * ex; joy.oy += dy / d * ex;
      dx = e.clientX - joy.ox; dy = e.clientY - joy.oy;
    }
    const dd = len(dx, dy), m = Math.min(1, dd / joy.R);
    const dz = 0.14, mm = m < dz ? 0 : (m - dz) / (1 - dz);
    joy.vx = dd ? dx / dd * mm : 0; joy.vy = dd ? dy / dd * mm : 0;
    setJoyPos();
  }, { passive: false });
  const endPtr = e => {
    const k = ptr.get(e.pointerId); if (!k) return;
    ptr.delete(e.pointerId);
    if (k === 'joy') resetJoy(); else press(k, false);
  };
  ctl.addEventListener('pointerup', endPtr);
  ctl.addEventListener('pointercancel', endPtr);
  ctl.addEventListener('lostpointercapture', endPtr);
  ctl.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.card')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  const keys = new Set();
  const KMAP = { Space: 'A', KeyJ: 'A', KeyK: 'B', KeyL: 'B', ShiftLeft: 'C', ShiftRight: 'C', KeyE: 'D', KeyI: 'D' };
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter') $('goJoin').click(); return; }
    if (e.code === 'Escape') { if (app.mode !== 'menu') togglePause(); return; }
    if (e.code === 'KeyF' && !e.repeat) { toggleFS(); return; }
    if (keys.has(e.code)) { e.preventDefault(); return; }
    keys.add(e.code);
    const k = KMAP[e.code]; if (k && app.mode !== 'menu') { press(k, true); e.preventDefault(); }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => {
    keys.delete(e.code);
    const k = KMAP[e.code]; if (k) press(k, false);
  });
  addEventListener('blur', () => { keys.clear(); for (const k of ['A', 'B', 'C', 'D']) press(k, false); resetJoy(); ptr.clear(); });
  function toggleFS() { const d = document; try { if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { /* refusé */ } }
  /* ---------- MANETTE (Gamepad API) : stick, boutons, vibrations ---------- */
  const GP = { idx: -1, prev: {}, pad: null };
  addEventListener('gamepadconnected', e => { GP.idx = e.gamepad.index; toast('Manette connectée : prête à cogner'); });
  addEventListener('gamepaddisconnected', e => { if (e.gamepad.index !== GP.idx) return; GP.idx = -1; GP.pad = null; for (const k of ['A', 'B', 'C', 'D']) if (GP.prev[k]) press(k, false); GP.prev = {}; });
  function pollPad() {
    if (GP.idx < 0 || !navigator.getGamepads) return null;
    const gp = navigator.getGamepads()[GP.idx]; if (!gp) return null; GP.pad = gp;
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const live = app.mode !== 'menu' && !app.drafting;
    const st = { A: b(0), B: b(1) || b(2), C: b(4) || b(5) || b(7), D: b(3) || b(6) };
    for (const k of ['A', 'B', 'C', 'D']) if (st[k] !== !!GP.prev[k]) { if (live || !st[k]) press(k, st[k]); GP.prev[k] = st[k]; }
    const start = b(9); if (start && !GP.prev.S && app.mode !== 'menu') togglePause(); GP.prev.S = start;
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1; // croix directionnelle
    const m = len(x, y); if (m < 0.18) return [0, 0];
    const mm = Math.min(1, (m - 0.18) / 0.82); return [x / m * mm, y / m * mm];
  }
  function padRumble(p) {
    const gp = GP.pad; if (!gp || !gp.vibrationActuator || !OPT.vib) return;
    const d = Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p;
    try { gp.vibrationActuator.playEffect('dual-rumble', { duration: Math.min(450, d), strongMagnitude: Math.min(1, d / 220), weakMagnitude: 0.7 }); } catch (e) { /* pas de vibration */ }
  }
  function readMove() {
    let kx = 0, ky = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) ky -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) ky += 1;
    let mx = joy.vx, my = joy.vy;
    const g = pollPad(); if (g && (g[0] || g[1])) { mx = g[0]; my = g[1]; }
    if (kx || ky) { const m = len(kx, ky); mx = kx / m; my = ky / m; }
    LI.mx = mx * cam.flip; LI.my = my * cam.flip;
    return LI;
  }

