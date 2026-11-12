import { $$ } from "../core/dom.js";
let uid = 0;
function fmtNum(v, step) {
  const s = String(step);
  const d = s.includes(".") ? s.split(".")[1].length : 0;
  return Number(v).toFixed(d);
}
function rangeHTML(key, label, min, max, step, value, unit = "") {
  uid += 1;
  const id = `r${uid}-${key}`;
  return `<label class="ctl" for="${id}"><span>${label}</span><output data-out="${key}">${fmtNum(value, step)}${unit}</output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-k="${key}" data-unit="${unit}"></label>`;
}
function setFill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.style.setProperty("--p", `${(Number(input.value) - min) / (max - min) * 100}%`);
}
function bindRanges(root, state, onChange) {
  $$('input[type="range"][data-k]', root).forEach((inp) => {
    const out = root.querySelector(`output[data-out="${inp.dataset.k}"]`);
    inp.addEventListener("input", () => {
      state[inp.dataset.k] = Number(inp.value);
      if (out) out.textContent = fmtNum(inp.value, inp.step) + (inp.dataset.unit || "");
      setFill(inp);
      onChange(inp.dataset.k);
    });
    setFill(inp);
  });
}
const RAMP = [[0, [16, 19, 28]], [0.55, [46, 91, 255]], [1, [0, 240, 255]]];
function ramp(t) {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    const [p1, c1] = RAMP[i];
    const [p0, c0] = RAMP[i - 1];
    if (x <= p1) {
      const k = (x - p0) / (p1 - p0);
      return `rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * k)).join(",")})`;
    }
  }
  return "rgb(0,240,255)";
}
let gid = 0;
function gradId() {
  gid += 1;
  return `g${gid}`;
}
export {
  bindRanges,
  fmtNum,
  gradId,
  ramp,
  rangeHTML,
  setFill
};
