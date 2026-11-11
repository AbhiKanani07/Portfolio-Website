// An adaptive hover highlight: it glides between interactive elements and
// takes their shape, like a spatial OS pointer. The system cursor stays as is.
import { Spring, driver } from '../core/spring.js';
import { motion } from '../core/motion.js';

const TARGETS = 'a.btn, button.btn, .chip, .nav__links a, .nav__ask, .nav__name, .seg button, .answer__clear, .ks__swatch, .rbx__tile a, .dock, .palette__item, .channel__links a, .contact__list a, .foot a';

export function initPointer() {
  if (!motion.finePointer || motion.reduced) return;
  const el = document.createElement('div');
  el.className = 'pointer';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const s = (v) => new Spring(v, { stiffness: 480, damping: 40 });
  const x = s(0); const y = s(0); const w = s(12); const h = s(12); const r = s(6); const o = new Spring(0, { stiffness: 260, damping: 32 });
  const d = driver([x, y, w, h, r, o], () => {
    el.style.transform = `translate3d(${(x.value - w.value / 2).toFixed(1)}px, ${(y.value - h.value / 2).toFixed(1)}px, 0)`;
    el.style.width = `${w.value.toFixed(1)}px`;
    el.style.height = `${h.value.toFixed(1)}px`;
    el.style.borderRadius = `${r.value.toFixed(1)}px`;
    el.style.opacity = o.value.toFixed(3);
  });
  let mx = -100;
  let my = -100;
  const aim = () => {
    const top = mx >= 0 ? document.elementFromPoint(mx, my) : null;
    const t = top && top.closest ? top.closest(TARGETS) : null;
    if (t && t.getClientRects().length && !t.closest('[hidden]')) {
      const b = t.getBoundingClientRect();
      const rad = parseFloat(getComputedStyle(t).borderTopLeftRadius) || 6;
      x.set(b.left + b.width / 2 + (mx - (b.left + b.width / 2)) * 0.06);
      y.set(b.top + b.height / 2 + (my - (b.top + b.height / 2)) * 0.06);
      w.set(b.width + 8); h.set(b.height + 8); r.set(Math.min(rad + 4, (b.height + 8) / 2)); o.set(1);
    } else {
      x.set(mx); y.set(my); w.set(12); h.set(12); r.set(6); o.set(0);
    }
    d.kick();
  };
  document.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; aim(); }, { passive: true });
  document.addEventListener('scroll', aim, { passive: true });
  const later = () => { setTimeout(aim, 60); setTimeout(aim, 420); };
  document.addEventListener('click', later);
  document.addEventListener('keydown', later);
  window.addEventListener('hashchange', later);
  document.documentElement.addEventListener('pointerleave', () => { o.set(0); d.kick(); });
  document.addEventListener('pointerdown', () => { if (o.target > 0) { w.set(w.target - 4); h.set(h.target - 4); d.kick(); } });
}
