  /* =============== BOUCLE =============== */
  const STEP = 1 / 60;
  let chantT = 12, lastTick = 0;
  let last = performance.now(), acc = 0, lastLbl = '', lastP = -1, lastS = -1;
  const demoV = makeView(), hostV = makeView();

  function updButtons(V) {
    const me = app.myTeam, ci = me * 4 + V.ctrl[me];
    const own = V.ball.owner === ci, bar = V.bar[me], full = bar >= 1, ki = bar >= 1 / 3 - 1e-6;
    // ballon en l'air à portée : volée ou tête
    const bl = V.ball, mp = V.players[ci];
    const air = !own && bl.owner < 0 && bl.z > 12 && !bl.sup && len(bl.x - mp.x, bl.y - mp.y) < 130 ? (bl.z > 95 ? 2 : bl.z > 50 ? 3 : 1) : 0;
    let fin = 0; // un adversaire à terre à portée : on peut l'achever
    if (!own && !air) { let up = false; for (let j = 0; j < 4; j++) { const o = V.players[(1 - me) * 4 + j], d = len(o.x - mp.x, o.y - mp.y); if (o.st === ST.down) { if (o.z < 8 && d < 76) fin = 1; } else if (d < 110) up = true; } if (up) fin = 0; }
    const gkc = V.ctrl[me] === 3;
    const far = own && !gkc && len((me === 0 ? W : 0) - mp.x, H / 2 - mp.y) > 1000; // l'ultime ne part pas de trop loin
    const lbl = (own ? 1 : 0) + '' + (full ? 2 : ki ? 1 : 0) + air + (gkc ? 'g' : '') + (far ? 'f' : '') + (fin ? 'x' : '');
    if (lbl !== lastLbl) {
      lastLbl = lbl;
      btns.A.classList.toggle('air', air > 0); btns.A.classList.toggle('fin', !!fin);
      btns.A.innerHTML = own ? '<b>TIR</b><small>tap = passe</small>' : air === 2 ? '<b>TÊTE</b><small>en l\'air !</small>' : air === 3 ? '<b>CISEAU</b><small>acrobatique !</small>' : air === 1 ? '<b>VOLÉE</b><small>reprise !</small>' : fin ? '<b>ACHÈVE</b><small>coup de grâce</small>' : '<b>FRAPPE</b><small>combo · sprint = sauté</small>';
      btns.B.innerHTML = own ? (gkc ? '<b>DÉGAGER</b><small>loin devant</small>' : '<b>ESQUIVE</b><small>lève le ballon</small>') : '<b>TACLE</b><small>maintiens</small>';
      if (own && gkc) btns.A.innerHTML = '<b>RELANCE</b><small>maintiens = tir</small>';
      btns.D.classList.toggle('ready', own ? full && !far && !gkc : ki);
      btns.D.innerHTML = '<div class="ring"></div>' + (own ? (gkc ? '<b>DÉGAGER</b>' : full ? (far ? '<b>ULTIME</b><small>trop loin</small>' : '<b>ULTIME</b>') : '<b>SPÉCIAL</b><small>barre pleine</small>')
        : full ? '<b>RAYON</b><small>maintiens</small>' : ki ? '<b>KI</b><small>tap · maintiens</small>' : '<b>KI</b><small>maintiens = charger</small>');
      lastP = -1;
    }
    const p = Math.round(clamp(V.bar[me], 0, 1) * 50) / 50, s = Math.round(clamp(V.players[ci].stam, 0, 1) * 40) / 40;
    if (p !== lastP) { lastP = p; btns.D.style.setProperty('--p', p); }
    if (s !== lastS) { lastS = s; btns.C.style.setProperty('--p', s); }
  }

  // résolution adaptative : si le téléphone peine, on baisse la définition du canvas
  let pfT = 0, pfN = 0, pfSlow = 0;
  function perfWatch(dt) {
    if (document.hidden || dt <= 0 || dt >= 0.25) return; // (au-delà : onglet en pause, pas un problème de performance)
    pfT += dt; pfN++;
    if (pfT < 2) return;
    const avg = pfT / pfN; pfT = 0; pfN = 0;
    pfSlow = avg > 1 / 42 ? pfSlow + (avg > 1 / 25 ? 2 : 1) : 0; // très lent : on réagit dès la première mesure
    if (pfSlow < 2) return;
    pfSlow = 0;
    // on sacrifie d'abord le superflu : ULTRA → HAUTE, puis la définition, puis le pipeline GPU
    if (OPT.gfx === 'auto' && gfxAuto === 'ultra') { gfxAuto = 'high'; applyGfx(); }
    else if (dprCap > 1 && DPR > 1) { dprCap = Math.max(1, Math.min(dprCap, DPR) - 0.25); resize(); }
    else if (OPT.gfx === 'auto' && gfxAuto === 'high') { gfxAuto = 'perf'; applyGfx(); }
  }
  const PV = new Float32Array(27); let pvOk = false;
  function savePrev(w) {
    for (let i = 0; i < 8; i++) { const p = w.players[i]; PV[i * 3] = p.x; PV[i * 3 + 1] = p.y; PV[i * 3 + 2] = p.z; }
    const b = w.ball; PV[24] = b.x; PV[25] = b.y; PV[26] = b.z; pvOk = true;
  }
  function smoothView(V, a) {
    if (!pvOk) return;
    const L = (o, k, lim) => { const px = PV[k], py = PV[k + 1], pz = PV[k + 2]; if (len(o.x - px, o.y - py) > lim) return; o.x = px + (o.x - px) * a; o.y = py + (o.y - py) * a; o.z = pz + (o.z - pz) * a; };
    for (let i = 0; i < 8; i++) L(V.players[i], i * 3, 60);
    L(V.ball, 24, 120);
  }
  function demoStep(dt) {
    if (!app.demo || app.demo.phase === 'end') { app.demo = TF.newWorld({ human: [false, false], diff: 'normal' }); app.demo.phase = 'play'; app.demo.phaseT = 0; }
    acc += dt; let n = 0;
    while (acc >= STEP && n < 4) { savePrev(app.demo); TF.step(app.demo, STEP, null); n++; acc -= STEP; for (const e of app.demo.ev) fx(e, true); app.demo.ev.length = 0; }
    if (n === 4) acc = 0;
    const V = viewFromWorld(app.demo, demoV); smoothView(V, clamp(acc / STEP, 0, 1));
    return V;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    let V = null;
    if (app.drafting) V = demoStep(dt);
    else if (app.mode === 'solo' || app.mode === 'host') {
      const w = app.world;
      if (w && !app.paused && hitStop > 0) { hitStop -= dt; acc = 0; }
      else if (w && !app.paused) {
        acc += dt; let n = 0;
        const inputs = [readMove(), app.mode === 'host' ? NET.remoteIn : null];
        while (acc >= STEP && n < 5) {
          savePrev(w); TF.step(w, STEP, inputs); n++; acc -= STEP; app.tick++;
          if (w.ev.length) { for (const e of w.ev) { fx(e); if (app.mode === 'host') NET.pend.push(e); } w.ev.length = 0; }
          if (app.mode === 'host' && NET.connected && !w.paused && app.tick % 2 === 0) { send(snapshot(w, NET.pend)); NET.pend = []; }
        }
        if (n === 5) acc = 0;
      } else acc = 0;
      if (w) { V = viewFromWorld(w, hostV); smoothView(V, clamp(acc / STEP, 0, 1)); }
      if (app.mode === 'host' && NET.connected && !NET.lost && Date.now() - NET.lastRx > 4500) hostLost();
    } else if (app.mode === 'guest') {
      V = interpView(now);
      sendInput(now);
      const silence = Date.now() - NET.lastRx;
      if (NET.everConnected && !NET.reconnecting) {
        if (silence > 12000) guestStartReconnect();
        else if (silence > 4500 && !NET.silent) { NET.silent = true; showNetMsg('TON POTE NE RÉPOND PLUS', 'Il a peut-être quitté l\'appli… on patiente', true); }
        else if (silence < 1000 && NET.silent) { NET.silent = false; hideScr('netm'); }
      }
    } else V = demoStep(dt); // menu : match de démo IA vs IA en fond
    if (!app.ready) return;
    if (!V) { ctx = uictx; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, CW, CH); renderer.render(scene, camera); return; }
    const fdt = hitStop > 0 && app.mode !== 'guest' && app.mode !== 'menu' ? 0 : dt;
    perfWatch(dt);
    lastV = V; animRealDt = dt;
    myCtrl = app.mode !== 'menu' && !app.drafting ? app.myTeam * 4 + V.ctrl[app.myTeam] : -1;
    AU.slow(app.mode === 'menu' || app.drafting ? 1 : app.paused ? 0.3 : (V.ts || 1));
    if (app.mode !== 'menu' && !app.drafting) { // la musique monte avec l'enjeu ; le public chante de temps en temps
      MUS.inten = V.golden ? 1 : V.clock < 30 ? 0.85 : V.clock < 60 ? 0.6 : 0.35;
      if (V.phase === 'end' && MUS.mode === 'match') MUS.set('off');
      if (V.phase === 'play' && !V.golden && V.clock <= 5.2 && V.clock > 0) { const s5 = Math.ceil(V.clock); if (s5 !== lastTick) { lastTick = s5; AU.beep(s5 <= 1 ? 1320 : 880, 0.09); AU.kick(0.35); AU.call(String(s5)); shake(2); } }
      if (V.phase === 'play' && !app.paused) { chantT -= dt; if (chantT <= 0) { chantT = rnd2(22, 40); AU.chant(); } }
    }
    if (myCtrl >= 0 && V.phase === 'play' && !app.paused) { // ton joueur est en sang : son cœur cogne
      const dm = V.players[myCtrl].dmg || 0;
      if (dm >= 6.5) { hbT -= dt; if (hbT <= 0) { hbT = dm >= 8.5 ? 0.62 : 0.85; AU.heart(); } } else hbT = 0;
    }
    updFx(fdt * (V.ts || 1));
    updCam(V, dt);
    render(V, fdt);
    if (app.mode !== 'menu' && !app.drafting) {
      updButtons(V);
      if (V.phase === 'countdown') {
        const n = Math.ceil(V.phaseT - 0.2);
        if (n !== app.lastCount && n >= 1 && n <= 3) { app.lastCount = n; AU.beep(660, 0.14); AU.call(String(n)); }
      }
      if (V.phase === 'end') {
        if (!app.endShown) { app.endT += dt; if (app.endT > 3) { app.endShown = true; showEnd(V); } } // 3 s : on laisse le temps de voir la fête en 3D
      } else { app.endT = 0; if (app.endShown) { app.endShown = false; hideScr('end'); } }
    }
  }

  /* =============== DÉMARRAGE : polices, modèles, stade, personnages =============== */
  const bootBar = $('bootBar'), bootTxt = $('bootTxt');
  const step = (u, txt) => new Promise(res => { bootBar.style.width = Math.round(u * 100) + '%'; if (txt) bootTxt.textContent = txt; requestAnimationFrame(() => setTimeout(res, 0)); });
  async function boot() {
    if (!renderer) { bootTxt.textContent = 'WebGL indisponible : ce navigateur ne peut pas afficher le jeu en 3D.'; return; }
    applyGfx();
    await step(0.05, 'Chargement des polices…');
    try { await Promise.race([Promise.all([document.fonts.load('20px Anton'), document.fonts.load('italic 800 16px "Barlow Condensed"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* polices système */ }
    await step(0.1, 'Chargement des modèles 3D…');
    await loadModels(u => { bootBar.style.width = Math.round(10 + u * 45) + '%'; });
    skPrep(); // squelette des joueurs (si les modèles sont là)
    await step(0.58, 'Construction du stade…');
    buildStadium();
    await step(0.76, 'Les joueurs entrent sur la pelouse…');
    buildParticles(); buildBall(); buildGoals(); buildGuides();
    app.demo = TF.newWorld({ human: [false, false], diff: 'normal' }); app.demo.phase = 'play'; app.demo.phaseT = 0;
    setLooks(app.demo.picks); syncRigs();
    await step(0.9, 'Réglage des projecteurs…');
    applyGfx();
    try { renderer.compile(scene, camera); } catch (e) { /* compilation à la volée */ }
    await step(1, 'C\'est parti !');
    app.ready = true;
    $('boot').classList.add('off'); setTimeout(() => { $('boot').style.display = 'none'; }, 600);
  }
  const inv = (Q.get('code') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (inv.length === 4) { $('codeIn').value = inv; $('invite').classList.add('on'); }
  if (!location.protocol.startsWith('http')) $('netNote').textContent = 'Astuce : héberge le fichier en ligne pour pouvoir envoyer un lien à ton pote.';
  setTimeout(() => { loadPeer().catch(() => { $('netNote').textContent = 'Mode en ligne indisponible (pas de réseau). Le solo marche quand même !'; }); }, 800);
  boot().catch(e => { bootTxt.textContent = 'Erreur au démarrage : ' + (e && e.message || e); console.error(e); });
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });

  // exposé pour les tests automatisés
  window.__TF = { app, NET, LI, cam, press, startSolo, startHost, startGuest, toMenu, DR, portrait, poseShot, netBulge, OPT, applyGfx, snapshot, onSnap, setFlip, enterGame, scene, camera, renderer, RIGS, P2, get K() { return K; } };
})();
