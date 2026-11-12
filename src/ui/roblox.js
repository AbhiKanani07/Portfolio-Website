import { $, $$, escapeHTML, debounce } from "../core/dom.js";
import { editDistance, normalize } from "../ai/text.js";
import { SAMPLE } from "../data/roblox-sample.js";
const DAY = 864e5;
const ago = (iso) => {
  if (!iso) return "";
  const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / DAY));
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  if (d < 365) return `${Math.round(d / 30)} ${Math.round(d / 30) === 1 ? "month" : "months"} ago`;
  return `${Math.round(d / 365)} ${Math.round(d / 365) === 1 ? "year" : "years"} ago`;
};
const compact = (n) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
const safeImg = (u) => typeof u === "string" && /^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\//i.test(u) ? u : null;
const words = (s) => normalize(s).split(" ").filter(Boolean);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lastTime = (g) => g.lastPlayed ? new Date(g.lastPlayed).getTime() : 0;
async function loadRoblox() {
  if (window.__ROBLOX__ && Array.isArray(window.__ROBLOX__.games) && window.__ROBLOX__.games.length) return { ...window.__ROBLOX__, real: true };
  try {
    const res = await fetch("roblox.json", { cache: "no-cache" });
    if (res.ok) {
      const j = await res.json();
      if (j && Array.isArray(j.games) && j.games.length) return { ...j, real: true };
    }
  } catch (e) {
  }
  const preview = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === "file:" || new URLSearchParams(location.search).has("debug");
  if (!preview) return { games: [], real: false, sample: false };
  return { ...SAMPLE, real: false, sample: true, games: SAMPLE.games.map((g) => ({ ...g, lastPlayed: g.daysAgo != null ? new Date(Date.now() - g.daysAgo * DAY).toISOString() : null })) };
}
function robloxEntries(data) {
  if (!data.real) return [];
  const recent = data.games.filter((g) => g.recent).sort((a, b) => lastTime(b) - lastTime(a)).slice(0, 6);
  const favs = data.games.filter((g) => g.favorite).slice(0, 8);
  const list = (arr, dated) => arr.map((g) => dated && g.lastPlayed ? `${g.name} (${ago(g.lastPlayed)})` : g.name).join(", ");
  const out = [];
  const fromBadges = data.recentSource === "badges";
  if (recent.length) out.push({ id: "roblox-recent", title: "Recently played on Roblox", href: "#between", topic: "voxels", keywords: `roblox recently played recent games last played playing ${recent.map((g) => g.name).join(" ")}`, short: `Recently played on Roblox: ${list(recent.slice(0, 3))}.`, body: `${fromBadges ? "Based on the newest badges he's earned, his" : "His"} recently played Roblox games are ${list(recent, fromBadges)}. You can search them in the In between section.` });
  if (favs.length) out.push({ id: "roblox-favorites", title: "Favorite Roblox games", href: "#between", topic: "voxels", keywords: `roblox favorite favorites top games best ${favs.map((g) => g.name).join(" ")}`, short: `His favorite Roblox games include ${list(favs.slice(0, 3))}.`, body: `His favorited Roblox games include ${list(favs)}. The In between section searches all of them.` });
  return out;
}
function matchToken(q, toks) {
  let best = 0;
  for (const t of toks) {
    if (t === q) return 1;
    if (q.length >= 2 && t.startsWith(q)) best = Math.max(best, 0.82);
    else if (q.length >= 4 && t.includes(q)) best = Math.max(best, 0.6);
    else if (q.length >= 4) {
      const max = q.length >= 7 ? 2 : 1;
      if (editDistance(q, t.slice(0, q.length + 1), max) <= max || editDistance(q, t, max) <= max) best = Math.max(best, 0.55);
    }
  }
  return best;
}
function initRoblox({ onData } = {}) {
  const root = $("[data-roblox]");
  if (!root) return;
  const input = $("[data-rbx-q]", root);
  const grid = $("[data-rbx-grid]", root);
  const meta = $("[data-rbx-meta]", root);
  const status = $("[data-rbx-status]", root);
  const foot = $("[data-rbx-foot]", root);
  const sort = $("[data-rbx-sort]", root);
  const LIMIT = 8;
  const more = $("[data-rbx-more]", root);
  const state = { q: "", filter: "all", sort: "relevance", all: false };
  let index = [];
  let data = { games: [] };
  const highlight = (name, q) => name.split(/(\s+)/).map((w) => {
    const n = normalize(w);
    const hit = n && q.some((t) => n.startsWith(t) || t.length >= 4 && editDistance(t, n.slice(0, t.length + 1), 1) <= 1);
    return hit ? `<mark>${escapeHTML(w)}</mark>` : escapeHTML(w);
  }).join("");
  function render() {
    const t0 = performance.now();
    const q = words(state.q);
    let rows = [];
    for (const row of index) {
      const g = row.g;
      if (state.filter === "recent" && !g.recent) continue;
      if (state.filter === "favorite" && !g.favorite) continue;
      if (!q.length) {
        rows.push({ g, score: 0 });
        continue;
      }
      let score = 0;
      let all = true;
      for (const t of q) {
        let best = 0;
        for (const [toks, w] of row.fields) best = Math.max(best, matchToken(t, toks) * w);
        if (!best) {
          all = false;
          break;
        }
        score += best;
      }
      if (all) rows.push({ g, score });
    }
    const by = {
      relevance: (a, b) => b.score - a.score || lastTime(b.g) - lastTime(a.g) || Number(b.g.favorite) - Number(a.g.favorite),
      recent: (a, b) => lastTime(b.g) - lastTime(a.g),
      visits: (a, b) => (b.g.visits || 0) - (a.g.visits || 0),
      name: (a, b) => a.g.name.localeCompare(b.g.name)
    }[state.sort];
    rows.sort(by);
    const ms = performance.now() - t0;
    meta.textContent = `${rows.length} ${rows.length === 1 ? "game" : "games"}, ${ms < 0.1 ? "under 0.1" : ms.toFixed(2)} ms`;
    if (!data.games.length) {
      more.hidden = true;
      grid.innerHTML = '<li class="rbx__empty">The library appears here after its first sync from Roblox.</li>';
      return;
    }
    if (!rows.length) {
      more.hidden = true;
      grid.innerHTML = `<li class="rbx__empty">No games match "${escapeHTML(state.q)}". Try a creator or a genre.</li>`;
      return;
    }
    more.hidden = rows.length <= LIMIT;
    more.firstElementChild.textContent = state.all ? "Show fewer" : `Show all ${rows.length}`;
    grid.innerHTML = (state.all ? rows : rows.slice(0, LIMIT)).map(({ g }) => {
      const img = safeImg(g.icon);
      const hue = 185 + [...g.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 50;
      const initials = g.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      const art = img ? `<img src="${escapeHTML(img)}" alt="" loading="lazy" decoding="async" width="150" height="150">` : `<span class="rbx__glyph" style="--h:${hue}" aria-hidden="true">${escapeHTML(initials)}</span>`;
      const tags = [g.recent && g.lastPlayed ? `played ${ago(g.lastPlayed)}` : "", g.favorite ? "favorite" : "", g.pick ? "top pick" : "", g.visits ? `${compact(g.visits)} visits` : ""].filter(Boolean).map((x) => `<span>${x}</span>`).join("");
      const inner = `<span class="rbx__art">${art}</span><span class="rbx__name">${highlight(g.name, q)}</span><span class="rbx__by">${escapeHTML(g.creator || "Unknown creator")}${g.genre ? `, ${escapeHTML(g.genre)}` : ""}</span><span class="rbx__tags mono">${tags}</span>`;
      return g.url ? `<li class="rbx__tile"><a href="${escapeHTML(g.url)}" target="_blank" rel="noopener">${inner}</a></li>` : `<li class="rbx__tile"><div>${inner}</div></li>`;
    }).join("");
  }
  more.addEventListener("click", () => {
    state.all = !state.all;
    render();
    if (!state.all) root.scrollIntoView({ block: "nearest" });
  });
  const later = debounce(() => {
    state.q = input.value.trim();
    state.all = false;
    render();
  }, 60);
  input.addEventListener("input", later);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      state.q = "";
      render();
    }
    if (e.key === "ArrowDown") {
      const first = grid.querySelector("a");
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  $("[data-rbx-form]", root).addEventListener("submit", (e) => {
    e.preventDefault();
    const first = grid.querySelector("a");
    if (first) first.focus();
  });
  $$("[data-rbx-filter]", root).forEach((b) => b.addEventListener("click", () => {
    state.filter = b.dataset.rbxFilter;
    $$("[data-rbx-filter]", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));
  sort.addEventListener("change", () => {
    state.sort = sort.value;
    render();
  });
  loadRoblox().then((d) => {
    data = d;
    index = d.games.map((g) => ({ g, fields: [[words(g.name), 3], [words(g.creator || ""), 1.5], [words(g.genre || ""), 1.2]] }));
    const rec = d.games.filter((g) => g.recent).length;
    const fav = d.games.filter((g) => g.favorite).length;
    const recBtn = $('[data-rbx-filter="recent"]', root);
    if (recBtn) recBtn.hidden = !rec;
    if (d.real) {
      const counts = [rec ? `${rec} recently played` : "", fav ? `${fav} favorites` : ""].filter(Boolean).join(", ");
      status.textContent = `Synced ${ago(d.updated)} from Roblox${counts ? `. ${cap(counts)}.` : "."}`;
      foot.textContent = [d.recentSource === "badges" ? "Recently played comes from the newest badges he's earned, read through Roblox Open Cloud." : d.recentSource === "manual" ? "Recently played is listed by Abhi." : "", fav ? "Favorites come from his Roblox favorites." : ""].filter(Boolean).join(" ");
    } else if (d.sample) {
      status.textContent = "Sample data. His real library appears after the first sync.";
      status.classList.add("is-sample");
      foot.textContent = "These sample games are invented. After a sync, recently played comes from his newest Roblox badges and favorites from his Roblox favorites.";
    } else {
      status.textContent = "Syncing soon.";
    }
    render();
    if (onData) onData(d);
  });
}
export {
  initRoblox,
  loadRoblox,
  robloxEntries
};
