// Command palette: Ctrl or Command K (or "/") from anywhere. Type a question to
// ask the assistant in place, or jump to a section, a case study, or a link.
import { $, $$, escapeHTML } from '../core/dom.js';
import { Spring, driver } from '../core/spring.js';
import { motion } from '../core/motion.js';
import { DEFAULTS } from '../ai/engine.js';

export function initPalette({ engine, driver: words, holo, drawer, dock }) {
  const root = $('[data-palette]');
  if (!root) return null;
  const panel = $('.palette__panel', root);
  const input = $('#palette-input', root);
  const list = $('#palette-list', root);
  const answer = $('[data-palette-answer]', root);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  $$('[data-kbd]').forEach((k) => { k.textContent = mac ? '⌘K' : 'Ctrl K'; });

  let open = false;
  let items = [];
  let active = 0;
  let lastFocus = null;
  let ctx = {};
  let current = null;
  let force = 0;
  const go = (sel) => { close(); setTimeout(() => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth' }); }, 40); };
  const caseStudy = (id) => () => { close(); drawer.show(id); };
  const ext = (url) => () => { close(); window.open(url, '_blank', 'noopener'); };
  const copyEmail = () => {
    const email = 'arkanani2mail@gmail.com';
    const done = () => { const el = list.querySelector('[aria-selected="true"] small'); if (el) el.textContent = 'Copied'; setTimeout(close, 650); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(email).then(done, () => { window.location.href = `mailto:${email}`; });
    else window.location.href = `mailto:${email}`;
  };
  const SUGGEST = ['Give me the 30-second summary of Abhi.', 'What does he do at Quest Diagnostics?', 'What is Keystroke?'];
  const CMDS = [
    { group: 'Jump to', label: 'Work', hint: 'four products', run: () => go('#work') },
    { group: 'Jump to', label: 'Sandbox', hint: 'the answer engine', run: () => go('#sandbox') },
    { group: 'Jump to', label: 'Experience', hint: 'Quest, Pitt, leadership', run: () => go('#experience') },
    { group: 'Jump to', label: 'In between', hint: 'Roblox and YouTube', run: () => go('#between') },
    { group: 'Jump to', label: 'Roblox library', hint: 'search his games', run: () => { go('#between'); setTimeout(() => { const q = document.querySelector('#rbx-q'); if (q) q.focus({ preventScroll: true }); }, 700); } },
    { group: 'Jump to', label: 'Contact', hint: 'email and links', run: () => go('#contact') },
    { group: 'Jump to', label: 'Top of the page', hint: 'the hologram', run: () => go('#top') },
    { group: 'Case studies', label: 'Bravox Credit', hint: 'credit approval engine', run: caseStudy('bravox') },
    { group: 'Case studies', label: 'Keystroke', hint: 'images to Wallet passes', run: caseStudy('keystroke') },
    { group: 'Case studies', label: 'Sleep insights dashboard', hint: 'Random Forest, SHAP', run: caseStudy('sleep') },
    { group: 'Case studies', label: 'YouTube content algorithm', hint: 'ranking with Redis', run: caseStudy('youtube') },
    { group: 'Case studies', label: 'Dutch water quality', hint: 'earlier project', run: caseStudy('water') },
    { group: 'Contact', label: 'Copy email address', hint: 'arkanani2mail@gmail.com', run: copyEmail },
    { group: 'Contact', label: 'Open LinkedIn', hint: 'linkedin.com/in/abhikanani', run: ext('https://www.linkedin.com/in/abhikanani/') },
    { group: 'Contact', label: 'Open GitHub', hint: 'github.com/AbhiKanani07', run: ext('https://github.com/AbhiKanani07') },
    { group: 'Contact', label: 'Open bravoxcredit.com', hint: 'live product', run: ext('https://www.bravoxcredit.com') },
  ];

  const sp = new Spring(0, { stiffness: 320, damping: 32 });
  const anim = driver(sp, () => {
    const v = sp.value;
    panel.style.opacity = String(Math.min(1, v * 1.2));
    panel.style.transform = `translate3d(0, ${((1 - v) * -12).toFixed(2)}px, 0) scale(${(0.975 + v * 0.025).toFixed(4)})`;
  }, () => { if (!open) root.hidden = true; });

  function mark() {
    $$('[data-i]', list).forEach((li) => li.setAttribute('aria-selected', String(Number(li.dataset.i) === active)));
    input.setAttribute('aria-activedescendant', items.length ? `pi-${active}` : '');
    const el = list.querySelector(`#pi-${active}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function render() {
    const q = input.value.trim();
    const ql = q.toLowerCase();
    items = [];
    if (q) items.push({ group: 'Assistant', label: `Ask: ${q}`, hint: 'answers from the record', run: () => ask(q) });
    else SUGGEST.forEach((s) => items.push({ group: 'Ask the assistant', label: s, hint: 'question', run: () => { input.value = s; ask(s); } }));
    CMDS.forEach((c) => { if (!ql || `${c.label} ${c.hint} ${c.group}`.toLowerCase().includes(ql)) items.push(c); });
    active = Math.max(0, Math.min(active, items.length - 1));
    let html = '';
    let group = null;
    items.forEach((it, i) => {
      if (it.group !== group) { group = it.group; html += `<li class="palette__group" role="presentation">${escapeHTML(group)}</li>`; }
      html += `<li class="palette__item" role="option" id="pi-${i}" data-i="${i}" aria-selected="false"><span>${escapeHTML(it.label)}</span><small>${escapeHTML(it.hint)}</small></li>`;
    });
    list.innerHTML = html;
    mark();
  }

  function ask(q) {
    if (current) { current.cancel(); current = null; }
    const local = engine.ask(q, DEFAULTS, ctx);
    ctx = engine.remember(ctx, local);
    holo.setTopic(local.topic);
    holo.setMode('retrieving');
    if (dock) dock.pulse(0.6);
    answer.hidden = false;
    answer.innerHTML = '<p class="qa__q mono"></p><p class="qa__a"><span data-text></span><span class="caret caret--sm" aria-hidden="true"></span></p><div class="qa__src"></div><p class="meta mono"></p>';
    $('.qa__q', answer).textContent = q;
    const textEl = $('[data-text]', answer);
    let text = '';
    let engineName = words.name;
    current = words.run(q, local, {
      instant: motion.reduced,
      onEngine: (n) => { engineName = n; },
      onStart: () => holo.setMode('streaming'),
      onToken: (tok) => { text += tok; textEl.textContent = text; holo.pulse(0.1); if (dock) dock.pulse(0.1); },
      onDone: (final) => {
        textEl.textContent = final;
        const caret = $('.caret', answer);
        if (caret) caret.remove();
        $('.qa__src', answer).innerHTML = local.sources.length
          ? `<span class="mono">Sources</span>${local.sources.map((s) => `<a class="chip chip--sm" href="${escapeHTML(s.href)}"${/^https?:/.test(s.href) ? ' target="_blank" rel="noopener"' : ''}>${escapeHTML(s.title)}</a>`).join('')}`
          : '';
        $('.meta', answer).innerHTML = `<span>${escapeHTML(engineName)}</span><span>retrieved in ${local.trace.ms.toFixed(2)} ms</span>`;
        holo.setMode('idle');
        current = null;
      },
    });
    input.select();
  }

  function show() {
    if (open) return;
    open = true;
    clearTimeout(force);
    const menu = document.querySelector('[data-menu][aria-expanded="true"]');
    if (menu) menu.click();
    lastFocus = document.activeElement;
    root.hidden = false;
    input.value = '';
    answer.hidden = true;
    active = 0;
    render();
    sp.set(1);
    anim.kick();
    input.focus({ preventScroll: true });
  }
  function close() {
    if (!open) return;
    open = false;
    if (current) { current.cancel(); current = null; }
    sp.set(0);
    anim.kick();
    clearTimeout(force);
    force = setTimeout(() => { if (!open) { anim.stop(); sp.jump(0); root.hidden = true; } }, 450);
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (e) => {
    if (open && e.key === 'Escape') { e.preventDefault(); close(); return; }
    const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (open) close(); else show(); return; }
    if (e.key === '/' && !typing && !open) { e.preventDefault(); show(); }
  });
  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) items[active].run(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  });
  list.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) items[Number(li.dataset.i)].run(); });
  list.addEventListener('pointermove', (e) => { const li = e.target.closest('[data-i]'); if (li && Number(li.dataset.i) !== active) { active = Number(li.dataset.i); mark(); } });
  answer.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  $$('[data-palette-close]', root).forEach((b) => b.addEventListener('click', close));
  $$('[data-palette-open]').forEach((b) => b.addEventListener('click', show));
  return { show, close };
}
