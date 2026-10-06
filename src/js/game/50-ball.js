  /* =============== BALLON, TRAÎNÉES, CAGES =============== */
  // panneaux du ballon : 12 pentagones noirs (sommets de l'icosaèdre), 20 hexagones blancs ; coutures sombres
  const BALLDIR = (() => {
    const t = (1 + Math.sqrt(5)) / 2, pent = [], hex = [];
    for (const [a, b, c] of [[0, 1, t], [0, -1, t], [0, 1, -t], [0, -1, -t]]) for (const p of [[a, b, c], [b, c, a], [c, a, b]]) pent.push(new THREE.Vector3(...p).normalize());
    for (const sx2 of [-1, 1]) for (const sy2 of [-1, 1]) for (const sz2 of [-1, 1]) hex.push(new THREE.Vector3(sx2, sy2, sz2).normalize());
    for (const [a, b] of [[0, 1 / t], [0, -1 / t]]) for (const s2 of [t, -t]) for (const p of [[a, b, s2], [b, s2, a], [s2, a, b]]) hex.push(new THREE.Vector3(...p).normalize());
    return { pent, hex };
  })();
  function ballMaterial() {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.05 });
    m.userData.u = { uIron: { value: 0 }, uGold: { value: 0 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, m.userData.u);
      sh.uniforms.uPent = { value: BALLDIR.pent }; sh.uniforms.uHex = { value: BALLDIR.hex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjN=normalize(position);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjN;uniform vec3 uPent[12];uniform vec3 uHex[20];uniform float uIron,uGold;')
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'vec3 n=normalize(vObjN);float b1=-2.,b2=-2.;bool pen=false;',
          'for(int i=0;i<12;i++){float d=dot(n,uPent[i]);if(d>b1){b2=b1;b1=d;pen=true;}else if(d>b2)b2=d;}',
          'for(int i=0;i<20;i++){float d=dot(n,uHex[i]);if(d>b1){b2=b1;b1=d;pen=false;}else if(d>b2)b2=d;}',
          'float seam=smoothstep(0.0,0.018,b1-b2);',
          'vec3 pc=pen?vec3(0.06,0.065,0.08):vec3(0.94,0.95,0.97);',
          'pc=mix(pc,pen?vec3(0.85,0.62,0.12):vec3(1.0,0.84,0.3),uGold);',
          'pc*=mix(0.35,1.0,seam);diffuseColor.rgb=mix(pc,vec3(0.17,0.18,0.2)*(pen?0.6:1.0),uIron);'
        ].join('\n'))
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.25,uIron);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.9,max(uIron,uGold*0.8));');
    };
    return m;
  }
  // ruban lumineux qui suit un point (traînées de feu, trace des tirs)
  class Ribbon {
    constructor(n, additive) {
      this.n = n; this.pts = []; this.col = [];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 2 * 4), 4).setUsage(THREE.DynamicDrawUsage));
      const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      this.g = g;
      this.m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
      this.m.frustumCulled = false; this.m.renderOrder = 6; scene.add(this.m);
    }
    clear() { this.pts.length = 0; this.m.visible = false; }
    push(x, y, z) { this.pts.push(toW(x, y, z)); if (this.pts.length > this.n) this.pts.shift(); }
    update(width, colorAt) { // width(f) en mètres, colorAt(f) -> [r,g,b,a] (f : 0 queue … 1 tête)
      const P = this.pts, n = P.length; if (n < 2) { this.m.visible = false; return; }
      this.m.visible = true;
      const pos = this.g.attributes.position.array, col = this.g.attributes.color.array, cp = camera.position, t = new THREE.Vector3(), v = new THREE.Vector3(), s = new THREE.Vector3();
      for (let i = 0; i < this.n; i++) {
        const k = Math.min(i, n - 1), p = P[k], f = n > 1 ? k / (n - 1) : 1;
        t.subVectors(P[Math.min(n - 1, k + 1)], P[Math.max(0, k - 1)]); v.subVectors(cp, p); s.crossVectors(t, v).normalize();
        const w = width(f), c = colorAt(f);
        pos[i * 6] = p.x + s.x * w; pos[i * 6 + 1] = p.y + s.y * w; pos[i * 6 + 2] = p.z + s.z * w;
        pos[i * 6 + 3] = p.x - s.x * w; pos[i * 6 + 4] = p.y - s.y * w; pos[i * 6 + 5] = p.z - s.z * w;
        for (const o of [0, 4]) { col[i * 8 + o] = c[0]; col[i * 8 + o + 1] = c[1]; col[i * 8 + o + 2] = c[2]; col[i * 8 + o + 3] = i < n ? c[3] : 0; }
      }
      this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true;
      this.g.setDrawRange(0, (n - 1) * 6);
    }
  }
  const BALL = {};
  function buildBall() {
    const r = BR * U3;
    BALL.mat = ballMaterial();
    BALL.grp = new THREE.Group(); BALL.spin = new THREE.Group(); BALL.grp.add(BALL.spin);
    BALL.mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), BALL.mat); BALL.mesh.castShadow = true;
    const ol = new THREE.Mesh(BALL.mesh.geometry, OUTLINE); BALL.mesh.add(ol);
    BALL.spin.add(BALL.mesh); scene.add(BALL.grp);
    BALL.blob = new THREE.Mesh(BLOBG, BLOBM); BALL.blob.renderOrder = 1; world.add(BALL.blob);
    BALL.q = new THREE.Quaternion();
    BALL.fire = new Ribbon(18, true); BALL.shot = new Ribbon(16, false);
    // ballon dans les flammes (frappes en feu) : maillage « boule de feu » orienté dans le sens du vol
    BALL.fb = vfxObj('fx_fireball'); if (BALL.fb) { BALL.fb.visible = false; scene.add(BALL.fb); }
    // leurres dorés de la TRIPLE COURONNE
    BALL.decoys = [0, 1].map(() => { const m = new THREE.Mesh(BALL.mesh.geometry, (() => { const mm = ballMaterial(); mm.userData.u.uGold.value = 1; mm.emissive = new THREE.Color('#5a3a00'); return mm; })()); m.visible = false; scene.add(m); return m; });
    // lame de LA GRANDE FAUCHEUSE, cornes de la CHARGE DU BUFFLE
    BALL.blade = vfxObj('fx_slash'); if (BALL.blade) { BALL.blade.visible = false; scene.add(BALL.blade); }
    const hornG = merge([tube([[0, 2, 6], [6, 8, 15], [14, 18, 13]], 2.4, '#e2d6b8', 0.5), tube([[0, 2, -6], [6, 8, -15], [14, 18, -13]], 2.4, '#e2d6b8', 0.5)]);
    BALL.horns = new THREE.Mesh(hornG, toon({ vertexColors: true })); BALL.horns.add(new THREE.Mesh(hornG, OUTLINE)); BALL.horns.visible = false; scene.add(BALL.horns);
    BALL.hyp = vfxObj('fx_spinring'); if (BALL.hyp) { BALL.hyp.visible = false; scene.add(BALL.hyp); }
    BALL.light = 0;
  }
  const _bv = new THREE.Vector3(), _bq = new THREE.Quaternion(), _bax = new THREE.Vector3(), _bz = new THREE.Vector3(0, 0, 1);
  function setVfxCol(o, c0, c1, c2, op) { if (!o) return; for (const mt of o.userData.mats) { const r = mt.userData.role; mt.color.set(r === 'core' ? c0 : r === 'energy' ? c1 : r === 'heat' ? c2 : '#3a3434'); if (mt.blending === THREE.AdditiveBlending) mt.color.multiplyScalar(r === 'core' ? 3 : 2.5); mt.opacity = op == null ? 1 : op; } }
  function updBall3D(V, dt) {
    const b = V.ball, uk = b.uk ? ULK[b.uk - 1] : '', inv = uk === 'abra' && b.gu > 0.18 && b.gu < 0.7, now = performance.now();
    const gs = uk === 'rouleau' ? 2.4 : uk === 'bordee' ? 1.25 : 1, r = BR * gs;
    BALL.grp.visible = !inv;
    toW(b.x, b.y, b.z + (gs - 1) * BR, BALL.grp.position);
    // rotation : le ballon roule dans le sens de sa course
    const vx = b.vx || 0, vy = b.vy || 0, sp = len(vx, vy);
    if (sp > 1 && dt > 0) { _bax.set(vy, 0, -vx).normalize(); _bq.setFromAxisAngle(_bax, -sp * dt * (V.ts || 1) * 0.8 / (BR * gs)); BALL.q.premultiply(_bq); }
    // étiré dans le sens de la vitesse, écrasé au rebond
    const st2 = b.owner < 0 ? Math.min(0.3, Math.max(0, sp - 300) / 3200) : 0;
    if (sp > 1) { _bv.set(vx, (bvz || 0), vy).normalize(); BALL.grp.quaternion.setFromUnitVectors(_bz, _bv); } else BALL.grp.quaternion.identity();
    BALL.grp.scale.set(gs * (1 - st2 * 0.55 + BSQ * 0.7), gs * (1 - st2 * 0.55 - BSQ), gs * (1 + st2));
    BALL.spin.quaternion.copy(BALL.grp.quaternion).invert().multiply(BALL.q);
    BALL.mat.userData.u.uIron.value = uk === 'bordee' ? 1 : 0;
    BALL.mat.emissive.set(b.sup ? (uk ? UCOL[uk][0] : b.sup === 2 ? '#ff1e2e' : '#ff6a00') : '#000000'); BALL.mat.emissiveIntensity = b.sup ? 0.6 : 0;
    // ombre
    const f = 1 - Math.min(b.z, 200) / 300; BALL.blob.visible = !inv;
    BALL.blob.position.set(b.x * U3, 0.015, b.y * U3); BALL.blob.scale.set(26 * U3 * f * gs, 1, 22 * U3 * f * gs); BALL.blob.material.opacity = 1;
    // traînées
    if (b.sup && !inv) {
      BALL.fire.push(b.x, b.y, b.z + (gs - 1) * BR);
      const cols = (uk ? UCOL[uk] : b.sup === 2 ? ['#ff1e2e', '#ffffff', '#ff4060'] : ['#ffd23a', '#ff6a00', '#ff1e1e']).map(c => new THREE.Color(c));
      BALL.fire.update(fz => r * U3 * (0.35 + fz * 1.6), fz => { const c = fz > 0.8 ? cols[1] : cols[0]; return [c.r * 3, c.g * 3, c.b * 3, fz * 0.7]; });
    } else BALL.fire.clear();
    if (!b.sup && strail.length > 2 && !inv) {
      BALL.shot.pts = strail.map(q => toW(q[0], q[1], q[2])); const c = new THREE.Color(strailCol);
      BALL.shot.update(fz => r * U3 * (0.25 + 1.1 * fz), fz => [c.r * 1.4, c.g * 1.4, c.b * 1.4, 0.55 * fz]);
    } else BALL.shot.clear();
    // boule de feu autour du ballon
    if (BALL.fb) {
      BALL.fb.visible = !!b.sup && !inv && sp > 200;
      if (BALL.fb.visible) {
        const c = uk ? UCOL[uk] : b.sup === 2 ? ['#ff1e2e', '#ffffff', '#ff4060'] : ['#ff8a1a', '#fff1c2', '#ff3a1a'];
        setVfxCol(BALL.fb, c[1], c[0], c[0], 0.85);
        BALL.fb.position.copy(BALL.grp.position); _bv.set(vx, bvz || 0, vy).normalize(); BALL.fb.quaternion.setFromUnitVectors(_bz, _bv);
        BALL.fb.scale.setScalar(r * U3 * 4.2 * (1 + 0.08 * Math.sin(now / 30)));
      }
    }
    // leurres, lame, cornes, spirale hypnotique
    const dc = uk === 'couronne' && b.gu < 0.97;
    for (let k = 0; k < 2; k++) {
      const m = BALL.decoys[k]; m.visible = dc;
      if (dc) { const s2 = k ? -1 : 1, spd = sp || 1, nx = -vy / spd, ny = vx / spd, off = 115 * Math.sin(Math.PI * clamp(b.gu, 0, 1)); toW(b.x + nx * off * s2, b.y + ny * off * s2, b.z + 6 * s2, m.position); m.quaternion.copy(BALL.q); }
    }
    if (BALL.blade) { BALL.blade.visible = uk === 'fauche' && !!b.sup; if (BALL.blade.visible) { setVfxCol(BALL.blade, '#ffffff', '#a66bff', '#e8dcff', 0.95); BALL.blade.position.copy(BALL.grp.position); BALL.blade.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), _bv.set(vx, 0, vy).normalize()); BALL.blade.scale.setScalar(1.6); } }
    BALL.horns.visible = uk === 'stampede' && !!b.sup;
    if (BALL.horns.visible) { BALL.horns.position.copy(BALL.grp.position); BALL.horns.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), _bv.set(vx, 0, vy).normalize()); BALL.horns.scale.setScalar(U3); }
    if (BALL.hyp) { const on = now < HYPT && b.owner < 0; BALL.hyp.visible = on; if (on) { setVfxCol(BALL.hyp, '#e8dcff', '#a66bff', '#7a3cff', Math.min(1, (HYPT - now) / 400)); BALL.hyp.position.copy(BALL.grp.position); BALL.hyp.rotation.set(0.5, now / 140, 0); BALL.hyp.scale.setScalar(0.9); } }
    // MÉGA tir : arcs électriques ; DÉGAGEMENT OBUS : traînée verte
    if (b.sup === 2 && (!uk || uk === 'thor') && dt > 0 && R() < 0.7) spawn({ x: b.x + rnd2(-8, 8), y: b.y + rnd2(-8, 8), z: b.z + rnd2(-6, 8), vx: rnd2(-300, 300), vy: rnd2(-300, 300), vz: rnd2(-150, 250), g: 0, life: 0.12, max: 0.12, size: 3, col: pick(['#ffffff', '#b8e4ff']), type: 'spark', rot: 0, vr: 0 });
    if (now < OBT && b.owner < 0 && sp > 300 && dt > 0 && R() < 0.8) spawn({ x: b.x, y: b.y, z: b.z, vx: rnd2(-30, 30), vy: rnd2(-30, 30), vz: rnd2(0, 40), g: 0, life: 0.35, max: 0.35, size: rnd2(4, 7), col: pick(['#c6ff1a', '#ffd23a', '#fff']), type: 'fire', rot: 0, vr: 0 });
  }

  /* ---------- cages : montants, filets qui gonflent sous l'impact ---------- */
  const GOALS = [];
  let NETB = null;
  function netBulge(side, y, z) { NETB = { side, y, z: clamp(z, 16, BARZ - 16), t0: performance.now() }; }
  function buildGoals() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; for (let k = 0; k <= 128; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 128); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(128, k); g.stroke(); }
    const netTex = new THREE.CanvasTexture(c); netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.anisotropy = 4;
    const post = new THREE.MeshStandardMaterial({ color: '#f4f5f7', roughness: 0.22, metalness: 0.35, emissive: '#151515' });
    const rad = 2.4 * U3;
    for (const side of [0, 1]) {
      const gx = side ? W : 0, bx = side ? W + GD : -GD, grp = new THREE.Group(); world.add(grp);
      const bar = (a, b2, r) => { const A = toW(...a), B = toW(...b2), d = B.clone().sub(A); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 16), post); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; m.receiveShadow = true; grp.add(m); const o = new THREE.Mesh(m.geometry, OUTLINE); m.add(o); };
      bar([gx, MT, 0], [gx, MT, BARZ + 2], rad); bar([gx, MB, 0], [gx, MB, BARZ + 2], rad); bar([gx, MT - 2, BARZ], [gx, MB + 2, BARZ], rad);
      for (const y of [MT, MB]) { bar([gx, y, BARZ], [bx, y, BARZ], rad * 0.45); bar([bx, y, 0], [bx, y, BARZ], rad * 0.45); bar([gx, y, 0], [bx, y, 0], rad * 0.45); }
      bar([bx, MT, BARZ], [bx, MB, BARZ], rad * 0.45); bar([bx, MT, 0], [bx, MB, 0], rad * 0.45);
      // filets : le fond est subdivisé pour pouvoir gonfler
      const nm = new THREE.MeshStandardMaterial({ map: netTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, color: '#e8ebf0' });
      const cell = 10 * U3;
      const panel = (w, h, sw, sh) => { const p = new THREE.PlaneGeometry(w, h, sw, sh); const uv = p.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / cell, uv.getY(k) * h / cell); return p; };
      const back = new THREE.Mesh(panel((MB - MT) * U3, BARZ * U3, 26, 10), nm); back.rotation.y = side ? -Math.PI / 2 : Math.PI / 2; back.position.set(bx * U3, BARZ * U3 / 2, H / 2 * U3); grp.add(back);
      const top = new THREE.Mesh(panel(GD * U3, (MB - MT) * U3, 4, 20), nm); top.rotation.x = -Math.PI / 2; top.position.set((gx + bx) / 2 * U3, BARZ * U3, H / 2 * U3); grp.add(top);
      for (const y of [MT, MB]) { const s2 = new THREE.Mesh(panel(GD * U3, BARZ * U3, 4, 8), nm); s2.position.set((gx + bx) / 2 * U3, BARZ * U3 / 2, y * U3); grp.add(s2); }
      const base = back.geometry.attributes.position.array.slice();
      GOALS.push({ side, back, base, grp });
    }
  }
  function updGoals() {
    for (const G of GOALS) {
      const pos = G.back.geometry.attributes.position;
      if (!NETB || NETB.side !== G.side) { if (G.dirty) { pos.array.set(G.base); pos.needsUpdate = true; G.dirty = false; } continue; }
      const t = (performance.now() - NETB.t0) / 1000;
      if (t > 1.6) { NETB = null; continue; }
      const A = t < 0.12 ? 40 * Math.sin(t / 0.12 * Math.PI / 2) : 40 * Math.exp(-(t - 0.12) * 3.2) * Math.cos((t - 0.12) * 15), sig2 = 2 * 50 * 50;
      // le plan est tourné de ±90° : son X local suit le terrain en y, son Z local sort vers l'extérieur
      for (let k = 0; k < pos.count; k++) {
        const lx = G.base[k * 3], ly = G.base[k * 3 + 1];
        const yy = H / 2 + (G.side ? lx : -lx) / U3, zz = ly / U3 + BARZ / 2;
        const off = A * Math.exp(-((yy - NETB.y) * (yy - NETB.y) + (zz - NETB.z) * (zz - NETB.z) * 1.6) / sig2);
        pos.array[k * 3 + 2] = -off * U3;
      }
      pos.needsUpdate = true; G.dirty = true;
    }
  }
