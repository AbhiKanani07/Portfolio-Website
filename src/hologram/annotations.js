// Labels pinned to points on the hologram. Each topic has three anchors in the
// shape's own coordinates; every frame they're projected through the same
// matrices as the point cloud, so the labels track the shape as it turns and
// dim when their anchor swings behind it. The values come from the record.
import { observeResize } from '../core/dom.js';
import { motion } from '../core/motion.js';

const TAU = Math.PI * 2;
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const torus = (u) => {
  const R = 1.28; const c = Math.cos(0.95); const s = Math.sin(0.95);
  const x = R * Math.cos(u); const z = R * Math.sin(u);
  return [x, -z * s, z * c];
};
const cluster = (k) => { const a = k * 1.0471976 + 0.4; const e = k % 2 === 0 ? 0.4 : -0.4; return [Math.cos(a) * 0.76, e * (0.62 + 0.2 * Math.sin(k * 2.1)), Math.sin(a) * 0.76]; };
const helix = (t, time) => { const a = t * TAU * 2.4 + time * 0.25; return [Math.cos(a) * 0.5, (t - 0.5) * 2.1, Math.sin(a) * 0.5]; };
const pillar = (p, y) => { const a = ((p + 0.5) / 27) * TAU; return [Math.cos(a), y, Math.sin(a)]; };

export const NOTES = {
  core: [
    { at: () => unit(0.15, 1, 0.1), k: 'Quest Diagnostics', v: 'Enterprise Data Engineer' },
    { at: () => unit(0.95, -0.25, 0.3), k: 'University of Pittsburgh', v: 'Data Science, Dec 2028' },
    { at: () => unit(-0.7, -0.6, 0.4), k: 'Shipping', v: 'Bravox and Keystroke' },
  ],
  systems: [
    { at: () => torus(0.3), k: 'Cloud', v: 'Azure, Fabric, AWS' },
    { at: () => torus(2.4), k: 'Backends', v: 'FastAPI, Node.js' },
    { at: () => torus(4.4), k: 'Delivery', v: 'Docker, CI/CD' },
  ],
  pipelines: [
    { at: () => [-0.96, 0.6, 0.28], k: 'Ingestion', v: '1,000+ daily jobs' },
    { at: () => [0.5, 0, 0], k: 'In production', v: '5 pipelines' },
    { at: () => [0.86, -0.56, 0.56], k: 'Reporting', v: '100+ labs' },
  ],
  matrix: [
    { at: () => pillar(0, 0.79), k: 'Catalog', v: '27 cards' },
    { at: () => pillar(9, 0), k: 'Bureaus', v: '3, judged per issuer' },
    { at: () => pillar(18, -0.79), k: 'Odds band', v: '45–96%' },
  ],
  clusters: [
    { at: () => cluster(0), k: 'Sleep model', v: '93% accuracy, SHAP' },
    { at: () => cluster(2), k: 'Ranking', v: 'Similarity and engagement' },
    { at: () => cluster(4), k: 'Serving', v: 'FastAPI and Redis' },
  ],
  helix: [
    { at: (t) => helix(0.92, t), k: 'Dec 2028', v: 'B.S. Data Science' },
    { at: (t) => helix(0.55, t), k: '2026', v: 'Quest, AWS Cloud Club' },
    { at: (t) => helix(0.12, t), k: '2025', v: 'Mascaro, data analyst intern' },
  ],
  voxels: [
    { at: () => [0.45, 0.75, -0.25], k: 'Roblox', v: 'Recently played and favorites' },
    { at: () => [0.85, -0.62, 0.65], k: 'Library', v: 'Synced from Roblox' },
    { at: () => [0, 0.97, 0.35], k: 'Search', v: 'Typo-tolerant, in your browser' },
  ],
  pass: [
    { at: () => [0, 0.42, 0], k: 'Keystroke', v: 'Image to Wallet pass' },
    { at: () => [0, -0.56, 0], k: 'Bundle', v: 'SHA-1 manifest' },
    { at: () => [0.62, 0.86, 0], k: 'Signing', v: 'Server-side, FastAPI' },
  ],
};

export function initAnnotations(holo, { root, slot }) {
  const layer = document.createElement('div');
  layer.className = 'holo-notes';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `<svg>${'<line></line><circle r="2.4"></circle>'.repeat(3)}</svg>${'<div class="note"><span class="note__k mono"></span><span class="note__v"></span></div>'.repeat(3)}`;
  root.insertBefore(layer, root.querySelector('.hero__grid'));
  const lines = Array.from(layer.querySelectorAll('line'));
  const dots = Array.from(layer.querySelectorAll('circle'));
  const notes = Array.from(layer.querySelectorAll('.note'));
  let shown = null;
  let fade = 0;
  let sizes = notes.map(() => [0, 0]);
  let box = null;
  const measure = () => {
    const r = root.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    box = { x: s.left - r.left, y: s.top - r.top, w: s.width, h: s.height };
  };
  measure();
  observeResize([root, slot], measure);
  const show = (topic) => {
    shown = topic;
    NOTES[topic].forEach((n, i) => { notes[i].children[0].textContent = n.k; notes[i].children[1].textContent = n.v; });
    sizes = notes.map((el) => [el.offsetWidth, el.offsetHeight]);
  };

  let last = 0;
  holo.onFrame = (h) => {
    const t = performance.now();
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
    last = t;
    const topic = NOTES[h.topic] ? h.topic : 'core';
    const want = topic === shown && h.morph >= 0.8 ? 1 : 0;
    fade += (want - fade) * (motion.reduced ? 1 : 1 - Math.exp(-dt * 9));
    if (topic !== shown && fade < 0.03) show(topic);
    const roomy = box && box.w >= 360 && box.h >= 190;
    layer.style.opacity = roomy ? fade.toFixed(3) : '0';
    if (!roomy || fade < 0.01 || !shown) return;
    const c = h.project([0, 0, 0]);
    NOTES[shown].forEach((n, i) => {
      const p = h.project(n.at(h.time));
      const [w, ht] = sizes[i];
      let dx = p.x - c.x;
      let dy = p.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const right = dx >= 0;
      let x = p.x + dx * 40 + (right ? 10 : -10 - w);
      let y = p.y + dy * 26 - ht / 2;
      x = Math.max(box.x + 4, Math.min(box.x + box.w - w - 4, x));
      y = Math.max(box.y + 4, Math.min(box.y + box.h - ht - 4, y));
      const vis = p.front ? 1 : 0.28;
      notes[i].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      notes[i].style.opacity = String(vis);
      const ex = right ? x : x + w;
      const ln = lines[i];
      ln.setAttribute('x1', p.x.toFixed(1));
      ln.setAttribute('y1', p.y.toFixed(1));
      ln.setAttribute('x2', ex.toFixed(1));
      ln.setAttribute('y2', (y + ht / 2).toFixed(1));
      ln.style.opacity = String(vis * 0.85);
      dots[i].setAttribute('cx', p.x.toFixed(1));
      dots[i].setAttribute('cy', p.y.toFixed(1));
      dots[i].style.opacity = String(vis);
    });
  };
}
