  /* =============== UI =============== */
  const SCR = ['menu', 'lobby', 'joining', 'help', 'pause', 'end', 'netm', 'draft', 'opts'];
  function show(id) { for (const s of SCR) $(s).classList.toggle('on', s === id); }
  function hideScr(id) { $(id).classList.remove('on'); }
  function hideAll() { for (const s of SCR) $(s).classList.remove('on'); }
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
  function setLobby(msg, dots) { $('lobStatus').innerHTML = dots ? '<span class="dots">' + msg + '</span>' : msg; }
  function showNetMsg(title, msg, spin) {
    $('netTitle').textContent = title; $('netStatus').innerHTML = spin ? '<span class="dots">' + msg + '</span>' : msg;
    $('netSpin').style.display = spin ? '' : 'none'; show('netm');
  }
  function setFlip(f) { cam.flip = f; }

  function goFull() {
    if (!isTouch) return;
    const el = document.documentElement;
    const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* rien */ } };
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) { lock(); return; }
      const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
      if (r && r.then) r.then(lock).catch(() => {}); else lock();
    } catch (e) { /* rien */ }
  }
  let wl = null;
  async function wake() { try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { wl = null; } }
  function unwake() { try { if (wl) wl.release(); } catch (e) { /* rien */ } wl = null; }

  /* ---------- écran VS : les deux équipes se font face avant le coup d'envoi ---------- */
  let vsT = 0;
  const rgba = (h, a) => { const n = parseInt(hx(h, '#ffffff').slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function showVS(picks) {
    const el = $('vs'); if (!picks || !picks[0] || !picks[1]) return;
    const me = app.myTeam, op = 1 - me;
    const side = (cls, t) => {
      const box = el.querySelector(cls), who = t === me ? (app.mode === 'solo' ? 'TON ÉQUIPE' : 'TOI') : (app.mode === 'solo' ? "L'IA" : 'TON POTE');
      box.querySelector('.vsn').innerHTML = `<small>${who}</small>${TEAMS[t].name}`;
      box.querySelector('.vsp').innerHTML = picks[t].map((id, k) => id >= 0 ? `<figure style="animation-delay:${(0.28 + k * 0.07).toFixed(2)}s"><img alt="" src="${portrait(id, t)}"><figcaption>${TF.ROSTER[id].name}</figcaption></figure>` : '').join('');
    };
    side('.vsl', me); side('.vsr', op);
    el.style.setProperty('--c0', rgba(TEAMS[me].c1, 0.5)); el.style.setProperty('--c1', rgba(TEAMS[op].c1, 0.5));
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(vsT); vsT = setTimeout(() => el.classList.remove('on'), 2800);
    AU.whoosh(true); setTimeout(() => { AU.boom(1.1); AU.crunch(0.8); AU.roar(0.8); vibe(40); }, 470);
  }
  function enterGame() {
    hideAll();
    ctl.classList.add('on'); mbtn.classList.add('on');
    app.endShown = false; app.paused = false; parts.length = 0; floats.length = 0; banner = null; app.lastCount = -1;
    stains.length = 0; clearStains();
    vioReset(); ZB = null; shocks.length = 0; flashLights.length = 0; camIntro(); celeTeam = -1;
    showVS(app.world ? app.world.picks : NET.role === 'guest' ? [DR.opp.slice(), DR.mine.slice()] : null);
    lastLbl = ''; AU.ambient(true); MUS.set('match'); wake();
    requestAnimationFrame(layoutButtons);
  }
  function startSolo(picks, aiPicks) {
    AU.init(); goFull(); netReset();
    app.mode = 'solo'; app.myTeam = 0; setFlip(1); app.drafting = false; DR.on = false;
    const mine = picks && picks.every(x => x >= 0) ? picks.slice() : prefTeam([]);
    const ai = aiPicks || TF.randomPicks(mine);
    app.world = TF.newWorld({ human: [true, false], diff: app.diff, picks: [mine, ai] });
    enterGame();
  }
  function toMenu() {
    netLeave(); app.drafting = false; DR.on = false;
    app.mode = 'menu'; app.world = null; app.paused = false; setFlip(1);
    ctl.classList.remove('on'); mbtn.classList.remove('on');
    for (const k of ['A', 'B', 'C', 'D']) press(k, false); resetJoy(); ptr.clear();
    show('menu'); AU.ambient(false); MUS.set('menu'); unwake(); banner = null;
    $('vs').classList.remove('on');
  }
  function togglePause() {
    if (app.mode === 'menu') return;
    if ($('pause').classList.contains('on')) { resumeGame(); return; }
    if ($('end').classList.contains('on') || $('netm').classList.contains('on')) return;
    const online = app.mode !== 'solo';
    $('pauseTitle').textContent = online ? 'MENU' : 'PAUSE';
    $('pResume').textContent = online ? 'RETOUR AU MATCH' : 'REPRENDRE';
    $('pRestart').style.display = online ? 'none' : '';
    $('pQuit').textContent = online ? 'QUITTER LA PARTIE' : 'QUITTER';
    if (!online) app.paused = true;
    show('pause');
  }
  function resumeGame() { hideScr('pause'); app.paused = false; }

  function countUp(root) { // les chiffres défilent jusqu'à leur valeur, ligne après ligne
    root.querySelectorAll('[data-n]').forEach(el => {
      const n = +el.dataset.n, dec = +(el.dataset.dec || 0), suf = el.dataset.suf || '', t0 = performance.now() + (+el.dataset.t || 0) * 1000;
      el.textContent = (0).toFixed(dec) + suf;
      const tick = now => { const u = clamp((now - t0) / 600, 0, 1), e = 1 - Math.pow(1 - u, 3); el.textContent = (n * e).toFixed(dec) + suf; if (u < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }
  function showEnd(V) {
    const me = app.myTeam, op = 1 - me, win = V.winner === me;
    $('end').classList.toggle('win', win); $('end').classList.toggle('lose', !win);
    AU.fanfare(win); AU.call(!win ? 'youlose' : V.score[op] === 0 ? 'flawlessvictory' : 'youwin', 0.35);
    $('endRes').textContent = win ? (app.mode === 'solo' ? 'VICTOIRE !' : 'T\'AS GAGNÉ !') : (app.mode === 'solo' ? 'DÉFAITE…' : 'T\'AS PERDU…');
    $('endRes').style.color = win ? '#f1efe9' : '#ff2a1e';
    $('endSc').innerHTML = `<span style="color:${TEAMS[me].c1}">${V.score[me]}</span> - <span style="color:${TEAMS[op].c1}">${V.score[op]}</span>`;
    const L = ['Tirs', 'Super tirs', 'Buts', 'Tacles réussis', 'K.O. infligés', 'Passes réussies'];
    let h = `<div class="l" style="color:${TEAMS[me].c1}">${TEAMS[me].name}</div><div class="m"></div><div class="r" style="color:${TEAMS[op].c1}">${TEAMS[op].name}</div>`;
    let row = 0;
    const line = (a, lab, b, cls, dec, suf) => { const t = (0.5 + row++ * 0.09).toFixed(2), n = (v, c) => `<div class="${c}${cls ? ' ' + cls : ''}" style="animation-delay:${t}s"${typeof v === 'number' ? ` data-n="${v}" data-t="${t}" data-dec="${dec || 0}" data-suf="${suf || ''}"` : ''}>${v}</div>`;
      h += n(a, 'l') + `<div class="m" style="animation-delay:${t}s">${lab}</div>` + n(b, 'r'); };
    for (const i of [2, 0, 1, 3, 4, 5]) line(V.stats[me][i], L[i], V.stats[op][i]);
    // bilan du carnage
    line(VIO.bones[me], 'Os brisés', VIO.bones[op], 'v');
    line(VIO.gr[me] || 0, 'Coups de grâce', VIO.gr[op] || 0, 'v');
    if (GORE) line(+VIO.blood[me].toFixed(1), 'Sang versé', +VIO.blood[op].toFixed(1), 'v', 1, ' L'); else line('—', 'Sang versé', '—', 'v');
    let bi = -1, bk = 0; for (let i = 0; i < 8; i++) if (VIO.ko[i] > bk) { bk = VIO.ko[i]; bi = i; }
    if (bi >= 0) { const rid = V.pk && V.pk[bi >> 2] ? V.pk[bi >> 2][bi & 3] : -1;
      h += `<div class="mvp" style="animation-delay:${(0.55 + row * 0.09).toFixed(2)}s">${rid >= 0 ? `<img alt="" src="${portrait(rid, bi >> 2)}">` : ''}<span>BOUCHER DU MATCH : <b style="color:${TEAMS[bi >> 2].c1}">${LK[bi].name}</b> · ${bk} K.O.</span></div>`; }
    $('endStats').innerHTML = h; countUp($('endStats'));
    $('endStatus').textContent = ''; $('endAgain').disabled = false;
    if (app.mode === 'host') rematchStatus(NET.rmH, NET.rmG);
    show('end');
  }

  /* =============== COMPOSITION D'ÉQUIPE =============== */
  const DR_ROLES = ['ATT', 'MIL', 'DEF', 'GK'], NR = 4, NONE = () => [-1, -1, -1, -1];
  const STATN = [['v', 'VITESSE'], ['t', 'TIR'], ['h', 'TÊTE'], ['k', 'TECHNIQUE'], ['d', 'TACLE'], ['c', 'COMBAT'], ['r', 'RÉSISTANCE']];
  const STATG = [['rf', 'RÉFLEXES'], ['pl', 'PLONGEON'], ['so', 'SORTIES'], ['re', 'RELANCE'], ['ca', 'CARRURE']];
  const DR = { on: false, net: false, mine: NONE(), opp: NONE(), tab: 0, view: -1, ready: false, oppReady: false, pend: NONE(), wantReady: false, seeded: false };
  const full = a => a.every(x => x >= 0);
  function prefTeam(taken) { // équipe préférée mémorisée (si dispo), sinon au hasard
    let p = null; try { p = JSON.parse(localStorage.getItem('tf_team') || 'null'); } catch (e) { p = null; }
    const out = [];
    for (let r = 0; r < NR; r++) {
      const ok = TF.BYROLE[DR_ROLES[r]], v = p && p[r];
      out.push(ok.includes(v) && !taken.includes(v) ? v : -1);
    }
    const rnd = TF.randomPicks(taken.concat(out.filter(x => x >= 0)));
    return out.map((v, r) => (v >= 0 ? v : rnd[r]));
  }
  function saveTeam(p) { try { localStorage.setItem('tf_team', JSON.stringify(p)); } catch (e) { /* rien */ } }
  function openDraft(net) {
    AU.init(); if (!net) { goFull(); netReset(); app.mode = 'menu'; app.myTeam = 0; setFlip(1); }
    app.drafting = true; DR.on = true; DR.net = net; DR.ready = DR.oppReady = DR.wantReady = false; DR.pend = NONE(); DR.seeded = false;
    if (!net) { DR.mine = prefTeam([]); DR.opp = NONE(); }
    ctl.classList.remove('on'); mbtn.classList.remove('on');
    for (const k of ['A', 'B', 'C', 'D']) press(k, false); resetJoy(); ptr.clear();
    DR.tab = 0; DR.view = DR.mine[0];
    show('draft'); drRender();
  }
  function drRender() {
    if (!DR.on) return;
    const role = DR_ROLES[DR.tab], ids = TF.BYROLE[role], me = app.myTeam, tc = TEAMS[me].c1;
    $('draft').style.setProperty('--tc', tc);
    document.querySelectorAll('.drTab').forEach((b, r) => {
      const v = DR.mine[r] >= 0 ? DR.mine[r] : DR.pend[r];
      b.classList.toggle('on', r === DR.tab); b.classList.toggle('ok', DR.mine[r] >= 0);
      b.querySelector('b').textContent = v >= 0 ? TF.ROSTER[v].name : '— choisis —';
    });
    if (DR.view < 0 || !ids.includes(DR.view)) DR.view = DR.mine[DR.tab] >= 0 ? DR.mine[DR.tab] : ids[0];
    $('drCards').innerHTML = ids.map(id => {
      const R2 = TF.ROSTER[id], cls = ['drCard'];
      if (DR.mine[DR.tab] === id || DR.pend[DR.tab] === id) cls.push('sel');
      if (DR.opp.includes(id)) cls.push('taken');
      if (DR.view === id) cls.push('view');
      return `<button class="${cls.join(' ')}" data-id="${id}"><img alt="" src="${portrait(id, me)}"><div class="nm">${R2.name}</div></button>`;
    }).join('');
    const R2 = TF.ROSTER[DR.view], isG = R2.role === 'GK';
    let h = `<h3>${R2.name}</h3><div class="tg">${R2.tag}${DR.opp.includes(DR.view) ? ' — <b style="color:#ff3b30">déjà pris par ton pote</b>' : ''}</div><div class="drSt">`;
    for (const [k, lab] of isG ? STATG : STATN) { h += `<span>${lab}</span><i>`; for (let n = 1; n <= 5; n++) h += `<em class="${n <= R2.st[k] ? 'f' : ''}"></em>`; h += '</i>'; }
    if (isG) { // gardien : une spécialité d'ARRÊT et une de RELANCE
      h += `</div><div class="drTr d"><b><small>ARRÊT</small>${R2.def[1]}</b><p>${R2.def[2]}</p></div><div class="drTr g"><b><small>RELANCE</small>${R2.atk[1]}</b><p>${R2.atk[2]}</p></div>`;
    } else {
      const uc = (UCOL[R2.ult[0]] || ['#ff2a1e'])[0];
      h += `</div><div class="drTr u" style="--uc:${uc}"><b><small>ULTIME</small>${R2.ult[1]}</b><p>${R2.ult[2]}</p></div>`;
      h += `<div class="drTr"><b><small>ATTAQUE</small>${R2.atk[1]}</b><p>${R2.atk[2]}</p></div><div class="drTr d"><b><small>DÉFENSE</small>${R2.def[1]}</b><p>${R2.def[2]}</p></div>`;
      h += `<div class="drShot">Frappe : <b>${R2.shotN}</b></div>`;
    }
    $('drInfo').innerHTML = h;
    const go = $('drGo'), done = full(DR.mine);
    if (!DR.net) { go.textContent = "C'EST PARTI"; go.disabled = !done; $('drStatus').textContent = done ? '' : 'Choisis un attaquant, un milieu, un défenseur et un gardien'; }
    else {
      go.textContent = DR.ready ? 'PRÊT ✓' : 'PRÊT'; go.disabled = !done;
      $('drStatus').innerHTML = DR.ready && DR.oppReady ? 'Coup d\'envoi !' : DR.oppReady ? 'Ton pote est prêt, à toi !' : DR.ready ? '<span class="dots">Ton pote compose son équipe</span>' : 'Choisis tes 4 joueurs (pas les mêmes que ton pote) puis PRÊT';
    }
  }
  function drPick(r, id) {
    if (DR.opp.includes(id)) { toast('Déjà pris par ton pote'); return; }
    if (!DR.net) { DR.mine[r] = id; saveTeam(DR.mine); }
    else if (NET.role === 'host') { if (!hostPick(0, r, id)) toast('Déjà pris par ton pote'); else saveTeam(DR.mine); }
    else { DR.pend[r] = id; send({ k: 'dpick', r, id }); }
    drRender();
  }
  // ----- composition en ligne : l'hôte arbitre (premier arrivé, premier servi) -----
  function hostDraftOpen(keep) {
    if (!keep || !NET.dr) NET.dr = { p: [prefTeam([]), NONE()], r: [0, 0] };
    else NET.dr.r = [0, 0];
    app.world = null; openDraft(true); hostDraftSync();
    if (!NET.drTimer) { NET.drTimer = setInterval(() => { if (app.drafting && NET.role === 'host' && NET.dr) send({ k: 'dr', p: NET.dr.p, r: NET.dr.r }); }, 900); NET.timers.push(NET.drTimer); }
  }
  function hostPick(team, r, id) {
    const d = NET.dr; if (!d || d.p[1 - team].includes(id) || !TF.BYROLE[DR_ROLES[r]].includes(id)) return false;
    d.p[team][r] = id; d.r[team] = 0; return true;
  }
  function hostDraftSync() {
    const d = NET.dr; if (!d) return;
    DR.mine = d.p[0].slice(); DR.opp = d.p[1].slice(); DR.ready = !!d.r[0]; DR.oppReady = !!d.r[1];
    drRender(); send({ k: 'dr', p: d.p, r: d.r });
    if (d.r[0] && d.r[1] && full(d.p[0]) && full(d.p[1])) {
      app.drafting = false; DR.on = false;
      app.world = TF.newWorld({ human: [true, true], picks: [d.p[0].slice(), d.p[1].slice()] });
      send({ k: 'go', p: d.p }); enterGame();
    }
  }
  function guestDraft(d) {
    if (!Array.isArray(d.p) || !Array.isArray(d.p[1])) return;
    if (!app.drafting) { hideScr('end'); app.endShown = false; openDraft(true); }
    else if (!$('draft').classList.contains('on')) show('draft');
    DR.mine = d.p[1].slice(); DR.opp = d.p[0].slice(); DR.ready = !!d.r[1]; DR.oppReady = !!d.r[0];
    while (DR.mine.length < NR) DR.mine.push(-1); while (DR.opp.length < NR) DR.opp.push(-1);
    for (let r = 0; r < NR; r++) if (DR.pend[r] === DR.mine[r] || DR.opp.includes(DR.pend[r])) DR.pend[r] = -1;
    if (!DR.seeded) { // première fois : on propose son équipe préférée (ce qui est encore libre)
      DR.seeded = true;
      if (!full(DR.mine)) { const pf = prefTeam(DR.opp); for (let r = 0; r < NR; r++) if (DR.mine[r] < 0) { DR.pend[r] = pf[r]; send({ k: 'dpick', r, id: pf[r] }); } }
    }
    drRender();
  }
  function guestGo() { app.drafting = false; DR.on = false; enterGame(); }
  // l'invité renvoie ses choix tant que l'hôte ne les a pas pris en compte (messages non garantis)
  setInterval(() => {
    if (!app.drafting || NET.role !== 'guest' || !NET.conn || !NET.conn.open) return;
    for (let r = 0; r < NR; r++) if (DR.pend[r] >= 0) send({ k: 'dpick', r, id: DR.pend[r] });
    if (DR.wantReady !== DR.ready) send({ k: 'dready', v: DR.wantReady });
  }, 700);
  $('drCards').addEventListener('click', e => {
    const b = e.target.closest('.drCard'); if (!b) return;
    AU.init(); AU.ui('pick');
    const id = +b.dataset.id; DR.view = id; drPick(DR.tab, id);
  });
  document.querySelectorAll('.drTab').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); AU.init(); AU.click(); DR.tab = +b.dataset.r; DR.view = DR.mine[DR.tab]; drRender();
  }));

  // boutons de l'interface
  const BACK = { joinBack: 1, lobCancel: 1, drBack: 1, optOk: 1, pQuit: 1, endMenu: 1, netMenu: 1 };
  const on = (id, f) => $(id).addEventListener('click', e => { e.preventDefault(); AU.init(); AU.ui(BACK[id] ? 'back' : 'ok'); f(e); });
  // survol (souris) : petit tic sonore, comme dans un menu de console
  let hovT = 0;
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || !e.target.closest) return;
    const el = e.target.closest('.mb, .chip, .seg button, .drCard, .drTab, .link'); if (!el || el === document.__hov) return;
    document.__hov = el; const t = performance.now(); if (t - hovT > 45) { hovT = t; AU.ui('hover'); }
  });
  on('goSolo', () => openDraft(false));
  document.querySelectorAll('#chips .chip').forEach(c => c.addEventListener('click', () => {
    AU.init(); AU.click(); app.diff = c.dataset.d;
    document.querySelectorAll('#chips .chip').forEach(x => x.classList.toggle('on', x === c));
  }));
  /* ---------- OPTIONS : tout s'applique immédiatement ---------- */
  let optsFrom = 'menu';
  const TIERN = { ultra: 'ULTRA', high: 'HAUTE', perf: 'PERFORMANCE' };
  function optsRender() {
    document.querySelectorAll('#opts .seg').forEach(sg => { const k = sg.dataset.k, v = k === 'gore' ? GORE : OPT[k]; sg.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(v) === b.dataset.v)); });
    document.querySelectorAll('#opts input[type=range]').forEach(r => { r.value = Math.round(OPT[r.dataset.k] * 100); r.style.setProperty('--v', r.value + '%'); });
    $('optGfx').textContent = (softGPU ? 'GPU logiciel détecté (niveau PERF conseillé)' : 'Rendu 3D WebGL') + ' · niveau actuel : ' + TIERN[gfxTier()] + (OPT.gfx === 'auto' ? ' (il s\'adapte tout seul à ton appareil)' : '');
  }
  function openOpts() { optsFrom = app.mode === 'menu' ? 'menu' : 'pause'; optsRender(); show('opts'); }
  document.querySelectorAll('#opts .seg button').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); AU.init();
    const k = b.parentElement.dataset.k, v = b.dataset.v;
    if (k === 'gore') { GORE = +v; try { localStorage.setItem('tf_gore', v); } catch (_) { /* rien */ } if (!GORE) { stains.length = 0; clearStains(); } if (GORE) AU.splat(); else AU.click(); }
    else if (k === 'gfx') { OPT.gfx = v; gfxAuto = isTouch ? 'high' : 'ultra'; dprCap = 2; applyGfx(); AU.click(); }
    else { OPT[k] = +v; AU.click(); if (k === 'vib' && OPT.vib) vibe(30); if (k === 'shake' && OPT.shake) shake(10); if (k === 'voice' && OPT.voice) AU.call('fight'); }
    saveOpts(); optsRender();
  }));
  document.querySelectorAll('#opts input[type=range]').forEach(r => {
    r.addEventListener('input', () => { OPT[r.dataset.k] = r.value / 100; r.style.setProperty('--v', r.value + '%'); AU.vol(); saveOpts(); });
    r.addEventListener('change', () => { AU.init(); if (r.dataset.k === 'sfx') { AU.punch(2); AU.flesh(0.8); } });
  });
  on('goOpts', openOpts); on('pOpts', openOpts); on('optOk', () => show(optsFrom));
  on('goHost', () => { goFull(); startHost(); });
  on('goJoin', () => { goFull(); startGuest($('codeIn').value); });
  $('codeIn').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  on('goHelp', () => show('help'));
  on('helpOk', () => { if (app.mode === 'menu') show('menu'); else show('pause'); AU.ui('back'); });
  on('lobCancel', () => { toMenu(); });
  on('lobShare', async () => {
    const link = shareLink(NET.code);
    const txt = 'Viens te faire démolir sur TACLE FURY. Code : ' + NET.code;
    if (navigator.share) { try { await navigator.share({ title: 'Tacle Fury', text: txt, url: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    copy(link || NET.code);
  });
  on('lobCopy', () => copy(shareLink(NET.code) || NET.code));
  function copy(t) {
    const done = () => toast('Copié ! Envoie-le à ton pote');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done).catch(() => fallbackCopy(t, done));
    else fallbackCopy(t, done);
  }
  function fallbackCopy(t, done) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast(t); } ta.remove();
  }
  on('joinBack', () => { netReset(); show('menu'); });
  on('mbtn', togglePause);
  on('pResume', resumeGame);
  on('pRestart', () => { hideScr('pause'); startSolo(); });
  on('pHelp', () => show('help'));
  on('pQuit', () => toMenu());
  on('endAgain', () => {
    if (app.mode === 'solo') { hideScr('end'); openDraft(false); }
    else if (app.mode === 'host') { NET.rmH = true; rematchCheck(); }
    else if (app.mode === 'guest') { send({ k: 'rematch' }); rematchStatus(0, 1); }
  });
  on('endMenu', () => toMenu());
  on('drGo', () => {
    if (!full(DR.mine)) return;
    if (!DR.net) { saveTeam(DR.mine); startSolo(DR.mine); return; }
    if (NET.role === 'host') { NET.dr.r[0] = NET.dr.r[0] ? 0 : 1; hostDraftSync(); }
    else { DR.wantReady = !DR.ready; send({ k: 'dready', v: DR.wantReady }); }
  });
  on('drRand', () => {
    const pk = TF.randomPicks(DR.opp.filter(x => x >= 0));
    for (let r = 0; r < NR; r++) if (!DR.opp.includes(pk[r])) drPick(r, pk[r]);
    DR.view = pk[DR.tab]; drRender();
  });
  on('drBack', () => toMenu());
  on('netMenu', () => toMenu());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (app.mode === 'solo' && !app.paused && !$('end').classList.contains('on')) togglePause(); }
    else if (app.mode !== 'menu') wake();
  });
  addEventListener('resize', () => { resize(); });
  addEventListener('orientationchange', () => setTimeout(resize, 250));

