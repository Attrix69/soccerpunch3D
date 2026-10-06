  /* =============== STADE : tribunes, foule, toits, projecteurs, écrans, bord de terrain =============== */
  const STANDS = [];      // { mats: [Matrix4], side, ... } — chaque travée de 4 m (18 sièges)
  const SEATS = [];       // sièges du public (repère monde) : [x, y, z, yaw, camp]
  let crowd = null, crowdN = 0, beamsGrp = null, flaresGrp = null, flashMesh = null, railCam = null, craneHead = null;
  const CROWD_U = { uTime: { value: 0 }, uHype0: { value: 0 }, uHype1: { value: 0 }, uWave: { value: 0 } };
  const hype = [0, 0], hypeT2 = [0, 0];
  const SEATX = [-1.55, -0.93, -0.31, 0.31, 0.93, 1.55];

  function buildStands() {
    const bayParts = modelParts('stand_bay');
    const X0m = 0, X1m = W * U3, Z0m = 0, Z1m = H * U3;
    const add = (cx, cz, yaw, tiers, n, sideTag, y0) => { // une tribune : n travées côte à côte, tiers rangs de travées
      const ux = Math.cos(yaw), uz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw); // ux,uz : le long ; fx,fz : vers le terrain
      for (let t = 0; t < tiers; t++) for (let i = 0; i < n; i++) {
        const along = (i - (n - 1) / 2) * 4, back = -t * 2.4;
        const x = cx + ux * along + fx * back, z = cz + uz * along + fz * back, y = t * 1.2 + (y0 || 0);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
        STANDS.push({ m, side: sideTag, t, i, n, tiers });
        for (let r = 0; r < 3; r++) for (const sxs of SEATX) {
          const lz = 0.8 - 0.8 * r, ly = 0.4 + 0.4 * r;
          const wx = x + ux * sxs + fx * lz, wz = z + uz * sxs + fz * lz;
          // camp des supporters : derrière son but (la moitié gauche du stade pour les LOUPS)
          SEATS.push([wx, y + ly, wz, yaw, wx < CTR.x ? 0 : 1, t, sideTag]);
        }
      }
      // soubassement en béton sous les gradins supérieurs
      for (let t = 1; t < tiers; t++) {
        const g = new THREE.BoxGeometry(n * 4, t * 1.2, 2.4), mm = new THREE.Mesh(g, stdMat('#16171a', 0.95));
        mm.position.set(cx + fx * (-t * 2.4), t * 0.6 + (y0 || 0), cz + fz * (-t * 2.4)); mm.rotation.y = yaw; world.add(mm);
      }
      return { cx, cz, yaw, tiers, n, ux, uz, fx, fz };
    };
    // tribune principale (en face de la caméra), tribune basse côté caméra, virages derrière les buts
    const main = add(CTR.x, Z0m - 0.3 - 3.4 - 1.2, 0, 7, 15, 'main');
    const near = add(CTR.x, Z1m + 0.36 + 0.22 + 1.0 + 1.2, Math.PI, 4, 15, 'near', -0.8); // en contrebas : on voit les dos du premier rang
    const left = add(X0m - GD * U3 - 3.4 - 1.2, CTR.z, Math.PI / 2, 5, 9, 'left');
    const right = add(X1m + GD * U3 + 3.4 + 1.2, CTR.z, -Math.PI / 2, 5, 9, 'right');
    // instanciation des travées (béton, sièges, armatures)
    const mats = { concrete: stdMat('#3a3c40', 0.9), blue: stdMat('#5b0f14', 0.55, 0.1), metal: stdMat('#15171b', 0.5, 0.5) };
    delete bayParts.metal;
    for (const nm in bayParts) {
      const im = new THREE.InstancedMesh(bayParts[nm], mats[nm] || mats.concrete, STANDS.length);
      STANDS.forEach((s, k) => im.setMatrixAt(k, s.m));
      im.receiveShadow = true; im.castShadow = false; im.name = 'stands'; world.add(im);
    }
    // rampes au fond des tribunes, toits, écrans de bout
    for (const st of [main, left, right]) {
      const backOff = -(st.tiers - 1) * 2.4 - 1.25, topY = st.tiers * 1.2 + 0.8;
      const railParts = modelParts('stand_rail');
      const rail = new THREE.InstancedMesh(railParts.metal, mats.metal, st.n);
      for (let i = 0; i < st.n; i++) {
        const along = (i - (st.n - 1) / 2) * 4;
        rail.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(st.cx + st.ux * along + st.fx * backOff, topY, st.cz + st.uz * along + st.fz * backOff), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw), new THREE.Vector3(1, 1, 1)));
      }
      world.add(rail);
      // mur arrière sombre (le stade est fermé)
      const wall = new THREE.Mesh(new THREE.BoxGeometry(st.n * 4 + 2, topY + 8, 0.6), stdMat('#0d0e11', 0.95));
      wall.position.set(st.cx + st.fx * (backOff - 0.6), (topY + 8) / 2 - 1, st.cz + st.fz * (backOff - 0.6)); wall.rotation.y = st.yaw; world.add(wall);
    }
    // toit de la tribune principale : baies en porte-à-faux, fermes, rampe de projecteurs
    {
      const st = main, backOff = -(st.tiers - 1) * 2.4, topY = st.tiers * 1.2 + 0.6;
      const roofParts = modelParts('stand_roof'), sc = 2.2;
      const roofM = { metal: mats.metal, blue: stdMat('#101216', 0.7, 0.3) };
      for (const nm in roofParts) {
        const n2 = Math.ceil(st.n * 4 / (4 * sc)) + 1, im = new THREE.InstancedMesh(roofParts[nm], roofM[nm] || mats.metal, n2);
        for (let i = 0; i < n2; i++) {
          const along = (i - (n2 - 1) / 2) * 4 * sc;
          im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(st.cx + along, topY, st.cz + backOff + 0.4), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc * 1.8)));
        }
        im.castShadow = true; world.add(im);
      }
      // bandeau LED sous le toit
      const ribbonCv = document.createElement('canvas'); ribbonCv.width = 2048; ribbonCv.height = 96;
      const rg = ribbonCv.getContext('2d'); rg.fillStyle = '#050506'; rg.fillRect(0, 0, 2048, 96);
      rg.font = `64px ${FONT}`; rg.textBaseline = 'middle'; rg.textAlign = 'center';
      for (let i = 0; i < 6; i++) { rg.fillStyle = i % 2 ? '#ff2a1e' : '#f1efe9'; rg.fillText(i % 2 ? 'SANS PITIÉ' : 'TACLE FURY 3D', 170 + i * 341, 52); }
      const rtx = new THREE.CanvasTexture(ribbonCv); rtx.colorSpace = THREE.SRGBColorSpace;
      const rib = new THREE.Mesh(new THREE.PlaneGeometry(st.n * 4, 1.6), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: rtx, emissiveIntensity: 1.3 }));
      rib.position.set(st.cx, topY + 3.2 * sc - 1.2, st.cz + backOff + 0.4 + 1.5 * sc * 1.8 + 0.05); world.add(rib);
      // rampe de projecteurs au bord du toit (lumière principale)
      const lampM = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff8e8', emissiveIntensity: 6 });
      const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 0.25), lampM, 22);
      for (let i = 0; i < 22; i++) lamps.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(st.cx + (i - 10.5) * 2.5, topY + 3.2 * sc - 0.2, st.cz + backOff + 0.4 + 1.5 * sc * 1.8 + 0.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.6), new THREE.Vector3(1, 1, 1)));
      world.add(lamps);
      for (let i = 0; i < 22; i += 3) glowSprite(st.cx + (i - 10.5) * 2.5, topY + 3.2 * sc - 0.2, st.cz + backOff + 0.4 + 1.5 * sc * 1.8 + 0.4, 4.5, '#fff4dc', 0.55);
    }
    // tifo géant au centre de la tribune principale
    {
      const st = main, rows = [2, 6], w = 22;
      const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const g = c.getContext('2d');
      for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? '#111113' : '#a10f14'; g.fillRect(k * 1024 / 12, 0, 1024 / 12 + 1, 320); }
      const sh = g.createLinearGradient(0, 0, 0, 320); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,.05)'); g.fillStyle = sh; g.fillRect(0, 0, 1024, 320);
      g.font = `190px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText('SANS PITIÉ', 518, 172); g.fillStyle = '#f1eee8'; g.fillText('SANS PITIÉ', 512, 166);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const depth = (rows[1] - rows[0] + 1) * 2.4, rise = (rows[1] - rows[0] + 1) * 1.2;
      const geo = new THREE.PlaneGeometry(w, Math.hypot(depth, rise), 24, 6);
      const tifo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tx, roughness: 0.85, side: THREE.DoubleSide }));
      tifo.rotation.x = -Math.atan2(depth, rise);
      tifo.position.set(st.cx, rows[0] * 1.2 + rise / 2 + 1.5, st.cz - rows[0] * 2.4 - depth / 2 + 1.2);
      tifo.userData.wave = 1; world.add(tifo); TIFO = tifo;
      // les supporters cachés par le tifo le tiennent à bout de bras : on les retire
      for (let k = SEATS.length - 1; k >= 0; k--) { const s = SEATS[k]; if (s[6] === 'main' && s[5] >= rows[0] && s[5] <= rows[1] && Math.abs(s[0] - st.cx) < w / 2 - 0.3) SEATS.splice(k, 1); }
    }
    // drapeaux géants qui flottent au-dessus des virages
    for (const st of [left, right]) {
      const team = st === left ? 0 : 1, T = TEAMS[team];
      for (let i = 0; i < 5; i++) {
        const along = (i - 2) * 7.2, backOff = -(st.tiers - 1) * 2.4 - 0.4, topY = st.tiers * 1.2 + 1.2;
        const x = st.cx + st.ux * along + st.fx * backOff, z = st.cz + st.uz * along + st.fz * backOff;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 7, 6), mats.metal); pole.position.set(x, topY + 3.5, z); world.add(pole);
        const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
        g.fillStyle = T.c1; g.fillRect(0, 0, 256, 160); g.fillStyle = T.c2; g.fillRect(0, 60, 256, 40); g.fillStyle = T.acc; g.fillRect(0, 56, 256, 4); g.fillRect(0, 100, 256, 4);
        g.font = `48px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = team ? '#fff' : '#111'; g.fillText(T.name, 128, 32);
        const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2, 12, 4), flagMat(tx));
        fl.geometry.translate(1.8, 0, 0); fl.position.set(x, topY + 5.8, z); fl.rotation.y = st.yaw + (i % 2 ? 0.4 : -0.4) + Math.PI / 2;
        world.add(fl);
      }
    }
    return { main, near, left, right };
  }
  let TIFO = null;
  const FLAG_U = { uTime: { value: 0 } };
  function flagMat(tx) { // drapeau qui ondule (déformation dans le shader)
    const m = new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.8 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = FLAG_U.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fw=position.x/3.6;transformed.z+=sin(position.x*2.2-uTime*5.0+position.y*0.6)*0.35*fw;transformed.y+=sin(position.x*1.7-uTime*4.0)*0.12*fw;');
    };
    return m;
  }

  /* ---------- la foule : des milliers de supporters instanciés, animés sur le GPU ---------- */
  function fanGeometry() {
    const parts = [];
    const box = (w, h, d, x, y, z, part) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); tag(g, part); parts.push(g); };
    const tag = (g, part) => { const n = g.attributes.position.count; g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1)); };
    box(0.38, 0.82, 0.24, 0, 0.41, 0, 4);           // jambes
    box(0.46, 0.6, 0.28, 0, 1.1, 0, 0);             // torse
    const head = new THREE.IcosahedronGeometry(0.15, 0); head.translate(0, 1.56, 0.01); tag(head, 3); parts.push(head);
    box(0.12, 0.56, 0.12, -0.3, 1.1, 0, 1);         // bras gauche (pivot à l'épaule, animé)
    box(0.12, 0.56, 0.12, 0.3, 1.1, 0, 2);          // bras droit
    const g = THREE.mergeGeometries(parts.map(p => { const q = p.index ? p.toNonIndexed() : p; for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'aPart') q.deleteAttribute(k); return q; }));
    return g;
  }
  function buildCrowd() {
    // ordre aléatoire : quand on baisse la densité, la foule s'éclaircit partout de la même façon
    for (let i = SEATS.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = SEATS[i]; SEATS[i] = SEATS[j]; SEATS[j] = t; }
    const N = SEATS.length, geo = fanGeometry();
    const shirt = new Float32Array(N * 3), skin = new Float32Array(N * 3), info = new Float32Array(N * 4);
    const c = new THREE.Color(), SKN = ['#7a5a44', '#5a3e2c', '#8e6c52', '#3e2a1e', '#a07a5c', '#c49a7a', '#e0b896'];
    const mats = [];
    SEATS.forEach((s, k) => {
      const T = TEAMS[s[4]], r = Math.random();
      c.set(r < 0.42 ? T.c1 : r < 0.58 ? T.c2 : r < 0.67 ? T.acc : pick(['#1b1c20', '#222328', '#17181b', '#2a2b30', '#3a3d44']));
      shirt[k * 3] = c.r; shirt[k * 3 + 1] = c.g; shirt[k * 3 + 2] = c.b;
      c.set(pick(SKN)); skin[k * 3] = c.r; skin[k * 3 + 1] = c.g; skin[k * 3 + 2] = c.b;
      info[k * 4] = Math.random(); info[k * 4 + 1] = s[4]; info[k * 4 + 2] = Math.random() < 0.18 ? 1 : 0; info[k * 4 + 3] = 0.9 + Math.random() * 0.2;
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(s[0], s[1], s[2]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s[3] + (Math.random() - 0.5) * 0.5), new THREE.Vector3(1, info[k * 4 + 3], 1)));
    });
    geo.setAttribute('iShirt', new THREE.InstancedBufferAttribute(shirt, 3));
    geo.setAttribute('iSkin', new THREE.InstancedBufferAttribute(skin, 3));
    geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(info, 4));
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, CROWD_U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aPart;attribute vec3 iShirt,iSkin;attribute vec4 iInfo;uniform float uTime,uHype0,uHype1,uWave;varying vec3 vFan;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'float ph=iInfo.x, hy=mix(uHype0,uHype1,iInfo.y);',
          'vFan = aPart==3.0 ? iSkin : aPart==4.0 ? vec3(0.07,0.075,0.09) : iShirt;',
          // bras : levés quand ça chauffe, écharpe tendue pour certains (iInfo.z)
          'if(aPart==1.0||aPart==2.0){float sd=aPart==1.0?-1.0:1.0;float up=clamp(hy*(0.55+0.45*sin(uTime*(3.0+ph*2.0)+ph*20.0))+iInfo.z*0.75+0.08*sin(uTime*0.7+ph*30.0),0.0,1.0);',
          '  float a=up*2.75;vec3 p=transformed-vec3(0.3*sd,1.36,0.0);float ca=cos(a),sa=sin(a);transformed=vec3(p.x*ca-p.y*sa*(-sd),p.x*sa*(-sd)+p.y*ca,p.z)+vec3(0.3*sd,1.36,0.0);',
          '  if(aPart==1.0&&up>0.5)vFan=mix(iShirt,iSkin,0.0);}',
          // tout le corps : sautille quand l'équipe marque, se balance sinon ; la ola fait le tour du stade
          'float jmp=max(0.0,sin(uTime*(7.0+ph*3.0)+ph*40.0))*0.32*hy;',
          'vec4 wp=instanceMatrix*vec4(0.,0.,0.,1.);float ola=uWave*max(0.0,1.0-abs(mod(atan(wp.z-14.7,wp.x-24.6)*3.0-uTime*3.0,6.2832)-3.1416)*1.2)*0.5;',
          'transformed.y+=jmp+ola;transformed.x+=sin(uTime*1.3+ph*20.0)*0.03*(1.0-hy);'
        ].join('\n'));
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFan;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vFan * 0.85, opacity );');
    };
    crowd = new THREE.InstancedMesh(geo, mat, N);
    mats.forEach((m, k) => crowd.setMatrixAt(k, m));
    crowd.frustumCulled = false; crowd.name = 'crowd'; crowdN = N; world.add(crowd);
    // flashs d'appareils photo dans les tribunes (animés sur le GPU)
    const fg = new THREE.PlaneGeometry(0.5, 0.5), NF = 400, fpos = new Float32Array(NF * 4);
    for (let k = 0; k < NF; k++) { const s = SEATS[(Math.random() * N) | 0]; fpos[k * 4] = s[0]; fpos[k * 4 + 1] = s[1] + 1.6; fpos[k * 4 + 2] = s[2]; fpos[k * 4 + 3] = Math.random(); }
    fg.setAttribute('iPos', new THREE.InstancedBufferAttribute(fpos, 4));
    const fm = new THREE.ShaderMaterial({
      uniforms: { uTime: CROWD_U.uTime, uRate: { value: 0.2 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute vec4 iPos;uniform float uTime,uRate;varying vec2 vUv;varying float vA;float h(float n){return fract(sin(n)*43758.5453);}void main(){vUv=uv;float slot=floor(uTime*3.0+iPos.w*17.0);float on=step(1.0-uRate*0.25,h(slot*1.7+iPos.w*91.0));float f=fract(uTime*3.0+iPos.w*17.0);vA=on*max(0.0,1.0-f*4.0);vec4 mv=modelViewMatrix*vec4(iPos.xyz,1.0);mv.xy+=position.xy*(0.6+vA);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec2 vUv;varying float vA;void main(){float d=length(vUv-0.5);float a=vA*smoothstep(0.5,0.0,d);if(a<0.01)discard;gl_FragColor=vec4(vec3(2.6,2.7,3.0)*a,a);}'
    });
    flashMesh = new THREE.InstancedMesh(fg, fm, NF); flashMesh.frustumCulled = false; world.add(flashMesh);
  }
  function setCrowdDensity(f) { if (crowd) crowd.count = Math.max(1, Math.floor(crowdN * f)); }

  /* ---------- projecteurs : pylônes, halos, faisceaux dans la brume ---------- */
  const GLOWT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.15, 'rgba(255,255,255,.75)'); rg.addColorStop(0.45, 'rgba(255,255,255,.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  function glowSprite(x, y, z, size, col, op) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOWT, color: col, transparent: true, opacity: op == null ? 0.8 : op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.position.set(x, y, z); s.scale.set(size, size, 1); world.add(s); return s;
  }
  // faisceau « volumétrique » : dégradé le long du cône, bords adoucis, s'efface près de la caméra
  const BEAMM = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#fff0d6') }, uOp: { value: 0.05 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN;varying vec3 vV;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;vY=uv.y;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uCol;uniform float uOp;varying vec3 vN;varying vec3 vV;varying float vY;void main(){float d=length(vV);float e=pow(abs(dot(normalize(vN),vV/d)),2.0);float a=uOp*e*smoothstep(0.0,0.7,vY)*smoothstep(6.0,26.0,d);gl_FragColor=vec4(uCol*a,a);}'
  });
  function buildFloodlights() {
    beamsGrp = new THREE.Group(); world.add(beamsGrp);
    const lamp = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fffaf0', emissiveIntensity: 7 });
    const beamTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.75, 'rgba(255,255,255,.55)'); lg.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = lg; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); })();
    const corners = [[-9, -9], [W * U3 + 9, -9], [-9, H * U3 + 9], [W * U3 + 9, H * U3 + 9]];
    for (const [x, z] of corners) {
      const m = model('floodlight', { white: lamp, concrete: stdMat('#2a2c30', 0.9), metal: stdMat('#1c1e22', 0.5, 0.6) }, { cast: false });
      const sc = 1.85; m.scale.setScalar(sc); m.position.set(x, 0, z);
      m.rotation.y = Math.atan2(CTR.x - x, CTR.z - z); world.add(m);
      const top = new THREE.Vector3(0, 12.1 * sc, 0.2 * sc).applyAxisAngle(new THREE.Vector3(0, 1, 0), m.rotation.y).add(m.position);
      glowSprite(top.x, top.y, top.z, 9, '#fff6e0', 0.9); glowSprite(top.x, top.y, top.z, 26, '#ffe8c0', 0.22);
      // faisceau volumétrique vers le terrain
      const tgt = new THREE.Vector3(CTR.x + (CTR.x - x) * -0.15, 0, CTR.z + (CTR.z - z) * -0.15), dir = tgt.clone().sub(top), L = dir.length();
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 11, L, 32, 8, true), BEAMM);
      cone.position.copy(top).add(tgt).multiplyScalar(0.5);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
      beamsGrp.add(cone);
    }
  }
  function setBeams(on) { if (beamsGrp) beamsGrp.visible = !!on; }

  /* ---------- bord de terrain : bancs, caméras de télé, enceintes, écrans géants ---------- */
  let screens = [], screenCv = null, screenTex = null, screenT = 0;
  function buildSideline() {
    const teamM = t => stdMat(TEAMS[t].c1, 0.6, 0.1);
    const zD = -10 * U3 - 0.3 - 1.5;
    for (const t of [0, 1]) { // les bancs de touche, chacun dans son camp
      const x = CTR.x + (t ? 1 : -1) * 9;
      const d = model('dugout', { blue: stdMat('#121418', 0.4, 0.5), concrete: stdMat('#2a2c30', 0.9), metal: stdMat('#1c1e22', 0.5, 0.6) }, { cast: true });
      d.position.set(x, 0, zD); d.scale.setScalar(1.3); world.add(d);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: TEAMS[t].c1, emissive: TEAMS[t].c1, emissiveIntensity: 1.5 }));
      stripe.position.set(x, 2.75, zD + 1.25); world.add(stripe);
      for (const [nm, dx, dz] of [['cooler', 3.3, 0.7], ['water_carrier', 3.0, 1.1], ['water_carrier', -3.1, 1.0]]) { const o = model(nm, { blue: teamM(t) }, { cast: true }); o.position.set(x + dx, 0, zD + dz); world.add(o); }
    }
    const tt = model('treatment_table', null, { cast: true }); tt.position.set(CTR.x - 17, 0, zD + 0.4); world.add(tt);
    const stc = model('stretcher', null, { cast: true }); stc.position.set(CTR.x - 19.5, 0, zD + 0.6); stc.rotation.y = 0.4; world.add(stc);
    // caméra sur rail le long de la touche d'en face (elle suit le jeu)
    const railM = { white: stdMat('#2c2e33', 0.6), blue: stdMat('#d4111a', 0.5, 0.2) };
    for (let i = -6; i <= 6; i++) { const r = model('camera_rail', railM, {}); r.position.set(CTR.x + i * 4, 0, zD + 1.3); r.traverse(o => { if (o.isMesh && o.material.name !== 'white' && o.material !== railM.white) o.visible = false; }); world.add(r); }
    railCam = model('camera_rail', railM, { cast: true }); railCam.traverse(o => { if (o.isMesh && o.material === railM.white) o.visible = false; });
    railCam.position.set(CTR.x, 0, zD + 1.3); world.add(railCam);
    // grue de télé côté caméra, plateformes derrière les buts
    const crane = model('camera_crane', { blue: stdMat('#d4111a', 0.5, 0.2) }, { cast: true });
    crane.position.set(CTR.x - 14, 0, (H + 12) * U3 + 2.2); crane.rotation.y = Math.PI / 2; crane.scale.setScalar(1.25); world.add(crane); craneHead = crane;
    for (const side of [0, 1]) {
      const p = model('camera_platform', null, { cast: true }); p.position.set(side ? W * U3 + GD * U3 + 2.6 : -GD * U3 - 2.6, 0, CTR.z + (side ? -7 : 7)); p.rotation.y = side ? -Math.PI / 2 : Math.PI / 2; world.add(p);
      for (const dz of [-12, 12]) { const s = model('speaker', null, { cast: true }); s.position.set(side ? W * U3 + 3 : -3, 0, CTR.z + dz * 1.1); s.rotation.y = side ? -Math.PI / 2 : Math.PI / 2; s.scale.setScalar(1.4); world.add(s); }
    }
    // écrans géants sur les virages : le score, l'horloge, les noms des héros du moment
    screenCv = document.createElement('canvas'); screenCv.width = 512; screenCv.height = 256;
    screenTex = new THREE.CanvasTexture(screenCv); screenTex.colorSpace = THREE.SRGBColorSpace;
    const scrM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: screenTex, emissiveIntensity: 1.15, roughness: 0.3 });
    for (const side of [0, 1]) {
      const x = side ? W * U3 + GD * U3 + 3.4 + 1.2 + 4 * 2.4 + 1 : -GD * U3 - 3.4 - 1.2 - 4 * 2.4 - 1, z = side ? CTR.z - 10 : CTR.z + 10;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(9.6, 5.2, 0.5), stdMat('#0c0d10', 0.5, 0.5)); fr.position.set(x, 13.5, z);
      fr.rotation.y = side ? -Math.PI / 2 + 0.35 : Math.PI / 2 - 0.35; world.add(fr);
      const sc2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.6), scrM); sc2.position.set(0, 0, 0.26); fr.add(sc2);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 11, 0.4), stdMat('#1c1e22', 0.5, 0.6)); leg.position.set(x, 5.5, z); world.add(leg);
      screens.push(fr);
    }
  }
  let scrMsg = null; // message plein écran temporaire (BUT !, K.O.…)
  function screenMsg(txt, col, life) { scrMsg = { txt, col, t: performance.now() + (life || 2) * 1000 }; }
  function drawScreen(V) {
    const g = screenCv.getContext('2d'), w = 512, h = 256, now = performance.now();
    g.fillStyle = '#06070a'; g.fillRect(0, 0, w, h);
    if (scrMsg && now < scrMsg.t) {
      const on = ((now / 180) | 0) % 2;
      g.fillStyle = on ? scrMsg.col : '#06070a'; g.fillRect(0, 0, w, h);
      g.font = `110px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = on ? '#06070a' : scrMsg.col; g.fillText(scrMsg.txt, w / 2, h / 2 + 6);
    } else {
      const T0 = TEAMS[0], T1 = TEAMS[1];
      g.fillStyle = '#111318'; g.fillRect(0, 0, w, 64);
      g.font = `44px ${FONT}`; g.textBaseline = 'middle';
      g.textAlign = 'left'; g.fillStyle = T0.c1; g.fillText(T0.name, 18, 34);
      g.textAlign = 'right'; g.fillStyle = T1.c1; g.fillText(T1.name, w - 18, 34);
      g.font = `150px ${FONT}`; g.textAlign = 'center';
      g.fillStyle = T0.c1; g.fillText(String(V ? V.score[0] : 0), w * 0.27, 160);
      g.fillStyle = T1.c1; g.fillText(String(V ? V.score[1] : 0), w * 0.73, 160);
      g.fillStyle = '#f1efe9'; g.font = `60px ${FONT}`; g.fillText(V && V.golden ? 'OR' : fmtClock(V ? V.clock : 180), w / 2, 150);
      g.fillStyle = '#d4111a'; g.fillRect(0, h - 10, w, 10);
    }
    g.fillStyle = 'rgba(0,0,0,.3)'; for (let y = 1; y < h; y += 3) g.fillRect(0, y, w, 1);
    screenTex.needsUpdate = true;
  }

  /* ---------- ciel de nuit ---------- */
  function buildSky() {
    const geo = new THREE.SphereGeometry(320, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 vP;float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}void main(){float y=vP.y;vec3 c=mix(vec3(0.03,0.035,0.06),vec3(0.006,0.007,0.014),smoothstep(0.0,0.6,y));c+=vec3(0.09,0.05,0.035)*exp(-max(y,0.0)*9.0);vec3 q=floor(vP*420.0);float s=step(0.9985,h(q))*smoothstep(0.08,0.4,y);c+=vec3(s*0.8);gl_FragColor=vec4(c,1.);}'
    });
    const sky = new THREE.Mesh(geo, mat); sky.position.copy(CTR); sky.renderOrder = -1; scene.add(sky);
  }

  /* ---------- fumigènes dans les virages (aux couleurs des camps) ---------- */
  function buildFlares(st) {
    flaresGrp = new THREE.Group(); world.add(flaresGrp);
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(0.5, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const NP = 26;
    for (const sd of [st.left, st.right]) for (let i = 0; i < 3; i++) {
      const team = sd === st.left ? 0 : 1, along = (i - 1) * 9 + (Math.random() - 0.5) * 3, back = -(1 + (Math.random() * 3 | 0)) * 2.4;
      const x = sd.cx + sd.ux * along + sd.fx * back, z = sd.cz + sd.uz * along + sd.fz * back, y = -back / 2 + 1.6;
      const geo = new THREE.PlaneGeometry(1, 1), seed = new Float32Array(NP);
      for (let k = 0; k < NP; k++) seed[k] = k / NP;
      geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 1));
      const col = new THREE.Color(team ? '#ff4a26' : '#56b8ff');
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: CROWD_U.uTime, tex: { value: tex }, uCol: { value: col }, uOrg: { value: new THREE.Vector3(x, y, z) } }, transparent: true, depthWrite: false,
        vertexShader: 'attribute float iSeed;uniform float uTime;uniform vec3 uOrg;varying vec2 vUv;varying float vT;void main(){vUv=uv;float t=fract(uTime*0.12+iSeed);vT=t;vec3 p=uOrg+vec3(sin(iSeed*40.0+uTime*0.3)*t*2.5+t*t*4.0,t*9.0,cos(iSeed*31.0)*t*2.0);vec4 mv=modelViewMatrix*vec4(p,1.0);mv.xy+=position.xy*(0.8+t*5.0);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'uniform sampler2D tex;uniform vec3 uCol;varying vec2 vUv;varying float vT;void main(){vec4 c=texture2D(tex,vUv);float a=c.a*(1.0-vT)*smoothstep(0.0,0.08,vT)*0.5;vec3 col=mix(uCol*2.2,uCol*0.45+vec3(0.06),smoothstep(0.0,0.35,vT));gl_FragColor=vec4(col,a);}'
      });
      const im = new THREE.InstancedMesh(geo, m, NP); im.frustumCulled = false; flaresGrp.add(im);
      glowSprite(x, y + 0.3, z, 3.2, team ? '#ff5a30' : '#7cc8ff', 0.9);
    }
  }

  let STD = null;
  function buildStadium() {
    buildSky(); buildPitch(); buildGroundMarks(); buildEnclosure();
    STD = buildStands(); buildCrowd(); buildFloodlights(); buildSideline(); buildFlares(STD);
  }
  // la foule vit le match : elle saute sur les buts, se lève sur les grosses actions
  function crowdHype(team, v, dur) { for (const t of team < 0 ? [0, 1] : [team]) { hype[t] = Math.max(hype[t], v); hypeT2[t] = Math.max(hypeT2[t], performance.now() + (dur || 1.5) * 1000); } }
  function updStadium(V, dt) {
    const t = performance.now() / 1000;
    CROWD_U.uTime.value = t; FLAG_U.uTime.value = t;
    for (const k of [0, 1]) { if (performance.now() > hypeT2[k]) hype[k] = Math.max(0.12, hype[k] - dt * 0.6); }
    const base = app.mode === 'menu' ? 0.15 : 0.2;
    CROWD_U.uHype0.value += (Math.max(base, hype[0]) - CROWD_U.uHype0.value) * Math.min(1, dt * 6);
    CROWD_U.uHype1.value += (Math.max(base, hype[1]) - CROWD_U.uHype1.value) * Math.min(1, dt * 6);
    if (flashMesh) flashMesh.material.uniforms.uRate.value = 0.25 + Math.max(hype[0], hype[1]) * 1.2;
    if (railCam && V) { const tx = clamp(V.ball.x, 120, W - 120) * U3; railCam.position.x += (tx - railCam.position.x) * Math.min(1, dt * 1.5); }
    updEnclosure(dt);
    screenT += dt; if (screenCv && screenT > 0.25) { screenT = 0; drawScreen(V); }
    if (TIFO) TIFO.position.y += Math.sin(t * 1.7) * 0.0015;
  }
