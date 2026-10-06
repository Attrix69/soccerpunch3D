  /* =============== POSES : la cinématique de la version 2D, pilotant les squelettes 3D =============== */
  // état d'animation par joueur : fondu entre les poses, orientation lissée
  const PSB = [], FA = new Float32Array(NSL).fill(NaN), TRL = [];
  for (let i = 0; i < NSL; i++) { PSB.push({ init: false, key: -1, t: 1, dur: 0.15, from: null, cur: null }); TRL.push([]); }
  let animDt = 0.016;
  const isStrike = s => s === ST.punch || s === ST.punch2 || s === ST.hkick || s === ST.volley || s === ST.head || s === ST.stomp;
  const AHIT = new Uint8Array(NSL); // le geste aérien a touché le ballon (pour enchaîner sur la pose de frappe)
  const SLOT_T = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0], SLOT_GK = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0];
  const PO = {};
  function poseOf(p, i) {
    const ghost = 0;
    const team = SLOT_T[i], gk = SLOT_GK[i], st = p.st, now = performance.now() / 1000;
    let fx = p.fx, fy = p.fy;
    let roll = 0, srot = 0;
    let dive = 0;
    if (st === ST.dive) { // plongeon du gardien : face au terrain, corps couché sur le côté du ballon
      const sg = fx >= 0 ? 1 : -1; dive = (p.fy >= 0 ? 1 : -1) * sg; roll = 0.35 * dive; fx = sg; fy = 0;
    }
    const fl = len(fx, fy) || 1; fx /= fl; fy /= fl;
    if (!ghost && st !== ST.dive) { // le corps pivote au lieu de se retourner d'un coup
      const ta = Math.atan2(fy, fx); let ca = FA[i];
      if (ca !== ca) ca = ta;
      let d = ta - ca; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const rate = isStrike(st) || st === ST.dash || st === ST.slide || st === ST.fly || st === ST.blast ? 38 : 13;
      ca += d * (1 - Math.exp(-animDt * rate)); FA[i] = ca; fx = Math.cos(ca); fy = Math.sin(ca);
    } else if (!ghost) FA[i] = Math.atan2(fy, fx);
    else if (ghostCol && st !== ST.dive && FA[i] === FA[i]) { fx = Math.cos(FA[i]); fy = Math.sin(FA[i]); }
    const amp = clamp(spd[i] / 250, 0, 1.3), ph = animPh[i];
    const loco = st === ST.run || st === ST.hold || st === ST.dash;
    // poids de la course : passage progressif arrêt → marche → course (plus de bascule sèche)
    const wr = st === ST.dash ? 1 : loco ? sm01((amp - 0.03) / 0.3) : 0;
    let lean = 0.08, hipD = null, mouth = 0, eyes = 1, spread = 0, tw = 0, lift = 0, glide = 0;
    // bras : a angle avant/arrière, b pli du coude, o écartement du bras (rad), p écartement de l'avant-bras par rapport au bras
    const L0 = { a: 0.1, b: 0.25 }, L1 = { a: -0.1, b: 0.25 }, A0 = { a: 0.2, b: 0.5, o: 0, p: 0 }, A1 = { a: 0.15, b: 0.5, o: 0, p: 0 };
    const PE = LK[i].pe || PE0, G = PE.g;
    if (st === ST.run || st === ST.hold) { // garde : genoux fléchis, poings serrés, appuis vivants
      const br = Math.sin(now * 3.2 + i * 1.7), sway = Math.sin(now * 1.15 + i * 2.3);
      lean = gk ? 0.32 : 0.14 + br * 0.02; spread = gk ? 3 : 1.5;
      L0.a = 0.3 + sway * 0.05; L0.b = (gk ? 0.95 : 0.6) + sway * 0.08; L1.a = -0.05 - sway * 0.04; L1.b = (gk ? 0.6 : 0.35) - sway * 0.06;
      A0.a = gk ? 0.85 : 0.3; A0.b = gk ? 0.8 : 2.35 + br * 0.08; A1.a = gk ? 0.85 : 0.12; A1.b = gk ? 0.8 : 2.2;
      roll = sway * 0.03 * (1 - wr); // transfert du poids d'une jambe à l'autre
      if (gk && PE.idle && !ghost && st === ST.run) { // posture d'attente propre à chaque gardien
        const t = now + i * 0.37;
        switch (PE.idle) {
          case 'gkwall': lean = 0.22; spread = 5; L0.b = 0.75; L1.b = 0.75; A0.a = 0.35; A0.b = 0.3; A0.o = 1.2; A1.a = 0.35; A1.b = 0.3; A1.o = 1.2; break; // le mur : bras en croix
          case 'gkcat': { const f2 = Math.sin(t * 2.2); lean = 0.55; L0.a = 0.65; L0.b = 1.5; L1.a = 0.25; L1.b = 1.4; roll = 0.06 * f2; lift = 1.2 * Math.abs(Math.sin(t * 5));
            A0.a = 1.25 + 0.1 * f2; A0.b = 1.3; A0.o = 0.25; A1.a = 1.15 - 0.1 * f2; A1.b = 1.35; A1.o = 0.25; break; } // ramassé, griffes sorties
          case 'gkbutcher': { const ph2 = (t * 1.4) % 1, hit = ph2 < 0.12 ? 1 - ph2 / 0.12 : 0; lean = 0.42; spread = 3.4;
            A0.a = 1.05; A0.b = 1.65 - 0.5 * hit; A0.p = -0.7; A1.a = 1.0; A1.b = 1.7 - 0.5 * hit; A1.p = -0.7; mouth = hit > 0.4 ? 1 : 0; break; } // tape ses gants l'un contre l'autre
          case 'gkhypno': lean = 0.02; spread = 1; A0.a = 1.45; A0.b = 0.1; A0.o = 0.12; A1.a = 0.45; A1.b = 2.0; A1.p = -0.9; break; // le pendule tendu
          case 'gkloco': { const f2 = Math.sin(t * 3); lean = 0.15; spread = 2.6; lift = 2.5 * Math.abs(Math.sin(t * 6));
            A0.a = 1.4 + 1.3 * f2; A0.b = 0.3; A0.o = 0.5; A1.a = 1.4 - 1.3 * f2; A1.b = 0.3; A1.o = 0.5; mouth = 1; break; } // moulinets de bras
        }
      }
      if (!gk && PE.idle && !ghost) { // posture d'attente propre à chaque joueur
        const t = now + i * 0.37;
        switch (PE.idle) {
          case 'boxer': { const bb = Math.sin(t * 7); lean = 0.2; lift = 1 + 1.3 * Math.abs(bb); spread = 2.5;
            A0.a = 0.45; A0.b = 2.25; A0.o = 0.15; A0.p = -0.5; A1.a = 0.7 + 0.08 * bb; A1.b = 2.1; A1.o = 0.15; A1.p = -0.5; break; } // garde de boxeur, sautille
          case 'heavy': lean = 0.27 + 0.03 * Math.sin(t * 1.6); spread = 4.2; A0.a = 0.15; A0.b = 0.35; A0.o = 0.34; A1.a = 0.12; A1.b = 0.35; A1.o = 0.34; L0.b += 0.2; L1.b += 0.2; break; // voûté, bras ballants
          case 'reaper': lean = 0.02; spread = 0; lift = 3 + 1.5 * Math.sin(t * 2.1); roll = 0; // elle lévite
            L0.a = 0.12; L0.b = 0.25; L1.a = 0.02; L1.b = 0.3; A0.a = 0.2; A0.b = 0.15; A0.o = 0.08; A1.a = 0.15; A1.b = 0.12; A1.o = 0.08; break;
          case 'cross': lean = -0.02; spread = 3.2; A0.a = 0.55; A0.b = -0.53; A0.o = 0.2; A0.p = -1.75; A1.a = 0.68; A1.b = -0.66; A1.o = 0.15; A1.p = -1.65; break; // bras croisés
          case 'swagger': lean = -0.1; spread = 3.8; A0.a = 0; A0.b = 0.25; A0.o = 0.75; A0.p = -1.55; A1.a = 0; A1.b = 0.25; A1.o = 0.75; A1.p = -1.55; break; // poings sur les hanches
          case 'ready': { const bb = Math.abs(Math.sin(t * 6)); lean = 0.2; lift = bb * 2.2; L0.b += 0.15; L1.b += 0.15; break; } // sautille sur place
          case 'magic': { const f2 = Math.sin(t * 5); lean = 0.04; A0.a = 0.8; A0.b = 1.3 + 0.15 * f2; A0.o = 0.1; A0.p = -0.65; A1.a = 0.8; A1.b = 1.3 - 0.15 * f2; A1.o = 0.1; A1.p = -0.65; break; } // doigts qui pianotent
          case 'tentacle': { const f2 = Math.sin(t * 3.2); A0.a = 0.6 + 0.35 * f2; A0.b = 1.0 + 0.7 * Math.sin(t * 3.2 + 1.2); A0.o = 0.35;
            A1.a = 0.6 - 0.35 * f2; A1.b = 1.0 + 0.7 * Math.sin(t * 3.2 + 2.6); A1.o = 0.35; break; } // bras qui ondulent
          case 'balance': { const f2 = Math.sin(t * 2.4); lean = 0.04; roll = 0.07 * f2; L1.a = 0.25; L1.b = 1.7; L0.a = 0.02; L0.b = 0.1;
            A0.a = -lean; A0.b = 0.05; A0.o = 1.4 + 0.15 * f2; A1.a = -lean; A1.b = 0.05; A1.o = 1.4 - 0.15 * f2; break; } // sur un pied, bras en balancier
          case 'conduct': { const f2 = Math.sin(t * 4.5); lean = -0.03; A0.a = 1.9 + 0.45 * f2; A0.b = 0.5 + 0.35 * Math.sin(t * 4.5 + 1); A0.o = 0.25;
            A1.a = -0.55; A1.b = 1.5; A1.o = 0.2; A1.p = -1.1; break; } // il dirige, l'autre main dans le dos
          case 'royal': lean = -0.07; spread = 0.5; A0.a = -0.55; A0.b = 1.1; A0.o = 0.2; A0.p = -1.1; A1.a = -0.55; A1.b = 1.1; A1.o = 0.2; A1.p = -1.1; break; // mains dans le dos
          case 'prowl': { const f2 = Math.sin(t * 2); lean = 0.55; spread = 3; L0.a = 0.55; L0.b = 1.25; L1.a = 0.05; L1.b = 1.1; roll = 0.05 * f2;
            A0.a = 1.05 + 0.1 * f2; A0.b = 0.9; A0.o = 0.25; A1.a = 0.95 - 0.1 * f2; A1.b = 1.0; A1.o = 0.25; break; } // à l'affût, griffes sorties
          case 'bull': { const f2 = Math.sin(t * 6); lean = 0.42; spread = 3; L0.a = -0.25 + 0.3 * f2; L0.b = 0.5 + 0.3 * Math.max(0, -f2);
            A0.a = 0.35; A0.b = 1.2; A0.o = 0.35; A1.a = 0.3; A1.b = 1.25; A1.o = 0.35; break; } // gratte le sol
          case 'sly': { const f2 = Math.sin(t * 9); lean = 0.24; roll = 0.04 * Math.sin(t * 1.3);
            A0.a = 0.85; A0.b = 1.55 + 0.12 * f2; A0.o = 0.05; A0.p = -0.75; A1.a = 0.85; A1.b = 1.55 - 0.12 * f2; A1.o = 0.05; A1.p = -0.75; break; } // se frotte les mains
          case 'pound': { const ph2 = (t * 1.6) % 1, hit = ph2 < 0.15 ? 1 - ph2 / 0.15 : 0; lean = 0.12; spread = 2.5;
            A0.a = 0.85; A0.b = 1.4 - 0.5 * hit; A0.o = 0.1; A0.p = -0.7; A1.a = 0.7; A1.b = 1.5; A1.o = 0.05; A1.p = -0.65; break; } // poing dans la paume
        }
      }
      const sh = SHF[i] * (1 - wr);
      if (sh > 0.02) { // pivote sur place : petits pas
        const s2 = Math.sin(ph), c2 = Math.cos(ph);
        L0.a += 0.32 * s2 * sh; L0.b += 0.75 * Math.max(0, c2) * sh; L1.a -= 0.32 * s2 * sh; L1.b += 0.75 * Math.max(0, -c2) * sh;
      }
    }
    if (wr > 0) { // cycle de course (démarche propre à chaque joueur)
      const s1 = Math.sin(ph), c1 = Math.cos(ph), am = Math.min(1, amp);
      const sa = (0.8 + 0.16 * sm01((amp - 0.75) / 0.45)) * G.st; // foulée plus longue au sprint
      const kl = (1.05 + 0.5 * am) * G.kn;                         // le genou monte plus en courant vite
      const as = 0.95 * G.arm, ab = G.ab || 0, fl = G.flop ? 0.75 * Math.sin(ph * 2 + 1) * am : 0;
      const r = [0.1 + 0.15 * am + (amp > 1.05 ? 0.06 : 0) + (G.ln || 0) * Math.min(1, am * 1.6),
        sa * s1 * am, 0.2 + kl * Math.max(0, c1) * am, -sa * s1 * am, 0.2 + kl * Math.max(0, -c1) * am,
        -as * s1 * am, Math.max(0.05, 1.35 + 0.3 * am + ab + fl), as * s1 * am, Math.max(0.05, 1.35 + 0.3 * am + ab - fl), G.ao || 0, 0, G.ao || 0, 0];
      if (G.cond) { r[5] = 1.85 + 0.45 * Math.sin(ph * 2); r[6] = 0.5; r[9] = 0.25; } // la baguette bat la mesure
      const cur = [lean, L0.a, L0.b, L1.a, L1.b, A0.a, A0.b, A1.a, A1.b, A0.o, A0.p, A1.o, A1.p];
      for (let k = 0; k < 13; k++) cur[k] += (r[k] - cur[k]) * wr;
      [lean, L0.a, L0.b, L1.a, L1.b, A0.a, A0.b, A1.a, A1.b, A0.o, A0.p, A1.o, A1.p] = cur;
      spread = spread * (1 - wr) + (G.wd || 0) * wr;
      tw = 0.2 * s1 * am * wr * (G.tw == null ? 1 : G.tw); // les épaules tournent à l'inverse des hanches
      roll += (G.sw || 0) * s1 * am * wr;                  // roulis : il se dandine
      lift = lift * (1 - wr) + (G.bob || 0) * Math.max(0, Math.sin(ph * 2)) * am * wr;
      glide = (G.gl || 0) * wr;
      const blv = BLV(p.dmg);
      if (blv >= 2) { // salement amoché : il boite (foulée raccourcie, la hanche plonge sur la jambe blessée)
        const k = blv === 3 ? 1 : 0.6;
        L1.a *= 1 - 0.4 * k; L1.b *= 1 - 0.35 * k; roll += 0.1 * k * Math.sin(ph) * am * wr; lean += 0.05 * k * wr;
      }
    }
    if (loco && st !== ST.dash && !ghost) { // le corps réagit aux forces : accélère, freine, vire
      const ax = SAX[i], ay = SAY[i];
      const aF = ax * p.fx + ay * p.fy, aL = (ay * p.fx - ax * p.fy);
      lean += clamp(aF / 1150 * 0.24, -0.32, 0.26) * Math.max(wr, 0.35);
      roll += clamp(aL / 1900 * 0.3, -0.22, 0.22) * wr;
      const brk = sm01((-aF - 450) / 900) * clamp(spd[i] / 130, 0, 1);
      if (brk > 0.02) { // freinage : jambe d'appui plantée devant, buste en arrière
        if (!BRL[i]) BRL[i] = L0.a >= L1.a ? 1 : 2;
        const F = BRL[i] === 1 ? L0 : L1, B = BRL[i] === 1 ? L1 : L0;
        F.a += (0.72 - F.a) * brk; F.b += (0.12 - F.b) * brk; B.a += (-0.3 - B.a) * brk; B.b += (0.95 - B.b) * brk;
        A0.a += (0.75 - A0.a) * brk * 0.6; A1.a += (1.0 - A1.a) * brk * 0.6; tw *= 1 - brk; spread += 1.4 * brk;
      } else BRL[i] = 0;
    }
    if (p.chg > 0 && (st === ST.run || st === ST.hold)) { // armé du tir
      const v = Math.min(1, p.chg);
      L0.a = -0.3 - 0.85 * v; L0.b = 0.5 + 1.5 * v; L1.a = 0.15; L1.b = 0.4;
      A0.a = 0.3 + 0.8 * v; A0.b = 0.3; A1.a = -0.3 - 0.9 * v; A1.b = 0.4; lean = 0.2 - 0.12 * v; mouth = v > 0.85 ? 1 : 0;
      switch (PE.kick) { // l'armé dépend de la manière de frapper
        case 'axe': A0.a = 0.3 + 2.5 * v; A0.b = 0.5; A1.a = 0.3 + 2.4 * v; A1.b = 0.6; lean = 0.1 - 0.3 * v; break;          // hache levée à deux mains
        case 'cannon': case 'boot': L0.a = -0.4 - 1.0 * v; L0.b = 0.4 + 1.8 * v; lean = 0.15 - 0.3 * v; break;               // énorme armé
        case 'toe': case 'poke': L0.a = -0.2 - 0.45 * v; L0.b = 0.5 + 0.9 * v; A0.a = 0.45; A0.b = 2.2; A0.p = -0.5; A1.a = 0.7; A1.b = 2.1; A1.p = -0.5; break; // armé court, garde haute
        case 'chip': A0.a = -lean; A0.b = 0.05; A0.o = 1.3; A1.a = -lean; A1.b = 0.05; A1.o = 1.3; break;                     // bras en balancier
        case 'scythe': A0.a = -0.6 - 0.8 * v; A0.b = 0.1; A0.o = 0.6; tw = 0.5 * v; roll = -0.2 * v; break;                  // faux armée
        case 'sidefoot': A0.a = 1.8; A0.b = 0.4; A0.o = 0.25; L0.a = -0.2 - 0.5 * v; tw = 0.3 * v; break;                     // baguette levée
        case 'pounce': lean = 0.45 + 0.1 * v; L1.b = 0.9; A0.a = 0.8; A0.b = 1.0; A0.o = 0.25; A1.a = 0.7; A1.b = 1.0; A1.o = 0.25; break;
        case 'butt': case 'stomp': lean = 0.35 + 0.1 * v; break;
        case 'trivela': case 'curl': tw = 0.45 * v; A1.o = 0.6 * v; break;
      }
    } else if (p.chg < 0) { // charge du tacle : on se ramasse
      const v = -p.chg; lean = 0.4 + 0.35 * v; L0.a += 0.35 * v; L0.b += 0.6 * v; L1.a += 0.35 * v; L1.b += 0.6 * v;
      A0.a = 0.9; A0.b = 1.1; A1.a = 0.5; A1.b = 1.3; mouth = v > 0.7 ? 1 : 0;
    }
    switch (st) {
      case ST.kick: { // geste de frappe propre à chaque joueur (et pose d'ULTIME)
        const shot = now - KSHOT[i] < 0.6, ks = UPK[i] && shot ? UPK[i] : shot ? PE.kick : 'pass', e = Math.min(1, stT[i] / 0.06);
        L0.a = 1.4; L0.b = 0.08; L1.a = -0.25; L1.b = 0.4; A0.a = -1.1; A0.b = 0.3; A1.a = 1.3; A1.b = 0.3; lean = -0.25; mouth = 1;
        switch (ks) {
          case 'pass': L0.a = 0.95; L0.b = 0.25; L1.a = -0.15; L1.b = 0.35; A0.a = -0.6; A0.b = 0.4; A1.a = 0.8; A1.b = 0.4; lean = -0.05; mouth = 0; break;
          // ULTIMES
          case 'upper': lift = 7 * e; lean = -0.25; tw = -0.4; A0.a = 3.0; A0.b = 0.05; A0.o = 0.1; A1.a = 0.45; A1.b = 2.3; A1.p = -0.4; L0.a = 0.35; L0.b = 0.7; L1.a = -0.2; L1.b = 0.3; break; // uppercut vers le ciel
          case 'stampede': lean = 0.95; lift = 2; A0.a = -1.3; A0.b = 0.3; A0.o = 0.3; A1.a = -1.2; A1.b = 0.35; A1.o = 0.3; L0.a = 0.6; L0.b = 0.9; L1.a = -0.8; L1.b = 0.3; break; // coup de tête plongeant
          case 'bordee': lean = -0.6; spread = 3; A0.a = -2.0; A0.b = 0.2; A0.o = 0.4; A1.a = 2.5; A1.b = 0.3; A1.o = 0.4; L0.a = 1.7; L0.b = 0.05; L1.a = -0.3; L1.b = 0.6; break; // le recul
          case 'fil': lean = 0.75; lift = 1; L0.a = 0.05; L0.b = 0.05; L1.a = -1.45; L1.b = 0.1; A0.a = -lean; A0.b = 0.05; A0.o = 1.45; A1.a = -lean; A1.b = 0.05; A1.o = 1.45; mouth = 0; break; // arabesque
          case 'crescendo': lean = -0.22; A0.a = 2.8; A0.b = 0.3; A0.o = 0.35; A1.a = 2.7; A1.b = 0.35; A1.o = 0.35; L0.a = 0.9; L0.b = 0.2; L1.a = -0.2; L1.b = 0.3; break; // fortissimo
          case 'abra': lean = -0.12; A0.a = 2.3; A0.b = 0.1; A0.o = 0.7; A1.a = 2.3; A1.b = 0.1; A1.o = 0.7; L0.a = 1.0; L0.b = 0.3; L1.a = -0.2; L1.b = 0.3; break; // « ta-da ! »
          case 'couronne': lean = -0.1; tw = -0.4; A0.a = 1.3; A0.b = 0.15; A0.o = 0.9; A1.a = 1.3; A1.b = 0.15; A1.o = 0.9; L0.a = 1.7; L0.b = 0.15; L1.a = -0.25; L1.b = 0.35; break;
          // FRAPPES
          case 'toe': lean = 0.14; L0.a = 1.05; L0.b = 0.04; L1.a = -0.12; L1.b = 0.35; A0.a = 0.45; A0.b = 2.25; A0.p = -0.5; A1.a = 0.7; A1.b = 2.1; A1.p = -0.5; break; // pointu sec, garde haute
          case 'poke': lean = 0.26; L0.a = 1.0; L0.b = 0.05; L1.a = -0.25; L1.b = 0.6; A0.a = -0.7; A0.b = 0.3; A1.a = 1.0; A1.b = 0.3; A1.o = 0.5; break;
          case 'stomp': lean = 0.4; spread = 3; L0.a = 0.85; L0.b = 0.55; L1.a = -0.3; L1.b = 0.8; A0.a = -1.0; A0.b = 0.4; A0.o = 0.3; A1.a = -0.9; A1.b = 0.4; A1.o = 0.3; break; // écrase la balle
          case 'scythe': lean = -0.12; roll = 0.38; tw = -0.7; L0.a = 1.6; L0.b = 0.1; L1.a = -0.15; L1.b = 0.4; A0.a = 2.1; A0.b = 0.1; A0.o = 0.6; A1.a = -0.6; A1.b = 0.3; A1.o = 0.3; break; // fauche en arc
          case 'boot': lean = -0.5; L0.a = 2.4; L0.b = 0.02; L1.a = -0.1; L1.b = 0.2; A0.a = 1.3; A0.b = 0.3; A1.a = 1.1; A1.b = 0.3; break; // coup de pied de rugby
          case 'axe': lean = -0.22; spread = 2; L0.a = 1.5; L0.b = 0.1; L1.a = -0.25; L1.b = 0.4; A0.a = 2.9; A0.b = 0.4; A0.o = 0.15; A1.a = 2.85; A1.b = 0.45; A1.o = 0.15; break; // hache à deux mains
          case 'drive': lean = -0.32; lift = 4 * e; L0.a = 1.95; L0.b = 0.05; L1.a = -0.3; L1.b = 0.6; A0.a = -1.3; A0.b = 0.3; A0.o = 0.3; A1.a = 1.6; A1.b = 0.3; A1.o = 0.5; break; // accompagne haut, décolle
          case 'trivela': roll = -0.38; tw = 0.55; spread = -1.5; lean = 0; L0.a = 1.1; L0.b = 0.35; L1.a = -0.1; L1.b = 0.3; A0.a = 1.2; A0.b = 0.15; A0.o = 0.8; A1.a = 1.2; A1.b = 0.15; A1.o = 0.8; break; // extérieur du pied
          case 'whip': lean = -0.15; L0.a = 1.5; L0.b = 0.65; L1.a = -0.2; L1.b = 0.35; A0.a = 2.4; A0.b = 1.2; A0.o = 0.4; A1.a = -1.2; A1.b = 1.0; A1.o = 0.4; break; // fouetté
          case 'chip': lean = -0.08; lift = 2; L0.a = 0.75; L0.b = 0.2; L1.a = 0; L1.b = 0.1; A0.a = 0.08; A0.b = 0.05; A0.o = 1.35; A1.a = 0.08; A1.b = 0.05; A1.o = 1.35; break; // piqué sur la pointe
          case 'sidefoot': lean = 0.04; roll = 0.28; tw = -0.3; L0.a = 0.9; L0.b = 0.25; L1.a = -0.1; L1.b = 0.3; A0.a = 2.5; A0.b = 0.3; A0.o = 0.3; A1.a = -0.55; A1.b = 1.5; A1.o = 0.2; A1.p = -1.1; mouth = 0; break; // plat du pied, baguette en l'air
          case 'curl': lean = -0.05; tw = -0.5; roll = 0.2; L0.a = 1.75; L0.b = 0.15; L1.a = -0.25; L1.b = 0.35; A0.a = 2.0; A0.b = 0.4; A0.o = 0.55; A1.a = -0.3; A1.b = 0.2; A1.o = 0.4; mouth = 0; break; // enroulé élégant
          case 'pounce': lean = 0.45; lift = 3 * e; L0.a = 1.35; L0.b = 0.1; L1.a = -0.65; L1.b = 0.5; A0.a = 1.6; A0.b = 0.8; A0.o = 0.2; A1.a = 1.3; A1.b = 0.9; A1.o = 0.2; break; // bondit, griffes en avant
          case 'butt': lean = 0.6; L0.a = 1.2; L0.b = 0.2; L1.a = -0.3; L1.b = 0.5; A0.a = -1.2; A0.b = 0.4; A0.o = 0.25; A1.a = -1.1; A1.b = 0.4; A1.o = 0.25; break; // tête baissée
          case 'cannon': lean = -0.45; spread = 3; L0.a = 1.6; L0.b = 0.05; L1.a = -0.3; L1.b = 0.5; A0.a = -1.8; A0.b = 0.2; A0.o = 0.35; A1.a = 2.4; A1.b = 0.3; A1.o = 0.35; break; // recul du canon
        }
        break;
      }
      case ST.slide: hipD = -5; lean = -1.0; L0.a = 1.48; L0.b = 0.04; L1.a = 1.2; L1.b = 2.6; A0.a = 3.0; A0.b = 0.8; A1.a = 0.55; A1.b = 0.1; mouth = 1; break;
      case ST.fly: hipD = -22; lean = -1.2; L0.a = 1.6; L0.b = 0; L1.a = 0.55; L1.b = 2.4; A0.a = 0.6; A0.b = 0.3; A1.a = 3.6; A1.b = 0.5; mouth = 1; break;
      case ST.dash: lean = 0.62; A0.a = -1.6 - 0.62; A0.b = 0.2; A1.a = -1.4 - 0.62; A1.b = 0.25; break;
      case ST.dive: hipD = -14; lean = 0.05; L0.a = 0.05; L0.b = 0.1; L1.a = -0.2; L1.b = 0.3; A0.a = 3.0; A0.b = 0.05; A1.a = 2.85; A1.b = 0.1; mouth = 1; break;
      case ST.cele: { // chacun sa célébration
        const t = now + i * 0.5;
        lean = -0.18; spread = 3; L0.a = 0.15; L0.b = 0.25; L1.a = -0.15; L1.b = 0.25; mouth = 1;
        A0.a = 2.75 + 0.35 * Math.sin(now * 13) + 0.18; A0.b = 0.55; A1.a = 2.9 + 0.18; A1.b = 0.45;
        switch (PE.cele) {
          case 'flex': { const f = 0.25 * Math.max(0, Math.sin(t * 4)); lean = -0.06; spread = 3.5; A0.a = -lean; A0.b = 2.85 + f; A0.o = 1.45; A0.p = -1.45; A1.a = -lean; A1.b = 2.85 + f; A1.o = 1.45; A1.p = -1.45; break; } // double biceps
          case 'chest': { const f = Math.sin(t * 10); lean = -0.14; spread = 4; A0.a = 1.0 + 0.35 * Math.max(0, f); A0.b = 1.9; A0.p = -0.9; A1.a = 1.0 + 0.35 * Math.max(0, -f); A1.b = 1.9; A1.p = -0.9; break; } // se frappe le torse
          case 'reaper': lean = 0.04; spread = 0; lift = 7 + 3 * Math.sin(t * 2); mouth = 0; L0.a = 0.1; L0.b = 0.3; L1.a = 0; L1.b = 0.35;
            A0.a = 2.3; A0.b = 0.5; A0.o = 0.25; A1.a = 1.2; A1.b = 1.5; A1.o = 0.1; A1.p = -1.0; break; // lévite, faux brandie
          case 'haka': { const f = Math.sin(t * 9); lean = 0.15; spread = 5; L0.a = 0.45; L0.b = 1.0; L1.a = 0.35; L1.b = 1.05; A0.a = 0.5 + 0.45 * f; A0.b = 1.6; A0.o = 0.5; A1.a = 0.5 + 0.45 * f; A1.b = 1.6; A1.o = 0.5; break; }
          case 'roar': { const f = Math.sin(t * 13) * 0.12; lean = -0.35; spread = 4; A0.a = 2.2 + f; A0.b = 1.1; A0.o = 0.55; A1.a = 2.2 - f; A1.b = 1.1; A1.o = 0.55; break; } // rugit vers le ciel
          case 'pump': { const f = Math.max(0, Math.sin(t * 7)); lean = -0.08; L0.a = 0.6; L0.b = 1.6; L1.a = -0.1; L1.b = 0.3; A0.a = 2.4 + 0.5 * f; A0.b = 0.9 - 0.7 * f; A1.a = 0.4; A1.b = 2.0; A1.p = -0.4; break; } // genou levé, poing qui pompe
          case 'bow': { const f = Math.sin(t * 1.4); lean = 0.75 + 0.15 * f; spread = 1; mouth = 0; A0.a = 0.6; A0.b = 1.6; A0.p = -1.0; A1.a = 0.2; A1.b = 0.2; A1.o = 1.1; L0.a = 0.25; L0.b = 0.1; L1.a = -0.2; L1.b = 0.15; break; } // la révérence
          case 'wave': A0.a = 1.6 + 0.6 * Math.sin(t * 6); A0.b = 1.0 + 0.8 * Math.sin(t * 6 + 1.3); A0.o = 0.8; A1.a = 1.6 + 0.6 * Math.sin(t * 6 + 2); A1.b = 1.0 + 0.8 * Math.sin(t * 6 + 3.3); A1.o = 0.8; lean = -0.1; break; // tentacules au vent
          case 'flip': { const f = (t * 1.1) % 1, fl2 = f < 0.45 ? f / 0.45 : 0; srot = fl2 * Math.PI * 2; lift = Math.sin(fl2 * Math.PI) * 20;
            L0.a = 0.4 + 0.5 * Math.sin(fl2 * Math.PI); L0.b = 0.3 + 1.5 * Math.sin(fl2 * Math.PI); L1.a = L0.a; L1.b = L0.b; A0.a = -lean; A0.b = 0.05; A0.o = 1.4; A1.a = -lean; A1.b = 0.05; A1.o = 1.4; break; } // saltos
          case 'conduct': { const f = Math.sin(t * 5); lean = -0.1; A0.a = 2.4 + 0.5 * f; A0.b = 0.4 + 0.4 * Math.sin(t * 5 + 1); A0.o = 0.4; A1.a = 2.2 - 0.5 * f; A1.b = 0.5; A1.o = 0.5; break; } // dirige le stade
          case 'royal': { const f = Math.sin(t * 4); lean = -0.1; spread = 0.5; mouth = 0; A0.a = 2.2; A0.b = 0.9 + 0.3 * f; A0.o = 0.35 + 0.15 * f; A1.a = 0; A1.b = 0.25; A1.o = 0.75; A1.p = -1.55; break; } // salut royal
          case 'tiger': { const f = Math.sin(t * 3); lean = 0.5; spread = 4; L0.a = 0.6; L0.b = 1.3; L1.a = -0.1; L1.b = 1.0; A0.a = 1.9 + 0.3 * f; A0.b = 1.0; A0.o = 0.3; A1.a = 1.6 - 0.3 * f; A1.b = 1.1; A1.o = 0.3; break; } // griffes, rugissement
          case 'stomp': { const f = Math.sin(t * 7); lean = 0.45; spread = 3; L0.a = 0.3 + 0.5 * Math.max(0, f); L0.b = 0.4 + Math.max(0, f); L1.a = 0.3 + 0.5 * Math.max(0, -f); L1.b = 0.4 + Math.max(0, -f);
            A0.a = 2.6; A0.b = 1.6; A0.o = 0.6; A1.a = 2.6; A1.b = 1.6; A1.o = 0.6; break; } // cornes avec les doigts, piétine
          case 'shh': lean = 0; mouth = 0; A0.a = 1.3; A0.b = 2.3; A0.p = -0.6; A1.a = 0; A1.b = 0.25; A1.o = 0.75; A1.p = -1.55; L0.a = 0.4; L0.b = 0.2; break; // chut…
          case 'cannon': { const ph2 = (t * 1.5) % 1, k = ph2 < 0.1 ? ph2 / 0.1 : Math.max(0, 1 - (ph2 - 0.1) / 0.3); lean = 0.1 - 0.35 * k; spread = 3; A0.a = 1.5 - lean; A0.b = 0.05; A1.a = 1.45 - lean; A1.b = 0.1; break; } // tire au canon
        }
        break;
      }
      case ST.punch: case ST.punch2: { // direct : bras tendu puis rentré
        const t = stT[i], e = t < 0.06 ? t / 0.06 : t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.05);
        const H = st === ST.punch ? A0 : A1, G = st === ST.punch ? A1 : A0;
        lean = 0.22 + 0.2 * e; H.a = 1.5 - lean; H.b = 2.3 * (1 - e) + 0.02; G.a = 0.35; G.b = 2.3;
        L0.a = st === ST.punch ? -0.35 : 0.45; L0.b = 0.45; L1.a = st === ST.punch ? 0.45 : -0.35; L1.b = 0.45; mouth = e > 0.5 ? 1 : 0; break;
      }
      case ST.hkick: if (LK[i].tr.boule) { // COUP DE BOULE : on recule la tête… et BAM
        const t = stT[i], wu = Math.min(1, t / 0.15), e = t < 0.15 ? 0 : Math.min(1, (t - 0.15) / 0.05), r = t > 0.27 ? Math.max(0, 1 - (t - 0.27) / 0.07) : 1;
        lean = ((-0.35 * wu) * (1 - e) + 0.85 * e) * r + 0.1 * (1 - r); A0.a = -0.9; A0.b = 0.6; A1.a = -0.8; A1.b = 0.7;
        L0.a = 0.5; L0.b = 0.6; L1.a = -0.4; L1.b = 0.4; spread = 2; mouth = 1; break;
      } else if (LK[i].tr.patate) { // PATATE DE FORAIN : il arme tout le bras et envoie un crochet monstrueux
        const t = stT[i], e = t < 0.13 ? 0 : Math.min(1, (t - 0.13) / 0.06), wu = Math.min(1, t / 0.13), r = t > 0.27 ? Math.max(0, 1 - (t - 0.27) / 0.07) : 1;
        lean = (0.05 - 0.15 * wu + 0.55 * e) * r + 0.1 * (1 - r); spread = 3;
        A0.a = (-1.5 * wu * (1 - e) + 1.75 * e) * r + 0.3 * (1 - r); A0.b = (1.6 * (1 - e) + 0.15 * e) * r + 2.2 * (1 - r);
        A1.a = 0.35; A1.b = 2.2; L0.a = 0.45; L0.b = 0.55; L1.a = -0.45; L1.b = 0.35; tw = (-0.35 * wu * (1 - e) + 0.45 * e) * r; mouth = 1; break;
      } else { // coup de pied haut
        const t = stT[i], e = Math.min(1, t / 0.13), r = t > 0.25 ? Math.max(0, 1 - (t - 0.25) / 0.09) : 1;
        L0.a = (0.9 + 1.25 * e) * r; L0.b = (1.9 - 1.85 * e) * r + 0.2 * (1 - r); L1.a = -0.25; L1.b = 0.35;
        lean = -0.4 * e * r; A0.a = -0.7; A0.b = 0.6; A1.a = 1.0; A1.b = 0.7; mouth = 1; break;
      }
      case ST.stomp: { // COUP DE GRÂCE : genou monté très haut… puis le talon s'écrase
        const t = stT[i];
        if (t < 0.2) {
          const wu = Math.min(1, t / 0.15);
          lean = 0.08 - 0.2 * wu; lift = 2.5 * wu; spread = 2;
          L0.a = 0.3 + 1.35 * wu; L0.b = 0.5 + 1.45 * wu; L1.a = -0.12; L1.b = 0.35;
          A0.a = 0.3 + 1.1 * wu; A0.b = 1.3; A0.o = 0.55; A1.a = 0.2 + 0.8 * wu; A1.b = 1.1; A1.o = 0.55; mouth = 1;
        } else {
          const e = Math.min(1, (t - 0.2) / 0.045);
          lean = -0.12 + 0.5 * e; spread = 2.6;
          L0.a = 1.65 * (1 - e) + 0.5 * e; L0.b = 1.95 * (1 - e) + 0.12 * e; L1.a = -0.3; L1.b = 0.55 + 0.3 * e;
          A0.a = -0.7; A0.b = 0.6; A0.o = 0.45; A1.a = -0.55; A1.b = 0.7; A1.o = 0.45; mouth = 1;
        }
        break;
      }
      case ST.charge: { // on concentre son ki
        const full = curBar[team] >= 1, sh = Math.sin(now * 40) * 0.03;
        spread = 4; lean = 0.08 + sh; L0.a = 0.5; L0.b = 1.05; L1.a = -0.35; L1.b = 0.7; mouth = 1;
        if (full) { A0.a = -1.0; A0.b = 1.5; A1.a = -0.8; A1.b = 1.7; } // mains jointes sur le côté
        else { A0.a = 0.45 + sh; A0.b = 1.1; A1.a = 0.35 - sh; A1.b = 1.2; }
        break;
      }
      case ST.blast: // bras tendus, paumes en avant
        spread = 3; lean = 0.18; L0.a = 0.5; L0.b = 0.55; L1.a = -0.45; L1.b = 0.3;
        A0.a = 1.5 - lean; A0.b = 0.05; A1.a = 1.45 - lean; A1.b = 0.1; mouth = 1; break;
      case ST.volley: { // reprise de volée : jambe armée, puis fouettée à hauteur de hanche, corps penché sur le côté
        const e = AHIT[i] ? 1 : 0, wu = Math.min(1, stT[i] / 0.1);
        if (p.z > 5) { // CISEAU ACROBATIQUE : en l'air, corps couché, jambes en ciseaux
          if (!e) { lean = -0.35 - 0.45 * wu; L0.a = 0.4 + 0.5 * wu; L0.b = 1.6; L1.a = 1.0 + 0.3 * wu; L1.b = 0.5; A0.a = -1.4; A0.b = 0.3; A1.a = 1.8; A1.b = 0.4; roll = 0.2 * wu; }
          else { lean = -1.05; L0.a = 2.45; L0.b = 0.05; L1.a = 0.35; L1.b = 1.2; A0.a = -1.9; A0.b = 0.2; A1.a = 2.4; A1.b = 0.3; roll = 0.38; spread = 2; }
          hipD = -16; mouth = 1; break;
        }
        if (!e) { lean = -0.15 - 0.2 * wu; L0.a = -0.25 - 0.4 * wu; L0.b = 0.9 + 0.6 * wu; L1.a = 0.2; L1.b = 0.45; A0.a = -0.6; A0.b = 0.4; A1.a = 1.3; A1.b = 0.3; roll = -0.12 * wu; }
        else { lean = -0.55; L0.a = 1.85; L0.b = 0.05; L1.a = -0.15; L1.b = 0.35; A0.a = -1.2; A0.b = 0.2; A1.a = 1.9; A1.b = 0.2; roll = 0.32; spread = 2; }
        mouth = 1; break;
      }
      case ST.head: { // tête : on s'arme en arrière en l'air, puis coup de nuque vers l'avant
        const e = AHIT[i] ? 1 : 0, wu = Math.min(1, stT[i] / 0.12);
        if (!e) { lean = 0.05 - 0.45 * wu; L0.a = 0.45; L0.b = 1.0 + 0.5 * wu; L1.a = -0.15; L1.b = 1.1 + 0.3 * wu; A0.a = -0.5 - 0.6 * wu; A0.b = 0.7; A1.a = -0.35 - 0.6 * wu; A1.b = 0.8; }
        else { lean = 0.6; L0.a = -0.35; L0.b = 0.5; L1.a = -0.1; L1.b = 0.9; A0.a = 0.6; A0.b = 0.5; A1.a = 0.45; A1.b = 0.6; }
        mouth = 1; break;
      }
      case ST.stag: { // sonné par le coup
        const w2 = Math.sin(stT[i] * 22) * 0.12;
        lean = -0.5 + w2; L0.a = -0.35; L0.b = 0.5; L1.a = 0.4; L1.b = 0.25; A0.a = -1.3 + w2; A0.b = 0.7; A1.a = 2.3; A1.b = 0.9; mouth = 1; break;
      }
      case ST.down: {
        // une fois retombé, on reste au sol (les petits rebonds ne refont pas « voler » le corps)
        if (!ghost) { if (stT[i] < 0.02) DGR[i] = 0; if (p.z <= 3) DGR[i] = 1; }
        if (p.z > 3 && !DGR[i]) { srot = p.spin; L0.a = 0.7; L0.b = 0.9; L1.a = -0.4; L1.b = 1.2; A0.a = 2.6; A0.b = 0.5; A1.a = -2.4; A1.b = 0.6; mouth = 1; }
        else { hipD = -3.5; lean = -1.52; L0.a = 1.9; L0.b = 0.7; L1.a = 1.5; L1.b = 0.05; A0.a = -0.35; A0.b = 0.35; A1.a = 2.85; A1.b = 0.2; eyes = 0; spread = 2; }
        break;
      }
    }
    // l'équipe qui vient d'encaisser (ou qui a perdu) baisse la tête : mains sur les genoux, sur la tête, bras ballants
    const dej = !ghost && st === ST.run && celeTeam >= 0 && team !== celeTeam && lastV && (lastV.phase === 'goal' || lastV.phase === 'end') && !app.drafting;
    if (dej) {
      const v = (i + (lastV.phase === 'end' ? 1 : 0)) % 3, br = Math.sin(now * 1.6 + i) * 0.04;
      if (v === 0) { lean = 0.72 + br; spread = 2.5; L0.a = 0.35; L0.b = 0.65; L1.a = 0.3; L1.b = 0.6; A0.a = 0.92; A0.b = 0.15; A0.o = 0.15; A1.a = 0.88; A1.b = 0.15; A1.o = 0.15; } // mains sur les genoux
      else if (v === 1) { lean = -0.04 + br; spread = 1.2; A0.a = 2.55; A0.b = 2.3; A0.o = 0.55; A1.a = 2.5; A1.b = 2.3; A1.o = 0.55; L0.a = 0.05; L0.b = 0.1; L1.a = -0.05; L1.b = 0.12; } // mains sur la tête
      else { lean = 0.3 + br; spread = 1; A0.a = -0.05; A0.b = 0.12; A0.o = 0.05; A1.a = -0.08; A1.b = 0.12; A1.o = 0.05; L0.a = 0.08; L0.b = 0.15; L1.a = -0.05; L1.b = 0.15; } // effondré
      mouth = 0;
    }
    // gestes spéciaux du gardien (scorpion, poing, sortie kamikaze, blindé)
    const gp = gk && GKP[i] && now - GKP[i][1] < GKPD[GKP[i][0]] && st !== ST.down ? GKP[i][0] : '';
    switch (gp) {
      case 'scorpion': lean = 1.3; lift = 10; L0.a = -2.4; L0.b = 1.7; L1.a = -2.0; L1.b = 1.3; A0.a = 1.8; A0.b = 0.1; A0.o = 0.3; A1.a = 1.8; A1.b = 0.1; A1.o = 0.3; mouth = 1; break;
      case 'poing': lean = -0.15; lift = 6; A0.a = 2.9; A0.b = 0.05; A0.o = 0.1; A1.a = 1.1; A1.b = 1.5; A1.p = -0.4; L0.a = 0.6; L0.b = 0.9; L1.a = -0.2; L1.b = 0.3; mouth = 1; break;
      case 'kamikaze': lean = 0.75; A0.a = 1.4; A0.b = 0.35; A0.o = 0.25; A1.a = 1.2; A1.b = 0.5; A1.o = 0.25; mouth = 1; break;
      case 'blinde': lean = -0.25; spread = 4; A0.a = 0.6; A0.b = 0.2; A0.o = 1.3; A1.a = 0.6; A1.b = 0.2; A1.o = 1.3; mouth = 1; break;
    }
    // hanche : posée sur la jambe la plus tendue
    const ext = l => 13 * Math.cos(l.a) + 13.5 * Math.cos(l.a - l.b);
    if (hipD === null) hipD = -Math.max(ext(L0), ext(L1), 15);
    if (glide > 0) hipD += (-26.4 - hipD) * glide;  // glisse : le bassin ne monte ni ne descend
    hipD -= lift;
    if (!ghost) { // fondu enchaîné entre l'ancienne pose et la nouvelle (easing doux)
      const S2 = PSB[i], key = st * 8 + (p.chg > 0 ? 2 : p.chg < 0 ? 4 : 0) + (st === ST.down && !DGR[i] && p.z > 3 ? 1 : 0) + ((st === ST.volley || st === ST.head) && AHIT[i] ? 1 : 0) + (st === ST.volley && p.z > 5 ? 2 : 0) + (gp ? 6000 + gp.length : 0) + (dej ? 3000 : 0);
      srot = Math.atan2(Math.sin(srot), Math.cos(srot)); // angle ramené dans [-π, π] pour un fondu au plus court
      const tv = [lean, hipD, spread, L0.a, L0.b, L1.a, L1.b, A0.a, A0.b, A1.a, A1.b, roll, tw, srot, A0.o, A0.p, A1.o, A1.p];
      if (!S2.init) { S2.init = true; S2.key = key; S2.cur = tv.slice(); S2.t = 1; S2.dur = 0.1; }
      if (key !== S2.key) {
        const was = (S2.key / 8) | 0; // on se relève d'une chute ou d'un tacle : le temps de se redresser
        S2.key = key; S2.from = S2.cur.slice(); S2.t = 0;
        S2.dur = isStrike(st) || st === ST.stag || st === ST.blast || st === ST.kick ? 0.065 : st === ST.down || st === ST.slide || st === ST.fly || st === ST.dive ? 0.09
          : (was === ST.down || was === ST.slide || was === ST.dive) && st === ST.run ? 0.3 : 0.17;
      }
      if (S2.t < S2.dur && S2.from) {
        S2.t += animDt; const u = Math.min(1, S2.t / S2.dur), e = u * u * (3 - 2 * u);
        for (let k = 0; k < tv.length; k++) tv[k] = S2.from[k] + (tv[k] - S2.from[k]) * e;
        [lean, hipD, spread, L0.a, L0.b, L1.a, L1.b, A0.a, A0.b, A1.a, A1.b, roll, tw, srot, A0.o, A0.p, A1.o, A1.p] = tv;
      }
      S2.cur = tv;
    } else if (ghostCol && PSB[i].cur) [lean, hipD, spread, L0.a, L0.b, L1.a, L1.b, A0.a, A0.b, A1.a, A1.b, roll, tw, srot, A0.o, A0.p, A1.o, A1.p] = PSB[i].cur;
    PO.lean = lean; PO.hipD = hipD; PO.spread = spread; PO.roll = roll; PO.tw = tw; PO.srot = srot; PO.mouth = mouth; PO.eyes = eyes; PO.fx = fx; PO.fy = fy; PO.dive = dive;
    PO.L0a = L0.a; PO.L0b = L0.b; PO.L1a = L1.a; PO.L1b = L1.b; PO.A0a = A0.a; PO.A0b = A0.b; PO.A0o = A0.o; PO.A0p = A0.p; PO.A1a = A1.a; PO.A1b = A1.b; PO.A1o = A1.o; PO.A1p = A1.p;
    PO.dej = dej; PO.gp = gp; PO.amp = amp;
    return PO;
  }

  /* ---------- de la pose aux articulations 3D (mêmes formules que la 2D, sans la projection) ---------- */
  // repère local du personnage (unités) : X devant, Y en haut, Z à sa droite ; (f, d, l) de la 2D -> (f, -d, l)
  const V3 = () => new THREE.Vector3();
  const JT = { hjR: V3(), knR: V3(), ftR: V3(), toR: V3(), hjL: V3(), knL: V3(), ftL: V3(), toL: V3(), sjR: V3(), elR: V3(), hdR: V3(), sjL: V3(), elL: V3(), hdL: V3(), nk: V3(), hc: V3(), Hc: V3(), Sc: V3() };
  const FR = { hX: V3(), hY: V3(), hZ: V3(), sX: V3(), sY: V3(), sZ: V3() };
  let jHipD = 0, jRoll = 0, jCr = 1, jSr = 0, jScF = 0, jScD = 0, jTc = 1, jTs = 0, jHc = 1, jHs = 0;
  function jP(f, d, l, v) { if (jRoll) { const dd = d - jHipD, l2 = l * jCr - dd * jSr; d = l * jSr + dd * jCr + jHipD; l = l2; } return v.set(f, -d, l); }
  function jPt(f, d, l, v) { const ff = f - jScF; return jP(jScF + ff * jTc - l * jTs, d, ff * jTs + l * jTc, v); }
  function jPh(f, d, l, v) { return jP(f * jHc - l * jHs, d, f * jHs + l * jHc, v); }
  function joints(L, po) {
    const BU = L.b, shW = BU[2], hpW = 4.8 + po.spread + (BU[3] - 7.4) * 0.6;
    jHipD = po.hipD; jRoll = po.roll; jCr = Math.cos(po.roll); jSr = Math.sin(po.roll);
    const sl = Math.sin(po.lean), cl = Math.cos(po.lean), TL = 20.5;
    jScF = sl * TL; jScD = po.hipD - cl * TL; jTc = Math.cos(po.tw); jTs = Math.sin(po.tw); jHc = Math.cos(-0.45 * po.tw); jHs = Math.sin(-0.45 * po.tw);
    for (const [a, b, s, H, K2, F, T] of [[po.L0a, po.L0b, 1, JT.hjR, JT.knR, JT.ftR, JT.toR], [po.L1a, po.L1b, -1, JT.hjL, JT.knL, JT.ftL, JT.toL]]) {
      jPh(0, po.hipD, s * hpW, H);
      const kf = 13 * Math.sin(a), kd = po.hipD + 13 * Math.cos(a); jP(kf, kd, s * (hpW + 0.4), K2);
      const sa = a - b, ff = kf + 13.5 * Math.sin(sa), fd = kd + 13.5 * Math.cos(sa); jP(ff, fd, s * (hpW + 0.6), F);
      jP(ff + 5.2 * Math.sin(sa + 1.5), fd + 5.2 * Math.cos(sa + 1.5), s * (hpW + 0.6), T);
    }
    for (const [a, b, o, pp, s, Sj, El, Hd] of [[po.A0a, po.A0b, po.A0o, po.A0p, 1, JT.sjR, JT.elR, JT.hdR], [po.A1a, po.A1b, po.A1o, po.A1p, -1, JT.sjL, JT.elL, JT.hdL]]) {
      jPt(jScF + sl * -1.5, jScD + cl * 1.5, s * shW, Sj);
      const g = po.lean + a, cg = Math.cos(g), q = o + pp;
      const ef = jScF - sl * 1.5 + 10.5 * Math.sin(g), ed = jScD + cl * 1.5 + 10.5 * cg * Math.cos(o), eL = shW + 0.8 + 10.5 * Math.abs(cg) * Math.sin(o);
      jPt(ef, ed, s * eL, El);
      const g2 = g + b, cg2 = Math.cos(g2);
      jPt(ef + 10 * Math.sin(g2), ed + 10 * cg2 * Math.cos(q), s * (eL - 0.2 + 10 * Math.abs(cg2) * Math.sin(q)), Hd);
    }
    jP(jScF + sl * 3.5, jScD - cl * 3.5, 0, JT.nk); jP(jScF + sl * 9.4, jScD - cl * 9.4, 0, JT.hc);
    jPh(0, po.hipD, 0, JT.Hc); jPt(jScF, jScD, 0, JT.Sc);
    // repères du bassin et des épaules
    FR.hY.subVectors(JT.Sc, JT.Hc).normalize(); FR.hZ.subVectors(JT.hjR, JT.hjL); FR.hZ.addScaledVector(FR.hY, -FR.hZ.dot(FR.hY)).normalize(); FR.hX.crossVectors(FR.hY, FR.hZ);
    FR.sY.copy(FR.hY); FR.sZ.subVectors(JT.sjR, JT.sjL); FR.sZ.addScaledVector(FR.sY, -FR.sZ.dot(FR.sY)).normalize(); FR.sX.crossVectors(FR.sY, FR.sZ);
  }
  const _ax = V3(), _ay = V3(), _az = V3(), _mm = new THREE.Matrix4();
  // segment construit le long de -Y : on le pose de A vers B ; refZ donne l'orientation autour du membre
  function setSeg(m, A, B, Lr, refZ, refX) {
    _ay.subVectors(A, B); const l = _ay.length() || 1; _ay.multiplyScalar(1 / l);
    _az.copy(refZ).addScaledVector(_ay, -refZ.dot(_ay));
    if (_az.lengthSq() < 0.04) { _ax.copy(refX).addScaledVector(_ay, -refX.dot(_ay)).normalize(); _az.crossVectors(_ax, _ay); }
    else { _az.normalize(); _ax.crossVectors(_ay, _az); }
    const s = Lr ? l / Lr : 1;
    m.matrix.set(_ax.x, _ay.x * s, _az.x, A.x, _ax.y, _ay.y * s, _az.y, A.y, _ax.z, _ay.z * s, _az.z, A.z, 0, 0, 0, 1);
  }
  function setFrame(m, O, X, Y, Z) { m.matrix.set(X.x, Y.x, Z.x, O.x, X.y, Y.y, Z.y, O.y, X.z, Y.z, Z.z, O.z, 0, 0, 0, 1); }
  // segment le long de +X (chaussure) : de A vers B, la latérale donne le haut
  function setSegX(m, A, B, refZ) {
    _ax.subVectors(B, A).normalize(); _az.copy(refZ).addScaledVector(_ax, -refZ.dot(_ax)).normalize(); _ay.crossVectors(_az, _ax);
    m.matrix.set(_ax.x, _ay.x, _az.x, A.x, _ax.y, _ay.y, _az.y, A.y, _ax.z, _ay.z, _az.z, A.z, 0, 0, 0, 1);
  }

  /* ---------- torse : anneaux en super-ellipse, du bassin aux épaules ---------- */
  const _rc = V3(), _rx = V3(), _ry = V3(), _rz = V3(), _tp = V3();
  function updTorso(rg, po) {
    const L = rg.L, BU = L.b, bw = BU[1], pos = rg.tgeo.attributes.position.array;
    const wH = BU[3] + po.spread * 0.5 + 0.9, wS = BU[2] + 1.7, dH = 4.7, dS = 5.1 * (bw > 1 ? 1.12 : 1);
    for (let r = 0; r < TNR; r++) {
      let u = (r - 1) / (TNR - 3), sc = 1, off = 0;
      if (r === 0) { u = 0; sc = 0.62; off = -2.6; } else if (r === TNR - 1) { u = 1; sc = 0.42; off = 2.6; }
      const e = u * u * (3 - 2 * u);
      _rc.lerpVectors(JT.Hc, JT.Sc, u);
      _rx.lerpVectors(FR.hX, FR.sX, e).normalize(); _ry.copy(FR.hY); _rz.lerpVectors(FR.hZ, FR.sZ, e).normalize();
      _rc.addScaledVector(_ry, off).addScaledVector(_rx, 0.9 * Math.sin(Math.PI * u));
      const w = (wH + (wS - wH) * Math.pow(u, 1.4) - 0.6 * Math.sin(Math.PI * u * 0.8)) * sc, dz = (dH + (dS - dH) * u + 0.7 * Math.sin(Math.PI * u)) * sc;
      for (let s = 0; s <= TNS; s++) {
        const ph = s / TNS * Math.PI * 2 - Math.PI / 2, cf = se(Math.cos(ph), 3.2), sf = se(Math.sin(ph), 3.2);
        _tp.copy(_rc).addScaledVector(_rx, cf * dz).addScaledVector(_rz, -sf * w);
        const k = (r * (TNS + 1) + s) * 3; pos[k] = _tp.x; pos[k + 1] = _tp.y; pos[k + 2] = _tp.z;
      }
    }
    rg.tgeo.attributes.position.needsUpdate = true;
    rg.tgeo.computeVertexNormals();
    const n = rg.tgeo.attributes.normal.array; // couture : normales moyennées
    for (let r = 0; r < TNR; r++) { const a = r * (TNS + 1) * 3, b = (r * (TNS + 1) + TNS) * 3; for (let c = 0; c < 3; c++) { const v = (n[a + c] + n[b + c]) / 2; n[a + c] = v; n[b + c] = v; } }
    rg.tgeo.attributes.normal.needsUpdate = true;
  }

  /* ---------- accessoires animés : capes, robe, queues, pendule ---------- */
  const _q1 = V3(), _q2 = V3(), _q3 = V3(), _q4 = V3();
  function updCloth(rg, po, i, now) {
    const L = rg.L, BU = L.b, shW = BU[2], flow = Math.min(1, po.amp || 0), wag = Math.sin(now * 9 + i * 1.3);
    const sl = Math.sin(po.lean), cl = Math.cos(po.lean), hipD = po.hipD;
    if (rg.cape) { // cape / manteau : accrochée aux épaules, elle flotte derrière quand il court
      const c = rg.cape, pos = c.g.attributes.position.array, mantle = L.pe.prop === 'mantle';
      const wv = Math.sin(now * 7 + i) * 1.6 * flow, drop = mantle ? 14 : 21;
      jPt(jScF - 4.2 * cl, jScD + 1 - 4.2 * sl, shW + 0.8, _q1); jPt(jScF - 4.2 * cl, jScD + 1 - 4.2 * sl, -(shW + 0.8), _q2);
      jP(-7.5 - 12 * flow, hipD + drop - 6 * flow + wv, shW + 4, _q3); jP(-7.5 - 12 * flow, hipD + drop - 6 * flow - wv, -(shW + 4), _q4);
      for (let r = 0; r <= c.rows; r++) for (let k = 0; k <= c.cols; k++) {
        const v = r / c.rows, u = k / c.cols, bul = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 2.2;
        const x = (_q2.x + (_q1.x - _q2.x) * u) * (1 - v) + (_q4.x + (_q3.x - _q4.x) * u) * v - bul - 0.6;
        const y = (_q2.y + (_q1.y - _q2.y) * u) * (1 - v) + (_q4.y + (_q3.y - _q4.y) * u) * v;
        const z = (_q2.z + (_q1.z - _q2.z) * u) * (1 - v) + (_q4.z + (_q3.z - _q4.z) * u) * v;
        const j = (r * (c.cols + 1) + k) * 3; pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
      }
      c.g.attributes.position.needsUpdate = true; c.g.computeVertexNormals();
    }
    if (rg.robe) { // robe de la Faucheuse : du bassin aux genoux
      const c = rg.robe, pos = c.g.attributes.position.array;
      for (let r = 0; r <= c.rows; r++) for (let k = 0; k <= c.cols; k++) {
        const v = r / c.rows, a = k / c.cols * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        jPh(ca * 5 * cl, hipD - 3 + ca * 5 * sl, sa * (BU[3] + 1.9), _q1);
        jP(-2 - 4 * flow + ca * 7, hipD + 17 - 2 * flow, sa * (BU[3] + 5.5), _q2);
        _q1.lerp(_q2, v);
        const j = (r * (c.cols + 1) + k) * 3; pos[j] = _q1.x; pos[j + 1] = _q1.y; pos[j + 2] = _q1.z;
      }
      c.g.attributes.position.needsUpdate = true; c.g.computeVertexNormals();
    }
    if (rg.tail) { // queues : renard (touffue), chat (en point d'interrogation), tigre (rayée)
      const OF = L.of, p = [V3(), V3(), V3(), V3()];
      jPh(-4 * cl, hipD + 1, 0, p[0]);
      if (OF.foxtail) { jP(-9 - 5 * flow, hipD + 8 - 2 * flow + wag * 0.6, wag * 1.5, p[1]); jP(-13 - 6 * flow, hipD + 7 - 4 * flow + wag, wag * 2, p[2]); jP(-16 - 7 * flow, hipD + 4 - 5 * flow + wag, wag * 2.5, p[3]); }
      else if (OF.cattail) { jP(-10 - 3 * flow, hipD - 2, wag * 1.2, p[1]); jP(-12 - 4 * flow, hipD - 13 + wag, wag * 2, p[2]); jP(-8 - 5 * flow, hipD - 18 + wag * 1.4, wag * 2.5, p[3]); }
      else { jP(-9 - 3 * flow, hipD + 10, wag * 1.5, p[1]); jP(-15 - 5 * flow, hipD + 9 - 2 * flow + wag * 0.6, wag * 2.5, p[2]); jP(-18 - 6 * flow, hipD + 2 - 3 * flow + wag * 1.4, wag * 3, p[3]); }
      for (let k = 0; k < 3; k++) setSeg(rg.tail[k], p[k], p[k + 1], 10, FR.hZ, FR.hX);
      if (rg.tailTip) setSegX(rg.tailTip, p[3], p[2], FR.hZ);
    }
    if (rg.coat) for (const [k, l] of [[0, 3], [1, -3]]) { jPh(-4 * cl, hipD - 3, l, _q1); jP(-7 - 7 * flow, hipD + 12 - 3 * flow, l * 1.5, _q2); setSeg(rg.coat[k], _q1, _q2, 10, FR.hZ, FR.hX); }
    if (rg.pend) { const sw = Math.sin(now * 3.4 + i) * 0.7; _q1.copy(JT.hdR); _q2.set(_q1.x + Math.sin(sw) * 11, _q1.y - Math.cos(sw) * 11, _q1.z); setSeg(rg.pend, _q1, _q2, 0, FR.sZ, FR.sX); }
  }

  /* ---------- tout le personnage pour une image ---------- */
  const _yaw = new THREE.Euler();
  function updRig(rg, p, i, dt) {
    const L = rg.L, now = performance.now() / 1000, po = poseOf(p, i);
    joints(L, po);
    const S2 = rg.seg, hipY = -po.hipD;
    // corps entier : roulade (saltos, K.O. qui vrille) autour des hanches, plongeon du gardien sur le côté
    rg.body.position.set(0, hipY, 0); rg.body.rotation.set(po.dive * 1.25, 0, -po.srot, 'XYZ'); rg.inner.position.set(0, -hipY, 0);
    setSeg(S2.thighR, JT.hjR, JT.knR, 13, FR.hZ, FR.hX); setSeg(S2.shinR, JT.knR, JT.ftR, 13.5, FR.hZ, FR.hX); setSegX(S2.footR, JT.ftR, JT.toR, FR.hZ);
    setSeg(S2.thighL, JT.hjL, JT.knL, 13, FR.hZ, FR.hX); setSeg(S2.shinL, JT.knL, JT.ftL, 13.5, FR.hZ, FR.hX); setSegX(S2.footL, JT.ftL, JT.toL, FR.hZ);
    setSeg(S2.uarmR, JT.sjR, JT.elR, 10.5, FR.sZ, FR.sX); setSeg(S2.farmR, JT.elR, JT.hdR, 10, FR.sZ, FR.sX); setSeg(S2.handR, JT.hdR, _q1.copy(JT.hdR).multiplyScalar(2).sub(JT.elR), 0, FR.sZ, FR.sX);
    setSeg(S2.uarmL, JT.sjL, JT.elL, 10.5, FR.sZ, FR.sX); setSeg(S2.farmL, JT.elL, JT.hdL, 10, FR.sZ, FR.sX); setSeg(S2.handL, JT.hdL, _q1.copy(JT.hdL).multiplyScalar(2).sub(JT.elL), 0, FR.sZ, FR.sX);
    setSeg(S2.neck, JT.hc, JT.nk, 0, FR.sZ, FR.sX); // le cou part de la tête vers les épaules
    _q2.subVectors(JT.hc, JT.nk).normalize(); _q3.copy(FR.sX).addScaledVector(_q2, -FR.sX.dot(_q2)).normalize(); _q4.crossVectors(_q3, _q2);
    setFrame(S2.head, JT.hc, _q3, _q2, _q4);
    setFrame(rg.chest, JT.Sc, FR.sX, FR.sY, FR.sZ); setFrame(rg.hips, JT.Hc, FR.hX, FR.hY, FR.hZ);
    updTorso(rg, po); updCloth(rg, po, i, now);
    // racine : position, orientation (le corps pivote, cf. FA), écrasement / étirement
    const sq = i < 8 && !app.drafting ? SQ[i] : 0, sc = U3 * L.b[0];
    let hop = 0; if (HOP[i] > 0) hop = Math.sin(Math.PI * clamp(1 - HOP[i] / 0.32, 0, 1)) * 26;
    rg.root.position.set(p.x * U3, (p.z + hop) * U3, p.y * U3);
    rg.root.rotation.set(0, Math.atan2(-po.fy, po.fx), 0);
    rg.root.scale.set(sc * (1 + sq * 0.55), sc * (1 - sq), sc * (1 + sq * 0.55));
    // visage : bouche, yeux K.O., clignements, blessures
    const blv = BLV(p.dmg || 0), blink = (((now + i * 1.7) % 3.7) < 0.12) ? 1 : 0, spiral = L.f.spiral ? ((now * 12) | 0) : 0;
    const fk = (po.mouth ? 1 : 0) + '|' + (po.eyes === 0 ? 1 : 0) + '|' + blv + '|' + blink + '|' + spiral + '|' + GORE;
    if (fk !== rg.fkey) { rg.fkey = fk; paintFace(rg, { mouth: po.mouth, ko: po.eyes === 0, blv, blink, t: now, look: 0 }); }
    const dirt = i < 8 ? Math.round((DIRT[i] || 0) * 8) / 8 : 0, jk = dirt + '|' + (blv >= 2 ? blv : 0) + '|' + GORE;
    if (jk !== rg.jkey) { rg.jkey = jk; paintJersey(rg, L, PAL[rg.team], rg.gk, dirt, blv); }
    // éclat d'impact (blanc puis rouge), invulnérabilité (clignote)
    const hf = i < 8 ? (HITT[i] - performance.now()) / 1000 : 0;
    const em = hf > 0 ? Math.min(0.95, hf * 10) : 0, emc = hf > 0.05 ? 0xffffff : 0xff2a1e;
    const blinkOff = p.inv && ((performance.now() / 70) | 0) % 2;
    if (rg.em !== em || rg.emc !== emc) { rg.em = em; rg.emc = emc; for (const m of rg.mats) { m.emissive.setHex(emc); m.emissiveIntensity = em * 1.4; } }
    if (rg.bo !== blinkOff) { rg.bo = blinkOff; for (const m of rg.mats) m.opacity = blinkOff ? 0.4 : 1; }
    return po;
  }
