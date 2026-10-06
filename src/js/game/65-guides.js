  /* =============== AIDES DE JEU : ce que tu peux faire, et ce qui va se passer ===============
     au sol (vraies surfaces 3D, sous les joueurs) : cône de tir, ligne de passe, portée du tacle, anneaux
     au-dessus (interface, projetée) : réticule dans la cage, cible de la frappe, coup de grâce, danger, nom du joueur */
  const GHW = TF.GHW;
  function ctrlInfo(V) {
    if (app.mode === 'menu' || app.drafting || V.phase !== 'play') return null;
    const me = app.myTeam, ci = me * 4 + V.ctrl[me], p = V.players[ci];
    if (!p || p.st === ST.down) return null;
    const am = len(LI.mx, LI.my);
    return { me, ci, p, own: V.ball.owner === ci, gk: (ci & 3) === 3, am, ux: am > 0.3 ? LI.mx / am : p.fx, uy: am > 0.3 ? LI.my / am : p.fy };
  }
  function laneBlockV(V, team, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; let n = 0;
    for (let j = 0; j < 4; j++) {
      const o = V.players[(1 - team) * 4 + j]; if (o.st === ST.down) continue;
      const t = clamp(((o.x - ax) * dx + (o.y - ay) * dy) / L2, 0, 1);
      if (t > 0.08 && len(ax + dx * t - o.x, ay + dy * t - o.y) < 34) n++;
    }
    return n;
  }
  // même logique que la simulation : à qui partirait une passe maintenant ?
  function passTarget(V, c) {
    let best = null, bs = -1e9;
    for (let i = 0; i < 4; i++) {
      const m = V.players[c.me * 4 + i]; if (m === c.p || m.st === ST.down) continue;
      const vx = m.x - c.p.x, vy = m.y - c.p.y, d = len(vx, vy); if (d < 40) continue;
      const cos = (vx * c.ux + vy * c.uy) / d; if (cos < -0.15) continue;
      if ((i & 3) === 3 && (c.am <= 0.3 || cos < 0.82)) continue;
      const s = cos * 1.3 - d / 1500 - laneBlockV(V, c.me, c.p.x, c.p.y, m.x, m.y) * 0.35 + ((i & 3) === 3 && cos > 0.9 ? 0.4 : 0);
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }
  function strikeTarget(V, c) {
    let tg = null, bs = -1e9; const reach = LK[c.ci].tr.tentacules ? 150 : 125;
    for (let j = 0; j < 4; j++) {
      const o = V.players[(1 - c.me) * 4 + j]; if (o.st === ST.down) continue;
      const vx = o.x - c.p.x, vy = o.y - c.p.y, d = len(vx, vy); if (d > reach || d < 1) continue;
      const cos = (vx * c.ux + vy * c.uy) / d; if (cos < 0.15) continue;
      const s = cos * 1.2 - d / reach + (V.ball.owner === (1 - c.me) * 4 + j ? 0.4 : 0) - (j === 3 ? 0.3 : 0);
      if (s > bs) { bs = s; tg = o; }
    }
    return tg;
  }
  function shotAim(V, c) { // point visé dans la cage (ou direction hors cage)
    const gx = c.me === 0 ? W : 0, sg = c.me === 0 ? 1 : -1, k = V.players[(1 - c.me) * 4 + 3];
    if (c.am > 0.35) {
      const gdx = gx - c.p.x, gdy = H / 2 - c.p.y, gd = len(gdx, gdy) || 1;
      if ((c.ux * gdx + c.uy * gdy) / gd > 0.17) return { x: gx + sg * 12, y: H / 2 + clamp(c.uy * 1.6, -1, 1) * GHW * 0.78, goal: true, rnd: false };
      return { x: c.p.x + c.ux * 600, y: c.p.y + c.uy * 600, goal: false };
    }
    return { x: gx + sg * 12, y: H / 2 + (k.y <= H / 2 ? 1 : -1) * GHW * 0.62, goal: true, rnd: true };
  }

  /* ---------- surfaces au sol ---------- */
  const DASHT = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 8); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
  const GG = {};
  function gMat(col, op, tex) { return new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, map: tex || null, side: THREE.DoubleSide, fog: false }); }
  function buildGuides() {
    const add = (m, ro) => { m.renderOrder = ro || 3; m.visible = false; m.frustumCulled = false; scene.add(m); return m; };
    // cône de tir (3 sommets mobiles)
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    GG.cone = add(new THREE.Mesh(cg, gMat('#ffd23a', 0.25)));
    // lignes pointillées (visée, passe)
    const line = () => { const t = DASHT.clone(); t.needsUpdate = true; return add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0), gMat('#ffffff', 0.8, t))); };
    GG.aim = line(); GG.pass = line();
    GG.passRing = add(new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), gMat('#ffffff', 0.8)));
    // portée du tacle : flèche dégradée (couleurs par sommet)
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15), 3)); tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(20), 4)); tg.setIndex([0, 1, 4, 1, 2, 3, 1, 3, 4]);
    GG.tackle = add(new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })));
    GG.danger = add(new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), gMat('#ff2a1e', 0.8)));
    // anneau du joueur contrôlé : cercle + trois crans qui tournent (un par joueur humain)
    GG.ctrl = [0, 1].map(t => {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), gMat(TEAMS[t].c1, 0.95)));
      for (let k = 0; k < 3; k++) { const a = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.3, 16, 1, k * 2.094, 0.55).rotateX(-Math.PI / 2), gMat(TEAMS[t].c1, 0.95)); grp.add(a); }
      grp.traverse(o => { o.renderOrder = 3; }); grp.visible = false; scene.add(grp); return grp;
    });
  }
  function setLine(m, x0, y0, x1, y1, w, col, op, t, speed) {
    const dx = x1 - x0, dy = y1 - y0, L = len(dx, dy) * U3;
    m.visible = true; m.position.set(x0 * U3, 0.025, y0 * U3); m.rotation.set(0, -Math.atan2(dy, dx), 0); m.scale.set(L, 1, w * U3);
    m.material.color.set(col); m.material.opacity = op; m.material.map.repeat.set(L / 0.42, 1); m.material.map.offset.x = -t * speed;
  }
  function hideGuides() { if (!GG.cone) return; for (const k of ['cone', 'aim', 'pass', 'passRing', 'tackle', 'danger']) GG[k].visible = false; }
  function updGuides3D(V) {
    hideGuides(); if (!GG.cone) return;
    const t = performance.now() / 1000;
    // anneaux des joueurs humains
    for (let tm = 0; tm < 2; tm++) {
      const human = !app.drafting && (app.mode === 'host' || app.mode === 'guest' || (app.mode === 'solo' && tm === 0));
      const R2 = GG.ctrl[tm]; R2.visible = human && app.mode !== 'menu';
      if (!R2.visible) continue;
      const p = V.players[tm * 4 + V.ctrl[tm]], mine = tm === app.myTeam;
      R2.position.set(p.x * U3, 0.03, p.y * U3); R2.scale.setScalar(22 * U3 * (mine ? 1.05 : 0.9));
      R2.rotation.y = t * 2.4; for (let k = 1; k < 4; k++) R2.children[k].visible = mine;
      R2.children[0].material.opacity = mine ? 0.95 : 0.55;
    }
    const c = ctrlInfo(V); if (!c) return;
    const p = c.p;
    if (c.own && !c.gk && p.chg > 0) { // ---- VISÉE DU TIR ----
      const ch = Math.min(1, p.chg), sup = ch >= 0.97, a = shotAim(V, c), b = V.ball;
      const col = sup ? ((t * 12 | 0) % 2 ? '#ffffff' : '#ff2a1e') : ch < 0.5 ? '#ffd23a' : '#ff8a1a';
      const dx = a.x - b.x, dy = a.y - b.y, d = len(dx, dy) || 1, an = Math.atan2(dy, dx), spr = sup ? 0.02 : 0.025 + 0.06 * ch;
      const L = Math.min(d, 900), pos = GG.cone.geometry.attributes.position.array;
      pos.set([b.x * U3, 0.02, b.y * U3, (b.x + Math.cos(an - spr) * L) * U3, 0.02, (b.y + Math.sin(an - spr) * L) * U3, (b.x + Math.cos(an + spr) * L) * U3, 0.02, (b.y + Math.sin(an + spr) * L) * U3]);
      GG.cone.geometry.attributes.position.needsUpdate = true; GG.cone.geometry.computeBoundingSphere();
      GG.cone.visible = true; GG.cone.material.color.set(col); GG.cone.material.opacity = 0.16 + 0.16 * ch;
      setLine(GG.aim, b.x, b.y, b.x + Math.cos(an) * L, b.y + Math.sin(an) * L, 2.2, col, 0.85, t, 2);
    } else if (c.own && !c.gk) { // ---- RECEVEUR DE LA PASSE ----
      const m = passTarget(V, c);
      if (m) {
        const al = c.am > 0.3 ? 0.85 : 0.4;
        setLine(GG.pass, p.x, p.y, m.x, m.y, 2.4, TEAMS[c.me].c1, al * 0.6, t, 1.5);
        GG.passRing.visible = true; GG.passRing.position.set(m.x * U3, 0.03, m.y * U3); GG.passRing.scale.setScalar(20 * U3); GG.passRing.material.color.set(TEAMS[c.me].c1); GG.passRing.material.opacity = al;
      }
    } else if (!c.own && p.chg < 0) { // ---- PORTÉE DU TACLE ----
      const ch = Math.min(1, -p.chg), as = LK[c.ci].tr.assassin, v0 = (470 + 300 * ch) * (as ? 1.12 : 1), T = (0.3 + 0.2 * ch) * (as ? 1.1 : 1);
      const L = v0 * (1 - Math.pow(0.18, T)) / 1.7148, ex = p.x + c.ux * L, ey = p.y + c.uy * L, nx = -c.uy, ny = c.ux, wd = 14;
      const pts = [[p.x + nx * wd * 0.5, p.y + ny * wd * 0.5], [ex + nx * wd, ey + ny * wd], [ex + c.ux * 26, ey + c.uy * 26], [ex - nx * wd, ey - ny * wd], [p.x - nx * wd * 0.5, p.y - ny * wd * 0.5]];
      const pos = GG.tackle.geometry.attributes.position.array, col = GG.tackle.geometry.attributes.color.array, a1 = 0.35 + 0.35 * ch;
      pts.forEach((q, k) => { pos[k * 3] = q[0] * U3; pos[k * 3 + 1] = 0.022; pos[k * 3 + 2] = q[1] * U3; col[k * 4] = 1; col[k * 4 + 1] = 0.48; col[k * 4 + 2] = 0; col[k * 4 + 3] = k === 0 || k === 4 ? 0 : a1; });
      GG.tackle.geometry.attributes.position.needsUpdate = true; GG.tackle.geometry.attributes.color.needsUpdate = true; GG.tackle.visible = true;
    }
    const dz = dangerOf(V, c);
    if (dz > 0) { const fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 22)); GG.danger.visible = true; GG.danger.position.set(p.x * U3, 0.035, p.y * U3); GG.danger.scale.setScalar(30 * U3); GG.danger.material.opacity = (0.35 + 0.5 * dz) * fl; }
  }
  // un tacle, un coup de pied sauté ou une boule de ki arrive sur toi ?
  function dangerOf(V, c) {
    const p = c.p; let dz = 0;
    for (let j = 0; j < 4; j++) {
      const i2 = (1 - c.me) * 4 + j, o = V.players[i2], vx = p.x - o.x, vy = p.y - o.y, d = len(vx, vy);
      if ((o.st === ST.slide || o.st === ST.fly) && d < 230) { const ov = len(SVX[i2], SVY[i2]) || 1; if ((SVX[i2] * vx + SVY[i2] * vy) / (ov * (d || 1)) > 0.6) dz = Math.max(dz, 1 - d / 230); }
      else if (STRIKEV(o.st) && d < 80) dz = Math.max(dz, 0.6);
    }
    for (const k of V.proj) if (k[4] !== c.me) { const vx = p.x - k[0], vy = p.y - k[1], d = len(vx, vy), kv = len(k[2], k[3]) || 1; if (d < 320 && (k[2] * vx + k[3] * vy) / (kv * (d || 1)) > 0.8) dz = Math.max(dz, 1 - d / 320); }
    return dz;
  }
  const STRIKEV = s => s === ST.punch || s === ST.punch2 || s === ST.hkick || s === ST.stomp;

  /* ---------- couche interface (projetée) ---------- */
  function brackets(X, Y, w, h, col, lw) {
    const c = Math.min(w, h) * 0.35; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (const [sx2, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = X + sx2 * w / 2, y = Y + sy2 * h / 2; ctx.moveTo(x - sx2 * c, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy2 * c); }
    ctx.stroke();
  }
  function drawGuidesUI(V) {
    const c = ctrlInfo(V); if (!c) return;
    const p = c.p, t = performance.now() / 1000, sK = Math.min(K, 1.6);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (c.own && !c.gk && p.chg > 0) { // réticule dans la cage
      const ch = Math.min(1, p.chg), sup = ch >= 0.97, a = shotAim(V, c);
      const col = sup ? ((t * 12 | 0) % 2 ? '#ffffff' : '#ff2a1e') : ch < 0.5 ? '#ffd23a' : '#ff8a1a';
      if (a.goal) {
        const q = P2(a.x, a.y, 40);
        if (q[2]) {
          const X = q[0], Y = q[1], r = (10 + 16 * (sup ? 0.3 : ch)) * sK, pr = 1 + 0.12 * Math.sin(t * 14);
          ctx.globalAlpha = 0.95; ctx.strokeStyle = INK; ctx.lineWidth = 5 * sK; ctx.beginPath(); ctx.arc(X, Y, r * pr, 0, 7); ctx.stroke();
          ctx.strokeStyle = col; ctx.lineWidth = 2.6 * sK; ctx.beginPath(); ctx.arc(X, Y, r * pr, 0, 7); ctx.stroke();
          ctx.beginPath(); for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(X + ux * r * 0.45, Y + uy * r * 0.45); ctx.lineTo(X + ux * r * 1.5, Y + uy * r * 1.5); } ctx.stroke();
          ctx.font = `italic 800 ${Math.max(10, 11 * sK) | 0}px ${UIF}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
          const lab = sup ? 'SUPER TIR' : a.rnd ? 'LOIN DU GARDIEN' : Math.round(ch * 100) + ' %';
          ctx.strokeText(lab, X, Y - r * 1.7); ctx.fillStyle = col; ctx.fillText(lab, X, Y - r * 1.7);
        }
      }
    }
    if (!c.own) { // cible de la frappe / coup de grâce
      const tg = p.chg < 0 ? null : strikeTarget(V, c);
      if (tg) { const q = P2(tg.x, tg.y, 32), pr = 1 + 0.08 * Math.sin(t * 16); if (q[2]) { ctx.globalAlpha = 0.9; brackets(q[0], q[1], 46 * K * pr, 74 * K * pr, '#ff3b30', 2.4 * sK); } }
      else for (let j = 0; j < 4; j++) {
        const o = V.players[(1 - c.me) * 4 + j];
        if (o.st === ST.down && o.z < 8 && len(o.x - p.x, o.y - p.y) < 76) {
          const q = P2(o.x, o.y, 30); if (!q[2]) break;
          const X = q[0], Y = q[1] - Math.abs(Math.sin(t * 6)) * 4 * K;
          ctx.globalAlpha = 0.95; ctx.font = `${Math.max(12, 15 * sK) | 0}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
          ctx.strokeText('ACHÈVE !', X, Y - 18 * K); ctx.fillStyle = '#ff2a1e'; ctx.fillText('ACHÈVE !', X, Y - 18 * K);
          const q2 = P2(o.x, o.y, 6); brackets(q2[0], q2[1], 60 * K, 30 * K, '#ff2a1e', 2.2 * sK);
          break;
        }
      }
    }
    const dz = dangerOf(V, c);
    if (dz > 0) { // « ! » rouge au-dessus de toi
      const q = P2(p.x, p.y, p.z + 92), fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 22));
      if (q[2]) { ctx.globalAlpha = Math.min(1, 0.5 + dz) * fl; ctx.font = `${Math.max(18, 24 * sK) | 0}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText('!', q[0], q[1]); ctx.fillStyle = '#ff2a1e'; ctx.fillText('!', q[0], q[1]); }
    }
    ctx.restore();
  }
  // au-dessus des joueurs : chevron et nom du joueur contrôlé, jauge de charge, étoiles des sonnés
  function drawOverPlayers(V) {
    const now = performance.now();
    for (let i = 0; i < 8; i++) {
      const p = V.players[i], team = i >> 2, T = TEAMS[team], top = 66 * LK[i].b[0] + p.z;
      if (p.st === ST.down && p.z < 3) { // sonné : petites étincelles qui tournent
        const q = P2(p.x, p.y, 18); if (!q[2]) continue;
        const t = now / 1000; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * Math.min(K, 1.5);
        for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.09, x = q[0] + Math.cos(a) * 12 * K, y = q[1] + Math.sin(a) * 4 * K - 6 * K, r = 3 * K; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(a * 2); ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); }
        ctx.globalAlpha = 1; continue;
      }
      if (p.chg !== 0) { // jauge de charge segmentée
        const q = P2(p.x, p.y, top + 18); if (!q[2]) continue;
        const v = Math.abs(p.chg), N = 8, sw = 5 * K, gap = 1.4 * K, h = 6 * K, w = N * (sw + gap), gx = q[0] - w / 2, gy = q[1];
        ctx.fillStyle = 'rgba(0,0,0,.75)'; para(gx - 3 * K, gy - 2 * K, w + 4 * K, h + 4 * K, 3 * K); ctx.fill();
        const full = p.chg > 0 && v >= 0.97, blink = (now / 70 | 0) % 2;
        for (let k = 0; k < N; k++) { const on = v * N > k + 0.15; ctx.fillStyle = !on ? 'rgba(255,255,255,.12)' : p.chg < 0 ? '#9fd3ff' : full ? (blink ? '#fff' : '#ff1e1e') : k < 3 ? '#ffc21a' : k < 6 ? '#ff6a00' : '#ff1e1e'; para(gx + k * (sw + gap), gy, sw, h, 2 * K); ctx.fill(); }
        if (full) { ctx.font = `${Math.max(12, 13 * K) | 0}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = blink ? '#fff' : '#ff1e1e'; ctx.fillText('MAX', q[0], gy - 4 * K); }
      }
      if (app.mode !== 'menu' && !app.drafting && team === app.myTeam && (i & 3) === V.ctrl[team]) { // chevron du joueur contrôlé
        const q = P2(p.x, p.y, top + (p.chg !== 0 ? 34 : 14)); if (!q[2]) continue;
        const X = q[0], ay = q[1] - Math.abs(Math.sin(now / 160)) * 3 * K, s = Math.min(K, 1.6);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(X - 10 * s, ay - 9 * s); ctx.lineTo(X, ay + 1 * s); ctx.lineTo(X + 10 * s, ay - 9 * s); ctx.lineTo(X, ay - 4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = T.c1; ctx.beginPath(); ctx.moveTo(X - 8 * s, ay - 8 * s); ctx.lineTo(X, ay - 1 * s); ctx.lineTo(X + 8 * s, ay - 8 * s); ctx.lineTo(X, ay - 4.5 * s); ctx.closePath(); ctx.fill();
        ctx.font = `italic 800 ${Math.max(9, 10 * s) | 0}px ${UIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const nm = LK[i].name; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText(nm, X, ay - 11 * s); ctx.fillStyle = T.c1; ctx.fillText(nm, X, ay - 11 * s);
      }
    }
  }
  // ballon hors de l'écran : une flèche au bord
  function drawOffscreen(V) {
    const b = V.ball, q = P2(b.x, b.y, b.z), m = 34;
    let X = q[0], Y = q[1];
    if (q[2] && X > -10 && X < CW + 10 && Y > -10 && Y < CH + 10) return;
    if (!q[2]) { X = CW - X; Y = CH - Y; }
    const cx = CW / 2, cy = CH / 2, dx = X - cx, dy = Y - cy, s = Math.min((cx - m) / Math.abs(dx || 1e-3), (cy - m) / Math.abs(dy || 1e-3));
    const ax = cx + dx * s, ay = cy + dy * s, an = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(an);
    ctx.fillStyle = 'rgba(8,8,10,.8)'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(4, -7); ctx.lineTo(4, 7); ctx.closePath(); ctx.fill();
    ctx.rotate(-an); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2, 0, 5, 0, 7); ctx.fill();
    ctx.restore();
  }
