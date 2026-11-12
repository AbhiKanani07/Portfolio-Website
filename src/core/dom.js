const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function rafThrottle(fn) {
  let id = 0;
  let args;
  return (...a) => {
    args = a;
    if (!id) id = requestAnimationFrame(() => {
      id = 0;
      fn(...args);
    });
  };
}
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
function observeResize(targets, fn) {
  const run = rafThrottle(fn);
  const ro = new ResizeObserver(() => run());
  [].concat(targets).forEach((t) => t && ro.observe(t));
  return () => ro.disconnect();
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = s + 1831565813 >>> 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export {
  $,
  $$,
  clamp,
  debounce,
  escapeHTML,
  gauss,
  lerp,
  mulberry32,
  observeResize,
  rafThrottle,
  wait
};
