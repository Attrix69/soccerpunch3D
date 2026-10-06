  /* =============== SON (Web Audio : synthèse + bruitages enregistrés) =============== */
  const AU = {
    c: null, out: null, noise: null, crowdG: null, base: 0, smp: {},
    init() {
      if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try {
        const c = this.c = new AC();
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(c.destination);
        // filtre maître : au ralenti, le monde devient sourd (le son « sous l'eau » des grosses collisions)
        const lp = this.lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.9; lp.connect(comp);
        this.out = c.createGain(); this.out.gain.value = 0.8 * OPT.sfx; this.out.connect(lp);
        // bus musique : passe par le filtre maître (étouffée au ralenti) mais pas par la réverbération ; « ducking » sur les gros chocs
        this.mus = c.createGain(); this.mus.gain.value = 0; this.musD = c.createGain(); this.musD.gain.value = 1; this.mus.connect(this.musD); this.musD.connect(lp);
        // réverbération du stade : les impacts résonnent sous le toit
        try {
          const rv = c.createConvolver(), L = (c.sampleRate * 2.2) | 0, ir = c.createBuffer(2, L, c.sampleRate);
          for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < L; i++) { const t = i / c.sampleRate; d[i] = t < 0.012 ? 0 : (R() * 2 - 1) * Math.pow(1 - i / L, 3.2) * (t < 0.09 && R() < 0.02 ? 3 : 1); } }
          rv.buffer = ir; const rs = c.createGain(); rs.gain.value = 0.2; this.out.connect(rs); rs.connect(rv); rv.connect(lp); this.rvs = rs;
        } catch (e) { /* pas de réverb */ }
        const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = R() * 2 - 1;
        this.noise = buf;
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.5;
        const g = c.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(this.out); src.start();
        this.crowdG = g;
        MUS.mode = app.mode === 'menu' ? 'menu' : 'match'; this.vol(); MUS.start();
        this.loadSmp();
      } catch (e) { this.c = null; }
    },
    ok() { return this.c && this.c.state === 'running'; },
    loadSmp() { // décodage asynchrone : tant qu'un son n'est pas prêt, la synthèse prend le relais
      if (typeof SFXD === 'undefined') return;
      for (const name in SFXD) {
        const bin = atob(SFXD[name]), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const key = name.replace(/-\d+$/, '');
        const done = b => { // on saute le silence que l'encodeur MP3 laisse en tête
          const d = b.getChannelData(0); let pk = 0, i = 0;
          for (let j = 0; j < d.length; j++) pk = Math.max(pk, Math.abs(d[j]));
          while (i < d.length && Math.abs(d[i]) < pk * 0.02) i++;
          (this.smp[key] = this.smp[key] || []).push({ b, o: Math.max(0, i / b.sampleRate - 0.0005) });
        };
        try { const p = this.c.decodeAudioData(u.buffer, done, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) { /* son ignoré */ }
      }
    },
    play(key, vol, rate, delay) { // rate omis : variation aléatoire, et plus grave au ralenti
      const L = this.smp[key]; if (!L || !this.ok()) return false;
      let k = (R() * L.length) | 0; if (L.length > 1 && k === L.last) k = (k + 1) % L.length; L.last = k;
      const c = this.c, s = c.createBufferSource(), g = c.createGain();
      s.buffer = L[k].b; s.playbackRate.value = rate || (0.93 + R() * 0.14) * (this.sl < 1 ? 0.7 + 0.3 * this.sl : 1);
      g.gain.value = vol; s.connect(g); g.connect(this.out); s.start(c.currentTime + (delay || 0), L[k].o);
      return true;
    },
    lastCall: 0,
    call(k, delay) { // l'annonceur du stade : « FIGHT! », « COMBO! », « YOU WIN! »…
      if (!OPT.voice || !this.ok() || !this.smp['vo_' + k]) return;
      const now = this.c.currentTime; if (now - this.lastCall < 0.6) return; this.lastCall = now;
      this.play('vo_' + k, 0.95, 1, delay); this.duck(0.45, 0.9);
    },
    ult(k) { // signature sonore de chaque ULTIME
      const o = (t, a, b, d, v, dl) => this.osc(t, a, b, d, v, dl), z = (t, a, b, d, v, q, dl) => this.nz(t, a, b, d, v, q, dl);
      switch (k) {
        case 'upper': this.punch(2); o('sawtooth', 120, 900, 0.55, 0.22); z('bandpass', 400, 3000, 0.6, 0.35, 2); break;
        case 'rouleau': z('lowpass', 160, 50, 1.8, 0.7, 1); o('sine', 55, 38, 1.4, 0.45); break;
        case 'fauche': o('triangle', 900, 160, 0.8, 0.22); z('bandpass', 3200, 500, 0.8, 0.35, 5); break;
        case 'seisme': o('sine', 75, 28, 1.1, 0.65); z('lowpass', 260, 60, 1.2, 0.6); break;
        case 'thor': z('highpass', 5000, 900, 0.35, 0.7); z('lowpass', 320, 70, 1.4, 0.6); break;
        case 'faucon': o('sawtooth', 1700, 2600, 0.25, 0.12); o('sawtooth', 2600, 1300, 0.45, 0.12, 0.25); break;
        case 'abra': [880, 1108, 1318, 1760, 2217].forEach((f, n) => o('sine', f, f, 0.35, 0.16, n * 0.07)); break;
        case 'encre': o('sine', 320, 70, 0.3, 0.35); o('sine', 260, 60, 0.3, 0.3, 0.18); z('lowpass', 900, 200, 0.5, 0.3); break;
        case 'fil': [523, 587, 659, 784, 880, 1047, 1175].forEach((f, n) => o('triangle', f, f, 0.4, 0.13, n * 0.05)); break;
        case 'crescendo': o('sawtooth', 220, 880, 1.4, 0.14); o('square', 330, 1320, 1.4, 0.07); o('triangle', 110, 440, 1.4, 0.18); break;
        case 'couronne': o('square', 523, 523, 0.16, 0.14); o('square', 659, 659, 0.16, 0.14, 0.15); o('square', 784, 784, 0.45, 0.16, 0.3); o('square', 1047, 1047, 0.5, 0.1, 0.3); break;
        case 'bond': this.roar(1); this.swish(1); break;
        case 'stampede': for (let n = 0; n < 9; n++) z('lowpass', 220, 90, 0.14, 0.55, 1, n * 0.085); this.roar(0.7); break;
        case 'ruse': o('sine', 1100, 1800, 0.12, 0.16); o('sine', 1800, 900, 0.18, 0.16, 0.14); break;
        case 'bordee': this.boom(1.4); z('lowpass', 900, 50, 1.4, 0.95); break;
      }
    },
    osc(type, f0, f1, dur, vol, delay) {
      if (!this.ok()) return;
      const c = this.c, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
    },
    nz(type, f0, f1, dur, vol, q, delay) {
      if (!this.ok()) return;
      const c = this.c, t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; f.type = type; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.out); s.start(t, R() * 1.5); s.stop(t + dur + 0.05);
    },
    kick(p) {
      p = clamp(p, 0.2, 1.2);
      if (this.play('kk', 0.8 * p)) { this.play('tap', 0.3 * p, 0.9 + p * 0.3); this.osc('sine', 150, 38, 0.12, 0.3 * p); this.nz('bandpass', 1800, 900, 0.05, 0.2 * p, 1.2); return; }
      this.osc('sine', 150, 38, 0.17, 0.75 * p); this.nz('bandpass', 1800, 900, 0.06, 0.35 * p, 1.2);
    },
    boom(p) { p = clamp(p, 0.3, 1.3); this.osc('sine', 95, 24, 0.55, 1.0 * p); this.osc('triangle', 60, 30, 0.35, 0.4 * p); this.nz('lowpass', 1400, 120, 0.45, 0.7 * p, 0.7); },
    crunch(p) { this.nz('bandpass', 2400, 700, 0.07, 0.55 * p, 2.5); this.nz('bandpass', 1600, 500, 0.06, 0.45 * p, 3, 0.035); this.nz('highpass', 3500, 3500, 0.03, 0.25 * p, 1, 0.012); },
    bonk() { this.osc('triangle', 760, 170, 0.15, 0.22); },
    swish(p) { p = p || 1; if (!this.play('sw', 0.4 * p)) this.nz('bandpass', 600, 3400, 0.24, 0.24 * p, 1.4); },
    whoosh(big) { this.nz('bandpass', 260, 4500, big ? 0.9 : 0.6, 0.42, 0.9); this.osc('sawtooth', 60, big ? 700 : 480, big ? 0.85 : 0.6, 0.07); },
    post() { const s = this.play('post', 0.85) ? 0.6 : 1; this.osc('sine', 1320, 1290, 0.8, 0.28 * s); this.osc('sine', 2650, 2600, 0.55, 0.1 * s); this.osc('triangle', 660, 650, 0.35, 0.14 * s); },
    wall(v) { const p = clamp(v / 1200, 0.15, 1); this.osc('sine', 150, 60, 0.11, 0.45 * p); this.nz('lowpass', 700, 300, 0.09, 0.2 * p); },
    grab() { this.osc('sine', 320, 120, 0.12, 0.35); this.nz('lowpass', 1300, 400, 0.08, 0.22); },
    click() { if (!this.play('uiclk', 0.45)) this.osc('square', 900, 700, 0.05, 0.06); },
    beep(f, d) { this.osc('square', f, f, d || 0.12, 0.11); },
    whistle(kind) {
      if (!this.ok()) return;
      const c = this.c;
      const blast = (st, dur) => {
        const t = c.currentTime + st, o = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
        o.frequency.value = 2860; o2.frequency.value = 2945; lfo.frequency.value = 32; lg.gain.value = 75;
        lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); o2.connect(g); g.connect(this.out);
        [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
      };
      if (kind === 2) { blast(0, 0.32); blast(0.42, 0.32); blast(0.84, 0.95); }
      else if (kind === 1) { blast(0, 0.22); blast(0.3, 0.22); }
      else blast(0, 0.45);
    },
    roar(level) {
      if (!this.ok() || !this.crowdG) return;
      const g = this.crowdG.gain, t = this.c.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(this.base + 0.55 * level, t + 0.25);
      g.linearRampToValueAtTime(this.base + 0.12 * level, t + 1.6);
      g.linearRampToValueAtTime(this.base, t + 3.4);
    },
    vol() { // volumes réglables dans les options
      if (!this.c) return;
      const t = this.c.currentTime;
      this.out.gain.setTargetAtTime(0.8 * OPT.sfx, t, 0.05);
      this.mus.gain.setTargetAtTime(0.5 * OPT.music * (MUS.mode === 'match' ? 0.62 : 1), t, 0.2);
    },
    duck(a, d) { // la musique s'efface un instant sous les gros impacts
      if (!this.ok() || !this.musD) return;
      const g = this.musD.gain, t = this.c.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1 - a, t + 0.03); g.linearRampToValueAtTime(1, t + 0.03 + (d || 0.5));
    },
    ui(k) { // sons d'interface
      if (!this.ok()) return;
      if (k === 'hover') { if (!this.play('uihov', 0.22)) this.osc('triangle', 1700, 1500, 0.035, 0.035); }
      else if (k === 'ok') { if (!this.play('uiok', 0.5)) this.osc('square', 520, 780, 0.08, 0.07); this.osc('sine', 160, 60, 0.14, 0.4); this.nz('bandpass', 1200, 3000, 0.12, 0.12, 1.5); }
      else if (k === 'back') { if (!this.play('uiback', 0.5)) { this.osc('square', 620, 360, 0.09, 0.06); this.nz('lowpass', 900, 300, 0.08, 0.1); } }
      else if (k === 'pick') { this.osc('sine', 120, 50, 0.16, 0.6); this.nz('bandpass', 700, 2600, 0.14, 0.18, 1.2); if (!this.play('uipick', 0.55)) this.osc('triangle', 880, 1320, 0.07, 0.05, 0.03); }
    },
    fanfare(win) { // jingle de fin de match
      if (!this.ok()) return;
      const c = this.c, t0 = c.currentTime + 0.05;
      const brass = (f, st, d, v) => { const o = c.createOscillator(), o2 = c.createOscillator(), f2 = c.createBiquadFilter(), g = c.createGain(), t = t0 + st;
        o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.006; f2.type = 'lowpass'; f2.Q.value = 2;
        f2.frequency.setValueAtTime(400, t); f2.frequency.exponentialRampToValueAtTime(2400, t + 0.06); f2.frequency.exponentialRampToValueAtTime(900, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.setValueAtTime(v, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(f2); o2.connect(f2); f2.connect(g); g.connect(this.out); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05); };
      if (win) { // victoire : montée de cuivres, foule en délire
        [[[164.8, 207.7, 246.9], 0, 0.18], [[164.8, 207.7, 246.9], 0.2, 0.18], [[220, 277.2, 329.6], 0.42, 0.22], [[246.9, 311.1, 370], 0.68, 0.22], [[329.6, 415.3, 493.9], 0.95, 1.4]]
          .forEach(([ch, st, d]) => ch.forEach(f => brass(f, st, d, 0.07)));
        this.boom(0.9); this.roar(1); this.horn();
        for (let k = 0; k < 5; k++) this.nz('bandpass', 1400, 1400, 0.05, 0.25, 1.2, 1.2 + k * 0.22);
      } else { // défaite : accord mineur qui s'effondre, la foule soupire
        [[[110, 130.8, 164.8], 0, 0.7], [[103.8, 123.5, 155.6], 0.75, 0.7], [[82.4, 98, 123.5], 1.5, 1.6]].forEach(([ch, st, d]) => ch.forEach(f => brass(f, st, d, 0.06)));
        this.ooh(0.6);
      }
    },
    chant() { // les supporters tapent dans leurs mains : « CLAP CLAP · CLAP CLAP CLAP »
      if (!this.ok()) return;
      const b = 60 / 124, pat = [0, 0.5, 1.5, 2, 2.5];
      for (const st of pat) for (let k = 0; k < 4; k++) this.nz('bandpass', 1100 + R() * 900, 0, 0.04, 0.09, 1.4, st * b + R() * 0.03);
    },
    ambient(on) {
      this.base = on ? 0.07 : 0;
      if (!this.ok() || !this.crowdG) return;
      const g = this.crowdG.gain, t = this.c.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(this.base, t + 0.8);
    },
    punch(n) {
      if (this.play(n >= 2 ? 'ph' : 'pm', 0.7 + n * 0.1)) { this.osc('sine', 130 - n * 15, 40, 0.12 + n * 0.03, 0.4); return; }
      this.osc('sine', 130 - n * 15, 40, 0.12 + n * 0.03, 0.75); this.nz('bandpass', 1500, 500, 0.06, 0.5, 2); this.nz('lowpass', 900, 200, 0.1, 0.35 * n);
    },
    kiball() { this.osc('sawtooth', 220, 900, 0.18, 0.08); this.osc('sine', 1200, 300, 0.25, 0.18); this.nz('bandpass', 3000, 900, 0.2, 0.12, 2); },
    charge() { this.osc('sawtooth', 70, 160, 1.4, 0.07); this.osc('sine', 140, 420, 1.4, 0.12); this.nz('bandpass', 400, 2000, 1.4, 0.12, 1.5); },
    beam() { this.osc('sawtooth', 90, 55, 0.9, 0.16); this.osc('square', 180, 120, 0.8, 0.05); this.nz('bandpass', 900, 2600, 0.9, 0.5, 0.7); this.boom(1); },
    horn() { [55, 82.5, 110, 165].forEach((f, i) => this.osc('sawtooth', f, f * 1.01, 1.4, 0.08, i * 0.02)); },
    goal() { this.roar(1); this.horn(); this.boom(0.8); },
    /* ----- la chair et les os ----- */
    flesh(p) {
      p = clamp(p, 0.2, 1.4);
      if (!this.play('hit', 0.4 * p)) this.nz('bandpass', 1150, 380, 0.07, 0.6 * p, 1.3);
      this.nz('lowpass', 520, 140, 0.13, 0.55 * p, 0.8);
    },
    bone(p) { // craquement d'os : une salve de clics secs
      if (!this.ok()) return; p = clamp(p, 0.2, 1.3);
      let d = 0; const n = 3 + ((R() * 3) | 0);
      for (let k = 0; k < n; k++) { this.nz('highpass', 2600 + R() * 2600, 0, 0.01 + R() * 0.014, (0.45 + R() * 0.45) * p, 0.7, d); d += 0.005 + R() * 0.022; }
      this.osc('square', 2100, 420, 0.035, 0.1 * p);
    },
    thud(p) { // un corps qui s'écrase sur la pelouse
      p = clamp(p, 0.2, 1.3);
      const s = this.play('th', 0.85 * p) ? 0.5 : 1;
      this.osc('sine', 88, 30, 0.34, 0.95 * p * s); this.nz('lowpass', 460, 80, 0.36, 0.6 * p * s, 0.8); this.nz('bandpass', 2400, 800, 0.08, 0.16 * p, 1.4, 0.008);
    },
    slam(p) { this.thud(p); this.osc('triangle', 140, 60, 0.3, 0.5 * p); this.nz('bandpass', 700, 300, 0.4, 0.5 * p, 3, 0.01); this.osc('sine', 610, 590, 0.6, 0.06 * p, 0.02); }, // béton + vibration du muret
    lastV: 0,
    voice(kind, pitch, vol) { // cris synthétisés (formants) : « HAN ! », « OUGH… », « AAAARGH ! »
      if (!this.ok()) return;
      const c = this.c, now = c.currentTime; if (now - this.lastV < 0.08) return; this.lastV = now;
      const ko = kind === 'ko', eff = kind === 'eff', t = now + (ko ? 0.035 : 0.005);
      const dur = ko ? 0.5 + R() * 0.25 : eff ? 0.15 : 0.22 + R() * 0.08, v = (vol || 0.3) * (ko ? 1.1 : 1);
      const f0 = (pitch || 1) * (eff ? 155 : 128) * (0.88 + R() * 0.3);
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * (ko ? 1.35 : 1.12), t); o.frequency.exponentialRampToValueAtTime(f0 * (ko ? 0.55 : 0.75), t + dur);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = ko ? 19 : 31; lg.gain.value = f0 * (ko ? 0.09 : 0.05); lfo.connect(lg); lg.connect(o.frequency);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.018); g.gain.setValueAtTime(v, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const F = ko ? [[640, 1], [1080, 0.55], [2450, 0.22]] : eff ? [[760, 1], [1200, 0.6], [2600, 0.2]] : [[430, 1], [820, 0.5], [2450, 0.18]];
      for (const [f, a] of F) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (0.93 + R() * 0.14); bp.Q.value = 5; const ga = c.createGain(); ga.gain.value = a * 2.6; o.connect(bp); bp.connect(ga); ga.connect(g); }
      const s = c.createBufferSource(), sf = c.createBiquadFilter(), sg = c.createGain(); s.buffer = this.noise; sf.type = 'bandpass'; sf.frequency.value = 1600; sf.Q.value = 0.8; sg.gain.value = 0.22;
      s.connect(sf); sf.connect(sg); sg.connect(g);
      g.connect(this.out);
      o.start(t); lfo.start(t); s.start(t, R() * 1.5); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); s.stop(t + dur + 0.05);
    },
    lastO: 0,
    ooh(level) { // la foule réagit au massacre : « OOOOH ! »
      if (!this.ok()) return;
      const c = this.c, now = c.currentTime; if (now - this.lastO < 0.7) return; this.lastO = now;
      const t = now + 0.06, dur = 1.25 + 0.4 * level, v = 0.16 * clamp(level, 0.3, 1.4);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.18); g.gain.setValueAtTime(v, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(560, t); bp.frequency.exponentialRampToValueAtTime(360, t + dur);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; bp.connect(lp); lp.connect(g); g.connect(this.out);
      const os = [];
      for (let k = 0; k < 7; k++) { const o = c.createOscillator(); o.type = 'sawtooth'; const f = 150 + R() * 150; o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f * 0.86, t + dur); o.connect(bp); os.push(o); }
      const s = c.createBufferSource(), sg = c.createGain(); s.buffer = this.noise; sg.gain.value = 0.9; s.connect(sg); sg.connect(bp); os.push(s);
      for (const o of os) { o.start(t, o === s ? R() : 0); o.stop(t + dur + 0.05); }
    },
    heart() { this.osc('sine', 62, 40, 0.13, 0.55); this.osc('sine', 56, 36, 0.15, 0.42, 0.2); },
    splat() { this.nz('lowpass', 1400, 300, 0.16, 0.4, 1.2); this.nz('bandpass', 800, 300, 0.1, 0.3, 2, 0.04); },
    sl: 1,
    slow(ts) { // le son s'étouffe pendant le ralenti
      if (!this.ok() || !this.lp) return;
      const q = ts < 0.92 ? Math.round(ts * 10) / 10 : 1; if (q === this.sl) return; this.sl = q;
      this.lp.frequency.setTargetAtTime(q < 1 ? 520 + 2600 * q : 20000, this.c.currentTime, q < 1 ? 0.03 : 0.12);
    }
  };

  function vibe(p) {
    if (app.mode === 'menu' || !OPT.vib) return;
    if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* rien */ } }
    padRumble(p); // la manette vibre aussi
  }

