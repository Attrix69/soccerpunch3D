  /* =============== PORTRAITS : chaque joueur rendu en 3D (composition, carte du joueur, écran VS) =============== */
  const portraits = {};
  const PSCENE = new THREE.Scene();
  {
    PSCENE.add(new THREE.HemisphereLight('#c8d4ff', '#2a1a14', 0.55));
    const k = new THREE.DirectionalLight('#fff2dc', 1.7); k.position.set(4, 6, 7); PSCENE.add(k);
    const r = new THREE.DirectionalLight('#ff5a40', 1.1); r.position.set(-6, 3, -5); PSCENE.add(r);
    const r2 = new THREE.DirectionalLight('#7cc8ff', 0.8); r2.position.set(6, 2, -6); PSCENE.add(r2);
  }
  const PCAM = new THREE.PerspectiveCamera(24, 130 / 230, 0.1, 50);
  let PRT = null;
  // ACES (approximation de Narkowicz) puis sRGB : la cible de rendu reste en linéaire
  const LUT = new Uint8Array(4096);
  for (let k = 0; k < 4096; k++) { const x = k / 4095 * 4, a = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), c = Math.min(1, Math.max(0, a)); LUT[k] = Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); }
  function render3DFigure(rid, team, o) { // -> canvas (130 × 230 px CSS, ×2)
    const Wp = 130, Hp = 230, dpr = 2, w = Wp * dpr, h = Hp * dpr;
    if (!PRT) PRT = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType });
    const slot = 8, gk = TF.ROSTER[rid].role === 'GK';
    SLOT_T[slot] = team; SLOT_GK[slot] = gk ? 1 : 0;
    LK[slot] = makeLook(rid, team);
    PSB[slot].init = false; FA[slot] = NaN; spd[slot] = o.spd || 0; animPh[slot] = o.ph || 0; SHF[slot] = 0; SAX[slot] = 0; SAY[slot] = 0; stT[slot] = o.stT || 0; SQ[slot] = 0; HOP[slot] = 0;
    KSHOT[slot] = o.shot ? performance.now() / 1000 : -9; UPK[slot] = o.upk || '';
    const rg = buildRig(LK[slot], team, slot, { scene: PSCENE });
    const p = { st: o.st || 0, fx: o.fx == null ? 0.55 : o.fx, fy: o.fy == null ? 0.84 : o.fy, z: o.z || 0, dmg: o.dmg || 0, inv: 0, chg: o.chg || 0, spin: 0, x: 0, y: 0 };
    const keepDraft = app.drafting; app.drafting = true; // pas d'écrasement ni de joueur « déçu » sur un portrait
    updRig(rg, p, slot, 0);
    app.drafting = keepDraft;
    rg.root.position.set(0, 0, 0); rg.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rg.root, !!rg.sk), hgt = box.max.y - box.min.y, cy = (box.max.y + box.min.y) / 2;
    const dist = (hgt * 0.62) / Math.tan(THREE.MathUtils.degToRad(PCAM.fov / 2));
    PCAM.position.set(0, cy + hgt * 0.04, dist); PCAM.lookAt(0, cy, 0);
    if (o.head && rg.bone) { const hp = new THREE.Vector3(); rg.bone.Head.getWorldPosition(hp); hp.y += 0.1; PCAM.position.set(hp.x, hp.y, hp.z + 0.95); PCAM.lookAt(hp); PCAM.fov = 27; }
    PCAM.updateProjectionMatrix();
    const keepRes = OUTL_U.uRes.value.clone(), keepPx = OUTL_U.uPx.value;
    OUTL_U.uRes.value.set(w, h); OUTL_U.uPx.value = 4.2;
    renderer.setRenderTarget(PRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(PSCENE, PCAM);
    const hb = new Uint16Array(w * h * 4), buf = new Float32Array(w * h * 4); // cible en demi-flottants
    try { renderer.readRenderTargetPixels(PRT, 0, 0, w, h, hb); for (let k = 0; k < hb.length; k++) buf[k] = THREE.DataUtils.fromHalfFloat(hb[k]); } catch (e) { /* lecture impossible : portrait vide */ }
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
    OUTL_U.uRes.value.copy(keepRes); OUTL_U.uPx.value = keepPx; PCAM.fov = 24;
    disposeRig(rg);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const id = g.createImageData(w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4, t = (y * w + x) * 4, a = buf[s + 3];
      const un = a > 0.001 ? 1 / a : 0; // alpha prémultiplié
      d[t] = LUT[Math.min(4095, (buf[s] * un * 1024) | 0)]; d[t + 1] = LUT[Math.min(4095, (buf[s + 1] * un * 1024) | 0)]; d[t + 2] = LUT[Math.min(4095, (buf[s + 2] * un * 1024) | 0)]; d[t + 3] = Math.min(255, a * 255) | 0;
    }
    const fig = document.createElement('canvas'); fig.width = w; fig.height = h; fig.getContext('2d').putImageData(id, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rg2 = g.createRadialGradient(Wp / 2, Hp * 0.6, 8, Wp / 2, Hp * 0.6, Wp * 0.75);
    rg2.addColorStop(0, 'rgba(255,255,255,.13)'); rg2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg2; g.fillRect(0, 0, Wp, Hp);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.ellipse(Wp / 2, Hp - 12, 40, 9, 0, 0, 7); g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fig, 0, 0);
    return c;
  }
  function portrait(id, team, back) {
    const key = id + '_' + team + (back ? 'b' : ''); if (portraits[key]) return portraits[key];
    let url = '';
    try { url = render3DFigure(id, team, { fx: back ? -0.5 : 0.55, fy: back ? -0.86 : 0.84 }).toDataURL(); } catch (e) { url = ''; }
    return (portraits[key] = url);
  }
  function poseShot(id, team, o) { try { return render3DFigure(id, team, o || {}).toDataURL(); } catch (e) { return ''; } }
