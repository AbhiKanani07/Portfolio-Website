import { mountOdds, miniOdds } from "./odds.js";
import { mountKeystroke, miniKeystroke } from "./keystroke.js";
import { mountYouTube, miniYouTube } from "./youtube.js";
import { mountSleep, miniSleep } from "./sleep.js";
import { mountWater, miniWater } from "./water.js";
const DEMOS = { odds: mountOdds, keystroke: mountKeystroke, youtube: mountYouTube, sleep: mountSleep, water: mountWater };
const MINIS = { odds: miniOdds, keystroke: miniKeystroke, youtube: miniYouTube, sleep: miniSleep, water: miniWater };
function mountDemo(el) {
  if (el.dataset.mounted) return;
  const fn = DEMOS[el.dataset.demo];
  if (!fn) return;
  fn(el);
  el.dataset.mounted = "1";
}
function mountMini(el) {
  const fn = MINIS[el.dataset.mini];
  if (fn) fn(el);
}
export {
  mountDemo,
  mountMini
};
