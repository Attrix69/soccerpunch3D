  /* =============== EFFETS (événements de la simulation) =============== */
  const HITS = ['CRAC !', 'DÉTRUIT !', 'ÉCRASÉ !', 'BRUTAL !', 'DÉMOLI !', 'LAMINÉ !', 'BAM !'];
  const TRTXT = { coude: ['COUP DE COUDE !', '#ff6a3a'], tank: ['INARRÊTABLE !', '#ffd23a'], mur: ['LE MUR !', '#9fd3ff'], berserk: ['BERSERKER !', '#ff2a1e'],
    illusion: ['ILLUSION !', '#c7a6ff'], tentacules: ['TENTACULE !', '#7dff9a'], ventouse: ['VENTOUSE !', '#7dff9a'], sauterelle: ['SAUTERELLE !', '#7dff9a'],
    centre: ['CENTRE MILLIMÉTRÉ !', '#ffd23a'], encre: ['ENCRÉ !', '#c7a6ff'],
    blinde: ['BLINDÉ !', '#c6ff1a'], eclair: ['RELANCE ÉCLAIR !', '#3cc8ff'], poing: ['POINGS DE FER !', '#ff6a3a'], kamikaze: ['SORTIE KAMIKAZE !', '#ff2a1e'],
    transe: ['TRANSE !', '#c7a6ff'], hypnose: ['MAUVAIS ŒIL…', '#c7a6ff'], libero: ['LIBÉRO !', '#ff2fa0'], scorpion: ['SCORPION !', '#ffd23a'], laser: ['PASSE LASER !', '#3cc8ff'], renard: ['RENARD !', '#ff8a1a'], pickpocket: ['PICKPOCKET !', '#7dff9a'] };
  const SIGTXT = { tigre: ['FRAPPE DU TIGRE', '#ff9a00'], canon: ['BOULET DE CANON', '#ff5a1e'], lucarne: ['LUCARNE ROYALE', '#ffd23a'], comete: ['LA COMÈTE', '#7fd8ff'],
    tonnerre: ['DÉGAGEMENT TONNERRE', '#ffe14a'], faux: ['COUP DE FAUX', '#d6d0ff'] };
  const PUNCH = ['BAM !', 'PAF !', 'POW !', 'CLAC !'];
  /* ---------- fil des K.O., combos, multi-K.O. ---------- */
  const FEED = [], KOW = [], CMB = { n: 0, t: 0, pop: 0, tier: 0 };
  let celeTeam = -1; // équipe qui célèbre (but, fin de match) : les autres baissent la tête
  const FEEDW = { tackle: 'TACLE', assassin: 'TACLE ASSASSIN', combo: 'COMBO', patate: 'PATATE', boule: 'COUP DE BOULE', fly: 'FLY-KICK', beam: 'MÉGA RAYON', ki: 'BOULE DE KI',
    ball: 'BOULET', gk: 'TIR EN FEU', kamikaze: 'SORTIE KAMIKAZE', charge: "CHARGE D'ÉPAULE", clash: 'DUEL AÉRIEN', body: 'DOMINO', quake: 'SÉISME', zap: 'FOUDRE', stomp: 'COUP DE GRÂCE' };
  const TIERS = [[16, 'APOCALYPSE', '#ff1e1e'], [12, 'INHUMAIN', '#ff2a1e'], [8, 'BARBARE', '#ff5a1e'], [5, 'BRUTAL', '#ff8a1a'], [3, 'SAUVAGE', '#ffb400'], [2, 'COMBO', '#f1efe9']];
  const tierOf = n => { for (let k = 0; k < TIERS.length; k++) if (n >= TIERS[k][0]) return k; return -1; };
  function regHit(e) { // chaque coup porté par mon équipe nourrit le combo
    if (e.a !== app.myTeam || e.v === e.a) return;
    const now = performance.now();
    CMB.n = now - CMB.t < 1900 ? CMB.n + 1 : 1; CMB.t = now; CMB.pop = now;
    const tr = tierOf(CMB.n);
    if (tr >= 0 && tr < 5 && (CMB.tier < 0 || tr < CMB.tier)) { AU.beep(520 + (5 - tr) * 140, 0.09); if (tr === 4) AU.call('combo'); if (tr <= 2) AU.roar(0.5); MUS.boost = Math.min(0.6, MUS.boost + 0.25); }
    CMB.tier = tr;
  }
  function regKO(e, big) {
    regHit(e);
    if (e.b >= 0 && e.a !== e.v) VIO.ko[e.b]++;
    FEED.push({ a: e.b, v: e.id, w: FEEDW[e.kd] || 'K.O.', big: big || (e.d || 0) >= 7, t: 4.6 }); if (FEED.length > 4) FEED.shift();
    if (e.a < 0 || e.a === e.v) return;
    const now = performance.now();
    KOW.push([now, e.a]); while (KOW.length && now - KOW[0][0] > 2600) KOW.shift();
    const n = KOW.filter(k => k[1] === e.a).length;
    let down = 0; if (lastV) for (let j = 0; j < 4; j++) { const q = e.v * 4 + j; if (q === e.id || lastV.players[q].st === ST.down) down++; }
    const mine = e.a === app.myTeam;
    if (down >= 3 && now - (CMB.carn || 0) > 4000) { CMB.carn = now; showBanner('CARNAGE !', 'toute l\'équipe au tapis', '#ff1e1e', 1.5, 0.75, 0.3); AU.roar(1); AU.ooh(1.4); AU.call('multikill'); if (mine) vibe([60, 30, 60, 30, 150]); }
    else if (n >= 2) { showBanner(n >= 4 ? 'MASSACRE !' : n === 3 ? 'TRIPLE K.O. !' : 'DOUBLE K.O. !', '', mine ? '#ffd23a' : '#ff6a3a', 1.1, n >= 3 ? 0.68 : 0.58, 0.3); AU.roar(0.6 + n * 0.15); if (n >= 3) AU.call('multikill'); }
  }
  let lastV = null, animRealDt = 0.016, hbT = 0, hypeT = 0;
  function drawFeed() {
    if (!FEED.length) return;
    const xr = CW - 12 - SAFE.r, y0 = 50 + SAFE.t + ((app.mode === 'host' || app.mode === 'guest') ? 6 : 0), rh = 21, dt = animRealDt; // à droite, sous le score
    ctx.save(); ctx.textBaseline = 'middle';
    for (let k = FEED.length - 1; k >= 0; k--) { FEED[k].t -= dt; if (FEED[k].t <= 0) FEED.splice(k, 1); }
    FEED.forEach((f, k) => {
      const y = y0 + k * (rh + 3), al = clamp(f.t / 0.5, 0, 1), ent = clamp((4.6 - f.t) / 0.12, 0, 1);
      ctx.globalAlpha = al;
      const an = f.a >= 0 ? LK[f.a].name : '—', vn = LK[f.v] ? LK[f.v].name : '?';
      ctx.font = `italic 800 13px ${UIF}`;
      const w1 = ctx.measureText(an).width, w3 = ctx.measureText(vn).width;
      ctx.font = `12px ${FONT}`; const w2 = ctx.measureText(f.w).width + 14;
      const tw = w1 + w2 + w3 + 26, xo = xr - tw + (1 - ent) * 40;
      ctx.fillStyle = 'rgba(8,8,10,.82)'; para(xo, y, tw, rh, 6); ctx.fill();
      ctx.fillStyle = f.a >= 0 ? TEAMS[f.a >> 2].c1 : '#888'; ctx.fillRect(xo + 6, y + rh - 2, 3, 2);
      ctx.font = `italic 800 13px ${UIF}`; ctx.textAlign = 'left';
      ctx.fillStyle = f.a >= 0 ? TEAMS[f.a >> 2].c1 : '#a9adb5'; ctx.fillText(an, xo + 10, y + rh / 2 + 1);
      const bx = xo + 16 + w1;
      ctx.fillStyle = f.big ? '#d4111a' : '#3a3b42'; para(bx, y + 3, w2, rh - 6, 4); ctx.fill();
      ctx.font = `12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(f.w, bx + w2 / 2 + 2, y + rh / 2 + 1);
      ctx.font = `italic 800 13px ${UIF}`; ctx.textAlign = 'left'; ctx.fillStyle = TEAMS[f.v >> 2].c1; ctx.fillText(vn, bx + w2 + 6, y + rh / 2 + 1);
      if (f.big && GORE) { ctx.fillStyle = '#b10d12'; circ(bx + w2 + 8 + w3 + 6, y + rh / 2, 3); ctx.fill(); }
    });
    ctx.restore();
  }
  function drawCombo() {
    const now = performance.now(), age = now - CMB.t;
    if (CMB.n < 2 || age > 1900) { if (age > 1900) { CMB.n = 0; CMB.tier = -1; } return; }
    const tr = tierOf(CMB.n), T = TIERS[tr], pop = clamp((now - CMB.pop) / 140, 0, 1), sc = 1 + (1 - pop) * 0.45;
    const al = clamp((1900 - age) / 400, 0, 1), x = CW - 24 - SAFE.r, y = Math.max(CH * 0.3, 168 + SAFE.t), s = Math.min(CH * 0.11, 64) * sc;
    ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(-0.06); ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `${s | 0}px ${FONT}`; const txt = 'x' + CMB.n;
    ctx.fillStyle = '#000'; ctx.fillText(txt, s * 0.06, s * 0.07); ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = T[2]; ctx.fillText(txt, 0, 0);
    ctx.font = `${Math.max(14, s * 0.36) | 0}px ${FONT}`; ctx.lineWidth = 5; ctx.strokeText(T[1], 0, s * 0.42); ctx.fillStyle = '#f1efe9'; ctx.fillText(T[1], 0, s * 0.42);
    // jauge du délai de combo
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-s * 1.4, s * 0.55, s * 1.4, 4); ctx.fillStyle = T[2]; ctx.fillRect(-s * 1.4 * (1 - age / 1900), s * 0.55, s * 1.4 * (1 - age / 1900), 4);
    ctx.restore();
  }
  function fx(e, demo) {
    const me = app.myTeam, loud = !demo;
    fx3D(e, demo);
    switch (e.k) {
      case 'kick':
        if (e.i >= 0) { KSHOT[e.i] = performance.now() / 1000; UPK[e.i] = ''; }
        if (loud) AU.kick(0.45 + (e.p || 0) / 140);
        burst(e.x, e.y, 2, 4, { sp: 80, vz: 60, col: '#6a5a46', type: 'puff', size: 4, life: 0.4, g: 0 });
        turf(e.x, e.y, 3, 120);
        break;
      case 'pass': if (loud) AU.kick(0.3); break;
      case 'super': {
        if (e.i >= 0) { KSHOT[e.i] = performance.now() / 1000; UPK[e.i] = e.uk && UPOSE_K[e.uk] ? e.uk : ''; }
        { // la frappe déchire l'air : onde de choc, éclair de lumière, la caméra suit le boulet
          const c = e.uk ? (UCOL[e.uk] || UCOL.upper)[0] : e.u ? '#ff2a3a' : (SIGTXT[e.sig] ? SIGTXT[e.sig][1] : '#ff8a1a');
          shockAt(e.x, e.y, 20, e.uk ? 0.03 : 0.02, e.uk ? 0.75 : 0.55, e.uk ? 0.55 : 0.4); flashLight(e.x, e.y, 20, c, e.uk ? 0.5 : 0.36, e.uk ? 1.7 : 1.2, e.uk ? 0.55 : 0.35);
          chromaP = Math.max(chromaP, e.uk ? 1.6 : 1); if (!demo) camShot('ult', 0, 0, e.uk ? 1.12 : 1.06, e.uk ? 2.4 : 0.9, e.uk ? 4 : 3);
        }
        if (e.uk) { // ULTIME propre au joueur
          ultStart(e, loud);
          if (loud) { AU.whoosh(true); vibe(e.t === me ? [30, 20, 90] : 50); AU.roar(0.7); AU.duck(0.7, 1.2); }
          flash = 0.85; stop(0.16); shake(20);
          burst(e.x, e.y, 12, 8, { sp: 120, vz: 80, col: '#1c1a1a', type: 'smoke', size: 7, life: 0.9, g: -40 }); turf(e.x, e.y, 8, 200);
          break;
        }
        const sg = SIGTXT[e.sig], col = e.u ? '#ff1e2e' : sg ? sg[1] : '#ff8a1a';
        if (e.sig === 'tigre') burst(e.x, e.y, 14, 18, { sp: 260, vz: 160, col: ['#ff8a00', '#111', '#ffb000', '#111'], type: 'fire', size: 6, life: 0.55, g: 120 }); // rayures du tigre
        if (e.sig === 'comete') burst(e.x, e.y, 14, 16, { sp: 220, vz: 260, col: ['#bff4ff', '#7fd8ff', '#fff'], type: 'fire', size: 5, life: 0.6, g: -60 });
        if (loud) { AU.whoosh(e.u); AU.boom(0.8); if (e.sig === 'tigre' || e.sig === 'canon') AU.roar(1); showBanner(e.u ? 'TIR ULTIME' : sg ? sg[0] : 'SUPER TIR', e.n, col, 1.3, 0.62, 0.26); vibe(e.t === me ? [30, 20, 70] : 40); AU.roar(0.6); flash = 0.8; flashCol = e.u ? '255,40,40' : '255,160,60'; }
        stop(e.u ? 0.14 : 0.09);
        shake(e.u ? 18 : 12);
        burst(e.x, e.y, 10, 26, { sp: 340, vz: 200, col: e.u ? ['#ff1e2e', '#ffffff', '#ff6070'] : ['#ffd23a', '#ff6a00', '#ff1e1e'], type: 'fire', size: 7, life: 0.5, g: 200 });
        burst(e.x, e.y, 12, 8, { sp: 120, vz: 80, col: '#1c1a1a', type: 'smoke', size: 7, life: 0.9, g: -40 });
        impact(e.x, e.y, 12, 70); ring(e.x, e.y, col, 80); turf(e.x, e.y, 8, 200);
        break;
      }
      case 'quake': { // SÉISME / la météorite de l'UPPERCUT
        shockAt(e.x, e.y, 0, 0.03, 0.6, e.m ? 0.55 : 0.45); flashLight(e.x, e.y, 10, e.m ? '#ff9a3c' : '#ffd08a', 0.42, 1.4, 0.45); chromaP = Math.max(chromaP, 1);
        if (loud) { AU.boom(1.2); AU.crunch(0.8); vibe(60); }
        crackMark(e.x, e.y, e.r * 1.1); ring(e.x, e.y, '#d9b27a', e.r * 1.4); ring(e.x, e.y, '#fff1d6', e.r);
        burst(e.x, e.y, 4, 20, { sp: 320, vz: 260, col: ['#7a6248', '#5a4a36', '#9a8466'], type: 'puff', size: 10, life: 0.9, g: 300 });
        turf(e.x, e.y, 16, 320); shake(e.m ? 24 : 16); stop(0.08);
        floatTxt(e.x, e.y, 70, e.m ? 'MÉTÉORITE !' : 'BOOM !', '#ffd08a', 30);
        if (e.m) burst(e.x, e.y, 10, 26, { sp: 360, vz: 300, col: ['#ff9a3c', '#ffd23a', '#fff'], type: 'fire', size: 8, life: 0.6, g: 400 });
        break;
      }
      case 'zap': { // un éclair à chaque virage du MARTEAU DE THOR
        flashLight(e.x, e.y, 60, '#b8e4ff', 0.5, 1.8, 0.28); shockAt(e.x, e.y, 0, 0.012, 0.35, 0.3);
        if (loud) { AU.nz('highpass', 5000, 900, 0.3, 0.6); AU.boom(0.8); }
        spawn({ x: e.x, y: e.y, z: 0, vx: 0, vy: 0, vz: 0, g: 0, life: 0.28, max: 0.28, size: 1, col: '#fff', type: 'bolt', pts: boltPts(e.x, e.y), rot: 0, vr: 0 });
        ring(e.x, e.y, '#6fb8ff', 90); burst(e.x, e.y, 5, 18, { sp: 300, vz: 200, col: ['#fff', '#6fb8ff', '#b8e4ff'], type: 'spark', size: 3, life: 0.35 });
        crackMark(e.x, e.y, 50, '#0c1a2a'); flash = 0.45; flashCol = '170,215,255'; shake(12);
        break;
      }
      case 'ruse': { // la feinte : un leurre continue tout droit
        if (loud) AU.swish(1);
        floatTxt(e.x, e.y, 70, 'FEINTE !', '#ff8a3d', 28);
        if (UL) { const dx = e.x - UL.sx, dy = e.y - UL.sy, d = len(dx, dy) || 1; spawn({ x: e.x, y: e.y, z: 25, vx: dx / d * 1300, vy: dy / d * 1300, vz: 0, g: 0, life: 0.45, max: 0.45, size: 1, col: '#fff', type: 'fake', rot: 0, vr: 0 }); }
        burst(e.x, e.y, 25, 10, { sp: 160, vz: 80, col: ['#ff8a3d', '#fff'], type: 'spark', size: 3, life: 0.3 });
        break;
      }
      case 'pounce': // le bond final des GRIFFES DU TIGRE
        if (loud) AU.roar(1);
        floatTxt(e.x, e.y, 70, 'RAAAH !', '#ff9000', 30); ring(e.x, e.y, '#ff9000', 80);
        burst(e.x, e.y, 10, 16, { sp: 260, vz: 220, col: ['#ff9000', '#111', '#ffb000'], type: 'fire', size: 6, life: 0.45, g: 200 });
        break;
      case 'slide':
        if (loud) AU.swish(0.7 + (e.c || 0) / 200);
        turf(e.x, e.y, 6, 140);
        break;
      case 'hit': {
        const big = e.kd === 'fly' || e.kd === 'gk' || e.kd === 'kamikaze' || e.kd === 'beam' || e.kd === 'combo' || e.kd === 'assassin' || e.kd === 'patate' || e.kd === 'boule' || e.kd === 'charge' || e.f > 480;
        const real = e.kd !== 'gkp';
        if (loud) {
          AU.boom(0.6 + e.f / 600); AU.crunch(big ? 1 : 0.6); AU.flesh(0.7 + e.f / 900);
          if (real && (big || e.d >= 5)) AU.bone(big ? 1.1 : 0.8);
          if (real) AU.voice(big || e.d >= 6 ? 'ko' : 'hurt', LK[e.id] ? 1.08 / LK[e.id].b[0] : 1, 0.3);
          if (e.v === me) vibe(big ? [90, 30, 170] : [60, 30, 110]); else if (e.a === me) vibe(big ? 55 : 35);
          if (big) { AU.roar(0.6); AU.ooh(e.d >= 7 ? 1.25 : 0.9); AU.duck(0.55, 0.45); }
        }
        if (big) hypeT = performance.now() + 1200;
        const txt = e.kd === 'kamikaze' ? 'DÉCOUPÉ !' : e.kd === 'assassin' ? 'TACLE ASSASSIN !' : e.kd === 'patate' ? 'PATATE DE FORAIN !' : e.kd === 'boule' ? 'COUP DE BOULE !' : e.kd === 'charge' ? 'CHARGE DU BULLDOZER !' : e.kd === 'clash' ? 'DUEL AÉRIEN !' : e.kd === 'fly' ? 'K.O. !' : e.kd === 'gk' ? 'GARDIEN K.O. !' : e.kd === 'ball' ? 'SMASH !' : e.kd === 'gkp' || e.kd === 'body' ? '' : e.kd === 'combo' ? 'COMBO K.O. !' : e.kd === 'ki' ? 'BOOM !' : e.kd === 'beam' ? 'PULVÉRISÉ !' : pick(HITS);
        if (txt) floatTxt(e.x, e.y, 60, (e.d >= 7 && R() < 0.5) ? pick(['EN SANG !', 'MASSACRE !', 'DÉFIGURÉ !']) : txt, big || e.d >= 7 ? '#ff2a1e' : '#f1efe9', big ? 34 : 26);
        bleed(e, big ? 1.4 : 1);
        if (real) {
          stop(big ? 0.15 : 0.07); hitFlash(e.id, big ? 0.16 : 0.1); SQ[e.id] = big ? -0.2 : -0.12;
          flashLight(e.x, e.y, 30, big ? '#ffe2c0' : '#fff6e8', big ? 0.26 : 0.15, big ? 1.1 : 0.55, big ? 0.24 : 0.14);
          if (big) { shockAt(e.x, e.y, 30, 0.014, 0.45, 0.32); chromaP = Math.max(chromaP, 1); if (!demo) camShot('ko', e.x, e.y, 1.16, 0.55, 2); }
          if (big) { flash = 0.55; flashCol = '255,30,20'; zblur(e.x, e.y, 0.24); }
          if (big || e.d >= 4) { if (R() < 0.75) teeth(e, big && R() < 0.5 ? 2 : 1); }
          spit(e, big ? 10 : 5);
          kick(e.dx, e.dy, (big ? 15 : 6 + e.f / 110) * (loud ? 1 : 0.4));
          if ((big || e.d >= 5) && e.a >= 0 && !demo) VIO.bones[e.a]++;
        }
        burst(e.x, e.y, 25, big ? 24 : 14, { sp: big ? 400 : 270, vz: 220, col: ['#fff', '#ffd23a', '#ff6a00'], type: 'spark', size: 3, life: 0.4 });
        burst(e.x, e.y, 20, big ? 6 : 3, { sp: 70, vz: 40, col: '#3a3430', type: 'smoke', size: 6, life: 0.7, g: -30 });
        turf(e.x, e.y, big ? 12 : 7, 220);
        impact(e.x, e.y, 28, big ? 80 : 55);
        ring(e.x, e.y, big ? '#ff2a1e' : '#fff', big ? 70 : 46);
        shake(big ? 10 : 3 + e.f / 110);
        dirty(e.id, 0.08);
        if (!demo && real) regKO(e, big);
        if (loud && GORE > 1 && real) { if (e.id === myCtrl && (big || e.d >= 6)) screenBlood(big ? 3 : 2); else if (e.b === myCtrl && big && e.d >= 5 && R() < 0.6) screenBlood(1, 0.65); }
        break;
      }
      case 'thud': { // un corps qui retombe lourdement
        const v = clamp((e.v - 150) / 500, 0, 1), first = !e.n;
        if (loud) { AU.thud((0.3 + v * 0.8) * (first ? 1 : 0.6)); if (first && e.id >= 0 && v > 0.45) AU.voice('hurt', LK[e.id] ? 0.95 / LK[e.id].b[0] : 0.9, 0.2); if (first && e.id === myCtrl) vibe(40); }
        burst(e.x, e.y, 2, (3 + v * 9) | 0, { sp: 90 + 140 * v, vz: 50, col: ['#5a4a36', '#6a5a46', '#4a4034'], type: 'puff', size: 6, life: 0.6, g: 0 });
        turf(e.x, e.y, (2 + v * 9) | 0, 110 + 160 * v);
        if (first) { shake(1 + v * 4); if (e.id >= 0) { kick(0, 1, (2 + v * 6) * (loud ? 1 : 0.4)); SQ[e.id] = 0.18 + 0.15 * v; } if (v > 0.5) shockAt(e.x, e.y, 0, 0.006, 0.3, 0.18); }
        dirty(e.id, 0.1 + 0.12 * v);
        break;
      }
      case 'slam': { // encastré dans le muret
        const v = clamp(e.v / 600, 0.4, 1.2);
        if (loud) { AU.slam(v); AU.bone(0.9); AU.voice('ko', LK[e.id] ? 1 / LK[e.id].b[0] : 1, 0.3); AU.ooh(1.1); AU.roar(0.5); vibe(e.id === myCtrl ? [90, 40, 140] : 40); }
        floatTxt(e.x, e.y, 56, pick(['ENCASTRÉ !', 'DANS LE DÉCOR !', 'CONTRE LE MURET !']), '#ff6a3a', 30);
        bleed(e, 1); hitFlash(e.id, 0.13); stop(0.1); shake(9); SQ[e.id] = 0.3; shockAt(e.x, e.y, 20, 0.014, 0.4, 0.3); flashLight(e.x, e.y, 20, '#ffffff', 0.22, 0.9, 0.18); chromaP = Math.max(chromaP, 0.8); kick(-(e.dx || 0), -(e.dy || 0), 13 * (loud ? 1 : 0.4)); zblur(e.x, e.y, 0.18);
        burst(e.x, e.y, 20, 14, { sp: 260, vz: 200, col: ['#9a9a9a', '#c9ccd2', '#5a5e66', '#fff'], type: 'spark', size: 3, life: 0.45 });
        burst(e.x, e.y, 18, 8, { sp: 110, vz: 70, col: '#7a7a80', type: 'smoke', size: 9, life: 1, g: -30 });
        impact(e.x, e.y, 30, 72); ring(e.x, e.y, '#ff6a3a', 60);
        if (!demo && e.a >= 0) VIO.bones[e.a]++;
        if (loud && GORE > 1 && e.id === myCtrl) screenBlood(2);
        break;
      }
      case 'stomp': { // COUP DE GRÂCE
        if (loud) { AU.duck(0.6, 0.5); AU.thud(1); AU.flesh(1.1); AU.bone(1.15); AU.crunch(0.9); AU.voice('ko', LK[e.id] ? 1.05 / LK[e.id].b[0] : 1, 0.34); AU.ooh(1.2); AU.roar(0.7); vibe(e.a === me ? [40, 20, 100] : e.v === me ? [100, 30, 160] : 30); }
        floatTxt(e.x, e.y, 52, pick(['COUP DE GRÂCE !', 'ACHEVÉ !', 'PIÉTINÉ !', 'SANS PITIÉ !']), '#ff2a1e', 32); hypeT = performance.now() + 1400;
        bleed({ x: e.x, y: e.y, d: Math.max(e.d || 0, 3), dx: e.dx, dy: e.dy, a: e.a }, 1.5);
        hitFlash(e.id, 0.15); stop(0.14); shake(8); SQ[e.id] = 0.32; shockAt(e.x, e.y, 0, 0.018, 0.5, 0.36); flashLight(e.x, e.y, 10, '#ff5a3a', 0.3, 1.2, 0.3); chromaP = Math.max(chromaP, 1.2);
        if (!demo) camShot('ko', e.x, e.y, 1.2, 0.7, 3); kick(0, 1, 14 * (loud ? 1 : 0.4)); zblur(e.x, e.y, 0.2);
        flash = Math.max(flash, 0.4); flashCol = '255,30,20';
        impact(e.x, e.y, 6, 72); ring(e.x, e.y, '#ff2a1e', 64); crackMark(e.x, e.y, 44, '#2a0c08'); turf(e.x, e.y, 12, 240);
        burst(e.x, e.y, 4, 10, { sp: 160, vz: 70, col: ['#5a4a36', '#6a5a46'], type: 'puff', size: 7, life: 0.6, g: 0 });
        teeth({ x: e.x, y: e.y, dx: e.dx, dy: e.dy }, R() < 0.5 ? 2 : 1);
        dirty(e.id, 0.2);
        if (!demo) { VIO.gr[e.a] = (VIO.gr[e.a] || 0) + 1; VIO.bones[e.a]++; regKO(Object.assign({ kd: 'stomp' }, e), true); }
        if (loud && GORE > 1) { if (e.id === myCtrl) screenBlood(2); else if (e.b === myCtrl) screenBlood(1, 0.7); }
        break;
      }
      case 'domino': floatTxt(e.x, e.y, 66, pick(['STRIKE !', 'DOMINO !', 'BOWLING !']), '#ffd23a', 30); if (loud) { AU.ooh(0.9); AU.roar(0.5); } break;
      case 'net': floatTxt(e.x, e.y, 60, 'AU FOND DES FILETS !', '#f1efe9', 28); if (loud) { AU.roar(0.9); AU.ooh(1); AU.nz('bandpass', 900, 380, 0.45, 0.35, 1); } shake(5); break;
      case 'swing': if (loud) { AU.swish(0.35 + e.n * 0.12); if (e.n === 3 && R() < 0.55) AU.voice('eff', 1.05, 0.18); } break;
      case 'punch': {
        if (loud) { AU.punch(e.n); AU.flesh(0.45 + e.n * 0.22); if (e.n >= 2 || R() < 0.35) AU.voice('hurt', LK[e.id] ? 1.1 / LK[e.id].b[0] : 1, 0.22); if (e.hv) AU.bone(0.55); if (e.v === me) vibe(40); else if (e.a === me) vibe(15); }
        hitFlash(e.id, 0.07 + e.n * 0.015); spit(e, 3 + e.n * 2); kick(e.dx, e.dy, (3 + e.n * 2.2) * (loud ? 1 : 0.4));
        if (e.n >= 2 && (e.d || 0) >= 3 && R() < 0.35) teeth(e, 1);
        if (!demo) regHit(e);
        floatTxt(e.x, e.y, 58, pick(PUNCH), e.hv ? '#ff6a3a' : e.n === 2 ? '#ffb400' : '#f1efe9', 22 + e.n * 3 + (e.hv ? 5 : 0));
        if (e.hv) shake(4);
        bleed(e);
        burst(e.x, e.y, 40, 8, { sp: 220, vz: 160, col: ['#fff', '#ffd23a'], type: 'spark', size: 2.5, life: 0.3 });
        impact(e.x, e.y, 42, 34 + e.n * 8); shake(3 + e.n * 2); stop(0.035 + e.n * 0.01);
        break;
      }
      case 'kiball': {
        if (loud) AU.kiball();
        const c = KICOL[e.t];
        burst(e.x, e.y, 30, 10, { sp: 160, vz: 80, col: [c[0], c[1], '#fff'], type: 'fire', size: 5, life: 0.3, g: 0 });
        break;
      }
      case 'kiboom': {
        flashLight(e.x, e.y, 30, KICOL[e.t][1], 0.3, 1.3, 0.3); shockAt(e.x, e.y, 30, 0.009, 0.35, 0.22);
        if (loud) { AU.boom(0.7); AU.crunch(0.5); }
        const c = KICOL[e.t];
        burst(e.x, e.y, 30, 22, { sp: 300, vz: 220, col: [c[0], c[1], c[2], '#fff'], type: 'fire', size: 7, life: 0.45, g: 300 });
        burst(e.x, e.y, 30, 5, { sp: 80, vz: 60, col: '#2a2626', type: 'smoke', size: 8, life: 0.8, g: -40 });
        ring(e.x, e.y, c[1], 70); impact(e.x, e.y, 30, 60); turf(e.x, e.y, 6, 200); shake(7);
        break;
      }
      case 'kifade': burst(e.x, e.y, 30, 6, { sp: 60, vz: 40, col: KICOL[e.t][1], type: 'fire', size: 4, life: 0.3, g: 0 }); break;
      case 'charge': if (loud) AU.charge(); ring(e.x, e.y, KICOL[e.t][1], 50); break;
      case 'beamready': if (loud && e.t === me) { AU.beep(1320, 0.1); floatTxt(e.x, e.y, 95, 'PRÊT !', '#ffd23a', 22); } break;
      case 'beam': {
        shockAt(e.x, e.y, 30, 0.024, 0.6, 0.5); flashLight(e.x, e.y, 30, KICOL[e.t][0], 0.45, 1.6, 0.5); chromaP = Math.max(chromaP, 1.4);
        if (!demo) camShot('ko', e.x, e.y, 1.08, 0.6, 2);
        const c = KICOL[e.t];
        if (loud) { AU.beam(); AU.roar(0.9); showBanner('MÉGA RAYON', e.n, c[1], 1.1, 0.5, 0.24); vibe(e.t === me ? [40, 30, 140] : 120); flash = 0.85; flashCol = e.t ? '255,140,40' : '120,220,255'; }
        shake(18); stop(0.1);
        break;
      }
      case 'nokki': if (loud && e.t === me) floatTxt(e.x, e.y, 80, 'PAS ASSEZ DE KI', '#8a8f99', 18); break;
      case 'post':
        if (loud) AU.post();
        floatTxt(e.x, e.y, e.z || 50, 'POTEAU !', '#f1efe9', 26); shake(6);
        burst(e.x, e.y, e.z || 50, 12, { sp: 220, col: ['#fff', '#ffd23a'], type: 'spark', life: 0.35 });
        break;
      case 'wall': if (loud) AU.wall(e.v); break;
      case 'save':
        if (loud) { AU.grab(); if (e.ul) { AU.boom(1); AU.roar(1); } }
        floatTxt(e.x, e.y, 70, e.ul ? 'ULTIME STOPPÉ !' : e.big ? 'PARADE !' : 'ARRÊT !', e.ul ? '#c6ff1a' : '#9fd3ff', e.ul ? 32 : 24);
        if (e.ul) { shake(14); flash = 0.6; flashCol = '200,255,60'; ring(e.x, e.y, '#c6ff1a', 90); }
        break;
      case 'deflect': if (loud) AU.kick(0.35); floatTxt(e.x, e.y, 55, 'CONTRÉ !', '#9fd3ff', 22); break;
      case 'dodge': { // ESQUIVE PARFAITE : le coup passe dans le vide
        const mine = e.id >= 0 && e.id === myCtrl && e.pf;
        if (loud) { AU.whoosh(false); AU.swish(1); if (mine) { AU.beep(1320, 0.07); vibe(20); } }
        floatTxt(e.x, e.y, 64, mine ? 'ESQUIVE PARFAITE !' : 'ESQUIVÉ !', '#7dff9a', mine ? 28 : 22);
        ring(e.x, e.y, '#7dff9a', 60); burst(e.x, e.y, 30, 10, { sp: 200, vz: 80, col: ['#7dff9a', '#ffffff', '#3cc8ff'], type: 'spark', size: 2.5, life: 0.35 });
        flashLight(e.x, e.y, 30, '#7dff9a', 0.22, 0.8, 0.25);
        if (mine) { flash = Math.max(flash, 0.25); flashCol = '120,255,170'; }
        break;
      }
      case 'tr': {
        const t = TRTXT[e.s]; if (!t) break;
        floatTxt(e.x, e.y, 72, t[0], t[1], e.s === 'berserk' || e.s === 'mur' || e.s === 'tank' || e.s === 'scorpion' || e.s === 'kamikaze' ? 26 : 22);
        if (e.id >= 0 && GKPD[e.s]) GKP[e.id] = [e.s, performance.now() / 1000];
        switch (e.s) { // spécialités des gardiens
          case 'blinde': if (loud) { AU.punch(2); AU.boom(0.7); } shake(8); burst(e.x, e.y, 40, 16, { sp: 260, vz: 160, col: ['#fff', '#c6ff1a', '#ffd23a'], type: 'spark', size: 3, life: 0.35 }); ring(e.x, e.y, '#c6ff1a', 70); break;
          case 'poing': if (loud) { AU.punch(2); AU.kick(0.7); } shake(6); impact(e.x, e.y, 60, 50); burst(e.x, e.y, 60, 10, { sp: 220, vz: 120, col: ['#fff', '#ff6a3a'], type: 'spark', size: 2.5, life: 0.3 }); break;
          case 'scorpion': if (loud) { AU.swish(1); AU.kick(0.7); } shake(6); impact(e.x, e.y, 70, 56); burst(e.x, e.y, 70, 12, { sp: 220, vz: 200, col: ['#ffd23a', '#fff'], type: 'spark', size: 2.5, life: 0.35 }); break;
          case 'kamikaze': if (loud) { AU.roar(0.7); AU.swish(0.9); } shake(5); burst(e.x, e.y, 0, 8, { sp: 120, vz: 60, col: '#5a4a36', type: 'puff', size: 6, life: 0.5, g: 0 }); break;
          case 'hypnose': {
            if (loud) { AU.osc('sine', 260, 820, 0.7, 0.14); AU.osc('sine', 390, 1230, 0.7, 0.08, 0.05); }
            HYPT = performance.now() + 1400; const bx = e.bx || e.x, by = e.by || e.y;
            for (let k = 0; k < 3; k++) spawn({ x: bx, y: by, z: 30, vx: 0, vy: 0, vz: 0, g: 0, life: 0.5 + k * 0.15, max: 0.5 + k * 0.15, size: 50 + k * 20, col: k % 2 ? '#c7a6ff' : '#7a3cff', type: 'ring', rot: 0, vr: 0 });
            break;
          }
          case 'transe': if (loud) { AU.beep(880, 0.08); AU.beep(1320, 0.1); } burst(e.x, e.y, 50, 10, { sp: 120, vz: 160, col: ['#c7a6ff', '#7a3cff', '#fff'], type: 'fire', size: 4, life: 0.6, g: -60 }); break;
          case 'eclair': if (loud) AU.swish(0.9); break;
          case 'libero': if (loud) { AU.roar(0.5); AU.swish(0.7); } break;
        }
        if (e.s === 'sauterelle' && e.id >= 0) HOP[e.id] = 0.32;
        if (loud) { if (e.s === 'mur' || e.s === 'coude' || e.s === 'tank') { AU.punch(2); shake(5); } else if (e.s === 'berserk') AU.roar(0.8); else AU.swish(0.6); }
        if (e.s === 'mur') burst(e.x, e.y, 30, 10, { sp: 200, vz: 120, col: ['#fff', '#9fd3ff'], type: 'spark', size: 2.5, life: 0.3 });
        break;
      }
      case 'punt':
        if (loud) { AU.kick(e.ob ? 1 : 0.75); AU.whoosh(false); if (e.ob) AU.boom(0.6); }
        floatTxt(e.x, e.y, 70, e.ob ? 'DÉGAGEMENT OBUS !' : 'DÉGAGEMENT !', e.ob ? '#c6ff1a' : '#9fd3ff', e.ob ? 26 : 24); turf(e.x, e.y, 4, 120);
        if (e.ob) { OBT = performance.now() + 1100; shake(7); burst(e.x, e.y, 24, 14, { sp: 260, vz: 120, col: ['#c6ff1a', '#ffd23a', '#fff'], type: 'fire', size: 6, life: 0.4, g: 100 }); }
        break;
      case 'ultfar': if (e.t === me) { floatTxt(e.x, e.y, 80, 'ULTIME : TROP LOIN !', '#8a8f99', 20); if (loud) AU.beep(220, 0.12); } break;
      case 'flick':
        if (loud) { AU.swish(0.8); AU.kick(0.25); }
        floatTxt(e.x, e.y, 70, 'SOMBRERO !', '#fff6c0', 24);
        turf(e.x, e.y, 3, 90);
        break;
      case 'aerialGo': if (loud) AU.swish(e.h ? 0.5 : 0.7); if (e.h) burst(e.x, e.y, 0, 5, { sp: 90, vz: 30, col: '#5a4a36', type: 'puff', size: 4, life: 0.4, g: 0 }); break;
      case 'aerial': {
        if (e.id >= 0) AHIT[e.id] = 1;
        const fire = e.s, head = e.h;
        if (loud) {
          AU.kick(head ? 0.45 + e.q / 400 : 0.6 + e.q / 250);
          if (fire) { AU.whoosh(false); AU.boom(0.7); AU.roar(e.bf ? 1 : 0.5); showBanner(e.bf ? 'COUP DE TÊTE DU BUFFLE' : e.a ? 'CISEAU ACROBATIQUE' : 'REPRISE DE VOLÉE', e.n, e.bf ? '#ff5a1e' : '#ffd23a', 1.1, 0.55, 0.26); vibe(e.t === me ? [25, 20, 60] : 30); flash = 0.6; flashCol = '255,190,60'; }
          else if (e.t === me) vibe(head ? 20 : 25);
        }
        const txt = !e.g ? (head ? 'DÉGAGEMENT DE LA TÊTE !' : e.a ? 'DÉGAGÉ EN CISEAU !' : 'DÉGAGÉ !') : head ? (fire ? '' : e.bf ? 'TÊTE DU BUFFLE !' : e.q > 70 ? 'COUP DE TÊTE !' : 'TÊTE !') : fire ? '' : e.a ? 'CISEAU !' : (e.q > 70 ? 'REPRISE !' : 'VOLÉE !');
        if (txt) floatTxt(e.x, e.y, Math.max(70, (e.z || 0) + 25), txt, !e.g ? '#9fd3ff' : e.q > 70 ? '#ffd23a' : '#f1efe9', !e.g ? 20 : 24);
        burst(e.x, e.y, e.z || 40, fire ? 18 : 7, { sp: fire ? 300 : 160, vz: 120, col: fire ? ['#ffd23a', '#ff6a00', '#fff'] : ['#fff', '#ffd23a'], type: fire ? 'fire' : 'spark', size: fire ? 6 : 2.5, life: 0.35, g: 100 });
        impact(e.x, e.y, e.z || 40, fire ? 64 : 36);
        if (fire) { stop(0.09); shake(10); ring(e.x, e.y, '#ffd23a', 70); } else { stop(0.04); shake(head ? 3 : 4); }
        break;
      }
      case 'feint':
        if (loud) AU.swish(0.6);
        burst(e.x, e.y, 15, 8, { sp: 120, vz: 30, col: '#8a8f99', type: 'puff', size: 5, life: 0.35, g: 0 });
        break;
      case 'fly':
        if (loud) { AU.whoosh(false); AU.roar(0.4); }
        floatTxt(e.x, e.y, 80, 'FLY-KICK !', '#ff2a1e', 28); shake(5);
        break;
      case 'land': turf(e.x, e.y, 5, 120); burst(e.x, e.y, 0, 6, { sp: 110, vz: 40, col: '#5a4a36', type: 'puff', size: 5, life: 0.5, g: 0 }); break;
      case 'dive': if (loud) AU.swish(0.5); turf(e.x, e.y, 3, 100); break;
      case 'goal': {
        if (loud) AU.duck(0.85, 2.2);
        netBulge(e.x < W / 2 ? 0 : 1, e.y, lastV ? lastV.ball.z : 30);
        { const gx = e.x < W / 2 ? -GD / 2 : W + GD / 2;
          shockAt(gx, e.y, 40, 0.034, 0.9, 0.7); chromaP = Math.max(chromaP, 1.3);
          for (const gy of [MT - 30, MB + 30]) flashLight(gx, gy, 40, '#ff8a2a', 0.55, 1.5, 1.6);
          flashLight(gx, e.y, 40, '#ffffff', 0.6, 2, 0.4);
          if (!demo) camShot('goal', e.x < W / 2 ? 120 : W - 120, e.y, 1.16, 2.4, 5); celeTeam = e.t; }
        const mine = e.t === me, T = TEAMS[e.t];
        if (loud) {
          AU.goal();
          const sub = e.own ? 'contre son camp de ' + e.n : (e.n ? 'pour ' + e.n : '');
          showBanner(e.own ? 'CSC !' : 'BUUUUT !', sub, T.c1, 2.4);
          vibe(mine ? [100, 60, 100, 60, 250] : 300); flash = 0.9; flashCol = '255,255,255';
        }
        shake(16);
        // pyrotechnie derrière le but + confettis aux couleurs de l'équipe
        const gx = e.x < W / 2 ? -GD : W + GD;
        for (const gy of [MT - 30, MB + 30]) for (let k = 0; k < 14; k++) spawn({ x: gx, y: gy, z: 0, vx: rnd2(-20, 20), vy: rnd2(-10, 10), vz: rnd2(380, 620), g: 500, life: rnd2(0.6, 1), max: 1, size: rnd2(5, 9), col: pick(['#ff6a00', '#ffd23a', '#ff1e1e']), type: 'fire', rot: 0, vr: 0 });
        for (let k = 0; k < 4; k++) burst(e.x + rnd2(-20, 20), e.y + rnd2(-60, 60), 60, 20, { sp: 340, vz: 520, col: [T.c1, T.acc, T.c2], type: 'conf', size: 4, life: 2.2, g: 520 });
        break;
      }
      case 'whistle': // coup d'envoi : le stade explose
        if (loud) { AU.whistle(0); showBanner('GO !', '', '#ff2a1e', 0.8); AU.boom(0.7); AU.roar(0.7); AU.call('fight'); }
        if (!demo) { shockAt(W / 2, H / 2, 0, 0.02, 0.6, 0.6); kick(0, 1, 9); flashLight(W / 2, H / 2, 20, '#ffffff', 0.6, 0.9, 0.35); }
        break;
      case 'golden': if (loud) { AU.whistle(1); showBanner('BUT EN OR', 'le prochain but gagne', '#ffb400', 2.2); AU.roar(0.6); AU.call('suddendeath', 0.5); } break;
      case 'end': {
        if (loud) { AU.whistle(2); showBanner('TERMINÉ', '', '#f1efe9', 1.8); AU.roar(0.8); }
        if (!demo && lastV) { // la caméra va chercher les vainqueurs
          const wt = app.world ? app.world.winner : lastV.winner; celeTeam = wt;
          let x = 0, y = 0; for (let j = 0; j < 4; j++) { const q = lastV.players[(wt >= 0 ? wt : 0) * 4 + j]; x += q.x / 4; y += q.y / 4; }
          camShot('end', x, y, 1.24, 8, 6);
        }
        break;
      }
    }
  }

