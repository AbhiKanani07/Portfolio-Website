import { $$, clamp } from "../core/dom.js";
import { Spring, driver } from "../core/spring.js";
import { motion } from "../core/motion.js";
function initMagnetic(root = document) {
  if (!motion.finePointer || motion.reduced) return;
  $$("[data-magnetic]", root).forEach((el) => {
    if (el.dataset.magneticReady) return;
    el.dataset.magneticReady = "1";
    const x = new Spring(0, { stiffness: 220, damping: 22 });
    const y = new Spring(0, { stiffness: 220, damping: 22 });
    const label = el.firstElementChild;
    const d = driver([x, y], () => {
      el.style.transform = `translate3d(${x.value.toFixed(2)}px, ${y.value.toFixed(2)}px, 0)`;
      if (label) label.style.transform = `translate3d(${(x.value * 0.35).toFixed(2)}px, ${(y.value * 0.35).toFixed(2)}px, 0)`;
    }, () => {
      if (x.value === 0 && y.value === 0) {
        el.style.transform = "";
        if (label) label.style.transform = "";
      }
    });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x.set(clamp((e.clientX - (r.left + r.width / 2)) * 0.3, -12, 12));
      y.set(clamp((e.clientY - (r.top + r.height / 2)) * 0.3, -9, 9));
      d.kick();
    });
    el.addEventListener("pointerleave", () => {
      x.set(0);
      y.set(0);
      d.kick();
    });
  });
}
export {
  initMagnetic
};
