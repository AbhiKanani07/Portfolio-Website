// Transition-graph demo: topics are nodes, transitions are edges, and a
// reinforcement knob shows how a feed that repeats your last topic narrows a
// session. Illustrative probabilities, not real watch history.
import { mulberry32, escapeHTML } from '../core/dom.js';
import { rangeHTML, bindRanges } from './ui.js';

const CATS = ['Tech reviews', 'Coding', 'Gaming', 'Music', 'Sports', 'Finance', 'Comedy'];
const SHORT = ['Tech', 'Code', 'Games', 'Music', 'Sports', 'Finance', 'Comedy'];
const COLORS = ['#00F0FF', '#2E5BFF', '#A9B8FF', '#F1F5FF', '#5FD7E6', '#7D9BFF', '#C8FBFF'];
const INK = ['#05060a', '#f1f5ff', '#05060a', '#05060a', '#05060a', '#05060a', '#05060a'];
const BASE = [
  [0.34, 0.22, 0.12, 0.08, 0.06, 0.12, 0.06],
  [0.2, 0.42, 0.08, 0.1, 0.04, 0.1, 0.06],
  [0.1, 0.06, 0.44, 0.12, 0.08, 0.04, 0.16],
  [0.06, 0.08, 0.12, 0.46, 0.1, 0.04, 0.14],
  [0.06, 0.04, 0.14, 0.1, 0.48, 0.06, 0.12],
  [0.16, 0.1, 0.04, 0.06, 0.06, 0.48, 0.1],
  [0.08, 0.06, 0.16, 0.14, 0.12, 0.06, 0.38],
];

export const biased = (a) => BASE.map((row, i) => row.map((v, j) => (1 - a) * v + (i === j ? a : 0)));
export function stationary(P) {
  let pi = new Array(P.length).fill(1 / P.length);
  for (let k = 0; k < 300; k++) {
    const nx = new Array(P.length).fill(0);
    for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) nx[j] += pi[i] * P[i][j];
    pi = nx;
  }
  return pi;
}
const entropy = (row) => -row.reduce((s, p) => (p > 0 ? s + p * Math.log2(p) : s), 0);
function walk(P, start, steps, rand) {
  const path = [start];
  let cur = start;
  for (let s = 1; s < steps; s++) {
    const r = rand();
    let acc = 0;
    let next = P[cur].length - 1;
    for (let j = 0; j < P[cur].length; j++) { acc += P[cur][j]; if (r < acc) { next = j; break; } }
    path.push(next);
    cur = next;
  }
  return path;
}
const pos = (i, R, cx = 200, cy = 165) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / CATS.length;
  return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, a];
};

export function mountYouTube(root) {
  const state = { alpha: 0.25, cur: 1, seed: 7 };
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      ${rangeHTML('alpha', 'Feed reinforcement', 0, 0.8, 0.05, state.alpha)}
      <p class="demo__foot" style="margin-top:-8px">How strongly the feed repeats whatever was just watched. Zero is the base graph.</p>
      <button class="btn" type="button" data-sim><span>Simulate a 24-video session</span></button>
      <p class="demo__foot">Pick a starting topic on the graph.</p>
    </div>
    <div class="demo__out">
      <div class="yt">
        <svg viewBox="0 0 400 330" data-g role="group" aria-label="Topic transition graph"></svg>
        <div><p class="demo__h" data-h></p><div class="stats" data-stats></div></div>
      </div>
      <p class="demo__h" style="margin-top: 20px">Simulated session</p>
      <div class="yt__session" data-session></div>
      <p class="demo__foot" data-sum></p>
    </div>
  </div></div>`;
  const svgEl = root.querySelector('[data-g]');

  function render() {
    const P = biased(state.alpha);
    const pi = stationary(P);
    const c = state.cur;
    const [cx, cy] = pos(c, 118);
    let edges = '';
    for (let j = 0; j < CATS.length; j++) {
      if (j === c) continue;
      const [x, y] = pos(j, 118);
      const p = P[c][j];
      edges += `<line class="yt__edge" x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke-width="${(0.6 + p * 16).toFixed(2)}" opacity="${Math.min(0.95, 0.16 + p * 1.7).toFixed(2)}"/>`;
    }
    const [lx, ly] = pos(c, 118 - (8 + pi[c] * 44) - 17);
    edges += `<circle class="yt__edge" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="14" stroke-width="${(0.6 + P[c][c] * 10).toFixed(2)}" opacity="${Math.min(0.95, 0.2 + P[c][c]).toFixed(2)}"/>`;
    let nodes = '';
    for (let j = 0; j < CATS.length; j++) {
      const [x, y, a] = pos(j, 118);
      const r = 8 + pi[j] * 44;
      const [tx, ty] = pos(j, 118 + r + 30);
      const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      nodes += `<g class="yt__node${j === c ? ' is-cur' : ''}" data-node="${j}" tabindex="0" role="button" aria-pressed="${j === c}" aria-label="Start from ${CATS[j]}">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>
        <text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="${anchor}">${CATS[j]}</text></g>`;
    }
    svgEl.innerHTML = edges + nodes;
    const stay = P[c][c];
    root.querySelector('[data-h]').textContent = `Starting from ${CATS[c]}`;
    root.querySelector('[data-stats]').innerHTML = [
      [`${(stay * 100).toFixed(0)}%`, 'stays on topic'],
      [`${(1 / (1 - stay)).toFixed(1)}`, 'expected streak'],
      [`${(pi[c] * 100).toFixed(0)}%`, 'long-run share'],
      [`${entropy(P[c]).toFixed(2)} bits`, 'next-step spread'],
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
    const path = walk(P, c, 24, mulberry32(state.seed));
    const runs = [];
    path.forEach((k) => { const last = runs[runs.length - 1]; if (last && last.k === k) last.n += 1; else runs.push({ k, n: 1 }); });
    root.querySelector('[data-session]').innerHTML = runs.map((r) => `<div class="yt__seg" style="flex:${r.n} 1 0; background:${COLORS[r.k]}; color:${INK[r.k]}" title="${CATS[r.k]}, ${r.n} ${r.n === 1 ? 'video' : 'videos'}">${r.n >= 2 ? `${escapeHTML(SHORT[r.k])} ${r.n}` : ''}</div>`).join('');
    const longest = Math.max(...runs.map((r) => r.n));
    root.querySelector('[data-sum]').textContent = `Longest streak: ${longest} ${longest === 1 ? 'video' : 'videos'}${longest >= 5 ? ', a binge' : ''}. Topic switches: ${runs.length - 1} of 23.`;
  }

  svgEl.addEventListener('click', (e) => { const g = e.target.closest('[data-node]'); if (g) { state.cur = Number(g.dataset.node); render(); } });
  svgEl.addEventListener('keydown', (e) => {
    const g = e.target.closest('[data-node]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); state.cur = Number(g.dataset.node); render(); svgEl.querySelector(`[data-node="${state.cur}"]`).focus(); }
  });
  root.querySelector('[data-sim]').addEventListener('click', () => { state.seed += 1; render(); });
  bindRanges(root, state, render);
  render();
}

export function miniYouTube(el) {
  const P = BASE;
  const pi = stationary(P);
  let lines = '';
  for (let i = 0; i < CATS.length; i++) {
    for (let j = i + 1; j < CATS.length; j++) {
      const [x1, y1] = pos(i, 96, 160, 112);
      const [x2, y2] = pos(j, 96, 160, 112);
      const w = (P[i][j] + P[j][i]) / 2;
      lines += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#00F0FF" stroke-width="${(0.4 + w * 9).toFixed(2)}" opacity="${(0.12 + w * 2.2).toFixed(2)}"/>`;
    }
  }
  const dots = CATS.map((c, i) => {
    const [x, y] = pos(i, 96, 160, 112);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(5 + pi[i] * 34).toFixed(1)}" fill="${i === 1 ? '#00F0FF' : '#07080b'}" stroke="${i === 1 ? '#00F0FF' : 'rgba(255,255,255,0.3)'}"/>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 320 234" role="img" aria-label="Illustrative topic transition graph">${lines}${dots}<text class="mini-txt" x="0" y="232">transition graph, illustrative</text></svg>`;
}
