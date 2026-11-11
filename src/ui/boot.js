// A boot log that reports what actually happened while the page started:
// real context and shader timings, the real point count, the real index size.
// Any key, click, scroll, or touch skips it. Reduced motion skips it entirely.
import { $ } from '../core/dom.js';
import { motion } from '../core/motion.js';

const ms = (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;

export function runBoot(info, onDone) {
  const el = $('[data-boot]');
  const hero = $('.hero');
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  let done = false;
  const off = () => events.forEach((e) => window.removeEventListener(e, finish));
  function finish() {
    if (done) return;
    done = true;
    off();
    hero.classList.remove('is-booting');
    if (el) { el.classList.add('is-done'); setTimeout(() => el.remove(), 450); }
    onDone();
  }
  if (!el || motion.reduced) { finish(); return; }
  const lines = [
    ['webgl2 context', info.gl ? ms(info.contextMs) : 'unavailable, css fallback'],
    ...(info.gl ? [['shaders compiled', `2 programs, ${ms(info.compileMs)}`], ['point cloud', `${info.points.toLocaleString('en-US')} points`]] : []),
    ['record indexed', `${info.entries} entries, ${info.terms} terms, ${ms(info.indexMs)}`],
    ['answer engine', info.engine],
    ['display', `${info.w} × ${info.h} at ${info.dpr}x`],
  ];
  const list = $('[data-boot-log]', el);
  events.forEach((e) => window.addEventListener(e, finish, { passive: true }));
  let i = 0;
  const step = () => {
    if (done) return;
    if (i >= lines.length) {
      const li = document.createElement('li');
      li.className = 'boot__ready';
      li.textContent = 'ready';
      list.append(li);
      setTimeout(finish, 420);
      return;
    }
    const [k, v] = lines[i];
    i += 1;
    const li = document.createElement('li');
    li.innerHTML = `<span>${k}</span><i></i><b>${v}</b>`;
    list.append(li);
    setTimeout(step, 110);
  };
  setTimeout(step, 150);
}
