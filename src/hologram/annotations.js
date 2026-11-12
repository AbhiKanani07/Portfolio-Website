// Labels around the hologram: three facts from the record per topic, pinned at
// fixed angles on the hologram's edge so they stay put while the shape turns.
// They fade on topic changes and hide whenever the stage is too small for them.
import { observeResize } from '../core/dom.js';
import { motion } from '../core/motion.js';

export const NOTES = {
  core: [['Quest Diagnostics', 'Enterprise Data Engineer'], ['University of Pittsburgh', 'Data Science, Dec 2028'], ['Shipping', 'Bravox and Keystroke']],
  systems: [['Cloud', 'Azure, Fabric, AWS'], ['Backends', 'FastAPI, Node.js'], ['Delivery', 'Docker, CI/CD']],
  pipelines: [['In production', '5 pipelines'], ['Ingestion', '1,000+ daily jobs'], ['Reporting', '100+ labs']],
  matrix: [['Catalog', '27 cards'], ['Bureaus', '3, judged per issuer'], ['Odds band', '45–96%']],
  clusters: [['Sleep model', '93% accuracy, SHAP'], ['Ranking', 'Similarity and engagement'], ['Serving', 'FastAPI and Redis']],
  helix: [['Dec 2028', 'B.S. Data Science'], ['2026', 'Quest, AWS Cloud Club'], ['2025', 'Mascaro, data analyst intern']],
  voxels: [['Roblox', 'Recently played and favorites'], ['Library', 'Synced from Roblox'], ['Search', 'Typo-tolerant, in your browser']],
  pass: [['Keystroke', 'Image to Wallet pass'], ['Bundle', 'SHA-1 manifest'], ['Signing', 'Server-side, FastAPI']],
};
const ANGLES = [50, -12, 208];

export function initAnnotations(holo, { root, slot }) {
  const layer = document.createElement('div');
  layer.className = 'holo-notes';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `<svg>${'<line></line><circle r="2.2"></circle>'.repeat(3)}</svg>${'<div class="note"><span class="note__k mono"></span><span class="note__v"></span></div>'.repeat(3)}`;
  root.insertBefore(layer, root.querySelector('.hero__grid'));
  const lines = Array.from(layer.querySelectorAll('line'));
  const dots = Array.from(layer.querySelectorAll('circle'));
  const notes = Array.from(layer.querySelectorAll('.note'));
  let shown = null;
  let fade = 0;
  let sizes = notes.map(() => [0, 0]);
  let box = null;
  let last = 0;
  let placed = '';
  const measure = () => {
    const r = root.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    box = { x: s.left - r.left, y: s.top - r.top, w: s.width, h: s.height };
    placed = '';
  };
  measure();
  observeResize([root, slot], measure);
  const show = (topic) => {
    shown = topic;
    NOTES[topic].forEach(([k, v], i) => { notes[i].children[0].textContent = k; notes[i].children[1].textContent = v; });
    sizes = notes.map((el) => [el.offsetWidth, el.offsetHeight]);
    placed = '';
  };

  holo.onFrame = (h) => {
    const t = performance.now();
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
    last = t;
    const topic = NOTES[h.topic] ? h.topic : 'core';
    const want = topic === shown && h.morph >= 0.85 ? 1 : 0;
    fade += (want - fade) * (motion.reduced ? 1 : 1 - Math.exp(-dt * 8));
    if (topic !== shown && fade < 0.03) show(topic);
    const roomy = box && box.w >= 400 && box.h >= 250;
    const op = roomy ? Math.round(fade * 100) / 100 : 0;
    if (layer.style.opacity !== String(op)) layer.style.opacity = String(op);
    if (!op || !shown) return;
    const c = h.project([0, 0, 0]);
    const rad = h.radiusPx() * 0.92;
    const key = `${Math.round(c.x)},${Math.round(c.y)},${Math.round(rad)},${shown}`;
    if (key === placed) return;
    placed = key;
    ANGLES.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const ax = c.x + Math.cos(a) * rad;
      const ay = c.y - Math.sin(a) * rad;
      const [w, ht] = sizes[i];
      const right = Math.cos(a) >= 0;
      let x = right ? ax + 20 : ax - 20 - w;
      let y = ay - ht / 2;
      x = Math.max(box.x + 4, Math.min(box.x + box.w - w - 4, x));
      y = Math.max(box.y + 4, Math.min(box.y + box.h - ht - 4, y));
      notes[i].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      const ex = right ? x : x + w;
      lines[i].setAttribute('x1', ax.toFixed(1));
      lines[i].setAttribute('y1', ay.toFixed(1));
      lines[i].setAttribute('x2', ex.toFixed(1));
      lines[i].setAttribute('y2', (y + ht / 2).toFixed(1));
      dots[i].setAttribute('cx', ax.toFixed(1));
      dots[i].setAttribute('cy', ay.toFixed(1));
    });
  };
}
