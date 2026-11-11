// Entry point. Wires the hologram, the answer engine, and the page together.
import { $, $$ } from './core/dom.js';
import { KB } from './ai/knowledge.js';
import { createEngine } from './ai/engine.js';
import { pickDriver } from './ai/drivers.js';
import { Hologram, StillHologram } from './hologram/hologram.js';
import { initAnnotations } from './hologram/annotations.js';
import { initNav } from './ui/nav.js';
import { initCommandBar } from './ui/commandbar.js';
import { initBento } from './ui/bento.js';
import { initDrawer } from './ui/drawer.js';
import { initReveal } from './ui/reveal.js';
import { initMagnetic } from './ui/magnetic.js';
import { initSandbox } from './ui/sandbox.js';
import { initPalette } from './ui/palette.js';
import { initDock } from './ui/dock.js';
import { runBoot } from './ui/boot.js';
import { initRoblox, robloxEntries } from './ui/roblox.js';
import { initPointer } from './ui/pointer.js';
import { mountDemo } from './demos/index.js';

function readoutsAPI() {
  const map = new Map($$('[data-ro]').map((el) => [el.dataset.ro, el]));
  return { set(key, value) { const el = map.get(key); if (el && el.textContent !== value) el.textContent = value; } };
}

function boot() {
  window.__booted = true;
  const hero = $('.hero');
  const canvas = $('[data-holo]');
  const slot = $('[data-holo-slot]');
  const readouts = readoutsAPI();
  const nav = initNav();
  const onStats = (s) => {
    nav.setStats(s);
    readouts.set('mode', s.mode);
    readouts.set('topic', s.topic);
    readouts.set('freq', s.freq.toFixed(2));
    readouts.set('disp', s.disp.toFixed(2));
    readouts.set('points', s.points.toLocaleString('en-US'));
  };

  let holo = new Hologram(canvas, { slot, interaction: hero, onStats });
  const gl = holo.init();
  if (!gl) {
    holo = new StillHologram(hero, slot, onStats);
    holo.init();
  } else {
    holo.sync();
    initAnnotations(holo, { root: hero, slot });
  }

  const t0 = performance.now();
  const engine = createEngine(KB);
  const indexMs = performance.now() - t0;
  const meta = document.querySelector('meta[name="ask-endpoint"]');
  const driver = pickDriver(KB, { endpoint: meta ? meta.content.trim() : '' });
  const bar = initCommandBar({ engine, driver, holo, readouts });
  initBento();
  const drawer = initDrawer({
    onOpen: (id, article) => { holo.cover(true); $$('[data-demo]', article).forEach(mountDemo); initMagnetic(article); },
    onClose: () => holo.cover(false),
  });
  let palette = null;
  const dock = initDock({ hero, onOpen: () => palette && palette.show() });
  palette = initPalette({ engine, driver, holo, drawer, dock });
  initSandbox({ engine });
  initRoblox({ onData: (data) => { const extra = robloxEntries(data); if (extra.length) { engine.extend(extra); readouts.set('entries', String(engine.size)); } } });
  initReveal();
  initMagnetic();
  initPointer();

  const info = holo.bootInfo || {};
  runBoot({
    gl, contextMs: info.contextMs || 0, compileMs: info.compileMs || 0, points: info.points || 0,
    entries: engine.size, terms: engine.terms, indexMs, engine: driver.name,
    w: window.innerWidth, h: window.innerHeight, dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
  }, () => bar.startIntro());

  window.addEventListener('pagehide', (e) => { if (!e.persisted) holo.destroy(); });
  if (new URLSearchParams(location.search).has('debug')) window.__portfolio = { holo, engine, driver, palette, drawer };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
