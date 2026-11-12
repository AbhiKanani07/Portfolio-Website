import { mulberry32, gauss, clamp, escapeHTML, rangeHTML, bindRanges } from "./shared.js";
const N = 4e3;
const DIMS = 16;
const TOPICS = ["Coding", "Tech reviews", "Finance", "Sports", "Music", "Gaming"];
const PHRASES = {
  Coding: ["Async Python, explained", "A REST API in one sitting", "SQL window functions in practice", "Designing a cache layer", "TypeScript generics, gently", "Profiling a slow endpoint"],
  "Tech reviews": ["A week with a folding phone", "Budget laptop showdown", "Mechanical keyboards, ranked", "Is this camera worth it?", "Noise-canceling headphones compared", "A tiny PC build"],
  Finance: ["Index funds in ten minutes", "How credit scores actually work", "Budgeting on a student income", "Reading an earnings report", "What a yield curve says", "Roth versus traditional"],
  Sports: ["Every goal from the weekend", "Film breakdown: the final drive", "Training like a sprinter", "Top plays of the month", "The tactics behind the upset", "Rookie season review"],
  Music: ["Beats to focus to", "Producing a track from scratch", "Live session in the studio", "The story behind the album", "Guitar tone, demystified", "An a cappella cover"],
  Gaming: ["Speedrun record attempt", "Patch notes, explained", "The hardest boss, solved", "Building a city in one hour", "Retro console restoration", "Indie games worth your time"]
};
const PROFILES = {
  coding: { label: "Mostly coding", mix: [1, 0.5, 0.25, 0, 0.1, 0.15] },
  sports: { label: "Sports and music", mix: [0.05, 0.1, 0, 1, 0.7, 0.2] },
  finance: { label: "Finance and tech", mix: [0.2, 0.6, 1, 0.05, 0.05, 0] }
};
let CAT = null;
function catalog() {
  if (CAT) return CAT;
  const rand = mulberry32(424242);
  const vec = new Float32Array(N * DIMS);
  const meta = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = Math.floor(rand() * 6);
    const t2 = Math.floor(rand() * 6);
    let norm = 0;
    for (let d = 0; d < DIMS; d++) {
      const v = d < 6 ? (d === t ? 1 : d === t2 ? 0.35 : 0) + gauss(rand) * 0.08 : gauss(rand) * 0.22;
      vec[i * DIMS + d] = v;
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    for (let d = 0; d < DIMS; d++) vec[i * DIMS + d] /= norm;
    const ph = PHRASES[TOPICS[t]];
    meta[i] = { title: `${ph[Math.floor(rand() * ph.length)]}, part ${1 + Math.floor(rand() * 9)}`, topic: TOPICS[t], wtr: clamp(0.4 + gauss(rand) * 0.18), likes: clamp(0.55 + gauss(rand) * 0.18), days: Math.floor(rand() * 365) };
  }
  CAT = { vec, meta };
  return CAT;
}
function rank(profile, w, k = 8) {
  const { vec, meta } = catalog();
  const mix = PROFILES[profile].mix;
  const p = new Float32Array(DIMS);
  const pn = Math.sqrt(mix.reduce((s, x) => s + x * x, 0));
  mix.forEach((x, d) => {
    p[d] = x / pn;
  });
  const top = [];
  for (let i = 0; i < N; i++) {
    let dot = 0;
    const o = i * DIMS;
    for (let d = 0; d < DIMS; d++) dot += p[d] * vec[o + d];
    const m = meta[i];
    const sim = w.sim * Math.max(0, dot);
    const eng = w.eng * (0.6 * m.wtr + 0.4 * m.likes);
    const fresh = w.fresh * Math.exp(-m.days / 45);
    const s = sim + eng + fresh;
    if (top.length < k || s > top[top.length - 1].s) {
      top.push({ i, s, sim, eng, fresh });
      top.sort((a, b) => b.s - a.s);
      if (top.length > k) top.pop();
    }
  }
  return top.map((t) => ({ ...t, ...meta[t.i] }));
}
function mountYouTube(root) {
  const state = { profile: "coding", sim: 0.6, eng: 0.3, fresh: 0.1 };
  const cache = new Map();
  let requests = 0;
  let hits = 0;
  let lastKey = "";
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      <div class="ctl"><span>Viewer</span><span></span><div class="seg" role="group" aria-label="Viewer profile" style="grid-column: 1 / -1; justify-self: start; margin-top: 6px; flex-wrap: wrap">${Object.entries(PROFILES).map(([k, p]) => `<button type="button" data-profile="${k}" aria-pressed="${k === state.profile}">${p.label}</button>`).join("")}</div></div>
      ${rangeHTML("sim", "Content similarity weight", 0, 1, 0.05, state.sim)}
      ${rangeHTML("eng", "Engagement weight", 0, 1, 0.05, state.eng)}
      ${rangeHTML("fresh", "Freshness weight", 0, 1, 0.05, state.fresh)}
      <button class="btn" type="button" data-repeat><span>Send the same request again</span></button>
    </div>
    <div class="demo__out">
      <div class="rk__req mono" data-req></div>
      <div class="rk__legend mono"><span><i class="s"></i>similarity</span><span><i class="e"></i>engagement</span><span><i class="f"></i>freshness</span></div>
      <ol class="rk__list" data-list></ol>
      <div class="stats" data-stats style="margin-top: 16px"></div>
    </div>
  </div></div>`;
  const list = root.querySelector("[data-list]");
  catalog();
  function request() {
    const key = `GET /rank?viewer=${state.profile}&sim=${state.sim.toFixed(2)}&eng=${state.eng.toFixed(2)}&fresh=${state.fresh.toFixed(2)}`;
    lastKey = key;
    requests += 1;
    const t0 = performance.now();
    let res = cache.get(key);
    const hit = !!res;
    if (hit) {
      hits += 1;
      cache.delete(key);
      cache.set(key, res);
    } else {
      res = rank(state.profile, state);
      cache.set(key, res);
      if (cache.size > 32) cache.delete(cache.keys().next().value);
    }
    const ms = performance.now() - t0;
    root.querySelector("[data-req]").innerHTML = `<span>${escapeHTML(key)}</span><span class="rk__status ${hit ? "hit" : "miss"}">${hit ? "cache hit" : "cache miss"}</span><span>${ms < 0.1 ? "under 0.1" : ms.toFixed(2)} ms</span>`;
    const max = res[0] ? res[0].s : 1;
    list.innerHTML = res.map((r, n) => `<li class="rk__row"><span class="rk__n">${n + 1}</span><span class="rk__t">${escapeHTML(r.title)}<small>${r.topic}, ${r.days} ${r.days === 1 ? "day" : "days"} old</small></span><span class="rk__stack" title="similarity ${r.sim.toFixed(2)}, engagement ${r.eng.toFixed(2)}, freshness ${r.fresh.toFixed(2)}"><i class="s" style="width:${(r.sim / max * 100).toFixed(1)}%"></i><i class="e" style="width:${(r.eng / max * 100).toFixed(1)}%"></i><i class="f" style="width:${(r.fresh / max * 100).toFixed(1)}%"></i></span><span class="rk__score">${r.s.toFixed(3)}</span></li>`).join("");
    root.querySelector("[data-stats]").innerHTML = [
      [N.toLocaleString("en-US"), "videos scored"],
      [String(DIMS), "vector dimensions"],
      [String(cache.size), "cached responses"],
      [`${Math.round(hits / requests * 100)}%`, "cache hit rate"]
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
  }
  root.querySelectorAll("[data-profile]").forEach((b) => b.addEventListener("click", () => {
    state.profile = b.dataset.profile;
    root.querySelectorAll("[data-profile]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    request();
  }));
  root.querySelector("[data-repeat]").addEventListener("click", request);
  bindRanges(root, state, request);
  request();
  return { lastKey: () => lastKey };
}
function miniYouTube(el) {
  const res = rank("coding", { sim: 0.6, eng: 0.3, fresh: 0.1 }, 6);
  const max = res[0].s;
  const rows = res.map((r, i) => {
    const y = 14 + i * 28;
    const x0 = 250;
    const span = 330;
    const ws = r.sim / max * span;
    const we = r.eng / max * span;
    const wf = r.fresh / max * span;
    const t = r.title.length > 34 ? `${r.title.slice(0, 33)}…` : r.title;
    return `<text class="mini-txt" x="0" y="${y + 9}">${i + 1}  ${escapeHTML(t)}</text><rect x="${x0}" y="${y}" width="${ws.toFixed(1)}" height="10" fill="#00f0ff"/><rect x="${(x0 + ws).toFixed(1)}" y="${y}" width="${we.toFixed(1)}" height="10" fill="#2e5bff"/><rect x="${(x0 + ws + we).toFixed(1)}" y="${y}" width="${wf.toFixed(1)}" height="10" fill="rgba(241,245,255,0.55)"/>`;
  }).join("");
  el.innerHTML = `<svg viewBox="0 0 600 196" role="img" aria-label="Top six ranked videos for a coding-heavy viewer">${rows}<text class="mini-txt" x="0" y="194">ranked from 4,000 synthetic videos in your browser: similarity, engagement, freshness</text></svg>`;
}
export {
  miniYouTube,
  mountYouTube,
  rank
};
