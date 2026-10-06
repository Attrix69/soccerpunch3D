  /* =============== TERRAIN : pelouse, lignes, traces, panneaux LED, murets =============== */
  const PX0 = -70, PX1 = W + 70, PY0 = -24, PY1 = H + 28; // étendue de la pelouse peinte (unités)
  const world = new THREE.Group(); scene.add(world);
  let grassTex = null, decalCv = null, decalTex = null, decalDirty = 0;
  const seeded = s0 => { let s = s0; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  function buildPitch() {
    const tw = 2560, th = Math.round(tw * (PY1 - PY0) / (PX1 - PX0));
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    const g = c.getContext('2d'), k = tw / (PX1 - PX0);
    const bx = x => (x - PX0) * k, by = y => (y - PY0) * k;
    const rnd0 = seeded(1337), rnd = (a, b) => a + rnd0() * (b - a);
    // abords : piste sombre
    g.fillStyle = '#1a2117'; g.fillRect(0, 0, tw, th);
    // tonte en damier (comme la version 2D), sous les projecteurs
    const NS = 14, NY = 8;
    for (let i = 0; i < NS; i++) { g.fillStyle = i % 2 ? '#2f7a35' : '#286b2e'; g.fillRect(bx(i * W / NS), by(0), W / NS * k + 1, H * k); }
    for (let j = 0; j < NY; j++) if (j % 2) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(bx(0), by(j * H / NY), W * k, H / NY * k); }
    // brins d'herbe
    for (let n = 0; n < 60000; n++) {
      const x = rnd(PX0, PX1), y = rnd(PY0, PY1);
      g.fillStyle = rnd0() < 0.55 ? 'rgba(6,34,10,.18)' : 'rgba(170,235,150,.07)';
      g.fillRect(bx(x), by(y), rnd(0.8, 1.8), rnd(1.6, 4));
    }
    // usure naturelle : devant les buts, aux points de penalty, au rond central
    const dirt = (x, y, rx, ry, a) => {
      g.save(); g.translate(bx(x), by(y)); g.scale(1, ry / rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx * k); rg.addColorStop(0, `rgba(92,70,40,${a})`); rg.addColorStop(0.6, `rgba(80,62,36,${a * 0.5})`); rg.addColorStop(1, 'rgba(80,62,36,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rx * k, 0, 7); g.fill(); g.restore();
    };
    dirt(36, H / 2, 110, 150, 0.5); dirt(W - 36, H / 2, 110, 150, 0.5); dirt(W / 2, H / 2, 120, 90, 0.16);
    dirt(155, H / 2, 26, 22, 0.35); dirt(W - 155, H / 2, 26, 22, 0.35);
    for (let n = 0; n < 16; n++) dirt(rnd(160, W - 160), rnd(80, H - 80), rnd(24, 50), rnd(16, 36), 0.13);
    // traces de tacles
    g.lineCap = 'round';
    for (let n = 0; n < 22; n++) {
      const x = rnd(60, W - 60), y = rnd(40, H - 40), a = rnd(-0.6, 0.6) + (rnd0() < 0.5 ? 0 : Math.PI), L = rnd(40, 85);
      g.strokeStyle = 'rgba(70,52,30,.4)'; g.lineWidth = rnd(2.5, 4.5) * k;
      g.beginPath(); g.moveTo(bx(x), by(y)); g.lineTo(bx(x + Math.cos(a) * L), by(y + Math.sin(a) * L)); g.stroke();
    }
    // fonds de cages
    for (const side of [0, 1]) { const x0 = side ? W : -GD; g.fillStyle = '#16241a'; g.fillRect(bx(x0), by(MT), GD * k, (MB - MT) * k); }
    // lignes à la craie
    const lines = (lw, col) => {
      g.strokeStyle = col; g.lineWidth = lw * k; g.lineJoin = 'miter';
      g.strokeRect(bx(3), by(3), (W - 6) * k, (H - 6) * k);
      g.beginPath(); g.moveTo(bx(W / 2), by(3)); g.lineTo(bx(W / 2), by(H - 3)); g.stroke();
      const arc = (x, y, r, a0, a1) => { g.beginPath(); g.arc(bx(x), by(y), r * k, a0 || 0, a1 || Math.PI * 2); g.stroke(); };
      arc(W / 2, H / 2, 118);
      for (const sd of [0, 1]) {
        const gx = sd ? W : 0, d = sd ? -1 : 1;
        g.beginPath(); g.moveTo(bx(gx), by(H / 2 - 275)); g.lineTo(bx(gx + d * 225), by(H / 2 - 275)); g.lineTo(bx(gx + d * 225), by(H / 2 + 275)); g.lineTo(bx(gx), by(H / 2 + 275)); g.stroke();
        g.beginPath(); g.moveTo(bx(gx), by(H / 2 - 150)); g.lineTo(bx(gx + d * 78), by(H / 2 - 150)); g.lineTo(bx(gx + d * 78), by(H / 2 + 150)); g.lineTo(bx(gx), by(H / 2 + 150)); g.stroke();
        const a = Math.acos(70 / 100);
        if (sd) arc(gx - 155, H / 2, 100, Math.PI - a, Math.PI + a); else arc(gx + 155, H / 2, 100, -a, a);
        for (const cy of [3, H - 3]) { const st = sd ? (cy < H / 2 ? Math.PI / 2 : Math.PI) : (cy < H / 2 ? 0 : -Math.PI / 2); arc(sd ? W - 3 : 3, cy, 14, st, st + Math.PI / 2); }
      }
    };
    lines(9, 'rgba(255,255,255,.05)');
    lines(2.8, 'rgba(246,246,240,.92)');
    g.fillStyle = 'rgba(246,246,240,.94)';
    for (const x of [W / 2, 155, W - 155]) { g.beginPath(); g.arc(bx(x), by(H / 2), 4 * k, 0, 7); g.fill(); }
    // emblème central : trois griffures rouges
    g.save(); g.translate(bx(W / 2), by(H / 2)); g.rotate(-0.5); g.scale(1.3 * k, 1.3 * k);
    for (let n = -1; n <= 1; n++) { g.fillStyle = 'rgba(210,20,26,.3)'; g.beginPath(); g.moveTo(n * 22 - 4, -78); g.quadraticCurveTo(n * 22 + 9, 0, n * 22 - 2, 80); g.quadraticCurveTo(n * 22 + 2, 0, n * 22 - 4, -78); g.fill(); }
    g.restore();
    grassTex = new THREE.CanvasTexture(c);
    grassTex.colorSpace = THREE.SRGBColorSpace; grassTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // détail : grain de l'herbe en gros plan
    const dc = document.createElement('canvas'); dc.width = dc.height = 256; const dg = dc.getContext('2d'), dr = seeded(77);
    dg.fillStyle = '#808080'; dg.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 9000; n++) { const v = 60 + dr() * 140 | 0; dg.fillStyle = `rgb(${v},${v},${v})`; dg.fillRect(dr() * 256, dr() * 256, 1 + dr(), 2 + dr() * 3); }
    const detail = new THREE.CanvasTexture(dc); detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.93, metalness: 0 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.tDetail = { value: detail };
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 0.78 + 0.44 * texture2D(tDetail, vMapUv * vec2(90.0, 52.0)).r;')
        .replace('#include <common>', '#include <common>\nuniform sampler2D tDetail;');
    };
    const geo = new THREE.PlaneGeometry((PX1 - PX0) * U3, (PY1 - PY0) * U3);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.set((PX0 + PX1) / 2 * U3, 0, (PY0 + PY1) / 2 * U3); m.receiveShadow = true;
    world.add(m);
    // sol au-delà (béton de la piste, sous les tribunes)
    const out = new THREE.Mesh(new THREE.PlaneGeometry(260, 220).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1b3320', roughness: 0.95 })); // gazon synthétique des abords
    out.position.set(CTR.x, -0.02, CTR.z); out.receiveShadow = true; world.add(out);
    // calque des taches de sang (peint au fil du match, brillant comme du sang frais)
    decalCv = document.createElement('canvas'); decalCv.width = 1600; decalCv.height = Math.round(1600 * (PY1 - PY0) / (PX1 - PX0));
    decalTex = new THREE.CanvasTexture(decalCv); decalTex.colorSpace = THREE.SRGBColorSpace;
    const dm = new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: 0.22, metalness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const dmesh = new THREE.Mesh(geo, dm); dmesh.position.copy(m.position); dmesh.position.y = 0.004; dmesh.receiveShadow = true; dmesh.renderOrder = 1;
    world.add(dmesh);
  }
  function clearStains() { if (!decalCv) return; decalCv.getContext('2d').clearRect(0, 0, decalCv.width, decalCv.height); decalTex.needsUpdate = true; }
  function paintStain(s) { // tache de sang imprimée dans la pelouse
    if (!decalCv) return;
    const g = decalCv.getContext('2d'), k = decalCv.width / (PX1 - PX0), X = (s.x - PX0) * k, Y = (s.y - PY0) * k;
    let sd = s.seed; const r0 = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    g.fillStyle = 'rgba(92,6,8,.66)'; g.beginPath(); g.ellipse(X, Y, s.r * k, s.r * k * 0.86, r0() * 3, 0, 7); g.fill();
    g.fillStyle = 'rgba(128,8,10,.6)';
    for (let n = 0; n < 5 + s.r / 2; n++) {
      const d = s.r * (0.8 + r0() * 2.4), a = Math.atan2(s.dy, s.dx) + (r0() - 0.5) * 1.3, rr2 = (0.8 + r0() * s.r * 0.35) * k;
      g.beginPath(); g.ellipse(X + Math.cos(a) * d * k, Y + Math.sin(a) * d * k, rr2, rr2 * 0.8, a, 0, 7); g.fill();
    }
    decalDirty = 1;
  }
  function updDecals() { if (decalDirty && decalTex) { decalDirty = 0; decalTex.needsUpdate = true; } }

  /* ---------- traces éphémères au sol : gouttes, sillons, fissures, griffures, encre, dents ---------- */
  // atlas 4×2 : 0 goutte, 1 sillon, 2 fissure, 3 griffures, 4 encre, 5 brûlure, 6 dent, 7 anneau
  let GM = null; const GMN = 360, gmList = [];
  function buildGroundMarks() {
    const S2 = 128, c = document.createElement('canvas'); c.width = S2 * 4; c.height = S2 * 2; const g = c.getContext('2d');
    const cell = (i, f) => { g.save(); g.translate((i % 4) * S2 + S2 / 2, ((i / 4) | 0) * S2 + S2 / 2); f(); g.restore(); };
    const rd = seeded(9);
    cell(0, () => { g.fillStyle = '#fff'; g.beginPath(); for (let a = 0; a <= 24; a++) { const an = a / 24 * 6.283, r = 34 * (0.75 + rd() * 0.4); g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.fill(); for (let n = 0; n < 9; n++) { const an = rd() * 6.283, d = 40 + rd() * 18; g.beginPath(); g.arc(Math.cos(an) * d, Math.sin(an) * d, 3 + rd() * 6, 0, 7); g.fill(); } });
    cell(1, () => { const lg = g.createLinearGradient(-60, 0, 60, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.2, '#fff'); lg.addColorStop(0.8, '#fff'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(-60, -22, 120, 44); });
    cell(2, () => { g.strokeStyle = '#fff'; g.lineCap = 'round'; for (let n = 0; n < 9; n++) { const a = n * 0.7 + rd() * 0.5; let x = 0, y = 0; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); for (let j = 0; j < 4; j++) { const r = 60 * (0.18 + rd() * 0.16); x += Math.cos(a + (rd() - 0.5) * 0.8) * r; y += Math.sin(a + (rd() - 0.5) * 0.8) * r; g.lineTo(x, y); g.lineWidth *= 0.8; } g.stroke(); } g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill(); });
    cell(3, () => { g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 12; for (const o of [-30, 0, 30]) { g.beginPath(); g.moveTo(-56, o - 10); g.quadraticCurveTo(0, o + 8, 56, o - 6); g.stroke(); } });
    cell(4, () => { g.fillStyle = '#fff'; g.beginPath(); for (let a = 0; a <= 30; a++) { const an = a / 30 * 6.283, r = 44 * (0.7 + 0.3 * Math.sin(an * 5 + 1) * rd()); g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.fill(); });
    cell(5, () => { const rg = g.createRadialGradient(0, 0, 0, 0, 0, 60); rg.addColorStop(0, '#fff'); rg.addColorStop(0.6, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fill(); });
    cell(6, () => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 30, 22, 0, 0, 7); g.fill(); });
    cell(7, () => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 54, 0, 7); g.stroke(); });
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(GMN), 1));
    geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(GMN), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { tAtlas: { value: tex } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aTile,aAlpha;varying vec2 vUv;varying float vA;varying vec3 vC;void main(){vec2 t=vec2(mod(aTile,4.),floor(aTile/4.));vUv=(uv+t)*vec2(.25,.5);vUv.y=1.-((1.-uv.y)+t.y)*.5;vA=aAlpha;vC=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tAtlas;varying vec2 vUv;varying float vA;varying vec3 vC;void main(){float a=texture2D(tAtlas,vUv).a*vA;if(a<0.01)discard;gl_FragColor=vec4(vC,a);}'
    });
    GM = new THREE.InstancedMesh(geo, mat, GMN);
    GM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GMN * 3), 3);
    GM.count = 0; GM.frustumCulled = false; GM.renderOrder = 2; world.add(GM);
  }
  // t : type (d goutte, k sillon, s sillon de sang, t dent, crack, claw, ink, burn) — x2,y2 : fin du sillon
  const GMT = { d: 0, k: 1, s: 1, crack: 2, claw: 3, ink: 4, burn: 5, t: 6, ring: 7 };
  const GMC = { d: '#6e0609', k: '#3a2a16', s: '#6a0609', crack: '#1c140c', claw: '#1a0d04', ink: '#120a1c', burn: '#0c0806', t: '#efeadc', ring: '#ffffff' };
  function groundMark(t, x, y, r, x2, y2, life, rot, col, a0) {
    if (gmList.length >= GMN) gmList.shift();
    const o = { t, x, y, r, x2, y2, life, max: life, rot: rot || 0, col: col || GMC[t], a0: a0 == null ? (t === 's' ? 0.62 : t === 'k' ? 0.5 : t === 'd' ? 0.8 : 0.9) : a0 };
    gmList.push(o); return o;
  }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s3 = new THREE.Vector3(), _p3 = new THREE.Vector3(), _eY = new THREE.Euler(), _c3 = new THREE.Color();
  function updGroundMarks(dt) {
    if (!GM) return;
    const at = GM.geometry.attributes.aTile, aa = GM.geometry.attributes.aAlpha;
    let n = 0;
    for (let i = gmList.length - 1; i >= 0; i--) { const m = gmList[i]; m.life -= dt; if (m.life <= 0) gmList.splice(i, 1); }
    for (const m of gmList) {
      let cx = m.x, cy = m.y, sx2 = m.r * 2, sy2 = m.r * 2, rot = m.rot;
      if (m.t === 'k' || m.t === 's') { cx = (m.x + m.x2) / 2; cy = (m.y + m.y2) / 2; sx2 = len(m.x2 - m.x, m.y2 - m.y) + m.r; sy2 = m.r; rot = Math.atan2(m.y2 - m.y, m.x2 - m.x); }
      if (m.t === 'claw') { cx = (m.x + m.x2) / 2; cy = (m.y + m.y2) / 2; sx2 = len(m.x2 - m.x, m.y2 - m.y) + 20; sy2 = 46; rot = Math.atan2(m.y2 - m.y, m.x2 - m.x); }
      _eY.set(0, -rot, 0); _q.setFromEuler(_eY); _p3.set(cx * U3, 0.012 + n * 0.00002, cy * U3); _s3.set(sx2 * U3, 1, sy2 * U3);
      _m4.compose(_p3, _q, _s3); GM.setMatrixAt(n, _m4);
      _c3.set(m.col); GM.setColorAt(n, _c3);
      at.array[n] = GMT[m.t]; aa.array[n] = m.a0 * clamp(m.life / m.max * 3, 0, 1);
      n++;
    }
    GM.count = n; GM.instanceMatrix.needsUpdate = true; GM.instanceColor.needsUpdate = true; at.needsUpdate = true; aa.needsUpdate = true;
  }

  /* ---------- enceinte : panneaux LED, murets de béton, vitres, poteaux de corner ---------- */
  let ledCv = null, ledTex = null, ledT = 0;
  const ADS = [['TACLE FURY', '#ffffff', '#3a0507'], ['LOUPS', TEAMS[0].c1, '#06121c'], ['AUCUNE RÈGLE', '#ff3b2e', '#160404'], ['FULL CONTACT', '#ffb000', '#161004'], ['TAUREAUX', '#ff3b2e', '#1a0405'], ['3D', '#ffffff', '#120a1c'], ['SANS PITIÉ', '#ff3b2e', '#160404']];
  function drawLED(t) { // les panneaux défilent ; ils flashent aux couleurs de l'équipe qui marque
    const g = ledCv.getContext('2d'), w = ledCv.width, h = ledCv.height, segW = 420;
    const goal = performance.now() < ledGoal.t ? ledGoal.team : -1;
    g.fillStyle = '#050506'; g.fillRect(0, 0, w, h);
    if (goal >= 0) {
      const T = TEAMS[goal], on = ((performance.now() / 160) | 0) % 2;
      g.fillStyle = on ? T.c1 : '#050506'; g.fillRect(0, 0, w, h);
      g.font = `${h * 0.72 | 0}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let x = (t * 300) % 520 - 520; x < w + 520; x += 520) { g.fillStyle = on ? '#050506' : T.c1; g.fillText('BUUUUT !', x, h / 2 + 2); }
    } else {
      const off = (t * 60) % (segW * ADS.length);
      for (let i = -1; i <= Math.ceil(w / segW) + 1; i++) {
        const k = ((i + Math.floor(off / segW)) % ADS.length + ADS.length) % ADS.length, a = ADS[k], x0 = i * segW - (off % segW);
        const pg = g.createLinearGradient(0, 0, 0, h); pg.addColorStop(0, a[2]); pg.addColorStop(1, '#050506');
        g.fillStyle = pg; g.fillRect(x0 + 3, 3, segW - 6, h - 6);
        g.font = `${h * 0.6 | 0}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = a[1];
        g.fillText(a[0], x0 + segW / 2, h / 2 + 2);
      }
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 1; y < h; y += 3) g.fillRect(0, y, w, 1); // trame LED
    ledTex.needsUpdate = true;
  }
  const ledGoal = { t: 0, team: 0 };
  function buildEnclosure() {
    ledCv = document.createElement('canvas'); ledCv.width = 2048; ledCv.height = 64;
    ledTex = new THREE.CanvasTexture(ledCv); ledTex.colorSpace = THREE.SRGBColorSpace; ledTex.wrapS = THREE.RepeatWrapping;
    drawLED(0);
    const ledMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: ledTex, emissiveIntensity: 1.6, roughness: 0.4 });
    const boardMat = stdMat('#0b0b0d', 0.6, 0.3);
    const bh = 0.95, bd = 0.22; // hauteur, épaisseur des panneaux
    const L = (W + 2 * GD + 40) * U3;
    for (const side of [0, 1]) { // panneaux LED des deux touches (dos noir, face lumineuse)
      const z = side ? (H + 12) * U3 + bd / 2 : -10 * U3 - bd / 2;
      const g = new THREE.BoxGeometry(L, bh, bd);
      const box = new THREE.Mesh(g, boardMat); box.position.set(CTR.x, bh / 2, z); box.castShadow = true; box.receiveShadow = true; world.add(box);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.1, bh - 0.12), ledMat);
      face.position.set(CTR.x, bh / 2, side ? z - bd / 2 - 0.004 : z + bd / 2 + 0.004); if (side) face.rotation.y = Math.PI;
      world.add(face);
      // liseré rouge sur le dessus
      const strip = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, bd + 0.02), new THREE.MeshStandardMaterial({ color: '#2a0405', emissive: '#ff1a10', emissiveIntensity: 2.2 }));
      strip.position.set(CTR.x, bh + 0.02, z); world.add(strip);
    }
    // murets de béton derrière les lignes de but (hors de la cage), bande LED rouge
    const conc = stdMat('#202226', 0.85, 0.05), redLed = new THREE.MeshStandardMaterial({ color: '#2a0405', emissive: '#ff1a10', emissiveIntensity: 2.4 });
    for (const side of [0, 1]) {
      const x = side ? (W + 2) * U3 + 0.12 : -2 * U3 - 0.12;
      for (const [y0, y1] of [[-10, MT - 4], [MB + 4, H + 12]]) {
        const len2 = (y1 - y0) * U3, zc = (y0 + y1) / 2 * U3;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, len2), conc); m.position.set(x, 0.375, zc); m.castShadow = true; m.receiveShadow = true; world.add(m);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, len2), redLed); s.position.set(x, 0.77, zc); world.add(s);
      }
    }
    // vitres de protection au-dessus de l'enceinte : le ballon rebondit dessus, à toutes les hauteurs
    const glass = new THREE.MeshStandardMaterial({ color: '#9fc4ff', transparent: true, opacity: 0.05, roughness: 0.05, metalness: 0.6, depthWrite: false, side: THREE.DoubleSide });
    const frameM = stdMat('#1a1c20', 0.5, 0.6);
    const gh = 1.6;
    for (const side of [0, 1]) {
      const z = side ? (H + 12) * U3 + 0.1 : -10 * U3 - 0.1;
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(L, gh), glass); gm.position.set(CTR.x, bh + gh / 2, z); gm.renderOrder = 3; world.add(gm);
      if (!side) for (let x = -GD - 20; x <= W + GD + 20; x += 120) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, gh, 0.04), frameM); p.position.set(x * U3, bh + gh / 2, z); world.add(p); }
    }
    for (const side of [0, 1]) {
      const x = side ? (W + 2) * U3 + 0.2 : -2 * U3 - 0.2;
      for (const [y0, y1] of [[-10, MT - 4], [MB + 4, H + 12]]) {
        const len2 = (y1 - y0) * U3, zc = (y0 + y1) / 2 * U3;
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(len2, gh + 0.2), glass); gm.rotation.y = Math.PI / 2; gm.position.set(x, 0.75 + (gh + 0.2) / 2, zc); gm.renderOrder = 3; world.add(gm);
      }
    }
    // poteaux de corner
    for (const [x, y] of [[3, 3], [W - 3, 3], [3, H - 3], [W - 3, H - 3]]) {
      const f = model('corner_flag', { accent: new THREE.MeshStandardMaterial({ color: '#d4111a', emissive: '#3a0204', side: THREE.DoubleSide }) }, { cast: true });
      f.position.copy(toW(x, y, 0)); f.rotation.y = Math.atan2(y < H / 2 ? 1 : -1, x < W / 2 ? 1 : -1) - Math.PI / 2; f.scale.setScalar(1.1); world.add(f);
    }
  }
  function updEnclosure(dt) { ledT += dt; if (ledCv && (ledT > 0.05)) { drawLED(performance.now() / 1000); ledT = 0; } }
