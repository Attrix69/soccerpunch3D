  /* ---------- HUD ---------- */
  function fmtClock(s) { s = Math.max(0, Math.ceil(s)); return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); }
  const UIF = '"Barlow Condensed", "Arial Narrow", sans-serif';

  // blasons : la tête de loup, la tête de taureau
  function crest(t, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
    ctx.beginPath();
    if (t === 0) { ctx.moveTo(-9, -8); ctx.lineTo(-4, -3); ctx.lineTo(4, -3); ctx.lineTo(9, -8); ctx.lineTo(8, 2); ctx.lineTo(0, 10); ctx.lineTo(-8, 2); ctx.closePath(); }
    else { ctx.moveTo(-11, -9); ctx.quadraticCurveTo(-9, -1, -4, -2); ctx.lineTo(4, -2); ctx.quadraticCurveTo(9, -1, 11, -9); ctx.quadraticCurveTo(11, 1, 6, 2); ctx.lineTo(4, 9); ctx.lineTo(-4, 9); ctx.lineTo(-6, 2); ctx.quadraticCurveTo(-11, 1, -11, -9); ctx.closePath(); }
    ctx.fillStyle = INK; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(-4.5, 1, 3, 2); ctx.fillRect(1.5, 1, 3, 2); // les yeux
    ctx.restore();
  }
  const SCP = [0, 0], SCV = [0, 0]; // horodatage du dernier but de chaque équipe (le chiffre « pop »)
  function glass(x, y, w, h, sk, side) { // panneau incliné en verre fumé
    ctx.beginPath();
    if (!side) { ctx.moveTo(x + sk, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); }
    else { ctx.moveTo(x, y); ctx.lineTo(x + w - sk, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(34,35,40,.94)'); g.addColorStop(0.5, 'rgba(12,12,15,.94)'); g.addColorStop(1, 'rgba(6,6,8,.96)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + (side ? 0 : sk), y + 1, w - sk, 1);
  }
  function kiCells(x, y, w, v, col, side, now) { // le ki en trois crans : chaque cran = une boule de ki
    const cw = (w - 8) / 3, full = v >= 1;
    for (let k = 0; k < 3; k++) {
      const kk = side ? 2 - k : k, f = clamp(v * 3 - kk, 0, 1), X = x + k * (cw + 4);
      ctx.fillStyle = 'rgba(255,255,255,.1)'; para(X, y, cw, 6, 3); ctx.fill();
      if (f > 0) {
        ctx.fillStyle = full ? ((now / 110 | 0) % 2 ? '#ffffff' : '#ffb400') : f >= 1 ? col : shade(hx(col, '#ffffff'), 0.7);
        const fw = cw * f; para(side ? X + cw - fw : X, y, fw, 6, 3); ctx.fill();
      }
    }
  }
  function drawHUD(V) {
    const L = cam.flip === 1 ? 0 : 1, Rt = 1 - L, now = performance.now();
    const w = Math.min(430, CW * 0.58), h = 38, y = 6 + SAFE.t, cx = CW / 2, cw = 70, pw = (w - cw) / 2;
    ctx.textBaseline = 'middle';
    for (const [t, side] of [[L, 0], [Rt, 1]]) {
      const T = TEAMS[t], x0 = side ? cx + cw / 2 - 4 : cx - cw / 2 - pw + 4;
      if (V.score[t] !== SCV[t]) { if (V.score[t] > SCV[t]) SCP[t] = now; SCV[t] = V.score[t]; }
      glass(x0, y, pw, h, 16, side);
      ctx.fillStyle = T.c1; para(side ? x0 : x0 + 2, y + h - 3, pw - 2, 3, side ? -3 : 3); ctx.fill(); // liseré couleur d'équipe
      crest(t, side ? x0 + pw - 26 : x0 + 26, y + 15, 0.95, T.c1);
      ctx.font = `italic 800 13px ${UIF}`; ctx.fillStyle = '#e9e7e2'; ctx.textAlign = side ? 'right' : 'left';
      const nx = side ? x0 + pw - 44 : x0 + 44, mine = t === app.myTeam && app.mode !== 'menu';
      ctx.fillText(T.name, nx, y + 12);
      if (mine) { const tw = ctx.measureText(T.name).width; ctx.font = `italic 800 10px ${UIF}`; ctx.fillStyle = T.acc; ctx.fillText('TOI', side ? nx - tw - 6 : nx + tw + 6, y + 12); }
      kiCells(side ? x0 + 44 : x0 + 40, y + 25, pw - 96, clamp(V.bar[t], 0, 1), T.acc, side, now);
      // score : il « pop » quand on marque
      const pt = (now - SCP[t]) / 1000, pop = SCP[t] && pt < 0.6 ? 1 + 0.9 * Math.exp(-pt * 7) * Math.cos(pt * 18) : 1;
      const sxp = side ? cx + cw / 2 + 24 : cx - cw / 2 - 24;
      ctx.save(); ctx.translate(sxp, y + h / 2 + 1); ctx.scale(pop, pop);
      ctx.font = `32px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(String(V.score[t]), 1.5, 2);
      ctx.fillStyle = SCP[t] && pt < 0.35 ? '#ffffff' : T.c1; ctx.fillText(String(V.score[t]), 0, 0);
      ctx.restore();
    }
    // bloc horloge
    const hot = V.clock < 15 && V.phase === 'play' && !V.golden;
    ctx.fillStyle = '#0b0b0d'; ctx.fillRect(cx - cw / 2, y - 2, cw, h + 6);
    const cg = ctx.createLinearGradient(0, y - 2, 0, y + h + 4); cg.addColorStop(0, 'rgba(255,255,255,.08)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = cg; ctx.fillRect(cx - cw / 2, y - 2, cw, h + 6);
    ctx.fillStyle = hot || V.golden ? ((now / 250 | 0) % 2 ? '#ffb400' : '#ff2a1e') : '#d4111a'; ctx.fillRect(cx - cw / 2, y + h + 1, cw, 3);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.strokeRect(cx - cw / 2 + 0.5, y - 1.5, cw - 1, h + 5);
    ctx.textAlign = 'center';
    if (V.golden) {
      ctx.font = `13px ${FONT}`; ctx.fillStyle = (now / 250 | 0) % 2 ? '#ffb400' : '#ff2a1e';
      ctx.fillText('BUT', cx, y + 12); ctx.fillText('EN OR', cx, y + 27);
    } else {
      ctx.font = `24px ${FONT}`; ctx.fillStyle = hot ? ((now / 300 | 0) % 2 ? '#ff2a1e' : '#fff') : '#f1efe9';
      ctx.fillText(fmtClock(V.clock), cx, y + h / 2 + 1);
    }
    // ping
    if ((app.mode === 'host' || app.mode === 'guest') && NET.rtt) {
      const ms = Math.round(NET.rtt);
      ctx.font = `italic 800 13px ${UIF}`; ctx.textAlign = 'right';
      ctx.fillStyle = ms < 90 ? '#7dff9a' : ms < 180 ? '#ffb400' : '#ff2a1e';
      ctx.fillText('● ' + ms + ' ms', CW - 12 - SAFE.r, y + 12);
    }
    drawCard(V, now);
    drawMinimap(V);
  }
  // carte du joueur contrôlé : portrait, nom, endurance, état physique
  const PIMG = {};
  function pimg(i, V) {
    const rid = V.pk && V.pk[i >> 2] ? V.pk[i >> 2][i & 3] : -1; if (rid == null || rid < 0) return null;
    const key = rid + '_' + (i >> 2);
    if (!PIMG[key]) { const im = new Image(); im.src = portrait(rid, i >> 2); PIMG[key] = im; }
    return PIMG[key].complete ? PIMG[key] : null;
  }
  const STATE = [[2, 'EN FORME', '#7dff9a'], [4.5, 'TOUCHÉ', '#ffd23a'], [7, 'AMOCHÉ', '#ff8a1a'], [99, 'EN SANG', '#ff2a1e']];
  function drawCard(V, now) {
    const me = app.myTeam, ci = me * 4 + V.ctrl[me], p = V.players[ci], T = TEAMS[me];
    const wide = CW >= 980, x = (wide ? 60 : 10) + SAFE.l, y = (wide ? 8 : 56) + SAFE.t, w = 196, h = 46;
    glass(x, y, w, h, 10, 0);
    ctx.fillStyle = T.c1; ctx.fillRect(x + 10, y + h - 2, w - 10, 2);
    const im = pimg(ci, V);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 12, y + 2, 42, h - 4); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x + 12, y + 2, 42, h - 4);
    if (im) ctx.drawImage(im, 0, 0, im.width, im.height * 0.5, x + 4, y - 4, 58, 58 * (im.height * 0.5) / im.width * 1);
    ctx.restore();
    const st = p.st === ST.down ? [0, 'AU TAPIS', '#ff2a1e'] : STATE.find(s2 => (p.dmg || 0) < s2[0]);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `14px ${FONT}`; ctx.fillStyle = T.c1; ctx.fillText(LK[ci].name, x + 62, y + 11);
    ctx.font = `italic 800 10px ${UIF}`; ctx.fillStyle = '#9aa0a8'; ctx.fillText(ROLE_TAG[ci & 3], x + 62, y + 24);
    ctx.fillStyle = st[2]; ctx.textAlign = 'right'; ctx.fillText(st[1], x + w - 8, y + 24);
    // jauges : endurance (vert) et santé (de vert à rouge)
    const bar = (yy, v, col, lab) => {
      ctx.fillStyle = 'rgba(255,255,255,.1)'; para(x + 62, yy, w - 72, 5, 2); ctx.fill();
      ctx.fillStyle = col; para(x + 62, yy, (w - 72) * clamp(v, 0, 1), 5, 2); ctx.fill();
    };
    const hp = 1 - clamp((p.dmg || 0) / 10, 0, 1);
    bar(y + 33, p.stam, p.stam < 0.25 ? '#ff8a1a' : '#e6e9ee');
    bar(y + 40, hp, hp > 0.6 ? '#7dff9a' : hp > 0.3 ? '#ffd23a' : (now / 200 | 0) % 2 ? '#ff2a1e' : '#a30c10');
  }
  function drawMinimap(V) {
    const mw = Math.min(150, CW * 0.19), mh = mw * 0.6, mx0 = CW / 2 - mw / 2, my0 = CH - mh - 8 - SAFE.b;
    ctx.globalAlpha = 0.9;
    rr(mx0 - 4, my0 - 4, mw + 8, mh + 8, 5); ctx.fillStyle = 'rgba(6,10,8,.78)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(46,110,52,.35)'; ctx.fillRect(mx0, my0, mw, mh);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(mx0, my0, mw, mh);
    ctx.beginPath(); ctx.moveTo(mx0 + mw / 2, my0); ctx.lineTo(mx0 + mw / 2, my0 + mh); ctx.stroke();
    ctx.beginPath(); ctx.arc(mx0 + mw / 2, my0 + mh / 2, mh * 0.18, 0, 7); ctx.stroke();
    const mxp = xx => mx0 + (cam.flip === 1 ? xx : W - xx) / W * mw, myp = yy => my0 + (cam.flip === 1 ? yy : H - yy) / H * mh;
    ctx.fillStyle = '#fff'; ctx.fillRect(mxp(0) - 2, myp(MT), 2, myp(MB) - myp(MT)); ctx.fillRect(mxp(W), myp(MT), 2, myp(MB) - myp(MT));
    for (let i = 0; i < 8; i++) {
      const p = V.players[i], t = i >> 2;
      ctx.fillStyle = (i & 3) === 3 ? TEAMS[t].gkc : TEAMS[t].c1; ctx.globalAlpha = p.st === ST.down ? 0.4 : 0.95;
      circ(mxp(p.x), myp(p.y), 3); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      if (t === app.myTeam && (i & 3) === V.ctrl[t] && app.mode !== 'menu') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; circ(mxp(p.x), myp(p.y), 5.5); ctx.stroke(); }
    }
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffb400'; circ(mxp(V.ball.x), myp(V.ball.y), 2.6); ctx.fill();
  }

  function bigText(txt, sub, col, scale, alpha, yy) {
    const s = Math.min(CW * 0.13, CH * 0.22, 100) * scale;
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(CW / 2, CH * (yy || 0.4)); ctx.rotate(-0.035); ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.font = `${s | 0}px ${FONT}`; ctx.lineJoin = 'round';
    // bande noire derrière le texte
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-tw / 2 - s * 0.5, -s * 0.5, tw + s, s * 0.95);
    ctx.fillStyle = shade(col, 0.4); ctx.fillText(txt, s * 0.07, s * 0.08);   // extrusion
    ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = col; ctx.fillText(txt, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(-tw, -s, tw * 2, s * 0.92); ctx.clip(); // reflet métallique haut
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillText(txt, 0, 0); ctx.restore();
    if (sub) {
      ctx.font = `italic 800 ${Math.max(14, s * 0.28) | 0}px ${UIF}`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(sub.toUpperCase(), 0, s * 0.74); ctx.fillStyle = '#f1efe9'; ctx.fillText(sub.toUpperCase(), 0, s * 0.74);
    }
    ctx.restore();
  }

  function drawOverText(V) {
    if (banner) {
      const t = 1 - banner.life / banner.max, el = t * banner.max;
      const sc = el < 0.1 ? 2.2 - el / 0.1 * 1.2 : el < 0.2 ? 1 + Math.sin((el - 0.1) / 0.1 * Math.PI) * 0.06 : 1; // arrive en s'écrasant
      bigText(banner.txt, banner.sub, banner.col, sc * banner.sc, clamp(Math.min(banner.life / 0.25, el / 0.06), 0, 1), banner.yy);
    }
    if (V.phase === 'countdown' && V.phaseT > 0.25) {
      const n = Math.ceil(V.phaseT - 0.2), f = (V.phaseT - 0.2) % 1;
      if (n >= 1 && n <= 3) bigText(String(n), n === 3 ? 'serre les crampons' : n === 1 ? 'pas de quartier' : '', '#f1efe9', 0.8 + f * 0.7, 1);
    } else if (V.phase === 'kickoff' && !banner) {
      bigText('PRÊTS ?', '', '#f1efe9', 0.6, 0.85);
    }
    if (V.rs > 0) bigText('REPRISE', String(Math.ceil(V.rs)), '#f1efe9', 0.7, 1);
    if (V.paused && app.mode === 'guest') bigText('PAUSE', 'Ton pote revient…', '#ffb400', 0.6, 1);
  }

  const rageEl = $('rage'); let rageS = '';

