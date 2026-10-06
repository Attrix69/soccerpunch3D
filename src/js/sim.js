/* ================= TACLE FURY — SIMULATION (pure, sans DOM) ================= */
var TF = (function () {
  'use strict';
  const W = 1640, H = 980, GHW = 112, GD = 50, BARZ = 92, PR = 16, BR = 9;
  const FS = W / 1200; // échelle des distances tactiques (terrain agrandi)
  const KI1 = 1 / 3;  // coût d'une boule de ki
  const PACE = 0.8;   // rythme global du jeu (le chrono, lui, reste en temps réel)
  const ACC_RUN = 1150, ACC_BRK = 1900; // poussée max pour accélérer / freiner-tourner (unités/s²)
  const MT = H / 2 - GHW, MB = H / 2 + GHW;
  const GRAV = 1500, PGRAV = 1300, DEC = 330;
  const ST = { run: 0, slide: 1, fly: 2, down: 3, dash: 4, hold: 5, cele: 6, kick: 7, dive: 8, punch: 9, punch2: 10, hkick: 11, charge: 12, blast: 13, stag: 14, volley: 15, head: 16, stomp: 17 };
  const AERIAL = s => s === ST.volley || s === ST.head;
  const STRIKE = s => s === ST.punch || s === ST.punch2 || s === ST.hkick || s === ST.stomp;
  // K.O. dont la violence mérite un ralenti (le coup de grâce du combo, les spécialités qui détruisent)
  const BRUTAL = { combo: 1, patate: 1, boule: 1, assassin: 1, beam: 1, kamikaze: 1, fly: 1, gk: 1 };
  const PH = ['countdown', 'kickoff', 'play', 'goal', 'end'];
  const TEAMS = [
    { name: 'LOUPS', c1: '#e6e9ee', c2: '#15171b', acc: '#3cc8ff', gkc: '#c6ff1a', names: ['Kaiser', 'Vandal', 'Rex'], gk: 'Le Bunker' },
    { name: 'TAUREAUX', c1: '#d4141c', c2: '#140a0b', acc: '#ff7a00', gkc: '#ffb400', names: ['Brutus', 'Torro', 'Kong'], gk: 'Le Mur' }
  ];
  const ROLES = ['ATT', 'MIL', 'DEF', 'GK'];
  // SPÉCIALITÉS — ATT : frappe du tigre, coup de tête du buffle · MIL : technique et agile · DEF : costaud, tacle assassin, patate de forain
  const SPEC = {
    ATT: { spd: 1.0, acc: 1.0, turn: 14, own: 0.93, dashCd: 1.3, inv: 0.32, shot: 1.15, chg: 0.62, head: 1.5, tackle: 1, punch: 1, guard: 1, mass: 1, pass: 1 },
    MIL: { spd: 1.04, acc: 1.35, turn: 19, own: 0.99, dashCd: 0.75, inv: 0.42, shot: 1.0, chg: 0.8, head: 1.0, tackle: 0.95, punch: 0.95, guard: 0.9, mass: 0.85, pass: 1.12 },
    DEF: { spd: 0.95, acc: 0.88, turn: 11, own: 0.9, dashCd: 1.5, inv: 0.3, shot: 0.95, chg: 0.8, head: 1.1, tackle: 1.4, punch: 1.6, guard: 1.7, mass: 1.7, pass: 1 },
    GK: { spd: 1, acc: 1, turn: 14, own: 0.93, dashCd: 1.3, inv: 0.32, shot: 1.0, chg: 0.8, head: 1, tackle: 1, punch: 1, guard: 1.2, mass: 1.3, pass: 1 }
  };
  const SP = p => p.S;

  /* ===== EFFECTIF : 5 défenseurs, 5 milieux, 5 attaquants — chacun 2 spécialités (attaque / défense) =====
     st : v vitesse, t tir, h tête, k technique, d tacle, c combat, r résistance (de 1 à 5) */
  const ROSTER = [
    { id: 'fistinier', name: 'Le Fistinier', role: 'DEF', tag: 'Biker en cuir, des poings comme des enclumes', st: { v: 2, t: 2, h: 2, k: 2, d: 3, c: 5, r: 4 },
      atk: ['coude', 'Coup de coude', 'Ballon au pied, celui qui vient le cogner de face se prend un coup de coude.'],
      def: ['patate', 'Patate de forain', 'Un direct qui sonne… puis un crochet monstrueux qui envoie au tapis.'] },
    { id: 'bulldozer', name: 'Le Bulldozer', role: 'DEF', tag: 'Un chantier à lui tout seul', st: { v: 1, t: 2, h: 3, k: 1, d: 3, c: 3, r: 5 },
      atk: ['tank', 'Inarrêtable', 'Ballon au pied, tacles et coups le font vaciller mais jamais tomber.'],
      def: ['charge', "Charge d'épaule", 'En sprint, il renverse tout adversaire qu\'il percute.'] },
    { id: 'faucheuse', name: 'La Faucheuse', role: 'DEF', tag: 'Quand elle glisse, quelqu\'un ne se relève pas', st: { v: 3, t: 2, h: 2, k: 3, d: 5, c: 3, r: 3 },
      atk: ['faux', 'Coup de faux', 'Son tacle chargé à fond sur un ballon libre le transforme en frappe en feu.'],
      def: ['assassin', 'Tacle assassin', 'Tacle glissé à rallonge : K.O. plus long et plus sanglant.'] },
    { id: 'rempart', name: 'Le Rempart', role: 'DEF', tag: 'Ancien pilier de rugby, nez cassé quatre fois', st: { v: 2, t: 3, h: 4, k: 2, d: 4, c: 2, r: 5 },
      atk: ['tonnerre', 'Dégagement tonnerre', 'Ses frappes depuis son propre camp partent en feu.'],
      def: ['mur', 'Le Mur', 'Bloque les tirs qui passent près de lui, même en feu, sans broncher.'] },
    { id: 'viking', name: 'Le Viking', role: 'DEF', tag: 'Il a traversé la mer du Nord à la nage', st: { v: 3, t: 3, h: 4, k: 2, d: 3, c: 4, r: 4 },
      atk: ['boule', 'Coup de boule', 'Le 3e coup du combo est un coup de tête qui met K.O.'],
      def: ['berserk', 'Berserker', 'Plus il saigne, plus il est rapide, fort et dur au mal.'] },
    { id: 'prodige', name: 'Le Prodige', role: 'MIL', tag: 'Le ballon est son meilleur ami', st: { v: 4, t: 4, h: 3, k: 5, d: 2, c: 2, r: 2 },
      atk: ['comete', 'La Comète', 'Tir chargé à fond qui monte très haut puis plonge sous la barre.'],
      def: ['retour', 'Retour éclair', 'Bien plus rapide quand il court après le porteur adverse.'] },
    { id: 'magicien', name: 'Le Magicien', role: 'MIL', tag: 'Tu le vois, tu le vois plus', st: { v: 3, t: 3, h: 2, k: 5, d: 2, c: 2, r: 2 },
      atk: ['laser', 'Passe laser', 'Passes ultra rapides que personne ne peut couper.'],
      def: ['illusion', 'Illusion', 'Une fois sur deux, coups et tacles passent à travers lui.'] },
    { id: 'pieuvre', name: 'La Pieuvre', role: 'MIL', tag: 'Huit bras, zéro ballon perdu', st: { v: 3, t: 2, h: 3, k: 4, d: 4, c: 3, r: 3 },
      atk: ['ventouse', 'Ventouse', 'Contrôle tout, même les frappes, et ne lâche jamais le ballon sous les coups.'],
      def: ['tentacules', 'Tentacules', 'Intercepte les passes qui passent près de lui ; ses coups portent plus loin.'] },
    { id: 'funambule', name: 'Le Funambule', role: 'MIL', tag: 'Léger comme une plume, insaisissable', st: { v: 5, t: 2, h: 1, k: 5, d: 2, c: 1, r: 1 },
      atk: ['crochet', 'Crochet éclair', 'Esquives et sombreros à répétition, sans délai ni fatigue.'],
      def: ['sauterelle', 'Sauterelle', 'Saute tout seul par-dessus les tacles glissés.'] },
    { id: 'chef', name: "Le Chef d'Orchestre", role: 'MIL', tag: 'Il voit le jeu avant tout le monde', st: { v: 2, t: 3, h: 2, k: 4, d: 3, c: 2, r: 3 },
      atk: ['centre', 'Centre millimétré', 'Ses longues passes arrivent pile pour une volée ou une tête en feu.'],
      def: ['chef', 'Chef de défense', 'Tant qu\'il est debout, toute son équipe encaisse mieux les coups.'] },
    { id: 'prince', name: 'Le Petit Prince', role: 'ATT', tag: 'La classe, même les crampons en sang', st: { v: 4, t: 4, h: 3, k: 4, d: 1, c: 2, r: 2 },
      atk: ['lucarne', 'Lucarne royale', 'Tir chargé à fond : précision parfaite, pleine lucarne, loin du gardien.'],
      def: ['intouchable', 'Intouchable', 'Se relève deux fois plus vite et reste intouchable plus longtemps.'] },
    { id: 'tigre', name: 'Le Tigre', role: 'ATT', tag: 'Il rugit avant de frapper', st: { v: 4, t: 5, h: 2, k: 3, d: 2, c: 3, r: 3 },
      atk: ['tigre', 'Frappe du tigre', 'Tir chargé à fond ultra rapide qui renverse tout, gardien compris.'],
      def: ['bond', 'Bond du tigre', 'Coup de pied sauté plus long, rechargé deux fois plus vite.'] },
    { id: 'buffle', name: 'Le Buffle', role: 'ATT', tag: 'Un front en béton armé', st: { v: 2, t: 3, h: 5, k: 2, d: 2, c: 4, r: 4 },
      atk: ['buffle', 'Coup de tête du buffle', 'Têtes surpuissantes, en feu si bien dosées.'],
      def: ['cornes', 'Cornes', 'Gagne tous les duels aériens et bouscule celui qui saute avec lui.'] },
    { id: 'renard', name: 'Le Renard', role: 'ATT', tag: 'Toujours là où le ballon retombe', st: { v: 5, t: 3, h: 3, k: 3, d: 2, c: 1, r: 1 },
      atk: ['renard', 'Renard des surfaces', 'Près du but adverse : frappe instantanée et il attire les ballons qui traînent.'],
      def: ['pickpocket', 'Pickpocket', 'Chipe le ballon au porteur en arrivant dans son dos.'] },
    { id: 'canonnier', name: 'Le Canonnier', role: 'ATT', tag: 'Tatoué de la tête aux crampons', st: { v: 2, t: 5, h: 2, k: 2, d: 2, c: 3, r: 4 },
      atk: ['canon', 'Boulet de canon', 'De loin, ses tirs sont les plus rapides du jeu et assomment le gardien.'],
      def: ['barrage', 'Tir de barrage', 'Ses boules de ki coûtent moins cher et partent plus vite.'] }
  ];
  /* ===== GARDIENS (ids 15 à 19) — st : rf réflexes, pl plongeon, so sorties, re relance, ca carrure (de 1 à 5)
     atk = spécialité de RELANCE, def = spécialité d'ARRÊT ===== */
  ROSTER.push(
    { id: 'bunker', name: 'Le Bunker', role: 'GK', tag: 'Une armoire normande avec des gants', st: { rf: 2, pl: 2, so: 2, re: 3, ca: 5 },
      atk: ['obus', 'Dégagement obus', 'Ses dégagements partent tendus comme des obus, droit dans les pieds de son attaquant.'],
      def: ['blinde', 'Blindé', 'Les frappes en feu rebondissent bien plus souvent sur lui, même les ultimes. Il ne tombe jamais.'] },
    { id: 'chat', name: 'Le Chat', role: 'GK', tag: 'Neuf vies. Il en a déjà grillé six.', st: { rf: 5, pl: 5, so: 3, re: 3, ca: 1 },
      atk: ['eclair', 'Relance éclair', 'Il relance à la main en une fraction de seconde : une passe que personne ne peut couper.'],
      def: ['feline', 'Détente féline', 'Plongeons bien plus longs et rapides, et il se relève aussitôt pour replonger.'] },
    { id: 'boucher', name: 'Le Boucher', role: 'GK', tag: 'Il sort de sa cage comme un taureau de son box', st: { rf: 3, pl: 2, so: 5, re: 2, ca: 4 },
      atk: ['poing', 'Poings de fer', 'Il ne relâche jamais un ballon devant son but : il le boxe à cinquante mètres.'],
      def: ['kamikaze', 'Sortie kamikaze', 'Un attaquant entre dans sa zone ballon au pied ? Il jaillit et le découpe.'] },
    { id: 'hypno', name: "L'Hypnotiseur", role: 'GK', tag: 'Regarde-le dans les yeux… et rate ton tir', st: { rf: 4, pl: 3, so: 2, re: 3, ca: 2 },
      atk: ['transe', 'Transe', 'Chaque arrêt remplit la barre de ki de son équipe.'],
      def: ['hypnose', 'Mauvais œil', 'Les tirs adverses ralentissent en approchant de son but, même en feu.'] },
    { id: 'loco', name: 'El Loco', role: 'GK', tag: 'Gardien, libéro, buteur… et complètement fou', st: { rf: 3, pl: 4, so: 4, re: 5, ca: 2 },
      atk: ['libero', 'Libéro', 'Il sort de sa surface balle au pied et dribble comme un joueur de champ.'],
      def: ['scorpion', 'Le Scorpion', 'Les ballons hauts ne passent plus : il les sort d\'un coup du scorpion.'] }
  );
  // manière de frapper + ULTIME de chaque joueur
  const STYLE = {
    fistinier: ['pointu', 'upper', 'Uppercut de cuir', "D'un uppercut, il envoie le ballon dans les nuages… qui retombe comme une météorite devant le but."],
    bulldozer: ['rasante', 'rouleau', 'Rouleau compresseur', 'Un ballon géant qui roule et écrase tout ce qui se trouve sur son passage.'],
    faucheuse: ['enroulee', 'fauche', 'La Grande Faucheuse', 'Le ballon décrit un immense arc de faux et revient trancher le but.'],
    rempart: ['boulet', 'seisme', 'Séisme', 'Trois rebonds monstrueux : chaque impact fait trembler la terre et renverse les adversaires.'],
    viking: ['boulet', 'thor', 'Marteau de Thor', 'Le ballon file en zigzag d\'éclairs et foudroie ceux qui sont près des virages.'],
    prodige: ['enroulee', 'faucon', 'Envol du faucon', 'Le ballon monte en vrille dans le ciel puis plonge en piqué sous la barre.'],
    magicien: ['trivela', 'abra', 'Abracadabra', 'Le ballon disparaît en plein vol… et réapparaît au fond des filets.'],
    pieuvre: ['flottante', 'encre', "Jet d'encre", 'Le ballon ondule comme un tentacule et sonne tous ceux qu\'il frôle.'],
    funambule: ['pique', 'fil', "Le Fil d'or", "Le ballon marche sur un fil d'or, s'arrête en équilibre… puis part comme une flèche."],
    chef: ['precise', 'crescendo', 'Crescendo', 'Le ballon part pianissimo et finit fortissimo, en accélérant sans fin.'],
    prince: ['enroulee', 'couronne', 'Triple couronne', 'Trois ballons dorés se séparent : un seul est le vrai, et il finit pleine lucarne.'],
    tigre: ['boulet', 'bond', 'Griffes du tigre', 'Une frappe rasante qui lacère la pelouse puis bondit au dernier moment.'],
    buffle: ['boulet', 'stampede', 'Charge du buffle', 'Une tête atomique : le ballon fonce comme un troupeau et balaie tout le monde.'],
    renard: ['pointu', 'ruse', 'Ruse du renard', 'Le ballon file vers un poteau… et change de côté au dernier moment.'],
    canonnier: ['boulet', 'bordee', 'Bordée', 'Le tir le plus rapide du jeu : un recul énorme et un boulet qui traverse tout.']
  };
  const SHOTN = { pointu: 'Pointu sec', rasante: 'Frappe rasante', enroulee: 'Frappe enroulée', trivela: 'Extérieur du pied', flottante: 'Frappe flottante', pique: 'Frappe piquée', precise: 'Plat du pied millimétré', boulet: 'Gros boulet' };
  ROSTER.forEach(r => { const s = STYLE[r.id]; if (!s) { r.shot = ''; r.shotN = ''; r.ult = null; return; } r.shot = s[0]; r.shotN = SHOTN[s[0]]; r.ult = [s[1], s[2], s[3]]; });
  const BYROLE = { DEF: [0, 1, 2, 3, 4], MIL: [5, 6, 7, 8, 9], ATT: [10, 11, 12, 13, 14], GK: [15, 16, 17, 18, 19] };
  function specGK(r) { // un 3 partout = le gardien de base
    const s = r.st;
    return Object.assign({}, SPEC.GK, { spd: 0.91 + 0.03 * s.so, ref: 0.8 + 0.067 * s.rf, dive: 0.7 + 0.1 * s.pl, out: 0.7 + 0.1 * s.so,
      rel: 0.94 + 0.02 * s.re, carr: 0.7 + 0.1 * s.ca, zb: 0, guard: 0.8 + 0.2 * s.ca, mass: 0.9 + 0.15 * s.ca, pass: 0.94 + 0.04 * s.re });
  }
  function specFor(r) {
    const s = r.st;
    return { spd: 0.92 + 0.03 * s.v, acc: 0.8 + 0.11 * s.k, turn: 9 + 2 * s.k, own: 0.87 + 0.024 * s.k, dashCd: 1.6 - 0.18 * s.k, inv: 0.28 + 0.03 * s.k,
      shot: 0.9 + 0.055 * s.t, chg: 0.98 - 0.075 * s.t, head: 0.85 + 0.13 * s.h, tackle: 0.8 + 0.13 * s.d, punch: 0.8 + 0.18 * s.c,
      guard: 0.8 + 0.2 * s.r, mass: 0.7 + 0.2 * s.r, pass: 0.95 + 0.04 * s.k };
  }
  // composition au hasard (sans doublon entre les deux équipes)
  function randomPicks(taken) {
    const used = new Set(taken || []), out = [];
    for (const role of ['ATT', 'MIL', 'DEF', 'GK']) {
      const free = BYROLE[role].filter(i => !used.has(i)); const id = free[(R() * free.length) | 0];
      used.add(id); out.push(id);
    }
    return out;
  }
  const ULT_MAX = 1000; // l'ultime se déclenche à moins de 1000 du but adverse (à peu près depuis le rond central)
  const ultFar = p => len((p.team === 0 ? W : 0) - p.x, H / 2 - p.y) > ULT_MAX;
  const hasUp = (w, t, k) => { for (let i = 0; i < 4; i++) { const q = w.players[t * 4 + i]; if (q.tr[k] && q.st !== ST.down) return true; } return false; };
  const bzF = p => (p.tr.berserk ? clamp((p.dmg - 1) / 5, 0, 1) : 0);    // rage du berserker
  const inOwnBox = p => (p.team === 0 ? p.x < 205 : p.x > W - 205) && p.y > MT - 140 && p.y < MB + 140;
  const inBox = p => len((p.team === 0 ? W : 0) - p.x, H / 2 - p.y) < 330; // dans la zone du renard
  const bfx = (b, k) => b.fxk === k && b.fxBy === b.kickBy && b.kickT < 2.5; // effet spécial attaché au dernier tir
  const DIFF = {
    easy:   { react: 0.6,  acc: 1.7, speed: 0.9,  aggr: 0.45, gk: 0.82 },
    normal: { react: 0.85, acc: 1.0, speed: 1.0,  aggr: 0.7,  gk: 1.0 },
    hard:   { react: 1.05, acc: 0.7, speed: 1.06, aggr: 0.95, gk: 1.12 }
  };
  const EMPTY = { mx: 0, my: 0, a: false, b: false, sp: false, d: false, aN: 0, bN: 0, dN: 0 };
  const POSTS = [[0, MT], [0, MB], [W, MT], [W, MB]];

  const R = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const len = (x, y) => Math.sqrt(x * x + y * y);
  const rnd = (a, b) => a + R() * (b - a);
  function ev(w, k, o) { o = o || {}; o.k = k; w.ev.push(o); }

  /* ---------- création ---------- */
  function newWorld(opt) {
    opt = opt || {};
    const w = {
      t: 0, phase: 'countdown', phaseT: 3.2, clock: opt.dur || 180, golden: false, score: [0, 0],
      ts: 1, slowT: 0, ev: [], ended: false, winner: -1, kickTeam: 0, paused: false, resumeT: 0, celeTeam: -1,
      diff: DIFF[opt.diff || 'normal'] || DIFF.normal, teams: [], players: [], ball: null, proj: [], beams: []
    };
    let picks = opt.picks && opt.picks[0] && opt.picks[1] ? opt.picks.map(a => a.slice()) : (() => { const a = randomPicks(); return [a, randomPicks(a)]; })();
    for (let t = 0; t < 2; t++) if (!BYROLE.GK.includes(picks[t][3]) || (t === 1 && picks[1][3] === picks[0][3])) { // anciennes compositions sans gardien
      const free = BYROLE.GK.filter(i => i !== picks[1 - t][3]); picks[t][3] = free[(R() * free.length) | 0];
    }
    w.picks = picks;
    for (let t = 0; t < 2; t++) {
      const human = !!(opt.human && opt.human[t]);
      w.teams.push({
        id: t, human, ctrl: 0, bar: 0, swT: 0, lastSw: 9, lock: 0, beamCd: 0,
        prev: { a: false, b: false, d: false, aN: 0, bN: 0, dN: 0 },
        stats: [0, 0, 0, 0, 0, 0] // tirs, super tirs, buts, tacles, KO, passes
      });
      for (let i = 0; i < 4; i++) {
        w.players.push({
          id: t * 4 + i, team: t, idx: i, gk: i === 3, role: ROLES[i],
          name: ROSTER[picks[t][i]].name, rid: picks[t][i],
          S: i === 3 ? specGK(ROSTER[picks[t][i]]) : specFor(ROSTER[picks[t][i]]),
          tr: { [ROSTER[picks[t][i]].atk[0]]: 1, [ROSTER[picks[t][i]].def[0]]: 1 },
          coudeCd: 0, chCd: 0, stealCd: 0, bzOn: false, kamCd: 0, kamT: 0, kBy: null, bodyHits: [], gdone: false, landed: 0, inNet: false, slamCd: 0, stompT: null,
          x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fx: t ? -1 : 1, fy: 0, mx: 0, my: 0, smx: 0, smy: 0, spr: false,
          st: 0, t: 0, stun: 0, stam: 1, inv: 0, pickCd: 0, tackCd: 0, dashCd: 0, diveCd: 0, rec: 0,
          aAct: false, aHold: 0, chS: false, charge: 0, chT: false, tch: 0, slideC: 0, hits: [], spin: 0, spinV: 0,
          strikeCd: 0, comboN: 0, comboT: 0, flyCd: 0, qS: 0, hitAt: 0, hitDone: true, kiOn: false, kiH: 0, beamC: 0, dmg: 0, aT: 0, aX: 0, aY: 0, aQ: 0,
          aiAcc: human ? 1 : w.diff.acc,
          ai: { dec: 0, tx: 0, ty: 0, spr: false, shootH: -1, tackH: -1, tgt: null, holdT: 0, dx: 0, dy: 0, beamH: -1, sox: 0, soy: 0, supCar: null, supUntil: 0 }
        });
      }
    }
    w.ball = { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, sup: 0, kickBy: null, kickT: 9, passTo: null, last: null, wallT: 0, gp: null, uk: 0, curl: 0, knk: -1, cuBy: null };
    resetKickoff(w, R() < 0.5 ? 0 : 1);
    w.phase = 'countdown'; w.phaseT = 3.2;
    return w;
  }

  function resetKickoff(w, kt) {
    w.kickTeam = kt;
    const b = w.ball;
    Object.assign(b, { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, sup: 0, kickBy: null, kickT: 9, passTo: null, last: null, gp: null, uk: 0, curl: 0, knk: -1, cuBy: null });
    for (const p of w.players) {
      const s = p.team === 0 ? -1 : 1, k = p.team === kt;
      let x, y;
      if (p.gk) { x = p.team === 0 ? 24 : W - 24; y = H / 2; }
      else if (p.role === 'ATT') { x = W / 2 + s * (k ? 26 : 150 * FS); y = H / 2 + (k ? 0 : -40); }
      else if (p.role === 'MIL') { x = W / 2 + s * 220 * FS; y = H / 2 + (p.team ? -150 : 150) * FS; }
      else { x = W / 2 + s * 390 * FS; y = H / 2 + (p.team ? 110 : -110) * FS; }
      Object.assign(p, {
        x, y, z: 0, vx: 0, vy: 0, vz: 0, fx: -s, fy: 0, mx: 0, my: 0, smx: 0, smy: 0, spr: false, st: ST.run, t: 0, stun: 0, inv: 0,
        pickCd: 0, tackCd: 0, dashCd: 0, rec: 0, aAct: false, aHold: 0, chS: false, charge: 0, chT: false, tch: 0, spin: 0,
        strikeCd: 0, comboN: 0, comboT: 0, qS: 0, hitDone: true, kiOn: false, kiH: 0, beamC: 0
      });
      p.ai.shootH = -1; p.ai.tackH = -1; p.ai.holdT = 0; p.ai.tgt = null; p.ai.beamH = -1;
    }
    w.proj.length = 0; w.beams.length = 0;
    for (const tm of w.teams) { tm.ctrl = 0; tm.lock = 0; }
    w.phase = 'kickoff'; w.phaseT = 1.1; w.celeTeam = -1;
  }

  /* ---------- boucle ---------- */
  function step(w, dt, inputs) {
    if (w.paused) return;
    if (w.resumeT > 0) { w.resumeT -= dt; syncPrev(w, inputs); return; }
    w.t += dt;
    if (w.slowT > 0) { w.slowT -= dt; w.ts = 0.28; } else w.ts = Math.min(1, w.ts + dt * 2.5);
    const sd = dt * w.ts * PACE;
    switch (w.phase) {
      case 'countdown':
      case 'kickoff':
        w.phaseT -= dt;
        idle(w, sd);
        syncPrev(w, inputs);
        if (w.phaseT <= 0) {
          w.phase = 'play';
          ev(w, 'whistle', { w: 0 });
          const k = w.players[w.kickTeam * 4];
          possess(w, k); k.inv = 1.0;
        }
        break;
      case 'play':
        play(w, sd, inputs || []);
        if (w.golden) w.goldT = (w.goldT || 0) + dt;
        if (!w.golden && w.phase === 'play') {
          w.clock -= dt * w.ts;
          if (w.clock <= 0) {
            w.clock = 0;
            if (w.score[0] !== w.score[1]) {
              w.ended = true; w.winner = w.score[0] > w.score[1] ? 0 : 1;
              w.phase = 'end'; w.celeTeam = w.winner; ev(w, 'end', {});
            } else { w.golden = true; ev(w, 'golden', {}); }
          }
        }
        break;
      case 'goal':
        w.phaseT -= dt;
        ballPhys(w, sd, true);
        cele(w, sd);
        syncPrev(w, inputs);
        if (w.phaseT <= 0) {
          if (w.ended) { w.phase = 'end'; w.celeTeam = w.winner; ev(w, 'end', {}); }
          else resetKickoff(w, w.kickTeam);
        }
        break;
      case 'end':
        ballPhys(w, sd, true);
        cele(w, sd);
        syncPrev(w, inputs);
        break;
    }
  }

  function syncPrev(w, inputs) {
    if (!inputs) return;
    for (let t = 0; t < 2; t++) {
      const i = inputs[t]; if (!i) continue;
      w.teams[t].prev = { a: i.a, b: i.b, d: i.d, aN: i.aN, bN: i.bN, dN: i.dN };
    }
  }

  function idle(w, dt) {
    for (const p of w.players) { p.mx = 0; p.my = 0; p.spr = false; movePlayer(w, p, dt); }
  }

  function cele(w, dt) {
    for (const p of w.players) {
      if (p.st === ST.down) { movePlayer(w, p, dt); continue; }
      if (p.team === w.celeTeam && !p.gk) { if (p.st !== ST.cele) { p.st = ST.cele; p.vz = rnd(200, 360); } }
      else if (p.st !== ST.run) { p.st = ST.run; }
      p.mx = 0; p.my = 0; p.spr = false;
      movePlayer(w, p, dt);
    }
  }

  function play(w, dt, inputs) {
    for (const p of w.players) {
      p.pickCd -= dt; p.tackCd -= dt; p.dashCd -= dt; p.diveCd -= dt; p.strikeCd -= dt; p.flyCd -= dt; p.coudeCd -= dt; p.chCd -= dt; p.stealCd -= dt;
      if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.comboN = 0; }
      if (p.dmg > 0) p.dmg = Math.max(0, p.dmg - 0.04 * dt);
      if (p.inv > 0) p.inv -= dt;
      if (p.rec > 0) p.rec -= dt;
    }
    for (const tm of w.teams) {
      tm.lastSw += dt; if (tm.lock > 0) tm.lock -= dt; if (tm.beamCd > 0) tm.beamCd -= dt;
      if (tm.human) humanTeam(w, tm, inputs[tm.id] || EMPTY, dt);
    }
    for (const p of w.players) {
      if (p.st === ST.run || p.st === ST.hold || p.st === ST.kick) {
        const tm = w.teams[p.team];
        if (p.gk) { if (!(tm.human && tm.ctrl === p.idx)) aiKeeper(w, p, dt); }
        else if (!(tm.human && tm.ctrl === p.idx)) {
          aiField(w, p, dt);
          // l'IA ne change pas de cap d'un coup : ses intentions sont lissées
          if (p.st === ST.run || p.st === ST.hold || p.st === ST.kick) {
            const k = Math.min(1, 7 * dt);
            p.smx += (p.mx - p.smx) * k; p.smy += (p.my - p.smy) * k; p.mx = p.smx; p.my = p.smy;
          }
        } else { p.smx = p.mx; p.smy = p.my; }
      } else if (p.st === ST.charge && !(w.teams[p.team].human && w.teams[p.team].ctrl === p.idx)) aiCharge(w, p, dt);
      movePlayer(w, p, dt);
    }
    collide(w);
    bodyHits(w);
    pickpocket(w);
    ballPhys(w, dt, false);
    updProj(w, dt);
    updBeams(w, dt);
  }

  /* ---------- joueurs humains ---------- */
  function humanTeam(w, tm, inp, dt) {
    const pr = tm.prev;
    const aP = inp.aN > pr.aN, bP = inp.bN > pr.bN, dP = inp.dN > pr.dN;
    const aR = (pr.a && !inp.a) || (aP && !inp.a);
    const bR = (pr.b && !inp.b) || (bP && !inp.b);
    const dR = (pr.d && !inp.d) || (dP && !inp.d);
    tm.prev = { a: inp.a, b: inp.b, d: inp.d, aN: inp.aN, bN: inp.bN, dN: inp.dN };
    autoSwitch(w, tm, dt);
    let p = w.players[tm.id * 4 + tm.ctrl];
    const b = w.ball;
    let own = b.owner === p;
    let mx = inp.mx || 0, my = inp.my || 0;
    let m = len(mx, my); if (m > 1) { mx /= m; my /= m; m = 1; }
    const free = () => p.st === ST.run || p.st === ST.kick || (p.gk && p.st === ST.hold);

    // A : TIR (maintenir) / PASSE (tap) — sans ballon : FRAPPE (combo poing, poing, pied) ; en sprint : coup de pied sauté
    if (aP) {
      const plan = !own && (free() || STRIKE(p.st) || p.st === ST.dash) ? aerialPlan(w, p) : null;
      if (own) { p.aAct = true; p.aHold = 0; }
      else if (plan) { const t = aimTarget(w, p, m > 0.35 ? mx : 0, m > 0.35 ? my : 0); doAerial(w, p, plan, t.x, t.y); }
      else if (free() && p.spr && len(p.vx, p.vy) > 250 && p.flyCd <= 0 && p.stam > 0.2) {
        doFly(w, p, m > 0.3 ? mx : p.fx, m > 0.3 ? my : p.fy); p.flyCd = p.tr.bond ? 1.1 : 2.4; p.stam -= p.tr.bond ? 0.1 : 0.2;
      } else if (free() || STRIKE(p.st) || p.st === ST.dash) p.qS = 0.28;
    }
    if (p.qS > 0) { // appui mémorisé : volée/tête si le ballon devient jouable, sinon frappe
      p.qS -= dt;
      const plan = b.owner ? null : (free() || p.st === ST.dash) ? aerialPlan(w, p) : null;
      if (b.owner === p) p.qS = 0;
      else if (plan) { const t = aimTarget(w, p, m > 0.35 ? mx : 0, m > 0.35 ? my : 0); doAerial(w, p, plan, t.x, t.y); p.qS = 0; }
      else if (free() && p.strikeCd <= 0) { doStrike(w, p, m > 0.3 ? mx : 0, m > 0.3 ? my : 0); p.qS = 0; }
    }
    if (p.aAct) {
      if (!own || !(free() || p.st === ST.dash)) { p.aAct = false; p.chS = false; p.charge = 0; }
      else {
        p.aHold += dt;
        if (p.aHold > 0.14) { p.chS = true; p.charge = Math.min(1, (p.aHold - 0.14) / (SP(p).chg * (p.tr.renard && inBox(p) ? 0.33 : 1))); }
        if (aR || !inp.a) {
          if (p.aHold < 0.18) doPass(w, p, m > 0.3 ? mx : 0, m > 0.3 ? my : 0);
          else { const t = aimTarget(w, p, m > 0.35 ? mx : 0, m > 0.35 ? my : 0); doShoot(w, p, p.charge, false, t.x, t.y); }
          p.aAct = false; p.chS = false; p.charge = 0;
        }
      }
    }
    // B : TACLE (maintenir pour charger) — avec ballon : FEINTE
    if (bP) {
      if (b.owner === p) { if (p.gk && p.st === ST.hold) doPunt(w, p, mx, my); else if (p.st === ST.run || p.st === ST.kick) doDash(w, p, mx, my); }
      else if (free() && p.tackCd <= 0) { p.chT = true; p.tch = 0; }
    }
    if (p.chT) {
      if (b.owner === p || !free()) { p.chT = false; p.tch = 0; }
      else {
        p.tch += dt;
        if (bR || !inp.b) {
          doSlide(w, p, m > 0.3 ? mx : p.fx, m > 0.3 ? my : p.fy, Math.min(1, p.tch / 0.55), true);
          p.chT = false; p.tch = 0;
        }
      }
    }
    // D : SPÉCIAL — avec ballon : TIR ULTIME ; sans ballon : tap = BOULE DE KI, maintenir = charger le ki puis MÉGA RAYON
    if (dP) {
      if (b.owner === p) {
        if (p.gk) { if (p.st === ST.hold) doPunt(w, p, mx, my); }
        else if (tm.bar >= 1 && (free() || p.st === ST.dash)) {
          if (ultFar(p)) ev(w, 'ultfar', { x: p.x, y: p.y, t: p.team });   // trop loin : l'ultime se mérite
          else { const t = aimTarget(w, p, m > 0.35 ? mx : 0, m > 0.35 ? my : 0); doShoot(w, p, 1, true, t.x, t.y); tm.bar = 0; }
        }
      } else if (free() || p.st === ST.dash) { p.kiOn = true; p.kiH = 0; }
    }
    if (p.kiOn) {
      if (b.owner === p || !(free() || p.st === ST.charge || p.st === ST.dash)) { p.kiOn = false; if (p.st === ST.charge) p.st = ST.run; }
      else {
        p.kiH += dt;
        if (p.kiH > 0.2 && p.st !== ST.charge && free()) startCharge(w, p);
        if (p.st === ST.charge) chargeTick(w, p, dt);
        if (dR || !inp.d) {
          if (p.kiH <= 0.2) { if (free() || p.st === ST.dash) doKi(w, p, m > 0.3 ? mx : 0, m > 0.3 ? my : 0); }
          else if (p.st === ST.charge) { if (p.beamC >= 0.45 && tm.beamCd <= 0) doBeam(w, p, m > 0.3 ? mx : 0, m > 0.3 ? my : 0); else p.st = ST.run; }
          p.kiOn = false;
        }
      }
    }
    // gardien : s'il garde le ballon trop longtemps, il relance tout seul
    if (p.gk && b.owner === p && p.st === ST.hold) { p.ai.holdT += dt; if (p.ai.holdT > 4) gkDistribute(w, p); }
    // déplacement
    p.mx = mx; p.my = my; p.spr = !!inp.sp;
    if (b.passTo === p) { // réception assistée : on va vers le ballon (ou là où il va tomber)
      const L = landing(b), dx = (L ? L.x : b.x + b.vx * 0.12) - p.x, dy = (L ? L.y : b.y + b.vy * 0.12) - p.y, d = len(dx, dy);
      if (d > 18) {
        let ax = dx / d * 1.2 + mx * 0.6, ay = dy / d * 1.2 + my * 0.6;
        const am = len(ax, ay) || 1; p.mx = ax / am; p.my = ay / am;
      }
    }
  }

  function landing(b) { const L = b.land; return L && L.by === b.kickBy && b.kickT < L.t + 0.3 ? L : null; }
  function autoSwitch(w, tm, dt) {
    const b = w.ball, cur = w.players[tm.id * 4 + tm.ctrl];
    if (b.owner && b.owner.team === tm.id) { if (b.owner !== cur) setCtrl(w, tm, b.owner.idx); return; }
    if (b.passTo && b.passTo.team === tm.id) { if (b.passTo !== cur) setCtrl(w, tm, b.passTo.idx); return; }
    if (cur.gk) { // le gardien a relâché le ballon : on rend la main au joueur de champ le plus proche
      const tx = b.x + b.vx * 0.3, ty = b.y + b.vy * 0.3; let bi = 0, bd = 1e9;
      for (let i = 0; i < 3; i++) { const p = w.players[tm.id * 4 + i]; if (p.st === ST.down) continue; const d = len(p.x - tx, p.y - ty); if (d < bd) { bd = d; bi = i; } }
      setCtrl(w, tm, bi); return;
    }
    if (tm.lock > 0) return;
    if (cur.chT || cur.kiOn || cur.qS > 0 || cur.comboT > 0 || cur.st === ST.slide || cur.st === ST.fly || cur.st === ST.dash || STRIKE(cur.st) || AERIAL(cur.st) || cur.st === ST.charge || cur.st === ST.blast) return;
    tm.swT -= dt; if (tm.swT > 0) return; tm.swT = 0.1;
    const tx = b.owner ? b.owner.x : b.x + b.vx * 0.3, ty = b.owner ? b.owner.y : b.y + b.vy * 0.3;
    let best = null, bd = 1e9;
    for (let i = 0; i < 3; i++) {
      const p = w.players[tm.id * 4 + i]; if (p.st === ST.down) continue;
      const d = len(p.x - tx, p.y - ty); if (d < bd) { bd = d; best = p; }
    }
    if (!best || best === cur) return;
    const dc = cur.st === ST.down ? 1e9 : len(cur.x - tx, cur.y - ty);
    if (dc - bd > 75 && tm.lastSw > 0.5) setCtrl(w, tm, best.idx);
  }
  function setCtrl(w, tm, i) {
    const o = w.players[tm.id * 4 + tm.ctrl];
    o.aAct = false; o.chS = false; o.charge = 0; o.chT = false; o.tch = 0; o.qS = 0;
    if (o.kiOn) { o.kiOn = false; if (o.st === ST.charge) o.st = ST.run; }
    tm.ctrl = i; tm.lastSw = 0;
  }
  function manualSwitch(w, tm) {
    const b = w.ball, cur = tm.ctrl;
    let best = -1, bd = 1e9;
    for (let i = 0; i < 3; i++) {
      if (i === cur) continue;
      const p = w.players[tm.id * 4 + i]; if (p.st === ST.down) continue;
      const d = len(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) { setCtrl(w, tm, best); tm.lock = 0.9; }
  }

  /* ---------- actions ---------- */
  function aimTarget(w, p, ax, ay) {
    const gx = p.team === 0 ? W : 0, sg = p.team === 0 ? 1 : -1;
    const k = w.players[(1 - p.team) * 4 + 3];
    const am = len(ax, ay);
    if (am > 0.35) {
      const ux = ax / am, uy = ay / am, gdx = gx - p.x, gdy = H / 2 - p.y, gd = len(gdx, gdy) || 1;
      const cos = (ux * gdx + uy * gdy) / gd;
      if (cos > 0.17) return { x: gx + sg * 12, y: H / 2 + clamp(uy * 1.6, -1, 1) * GHW * 0.78, g: 1 };
      return { x: p.x + ux * 600, y: p.y + uy * 600, g: 0 };
    }
    return { x: gx + sg * 12, y: H / 2 + (k.y <= H / 2 ? 1 : -1) * GHW * rnd(0.45, 0.8), g: 1 };
  }

  function doShoot(w, p, c, ult, tx, ty) {
    const b = w.ball; if (b.owner !== p) return;
    const tm = w.teams[p.team], tr = p.tr, gx = p.team === 0 ? W : 0;
    if (p.gk) ult = false;                          // le gardien n'a ni super tir ni ultime : c'est une relance
    let sup = ult ? 2 : (c >= 0.97 && !p.gk ? 1 : 0);
    const toGoal = Math.abs(tx - gx) < 40;
    const far = len(gx - p.x, H / 2 - p.y) > 480, ownHalf = p.team === 0 ? p.x < W / 2 : p.x > W / 2;
    let sig = '';
    if (sup === 1 && toGoal) sig = tr.tigre ? 'tigre' : tr.lucarne ? 'lucarne' : tr.comete ? 'comete' : tr.canon && far ? 'canon' : '';
    if (!sup && tr.tonnerre && ownHalf && c > 0.45 && !p.gk) { sup = 1; sig = 'tonnerre'; } // DÉGAGEMENT TONNERRE
    if (sig === 'lucarne') { // pleine lucarne, côté opposé au gardien
      const k = w.players[(1 - p.team) * 4 + 3];
      tx = gx + (p.team === 0 ? 12 : -12); ty = H / 2 + (k.y <= H / 2 ? 1 : -1) * GHW * 0.84;
    }
    if (sup === 2 && !p.gk) { startUlt(w, p, tx, ty, toGoal); return; }
    const dx = tx - p.x, dy = ty - p.y, d = len(dx, dy) || 1;
    let ang = Math.atan2(dy, dx);
    // manière de frapper propre à chaque joueur (tirs normaux)
    const sty = !sup && toGoal && !p.gk ? ROSTER[p.rid].shot : '';
    const SS = { pointu: [1.05, 1.2], rasante: [1.06, 1], enroulee: [1, 0.7], trivela: [1, 0.8], flottante: [0.92, 1], pique: [0.86, 0.9], precise: [0.96, 0.45], boulet: [1.05, 1.15] }[sty] || [1, 1];
    const spread = sup === 2 || sig === 'lucarne' ? 0 : sup ? 0.02 : (0.025 + 0.06 * c) * (p.aiAcc || 1) * SS[1];
    ang += rnd(-spread, spread);
    const SM = { tigre: 1.12, canon: 1.25, lucarne: 1.04, comete: 0.95, tonnerre: 1.0 };
    const speed = sup === 2 ? 1680 : sup ? 1430 * (SM[sig] || 1) : (560 + 620 * c) * SP(p).shot * (tr.canon && far ? 1.25 : 1) * SS[0];
    const tg = Math.max(0.12, d / speed);
    let hz;
    if (!toGoal) hz = rnd(40, 140);
    else if (sup === 2) hz = 22;
    else if (sig === 'lucarne') hz = 74;
    else if (sup) hz = rnd(12, 45);
    else if (sty === 'rasante') hz = rnd(0, 9);
    else if (sty === 'pointu') hz = rnd(4, 42);
    else if (sty === 'pique') hz = rnd(48, 78);
    else if (sty === 'precise') hz = rnd(6, 50);
    else hz = R() < 0.1 + 0.08 * c ? rnd(92, 125) : rnd(4, 72);
    let vz = clamp((hz + 0.5 * GRAV * tg * tg) / tg, 40, 720);
    if (sty === 'rasante') vz = Math.min(vz, 40 + 0.5 * GRAV * tg);
    if (sig === 'comete') vz = cometeVz(b.z, tg, rnd(30, 62)); // monte très haut puis plonge
    // ENROULÉE / EXTÉRIEUR : le ballon part large puis revient (ou l'inverse) — FLOTTANTE : il danse
    let curl = 0;
    if (sty === 'enroulee' || sty === 'trivela') {
      const gx2 = gx - p.x, gy2 = H / 2 - p.y, cr = dx * gy2 - dy * gx2, s = Math.abs(cr) < 1 ? (R() < 0.5 ? 1 : -1) : Math.sign(cr);
      const th = sty === 'enroulee' ? 0.36 : -0.44;
      ang -= s * th / 2; curl = s * th / tg;
    }
    b.owner = null;
    b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; b.vz = vz; b.z = Math.max(b.z, 4);
    b.sup = sup; b.kickBy = p; b.kickT = 0; b.passTo = null; b.last = p;
    b.fxk = sig; b.fxBy = p;
    b.curl = curl; b.knk = sty === 'flottante' ? rnd(11, 15) : -1; b.cuBy = p; b.cuT = 0; b.cuEnd = tg * 1.25;
    p.pickCd = 0.35; p.st = ST.kick; p.t = 0.2; p.vx *= 0.3; p.vy *= 0.3;
    p.chS = false; p.charge = 0; p.aAct = false;
    tm.stats[0]++; if (sup) tm.stats[1]++;
    if (sup) { w.slowT = sup === 2 ? 0.85 : 0.55; ev(w, 'super', { x: p.x, y: p.y, t: p.team, u: sup === 2 ? 1 : 0, n: p.name, sig, i: p.id }); }
    else ev(w, 'kick', { x: p.x, y: p.y, p: Math.round(c * 100), i: p.id });
  }

  /* ---------- ULTIMES : une trajectoire guidée et un effet par joueur ---------- */
  const UV = { rouleau: 1050, fauche: 1250, seisme: 1100, thor: 1500, faucon: 1400, abra: 1300, encre: 1150, couronne: 1350, bond: 1650, stampede: 1700, ruse: 1550, bordee: 2350 };
  const UTZ = { upper: 30, rouleau: 0, fauche: 26, seisme: 0, thor: 28, faucon: 30, abra: 30, encre: 25, fil: 35, crescendo: 30, couronne: 64, bond: 60, stampede: 34, ruse: 22, bordee: 26 };
  function startUlt(w, p, tx, ty, toGoal) {
    const b = w.ball, tm = w.teams[p.team], k = ROSTER[p.rid].ult[0];
    const gx = p.team === 0 ? W : 0, sg = p.team === 0 ? 1 : -1, kp = w.players[(1 - p.team) * 4 + 3];
    // cible dans le but : là où le joueur vise, sinon loin du gardien
    let side = toGoal && Math.abs(ty - H / 2) > 8 ? Math.sign(ty - H / 2) : (kp.y <= H / 2 ? 1 : -1);
    const ay = k === 'couronne' ? 0.8 : k === 'ruse' ? 0.66 : 0.55;
    const g = { k, by: p, sx: b.x, sy: b.y, sz: Math.max(b.z, 4), tx: gx + sg * 34, ty: H / 2 + side * GHW * ay, tz: UTZ[k], t: 0, u: 0, sgn: 1, A: 0, wp: null, hit: [], fl: 0, inv: 0 };
    if (k === 'stampede') g.sz = 46; // il s'est fait une tête
    const D = len(g.tx - g.sx, g.ty - g.sy) || 1;
    g.D = D; g.ux = (g.tx - g.sx) / D; g.uy = (g.ty - g.sy) / D; g.nx = -g.uy; g.ny = g.ux;
    // zigzag / feinte : chemin à points de passage
    if (k === 'thor') {
      const A = Math.min(110, D * 0.2), pts = [[g.sx, g.sy]];
      let s2 = R() < 0.5 ? 1 : -1;
      for (const [u, a] of [[0.24, 1], [0.48, -1], [0.72, 0.6]]) pts.push([g.sx + (g.tx - g.sx) * u + g.nx * A * a * s2, clamp(g.sy + (g.ty - g.sy) * u + g.ny * A * a * s2, 40, H - 40)]);
      pts.push([g.tx, g.ty]); g.wp = pts;
    } else if (k === 'ruse') {
      const fy = H / 2 - side * GHW * 0.7, f = 0.66;
      g.wp = [[g.sx, g.sy], [g.sx + (g.tx - g.sx) * f, g.sy + (fy - g.sy) * f], [g.tx, g.ty]];
    }
    if (g.wp) { let L = 0; g.wl = [0]; for (let i = 1; i < g.wp.length; i++) { L += len(g.wp[i][0] - g.wp[i - 1][0], g.wp[i][1] - g.wp[i - 1][1]); g.wl.push(L); } g.L = L; }
    // amplitude latérale : on reste dans le terrain (côté le plus libre)
    const LA = { fauche: Math.min(300, D * 0.42), faucon: 36, encre: Math.min(88, D * 0.16), crescendo: 30 }[k] || 0;
    if (LA) {
      const fit = sg2 => {
        let A = LA;
        for (let it = 0; it < 14; it++) {
          g.sgn = sg2; g.A = A; let ok = true;
          for (let q = 0; q <= 20 && ok; q++) { const o = gpPos(g, q / 20); if (o[1] < 40 || o[1] > H - 40) ok = false; }
          if (ok) return A; A *= 0.8;
        }
        return 0;
      };
      const s0 = R() < 0.5 ? 1 : -1, a0 = fit(s0), a1 = fit(-s0);
      if (a1 > a0 * 1.15) { g.sgn = -s0; g.A = a1; } else { g.sgn = s0; g.A = a0; }
    }
    const PL = g.wp ? g.L : D * (k === 'fauche' ? 1.25 : k === 'encre' ? 1.12 : 1);
    g.dur = k === 'upper' ? 1.2 + D / 3000 : k === 'fil' ? 0.8 + D / 2600 : k === 'crescendo' ? Math.max(0.5, D / 800) : Math.max(0.18, PL / UV[k]);
    b.owner = null; b.gp = g; b.uk = p.rid + 1;
    b.sup = 2; b.kickBy = p; b.kickT = 0; b.passTo = null; b.last = p; b.fxk = ''; b.fxBy = p; b.curl = 0; b.knk = -1;
    b.vx = g.ux * 300; b.vy = g.uy * 300; b.vz = 0;
    p.pickCd = 0.5; p.st = ST.kick; p.t = 0.45; p.vx *= 0.3; p.vy *= 0.3;
    p.chS = false; p.charge = 0; p.aAct = false;
    if (k === 'bordee') { p.vx = -g.ux * 560; p.vy = -g.uy * 560; p.rec = 0.4; } // le recul du canon
    tm.stats[0]++; tm.stats[1]++;
    w.slowT = 0.85;
    ev(w, 'super', { x: p.x, y: p.y, t: p.team, u: 1, n: p.name, uk: k, i: p.id, sx: Math.round(g.sx), sy: Math.round(g.sy), tx: Math.round(g.tx), ty: Math.round(g.ty), sgn: g.sgn, dur: Math.round(g.dur * 100) / 100 });
  }
  // position sur la trajectoire guidée à l'instant s ∈ [0,1] → [x, y, z, u]
  const GPO = [0, 0, 0, 0];
  function gpPos(g, s) {
    let u = s, lat = 0, z;
    const zl = u2 => g.sz + (g.tz - g.sz) * u2, PI = Math.PI;
    switch (g.k) {
      case 'upper': u = s ** 2.4; z = zl(u) + 820 * Math.sin(PI * Math.min(1, s / 0.9) ** 1.25); break;
      case 'rouleau': z = g.sz * Math.max(0, 1 - s * 10); break;
      case 'fauche': lat = Math.sin(PI * s ** 0.75); z = zl(u) + 30 * Math.sin(PI * u); break;
      case 'seisme': z = Math.max(g.sz * (1 - s * 12), 120 * (1 - 0.35 * u) * Math.abs(Math.sin(3 * PI * u))); break;
      case 'faucon': lat = Math.sin(4 * PI * u) * (1 - u); z = zl(u) + 230 * Math.sin(PI * Math.min(1, u / 0.84)); break;
      case 'abra': z = zl(u) + 22 * Math.sin(PI * u); break;
      case 'encre': lat = Math.sin(2 * PI * u) * (1 - 0.25 * u); z = zl(u) + 10 * Math.sin(PI * u); break;
      case 'fil':
        u = s < 0.3 ? 0.45 * s / 0.3 : s < 0.72 ? 0.45 + 0.012 * Math.sin((s - 0.3) * 40) : 0.45 + 0.55 * ((s - 0.72) / 0.28) ** 1.3;
        z = s < 0.72 ? g.sz + (58 - g.sz) * Math.min(1, s / 0.15) + (s > 0.3 ? 4 * Math.sin(s * 70) : 0) : 58 + (g.tz - 58) * ((s - 0.72) / 0.28); break;
      case 'crescendo': u = 0.25 * s + 0.75 * s * s * s; lat = Math.sin(2 * PI * u); z = zl(u) + 25 * Math.sin(PI * u); break;
      case 'couronne': z = zl(u) + 40 * Math.sin(PI * u); break;
      case 'bond': z = u < 0.68 ? 5 + (g.sz - 5) * Math.max(0, 1 - s * 10) : 5 + 62 * Math.sin(PI * (u - 0.68) / 0.64); break;
      default: z = zl(u) + (g.k === 'ruse' ? 18 : g.k === 'thor' ? 14 : 8) * Math.sin(PI * u);
    }
    let x, y;
    if (g.wp) {
      const d = u * g.L; let i = 1; while (i < g.wl.length - 1 && g.wl[i] < d) i++;
      const a = g.wp[i - 1], c = g.wp[i], f = (d - g.wl[i - 1]) / ((g.wl[i] - g.wl[i - 1]) || 1);
      x = a[0] + (c[0] - a[0]) * f; y = a[1] + (c[1] - a[1]) * f;
    } else { const o = g.sgn * g.A * lat; x = g.sx + (g.tx - g.sx) * u + g.nx * o; y = g.sy + (g.ty - g.sy) * u + g.ny * o; }
    GPO[0] = x; GPO[1] = y; GPO[2] = z; GPO[3] = u; return GPO;
  }
  // effets pendant le vol (écrasement, séisme, éclairs, encre…)
  function ultTick(w, g, s, s0) {
    const b = w.ball, by = g.by, PI = Math.PI;
    const foes = r => { const out = []; for (const o of w.players) if (o.team !== by.team && o.st !== ST.down && len(o.x - b.x, o.y - b.y) < r) out.push(o); return out; };
    const blast = (x, y, r, f, kind) => {
      for (const o of w.players) {
        if (o.team === by.team || o.st === ST.down || o.inv > 0) continue;
        const dx = o.x - x, dy = o.y - y, d = len(dx, dy); if (d > r) continue;
        knock(w, o, dx / (d || 1), dy / (d || 1), 1.1, f, by, kind);
      }
    };
    switch (g.k) {
      case 'rouleau': case 'stampede': { // il écrase / il balaie
        for (const o of foes(g.k === 'rouleau' ? 56 : 74)) {
          if (g.hit.includes(o.id) || o.inv > 0) continue; g.hit.push(o.id);
          const sd = (o.x - b.x) * g.nx + (o.y - b.y) * g.ny >= 0 ? 1 : -1;
          const dx = g.ux * 0.6 + g.nx * sd * 0.8, dy = g.uy * 0.6 + g.ny * sd * 0.8, l = len(dx, dy);
          knock(w, o, dx / l, dy / l, 1.3, 560, by, 'ball');
        }
        break;
      }
      case 'seisme': for (const q of [1 / 3, 2 / 3]) if (g.u >= q && !(g.fl & (q < 0.5 ? 1 : 2))) { g.fl |= q < 0.5 ? 1 : 2; ev(w, 'quake', { x: Math.round(b.x), y: Math.round(b.y), r: 115 }); blast(b.x, b.y, 115, 420, 'quake'); } break;
      case 'upper': if (s >= 0.9 && !(g.fl & 1)) { g.fl |= 1; ev(w, 'quake', { x: Math.round(b.x), y: Math.round(b.y), r: 100, m: 1 }); blast(b.x, b.y, 100, 460, 'quake'); } break;
      case 'thor': for (let i = 1; i <= 3; i++) if (g.u * g.L >= g.wl[i] && !(g.fl & (1 << i))) { g.fl |= 1 << i; ev(w, 'zap', { x: Math.round(b.x), y: Math.round(b.y) }); blast(b.x, b.y, 80, 380, 'zap'); } break;
      case 'ruse': if (g.u * g.L >= g.wl[1] && !(g.fl & 1)) { g.fl |= 1; ev(w, 'ruse', { x: Math.round(b.x), y: Math.round(b.y) }); } break;
      case 'bond': if (g.u >= 0.68 && !(g.fl & 1)) { g.fl |= 1; ev(w, 'pounce', { x: Math.round(b.x), y: Math.round(b.y) }); } break;
      case 'encre': // l'encre sonne ceux qu'elle frôle
        for (const o of foes(70)) {
          if (g.hit.includes(o.id) || o.inv > 0 || (o.gk && o.st === ST.hold)) continue; g.hit.push(o.id);
          o.st = ST.stag; o.t = 0.9; o.vx *= 0.2; o.vy *= 0.2; o.chS = false; o.charge = 0; o.aAct = false;
          ev(w, 'tr', { x: o.x, y: o.y, s: 'encre' });
        }
        break;
      case 'abra': g.inv = s > 0.18 && s < 0.7 ? 1 : 0; break;
    }
  }

  // LA COMÈTE : gravité normale à la montée, triple à la descente → on cherche l'élan vertical
  const DIPG = 3;
  function cometeVz(z0, tg, hz) {
    const zAt = vz => { const t1 = vz / GRAV; if (tg <= t1) return z0 + vz * tg - 0.5 * GRAV * tg * tg; const top = z0 + vz * vz / (2 * GRAV); return top - 0.5 * GRAV * DIPG * (tg - t1) * (tg - t1); };
    let lo = 120, hi = 1500;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (zAt(m) < hz) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  function laneBlock(w, p, tx, ty) {
    const dx = tx - p.x, dy = ty - p.y, L = len(dx, dy) || 1;
    let pen = 0;
    for (const o of w.players) {
      if (o.team === p.team || o.st === ST.down) continue;
      const t = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / (L * L), 0, 1);
      const d = len(p.x + dx * t - o.x, p.y + dy * t - o.y);
      if (d < 34 && t > 0.08) pen += 1;
    }
    return pen;
  }

  function doPass(w, p, ax, ay) {
    const b = w.ball; if (b.owner !== p) return;
    const am = len(ax, ay);
    const dx0 = am > 0.3 ? ax / am : p.fx, dy0 = am > 0.3 ? ay / am : p.fy;
    let best = null, bs = -1e9;
    for (let i = 0; i < 4; i++) {
      const m = w.players[p.team * 4 + i];
      if (m === p || m.st === ST.down) continue;
      const vx = m.x - p.x, vy = m.y - p.y, d = len(vx, vy); if (d < 40) continue;
      const cos = (vx * dx0 + vy * dy0) / d;
      if (cos < -0.15) continue;
      if (m.gk && (am <= 0.3 || cos < 0.82 || !(w.teams[p.team].human && w.teams[p.team].ctrl === p.idx))) continue; // passe en retrait : il faut viser le gardien
      const s = cos * 1.3 - d / 1500 - laneBlock(w, p, m.x, m.y) * 0.35 + (m.gk && cos > 0.9 ? 0.4 : 0); // on vise le gardien : c'est pour lui
      if (s > bs) { bs = s; best = m; }
    }
    b.owner = null; b.kickBy = p; b.kickT = 0; b.last = p; b.sup = 0; b.fxk = ''; b.fxBy = p;
    if (!best) {
      b.vx = dx0 * 650; b.vy = dy0 * 650; b.vz = 60; b.passTo = null;
    } else {
      const d0 = len(best.x - p.x, best.y - p.y), T = d0 / 650, sg = p.team === 0 ? 1 : -1;
      const lead = best.gk ? 0 : 0.7; // le gardien : on lui donne dans les pieds, sans anticipation
      const tx = clamp(best.x + best.vx * T * lead, 30, W - 30), ty = clamp(best.y + best.vy * T * lead, 30, H - 30);
      const ddx = tx - p.x, ddy = ty - p.y, d = len(ddx, ddy) || 1;
      if (best.gk) { // PASSE EN RETRAIT : toujours au sol, dosée pour mourir dans ses gants (jamais de lob)
        const sp = clamp(Math.sqrt(150 * 150 + 2 * DEC * d), 300, 820);
        b.vx = ddx / d * sp; b.vy = ddy / d * sp; b.vz = 0; b.z = 0;
      } else if (p.tr.centre && d > 260 && ddx * sg > 0) { // centre millimétré : seulement vers l'avant // CENTRE MILLIMÉTRÉ : arrive à hauteur de poitrine, prêt pour la reprise
        const tg = 0.25 + d / 760;
        b.vx = ddx / tg; b.vy = ddy / tg; b.vz = (70 - Math.max(b.z, 3) + 0.5 * GRAV * tg * tg) / tg; b.fxk = 'centre';
        ev(w, 'tr', { x: p.x, y: p.y, s: 'centre' });
      } else if (d > 420 && laneBlock(w, p, tx, ty) > 0 && !p.tr.laser && !p.tr.eclair && ddx * sg > -100) {
        const tg = 0.75 + d / 1600;
        b.vx = ddx / tg; b.vy = ddy / tg; b.vz = 0.5 * GRAV * tg * 0.92;
      } else {
        const lz = p.tr.laser || p.tr.eclair;
        const sp = clamp(Math.sqrt(170 * 170 + 2 * DEC * d), 360, 1050) * SP(p).pass * (lz ? 1.45 : 1);
        b.vx = ddx / d * sp; b.vy = ddy / d * sp; b.vz = 30;
        if (lz) { b.fxk = 'laser'; if (d > 200) ev(w, 'tr', { x: p.x, y: p.y, s: p.tr.eclair ? 'eclair' : 'laser' }); } // PASSE LASER / RELANCE ÉCLAIR
      }
      b.passTo = best;
      const tm = w.teams[p.team];
      if (tm.human) setCtrl(w, tm, best.idx);
    }
    if (!best || !best.gk) b.z = Math.max(b.z, 3);
    p.pickCd = 0.3; p.st = ST.kick; p.t = 0.15;
    ev(w, 'pass', { x: p.x, y: p.y });
  }

  function doPunt(w, p, ax, ay) { // dégagement du gardien à la volée, loin devant
    const b = w.ball; if (b.owner !== p) return;
    const sg = p.team === 0 ? 1 : -1, am = len(ax, ay);
    let tx, ty;
    if (am > 0.3 && ax * sg > -0.2) { tx = p.x + ax / am * 720; ty = p.y + ay / am * 720; }
    else { // vers le coéquipier le plus avancé
      let fw = null; for (let i = 0; i < 3; i++) { const m = w.players[p.team * 4 + i]; if (m.st !== ST.down && (!fw || m.x * sg > fw.x * sg)) fw = m; }
      tx = fw ? fw.x + sg * 60 : p.x + sg * 720; ty = fw ? fw.y : H / 2;
    }
    tx = clamp(tx, 60, W - 60); ty = clamp(ty, 60, H - 60);
    if (p.tr.obus) { // DÉGAGEMENT OBUS : tendu, droit dans les pieds du coéquipier visé
      let best = null, bs = -1e9; const ux = tx - p.x, uy = ty - p.y, ul = len(ux, uy) || 1;
      for (let i = 0; i < 3; i++) { const m = w.players[p.team * 4 + i]; if (m.st === ST.down) continue; const vx = m.x - p.x, vy = m.y - p.y, d = len(vx, vy) || 1;
        const s2 = (vx * ux + vy * uy) / (d * ul) * 2 + d / 900; if (s2 > bs) { bs = s2; best = m; } }
      if (best) {
        const d = len(best.x - p.x, best.y - p.y), tg = 0.42 + d / 2400;
        const fx2 = clamp(best.x + best.vx * tg * 0.6, 30, W - 30), fy2 = clamp(best.y + best.vy * tg * 0.6, 30, H - 30);
        b.owner = null; b.x = p.x + p.fx * 12; b.y = p.y + p.fy * 12; b.z = 24;
        b.vx = (fx2 - p.x) / tg; b.vy = (fy2 - p.y) / tg; b.vz = (8 - 24 + 0.5 * GRAV * tg * tg) / tg; // il arrive au ras du sol, dans les pieds
        b.kickBy = p; b.kickT = 0; b.last = p; b.passTo = best; b.sup = 0; b.fxk = 'laser'; b.fxBy = p;
        b.land = { x: fx2, y: fy2, by: p, t: tg }; // le receveur attend le ballon là où il tombe
        p.st = ST.kick; p.t = 0.2; p.pickCd = 0.5; p.fx = (fx2 - p.x) / (d || 1); p.fy = (fy2 - p.y) / (d || 1);
        const tm = w.teams[p.team]; if (tm.human) setCtrl(w, tm, best.idx);
        ev(w, 'punt', { x: p.x, y: p.y, t: p.team, ob: 1 });
        return;
      }
    }
    const dx = tx - p.x, dy = ty - p.y, tg = 1.05;
    b.owner = null; b.x = p.x + p.fx * 12; b.y = p.y + p.fy * 12; b.z = 24;
    b.vx = dx / tg; b.vy = dy / tg; b.vz = 0.5 * GRAV * tg * 0.95;
    b.kickBy = p; b.kickT = 0; b.last = p; b.passTo = null; b.sup = 0;
    p.st = ST.kick; p.t = 0.2; p.pickCd = 0.5; p.fx = dx / (len(dx, dy) || 1); p.fy = dy / (len(dx, dy) || 1);
    ev(w, 'punt', { x: p.x, y: p.y, t: p.team });
  }

  function doDash(w, p, ax, ay) {
    if (p.dashCd > 0 || p.stam < 0.12) return;
    const m = len(ax, ay);
    const dx = m > 0.3 ? ax / m : p.fx, dy = m > 0.3 ? ay / m : p.fy;
    p.st = ST.dash; p.t = 0.24; p.vx = dx * 540; p.vy = dy * 540; p.fx = dx; p.fy = dy;
    p.inv = SP(p).inv; p.dashCd = p.tr.crochet ? 0.35 : SP(p).dashCd; p.stam = Math.max(0, p.stam - (p.tr.crochet ? 0 : SP(p).dashCd < 0.9 ? 0.12 : 0.18));
    ev(w, 'feint', { x: p.x, y: p.y });
    const b = w.ball;
    if (b.owner === p) { // SOMBRERO : le ballon passe par-dessus, on le reprend de volée, de la tête… ou il retombe dans les pieds
      b.owner = null; b.x = p.x + dx * (PR + BR); b.y = p.y + dy * (PR + BR); b.z = 18;
      const bs = SP(p).acc > 1.2 ? 290 : 320; // un technicien dose son sombrero au millimètre
      b.vx = dx * bs; b.vy = dy * bs; b.vz = 530;
      b.kickBy = p; b.kickT = 0; b.last = p; b.passTo = null; b.sup = 0; p.pickCd = 0.2; b.lobBy = p;
      p.chS = false; p.charge = 0; p.aAct = false;
      if (w.teams[p.team].human) w.teams[p.team].lock = 0.9; // on garde le même joueur
      ev(w, 'flick', { x: p.x, y: p.y, n: p.name, t: p.team });
    }
  }

  /* ---------- jeu aérien : reprise de volée, tête, duels ---------- */
  // peut-on aller chercher le ballon en l'air ? → instant, point et hauteur du contact
  function aerialPlan(w, p, maxT) {
    const b = w.ball;
    if (b.owner || p.gk || (b.z < 8 && b.vz <= 0)) return null;
    if (b.sup && b.kickBy && b.kickBy.team !== p.team) return null; // une frappe en feu, ça ne se reprend pas
    let x = b.x, y = b.y, z = b.z, vz = b.vz, best = null, bs = -1e9;
    const h = 1 / 60, T = maxT || 0.45, mine = b.kickBy === p && b.kickT < 0.6;
    for (let t = h; t <= T + 1e-6; t += h) {
      x += b.vx * h; y += b.vy * h; vz -= GRAV * h; z += vz * h;
      if (z < 0) break;
      if (z < 10 || z > 135) continue;
      if (mine && vz > 0) continue; // son propre sombrero : on attend qu'il redescende
      if (len(x - p.x, y - p.y) > PR + BR + 12 + 330 * t) continue;
      // c'est le moment de l'appui qui décide : on vise le contact ~0,16 s plus tard
      // (ballon encore haut → tête, ballon à hauteur de taille → volée), en évitant les sauts extrêmes
      const hs = z <= 105 ? 1 : 1 - (z - 105) / 60;
      const sc = hs - 2.5 * Math.abs(t - 0.16);
      if (sc > bs) { bs = sc; best = { t, x, y, z }; }
    }
    return best;
  }

  function doAerial(w, p, plan, tx, ty) {
    // vers le but : du pied jusqu'à hauteur de poitrine (ciseau sauté), la tête seulement pour les ballons hauts
    // en défense (dégagement) : la tête dès que le ballon dépasse la taille
    const gx = p.team === 0 ? W : 0, att = Math.abs(tx - gx) < 40;
    const head = plan.z > 92;
    p.st = head ? ST.head : ST.volley;
    p.aT = plan.t; p.aX = tx; p.aY = ty; p.hitDone = false;
    // qualité du timing : idéal quand on déclenche ~0,18 s avant le contact, sans trop devoir se jeter
    const dd = len(plan.x - p.x, plan.y - p.y);
    // qualité = hauteur du ballon au contact (donc le timing de l'appui) : chaque geste a sa zone idéale
    const z = plan.z, zone = (a, b2, f) => clamp(1 - Math.max(0, a - z, z - b2) / f, 0.25, 1);
    p.aQ = (head ? zone(64, 82, 40) : z > 50 ? zone(66, 84, 26) : zone(22, 42, 22)) * clamp(1.25 - dd / 160, 0.45, 1);
    if (!w.teams[p.team].human) p.aQ *= rnd(0.72, 1); // l'IA n'est pas parfaite
    if (bfx(w.ball, 'centre') && w.ball.kickBy.team === p.team) p.aQ = Math.max(p.aQ, 0.95); // le centre millimétré
    // on se jette vers le point de contact (en restant juste derrière le ballon)
    const ux = (plan.x - p.x) / (dd || 1), uy = (plan.y - p.y) / (dd || 1);
    const go = Math.max(0, dd - (PR + BR - 2)), tt = Math.max(plan.t, 0.08);
    const sp = Math.min(430, go / tt);
    p.vx = ux * sp; p.vy = uy * sp;
    if (dd > 4) { p.fx = ux; p.fy = uy; }
    if (head) { // saut calé pour avoir la tête à hauteur du ballon au moment du contact
      const jh = clamp(plan.z - 62, 0, 70);
      p.vz = jh > 3 ? clamp(jh / tt + 0.5 * PGRAV * tt, 160, 620) : 120; p.z = Math.max(p.z, 1);
    } else { // volée : on décolle pour un ballon à mi-hauteur (ciseau acrobatique)
      const jh = clamp(plan.z - 46, 0, 46);
      if (jh > 4) { p.vz = clamp(jh / tt + 0.5 * PGRAV * tt, 140, 560); p.z = Math.max(p.z, 1); } else p.vz = 0;
    }
    p.chS = false; p.charge = 0; p.chT = false; p.tch = 0; p.qS = 0; p.aAct = false; p.comboN = 0; p.comboT = 0;
    ev(w, 'aerialGo', { x: p.x, y: p.y, h: head ? 1 : 0 });
  }

  function aerialContact(w, p) {
    const b = w.ball;
    if (b.owner) return false;
    if (b.sup && b.kickBy && b.kickBy.team !== p.team) return false;
    if (len(b.x - p.x, b.y - p.y) > PR + BR + 16) return false;
    if (p.aT > 0.1) return false;                                   // pas de contact bien avant le moment prévu
    if (b.kickBy === p && b.kickT < 0.6 && b.vz > 0) return false;  // son propre sombrero qui monte encore
    if (!p.tr.cornes) for (const o of w.players) // CORNES : il gagne le duel aérien
      if (o.team !== p.team && o.tr.cornes && AERIAL(o.st) && !o.hitDone && len(b.x - o.x, b.y - o.y) < PR + BR + 24) return false;
    const rz = b.z - p.z;
    return p.st === ST.head ? rz > 38 && rz < 96 : rz > 2 && rz < 62;
  }

  function aerialStrike(w, p) {
    const b = w.ball, tm = w.teams[p.team], head = p.st === ST.head;
    const q = p.aQ, gx = p.team === 0 ? W : 0;
    let tx = p.aX, ty = p.aY;
    const toGoal = Math.abs(tx - gx) < 40;
    const dx0 = tx - b.x, dy0 = ty - b.y, d = len(dx0, dy0) || 1;
    let ang = Math.atan2(dy0, dx0);
    const spread = (0.03 + 0.08 * (1 - q)) * (p.aiAcc || 1);
    ang += rnd(-spread, spread);
    const acro = !head && p.z > 6;
    const buffle = head && !!p.tr.buffle;
    const sup = (!head || buffle) && toGoal && q > (buffle ? 0.7 : 0.86) ? 1 : 0;
    const speed = head ? (620 + 320 * q) * SP(p).head : sup ? 1380 : 880 + 380 * q;
    const tg = Math.max(0.1, d / speed);
    const hz = !toGoal ? rnd(40, 110) : head ? rnd(6, 50) : sup ? rnd(12, 55) : rnd(8, 80);
    b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
    b.vz = clamp((hz - b.z + 0.5 * GRAV * tg * tg) / tg, -420, 720);
    b.owner = null; b.sup = sup; b.kickBy = p; b.kickT = 0; b.passTo = null; b.last = p; b.fxk = ''; b.fxBy = p;
    p.pickCd = 0.3; p.fx = Math.cos(ang); p.fy = Math.sin(ang);
    p.vx *= 0.35; p.vy *= 0.35;
    if (toGoal) tm.stats[0]++;
    if (sup) { tm.stats[1]++; w.slowT = 0.45; }
    tm.bar = Math.min(1, tm.bar + 0.04);
    ev(w, 'aerial', { id: p.id, x: p.x, y: p.y, z: Math.round(b.z), h: head ? 1 : 0, a: acro ? 1 : 0, bf: buffle ? 1 : 0, q: Math.round(q * 100), s: sup, g: toGoal ? 1 : 0, n: p.name, t: p.team });
    // duel aérien : celui qui touche le ballon le premier bouscule l'adversaire qui sautait avec lui
    for (const o of w.players) {
      if (o.team === p.team || !AERIAL(o.st) || o.hitDone || o.tr.cornes) continue;
      const vx = o.x - p.x, vy = o.y - p.y, dd = len(vx, vy) || 1;
      if (dd < PR * 2 + 26) { o.hitDone = true; knock(w, o, vx / dd, vy / dd, 0.7, 230, p, 'clash'); }
    }
  }

  function doSlide(w, p, dx, dy, c, assist) {
    let m = len(dx, dy) || 1; dx /= m; dy /= m;
    if (assist) {
      let best = null, bs = 0.55;
      for (const o of w.players) {
        if (o.team === p.team || o.st === ST.down) continue;
        const vx = o.x + o.vx * 0.12 - p.x, vy = o.y + o.vy * 0.12 - p.y, d = len(vx, vy);
        if (d > 110 + 110 * c || d < 1) continue;
        const cos = (vx * dx + vy * dy) / d;
        const s = cos + (w.ball.owner === o ? 0.3 : 0);
        if (cos > 0.55 && s > bs) { bs = s; best = [vx / d, vy / d]; }
      }
      if (best) { dx = best[0]; dy = best[1]; }
    }
    const dfn = !!p.tr.assassin;
    p.st = ST.slide; p.t = (0.3 + 0.2 * c) * (dfn ? 1.1 : 1);
    const sp = (470 + 300 * c) * (dfn ? 1.12 : 1);
    p.vx = dx * sp; p.vy = dy * sp; p.fx = dx; p.fy = dy;
    p.slideC = c; p.hits = []; p.tackCd = 0.45; p.chT = false; p.tch = 0;
    ev(w, 'slide', { x: p.x, y: p.y, c: Math.round(c * 100) });
  }

  function doFly(w, p, dx, dy) {
    const b = w.ball;
    let tgt = null;
    if (b.owner && b.owner.team !== p.team && len(b.owner.x - p.x, b.owner.y - p.y) < 430) tgt = b.owner;
    if (!tgt) {
      let bd = 380;
      const m = len(dx, dy) || 1;
      for (const o of w.players) {
        if (o.team === p.team || o.st === ST.down) continue;
        const vx = o.x - p.x, vy = o.y - p.y, d = len(vx, vy);
        if (d < bd && (vx * dx + vy * dy) / m > -0.2 * d) { bd = d; tgt = o; }
      }
    }
    let tx, ty;
    if (tgt) { tx = tgt.x + tgt.vx * 0.25; ty = tgt.y + tgt.vy * 0.25; }
    else { const m = len(dx, dy) || 1; tx = p.x + dx / m * 300; ty = p.y + dy / m * 300; }
    const ddx = tx - p.x, ddy = ty - p.y, d = len(ddx, ddy) || 1;
    const dur = p.tr.bond ? 0.56 : 0.5, sp = clamp(d / dur, 300, p.tr.bond ? 980 : 820); // BOND DU TIGRE
    p.st = ST.fly; p.t = dur; p.vx = ddx / d * sp; p.vy = ddy / d * sp; p.vz = PGRAV * dur / 2; p.z = 1;
    p.fx = ddx / d; p.fy = ddy / d; p.hits = []; p.chT = false; p.tch = 0; p.chS = false; p.charge = 0;
    ev(w, 'fly', { x: p.x, y: p.y, t: p.team, n: p.name });
  }

  const DMG = { tackle: 1.5, fly: 2, ball: 1.5, gk: 2, gkp: 0, combo: 2, ki: 2, beam: 3, clash: 1, assassin: 2.5, patate: 3, boule: 2.5, charge: 1.5, kamikaze: 2.5, body: 1.2 };
  function knock(w, p, dx, dy, stun, force, by, kind) {
    if (p.st === ST.down) return;
    const b = w.ball;
    if (p.tr.tank && b.owner === p && kind !== 'beam' && kind !== 'ki' && kind !== 'ball') { // INARRÊTABLE : il vacille, il garde le ballon
      p.st = ST.stag; p.t = 0.26; p.vx = dx * force * 0.3; p.vy = dy * force * 0.3;
      p.dmg = Math.min(10, p.dmg + (DMG[kind] || 1.5) * 0.5);
      p.chS = false; p.charge = 0; p.aAct = false; p.qS = 0;
      ev(w, 'tr', { x: p.x, y: p.y, s: 'tank' });
      ev(w, 'punch', { x: p.x, y: p.y, n: 2, v: p.team, a: by ? by.team : -1, id: p.id, d: Math.round(p.dmg * 10) / 10, dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100 });
      return;
    }
    if (b.owner === p) {
      b.owner = null;
      b.x = p.x + dx * 12; b.y = p.y + dy * 12;
      const s = 260 + force * 0.35;
      b.vx = dx * s + rnd(-90, 90); b.vy = dy * s + rnd(-90, 90); b.vz = rnd(160, 260);
      b.last = p; b.kickBy = by; b.kickT = 0; b.passTo = null; b.sup = 0;
      p.pickCd = 0.9;
    }
    if (p.gk && p.st === ST.hold && b.owner === p) b.owner = null;
    const gd = Math.sqrt(SP(p).guard * (1 + 0.8 * bzF(p))); stun /= gd; force /= gd; // le costaud encaisse mieux
    stun *= 1 + 0.035 * p.dmg;                                          // un joueur déjà amoché reste plus longtemps au tapis
    if (p.tr.intouchable) stun *= 0.5;                                  // INTOUCHABLE : se relève deux fois plus vite
    if (!p.tr.chef && hasUp(w, p.team, 'chef')) { stun *= 0.75; force *= 0.8; } // CHEF DE DÉFENSE
    if (by && by.tr && by.tr.berserk) { force *= 1 + 0.5 * bzF(by); }
    p.st = ST.down; p.stun = stun; p.vx = dx * force; p.vy = dy * force; p.vz = 200 + force * 0.4;
    p.spinV = (R() < 0.5 ? -1 : 1) * rnd(8, 14); p.spin = 0;
    p.chS = false; p.charge = 0; p.chT = false; p.tch = 0; p.aAct = false; p.qS = 0; p.kiOn = false; p.comboN = 0; p.comboT = 0;
    p.ai.shootH = -1; p.ai.tackH = -1; p.ai.beamH = -1;
    // le corps devient un projectile : on retient qui l'a envoyé (crédité des dégâts qu'il fera en retombant)
    p.kBy = by || null; p.bodyHits = []; p.gdone = false; p.landed = 0; p.inNet = false; p.slamCd = 0;
    if (by && by.team !== p.team) w.teams[by.team].stats[4]++;
    p.dmg = Math.min(10, p.dmg + (DMG[kind] || 1.5));
    if (p.tr.berserk && !p.bzOn && p.dmg >= 3) { p.bzOn = true; ev(w, 'tr', { x: p.x, y: p.y, s: 'berserk' }); }
    if (w.phase === 'play' && (BRUTAL[kind] || force > 560)) w.slowT = Math.max(w.slowT, 0.16); // le temps s'arrête sur le coup qui détruit
    ev(w, 'hit', { x: p.x, y: p.y, f: Math.round(force), v: p.team, a: by ? by.team : -1, b: by ? by.id : -1, kd: kind, n: p.name, id: p.id, d: Math.round(p.dmg * 10) / 10, dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100 });
  }

  function slideHits(w, p) {
    const sp = len(p.vx, p.vy); if (sp < 60) return;
    const dx = p.vx / sp, dy = p.vy / sp;
    let hit = false;
    for (const o of w.players) {
      if (o.team === p.team || o.st === ST.down || p.hits.includes(o.id)) continue;
      if ((o.st === ST.fly || AERIAL(o.st)) && o.z > 25) continue;
      if (o.gk && o.st === ST.hold) continue;
      const d = len(o.x - p.x, o.y - p.y);
      if (d < PR * 2 + 8 + p.slideC * 8 + (p.tr.assassin ? 8 : 0)) {
        p.hits.push(o.id);
        if (o.inv > 0) { dodged(w, o); continue; }
        if (o.tr.sauterelle && (o.st === ST.run || o.st === ST.hold || o.st === ST.kick || o.st === ST.dash)) { o.inv = Math.max(o.inv, 0.3); ev(w, 'tr', { x: o.x, y: o.y, s: 'sauterelle', id: o.id }); continue; }
        if (o.tr.illusion && R() < 0.5) { o.inv = Math.max(o.inv, 0.25); ev(w, 'tr', { x: o.x, y: o.y, s: 'illusion' }); continue; }
        const ass = !!p.tr.assassin; // TACLE ASSASSIN
        knock(w, o, dx, dy, (1.0 + 0.6 * p.slideC) * (ass ? 1.35 : 1), (300 + 260 * p.slideC) * SP(p).tackle, p, ass ? 'assassin' : 'tackle');
        const tm = w.teams[p.team]; tm.bar = Math.min(1, tm.bar + 0.08); tm.stats[3]++;
        hit = true;
      }
    }
    const b = w.ball;
    if (!hit && !b.owner && b.z < 25 && len(b.x - p.x, b.y - p.y) < PR + BR + 8 && !(bfx(b, 'faux') && b.kickBy === p)) {
      if (p.tr.faux && p.slideC > 0.75) { // COUP DE FAUX : le tacle devient une frappe en feu vers le but
        const gx = p.team === 0 ? W : 0, ty = H / 2 + rnd(-0.75, 0.75) * GHW, ddx = gx - b.x, ddy = ty - b.y, dd = len(ddx, ddy) || 1;
        b.vx = ddx / dd * 1250; b.vy = ddy / dd * 1250; b.vz = clamp((30 + 0.5 * GRAV * (dd / 1250) ** 2) / (dd / 1250), 60, 600);
        b.last = p; b.kickBy = p; b.kickT = 0; b.passTo = null; b.sup = 1; b.fxk = 'faux'; b.fxBy = p; p.pickCd = 0.3;
        w.slowT = 0.45; w.teams[p.team].stats[0]++; w.teams[p.team].stats[1]++;
        ev(w, 'super', { x: p.x, y: p.y, t: p.team, u: 0, n: p.name, sig: 'faux' });
      } else {
        b.vx = dx * sp * 0.95 + rnd(-60, 60); b.vy = dy * sp * 0.95 + rnd(-60, 60); b.vz = 90;
        b.last = p; b.kickBy = p; b.kickT = 0; b.passTo = null; b.sup = 0; p.pickCd = 0.12;
      }
    }
  }

  // un coup passe dans le vide : pendant une feinte, c'est une ESQUIVE PARFAITE (ralenti + un peu de ki)
  function dodged(w, o) {
    const pf = o.st === ST.dash;
    if (pf) { const tm = w.teams[o.team]; tm.bar = Math.min(1, tm.bar + 0.06); if (tm.human && w.phase === 'play') w.slowT = Math.max(w.slowT, 0.12); }
    ev(w, 'dodge', { x: o.x, y: o.y, id: o.id, pf: pf ? 1 : 0 });
  }

  function flyHits(w, p) {
    const sp = len(p.vx, p.vy) || 1, dx = p.vx / sp, dy = p.vy / sp;
    for (const o of w.players) {
      if (o.team === p.team || o.st === ST.down || p.hits.includes(o.id)) continue;
      if (o.gk && o.st === ST.hold) continue;
      if (len(o.x - p.x, o.y - p.y) < PR * 2 + 16) {
        p.hits.push(o.id);
        if (o.tr.illusion && R() < 0.5) { ev(w, 'tr', { x: o.x, y: o.y, s: 'illusion' }); continue; }
        knock(w, o, dx, dy, 1.5, p.tr.bond ? 560 : 500, p, 'fly');
        const tm = w.teams[p.team]; tm.stats[3]++;
      }
    }
    const b = w.ball;
    if (!b.owner && b.z < p.z + 40 && len(b.x - p.x, b.y - p.y) < PR + BR + 14) {
      b.vx = dx * 950; b.vy = dy * 950; b.vz = 180; b.last = p; b.kickBy = p; b.kickT = 0; b.passTo = null; b.sup = 1;
      ev(w, 'kick', { x: p.x, y: p.y, p: 100 });
    }
  }

  /* ---------- combat : frappes, ki, rayon ---------- */
  function nearestFoe(w, p, dx, dy, maxD, minCos, carBonus) {
    let tg = null, bs = -1e9;
    for (const o of w.players) {
      if (o.team === p.team || o.st === ST.down) continue;
      const vx = o.x - p.x, vy = o.y - p.y, d = len(vx, vy); if (d > maxD || d < 1) continue;
      const cos = (vx * dx + vy * dy) / d; if (cos < minCos) continue;
      const s = cos * 1.2 - d / maxD + (w.ball.owner === o ? carBonus : 0) - (o.gk ? 0.3 : 0);
      if (s > bs) { bs = s; tg = o; }
    }
    return tg;
  }

  function doStrike(w, p, ax, ay) {
    if (p.strikeCd > 0) return;
    let n = p.comboT > 0 ? Math.min(3, p.comboN + 1) : 1;
    if (p.tr.patate && n === 2) n = 3; // un direct… puis la PATATE DE FORAIN
    let dx = p.fx, dy = p.fy; const am = len(ax, ay); if (am > 0.3) { dx = ax / am; dy = ay / am; }
    const tg = nearestFoe(w, p, dx, dy, p.tr.tentacules ? 150 : 125, 0.15, 0.4);
    if (!tg) { const df = downFoe(w, p, dx, dy, 78); if (df) { doStomp(w, p, df); return; } } // personne debout : COUP DE GRÂCE sur celui qui est au sol
    let gap = 60;
    if (tg) { const vx = tg.x - p.x, vy = tg.y - p.y, d = len(vx, vy) || 1; dx = vx / d; dy = vy / d; gap = clamp(d - (PR * 2 + 2), 0, 85); }
    p.fx = dx; p.fy = dy;
    const dur = n === 3 ? 0.34 : 0.2;
    p.st = n === 1 ? ST.punch : n === 2 ? ST.punch2 : ST.hkick;
    p.t = dur; p.hitAt = dur - (n === 3 ? 0.13 : 0.075); p.hitDone = false;
    const v = Math.min(620, gap * 9 + 60);
    p.vx = dx * v; p.vy = dy * v;
    p.comboN = n; p.comboT = n === 3 ? 0 : dur + 0.4;
    p.strikeCd = n === 3 ? dur + 0.5 : 0;
    p.chT = false; p.tch = 0;
    ev(w, 'swing', { x: p.x, y: p.y, n });
  }

  /* ---------- COUP DE GRÂCE : on piétine l'adversaire à terre (une fois par chute) ---------- */
  function downFoe(w, p, dx, dy, maxD) {
    let tg = null, bs = -1e9;
    for (const o of w.players) {
      if (o.team === p.team || o.st !== ST.down || o.z > 8 || o.gdone || o.inNet) continue;
      const vx = o.x - p.x, vy = o.y - p.y, d = len(vx, vy); if (d > maxD) continue;
      const cos = d > 1 ? (vx * dx + vy * dy) / d : 1; if (cos < -0.35) continue;
      const s = cos - d / maxD; if (s > bs) { bs = s; tg = o; }
    }
    return tg;
  }
  function doStomp(w, p, o) {
    const vx = o.x - p.x, vy = o.y - p.y, d = len(vx, vy) || 1, dx = vx / d, dy = vy / d;
    p.st = ST.stomp; p.t = 0.42; p.hitAt = 0.2; p.hitDone = false; p.stompT = o;
    p.fx = dx; p.fy = dy;
    const gap = Math.max(0, d - PR * 1.3), v = Math.min(420, gap / 0.2);   // il enjambe et se place au-dessus
    p.vx = dx * v; p.vy = dy * v;
    p.comboN = 0; p.comboT = 0; p.strikeCd = 0.62; p.chT = false; p.tch = 0;
    ev(w, 'swing', { x: p.x, y: p.y, n: 3 });
  }
  function stompHit(w, p) {
    const o = p.stompT; p.stompT = null;
    if (!o || o.st !== ST.down || o.z > 12 || o.gdone || len(o.x - p.x, o.y - p.y) > 60) { ev(w, 'thud', { x: p.x, y: p.y, v: 120, id: -1 }); return; }
    o.gdone = true;
    const gd = Math.sqrt(SP(o).guard);
    o.stun = Math.min(o.stun + 0.6 / gd, 2.6); o.vz = 110; o.z = Math.max(o.z, 1);
    o.vx += p.fx * 60; o.vy += p.fy * 60;
    o.dmg = Math.min(10, o.dmg + 1.8 / gd);
    const tm = w.teams[p.team]; tm.bar = Math.min(1, tm.bar + 0.06); tm.stats[3]++;
    if (w.phase === 'play') w.slowT = Math.max(w.slowT, 0.12);
    ev(w, 'stomp', { x: o.x, y: o.y, id: o.id, b: p.id, v: o.team, a: p.team, n: o.name, d: Math.round(o.dmg * 10) / 10, dx: Math.round(p.fx * 100) / 100, dy: Math.round(p.fy * 100) / 100 });
  }

  /* ---------- corps projetés : ils renversent tout ce qu'ils percutent (effet domino) ---------- */
  function bodyHits(w) {
    for (const p of w.players) {
      if (p.st !== ST.down || p.z > 46) continue;
      const sp = len(p.vx, p.vy); if (sp < 330) continue;
      const dx = p.vx / sp, dy = p.vy / sp;
      for (const o of w.players) {
        if (o === p || o.st === ST.down || o.inv > 0 || p.bodyHits.includes(o.id)) continue;
        if ((o.st === ST.fly || AERIAL(o.st)) && o.z > 30) continue;
        if (o.gk && o.st === ST.hold) continue;
        const vx = o.x - p.x, vy = o.y - p.y, d = len(vx, vy);
        if (d > PR * 2 + 6 || (vx * dx + vy * dy) < 0) continue;
        p.bodyHits.push(o.id);
        if (o.tr.illusion && R() < 0.5) { o.inv = Math.max(o.inv, 0.25); ev(w, 'tr', { x: o.x, y: o.y, s: 'illusion' }); continue; }
        const f = Math.min(560, sp * 0.62);
        const ux = dx * 0.75 + (vx / (d || 1)) * 0.25, uy = dy * 0.75 + (vy / (d || 1)) * 0.25, ul = len(ux, uy) || 1;
        knock(w, o, ux / ul, uy / ul, 0.95, f, p.kBy && p.kBy.team !== o.team ? p.kBy : p, 'body'); // crédité à celui qui a lancé le corps (sinon au corps lui-même)
        p.vx *= 0.55; p.vy *= 0.55; // le choc absorbe une partie de l'élan
        ev(w, 'domino', { x: o.x, y: o.y, id: o.id, by: p.id });
        break;
      }
    }
  }

  function stagger(w, o, by, n) {
    const b = w.ball;
    const hv = !!by.tr.patate, tough = o.S.guard >= 1.6;
    if (b.owner === o && n >= 2 && !o.tr.ventouse && !o.tr.tank) { // le ballon gicle au 2e coup (pas avec la Ventouse)
      const a = Math.atan2(by.fy, by.fx) + rnd(-1, 1), s = rnd(170, 270);
      b.owner = null; b.x = o.x + Math.cos(a) * 14; b.y = o.y + Math.sin(a) * 14;
      b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.vz = rnd(110, 200);
      b.last = o; b.kickBy = by; b.kickT = 0; b.passTo = null; b.sup = 0; o.pickCd = 0.7;
    }
    if (o.gk && o.st === ST.hold) o.st = ST.run;
    o.dmg = Math.min(10, o.dmg + 1);
    o.st = ST.stag; o.t = ((n >= 2 ? 0.36 : 0.24) + 0.08 * n) * (hv ? 1.3 : 1) * (tough ? 0.7 : 1);
    const push = (180 + 60 * n) * (hv ? 0.8 : 1) * (tough ? 0.7 : 1) * (1 + 0.4 * bzF(by)); o.vx = by.fx * push; o.vy = by.fy * push; // le direct du défenseur sonne sur place : la patate arrive derrière
    o.chS = false; o.charge = 0; o.chT = false; o.tch = 0; o.aAct = false; o.qS = 0; o.kiOn = false; o.comboN = 0; o.comboT = 0;
    o.ai.shootH = -1; o.ai.tackH = -1; o.ai.beamH = -1;
    const tm = w.teams[by.team]; tm.bar = Math.min(1, tm.bar + 0.035);
    ev(w, 'punch', { x: o.x, y: o.y, n, hv: hv ? 1 : 0, v: o.team, a: by.team, id: o.id, d: Math.round(o.dmg * 10) / 10, dx: Math.round(by.fx * 100) / 100, dy: Math.round(by.fy * 100) / 100 });
  }

  function strikeHit(w, p) {
    const n = p.comboN, reach = (n === 3 ? 64 : 56) + (p.tr.patate ? 4 : 0) + (p.tr.tentacules ? 14 : 0);
    let hit = false;
    for (const o of w.players) {
      if (o.team === p.team || o.st === ST.down) continue;
      if (o.gk && o.st === ST.hold) continue;
      if (o.st === ST.fly && o.z > 25) continue;
      const vx = o.x - p.x, vy = o.y - p.y, d = len(vx, vy);
      if (d > reach || (d > 6 && (vx * p.fx + vy * p.fy) / d < 0.2)) continue;
      if (o.inv > 0) { dodged(w, o); continue; }
      if (o.tr.illusion && R() < 0.5) { o.inv = Math.max(o.inv, 0.25); ev(w, 'tr', { x: o.x, y: o.y, s: 'illusion' }); continue; }
      if (o.tr.coude && w.ball.owner === o && o.coudeCd <= 0 && (p.x - o.x) * o.fx + (p.y - o.y) * o.fy > 0) { // COUP DE COUDE
        o.coudeCd = 1.8; hit = true; ev(w, 'tr', { x: o.x, y: o.y, s: 'coude' }); stagger(w, p, o, 2); continue;
      }
      hit = true;
      if (n === 3) {
        if (p.tr.patate) knock(w, o, p.fx, p.fy, 1.5, 700, p, 'patate'); // PATATE DE FORAIN
        else if (p.tr.boule) knock(w, o, p.fx, p.fy, 1.3, 540, p, 'boule'); // COUP DE BOULE
        else knock(w, o, p.fx, p.fy, 1.0, 440, p, 'combo');
        const tm = w.teams[p.team]; tm.bar = Math.min(1, tm.bar + 0.07); tm.stats[3]++;
      } else stagger(w, o, p, n);
    }
    const b = w.ball;
    if (!hit && n === 3 && !b.owner && b.z < 40 && len(b.x - p.x, b.y - p.y) < PR + BR + 22) { // reprise de volée
      b.vx = p.fx * 820; b.vy = p.fy * 820; b.vz = 140; b.last = p; b.kickBy = p; b.kickT = 0; b.passTo = null; b.sup = 0;
      ev(w, 'kick', { x: p.x, y: p.y, p: 80 });
    }
    if (!hit) ev(w, 'whiff', { x: p.x, y: p.y });
  }

  function doKi(w, p, ax, ay) {
    const tm = w.teams[p.team], cost = p.tr.barrage ? KI1 * 0.7 : KI1; // TIR DE BARRAGE
    if (tm.bar < cost - 1e-6) { ev(w, 'nokki', { x: p.x, y: p.y, t: p.team }); return false; }
    tm.bar = Math.max(0, tm.bar - cost);
    let dx = p.fx, dy = p.fy; const am = len(ax, ay); if (am > 0.3) { dx = ax / am; dy = ay / am; }
    const tg = nearestFoe(w, p, dx, dy, 700, 0.45, 0.6);
    if (tg) {
      const d = len(tg.x - p.x, tg.y - p.y), T = d / 900 * 0.8;
      const vx = tg.x + tg.vx * T - p.x, vy = tg.y + tg.vy * T - p.y, m = len(vx, vy) || 1; dx = vx / m; dy = vy / m;
    }
    const ks = p.tr.barrage ? 1180 : 900;
    w.proj.push({ x: p.x + dx * 22, y: p.y + dy * 22, z: 30, vx: dx * ks, vy: dy * ks, team: p.team, by: p, life: 0.95 });
    p.st = ST.blast; p.t = 0.24; p.fx = dx; p.fy = dy; p.vx *= 0.2; p.vy *= 0.2; p.kiOn = false;
    ev(w, 'kiball', { x: p.x, y: p.y, t: p.team });
    return true;
  }

  function startCharge(w, p) {
    p.st = ST.charge; p.beamC = 0; p.vx *= 0.3; p.vy *= 0.3; p.qS = 0; p.chT = false; p.tch = 0;
    ev(w, 'charge', { x: p.x, y: p.y, t: p.team });
  }
  function chargeTick(w, p, dt) {
    const tm = w.teams[p.team];
    if (tm.bar < 1) tm.bar = Math.min(1, tm.bar + 0.15 * dt);
    else if (tm.beamCd <= 0) { if (p.beamC < 0.45 && p.beamC + dt >= 0.45) ev(w, 'beamready', { x: p.x, y: p.y, t: p.team }); p.beamC += dt; }
  }

  function doBeam(w, p, ax, ay) {
    const tm = w.teams[p.team], b = w.ball;
    let dx = p.fx, dy = p.fy; const am = len(ax, ay); if (am > 0.3) { dx = ax / am; dy = ay / am; }
    let tg = nearestFoe(w, p, dx, dy, 950, am > 0.3 ? 0.6 : 0.2, 0.8);
    if (!tg && !b.owner && am <= 0.3) { const vx = b.x - p.x, vy = b.y - p.y, m = len(vx, vy); if (m > 40 && m < 950) { dx = vx / m; dy = vy / m; } }
    if (tg) { const vx = tg.x - p.x, vy = tg.y - p.y, m = len(vx, vy) || 1; dx = vx / m; dy = vy / m; }
    w.beams.push({ x: p.x + dx * 20, y: p.y + dy * 20, dx, dy, L: 0, t: 0.6, team: p.team, by: p, hits: [], ball: false });
    tm.bar = 0; tm.beamCd = 6;
    p.st = ST.blast; p.t = 0.62; p.fx = dx; p.fy = dy; p.vx = -dx * 140; p.vy = -dy * 140; p.kiOn = false; p.beamC = 0;
    w.slowT = 0.3;
    ev(w, 'beam', { x: p.x, y: p.y, t: p.team, n: p.name });
  }

  function updProj(w, dt) {
    const b = w.ball;
    for (let i = w.proj.length - 1; i >= 0; i--) {
      const k = w.proj[i]; k.life -= dt;
      let gone = false;
      for (let s = 0; s < 3 && !gone; s++) {
        k.x += k.vx * dt / 3; k.y += k.vy * dt / 3;
        for (const o of w.players) {
          if (o.team === k.team || o.st === ST.down || (o.st === ST.fly && o.z > 40)) continue;
          if (len(o.x - k.x, o.y - k.y) < PR + 13) {
            if (o.inv > 0) continue;
            const sp = len(k.vx, k.vy) || 1;
            knock(w, o, k.vx / sp, k.vy / sp, 1.0, 380, k.by, 'ki');
            ev(w, 'kiboom', { x: k.x, y: k.y, t: k.team }); gone = true; break;
          }
        }
        if (!gone && !b.owner && b.z < 60 && len(b.x - k.x, b.y - k.y) < BR + 14) {
          b.vx = k.vx * 1.05; b.vy = k.vy * 1.05; b.vz = 160; b.last = k.by; b.kickBy = k.by; b.kickT = 0; b.passTo = null; b.sup = 1;
          ev(w, 'kiboom', { x: k.x, y: k.y, t: k.team }); gone = true;
        }
        if (!gone && (k.x < -GD || k.x > W + GD || k.y < -10 || k.y > H + 10)) { ev(w, 'kiboom', { x: k.x, y: k.y, t: k.team }); gone = true; }
      }
      if (!gone && k.life <= 0) { ev(w, 'kifade', { x: k.x, y: k.y, t: k.team }); gone = true; }
      if (gone) w.proj.splice(i, 1);
    }
  }

  function updBeams(w, dt) {
    const b = w.ball;
    for (let i = w.beams.length - 1; i >= 0; i--) {
      const m = w.beams[i]; m.t -= dt; m.L = Math.min(1050, m.L + 3600 * dt);
      for (const o of w.players) {
        if (o.team === m.team || o.st === ST.down || m.hits.includes(o.id)) continue;
        const t = clamp((o.x - m.x) * m.dx + (o.y - m.y) * m.dy, 0, m.L);
        if (t <= 0) continue;
        if (len(o.x - (m.x + m.dx * t), o.y - (m.y + m.dy * t)) < PR + 26) {
          m.hits.push(o.id);
          knock(w, o, m.dx, m.dy, 1.6, 640, m.by, 'beam');
          w.teams[m.team].stats[3]++;
        }
      }
      if (!m.ball && (!b.owner || b.owner.team !== m.team) && b.z < 90) {
        const t = clamp((b.x - m.x) * m.dx + (b.y - m.y) * m.dy, 0, m.L);
        if (t > 0 && len(b.x - (m.x + m.dx * t), b.y - (m.y + m.dy * t)) < 30) {
          if (b.owner) knock(w, b.owner, m.dx, m.dy, 1.6, 640, m.by, 'beam');
          b.owner = null; b.vx = m.dx * 1350; b.vy = m.dy * 1350; b.vz = 60; b.z = Math.max(b.z, 10);
          b.sup = 2; b.kickBy = m.by; b.last = m.by; b.kickT = 0; b.passTo = null; m.ball = true;
        }
      }
      if (m.t <= 0) w.beams.splice(i, 1);
    }
  }

  function aiCharge(w, p, dt) {
    const ai = p.ai, tm = w.teams[p.team];
    chargeTick(w, p, dt);
    if (ai.beamH < 0) { p.st = ST.run; return; }
    ai.beamH -= dt;
    const tg = ai.tgt;
    if (ai.beamH <= 0) {
      if (tg && tg.st !== ST.down && tm.bar >= 1 && tm.beamCd <= 0 && p.beamC >= 0.45) doBeam(w, p, tg.x - p.x, tg.y - p.y);
      else p.st = ST.run;
      ai.beamH = -1;
    }
  }

  /* ---------- physique joueurs ---------- */
  function turn(p, dx, dy, dt, rate) {
    const a = Math.atan2(p.fy, p.fx), t = Math.atan2(dy, dx);
    let d = t - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const n = a + clamp(d, -rate * dt, rate * dt);
    p.fx = Math.cos(n); p.fy = Math.sin(n);
  }

  function movePlayer(w, p, dt) {
    const b = w.ball;
    switch (p.st) {
      case ST.run: case ST.hold: case ST.kick: {
        if (p.st === ST.kick) { p.t -= dt; if (p.t <= 0) p.st = ST.run; }
        let mx = p.mx, my = p.my, m = len(mx, my);
        if (m > 1) { mx /= m; my /= m; m = 1; }
        const S = SP(p);
        let max = (p.gk ? 265 : 228) * S.spd;
        if (!w.teams[p.team].human) max *= w.diff.speed;
        const moving = m > 0.2;
        if (p.spr && moving && p.stam > 0.03) { max *= 1.42; p.stam -= 0.36 * dt; }
        else p.stam = Math.min(1, p.stam + 0.2 * dt);
        if (p.stam < 0) p.stam = 0;
        if (b.owner === p) max *= S.own;
        if (p.chS) max *= 0.62;
        if (p.chT) max *= 0.55;
        if (p.rec > 0) max *= 0.35;
        if (p.st === ST.hold) max *= 0.5;
        if (p.tr.berserk) max *= 1 + 0.16 * bzF(p);              // BERSERKER : la douleur le rend plus rapide
        else max *= 1 - Math.min(0.12, p.dmg * 0.012);
        if (p.tr.retour && b.owner && b.owner.team !== p.team) max *= 1.15; // RETOUR ÉCLAIR
        if (p.tr.renard && inBox(p)) max *= 1.08;
        // inertie : on rejoint la vitesse voulue en douceur, avec une poussée maximale
        // (on freine et on change d'appui plus fort qu'on n'accélère)
        let ax = (mx * max - p.vx) * 9, ay = (my * max - p.vy) * 9;
        const am = len(ax, ay);
        const cap = (ax * p.vx + ay * p.vy < 0 ? ACC_BRK : ACC_RUN) * (p.gk ? 1.6 : S.acc);
        if (am > cap) { ax *= cap / am; ay *= cap / am; }
        p.vx += ax * dt; p.vy += ay * dt;
        if (moving) turn(p, mx, my, dt, S.turn);
        else if (b.owner !== p) turn(p, b.x - p.x, b.y - p.y, dt, 6);
        if (p.gk && b.owner !== p) turn(p, b.x - p.x, b.y - p.y, dt, 10);
        p.z = 0; p.vz = 0;
        break;
      }
      case ST.cele: {
        p.vz -= PGRAV * dt; p.z += p.vz * dt;
        if (p.z <= 0) { p.z = 0; p.vz = rnd(220, 380); }
        const f = Math.pow(0.05, dt); p.vx *= f; p.vy *= f;
        break;
      }
      case ST.slide: {
        p.t -= dt; const f = Math.pow(0.18, dt); p.vx *= f; p.vy *= f;
        if (w.phase === 'play') slideHits(w, p);
        if (p.t <= 0) { p.st = ST.run; p.rec = 0.32; }
        break;
      }
      case ST.dash: {
        p.t -= dt; if (p.t <= 0) { p.st = ST.run; p.vx *= 0.5; p.vy *= 0.5; }
        break;
      }
      case ST.fly: {
        p.t -= dt; p.vz -= PGRAV * dt; p.z += p.vz * dt;
        if (w.phase === 'play') flyHits(w, p);
        if (p.z <= 0 && p.vz < 0) { p.z = 0; p.vz = 0; p.st = ST.run; p.rec = 0.3; p.vx *= 0.3; p.vy *= 0.3; ev(w, 'land', { x: p.x, y: p.y }); }
        break;
      }
      case ST.down: {
        p.stun -= dt; p.vz -= PGRAV * dt; p.z += p.vz * dt; p.slamCd -= dt;
        if (p.z <= 0) {
          p.z = 0;
          if (p.vz < -160) { // le corps s'écrase au sol, rebondit et perd de l'élan
            if (w.phase === 'play' || w.phase === 'goal') ev(w, 'thud', { x: Math.round(p.x), y: Math.round(p.y), v: Math.round(-p.vz), id: p.id, n: p.landed });
            p.landed++; p.vz = -p.vz * 0.36; p.vx *= 0.8; p.vy *= 0.8; p.spinV *= 0.55;
          } else p.vz = 0;
          const f = Math.pow(0.09, dt); p.vx *= f; p.vy *= f; // il glisse sur la pelouse
        } else p.spin += p.spinV * dt;
        if (p.stun <= 0 && p.z <= 0) { p.st = ST.run; p.inv = p.tr.intouchable ? 1.6 : 0.9; p.rec = 0.2; p.spin = 0; }
        break;
      }
      case ST.dive: {
        p.t -= dt; const f = Math.pow(0.12, dt); p.vx *= f; p.vy *= f;
        if (p.t <= 0) { p.st = ST.run; p.rec = p.tr.feline ? 0.08 : 0.35; }
        break;
      }
      case ST.punch: case ST.punch2: case ST.hkick: {
        p.t -= dt; const f = Math.pow(0.02, dt); p.vx *= f; p.vy *= f;
        if (!p.hitDone && p.t <= p.hitAt) { p.hitDone = true; if (w.phase === 'play') strikeHit(w, p); }
        if (p.t <= 0) p.st = ST.run;
        break;
      }
      case ST.stomp: {
        p.t -= dt; const f = Math.pow(p.hitDone ? 0.002 : 0.2, dt); p.vx *= f; p.vy *= f;
        if (!p.hitDone && p.t <= p.hitAt) { p.hitDone = true; if (w.phase === 'play') stompHit(w, p); else p.stompT = null; }
        if (p.t <= 0) { p.st = ST.run; p.rec = 0.1; }
        break;
      }
      case ST.volley: case ST.head: {
        p.aT -= dt;
        if (p.z > 0 || p.vz > 0) { p.vz -= PGRAV * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } }
        if (!p.hitDone) {
          if (w.phase === 'play' && aerialContact(w, p)) { p.hitDone = true; aerialStrike(w, p); }
          else if (p.aT < -0.08 || w.ball.owner) { p.hitDone = true; ev(w, 'whiff', { x: p.x, y: p.y }); }
        } else { const f = Math.pow(0.05, dt); p.vx *= f; p.vy *= f; }
        if (p.hitDone && p.z <= 0 && p.aT < -0.22) { p.st = ST.run; p.rec = 0.12; }
        break;
      }
      case ST.stag: {
        p.t -= dt; const f = Math.pow(0.03, dt); p.vx *= f; p.vy *= f;
        if (p.t <= 0) { p.st = ST.run; p.rec = 0.12; }
        break;
      }
      case ST.charge: { const f = Math.pow(0.0005, dt); p.vx *= f; p.vy *= f; p.stam = Math.min(1, p.stam + 0.2 * dt); break; }
      case ST.blast: {
        p.t -= dt; const f = Math.pow(0.01, dt); p.vx *= f; p.vy *= f;
        if (p.t <= 0) { p.st = ST.run; p.rec = 0.12; }
        break;
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.gk && p.st === ST.hold) { // ballon en main : le gardien reste dans sa surface… et devant sa ligne (pas de CSC)
      if (p.tr.libero && w.ball.owner === p && !inOwnBox(p)) { p.st = ST.run; ev(w, 'tr', { x: p.x, y: p.y, s: 'libero' }); } // LIBÉRO : il sort balle au pied
      else if (p.tr.libero) p.x = p.team === 0 ? Math.max(p.x, PR + BR + 6) : Math.min(p.x, W - PR - BR - 6); // il peut sortir de sa surface
      else {
        p.x = p.team === 0 ? clamp(p.x, PR + BR + 6, 200) : clamp(p.x, W - 200, W - PR - BR - 6);
        p.y = clamp(p.y, MT - 130, MB + 130);
      }
    }
    if (p.st !== ST.down) { clampP(p); return; }
    const vx0 = p.vx, vy0 = p.vy;
    clampP(p);
    if (w.phase !== 'play') return;
    // projeté contre les murets : ÉCRASÉ CONTRE LA BALUSTRADE
    const hit = Math.max(Math.abs(vx0 - p.vx), Math.abs(vy0 - p.vy)) / 1.3;
    if (hit > 250 && p.slamCd <= 0 && p.z < 60) {
      p.slamCd = 0.4; p.stun = Math.min(p.stun + 0.35, 2.6); p.dmg = Math.min(10, p.dmg + 1);
      p.vx *= 1.4; p.vy *= 1.4; // rebond plus sec contre le béton
      ev(w, 'slam', { x: Math.round(p.x), y: Math.round(p.y), v: Math.round(hit), id: p.id, n: p.name, d: Math.round(p.dmg * 10) / 10, dx: Math.round(Math.sign(p.vx) * 100) / 100, dy: Math.round(Math.sign(p.vy) * 100) / 100, a: p.kBy ? p.kBy.team : -1 });
    }
    // envoyé AU FOND DES FILETS
    if (!p.inNet && (p.x < -6 || p.x > W + 6) && p.y > MT && p.y < MB) { p.inNet = true; ev(w, 'net', { x: Math.round(p.x), y: Math.round(p.y), id: p.id, n: p.name }); }
  }

  function clampP(p) {
    const inMouth = p.y > MT + 4 && p.y < MB - 4;
    const minX = inMouth ? -GD + PR : PR, maxX = inMouth ? W + GD - PR : W - PR;
    if (p.x < minX) { p.x = minX; if (p.vx < 0) p.vx *= -0.3; }
    if (p.x > maxX) { p.x = maxX; if (p.vx > 0) p.vx *= -0.3; }
    const inGoal = p.x < 0 || p.x > W;
    const minY = inGoal ? MT + PR * 0.6 : PR, maxY = inGoal ? MB - PR * 0.6 : H - PR;
    if (p.y < minY) { p.y = minY; if (p.vy < 0) p.vy *= -0.3; }
    if (p.y > maxY) { p.y = maxY; if (p.vy > 0) p.vy *= -0.3; }
  }

  function shoulder(w, a, c) { // CHARGE D'ÉPAULE du Bulldozer lancé en sprint
    if (!a.tr.charge || a.chCd > 0 || !a.spr || !(a.st === ST.run || a.st === ST.kick) || len(a.vx, a.vy) < 230) return false;
    if (c.st === ST.down || c.inv > 0 || (c.gk && c.st === ST.hold)) return false;
    const dx = c.x - a.x, dy = c.y - a.y, d = len(dx, dy) || 1, v = len(a.vx, a.vy);
    if ((a.vx * dx + a.vy * dy) / (v * d) < 0.6) return false; // il faut lui foncer dessus
    a.chCd = 2.2; knock(w, c, dx / d, dy / d, 0.9, 420, a, 'charge'); a.vx *= 0.7; a.vy *= 0.7;
    return true;
  }

  function pickpocket(w) { // PICKPOCKET : on lui chipe le ballon en arrivant dans son dos
    const b = w.ball, o = b.owner; if (!o || o.gk || o.inv > 0) return;
    for (let i = 0; i < 3; i++) {
      const p = w.players[(1 - o.team) * 4 + i];
      if (!p.tr.pickpocket || p.stealCd > 0 || p.pickCd > 0 || !(p.st === ST.run || p.st === ST.kick)) continue;
      const vx = p.x - o.x, vy = p.y - o.y, d = len(vx, vy);
      if (d > PR * 2 + 10 || d < 0.01 || (vx * o.fx + vy * o.fy) / d > -0.15) continue;
      p.stealCd = 2; o.pickCd = 0.7; b.owner = null; possess(w, p);
      ev(w, 'tr', { x: p.x, y: p.y, s: 'pickpocket' });
      return;
    }
  }

  function collide(w) {
    const P = w.players;
    for (let i = 0; i < P.length; i++) {
      const a = P[i]; if (a.z > 12) continue;
      for (let j = i + 1; j < P.length; j++) {
        const c = P[j]; if (c.z > 12) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = len(dx, dy), mind = PR * 2 - 2;
        if (d >= mind || d < 0.01) continue;
        if ((a.st === ST.dash || c.st === ST.dash) && a.team !== c.team) continue; // l'esquive passe à côté du défenseur
        const o = (mind - d) / d;
        if (a.team !== c.team) { if (shoulder(w, a, c)) continue; if (shoulder(w, c, a)) continue; }
        const ma = SP(a).mass, mc = SP(c).mass; // le costaud pousse, le léger est poussé
        let wa = mc / (ma + mc), wc = ma / (ma + mc);
        if (a.st === ST.hold) { wa = 0; wc = 1; } else if (c.st === ST.hold) { wa = 1; wc = 0; }
        a.x -= dx * o * wa; a.y -= dy * o * wa; c.x += dx * o * wc; c.y += dy * o * wc;
      }
    }
  }

  /* ---------- ballon ---------- */
  function possess(w, p) {
    const b = w.ball, prev = b.last;
    b.owner = p; b.sup = 0; b.vx = 0; b.vy = 0; b.vz = 0; b.fxk = '';
    const tm = w.teams[p.team];
    if (b.passTo === p && b.kickBy && b.kickBy.team === p.team && b.kickBy !== p) { tm.bar = Math.min(1, tm.bar + 0.03); tm.stats[5]++; }
    else if (prev && prev.team !== p.team && b.kickT < 3) tm.bar = Math.min(1, tm.bar + 0.02);
    b.passTo = null; b.last = p; p.chT = false; p.tch = 0;
    if (p.gk) { p.st = p.tr.libero && !inOwnBox(p) ? ST.run : ST.hold; p.ai.holdT = 0; }
    if (tm.human && !p.gk && tm.ctrl !== p.idx) setCtrl(w, tm, p.idx);
  }

  function ballPhys(w, dt, dead) {
    const b = w.ball;
    b.wallT -= dt;
    if (b.owner) {
      const p = b.owner, d = PR + BR + 1;
      b.x = p.x + p.fx * d; b.y = p.y + p.fy * d;
      b.z = p.st === ST.hold ? 20 : Math.abs(Math.sin(w.t * 11)) * 3;
      if (p.gk && p.st === ST.hold) b.x = clamp(b.x, BR + 2, W - BR - 2); // le ballon en main ne franchit jamais la ligne
      b.y = clamp(b.y, BR, H - BR);
      const inMouth = b.y > MT && b.y < MB;
      b.x = inMouth ? clamp(b.x, -GD + BR, W + GD - BR) : clamp(b.x, BR, W - BR);
      b.vx = p.vx; b.vy = p.vy; b.vz = 0;
      if (!dead) goalCheck(w);
      return;
    }
    const nk = b.kickT < (b.oT || 0) || b.kickBy !== b.oBy;
    b.kickT += dt;
    if (nk) { b.oBy = b.kickBy; b.ox = b.x; b.oy = b.y; b.hyp = 0; b.beat = null; } // point de départ du dernier tir : le gardien lit les frappes lointaines
    b.oT = b.kickT;
    const hk = hypnoK(w);
    const g = b.gp;
    if (g && (b.sup !== 2 || b.kickBy !== g.by)) { b.gp = null; b.uk = 0; } // l'ultime a été stoppé
    else if (g) { // ULTIME : trajectoire guidée
      const n = Math.max(1, Math.min(12, Math.ceil(dt / 0.0035))), h = dt / n;
      for (let i = 0; i < n; i++) {
        const s0 = Math.min(1, g.t / g.dur); g.t += h * (hk ? 0.6 : 1); const s = Math.min(1, g.t / g.dur);
        const px = b.x, py = b.y, pz = b.z, o = gpPos(g, s);
        b.x = o[0]; b.y = o[1]; b.z = o[2]; g.u = o[3];
        const gx = g.by.team === 0 ? W : 0;
        if (Math.abs(b.x - gx) < 70) b.z = Math.min(b.z, 66); // toujours sous la barre
        b.vx = (b.x - px) / h; b.vy = (b.y - py) / h; b.vz = (b.z - pz) / h;
        ultTick(w, g, s, s0);
        if (!dead) { if (ballTouch(w)) { b.gp = null; b.uk = 0; return; } if (goalCheck(w)) { b.gp = null; b.uk = 0; return; } }
        if (b.gp !== g || b.sup !== 2 || b.kickBy !== g.by || b.owner) { b.gp = null; b.uk = 0; return; }
        if (s >= 1) { b.gp = null; b.uk = 0; const sp = len(b.vx, b.vy); if (sp > 1900) { b.vx *= 1900 / sp; b.vy *= 1900 / sp; } return; }
      }
      return;
    }
    // ENROULÉE / FLOTTANTE : effet tant que personne n'a touché le ballon
    const cu = b.cuBy && b.last === b.cuBy && b.kickBy === b.cuBy && b.kickT >= b.cuT && b.kickT < b.cuEnd && b.z > 0.5;
    b.cuT = b.kickT;
    if (cu && (b.curl || b.knk >= 0)) {
      const a = (b.curl + (b.knk >= 0 ? 0.3 * b.knk * Math.cos(b.kickT * b.knk) : 0)) * dt, ca = Math.cos(a), sa = Math.sin(a); // flottante : le cap oscille autour de la visée
      const vx = b.vx * ca - b.vy * sa; b.vy = b.vx * sa + b.vy * ca; b.vx = vx;
      if (b.knk >= 0) b.vz += 220 * Math.cos(b.kickT * b.knk * 0.8) * dt;
    }
    const sp = len(b.vx, b.vy);
    const n = Math.max(1, Math.min(8, Math.ceil(sp * dt / 7)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      b.x += b.vx * h; b.y += b.vy * h;
      b.vz -= GRAV * h * (b.vz < 0 && b.fxk === 'comete' && b.fxBy === b.kickBy ? DIPG : 1); b.z += b.vz * h;
      if (b.z <= 0) { b.z = 0; if (b.vz < -140) b.vz = -b.vz * 0.52; else b.vz = 0; }
      walls(w, b);
      if (!dead) { if (ballTouch(w)) break; if (goalCheck(w)) return; }
    }
    if (b.owner) return;
    const s2 = len(b.vx, b.vy);
    if (s2 > 0) {
      let ns = b.z <= 0.5 ? Math.max(0, s2 - DEC * dt) : s2 * (1 - 0.05 * dt);
      if (hk && ns > 430) ns = Math.max(430, ns * Math.exp(-2.4 * dt)); // MAUVAIS ŒIL
      ns = Math.min(ns, 1900);
      b.vx *= ns / s2; b.vy *= ns / s2;
    }
    if (b.sup && s2 < 620) b.sup = 0;
  }

  // l'Hypnotiseur dont le but est menacé par le tir en cours (ou null)
  function hypnoK(w) {
    const b = w.ball; if (!b.kickBy || b.owner) return null;
    const k = w.players[(1 - b.kickBy.team) * 4 + 3]; if (!k.tr.hypnose || k.st === ST.down) return null;
    const gx = k.team === 0 ? 0 : W, sg = k.team === 0 ? 1 : -1;
    if (b.vx * sg > -250 || len(b.x - gx, b.y - H / 2) > 380) return null;
    if (!b.hyp) { b.hyp = 1; ev(w, 'tr', { x: k.x, y: k.y, s: 'hypnose', bx: Math.round(b.x), by: Math.round(b.y), id: k.id }); }
    return k;
  }
  function wallHit(w, b, v) { if (v > 320 && b.wallT <= 0) { b.wallT = 0.12; ev(w, 'wall', { x: b.x, y: b.y, v: Math.round(v) }); } }

  function walls(w, b) {
    if (b.y < BR && !(b.x < 0 || b.x > W)) { b.y = BR; if (b.vy < 0) { wallHit(w, b, -b.vy); b.vy = -b.vy * 0.78; } }
    else if (b.y > H - BR && !(b.x < 0 || b.x > W)) { b.y = H - BR; if (b.vy > 0) { wallHit(w, b, b.vy); b.vy = -b.vy * 0.78; } }
    for (let side = 0; side < 2; side++) {
      const deep = side === 0 ? -b.x : b.x - W; // >0 : derrière la ligne
      const sg = side === 0 ? 1 : -1;
      if (deep > 0) {
        if (b.y < MT + BR) { b.y = MT + BR; b.vy = Math.abs(b.vy) * 0.3; }
        if (b.y > MB - BR) { b.y = MB - BR; b.vy = -Math.abs(b.vy) * 0.3; }
        if (deep > GD - BR) { b.x = side === 0 ? -GD + BR : W + GD - BR; b.vx = sg * Math.abs(b.vx) * 0.07; b.vy *= 0.45; b.vz *= 0.4; } // le filet absorbe le ballon
        if (b.z > BARZ - BR) { b.z = BARZ - BR; b.vz = -Math.abs(b.vz) * 0.2; }
      } else if (deep > -BR) {
        const inMouth = b.y > MT && b.y < MB;
        if (inMouth && b.z < BARZ - BR * 0.5) continue;
        const v = -sg * b.vx;
        if (inMouth && b.z < BARZ + BR) { // barre transversale
          b.x = side === 0 ? BR : W - BR;
          if (v > 0) { b.vx = sg * v * 0.6; b.vz = Math.abs(b.vz) * 0.4 + 120; if (v > 200) ev(w, 'post', { x: side ? W : 0, y: b.y, z: BARZ }); }
          continue;
        }
        b.x = side === 0 ? BR : W - BR;
        if (v > 0) { wallHit(w, b, v); b.vx = sg * v * 0.78; }
      }
    }
    if (b.z < BARZ) {
      for (const pp of POSTS) {
        const dx = b.x - pp[0], dy = b.y - pp[1], d = len(dx, dy), rr = BR + 4;
        if (d < rr && d > 0.01) {
          const nx = dx / d, ny = dy / d;
          b.x = pp[0] + nx * rr; b.y = pp[1] + ny * rr;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; if (-vn > 200) ev(w, 'post', { x: pp[0], y: pp[1], z: 40 }); }
        }
      }
    }
  }

  function goalCheck(w) {
    const b = w.ball;
    if (b.y > MT && b.y < MB) {
      if (b.x < -BR) { scored(w, 1); return true; }
      if (b.x > W + BR) { scored(w, 0); return true; }
    }
    return false;
  }

  function scored(w, team) {
    const b = w.ball, last = b.last;
    const own = !!(last && last.team !== team);
    if (b.owner) { b.vx = b.owner.vx; b.vy = b.owner.vy; b.owner = null; }
    w.score[team]++; w.teams[team].stats[2]++;
    ev(w, 'goal', { t: team, n: last ? last.name : '', own: own ? 1 : 0, x: Math.round(b.x), y: Math.round(b.y) });
    w.phase = 'goal'; w.phaseT = 2.8; w.kickTeam = 1 - team; w.celeTeam = team;
    w.teams[1 - team].bar = Math.min(1, w.teams[1 - team].bar + 0.12);
    w.slowT = 0;
    if (w.golden) { w.ended = true; w.winner = team; w.slowT = 1.1; } // BUT EN OR : le temps se fige sur le but décisif
    for (const p of w.players) { p.chS = false; p.charge = 0; p.chT = false; p.tch = 0; p.aAct = false; if (p.st === ST.hold) p.st = ST.run; }
  }

  function ballTouch(w) {
    const b = w.ball; if (b.owner) return true;
    const sp = len(b.vx, b.vy);
    let best = null, bd = 1e9;
    const foeBall = q => b.kickBy && b.kickBy.team !== q.team;
    for (const p of w.players) {
      if (p.st === ST.down) continue;
      const dx = b.x - p.x, dy = b.y - p.y, d = len(dx, dy);
      // portées spéciales : LE MUR, TENTACULES (contre les ballons adverses), RENARD (ballons qui traînent près du but)
      const xr = p.gk ? 0 : p.tr.mur && foeBall(p) ? 18 : p.tr.tentacules && foeBall(p) && !b.sup ? 16 : p.tr.renard && inBox(p) && sp < 700 ? 14 : 0;
      const reach = PR + BR + (p.gk ? (p.st === ST.dive ? 16 * SP(p).dive + (p.tr.feline ? 8 : 0) : b.passTo === p ? 26 : 7) : 3) + xr;
      if (d > reach) continue;
      const zmax = p.gk ? (b.passTo === p ? 140 : gkZ(w, p)) : (p.st === ST.fly ? p.z + 40 : p.tr.mur ? 58 : xr ? 42 : 30);
      if (b.z > zmax) continue;
      if (bfx(b, 'laser') && p.team !== b.kickBy.team && b.kickT < 1.5) continue; // PASSE LASER : impossible à couper
      if (p.st === ST.fly || p.st === ST.slide) continue; // gérés par flyHits / slideHits
      if (AERIAL(p.st) && !p.hitDone) continue;           // géré par aerialContact
      if (b.sup && b.kickBy) {
        if (p === b.kickBy && b.kickT < 0.3) continue;
        if (p.team === b.kickBy.team) continue;
        if (b.gp && b.gp.inv) continue; // ABRACADABRA : on ne touche pas ce qu'on ne voit pas
        if (p.gk) { if (b.beat === p) continue; if (gkSuper(w, p, sp)) return false; continue; }
        if (p.inv > 0) continue;
        if (p.tr.mur) { // LE MUR : il prend la frappe en pleine poitrine et ne bouge pas
          b.vx = -b.vx * 0.22 + rnd(-120, 120); b.vy = -b.vy * 0.22 + rnd(-120, 120); b.vz = 170; b.sup = 0; b.fxk = '';
          b.last = p; b.passTo = null; p.pickCd = 0.3; ev(w, 'tr', { x: p.x, y: p.y, s: 'mur' });
          return false;
        }
        knock(w, p, b.vx / (sp || 1), b.vy / (sp || 1), 1.2, 420, b.kickBy, 'ball');
        const f = b.sup === 2 ? 0.97 : 0.82; b.vx *= f; b.vy *= f;
        continue;
      }
      if (p.pickCd > 0) continue;
      if (xr && d > reach - xr) p.xrT = 1; else p.xrT = 0; // prise de balle grâce à sa portée spéciale
      if (b.lobBy && b.lobBy === b.kickBy && b.kickT < 0.2 && p.team !== b.lobBy.team) continue; // le sombrero décolle : pas de contrôle au pied
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return false;
    const p = best;
    if (p.gk) return gkTouch(w, p, sp);
    if (sp > 800 && b.passTo !== p && p.tr.ventouse) { ev(w, 'tr', { x: p.x, y: p.y, s: 'ventouse' }); possess(w, p); return true; } // VENTOUSE
    if (sp > 800 && b.passTo !== p) {
      const dx = b.x - p.x, dy = b.y - p.y, d = len(dx, dy) || 1, nx = dx / d, ny = dy / d;
      b.fxk = '';
      if (p.tr.mur) { b.vx *= 0.25; b.vy *= 0.25; ev(w, 'tr', { x: p.x, y: p.y, s: 'mur' }); }
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
      b.vx *= 0.6; b.vy *= 0.6; b.vz = Math.max(b.vz, 120); b.last = p; b.passTo = null; p.pickCd = 0.25;
      ev(w, 'deflect', { x: p.x, y: p.y });
      return false;
    }
    if (p.xrT && b.kickBy && b.kickBy.team !== p.team) ev(w, 'tr', { x: p.x, y: p.y, s: p.tr.tentacules ? 'tentacules' : p.tr.renard ? 'renard' : 'mur' });
    possess(w, p);
    return true;
  }

  // niveau du gardien (difficulté) ; en but en or qui s'éternise, les gardiens fatiguent
  function gkSkill(w, k) { return (w.teams[k.team].human ? 1 : w.diff.gk) * clamp(1 - ((w.goldT || 0) - 60) / 300, 0.6, 1); }
  // distance parcourue par le tir jusqu'au gardien → 0 (tir de près) … 1 (tir depuis l'autre camp)
  function farF(w, k) { const b = w.ball; return b.ox == null ? 0 : clamp((len(k.x - b.ox, k.y - b.oy) - 450) / 500, 0, 1); }
  // hauteur que le gardien peut atteindre : sur un tir lointain il a le temps de sauter jusqu'à la barre
  function gkZ(w, k) {
    const b = w.ball; if (!(b.last && b.last.team !== k.team)) return 80;
    return k.tr.scorpion ? BARZ + 12 : 80 + 18 * farF(w, k) + (SP(k).zb || 0); // LE SCORPION : rien ne passe au-dessus de lui
  }

  function gkTouch(w, k, sp) {
    const b = w.ball;
    const shotAtUs = !!(b.last && b.last.team !== k.team);
    if (shotAtUs && k.tr.scorpion && b.z > 72 && sp > 300) { gkClear(w, k, 'scorpion'); gkSaved(w, k); return false; } // LE SCORPION
    if (!shotAtUs || sp < 980 * gkSkill(w, k) * SP(k).ref * (1 + 0.8 * farF(w, k))) {
      if (shotAtUs && sp > 380) { ev(w, 'save', { x: k.x, y: k.y, t: k.team }); gkSaved(w, k); }
      possess(w, k);
      return true;
    }
    const sg = k.team === 0 ? 1 : -1;
    if (k.tr.poing) gkClear(w, k, 'poing'); // POINGS DE FER : jamais de ballon qui traîne devant le but
    else { b.vx = Math.abs(b.vx) * 0.4 * sg; b.vy = b.vy * 0.3 + rnd(-320, 320); b.vz = rnd(150, 320); }
    b.last = k; b.passTo = null; k.pickCd = 0.5; b.fxk = '';
    ev(w, 'save', { x: k.x, y: k.y, t: k.team }); gkSaved(w, k);
    return false;
  }
  function gkClear(w, k, how) { // dégagement sur l'arrêt : poing ou coup du scorpion, loin devant
    const b = w.ball, sg = k.team === 0 ? 1 : -1;
    b.vx = sg * rnd(880, 1080); b.vy = rnd(-260, 260); b.vz = how === 'scorpion' ? rnd(430, 520) : rnd(300, 400);
    b.last = k; b.kickBy = k; b.kickT = 0; b.passTo = null; b.sup = 0; b.fxk = ''; b.gp = null; b.uk = 0; k.pickCd = 0.5;
    ev(w, 'tr', { x: k.x, y: k.y, s: how, id: k.id });
  }
  function gkSaved(w, k) { // TRANSE : chaque arrêt remplit la barre de ki
    if (!k.tr.transe) return;
    const tm = w.teams[k.team]; tm.bar = Math.min(1, tm.bar + 0.2);
    ev(w, 'tr', { x: k.x, y: k.y, s: 'transe' });
  }

  function gkSuper(w, k, sp) {
    const b = w.ball, s = sp || 1;
    const trick = bfx(b, 'lucarne') || bfx(b, 'comete'), heavy = bfx(b, 'tigre') || bfx(b, 'canon');
    const f = farF(w, k), dist = b.ox == null ? 0 : len(k.x - b.ox, k.y - b.oy);
    // chance que le tir passe : de loin, le gardien a tout le temps de le lire
    let pg = b.sup === 2 ? 1 : heavy ? 1 - 0.85 * (bfx(b, 'canon') ? clamp((dist - 700) / 400, 0, 1) : clamp((dist - 550) / 450, 0, 1)) : (trick ? 0.78 : 0.5) / gkSkill(w, k) * (1 - 0.9 * f);
    if (b.sup !== 2) pg /= SP(k).carr;           // la carrure : un costaud encaisse les boulets
    if (k.tr.blinde) pg *= b.sup === 2 ? 0.7 : 0.55; // BLINDÉ : même un ultime peut rebondir sur lui
    if (R() < pg) {
      b.beat = k; // ce gardien est battu : le ballon file
      if (k.tr.blinde) ev(w, 'tr', { x: k.x, y: k.y, s: 'blinde' }); // il ne tombe jamais
      else knock(w, k, b.vx / s, b.vy / s, 1.5, 520, b.kickBy, 'gk');
      b.vx *= 0.9; b.vy *= 0.9;
      return false;
    }
    const sg = k.team === 0 ? 1 : -1, ul = b.sup === 2 ? 1 : 0;
    if (f > 0.5 && !heavy && !k.tr.poing) { ev(w, 'save', { x: k.x, y: k.y, t: k.team, big: 1 }); gkSaved(w, k); possess(w, k); return true; } // tir de trop loin : capté
    if (!k.tr.blinde) knock(w, k, -sg, 0, 0.7, 180, b.kickBy, 'gkp');
    if (k.tr.poing || (k.tr.scorpion && b.z > 72)) gkClear(w, k, k.tr.poing ? 'poing' : 'scorpion');
    else { b.vx = Math.abs(b.vx) * 0.45 * sg; b.vy = b.vy * 0.3 + rnd(-380, 380); b.vz = rnd(220, 380); }
    b.last = k; b.sup = 0; b.passTo = null; b.fxk = ''; b.gp = null; b.uk = 0;
    ev(w, 'save', { x: k.x, y: k.y, t: k.team, big: 1, ul }); gkSaved(w, k);
    return true;
  }

  /* ---------- IA ---------- */
  function seek(p, tx, ty, spr) {
    const dx = tx - p.x, dy = ty - p.y, d = len(dx, dy);
    if (d < 8) { p.mx = 0; p.my = 0; }
    else { const s = Math.min(1, (d - 4) / 75); p.mx = dx / d * s; p.my = dy / d * s; } // on ralentit à l'approche
    p.spr = spr;
  }

  function closestField(w, team, x, y) {
    let best = null, bd = 1e9;
    for (let i = 0; i < 3; i++) {
      const p = w.players[team * 4 + i]; if (p.st === ST.down) continue;
      const d = len(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function homeSpot(w, p) {
    const b = w.ball, sg = p.team === 0 ? 1 : -1;
    const ub = p.team === 0 ? b.x / W : 1 - b.x / W;
    const bv = b.y / H;
    let u, v;
    const sw = clamp((bv - 0.38) / 0.24, 0, 1), sm = sw * sw * (3 - 2 * sw); // bascule progressive
    if (p.role === 'ATT') { u = 0.64; v = 0.62 - 0.24 * sm; }
    else if (p.role === 'MIL') { u = 0.46; v = 0.3 + 0.4 * sm; }
    else { u = 0.22; v = 0.5; }
    u += (ub - 0.5) * 0.45; v = v * 0.65 + bv * 0.35;
    const car = b.owner;
    if (car && car.team === p.team) u += 0.08; else if (car) u -= 0.08;
    u = clamp(u, 0.08, 0.9); v = clamp(v, 0.1, 0.9);
    return { x: p.team === 0 ? u * W : (1 - u) * W, y: v * H, sg };
  }

  /* ---------- déplacements sans ballon : on cherche l'espace, on marque, on couvre ---------- */
  function foeDist(w, team, x, y) {
    let o = 1e9;
    for (let j = 0; j < 4; j++) { const q = w.players[(1 - team) * 4 + j]; if (q.st === ST.down) continue; const d = len(q.x - x, q.y - y) * (q.gk ? 1.6 : 1); if (d < o) o = d; }
    return o;
  }
  // l'attaquant (le plus offensif des deux) fait l'appel dans l'espace, l'autre propose un relais
  function supportSpot(w, p, car) {
    const ai = p.ai, sg = p.team === 0 ? 1 : -1, gx = p.team === 0 ? W : 0;
    let runner = null, relay = null;
    for (let i = 0; i < 3; i++) { const m = w.players[p.team * 4 + i]; if (m === car || m.st === ST.down) continue; if (!runner) runner = m; else relay = m; }
    const isRun = p === runner, other = isRun ? relay : runner;
    const keep = ai.supCar === car && ai.supUntil > w.t && foeDist(w, p.team, car.x + ai.sox, car.y + ai.soy) > 95; // on garde son idée… sauf si un défenseur vient la fermer
    if (keep) {
      return { x: clamp(car.x + ai.sox, 70, W - 70), y: clamp(car.y + ai.soy, 60, H - 60), run: isRun && ai.sox * sg > 140 };
    }
    const from = { x: car.x, y: car.y, team: p.team };
    const FX = isRun ? [160, 250, 340, 430] : [-240, -150, -60, 40], FY = isRun ? [-300, -170, -60, 60, 170, 300] : [-280, -160, 160, 280];
    let bs = -1e9, bx = 0, by = 0;
    for (const fx of FX) for (const fy of FY) {
      const cx = clamp(car.x + sg * fx, 80, W - 80), cy = clamp(car.y + fy, 70, H - 70);
      let sc = Math.min(foeDist(w, p.team, cx, cy), 240) * 0.016;               // de l'espace autour de soi
      sc -= laneBlock(w, from, cx, cy) * 1.9;                                    // une ligne de passe dégagée
      const dc = len(cx - car.x, cy - car.y);
      if (dc < 150) sc -= (150 - dc) * 0.012; else if (dc > 430) sc -= (dc - 430) * 0.006; // ni collé, ni trop loin
      if (other) { const dm = len(cx - other.x, cy - other.y); if (dm < 190) sc -= (190 - dm) * 0.01; } // s'écarter du coéquipier
      sc -= len(cx - p.x, cy - p.y) * 0.0018;                                    // un endroit qu'on peut atteindre
      if (isRun) { sc += (cx - car.x) * sg * 0.004; const dg = len(gx - cx, H / 2 - cy); if (dg < 520) sc += (520 - dg) * 0.004; }
      else sc += Math.max(0, 1 - Math.abs(cy - H / 2) / 420) * 0.3;
      if (ai.supCar === car && len(cx - (car.x + ai.sox), cy - (car.y + ai.soy)) < 70) sc += 0.4; // continuité
      if (sc > bs) { bs = sc; bx = cx; by = cy; }
    }
    ai.sox = bx - car.x; ai.soy = by - car.y; ai.supCar = car; ai.supUntil = w.t + rnd(0.5, 0.9);
    return { x: bx, y: by, run: isRun && ai.sox * sg > 140 };
  }
  // marquage : chaque adversaire sans ballon est pris par un seul défenseur, placé côté but
  function markSpot(w, p, car, presser, ctrlP) {
    const myGx = p.team === 0 ? 0 : W;
    const defs = [];
    for (let i = 0; i < 3; i++) { const m = w.players[p.team * 4 + i]; if (m !== presser && m !== ctrlP && m.st !== ST.down) defs.push(m); }
    const foes = [];
    for (let j = 0; j < 3; j++) { const q = w.players[(1 - p.team) * 4 + j]; if (q !== car && q.st !== ST.down) foes.push(q); }
    foes.sort((a, c) => Math.abs(a.x - myGx) - Math.abs(c.x - myGx)); // le plus menaçant d'abord
    const used = []; let mine = null;
    for (const f of foes) {
      let bd = 1e9, bm = null;
      for (const d of defs) { if (used.includes(d)) continue; const dd = len(d.x - f.x, d.y - f.y); if (dd < bd) { bd = dd; bm = d; } }
      if (bm) { used.push(bm); if (bm === p) mine = f; }
    }
    const zx = myGx + (car.x - myGx) * 0.45, zy = H / 2 + (car.y - H / 2) * 0.6; // zone entre le porteur et notre but
    if (!mine) return { x: zx, y: zy };
    // deux attaquants collés : le second défenseur ne s'empile pas, il ferme la zone
    for (const f of foes) if (f !== mine && len(f.x - mine.x, f.y - mine.y) < 130 && Math.abs(f.x - myGx) < Math.abs(mine.x - myGx)) return { x: zx, y: zy };
    const gdx = myGx - mine.x, gdy = H / 2 - mine.y, gl = len(gdx, gdy) || 1;
    let tx = mine.x + gdx / gl * 40 + (car.x - mine.x) * 0.16, ty = mine.y + gdy / gl * 40 + (car.y - mine.y) * 0.16;
    if (p.role === 'DEF') { tx = tx * 0.7 + zx * 0.3; ty = ty * 0.7 + zy * 0.3; } // le dernier rempart ne se fait pas aspirer
    return { x: tx, y: ty };
  }
  // on ne se marche pas dessus : la cible s'écarte des coéquipiers
  function spread(w, p, t) {
    for (let i = 0; i < 3; i++) {
      const m = w.players[p.team * 4 + i]; if (m === p || m.st === ST.down) continue;
      const own = m === w.ball.owner || m.ai.tx === 0;
      for (const [mx, my, R0] of [[m.x, m.y, 120], [own ? m.x : m.ai.tx, own ? m.y : m.ai.ty, 140]]) { // sa position ET sa destination
        const dx = t.x - mx, dy = t.y - my, d = len(dx, dy);
        if (d < R0) { const k = (R0 - d) / (d || 1); t.x += dx * k * 0.8; t.y += dy * k * 0.8; }
      }
    }
    t.x = clamp(t.x, 40, W - 40); t.y = clamp(t.y, 40, H - 40);
    return t;
  }
  function bestPassMate(w, p) {
    const sg = p.team === 0 ? 1 : -1;
    let best = null, bs = 0.15;
    for (let i = 0; i < 3; i++) {
      const m = w.players[p.team * 4 + i]; if (m === p || m.st === ST.down) continue;
      let open = 1e9;
      for (let j = 0; j < 4; j++) { const o = w.players[(1 - p.team) * 4 + j]; if (o.st === ST.down) continue; open = Math.min(open, len(o.x - m.x, o.y - m.y)); }
      const prog = (m.x - p.x) * sg;
      const s = prog * 0.002 + Math.min(open, 220) * 0.004 - laneBlock(w, p, m.x, m.y) * 0.6;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  function aiShotTarget(w, p) {
    const k = w.players[(1 - p.team) * 4 + 3];
    const gx = p.team === 0 ? W : 0, sg = p.team === 0 ? 1 : -1;
    return { x: gx + sg * 12, y: H / 2 + (k.y <= H / 2 ? 1 : -1) * GHW * rnd(0.35, 0.85) };
  }

  function aiCarrier(w, p, dt, D) {
    const tm = w.teams[p.team], ai = p.ai, sg = p.team === 0 ? 1 : -1, ogx = p.team === 0 ? W : 0;
    const gdx = ogx - p.x, gdy = H / 2 - p.y, gd = len(gdx, gdy) || 1;
    let near = null, nd = 1e9, slider = null;
    for (let j = 0; j < 4; j++) {
      const o = w.players[(1 - p.team) * 4 + j]; if (o.st === ST.down) continue;
      const d = len(o.x - p.x, o.y - p.y);
      if (d < nd) { nd = d; near = o; }
      if ((o.st === ST.slide || o.st === ST.fly || o.chT || (STRIKE(o.st) && d < 90)) && d < 150) {
        const vdot = o.st === ST.slide || o.st === ST.fly ? (o.vx * (p.x - o.x) + o.vy * (p.y - o.y)) : 1;
        if (vdot > 0) slider = o;
      }
    }
    for (const k of w.proj) if (k.team !== p.team && len(k.x - p.x, k.y - p.y) < 220 && k.vx * (p.x - k.x) + k.vy * (p.y - k.y) > 0) slider = { x: k.x, y: k.y };
    if (slider && p.dashCd <= 0 && (p.st === ST.run || p.st === ST.kick) && R() < 0.07 * D.react * 4) {
      const ax = -(slider.y - p.y), ay = slider.x - p.x;
      const s = (ax * gdx + ay * gdy) >= 0 ? 1 : -1;
      doDash(w, p, ax * s, ay * s);
      return;
    }
    if (ai.shootH >= 0) {
      ai.shootH -= dt; p.chS = true; p.charge = Math.min(1, p.charge + dt / (SP(p).chg * (p.tr.renard && inBox(p) ? 0.33 : 1)));
      p.mx = gdx / gd * 0.5; p.my = gdy / gd * 0.5; p.spr = false;
      if (ai.shootH < 0) { const t = aiShotTarget(w, p); doShoot(w, p, p.charge, false, t.x, t.y); ai.shootH = -1; }
      return;
    }
    ai.dec -= dt;
    if (ai.dec <= 0) {
      ai.dec = rnd(0.1, 0.2) / D.react;
      if (near && nd < 95 && p.dashCd <= 0 && p.stam > 0.25 && gd < 760 && (near.x - p.x) * gdx + (near.y - p.y) * gdy > 0 && R() < 0.09 * D.aggr * (SP(p).acc > 1.2 ? 2.2 : SP(p).acc < 1 ? 0.4 : 1) * (p.tr.crochet ? 1.5 : 1)) {
        doDash(w, p, gdx / gd + rnd(-0.45, 0.45), gdy / gd + rnd(-0.45, 0.45)); return; // sombrero par-dessus le défenseur
      }
      if (tm.bar >= 1 && gd < 620 && R() < 0.3) { const t = aiShotTarget(w, p); doShoot(w, p, 1, true, t.x, t.y); tm.bar = 0; return; }
      const angOK = Math.abs(p.y - H / 2) < 250 || gd < 230;
      const sht = SP(p).shot > 1.1 || (p.tr.canon) ? 1 : 0;
      if (gd < (p.tr.canon ? 720 : sht ? 580 : 480) && angOK && R() < (sht ? 0.55 : 0.45)) {
        ai.shootH = nd > 190 && R() < 0.5 ? 0.98 : rnd(0.15, 0.6);
        if (nd < 70) ai.shootH = rnd(0.05, 0.22);
        p.charge = 0; return;
      }
      if (nd < 90 && R() < 0.5) { const m = bestPassMate(w, p); if (m) { doPass(w, p, m.x - p.x, m.y - p.y); return; } }
      if (gd > 750 && R() < 0.06) { const m = bestPassMate(w, p); if (m && (m.x - p.x) * sg > 80) { doPass(w, p, m.x - p.x, m.y - p.y); return; } }
      let dx = gdx / gd, dy = gdy / gd;
      for (let j = 0; j < 4; j++) {
        const o = w.players[(1 - p.team) * 4 + j]; if (o.st === ST.down) continue;
        const d = len(o.x - p.x, o.y - p.y) || 1;
        if (d < 170) { const k = (170 - d) / 170 * 1.3; dx += (p.x - o.x) / d * k; dy += (p.y - o.y) / d * k; }
      }
      if (p.y < 80) dy += 0.6; if (p.y > H - 80) dy -= 0.6;
      const m = len(dx, dy) || 1; ai.dx = dx / m; ai.dy = dy / m;
      ai.spr = p.stam > 0.35 && nd > 90;
    }
    p.mx = ai.dx; p.my = ai.dy; p.spr = ai.spr;
  }

  // loin du ballon, ça se cogne quand même : règlements de comptes et coups de grâce
  function aiBrawl(w, p, D, tm, car) {
    if (p.st !== ST.run || p.strikeCd > 0 || w.phase !== 'play') return false;
    const busy = car && car.team !== p.team && len(car.x - p.x, car.y - p.y) < 200; // le porteur adverse passe avant tout
    if (busy) return false;
    const hm = tm.human ? 0.6 : 1, pf = SP(p).punch > 1.4 ? 1.4 : 1;
    const df = downFoe(w, p, p.fx, p.fy, 110);
    if (df && R() < 0.15 * D.aggr * hm * pf) { doStomp(w, p, df); return true; }
    let o = null, od = 58;
    for (let j = 0; j < 3; j++) { const q = w.players[(1 - p.team) * 4 + j]; if (q === car || q.st === ST.down || q.inv > 0) continue; const d = len(q.x - p.x, q.y - p.y); if (d < od) { od = d; o = q; } }
    if (o && R() < (p.comboT > 0 ? 0.65 : 0.045) * D.aggr * hm * pf) { doStrike(w, p, o.x - p.x, o.y - p.y); return true; }
    return false;
  }

  function aiField(w, p, dt) {
    const b = w.ball, tm = w.teams[p.team];
    const D = tm.human ? DIFF.normal : w.diff;
    const ai = p.ai, sg = p.team === 0 ? 1 : -1, mgx = p.team === 0 ? 0 : W;
    if (b.owner === p) { aiCarrier(w, p, dt, D); return; }
    if (p.chS) { p.chS = false; p.charge = 0; ai.shootH = -1; }
    // surpris par un sombrero qui vient de lui passer au-dessus : réaction moins sûre
    const surprise = b.kickBy && b.kickBy.team !== p.team && b.kickT < 0.45 && b.vz > 0 ? 0.25 : 1;
    if (!b.owner && b.z > 8 && ai.tackH < 0 && (p.st === ST.run || p.st === ST.kick) && R() < dt * 9 * D.react * surprise * (SP(p).head > 1.3 ? 1.4 : 1)) {
      const pl = aerialPlan(w, p, 0.4);
      if (pl && pl.t > 0.06 && closestField(w, p.team, pl.x, pl.y) === p) {
        const ogx = p.team === 0 ? W : 0, gdist = len(ogx - pl.x, H / 2 - pl.y);
        const theirs = b.last && b.last.team !== p.team;
        if (gdist < (pl.z > 92 ? 380 : 560) && Math.abs(pl.y - H / 2) < 300) { const t = aiShotTarget(w, p); doAerial(w, p, pl, t.x, t.y); return; }
        if (theirs) { // dégagement… seulement s'il y a le feu : sinon on laisse retomber et on contrôle
          let foeNear = false;
          for (let j = 0; j < 3; j++) { const o = w.players[(1 - p.team) * 4 + j]; if (o.st !== ST.down && len(o.x - pl.x, o.y - pl.y) < 140) foeNear = true; }
          const danger = Math.abs(pl.x - mgx) < W * 0.33;
          if (pl.z <= 92 || foeNear || danger) { doAerial(w, p, pl, pl.x + sg * 520, clamp(pl.y + rnd(-220, 220), 80, H - 80)); return; }
        }
      }
    }
    if (ai.tackH >= 0) {
      ai.tackH -= dt; p.tch += dt;
      const tg = ai.tgt;
      if (!tg || tg.st === ST.down || b.owner === p) { p.chT = false; p.tch = 0; ai.tackH = -1; }
      else if (ai.tackH < 0) {
        doSlide(w, p, tg.x + tg.vx * 0.15 - p.x, tg.y + tg.vy * 0.15 - p.y, Math.min(1, p.tch / 0.55), false);
        ai.tackH = -1;
        return;
      } else { seek(p, tg.x, tg.y, false); return; }
    }
    ai.dec -= dt;
    if (ai.dec <= 0) {
      ai.dec = rnd(0.08, 0.16) / D.react;
      const ctrlP = tm.human ? w.players[p.team * 4 + tm.ctrl] : null;
      const car = b.owner;
      if (aiBrawl(w, p, D, tm, car)) return;
      if (car && car.team === p.team) {
        const sp2 = spread(w, p, supportSpot(w, p, car)), far = len(sp2.x - p.x, sp2.y - p.y);
        ai.tx = sp2.x; ai.ty = sp2.y; ai.spr = (sp2.run ? far > 120 : far > 230) && p.stam > 0.35; // on sprinte pour l'appel, on trottine sinon
      } else if (car) {
        const presser = closestField(w, p.team, car.x, car.y);
        // le défenseur ne laisse rien passer dans son camp : il sort au duel même s'il n'est pas le plus proche
        const defPress = p.role === 'DEF' && Math.abs(car.x - mgx) < W * 0.42 && len(car.x - p.x, car.y - p.y) < 230 && !car.gk;
        if (p === presser || defPress) {
          const d = len(car.x - p.x, car.y - p.y);
          ai.tx = car.x + car.vx * 0.2; ai.ty = car.y + car.vy * 0.2; ai.spr = d > 70;
          const solo = !tm.human; // les coéquipiers d'un humain ne dépensent pas son ki
          if (car.gk && car.st === ST.hold) { ai.tx = car.x + sg * 120; ai.ty = car.y; ai.spr = false; }
          else if ((d < 60 || p.comboT > 0) && p.strikeCd <= 0 && car.inv <= 0 && R() < (p.comboT > 0 ? 0.7 : 0.22) * D.aggr * (tm.human ? 0.6 : 1) * (SP(p).punch > 1.4 ? 1.3 : 1)) {
            doStrike(w, p, car.x - p.x, car.y - p.y); return;
          } else if (d < 80 + 30 * D.aggr && p.tackCd <= 0 && car.inv <= 0 && R() < 0.05 * D.aggr * (tm.human ? 0.6 : 1) * (SP(p).tackle > 1.3 ? 1.6 : SP(p).tackle < 1 ? 0.8 : 1)) {
            ai.tackH = rnd(0.12, 0.38) / D.react * (d > 90 ? 1.3 : 1); ai.tgt = car; p.chT = true; p.tch = 0;
          } else if (solo && tm.bar >= 1 && tm.beamCd <= 0 && d > 220 && d < 800 && R() < 0.14 * D.aggr) {
            startCharge(w, p); p.beamC = 0; ai.beamH = rnd(0.55, 0.8); ai.tgt = car; return;
          } else if (solo && tm.bar >= KI1 && tm.bar < 1 && d > 150 && d < 560 && R() < 0.09 * D.aggr) {
            doKi(w, p, car.x - p.x, car.y - p.y); return;
          } else if (d > 140 && d < 300 && p.flyCd <= 0 && p.stam > 0.3 && R() < 0.045 * D.aggr * (tm.human ? 0.5 : 1)) {
            doFly(w, p, car.x - p.x, car.y - p.y); p.flyCd = p.tr.bond ? 1.5 : 3; p.stam -= 0.2; return;
          }
        } else {
          const mk2 = spread(w, p, markSpot(w, p, car, presser, ctrlP)); ai.tx = mk2.x; ai.ty = mk2.y;
          const behind = (p.x - car.x) * sg > 0; // le porteur nous a dépassés : repli à fond
          ai.spr = len(ai.tx - p.x, ai.ty - p.y) > (behind ? 90 : 170);
          const dc = len(car.x - p.x, car.y - p.y);
          if (!tm.human && tm.bar >= 1 && tm.beamCd <= 0 && dc > 250 && dc < 800 && R() < 0.06 * D.aggr) { startCharge(w, p); ai.beamH = rnd(0.55, 0.8); ai.tgt = car; return; }
          if (!tm.human && tm.bar < 1 && dc > 480 && R() < 0.012 * D.aggr) { startCharge(w, p); ai.beamH = rnd(0.7, 1.3); ai.tgt = null; return; }
        }
      } else {
        const bx = b.x + b.vx * 0.25, by = b.y + b.vy * 0.25;
        const chaser = closestField(w, p.team, bx, by);
        if (b.passTo === p) { const L = landing(b); ai.tx = L ? L.x : b.x + b.vx * 0.15; ai.ty = L ? L.y : b.y + b.vy * 0.15; ai.spr = true; }
        else if (p === chaser && p !== ctrlP) { ai.tx = bx; ai.ty = by; ai.spr = true; }
        else {
          // le deuxième plus proche couvre entre le ballon et notre but ; les autres se replacent
          let sec = null, sd = 1e9;
          for (let i = 0; i < 3; i++) { const m = w.players[p.team * 4 + i]; if (m === chaser || m.st === ST.down) continue; const d = len(m.x - bx, m.y - by); if (d < sd) { sd = d; sec = m; } }
          let t2;
          if (p === sec && sd < 340) { const gdx = mgx - bx, gdy = H / 2 - by, gl = len(gdx, gdy) || 1; t2 = { x: bx + gdx / gl * 120, y: by + gdy / gl * 120 }; }
          else t2 = homeSpot(w, p);
          t2 = spread(w, p, t2); ai.tx = t2.x; ai.ty = t2.y; ai.spr = len(t2.x - p.x, t2.y - p.y) > 260;
        }
      }
    }
    seek(p, ai.tx, ai.ty, ai.spr);
  }

  function gkDistribute(w, k) {
    if (k.tr.obus && k.st === ST.hold) { k.ai.holdT = 0; doPunt(w, k, 0, 0); return; } // DÉGAGEMENT OBUS
    let best = null, bs = -1e9;
    for (let i = 0; i < 3; i++) {
      const m = w.players[k.team * 4 + i]; if (m.st === ST.down) continue;
      let open = 1e9;
      for (let j = 0; j < 3; j++) { const o = w.players[(1 - k.team) * 4 + j]; if (o.st === ST.down) continue; open = Math.min(open, len(o.x - m.x, o.y - m.y)); }
      const s = Math.min(open, 260) - laneBlock(w, k, m.x, m.y) * 120 + rnd(0, 40);
      if (s > bs) { bs = s; best = m; }
    }
    k.st = ST.run;
    if (best) doPass(w, k, best.x - k.x, best.y - k.y);
    else { const t = { x: W / 2, y: H / 2 }; doPass(w, k, t.x - k.x, t.y - k.y); }
    k.pickCd = 0.6;
  }

  function aiKeeper(w, k, dt) {
    const b = w.ball, sg = k.team === 0 ? 1 : -1, gx = k.team === 0 ? 0 : W, sk = gkSkill(w, k);
    if (b.owner === k) {
      k.ai.holdT += dt;
      if (k.tr.libero) { // LIBÉRO : il remonte le ballon tant que personne ne vient le presser
        let near = 1e9; for (let j = 0; j < 3; j++) { const o = w.players[(1 - k.team) * 4 + j]; if (o.st !== ST.down) near = Math.min(near, len(o.x - k.x, o.y - k.y)); }
        if (k.ai.holdT < 0.1) k.ai.dy = rnd(-160, 160);
        seek(k, gx + sg * 430, clamp(H / 2 + k.ai.dy, 120, H - 120), true);
        if (k.ai.holdT > 2.2 || near < 150 || (k.ai.holdT > 0.6 && Math.abs(k.x - gx) > 400)) gkDistribute(w, k);
        return;
      }
      seek(k, gx + sg * 40, H / 2, false);
      if (k.ai.holdT > (k.tr.eclair ? 0.3 : 0.85)) gkDistribute(w, k); // RELANCE ÉCLAIR
      return;
    }
    k.kamCd -= dt;
    if (k.st === ST.hold) k.st = ST.run;
    // l'attaquant vient au contact : le gardien plonge dans ses pieds
    const car = b.owner;
    if (car && car.team !== k.team && car.inv <= 0 && len(car.x - k.x, car.y - k.y) < PR * 2 + 6 + (SP(k).out - 1) * 20 && k.pickCd <= 0) {
      car.pickCd = 0.6; b.owner = null; b.last = car;
      ev(w, 'save', { x: k.x, y: k.y, t: k.team });
      if (k.kamT > 0) { knock(w, car, sg, rnd(-0.4, 0.4), 1.3, 380, k, 'kamikaze'); k.kamT = 0; } // il le découpe au passage
      possess(w, k);
      return;
    }
    // SORTIE KAMIKAZE : un porteur adverse entre dans sa zone → il jaillit
    if (k.tr.kamikaze && car && car.team !== k.team && car.inv <= 0 && k.kamCd <= 0 && k.kamT <= 0 && len(car.x - gx, car.y - H / 2) < 330) {
      k.kamT = 1.1; k.kamCd = 3.5; ev(w, 'tr', { x: k.x, y: k.y, s: 'kamikaze', id: k.id });
    }
    if (k.kamT > 0) {
      k.kamT -= dt;
      if (car && car.team !== k.team) { seek(k, car.x + car.vx * 0.12, car.y + car.vy * 0.12, true); return; }
      k.kamT = 0;
    }
    const dB = Math.abs(b.x - gx);
    const depth = clamp(18 + (1 - dB / 650) * 42, 18, 62);
    let tx = gx + sg * depth, ty = H / 2 + clamp((b.y - H / 2) * 0.5, -GHW + 12, GHW - 12);
    let spr = false;
    if (!b.owner && b.vx * sg < -220) {
      const t = (tx - b.x) / b.vx;
      if (t > 0 && t < 1) {
        const py = b.y + b.vy * t;
        ty = clamp(py, MT - 12, MB + 12); spr = true;
        const fe = k.tr.feline ? 1.35 : 1; // DÉTENTE FÉLINE
        if (t < 0.34 * sk * fe && Math.abs(py - k.y) > 20 && k.diveCd <= 0 && b.z < gkZ(w, k) + 5 && Math.abs(py - H / 2) < GHW + 30) {
          k.st = ST.dive; k.t = 0.34;
          const need = Math.abs(py - k.y) / 0.25;
          k.vy = Math.sign(py - k.y) * Math.min(560 * sk * SP(k).dive * fe, need + 80); k.vx = 0; k.diveCd = k.tr.feline ? 0.45 : 0.9;
          k.fy = Math.sign(py - k.y); k.fx = 0.0001 * sg;
          ev(w, 'dive', { x: k.x, y: k.y });
          return;
        }
      }
    }
    if (!b.owner && dB < 190 && len(b.vx, b.vy) < 320 && Math.abs(b.y - H / 2) < 230) { tx = b.x; ty = b.y; spr = true; }
    else if (car && car.team !== k.team && dB < 160 * SP(k).out && Math.abs(car.y - H / 2) < 200) { tx = gx + sg * Math.min(115 * SP(k).out, depth + 45); ty = clamp(car.y, MT, MB); spr = true; }
    seek(k, tx, ty, spr);
  }

  return { W, H, GHW, GD, BARZ, PR, BR, MT, MB, ST, PH, TEAMS, DIFF, EMPTY, SPEC, ROSTER, BYROLE, randomPicks, newWorld, step, resetKickoff };
})();
if (typeof module !== 'undefined') module.exports = TF;
