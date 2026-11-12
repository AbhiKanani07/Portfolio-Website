import { $$ } from "../core/dom.js";
import { Spring, driver } from "../core/spring.js";
import { motion } from "../core/motion.js";
function animateIn(el, delay) {
  const isRule = el.hasAttribute("data-rule");
  setTimeout(() => {
    const p = new Spring(0, { stiffness: isRule ? 70 : 120, damping: isRule ? 17 : 21 });
    el.classList.add("is-in");
    const apply = () => {
      const v = p.value;
      if (isRule) el.style.transform = `scaleX(${v.toFixed(4)})`;
      else {
        el.style.opacity = String(Math.min(1, v * 1.15));
        el.style.transform = `translate3d(0, ${((1 - v) * 18).toFixed(2)}px, 0)`;
      }
    };
    apply();
    p.set(1);
    driver(p, apply, () => {
      el.style.opacity = "";
      el.style.transform = "";
    }).kick();
  }, delay);
}
function initReveal() {
  const html = document.documentElement;
  if (motion.reduced || !("IntersectionObserver" in window)) {
    html.classList.add("reveal-off");
    return;
  }
  const units = [];
  $$("[data-reveal-group]").forEach((g) => units.push({ el: g, items: $$("[data-reveal], [data-rule]", g) }));
  $$("[data-reveal], [data-rule]").forEach((el) => {
    if (!el.closest("[data-reveal-group]")) units.push({ el, items: [el] });
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const unit = units.find((u) => u.el === en.target);
      if (unit) unit.items.forEach((it, i) => animateIn(it, i * 70));
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  units.forEach((u) => io.observe(u.el));
  setTimeout(() => {
    $$("[data-reveal]:not(.is-in), [data-rule]:not(.is-in)").forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add("is-in");
    });
  }, 4e3);
}
export {
  initReveal
};
