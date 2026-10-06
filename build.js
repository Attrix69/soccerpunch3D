#!/usr/bin/env node
// Assemble le jeu en un seul fichier jouable hors ligne : src/shell.html + ses inclusions -> index.html
// Usage : node build.js            (écrit index.html)
//         node build.js --check    (vérifie que index.html est à jour, code de sortie 1 sinon)
// Directives reconnues dans les sources (seules sur leur ligne) :
//   @@include chemin   fichier(s) de src/ (joker * autorisé)
//   @@sfx dossier      les .mp3 de src/dossier deviennent var SFXD = { nom: base64 }
//   @@glb dossier      les .glb du dossier (depuis la racine) deviennent var GLBD = { nom: base64 }
//   @@raw fichier      fichier copié tel quel (depuis la racine), ex. vendor/three.bundle.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = __dirname, SRC = path.join(ROOT, 'src');

function include(spec) {
  const m = spec.match(/^(.*\/)?([^/]*\*[^/]*)$/);
  if (!m) return [spec];
  const dir = m[1] || '', re = new RegExp('^' + m[2].replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$');
  return fs.readdirSync(path.join(SRC, dir)).filter(f => re.test(f)).sort().map(f => dir + f);
}
function embed(varName, dir, ext) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort();
  return 'var ' + varName + ' = {\n' + files.map(f => JSON.stringify(f.slice(0, -ext.length)) + ':"' + fs.readFileSync(path.join(dir, f)).toString('base64') + '"').join(',\n') + '\n};';
}
function expand(text) {
  return text.split('\n').map(line => {
    let m = line.match(/^@@sfx (\S+)$/);
    if (m) return embed('SFXD', path.join(SRC, m[1]), '.mp3');
    m = line.match(/^@@glb (\S+)$/);
    if (m) return embed('GLBD', path.join(ROOT, m[1]), '.glb');
    m = line.match(/^@@raw (\S+)$/);
    if (m) { const t = fs.readFileSync(path.join(ROOT, m[1]), 'utf8'); if (/<\/script/i.test(t)) throw new Error(m[1] + ' contient </script>'); return t.trimEnd(); }
    m = line.match(/^@@include (\S+)$/);
    if (!m) return line;
    return include(m[1]).map(f => {
      const t = fs.readFileSync(path.join(SRC, f), 'utf8');
      return t.endsWith('\n') ? t.slice(0, -1) : t;
    }).join('\n');
  }).join('\n');
}
const out = expand(fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8'));
const dest = path.join(ROOT, 'index.html');
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  if (cur !== out) { console.error('index.html n\'est pas à jour : lance « node build.js »'); process.exit(1); }
  console.log('index.html à jour');
} else {
  fs.writeFileSync(dest, out);
  console.log('index.html écrit (' + (Buffer.byteLength(out) / 1024).toFixed(0) + ' Ko)');
}
