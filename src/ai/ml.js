import { analyze } from "./text.js";
const decode = (b64) => {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) << 24 >> 24;
  return out;
};
const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
function createModel(M) {
  const K = M.lsa.k;
  const termIdx = new Map(M.lsa.terms.map((t, i) => [t, i]));
  const q8 = decode(M.lsa.data);
  const featIdx = new Map(M.features.map((f, i) => [f, i]));
  const rows = M.weights.map((row) => {
    const m = new Map();
    for (let i = 0; i < row.length; i += 2) m.set(row[i], row[i + 1]);
    return m;
  });
  const points = new Map(Object.entries(M.map.points));
  const embedTf = (tf) => {
    const e = new Float64Array(K);
    let hit = 0;
    tf.forEach((c, t) => {
      const i = termIdx.get(t);
      if (i === void 0) return;
      hit += 1;
      const w = Math.log(1 + c) * M.lsa.idf[i];
      for (let j = 0; j < K; j++) e[j] += w * q8[i * K + j] * M.lsa.scale[j];
    });
    if (!hit) return null;
    const n = Math.hypot(...e) || 1;
    for (let j = 0; j < K; j++) e[j] /= n;
    return e;
  };
  const tfOf = (tokens) => {
    const m = new Map();
    tokens.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
    return m;
  };
  function classify(tokens) {
    const f = tokens.map((t) => `u:${t}`);
    for (let i = 0; i + 1 < tokens.length; i++) f.push(`b:${tokens[i]}_${tokens[i + 1]}`);
    const x = [...new Set(f)].map((k) => featIdx.get(k)).filter((i) => i !== void 0);
    const v = 1 / Math.sqrt(x.length || 1);
    const z = M.classes.map((_, c) => {
      let s = M.bias[c];
      for (const i of x) s += (rows[c].get(i) || 0) * v;
      return s;
    });
    const mx = Math.max(...z);
    const ex = z.map((s) => Math.exp(s - mx));
    const sum = ex.reduce((a, b) => a + b, 0);
    const p = new Map();
    M.classes.forEach((id, c) => p.set(id, ex[c] / sum));
    return { p, features: x.length };
  }
  const embed = (tokens) => embedTf(tfOf(tokens));
  const embedEntry = (e) => {
    const tf = new Map();
    const add = (s, w) => analyze(s || "").forEach((t) => tf.set(t, (tf.get(t) || 0) + w));
    add(e.title, 2);
    add(e.keywords, 2);
    add(e.short, 1);
    add(e.body, 1);
    return embedTf(tf);
  };
  function place(q, docs) {
    if (!q) return null;
    const near = docs.filter((d) => d.emb && (d.xy || points.has(d.id))).map((d) => ({ d, s: dot(q, d.emb) })).sort((a, b) => b.s - a.s).slice(0, 4);
    if (!near.length || near[0].s <= 0) return null;
    let x = 0;
    let y = 0;
    let w = 0;
    near.forEach(({ d, s }) => {
      const p = d.xy || points.get(d.id);
      const k = Math.exp(Math.max(0, s) * 12);
      x += p[0] * k;
      y += p[1] * k;
      w += k;
    });
    return [x / w, y / w];
  }
  return { meta: M.meta, blend: M.blend, trained: M.trained, classify, embed, embedEntry, place, point: (id) => points.get(id) || null, dot };
}
export {
  createModel
};
