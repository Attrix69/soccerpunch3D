  /* =============== CAMÉRA « RÉALISATEUR » EN 3D ===============
     Plan large de télé depuis la tribune, qui suit le jeu en anticipant ; zoom selon la densité de l'action ;
     plans cinématiques courts (ultimes, K.O. brutaux, buts, fin de match) où la caméra descend et tourne ;
     plan d'ouverture : survol de la tribune puis plongée sur le terrain. Au menu, un lent travelling autour du match.
     Règle d'or : le joueur que tu contrôles ne sort jamais du cadre. */
  const DIRC = { shot: null, intro: 0, lx: 0, ly: 0, dz: 1, rotT: 0, yaw: 0, pitch: 0.6, dist: 32, menuT: 0 };
  function camShot(kind, x, y, zoom, dur, prio) {
    const s = DIRC.shot;
    if (s && s.t < s.dur && (s.prio || 0) > (prio || 0)) return;
    DIRC.shot = { kind, x, y, zoom, dur, prio: prio || 0, t: 0, side: x < W / 2 ? -1 : 1 };
  }
  function camIntro() { DIRC.intro = 3.1; DIRC.shot = null; }
  const easeIO = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const BASE_PITCH = 0.62;
  const _ct = new THREE.Vector3(), _cp = new THREE.Vector3();
  function camDist(zoom) { // distance pour voir ~31 m de large au niveau du ballon (comme la version 2D)
    const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const want = 1030 * U3 / zoom, d1 = (want / 2) / Math.tan(hf / 2), d2 = (want * 0.62 / 2) / Math.tan(vf / 2); // écran étroit : on garde de la hauteur
    return Math.min(d1, Math.max(d2, d1 * 0.62));
  }
  function updCam(V, dt) {
    const b = V.ball, inGame = app.mode !== 'menu' && !app.drafting;
    const me = inGame ? V.players[app.myTeam * 4 + V.ctrl[app.myTeam]] : null;
    // 1. cadrage de base : le ballon, un peu de toi, et de l'avance dans le sens du jeu
    let tx = b.x, ty = b.y;
    if (me) { tx = b.x * 0.78 + me.x * 0.22; ty = b.y * 0.78 + me.y * 0.22; }
    const bv = b.owner >= 0 ? 0.12 : 0.2;
    const lxT = clamp((b.vx || 0) * bv, -150, 150), lyT = clamp((b.vy || 0) * bv * 0.6, -80, 80);
    const kl = 1 - Math.exp(-dt * 2.2);
    DIRC.lx += (lxT - DIRC.lx) * kl; DIRC.ly += (lyT - DIRC.ly) * kl;
    tx += DIRC.lx; ty += DIRC.ly;
    if (me && b.owner >= 0 && (b.owner >> 2) === app.myTeam) tx += (app.myTeam === 0 ? 1 : -1) * 70;
    // 2. zoom de fond
    let near = 0;
    for (let i = 0; i < 8; i++) { const p = V.players[i]; if ((i & 3) !== 3 && len(p.x - b.x, p.y - b.y) < 230) near++; }
    const fast = clamp((len(b.vx || 0, b.vy || 0) - 500) / 900, 0, 1);
    const dzT = clamp(0.97 + near * 0.022 - fast * 0.07, 0.93, 1.08);
    DIRC.dz += (dzT - DIRC.dz) * (1 - Math.exp(-dt * 1.4));
    let zt = DIRC.dz * (1 + (1 - (V.ts || 1)) * 0.16);
    // 3. plans cinématiques : la caméra se rapproche, descend et pivote
    let rotT = 0, pitchT = BASE_PITCH, yawT = 0;
    const s = DIRC.shot;
    if (s) {
      s.t += dt;
      const live = s.kind === 'ult' ? b.sup > 0 && s.t < s.dur : s.t < s.dur;
      if (!live && s.t >= s.dur + 0.4) DIRC.shot = null;
      else {
        const inn = clamp(s.t / 0.22, 0, 1), out = live ? 1 : clamp(1 - (s.t - s.dur) / 0.4, 0, 1), w = easeIO(Math.min(inn, out));
        const fx = s.kind === 'ult' ? b.x + (b.vx || 0) * 0.15 : s.x, fy = s.kind === 'ult' ? b.y : s.y;
        tx += (fx - tx) * w * (s.kind === 'ult' ? 0.65 : 0.8); ty += (fy - ty) * w * (s.kind === 'ult' ? 0.65 : 0.8);
        zt += (s.zoom - zt) * w;
        if (s.kind === 'ult') { rotT = 0.012 * w * (cam.flip * ((b.vx || 0) >= 0 ? 1 : -1)); pitchT -= 0.1 * w; yawT = -0.14 * w * clamp((b.vx || 0) / 900, -1, 1) * cam.flip; }
        else if (s.kind === 'goal') { pitchT -= 0.2 * w; yawT = 0.32 * w * s.side * cam.flip; zt *= 1 + 0.25 * w; }
        else if (s.kind === 'ko') { pitchT -= 0.12 * w; zt *= 1 + 0.1 * w; }
        else if (s.kind === 'end') { pitchT -= 0.26 * w; yawT = 0.2 * w * Math.sin(s.t * 0.25); zt *= 1 + 0.35 * w; }
      }
    }
    // au menu (et pendant la composition) : lent travelling autour du match de démo
    if (!inGame) { DIRC.menuT += dt; yawT += Math.sin(DIRC.menuT * 0.11) * 0.42; pitchT = 0.46 + 0.06 * Math.sin(DIRC.menuT * 0.07); zt *= 1.12; }
    // 4. plan d'ouverture
    let introU = 1;
    if (DIRC.intro > 0) {
      DIRC.intro -= dt;
      introU = easeIO(clamp(1 - DIRC.intro / 3.1, 0, 1));
      tx += (1 - introU) * -260 * cam.flip; ty += (1 - introU) * -120 * cam.flip; zt = lerp(0.55, zt, introU); rotT += (1 - introU) * 0.02;
      pitchT = lerp(1.05, pitchT, introU); yawT += (1 - introU) * 0.75;
    }
    // 5. ton joueur reste dans le cadre
    if (me && DIRC.intro <= 0) {
      const hw = 1030 / zt * 0.5 * 0.86, hh = 980 / zt * 0.36;
      tx = clamp(tx, me.x - hw, me.x + hw); ty = clamp(ty, me.y - hh, me.y + hh);
    }
    tx = clamp(tx, 120, W - 120); ty = clamp(ty, 120, H - 120);
    const k = 1 - Math.exp(-dt * (s && s.kind === 'ko' ? 6 : 4.2));
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    cam.zoom += (zt - cam.zoom) * (1 - Math.exp(-dt * (DIRC.intro > 0 ? 3 : 5)));
    const ka = 1 - Math.exp(-dt * (DIRC.intro > 0 ? 6 : 2.6));
    DIRC.pitch += (pitchT - DIRC.pitch) * ka; DIRC.yaw += (yawT - DIRC.yaw) * ka;
    // ressorts : recul dans la direction du coup, roulis, zoom d'impact
    const kd = Math.min(dt, 0.033);
    DIRC.rotT += (rotT - DIRC.rotT) * (1 - Math.exp(-dt * 3));
    cam.kvx += (-260 * cam.kx - 17 * cam.kvx) * kd; cam.kvy += (-260 * cam.ky - 17 * cam.kvy) * kd;
    cam.kx += cam.kvx * kd; cam.ky += cam.kvy * kd;
    cam.rv += (-300 * (cam.rot - DIRC.rotT) - 16 * cam.rv) * kd; cam.rot = clamp(cam.rot + cam.rv * kd, -0.03, 0.03);
    if (Math.abs(cam.rot) < 1e-4 && Math.abs(cam.rv) < 1e-3 && !DIRC.rotT) { cam.rot = 0; cam.rv = 0; }
    cam.zp *= Math.exp(-dt * 7); if (cam.zp < 0.002) cam.zp = 0;
    cam.shake *= Math.exp(-dt * 8); if (cam.shake < 0.3) cam.shake = 0;
    const sk = OPT.shake ? 1 : 0.35;
    // 6. placement de la caméra : orbite autour du point visé
    const yaw = (cam.flip === 1 ? 0 : Math.PI) + DIRC.yaw, dist = camDist(cam.zoom) * (introU < 1 ? lerp(2.1, 1, introU) : 1);
    _ct.set((cam.x + cam.kx) * U3, 0.9, (cam.y + cam.ky) * U3);
    _cp.set(Math.sin(yaw) * Math.cos(DIRC.pitch) * dist, Math.sin(DIRC.pitch) * dist, Math.cos(yaw) * Math.cos(DIRC.pitch) * dist).add(_ct);
    const sh = cam.shake * sk * 0.011;
    if (sh) { _cp.x += (R() * 2 - 1) * sh; _cp.y += (R() * 2 - 1) * sh; _cp.z += (R() * 2 - 1) * sh; _ct.x += (R() * 2 - 1) * sh * 0.4; _ct.y += (R() * 2 - 1) * sh * 0.4; }
    camera.position.copy(_cp); camera.up.set(0, 1, 0); camera.lookAt(_ct);
    camera.rotateZ(cam.rot * sk + (cam.flip === 1 ? 0 : 0));
    const fov = 30 * (1 - cam.zp);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    // échelle de l'interface : pixels par unité de jeu au niveau de l'action
    K = CH / (2 * dist * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) * U3;
  }
