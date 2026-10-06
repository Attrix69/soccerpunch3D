  /* ---------- ULTIMES : effets visuels propres à chacun ---------- */
  const ULK = TF.ROSTER.map(r => (r.ult ? r.ult[0] : ''));
  const UCOL = { upper: ['#ff9a3c', '#fff1d6', '#ff5a1e'], rouleau: ['#ffc21a', '#ff8a00', '#fff2b0'], fauche: ['#a66bff', '#e8dcff', '#5a2aa8'],
    seisme: ['#d9b27a', '#fff1d6', '#a0703a'], thor: ['#6fb8ff', '#ffffff', '#b8e4ff'], faucon: ['#7fd8ff', '#ffffff', '#c8f2ff'],
    abra: ['#e05cff', '#ffffff', '#ff9af0'], encre: ['#8a5cff', '#c7a6ff', '#3a1d6a'], fil: ['#ffd23a', '#fff6c0', '#ffb000'],
    crescendo: ['#f4f1ea', '#ffd23a', '#ffffff'], couronne: ['#ffd23a', '#fff6c0', '#ff9a00'], bond: ['#ff9000', '#ffd08a', '#ff5a00'],
    stampede: ['#ff2d55', '#ffd0d8', '#ff7a00'], ruse: ['#ff8a3d', '#ffffff', '#c6ff4a'], bordee: ['#ff6a00', '#ffd23a', '#ff2a00'] };
  let UL = null;          // ultime en cours (départ, cible, tireur)
  let HYPT = 0, OBT = 0;  // ballon hypnotisé / dégagement obus en vol (jusqu'à)
  let lastClaw = null, ulInv = false;
  // marques au sol (griffures, fissures, encre) et traces de combat : instanciées sur la pelouse (cf. 32-pitch)
  function mark(o) { groundMark(o.t, o.x, o.y, o.r || 20, o.x2, o.y2, o.life || 2.5, o.rot); }
  function goreMark(t, x, y, r, x2, y2, life, rot) { groundMark(t, x, y, r, x2, y2, life, rot); }
  function crackMark(x, y, r, col) {
    groundMark('crack', x, y, r * 1.1, 0, 0, 2.6, R() * 6, col || '#20160c', 0.85);
    vfx('fx_crack', x, y, 0, { scale: r * U3 * 1.6, s1: r * U3 * 2.1, life: 1.1, grow: 0.08, hold: 0.5, yaw: R() * 6, c2: '#ff7a1a', dark2: col && col !== '#20160c' ? '#2a3a4a' : '#4a3a2a' });
  }
  function boltPts(x, y) { const pts = []; let px = x + rnd2(-60, 60), pz = 560; while (pz > 0) { pts.push([px, y, pz]); pz -= rnd2(40, 80); px += rnd2(-26, 26); } pts.push([x, y, 0]); return pts; }
  function ultStart(e, loud) { // départ d'un ULTIME
    const k = e.uk, c = UCOL[k] || UCOL.upper, R2 = TF.ROSTER.find(r => r.ult && r.ult[0] === k);
    UL = { k, sx: e.sx, sy: e.sy, tx: e.tx, ty: e.ty, by: e.i, t0: performance.now() / 1000, g0: 0 };
    lastClaw = null; ulInv = false;
    if (loud) { AU.ult(k); showBanner(R2 ? R2.ult[1].toUpperCase() : 'ULTIME', e.n, c[0], 1.5, 0.66, 0.26); }
    flashCol = { thor: '170,215,255', abra: '240,140,255', encre: '60,30,90', fil: '255,225,120', crescendo: '255,250,230', couronne: '255,220,90', faucon: '170,235,255', fauche: '170,120,255' }[k] || '255,120,40';
    burst(e.x, e.y, 10, 22, { sp: 320, vz: 220, col: c, type: 'fire', size: 7, life: 0.55, g: 200 });
    ring(e.x, e.y, c[0], 90); ring(e.x, e.y, c[1], 60); impact(e.x, e.y, 14, 80);
    { // la frappe d'un ultime déchire l'air : onde au sol, dôme d'énergie, éclat orienté vers le but
      const dx = (e.tx || e.x + 1) - e.x, dy = (e.ty || e.y) - e.y;
      vfx('fx_shock_l', e.x, e.y, 0, { c1: c[0], c0: c[2] || c[1], scale: 1.2, s1: 4.2, life: 0.7, grow: 0.6, int: 1.4 });
      vfx('fx_dome', e.x, e.y, 0, { c1: c[0], c0: c[2] || c[1], scale: 0.8, s1: 2.8, life: 0.5, grow: 0.4, int: 0.55 });
      vfx('fx_shockcres', e.x, e.y, 30, { c1: c[0], c0: '#ffffff', scale: 1.6, s1: 3, life: 0.45, yaw: Math.atan2(-dy, dx), grow: 0.4 });
      if (k === 'bordee') vfx('fx_muzzle', e.x, e.y, 26, { c2: '#ff6a00', c0: '#ffd23a', scale: 1.6, s1: 3.4, life: 0.4, dir: [dx, dy, 0] });
      if (k === 'upper') vfx('fx_upper', e.x, e.y, 20, { c1: c[0], c0: '#fff1d6', scale: 1.4, s1: 3.2, life: 0.5, yaw: Math.atan2(-dy, dx), sy: 1.6 });
      if (k === 'thor') vfx('fx_lightning', e.x, e.y, 0, { c1: '#6fb8ff', scale: 1.2, sy: 6, life: 0.35 });
      if (k === 'bond') vfx('fx_claw', e.x, e.y, 30, { c1: '#ff9000', c0: '#ffd08a', scale: 1.4, s1: 2.6, life: 0.4, yaw: Math.atan2(-dy, dx) });
    }
    switch (k) {
      case 'bordee': // le coup de canon : flamme de bouche, nuage de poudre
        burst(e.x, e.y, 20, 30, { sp: 420, vz: 160, col: ['#ff6a00', '#ffd23a', '#fff'], type: 'fire', size: 9, life: 0.4, g: 0 });
        burst(e.x, e.y, 18, 18, { sp: 160, vz: 70, col: ['#8a8f99', '#5a5e66', '#c9ccd2'], type: 'smoke', size: 12, life: 1.6, g: -30 });
        shake(28); break;
      case 'upper': burst(e.x, e.y, 30, 20, { sp: 120, vz: 700, col: ['#ff9a3c', '#fff', '#c96a2a'], type: 'spark', size: 3, life: 0.5, g: 600 }); break;
      case 'rouleau': case 'stampede': burst(e.x, e.y, 2, 16, { sp: 260, vz: 80, col: ['#7a6248', '#5a4a36', '#9a8466'], type: 'puff', size: 9, life: 0.9, g: 0 }); turf(e.x, e.y, 14, 260); break;
      case 'abra': burst(e.x, e.y, 30, 18, { sp: 220, vz: 200, col: ['#e05cff', '#fff', '#ff9af0', '#7a5cff'], type: 'conf', size: 3, life: 1.2, g: 180 }); break;
      case 'encre': burst(e.x, e.y, 10, 12, { sp: 180, vz: 90, col: '#140c1e', type: 'smoke', size: 10, life: 1.2, g: -20 }); break;
      case 'couronne': burst(e.x, e.y, 30, 24, { sp: 260, vz: 300, col: ['#ffd23a', '#fff6c0', '#ff9a00'], type: 'conf', size: 3.5, life: 1.4, g: 300 }); break;
      case 'crescendo': for (let n = 0; n < 6; n++) spawn({ x: e.x + rnd2(-20, 20), y: e.y + rnd2(-10, 10), z: 50, vx: rnd2(-60, 60), vy: rnd2(-30, 30), vz: rnd2(60, 140), g: 0, life: 1.2, max: 1.2, size: 18, col: pick(['#fff', '#ffd23a']), type: 'note', txt: pick(['♪', '♫']), rot: rnd2(-0.3, 0.3), vr: 0 }); break;
      case 'faucon': burst(e.x, e.y, 20, 14, { sp: 200, vz: 260, col: ['#fff', '#e8f6ff'], type: 'conf', size: 3, life: 1.3, g: 120 }); break;
    }
  }
  function ultFlight(V, b, dt) { // pendant le vol : traînées et particules de chaque ultime
    if (!UL || !b.uk || dt <= 0) return;
    const k = ULK[b.uk - 1]; if (k !== UL.k) return;
    const c = UCOL[k], sp = len(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    const P = (o) => spawn(o);
    switch (k) {
      case 'upper': if (b.z > 60) for (let n = 0; n < 3; n++) P({ x: b.x + rnd2(-6, 6), y: b.y + rnd2(-6, 6), z: b.z + rnd2(-4, 10), vx: rnd2(-30, 30), vy: rnd2(-30, 30), vz: rnd2(60, 160), g: 0, life: 0.5, max: 0.5, size: rnd2(8, 14), col: pick(c), type: 'fire', rot: 0, vr: 0 }); break;
      case 'rouleau': case 'stampede':
        if (R() < 0.8) P({ x: b.x - ux * 20 + rnd2(-20, 20), y: b.y - uy * 20 + rnd2(-14, 14), z: 2, vx: -ux * 60 + rnd2(-60, 60), vy: -uy * 60 + rnd2(-60, 60), vz: rnd2(20, 60), g: 0, life: 0.9, max: 0.9, size: rnd2(8, 14), col: pick(['#7a6248', '#5a4a36', '#9a8466']), type: 'puff', rot: 0, vr: 0 });
        if (R() < 0.5) turf(b.x, b.y, 2, 200);
        break;
      case 'fauche': P({ x: b.x + rnd2(-8, 8), y: b.y + rnd2(-8, 8), z: b.z + rnd2(0, 10), vx: rnd2(-20, 20), vy: rnd2(-20, 20), vz: rnd2(10, 50), g: 0, life: 0.7, max: 0.7, size: rnd2(5, 9), col: pick(['#a66bff', '#5a2aa8', '#e8dcff']), type: 'fire', rot: 0, vr: 0 });
        if (R() < 0.5) P({ x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 15, g: 0, life: 0.9, max: 0.9, size: 8, col: '#140a24', type: 'smoke', rot: 0, vr: 0 }); break;
      case 'seisme': if (b.z < 12 && R() < 0.6) P({ x: b.x + rnd2(-16, 16), y: b.y + rnd2(-10, 10), z: 2, vx: rnd2(-80, 80), vy: rnd2(-50, 50), vz: rnd2(30, 80), g: 0, life: 0.8, max: 0.8, size: rnd2(7, 12), col: pick(['#7a6248', '#9a8466']), type: 'puff', rot: 0, vr: 0 }); break;
      case 'thor': if (R() < 0.7) P({ x: b.x, y: b.y, z: b.z, vx: rnd2(-260, 260), vy: rnd2(-260, 260), vz: rnd2(-100, 200), g: 0, life: 0.15, max: 0.15, size: 3, col: pick(['#fff', '#6fb8ff', '#b8e4ff']), type: 'spark', rot: 0, vr: 0 }); break;
      case 'faucon': { const a = performance.now() / 60;
        for (const s2 of [1, -1]) P({ x: b.x - uy * Math.cos(a) * 14 * s2, y: b.y + ux * Math.cos(a) * 14 * s2, z: b.z + Math.sin(a) * 14 * s2, vx: 0, vy: 0, vz: 0, g: 0, life: 0.35, max: 0.35, size: 4, col: s2 > 0 ? '#ffffff' : '#7fd8ff', type: 'fire', rot: 0, vr: 0 });
        if (R() < 0.25) P({ x: b.x, y: b.y, z: b.z, vx: rnd2(-60, 60), vy: rnd2(-60, 60), vz: rnd2(-20, 60), g: 90, life: 1.1, max: 1.1, size: 3, col: '#f4f8ff', type: 'conf', rot: R() * 6, vr: rnd2(-6, 6) }); break; }
      case 'abra': { const inv = b.gu > 0.18 && b.gu < 0.7;
        if (inv !== ulInv) { ulInv = inv; burst(b.x, b.y, b.z, 16, { sp: 180, vz: 120, col: ['#e05cff', '#fff', '#7a5cff'], type: 'conf', size: 3, life: 0.8, g: 0 }); burst(b.x, b.y, b.z, 6, { sp: 60, vz: 40, col: '#c7a6ff', type: 'smoke', size: 10, life: 0.6, g: 0 }); floatTxt(b.x, b.y, b.z + 40, inv ? 'POUF !' : 'TA-DAA !', '#ff9af0', 24); AU.swish(0.8); }
        if (!inv) P({ x: b.x, y: b.y, z: b.z, vx: rnd2(-40, 40), vy: rnd2(-40, 40), vz: rnd2(-20, 40), g: 0, life: 0.5, max: 0.5, size: 2.5, col: pick(c), type: 'conf', rot: R() * 6, vr: 8 });
        else if (R() < 0.15) P({ x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, g: 0, life: 0.3, max: 0.3, size: 2, col: '#ff9af0', type: 'spark', rot: 0, vr: 0 });
        break; }
      case 'encre':
        P({ x: b.x + rnd2(-6, 6), y: b.y + rnd2(-6, 6), z: b.z + rnd2(-2, 6), vx: rnd2(-25, 25), vy: rnd2(-25, 25), vz: rnd2(0, 25), g: 0, life: 1.3, max: 1.3, size: rnd2(9, 15), col: pick(['#140c1e', '#1e1030', '#2a1640']), type: 'smoke', rot: 0, vr: 0 });
        if (R() < 0.12) mark({ t: 'ink', x: b.x + rnd2(-30, 30), y: b.y + rnd2(-20, 20), r: rnd2(8, 18), rot: R() * 3, life: 3, max: 3 }); break;
      case 'fil': if (R() < 0.6) P({ x: b.x, y: b.y, z: b.z, vx: rnd2(-30, 30), vy: rnd2(-30, 30), vz: rnd2(-10, 30), g: 40, life: 0.6, max: 0.6, size: 2.5, col: pick(c), type: 'spark', rot: 0, vr: 0 }); break;
      case 'crescendo': if (R() < 0.12 + sp / 6000) P({ x: b.x, y: b.y, z: b.z + 10, vx: rnd2(-40, 40), vy: rnd2(-40, 40), vz: rnd2(50, 120), g: 0, life: 1, max: 1, size: 12 + sp / 160, col: pick(['#fff', '#ffd23a', '#f4f1ea']), type: 'note', txt: pick(['♪', '♫', '♩']), rot: rnd2(-0.4, 0.4), vr: 0 }); break;
      case 'couronne': if (R() < 0.7) P({ x: b.x, y: b.y, z: b.z, vx: rnd2(-30, 30), vy: rnd2(-30, 30), vz: rnd2(0, 40), g: 0, life: 0.5, max: 0.5, size: 2.5, col: pick(c), type: 'spark', rot: 0, vr: 0 }); break;
      case 'bond':
        if (b.z < 14) { // griffures dans la pelouse
          if (!lastClaw) lastClaw = [b.x, b.y];
          const d = len(b.x - lastClaw[0], b.y - lastClaw[1]);
          if (d > 46) { mark({ t: 'claw', x: lastClaw[0], y: lastClaw[1], x2: b.x, y2: b.y, nx: -uy, ny: ux, life: 2.2, max: 2.2 }); lastClaw = [b.x, b.y]; turf(b.x, b.y, 2, 160); }
        } else lastClaw = null;
        if (R() < 0.6) P({ x: b.x, y: b.y, z: b.z + 4, vx: rnd2(-40, 40), vy: rnd2(-40, 40), vz: rnd2(0, 40), g: 0, life: 0.4, max: 0.4, size: rnd2(5, 8), col: pick(['#ff9000', '#111', '#ffb000']), type: 'fire', rot: 0, vr: 0 });
        break;
      case 'ruse': if (R() < 0.5) P({ x: b.x, y: b.y, z: b.z, vx: rnd2(-30, 30), vy: rnd2(-30, 30), vz: rnd2(0, 30), g: 0, life: 0.4, max: 0.4, size: 5, col: pick(['#ff8a3d', '#fff']), type: 'fire', rot: 0, vr: 0 }); break;
      case 'bordee': P({ x: b.x, y: b.y, z: b.z, vx: rnd2(-15, 15), vy: rnd2(-15, 15), vz: rnd2(10, 30), g: 0, life: 1.1, max: 1.1, size: rnd2(6, 10), col: pick(['#8a8f99', '#5a5e66']), type: 'smoke', rot: 0, vr: 0 }); break;
    }
  }
  /* ---------- éléments d'un ultime posés dans le monde : cible de la météorite, fil d'or ---------- */
  let ulTarget = null, ulThread = null;
  function updUlt3D(V) {
    const b = V.ball;
    if (!ulTarget) {
      ulTarget = new THREE.Group();
      for (const r of [1.05, 0.62]) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a1e').multiplyScalar(2.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); ulTarget.add(m); }
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.06).rotateX(-Math.PI / 2), ulTarget.children[0].material); ulTarget.add(cross, cross.clone().rotateY(Math.PI / 2));
      ulTarget.visible = false; scene.add(ulTarget);
      ulThread = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23a').multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      ulThread.visible = false; scene.add(ulThread);
    }
    ulTarget.visible = false; ulThread.visible = false;
    if (!UL) return;
    const k = UL.k, act = b.uk && ULK[b.uk - 1] === k;
    if (!act && performance.now() / 1000 - UL.t0 > 0.4) { if (!b.uk) UL = null; return; }
    const t = performance.now() / 1000;
    if (k === 'upper' && act && b.z > 70 && b.gu < 0.77) { // UPPERCUT : la cible où la météorite va s'écraser
      const u = 0.7765, ix = UL.sx + (UL.tx - UL.sx) * u, iy = UL.sy + (UL.ty - UL.sy) * u, pr = 0.75 + 0.25 * Math.sin(t * 18);
      ulTarget.visible = true; toW(ix, iy, 1.5, ulTarget.position); ulTarget.scale.setScalar(pr * 1.1); ulTarget.rotation.y = t * 1.5;
    }
    if (k === 'fil' && act) { // le fil d'or tendu jusqu'au but
      const A = toW(UL.sx, UL.sy, 58), B = toW(UL.tx, UL.ty, 40), d = B.clone().sub(A);
      ulThread.visible = true; ulThread.position.copy(A).add(B).multiplyScalar(0.5); ulThread.scale.set(1 + 0.4 * Math.sin(t * 40), d.length(), 1 + 0.4 * Math.sin(t * 40));
      ulThread.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
  }
