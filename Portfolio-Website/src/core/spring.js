// Spring physics for every UI motion on the page: drawers, magnetic buttons,
// node drags, reveals. Damped harmonic oscillators integrated with fixed
// substeps, driven by one shared rAF ticker that sleeps when nothing moves.
import { motion } from './motion.js';

const active = new Set();
let raf = 0;
let last = 0;

function frame(now) {
  const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60;
  last = now;
  for (const fn of Array.from(active)) {
    if (fn(dt, now) === false) active.delete(fn);
  }
  if (active.size) raf = requestAnimationFrame(frame);
  else { raf = 0; last = 0; }
}

export const ticker = {
  add(fn) {
    active.add(fn);
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    return () => active.delete(fn);
  },
  remove(fn) { active.delete(fn); },
};

export class Spring {
  // stiffness k, damping c, mass m. Damping ratio = c / (2 * sqrt(k * m)).
  constructor(value = 0, { stiffness = 170, damping = 26, mass = 1, precision = 0.0005 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.k = stiffness;
    this.c = damping;
    this.m = mass;
    this.precision = precision;
  }
  set(target) { this.target = target; return this; }
  jump(value) { this.value = value; this.target = value; this.velocity = 0; return this; }
  step(dt) {
    const h = 1 / 240;
    let t = dt;
    while (t > 1e-6) {
      const s = Math.min(h, t);
      const force = -this.k * (this.value - this.target) - this.c * this.velocity;
      this.velocity += (force / this.m) * s;
      this.value += this.velocity * s;
      t -= s;
    }
    if (this.settled) { this.value = this.target; this.velocity = 0; }
    return this.value;
  }
  get settled() {
    return Math.abs(this.velocity) < this.precision * 20 && Math.abs(this.value - this.target) < this.precision;
  }
}

// Runs a group of springs until all settle. kick() restarts it after targets change.
export function driver(springs, onUpdate, onRest) {
  const list = [].concat(springs);
  let running = false;
  const fn = (dt) => {
    let settled = true;
    for (const s of list) { s.step(dt); if (!s.settled) settled = false; }
    onUpdate(list);
    if (settled) { running = false; onRest && onRest(list); return false; }
    return true;
  };
  return {
    kick() {
      if (motion.reduced) {
        list.forEach((s) => s.jump(s.target));
        onUpdate(list);
        onRest && onRest(list);
        return;
      }
      if (!running) { running = true; ticker.add(fn); }
    },
    stop() { running = false; ticker.remove(fn); },
    get running() { return running; },
  };
}
