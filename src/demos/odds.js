import { clamp, escapeHTML, debounce } from "../core/dom.js";
import { rangeHTML, bindRanges, gradId } from "./ui.js";
const TIERS = [
  { name: "Poor", floor: 300 },
  { name: "Fair", floor: 580 },
  { name: "Good", floor: 670 },
  { name: "Very good", floor: 740 },
  { name: "Excellent", floor: 800 }
];
const W = { score: 0.5, util: 0.3, inq: 0.2 };
const RUNWAY = 60;
const FLOOR = 45;
const CEIL = 96;
const PENALTY = 0.12;
const FIT_FLOOR = 0.3;
const ARCHETYPES = [
  { id: "secured", name: "Secured builder", short: "Secured", note: "Deposit-backed starter", tier: 0, maxUtil: 90, maxInq: 8 },
  { id: "student", name: "Student cash back", short: "Student", tier: 1, maxUtil: 50, maxInq: 4 },
  { id: "flat", name: "Flat-rate cash back", short: "Flat", tier: 2, maxUtil: 35, maxInq: 5 },
  { id: "travel", name: "Mid-tier travel", short: "Travel", note: "Issuer applies 5/24", tier: 3, maxUtil: 25, maxInq: 3, fiveTwentyFour: true },
  { id: "premium", name: "Premium travel", short: "Premium", tier: 4, maxUtil: 20, maxInq: 4 },
  { id: "ultra", name: "Ultra-premium travel", short: "Ultra", note: "Issuer applies 5/24", tier: 4, maxUtil: 15, maxInq: 3, fiveTwentyFour: true }
];
function tierOf(score) {
  for (let i = TIERS.length - 1; i >= 0; i--) if (score >= TIERS[i].floor) return i;
  return 0;
}
function evaluate(p, card) {
  const t = tierOf(p.score);
  const reasons = [];
  if (t < card.tier) reasons.push(`Needs ${TIERS[card.tier].name} (${TIERS[card.tier].floor}+); this profile is ${TIERS[t].name}.`);
  if (p.util > card.maxUtil) reasons.push(`Utilization ${p.util}% is over this card's ${card.maxUtil}% ceiling.`);
  if (p.inq > card.maxInq) reasons.push(`${p.inq} recent inquiries; this card tops out at ${card.maxInq}.`);
  if (card.fiveTwentyFour && p.newAccts >= 5) reasons.push(`5/24: ${p.newAccts} new cards in 24 months.`);
  if (reasons.length) return { card, ok: false, prob: 0, fit: 0, reasons };
  const fs = clamp((p.score - TIERS[card.tier].floor) / RUNWAY);
  const fu = clamp((card.maxUtil - p.util) / card.maxUtil);
  const fi = card.maxInq > 0 ? clamp((card.maxInq - p.inq) / card.maxInq) : p.inq === 0 ? 1 : 0;
  const raw = W.score * fs + W.util * fu + W.inq * fi;
  const prob = Math.round((FLOOR + raw * (CEIL - FLOOR)) * 10) / 10;
  const fitMult = Math.max(FIT_FLOOR, 1 - PENALTY * Math.max(0, t - card.tier));
  return { card, ok: true, prob, fit: Math.round(prob * fitMult * 10) / 10, fs, fu, fi, raw, fitMult, reasons };
}
const label = (p) => p >= 85 ? "Strong odds" : p >= 72 ? "Good odds" : p >= 58 ? "Fair odds" : "Long shot";
function mountOdds(root) {
  const state = { score: 712, util: 18, inq: 1, newAccts: 2, rank: "prob" };
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      ${rangeHTML("score", "Credit score", 300, 850, 1, state.score)}
      ${rangeHTML("util", "Utilization", 0, 100, 1, state.util, "%")}
      ${rangeHTML("inq", "Hard inquiries, last 24 months", 0, 10, 1, state.inq)}
      ${rangeHTML("newAccts", "New cards, last 24 months", 0, 10, 1, state.newAccts)}
      <div class="ctl"><span>Rank by</span><span></span>
        <div class="seg" role="group" aria-label="Rank by" style="grid-column: 1 / -1; justify-self: start; margin-top: 6px">
          <button type="button" data-rank="prob" aria-pressed="true">Approval odds</button>
          <button type="button" data-rank="fit" aria-pressed="false">Fit</button>
        </div>
      </div>
    </div>
    <div class="demo__out">
      <div class="odds__tier"><span class="mono">Score tier</span><b data-o="tier"></b><span class="mono" data-o="range"></span></div>
      <div class="odds__rows" data-o="rows"></div>
      <div class="odds__math mono" data-o="math"></div>
      <p class="visually-hidden" aria-live="polite" data-o="live"></p>
    </div>
  </div></div>`;
  const q = (k) => root.querySelector(`[data-o="${k}"]`);
  const rowsEl = q("rows");
  const rows = new Map();
  ARCHETYPES.forEach((c) => {
    const el = document.createElement("div");
    el.className = "odds__row";
    el.innerHTML = `<div class="odds__name">${escapeHTML(c.name)}<small></small></div><div class="bar"><i></i></div><div class="odds__val"></div><div class="odds__why"></div>`;
    rowsEl.append(el);
    rows.set(c.id, el);
  });
  const announce = debounce((txt) => {
    q("live").textContent = txt;
  }, 600);
  function render() {
    const t = tierOf(state.score);
    q("tier").textContent = TIERS[t].name;
    q("range").textContent = `${TIERS[t].floor}–${t < 4 ? TIERS[t + 1].floor - 1 : 850}`;
    const key = state.rank === "fit" ? "fit" : "prob";
    const res = ARCHETYPES.map((c) => evaluate(state, c));
    const ok = res.filter((r) => r.ok).sort((a, b) => b[key] - a[key]);
    const out = res.filter((r) => !r.ok);
    [...ok, ...out].forEach((r, i) => {
      const el = rows.get(r.card.id);
      el.style.order = String(i);
      el.classList.toggle("is-out", !r.ok);
      const v = key === "fit" ? r.fit : r.prob;
      el.querySelector("small").textContent = r.ok ? `${label(r.prob)}${r.card.note ? `. ${r.card.note}` : ""}` : r.card.note || "Out of reach";
      el.querySelector(".bar i").style.setProperty("--w", `${r.ok ? v : 0}%`);
      el.querySelector(".odds__val").textContent = r.ok ? `${v.toFixed(1)}${key === "fit" ? "" : "%"}` : "";
      el.querySelector(".odds__why").textContent = r.reasons.join(" ");
    });
    const top = ok[0];
    q("math").innerHTML = top ? `${escapeHTML(top.card.name)}, the top result:<br>margin = 0.50 × <b>${top.fs.toFixed(2)}</b> score + 0.30 × <b>${top.fu.toFixed(2)}</b> utilization + 0.20 × <b>${top.fi.toFixed(2)}</b> inquiries = <b>${top.raw.toFixed(3)}</b><br>odds = 45 + ${top.raw.toFixed(3)} × (96 − 45) = <b>${top.prob.toFixed(1)}%</b><br>fit = ${top.prob.toFixed(1)} × ${top.fitMult.toFixed(2)} = <b>${top.fit.toFixed(1)}</b>` : "No archetype clears its filters at this profile. Lower utilization or fewer inquiries usually open the most doors.";
    announce(top ? `${ok.length} of 6 archetypes clear their filters. Top: ${top.card.name}, ${top.prob.toFixed(1)} percent.` : "No archetype clears its filters.");
  }
  bindRanges(root, state, render);
  root.querySelectorAll("[data-rank]").forEach((b) => b.addEventListener("click", () => {
    state.rank = b.dataset.rank;
    root.querySelectorAll("[data-rank]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));
  render();
}
function miniOdds(el) {
  const p = { score: 712, util: 18, inq: 1, newAccts: 2 };
  const res = ARCHETYPES.map((c) => evaluate(p, c));
  const g = gradId();
  const bw = 40;
  const gap = 18;
  const H = 170;
  const x0 = 10;
  const bars = res.map((r, i) => {
    const x = x0 + i * (bw + gap);
    const h = r.ok ? r.prob / 100 * H : 0;
    const y = 20 + H - h;
    const body = r.ok ? `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="url(#${g})" opacity="0.9"/><text class="mini-txt" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${r.prob.toFixed(0)}%</text>` : `<rect class="mini-out" x="${x + 0.5}" y="${20 + H - 24}" width="${bw - 1}" height="24"/><text class="mini-txt" x="${x + bw / 2}" y="${20 + H - 30}" text-anchor="middle">out</text>`;
    return `${body}<text class="mini-txt" x="${x + bw / 2}" y="${20 + H + 16}" text-anchor="middle">${r.card.short}</text>`;
  }).join("");
  const width = x0 * 2 + 6 * bw + 5 * gap;
  el.innerHTML = `<svg viewBox="0 0 ${width} ${H + 44}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Approval odds for six card archetypes at a 712 score">
    <defs><linearGradient id="${g}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2E5BFF"/><stop offset="1" stop-color="#00F0FF"/></linearGradient></defs>
    <line x1="0" x2="${width}" y1="${20 + H}" y2="${20 + H}" stroke="rgba(255,255,255,0.16)"/>${bars}
    <text class="mini-txt" x="0" y="8">engine replica, score 712, 18% utilization</text></svg>`;
}
export {
  ARCHETYPES,
  TIERS,
  evaluate,
  label,
  miniOdds,
  mountOdds,
  tierOf
};
