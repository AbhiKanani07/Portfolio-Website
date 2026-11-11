// Floating HUD nav: renderer status, Pittsburgh time, section tracking, mobile menu.
import { $, $$ } from '../core/dom.js';

export function initNav() {
  const nav = $('[data-nav]');
  if (!nav) return { setStats() {} };
  const fpsEl = $('[data-fps]', nav);
  const clock = $('[data-clock]', nav);
  const menu = $('[data-menu]', nav);
  const links = $$('.nav__links a', nav);

  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  const tick = () => { const d = new Date(); clock.textContent = fmt.format(d); clock.setAttribute('datetime', d.toISOString()); };
  tick();
  setInterval(tick, 15000);

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Highlight the section in view.
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${en.target.id}`));
      links.forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));

  const setOpen = (open) => { nav.classList.toggle('is-open', open); menu.setAttribute('aria-expanded', String(open)); };
  menu.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('pointerdown', (e) => { if (!nav.contains(e.target)) setOpen(false); });

  // The status line reports the hologram's real render loop, nothing simulated.
  return {
    setStats(s) {
      let label;
      if (!s.webgl) label = 'NO WEBGL';
      else if (!s.running) label = 'STANDBY';
      else label = `${s.fps || '--'}FPS`;
      fpsEl.textContent = label;
      nav.classList.toggle('is-live', !!(s.webgl && s.running));
    },
  };
}
