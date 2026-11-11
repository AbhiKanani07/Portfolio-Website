// Anomaly check on illustrative Dutch water readings. Each reading is compared
// with what its province and month would predict; residuals past the threshold
// (in standard deviations) are flagged for follow-up.
import { mulberry32, gauss, escapeHTML } from '../core/dom.js';
import { rangeHTML, bindRanges, ramp } from './ui.js';

const PROV = ['Groningen', 'Fryslân', 'Drenthe', 'Overijssel', 'Flevoland', 'Gelderland', 'Utrecht', 'Noord-Holland', 'Zuid-Holland', 'Zeeland', 'Noord-Brabant', 'Limburg'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COAST = new Set(['Zeeland', 'Zuid-Holland', 'Noord-Holland', 'Groningen', 'Fryslân']);

export function generateWater(seed = 11) {
  const rand = mulberry32(seed);
  const values = PROV.map((p) => {
    const base = 42 + rand() * 18 + (COAST.has(p) ? 6 : 0);
    const amp = 6 + rand() * 4;
    return MON.map((m, j) => base + amp * Math.sin(((j - 3) / 12) * Math.PI * 2) + gauss(rand) * 2.1);
  });
  [['Zeeland', 7, 13], ['Limburg', 2, 10], ['Utrecht', 10, -9], ['Gelderland', 5, 8.5], ['Drenthe', 0, -7.5]]
    .forEach(([p, m, d]) => { values[PROV.indexOf(p)][m] += d; });
  return values;
}

export function residuals(values) {
  const P = values.length;
  const M = values[0].length;
  const provMean = values.map((r) => r.reduce((a, b) => a + b, 0) / M);
  const grand = provMean.reduce((a, b) => a + b, 0) / P;
  const monthMean = MON.map((_, j) => values.reduce((s, r) => s + r[j], 0) / P);
  const exp = values.map((r, i) => r.map((_, j) => provMean[i] + monthMean[j] - grand));
  const res = values.map((r, i) => r.map((v, j) => v - exp[i][j]));
  const flat = res.flat();
  const sd = Math.sqrt(flat.reduce((s, x) => s + x * x, 0) / (flat.length - 1));
  return { exp, z: res.map((r) => r.map((x) => x / sd)), sd };
}

export function mountWater(root) {
  const values = generateWater();
  const { exp, z, sd } = residuals(values);
  const all = values.flat();
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const state = { thr: 2.5, prov: PROV.indexOf('Zeeland') };
  root.innerHTML = `<div class="demo"><div class="demo__grid">
    <div class="demo__controls">
      ${rangeHTML('thr', 'Flag readings beyond', 1.5, 3.5, 0.1, state.thr, 'σ')}
      <label class="ctl"><span>Province chart</span><span></span><select class="select" data-prov style="grid-column: 1 / -1">${PROV.map((p, i) => `<option value="${i}"${i === state.prov ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
      <p class="demo__foot">Lower the threshold to sample more stations; raise it to chase only the clearest outliers.</p>
    </div>
    <div class="demo__out">
      <div class="wq">
        <div>
          <p class="demo__h">Readings by province and month</p>
          <div class="heat heat--wide" data-heat style="grid-template-columns: 96px repeat(12, minmax(0, 1fr))"></div>
          <div class="legend"><span><i></i>lower to higher</span><span><i class="key-flag"></i>flagged</span></div>
        </div>
        <div>
          <p class="demo__h" data-ch></p>
          <svg viewBox="0 0 360 210" data-chart role="img" aria-label="Readings for the selected province against the expected band"></svg>
          <ul class="flags" data-flags></ul>
        </div>
      </div>
    </div>
  </div></div>`;

  function render() {
    let html = '<span></span>' + MON.map((m) => `<span class="heat__lab heat__lab--top">${m[0]}</span>`).join('');
    PROV.forEach((p, i) => {
      html += `<span class="heat__lab">${p}</span>`;
      MON.forEach((m, j) => {
        const f = Math.abs(z[i][j]) > state.thr;
        html += `<span class="heat__cell${f ? ' is-flag' : ''}" style="--c:${ramp((values[i][j] - lo) / (hi - lo))}" title="${p}, ${m}: ${values[i][j].toFixed(1)} (${z[i][j] >= 0 ? '+' : ''}${z[i][j].toFixed(1)}σ)"></span>`;
      });
    });
    root.querySelector('[data-heat]').innerHTML = html;

    const i = state.prov;
    const row = values[i];
    const e = exp[i];
    const band = state.thr * sd;
    const ys = row.concat(e.map((v) => v + band), e.map((v) => v - band));
    const ymin = Math.min(...ys) - 2;
    const ymax = Math.max(...ys) + 2;
    const X = (j) => 34 + (j / 11) * 312;
    const Y = (v) => 14 + (1 - (v - ymin) / (ymax - ymin)) * 168;
    const up = e.map((v, j) => `${X(j).toFixed(1)},${Y(v + band).toFixed(1)}`);
    const dn = e.map((v, j) => `${X(j).toFixed(1)},${Y(v - band).toFixed(1)}`).reverse();
    const line = (arr) => arr.map((v, j) => `${j ? 'L' : 'M'}${X(j).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const pts = row.map((v, j) => `<circle class="wq__pt${Math.abs(z[i][j]) > state.thr ? ' is-flag' : ''}" cx="${X(j).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${Math.abs(z[i][j]) > state.thr ? 4.5 : 2.6}"/>`).join('');
    const axis = MON.map((m, j) => `<text class="wq__axis" x="${X(j).toFixed(1)}" y="204" text-anchor="middle">${m[0]}</text>`).join('');
    root.querySelector('[data-chart]').innerHTML = `<polygon class="wq__band" points="${up.concat(dn).join(' ')}"/><path class="wq__exp" d="${line(e)}"/><path class="wq__line" d="${line(row)}"/>${pts}${axis}<text class="wq__axis" x="0" y="${Y(ymax - 2) + 4}">${(ymax - 2).toFixed(0)}</text><text class="wq__axis" x="0" y="${Y(ymin + 2) + 4}">${(ymin + 2).toFixed(0)}</text>`;
    root.querySelector('[data-ch]').textContent = `${PROV[i]}: readings against the expected band`;

    const flagged = [];
    z.forEach((r, a) => r.forEach((v, b) => { if (Math.abs(v) > state.thr) flagged.push({ a, b, v }); }));
    flagged.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
    root.querySelector('[data-flags]').innerHTML = flagged.length
      ? flagged.slice(0, 5).map((f) => `<li><span>${f.v > 0 ? '+' : '−'}${Math.abs(f.v).toFixed(1)}σ</span>${escapeHTML(PROV[f.a])}, ${MON[f.b]}: ${f.v > 0 ? 'above' : 'below'} expected</li>`).join('') + (flagged.length > 5 ? `<li>${flagged.length - 5} more flagged</li>` : '')
      : '<li>No readings cross this threshold.</li>';
  }
  root.querySelector('[data-prov]').addEventListener('change', (ev) => { state.prov = Number(ev.target.value); render(); });
  bindRanges(root, state, render);
  render();
}

export function miniWater(el) {
  const values = generateWater();
  const { exp, z, sd } = residuals(values);
  const i = PROV.indexOf('Zeeland');
  const row = values[i];
  const e = exp[i];
  const ys = row.concat(e.map((v) => v + 2.5 * sd), e.map((v) => v - 2.5 * sd));
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const X = (j) => 8 + (j / 11) * 584;
  const Y = (v) => 10 + (1 - (v - lo) / (hi - lo)) * 150;
  const up = e.map((v, j) => `${X(j).toFixed(1)},${Y(v + 2.5 * sd).toFixed(1)}`);
  const dn = e.map((v, j) => `${X(j).toFixed(1)},${Y(v - 2.5 * sd).toFixed(1)}`).reverse();
  const d = row.map((v, j) => `${j ? 'L' : 'M'}${X(j).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const dots = row.map((v, j) => (Math.abs(z[i][j]) > 2.5 ? `<circle cx="${X(j).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="6" fill="#ffb020"/>` : `<circle cx="${X(j).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="#f1f5ff"/>`)).join('');
  el.innerHTML = `<svg viewBox="0 0 600 186" role="img" aria-label="Illustrative Zeeland readings with one flagged month"><polygon points="${up.concat(dn).join(' ')}" fill="rgba(46,91,255,0.16)"/><path d="${d}" fill="none" stroke="#f1f5ff" stroke-width="1.6"/>${dots}<text class="mini-txt" x="0" y="184">Zeeland, illustrative readings against the expected band</text></svg>`;
}
