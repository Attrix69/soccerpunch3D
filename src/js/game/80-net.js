  /* =============== VUE (monde -> affichage) =============== */
  function makeView() {
    const V = { phase: 'countdown', phaseT: 0, clock: 180, golden: false, score: [0, 0], ts: 1, bar: [0, 0], ctrl: [0, 0],
      ball: { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, sup: 0, owner: -1, uk: 0, gu: 0, kb: -1 }, players: [], proj: [], beams: [], stats: [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], winner: -1, paused: false, rs: 0 };
    for (let i = 0; i < 8; i++) V.players.push({ x: 0, y: 0, z: 0, fx: 1, fy: 0, st: 0, inv: 0, chg: 0, stam: 1, spin: 0, dmg: 0 });
    return V;
  }
  const chg = p => p.chS ? Math.max(0.001, p.charge) : p.chT ? -Math.max(0.001, Math.min(1, p.tch / 0.55)) : 0;
  function viewFromWorld(w, V) {
    V = V || makeView();
    V.phase = w.phase; V.phaseT = w.phaseT; V.clock = w.clock; V.golden = w.golden; V.score = w.score; V.ts = w.ts; V.pk = w.picks;
    V.bar[0] = w.teams[0].bar; V.bar[1] = w.teams[1].bar; V.ctrl[0] = w.teams[0].ctrl; V.ctrl[1] = w.teams[1].ctrl;
    const b = w.ball, vb = V.ball;
    vb.x = b.x; vb.y = b.y; vb.z = b.z; vb.vx = b.vx; vb.vy = b.vy; vb.sup = b.sup; vb.owner = b.owner ? b.owner.id : -1; vb.uk = b.gp ? b.uk : 0; vb.gu = b.gp ? b.gp.u : 0; vb.kb = b.kickBy && b.kickT < 2.5 ? b.kickBy.id : -1;
    for (let i = 0; i < 8; i++) {
      const p = w.players[i], o = V.players[i];
      o.x = p.x; o.y = p.y; o.z = p.z; o.fx = p.fx; o.fy = p.fy; o.st = p.st; o.inv = p.inv > 0 ? 1 : 0; o.chg = chg(p); o.stam = p.stam; o.spin = p.spin; o.dmg = p.dmg;
    }
    V.stats = [w.teams[0].stats, w.teams[1].stats]; V.winner = w.winner; V.paused = w.paused; V.rs = w.resumeT;
    V.proj = w.proj.map(k => [k.x, k.y, k.vx, k.vy, k.team]);
    V.beams = w.beams.map(b => [b.x, b.y, b.dx, b.dy, b.L, b.t, b.team]);
    return V;
  }
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  function snapshot(w, evs) {
    const b = w.ball, P = [];
    for (const p of w.players) P.push(r1(p.x), r1(p.y), r1(p.z), r2(p.fx), r2(p.fy), p.st, p.inv > 0 ? 1 : 0, r2(chg(p)), r2(p.stam), r2(p.spin), r1(p.dmg));
    return { k: 's', T: Math.round(performance.now()), ph: PH.indexOf(w.phase), pt: r2(w.phaseT), ck: r1(w.clock), gg: w.golden ? 1 : 0, sc: w.score,
      ts: r2(w.ts), bar: [r2(w.teams[0].bar), r2(w.teams[1].bar)], ct: [w.teams[0].ctrl, w.teams[1].ctrl], pk: w.picks,
      b: [r1(b.x), r1(b.y), r1(b.z), r1(b.vx), r1(b.vy), b.sup, b.owner ? b.owner.id : -1, b.gp ? b.uk : 0, b.gp ? Math.round(b.gp.u * 100) / 100 : 0, b.kickBy && b.kickT < 2.5 ? b.kickBy.id : -1], p: P, ev: evs,
      st: [w.teams[0].stats, w.teams[1].stats], wn: w.winner, pa: w.paused ? 1 : 0, rs: r2(Math.max(0, w.resumeT)),
      kp: w.proj.map(k => [r1(k.x), r1(k.y), Math.round(k.vx), Math.round(k.vy), k.team]),
      bm: w.beams.map(b => [r1(b.x), r1(b.y), r2(b.dx), r2(b.dy), Math.round(b.L), r2(b.t), b.team]) };
  }

  /* =============== RÉSEAU (PeerJS / WebRTC) =============== */
  const NET = {
    peer: null, conn: null, role: null, code: '', hostId: '', gid: '', lastRx: 0, rtt: 0, connected: false, everConnected: false,
    lost: false, reconnecting: false, reconStart: 0, remoteIn: Object.assign({}, TF.EMPTY), inSeq: -1, outSeq: 0, lastSend: 0,
    snaps: [], off: null, evq: [], pend: [], rmH: false, rmG: false, view: null, timers: [], openTO: 0
  };
  let peerP = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerP) return peerP;
    const urls = [];
    if (Q.get('peerlib')) urls.push(Q.get('peerlib'));
    urls.push('https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js');
    peerP = new Promise((res, rej) => {
      let i = 0;
      const next = () => {
        if (i >= urls.length) { peerP = null; rej(new Error('peerjs')); return; }
        const s = document.createElement('script'); s.src = urls[i++]; s.async = true;
        s.onload = () => (window.Peer ? res() : next()); s.onerror = next;
        document.head.appendChild(s);
      };
      next();
    });
    return peerP;
  }
  function peerOpts() {
    const o = { debug: Q.get('peerdebug') ? 2 : 0 };
    if (Q.get('peerhost')) { o.host = Q.get('peerhost'); o.port = +(Q.get('peerport') || 9000); o.path = Q.get('peerpath') || '/'; o.secure = Q.get('peersecure') === '1'; }
    return o;
  }
  function genCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A[(R() * A.length) | 0]; return s; }
  function shareLink(code) { return location.protocol.startsWith('http') ? location.origin + location.pathname + '?code=' + code : ''; }
  function send(m) { const c = NET.conn; if (c && c.open) { try { c.send(m); } catch (e) { /* rien */ } } }

  function netReset() {
    NET.timers.forEach(t => clearInterval(t)); NET.timers = [];
    clearTimeout(NET.openTO);
    try { if (NET.conn) NET.conn.close(); } catch (e) { /* rien */ }
    const p = NET.peer;
    if (p) setTimeout(() => { try { p.destroy(); } catch (e) { /* rien */ } }, 300);
    Object.assign(NET, { peer: null, conn: null, role: null, connected: false, everConnected: false, lost: false, reconnecting: false, rtt: 0,
      snaps: [], off: null, evq: [], pend: [], rmH: false, rmG: false, inSeq: -1, lastRx: 0, remoteIn: Object.assign({}, TF.EMPTY), view: null, dr: null, drTimer: null });
  }
  function netLeave() { if (NET.conn && NET.conn.open) send({ k: 'bye' }); netReset(); }

  function startPing() {
    NET.timers.push(setInterval(() => { if (NET.conn && NET.conn.open) send({ k: 'ping', t: performance.now() }); }, 1000));
  }

  // ----- HÔTE -----
  async function startHost() {
    AU.init();
    try { await loadPeer(); } catch (e) { toast('Impossible de charger le module en ligne (pas de réseau ?)'); return; }
    netReset(); NET.role = 'host';
    show('lobby'); $('lobCode').textContent = '····';
    setLobby('Création de la partie', true);
    const tryOpen = (n) => {
      NET.code = genCode();
      const p = new Peer(PFX + NET.code.toLowerCase(), peerOpts());
      NET.peer = p;
      p.on('open', () => {
        if (NET.peer !== p) return;
        $('lobCode').textContent = NET.code;
        $('lobShare').style.display = shareLink(NET.code) ? '' : 'none';
        setLobby('En attente de ton pote', true);
      });
      p.on('connection', c => hostAccept(c));
      p.on('error', e => {
        if (NET.peer !== p) return;
        if (e.type === 'unavailable-id' && n < 5) { try { p.destroy(); } catch (_) { /* rien */ } tryOpen(n + 1); }
        else if (e.type === 'peer-unavailable') { /* ignoré */ }
        else if (!app.world) setLobby('Serveur de connexion injoignable. Vérifie ta connexion internet.', false);
      });
      p.on('disconnected', () => { setTimeout(() => { if (NET.peer === p && !p.destroyed && p.disconnected) { try { p.reconnect(); } catch (_) { /* rien */ } } }, 1500); });
    };
    tryOpen(0);
    startPing();
  }
  function hostAccept(c) {
    const gid = c.metadata && c.metadata.gid;
    const active = NET.conn && NET.conn.open && Date.now() - NET.lastRx < 4000;
    if (active && gid !== NET.gid) { c.on('open', () => { try { c.send({ k: 'full' }); } catch (_) { /* rien */ } setTimeout(() => c.close(), 800); }); return; }
    const old = NET.conn;
    NET.conn = c; NET.gid = gid;
    if (old && old !== c) { try { old.close(); } catch (_) { /* rien */ } }
    wireConn(c);
  }
  function hostOnHello() {
    NET.connected = true; NET.everConnected = true; NET.lost = false;
    send({ k: 'welcome', v: VER });
    if (app.drafting && app.mode === 'host') { hostDraftSync(); toast('Ton pote est de retour !'); }
    else if (!app.world || app.mode !== 'host') {
      app.mode = 'host'; app.myTeam = 0; setFlip(1);
      NET.rmH = NET.rmG = false;
      hostDraftOpen(false);
      toast('Ton pote est là. Composez vos équipes !');
    } else {
      hideScr('netm');
      app.world.paused = false; app.world.resumeT = 2.4;
      toast('Ton pote est de retour !');
    }
  }
  function hostLost() {
    if (NET.lost || !app.world) return;
    NET.lost = true; NET.connected = false;
    app.world.paused = true;
    showNetMsg('CONNEXION PERDUE', 'Ton pote a décroché… On l\'attend (code ' + NET.code + ')', true);
  }
  function hostResume() {
    if (!NET.lost) return;
    NET.lost = false; NET.connected = true;
    hideScr('netm');
    if (app.world) { app.world.paused = false; app.world.resumeT = 2.4; }
  }

  // ----- INVITÉ -----
  async function startGuest(code) {
    AU.init();
    code = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length !== 4) { toast('Le code fait 4 lettres'); $('codeIn').focus(); return; }
    show('joining'); $('joinTitle').textContent = 'PARTIE ' + code; $('joinErr').textContent = ''; $('joinSpin').style.display = '';
    $('joinStatus').innerHTML = '<span class="dots">Connexion</span>';
    try { await loadPeer(); } catch (e) { failJoin('Impossible de charger le module en ligne (pas de réseau ?).'); return; }
    netReset(); NET.role = 'guest'; NET.code = code; NET.hostId = PFX + code.toLowerCase();
    NET.gid = NET.gid || Math.random().toString(36).slice(2, 10);
    newGuestPeer();
    startPing();
  }
  function newGuestPeer() {
    const p = new Peer(peerOpts());
    NET.peer = p;
    p.on('open', () => { if (NET.peer === p) guestConnect(); });
    p.on('error', e => {
      if (NET.peer !== p) return;
      if (e.type === 'peer-unavailable') { if (!NET.everConnected) failJoin('Partie introuvable. Vérifie le code (ou ton pote a fermé sa partie).'); }
      else if (!NET.everConnected && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed' || e.type === 'browser-incompatible')) failJoin('Connexion au serveur impossible. Vérifie ta connexion internet.');
    });
    p.on('disconnected', () => { setTimeout(() => { if (NET.peer === p && !p.destroyed && p.disconnected) { try { p.reconnect(); } catch (_) { /* rien */ } } }, 1500); });
  }
  function guestConnect() {
    if (!NET.peer || NET.peer.destroyed || NET.peer.disconnected) return;
    const c = NET.peer.connect(NET.hostId, { serialization: 'json', reliable: false, metadata: { gid: NET.gid } });
    if (!c) return;
    const old = NET.conn; NET.conn = c;
    if (old && old !== c) { try { old.close(); } catch (_) { /* rien */ } }
    wireConn(c);
    c.on('open', () => { NET.lastRx = Date.now(); send({ k: 'hello', v: VER, gid: NET.gid }); });
    clearTimeout(NET.openTO);
    NET.openTO = setTimeout(() => {
      if (NET.conn === c && !c.open && !NET.everConnected) failJoin('Connexion impossible avec la partie. Réessaie (en Wi-Fi ou en 4G), ou inversez : c\'est ton pote qui crée.');
    }, 16000);
  }
  function failJoin(msg) {
    if (app.mode !== 'menu') return;
    $('joinSpin').style.display = 'none'; $('joinStatus').textContent = ''; $('joinErr').textContent = msg;
    netReset();
  }
  function guestStartReconnect() {
    if (NET.reconnecting) return;
    NET.reconnecting = true; NET.reconStart = Date.now();
    showNetMsg('CONNEXION PERDUE', 'Reconnexion à la partie ' + NET.code, true);
    try { if (NET.conn) NET.conn.close(); } catch (_) { /* rien */ }
    const t = setInterval(() => {
      if (!NET.reconnecting) { clearInterval(t); return; }
      if (Date.now() - NET.reconStart > 60000) {
        clearInterval(t); NET.reconnecting = false;
        showNetMsg('PARTIE PERDUE', 'Impossible de retrouver la partie. Ton pote a peut-être quitté.', false);
        return;
      }
      const p = NET.peer;
      if (!p || p.destroyed) newGuestPeer();
      else if (p.disconnected) { try { p.reconnect(); } catch (_) { newGuestPeer(); } }
      else if (!NET.conn || !NET.conn.open) guestConnect();
    }, 3000);
    NET.timers.push(t);
  }
  function guestBack() {
    NET.reconnecting = false; NET.lost = false; NET.silent = false;
    hideScr('netm');
  }

  // ----- messages -----
  function wireConn(c) {
    c.on('data', d => { if (NET.conn === c) onData(d); });
    c.on('close', () => { if (NET.conn !== c) return; onClose(); });
    c.on('error', () => { /* géré par les délais */ });
  }
  function onClose() {
    if (NET.role === 'host') { if (app.world) hostLost(); }
    else if (NET.role === 'guest' && NET.everConnected && app.mode === 'guest') guestStartReconnect();
  }
  function onData(d) {
    if (!d || typeof d !== 'object') return;
    NET.lastRx = Date.now();
    switch (d.k) {
      case 'ping': send({ k: 'pong', t: d.t }); return;
      case 'pong': { const r = performance.now() - d.t; if (r >= 0 && r < 10000) NET.rtt = NET.rtt ? NET.rtt * 0.7 + r * 0.3 : r; return; }
      case 'bye':
        netReset();
        if (app.mode !== 'menu') { toMenu(); toast('Ton pote a quitté la partie'); }
        else if ($('lobby').classList.contains('on') || $('joining').classList.contains('on')) { toMenu(); toast('Ton pote a quitté la partie'); }
        return;
    }
    if (NET.role === 'host') {
      if (d.k === 'hello') { if (d.v !== VER) { send({ k: 'ver', v: VER }); } hostOnHello(); return; }
      if (NET.lost) hostResume();
      if (d.k === 'in' && Array.isArray(d.i)) {
        const a = d.i; if (a[6] <= NET.inSeq) return;
        NET.inSeq = a[6];
        const ri = NET.remoteIn;
        ri.mx = clamp(+a[0] || 0, -1, 1); ri.my = clamp(+a[1] || 0, -1, 1);
        ri.a = !!(a[2] & 1); ri.b = !!(a[2] & 2); ri.sp = !!(a[2] & 4); ri.d = !!(a[2] & 8);
        ri.aN = a[3] | 0; ri.bN = a[4] | 0; ri.dN = a[5] | 0;
      } else if (d.k === 'rematch') { NET.rmG = true; rematchCheck(); }
      else if (d.k === 'dpick' && app.drafting && NET.dr) { const r = d.r | 0, id = d.id | 0; if (r >= 0 && r < NR) hostPick(1, r, id); hostDraftSync(); }
      else if (d.k === 'dready' && app.drafting && NET.dr) { NET.dr.r[1] = d.v && full(NET.dr.p[1]) ? 1 : 0; hostDraftSync(); }
      else if (d.k === 'quitEnd') { /* rien */ }
    } else if (NET.role === 'guest') {
      if (d.k === 'welcome') {
        NET.connected = true;
        if (!NET.everConnected) {
          NET.everConnected = true; app.mode = 'guest'; app.myTeam = 1; setFlip(-1);
          NET.snaps = []; NET.off = null; NET.evq = []; NET.view = makeView();
          openDraft(true); $('drStatus').innerHTML = '<span class="dots">Connexion à la composition</span>';
        } else guestBack();
        return;
      }
      if (NET.reconnecting) guestBack();
      if (d.k === 's') { if (app.drafting) guestGo(); onSnap(d); }
      else if (d.k === 'dr') guestDraft(d);
      else if (d.k === 'go') { if (app.drafting) guestGo(); }
      else if (d.k === 'rm') rematchStatus(d.h, d.g);
      else if (d.k === 'full') failJoin('Cette partie est déjà complète.');
      else if (d.k === 'ver') toast('Ton pote a une autre version du jeu : rechargez la page tous les deux.');
    }
  }

  function onSnap(s) {
    const now = performance.now();
    const off = now - s.T;
    if (NET.off === null || off < NET.off) NET.off = off; else NET.off += (off - NET.off) * 0.005;
    const a = NET.snaps;
    if (a.length && s.T <= a[a.length - 1].T) {
      let i = a.length - 1; while (i >= 0 && a[i].T > s.T) i--;
      if (i >= 0 && a[i].T === s.T) return;
      a.splice(i + 1, 0, s);
    } else a.push(s);
    if (a.length > 90) a.splice(0, a.length - 90);
    if (s.ev && s.ev.length) for (const e of s.ev) NET.evq.push([s.T, e]);
  }
  const INTERP = 110;
  function interpView(now) {
    const a = NET.snaps; if (!a.length) return null;
    const rt = now - NET.off - INTERP;
    // événements au bon moment
    if (NET.evq.length) {
      const keep = [];
      for (const q of NET.evq) { if (q[0] <= rt) { if (rt - q[0] < 1500) fx(q[1]); } else keep.push(q); }
      NET.evq = keep;
    }
    let s0, s1, al = 0;
    if (a[a.length - 1].T <= rt) { s0 = s1 = a[a.length - 1]; }
    else if (a[0].T > rt) { s0 = s1 = a[0]; }
    else {
      let j = a.length - 1; while (j > 0 && a[j - 1].T > rt) j--;
      s1 = a[j]; s0 = a[j - 1]; al = clamp((rt - s0.T) / Math.max(1, s1.T - s0.T), 0, 1);
    }
    while (a.length > 3 && a[1].T < rt - 300) a.shift();
    const V = NET.view || (NET.view = makeView());
    const P0 = s0.p, P1 = s1.p, sN = al < 0.5 ? s0 : s1;
    for (let i = 0; i < 8; i++) {
      const o = V.players[i], j = i * 11;
      const jump = len(P1[j] - P0[j], P1[j + 1] - P0[j + 1]) > 150;
      const t = jump ? 1 : al;
      o.x = lerp(P0[j], P1[j], t); o.y = lerp(P0[j + 1], P1[j + 1], t); o.z = lerp(P0[j + 2], P1[j + 2], t);
      let fx_ = lerp(P0[j + 3], P1[j + 3], t), fy_ = lerp(P0[j + 4], P1[j + 4], t); const m = len(fx_, fy_) || 1; o.fx = fx_ / m; o.fy = fy_ / m;
      const Ps = sN.p; o.st = Ps[j + 5]; o.inv = Ps[j + 6]; o.chg = Ps[j + 7]; o.stam = Ps[j + 8];
      o.spin = Math.abs(P1[j + 9] - P0[j + 9]) < 3 ? lerp(P0[j + 9], P1[j + 9], t) : P1[j + 9];
      o.dmg = Ps[j + 10] || 0;
    }
    const b0 = s0.b, b1 = s1.b, vb = V.ball;
    const bj = len(b1[0] - b0[0], b1[1] - b0[1]) > 260 ? 1 : al;
    vb.x = lerp(b0[0], b1[0], bj); vb.y = lerp(b0[1], b1[1], bj); vb.z = lerp(b0[2], b1[2], bj);
    vb.vx = b1[3]; vb.vy = b1[4]; vb.sup = sN.b[5]; vb.owner = sN.b[6]; vb.uk = sN.b[7] || 0; vb.gu = lerp(b0[8] || 0, b1[8] || 0, bj); vb.kb = sN.b[9] == null ? -1 : sN.b[9];
    V.phase = PH[sN.ph] || 'play'; V.phaseT = lerp(s0.pt, s1.pt, al); V.clock = lerp(s0.ck, s1.ck, al); V.golden = !!sN.gg; if (sN.pk) V.pk = sN.pk;
    V.score = sN.sc; V.ts = lerp(s0.ts, s1.ts, al); V.bar = sN.bar; V.ctrl = sN.ct; V.stats = sN.st; V.winner = sN.wn; V.paused = !!sN.pa; V.rs = sN.rs || 0;
    const k0 = s0.kp || [], k1 = s1.kp || [];
    V.proj = k1.length === k0.length ? k1.map((k, n) => [lerp(k0[n][0], k[0], al), lerp(k0[n][1], k[1], al), k[2], k[3], k[4]]) : k1;
    V.beams = sN.bm || [];
    return V;
  }
  function sendInput(now) {
    if (now - NET.lastSend < 33 && NET.lastSig === sig()) return;
    NET.lastSend = now; NET.lastSig = sig();
    const i = readMove();
    send({ k: 'in', i: [r2(i.mx), r2(i.my), (i.a ? 1 : 0) | (i.b ? 2 : 0) | (i.sp ? 4 : 0) | (i.d ? 8 : 0), i.aN, i.bN, i.dN, ++NET.outSeq] });
  }
  function sig() { return (LI.a ? 1 : 0) + (LI.b ? 2 : 0) + (LI.sp ? 4 : 0) + (LI.d ? 8 : 0) + '|' + LI.aN + LI.bN + LI.dN; }

  // ----- revanche -----
  function rematchCheck() {
    if (NET.role !== 'host') return;
    send({ k: 'rm', h: NET.rmH ? 1 : 0, g: NET.rmG ? 1 : 0 });
    rematchStatus(NET.rmH, NET.rmG);
    if (NET.rmH && NET.rmG) {
      NET.rmH = NET.rmG = false;
      app.endShown = false; hideScr('end');
      send({ k: 'rm', h: 0, g: 0 });
      hostDraftOpen(true); // revanche : on recompose (les choix précédents sont gardés)
    }
  }
  function rematchStatus(h, g) {
    const me = NET.role === 'host' ? h : g, other = NET.role === 'host' ? g : h;
    const st = $('endStatus');
    if (me && !other) st.innerHTML = '<span class="dots">En attente de ton pote</span>';
    else if (!me && other) st.textContent = 'Ton pote veut sa revanche !';
    else st.textContent = '';
    $('endAgain').disabled = !!me;
  }

