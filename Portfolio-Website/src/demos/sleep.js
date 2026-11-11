// Twelve weeks of synthetic nights in the shape of a Fitbit export, the same
// approach the real project uses for safe demos. Habits move the data; a
// z-score threshold decides which nights are unusual enough to flag.
import { mulberry32, gauss, clamp } from '../core/dom.js';
import { rangeHTML, bindRanges, ramp } from './ui.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function generateNights({ consistency, screen }, seed = 7) {
  const rand = mulberry32(seed);
  const nights = [];
  for (let d = 0; d < 84; d++) {
    const weekday = d % 7;
    const weekend = weekday >= 5;
    const shift = Math.abs(gauss(rand) * consistency + (weekend ? consistency * 0.8 : 0));
    const screenMin = Math.max(0, screen + gauss(rand) * 15);
    let duration = 7.7 - shift * 0.012 - screenMin * 0.006 + gauss(rand) * 0.35;
    const deep = clamp(0.19 - screenMin * 0.0004 - shift * 0.0003 + gauss(rand) * 0.02, 0.06, 0.3);
    let hrv = 58 - shift * 0.05 - screenMin * 0.03 + gauss(rand) * 5;
    let rhr = 54 + shift * 0.02 + gauss(rand) * 2;
    if (rand() < 0.04) { rhr += 9 + rand() * 6; duration -= 1.2; hrv -= 14; }
    nights.push({ d, weekday, week: Math.floor(d / 7), duration: clamp(duration, 3.5, 9.8), deep, hrv, rhr });
  }
  return nights;
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a, m) => Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));

export function analyzeNights(nights, z) {
  const dur = nights.map((n) => n.duration);
  const rhr = nights.map((n) => n.rhr);
  const md = mean(dur); const sdd = sd(dur, md);
  const mr = mean(rhr); const sdr = sd(rhr, mr);
  nights.forEach((n) => {
    n.zr = (n.rhr - mr) / sdr;
    n.zd = (md - n.duration) / sdd;
    n.flag = n.zr > z || n.zd > z;
    n.good = n.duration >= 7 && n.deep >= 0.15;
  });
  return { md, hrv: mean(nights.map((n) => n.hrv)), good: nights.filter((n) => n.good).length / nights.length, flagged: nights.filter((n) => n.flag) };
}
const hm = (h) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;

export function mountSleep(root) {
  const state = { consistency: 35, screen: 45, z: 2.2 };
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      ${rangeHTML('consistency', 'Bedtime drift, typical', 5, 120, 5, state.consistency, ' min')}
      ${rangeHTML('screen', 'Screen time after 10 pm', 0, 150, 5, state.screen, ' min')}
      ${rangeHTML('z', 'Flag nights beyond', 1.5, 3.5, 0.1, state.z, 'σ')}
      <p class="demo__foot">Flags mark nights for follow-up. They are not a diagnosis.</p>
    </div>
    <div class="demo__out">
      <p class="demo__h">Sleep duration by night, twelve weeks</p>
      <div class="heat" data-heat style="grid-template-columns: 30px repeat(12, minmax(0, 1fr))"></div>
      <div class="legend"><span><i></i>shorter to longer</span><span><i class="key-flag"></i>flagged</span></div>
      <div class="stats" data-stats style="margin-top: 18px"></div>
      <ul class="flags" data-flags></ul>
    </div>
  </div></div>`;
  const heat = root.querySelector('[data-heat]');

  function render() {
    const nights = generateNights(state);
    const a = analyzeNights(nights, state.z);
    let html = '<span></span>';
    for (let w = 0; w < 12; w++) html += `<span class="heat__lab heat__lab--top">${w % 2 === 0 ? `W${w + 1}` : ''}</span>`;
    for (let d = 0; d < 7; d++) {
      html += `<span class="heat__lab">${DAYS[d]}</span>`;
      for (let w = 0; w < 12; w++) {
        const n = nights[w * 7 + d];
        html += `<span class="heat__cell${n.flag ? ' is-flag' : ''}" style="--c:${ramp((n.duration - 4.5) / 4)}" title="Week ${w + 1}, ${DAYS[d]}: ${hm(n.duration)}"></span>`;
      }
    }
    heat.innerHTML = html;
    root.querySelector('[data-stats]').innerHTML = [
      [hm(a.md), 'average sleep'], [`${Math.round(a.good * 100)}%`, 'good nights'],
      [`${a.hrv.toFixed(0)} ms`, 'average HRV'], [String(a.flagged.length), 'flagged nights'],
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
    const top = a.flagged.slice().sort((x, y) => Math.max(y.zr, y.zd) - Math.max(x.zr, x.zd)).slice(0, 4);
    root.querySelector('[data-flags]').innerHTML = top.length
      ? top.map((n) => `<li><span>${n.zr >= n.zd ? `+${n.zr.toFixed(1)}σ` : `−${n.zd.toFixed(1)}σ`}</span>Week ${n.week + 1}, ${DAYS[n.weekday]}: ${n.zr >= n.zd ? 'resting heart rate unusually high' : 'unusually short night'}</li>`).join('')
      : '<li>No nights cross this threshold.</li>';
  }
  bindRanges(root, state, render);
  render();
}

export function miniSleep(el) {
  const nights = generateNights({ consistency: 35, screen: 45 });
  analyzeNights(nights, 2.2);
  const s = 18;
  const g = 3;
  let rects = '';
  nights.forEach((n) => {
    const x = n.week * (s + g);
    const y = n.weekday * (s + g);
    rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${ramp((n.duration - 4.5) / 4)}"${n.flag ? ' stroke="#ffb020" stroke-width="1.5"' : ''}/>`;
  });
  const w = 12 * (s + g) - g;
  const h = 7 * (s + g) - g;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h + 20}" role="img" aria-label="Synthetic twelve-week sleep heatmap">${rects}<text class="mini-txt" x="0" y="${h + 16}">synthetic nights, flagged in amber</text></svg>`;
}
