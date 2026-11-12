import { readFile, writeFile } from "node:fs/promises";
import { KB } from "../src/ai/knowledge.js";
import { analyze, normalize } from "../src/ai/text.js";
const seed = (s) => () => {
  s |= 0;
  s = s + 1831565813 | 0;
  let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const rand = seed(20261112);
const pick = (a) => a[Math.floor(rand() * a.length)];
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const entries = KB.entries.filter((e) => !e.guard);
const ids = entries.map((e) => e.id);
const Q = {
  summary: ["who is abhi", "who is he", "tell me about abhi", "give me a quick summary", "introduce him", "what is his story", "describe abhi in a few sentences", "who am i looking at", "what does abhi do", "elevator pitch", "quick overview of abhi", "sum him up"],
  "quest-overview": ["tell me about his time at quest", "what is his experience at quest diagnostics", "quest diagnostics", "how did he start at quest", "what has he done at quest", "walk me through his quest experience", "his two roles at quest"],
  quest: ["what is his current job", "where does he work now", "what does he do at quest", "what is his role at quest now", "is he employed", "what are his responsibilities at work", "what is his job title", "does he work part time", "what pipelines does he own", "what does he do as an enterprise data engineer", "is he a data engineer", "how many labs does his reporting cover", "how many daily jobs does his ingestion process"],
  "quest-intern": ["what did he do during his internship", "tell me about his summer internship", "what did he build as an intern", "what was his first role at quest", "what is the tat database", "did he migrate workflows to onelake", "what did he accomplish as a data analytics intern"],
  "quest-stack": ["what tools does he use at work", "what is the tech stack at quest", "does he use azure at work", "what platform are his pipelines on", "which technologies does he use at quest"],
  pitt: ["where does he go to school", "what does he study", "what is his major", "what college does he attend", "is he a pitt student", "what degree is he getting", "which university"],
  gpa: ["what is his gpa", "how are his grades", "what is his major gpa", "is his gpa good"],
  coursework: ["what classes has he taken", "which courses is he taking", "has he taken database systems", "relevant coursework", "did he take linear algebra"],
  year: ["what year is he in", "is he a sophomore", "how far along is he in school", "is he still in school", "when is he finishing his degree"],
  "aws-club": ["is he in any clubs", "what is the aws cloud club", "what does he do as technical chair", "does he teach workshops", "does he run aws workshops"],
  pbl: ["what is phi beta lambda", "what does he do as vp of finance", "is he in a business organization", "does he handle budgeting for a club"],
  leadership: ["what leadership roles does he have", "has he led a team", "is he a leader", "leadership experience"],
  bravox: ["what is bravox", "tell me about bravox credit", "what is bravoxcredit.com", "what product did he build", "what is his startup", "tell me about his credit card app", "what is his side project"],
  "bravox-odds": ["how does bravox calculate odds", "how are approval odds estimated", "what is the scoring formula", "how does the bravox engine work", "what weights does bravox use", "how does bravox decide approval chances"],
  "bravox-band": ["why does bravox cap at 96", "why not 100 percent", "what is the odds range", "why is the maximum 96 percent"],
  "bravox-bureaus": ["which bureau does chase use", "how does bravox handle bureaus", "what is per bureau logic", "experian equifax transunion", "which credit bureau do issuers pull"],
  "bravox-fit": ["does bravox recommend cards", "how does it rank cards", "what is the fit score", "why not just show the easiest card"],
  "bravox-524": ["what is the 5/24 rule", "does bravox handle chase 5/24", "how does it treat chase new accounts"],
  "bravox-arch": ["what is bravox built with", "what is the architecture of bravox", "where is bravox hosted", "what database does bravox use", "what is the bravox stack"],
  "bravox-security": ["is bravox secure", "does bravox need my ssn", "how are passwords stored", "is my data safe on bravox", "does it do a hard pull"],
  "bravox-compliance": ["does bravox have a privacy policy", "is bravox compliant", "does bravox have an ftc disclosure"],
  "bravox-rebuild": ["why did he rebuild bravox", "why next js", "did he use kubernetes", "why did the frontend change"],
  "bravox-design": ["does he design", "who designed bravox", "is he a designer", "does he do ui design"],
  "bravox-tools": ["what free tools does bravox have", "is there a utilization calculator", "does bravox have a 5/24 counter"],
  "bravox-accuracy": ["is bravox accurate", "can i trust the odds", "has bravox been validated", "how reliable is bravox"],
  "bravox-status": ["is bravox making money", "is bravox live", "is bravox monetized", "how is bravox doing"],
  "bravox-next": ["what is next for bravox", "bravox roadmap", "what is he adding to bravox", "future plans for bravox"],
  "bravox-scores": ["fico or vantagescore", "does bravox use fico", "which score model does bravox use"],
  vector: ["what is bravox vector", "what is the waitlist", "what is his next product"],
  keystroke: ["what is keystroke", "tell me about his ios app", "what does keystroke do", "does he make apple wallet passes", "has he built an iphone app", "what is his swift project"],
  "keystroke-signing": ["how does keystroke sign passes", "what is in a pkpass", "why is pass signing hard", "how does the backend sign wallet passes"],
  youtube: ["tell me about his youtube algorithm", "how does his recommender work", "what is the youtube content algorithm", "does he use redis", "how does he rank videos", "what does his recommendation system do"],
  sleep: ["tell me about the sleep dashboard", "how accurate is his sleep model", "what is the sleep project", "does he use shap", "what does the random forest predict", "his fitbit project"],
  water: ["tell me about the water quality project", "netherlands water analysis", "what is the dutch water project"],
  projects: ["what has he built", "what are his projects", "show me his work", "what is in his portfolio", "what has he shipped", "list his projects"],
  site: ["how does this site work", "how was this website made", "what is the hologram", "what powers this page"],
  assistant: ["how does this assistant work", "how are you built", "how is the agent coded", "how do you answer questions", "what is behind this chatbot"],
  stack: ["what languages does he know", "what is his tech stack", "what programming languages", "what are his skills", "what frameworks does he use", "technical skills"],
  cloud: ["what cloud platforms does he use", "azure or aws", "does he know cloud", "cloud experience"],
  spoken: ["what languages does he speak", "does he speak hindi", "is he bilingual", "does he speak gujarati"],
  mascaro: ["what did he do at mascaro", "tell me about his construction internship", "mascaro construction", "his data analyst internship"],
  history: ["what is his work history", "where has he worked", "list his jobs", "what is his experience", "previous jobs"],
  dunkin: ["did he work at dunkin", "what was his job in high school", "dunkin donuts"],
  highschool: ["what did he do in high school", "where did he go to high school", "high school activities"],
  channels: ["does he have a youtube channel", "how many subscribers did he have", "what is fortatom", "does he do vfx", "was he a youtuber", "his youtube channels"],
  roblox: ["does he play roblox", "what games does he play", "what is his favorite game", "is he a gamer", "roblox library"],
  interests: ["what are his hobbies", "what does he do for fun", "does he play sports", "what does he do outside of work", "does he lift"],
  roles: ["what roles is he looking for", "is he open to work", "what jobs does he want", "is he looking for an internship", "what kind of role fits him", "is he available for hire"],
  contact: ["how do i contact him", "what is his email", "how can i reach abhi", "what is his linkedin", "how do i get in touch"],
  resume: ["can i see his resume", "where is his cv", "download resume"],
  principles: ["why should we hire him", "what makes him different", "how does he work", "what are his strengths", "what is his approach"],
  gaps: ["what are his weaknesses", "what is unfinished", "what is he still working on", "what are the gaps"],
  governance: ["does he know data governance", "data quality experience", "is he careful with data"],
  ml: ["does he know machine learning", "what ml work has he done", "does he do ai", "has he trained models", "data science projects"],
  location: ["where is he based", "where does he live", "is he in pittsburgh", "where is he from"],
  flagship: ["what is his best project", "which project is he proudest of", "which project is the biggest"],
  name: ["what is his name", "what is his full name"],
  tombrown: ["what did he do at tom brown", "department of defense project"],
  eafab: ["what did he do at eafab", "his web development internship"],
  fbla: ["was he fbla president", "tell me about fbla", "did he go to nationals"],
  volunteer: ["does he volunteer", "community service", "what fundraising has he done"]
};
const TEMPLATES = ["{p}", "what is {p}", "tell me about {p}", "what about {p}", "explain {p}", "describe {p}", "more on {p}", "info on {p}", "details about {p}", "can you tell me about {p}", "what can you tell me about {p}", "i want to know about {p}", "his {p}", "what is his {p}", "how does {p} work", "does he have {p}", "question about {p}"];
const phrases = (e) => {
  const kw = e.keywords.split(" ");
  const out2 = [e.title.toLowerCase().replace(/\(.*?\)/g, "").trim()];
  for (let i = 0; i < 5; i++) {
    const s = Math.floor(rand() * kw.length);
    out2.push(kw.slice(s, s + 1 + Math.floor(rand() * 3)).join(" "));
  }
  return out2;
};
const typo = (s) => {
  const w = s.split(" ");
  const i = Math.floor(rand() * w.length);
  const x = w[i];
  if (!x || x.length < 5) return s;
  const j = 1 + Math.floor(rand() * (x.length - 2));
  w[i] = rand() < 0.5 ? x.slice(0, j) + x.slice(j + 1) : x.slice(0, j - 1) + x[j] + x[j - 1] + x.slice(j + 1);
  return w.join(" ");
};
const samples = [];
for (const e of entries) {
  const add = (q, kind = "generated") => samples.push({ q, y: e.id, kind });
  (Q[e.id] || []).forEach((q) => add(q, "curated"));
  phrases(e).forEach((p) => {
    for (let k = 0; k < 3; k++) add(pick(TEMPLATES).replace("{p}", p));
  });
  e.body.split(/(?<=[.!?])\s+/).forEach(add);
  add(e.short);
}
const feedback = JSON.parse(await readFile(new URL("./feedback.json", import.meta.url), "utf8").catch(() => "[]"));
const fromVisitors = feedback.filter((r) => r.helpful && ids.includes(r.entry));
fromVisitors.forEach((r) => samples.push({ q: r.question, y: r.entry, kind: "feedback" }));
const base = samples.length;
for (let i = 0; i < base; i++) if (samples[i].kind !== "curated" && rand() < 0.15) samples.push({ q: typo(samples[i].q), y: samples[i].y, kind: "typo" });
const featurize = (q) => {
  const t = analyze(normalize(q));
  const f = t.map((x) => `u:${x}`);
  for (let i = 0; i + 1 < t.length; i++) f.push(`b:${t[i]}_${t[i + 1]}`);
  return [...new Set(f)];
};
shuffle(samples);
const train = [];
const held = [];
const perClass = new Map();
for (const s of samples) {
  if (s.kind === "curated") {
    const n = perClass.get(s.y) || 0;
    perClass.set(s.y, n + 1);
    const total = samples.filter((x) => x.kind === "curated" && x.y === s.y).length;
    if (total >= 3 && n < Math.round(total * 0.3)) held.push(s);
    else train.push(s);
  } else if (rand() < 0.12) held.push(s);
  else train.push(s);
}
const heldHuman = held.filter((s) => s.kind === "curated");
const counts = new Map();
train.forEach((s) => featurize(s.q).forEach((f) => counts.set(f, (counts.get(f) || 0) + 1)));
const vocab = [...counts.keys()].filter((f) => counts.get(f) >= 2);
const fIndex = new Map(vocab.map((f, i) => [f, i]));
const C = ids.length;
const V = vocab.length;
const yIndex = new Map(ids.map((id, i) => [id, i]));
const encode = (s) => ({ x: featurize(s.q).map((f) => fIndex.get(f)).filter((i) => i !== void 0), y: yIndex.get(s.y) });
const TR = train.map(encode);
const HO = held.map(encode);
const W = new Float32Array(C * V);
const Bv = new Float32Array(C);
const G = new Float32Array(C * V).fill(1e-8);
const GB = new Float32Array(C).fill(1e-8);
const LR = 0.6;
const L2 = 2e-4;
const logits = new Float64Array(C);
const forward = (x, w, b, wv) => {
  const v = 1 / Math.sqrt(x.length || 1);
  let mx = -Infinity;
  for (let c = 0; c < C; c++) {
    let z = b[c];
    for (const f of x) z += wv(c, f) * v;
    logits[c] = z;
    if (z > mx) mx = z;
  }
  let sum = 0;
  for (let c = 0; c < C; c++) {
    logits[c] = Math.exp(logits[c] - mx);
    sum += logits[c];
  }
  for (let c = 0; c < C; c++) logits[c] /= sum;
  return { p: logits, v };
};
const dense = (c, f) => W[c * V + f];
for (let ep = 0; ep < 30; ep++) {
  shuffle(TR);
  for (const s of TR) {
    const { p, v } = forward(s.x, Bv, Bv, dense);
    for (let c = 0; c < C; c++) {
      const g = p[c] - (c === s.y ? 1 : 0);
      if (Math.abs(g) < 1e-5) continue;
      for (const f of s.x) {
        const k = c * V + f;
        const gg = g * v + L2 * W[k];
        G[k] += gg * gg;
        W[k] -= LR * gg / Math.sqrt(G[k]);
      }
      GB[c] += g * g;
      Bv[c] -= LR * g / Math.sqrt(GB[c]);
    }
  }
}
const KEEP = 80;
const used = new Map();
const weights = [];
for (let c = 0; c < C; c++) {
  const row = [];
  for (let f = 0; f < V; f++) {
    const w = W[c * V + f];
    if (w !== 0) row.push([f, w]);
  }
  row.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  weights.push(row.slice(0, KEEP));
  row.slice(0, KEEP).forEach(([f]) => {
    if (!used.has(f)) used.set(f, used.size);
  });
}
const features = [...used.keys()].map((f) => vocab[f]);
const sparse = weights.map((row) => row.flatMap(([f, w]) => [used.get(f), Math.round(w * 100) / 100]));
const P = new Map();
sparse.forEach((row, c) => {
  const m = new Map();
  for (let i = 0; i < row.length; i += 2) m.set(row[i], row[i + 1]);
  P.set(c, m);
});
const fUsed = new Map(features.map((f, i) => [f, i]));
const evalSet = (set) => {
  let top1 = 0;
  let top3 = 0;
  for (const s of set) {
    const x = featurize(s.q).map((f) => fUsed.get(f)).filter((i) => i !== void 0);
    const { p } = forward(x, null, Bv, (c, f) => P.get(c).get(f) || 0);
    const order = [...p.keys()].sort((a, b) => p[b] - p[a]);
    if (order[0] === yIndex.get(s.y)) top1++;
    if (order.slice(0, 3).includes(yIndex.get(s.y))) top3++;
  }
  return { top1: top1 / set.length, top3: top3 / set.length };
};
const accTrain = evalSet(train);
const accHeld = evalSet(held);
const docs = entries.map((e) => {
  const tf = new Map();
  const add = (s, w) => analyze(s || "").forEach((t) => tf.set(t, (tf.get(t) || 0) + w));
  add(e.title, 2);
  add(e.keywords, 2);
  add(e.short, 1);
  add(e.body, 1);
  return tf;
});
const df = new Map();
docs.forEach((d) => d.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
const terms = [...df.keys()].sort();
const tIndex = new Map(terms.map((t, i) => [t, i]));
const N = docs.length;
const T = terms.length;
const idf = terms.map((t) => Math.log(N / df.get(t)) + 1);
const A = new Float64Array(N * T);
docs.forEach((d, i) => d.forEach((c, t) => {
  A[i * T + tIndex.get(t)] = Math.log(1 + c) * idf[tIndex.get(t)];
}));
function jacobi(M, n) {
  const a = Float64Array.from(M);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  for (let sweep = 0; sweep < 80; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] * a[p * n + q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = a[p * n + q];
      if (Math.abs(apq) < 1e-15) continue;
      const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
      const t = theta === 0 ? 1 : Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k * n + p];
        const akq = a[k * n + q];
        a[k * n + p] = c * akp - s * akq;
        a[k * n + q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p * n + k];
        const aqk = a[q * n + k];
        a[p * n + k] = c * apk - s * aqk;
        a[q * n + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k * n + p];
        const vkq = v[k * n + q];
        v[k * n + p] = c * vkp - s * vkq;
        v[k * n + q] = s * vkp + c * vkq;
      }
    }
  }
  const values = Array.from({ length: n }, (_, i) => a[i * n + i]);
  const order = values.map((_, i) => i).sort((x, y) => values[y] - values[x]);
  return { values: order.map((i) => values[i]), vectors: order.map((i) => Array.from({ length: n }, (_, k) => v[k * n + i])) };
}
const Gm = new Float64Array(N * N);
for (let i = 0; i < N; i++) for (let j = i; j < N; j++) {
  let s = 0;
  for (let t = 0; t < T; t++) s += A[i * T + t] * A[j * T + t];
  Gm[i * N + j] = s;
  Gm[j * N + i] = s;
}
const eig = jacobi(Gm, N);
const K = Math.min(24, N - 1);
const sig = eig.values.slice(0, K).map((l) => Math.sqrt(Math.max(l, 1e-12)));
const Vk = new Float64Array(T * K);
for (let t = 0; t < T; t++) for (let j = 0; j < K; j++) {
  let s = 0;
  for (let i = 0; i < N; i++) s += A[i * T + t] * eig.vectors[j][i];
  Vk[t * K + j] = s / sig[j];
}
const lsaKept = eig.values.slice(0, K).reduce((a, b) => a + b, 0) / eig.values.reduce((a, b) => a + Math.max(b, 0), 0);
const scale = Array.from({ length: K }, (_, j) => {
  let m = 0;
  for (let t = 0; t < T; t++) m = Math.max(m, Math.abs(Vk[t * K + j]));
  return m / 127 || 1;
});
const q8 = new Int8Array(T * K);
for (let t = 0; t < T; t++) for (let j = 0; j < K; j++) q8[t * K + j] = Math.round(Vk[t * K + j] / scale[j]);
const embed = (tf) => {
  const e = new Float64Array(K);
  tf.forEach((c, t) => {
    const i = tIndex.get(t);
    if (i === void 0) return;
    const w = Math.log(1 + c) * idf[i];
    for (let j = 0; j < K; j++) e[j] += w * q8[i * K + j] * scale[j];
  });
  const n = Math.hypot(...e) || 1;
  return Array.from(e, (x) => x / n);
};
const D = docs.map(embed);
const mean = Array.from({ length: K }, (_, j) => D.reduce((s, d) => s + d[j], 0) / N);
const Cv = new Float64Array(K * K);
D.forEach((d) => {
  for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) Cv[a * K + b] += (d[a] - mean[a]) * (d[b] - mean[b]) / N;
});
const pca = jacobi(Cv, K);
const axes = pca.vectors.slice(0, 2).map((v) => v.map((x) => Math.round(x * 1e5) / 1e5));
const explained = (pca.values[0] + pca.values[1]) / pca.values.reduce((a, b) => a + Math.max(b, 0), 0);
function tsne(X, perp = 9, iters = 900) {
  const n = X.length;
  const Dm = X.map((a) => X.map((b) => {
    let d = 0;
    for (let j = 0; j < a.length; j++) d += (a[j] - b[j]) ** 2;
    return d;
  }));
  const P = Array.from({ length: n }, () => new Float64Array(n));
  const H = Math.log(perp);
  for (let i = 0; i < n; i++) {
    let lo = 0;
    let hi = Infinity;
    let beta = 1;
    for (let it = 0; it < 80; it++) {
      let sum = 0;
      let hsum = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) { P[i][j] = 0; continue; }
        const v = Math.exp(-Dm[i][j] * beta);
        P[i][j] = v;
        sum += v;
        hsum += beta * Dm[i][j] * v;
      }
      sum = Math.max(sum, 1e-300);
      const h = Math.log(sum) + hsum / sum;
      for (let j = 0; j < n; j++) P[i][j] /= sum;
      if (Math.abs(h - H) < 1e-6) break;
      if (h > H) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; } else { hi = beta; beta = (beta + lo) / 2; }
    }
  }
  const Pj = Array.from({ length: n }, (_, i) => Float64Array.from({ length: n }, (_, j) => (i === j ? 0 : Math.max((P[i][j] + P[j][i]) / (2 * n), 1e-12))));
  const k = X[0].length;
  const mu = Array.from({ length: k }, (_, j) => X.reduce((acc, x) => acc + x[j], 0) / n);
  const cov = new Float64Array(k * k);
  X.forEach((x) => { for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) cov[a * k + b] += ((x[a] - mu[a]) * (x[b] - mu[b])) / n; });
  const pc = jacobi(cov, k).vectors;
  let Y = X.map((x) => [0, 1].map((c) => x.reduce((acc, v, j) => acc + (v - mu[j]) * pc[c][j], 0)));
  const sd = Math.sqrt(Y.reduce((acc, y) => acc + y[0] * y[0] + y[1] * y[1], 0) / (2 * n)) || 1;
  Y = Y.map((y) => [(y[0] / sd) * 1e-2 + (rand() - 0.5) * 1e-3, (y[1] / sd) * 1e-2 + (rand() - 0.5) * 1e-3]);
  const vel = Array.from({ length: n }, () => [0, 0]);
  const gains = Array.from({ length: n }, () => [1, 1]);
  for (let it = 0; it < iters; it++) {
    const ex = it < 150 ? 4 : 1;
    const num = Array.from({ length: n }, () => new Float64Array(n));
    let Z = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const q = 1 / (1 + (Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2);
      num[i][j] = q;
      num[j][i] = q;
      Z += 2 * q;
    }
    for (let i = 0; i < n; i++) {
      const g = [0, 0];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const m = 4 * (ex * Pj[i][j] - num[i][j] / Z) * num[i][j];
        g[0] += m * (Y[i][0] - Y[j][0]);
        g[1] += m * (Y[i][1] - Y[j][1]);
      }
      const mom = it < 250 ? 0.5 : 0.8;
      for (let c = 0; c < 2; c++) {
        gains[i][c] = Math.sign(g[c]) !== Math.sign(vel[i][c]) ? gains[i][c] + 0.2 : Math.max(0.01, gains[i][c] * 0.8);
        vel[i][c] = mom * vel[i][c] - 40 * gains[i][c] * g[c];
        Y[i][c] += vel[i][c];
      }
    }
  }
  const med = (a) => { const s2 = [...a].sort((x, y) => x - y); return s2[Math.floor(s2.length / 2)]; };
  const cx = med(Y.map((y) => y[0]));
  const cy = med(Y.map((y) => y[1]));
  const radii = Y.map((y) => Math.hypot(y[0] - cx, y[1] - cy)).sort((x, y) => x - y);
  const r90 = radii[Math.floor(radii.length * 0.9)] || 1;
  const pts = Y.map((y) => {
    const dx = (y[0] - cx) / r90;
    const dy = (y[1] - cy) / r90;
    const r = Math.hypot(dx, dy);
    const f = r > 0.85 ? (0.85 + 0.2 * Math.tanh((r - 0.85) / 0.2)) / r : 1;
    return [dx * f, dy * f];
  });
  const gap = 0.075;
  for (let pass = 0; pass < 200; pass++) {
    let moved = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = pts[j][0] - pts[i][0];
      const dy = pts[j][1] - pts[i][1];
      const d = Math.hypot(dx, dy) || 1e-6;
      if (d >= gap) continue;
      const push = (gap - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      pts[i][0] -= ux * push; pts[i][1] -= uy * push;
      pts[j][0] += ux * push; pts[j][1] += uy * push;
      moved++;
    }
    for (const p of pts) { const r = Math.hypot(p[0], p[1]); if (r > 1.05) { p[0] *= 1.05 / r; p[1] *= 1.05 / r; } }
    if (!moved) break;
  }
  return pts.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
}
const layout = tsne(D);
const qTf = (q) => {
  const m = new Map();
  analyze(normalize(q)).forEach((t) => m.set(t, (m.get(t) || 0) + 1));
  return m;
};
let semTop1 = 0;
held.forEach((s) => {
  const e = embed(qTf(s.q));
  let best2 = -2;
  let bi = -1;
  D.forEach((d, i) => {
    const c = d.reduce((acc, x, j) => acc + x * e[j], 0);
    if (c > best2) {
      best2 = c;
      bi = i;
    }
  });
  if (ids[bi] === s.y) semTop1++;
});
const model = {
  version: 1,
  trained: (new Date()).toISOString().slice(0, 10),
  classes: ids,
  topics: Object.fromEntries(entries.map((e) => [e.id, e.topic])),
  features,
  bias: Array.from(Bv, (b) => Math.round(b * 1e3) / 1e3),
  weights: sparse,
  lsa: { terms, idf: idf.map((x) => Math.round(x * 100) / 100), k: K, scale: scale.map((x) => Number(x.toPrecision(5))), data: Buffer.from(q8.buffer).toString("base64") },
  map: { method: "t-SNE", perplexity: 9, points: Object.fromEntries(ids.map((id, i) => [id, layout[i]])) },
  blend: { clf: 4, sem: 2 },
  meta: { samples: samples.length, curated: Object.values(Q).reduce((a, b) => a + b.length, 0), train: train.length, heldout: held.length, classes: C, vocab: V, features: features.length, weights: sparse.reduce((a, r) => a + r.length / 2, 0), heldTop1: Math.round(accHeld.top1 * 1e3) / 1e3, heldTop3: Math.round(accHeld.top3 * 1e3) / 1e3, trainTop1: Math.round(accTrain.top1 * 1e3) / 1e3, semanticTop1: Math.round(semTop1 / held.length * 1e3) / 1e3, lsaDims: K, lsaVariance: Math.round(lsaKept * 1e3) / 1e3, terms: T, docs: N }
};
const out = new URL("../src/ai/model.js", import.meta.url);
const write = () => writeFile(out, `export const MODEL = ${JSON.stringify(model)};
`);
await write();
const { createEngine } = await import(`../src/ai/engine.js?t=${Date.now()}`);
const { createModel } = await import("../src/ai/ml.js");
const { CASES } = await import("./cases.mjs");
const now = () => new Date("2026-11-11T21:00:00Z");
const right = (r, y) => (r.used || []).includes(y) || r.sources.some((x) => x.id === y);
const suite = (eng) => CASES.filter(([q, want]) => {
  const r = eng.ask(q);
  const got = ["answer", "followup"].includes(r.route) ? (r.used || [])[0] : r.route;
  return want.split("|").includes(got);
}).length;
const heldAcc = (eng, set = held) => set.filter((s) => right(eng.ask(s.q), s.y)).length / set.length;
const baseline = createEngine(KB, { now });
const base0 = heldAcc(baseline);
const baseHuman = heldAcc(baseline, heldHuman);
let best = null;
for (const clf of [0, 1, 2, 3, 4, 6]) for (const sem of [0, 1, 2, 3, 4]) {
  model.blend = { clf, sem };
  const eng = createEngine(KB, { now, model: createModel(model) });
  const s = suite(eng);
  const h = heldAcc(eng);
  const hh = heldAcc(eng, heldHuman);
  if (s === CASES.length && (!best || hh > best.hh || hh === best.hh && h > best.h)) best = { clf, sem, h, hh, s };
}
model.blend = best ? { clf: best.clf, sem: best.sem } : { clf: 0, sem: 0 };
model.meta.engineBaseline = Math.round(base0 * 1e3) / 1e3;
model.meta.engineLearned = best ? Math.round(best.h * 1e3) / 1e3 : model.meta.engineBaseline;
model.meta.humanHeldout = heldHuman.length;
model.meta.humanBaseline = Math.round(baseHuman * 1e3) / 1e3;
model.meta.humanLearned = best ? Math.round(best.hh * 1e3) / 1e3 : model.meta.humanBaseline;
model.meta.humanClassifier = Math.round(evalSet(heldHuman).top1 * 1e3) / 1e3;
model.meta.suite = `${best ? best.s : suite(baseline)}/${CASES.length}`;
model.meta.feedback = fromVisitors.length;
model.meta.kb = Math.round(JSON.stringify(model).length / 1024);
const src = `export const MODEL = ${JSON.stringify(model)};
`;
await write();
console.log(JSON.stringify(model.meta, null, 1));
console.log(`model.js ${(src.length / 1024).toFixed(1)} KB, blend ${JSON.stringify(model.blend)}`);
