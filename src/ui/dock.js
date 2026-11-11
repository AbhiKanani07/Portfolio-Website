// A companion orb that docks in the corner once the hero scrolls away. It
// follows you through the page, morphing to match the section you're reading,
// and opens the command palette. Canvas 2D, 360 points, animates only when seen.
import { $ } from '../core/dom.js';
import { motion } from '../core/motion.js';

const N = 360;
const TAU = Math.PI * 2;
const SECTIONS = [['top', 'core', 'Ask'], ['work', 'matrix', 'Work'], ['sandbox', 'systems', 'Sandbox'], ['experience', 'helix', 'Experience'], ['between', 'voxels', 'In between'], ['contact', 'core', 'Contact']];
const CUBES = [[0, -0.7, 0, 0.85, 0.08, 0.65], [-0.45, -0.38, 0.25, 0.22, 0.22, 0.22], [0.4, -0.38, -0.2, 0.22, 0.22, 0.22], [-0.45, 0.04, 0.25, 0.18, 0.18, 0.18], [0.45, 0.12, -0.25, 0.2, 0.2, 0.2], [0.45, 0.55, -0.25, 0.16, 0.2, 0.16], [0, 0.85, 0.35, 0.12, 0.12, 0.12]];

function shape(kind) {
  const p = new Float32Array(N * 3);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    let x; let y; let z;
    if (kind === 'matrix') { const k = i % 27; const a = ((k + 0.5) / 27) * TAU; y = -0.8 + Math.floor((i / 27) % 3) * 0.56 + rnd() * 0.44; x = Math.cos(a); z = Math.sin(a); }
    else if (kind === 'systems') { const u = rnd() * TAU; const v = rnd() * TAU; const R = 0.78; const r = 0.26; x = (R + r * Math.cos(v)) * Math.cos(u); const yy = r * Math.sin(v); const zz = (R + r * Math.cos(v)) * Math.sin(u); y = yy * 0.58 - zz * 0.81; z = yy * 0.81 + zz * 0.58; }
    else if (kind === 'helix') { const t = i / N; const s = i % 2 ? Math.PI : 0; const a = t * TAU * 2.4 + s; x = Math.cos(a) * 0.5; y = (t - 0.5) * 2; z = Math.sin(a) * 0.5; }
    else if (kind === 'voxels') { const c = CUBES[i % CUBES.length]; const f = Math.floor(rnd() * 6); const u = rnd() * 2 - 1; const v = rnd() * 2 - 1; const q = [[1, u, v], [-1, u, v], [u, 1, v], [u, -1, v], [u, v, 1], [u, v, -1]][f]; x = c[0] + q[0] * c[3]; y = c[1] + q[1] * c[4]; z = c[2] + q[2] * c[5]; }
    else { const yy = 1 - (2 * (i + 0.5)) / N; const r = Math.sqrt(1 - yy * yy); const phi = i * 2.39996323; x = Math.cos(phi) * r; y = yy; z = Math.sin(phi) * r; }
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
  }
  return p;
}

export function initDock({ hero, onOpen }) {
  const btn = $('[data-dock]');
  if (!btn) return { pulse() {} };
  const label = $('[data-dock-label]', btn);
  const cv = $('canvas', btn);
  const g = cv.getContext('2d');
  const S = 40;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = S * dpr;
  cv.height = S * dpr;
  g.scale(dpr, dpr);
  const SHAPES = {};
  ['core', 'matrix', 'systems', 'helix', 'voxels'].forEach((k) => { SHAPES[k] = shape(k); });
  let from = SHAPES.core;
  let to = SHAPES.core;
  let t = 1;
  const cur = new Float32Array(N * 3);
  let on = false;
  let raf = 0;
  let last = 0;
  let rot = 0;
  let pulse = 0;

  const draw = (dt) => {
    rot += dt * 0.6;
    pulse *= Math.exp(-dt * 5);
    if (t < 1) t = Math.min(1, t + dt / 0.7);
    const e = t * t * (3 - 2 * t);
    for (let i = 0; i < cur.length; i++) cur[i] = from[i] + (to[i] - from[i]) * e;
    g.clearRect(0, 0, S, S);
    const R = S * 0.34 * (1 + pulse * 0.14);
    const cy = Math.cos(rot);
    const sy = Math.sin(rot);
    for (let i = 0; i < N; i++) {
      const x = cur[i * 3]; const y = cur[i * 3 + 1]; const z = cur[i * 3 + 2];
      const X = x * cy + z * sy;
      const Z = -x * sy + z * cy;
      const Y = y * 0.95 - Z * 0.3;
      const depth = Math.max(0, Math.min(1, (y * 0.3 + Z * 0.95 + 1) / 2));
      g.fillStyle = depth > 0.6 ? `rgba(0, 240, 255, ${(0.3 + depth * 0.7).toFixed(2)})` : `rgba(46, 91, 255, ${(0.25 + depth * 0.7).toFixed(2)})`;
      const s = 0.6 + depth * 1.1;
      g.fillRect(S / 2 + X * R - s / 2, S / 2 - Y * R - s / 2, s, s);
    }
  };
  const loop = (now) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    draw(dt);
    if (on && !document.hidden && !motion.reduced) raf = requestAnimationFrame(loop);
    else { raf = 0; last = 0; }
  };
  const kick = () => { if (on && !raf && !document.hidden && !motion.reduced) raf = requestAnimationFrame(loop); };
  const morph = (kind) => {
    const target = SHAPES[kind] || SHAPES.core;
    if (target === to) return;
    from = Float32Array.from(cur.some((v) => v !== 0) ? cur : to);
    to = target;
    t = motion.reduced ? 1 : 0;
    if (motion.reduced) draw(0);
    kick();
  };

  new IntersectionObserver(([en]) => {
    on = !en.isIntersecting;
    btn.classList.toggle('is-on', on);
    btn.tabIndex = on ? 0 : -1;
    btn.setAttribute('aria-hidden', String(!on));
    if (motion.reduced) draw(0);
    kick();
  }, { threshold: 0.04 }).observe(hero);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const s = SECTIONS.find(([id]) => id === en.target.id);
      if (!s) return;
      label.textContent = s[2];
      btn.setAttribute('aria-label', `Ask the assistant. You're in ${s[2]}.`);
      morph(s[1]);
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
  document.addEventListener('visibilitychange', kick);
  btn.addEventListener('click', onOpen);
  draw(0);
  return { pulse(v) { pulse = Math.min(1, pulse + v); kick(); } };
}
