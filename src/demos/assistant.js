import { escapeHTML, debounce } from "../core/dom.js";
import { MODEL } from "../ai/model.js";
const COLORS = { matrix: "#4c6fff", pipelines: "#00f0ff", helix: "#a0a8bc", systems: "#7dd3fc", clusters: "#a78bfa", pass: "#f1f5ff", voxels: "#5eead4", core: "#7b8597" };
const pct = (x) => `${(x * 100).toFixed(1)}%`;
export function miniAssistant(el) {
  const pts = Object.entries(MODEL.map.points).map(([id, [x, y]]) => ({ id, x: 300 + x * 250, y: 138 - y * 118, c: COLORS[(MODEL.topics || {})[id]] || COLORS.core }));
  const links = pts.map((p) => {
    let best = null;
    let bd = Infinity;
    pts.forEach((q) => { if (q === p) return; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = q; } });
    return best ? `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${best.x.toFixed(1)}" y2="${best.y.toFixed(1)}" stroke="rgba(241,245,255,0.12)" stroke-width="1"/>` : "";
  }).join("");
  const dots = pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${p.c}"/>`).join("");
  el.innerHTML = `<svg viewBox="0 0 600 300" role="img" aria-label="The ${pts.length} entries of the record, mapped by meaning">${links}${dots}<text class="mini-txt" x="50" y="294">${pts.length} entries, mapped by meaning with t-SNE</text></svg>`;
}
export function mountAssistant(root, { engine } = {}) {
  if (!engine || !engine.model) { root.innerHTML = '<p class="case__note">The trained models are not loaded on this page.</p>'; return; }
  const samples = ["what is he studying", "is he any good with databases", "what does he play", "how does the credit tool decide", "who should i email"];
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      <label class="field"><span>Ask the models</span><input type="text" maxlength="160" value="${samples[0]}" data-q></label>
      <div class="sb__samples">${samples.map((s) => `<button type="button" class="chip chip--sm" data-s>${escapeHTML(s)}</button>`).join("")}</div>
      <p class="demo__foot" data-meta></p>
    </div>
    <div class="demo__out">
      <p class="demo__h">Intent classifier, top five by probability</p><ol class="pb" data-intent></ol>
      <p class="demo__h">Nearest entries by meaning, cosine similarity</p><ol class="pb" data-sem></ol>
      <p class="demo__h">The full engine answers from</p><p class="pb__final" data-final></p>
    </div>
  </div>
  <dl class="ml__dl pb__card" data-card></dl></div>`;
  const input = root.querySelector("[data-q]");
  const row = (it, final) => `<li class="${it.id === final ? "is-final" : ""}"><span class="pb__t">${escapeHTML(it.title)}</span><span class="pb__bar"><i style="width:${(Math.max(0, it.v) * 100).toFixed(1)}%"></i></span><span class="pb__v mono">${it.v.toFixed(2)}</span></li>`;
  const render = () => {
    const q = input.value.trim();
    const t0 = performance.now();
    const x = engine.explain(q || samples[0]);
    const ms = performance.now() - t0;
    const final = ["answer", "followup"].includes(x.r.route) && x.r.used ? x.r.used[0] : null;
    root.querySelector("[data-intent]").innerHTML = x.intents.length ? x.intents.map((it) => row(it, final)).join("") : '<li class="pb__empty">No words the model knows yet.</li>';
    root.querySelector("[data-sem]").innerHTML = x.neighbors.length ? x.neighbors.map((it) => row(it, final)).join("") : '<li class="pb__empty">No words the model knows yet.</li>';
    const title = final ? (engine.entries.find((e) => e.id === final) || {}).title : null;
    root.querySelector("[data-final]").textContent = title ? title : x.r.route === "multi" ? "several entries, one per part of the question" : `the ${x.r.route} rule, decided before the models`;
    root.querySelector("[data-meta]").textContent = `${(x.r.trace.tokens || []).length} terms after spell-check, scored in ${ms.toFixed(2)} ms in this browser.`;
  };
  const m = engine.model.meta;
  const b = engine.model.blend;
  root.querySelector("[data-card]").innerHTML = [
    ["Training data", `${m.samples.toLocaleString("en-US")} questions generated from the record, ${m.curated} of them written by hand${m.feedback ? `, ${m.feedback} from visitor ratings` : ""}`],
    ["Unseen questions", `${m.humanHeldout} hand-written questions held out of training: keywords alone ${pct(m.humanBaseline)}, with the models ${pct(m.humanLearned)}, classifier alone ${pct(m.humanClassifier)}`],
    ["Regression suite", `${m.suite} edge-case questions routed correctly; a blend that breaks any of them is rejected`],
    ["Blend", `BM25 + ${b.clf} × intent probability + ${b.sem} × semantic similarity`],
    ["Footprint", `${m.kb} KB, ${m.classes} classes, ${m.lsaDims}-dimension LSA, trained ${engine.model.trained}`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  input.addEventListener("input", debounce(render, 60));
  root.querySelectorAll("[data-s]").forEach((btn) => btn.addEventListener("click", () => { input.value = btn.textContent; render(); }));
  render();
}
