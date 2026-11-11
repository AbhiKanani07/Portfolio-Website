// Bento cards: a cursor-following spotlight and border light, staggered
// telemetry tags, and live mini visualizations computed by the demo code.
import { $$, rafThrottle } from '../core/dom.js';
import { motion } from '../core/motion.js';
import { Spring, driver } from '../core/spring.js';
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
    // Spatial tilt: the card leans toward the cursor and its visual drifts the other way.
    const rx = new Spring(0, { stiffness: 170, damping: 22 });
    const ry = new Spring(0, { stiffness: 170, damping: 22 });
    const viz = card.querySelector('.card__viz');
    const tilt = driver([rx, ry], () => {
      card.style.transform = rx.value || ry.value ? `perspective(1100px) rotateX(${rx.value.toFixed(3)}deg) rotateY(${ry.value.toFixed(3)}deg)` : '';
      if (viz) viz.style.transform = `translate3d(${(-ry.value * 1.6).toFixed(2)}px, ${(rx.value * 1.6).toFixed(2)}px, 0)`;
    });
    const lean = (x, y) => {
      if (motion.reduced) return;
      const r = card.getBoundingClientRect();
      ry.set(((x - r.left) / r.width - 0.5) * 5);
      rx.set(-((y - r.top) / r.height - 0.5) * 4);
      tilt.kick();
    };
    card.addEventListener('pointermove', (e) => { move(e.clientX, e.clientY); lean(e.clientX, e.clientY); });
    card.addEventListener('pointerenter', (e) => { move(e.clientX, e.clientY); card.classList.add('is-hot'); });
    card.addEventListener('pointerleave', () => { card.classList.remove('is-hot'); rx.set(0); ry.set(0); tilt.kick(); });
  });
  $$('[data-mini]').forEach((el) => mountMini(el));
}
