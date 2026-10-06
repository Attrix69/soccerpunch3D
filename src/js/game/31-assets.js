  /* =============== MODÈLES 3D (glTF embarqués, CC0 3dassets.dev) =============== */
  const MODELS = {};
  const b64buf = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  function loadModels(onProgress) {
    if (typeof GLBD === 'undefined') return Promise.resolve();
    const loader = new THREE.GLTFLoader(), names = Object.keys(GLBD);
    let done = 0;
    return Promise.all(names.map(n => new Promise(res => {
      try {
        loader.parse(b64buf(GLBD[n]), '', g => {
          g.scene.updateMatrixWorld(true);
          MODELS[n] = g.scene; done++; if (onProgress) onProgress(done / names.length); res();
        }, () => { done++; res(); });
      } catch (e) { done++; res(); }
    })));
  }
  // copie d'un modèle (géométries partagées) ; mats : { nomDuMatériau: couleur | Material | fonction(mat) }
  function model(name, mats, opt) {
    const src = MODELS[name]; if (!src) return new THREE.Group();
    const o = src.clone(true);
    o.traverse(m => {
      if (!m.isMesh) return;
      const nm = m.material && m.material.name;
      const r = mats && nm in mats ? mats[nm] : null;
      if (r instanceof THREE.Material) m.material = r;
      else if (typeof r === 'function') m.material = r(m.material);
      else if (r != null) { m.material = m.material.clone(); m.material.color.set(r); }
      m.castShadow = !!(opt && opt.cast); m.receiveShadow = opt && opt.receive != null ? opt.receive : true;
    });
    return o;
  }
  // toutes les géométries d'un modèle, ramenées dans son repère, regroupées par matériau (pour l'instanciation)
  function floatGeo(src) { // attributs quantifiés (KHR_mesh_quantization) -> flottants, sans index
    const g0 = src.index ? src.toNonIndexed() : src, g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal']) {
      const a = g0.attributes[k]; if (!a) continue;
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      g.setAttribute(k, new THREE.BufferAttribute(f, 3));
    }
    return g;
  }
  function modelParts(name) {
    const src = MODELS[name], out = {}; if (!src) return out;
    src.updateMatrixWorld(true);
    src.traverse(m => {
      if (!m.isMesh) return;
      const nm = (m.material && m.material.name) || 'mat', g = floatGeo(m.geometry);
      g.applyMatrix4(m.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      (out[nm] = out[nm] || []).push(g);
    });
    for (const k in out) out[k] = out[k].length > 1 ? THREE.mergeGeometries(out[k]) : out[k][0];
    return out;
  }
  function modelBox(name) { const b = new THREE.Box3(); if (MODELS[name]) b.setFromObject(MODELS[name]); return b; }
  // matériau « décor » : PBR simple, teinte sombre de stade
  const MATC = {};
  function stdMat(col, rough, metal, extra) {
    const k = col + '|' + rough + '|' + metal + '|' + (extra ? JSON.stringify(extra) : '');
    if (MATC[k]) return MATC[k];
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: rough == null ? 0.8 : rough, metalness: metal || 0 }, extra || {}));
    return (MATC[k] = m);
  }
