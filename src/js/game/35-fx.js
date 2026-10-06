  /* ---------- sang ---------- */
  // niveau de gore : 2 = MAX, 1 = NORMAL, 0 = sans sang (réglable dans le menu)
  let GORE = 2; try { const g = localStorage.getItem('tf_gore'); if (g !== null && g !== '') GORE = clamp(+g | 0, 0, 2); } catch (e) { /* rien */ }
  const stains = [];
  function bleed(e, mul) { // e.d = blessures cumulées de la victime
    if (!GORE) return;
    const d = e.d || 0; if (d < 1.2) return;
    const n = Math.min(GORE > 1 ? 44 : 26, (d * (GORE > 1 ? 3.4 : 2.6) * (mul || 1)) | 0), dx = (e.dx || 0), dy = (e.dy || 0);
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(dy, dx) + rnd2(-0.9, 0.9), s = rnd2(80, 260 + d * 22);
      spawn({ x: e.x, y: e.y, z: rnd2(30, 50), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd2(60, 280), g: 1000, life: 1.2, max: 1.2, size: rnd2(1.4, 2.8) * (k < 4 && GORE > 1 ? 1.6 : 1), col: pick(['#b10d12', '#8a070b', '#d4141c']), type: 'blood', rot: 0, vr: 0 });
    }
    if (e.a >= 0) VIO.blood[e.a] += n * 0.012;
    if (d >= 2.5) {
      const s = { x: e.x + dx * 18, y: e.y + dy * 18, r: Math.min(16, 3 + d * 1.2), dx: dx || 1, dy, seed: ((R() * 2e9) | 0) + 1 };
      stains.push(s); if (stains.length > 90) stains.shift();
      paintStain(s);
    }
  }

  /* ---------- particules & textes ---------- */
  const parts = [], floats = [];
  let banner = null, flash = 0, flashCol = '255,255,255', hitStop = 0, lastStop = 0;
  const HITT = new Float64Array(8), DIRT = new Float32Array(8), SKX = new Float32Array(8).fill(NaN), SKY = new Float32Array(8);
  let ghostCol = null, ZB = null, myCtrl = -1, chromaP = 0;
  const VIO = { blood: [0, 0], bones: [0, 0], ko: [0, 0, 0, 0, 0, 0, 0, 0], gr: [0, 0] };
  function vioReset() { VIO.blood = [0, 0]; VIO.bones = [0, 0]; VIO.ko = [0, 0, 0, 0, 0, 0, 0, 0]; VIO.gr = [0, 0]; DIRT.fill(0); SKX.fill(NaN); gmList.length = 0; SPL.length = 0; FEED.length = 0; CMB.n = 0; CMB.t = 0; KOW.length = 0; vfxClear(); }
  function hitFlash(id, d) { if (id >= 0 && id < 8) HITT[id] = Math.max(HITT[id], performance.now() + d * 1000); }
  function zblur(x, y, d) { const now = performance.now(); if (!ZB || ZB.end < now + d * 500) ZB = { x, y, end: now + d * 1000, dur: d * 1000 }; }
  function kick(dx, dy, m) { // la caméra encaisse le coup dans sa direction, puis revient
    const l = len(dx || 0, dy || 0);
    if (l > 0.01) { cam.kvx += dx / l * m * 22; cam.kvy += dy / l * m * 22; }
    cam.rv += (R() < 0.5 ? -1 : 1) * m * 0.012;
    cam.zp = Math.min(0.09, Math.max(cam.zp, m * 0.0035));
  }
  function teeth(e, n) { // dents qui sautent
    if (!GORE) return;
    for (let k = 0; k < n; k++) spawn({ x: e.x, y: e.y, z: 50, vx: (e.dx || 0) * rnd2(130, 280) + rnd2(-90, 90), vy: (e.dy || 0) * rnd2(130, 280) + rnd2(-90, 90), vz: rnd2(200, 340), g: 1150, life: 1.7, max: 1.7, size: 2.1, col: '#f4f1e6', type: 'tooth', rot: R() * 6, vr: rnd2(-20, 20) });
  }
  function spit(e, n) { // postillons et sueur arrachés par le coup
    for (let k = 0; k < n; k++) { const a = Math.atan2(e.dy || 0, e.dx || 1) + rnd2(-0.7, 0.7), sp = rnd2(120, 320); spawn({ x: e.x, y: e.y, z: rnd2(44, 56), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd2(40, 200), g: 900, life: 0.7, max: 0.7, size: rnd2(0.8, 1.6), col: pick(['#e8f0f6', '#ffffff', '#c9d6e2']), type: 'drop', rot: 0, vr: 0 }); }
  }
  function dirty(id, v) { if (id >= 0 && id < 8) DIRT[id] = Math.min(1, DIRT[id] + v); }
  /* ---------- sang sur l'objectif ---------- */
  const SPL = [], SPLC = {};
  const SPLAT = k => SPLC[k] || (SPLC[k] = (() => {
    const s = 200, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
    let sd = 977 * (k + 1) + 13; const r0 = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const cc = s / 2;
    g.fillStyle = '#7e070b';
    g.beginPath(); for (let a = 0; a <= 36; a++) { const an = a / 36 * Math.PI * 2, rr2 = s * 0.2 * (0.72 + r0() * 0.55); if (a) g.lineTo(cc + Math.cos(an) * rr2, cc + Math.sin(an) * rr2); else g.moveTo(cc + Math.cos(an) * rr2, cc + Math.sin(an) * rr2); } g.closePath(); g.fill();
    for (let q = 0; q < 18; q++) { const an = r0() * 6.283, d = s * (0.2 + r0() * 0.26), rr2 = s * (0.008 + r0() * 0.035); g.beginPath(); g.arc(cc + Math.cos(an) * d, cc + Math.sin(an) * d, rr2, 0, 7); g.fill(); }
    for (let q = 0; q < 4; q++) { const x = cc + (r0() - 0.5) * s * 0.3, w2 = s * (0.012 + r0() * 0.02), h2 = s * (0.12 + r0() * 0.26); g.fillRect(x - w2, cc, w2 * 2, h2); g.beginPath(); g.arc(x, cc + h2, w2 * 1.6, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-atop';
    const rg = g.createRadialGradient(cc - s * 0.05, cc - s * 0.05, 0, cc, cc, s * 0.5); rg.addColorStop(0, '#b3121a'); rg.addColorStop(0.5, '#8a080d'); rg.addColorStop(1, '#4a0305');
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(cc - s * 0.07, cc - s * 0.08, s * 0.06, s * 0.03, -0.6, 0, 7); g.fill();
    return c;
  })());
  function screenBlood(n, a) {
    if (GORE < 2 || app.mode === 'menu' || app.drafting) return;
    for (let k = 0; k < n; k++) {
      const side = R() < 0.5, x = side ? rnd2(0.02, 0.3) : rnd2(0.7, 0.98), y = rnd2(0.12, 0.85);
      SPL.push({ x: x * CW, y: y * CH, r: rnd2(110, 200) * Math.min(1.4, CH / 600), rot: rnd2(-0.5, 0.5), k: (R() * 4) | 0, life: 2.6, max: 2.6, a: a || 1, dy: 0 });
    }
    while (SPL.length > 7) SPL.shift();
    AU.splat();
  }
  function drawSplats(dt) {
    for (let k = SPL.length - 1; k >= 0; k--) {
      const s2 = SPL[k]; s2.life -= dt; s2.dy += dt * 16;
      if (s2.life <= 0) { SPL.splice(k, 1); continue; }
      const t = 1 - s2.life / s2.max, sc = t < 0.04 ? 0.6 + t / 0.04 * 0.4 : 1;
      ctx.globalAlpha = Math.min(1, s2.life / 0.9) * 0.88 * s2.a;
      ctx.save(); ctx.translate(s2.x, s2.y + s2.dy); ctx.rotate(s2.rot); ctx.drawImage(SPLAT(s2.k), -s2.r * sc / 2, -s2.r * sc / 2, s2.r * sc, s2.r * sc); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function spawn(o) { if (parts.length < 1100) parts.push(o); }
  function burst(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = (o.sp || 200) * (0.3 + R() * 0.9);
      spawn({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (o.vz || 150) * (0.4 + R()), g: o.g == null ? 900 : o.g,
        life: (o.life || 0.6) * (0.6 + R() * 0.6), max: o.life || 0.6, size: (o.size || 3) * (0.6 + R() * 0.8),
        col: Array.isArray(o.col) ? pick(o.col) : o.col, type: o.type || 'spark', rot: R() * 6, vr: rnd2(-10, 10) });
    }
  }
  function rnd2(a, b) { return a + R() * (b - a); }
  function ring(x, y, col, size) { spawn({ x, y, z: 1, vx: 0, vy: 0, vz: 0, g: 0, life: 0.45, max: 0.45, size: size || 40, col, type: 'ring' }); }
  function impact(x, y, z, size) { spawn({ x, y, z, vx: 0, vy: 0, vz: 0, g: 0, life: 0.2, max: 0.2, size, col: '#fff', type: 'lines', rot: R() * 6, vr: 0 }); }
  function turf(x, y, n, sp) { burst(x, y, 2, n, { sp: sp || 160, vz: 260, col: ['#3a2a16', '#4a3720', '#24401f', '#2d5226'], type: 'turf', size: 2.6, life: 0.7, g: 1100 }); }
  function floatTxt(x, y, z, txt, col, sz) {
    for (const f of floats) if (f.life > 0.45 && Math.abs(f.x - x) < 90 && Math.abs(f.y - y) < 90 && Math.abs(f.z - z) < 34) z = f.z + 34;
    floats.push({ x, y, z: z + 20, txt, col, sz: sz || 22, life: 1.1, max: 1.1, rot: rnd2(-0.12, 0.08) }); if (floats.length > 12) floats.shift();
  }
  function showBanner(txt, sub, col, life, sc, yy) { banner = { txt, sub: sub || '', col: col || '#ffffff', life: life || 1.6, max: life || 1.6, sc: sc || 1, yy: yy || 0.4 }; }
  function shake(a) { cam.shake = Math.max(cam.shake, a); }
  function stop(s) { // arrêt sur image à l'impact (solo / hôte)
    const t = performance.now();
    if (app.mode === 'guest' || t - lastStop < 260) return;
    hitStop = Math.max(hitStop, s); lastStop = t;
  }

  function updFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { if (p.type === 'tooth') groundMark('t', p.x, p.y, 1.8, 0, 0, 12, p.rot); parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0) {
        if (p.type === 'blood' || p.type === 'drop') { // la goutte s'écrase dans l'herbe et y reste
          if (p.type === 'blood') groundMark('d', p.x, p.y, p.size * rnd2(0.9, 1.4), 0, 0, 16, R() * 6);
          parts[i] = parts[parts.length - 1]; parts.pop(); continue;
        }
        p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5;
        if (p.type === 'tooth') { p.vr *= 0.5; p.vz *= 1.3; }
      }
      p.rot += (p.vr || 0) * dt;
    }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.z += 40 * dt; if (f.life <= 0) floats.splice(i, 1); }
    if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
    if (flash > 0) flash -= dt * 3.5;
    if (chromaP > 0) chromaP = Math.max(0, chromaP - animRealDt * 3);
    updVfx(dt);
  }

  /* ---------- rendu des particules : billboards instanciés (atlas peint au démarrage) ---------- */
  // tuiles : 0 halo, 1 bouffée, 2 fumée, 3 goutte, 4 motte, 5 confetti, 6 dent, 7 note ♪, 8 note ♫, 9 traits d'impact, 10 anneau, 11 étincelle, 12 orbe
  const PTILE = { spark: 11, fire: 0, puff: 1, smoke: 2, blood: 3, drop: 3, turf: 4, conf: 5, tooth: 6, note: 7, lines: 9, ring: 10, fake: 12 };
  const PADD = { spark: 1, fire: 1, fake: 1 };
  let PM = null, PA = null;
  function buildParticles() {
    const T = 128, c = document.createElement('canvas'); c.width = T * 4; c.height = T * 4; const g = c.getContext('2d');
    const cell = (i, f) => { g.save(); g.translate((i % 4) * T + T / 2, ((i / 4) | 0) * T + T / 2); f(); g.restore(); };
    const soft = (r, a0) => { const rg = g.createRadialGradient(0, 0, 0, 0, 0, r); rg.addColorStop(0, `rgba(255,255,255,${a0})`); rg.addColorStop(0.35, `rgba(255,255,255,${a0 * 0.55})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); };
    const rd = seeded(5);
    cell(0, () => soft(62, 1));
    cell(1, () => { for (let k = 0; k < 7; k++) { g.save(); g.translate((rd() - 0.5) * 50, (rd() - 0.5) * 40); soft(26 + rd() * 16, 0.55); g.restore(); } });
    cell(2, () => { for (let k = 0; k < 10; k++) { g.save(); g.translate((rd() - 0.5) * 60, (rd() - 0.5) * 50); soft(22 + rd() * 20, 0.4); g.restore(); } });
    cell(3, () => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 54, 34, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.0)'; });
    cell(4, () => { g.fillStyle = '#fff'; g.fillRect(-50, -32, 100, 64); g.fillStyle = 'rgba(0,0,0,.3)'; for (let k = 0; k < 14; k++) g.fillRect(-50 + rd() * 100, -32, 3, 22 + rd() * 20); });
    cell(5, () => { g.fillStyle = '#fff'; g.fillRect(-56, -22, 112, 44); });
    cell(6, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-40, -30); g.quadraticCurveTo(0, -46, 40, -30); g.lineTo(34, 18); g.quadraticCurveTo(22, 46, 8, 18); g.lineTo(-8, 18); g.quadraticCurveTo(-22, 46, -34, 18); g.closePath(); g.fill(); });
    cell(7, () => { g.fillStyle = '#fff'; g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 0, 4); });
    cell(8, () => { g.fillStyle = '#fff'; g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♫', 0, 4); });
    cell(9, () => { g.strokeStyle = '#fff'; g.lineCap = 'round'; for (let k = 0; k < 14; k++) { const an = k * 0.449 + (k % 2) * 0.12, r0 = 22, r1 = k % 3 ? 54 : 62; g.lineWidth = 5; g.beginPath(); g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); g.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); g.stroke(); } });
    cell(10, () => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 56, 0, 7); g.stroke(); g.lineWidth = 22; g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(0, 0, 50, 0, 7); g.stroke(); });
    cell(11, () => { const lg = g.createLinearGradient(-60, 0, 60, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.7, 'rgba(255,255,255,.9)'); lg.addColorStop(1, '#fff'); g.fillStyle = lg; g.beginPath(); g.ellipse(0, 0, 60, 9, 0, 0, 7); g.fill(); soft(16, 1); });
    cell(12, () => { soft(60, 0.9); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill(); });
    const tex = new THREE.CanvasTexture(c);
    const mk = additive => {
      const N = 1100, geo = new THREE.PlaneGeometry(1, 1);
      for (const [k, n] of [['iPos', 3], ['iCol', 4], ['iVel', 3], ['iSz', 4]]) geo.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(N * n), n).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.ShaderMaterial({
        uniforms: { tAtlas: { value: tex } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: [
          'attribute vec3 iPos,iVel;attribute vec4 iCol,iSz;varying vec2 vUv;varying vec4 vC;',
          // iSz : x = taille (m), y = rotation, z = tuile, w = mode (0 face caméra, 1 au sol, 2 étiré dans le sens de la vitesse)
          'void main(){float t=iSz.z;vec2 tl=vec2(mod(t,4.),floor(t/4.));vUv=vec2((uv.x+tl.x)*.25,1.-((1.-uv.y)+tl.y)*.25);vC=iCol;',
          ' vec2 q=position.xy;float c=cos(iSz.y),s=sin(iSz.y);',
          ' if(iSz.w>0.5&&iSz.w<1.5){vec3 p=iPos+vec3(q.x*c-q.y*s,0.0,q.x*s+q.y*c)*iSz.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);return;}',
          ' vec4 mv=modelViewMatrix*vec4(iPos,1.);',
          ' if(iSz.w>1.5){vec2 v=(modelViewMatrix*vec4(iVel,0.)).xy;float vl=length(v);vec2 d=vl>1e-4?v/vl:vec2(1.,0.);vec2 n=vec2(-d.y,d.x);float st=1.0+min(vl*0.9,3.0);mv.xy+=(d*q.x*st+n*q.y)*iSz.x;}',
          ' else mv.xy+=vec2(q.x*c-q.y*s,q.x*s+q.y*c)*iSz.x;',
          ' gl_Position=projectionMatrix*mv;}'
        ].join('\n'),
        fragmentShader: 'uniform sampler2D tAtlas;varying vec2 vUv;varying vec4 vC;void main(){float a=texture2D(tAtlas,vUv).a*vC.a;if(a<0.004)discard;gl_FragColor=vec4(vC.rgb'+ (additive ? '*a,a' : ',a') + ');}'
      });
      const m = new THREE.InstancedMesh(geo, mat, N); m.count = 0; m.frustumCulled = false; m.renderOrder = additive ? 6 : 5; scene.add(m);
      return m;
    };
    PM = mk(false); PA = mk(true);
  }
  const _pc = new THREE.Color();
  function drawParts() {
    if (!PM) return;
    const fill = (mesh, add) => {
      const g = mesh.geometry, P = g.attributes.iPos.array, C = g.attributes.iCol.array, Vv = g.attributes.iVel.array, Z = g.attributes.iSz.array;
      let n = 0;
      for (const p of parts) {
        if (!PADD[p.type] !== !add) continue;
        const a = clamp(p.life / p.max, 0, 1);
        let sz = p.size, alpha = 1, mode = 0, tile = PTILE[p.type] || 0, rot = p.rot || 0, intens = 1;
        switch (p.type) {
          case 'spark': sz = p.size * 1.6; alpha = a; mode = 2; intens = 2.2; break;
          case 'fire': sz = p.size * (0.4 + a * 0.8) * 2.1; alpha = a * 0.9; intens = 2.4; break;
          case 'puff': sz = p.size * (1 + (1 - a) * 2.2); alpha = a * 0.4; break;
          case 'smoke': sz = p.size * (1 + (1 - a) * 3); alpha = a * 0.35; break;
          case 'blood': sz = p.size * 1.25; alpha = Math.min(1, a * 2); mode = 2; break;
          case 'drop': sz = p.size * 1.1; alpha = Math.min(0.8, a * 1.6); mode = 2; break;
          case 'tooth': sz = p.size * 1.3; alpha = Math.min(1, a * 3); break;
          case 'turf': sz = p.size * 1.1; alpha = Math.min(1, a * 2.5); break;
          case 'conf': sz = p.size * 1.1; alpha = Math.min(1, a * 2); break;
          case 'ring': sz = p.size * (1.2 - a) * 1.15; alpha = a * 0.9; mode = 1; intens = 1.6; break;
          case 'lines': sz = p.size * (0.8 + (1 - a) * 0.9); alpha = a; intens = 1.8; break;
          case 'note': sz = p.size * 0.9; alpha = Math.min(1, a * 1.6); if (p.txt === '♫') tile = 8; break;
          case 'fake': sz = BR * 1.8; alpha = a * 0.75; intens = 1.4; break;
          case 'bolt': continue;
        }
        _pc.set(p.col || '#fff');
        P[n * 3] = p.x * U3; P[n * 3 + 1] = Math.max(0.02, p.z) * U3; P[n * 3 + 2] = p.y * U3;
        C[n * 4] = _pc.r * intens; C[n * 4 + 1] = _pc.g * intens; C[n * 4 + 2] = _pc.b * intens; C[n * 4 + 3] = alpha;
        Vv[n * 3] = p.vx * U3 * 0.02; Vv[n * 3 + 1] = p.vz * U3 * 0.02; Vv[n * 3 + 2] = p.vy * U3 * 0.02;
        Z[n * 4] = sz * U3; Z[n * 4 + 1] = rot; Z[n * 4 + 2] = tile; Z[n * 4 + 3] = mode;
        if (++n >= 1100) break;
      }
      mesh.count = n;
      for (const k of ['iPos', 'iCol', 'iVel', 'iSz']) g.attributes[k].needsUpdate = true;
    };
    fill(PM, false); fill(PA, true);
    for (const p of parts) if (p.type === 'bolt' && !p.mesh) { p.mesh = lightning(p.pts); }
  }
  // éclair : ruban lumineux en zigzag (MARTEAU DE THOR) — matériau partagé (pas de recompilation)
  const BOLTM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe8ff').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  function lightning(pts) {
    const v = pts.map(q => toW(q[0], q[1], q[2]));
    vfx('fx_lightning', pts[pts.length - 1][0], pts[pts.length - 1][1], 0, { c1: '#6fb8ff', c0: '#ffffff', scale: 1.4, sy: 12, life: 0.3, grow: 0.1 });
    const geo = new THREE.BufferGeometry(), pos = [];
    for (let k = 0; k < v.length - 1; k++) { const a = v[k], b = v[k + 1]; for (const w of [0.18, 0.06]) { pos.push(a.x - w, a.y, a.z, b.x - w, b.y, b.z, b.x + w, b.y, b.z, a.x - w, a.y, a.z, b.x + w, b.y, b.z, a.x + w, a.y, a.z); } }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(geo, BOLTM);
    scene.add(m);
    const t0 = performance.now();
    const tick = () => { const a = 1 - (performance.now() - t0) / 300; if (a <= 0) { scene.remove(m); geo.dispose(); return; } m.scale.set(1, 1, 1); m.visible = a > 0.05 && ((performance.now() / 40) | 0) % 3 !== 0; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return m;
  }
  function drawFloats() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of floats) {
      const t = 1 - f.life / f.max, sc = t < 0.1 ? t / 0.1 * 1.45 : t < 0.2 ? 1.45 - (t - 0.1) * 4.5 : 1;
      const p = P2(f.x, f.y, f.z); if (!p[2]) continue;
      const X = p[0], Y = p[1], s = Math.max(14, f.sz * Math.min(K, 1.6)) * sc;
      ctx.globalAlpha = clamp(f.life / 0.3, 0, 1);
      ctx.save(); ctx.translate(X, Y); ctx.rotate(f.rot); ctx.transform(1, 0, -0.2, 1, 0, 0);
      ctx.font = `${s | 0}px ${FONT}`;
      ctx.fillStyle = '#000'; ctx.fillText(f.txt, s * 0.06, s * 0.07);
      ctx.lineWidth = s * 0.2; ctx.strokeStyle = '#000'; ctx.strokeText(f.txt, 0, 0);
      ctx.fillStyle = f.col; ctx.fillText(f.txt, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- effets VFX (maillages lumineux 3dassets) : impacts, ondes, croissants, éclairs… ---------- */
  const VFXA = [], VFXF = {};
  // c0 : cœur (blanc chaud), c1 : énergie, c2 : chaleur — les matériaux « debris »/« smoke » restent opaques et sombres
  function vfxObj(name) {
    const pool = VFXF[name] || (VFXF[name] = []);
    if (pool.length) return pool.pop();
    const src = MODELS[name]; if (!src) return null;
    const o = src.clone(true); o.userData.vfx = name; o.userData.mats = [];
    o.traverse(m => {
      if (!m.isMesh) return;
      const role = m.material.name, dark = role === 'debris' || role === 'smoke';
      const mt = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      mt.userData.role = role; m.material = mt; m.renderOrder = dark ? 4 : 7; o.userData.mats.push(mt);
    });
    return o;
  }
  const _vq = new THREE.Quaternion(), _ve = new THREE.Euler(), _vY = new THREE.Vector3(0, 1, 0), _vZ = new THREE.Vector3(0, 0, 1);
  // o : { c0, c1, c2, scale, s1 (échelle finale), sy (étirement vertical), life, yaw, pitch, roll, spin, dir:[dx,dy,dz] (axe +Z du modèle), at(t)->[x,y,z] }
  function vfx(name, x, y, z, o) {
    o = o || {};
    if (VFXA.length > 60) { const old = VFXA.shift(); vfxFree(old); }
    const ob = vfxObj(name); if (!ob) return null;
    const S0 = (o.scale || 1), I = o.int || 2.6;
    for (const mt of ob.userData.mats) {
      const r = mt.userData.role;
      const c = r === 'core' ? (o.c0 || '#fff6e0') : r === 'energy' ? (o.c1 || '#3cc8ff') : r === 'heat' ? (o.c2 || o.c1 || '#ff7a1a') : r === 'smoke' ? (o.dark || '#2a2c31') : (o.dark2 || '#4a4036');
      mt.color.set(c); if (mt.blending === THREE.AdditiveBlending) mt.color.multiplyScalar(r === 'core' ? I * 1.2 : I);
      mt.opacity = 1;
    }
    ob.position.copy(toW(x, y, z || 0));
    if (o.dir) { const d = new THREE.Vector3(o.dir[0], o.dir[2] || 0, o.dir[1]).normalize(); ob.quaternion.setFromUnitVectors(_vZ, d); if (o.roll) ob.rotateZ(o.roll); }
    else { _ve.set(o.pitch || 0, o.yaw || 0, o.roll || 0, 'YXZ'); ob.quaternion.setFromEuler(_ve); }
    ob.scale.set(S0, S0 * (o.sy || 1), S0 * (o.sz || 1));
    const e = { ob, t: 0, life: o.life || 0.45, s0: S0, s1: o.s1 == null ? S0 * 1.6 : o.s1, sy: o.sy || 1, sz: o.sz || 1, spin: o.spin || 0, at: o.at || null, grow: o.grow == null ? 0.25 : o.grow, hold: o.hold || 0 };
    scene.add(ob); VFXA.push(e);
    return e;
  }
  function vfxFree(e) { scene.remove(e.ob); (VFXF[e.ob.userData.vfx] = VFXF[e.ob.userData.vfx] || []).push(e.ob); }
  function vfxClear() { while (VFXA.length) vfxFree(VFXA.pop()); }
  function updVfx(dt) {
    for (let i = VFXA.length - 1; i >= 0; i--) {
      const e = VFXA[i]; e.t += dt;
      const u = e.t / e.life;
      if (u >= 1) { VFXA.splice(i, 1); vfxFree(e); continue; }
      const gu = Math.min(1, u / Math.max(0.01, e.grow)), ease = 1 - Math.pow(1 - gu, 3);
      const s = e.s0 + (e.s1 - e.s0) * ease;
      e.ob.scale.set(s, s * e.sy, s * e.sz);
      if (e.spin) e.ob.rotateOnAxis(_vY, e.spin * dt);
      if (e.at) { const p = e.at(e.t); if (p) toW(p[0], p[1], p[2], e.ob.position); }
      const fade = u < e.hold ? 1 : 1 - (u - e.hold) / (1 - e.hold);
      for (const mt of e.ob.userData.mats) mt.opacity = Math.max(0, fade * fade);
    }
  }
