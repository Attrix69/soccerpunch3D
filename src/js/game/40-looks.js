  const NSL = 10; // 8 joueurs + 2 emplacements pour les portraits et l'aperçu
  /* ---------- joueurs : état d'animation, LOOK / TENUE / PERSONNALITÉ de chaque joueur (repris de la version 2D) ---------- */
  const animPh = new Float32Array(NSL), prevX = new Float32Array(NSL), prevY = new Float32Array(NSL), spd = new Float32Array(NSL);
  // cinématique lissée par joueur (vitesse, accélération, rotation) pour animer le corps
  const SVX = new Float32Array(NSL), SVY = new Float32Array(NSL), SAX = new Float32Array(NSL), SAY = new Float32Array(NSL);
  const SHF = new Float32Array(NSL), FPV = new Float32Array(NSL).fill(NaN), BRL = new Uint8Array(NSL), DGR = new Uint8Array(NSL);
  const sm01 = x => (x = x < 0 ? 0 : x > 1 ? 1 : x, x * x * (3 - 2 * x));
  const stPrev = new Int8Array(NSL).fill(-1), stT = new Float32Array(NSL);
  let curBar = [0, 0];
  const ghosts = [[], [], [], [], [], [], [], [], [], []];
  let ballSpin = 0, pbx = 0, pby = 0, pbz = 0, bvz = 0, BSQ = 0; // BSQ : écrasement du ballon au rebond
  const SQ = new Float32Array(NSL); // squash (>0 : tassé) / stretch (<0 : étiré) de chaque joueur
  const trail = [], strail = [];
  let strailCol = '#e8ecf2';
  const STY = [0, 1, 4, 2, 5, 6, 3, 2]; // coiffure par joueur
  const INK = '#060608', DEP = 0.42;
  const DKC = {};
  const dkc = c => DKC[c] || (DKC[c] = c[0] === '#' ? shade(c, 0.62) : c); // version sombre (membre du fond), mémorisée
  function shade(hex, f) { // assombrit (f<1) ou éclaircit (f>1)
    const n = parseInt(hex.slice(1, 7), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 1) { r *= f; g *= f; b *= f; } else { const k = f - 1; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  const PAL = TEAMS.map(T => ({ jl: shade(T.c1, 1.22), jm: shade(T.c1, 0.8), gl: shade(T.gkc, 1.22), gm: shade(T.gkc, 0.8), j: T.c1, jd: shade(T.c1, 0.6), s: T.c2, sd: shade(T.c2, 0.6), a: T.acc, ad: shade(T.acc, 0.6), g: T.gkc, gd: shade(T.gkc, 0.6) }));
  const SKD = SKIN.map(c => shade(c, 0.7));
  const HAIRD = HAIR.map(c => shade(c, 0.7));

  // gabarit par poste : [échelle, épaisseur des membres, largeur d'épaules, largeur de bassin]
  const BUILD = [[1.0, 1.0, 10.6, 7.4], [0.95, 0.86, 9.6, 6.8], [1.1, 1.24, 12.8, 8.6], [1.0, 1.0, 11, 7.4]];
  const ROLE_TAG = ['ATTAQUANT', 'MILIEU', 'DÉFENSEUR', 'GARDIEN'];
  // LOOK de chaque joueur de l'effectif (même ordre que TF.ROSTER)
  // hair : short, shaved, bald, crest, mohawk, spiky, slick, long, dreads, afro, hood, hardhat, scrum
  const LOOKS = [
    { sk: '#e2b08a', hc: '#3a2614', hair: 'shaved', face: ['moustache'], body: ['leather'], b: [1.12, 1.25, 13, 8.6] },        // Le Fistinier
    { sk: '#8a5532', hc: '#0d0d0d', hair: 'hardhat', face: ['beard'], body: [], b: [1.18, 1.38, 14.2, 9.6] },                 // Le Bulldozer
    { sk: '#d8c7b8', hc: '#111111', hair: 'hood', face: ['skull'], body: [], b: [1.07, 1.0, 11.4, 7.4] },                      // La Faucheuse
    { sk: '#6e4126', hc: '#111111', hair: 'scrum', face: ['tape'], body: [], b: [1.13, 1.3, 13.6, 9] },                        // Le Rempart
    { sk: '#efc6a4', hc: '#c4471c', hair: 'long', face: ['braidbeard', 'warpaint'], body: [], b: [1.1, 1.2, 12.8, 8.4] },      // Le Viking
    { sk: '#e8c39c', hc: '#151515', hair: 'spiky', face: [], band: 'a', body: [], b: [0.96, 0.9, 10, 7] },                    // Le Prodige
    { sk: '#c48a5e', hc: '#2b1d12', hair: 'long', face: ['goatee'], body: [], b: [0.97, 0.88, 9.8, 6.9] },                    // Le Magicien
    { sk: '#53301b', hc: '#1b120a', hair: 'dreads', face: [], body: [], b: [1.0, 0.95, 10.6, 7.2] },                          // La Pieuvre
    { sk: '#d9a982', hc: '#33e0ff', hair: 'short', face: [], body: [], b: [0.88, 0.8, 9, 6.4] },                             // Le Funambule
    { sk: '#cf9a70', hc: '#ececec', hair: 'slick', face: ['shades'], body: [], b: [0.98, 0.92, 10.2, 7.2] },                  // Le Chef d'Orchestre
    { sk: '#f0cfae', hc: '#e2b14a', hair: 'slick', face: ['crown'], body: [], b: [0.98, 0.92, 10.2, 7] },                     // Le Petit Prince
    { sk: '#9a6038', hc: '#ff7a00', hair: 'crest', face: ['stripes'], body: [], b: [1.02, 1.02, 10.8, 7.4] },                 // Le Tigre
    { sk: '#5e3a22', hc: '#0c0c0c', hair: 'afro', face: ['nosering', 'beard'], body: [], b: [1.15, 1.28, 13.2, 9] },          // Le Buffle
    { sk: '#f2cfb0', hc: '#d4561e', hair: 'short', face: ['sideburns'], body: [], b: [0.93, 0.88, 9.8, 6.8] },                // Le Renard
    { sk: '#b07650', hc: '#111111', hair: 'bald', face: ['beard', 'patch'], body: ['tattoo'], b: [1.1, 1.25, 12.4, 8.2] },             // Le Canonnier
    { sk: '#7a4a2c', hc: '#151515', hair: 'shaved', face: ['beard'], body: [], b: [1.2, 1.38, 14.6, 9.8] },                     // Le Bunker
    { sk: '#e8c39c', hc: '#101010', hair: 'short', face: ['eyemask', 'whiskers'], body: [], b: [0.96, 0.86, 10.2, 7] },         // Le Chat
    { sk: '#d9a07a', hc: '#2b1d12', hair: 'shaved', face: ['moustache', 'scar'], body: [], b: [1.14, 1.3, 13.4, 9.2] },         // Le Boucher
    { sk: '#c9a27e', hc: '#1a1220', hair: 'bald', face: ['goatee', 'spiral'], body: [], b: [1.02, 0.9, 10.4, 7] },             // L'Hypnotiseur
    { sk: '#b98055', hc: '#120c08', hair: 'long', face: ['moustache'], band: 'a', body: [], b: [0.98, 0.95, 10.4, 7.2] }        // El Loco
  ];
  // TENUE de chaque joueur (même ordre) — 'c1' couleur d'équipe, 'c2' couleur secondaire, 'acc' accent
  // slv : manches (≤1 part du bras, >1 jusqu'à l'avant-bras) · sl : short (≤1 part de la cuisse, >1 pantalon jusqu'au tibia)
  const OUTFITS = [
    { torso: 'c1', sleeve: '#241c18', slv: 0.85, shorts: '#1c1c22', sl: 1.6, socks: null, boots: '#111111', bootW: 1.15, hand: '#1a1a1a', sash: false, ov: ['leather'], ex: ['chain'], num: 4 },          // Fistinier : gilet de biker
    { sleeve: 'c1', slv: 0.5, shorts: '#34404f', sl: 1.6, socks: null, boots: '#6b4423', bootW: 1.25, sash: false, ov: ['hivis'], ex: [], num: 5 },                                                  // Bulldozer : gilet de chantier
    { torso: '#141318', sleeve: '#141318', slv: 1.7, shorts: '#141318', sl: 0.52, socks: '#141318', boots: '#0c0c0f', hand: '#e9e4dc', sash: false, ov: ['ropebelt'], ex: ['robe'], num: 13 }, // Faucheuse : robe noire
    { sleeve: 'c1', slv: 0.35, shorts: 'c2', sl: 0.45, socks: 'c1', boots: '#1f1f22', sash: false, ov: ['hoops'], ex: ['pads'], num: 3 },                                                            // Rempart : maillot de rugby
    { sleeve: null, slv: 0, shorts: '#4a3424', sl: 1.6, socks: null, boots: '#7a5c3e', bootW: 1.3, sash: false, ov: ['xstraps'], ex: ['fur', 'rings'], num: 2 },                                   // Viking : fourrure et sangles
    { sleeve: 'c1', slv: 0.5, shorts: 'c2', sl: 0.5, socks: 'c1', boots: 'acc', wrist: 'acc', sash: false, ov: ['vcollar', 'num10'], ex: ['captain'], num: 10 },                                    // Prodige : le n°10, brassard
    { sleeve: 'c1', slv: 1.8, shorts: 'c2', sl: 0.5, socks: 'c2', boots: '#111111', hand: '#f4f1ea', sash: false, ov: ['bowtie'], ex: ['cape'], num: 7 },                                           // Magicien : cape et gants blancs
    { torso: '#0f3d47', sleeve: '#0f3d47', slv: 2, shorts: '#0f3d47', sl: 2, legs: '#0f3d47', socks: null, boots: '#0a1f24', hand: '#0f3d47', sash: false, ov: ['chestband'], ex: ['suckers'], num: 8 }, // Pieuvre : combinaison
    { sleeve: 'c1', slv: 2, shorts: 'c1', sl: 0.4, legs: 'c2', socks: null, boots: '#f4f1ea', bootW: 0.85, sash: false, ov: ['diamonds'], ex: ['ruff'], num: 11 },                                  // Funambule : arlequin
    { torso: '#121216', sleeve: '#121216', slv: 2, shorts: '#121216', sl: 2, socks: null, boots: '#050506', sash: false, ov: ['tux'], ex: ['coattails'], num: 6 },                                   // Chef d'Orchestre : smoking
    { sleeve: 'c1', slv: 0.6, shorts: '#f1efe9', sl: 0.5, socks: 'c1', boots: '#d9a441', hand: '#f4f1ea', sash: true, sashC: '#d9a441', ov: ['goldtrim'], ex: ['epaulettes'], num: 1 },          // Petit Prince : dorures royales
    { sleeve: 'c1', slv: 0.5, shorts: '#111111', sl: 0.5, socks: '#ff7a00', boots: '#111111', wrist: '#ff7a00', sash: false, ov: ['tiger'], ex: ['tigertail'], num: 9 },                          // Tigre : rayures et queue
    { sleeve: null, slv: 0, shorts: 'c2', sl: 0.55, socks: 'c2', boots: '#2a1a10', bootW: 1.15, hand: '#e9e4dc', sash: false, ov: ['belt', 'torn'], ex: [], num: 14 },                             // Buffle : débardeur déchiré, ceinturon
    { sleeve: 'c1', slv: 0.5, shorts: 'c2', sl: 0.5, socks: '#d4561e', boots: 'acc', sash: false, ov: ['bib'], ex: ['foxtail'], num: 17 },                                                          // Renard : plastron blanc et queue
    { sleeve: null, slv: 0, shorts: '#2c2c34', sl: 1.6, socks: null, boots: '#222222', bootW: 1.15, sash: false, ov: ['bandolier'], ex: [], num: 99 },                                               // Canonnier : cartouchière
    { sleeve: 'c1', slv: 1.8, shorts: '#26262c', sl: 1.6, socks: null, boots: '#2a2a2e', bootW: 1.3, glove: '#24242a', sash: false, ov: ['padded'], ex: ['pads'], num: 1 },                         // Bunker : gilet matelassé, épaulières
    { sleeve: '#121216', slv: 2, shorts: '#121216', sl: 2, legs: '#121216', socks: null, boots: '#0c0c0f', glove: '#121216', sash: false, ov: ['catcollar'], ex: ['cattail'], num: 16 },           // Chat : combinaison noire et queue
    { sleeve: 'c1', slv: 0.5, shorts: '#3a3a42', sl: 0.55, socks: 'c2', boots: '#1b1b1f', bootW: 1.15, glove: '#e2ddd2', sash: false, ov: ['apron'], ex: [], num: 30 },                         // Boucher : tablier taché
    { sleeve: '#3a1a5a', slv: 2, shorts: '#2a1240', sl: 1.6, socks: null, boots: '#1a0c28', glove: '#7a3cff', sash: false, ov: ['spiral'], ex: ['cape'], num: 13 },                              // Hypnotiseur : cape et spirale
    { sleeve: 'c1', slv: 0.5, shorts: '#ff2fa0', sl: 0.5, socks: '#33e0ff', boots: '#ff2fa0', glove: '#ff2fa0', sash: false, ov: ['zigzag'], ex: [], num: 9 }                                     // El Loco : maillot fluo
  ];
  // PERSONNALITÉ (même ordre) : démarche g, posture d'attente, geste de frappe, célébration, couleur de ses frappes, couvre-chef / accessoire
  // g : cad cadence · st foulée · kn montée de genou · arm balancier · ab pli du coude · ln buste penché · gl glisse · bob rebond
  //     wd écart des pieds · sw roulis · tw rotation des épaules · ao bras écartés (rad) · flop bras mous · cond baguette
  const PERSO = [
    { g: { cad: 1, st: 0.95, kn: 0.9, arm: 0.4, ab: 0.95, ln: 0.1, sw: 0.05, wd: 1, tw: 1.4 }, idle: 'boxer', kick: 'toe', cele: 'flex', fx: '#ff9a3c', hat: 'bikercap' },
    { g: { cad: 0.8, st: 1.05, kn: 0.65, arm: 0.7, ab: 0.4, ln: 0.26, sw: 0.14, wd: 3.6, tw: 0.6, ao: 0.3 }, idle: 'heavy', kick: 'stomp', cele: 'chest', fx: '#ffc21a' },
    { g: { cad: 0.88, st: 1.15, kn: 0.35, arm: 0.1, ab: -1.15, ln: 0.12, gl: 0.9, tw: 0.25, ao: 0.1 }, idle: 'reaper', kick: 'scythe', cele: 'reaper', fx: '#a66bff', prop: 'scythe' },
    { g: { cad: 0.9, st: 1, kn: 1.05, arm: 1.1, ab: 0.25, ln: 0.34, wd: 2, sw: 0.06, tw: 1, ao: 0.2 }, idle: 'cross', kick: 'boot', cele: 'haka', fx: '#d9b27a' },
    { g: { cad: 0.88, st: 1.1, kn: 1.1, arm: 1.25, ab: -0.5, ln: -0.02, sw: 0.14, wd: 2.6, tw: 1.3, ao: 0.35 }, idle: 'swagger', kick: 'axe', cele: 'roar', fx: '#6fb8ff', hat: 'horns' },
    { g: { cad: 1.08, st: 1.12, kn: 1.18, arm: 1.05, ln: 0.12, tw: 1 }, idle: 'ready', kick: 'drive', cele: 'pump', fx: '#7fd8ff' },
    { g: { cad: 1.05, st: 0.9, kn: 0.85, arm: 0.55, ab: 0.35, ln: 0.05, tw: 1.7, sw: 0.04 }, idle: 'magic', kick: 'trivela', cele: 'bow', fx: '#e05cff', hat: 'tophat' },
    { g: { cad: 1, st: 0.95, kn: 0.9, arm: 1.5, ab: -0.4, ln: 0.1, flop: 1, tw: 0.8, ao: 0.25 }, idle: 'tentacle', kick: 'whip', cele: 'wave', fx: '#8a5cff', hat: 'goggles' },
    { g: { cad: 1.3, st: 0.75, kn: 1.4, arm: 0.2, ab: -1.25, ln: 0.02, bob: 4, sw: 0.06, tw: 0.3, ao: 1.3 }, idle: 'balance', kick: 'chip', cele: 'flip', fx: '#33e0ff', hat: 'jester' },
    { g: { cad: 0.95, st: 0.9, kn: 0.7, arm: 0.25, ab: 0.6, ln: -0.04, tw: 0.4, cond: 1 }, idle: 'conduct', kick: 'sidefoot', cele: 'conduct', fx: '#f4f1ea', prop: 'baton' },
    { g: { cad: 1, st: 1, kn: 1.35, arm: 0.5, ab: 0.15, ln: -0.07, tw: 0.5 }, idle: 'royal', kick: 'curl', cele: 'royal', fx: '#ffd23a', prop: 'mantle' },
    { g: { cad: 1.12, st: 1.3, kn: 1.1, arm: 1.2, ab: -0.2, ln: 0.46, bob: 3, tw: 1.2, ao: 0.2 }, idle: 'prowl', kick: 'pounce', cele: 'tiger', fx: '#ff9000', hat: 'catears' },
    { g: { cad: 0.9, st: 1, kn: 0.9, arm: 0.9, ab: 0.3, ln: 0.42, wd: 2.6, sw: 0.09, ao: 0.35 }, idle: 'bull', kick: 'butt', cele: 'stomp', fx: '#ff2d55', hat: 'bullhorns' },
    { g: { cad: 1.15, st: 1.05, kn: 1, arm: 0.8, ab: 0.45, ln: 0.25, tw: 0.9, sw: 0.03 }, idle: 'sly', kick: 'poke', cele: 'shh', fx: '#c6ff4a', hat: 'foxears' },
    { g: { cad: 0.92, st: 1, kn: 0.9, arm: 1, ab: 0.5, ln: 0.12, wd: 2, sw: 0.09, tw: 0.9, ao: 0.3 }, idle: 'pound', kick: 'cannon', cele: 'cannon', fx: '#ff6a00', hat: 'bandana' },
    // GARDIENS
    { g: { cad: 0.82, st: 1, kn: 0.6, arm: 0.6, ab: 0.5, ln: 0.2, sw: 0.13, wd: 3.6, tw: 0.6, ao: 0.4 }, idle: 'gkwall', kick: 'boot', cele: 'chest', fx: '#c6ff1a', hat: 'army' },
    { g: { cad: 1.15, st: 1.15, kn: 1.1, arm: 0.9, ab: 0.2, ln: 0.35, bob: 2.5, tw: 1.1 }, idle: 'gkcat', kick: 'drive', cele: 'flip', fx: '#e8ecf2', hat: 'blackcat' },
    { g: { cad: 0.95, st: 1.05, kn: 0.9, arm: 1, ab: 0.4, ln: 0.38, wd: 2.4, sw: 0.08, tw: 1.1, ao: 0.3 }, idle: 'gkbutcher', kick: 'stomp', cele: 'roar', fx: '#ff2a1e' },
    { g: { cad: 0.9, st: 0.95, kn: 0.6, arm: 0.3, ab: 0.5, ln: -0.02, gl: 0.6, tw: 0.4 }, idle: 'gkhypno', kick: 'sidefoot', cele: 'bow', fx: '#a66bff', hat: 'turban', prop: 'pendulum' },
    { g: { cad: 1.2, st: 1.05, kn: 1.3, arm: 1.3, ab: -0.1, ln: 0.12, bob: 3, sw: 0.05, tw: 1.3, ao: 0.25 }, idle: 'gkloco', kick: 'drive', cele: 'pump', fx: '#ff2fa0' }
  ];
  const PE0 = { g: { cad: 1, st: 1, kn: 1, arm: 1 }, idle: '', kick: '', cele: '', fx: '#e8ecf2' };
  // poses d'ULTIME propres (sinon le joueur garde son geste de frappe)
  const UPOSE_K = { upper: 1, stampede: 1, bordee: 1, fil: 1, crescendo: 1, abra: 1, couronne: 1 };
  const UPK = ['', '', '', '', '', '', '', '', '', ''], KSHOT = new Float32Array(NSL).fill(-9);
  const GKP = [null, null, null, null, null, null, null, null, null, null]; // geste spécial du gardien en cours : [type, instant]
  const GKPD = { scorpion: 0.55, poing: 0.4, kamikaze: 1.1, blinde: 0.45 };
  const GK_O = { sleeve: 'c1', slv: 0.45, shorts: 'c2', sl: 0.52, socks: 'c2', boots: 'acc', sash: true, ov: [], ex: [], num: 1 };
  const GKLOOK = t => ({ sk: SKIN[t * 4 + 3], hc: HAIR[t * 4 + 3], hair: 'bald', face: [], band: 's', body: [], b: [1, 1, 11, 7.4] });
  const LK = [], LKD = [];
  let lkKey = '';
  let lkRef = null;
  function setLooks(picks) { // looks des 8 joueurs du match
    if (picks === lkRef && LK.length >= 8 && lkKey !== '') return; lkRef = picks;
    const key = picks ? picks.join('|') : '-';
    if (key === lkKey && LK.length >= 8) return;
    for (let i = 0; i < 8; i++) { const t = i >> 2, r = i & 3, v = picks && picks[t] ? picks[t][r] : null; LK[i] = makeLook(v == null || v < 0 || !LOOKS[v] ? -1 : v, t); }
    lkKey = key; rigsDirty = true; // les personnages 3D sont reconstruits au prochain rendu
  }
  let rigsDirty = true;
  function makeLook(rid, t) {
    const L = rid < 0 ? GKLOOK(t) : Object.assign({}, LOOKS[rid]);
    L.f = {}; for (const k of L.face) L.f[k] = 1; L.bd = {}; for (const k of L.body) L.bd[k] = 1;
    L.rid = rid;
    L.o = rid < 0 ? GK_O : OUTFITS[rid]; L.of = {}; for (const k of L.o.ov.concat(L.o.ex)) L.of[k] = 1;
    const R2 = rid >= 0 ? TF.ROSTER[rid] : null;
    L.tr = R2 ? { [R2.atk[0]]: 1, [R2.def[0]]: 1 } : {};
    L.name = R2 ? R2.name.toUpperCase() : 'GARDIEN';
    L.skD = shade(L.sk, 0.7);
    L.pe = rid >= 0 ? PERSO[rid] : PE0;
    return L;
  }
  setLooks(null);
  // petits outils de dessin 2D (interface)
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
  function para(x, y, w, h, sk) { ctx.beginPath(); ctx.moveTo(x + sk, y); ctx.lineTo(x + w + sk, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
  const hx = (c, d) => (typeof c !== 'string' || c[0] !== '#' ? d : c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7));
  const BLV = d => (d >= 7 ? 3 : d >= 4.5 ? 2 : d >= 2 ? 1 : 0); // niveau de blessure visible
  const KICOL = [['#bff4ff', '#3cc8ff', '#0a6cff'], ['#fff1c2', '#ff8a1a', '#ff2a1e']];
  const HOP = new Float32Array(NSL);
