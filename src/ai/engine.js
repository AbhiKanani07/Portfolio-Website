// The answer engine: correct, route, retrieve, guard, compose. It never writes a
// fact that isn't in the record, and every answer carries a trace of how it was
// made, which the Sandbox section displays stage by stage.
import { normalize, words, analyze, expand, stem, STOP, editDistance } from './text.js';

export const DEFAULTS = Object.freeze({ topK: 3, minMatch: 0.25, floor: 0.32, blockPrivate: true, detail: 2, cite: true });

const K1 = 1.2;
const B = 0.75;
const SAT = 4.5;
const EXPANDED_WEIGHT = 0.35;
const FIELDS = [['title', 2.2], ['keywords', 2.6], ['short', 1], ['body', 1]];
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const months = (n) => (n <= 1 ? 'about a month' : `about ${n <= 12 ? NUM[n] : n} months`);

const RX = {
  injection: /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(instructions?|rules|prompt|previous|above|guidelines|guardrails|restrictions)\b|\b(system|hidden|developer) (prompt|message|instructions)\b|\bjailbreak\b|\bdeveloper mode\b|\byou are now\b|\bact as (a|an|my|if)\b|\bpretend (to be|you|that)\b|\broleplay\b|\bdo anything now\b|\bdan mode\b|\brepeat after me\b|\b(reveal|print|show|leak|dump) (your|the) (prompt|instructions|rules|system)\b/,
  greeting: /^(hi+|hey+|hello+|helo|yo|sup|hiya|howdy|greetings|good (morning|afternoon|evening|day)|namaste|namaskar|kem ?cho)\b/,
  thanks: /^(thanks|thank you|thx|ty|cheers|appreciate it|great|cool|awesome|nice|ok|okay|got it|perfect|bye|goodbye|see you|cya|wow)\b/,
  help: /^(help|menu|options|commands|start)$|\bwhat can (i|you) (ask|do|answer|tell|say)\b|\bwhat (do|can) you know\b|\bwhat should i ask\b|\bhow (do|can) i use (this|you)\b/,
  assistantMeta: /\b(your|this|the) (agent|assistant|bot|chatbot|chat bot|ai assistant|answer engine|engine|ai model)\b|\bhow (are|were|was) you (made|built|coded|programmed|trained|created|designed|developed|implemented|working)\b|\bhow do you work\b|\bhow (is|was|does) (this|your|the) (ai|agent|assistant|bot|chatbot|chat) (made|built|coded|programmed|work|works|working|implemented)\b|\bwhat (model|llm|language model|ai) (are you|is this|do you use|powers (you|this))\b|\bare you (gpt|chatgpt|claude|an? llm|a language model|openai|gemini)\b|\bdo you use (gpt|chatgpt|claude|an? llm|openai)\b/,
  identity: /\b(who|what) are you\b|\bare you (abhi|real|human|a bot|a robot|an ai|ai|a person|alive|sentient|him)\b|\byour name\b|\bwho (made|built|created|programmed|coded|wrote) you\b/,
  name: /\bwhat(s| is) (his|your) (full |last |first )?name\b|\bwho am i (talking|chatting) (to|about)\b/,
  comparison: /\b(better|worse|smarter|stronger|weaker|more talented|more skilled) than (other|others|another|most|anyone|everyone|me|other candidates|his peers)\b|\bcompare (him|abhi) (to|with)\b|\bcompared (to|with) (other|others|another)\b|\b(vs|versus) (other|another|someone)\b|\brank (him|candidates)\b/,
  others: /\b(his|abhis) (manager|boss|supervisor|coworkers?|colleagues?|team ?mates?|team members?|mentor|parents?|mom|dad|mother|father|brother|sister|siblings?|family|friends?|girlfriend|boyfriend|partner|wife|crush)\b/,
  task: /\b(write|compose|generate|draft|create|make|give) (me |us )?(a |an |some )?(poem|story|essay|song|joke|code|script|program|letter|haiku|tweet|recipe)\b|\btell (me |us )?(a |an )?(joke|story|poem|riddle)\b|\btranslate\b|\bsolve (this|my|the)\b|\b\d+\s*(plus|minus|times|divided by|[-+*\/x])\s*\d+\b|\bcalculate\b|\bhomework\b|\bweather\b|\bstock price\b|\brecipe\b/,
  abuse: /\b(fuck|fucking|shit|bitch|asshole|dick|cunt|bastard|retard|stupid bot|dumb bot|idiot|moron)\b/,
  followup: /^(tell me )?(more|go on|continue|elaborate|keep going|what else|anything else|why|how so|go deeper|more details|details|say more)( about (it|that|this))?( please)?$/,
  pronoun: /\b(it|its|they|them|their)\b/,
  person: /\b(he|him|his|abhi|kanani|you|your)\b/,
  quest: /\bquest\b|\bdiagnostics\b|\b(at|in) (his|your) (job|internship)\b/,
  questDetail: /\b(internal|confidential|proprietary|secret|secrets|patient|patients|phi|hipaa|customer|customers|client|clients|names? of (the )?(systems|labs|tools)|which labs|legacy system)\b/,
  techAsk: /\b(?:know|knows|use|uses|used|using|familiar with|experience with|experience in|worked with|work with|proficient in|proficient with|skilled in|good at|code in|program in|learned|learn)\s+([a-z0-9][a-z0-9.+#]*(?:\s+[a-z0-9][a-z0-9.+#]*)?)/,
  yesno: /^(does|do|did|has|have|can|is|was|could) (he|abhi|you)\b/,
  judge: /\b(good at|great at|expert|proficient|skilled|strong (at|in)|best at)\b/,
  skillVerb: /\b(know|knows|use|uses|used|using|experience|familiar|proficient|skilled|worked with|work with|good at|code in|program in|play|plays)\b/,
  otherFavorite: /\bfavou?rite (food|foods|color|colour|movie|movies|film|show|tv show|song|songs|band|artist|singer|book|books|animal|drink|place|city|team|car|subject|class|teacher|restaurant|snack|anime|holiday|season)\b/,
  ownCompare: /\b(which|what) (is|was|s)? ?(his )?(best|favorite|favourite|biggest|hardest|most impressive|strongest|proudest) (project|thing|work|build|product)\b|\bwhich (project|one|product) is (better|best|bigger)\b|\bbest project\b|\bfavorite project\b|\bproudest\b/,
  duration: /\bhow long\b|\bsince when\b|\bwhen did (he|abhi|you) (start|join|begin|leave|finish|stop)\b|\bwhen (does|do|will) (he|abhi|you) (start|graduate|finish)\b|\bhow many (months|years)\b/,
  time: /\bwhat time\b|\btime is it\b|\btime (is it )?(there|in pittsburgh)\b|\bright now\b|\bcurrently doing\b|\bdoing (right )?now\b|\b(available|online|awake) (right )?now\b/,
};

const PRIVATE = [
  ['pay', /\b(salary|salaries|compensation|wages?|stipend|hourly|pay rate|paid|how much (does|do|did) (he|you) (make|earn|get))\b/],
  ['phone', /\b(phone|cell|mobile number|contact number|home address|his address|your address|street address|where (exactly )?does he live)\b/],
  ['transcript', /\btranscripts?\b/],
  ['age', /\b(how old|his age|your age|birthday|date of birth|when was he born)\b/],
  ['authorization', /\b(visa|citizenship|citizen|immigration|work authorization|sponsorship)\b/],
  ['personal', /\b(religion|religious|girlfriend|boyfriend|dating|single|married|relationship status|politics|political|vote|voted|ethnicity|caste|net worth|ssn|social security)\b/],
];

const BOOSTS = [
  [/\bwho is\b|\btell me about (him|abhi|yourself)\b|\babout (him|abhi|yourself)\b|\bsummar|\bintroduce\b|\b30 second\b|\bwhat (does|do) (he|you) do$|\btell me everything\b|\bbackground\b/, 'summary', 4.5],
  [/\bwhere\b.*\b(from|live|lives|based|located|grow up|grew up)\b|\bhometown\b/, 'location', 5],
  [/\bwhere\b.*\b(work|works|intern|interns)\b|\bwhat does he do for (work|a living)\b|\bcurrent (job|role|position)\b|\bjob title\b|\b(his|your) title\b/, 'quest', 4],
  [/\bwhat (does|do) (he|you) do\b.*\bquest\b|\bquest\b.*\b(now|currently|part time)\b|\bpart time\b|\bpart 2\b|\benterprise data engineer\b/, 'quest', 6],
  [/\bquest\b/, 'quest-overview', 3],
  [/\b(summer|intern|internship|analytics intern|part 1)\b.*\bquest\b|\bquest\b.*\b(summer|intern|internship)\b|\btat\b|\bturnaround\b|\bonelake\b|\blegacy workflows?\b|\bsummer internship\b/, 'quest-intern', 6],
  [/\bpipelines?\b|\bdimensional\b|\bctes?\b|\bdaily jobs\b/, 'quest', 4],
  [/\b(tools|stack|tech|technologies|platform|software)\b.*\bquest\b|\bquest\b.*\b(tools|stack|tech|technologies|platform|software)\b/, 'quest-stack', 7],
  [/\bwhere\b.*\b(study|studies|school|college|go to)\b|\b(what|which) (school|university|college)\b|\bdid (he|you) go to college\b/, 'pitt', 5],
  [/\bstudent\b|\bin college\b/, 'year', 3],
  [/\bhigh school\b|\bsenior year\b/, 'highschool', 6],
  [/\bdunkin\b|\bdonuts?\b/, 'dunkin', 8],
  [/\bhow (does|do|is|are)\b.*\b(odds|bravox|engine|approval|probabilit|estimate|score|scoring)\b|\bhow (it|bravox) works\b/, 'bravox-odds', 5],
  [/\bwhat is bravox\b|\btell me about bravox\b/, 'bravox', 4],
  [/\bwhy (should|would) (we|i|you|someone|anyone) hire\b|\bwhy hire\b/, 'principles', 12],
  [/\b(open to|available for|looking for|interested in)\b|\bfit for\b|\b(good|great|strong|right) fit\b/, 'roles', 4.5],
  [/\b(hobbies|hobby|for fun|free time|outside of work|interests|in between)\b/, 'interests', 3],
  [/\bspeak|\bspoken\b|\bfluent\b/, 'spoken', 5],
  [/\bstack\b|\b(what|which) (languages|tools|technologies|frameworks)\b|\bskills\b/, 'stack', 2.5],
  [/\bvector\b/, 'vector', 5],
  [/\b(this|the) (site|website|page|portfolio)\b|\bhologram\b/, 'site', 7],
  [/\bweakness|\bwhat is he bad at\b|\bgaps?\b|\bunfinished\b/, 'gaps', 3],
  [/\baccura|\breliab|\bvalidat|\bcalibrat/, 'bravox-accuracy', 3],
  [/\bhard pull|\bssn\b|\bbank login/, 'bravox-security', 3],
  [/\bkeystroke\b|\bapple wallet\b|\bwallet pass|\bpkpass\b|\bios app\b|\biphone app\b/, 'keystroke', 6],
  [/\bsign(ing|ed|s)?\b.*\bpass|\bpass\b.*\bsign|\bmanifest\b/, 'keystroke-signing', 5],
  [/\baws\b|\bcloud club\b|\bclubs?\b/, 'aws-club', 4.5],
  [/\bgpa\b|\bgrades?\b/, 'gpa', 7],
  [/\bcoursework\b|\bcourses\b|\bclasses\b/, 'coursework', 4],
  [/\bgraduat/, 'year', 4],
  [/\bredis\b|\bcach(e|ing|ed)\b|\branking\b|\brecommendation (engine|algorithm)\b|\bcontent algorithm\b/, 'youtube', 4],
  [/\byoutube\b/, 'youtube', 2.5],
  [/\bchannels?\b|\bsubscribers?\b|\bcreator\b|\bvfx\b|\bvisual effects\b|\bvideo editing\b|\bfortatom\b|\bequinox\b|\bgexiz\b|\brandomgaming/, 'channels', 7],
  [/\bshap\b|\brandom forest\b|\bstreamlit\b|\bsleep\b/, 'sleep', 6],
  [/\broblox\b|\bwhat games\b|\bgames? (does )?(he|you) (play|played|plays|like|likes|love)\b|\bfavorite games?\b|\bgaming\b|\bvideo games?\b/, 'roblox', 7],
  [/\brecent(ly)? (played|games)\b|\bplay(ed|ing)? recently\b|\blast played\b/, 'roblox-recent', 8],
  [/\bfavou?rite (roblox )?games?\b|\btop (roblox )?games\b/, 'roblox-favorites', 8],
];

// Technologies that aren't in the record. Never spell-corrected, so "Rust"
// gets an honest "not in the record" instead of turning into "trust".
const TECH = new Set('spark kafka airflow dbt aws gcp azure rust go golang scala kotlin swift php ruby rails django flask vue angular svelte mongodb mongo redis hadoop hive databricks bigquery redshift terraform ansible jenkins pytorch keras sklearn scikit xgboost langchain openai llama figma unity unreal matlab sas spss powerbi looker lambda linux bash graphql haskell elixir perl dart flutter solidity blockchain c csharp nodejs express spring kubeflow mlflow tableau excel slack jira notion canva photoshop premiere blender davinci capcut aftereffects lightroom illustrator chatgpt copilot cplusplus'.split(' '));
const PRETTY = { aws: 'AWS', gcp: 'GCP', dbt: 'dbt', pytorch: 'PyTorch', powerbi: 'Power BI', mongodb: 'MongoDB', bigquery: 'BigQuery', graphql: 'GraphQL', nodejs: 'Node.js', csharp: 'C#', cplusplus: 'C++', sas: 'SAS', spss: 'SPSS', mlflow: 'MLflow', xgboost: 'XGBoost', openai: 'OpenAI', php: 'PHP', sklearn: 'scikit-learn', scikit: 'scikit-learn', chatgpt: 'ChatGPT', davinci: 'DaVinci Resolve', capcut: 'CapCut', aftereffects: 'After Effects' };
const GREET = new Set(['hi', 'hey', 'hello', 'helo', 'yo', 'sup', 'hiya', 'howdy', 'greeting', 'good', 'morning', 'afternoon', 'evening', 'day', 'namaste', 'namaskar', 'kem', 'cho', 'kemcho', 'there', 'assistant', 'bot', 'hologram', 'everyone'].map(stem));
const ROUTE_WORDS = 'salary compensation phone address girlfriend boyfriend weather translate poem joke assistant chatbot agent gpa grades transcript homework available internship keystroke roblox bravox quest diagnostics pittsburgh graduate graduation dunkin donuts favorite favourite recently channels subscribers summer engineer engineering hologram website portfolio python javascript typescript postgresql fastapi streamlit machine learning resume linkedin github email contact experience projects';

// Curated evidence for "does he know X" questions. Every sentence is backed by
// the entries listed in ids, which become the answer's sources.
const SKILLS = [
  { re: /\bpython\b/, ev: "Python is one of his core languages: it runs Bravox's FastAPI backend, his scikit-learn sleep model, and his YouTube ranking service, and he automated workflows with it at Mascaro.", ids: ['stack', 'bravox-arch', 'sleep'] },
  { re: /\bpostgres(ql)?\b|\bpsql\b/, ev: 'He builds dimensional PostgreSQL models at Quest, and Bravox and his YouTube algorithm both run on PostgreSQL.', ids: ['quest', 'bravox-arch', 'youtube'] },
  { re: /\bsql\b/, ev: 'At Quest he builds 10+ CTE-based dimensional SQL and PostgreSQL models that turn raw source data into analytics tables.', ids: ['quest', 'stack'] },
  { re: /\brlang\b/, ev: 'R is on his resume; at Mascaro he improved cost-comparison accuracy by analyzing labor and pricing data in R.', ids: ['mascaro', 'stack'] },
  { re: /\bjava\b/, ev: 'Java is one of the languages on his resume.', ids: ['stack'] },
  { re: /\bjavascript\b|\bjs\b|\btypescript\b/, ev: "JavaScript and TypeScript are on his resume, and Bravox's frontend is a Next.js and TypeScript app.", ids: ['stack', 'bravox-arch'] },
  { re: /\bswift(ui)?\b|\bios\b|\bxcode\b/, ev: 'He built Keystroke, an iOS app, with Swift and SwiftUI.', ids: ['keystroke', 'stack'] },
  { re: /\breact(js)?\b/, ev: 'His YouTube algorithm serves a React front end, and Bravox is built on Next.js, a React framework.', ids: ['youtube', 'bravox-arch'] },
  { re: /\bangular\b/, ev: 'Angular is one of the frameworks on his resume.', ids: ['stack'] },
  { re: /\bnextjs\b/, ev: "Bravox's frontend is a Next.js and TypeScript app on Vercel.", ids: ['bravox-arch'] },
  { re: /\bnodejs\b|\bnode\b/, ev: 'Node.js is one of the frameworks on his resume.', ids: ['stack'] },
  { re: /\bfastapi\b|\bfast api\b/, ev: "FastAPI powers Bravox's backend, Keystroke's pass-signing backend, and his YouTube ranking endpoint.", ids: ['bravox-arch', 'keystroke', 'youtube'] },
  { re: /\bstreamlit\b/, ev: 'His sleep dashboard is an interactive Streamlit app.', ids: ['sleep'] },
  { re: /\bpandas\b|\bnumpy\b/, ev: 'Pandas and NumPy run through his data work, from the sleep pipeline to his earlier water-quality analysis.', ids: ['sleep', 'stack'] },
  { re: /\bscikit( learn)?\b|\bsklearn\b|\brandom forests?\b/, ev: 'His sleep model is a scikit-learn Random Forest that reaches 93% accuracy on nightly sleep scores.', ids: ['sleep'] },
  { re: /\bshap\b/, ev: "He uses SHAP to explain his sleep model's predictions feature by feature.", ids: ['sleep'] },
  { re: /\bdocker\b|\bcontainers?\b/, ev: 'Docker is in his toolkit.', ids: ['stack', 'cloud'] },
  { re: /\bazure\b|\bfabric\b/, ev: 'At Quest he owns 5 production data pipelines on Microsoft Fabric and Azure.', ids: ['quest', 'quest-stack'] },
  { re: /\bonelake\b/, ev: 'As a summer intern at Quest he migrated legacy workflows into Azure OneLake, speeding up data integration by 25%.', ids: ['quest-intern'] },
  { re: /\baws\b|\bamazon web services\b/, ev: "He's Technical Chair of the AWS Cloud Club, where he leads workshops on AWS services, cloud architecture, and deployment.", ids: ['aws-club', 'cloud'] },
  { re: /\bhuggingface\b/, ev: 'Hugging Face is in his toolkit.', ids: ['stack', 'ml'] },
  { re: /\bpowerbi\b/, ev: 'Power BI is one of the technologies on his resume.', ids: ['stack'] },
  { re: /\bgit\b|\bgithub\b|\bversion control\b/, ev: 'Git and GitHub are part of his everyday stack; his projects live at github.com/AbhiKanani07.', ids: ['stack', 'contact'] },
  { re: /\bredis\b/, ev: 'His YouTube content algorithm caches ranked results in Redis.', ids: ['youtube'] },
  { re: /\bcicd\b|\bci cd\b|\bcontinuous (integration|deployment)\b/, ev: 'At Quest he extends CI/CD ingestion that processes 1,000+ daily jobs, and as an intern he raised deployment efficiency by 30% with automated CI/CD.', ids: ['quest', 'quest-intern'] },
  { re: /\brest ?(ful|apis?)\b|\brestful\b/, ev: 'Keystroke and his YouTube algorithm both run on REST APIs served by FastAPI.', ids: ['keystroke', 'youtube'] },
  { re: /\bvercel\b|\bneon\b/, ev: "Bravox's frontend runs on Vercel, its API on Render, and its PostgreSQL database on Neon.", ids: ['bravox-arch'] },
  { re: /\bexcel\b|\bcopilot\b/, ev: 'At Mascaro he cut manual Excel processing time by 40% by automating workflows with Python and Copilot.', ids: ['mascaro'] },
  { re: /\bvfx\b|\bvisual effects\b|\bvideo editing\b/, ev: 'He did the VFX for his own YouTube channels, one of which passed 100 subscribers.', ids: ['channels'] },
  { re: /\broblox\b/, ev: 'He loves Roblox; the In between section on this page searches his Roblox library.', ids: ['roblox'] },
  { re: /\bmachine learning\b|\bml\b/, ev: 'His applied ML includes a Random Forest at 93% accuracy on nightly sleep scores, explained with SHAP, and a content-based ranking engine for YouTube.', ids: ['ml', 'sleep'] },
];

const LETTERS = /\p{L}/gu;
const LATIN = /[a-z\u00c0-\u024f]/gi;
const INDIC = /[\u0900-\u097f\u0a80-\u0aff]/;
const NAMASTE = /नमस्ते|नमस्कार|નમસ્તે|કેમ છો/;
const looksRandom = (w) => w.length >= 5 && (!/[aeiouy]/.test(w) || /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|zxcv|xcvb|uiop)/.test(w) || /(.)\1{3,}/.test(w));
const ym = (d) => [d.getFullYear(), d.getMonth() + 1];
const span = (a, b) => (b[0] - a[0]) * 12 + (b[1] - a[1]);
const USEFUL = new Set(['answer', 'skill', 'duration', 'private', 'confidential', 'unknown-term', 'time', 'flagship', 'assistant', 'name', 'followup']);

export function createEngine(kb, { now = () => new Date() } = {}) {
  let entries; let byId; let docs; let N; let avgLen; let df; let rawVocab; let rawList;

  function index(list) {
    entries = list;
    byId = new Map(entries.map((e) => [e.id, e]));
    docs = entries.map((e) => {
      const tf = new Map();
      const all = new Set();
      let len = 0;
      for (const [field, weight] of FIELDS) {
        for (const t of analyze(e[field] || '')) { tf.set(t, (tf.get(t) || 0) + weight); all.add(t); len += weight; }
      }
      return { e, tf, all, len };
    });
    N = docs.length;
    avgLen = docs.reduce((s, d) => s + d.len, 0) / N;
    df = new Map();
    docs.forEach((d) => d.all.forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
    rawVocab = new Map();
    const add = (w) => { if (w.length >= 3 && !STOP.has(w)) rawVocab.set(w, (rawVocab.get(w) || 0) + 1); };
    entries.forEach((e) => ['title', 'keywords', 'short', 'body'].forEach((f) => words(e[f] || '').forEach(add)));
    ROUTE_WORDS.split(' ').forEach(add);
    rawList = Array.from(rawVocab.keys()).filter((w) => w.length >= 4);
  }
  index(kb.entries);

  const idf = (t) => { const n = df.get(t) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); };
  const ref = (e) => ({ id: e.id, title: e.title, href: e.href });
  const src = (ids) => ids.map((id) => byId.get(id)).filter(Boolean).map(ref);
  const known = (w) => rawVocab.has(w) || df.has(stem(w));
  const topicOf = (ids) => { const e = ids.map((id) => byId.get(id)).find(Boolean); return e ? e.topic : 'core'; };

  // Spelling: map unknown words to the nearest word in the record.
  function correct(norm) {
    const fixes = [];
    const text = norm.split(' ').map((w) => {
      if (w.length < 5 || STOP.has(w) || rawVocab.has(w) || TECH.has(w) || /\d/.test(w)) return w;
      const max = w.length >= 8 ? 2 : 1;
      let best = null;
      let bestD = max + 1;
      for (const v of rawList) {
        if (Math.abs(v.length - w.length) > max) continue;
        if (max === 1 && v[0] !== w[0]) continue;
        const d = editDistance(w, v, max);
        if (d < bestD || (d === bestD && best && rawVocab.get(v) > rawVocab.get(best))) { best = v; bestD = d; }
      }
      if (best && bestD <= max) { fixes.push([w, best]); return best; }
      return w;
    }).join(' ');
    return { text, fixes };
  }

  function unknownTech(norm, raw) {
    const m = norm.match(RX.techAsk);
    if (!m) return null;
    const parts = m[1].split(' ').filter((w) => !STOP.has(w));
    if (!parts.length) return null;
    const joined = parts.join('');
    const w = TECH.has(joined) ? joined : parts[0];
    if (known(w)) return null;
    if (!TECH.has(w) && !/[0-9.+#]/.test(w)) return null;
    let display = PRETTY[w];
    if (!display) {
      const hit = String(raw).match(new RegExp(`\\b${w.replace(/[.+#]/g, '\\$&')}\\b`, 'i'));
      const typed = hit ? hit[0] : w;
      display = /[A-Z]/.test(typed) ? typed : typed.charAt(0).toUpperCase() + typed.slice(1);
    }
    return { term: w, display };
  }

  function durationAnswer(norm) {
    const n = ym(now());
    if (/\bquest\b|\bdiagnostics\b/.test(norm)) return { text: `He joined Quest Diagnostics in June 2026 for a summer internship as a Data Analytics Intern, then stayed on part-time as an Enterprise Data Engineer in August 2026. That's ${months(Math.max(0, span([2026, 6], n)))} at Quest so far.`, ids: ['quest-overview'] };
    if (/\bdunkin\b|\bdonuts?\b/.test(norm)) return { text: "He worked at Dunkin' from January to August 2025, about eight months, during his senior year of high school.", ids: ['dunkin'] };
    if (/\bmascaro\b/.test(norm)) return { text: 'He was a Data Analyst Intern at Mascaro Construction from March to May 2025, about three months.', ids: ['mascaro'] };
    if (/\baws\b|\bcloud club\b/.test(norm)) return { text: `He's been Technical Chair of the AWS Cloud Club since September 2026, ${months(Math.max(0, span([2026, 9], n)))}.`, ids: ['aws-club'] };
    if (/\bphi beta\b|\bpbl\b|\bvice president\b|\bvp\b/.test(norm)) return { text: `He's been Vice President of Finance of Phi Beta Lambda since April 2026, ${months(Math.max(0, span([2026, 4], n)))}.`, ids: ['pbl'] };
    if (/\bpitt\b|\bcollege\b|\buniversity\b|\bgraduat|\bschool\b|\bdegree\b|\bstudying\b/.test(norm)) return { text: 'He started at the University of Pittsburgh in fall 2025 and is on track to graduate in December 2028.', ids: ['year'] };
    return null;
  }

  function single(raw, o, ctx, corrections) {
    const R = kb.replies;
    const low = raw.toLowerCase();
    const fixed = correct(normalize(raw));
    fixed.fixes.forEach((f) => corrections.push(f));
    const norm = fixed.text;
    const tokens = analyze(norm);
    const trace = { question: raw, normalized: norm, corrections: fixed.fixes, tokens, expanded: [], candidates: [], kept: [], decision: '', confidence: 0 };
    const out = (route, text, extra = {}) => ({ route, text, topic: 'core', sources: [], confidence: 0, ranked: [], trace: { ...trace, decision: extra.decision || route }, ...extra });

    // 1. Shape of the input
    if (!/[\p{L}\p{N}]/u.test(raw)) return out('empty', R.empty);
    const letters = (raw.match(LETTERS) || []).length;
    const latin = (raw.match(LATIN) || []).length;
    if (letters && latin < letters / 2) {
      if (NAMASTE.test(raw)) return out('greeting', R.namaste);
      return out('language', INDIC.test(raw) ? R.languageIndic : R.language, { decision: 'not in English' });
    }
    // 2. Guards that always apply
    if (RX.injection.test(norm)) return out('injection', R.injection, { decision: 'declined: tries to change the rules' });
    if (RX.abuse.test(norm)) return out('abuse', R.abuse, { decision: 'declined: abusive language' });
    // 3. Conversation
    if (RX.greeting.test(norm) && tokens.every((t) => GREET.has(t))) return out('greeting', /namaste|namaskar/.test(norm) ? R.namaste : /kem ?cho/.test(norm) ? R.kemcho : R.greeting);
    if (RX.thanks.test(norm) && norm.split(' ').length <= 5 && !RX.person.test(norm)) return out('thanks', R.thanks);
    if (RX.help.test(norm)) return out('help', R.help);
    if (RX.assistantMeta.test(norm)) { const e = byId.get('assistant'); return out('assistant', e.body, { topic: 'core', sources: o.cite ? [ref(e)] : [], decision: 'about the assistant itself' }); }
    if (RX.identity.test(norm)) return out('identity', R.identity, { sources: o.cite ? src(['assistant']) : [] });
    if (RX.name.test(norm)) return out('name', byId.get('name').body, { sources: o.cite ? src(['summary']) : [] });
    if (RX.comparison.test(norm)) return out('comparison', R.comparison, { decision: 'declined: comparison with other people' });
    // 4. Privacy
    if (o.blockPrivate) {
      if (RX.others.test(norm)) return out('private', R.private.personal, { decision: 'declined: other people', sources: o.cite ? src(['contact']) : [] });
      for (const [kind, re] of PRIVATE) if (re.test(norm)) return out('private', R.private[kind], { decision: `declined: private (${kind})`, sources: o.cite ? src([kind === 'age' ? 'year' : kind === 'transcript' ? 'gpa' : 'contact']) : [] });
      if (RX.quest.test(norm) && RX.questDetail.test(norm)) { const e = byId.get('quest-private'); return out('confidential', e.body, { decision: 'declined: internal Quest details', topic: 'pipelines', sources: o.cite ? [ref(e)] : [], confidence: 1 }); }
    }
    if (RX.task.test(norm) || RX.task.test(low.replace(/\b5\s*\/\s*24\b/g, ''))) return out('task', R.task, { decision: 'declined: not about Abhi' });
    // 5. Computed answers
    if (RX.time.test(norm)) {
      const d = now();
      const t = `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(d)}, ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(d)}`;
      return out('time', `It's ${t} in Pittsburgh right now. For his availability, email him at arkanani2mail@gmail.com.`, { sources: o.cite ? src(['contact']) : [] });
    }
    if (RX.duration.test(norm)) { const d = durationAnswer(norm); if (d) return out('duration', d.text, { topic: topicOf(d.ids), sources: o.cite ? src(d.ids) : [], used: d.ids, href: (byId.get(d.ids[0]) || {}).href }); }
    // 6. Follow-ups
    if (RX.followup.test(norm)) {
      if (!ctx.last) return out('help', R.noContext);
      const pool = (ctx.last.ranked || []).filter((c) => !ctx.shown.has(c.id) && c.match >= 0.2 && byId.has(c.id));
      const next = pool.find((c) => byId.get(c.id).href === ctx.last.href) || pool[0];
      if (!next) return out('followup', R.exhausted, { decision: 'nothing new on this topic' });
      const e = byId.get(next.id);
      return out('followup', e.body, { decision: 'continues the previous topic', topic: e.topic, sources: o.cite ? [ref(e)] : [], href: e.href, used: [e.id], confidence: next.match });
    }
    // 7. "Does he know X?"
    if (RX.yesno.test(norm) || RX.skillVerb.test(norm) || RX.judge.test(norm)) {
      const sk = SKILLS.find((s) => s.re.test(norm));
      if (sk) {
        const lead = RX.yesno.test(norm) && !RX.judge.test(norm) ? 'Yes. ' : '';
        return out('skill', lead + sk.ev, { topic: topicOf(sk.ids), sources: o.cite ? src(sk.ids) : [], used: sk.ids, href: (byId.get(sk.ids[0]) || {}).href, confidence: 1, decision: 'evidence from the record' });
      }
    }
    if (RX.otherFavorite.test(norm)) return out('not-found', R.notFound, { decision: 'personal preference that is not published', sources: o.cite ? src(['interests']) : [] });
    if (RX.ownCompare.test(norm)) { const e = byId.get('flagship'); return out('flagship', e.body, { topic: e.topic, sources: o.cite ? src(['bravox', 'keystroke', 'sleep']) : [] }); }
    const tech = unknownTech(norm, raw);
    if (tech) {
      if (RX.quest.test(norm)) return out('unknown-term', fill(R.questTech, { term: tech.display }), { decision: `"${tech.display}" isn't in the record`, topic: 'pipelines', sources: o.cite ? src(['quest-stack']) : [] });
      return out('unknown-term', fill(R.unknownTerm, { term: tech.display, stack: byId.get('stack').short }), { decision: `"${tech.display}" isn't in the record`, topic: 'systems', sources: o.cite ? src(['stack']) : [] });
    }

    // 8. Retrieval
    const boosts = new Map();
    for (const [re, id, w] of BOOSTS) if (byId.has(id) && re.test(norm)) boosts.set(id, Math.max(boosts.get(id) || 0, w));
    const personal = RX.person.test(norm);
    if (!tokens.length && !boosts.size) return out(personal ? 'not-found' : 'offtopic', personal ? R.notFound : R.offtopic, { decision: 'no content words to search for' });
    if (!boosts.size && tokens.every((t) => !df.has(t)) && norm.split(' ').some(looksRandom)) return out('gibberish', R.gibberish, { decision: 'unreadable input' });

    const anaphora = RX.pronoun.test(norm) && ctx.last && ctx.last.href ? ctx.last.href : null;
    const weights = new Map(tokens.map((t) => [t, 1]));
    const added = anaphora ? [] : expand(tokens);
    added.forEach((t) => { if (!weights.has(t)) weights.set(t, EXPANDED_WEIGHT); });
    trace.expanded = added;
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
      return { id: d.e.id, title: d.e.title, e: d.e, score, match, rank: score * (0.65 + 0.35 * coverage) };
    }).filter((c) => c.score > 0).sort((a, b) => b.rank - a.rank);

    const kept = ranked.filter((c) => c.match >= o.minMatch).slice(0, o.topK);
    trace.kept = kept.map((c) => c.id);
    trace.candidates = ranked.slice(0, 8).map((c) => ({ id: c.id, title: c.title, score: c.score, match: c.match, status: c.match < o.minMatch ? 'below minimum' : kept.includes(c) ? 'kept' : 'over the limit' }));
    const lean = ranked.map((c) => ({ id: c.id, match: c.match }));
    const top = kept[0];
    trace.confidence = top ? top.match : ranked[0] ? ranked[0].match : 0;
    if (!top || top.match < o.floor) {
      if (!tokens.some((t) => df.has(t)) && !personal && !boosts.size) return out('offtopic', R.offtopic, { trace: { ...trace, decision: 'off-topic: no overlap with the record' }, decision: 'off-topic: no overlap with the record', ranked: lean });
      let text = R.notFound;
      const sources = [];
      if (ranked[0] && ranked[0].match >= 0.18) { text += ` ${fill(R.closest, { title: ranked[0].title })}`; if (o.cite) sources.push(ref(ranked[0].e)); }
      return out('not-found', text, { decision: top ? `confidence ${top.match.toFixed(2)} is under the floor ${o.floor.toFixed(2)}` : 'nothing cleared the minimum match', sources, ranked: lean, confidence: trace.confidence });
    }
    const used = [top];
    const parts = [o.detail >= 2 ? top.e.body : top.e.short];
    for (const c of kept.slice(1)) {
      if (o.detail >= 3 && c.match >= 0.6 * top.match) { parts.push(c.e.short); used.push(c); }
      else if (o.detail === 2 && used.length < 2 && c.match >= 0.92 * top.match) { parts.push(c.e.short); used.push(c); }
    }
    trace.composedFrom = used.map((c) => c.id);
    return out('answer', parts.join(' '), { decision: `confidence ${top.match.toFixed(2)} clears the floor ${o.floor.toFixed(2)}`, topic: top.e.topic, sources: o.cite ? used.map((c) => ref(c.e)) : [], href: top.e.href, ranked: lean, used: used.map((c) => c.id), confidence: top.match, trace: { ...trace, decision: `confidence ${top.match.toFixed(2)} clears the floor ${o.floor.toFixed(2)}` } });
  }

  // Questions with several parts ("his stack and his GPA") are answered part by part.
  function splitIntents(raw) {
    const pieces = raw.split(/[?;!]+|\.\s+/).flatMap((s) => s.split(/\s+(?:and also|as well as|and|also|plus|&)\s+/i)).map((s) => s.trim()).filter((s) => /[a-z0-9]/i.test(s));
    return pieces.length >= 2 && pieces.length <= 4 ? pieces : null;
  }
  const keyOf = (r) => `${r.route}:${(r.used && r.used[0]) || r.text.slice(0, 40)}`;

  function ask(question, options = {}, ctx = {}) {
    const o = { ...DEFAULTS, ...options };
    const t0 = clock();
    const full = String(question || '').replace(/\s+/g, ' ').trim();
    const raw = full.slice(0, 300);
    const corrections = [];
    let result = single(raw, o, ctx, corrections);
    const segs = !['injection', 'abuse', 'language', 'empty', 'greeting', 'help'].includes(result.route) ? splitIntents(raw) : null;
    if (segs) {
      let c = ctx;
      const subs = [];
      for (const s of segs) {
        const r = single(s, o, c, []);
        if (USEFUL.has(r.route)) { subs.push(r); c = remember(c, r); }
      }
      const distinct = subs.filter((r, i) => subs.findIndex((x) => keyOf(x) === keyOf(r)) === i);
      if (distinct.length >= 2) {
        const text = distinct.map((r) => (r.route === 'answer' && r.used ? (byId.get(r.used[0]).short) : r.text)).join(' ');
        const sources = [];
        distinct.forEach((r) => r.sources.forEach((s) => { if (!sources.some((x) => x.id === s.id)) sources.push(s); }));
        const last = distinct[distinct.length - 1];
        result = { ...distinct[0], route: 'multi', text, sources, used: distinct.flatMap((r) => r.used || []), href: last.href || distinct[0].href, ranked: last.ranked || [], confidence: Math.min(...distinct.map((r) => r.confidence || 1)), trace: { ...result.trace, decision: `answered ${distinct.length} parts separately`, segments: distinct.map((r) => r.route) } };
      }
    }
    result.trace = { ...result.trace, route: result.route, params: o, ms: clock() - t0, clipped: full.length > raw.length, corrections };
    return result;
  }

  function remember(ctx, result) {
    if (!['answer', 'followup', 'skill', 'duration', 'multi'].includes(result.route)) return ctx;
    const fresh = result.route !== 'followup';
    const shown = fresh ? new Set() : new Set(ctx.shown || []);
    (result.used || []).forEach((id) => shown.add(id));
    return { last: { ranked: fresh ? result.ranked : (ctx.last ? ctx.last.ranked : []), href: result.href || (ctx.last && ctx.last.href) }, shown };
  }

  // Add or replace entries at runtime (the Roblox library arrives after load).
  function extend(extra) {
    const ids = new Set(extra.map((e) => e.id));
    index(entries.filter((e) => !ids.has(e.id)).concat(extra));
  }

  return { ask, remember, extend, get size() { return N; }, get terms() { return df.size; }, get entries() { return entries; } };
}
