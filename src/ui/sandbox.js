// The engine behind the hologram, opened up as a node graph. Stages can be
// dragged (pointer or arrow keys) on springs; controls feed the same engine
// the hero uses; a packet travels each wire as the stages run.
import { $, $$, clamp, escapeHTML, observeResize, debounce, wait } from '../core/dom.js';
import { Spring, driver, ticker } from '../core/spring.js';
import { motion } from '../core/motion.js';
import { DEFAULTS } from '../ai/engine.js';

const NS = 'http://www.w3.org/2000/svg';
const ORDER = ['parse', 'route', 'retrieve', 'guard', 'compose'];
const EARLY = new Set(['empty', 'language', 'injection', 'abuse', 'greeting', 'thanks', 'help', 'assistant', 'identity', 'name', 'comparison', 'private', 'confidential', 'task', 'time', 'duration', 'followup', 'skill', 'flagship', 'unknown-term']);
const DECLINED = new Set(['private', 'confidential', 'injection', 'comparison', 'abuse', 'task']);

export function initSandbox({ engine }) {
  const root = $('[data-sandbox]');
  if (!root) return;
  const graph = $('[data-sb-graph]', root);
  const wires = $('[data-sb-wires]', root);
  const input = $('[data-sb-input]', root);
  const answer = $('[data-sb-answer]', root);
  const traceBody = $('[data-sb-trace]', root);
  const params = { ...DEFAULTS };
  const nodes = $$('.node', graph).map((el) => ({
    el, id: el.dataset.node, head: $('.node__head', el), out: $('[data-out]', el), state: $('[data-state]', el),
    fx: Number(el.dataset.x), fy: Number(el.dataset.y),
    x: new Spring(0, { stiffness: 380, damping: 37 }), y: new Spring(0, { stiffness: 380, damping: 37 }),
  }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const paths = ORDER.slice(0, -1).map(() => { const p = document.createElementNS(NS, 'path'); wires.append(p); return p; });
  let W = 0;
  let H = 0;
  let stacked = false;
  let token = 0;

  const place = () => nodes.forEach((n) => { n.el.style.transform = stacked ? '' : `translate3d(${n.x.value.toFixed(1)}px, ${n.y.value.toFixed(1)}px, 0)`; });
  const box = (n) => ({ x: n.x.value, y: n.y.value, w: n.el.offsetWidth, h: n.el.offsetHeight });

  function drawWires() {
    if (stacked) return;
    ORDER.slice(0, -1).forEach((id, i) => {
      const A = box(byId[id]);
      const B = box(byId[ORDER[i + 1]]);
      let d;
      if (B.y - (A.y + A.h) > 20 || A.y - (B.y + B.h) > 20) {
        const down = B.y > A.y;
        const x1 = A.x + A.w / 2; const y1 = down ? A.y + A.h : A.y;
        const x2 = B.x + B.w / 2; const y2 = down ? B.y : B.y + B.h;
        const dy = Math.max(30, Math.abs(y2 - y1) * 0.55) * (down ? 1 : -1);
        d = `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
      } else if (B.x >= A.x) {
        const x1 = A.x + A.w; const y1 = A.y + 24; const x2 = B.x; const y2 = B.y + 24;
        const dx = Math.max(24, (x2 - x1) * 0.5);
        d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
      } else {
        const x1 = A.x; const y1 = A.y + 24; const x2 = B.x + B.w; const y2 = B.y + 24;
        const dx = Math.max(24, (x1 - x2) * 0.5);
        d = `M${x1},${y1} C${x1 - dx},${y1} ${x2 + dx},${y2} ${x2},${y2}`;
      }
      paths[i].setAttribute('d', d);
    });
  }

  const anim = driver(nodes.flatMap((n) => [n.x, n.y]), () => { place(); drawWires(); });

  function layout() {
    const r = graph.getBoundingClientRect();
    W = r.width;
    H = r.height;
    const nowStacked = W < 700;
    if (nowStacked !== stacked) { stacked = nowStacked; graph.classList.toggle('is-stacked', stacked); }
    if (stacked) { place(); return; }
    const g = graph.getBoundingClientRect();
    W = g.width;
    H = g.height;
    nodes.forEach((n) => {
      const w = n.el.offsetWidth;
      const h = n.el.offsetHeight;
      n.x.jump(clamp(n.fx * W, 8, Math.max(8, W - w - 8)));
      n.y.jump(clamp(n.fy * H, 8, Math.max(8, H - h - 8)));
    });
    wires.setAttribute('viewBox', `0 0 ${W} ${H}`);
    place();
    drawWires();
  }

  // Dragging, with the drop remembered as a fraction so resizes keep the layout.
  nodes.forEach((n) => {
    let start = null;
    const move = (tx, ty) => {
      const w = n.el.offsetWidth;
      const h = n.el.offsetHeight;
      n.x.set(clamp(tx, 4, W - w - 4));
      n.y.set(clamp(ty, 4, H - h - 4));
      n.fx = n.x.target / W;
      n.fy = n.y.target / H;
      anim.kick();
    };
    n.head.addEventListener('pointerdown', (e) => {
      if (stacked || e.button !== 0) return;
      e.preventDefault();
      n.head.setPointerCapture(e.pointerId);
      start = { px: e.clientX, py: e.clientY, x: n.x.target, y: n.y.target };
      n.el.classList.add('is-dragging');
    });
    n.head.addEventListener('pointermove', (e) => { if (start) move(start.x + e.clientX - start.px, start.y + e.clientY - start.py); });
    const end = () => { start = null; n.el.classList.remove('is-dragging'); };
    n.head.addEventListener('pointerup', end);
    n.head.addEventListener('pointercancel', end);
    n.head.addEventListener('keydown', (e) => {
      if (stacked) return;
      const step = e.shiftKey ? 48 : 16;
      const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!k) return;
      e.preventDefault();
      move(n.x.target + k[0], n.y.target + k[1]);
    });
  });

  function outputs(r) {
    const t = r.trace;
    const early = EARLY.has(r.route);
    const words = r.text.split(/\s+/).filter(Boolean).length;
    return {
      parse: { state: 'done', html: `${(t.corrections || []).map(([a, b]) => `corrected ${escapeHTML(a)} to ${escapeHTML(b)}<br>`).join('')}${t.tokens.length ? `terms: ${t.tokens.map(escapeHTML).join(', ')}${t.expanded && t.expanded.length ? `<br>plus ${t.expanded.length} synonyms` : ''}` : 'no content words'}` },
      route: { state: early ? r.route : r.route === 'multi' ? 'split' : 'search', html: r.route === 'multi' ? `split into ${t.segments.length} parts: ${t.segments.map(escapeHTML).join(', ')}` : early ? `${escapeHTML(r.route)}${DECLINED.has(r.route) ? ', declined' : ''}` : 'about Abhi: search the record' },
      retrieve: early ? { state: 'skipped', html: 'skipped: the route answered first' } : { state: 'done', html: t.candidates.length ? `best: ${escapeHTML(t.candidates[0].title)}<br>match ${t.candidates[0].match.toFixed(2)}, kept ${t.kept.length} of ${engine.size}` : `nothing matched, 0 of ${engine.size}` },
      guard: { state: DECLINED.has(r.route) || ['not-found', 'offtopic', 'gibberish'].includes(r.route) ? 'held' : 'pass', html: escapeHTML(t.decision) },
      compose: { state: 'done', html: `${words} words, ${r.sources.length} ${r.sources.length === 1 ? 'source' : 'sources'}${params.cite ? '' : ', citations off'}` },
    };
  }
  const setNode = (n, o) => { n.state.textContent = o.state; n.out.innerHTML = o.html; };

  function preview(r) {
    const t = r.trace;
    answer.innerHTML = '<p class="qa__a"></p><div class="qa__src"></div><p class="meta mono"></p>';
    $('.qa__a', answer).textContent = r.text;
    $('.qa__src', answer).innerHTML = r.sources.length ? `<span class="mono">Sources</span>${r.sources.map((s) => `<span class="chip chip--sm">${escapeHTML(s.title)}</span>`).join('')}` : '';
    $('.meta', answer).innerHTML = `<span>route ${escapeHTML(r.route)}</span><span>confidence ${r.confidence.toFixed(2)}</span><span>${t.ms.toFixed(2)} ms</span>`;
    traceBody.innerHTML = t.candidates.length
      ? t.candidates.slice(0, 6).map((c) => `<tr><td>${escapeHTML(c.title)}</td><td class="num">${c.score.toFixed(2)}</td><td><div class="bar"><i style="--w:${(c.match * 100).toFixed(0)}%"></i></div></td><td class="${c.status === 'kept' ? 'st-kept' : 'st-drop'}">${c.status}</td></tr>`).join('')
      : '<tr><td colspan="4" style="color: var(--ink-3)">The route answered before retrieval, so nothing was scored.</td></tr>';
  }

  function packet(path, ms) {
    return new Promise((resolve) => {
      const len = path.getTotalLength ? path.getTotalLength() : 0;
      if (!len) { resolve(); return; }
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '3.2');
      wires.append(dot);
      path.classList.add('is-hot');
      let t = 0;
      ticker.add((dt) => {
        t += (dt * 1000) / ms;
        const p = path.getPointAtLength(Math.min(1, t) * len);
        dot.setAttribute('cx', p.x.toFixed(1));
        dot.setAttribute('cy', p.y.toFixed(1));
        if (t < 1) return true;
        dot.remove();
        setTimeout(() => path.classList.remove('is-hot'), 260);
        resolve();
        return false;
      });
    });
  }

  async function run(flow) {
    token += 1;
    const mine = token;
    const r = engine.ask(input.value.trim() || 'Is Bravox accurate?', params);
    const o = outputs(r);
    nodes.forEach((n) => n.el.classList.remove('is-active'));
    if (!flow || motion.reduced || stacked) { nodes.forEach((n) => setNode(n, o[n.id])); preview(r); return; }
    nodes.forEach((n) => { n.state.textContent = 'waiting'; n.out.textContent = ''; });
    for (let i = 0; i < ORDER.length; i++) {
      if (mine !== token) return;
      const n = byId[ORDER[i]];
      n.el.classList.add('is-active');
      setNode(n, o[n.id]);
      await wait(200);
      if (mine !== token) return;
      if (i < paths.length) await packet(paths[i], 340);
      n.el.classList.remove('is-active');
    }
    if (mine === token) preview(r);
  }

  const rerun = debounce(() => run(false), 40);
  $$('[data-param]', root).forEach((ctl) => {
    const out = root.querySelector(`[data-param-out="${ctl.dataset.param}"]`);
    const sync = () => {
      const v = ctl.type === 'checkbox' ? ctl.checked : Number(ctl.value);
      params[ctl.dataset.param] = v;
      if (out) out.textContent = ctl.type === 'checkbox' ? '' : (ctl.step.includes('.') ? Number(ctl.value).toFixed(2) : String(ctl.value));
      if (ctl.type === 'range') ctl.style.setProperty('--p', `${((ctl.value - ctl.min) / (ctl.max - ctl.min)) * 100}%`);
    };
    sync();
    ctl.addEventListener('input', () => { sync(); rerun(); });
    ctl.addEventListener('change', () => { sync(); rerun(); });
  });
  $('[data-sb-form]', root).addEventListener('submit', (e) => { e.preventDefault(); run(true); });
  $$('[data-sb-sample]', root).forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; run(true); }));

  layout();
  observeResize(graph, layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { io.disconnect(); run(true); }
  }, { threshold: 0.35 });
  io.observe(graph);
}
