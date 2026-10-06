  /* =============== MUSIQUE PROCÉDURALE (Web Audio) ===============
     Un séquenceur 16 pas à 124 BPM en mi mineur, joué en direct (aucun fichier à charger) :
     menu = nappe sombre + basse + batterie en demi-temps ; match = groove plus discret dont
     l'intensité monte (caisse claire, accords, clapping du public) dans la dernière minute,
     au but en or et pendant les gros combos. */
  const MUS = {
    mode: 'off', bpm: 124, step: 0, bar: 0, next: 0, timer: 0, inten: 0, boost: 0,
    // progression : Mi m — Mi m — Do — Ré (fondamentales en Hz)
    roots: [82.41, 82.41, 65.41, 73.42],
    start() {
      if (this.timer || !AU.c) return;
      this.next = AU.c.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 25);
    },
    set(mode) { if (mode === this.mode) return; this.mode = mode; this.step = 0; this.bar = 0; if (AU.c) this.next = AU.c.currentTime + 0.08; AU.vol(); },
    tick() {
      const c = AU.c; if (!c || c.state !== 'running' || this.mode === 'off' || OPT.music <= 0.001) { if (c) this.next = c.currentTime + 0.05; return; }
      const sp = 60 / this.bpm / 4; // durée d'une double croche
      if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.05; // l'onglet s'est endormi : on repart proprement
      while (this.next < c.currentTime + 0.12) { this.play(this.step, this.next, sp); this.next += sp; if (++this.step >= 16) { this.step = 0; this.bar = (this.bar + 1) % 4; } }
      if (this.boost > 0) this.boost = Math.max(0, this.boost - 0.025 * 0.4);
    },
    // instruments
    kick(t, v) { const c = AU.c, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g); g.connect(AU.mus); o.start(t); o.stop(t + 0.3); },
    noise(t, type, f, q, d, v) { const c = AU.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = AU.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl); fl.connect(g); g.connect(AU.mus); s.start(t, R() * 1.5); s.stop(t + d + 0.02); },
    tone(t, type, f, d, v, cut, q) { const c = AU.c, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut * 2.2, t); fl.frequency.exponentialRampToValueAtTime(cut, t + d * 0.6); fl.Q.value = q || 1; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl); fl.connect(g); g.connect(AU.mus); o.start(t); o.stop(t + d + 0.02); },
    play(st, t, sp) {
      const root = this.roots[this.bar], menu = this.mode === 'menu', I = menu ? 0.55 : Math.min(1, this.inten + this.boost);
      // batterie
      if (menu ? st === 0 || st === 10 : st % 4 === 0) this.kick(t, menu ? 0.9 : 0.75);
      if (st % 2 === 0) this.noise(t, 'highpass', 8000, 0.8, st === 14 ? 0.12 : 0.035, menu ? 0.12 : 0.09 + 0.06 * I);
      if ((menu ? st === 8 : st === 4 || st === 12) && (menu || I > 0.45)) { this.noise(t, 'bandpass', 1900, 0.9, 0.16, 0.35); this.tone(t, 'triangle', 190, 0.08, 0.18, 900); }
      if (!menu && I > 0.6 && (st === 4 || st === 12)) for (let k = 0; k < 3; k++) this.noise(t + R() * 0.02, 'bandpass', 1200 + R() * 800, 1.4, 0.05, 0.1); // le public frappe dans ses mains
      // basse : croches qui cognent, saut d'octave
      if ([0, 2, 3, 6, 8, 10, 11, 14].includes(st)) this.tone(t, 'sawtooth', root * (st === 6 || st === 14 ? 2 : 1), sp * 1.6, menu ? 0.22 : 0.18, menu ? 420 : 520, 4);
      // accords de puissance (quinte + octave) quand ça chauffe
      if ((menu ? st === 0 && this.bar % 2 === 0 : I > 0.7 && (st === 2 || st === 10)))
        for (const m of [2, 3, 4]) this.tone(t, 'square', root * m, menu ? sp * 14 : sp * 1.5, menu ? 0.03 : 0.035, menu ? 1300 : 2200, 1);
      // nappe sombre du menu
      if (menu && st === 0) for (const m of [2, 2.378, 3]) this.tone(t, 'sawtooth', root * m * 1.002, sp * 16, 0.025, 700, 0.5);
    }
  };

