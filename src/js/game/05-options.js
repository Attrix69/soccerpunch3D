  /* =============== OPTIONS & NIVEAUX GRAPHIQUES =============== */
  // réglages du joueur, mémorisés dans le navigateur
  const OPT = { gfx: 'auto', music: 0.55, sfx: 1, vib: 1, shake: 1, voice: 1 };
  try { Object.assign(OPT, JSON.parse(localStorage.getItem('tf3_opts') || '{}')); } catch (e) { /* réglages par défaut */ }
  if (['auto', 'ultra', 'high', 'perf'].includes(Q.get('gfx'))) OPT.gfx = Q.get('gfx'); // pour les tests
  function saveOpts() { try { localStorage.setItem('tf3_opts', JSON.stringify(OPT)); } catch (e) { /* stockage indisponible */ } }
  // ULTRA : ombres fines, bloom, post-traitement complet, foule dense · HAUTE : un cran en dessous · PERF : rendu direct, ombres simples
  const GFXT = {
    ultra: { post: true, dpr: 2, shadow: 2048, bloom: 0.95, msaa: 4, crowd: 1, grain: 0.03, lights: 8, beams: true },
    high: { post: true, dpr: 1.5, shadow: 1024, bloom: 0.8, msaa: 0, crowd: 0.75, grain: 0.022, lights: 6, beams: true },
    perf: { post: false, dpr: 1, shadow: 0, bloom: 0, msaa: 0, crowd: 0.45, grain: 0, lights: 3, beams: false }
  };
  let gfxAuto = isTouch ? 'high' : 'ultra'; // AUTO : on part haut, on descend si l'appareil peine
  const gfxTier = () => (OPT.gfx === 'auto' ? gfxAuto : OPT.gfx);
  const GFX = () => GFXT[gfxTier()] || GFXT.high;
