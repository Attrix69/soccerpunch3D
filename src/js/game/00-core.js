/* ================= TACLE FURY 3D — RENDU 3D, CONTRÔLES, SON, RÉSEAU ================= */
(function () {
  'use strict';
  const { W, H, GD, BARZ, PR, BR, MT, MB, ST, PH, TEAMS } = TF;
  const VER = '3D-1.0';
  const PFX = 'tfury3d26-';
  const $ = id => document.getElementById(id);
  const R = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const len = (x, y) => Math.sqrt(x * x + y * y);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = a => a[(R() * a.length) | 0];
  const Q = new URLSearchParams(location.search);
  const isTouch = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);
  const FONT = 'Anton, Impact, "Arial Narrow Bold", sans-serif';

  // l'interface (HUD, textes, aides) se dessine sur un canvas 2D posé au-dessus du rendu 3D
  const uicv = $('ui'), uictx = uicv.getContext('2d');
  let ctx = uictx;
  const ctl = $('ctl'), mbtn = $('mbtn');

  /* =============== état de l'appli =============== */
  const app = {
    mode: 'menu',          // menu | solo | host | guest
    myTeam: 0, world: null, paused: false, diff: 'normal',
    V: null, endShown: false, endT: 0, demo: null, tick: 0, lastCount: -1, drafting: false, ready: false
  };
