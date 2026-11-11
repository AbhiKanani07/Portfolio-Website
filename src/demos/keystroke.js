// Keystroke pass builder: an image becomes a Wallet-style pass. Colors are
// extracted from the image, pass.json is real PassKit structure, and every file
// is hashed with real SHA-1 (Web Crypto) into manifest.json. Signing needs an
// Apple-issued certificate, so that step is shown, not faked.
import { escapeHTML, mulberry32, debounce, gradId } from './shared.js';

const W = 640;
const H = 210;
const PRESETS = [
  { id: 'aurora', label: 'Aurora', paint(g) {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#03101e'); gr.addColorStop(0.5, '#0b48d4'); gr.addColorStop(1, '#00dcef');
    g.fillStyle = gr; g.fillRect(0, 0, W, H); g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      g.strokeStyle = `rgba(255,255,255,${(0.05 + i * 0.016).toFixed(3)})`;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) { const y = H * 0.18 + i * H * 0.07 + Math.sin(x * 0.011 + i * 0.7) * H * 0.09; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  } },
  { id: 'grid', label: 'Grid', paint(g) {
    g.fillStyle = '#060912'; g.fillRect(0, 0, W, H);
    const hz = H * 0.38;
    const glow = g.createRadialGradient(W / 2, hz, 4, W / 2, hz, W * 0.45);
    glow.addColorStop(0, 'rgba(46,91,255,0.95)'); glow.addColorStop(1, 'rgba(46,91,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,240,255,0.6)'; g.lineWidth = 1;
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(W / 2 + i * 16, hz); g.lineTo(W / 2 + i * 96, H); g.stroke(); }
    for (let j = 1; j < 9; j++) { const y = hz + (H - hz) * Math.pow(j / 9, 1.7); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  } },
  { id: 'ember', label: 'Ember', paint(g) {
    const gr = g.createLinearGradient(0, H, W, 0);
    gr.addColorStop(0, '#220806'); gr.addColorStop(0.55, '#b9400e'); gr.addColorStop(1, '#f6b73c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rand = mulberry32(7);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,236,190,${(rand() * 0.55).toFixed(2)})`; g.beginPath(); g.arc(rand() * W, rand() * H, rand() * 2.6 + 0.6, 0, Math.PI * 2); g.fill(); }
  } },
];

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha1 = async (bytes) => hex(await crypto.subtle.digest('SHA-1', bytes));
const pngBytes = (canvas) => new Promise((resolve) => canvas.toBlob(async (b) => resolve(new Uint8Array(await b.arrayBuffer())), 'image/png'));

function colorsOf(canvas) {
  const { data } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  let r = 0; let g = 0; let b = 0; let wsum = 0;
  for (let i = 0; i < data.length; i += 64) {
    const R = data[i]; const G = data[i + 1]; const B = data[i + 2];
    const mx = Math.max(R, G, B); const mn = Math.min(R, G, B);
    const w = 0.2 + (mx ? (mx - mn) / mx : 0) * (mx / 255);
    r += R * w; g += G * w; b += B * w; wsum += w;
  }
  const bg = [r, g, b].map((v) => Math.round((v / wsum) * 0.62));
  const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
  const fg = lum < 0.5 ? [255, 255, 255] : [12, 12, 16];
  const label = fg.map((v, i) => Math.round(v * 0.72 + bg[i] * 0.28));
  const css = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  return { bg: css(bg), fg: css(fg), label: css(label) };
}

function drawCode(canvas, hash) {
  const n = 21;
  canvas.width = n; canvas.height = n;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); g.fillStyle = '#0b0b0f';
  const bits = hash.split('').map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
  let k = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
    if (bits[k % bits.length] === '1') g.fillRect(x, y, 1, 1);
    k += 1;
  }
  const finder = (ox, oy) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (i === 0 || j === 0 || i === 6 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) g.fillRect(ox + i, oy + j, 1, 1); };
  finder(0, 0); finder(14, 0); finder(0, 14);
}

export function mountKeystroke(root) {
  const state = { preset: 'aurora', title: 'Keystroke', holder: 'Abhi Kanani', serial: 'KS-0042', image: null };
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      <div class="ctl"><span>Image</span><span></span><div class="ks__presets" style="grid-column: 1 / -1">${PRESETS.map((p) => `<button type="button" class="ks__swatch" data-preset="${p.id}" aria-pressed="${p.id === state.preset}" aria-label="${p.label} image"><canvas width="128" height="42"></canvas></button>`).join('')}</div></div>
      <label class="btn ks__upload"><input type="file" accept="image/*" class="visually-hidden" data-file><span>Use your own image</span></label>
      <label class="field"><span>Pass title</span><input type="text" maxlength="24" value="${state.title}" data-f="title"></label>
      <label class="field"><span>Holder</span><input type="text" maxlength="28" value="${state.holder}" data-f="holder"></label>
      <p class="demo__foot" data-time></p>
    </div>
    <div class="demo__out"><div class="ks">
      <div class="pass" data-pass>
        <div class="pass__top"><span class="pass__mark" aria-hidden="true"></span><span data-p="title"></span><span class="mono pass__serial">${state.serial}</span></div>
        <img class="pass__strip" alt="Pass artwork made from the chosen image" data-p="strip">
        <div class="pass__fields"><div><span class="pass__label">Holder</span><span class="pass__value" data-p="holder"></span></div><div><span class="pass__label">Style</span><span class="pass__value">Generic</span></div></div>
        <div class="pass__code"><canvas data-p="code" aria-label="Pattern derived from the manifest hash"></canvas><small>Pattern from the manifest hash, not a scannable code</small></div>
      </div>
      <div>
        <p class="demo__h">Pass bundle</p>
        <table class="bundle"><thead><tr><th scope="col">File</th><th scope="col">Bytes</th><th scope="col">SHA-1</th></tr></thead><tbody data-files></tbody></table>
        <p class="demo__h" style="margin-top: 18px">manifest.json</p>
        <pre class="manifest mono" data-manifest></pre>
      </div>
    </div></div>
  </div></div>`;
  const q = (s) => root.querySelector(s);
  const src = document.createElement('canvas');
  src.width = W; src.height = H;
  root.querySelectorAll('.ks__swatch canvas').forEach((c, i) => { const g = c.getContext('2d'); g.scale(c.width / W, c.height / H); PRESETS[i].paint(g); });
  let token = 0;

  async function rebuild() {
    const mine = ++token;
    const g = src.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (state.image) {
      const im = state.image;
      const s = Math.max(W / im.width, H / im.height);
      g.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
    } else PRESETS.find((p) => p.id === state.preset).paint(g);
    const colors = colorsOf(src);
    const pass = {
      formatVersion: 1, passTypeIdentifier: 'pass.com.example.keystroke', serialNumber: state.serial, teamIdentifier: 'ABCDE12345',
      organizationName: 'Keystroke', description: `${state.title} pass`,
      backgroundColor: colors.bg, foregroundColor: colors.fg, labelColor: colors.label,
      generic: { primaryFields: [{ key: 'title', label: 'Pass', value: state.title }], secondaryFields: [{ key: 'holder', label: 'Holder', value: state.holder }] },
      barcodes: [{ format: 'PKBarcodeFormatQR', message: state.serial, messageEncoding: 'iso-8859-1' }],
    };
    const card = q('[data-pass]');
    card.style.setProperty('--pass-bg', colors.bg);
    card.style.setProperty('--pass-fg', colors.fg);
    card.style.setProperty('--pass-label', colors.label);
    q('[data-p="title"]').textContent = state.title || 'Untitled';
    q('[data-p="holder"]').textContent = state.holder || 'No holder';
    q('[data-p="strip"]').src = src.toDataURL('image/jpeg', 0.86);
    if (!(window.crypto && crypto.subtle)) { q('[data-time]').textContent = 'SHA-1 needs a secure (https) page, so hashing is off here.'; return; }
    const t0 = performance.now();
    const icon = document.createElement('canvas');
    icon.width = 58; icon.height = 58;
    icon.getContext('2d').drawImage(src, (W - H) / 2, 0, H, H, 0, 0, 58, 58);
    const files = [['icon.png', await pngBytes(icon)], ['pass.json', new TextEncoder().encode(JSON.stringify(pass, null, 2))], ['strip.png', await pngBytes(src)]];
    const hashes = {};
    for (const [name, bytes] of files) hashes[name] = await sha1(bytes);
    const manifest = JSON.stringify(hashes, null, 2);
    const mHash = await sha1(new TextEncoder().encode(manifest));
    const ms = performance.now() - t0;
    if (mine !== token) return;
    drawCode(q('[data-p="code"]'), mHash);
    q('[data-files]').innerHTML = files.map(([name, bytes]) => `<tr><td class="mono">${name}</td><td class="mono">${bytes.length.toLocaleString('en-US')}</td><td class="hash" title="${hashes[name]}">${hashes[name].slice(0, 12)}…</td></tr>`).join('')
      + `<tr><td class="mono">manifest.json</td><td class="mono">${manifest.length.toLocaleString('en-US')}</td><td class="hash" title="${mHash}">${mHash.slice(0, 12)}…</td></tr>`
      + '<tr><td class="mono">signature</td><td class="mono">none</td><td class="st-drop">needs an Apple-issued certificate</td></tr>';
    q('[data-manifest]').textContent = manifest;
    q('[data-time]').textContent = `Encoded and hashed ${files.length + 1} files in ${ms.toFixed(1)} ms, in this browser.`;
  }

  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    state.preset = b.dataset.preset;
    state.image = null;
    root.querySelectorAll('[data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    rebuild();
  }));
  q('[data-file]').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { state.image = im; root.querySelectorAll('[data-preset]').forEach((x) => x.setAttribute('aria-pressed', 'false')); rebuild(); URL.revokeObjectURL(url); };
    im.src = url;
  });
  const later = debounce(rebuild, 140);
  root.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('input', () => { state[inp.dataset.f] = inp.value.trim(); later(); }));
  rebuild();
}

export function miniKeystroke(el) {
  const id = gradId();
  const rand = mulberry32(42);
  let mods = '';
  const n = 13;
  const s = 5.2;
  const ox = 110 - (n * s) / 2;
  const oy = 176;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const corner = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8);
    const ring = corner && (x % 9 === 0 || y % 9 === 0 || x % 9 === 3 || y % 9 === 3 || (x % 9 === 1.5));
    if (corner ? (ring || (x % 9 >= 1 && x % 9 <= 2 && y % 9 >= 1 && y % 9 <= 2)) : rand() > 0.5) mods += `<rect x="${(ox + x * s).toFixed(1)}" y="${(oy + y * s).toFixed(1)}" width="${s}" height="${s}" fill="#0b0b0f"/>`;
  }
  el.innerHTML = `<svg viewBox="0 0 220 300" role="img" aria-label="A Wallet-style pass built from an image">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b48d4"/><stop offset="1" stop-color="#00dcef"/></linearGradient></defs>
    <rect x="30" y="8" width="160" height="264" rx="14" fill="#0b1830" stroke="rgba(255,255,255,0.2)"/>
    <circle cx="48" cy="26" r="5" fill="#00f0ff"/><rect x="60" y="22" width="56" height="8" rx="2" fill="rgba(241,245,255,0.8)"/>
    <rect x="30" y="42" width="160" height="62" fill="url(#${id})"/>
    <rect x="44" y="118" width="40" height="5" rx="2" fill="rgba(241,245,255,0.45)"/><rect x="44" y="128" width="76" height="8" rx="2" fill="rgba(241,245,255,0.85)"/>
    <rect x="128" y="118" width="34" height="5" rx="2" fill="rgba(241,245,255,0.45)"/><rect x="128" y="128" width="48" height="8" rx="2" fill="rgba(241,245,255,0.85)"/>
    <rect x="${ox - 6}" y="${oy - 6}" width="${n * s + 12}" height="${n * s + 12}" rx="6" fill="#ffffff"/>${mods}
    <text class="mini-txt" x="30" y="298">wallet pass, built from an image</text></svg>`;
}
