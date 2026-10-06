// Regenerates vendor/three.bundle.js (three.js + the add-ons the game uses) as one classic script exposing window.THREE.
// Usage: npm install && npm run vendor
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await build({
  entryPoints: [path.join(root, 'tools/vendor-entry.js')],
  outfile: path.join(root, 'vendor/three.bundle.js'),
  bundle: true,
  format: 'iife',
  globalName: 'THREE',
  minify: true,
  legalComments: 'eof',
  target: ['es2020'],
  logLevel: 'info'
});
