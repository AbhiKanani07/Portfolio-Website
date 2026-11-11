// Bento cards: a cursor-following spotlight and border light, staggered
// telemetry tags, and live mini visualizations computed by the demo code.
import { $$, rafThrottle } from '../core/dom.js';
import { motion } from '../core/motion.js';
import { mountMini } from '../demos/index.js';

export function initBento() {
  $$('.card').forEach((card) => {
    $$('.card__tags span', card).forEach((s, i) => s.style.setProperty('--i', i));
    if (!motion.finePointer) return;
    const move = rafThrottle((x, y) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${x - r.left}px`);
      card.style.setProperty('--my', `${y - r.top}px`);
    });
    card.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    card.addEventListener('pointerenter', (e) => { move(e.clientX, e.clientY); card.classList.add('is-hot'); });
    card.addEventListener('pointerleave', () => card.classList.remove('is-hot'));
  });
  $$('[data-mini]').forEach((el) => mountMini(el));
}
