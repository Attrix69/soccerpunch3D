  /* =============== PERSONNAGES 3D : figurines encrées, construites à partir du LOOK de chaque joueur =============== */
  // Repère d'un personnage (en unités de la simulation, 1 u = 3 cm) : X devant, Y en haut, Z à sa droite.
  // Les membres sont des capsules rigides posées entre les articulations calculées par la cinématique de la 2D.
  const INKC = new THREE.Color('#060608');
  const GRAD = (() => { const d = new Uint8Array([90, 150, 210, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const OUTL_U = { uPx: { value: 2.2 }, uRes: { value: new THREE.Vector2(1280, 720) } };
  const OUTLINE = new THREE.ShaderMaterial({
    uniforms: OUTL_U, side: THREE.BackSide,
    vertexShader: 'uniform float uPx;uniform vec2 uRes;void main(){vec4 cp=projectionMatrix*modelViewMatrix*vec4(position,1.);vec3 n=normalize(normalMatrix*normal);vec2 d=(projectionMatrix*vec4(n,0.)).xy;float l=length(d);d=l>1e-5?d/l:vec2(0.);cp.xy+=d*uPx*cp.w*2./uRes;gl_Position=cp;}',
    fragmentShader: 'void main(){gl_FragColor=vec4(0.022,0.022,0.03,1.);}'
  });
  function toon(o) { // matériau « cel-shading » + liseré de lumière (contre-jour des projecteurs)
    const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD, alphaHash: true }, o)); // alphaHash fixe : le clignotement ne change que l'opacité
    m.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
        'float rimF=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);outgoingLight+=vec3(0.62,0.66,0.8)*rimF*0.55;\n#include <opaque_fragment>');
    };
    return m;
  }

  /* ---------- briques de géométrie (couleurs par sommet, fusionnées par segment) ---------- */
  const _cc = new THREE.Color();
  function colorize(g, col) {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    _cc.set(col); const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = _cc.r; a[i * 3 + 1] = _cc.g; a[i * 3 + 2] = _cc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }
  // capsule effilée le long de -Y : rayon r0 en haut (y = y0), r1 en bas (y = y0 - L)
  function capsule(r0, r1, L, col, y0, seg) {
    const pts = [], n = 6;
    for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + k / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r1, -L + Math.sin(a) * r1)); }
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
    pts[0].x = 0.001; pts[pts.length - 1].x = 0.001;
    const g = new THREE.LatheGeometry(pts, seg || 12); if (y0) g.translate(0, y0, 0);
    return colorize(g, col);
  }
  function sph(r, col, x, y, z, sx, sy, sz, ws, hs) { const g = new THREE.SphereGeometry(r, ws || 14, hs || 10); g.scale(sx || 1, sy || 1, sz || 1); g.translate(x || 0, y || 0, z || 0); return colorize(g, col); }
  function rbox(w, h, d, r, col, x, y, z) { const g = new THREE.RoundedBoxGeometry(w, h, d, 2, r); g.translate(x || 0, y || 0, z || 0); return colorize(g, col); }
  function cyl(r0, r1, h, col, x, y, z, seg) { const g = new THREE.CylinderGeometry(r0, r1, h, seg || 14); g.translate(x || 0, y || 0, z || 0); return colorize(g, col); }
  function cone(r, h, col) { return colorize(new THREE.ConeGeometry(r, h, 8), col); }
  function tor(R, r, col, arc) { return colorize(new THREE.TorusGeometry(R, r, 6, 20, arc || Math.PI * 2), col); }
  // tube le long d'une courbe (cornes, moustaches, mèches)
  function tube(pts, r, col, r1) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    const g = new THREE.TubeGeometry(curve, 12, r, 7, false);
    if (r1 != null) { // effilé
      const pos = g.attributes.position, c = new THREE.Vector3(), tmp = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { const u = Math.floor(i / 8) / 12; curve.getPointAt(Math.min(1, u), c); tmp.fromBufferAttribute(pos, i).sub(c).multiplyScalar((r + (r1 - r) * u) / r).add(c); pos.setXYZ(i, tmp.x, tmp.y, tmp.z); }
      g.computeVertexNormals();
    }
    return colorize(g, col);
  }
  // pièce orientée de a vers b : capsules (construites de 0 à -L) ou pièces centrées (cônes, cylindres)
  function aim(g, a, b, centered) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    if (centered) g.translate(0, L / 2, 0); else g.rotateX(Math.PI);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate(A.x, A.y, A.z); return g;
  }
  const merge = gs => { const a = gs.filter(Boolean); return a.length ? THREE.mergeGeometries(a) : null; };

  /* ---------- tête : crâne + mâchoire carrée, cheveux, couvre-chefs, pilosité ---------- */
  // skin : la tête est celle du corps rigé (assets Quaternius) -> on ne construit que ce qui s'y ajoute (couvre-chefs, coiffures non fournies, pilosité)
  const HAIR_ASSET = { short: 'Hair_SimpleParted', slick: 'Hair_SimpleParted', shaved: 'Hair_Buzzed', long: 'Hair_Long' };
  function headGeo(L, C, tcol, skin) {
    const sk = L.sk, hair = L.hc, gs = [], F = L.f, hs = L.hair, HT = L.pe.hat, skD = shade(sk, 0.86);
    const own = skin && HAIR_ASSET[hs], RK = skin ? 1.12 : 1; // coiffure fournie par un asset ; anneaux un peu plus larges autour de la tête sculptée
    if (!skin) {
      gs.push(sph(7, sk, 0, 0, 0, 1, 1, 1, 22, 16), sph(5, sk, 2.4, -3.6, 0, 1, 1, 1.08, 18, 12));
      gs.push(sph(1.35, skD, 6.75, -1.2, 0, 1, 1.2, 1)); // nez
    }
    const covered = hs === 'hood' || HT === 'army' || HT === 'horns' || HT === 'turban' || hs === 'scrum';
    if (!covered && !skin) for (const s of [-1, 1]) gs.push(sph(1.7, skD, -0.2, -1.0, s * 6.75, 0.55, 1, 0.6)); // oreilles
    const cap = (r, x, y, col) => gs.push(sph(r, col, x, y, 0, 1, 1, 1, 20, 14));
    // coiffure
    if (own) { /* cheveux de l'asset */ }
    else if (hs === 'short' || hs === 'long' || hs === 'dreads') cap(6.7, -1.5, 2.0, hair);
    else if (hs === 'spiky') { cap(6.8, -1.3, 2.1, hair); for (const [bf, bd, bl, tf, td, tl] of [[-1, -6.4, 0, -2, -12.5, 0], [-4, -5, 3, -8, -9.5, 6], [-4, -5, -3, -8, -9.5, -6], [1.5, -6, 3, 3, -11, 6], [1.5, -6, -3, 3, -11, -6], [-6, -2, 0, -12, -4, 0], [3.5, -5, 0, 7.5, -9, 0]]) gs.push(aim(cone(2.4, Math.hypot(tf - bf, td - bd, tl - bl), hair), [bf, -bd, bl], [tf, -td, tl], true)); }
    else if (hs === 'shaved') cap(6.95, -0.6, 0.9, shade(hair, 1.35));
    else if (hs === 'slick') { cap(6.85, -1.0, 2.3, hair); gs.push(sph(1.2, '#ffffff', 2.6, 6.6, -1.4, 2.4, 0.4, 0.6)); }
    else if (hs === 'crest' || hs === 'mohawk') { if (hs === 'crest') cap(6.95, -0.8, 0.8, shade(hair, 0.5)); for (let k = 0; k <= 5; k++) { const a = -0.5 + k * 0.62, x = Math.cos(a + 1.2) * 7.2, y = Math.sin(a + 1.2) * 7.4 + 0.5; gs.push(aim(cone(1.7, 4.2, hair), [x * 0.8, y * 0.8, 0], [x * 1.25, y * 1.25, 0], true)); } }
    else if (hs === 'afro') cap(10.4, -1.8, 4.6, hair);
    else if (hs === 'hood') { gs.push(sph(8.6, '#16151b', -2.6, 1.4, 0, 1, 1, 1.02, 20, 14)); gs.push(aim(capsule(4.8, 3.4, 9, '#16151b'), [-5, -3, 0], [-7.5, -11, 0])); }
    else if (hs === 'hardhat') { if (!skin) { gs.push(sph(7.4, '#ffc21a', -0.4, 2.0, 0, 1, 0.9, 1, 20, 10)); gs.push(cyl(9.0, 9.0, 0.7, '#e0a300', 0.4, 2.1, 0, 24)); gs.push(rbox(10, 1.2, 1.4, 0.5, '#ffd84a', -1, 8.4, 0)); } }
    else if (hs === 'scrum') { cap(7.25, -1.0, 2.6, '#26262c'); for (const s of [-1, 1]) gs.push(sph(2.6, '#3a3a42', 0, -0.5, s * 6.9, 0.8, 1, 0.6)); }
    if (hs === 'long' && !own) for (const l of [-4, 0, 4]) gs.push(aim(capsule(3, 2.4, 13, hair), [-3, 4, l], [-7.5, -10, l * 1.15]));
    if (hs === 'dreads') for (const l of [-5.5, -2.8, 0, 2.8, 5.5]) { const a = [-2, 5, l], b = [-6.5, -10.5, l * 1.25]; gs.push(aim(capsule(1.4, 1.2, len(b[0] - a[0], b[1] - a[1]), hair), a, b)); gs.push(sph(1.4, '#c99a2e', b[0], b[1], b[2])); }
    // couvre-chefs
    switch (HT) {
      case 'horns': gs.push(sph(7.6, '#8a8d96', -0.3, 2.2, 0, 1, 0.92, 1, 20, 10)); gs.push(tor(7.4 * RK, 0.8, '#5d6068').rotateX(Math.PI / 2).translate(-0.3, 2.3, 0)); gs.push(rbox(1.2, 6, 1.2, 0.4, '#5d6068', 6.6, 1.5, 0));
        for (const s of [-1, 1]) gs.push(tube([[-0.5, 4.2, s * 6.2], [-0.2, 9, s * 11.5], [-1.4, 15, s * 10]], 1.9, '#efe6cf', 0.35)); break;
      case 'bullhorns': for (const s of [-1, 1]) { gs.push(tube([[-0.5, 5.2, s * 6], [0.6, 5.4, s * 14.5], [2.2, 11, s * 16.5]], 2.1, '#e2d6b8', 0.6)); gs.push(sph(0.9, '#3a3026', 2.2, 11, s * 16.5)); } break;
      case 'tophat': gs.push(cyl(9.4, 9.4, 0.7, '#17171c', -0.4, 6.4, 0, 28)); gs.push(cyl(5.6, 5.8, 11.3, '#17171c', -0.6, 12.1, 0, 22)); gs.push(cyl(5.85, 5.95, 2.2, tcol, -0.6, 7.9, 0, 22)); break;
      case 'jester': { const tips = [[-4.5, 12.5, -9.5], [-2.2, 16, 0], [-4.5, 12.5, 9.5]], cols = [C.s, tcol, C.s];
        for (let k = 0; k < 3; k++) { const [tf, td, tl] = tips[k]; gs.push(tube([[-0.6, 5.5, tl * 0.3], [tf * 0.5, td * 0.7, tl * 0.75], [tf, td, tl]], 3.2, cols[k], 0.4)); gs.push(sph(1.6, '#ffd23a', tf, td, tl)); }
        gs.push(tor(7.2 * RK, 1.0, '#ffd23a').rotateX(Math.PI / 2).translate(-0.4, 3.2, 0)); break; }
      case 'catears': for (const s of [-1, 1]) { gs.push(aim(cone(2.6, 6.2, '#ff7a00').scale(1, 1, 0.55), [-1.6, 5.4, s * 4.3], [-1.9, 11, s * 5.6], true)); gs.push(sph(1.2, '#111', -1.9, 10.6, s * 5.6)); } break;
      case 'foxears': for (const s of [-1, 1]) { gs.push(aim(cone(2.6, 8, '#d4561e').scale(1, 1, 0.5), [-1, 5.2, s * 4.1], [-1.4, 13.2, s * 5.4], true)); gs.push(aim(cone(1.5, 5, '#f4e6d8').scale(1, 1, 0.4), [-0.2, 5.6, s * 4.1], [-0.6, 10.6, s * 5.2], true)); } break;
      case 'blackcat': for (const s of [-1, 1]) { gs.push(aim(cone(2.6, 7.2, '#121216').scale(1, 1, 0.5), [-1, 5.4, s * 4.2], [-1.6, 12.4, s * 5.8], true)); gs.push(aim(cone(1.4, 4.4, '#ff8fb0').scale(1, 1, 0.4), [-0.2, 5.8, s * 4.2], [-0.8, 10.2, s * 5.4], true)); } break;
      case 'bikercap': gs.push(sph(7.3, '#1e1714', -0.6, 2.4, 0, 1, 0.78, 1, 20, 10)); gs.push(rbox(5, 0.8, 9, 0.35, '#100c0a', 6.2, 3.6, 0)); gs.push(sph(1.1, '#d9a441', 6.6, 6.1, 0)); break;
      case 'bandana': gs.push(sph(7.3, '#b3121c', -0.7, 2.0, 0, 1, 0.95, 1, 20, 12)); for (const [f, d, l] of [[2.5, 6, -2.2], [-1, 6.6, 2.6], [4.4, 4.4, 3.2], [-3.5, 5, -3.5], [1, 6.9, 0.5]]) gs.push(sph(0.7, '#f4f1ea', f, d + 0.3, l));
        gs.push(aim(capsule(1.3, 0.9, 6.5, '#b3121c'), [-6.6, 2.2, 0], [-11, -2.8, -2.6])); gs.push(aim(capsule(1.2, 0.9, 6.5, '#b3121c'), [-6.6, 2.2, 0], [-10.2, -4.4, 2.8])); break;
      case 'army': if (skin) break; gs.push(sph(8.4, '#4b5320', -0.4, 2.0, 0, 1, 0.82, 1, 20, 10)); gs.push(tor(8.3 * RK, 0.7, '#3c4219').rotateX(Math.PI / 2).translate(-0.4, 2.2, 0)); for (const s of [-1, 1]) gs.push(aim(capsule(0.45, 0.45, 8, '#2a2e12'), [0, 1.5, s * 7.2], [3.6, -6.2, s * 4])); break;
      case 'turban': gs.push(tor(6.8 * RK, 2.2, '#6a2fae').rotateX(Math.PI / 2).translate(-0.6, 3.2, 0)); gs.push(sph(6.6, '#5a2696', -0.6, 4.2, 0, 1, 0.7, 1)); gs.push(sph(1.8, '#33e0ff', 6.6, 4.6, 0)); gs.push(aim(capsule(0.7, 0.3, 4.4, '#f4f1ea'), [6.4, 5.4, 0], [4.6, 9.8, 0])); break;
      case 'goggles': if (skin) break; gs.push(tor(7.15 * RK, 0.75, '#1e1e24').rotateX(Math.PI / 2).rotateZ(-0.15).translate(0, 3.6, 0)); for (const s of [-1, 1]) { gs.push(cyl(2.3, 2.3, 1.4, '#1e1e24', 0, 0, 0).rotateZ(Math.PI / 2).translate(6.2, 4.6, s * 2.7)); gs.push(cyl(1.8, 1.8, 0.4, '#53d0e6', 0, 0, 0).rotateZ(Math.PI / 2).translate(6.95, 4.6, s * 2.7)); } break;
    }
    if (L.band) gs.push(tor(7.05 * RK, 0.9, L.band === 'a' ? C.a : C.s).rotateX(Math.PI / 2).rotateZ(-0.12).translate(-0.2, 2.8, 0));
    // visage en relief : barbe, moustache, rouflaquettes, couronne, piercing, lunettes
    if ((F.beard || F.braidbeard) && !skin) gs.push(sph(4.6, hair, 2.7, -4.7, 0, 1, 1, 1.12));
    if (F.braidbeard) { gs.push(aim(capsule(1.5, 1.1, 5.5, hair), [5.2, -7.5, 0], [5.8, -12.5, 0])); gs.push(sph(1.2, '#c9a23a', 5.8, -12.6, 0)); }
    if (F.goatee) gs.push(sph(1.9, hair, 5.6, -5.8, 0, 0.8, 1.2, 1));
    if (F.moustache) gs.push(tube([[6.0, -5.8, -2.9], [6.75, -2.6, -2.3], [7.05, -2.3, 0], [6.75, -2.6, 2.3], [6.0, -5.8, 2.9]], 0.75, hair));
    if (F.sideburns) for (const s of [-1, 1]) gs.push(sph(1.8, hair, 1.5, -1.6, s * 6.1, 0.7, 1.4, 0.6));
    if (F.crown && !skin) { gs.push(cyl(4.2, 4.6, 2.2, '#ffd23a', -1, 7.4, 0, 18)); for (const a of [0, 1.26, 2.51, 3.77, 5.03]) gs.push(aim(cone(0.9, 2.6, '#ffd23a'), [-1 + Math.cos(a) * 4.2, 8.4, Math.sin(a) * 4.2], [-1 + Math.cos(a) * 4.4, 11, Math.sin(a) * 4.4], true)); gs.push(sph(0.8, '#d4111a', 3.4, 7.4, 0)); }
    if (F.nosering) gs.push(tor(0.95, 0.22, '#ffd23a').rotateY(Math.PI / 2).translate(7.1, -2.9, 0));
    if (F.shades && !skin) { for (const s of [-1, 1]) gs.push(sph(1.9, '#08080a', 6.35, 0.5, s * 2.6, 0.45, 0.75, 1)); gs.push(rbox(0.6, 0.5, 1.6, 0.2, '#08080a', 6.9, 0.7, 0)); }
    return merge(gs);
  }

  /* ---------- membres ---------- */
  const OC = (L, C, gk, v) => { const tc = gk ? C.g : C.j; return v === 'c1' ? tc : v === 'c2' ? C.s : v === 'acc' ? C.a : v; };
  /* ---------- peinture du maillot (canvas → texture) ---------- */
  // u : 0,25 = face, 0,5 = côté gauche, 0,75 = dos ; v : 0 = bassin, 1 = épaules
  function paintJersey(rg, L, C, gk, dirt, blv) {
    const cv = rg.jcv, g = cv.getContext('2d'), Wc = 512, Hc = 256, O = L.o, OF = L.of;
    const tc = gk ? C.g : C.j, base = O.torso && O.torso !== 'c1' ? OC(L, C, gk, O.torso) : tc;
    const X = u => u * Wc, Y = v => (1 - v) * Hc, FX = 0.25 * Wc, BX = 0.75 * Wc, fw = Wc * 0.17; // demi-largeur visible de la face
    const lg = g.createLinearGradient(0, 0, 0, Hc); lg.addColorStop(0, shade(hx(base, '#888888'), 1.12)); lg.addColorStop(0.55, base); lg.addColorStop(1, shade(hx(base, '#888888'), 0.82));
    g.fillStyle = lg; g.fillRect(0, 0, Wc, Hc);
    const band = (v0, v1, col) => { g.fillStyle = col; g.fillRect(0, Y(v1), Wc, Y(v0) - Y(v1)); };
    const both = f => { f(FX, 1); f(BX, -1); };
    const line = (x0, y0, x1, y1, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    if (OF.hoops) for (const v of [0.24, 0.46, 0.68, 0.88]) band(v - 0.06, v + 0.06, C.s);
    if (OF.hivis) { both((cx) => { g.fillStyle = '#ff7a00'; g.fillRect(cx - fw * 1.6, Y(0.98), fw * 3.2, Y(0.16) - Y(0.98)); }); g.fillStyle = base; g.fillRect(FX - fw * 0.3, Y(0.98), fw * 0.6, Y(0.16) - Y(0.98)); for (const v of [0.45, 0.68]) band(v - 0.025, v + 0.025, '#dfe3e8'); }
    if (OF.chestband) { band(0.6, 0.72, tc); band(0.56, 0.58, C.a); }
    if (OF.diamonds) for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) { const x = c * Wc / 12 + (r % 2 ? Wc / 24 : 0), y = Y(0.28 + r * 0.19); g.fillStyle = (r + c) % 2 ? '#f4f1ea' : C.s; g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + 18, y); g.lineTo(x, y + 22); g.lineTo(x - 18, y); g.closePath(); g.fill(); }
    if (OF.tiger) for (let c = 0; c < 14; c++) { const x = c * Wc / 14; g.fillStyle = '#111'; g.beginPath(); g.moveTo(x - 6, Y(0.2 + (c % 3) * 0.05)); g.lineTo(x + 10, Y(0.95)); g.lineTo(x + 2, Y(0.95)); g.lineTo(x - 12, Y(0.3)); g.closePath(); g.fill(); }
    if (OF.padded) { for (const v of [0.32, 0.48, 0.64, 0.8]) band(v - 0.006, v + 0.006, 'rgba(0,0,0,.35)'); line(FX, Y(0.98), FX, Y(0.16), '#1c1c20', 4); }
    if (OF.zigzag) for (const [v, col] of [[0.34, '#ff2fa0'], [0.56, '#33e0ff'], [0.78, '#ffe14a']]) { g.strokeStyle = col; g.lineWidth = 9; g.beginPath(); for (let k = 0; k <= 24; k++) { const x = k * Wc / 24, y = Y(v + (k % 2 ? 0.05 : -0.04)); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    if (OF.leather) { g.fillStyle = '#211915'; g.fillRect(0, 0, Wc, Hc); g.fillStyle = tc; g.fillRect(FX - fw * 0.42, Y(1), fw * 0.84, Y(0.12) - Y(1)); g.fillStyle = '#c9ccd2'; for (const x of [FX - fw * 1.3, FX + fw * 1.3, BX - fw, BX, BX + fw]) for (const v of [0.9, 0.96]) { g.beginPath(); g.arc(x, Y(v), 3, 0, 7); g.fill(); } }
    if (OF.xstraps) for (const cx of [FX, BX]) { line(cx - fw, Y(0.98), cx + fw, Y(0.18), '#5b3a1e', 12); line(cx + fw, Y(0.98), cx - fw, Y(0.18), '#5b3a1e', 12); g.fillStyle = '#d9a441'; g.beginPath(); g.arc(cx, Y(0.58), 7, 0, 7); g.fill(); }
    if (OF.bandolier) { line(FX - fw, Y(0.98), FX + fw, Y(0.16), '#4a3020', 13); g.fillStyle = '#d9a441'; for (let t = 0.1; t < 0.95; t += 0.11) { g.beginPath(); g.arc(FX - fw + 2 * fw * t, Y(0.98 - 0.82 * t), 4, 0, 7); g.fill(); } line(BX + fw, Y(0.98), BX - fw, Y(0.16), '#4a3020', 13); }
    if (OF.apron) { g.fillStyle = '#ece8e0'; g.fillRect(FX - fw * 0.85, Y(0.95), fw * 1.7, Y(0.0) - Y(0.95)); g.fillStyle = 'rgba(150,10,14,.78)'; for (const [v, l, r] of [[0.55, -0.3, 8], [0.4, 0.4, 11], [0.25, -0.45, 6], [0.62, 0.5, 5]]) { g.beginPath(); g.arc(FX + l * fw, Y(v), r, 0, 7); g.fill(); } }
    if (OF.spiral) { g.strokeStyle = '#ffd23a'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= 60; k++) { const a = k * 0.42, r = 1 + k * 0.42; g.lineTo(FX + Math.cos(a) * r, Y(0.62) + Math.sin(a) * r); } g.stroke(); }
    if (OF.catcollar) { band(0.95, 1, '#b3121c'); g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(FX, Y(0.92), 6, 0, 7); g.fill(); }
    if (OF.belt || OF.ropebelt) { band(0.13, 0.19, OF.belt ? '#3a2414' : tc); if (OF.belt) { g.fillStyle = '#d9a441'; g.fillRect(FX - 9, Y(0.2), 18, Y(0.12) - Y(0.2)); } }
    if (OF.torn) for (let k = 0; k < 16; k++) { const x = k * Wc / 16; g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.moveTo(x - 9, Y(0.16)); g.lineTo(x + 9, Y(0.16)); g.lineTo(x + 2, Y(0.27)); g.closePath(); g.fill(); }
    if (OF.vcollar) { g.strokeStyle = C.a; g.lineWidth = 5; g.beginPath(); g.moveTo(FX - fw * 0.5, Y(1)); g.lineTo(FX, Y(0.84)); g.lineTo(FX + fw * 0.5, Y(1)); g.stroke(); }
    if (OF.bib) { g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(FX - fw * 0.65, Y(1)); g.lineTo(FX + fw * 0.65, Y(1)); g.lineTo(FX, Y(0.52)); g.closePath(); g.fill(); }
    if (OF.tux) { g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(FX - fw * 0.45, Y(1)); g.lineTo(FX + fw * 0.45, Y(1)); g.lineTo(FX, Y(0.36)); g.closePath(); g.fill(); g.fillStyle = INK; for (const v of [0.7, 0.58]) { g.beginPath(); g.arc(FX, Y(v), 2.5, 0, 7); g.fill(); } band(0.17, 0.24, tc); }
    if (OF.bowtie || OF.tux) { g.fillStyle = OF.tux ? tc : '#d9a441'; g.beginPath(); g.moveTo(FX, Y(0.95)); g.lineTo(FX - 13, Y(0.99)); g.lineTo(FX - 13, Y(0.91)); g.closePath(); g.fill(); g.beginPath(); g.moveTo(FX, Y(0.95)); g.lineTo(FX + 13, Y(0.99)); g.lineTo(FX + 13, Y(0.91)); g.closePath(); g.fill(); }
    if (OF.goldtrim) { band(0.965, 1, '#d9a441'); g.fillStyle = '#d9a441'; for (const v of [0.72, 0.58, 0.44]) { g.beginPath(); g.arc(FX + 4, Y(v), 3.2, 0, 7); g.fill(); } }
    if (O.sash !== false) for (const [cx, s] of [[FX, 1], [BX, -1]]) { const c0 = O.sashC || C.s; line(cx - s * fw * 0.9, Y(0.97), cx + s * fw * 0.8, Y(0.2), c0, 15); line(cx - s * fw * 0.9 + 6, Y(0.97), cx + s * fw * 0.8 + 6, Y(0.2), O.sashC ? '#fff2c4' : C.a, 3); }
    if (OF.num10) { g.font = `46px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.s; g.fillText('10', FX + fw * 0.35, Y(0.6)); }
    // numéro dans le dos
    g.font = `${Hc * 0.42 | 0}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = OF.hivis ? '#111' : O.torso && O.torso !== 'c1' ? tc : C.s; g.fillText(String(O.num || 1), BX, Y(0.56));
    // short : la ceinture du short sous le maillot
    band(0, 0.1, OC(L, C, gk, O.shorts)); band(0.1, 0.115, 'rgba(0,0,0,.35)');
    // boue et herbe, sang
    if (dirt > 0.12) { const rd = seeded(17 + rg.slot); g.fillStyle = `rgba(78,58,32,${(0.25 + 0.45 * dirt).toFixed(2)})`; for (let k = 0; k < 4 + dirt * 10; k++) { g.beginPath(); g.ellipse(rd() * Wc, Y(0.1 + rd() * 0.5), 6 + 14 * dirt * rd(), 4 + 8 * dirt * rd(), rd() * 3, 0, 7); g.fill(); } if (dirt > 0.4) { g.fillStyle = `rgba(52,82,34,${(0.2 + 0.35 * dirt).toFixed(2)})`; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(rd() * Wc, Y(0.15 + rd() * 0.4), 10, 5, rd() * 3, 0, 7); g.fill(); } } }
    if (GORE && blv >= 2) { const rd = seeded(41 + rg.slot); g.fillStyle = 'rgba(120,6,8,.85)'; for (let k = 0; k < (blv - 1) * 3; k++) { const x = FX + (rd() - 0.5) * fw * 2.2, y = Y(0.45 + rd() * 0.5); g.beginPath(); g.arc(x, y, 5 + rd() * 9, 0, 7); g.fill(); g.beginPath(); g.arc(x + 4, y + 10, 3, 0, 7); g.fill(); } }
    rg.jtex.needsUpdate = true;
  }

  /* ---------- assemblage ---------- */
  const RIGS = [];  // les 8 joueurs du match
    function segMesh(geo, mat, parent) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
    const o = new THREE.Mesh(geo, OUTLINE); o.matrixAutoUpdate = false; o.castShadow = false; m.add(o); o.updateMatrix();
    parent.add(m); return m;
  }
  function buildRig(L, team, slot, opt) {
    if (!SKB.ok) throw new Error('modèles des joueurs absents');
    const gk = (slot & 3) === 3, C = PAL[team], tcol = gk ? C.g : C.j;
    const rg = { L, team, gk, slot, root: new THREE.Group(), body: new THREE.Group(), inner: new THREE.Group(), seg: {}, mats: [], dyn: [], jkey: '', fkey: '', ft: 0 };
    rg.root.add(rg.body); rg.body.add(rg.inner);
    skBuild(rg, L, C, gk, tcol);
    rg.chest = new THREE.Object3D(); rg.chest.matrixAutoUpdate = false; rg.inner.add(rg.chest);
    rg.hips = new THREE.Object3D(); rg.hips.matrixAutoUpdate = false; rg.inner.add(rg.hips);
    buildProps(rg, L, C, gk, tcol);
    paintKit(rg, L, C, gk); paintJersey(rg, L, C, gk, 0, 0); paintFace2(rg, { mouth: 0, ko: 0, blv: 0, blink: 0, t: 0 });
    // ombre de contact, repère d'équipe
    if (!opt || !opt.scene) {
      rg.blob = new THREE.Mesh(BLOBG, BLOBM); rg.blob.renderOrder = 1; world.add(rg.blob);
      rg.tring = new THREE.Mesh(TRINGG, new THREE.MeshBasicMaterial({ color: TEAMS[team].c1, transparent: true, opacity: 0.55, depthWrite: false })); rg.tring.renderOrder = 2; world.add(rg.tring);
    }
    rg.root.traverse(o => { o.frustumCulled = false; });
    ((opt && opt.scene) || scene).add(rg.root);
    return rg;
  }
  function disposeRig(rg) {
    if (rg.root.parent) rg.root.parent.remove(rg.root);
    if (rg.blob) { world.remove(rg.blob); world.remove(rg.tring); rg.tring.material.dispose(); }
    skDispose(rg);
    rg.root.traverse(o => { if (o.geometry && o.geometry !== BLOBG && !(o.isSkinnedMesh && !o.geometry.userData.own)) o.geometry.dispose(); });
    for (const m of rg.mats) { if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
  }
  const BLOBG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const BLOBM = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(0,0,0,.75)'); rg.addColorStop(0.5, 'rgba(0,0,0,.4)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }); })();
  const TRINGG = new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2);

  /* ---------- accessoires : capes, queues, robe, faux, baguette, pendule, collerettes ---------- */
  function clothMesh(rg, col, edge, cols, rows) { // tissu dynamique (grille cols × rows), bord bas coloré
    const g = new THREE.PlaneGeometry(1, 1, cols, rows), n = g.attributes.position.count, ca = new Float32Array(n * 3), c1 = new THREE.Color(col), c2 = new THREE.Color(edge || col);
    for (let i = 0; i < n; i++) { const r = Math.floor(i / (cols + 1)), c = r >= rows ? c2 : c1; ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.deleteAttribute('uv');
    const m = new THREE.Mesh(g, toon({ vertexColors: true, side: THREE.DoubleSide })); rg.mats.push(m.material);
    m.castShadow = true; m.frustumCulled = false; rg.inner.add(m);
    return { m, g, cols, rows };
  }
  function chain(rg, cols, r) { // queue : 3 segments posés entre 4 points
    const ms = cols.map((c, k) => { const mm = segMesh(capsule(r[k], r[k + 1] || r[k], 10, c), rg.pmat, rg.inner); return mm; });
    return ms;
  }
  function buildProps(rg, L, C, gk, tcol) {
    const OF = L.of, PE = L.pe, bm = rg.pmat;
    if (OF.cape) rg.cape = clothMesh(rg, '#24163a', tcol, 4, 6);
    if (PE.prop === 'mantle') rg.cape = clothMesh(rg, '#8e0f22', '#f4f1ea', 4, 6);
    if (OF.robe) rg.robe = clothMesh(rg, '#17161c', '#0d0c10', 10, 3);
    if (OF.coattails) rg.coat = [segMesh(capsule(2.4, 1.8, 10, '#121216'), bm, rg.inner), segMesh(capsule(2.4, 1.8, 10, '#121216'), bm, rg.inner)];
    if (OF.foxtail) { rg.tail = chain(rg, ['#d4561e', '#d4561e', '#d4561e'], [2.5, 3.6, 4.2, 2.6]); rg.tailTip = segMesh(sph(4, '#f4f1ea', 0, -2, 0), bm, rg.inner); }
    if (OF.cattail) rg.tail = chain(rg, ['#121216', '#121216', '#121216'], [1.6, 1.5, 1.4, 1.1]);
    if (OF.tigertail) rg.tail = chain(rg, ['#ff7a00', '#111111', '#ff7a00'], [1.5, 1.45, 1.4, 1.2]);
    // accessoires rigides attachés au haut du corps
    const chestG = [];
    const SK = rg.sk, shw = SK ? 7.4 : L.b[2], fs = SK ? 0.62 : 1;
    if (OF.fur) for (const l of [-1, -0.55, -0.1, 0.35, 0.8]) chestG.push(sph(4.3 * fs, '#6b4f33', -0.5, SK ? 0 : 0.5, l * (shw + 1.2) * (SK ? 0.9 : 1)), sph(1.8 * fs, '#8f6d48', 0.8, SK ? 0.9 : 1.6, l * (shw + 1.2) * (SK ? 0.9 : 1)));
    if (OF.ruff) for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; chestG.push(sph(2.3 * fs, k % 2 ? '#f4f1ea' : tcol, Math.cos(a) * 4.6 * fs, 2.2, Math.sin(a) * 4.6 * fs, 1, 0.7, 1)); }
    if (PE.prop === 'scythe') { chestG.push(aim(capsule(1.15, 1.15, 44, '#4a3424'), [-6.2, -22, 6.5], [-7.5, 22, -5.5])); chestG.push(tube([[-7.5, 22, -5.5], [-6, 28, 2], [-8, 25, 10], [-9, 19, 14]], 1.6, '#cfd3da', 0.15)); }
    if (chestG.length) { const m = segMesh(merge(chestG), bm, rg.chest); m.matrixAutoUpdate = true; }
    const hipG = [];
    if (OF.chain) hipG.push(tor(4.5, 0.45, '#c9ccd2', Math.PI).rotateY(Math.PI / 2).translate(1, -3.2, (rg.sk ? 5.6 : L.b[3]) + 0.6));
    if (hipG.length) { const m = segMesh(merge(hipG), bm, rg.hips); m.matrixAutoUpdate = true; }
    // accessoires tenus en main
    if (PE.prop === 'baton') skProp(rg, 'acc_baton', rg.seg.handR, { '*': null, oak: '#121216', white: '#f4f1ea' }, new THREE.Matrix4().makeTranslation(0, 0.0425 * KM, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI)).multiply(new THREE.Matrix4().makeScale(KM * 0.95, KM * 0.95, KM * 0.95)));
    if (PE.prop === 'pendulum') { rg.pend = segMesh(merge([capsule(0.25, 0.25, 11, '#d9a441'), cyl(2.4, 2.4, 0.6, '#ffd23a', 0, -12, 0).rotateX(Math.PI / 2), cyl(1.2, 1.2, 0.7, '#7a3cff', 0, -12, 0).rotateX(Math.PI / 2)]), bm, rg.inner); }
  }

  /* ---------- les 8 personnages du match (reconstruits quand les équipes changent) ---------- */
  function syncRigs() {
    if (!rigsDirty) return;
    rigsDirty = false;
    for (const r of RIGS) disposeRig(r);
    RIGS.length = 0;
    for (let i = 0; i < 8; i++) RIGS.push(buildRig(LK[i], i >> 2, i));
    for (let i = 0; i < 8; i++) { PSB[i].init = false; FA[i] = NaN; }
  }
