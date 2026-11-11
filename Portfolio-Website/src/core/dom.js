// Small DOM and math helpers shared by every module.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Run at most once per animation frame with the latest arguments.
export function rafThrottle(fn) {
  let id = 0;
  let args;
  return (...a) => {
    args = a;
    if (!id) id = requestAnimationFrame(() => { id = 0; fn(...args); });
  };
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ResizeObserver throttled to one callback per frame. Returns a disposer.
export function observeResize(targets, fn) {
  const run = rafThrottle(fn);
  const ro = new ResizeObserver(() => run());
  [].concat(targets).forEach((t) => t && ro.observe(t));
  return () => ro.disconnect();
}

// Deterministic PRNG so demos render the same data on every visit.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
