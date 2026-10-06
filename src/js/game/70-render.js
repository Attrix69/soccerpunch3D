  /* ---------- état d'animation par joueur : vitesse lissée, cycle de course, traces au sol ---------- */
  function updAnimState(V, dt) {
    const gdt = dt * (V.ts || 1), igd = 1 / Math.max(gdt, 1e-3);
    for (let i = 0; i < 8; i++) {
      const p = V.players[i], dx = p.x - prevX[i], dy = p.y - prevY[i], d = len(dx, dy);
      if (d < 60 && gdt > 0) {
        const k = Math.min(1, gdt * 14), ox = SVX[i], oy = SVY[i];
        SVX[i] += (dx * igd - ox) * k; SVY[i] += (dy * igd - oy) * k;
        const ka = Math.min(1, gdt * 7);
        SAX[i] += ((SVX[i] - ox) * igd - SAX[i]) * ka; SAY[i] += ((SVY[i] - oy) * igd - SAY[i]) * ka;
        spd[i] = len(SVX[i], SVY[i]);
        if (spd[i] > 6) animPh[i] += gdt * 6.283 * (1.25 + 0.0058 * Math.min(spd[i], 380)) * (LK[i].pe ? LK[i].pe.g.cad : 1);
        const fa = Math.atan2(p.fy, p.fx); let da = fa - FPV[i];
        if (da !== da) da = 0; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
        FPV[i] = fa;
        SHF[i] += (Math.min(1, Math.abs(da) * igd / 5) - SHF[i]) * Math.min(1, gdt * 6);
        if (spd[i] < 40 && SHF[i] > 0.05) animPh[i] += gdt * 6.283 * 1.7 * SHF[i];
      } else if (d >= 60) { SVX[i] = SVY[i] = SAX[i] = SAY[i] = 0; spd[i] = 0; FPV[i] = NaN; }
      prevX[i] = p.x; prevY[i] = p.y;
      if (p.st !== stPrev[i]) { stPrev[i] = p.st; stT[i] = 0; AHIT[i] = 0; } else stT[i] += dt * (V.ts || 1);
      if ((p.st === ST.charge || p.st === ST.blast) && dt > 0 && R() < 0.7) { const T = TEAMS[i >> 2], full = V.bar[i >> 2] >= 1; spawn({ x: p.x + rnd2(-16, 16), y: p.y + rnd2(-6, 6), z: rnd2(0, 30), vx: 0, vy: 0, vz: rnd2(90, 170), g: -60, life: 0.55, max: 0.55, size: rnd2(2.5, 5), col: full ? pick(['#ffd23a', '#fff6c0']) : pick([T.acc, '#ffffff']), type: 'fire', rot: 0, vr: 0 }); }
      const gh = ghosts[i];
      if (p.st === ST.dash || p.st === ST.fly || (p.st === ST.down && p.z > 8)) { gh.push([p.x, p.y, p.z]); if (gh.length > 7) gh.shift(); }
      else if (gh.length) gh.length = 0;
      if (SQ[i]) { SQ[i] *= Math.exp(-dt * 9); if (Math.abs(SQ[i]) < 0.004) SQ[i] = 0; }
      if (HOP[i] > 0) HOP[i] -= animDt;
      if (dt > 0) groundFx(p, i, dt);
      if (dt > 0 && V.ts > 0.5) {
        if (p.st === ST.slide && R() < 0.8) turf(p.x + rnd2(-6, 6), p.y + rnd2(-4, 4), 1, 90);
        else if ((p.st === ST.slide || p.st === ST.dash) && R() < 0.5) spawn({ x: p.x, y: p.y, z: 2, vx: rnd2(-20, 20), vy: rnd2(-20, 20), vz: 20, g: 0, life: 0.5, max: 0.5, size: 5, col: '#5a4a36', type: 'puff', rot: 0, vr: 0 });
        else if (spd[i] > 300 && R() < 0.12) spawn({ x: p.x, y: p.y, z: 1, vx: 0, vy: 0, vz: 10, g: 0, life: 0.35, max: 0.35, size: 3, col: '#4a4034', type: 'puff', rot: 0, vr: 0 });
      }
    }
  }
  function groundFx(p, i, dt) { // sang des blessés, sillon des corps qui glissent, saleté
    const lv = BLV(p.dmg);
    if (GORE && lv >= 2 && p.st !== ST.down && R() < dt * (lv === 3 ? 5 : 2.4))
      spawn({ x: p.x + rnd2(-4, 4), y: p.y + rnd2(-3, 3), z: rnd2(32, 46), vx: SVX[i] * 0.3, vy: SVY[i] * 0.3, vz: rnd2(-20, 50), g: 900, life: 1.2, max: 1.2, size: rnd2(1.1, 2.1), col: '#8a070b', type: 'blood', rot: 0, vr: 0 });
    if (p.st === ST.down && p.z < 2 && spd[i] > 110) { // le corps laboure la pelouse
      if (SKX[i] === SKX[i] && len(p.x - SKX[i], p.y - SKY[i]) > 12) {
        goreMark('k', SKX[i], SKY[i], 7, p.x, p.y, 9);
        if (GORE && lv >= 2) goreMark('s', SKX[i] + rnd2(-2, 2), SKY[i], 3.2, p.x, p.y, 15);
        SKX[i] = p.x; SKY[i] = p.y;
      } else if (SKX[i] !== SKX[i]) { SKX[i] = p.x; SKY[i] = p.y; }
      if (R() < 0.5) turf(p.x, p.y, 1, 70);
      if (R() < 0.35) spawn({ x: p.x, y: p.y, z: 2, vx: rnd2(-20, 20), vy: rnd2(-20, 20), vz: 24, g: 0, life: 0.6, max: 0.6, size: 6, col: '#5a4a36', type: 'puff', rot: 0, vr: 0 });
      DIRT[i] = Math.min(1, DIRT[i] + dt * 0.25);
    } else SKX[i] = NaN;
    if (p.st === ST.slide) DIRT[i] = Math.min(1, DIRT[i] + dt * 0.35);
  }
  /* ---------- ballon : rotation, traînées de feu, trace des tirs ---------- */
  function updBallFx(V, dt) {
    const b = V.ball, bd = len(b.x - pbx, b.y - pby);
    if (bd < 200) ballSpin += bd * 0.09;
    if (b.owner < 0 && pbz > 6 && b.z <= 1.5 && bvz < -60) BSQ = Math.min(0.4, -bvz / 1400);
    bvz = dt > 0 ? (b.z - pbz) / Math.max(dt * (V.ts || 1), 1e-3) : bvz; pbz = b.z;
    if (BSQ) { BSQ *= Math.exp(-dt * 10); if (BSQ < 0.01) BSQ = 0; }
    pbx = b.x; pby = b.y;
    const ukk = b.uk ? ULK[b.uk - 1] : '';
    if (b.sup) {
      const invis = ukk === 'abra' && b.gu > 0.18 && b.gu < 0.7;
      if (!invis && dt > 0) {
        const cols = ukk ? UCOL[ukk] : b.sup === 2 ? ['#ff1e2e', '#ffffff', '#ff4060'] : ['#ffd23a', '#ff6a00', '#ff1e1e', '#fff'];
        for (let k = 0; k < 2; k++) spawn({ x: b.x + rnd2(-4, 4), y: b.y + rnd2(-4, 4), z: b.z + rnd2(0, 8), vx: rnd2(-40, 40), vy: rnd2(-40, 40), vz: rnd2(20, 90), g: 0, life: 0.35, max: 0.35, size: rnd2(4, 8), col: pick(cols), type: 'fire', rot: 0, vr: 0 });
        if (R() < 0.6 && ukk !== 'fil' && ukk !== 'couronne' && ukk !== 'crescendo') spawn({ x: b.x, y: b.y, z: b.z, vx: rnd2(-15, 15), vy: rnd2(-15, 15), vz: rnd2(10, 40), g: 0, life: 0.7, max: 0.7, size: rnd2(4, 7), col: '#1c1a1a', type: 'smoke', rot: 0, vr: 0 });
      }
      ultFlight(V, b, dt);
    }
    const bsp = len(b.vx || 0, b.vy || 0);
    if (!b.sup && b.owner < 0 && b.kb >= 0 && (b.kb & 3) !== 3 && (bsp > 480 || (strail.length && bsp > 250))) {
      if (!strail.length) strailCol = LK[b.kb].pe.fx;
      strail.push([b.x, b.y, b.z]); if (strail.length > 16) strail.shift();
    } else if (strail.length) strail.shift();
  }

  /* ---------- auras de ki, boules de ki, méga rayon, rage du berserker ---------- */
  const AUR = [], KIB = [], BEAMS3 = [];
  function auraObjs(i) {
    if (AUR[i]) return AUR[i];
    const a = { sph: vfxObj('fx_charge'), ring: vfxObj('fx_spinring'), rage: null };
    for (const o of [a.sph, a.ring]) if (o) { o.visible = false; scene.add(o); }
    a.rage = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOWT, color: '#ff2a1e', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); a.rage.visible = false; scene.add(a.rage);
    return (AUR[i] = a);
  }
  function updAuras(V) {
    const t = performance.now() / 1000;
    for (let i = 0; i < 8; i++) {
      const p = V.players[i], a = auraObjs(i), on = p.st === ST.charge || p.st === ST.blast, full = V.bar[i >> 2] >= 1, kc = full ? ['#fff8d0', '#ffd23a', '#ff9a00'] : KICOL[i >> 2];
      for (const o of [a.sph, a.ring]) if (o) o.visible = on;
      if (on && a.sph) {
        setVfxCol(a.sph, kc[0], kc[1], kc[2], 0.55 + 0.15 * Math.sin(t * 20));
        toW(p.x, p.y, 34 + p.z, a.sph.position); a.sph.scale.setScalar((p.st === ST.blast ? 1.5 : 1.15) * (1 + 0.06 * Math.sin(t * 30))); a.sph.rotation.set(t * 2, t * 3.1, 0);
        setVfxCol(a.ring, kc[0], kc[1], kc[2], 0.8); toW(p.x, p.y, 2, a.ring.position); a.ring.scale.setScalar(1.6); a.ring.rotation.y = t * 6;
      }
      const rage = LK[i].tr.berserk && p.dmg >= 3; a.rage.visible = rage;
      if (rage) { toW(p.x, p.y, 34 + p.z, a.rage.position); a.rage.scale.set(1.8, 2.8, 1); a.rage.material.opacity = 0.22 + 0.1 * Math.sin(t * 11); }
    }
    // boules de ki : orbes lumineux orientés dans le sens du tir
    for (let k = 0; k < Math.max(KIB.length, V.proj.length); k++) {
      if (!KIB[k]) { const o = vfxObj('fx_plasma'); if (!o) break; scene.add(o); KIB[k] = o; }
      const o = KIB[k], q = V.proj[k]; o.visible = !!q;
      if (!q) continue;
      const c = KICOL[q[4]]; setVfxCol(o, c[0], c[1], c[2], 1);
      toW(q[0], q[1], 30, o.position); o.quaternion.setFromUnitVectors(_bz, _bv.set(q[2], 0, q[3]).normalize()); o.scale.setScalar(1.35 + 0.1 * Math.sin(t * 40));
      if (R() < 0.8) spawn({ x: q[0] - q[2] * 0.02, y: q[1] - q[3] * 0.02, z: 30 + rnd2(-4, 4), vx: rnd2(-20, 20), vy: rnd2(-20, 20), vz: rnd2(-10, 10), g: 0, life: 0.3, max: 0.3, size: rnd2(5, 9), col: pick(c), type: 'fire', rot: 0, vr: 0 });
    }
    // méga rayon : colonne d'énergie de la largeur d'un homme
    for (let k = 0; k < Math.max(BEAMS3.length, V.beams.length); k++) {
      if (!BEAMS3[k]) {
        const grp = new THREE.Group();
        const mk = (r, col, op) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); grp.add(m); return m; };
        grp.userData.l = [mk(0.95, '#3cc8ff', 0.25), mk(0.55, '#3cc8ff', 0.5), mk(0.24, '#ffffff', 0.95)];
        grp.userData.fx = vfxObj('fx_beam'); if (grp.userData.fx) grp.add(grp.userData.fx);
        scene.add(grp); BEAMS3[k] = grp;
      }
      const g = BEAMS3[k], bm = V.beams[k]; g.visible = !!bm;
      if (!bm) continue;
      const c = KICOL[bm[6]], life = clamp(bm[5] / 0.15, 0, 1), wd = (1 + Math.sin(t * 60) * 0.1) * life;
      g.userData.l[0].material.color.set(c[2]).multiplyScalar(2); g.userData.l[1].material.color.set(c[1]).multiplyScalar(2.5); g.userData.l[2].material.color.set('#ffffff').multiplyScalar(3);
      toW(bm[0], bm[1], 30, g.position); g.quaternion.setFromUnitVectors(_bz, _bv.set(bm[2], 0, bm[3]).normalize());
      g.scale.set(wd, wd, Math.max(0.01, bm[4] * U3));
      if (g.userData.fx) { setVfxCol(g.userData.fx, '#ffffff', c[1], c[0], life); g.userData.fx.scale.set(4, 4, 1); g.userData.fx.position.set(0, 0, 0.5); }
    }
  }

  /* ---------- une image ---------- */
  function render(V, dt) {
    setLooks(V.pk); syncRigs();
    updAnimState(V, dt); updBallFx(V, dt);
    curBar = V.bar; animDt = Math.min(0.05, dt * (V.ts || 1));
    for (let i = 0; i < 8; i++) {
      const p = V.players[i], rg = RIGS[i]; if (!rg) continue;
      updRig(rg, p, i, dt);
      const lying = p.st === ST.slide || (p.st === ST.down && p.z < 3) || p.st === ST.dive, f = 1 - Math.min(p.z, 150) / 260, ew = (lying ? 26 : 15) * f * LK[i].b[0];
      rg.blob.position.set(p.x * U3, 0.012, p.y * U3); rg.blob.scale.set(ew * 2.7 * U3, 1, (lying ? 22 : 15) * f * U3 * 1.8); rg.blob.rotation.y = lying ? Math.atan2(-p.fy, p.fx) : 0;
      rg.tring.visible = !lying && app.mode !== 'menu'; rg.tring.position.set(p.x * U3, 0.02, p.y * U3); rg.tring.scale.setScalar(ew * 1.25 * U3);
    }
    updAuras(V); updBall3D(V, dt); updGoals(); updUlt3D(V); updGuides3D(V);
    drawParts(); updGroundMarks(dt); updDecals(); updStadium(V, dt); updLights(V, dt);
    OUTL_U.uRes.value.set(CW * DPR, CH * DPR); OUTL_U.uPx.value = clamp(1.1 + 0.75 * K, 1.5, 3.2) * DPR;
    composite(V, dt);
    drawUI(V, dt);
  }
  /* ---------- l'interface, sur sa propre couche ---------- */
  function drawUI(V, dt) {
    ctx = uictx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, CW, CH);
    drawFloats();
    if (SPL.length) drawSplats(dt > 0 ? dt : 0);
    if (app.mode !== 'menu' && !app.drafting) { drawOverPlayers(V); drawGuidesUI(V); drawHUD(V); drawFeed(); drawCombo(); drawOffscreen(V); drawOverText(V); }
  }
