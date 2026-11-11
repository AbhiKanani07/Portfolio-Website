// Entry point. Wires the hologram, the answer engine, and the page together.
import { $, $$ } from './core/dom.js';
import { KB } from './ai/knowledge.js';
import { createEngine } from './ai/engine.js';
import { pickDriver } from './ai/drivers.js';
import { Hologram, StillHologram } from './hologram/hologram.js';
import { initNav } from './ui/nav.js';
import { initCommandBar } from './ui/commandbar.js';
import { initBento } from './ui/bento.js';
import { initDrawer } from './ui/drawer.js';
import { initReveal } from './ui/reveal.js';
import { initMagnetic } from './ui/magnetic.js';
import { initSandbox } from './ui/sandbox.js';
import { mountDemo } from './demos/index.js';

function readoutsAPI() {
  const map = new Map($$('[data-ro]').map((el) => [el.dataset.ro, el]));
  return { set(key, value) { const el = map.get(key); if (el && el.textContent !== value) el.textContent = value; } };
}

function boot() {
  const hero = $('.hero');
  const canvas = $('[data-holo]');
  const slot = $('[data-holo-slot]');
  const readouts = readoutsAPI();
  const nav = initNav();
  const onStats = (s) => {
    nav.setStats(s);
    readouts.set('mode', s.mode);
    readouts.set('freq', s.freq.toFixed(2));
    readouts.set('disp', s.disp.toFixed(2));
    readouts.set('points', s.points.toLocaleString('en-US'));
  };

  let holo = new Hologram(canvas, { slot, interaction: hero, onStats });
  if (!holo.init()) {
    holo = new StillHologram(hero, slot, onStats);
    holo.init();
  } else {
    holo.sync();
  }

  const engine = createEngine(KB);
  const meta = document.querySelector('meta[name="ask-endpoint"]');
  const driver = pickDriver(KB, { endpoint: meta ? meta.content.trim() : '' });
  initCommandBar({ engine, driver, holo, readouts });
  initBento();
  initDrawer({ onOpen: (id, article) => { $$('[data-demo]', article).forEach(mountDemo); initMagnetic(article); } });
  initSandbox({ engine });
  initReveal();
  initMagnetic();

  window.addEventListener('pagehide', (e) => { if (!e.persisted) holo.destroy(); });
  if (new URLSearchParams(location.search).has('debug')) window.__portfolio = { holo, engine, driver };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
