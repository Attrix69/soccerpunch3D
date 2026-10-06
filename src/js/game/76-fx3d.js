  /* =============== EFFETS 3D des événements (en plus des effets de la version 2D) =============== */
  const yawOf = (dx, dy) => Math.atan2(-(dy || 0), dx || 1);
  function nearestP(x, y) { if (!lastV) return null; let best = null, bd = 1e9; for (let i = 0; i < 8; i++) { const p = lastV.players[i], d = len(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } } return best; }
  function fx3D(e, demo) {
    switch (e.k) {
      case 'kick': if ((e.p || 0) > 60) vfx('fx_dust', e.x, e.y, 0, { scale: 0.35, s1: 0.7, life: 0.45, dark: '#4a4034', dark2: '#5a4a36' }); break;
      case 'swing': { // traînée du coup : un croissant dans le sens de la frappe
        const p = nearestP(e.x, e.y); if (!p) break;
        vfx(e.n === 3 ? 'fx_upper' : 'fx_slash', e.x + p.fx * 16, e.y + p.fy * 16, e.n === 3 ? 30 : 42, { c1: '#ffffff', c0: '#fff6e0', int: 1.2, scale: 0.9, s1: 1.4, life: 0.18, grow: 0.5, yaw: yawOf(p.fx, p.fy), roll: e.n === 2 ? Math.PI : 0 });
        break;
      }
      case 'punch':
        vfx('fx_slash', e.x - (e.dx || 0) * 10, e.y - (e.dy || 0) * 10, 44, { c1: e.hv ? '#ff6a3a' : '#ffd23a', c0: '#ffffff', scale: 0.9 + e.n * 0.2, s1: 1.5 + e.n * 0.3, life: 0.2, yaw: yawOf(e.dx, e.dy), roll: e.n === 2 ? Math.PI : 0 });
        vfx('fx_burst_s', e.x, e.y, 44, { c1: '#ffd23a', c0: '#ffffff', c2: '#ff8a1a', scale: 0.5, s1: 1.1 + e.n * 0.2, life: 0.2, yaw: R() * 6 });
        crowdHype(e.a, 0.35, 0.6);
        break;
      case 'hit': {
        const big = e.kd === 'fly' || e.kd === 'gk' || e.kd === 'kamikaze' || e.kd === 'beam' || e.kd === 'combo' || e.kd === 'assassin' || e.kd === 'patate' || e.kd === 'boule' || e.kd === 'charge' || e.f > 480;
        if (e.kd === 'gkp' || e.kd === 'body') { vfx('fx_burst_s', e.x, e.y, 34, { c1: '#ffffff', c0: '#ffffff', c2: '#ffd23a', scale: 0.5, s1: 1, life: 0.2 }); break; }
        vfx(big ? 'fx_burst_l' : 'fx_burst', e.x, e.y, 40, { c1: big ? '#ff6a1a' : '#ffd23a', c0: '#ffffff', c2: big ? '#ff2a1e' : '#ff8a1a', scale: big ? 0.8 : 0.6, s1: big ? 2.2 : 1.4, life: big ? 0.32 : 0.24, yaw: R() * 6, pitch: R() });
        if (big) { vfx('fx_shock', e.x, e.y, 0, { c1: '#ff4a2a', c0: '#ffd8c8', scale: 0.8, s1: 3.2, life: 0.5, grow: 0.7, dark2: '#3a3026' }); vfx('fx_shockcres', e.x, e.y, 38, { c1: '#ffffff', c0: '#ffffff', scale: 1, s1: 1.9, life: 0.22, yaw: yawOf(e.dx, e.dy) }); }
        crowdHype(e.a >= 0 ? e.a : -1, big ? 0.85 : 0.5, big ? 1.6 : 0.9);
        if (big && !demo && e.d >= 6 && R() < 0.4) screenMsg('K.O. !', '#ff2a1e', 1.4);
        break;
      }
      case 'stomp':
        vfx('fx_shock_l', e.x, e.y, 0, { c1: '#ff3a1e', c0: '#ffd0c0', scale: 0.6, s1: 2.6, life: 0.55, grow: 0.6 });
        vfx('fx_burst', e.x, e.y, 16, { c1: '#ff2a1e', c0: '#ffffff', c2: '#ff6a00', scale: 0.7, s1: 1.6, life: 0.25 });
        crowdHype(e.a, 0.9, 1.6); break;
      case 'thud': { const v = clamp((e.v - 150) / 500, 0, 1); if (v > 0.25 && !e.n) vfx('fx_dust', e.x, e.y, 0, { scale: 0.5 + v * 0.6, s1: 1 + v * 1.4, life: 0.6, dark: '#4a4034', dark2: '#5a4a36', yaw: R() * 6 }); break; }
      case 'slam':
        vfx('fx_sparkfan', e.x, e.y, 26, { c2: '#ffd23a', c0: '#ffffff', scale: 1.4, s1: 2.2, life: 0.35, yaw: yawOf(-(e.dx || 0), -(e.dy || 0)) + Math.PI / 2 });
        vfx('fx_burst', e.x, e.y, 30, { c1: '#c9ccd2', c0: '#ffffff', c2: '#ff6a3a', scale: 0.7, s1: 1.6, life: 0.25 });
        vfx('fx_dust', e.x, e.y, 0, { scale: 0.7, s1: 1.6, life: 0.8, dark: '#5a5e66', dark2: '#7a7a80' });
        crowdHype(-1, 0.8, 1.4); break;
      case 'slide': vfx('fx_dust', e.x, e.y, 0, { scale: 0.3, s1: 0.8, life: 0.5, dark: '#4a4034', dark2: '#5a4a36' }); break;
      case 'land': case 'dive': vfx('fx_dust', e.x, e.y, 0, { scale: 0.3, s1: 0.75, life: 0.45, dark: '#4a4034', dark2: '#5a4a36' }); break;
      case 'quake':
        vfx('fx_shock_l', e.x, e.y, 0, { c1: e.m ? '#ff9a3c' : '#d9b27a', c0: '#fff1d6', scale: 1, s1: e.r * U3 * 2.6, life: 0.7, grow: 0.6, dark2: '#5a4a36' });
        vfx('fx_dust', e.x, e.y, 0, { scale: 1.2, s1: 3, life: 1.1, dark: '#5a4a36', dark2: '#7a6248' }); break;
      case 'post': vfx('fx_sparkfan', e.x, e.y, e.z || 50, { c2: '#ffd23a', c0: '#ffffff', scale: 1, s1: 1.8, life: 0.3, yaw: R() * 6 }); break;
      case 'save': {
        const kc = e.ul ? '#c6ff1a' : '#9fd3ff';
        vfx('fx_parry', e.x, e.y, 40, { c0: '#ffffff', c2: kc, scale: e.big ? 1.2 : 0.8, s1: e.big ? 2.4 : 1.5, life: 0.3, yaw: R() * 6 });
        if (e.big) vfx('fx_shock', e.x, e.y, 0, { c1: kc, c0: '#ffffff', scale: 0.8, s1: 2.6, life: 0.45 });
        crowdHype(e.t, e.big ? 0.8 : 0.45, 1.2); break;
      }
      case 'deflect': vfx('fx_parry', e.x, e.y, 30, { c0: '#ffffff', c2: '#9fd3ff', scale: 0.6, s1: 1.2, life: 0.22 }); break;
      case 'dodge': vfx('fx_parry', e.x, e.y, 30, { c0: '#ffffff', c2: '#7dff9a', scale: 0.7, s1: 1.5, life: 0.3 }); vfx('fx_spinring', e.x, e.y, 3, { c0: '#ffffff', c1: '#7dff9a', scale: 0.8, s1: 2, life: 0.35 }); break;
      case 'kiball': { const c = KICOL[e.t]; vfx('fx_muzzle', e.x, e.y, 30, { c2: c[1], c0: c[0], scale: 0.5, s1: 1.1, life: 0.2, yaw: R() * 6 }); break; }
      case 'kiboom': { const c = KICOL[e.t]; vfx('fx_dome', e.x, e.y, 0, { c1: c[1], c0: c[0], scale: 0.5, s1: 2.2, life: 0.4, grow: 0.4, int: 0.6 }); vfx('fx_burst', e.x, e.y, 30, { c1: c[1], c0: '#ffffff', c2: c[2], scale: 0.7, s1: 1.8, life: 0.3 }); break; }
      case 'beam': { const c = KICOL[e.t]; vfx('fx_shock_l', e.x, e.y, 0, { c1: c[1], c0: c[0], scale: 1, s1: 4, life: 0.6 }); vfx('fx_dome', e.x, e.y, 0, { c1: c[1], c0: c[0], scale: 0.6, s1: 2.4, life: 0.45, int: 0.6 }); crowdHype(e.t, 1, 2); break; }
      case 'super': {
        const p = e.i >= 0 && lastV ? lastV.players[e.i] : null, dx = p ? p.fx : 1, dy = p ? p.fy : 0;
        const c = e.uk ? (UCOL[e.uk] || UCOL.upper) : e.u ? ['#ff1e2e', '#ffffff', '#ff6070'] : ['#ff8a1a', '#fff1c2', '#ff3a1a'];
        if (!e.uk) { vfx('fx_shockcres', e.x, e.y, 26, { c1: c[0], c0: '#ffffff', scale: 1.2, s1: 2.6, life: 0.35, yaw: yawOf(dx, dy) }); vfx('fx_shock', e.x, e.y, 0, { c1: c[0], c0: c[1], scale: 0.8, s1: 3, life: 0.5 }); }
        crowdHype(e.t, 0.9, 2); break;
      }
      case 'aerial': if (e.s) { vfx('fx_burst', e.x, e.y, e.z || 40, { c1: '#ffd23a', c0: '#ffffff', c2: '#ff6a00', scale: 0.8, s1: 2, life: 0.3 }); crowdHype(e.t, 0.8, 1.5); } break;
      case 'flick': vfx('fx_spinring', e.x, e.y, 4, { c0: '#ffffff', c1: '#fff6c0', scale: 0.6, s1: 1.4, life: 0.3 }); crowdHype(e.t, 0.5, 1); break;
      case 'fly': vfx('fx_shockcres', e.x, e.y, 34, { c1: '#ff2a1e', c0: '#ffffff', scale: 0.9, s1: 1.6, life: 0.3, yaw: R() * 6 }); break;
      case 'punt': vfx('fx_shock', e.x, e.y, 0, { c1: e.ob ? '#c6ff1a' : '#9fd3ff', c0: '#ffffff', scale: 0.5, s1: 1.8, life: 0.35 }); break;
      case 'tr':
        if (e.s === 'mur' || e.s === 'blinde') vfx('fx_dome', e.x, e.y, 0, { c1: e.s === 'mur' ? '#9fd3ff' : '#c6ff1a', c0: '#ffffff', scale: 0.8, s1: 1.8, life: 0.4, int: 0.8 });
        else if (e.s === 'berserk') vfx('fx_burst_l', e.x, e.y, 40, { c1: '#ff2a1e', c0: '#ffd0c0', c2: '#ff2a1e', scale: 0.8, s1: 2.2, life: 0.4 });
        else if (e.s === 'poing' || e.s === 'scorpion') vfx('fx_burst', e.x, e.y, 60, { c1: '#ff6a3a', c0: '#ffffff', c2: '#ffd23a', scale: 0.7, s1: 1.6, life: 0.25 });
        else if (e.s === 'transe') vfx('fx_charge', e.x, e.y, 40, { c1: '#a66bff', c0: '#ffffff', scale: 0.6, s1: 1.4, life: 0.5 });
        break;
      case 'whistle': if (!demo) { vfx('fx_shock_l', W / 2, H / 2, 0, { c1: '#ffffff', c0: '#ffffff', scale: 1, s1: 6, life: 0.8, grow: 0.7 }); crowdHype(-1, 0.9, 2.2); } break;
      case 'golden': crowdHype(-1, 1, 2.5); screenMsg('BUT EN OR', '#ffb400', 2.4); break;
      case 'goal': {
        const T = TEAMS[e.t], gx = e.x < W / 2 ? -GD : W + GD;
        crowdHype(e.t, 1, 5); crowdHype(1 - e.t, 0.15, 0.1); screenMsg(e.own ? 'CSC !' : 'BUUUUT !', T.c1, 3.2);
        ledGoal.t = performance.now() + 3600; ledGoal.team = e.t;
        // pyrotechnie derrière la cage : colonnes de feu et gerbes d'étincelles
        for (const gy of [MT - 40, MB + 40]) { vfx('fx_ember', gx, gy, 0, { c0: '#fff1c2', c2: '#ff6a00', dark: '#2a2420', scale: 1.4, s1: 2.4, sy: 2.6, life: 1.6, grow: 0.2, hold: 0.5 }); flashLight(gx, gy, 60, '#ff8a2a', 0.5, 1.6, 1.4); }
        vfx('fx_shock_l', e.x, e.y, 0, { c1: T.c1, c0: '#ffffff', scale: 1, s1: 5, life: 0.9 });
        break;
      }
      case 'end': { const wt = app.world ? app.world.winner : lastV ? lastV.winner : -1; if (wt >= 0) { crowdHype(wt, 1, 9); screenMsg(TEAMS[wt].name, TEAMS[wt].c1, 6); } break; }
    }
  }
