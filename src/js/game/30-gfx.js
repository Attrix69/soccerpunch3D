  /* =============== RENDU 3D : moteur, caméra, lumières, post-traitement =============== */
  // Le monde de la simulation (x, y au sol, z en hauteur, en « unités ») devient une scène three.js
  // en mètres : X = x, Y = z (hauteur), Z = y. Une unité = 3 cm (les cages font 6,7 m sur 2,8 m).
  const U3 = 0.03;
  let CW = innerWidth, CH = innerHeight, DPR = 1, S = 1, K = 1, dprCap = 2;
  const SAFE = { t: 0, r: 0, b: 0, l: 0 };
  // cam garde l'API de la version 2D (secousses, recul, roulis, zoom d'impact) ; flip = -1 : on filme depuis l'autre tribune
  const cam = { x: W / 2, y: H / 2, flip: 1, sx: 0, sy: 0, shake: 0, zoom: 1, kx: 0, ky: 0, kvx: 0, kvy: 0, rot: 0, rv: 0, zp: 0 };
  const SKIN = ['#d9a982', '#6e4126', '#c48a5e', '#9a6038', '#e8bf98', '#53301b', '#8a5532', '#cf9a70'];
  const HAIR = ['#141414', '#2b1d12', '#0c0c0c', '#4a3524', '#161616', '#0a0a0a', '#9a948a', '#22170e'];
  const toW = (x, y, z, o) => (o || new THREE.Vector3()).set(x * U3, (z || 0) * U3, y * U3);

  const glcv = $('gl');
  let renderer = null, GPU = false, softGPU = false;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: glcv, antialias: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!Q.get('shots') });
    GPU = true;
    const gl = renderer.getContext();
    try { const di = gl.getExtension('WEBGL_debug_renderer_info'); const rn = di ? gl.getParameter(di.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); softGPU = /swiftshader|llvmpipe|software|softpipe/i.test(String(rn)); } catch (e) { softGPU = false; }
  } catch (e) { GPU = false; }
  if (softGPU) gfxAuto = 'perf'; // GPU émulé par le processeur : en AUTO on vise le plus léger
  if (renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05060a');
  scene.fog = new THREE.Fog('#07080d', 70, 190);
  const camera = new THREE.PerspectiveCamera(30, CW / CH, 0.4, 420);
  camera.position.set(W / 2 * U3, 18, H * U3 + 26);
  const CTR = toW(W / 2, H / 2, 0);

  /* ---------- éclairage de nuit : projecteurs principaux, contre-jour, remplissage ---------- */
  const hemi = new THREE.HemisphereLight('#8ea0c8', '#14200f', 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff0d8', 2.6); // la rampe de projecteurs de la tribune d'en face
  key.position.set(CTR.x - 16, 42, CTR.z - 26); key.target.position.copy(CTR);
  key.castShadow = true;
  const sc = key.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 22; sc.bottom = -22; sc.near = 10; sc.far = 110;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#b9cdff', 0.75); // deuxième pylône, côté caméra
  fill.position.set(CTR.x + 24, 30, CTR.z + 30); fill.target.position.copy(CTR); scene.add(fill, fill.target);
  const rimL = new THREE.DirectionalLight('#ffe2c4', 0.9);  // contre-jour : détoure les joueurs
  rimL.position.set(CTR.x - 6, 22, CTR.z - 40); rimL.target.position.copy(CTR); scene.add(rimL, rimL.target);
  // lumières dynamiques : tout ce qui brûle, brille ou explose éclaire vraiment la pelouse et les joueurs
  const DYN = [];
  for (let i = 0; i < 8; i++) { const L = new THREE.PointLight('#ffffff', 0, 9, 1.6); L.visible = true; scene.add(L); DYN.push(L); }

  /* ---------- post-traitement : bloom, puis composition « console » (repris de la version 2D) ---------- */
  const MAXS = 4;
  const FinalShader = {
    uniforms: {
      tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uAsp: { value: 1 }, uTime: { value: 0 },
      uSat: { value: 1.08 }, uCon: { value: 1.05 }, uTone: { value: 1 }, uVig: { value: 1 }, uGrain: { value: 0.02 }, uChroma: { value: 0 },
      uSlow: { value: 0 }, uGray: { value: 0 }, uHeat: { value: new THREE.Vector3() }, uFlash: { value: new THREE.Vector4() },
      uShock: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uNS: { value: 0 }, uZoom: { value: new THREE.Vector3() }
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: [
      'uniform sampler2D tDiffuse;uniform vec2 uRes;uniform float uAsp,uTime,uSat,uCon,uTone,uVig,uGrain,uChroma,uSlow,uGray;uniform vec3 uHeat,uZoom;uniform vec4 uFlash;uniform vec4 uShock[' + MAXS + '];uniform int uNS;varying vec2 vUv;',
      'vec3 samp(vec2 uv){if(uChroma>0.0004){vec2 o=(uv-0.5)*uChroma;return vec3(texture2D(tDiffuse,uv+o).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-o).b);}return texture2D(tDiffuse,uv).rgb;}',
      'void main(){vec2 uv=vUv;vec2 off=vec2(0.);',
      '  for(int i=0;i<' + MAXS + ';i++){if(i>=uNS)break;vec4 S=uShock[i];vec2 d=uv-S.xy;d.x*=uAsp;float r=length(d);float x=(r-S.z)/0.045;float ring=exp(-x*x)*S.w;vec2 n=d/max(r,1e-4);n.x/=uAsp;off+=n*ring;}',
      '  if(uHeat.z>0.){vec2 hd=uv-uHeat.xy;hd.x*=uAsp;float hf=max(0.,1.-length(hd)/0.28);off+=vec2(sin(uv.y*90.+uTime*14.),cos(uv.x*70.+uTime*11.))*0.0022*uHeat.z*hf*hf;}',
      '  vec2 su=uv-off;vec3 col;',
      '  if(uZoom.z>0.001){col=vec3(0.);for(int k=0;k<6;k++){float f=1.-uZoom.z*float(k)/5.;col+=samp(uZoom.xy+(su-uZoom.xy)*f);}col/=6.;}else col=samp(su);',
      '  float l=dot(col,vec3(0.2126,0.7152,0.0722));',
      '  col=mix(vec3(l),col,uSat);col=(col-0.5)*uCon+0.5;',
      '  col+=(vec3(-0.018,0.004,0.03)*(1.-l)+vec3(0.03,0.012,-0.022)*l)*uTone;',
      '  float g=dot(col,vec3(0.299,0.587,0.114));',
      '  col=mix(col,vec3(g)*vec3(1.18,0.84,0.8),uSlow*0.5);col=mix(col,vec3(g*0.92),uGray);',
      '  col=mix(col,uFlash.rgb,uFlash.a);',
      '  vec2 q=(vUv-0.5)*vec2(1.05,1.25);col*=clamp(1.-dot(q,q)*uVig,0.,1.);',
      '  float n=fract(sin(dot(floor(vUv*uRes)+fract(uTime*7.31)*vec2(113.,71.),vec2(12.9898,78.233)))*43758.5453)-0.5;col+=n*uGrain;',
      '  gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
    ].join('\n')
  };
  let composer = null, bloomPass = null, finalPass = null, usePost = false, rtSamples = -1;
  const shocks = [], flashLights = [];
  function makeComposer(samples) {
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.55, 0.82);
    composer.addPass(bloomPass);
    composer.addPass(new THREE.OutputPass());
    finalPass = new THREE.ShaderPass(FinalShader);
    composer.addPass(finalPass);
    rtSamples = samples;
  }
  function applyGfx() {
    if (!renderer) return;
    const t = GFX();
    usePost = t.post;
    if (usePost && rtSamples !== t.msaa) makeComposer(t.msaa);
    renderer.shadowMap.enabled = t.shadow > 0;
    key.castShadow = t.shadow > 0;
    if (t.shadow > 0 && key.shadow.mapSize.x !== t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    for (let i = 0; i < DYN.length; i++) DYN[i].visible = i < t.lights;
    scene.traverse(o => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
    if (typeof setCrowdDensity === 'function') setCrowdDensity(t.crowd);
    if (typeof setBeams === 'function') setBeams(t.beams);
    resize();
  }
  function resize() {
    if (!renderer) return;
    DPR = Math.min(dprCap, GFX().dpr, window.devicePixelRatio || 1);
    CW = window.innerWidth; CH = window.innerHeight;
    renderer.setPixelRatio(DPR); renderer.setSize(CW, CH, false);
    uicv.width = Math.round(CW * DPR); uicv.height = Math.round(CH * DPR);
    camera.aspect = CW / CH; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(DPR); composer.setSize(CW, CH); }
    if (bloomPass) bloomPass.resolution.set(CW * DPR / 2, CH * DPR / 2);
    S = Math.max(0.36, Math.min(CW / 1030, CH / 410));
    const cs = getComputedStyle($('sa'));
    SAFE.t = parseFloat(cs.paddingTop) || 0; SAFE.r = parseFloat(cs.paddingRight) || 0;
    SAFE.b = parseFloat(cs.paddingBottom) || 0; SAFE.l = parseFloat(cs.paddingLeft) || 0;
    requestAnimationFrame(layoutButtons);
  }

  /* ---------- projection : monde -> écran (px CSS) pour l'interface ---------- */
  const _pv = new THREE.Vector3(), P2O = [0, 0, 0];
  function P2(x, y, z) { // [X, Y, devant la caméra ?] — tableau partagé
    _pv.set(x * U3, (z || 0) * U3, y * U3).project(camera);
    P2O[0] = (_pv.x * 0.5 + 0.5) * CW; P2O[1] = (-_pv.y * 0.5 + 0.5) * CH; P2O[2] = _pv.z < 1 ? 1 : 0;
    return P2O;
  }
  const sx = x => P2(x, cam.y, 0)[0]; // compatibilité : préférer P2
  const sy = (y, z) => P2(cam.x, y, z)[1];

  /* ---------- effets de composition pilotés par le jeu ---------- */
  function shockAt(x, y, z, amp, dur, rmax) {
    if (!usePost) return;
    const p = P2(x, y, z || 0); if (!p[2]) return;
    shocks.push({ x: p[0], y: p[1], amp: amp * (OPT.shake ? 1 : 0.4), dur, rmax: rmax || 0.35, t: 0 }); if (shocks.length > MAXS) shocks.shift();
  }
  const _col = new THREE.Color();
  // flash de lumière éphémère : r = portée (fraction de l'écran en 2D -> mètres), i = intensité
  function flashLight(x, y, z, col, r, i, life) { flashLights.push({ x, y, z: z || 20, c: col, r: 3 + r * 14, i: i * 3.2, life: life || 0.2, max: life || 0.2 }); if (flashLights.length > 16) flashLights.shift(); }
  function updLights(V, dt) {
    const want = [];
    const b = V.ball;
    if (b.sup && !(b.uk && ULK[b.uk - 1] === 'abra' && b.gu > 0.18 && b.gu < 0.7)) want.push({ x: b.x, y: b.y, z: b.z + 8, c: b.uk ? UCOL[ULK[b.uk - 1]][0] : b.sup === 2 ? '#ff2a3a' : '#ff8a1a', r: b.uk ? 9 : 7, i: b.uk ? 4 : 3 });
    for (const k of V.proj) want.push({ x: k[0], y: k[1], z: 30, c: KICOL[k[4]][1], r: 6, i: 3.2 });
    for (const bm of V.beams) { const a = clamp(bm[5] / 0.2, 0, 1); for (const u of [0.2, 0.6]) want.push({ x: bm[0] + bm[2] * bm[4] * u, y: bm[1] + bm[3] * bm[4] * u, z: 30, c: KICOL[bm[6]][1], r: 9, i: 4.5 * a }); }
    for (let i = 0; i < 8; i++) { const p = V.players[i]; if (p.st === ST.charge || p.st === ST.blast) { const full = V.bar[i >> 2] >= 1; want.push({ x: p.x, y: p.y, z: 34, c: full ? '#ffd23a' : KICOL[i >> 2][1], r: 5, i: full ? 3 : 2 }); } }
    for (let k = flashLights.length - 1; k >= 0; k--) { const L = flashLights[k]; L.life -= dt; if (L.life <= 0) { flashLights.splice(k, 1); continue; } want.push({ x: L.x, y: L.y, z: L.z, c: L.c, r: L.r, i: L.i * Math.pow(L.life / L.max, 1.5) }); }
    want.sort((a, c) => c.i * c.r - a.i * a.r);
    const n = GFX().lights;
    for (let k = 0; k < DYN.length; k++) {
      const L = DYN[k], w = k < n ? want[k] : null;
      if (!w) { L.intensity = 0; continue; }
      // jamais au ras du sol : une source à 60 cm du gazon y brûle une tache blanche au lieu d'éclairer la scène
      toW(w.x, w.y, Math.max(w.z, 70), L.position); L.color.set(w.c); L.intensity = w.i * 2.2; L.distance = w.r * 1.3;
    }
  }
  let grayT = 0;
  function composite(V, dt) {
    const now = performance.now(), rdt = animRealDt;
    const ready = app.mode !== 'menu' && !app.drafting && V.bar[app.myTeam] >= 1;
    const rs = V.ts < 0.95 ? 's' + Math.round(clamp((1 - V.ts) * 1.1, 0, 1) * 10) : ready ? 'on' : '';
    if (rs !== rageS) { rageS = rs; rageEl.classList.toggle('on', rs === 'on'); rageEl.style.opacity = rs[0] === 's' ? (+rs.slice(1) / 10) : ''; }
    const lose = V.phase === 'end' && app.mode !== 'menu' && !app.drafting && V.winner >= 0 && V.winner !== app.myTeam;
    grayT += ((lose ? 0.6 : 0) - grayT) * Math.min(1, rdt * 1.5);
    const zb = ZB ? (ZB.end - now) / ZB.dur : 0; if (zb <= 0) ZB = null;
    if (!usePost) { $('vig').style.display = ''; renderer.render(scene, camera); return; }
    $('vig').style.display = 'none';
    const t = GFX(), won = V.phase === 'end' && app.mode !== 'menu' && V.winner === app.myTeam;
    bloomPass.strength = t.bloom * (1 + 0.45 * clamp(1 - V.ts, 0, 1)) * (won ? 1.25 : 1);
    bloomPass.threshold = won ? 0.72 : 0.82;
    const u = finalPass.uniforms, fc = flashCol.split(',');
    u.uRes.value.set(CW * DPR, CH * DPR); u.uAsp.value = CW / CH; u.uTime.value = now / 1000;
    u.uVig.value = app.mode === 'menu' ? 1.25 : 1; u.uGrain.value = t.grain;
    u.uChroma.value = Math.min(0.018, chromaP * 0.012 + clamp(1 - V.ts, 0, 1) * 0.005);
    u.uSlow.value = clamp((1 - V.ts) * 1.4, 0, 1); u.uGray.value = grayT;
    const bm0 = V.beams[0];
    let heat = null;
    if (V.ball.uk) { const p = P2(V.ball.x, V.ball.y, V.ball.z); if (p[2]) heat = [p[0], p[1], 1]; }
    else if (bm0) { const p = P2(bm0[0] + bm0[2] * bm0[4] * 0.5, bm0[1] + bm0[3] * bm0[4] * 0.5, 30); if (p[2]) heat = [p[0], p[1], 0.8]; }
    u.uHeat.value.set(heat ? heat[0] / CW : 0, heat ? 1 - heat[1] / CH : 0, heat ? heat[2] : 0);
    u.uFlash.value.set(+fc[0] / 255, +fc[1] / 255, +fc[2] / 255, flash > 0 ? clamp(flash, 0, 1) * 0.55 : 0);
    let zp = null; if (ZB) { const p = P2(ZB.x, ZB.y, 30); if (p[2]) zp = p; }
    u.uZoom.value.set(zp ? zp[0] / CW : 0, zp ? 1 - zp[1] / CH : 0, zp ? 0.075 * zb : 0);
    for (let k = shocks.length - 1; k >= 0; k--) { const s = shocks[k]; s.t += rdt; if (s.t >= s.dur) shocks.splice(k, 1); }
    shocks.forEach((s, k) => { const e = s.t / s.dur; u.uShock.value[k].set(s.x / CW, 1 - s.y / CH, s.rmax * (1 - Math.pow(1 - e, 2.2)), s.amp * (1 - e) * (1 - e)); });
    u.uNS.value = shocks.length;
    composer.render(dt);
  }
