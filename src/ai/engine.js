// The answer engine. Route, retrieve, guard, compose. It never writes a fact
// that isn't in the record, and every answer carries a trace of how it was made.
import { normalize, words, analyze, expand, stem, STOP } from './text.js';

export const DEFAULTS = Object.freeze({ topK: 3, minMatch: 0.25, floor: 0.32, blockPrivate: true, detail: 2, cite: true });

const K1 = 1.2;
const B = 0.75;
const SAT = 4.5;
const EXPANDED_WEIGHT = 0.35;
const FIELDS = [['title', 2.2], ['keywords', 2.6], ['short', 1], ['body', 1]];
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const RX = {
  injection: /\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|rules|prompt|previous|above|guidelines)\b|\bsystem prompt\b|\bjailbreak\b|\bdeveloper mode\b|\byou are now\b|\bact as (a|an|my)\b|\bpretend (to be|you)\b|\broleplay\b/,
  greeting: /^(hi+|hey+|hello+|yo|sup|hiya|howdy|good (morning|afternoon|evening)|namaste|namaskar|kem ?cho)\b/,
  thanks: /^(thanks|thank you|thx|ty|cheers|appreciate it|great|cool|awesome|nice|ok|okay|got it|perfect)\b/,
  identity: /\b(who|what) are you\b|\bare you (abhi|real|human|a bot|an ai|ai|a person|chatgpt|claude|gpt|him)\b|\byour name\b|\bwho (made|built|created|programmed) you\b/,
  comparison: /\b(better|worse|smarter|stronger|weaker|more talented) than\b|\bcompare (him|abhi)\b|\bcompared (to|with) (other|others|another)\b|\b(vs|versus) (other|another|someone)\b|\brank (him|candidates)\b/,
  followup: /^(tell me )?(more|go on|continue|elaborate|keep going|what else|anything else)\b/,
  pronoun: /\b(it|its|they|them|their)\b/,
  person: /\b(he|him|his|abhi|kanani|you|your)\b/,
  quest: /\bquest\b|\bdiagnostics\b|\b(at|in) (his|your) (job|internship)\b/,
  questDetail: /\b(internal|confidential|proprietary|specific|specifics|specifically|exactly|detail|details|tool|tools|tooling|technology|technologies|tech|stack|system|systems|pipeline|pipelines|database|databases|patient|patients|sample|samples|lab|labs|project|projects|application|applications|app|apps|built|build|building|cloud|vendor|vendors|platform|platforms|languages|software)\b/,
  techAsk: /\b(?:know|knows|use|uses|used|using|familiar with|experience with|experience in|worked with|work with|proficient in|proficient with|skilled in|good at)\s+([a-z0-9][a-z0-9.+#]*(?:\s+[a-z0-9][a-z0-9.+#]*)?)/,
};

const PRIVATE = [
  ['pay', /\b(salary|salaries|compensation|wages?|stipend|hourly|pay rate|paid|how much (does|do|did) (he|you) (make|earn|get))\b/],
  ['phone', /\b(phone|cell|mobile number|contact number|home address|his address|your address|street address)\b/],
  ['gpa', /\b(gpa|grades|transcript)\b/],
  ['age', /\b(how old|his age|your age|birthday|date of birth|when was he born)\b/],
  ['authorization', /\b(visa|citizenship|citizen|immigration|work authorization|sponsorship)\b/],
  ['personal', /\b(religion|religious|girlfriend|boyfriend|dating|married|relationship status|politics|political|vote|voted|ethnicity|caste|net worth|ssn|social security)\b/],
];

const BOOSTS = [
  [/\bwho is\b|\btell me about (him|abhi)\b|\babout (him|abhi)\b|\bsummar|\bintroduce\b|\b30 second\b|\bwhat (does|do) (he|you) do\b/, 'summary', 4.5],
  [/\bwhere\b.*\b(from|live|lives|based|located|grow up|grew up)\b/, 'location', 5],
  [/\bwhere\b.*\b(work|works|intern|interns)\b|\bwhat does he do for (work|a living)\b/, 'quest', 4],
  [/\bwhere\b.*\b(study|studies|school|college|go to)\b|\b(what|which) (school|university|college)\b/, 'pitt', 5],
  [/\bhow (does|do|is|are)\b.*\b(odds|bravox|engine|approval|probabilit|estimate|score|scoring)\b|\bhow (it|bravox) works\b/, 'bravox-odds', 5],
  [/\bwhat is bravox\b|\btell me about bravox\b/, 'bravox', 4],
  [/\bwhy (should|would) (we|i|you|someone|anyone) hire\b|\bwhy hire\b/, 'principles', 12],
  [/\b(open to|available for|looking for|interested in)\b|\bfit for\b|\b(good|great|strong|right) fit\b/, 'roles', 4.5],
  [/\b(hobbies|hobby|for fun|free time|outside of work|interests)\b/, 'interests', 3],
  [/\bspeak|\bspoken\b|\bfluent\b/, 'spoken', 5],
  [/\bstack\b|\b(what|which) (languages|tools|technologies|frameworks)\b|\bskills\b/, 'stack', 2.5],
  [/\bvector\b/, 'vector', 5],
  [/\bquest\b/, 'quest', 2],
  [/\b(this|the) (site|website|page|portfolio)\b|\bhologram\b/, 'site', 4],
  [/\bweakness|\bwhat is he bad at\b|\bgaps?\b|\bunfinished\b/, 'gaps', 3],
  [/\baccura|\breliab|\bvalidat|\bcalibrat/, 'bravox-accuracy', 3],
  [/\bhard pull|\bssn\b|\bbank login/, 'bravox-security', 3],
];

// Terms that look like technologies. Used only to say "not in the record"
// honestly instead of retrieving something loosely related.
const TECH = new Set('spark kafka airflow dbt docker aws gcp azure rust go golang scala kotlin swift php ruby rails django flask vue angular svelte mongodb mongo redis hadoop hive databricks snowflake bigquery redshift terraform ansible jenkins pytorch keras sklearn scikit xgboost langchain openai llama figma unity unreal matlab sas spss powerbi looker lambda linux bash graphql haskell elixir perl dart flutter solidity blockchain c csharp nodejs express spring kubeflow mlflow tableau excel'.split(' '));
const PRETTY = { aws: 'AWS', gcp: 'GCP', dbt: 'dbt', pytorch: 'PyTorch', powerbi: 'Power BI', mongodb: 'MongoDB', bigquery: 'BigQuery', graphql: 'GraphQL', nodejs: 'Node.js', csharp: 'C#', sas: 'SAS', spss: 'SPSS', mlflow: 'MLflow', xgboost: 'XGBoost', openai: 'OpenAI', php: 'PHP', sklearn: 'scikit-learn', scikit: 'scikit-learn' };
const GREET = new Set(['hi', 'hey', 'hello', 'yo', 'sup', 'hiya', 'howdy', 'good', 'morning', 'afternoon', 'evening', 'namaste', 'namaskar', 'kem', 'cho', 'kemcho', 'there', 'assistant', 'bot', 'hologram'].map(stem));

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

export function createEngine(kb) {
  const entries = kb.entries;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const docs = entries.map((e) => {
    const tf = new Map();
    const all = new Set();
    let len = 0;
    for (const [field, weight] of FIELDS) {
      for (const t of analyze(e[field] || '')) {
        tf.set(t, (tf.get(t) || 0) + weight);
        all.add(t);
        len += weight;
      }
    }
    return { e, tf, all, len };
  });
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / N;
  const df = new Map();
  docs.forEach((d) => d.all.forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const idf = (t) => { const n = df.get(t) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); };
  const vocab = new Set();
  entries.forEach((e) => ['title', 'keywords', 'short', 'body'].forEach((f) => words(e[f] || '').forEach((w) => { vocab.add(w); vocab.add(stem(w)); })));

  const ref = (e) => ({ id: e.id, title: e.title, href: e.href });
  const src = (ids) => ids.map((id) => byId.get(id)).filter(Boolean).map(ref);

  function unknownTech(norm, raw) {
    const m = norm.match(RX.techAsk);
    if (!m) return null;
    const parts = m[1].split(' ').filter((w) => !STOP.has(w));
    if (!parts.length) return null;
    const joined = parts.join('');
    const w = TECH.has(joined) ? joined : parts[0];
    if (vocab.has(w) || vocab.has(stem(w))) return null;
    if (!TECH.has(w) && !/[0-9.+#]/.test(w)) return null;
    let display = PRETTY[w];
    if (!display) {
      const hit = String(raw).match(new RegExp(`\\b${w.replace(/[.+#]/g, '\\$&')}\\b`, 'i'));
      const typed = hit ? hit[0] : w;
      display = /[A-Z]/.test(typed) ? typed : typed.charAt(0).toUpperCase() + typed.slice(1);
    }
    return { term: w, display };
  }

  function ask(question, options = {}, ctx = {}) {
    const o = { ...DEFAULTS, ...options };
    const t0 = now();
    const raw = String(question || '').trim().slice(0, 300);
    const norm = normalize(raw);
    const tokens = analyze(raw);
    const trace = { question: raw, normalized: norm, tokens, expanded: [], route: 'answer', candidates: [], kept: [], decision: '', confidence: 0, params: o, ms: 0, composedFrom: [] };
    const R = kb.replies;
    const finish = (result) => {
      trace.ms = now() - t0;
      trace.route = result.route;
      return { topic: 'core', sources: [], confidence: trace.confidence, ranked: [], ...result, trace };
    };
    const say = (route, text, extra = {}) => {
      trace.decision = extra.decision || route;
      return finish({ route, text, ...extra });
    };

    if (!raw) return say('empty', R.empty);
    if (RX.injection.test(norm)) return say('injection', R.injection, { decision: 'declined: tries to change the rules' });
    if (RX.greeting.test(norm) && tokens.every((t) => GREET.has(t))) {
      const reply = /namaste|namaskar/.test(norm) ? R.namaste : /kem ?cho/.test(norm) ? R.kemcho : R.greeting;
      return say('greeting', reply);
    }
    if (RX.thanks.test(norm) && norm.split(' ').length <= 5 && !RX.person.test(norm)) return say('thanks', R.thanks);
    if (RX.identity.test(norm)) return say('identity', R.identity, { sources: o.cite ? src(['site']) : [] });
    if (RX.comparison.test(norm)) return say('comparison', R.comparison, { decision: 'declined: comparison with other people' });
    if (o.blockPrivate) {
      for (const [kind, re] of PRIVATE) {
        if (re.test(norm)) return say('private', R.private[kind], { decision: `declined: private (${kind})`, sources: o.cite ? src([kind === 'age' ? 'year' : 'contact']) : [] });
      }
    }
    const tech = unknownTech(norm, raw);
    if (o.blockPrivate && RX.quest.test(norm) && (RX.questDetail.test(norm) || tech)) {
      trace.confidence = 1;
      return say('confidential', byId.get('quest-private').body, { decision: 'declined: internal Quest details', topic: 'systems', sources: o.cite ? src(['quest-private']) : [] });
    }
    if (RX.followup.test(norm) && norm.split(' ').length <= 5 && ctx.last) {
      const next = (ctx.last.ranked || []).find((c) => !ctx.shown.has(c.id) && c.match >= 0.2);
      if (!next) return say('followup', R.exhausted, { decision: 'nothing new on this topic' });
      const e = byId.get(next.id);
      trace.confidence = next.match;
      trace.composedFrom = [e.id];
      return say('followup', e.body, { decision: 'continues the previous topic', topic: e.topic, sources: o.cite ? [ref(e)] : [], href: e.href, used: [e.id] });
    }
    if (tech) {
      return say('unknown-term', fill(R.unknownTerm, { term: tech.display, stack: byId.get('stack').short }), { decision: `"${tech.display}" isn't in the record`, topic: 'systems', sources: o.cite ? src(['stack']) : [] });
    }

    const boosts = new Map();
    for (const [re, id, w] of BOOSTS) if (re.test(norm)) boosts.set(id, Math.max(boosts.get(id) || 0, w));
    const personal = RX.person.test(norm);
    if (!tokens.length && !boosts.size) {
      return say(personal ? 'not-found' : 'offtopic', personal ? R.notFound : R.offtopic, { decision: 'no content words to search for' });
    }

    const anaphora = RX.pronoun.test(norm) && ctx.last && ctx.last.href ? ctx.last.href : null;
    const weights = new Map(tokens.map((t) => [t, 1]));
    const added = expand(tokens);
    if (!anaphora) added.forEach((t) => { if (!weights.has(t)) weights.set(t, EXPANDED_WEIGHT); });
    trace.expanded = anaphora ? [] : added;

    const ranked = docs.filter((d) => !d.e.guard).map((d) => {
      let score = 0;
      const matched = new Set();
      for (const [t, w] of weights) {
        const f = d.tf.get(t);
        if (!f) continue;
        score += w * idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avgLen)));
        matched.add(t);
      }
      const boosted = boosts.get(d.e.id) || 0;
      score += boosted;
      if (anaphora && d.e.href === anaphora) score = score * 1.5 + 3.5;
      const coverage = tokens.length ? tokens.filter((t) => matched.has(t)).length / tokens.length : (boosted ? 1 : 0);
      const match = 0.62 * (1 - Math.exp(-score / SAT)) + 0.38 * coverage;
      const rank = score * (0.65 + 0.35 * coverage);
      return { id: d.e.id, title: d.e.title, e: d.e, score, match, rank };
    }).filter((c) => c.score > 0).sort((a, b) => b.rank - a.rank);

    const kept = ranked.filter((c) => c.match >= o.minMatch).slice(0, o.topK);
    trace.kept = kept.map((c) => c.id);
    trace.candidates = ranked.slice(0, 8).map((c) => ({
      id: c.id, title: c.title, score: c.score, match: c.match,
      status: c.match < o.minMatch ? 'below minimum' : kept.includes(c) ? 'kept' : 'over the limit',
    }));
    const lean = ranked.map((c) => ({ id: c.id, match: c.match }));
    const top = kept[0];
    trace.confidence = top ? top.match : ranked[0] ? ranked[0].match : 0;

    if (!top || top.match < o.floor) {
      const known = tokens.some((t) => df.has(t));
      if (!known && !personal && !boosts.size) {
        return say('offtopic', R.offtopic, { decision: 'off-topic: no overlap with the record', ranked: lean });
      }
      let text = R.notFound;
      const sources = [];
      const near = ranked[0];
      if (near && near.match >= 0.18) {
        text += ' ' + fill(R.closest, { title: near.title });
        if (o.cite) sources.push(ref(near.e));
      }
      const decision = top ? `confidence ${top.match.toFixed(2)} is under the floor ${o.floor.toFixed(2)}` : 'nothing cleared the minimum match';
      return say('not-found', text, { decision, sources, ranked: lean });
    }

    const used = [top];
    const parts = [o.detail >= 2 ? top.e.body : top.e.short];
    for (const c of kept.slice(1)) {
      if (o.detail >= 3 && c.match >= 0.6 * top.match) { parts.push(c.e.short); used.push(c); }
      else if (o.detail === 2 && used.length < 2 && c.match >= 0.92 * top.match) { parts.push(c.e.short); used.push(c); }
    }
    trace.composedFrom = used.map((c) => c.id);
    return say('answer', parts.join(' '), {
      decision: `confidence ${top.match.toFixed(2)} clears the floor ${o.floor.toFixed(2)}`,
      topic: top.e.topic,
      sources: o.cite ? used.map((c) => ref(c.e)) : [],
      href: top.e.href,
      ranked: lean,
      used: used.map((c) => c.id),
    });
  }

  // Conversation memory for follow-ups like "tell me more" or "how does it work".
  function remember(ctx, result) {
    if (!['answer', 'followup'].includes(result.route)) return ctx;
    const isNewTopic = result.route === 'answer';
    const shown = isNewTopic ? new Set() : new Set(ctx.shown || []);
    (result.used || []).forEach((id) => shown.add(id));
    return {
      last: { ranked: isNewTopic ? result.ranked : (ctx.last ? ctx.last.ranked : []), href: result.href || (ctx.last && ctx.last.href) },
      shown,
    };
  }

  return { ask, remember, size: N, entries };
}
