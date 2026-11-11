// Twelve weeks of synthetic nights in the shape of a Fitbit export. Click a
// night to see why it scored the way it did. The score comes from a linear
// stand-in model, so each contribution is exact (for a linear model with
// independent features, SHAP values are w * (x - mean)); the real project
// explains a Random Forest with SHAP.
import { mulberry32, gauss, clamp, rangeHTML, bindRanges, ramp } from './shared.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FEATURES = [['duration', 'Sleep duration', 4], ['deep', 'Deep sleep share', 2.5], ['hrv', 'HRV', 2], ['rhr', 'Resting heart rate', -2], ['shift', 'Bedtime drift', -1.5], ['screen', 'Late screen time', -1.5]];
const BASE = 70;

export function generateNights({ consistency, screen }, seed = 7) {
  const rand = mulberry32(seed);
  const nights = [];
  for (let d = 0; d < 84; d++) {
    const weekday = d % 7;
    const shift = Math.abs(gauss(rand) * consistency + (weekday >= 5 ? consistency * 0.8 : 0));
    const scr = Math.max(0, screen + gauss(rand) * 15);
    let duration = 7.7 - shift * 0.012 - scr * 0.006 + gauss(rand) * 0.35;
    const deep = clamp(0.19 - scr * 0.0004 - shift * 0.0003 + gauss(rand) * 0.02, 0.06, 0.3);
    let hrv = 58 - shift * 0.05 - scr * 0.03 + gauss(rand) * 5;
    let rhr = 54 + shift * 0.02 + gauss(rand) * 2;
    if (rand() < 0.04) { rhr += 9 + rand() * 6; duration -= 1.2; hrv -= 14; }
    nights.push({ d, weekday, week: Math.floor(d / 7), duration: clamp(duration, 3.5, 9.8), deep, hrv, rhr, shift, screen: scr });
  }
  return nights;
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a, m) => Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)) || 1;

export function analyzeNights(nights, z) {
  const dur = nights.map((n) => n.duration);
  const rhr = nights.map((n) => n.rhr);
  const md = mean(dur); const sdd = sd(dur, md);
  const mr = mean(rhr); const sdr = sd(rhr, mr);
  const stats = Object.fromEntries(FEATURES.map(([k]) => { const v = nights.map((n) => n[k]); const m = mean(v); return [k, { m, s: sd(v, m) }]; }));
  nights.forEach((n) => {
    n.zr = (n.rhr - mr) / sdr;
    n.zd = (md - n.duration) / sdd;
    n.flag = n.zr > z || n.zd > z;
    n.good = n.duration >= 7 && n.deep >= 0.15;
    n.parts = FEATURES.map(([k, label, w]) => ({ label, c: (w * (n[k] - stats[k].m)) / stats[k].s }));
    n.score = clamp(BASE + n.parts.reduce((a, p) => a + p.c, 0), 0, 100);
  });
  return { md, hrv: mean(nights.map((n) => n.hrv)), good: nights.filter((n) => n.good).length / nights.length, flagged: nights.filter((n) => n.flag) };
}
const hm = (h) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;

export function mountSleep(root) {
  const state = { consistency: 35, screen: 45, z: 2.2, sel: -1 };
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      ${rangeHTML('consistency', 'Bedtime drift, typical', 5, 120, 5, state.consistency, ' min')}
      ${rangeHTML('screen', 'Screen time after 10 pm', 0, 150, 5, state.screen, ' min')}
      ${rangeHTML('z', 'Flag nights beyond', 1.5, 3.5, 0.1, state.z, 'σ')}
      <p class="demo__foot">Flags mark nights for follow-up. They are not a diagnosis.</p>
    </div>
    <div class="demo__out">
      <p class="demo__h">Sleep duration by night, twelve weeks. Select a night to explain it.</p>
      <div class="heat" data-heat style="grid-template-columns: 30px repeat(12, minmax(0, 1fr))"></div>
      <div class="legend"><span><i></i>shorter to longer</span><span><i class="key-flag"></i>flagged</span></div>
      <div class="stats" data-stats style="margin-top: 18px"></div>
      <div class="wf" data-wf aria-live="polite"></div>
    </div>
  </div></div>`;
  const heat = root.querySelector('[data-heat]');
  let nights = [];

  function explain() {
    const n = nights[state.sel];
    if (!n) return;
    heat.querySelectorAll('.heat__cell').forEach((c) => c.classList.toggle('is-sel', Number(c.dataset.d) === state.sel));
    const parts = n.parts.slice().sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
    const max = Math.max(4, ...parts.map((p) => Math.abs(p.c)));
    root.querySelector('[data-wf]').innerHTML = `<p class="demo__h">Week ${n.week + 1}, ${DAYS[n.weekday]}: score ${Math.round(n.score)}, against an average night of ${BASE}</p>`
      + parts.map((p) => {
        const w = (Math.abs(p.c) / max) * 50;
        return `<div class="wf__row"><span>${p.label}</span><span class="wf__bar"><i class="${p.c >= 0 ? 'pos' : 'neg'}" style="left:${(p.c >= 0 ? 50 : 50 - w).toFixed(1)}%; width:${w.toFixed(1)}%"></i></span><span class="wf__val">${p.c >= 0 ? '+' : '−'}${Math.abs(p.c).toFixed(1)}</span></div>`;
      }).join('');
  }

  function render() {
    nights = generateNights(state);
    const a = analyzeNights(nights, state.z);
    if (state.sel < 0) state.sel = nights.reduce((lo, n) => (n.score < nights[lo].score ? n.d : lo), 0);
    let html = '<span></span>';
    for (let w = 0; w < 12; w++) html += `<span class="heat__lab heat__lab--top">${w % 2 === 0 ? `W${w + 1}` : ''}</span>`;
    for (let d = 0; d < 7; d++) {
      html += `<span class="heat__lab">${DAYS[d]}</span>`;
      for (let w = 0; w < 12; w++) {
        const n = nights[w * 7 + d];
        html += `<button type="button" class="heat__cell${n.flag ? ' is-flag' : ''}" data-d="${n.d}" style="--c:${ramp((n.duration - 4.5) / 4)}" aria-label="Week ${w + 1}, ${DAYS[d]}: ${hm(n.duration)}, score ${Math.round(n.score)}${n.flag ? ', flagged' : ''}"></button>`;
      }
    }
    heat.innerHTML = html;
    root.querySelector('[data-stats]').innerHTML = [
      [hm(a.md), 'average sleep'], [`${Math.round(a.good * 100)}%`, 'good nights'], [`${a.hrv.toFixed(0)} ms`, 'average HRV'], [String(a.flagged.length), 'flagged nights'],
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
    explain();
  }
  heat.addEventListener('click', (e) => { const c = e.target.closest('.heat__cell'); if (c) { state.sel = Number(c.dataset.d); explain(); } });
  bindRanges(root, state, render);
  render();
}

export function miniSleep(el) {
  const nights = generateNights({ consistency: 35, screen: 45 });
  analyzeNights(nights, 2.2);
  const s = 18;
  const g = 3;
  let rects = '';
  nights.forEach((n) => { rects += `<rect x="${n.week * (s + g)}" y="${n.weekday * (s + g)}" width="${s}" height="${s}" fill="${ramp((n.duration - 4.5) / 4)}"${n.flag ? ' stroke="#ffb020" stroke-width="1.5"' : ''}/>`; });
  const w = 12 * (s + g) - g;
  const h = 7 * (s + g) - g;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h + 20}" role="img" aria-label="Synthetic twelve-week sleep heatmap">${rects}<text class="mini-txt" x="0" y="${h + 16}">synthetic nights, flagged in amber</text></svg>`;
}
