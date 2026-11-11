// Full-screen case study drawer on a spring. Deep-linkable (#case-*), the back
// button closes it, focus is trapped while open, and the top bar can be dragged
// to dismiss with the release velocity carried into the spring.
import { $, $$ } from '../core/dom.js';
import { Spring, driver } from '../core/spring.js';
import { motion } from '../core/motion.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function initDrawer({ onOpen, onClose } = {}) {
  const root = $('[data-drawer]');
  if (!root) return null;
  const panel = $('[data-drawer-panel]', root);
  const backdrop = $('.drawer__backdrop', root);
  const body = $('[data-drawer-body]', root);
  const crumb = $('[data-drawer-crumb]', root);
  const bar = $('[data-drawer-drag]', root);
  const cases = $$('.case', body);
  const progress = new Spring(0, { stiffness: 230, damping: 29 });
  let open = false;
  let current = null;
  let returnFocus = null;
  let pushed = false;

  const render = () => {
    const v = progress.value;
    panel.style.transform = `translate3d(${((1 - v) * 100).toFixed(3)}%, 0, 0)`;
    backdrop.style.opacity = String(Math.max(0, Math.min(1, v)));
  };
  let forceTimer = 0;
  const finalize = () => {
    if (root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove('is-locked');
    if (current) current.hidden = true;
    current = null;
    if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
    if (onClose) onClose();
  };
  const anim = driver(progress, render, () => { if (!open && progress.value <= 0.001) finalize(); });

  function show(id, { fromHistory = false } = {}) {
    const article = cases.find((c) => c.id === `case-${id}`);
    if (!article) return;
    clearTimeout(forceTimer);
    if (current && current !== article) current.hidden = true;
    current = article;
    article.hidden = false;
    crumb.textContent = `Work / ${article.dataset.title || ''}`;
    root.setAttribute('aria-labelledby', article.getAttribute('aria-labelledby'));
    if (!open) {
      returnFocus = document.activeElement;
      const sbw = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--sbw', `${sbw}px`);
      document.documentElement.classList.add('is-locked');
      root.hidden = false;
      open = true;
    }
    body.scrollTop = 0;
    if (!fromHistory) {
      history.pushState({ drawer: id }, '', `#case-${id}`);
      pushed = true;
    }
    progress.set(1);
    anim.kick();
    if (onOpen) onOpen(id, article);
    requestAnimationFrame(() => { const first = $('.case__title', article); (first || panel).setAttribute('tabindex', '-1'); (first || panel).focus({ preventScroll: true }); });
  }

  function hide({ fromHistory = false, velocity = 0 } = {}) {
    if (!open) return;
    if (!fromHistory && pushed && history.state && history.state.drawer) { history.back(); return; }
    if (!fromHistory) history.replaceState(null, '', location.pathname + location.search);
    pushed = false;
    open = false;
    progress.velocity = velocity;
    progress.set(0);
    anim.kick();
    // On a device too slow to finish the spring, still close promptly.
    clearTimeout(forceTimer);
    forceTimer = setTimeout(() => { if (!open) { anim.stop(); progress.jump(0); render(); finalize(); } }, 900);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#case-"]');
    if (!a) return;
    e.preventDefault();
    show(a.getAttribute('href').slice(6));
  });
  $$('[data-drawer-close]', root).forEach((b) => b.addEventListener('click', () => hide()));
  window.addEventListener('popstate', () => {
    const m = location.hash.match(/^#case-([\w-]+)$/);
    if (m) show(m[1], { fromHistory: true });
    else hide({ fromHistory: true });
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, panel).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Drag the top bar to the right to dismiss.
  let drag = null;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || motion.reduced) return;
    drag = { x: e.clientX, t: performance.now(), w: panel.getBoundingClientRect().width, vx: 0, lx: e.clientX, lt: performance.now() };
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('is-dragging');
    anim.stop();
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = Math.max(0, e.clientX - drag.x);
    const t = performance.now();
    drag.vx = (e.clientX - drag.lx) / Math.max(1, t - drag.lt) * 1000;
    drag.lx = e.clientX;
    drag.lt = t;
    progress.jump(1 - dx / drag.w);
    render();
  });
  const release = () => {
    if (!drag) return;
    const dx = Math.max(0, drag.lx - drag.x);
    const v = -drag.vx / drag.w;
    bar.classList.remove('is-dragging');
    const close = dx > drag.w * 0.28 || drag.vx > 700;
    drag = null;
    if (close) hide({ velocity: v });
    else { progress.velocity = v; progress.set(1); anim.kick(); }
  };
  bar.addEventListener('pointerup', release);
  bar.addEventListener('pointercancel', release);

  const initial = location.hash.match(/^#case-([\w-]+)$/);
  if (initial) show(initial[1], { fromHistory: true });

  return { show, hide };
}
