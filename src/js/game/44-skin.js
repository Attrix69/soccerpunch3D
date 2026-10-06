  /* =============== CORPS RIGÉS : le squelette Quaternius (CC0) piloté par la cinématique de la 2D =============== */
  // La cinématique de la 2D (42-pose.js) donne, à chaque image, les articulations du joueur (JT) et les repères du bassin / des épaules (FR).
  // Ici on les transforme en rotations d'os : les membres par cinématique inverse à deux segments (la main et le pied vont exactement
  // où la 2D les met, quelles que soient les proportions du maillage), le tronc par interpolation entre le repère du bassin et celui des épaules.
  const KM = 33.333, LIFT = 2.75;       // unités de jeu par mètre · hauteur de la cheville du maillage au-dessus de la semelle (unités)
  const SKB = { ok: false, b: {}, L: {} };
  const _sc = V3(), _sv = [V3(), V3(), V3(), V3(), V3(), V3(), V3(), V3()];
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qid = new THREE.Quaternion();
  const _mb = new THREE.Matrix4(), _mc = new THREE.Matrix4();
  // repère orthonormé : x = direction, y = référence (orthogonalisée)
  function basisQ(x, y, out) {
    _sv[0].copy(x).normalize();
    _sv[1].copy(y).addScaledVector(_sv[0], -y.dot(_sv[0]));
    if (_sv[1].lengthSq() < 1e-8) { _sv[1].set(0, 1, 0); if (Math.abs(_sv[0].y) > 0.9) _sv[1].set(1, 0, 0); _sv[1].addScaledVector(_sv[0], -_sv[1].dot(_sv[0])); }
    _sv[1].normalize(); _sv[2].crossVectors(_sv[0], _sv[1]);
    return out.setFromRotationMatrix(_mb.makeBasis(_sv[0], _sv[1], _sv[2]));
  }
  const modelToRig = (v, o) => o.set(v.z * KM, v.y * KM, -v.x * KM);       // repère glTF (face à +Z, gauche en +X) -> repère du jeu (X devant, Z à droite)
  const rigToModel = (v, o) => o.set(-v.z / KM, v.y / KM, v.x / KM);
  function skPrep() { // données de pose communes (position de repos de chaque os), calculées une fois
    if (SKB.ok || !MODELS.body_m) return;
    const g = new THREE.Group(); g.rotation.y = Math.PI / 2; g.scale.setScalar(KM);
    const c = THREE.SkeletonUtils.clone(MODELS.body_m); g.add(c); g.updateMatrixWorld(true);
    c.traverse(o => { if (!o.isBone) return; const p = V3(), q = new THREE.Quaternion(); o.matrixWorld.decompose(p, q, _sc); SKB.b[o.name] = { p, q, par: o.parent && o.parent.isBone ? o.parent.name : null }; });
    const B = SKB.b, D = (a, b) => V3().subVectors(B[b].p, B[a].p).normalize();
    // membres : direction de repos de chaque segment et axe de la charnière (coude / genou), pour garder la torsion des os
    for (const s of ['r', 'l']) {
      const arm = { d1: D('upperarm_' + s, 'lowerarm_' + s), d2: D('lowerarm_' + s, 'hand_' + s) }, leg = { d1: D('thigh_' + s, 'calf_' + s), d2: D('calf_' + s, 'foot_' + s) };
      arm.h = V3().crossVectors(arm.d1, V3().set(1, 0, 0)).normalize(); leg.h = V3().crossVectors(leg.d1, V3().set(-1, 0, 0)).normalize();
      arm.q1 = basisQ(arm.d1, arm.h, new THREE.Quaternion()); arm.q2 = basisQ(arm.d2, arm.h, new THREE.Quaternion());
      leg.q1 = basisQ(leg.d1, leg.h, new THREE.Quaternion()); leg.q2 = basisQ(leg.d2, leg.h, new THREE.Quaternion());
      arm.l1 = B['upperarm_' + s].p.distanceTo(B['lowerarm_' + s].p); arm.l2 = B['lowerarm_' + s].p.distanceTo(B['hand_' + s].p);
      leg.l1 = B['thigh_' + s].p.distanceTo(B['calf_' + s].p); leg.l2 = B['calf_' + s].p.distanceTo(B['foot_' + s].p);
      const lat = V3().subVectors(B.thigh_l.p, B.thigh_r.p).normalize(), fd = D('foot_' + s, 'ball_' + s);
      leg.fd = fd; leg.fq = basisQ(fd, lat, new THREE.Quaternion());
      leg.tilt = Math.atan2(-fd.y, Math.hypot(fd.x, fd.z)); // le pied de repos pointe vers le bas : on le redresse pour que la semelle soit à plat
      SKB.L['arm_' + s] = arm; SKB.L['leg_' + s] = leg;
    }
    SKB.ok = true;
  }

  /* ---------- matériaux : peau, yeux, sourcils (textures partagées, teinte par personnage) ---------- */
  const SKIN_BASE = new THREE.Color('#c8946c'); // couleur moyenne de la texture de peau fournie
  function skinTint(hex, out) { // multiplie la texture pour approcher la peau voulue
    const c = new THREE.Color(hex); out.setRGB(Math.min(1.9, c.r / SKIN_BASE.r), Math.min(1.9, c.g / SKIN_BASE.g), Math.min(1.9, c.b / SKIN_BASE.b)); return out;
  }
  // contour d'un maillage animé par un squelette : même coque inversée que les autres personnages, déformée par les os
  const OUTLINE_SK = new THREE.ShaderMaterial({
    uniforms: OUTL_U, side: THREE.BackSide,
    vertexShader: 'uniform float uPx;uniform vec2 uRes;\n#include <common>\n#include <skinning_pars_vertex>\nvoid main(){\n#include <beginnormal_vertex>\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <begin_vertex>\n#include <skinning_vertex>\nvec4 cp=projectionMatrix*modelViewMatrix*vec4(transformed,1.);vec3 n=normalize(normalMatrix*objectNormal);vec2 d=(projectionMatrix*vec4(n,0.)).xy;float l=length(d);d=l>1e-5?d/l:vec2(0.);cp.xy+=d*uPx*cp.w*2./uRes;gl_Position=cp;}',
    fragmentShader: 'void main(){gl_FragColor=vec4(0.022,0.022,0.03,1.);}'
  });
  function skMesh(geo, mat, src, outline) { // maillage animé rattaché au squelette de `src`, avec son contour
    const m = new THREE.SkinnedMesh(geo, mat); m.bind(src.skeleton, src.bindMatrix); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
    src.parent.add(m);
    if (outline) { const o = new THREE.SkinnedMesh(geo, OUTLINE_SK); o.bind(src.skeleton, src.bindMatrix); o.frustumCulled = false; o.position.copy(src.position); o.quaternion.copy(src.quaternion); o.scale.copy(src.scale); src.parent.add(o); m.userData.outline = o; }
    return m;
  }

  /* ---------- construction d'un personnage animé ---------- */
  function skBuild(rg, L, C, gk, tcol) {
    const src = THREE.SkeletonUtils.clone(MODELS.body_m);
    // gabarit du poste : le corps est élargi après la pose (pas de déformation des os) ; la cinématique inverse travaille dans le repère non étiré
    const bulk = Math.min(1.38, Math.max(0.8, L.b[1])), kLat = 0.9 + (bulk - 0.8) * 0.55, kDep = 0.92 + (bulk - 0.8) * 0.35;
    rg.kS = { x: kDep, z: kLat };
    const mg = new THREE.Group(); mg.rotation.y = Math.PI / 2; mg.scale.set(KM * kLat, KM, KM * kDep); mg.add(src); rg.inner.add(mg); rg.model = mg; rg.src = src;
    rg.bone = {}; rg.wq = {}; src.traverse(o => { if (o.isBone) { rg.bone[o.name] = o; rg.wq[o.name] = new THREE.Quaternion(); } });
    let body = null, eyes = null, brows = null;
    src.traverse(o => { if (!o.isSkinnedMesh) return; if (o.name === 'Eyes') eyes = o; else if (o.name === 'Eyebrows') brows = o; else body = o; });
    rg.skin = skinTint(L.sk, new THREE.Color());
    const skinM = toon({ map: body.material.map, color: rg.skin }); rg.mats.push(skinM);
    const eyeM = toon({ map: eyes.material.map, color: rg.skin.clone().lerp(new THREE.Color(1, 1, 1), 0.35) }); rg.mats.push(eyeM);
    const browM = toon({ map: brows.material.map, color: new THREE.Color(L.hc).multiplyScalar(1.6) }); rg.mats.push(browM);
    body.material = skinM; eyes.material = eyeM; brows.material = browM;
    for (const m of [body, eyes, brows]) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; }
    const ol = new THREE.SkinnedMesh(body.geometry, OUTLINE_SK); ol.bind(body.skeleton, body.bindMatrix); ol.frustumCulled = false; ol.position.copy(body.position); ol.quaternion.copy(body.quaternion); ol.scale.copy(body.scale); body.parent.add(ol); body.userData.outline = ol;
    rg.body3 = body; rg.eyes3 = eyes; rg.brows3 = brows;
    skKit(rg, L, C, gk);
    skFace(rg, L);
    rg.pmat = toon({ vertexColors: true }); rg.mats.push(rg.pmat);
    skHead(rg, L, C, gk, tcol);
    skBoots(rg, L, C, gk);
    // repères portés par les mains (accessoires tenus) et par la tête
    rg.seg = { handR: new THREE.Object3D(), handL: new THREE.Object3D() };
    for (const k of ['handR', 'handL']) { rg.seg[k].matrixAutoUpdate = false; rg.inner.add(rg.seg[k]); }
    rg.fing = [];
    for (const sd of ['l', 'r']) for (const [f, k] of [['index', 1.1], ['middle', 1.2], ['ring', 1.1], ['pinky', 1.0], ['thumb', 0.6]]) for (const n of [1, 2, 3]) { const b = rg.bone[f + '_0' + n + '_' + sd]; if (b) rg.fing.push({ b, q0: b.quaternion.clone(), side: sd, k: k * (n === 1 && f !== 'thumb' ? 0.8 : 1), th: f === 'thumb', n }); }
    rg.sk = true;
  }

  /* ---------- tenue : coques de tissu découpées dans le maillage du corps (même squelette, donc elles suivent chaque mouvement) ---------- */
  // un seul maillage par joueur : maillot, manches, short, chaussettes, chaussures, gants ; une texture (maillot en haut, échantillons de couleur en bas)
  const KIT_Y = { hem: 0.985, waist: 1.045, knee: 0.542, ankle: 0.086 };
  const CELL = { sleeve: [0, 0], shorts: [1, 0], socks: [2, 0], boots: [3, 0], glove: [0, 1], legs: [1, 1], forearm: [2, 1] };
  function kitInfo(geo, bones) { // poids par groupe d'os pour chaque sommet (calcul unique par géométrie)
    if (geo.userData.kit) return geo.userData.kit;
    const n = geo.attributes.position.count, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const neck = new Float32Array(n), hand = new Float32Array(n), foot = new Float32Array(n);
    const kind = bones.map(b => /^(neck_01|Head)$/.test(b.name) ? 1 : /^(hand_|index_|middle_|ring_|pinky_|thumb_)/.test(b.name) ? 2 : /^(foot_|ball_)/.test(b.name) ? 3 : 0);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k), t = kind[si.getComponent(i, k)]; if (t === 1) neck[i] += w; else if (t === 2) hand[i] += w; else if (t === 3) foot[i] += w; }
    return (geo.userData.kit = { neck, hand, foot });
  }
  // découpe d'un polygone par un plan (garde x[axe]·sgn ≤ c·sgn) ; les sommets créés héritent des poids d'os du plus proche
  const _lerpV = (p, q, t) => { const o = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t, nx: p.nx + (q.nx - p.nx) * t, ny: p.ny + (q.ny - p.ny) * t, nz: p.nz + (q.nz - p.nz) * t, nk: p.nk + (q.nk - p.nk) * t, hd: p.hd + (q.hd - p.hd) * t, ft: p.ft + (q.ft - p.ft) * t };
    const nl = Math.hypot(o.nx, o.ny, o.nz) || 1; o.nx /= nl; o.ny /= nl; o.nz /= nl; const w = t < 0.5 ? p : q; o.si = w.si; o.sw = w.sw; return o; };
  function clipPoly(poly, axis, sgn, c) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], dp = (c - p[axis]) * sgn, dq = (c - q[axis]) * sgn;
      if (dp >= 0) out.push(p);
      if ((dp >= 0) !== (dq >= 0)) out.push(_lerpV(p, q, dp / (dp - dq)));
    }
    return out;
  }
  function skKit(rg, L, C, gk) {
    const body = rg.body3, g0 = body.geometry, O = L.o, info = kitInfo(g0, body.skeleton.bones);
    const P = g0.attributes.position, N = g0.attributes.normal, SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight, IX = g0.index;
    const slv = O.sleeve && O.slv > 0 ? O.slv : 0, sl = O.sl, pants = sl > 1 || !!O.legs;
    const xEnd = 0.212 + 0.251 * Math.min(1, slv) + (slv > 1 ? 0.243 * (slv - 1) : 0);
    const yShort = O.legs ? 0.10 : sl > 1 ? Math.max(0.12, 0.542 - 0.456 * (sl - 1)) : 0.971 - 0.4288 * Math.max(0.25, sl);
    // pièces : plans de coupe [axe, sens, valeur] (bords nets) + test sur le centre du triangle pour le reste
    const pieces = [];
    const tank = !slv;
    pieces.push({ cover: 1, off: 0.013, cell: null, cut: [['y', -1, KIT_Y.hem], ['x', 1, 0.215], ['x', -1, -0.215]], sel: (c, v) => v.nk < 0.35 && !(tank && c.y > 1.33 && Math.abs(c.x) > 0.158) && !(c.y < KIT_Y.waist && Math.abs(c.x) > 0.2) });
    if (slv) for (const sd of [1, -1]) pieces.push({ cover: 1, off: 0.013, cell: CELL.sleeve, cut: [['x', -sd, sd * 0.215], ['x', sd, sd * xEnd]], sel: c => c.y > 1.28 && c.y < 1.62 && Math.hypot(c.y - 1.455, c.z + 0.065) < 0.14, t: v => (xEnd - Math.abs(v.x)) / (xEnd - 0.215) });
    pieces.push({ cover: 1, off: 0.010, cell: O.legs ? CELL.legs : CELL.shorts, cut: [['y', -1, yShort], ['y', 1, 1.05], ['x', 1, 0.28], ['x', -1, -0.28]], sel: () => true, t: v => (v.y - yShort) / (1.05 - yShort) });
    if (O.socks && !pants) pieces.push({ cover: 1, off: 0.0065, cell: CELL.socks, cut: [['y', -1, 0.1], ['y', 1, 0.49]], sel: c => Math.abs(c.x) < 0.25, t: v => (v.y - 0.1) / 0.39 });
    const hc = gk ? O.glove || 'acc' : O.hand;
    if (hc) pieces.push({ off: 0.006, cell: CELL.glove, cut: [], sel: (c, v) => v.hd > 0.5, t: () => 0.5 });
    const pp = [], nn = [], si = [], sw = [], uv = [];
    const vert = i => ({ x: P.getX(i), y: P.getY(i), z: P.getZ(i), nx: N.getX(i), ny: N.getY(i), nz: N.getZ(i), si: [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)], sw: [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)], nk: info.neck[i], hd: info.hand[i], ft: info.foot[i] });
    const tri = IX.count / 3, cen = { x: 0, y: 0, z: 0 }, hidden = new Uint8Array(tri);
    for (let t = 0; t < tri; t++) {
      const ia = IX.getX(t * 3), ib = IX.getX(t * 3 + 1), ic = IX.getX(t * 3 + 2), V0 = [vert(ia), vert(ib), vert(ic)];
      for (const pc of pieces) {
        let poly = V0;
        for (const [ax, sg, cv] of pc.cut) { poly = clipPoly(poly, ax, sg, cv); if (poly.length < 3) break; }
        if (poly.length < 3) continue;
        if (poly.length === 3 && poly[0] === V0[0] && poly[1] === V0[1] && poly[2] === V0[2] && pc.cover) { // triangle entièrement sous la coque : on ne le dessine plus sur le corps
          cen.x = (V0[0].x + V0[1].x + V0[2].x) / 3; cen.y = (V0[0].y + V0[1].y + V0[2].y) / 3; cen.z = (V0[0].z + V0[1].z + V0[2].z) / 3;
          if (pc.sel(cen, { nk: (V0[0].nk + V0[1].nk + V0[2].nk) / 3, hd: 0, ft: 0 })) hidden[t] = 1;
        }
        for (let k = 1; k < poly.length - 1; k++) {
          const T = [poly[0], poly[k], poly[k + 1]];
          cen.x = (T[0].x + T[1].x + T[2].x) / 3; cen.y = (T[0].y + T[1].y + T[2].y) / 3; cen.z = (T[0].z + T[1].z + T[2].z) / 3;
          const avg = { nk: (T[0].nk + T[1].nk + T[2].nk) / 3, hd: (T[0].hd + T[1].hd + T[2].hd) / 3, ft: (T[0].ft + T[1].ft + T[2].ft) / 3 };
          if (!pc.sel(cen, avg)) continue;
          const u0 = [];
          for (const v of T) {
            pp.push(v.x + v.nx * pc.off, v.y + v.ny * pc.off, v.z + v.nz * pc.off); nn.push(v.nx, v.ny, v.nz); si.push(...v.si); sw.push(...v.sw);
            if (!pc.cell) { u0.push(0.5 - Math.atan2(v.z + 0.01, v.x) / (2 * Math.PI)); uv.push(0, 0.5 + 0.5 * Math.min(1, Math.max(0, (v.y - KIT_Y.hem) / (1.5 - KIT_Y.hem)))); }
            else { const tt = Math.min(1, Math.max(0, pc.t(v))); uv.push((pc.cell[0] + 0.12 + 0.38) * 0.25, 0.5 - (pc.cell[1] + 0.12 + 0.76 * (1 - tt)) * 0.25); }
          }
          if (!pc.cell) { const m = uv.length / 2; if (Math.max(...u0) - Math.min(...u0) > 0.5) for (let q = 0; q < 3; q++) if (u0[q] < 0.5) u0[q] += 1; for (let q = 0; q < 3; q++) uv[(m - 3 + q) * 2] = u0[q]; }
        }
      }
    }
    if (!pp.length) return;
    { // le corps ne dessine plus ce que la tenue recouvre entièrement (mêmes sommets, autre index)
      const keep = []; for (let t = 0; t < tri; t++) if (!hidden[t]) keep.push(IX.getX(t * 3), IX.getX(t * 3 + 1), IX.getX(t * 3 + 2));
      const bg = new THREE.BufferGeometry(); for (const k in g0.attributes) bg.setAttribute(k, g0.attributes[k]); bg.setIndex(keep); bg.userData.own = true;
      body.geometry = bg; if (body.userData.outline) body.userData.outline.geometry = bg;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.userData.own = true;
    rg.kcv = document.createElement('canvas'); rg.kcv.width = 512; rg.kcv.height = 512;
    rg.ktex = new THREE.CanvasTexture(rg.kcv); rg.ktex.colorSpace = THREE.SRGBColorSpace; rg.ktex.anisotropy = 4; rg.ktex.wrapS = THREE.RepeatWrapping;
    const m = toon({ map: rg.ktex, side: THREE.DoubleSide }); rg.mats.push(m);
    rg.kit = skMesh(g, m, body, true); rg.jcv = rg.kcv; rg.jtex = rg.ktex;
  }
  function paintKit(rg, L, C, gk) { // échantillons de couleur de la tenue (sous le maillot peint par paintJersey)
    const g = rg.kcv.getContext('2d'), O = L.o, cell = (c, f) => { g.save(); g.beginPath(); g.rect(c[0] * 128, 256 + c[1] * 128, 128, 128); g.clip(); g.translate(c[0] * 128, 256 + c[1] * 128); f(); g.restore(); };
    const col = v => OC(L, C, gk, v), grad = (c0, c1, c2) => { const lg = g.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, c2); lg.addColorStop(0.5, c0); lg.addColorStop(1, c1); return lg; };
    cell(CELL.sleeve, () => { const c0 = col(O.sleeve || 'c1'); g.fillStyle = c0; g.fillRect(0, 0, 128, 128); g.fillStyle = shade(hx(c0, '#888888'), 0.7); g.fillRect(0, 100, 128, 28); if (O.wrist) { g.fillStyle = col(O.wrist); g.fillRect(0, 108, 128, 12); } });
    cell(CELL.shorts, () => { const c0 = col(O.shorts); g.fillStyle = c0; g.fillRect(0, 0, 128, 128); g.fillStyle = shade(hx(c0, '#888888'), 0.75); g.fillRect(0, 0, 128, 16); g.fillStyle = shade(hx(c0, '#888888'), 1.25); g.fillRect(0, 100, 128, 28); });
    cell(CELL.legs, () => { const c0 = col(O.legs || O.shorts); g.fillStyle = c0; g.fillRect(0, 0, 128, 128); });
    cell(CELL.socks, () => { const c0 = col(O.socks || 'c1'); g.fillStyle = c0; g.fillRect(0, 0, 128, 128); g.fillStyle = col('c2'); g.fillRect(0, 20, 128, 16); g.fillStyle = shade(hx(c0, '#888888'), 0.8); g.fillRect(0, 108, 128, 20); });
    cell(CELL.boots, () => { const c0 = col(O.boots); g.fillStyle = c0; g.fillRect(0, 0, 128, 128); g.fillStyle = '#17171b'; g.fillRect(0, 96, 128, 32); g.fillStyle = shade(hx(c0, '#888888'), 1.3); g.fillRect(0, 36, 128, 6); });
    cell(CELL.glove, () => { const c0 = col(gk ? O.glove || 'acc' : O.hand || 'acc'); g.fillStyle = c0; g.fillRect(0, 0, 128, 128); });
    rg.ktex.needsUpdate = true;
  }

  /* ---------- tête : cheveux et barbe (assets), couvre-chefs et détails (procéduraux, posés sur l'os de la tête) ---------- */
  const HS = 1.22; // la tête est un peu agrandie pour la lisibilité à distance (proportions « dessin animé » de la 2D)
  const _HQ = new THREE.Quaternion();
  function skHead(rg, L, C, gk, tcol) {
    const hb = rg.bone.Head, HB = SKB.b.Head; hb.scale.setScalar(HS);
    const bi = rg.body3.skeleton.boneInverses[rg.body3.skeleton.bones.indexOf(hb)];
    const hairTex = MODELS.hair && MODELS.hair.getObjectByName('Hair_Buzzed'), tintHair = new THREE.Color(L.hc).multiplyScalar(1.7);
    const addAsset = (name, col) => {
      const src = MODELS.hair && MODELS.hair.getObjectByName(name); if (!src) return;
      const mt = toon({ map: src.material.map, color: col || tintHair, side: THREE.DoubleSide }); rg.mats.push(mt);
      const m = new THREE.Mesh(src.geometry, mt); m.matrixAutoUpdate = false; m.matrix.copy(bi); m.castShadow = true; m.frustumCulled = false;
      const o = new THREE.Mesh(src.geometry, OUTLINE); o.frustumCulled = false; m.add(o); hb.add(m);
    };
    if (HAIR_ASSET[L.hair]) addAsset(HAIR_ASSET[L.hair]);
    if (L.f.beard || L.f.braidbeard) addAsset('Hair_Beard');
    // repère de la tête aux dimensions de l'ancienne tête (rayon 7) : les couvre-chefs et détails procéduraux s'y placent tels quels
    const gh = headGeo(L, C, tcol, true);
    if (gh) {
      const anchor = new THREE.Object3D(), d = V3().set(0.017 * KM, 0.127 * KM, 0);
      _HQ.copy(HB.q).invert(); anchor.quaternion.copy(_HQ); anchor.position.copy(d).applyQuaternion(_HQ).multiplyScalar(1 / (KM * HS));
      anchor.scale.set(0.5, 0.51, 0.43).multiplyScalar(1 / (KM * HS));
      hb.add(anchor); rg.head3 = anchor;
      const m = new THREE.Mesh(gh, rg.pmat); m.castShadow = true; const o = new THREE.Mesh(gh, OUTLINE); m.add(o); anchor.add(m);
    }
  }

  /* ---------- chaussures : de vrais crampons (3dassets.dev, CC0) posés sur l'os de chaque pied ---------- */
  const CLEAT = {}; // géométries (gauche / droite) découpées dans la paire, centrées sur l'empreinte du pied
  function cleatGeos() {
    if (CLEAT.ok || !MODELS.cleat) return CLEAT;
    const src = MODELS.cleat; src.updateMatrixWorld(true);
    src.traverse(m => {
      if (!m.isMesh) return;
      const nm = m.material.name, g = floatGeo(m.geometry); g.applyMatrix4(m.matrixWorld);
      const pos = g.attributes.position, nor = g.attributes.normal;
      for (const side of [0, 1]) { // 0 : moitié x < 0, 1 : moitié x > 0
        const pp = [], nn = [];
        for (let t = 0; t < pos.count / 3; t++) {
          const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3; if ((cx > 0 ? 1 : 0) !== side) continue;
          for (let k = 0; k < 3; k++) { const i = t * 3 + k; pp.push(pos.getX(i) - (side ? 0.085 : -0.085), pos.getY(i), pos.getZ(i) - 0.025); nn.push(nor.getX(i), nor.getY(i), nor.getZ(i)); }
        }
        const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); q.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
        (CLEAT[nm] = CLEAT[nm] || [])[side] = q;
      }
    });
    CLEAT.ok = true; return CLEAT;
  }
  function skBoots(rg, L, C, gk) {
    const G = cleatGeos(); if (!G.blue) return;
    const O = L.o, main = new THREE.Color(hx(OC(L, C, gk, O.boots), '#222222')), lum = main.r * 0.3 + main.g * 0.59 + main.b * 0.11;
    const mats = { blue: toon({ color: main }), white: toon({ color: lum > 0.62 ? '#26262c' : '#eceef2' }), metal: toon({ color: '#17171b' }) };
    for (const k in mats) rg.mats.push(mats[k]);
    const bw = O.bootW || 1, sk = rg.body3.skeleton;
    for (const [s, x] of [['l', 0.114], ['r', -0.114]]) {
      const fb = rg.bone['foot_' + s], bi = sk.boneInverses[sk.bones.indexOf(fb)];
      const grp = new THREE.Group(); grp.matrixAutoUpdate = false;
      grp.matrix.copy(bi).multiply(_mb.makeTranslation(x, 0, -0.004)).multiply(_mc.makeScale(1.04 * Math.sqrt(bw), 1.02, 1.05)); fb.add(grp);
      for (const nm of ['blue', 'white', 'metal']) {
        const g = G[nm][x > 0 ? 1 : 0]; if (!g) continue;
        const m = new THREE.Mesh(g, mats[nm]); m.castShadow = true; m.frustumCulled = false; grp.add(m);
        if (nm !== 'metal') { const o = new THREE.Mesh(g, OUTLINE); o.frustumCulled = false; m.add(o); }
      }
    }
  }

  /* ---------- mains : poing fermé ou main ouverte ---------- */
  const _fa = new THREE.Vector3(1, 0, 0), _fq = new THREE.Quaternion();
  function skFist(rg, fr, fl) { // fr / fl : fermeture de la main droite / gauche (0 ouverte, 1 poing)
    for (const f of rg.fing) {
      const a = (f.side === 'r' ? fr : fl) * (f.th ? 0.9 : 1.55) * f.k;
      if (f.th) _fa.set(0, 0, 1); else _fa.set(1, 0, 0);
      f.b.quaternion.copy(f.q0).multiply(_fq.setFromAxisAngle(_fa, a));
    }
  }

  /* ---------- visage : calque peint (expressions, blessures, maquillage) posé sur la face sculptée ---------- */
  // projection de face : u = (x + 0.09) / 0.18, v = (1,80 - y) / 0.25 (mètres, repère du modèle) ; carte de 256 px
  const FX = x => (x + 0.09) * 1422.2, FY = y => (1.8 - y) * 1024;
  function skFace(rg, L) {
    const body = rg.body3, g0 = body.geometry, P = g0.attributes.position, N = g0.attributes.normal, SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight, IX = g0.index;
    const pp = [], nn = [], si = [], sw = [], uv = [];
    for (let t = 0; t < IX.count / 3; t++) {
      const ia = IX.getX(t * 3), ib = IX.getX(t * 3 + 1), ic = IX.getX(t * 3 + 2);
      const cx = (P.getX(ia) + P.getX(ib) + P.getX(ic)) / 3, cy = (P.getY(ia) + P.getY(ib) + P.getY(ic)) / 3, cz = (P.getZ(ia) + P.getZ(ib) + P.getZ(ic)) / 3, nz = (N.getZ(ia) + N.getZ(ib) + N.getZ(ic)) / 3;
      if (cz < 0.02 || cy < 1.545 || cy > 1.8 || Math.abs(cx) > 0.1 || nz < 0.2) continue;
      for (const i of [ia, ib, ic]) {
        pp.push(P.getX(i) + N.getX(i) * 0.0016, P.getY(i) + N.getY(i) * 0.0016, P.getZ(i) + N.getZ(i) * 0.0016); nn.push(N.getX(i), N.getY(i), N.getZ(i));
        si.push(SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)); sw.push(SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i));
        uv.push((P.getX(i) + 0.09) / 0.18, (P.getY(i) - 1.55) / 0.25);
      }
    }
    if (!pp.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.userData.own = true;
    rg.fcv = document.createElement('canvas'); rg.fcv.width = rg.fcv.height = 256;
    rg.ftex = new THREE.CanvasTexture(rg.fcv); rg.ftex.colorSpace = THREE.SRGBColorSpace; rg.ftex.anisotropy = 4;
    const fm = toon({ map: rg.ftex, transparent: true, alphaTest: 0.02, alphaHash: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); rg.mats.push(fm);
    rg.face = skMesh(g, fm, body, false); rg.face.castShadow = false; rg.face.renderOrder = 3;
  }
  function paintFace2(rg, st) { // st : { mouth, ko, blv, blink, t }
    if (!rg.fcv) return;
    const g = rg.fcv.getContext('2d'), L = rg.L, F = L.f, hair = L.hc, PU = 17, lid = shade(L.sk, 0.97);
    g.clearRect(0, 0, 256, 256); g.lineCap = 'round'; g.lineJoin = 'round';
    // anciennes coordonnées (devant, bas, côté) -> pixels : le côté droit du personnage est du côté -X du modèle
    const P = (f, d, l) => [FX(-l * 0.0152), FY(1.696 - (d + 0.5) * 0.0175)];
    const ell = (q, rx, ry, col, rot) => { g.fillStyle = col; g.beginPath(); g.ellipse(q[0], q[1], rx, ry, rot || 0, 0, 7); g.fill(); };
    const seg2 = (a, b, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
    if (F.skull) { ell(P(0, 0.4, 0), 122, 154, '#ece7de'); }
    if (F.warpaint) seg2(P(5.5, -0.6, -7), P(5.5, -0.6, 7), 2.4 * PU, 'rgba(40,100,255,.8)');
    if (F.eyemask) seg2(P(5.2, -0.7, -6.4), P(5.2, -0.7, 6.4), 3.2 * PU * 0.8, '#060608');
    const ko = st.ko, blv = st.blv;
    for (const s of [-1, 1]) {
      const e = P(5.0, -0.5, s * 2.5);
      if (blv >= 2 && (s === 1 || blv >= 3) && !F.shades && !F.skull) {
        ell([e[0], e[1] + 4], 2.6 * PU, 1.7 * PU, 'rgba(64,18,58,.65)');
        if (blv >= 3 && s === 1 && !ko) { ell(e, 1.9 * PU, 0.9 * PU, lid); seg2([e[0] - 22, e[1] + 2], [e[0] + 22, e[1] + 4], 1.0 * PU, '#060608'); continue; }
      }
      if (ko) { ell(e, 1.9 * PU, 1.05 * PU, lid); seg2([e[0] - 20, e[1] - 14], [e[0] + 20, e[1] + 14], 1.0 * PU, '#060608'); seg2([e[0] + 20, e[1] - 14], [e[0] - 20, e[1] + 14], 1.0 * PU, '#060608'); continue; }
      if (F.shades) continue;
      if (F.spiral) { ell(e, 1.7 * PU, 1.15 * PU, '#f2ede4'); g.strokeStyle = '#7a3cff'; g.lineWidth = 4; g.beginPath(); for (let k = 0; k <= 14; k++) { const a = st.t * 9 * s + k * 0.7, r = 0.13 * k * PU; g.lineTo(e[0] + Math.cos(a) * r, e[1] + Math.sin(a) * r * 0.75); } g.stroke(); continue; }
      if (F.patch && s === 1) { ell([e[0], e[1] + 2], 2.2 * PU, 1.5 * PU, '#060608'); const q = P(0, -5.5, 6.8); seg2(e, q, 8, '#060608'); seg2(P(5, -2.6, -6.8), e, 8, '#060608'); continue; }
      if (F.skull) { ell([e[0], e[1] + 2], 2.2 * PU, 1.9 * PU, '#060608'); ell([e[0], e[1] + 2], 0.7 * PU, 0.7 * PU, '#ff2a1e'); continue; }
      if (st.blink) { ell(e, 1.9 * PU, 1.05 * PU, lid); seg2([e[0] - 22, e[1] + 1], [e[0] + 22, e[1] + 1], 7, '#060608'); continue; }
    }
    if (F.skull) { const q = P(6.6, 1.4, 0); g.fillStyle = '#060608'; g.beginPath(); g.moveTo(q[0] - 12, q[1] + 8); g.lineTo(q[0] + 12, q[1] + 8); g.lineTo(q[0], q[1] - 10); g.closePath(); g.fill(); }
    if (F.stripes) for (const l of [-1, 1]) for (const dd of [0.6, 2.4]) seg2(P(5.2, dd, l * 3.4), P(4.4, dd + 0.6, l * 5.6), 0.8 * PU, '#111');
    if (F.whiskers) for (const l of [-1, 1]) for (const dd of [-0.6, 0.6]) seg2(P(6.4, 2.6 + dd, l * 1.6), P(5, 2.2 + dd * 2.2, l * 6.6), 4, 'rgba(20,20,20,.85)');
    if (F.scar) seg2(P(5.6, -3.6, -3.6), P(5.5, 2.4, -1.6), 0.8 * PU, '#7a2a22');
    if (F.tape) seg2(P(6.7, 0.6, -1.9), P(6.7, 0.6, 1.9), 1.2 * PU, '#f4f1ea');
    // bouche
    const m = P(5.9, 4.5, 0);
    if (st.mouth) { ell(m, 1.7 * PU, 1.3 * PU, '#2a0608'); g.fillStyle = '#f2ede4'; g.fillRect(m[0] - 1.35 * PU, m[1] - 1.0 * PU, 2.7 * PU, 0.65 * PU); ell([m[0], m[1] + 0.7 * PU], 0.95 * PU, 0.42 * PU, '#a83a3a'); }
    // bosses et blessures
    if (blv >= 2) { ell(P(5.2, -4.4, -2.6), (1.7 + 0.4 * (blv - 2)) * PU, (1.3 + 0.3 * (blv - 2)) * PU, 'rgba(90,30,70,.35)'); if (blv >= 3) ell(P(5.3, 1.2, 3.6), 2.0 * PU, 1.4 * PU, 'rgba(80,24,60,.45)'); }
    if (blv >= 1 && GORE) {
      seg2(P(6.6, 1.4, 0.7), P(6.3, 4.4 + blv * 0.6, 0.7), 1.1 * PU, '#a30c10');
      if (blv >= 2) { const c1 = P(5.4, -2.6, 2.6), c2 = P(5.0, 0.6, 3.4); seg2([c1[0] - 16, c1[1] - 7], [c1[0] + 16, c1[1] + 7], 0.9 * PU, '#a30c10'); seg2(c1, c2, 0.8 * PU, '#a30c10'); }
      if (blv >= 3) { ell(P(4.6, 2.2, -2.2), 2.0 * PU, 1.6 * PU, 'rgba(150,8,12,.78)'); ell(P(3.5, -4.5, 3), 1.5 * PU, 1.2 * PU, 'rgba(150,8,12,.6)'); }
    }
    rg.ftex.needsUpdate = true;
  }
  function skDispose(rg) { rg.model.traverse(o => { if (o.isSkinnedMesh && o.geometry && o.geometry.userData.own) o.geometry.dispose(); if (o.skeleton) o.skeleton.dispose(); }); }

  /* ---------- pose : des articulations de la 2D aux rotations d'os ---------- */
  function skWQ(rg, name) { // rotation monde d'un os qu'on ne pilote pas : parent × rotation locale de repos
    const B = SKB.b[name], q = rg.wq[name];
    if (!B.par) return q.copy(B.q);
    return q.copy(skWQ(rg, B.par)).multiply(rg.bone[name].quaternion);
  }
  function skSet(rg, name, qW) { // pose l'os pour qu'il ait la rotation monde qW
    const B = SKB.b[name], qp = B.par ? rg.wq[B.par] : _qid, b = rg.bone[name];
    b.quaternion.copy(qp).invert().multiply(qW); rg.wq[name].copy(qW);
  }
  function skPos(rg, bone, out) { // position d'un os (unités du personnage) : on remonte la chaîne des matrices locales
    bone.updateMatrix(); _mc.copy(bone.matrix);
    for (let o = bone.parent; o && o !== rg.src; o = o.parent) { o.updateMatrix(); _mc.premultiply(o.matrix); }
    return modelToRig(out.setFromMatrixPosition(_mc), out);
  }
  const _R = V3(), _M = V3(), _E = V3(), _d1 = V3(), _d2 = V3(), _h = V3(), _hf = V3(), _p = V3(), _dn = V3(), _t = V3();
  // cinématique inverse à deux segments : racine R, extrémité visée E, coude / genou attiré vers le point M (celui de la 2D)
  function skIK2(l1, l2, R, E, Mfk, outM, outE) {
    _dn.subVectors(E, R); let dist = _dn.length(); if (dist < 1e-4) { _dn.set(0, -1, 0); dist = 1e-4; } _dn.multiplyScalar(1 / dist);
    const dd = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.05), l1 + l2 - 0.02);
    const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    _p.subVectors(Mfk, R); _p.addScaledVector(_dn, -_p.dot(_dn));
    if (_p.lengthSq() < 1e-6) _p.set(0, 0, 1); _p.normalize();
    outE.copy(R).addScaledVector(_dn, dd); outM.copy(R).addScaledVector(_dn, a).addScaledVector(_p, h);
  }
  // pose d'un membre à deux segments ; bendRef : direction vers laquelle plie naturellement l'articulation (sert quand le membre est tendu)
  function skLimb(rg, key, nR, nM, nE, bendRef) {
    const Lm = SKB.L[key];
    _d1.subVectors(_M, _R).normalize(); _d2.subVectors(_E, _M).normalize();
    _h.crossVectors(_d1, _d2); const sn = _h.length();
    _hf.crossVectors(_d1, bendRef); if (_hf.lengthSq() < 1e-6) _hf.crossVectors(_d1, _t.set(0, 1, 0)); _hf.normalize();
    if (sn > 1e-4) { _h.multiplyScalar(1 / sn); if (_h.dot(_hf) < 0) _h.negate(); const w = Math.min(1, Math.max(0, (sn - 0.04) / 0.2)); _h.multiplyScalar(w).addScaledVector(_hf, 1 - w).normalize(); } else _h.copy(_hf);
    basisQ(_d1, _h, _qa); _qb.copy(Lm.q1).invert(); _qa.multiply(_qb).multiply(SKB.b[nR].q); skSet(rg, nR, _qa.clone());
    basisQ(_d2, _h, _qa); _qb.copy(Lm.q2).invert(); _qa.multiply(_qb).multiply(SKB.b[nM].q); skSet(rg, nM, _qa.clone());
    return Lm;
  }
  const _qs = new THREE.Quaternion(), _qh = new THREE.Quaternion();
  function skPose(rg, po) {
    const B = SKB.b, bone = rg.bone, J = JT, up = 0; // la hauteur de cheville est ajoutée au groupe entier (cf. updRigSkin)
    // bassin : position et orientation
    const kx = 1 / rg.kS.x, kz = 1 / rg.kS.z, US = (v, o) => o.set(v.x * kx, v.y, v.z * kz);
    US(J.Hc, _t); _t.y += up - 0.6; rigToModel(_t, _t);
    bone.pelvis.position.copy(_t).applyQuaternion(_qa.copy(bone.root.quaternion).invert()); // l'os racine est tourné de -90° (export Blender)
    rg.wq.root.copy(B.root.q);
    _qa.setFromRotationMatrix(_mb.makeBasis(FR.hX, FR.hY, FR.hZ)); _qh.copy(_qa);                // bassin
    _qb.setFromRotationMatrix(_mb.makeBasis(FR.sX, FR.sY, FR.sZ));                                 // épaules
    skSet(rg, 'pelvis', _qa.clone().multiply(B.pelvis.q));
    skSet(rg, 'spine_01', _qc.copy(_qh).slerp(_qb, 0.34).multiply(B.spine_01.q));
    skSet(rg, 'spine_02', _qc.copy(_qh).slerp(_qb, 0.67).multiply(B.spine_02.q));
    skSet(rg, 'spine_03', _qc.copy(_qb).multiply(B.spine_03.q));
    // tête et cou
    _t.subVectors(J.hc, J.nk).normalize(); _sv[0].copy(FR.sX).addScaledVector(_t, -FR.sX.dot(_t)).normalize(); _sv[1].crossVectors(_sv[0], _t);
    _qa.setFromRotationMatrix(_mb.makeBasis(_sv[0], _t, _sv[1]));
    skSet(rg, 'neck_01', _qc.copy(_qb).slerp(_qa, 0.5).multiply(B.neck_01.q));
    skSet(rg, 'Head', _qc.copy(_qa).multiply(B.Head.q));
    skWQ(rg, 'clavicle_l'); skWQ(rg, 'clavicle_r');
    // bras
    for (const [s, Sj, El, Hd] of [['r', J.sjR, J.elR, J.hdR], ['l', J.sjL, J.elL, J.hdL]]) {
      const nR = 'upperarm_' + s, nM = 'lowerarm_' + s, nE = 'hand_' + s, Lm = SKB.L['arm_' + s];
      skPos(rg, bone[nR], _R); US(El, _M); _M.y += up;
      _dn.subVectors(Hd, El).normalize(); US(Hd, _E); _E.y += up; _E.addScaledVector(_dn, -3.2); // le poignet est en retrait du centre de la main
      skIK2(Lm.l1, Lm.l2, _R, _E, _M, _M, _E);
      _sv[3].copy(Math.abs(FR.sX.dot(_d1.subVectors(_M, _R).normalize())) > 0.85 ? FR.sY : FR.sX);
      skLimb(rg, 'arm_' + s, nR, nM, nE, _sv[3]);
      // main : suit l'avant-bras
      basisQ(_d2, _h, _qa); _qb.copy(Lm.q2).invert(); _qa.multiply(_qb).multiply(B[nE].q); skSet(rg, nE, _qa.clone());
    }
    // jambes
    for (const [s, Hj, Kn, Ft, To] of [['r', J.hjR, J.knR, J.ftR, J.toR], ['l', J.hjL, J.knL, J.ftL, J.toL]]) {
      const nR = 'thigh_' + s, nM = 'calf_' + s, nE = 'foot_' + s, Lm = SKB.L['leg_' + s];
      skPos(rg, bone[nR], _R); US(Kn, _M); _M.y += up; US(Ft, _E); _E.y += up;
      skIK2(Lm.l1, Lm.l2, _R, _E, _M, _M, _E);
      _sv[3].copy(FR.hX).negate();
      skLimb(rg, 'leg_' + s, nR, nM, nE, _sv[3]);
      // pied : vers la pointe, incliné comme au repos pour que la semelle soit à plat
      US(To, _d1); US(Ft, _t); _d1.sub(_t).normalize(); _sv[4].subVectors(J.hjL, J.hjR).normalize();
      _sv[5].crossVectors(_d1, _sv[4]).normalize(); _d1.multiplyScalar(Math.cos(Lm.tilt)).addScaledVector(_sv[5], -Math.sin(Lm.tilt));
      basisQ(_d1, _sv[4], _qa); _qb.copy(Lm.fq).invert(); _qa.multiply(_qb).multiply(B[nE].q); skSet(rg, nE, _qa.clone());
    }
  }

  /* ---------- tout le personnage pour une image ---------- */
  function updRigSkin(rg, p, i, po, now) {
    rg.inner.position.y += LIFT; // les semelles du maillage posées au sol
    skPose(rg, po);
    { const open = !rg.gk && /^(magic|tentacle|sly|conduct|royal)$/.test(rg.L.pe.idle || '') && !isStrike(p.st), c = rg.gk ? 0.3 : open ? 0.25 : 0.95; skFist(rg, c, c); }
    setSeg(rg.seg.handR, JT.hdR, _q1.copy(JT.hdR).multiplyScalar(2).sub(JT.elR), 0, FR.sZ, FR.sX);
    setSeg(rg.seg.handL, JT.hdL, _q1.copy(JT.hdL).multiplyScalar(2).sub(JT.elL), 0, FR.sZ, FR.sX);
    setFrame(rg.chest, JT.Sc, FR.sX, FR.sY, FR.sZ); setFrame(rg.hips, JT.Hc, FR.hX, FR.hY, FR.hZ);
    updCloth(rg, po, i, now);
    rigRoot(rg, p, i, po);
    { const blv = BLV(p.dmg || 0), blink = (((now + i * 1.7) % 3.7) < 0.12) ? 1 : 0, spiral = rg.L.f.spiral ? ((now * 12) | 0) : 0;
      const fk = (po.mouth ? 1 : 0) + '|' + (po.eyes === 0 ? 1 : 0) + '|' + blv + '|' + blink + '|' + spiral + '|' + GORE;
      if (fk !== rg.fkey) { rg.fkey = fk; paintFace2(rg, { mouth: po.mouth, ko: po.eyes === 0, blv, blink, t: now }); } }
    const blv = BLV(p.dmg || 0), dirt = i < 8 ? Math.round((DIRT[i] || 0) * 8) / 8 : 0, jk = dirt + '|' + (blv >= 2 ? blv : 0) + '|' + GORE;
    if (rg.kcv && jk !== rg.jkey) { rg.jkey = jk; paintJersey(rg, L0(rg), PAL[rg.team], rg.gk, dirt, blv); }
    rigFlash(rg, p, i);
    return po;
  }
  const L0 = rg => rg.L;
