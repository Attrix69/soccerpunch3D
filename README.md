# Tacle Fury 3D

Foot de combat 3 contre 3, en 3D temps réel, dans le navigateur.
Zéro arbitre. Zéro carton. Zéro pitié.

C'est la version 3D de **Soccer Punch / Tacle Fury** : mêmes règles, mêmes personnages, même façon de jouer que la version 2D,
dans un stade complet avec foule, projecteurs, écrans géants et effets spéciaux.

## Jouer

Ouvre `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari). Le fichier est autonome : tout est dedans
(moteur 3D, modèles, sons, polices) et il fonctionne hors ligne.

Pour jouer en ligne avec un ami, héberge le fichier (GitHub Pages, Netlify…) et envoie-lui le lien, puis utilise
**DÉFIER UN POTE** / **REJOINDRE**.

### Commandes

| Action | Clavier | Tactile |
|---|---|---|
| Se déplacer | Flèches, ZQSD (AZERTY) ou WASD (QWERTY) | joystick |
| Frappe · tir · passe (tap) · volée · tête · achever | Espace ou J | FRAPPE |
| Tacle (maintenir) · esquive avec le ballon | K ou L | TACLE |
| Sprint | Maj | SPRINT |
| Ki · rayon · ultime | E ou I | KI |
| Pause | Échap | ☰ |
| Plein écran | F | |

### Graphismes

Le menu **OPTIONS** propose trois niveaux : **ULTRA** (ombres fines, bloom, post-traitement complet, foule dense),
**HAUTE** et **PERF** (rendu direct, idéal pour les téléphones modestes). En mode AUTO, le jeu baisse tout seul la qualité
si l'appareil peine.

## Développement

```bash
npm install
npm run vendor   # (re)génère vendor/three.bundle.js à partir de three.js
npm run build    # assemble src/ en un seul index.html
npm run check    # vérifie que le build est à jour
npm run serve    # sert le dossier sur http://localhost:8080
```

### Organisation

- `src/shell.html`, `src/body.html`, `src/css/` : page, interface et styles
- `src/js/sim.js` : la simulation du match, **identique à la version 2D** (règles, IA, réseau déterministe)
- `src/js/game/` : le rendu et le jeu, par modules numérotés
  - `30-gfx.js` : moteur de rendu, lumières, post-traitement (bloom, ondes de choc, flash, grain)
  - `31-assets.js` : chargement des modèles GLB embarqués
  - `32-pitch.js`, `33-stadium.js` : pelouse, panneaux LED, tribunes, foule animée sur le GPU, tifo, projecteurs
  - `35-fx.js` : sang, particules, textes, effets VFX 3D
  - `40-looks.js` à `43-portrait.js` : personnages toon procéduraux, poses reprises de la 2D, portraits du draft
  - `45-powers.js`, `50-ball.js`, `76-fx3d.js` : ultimes, ballon, buts, filets et effets des grands moments
  - `72-camera.js` : réalisation TV (plans de but, de KO, d'ultime, intro du match)
- `assets/models/` : modèles 3D CC0 de [3dassets.dev](https://3dassets.dev) (voir `assets/CREDITS.md`)
- `src/sfx/` : sons du jeu · `vendor/` : three.js empaqueté
- `build.js` : assemble le tout (`@@include`, `@@glb`, `@@sfx`, `@@raw`)

Les personnages, le ballon, la pelouse, la foule et les panneaux sont générés par le code ; le stade et les effets
s'appuient sur les modèles de 3dassets.dev.

Pour les tests, `index.html?gfx=ultra|high|perf` force un niveau graphique.
