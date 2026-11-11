// Text analysis for retrieval: normalization, stopwords, a light stemmer, and
// synonym groups. The same functions index the record and read the question,
// which is what keeps matching consistent.

export const STOP = new Set(`a an the and or but if then else of to in on at by for with from as is are was were be been being am do does did doing done have has had having it its this that these those there here what whats which who whos whom whose when where why how can could would should will shall may might must i me my mine we us our ours you your yours he hes him his she her hers they them their theirs about tell know any some more most much many very just also than so not no yes please give show explain describe let lets get got abhi abhis kanani kananis im ive id youre theyre thats theres heres dont doesnt didnt isnt arent wasnt cant wont into onto over under out up down off again once all both each few other such only own same too like really`.split(/\s+/));

const IRREGULAR = {
  built: 'build', building: 'build', builds: 'build', made: 'make', makes: 'make', making: 'make',
  ran: 'run', running: 'run', runs: 'run', worked: 'work', working: 'work', works: 'work',
  studies: 'study', studying: 'study', studied: 'study', used: 'use', using: 'use', uses: 'use',
  led: 'lead', leading: 'lead', leads: 'lead', spoke: 'speak', speaks: 'speak', spoken: 'speak', speaking: 'speak',
  lives: 'live', living: 'live', lived: 'live', hiring: 'hire', hired: 'hire', hires: 'hire',
  fluent: 'fluent', fluency: 'fluent', data: 'data', os: 'os', ai: 'ai', ml: 'ml', ux: 'ux', ui: 'ui', bravox: 'bravox',
};

export function stem(word) {
  const w = word;
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length <= 3 || /\d/.test(w)) return w;
  let s = w;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('sses')) s = s.slice(0, -2);
  else if (/(ches|shes|xes|zes)$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s') && !/(ss|us|is|os)$/.test(s)) s = s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2);
  else if (s.endsWith('ly') && s.length > 5) s = s.slice(0, -2);
  if (/([b-df-hj-np-tv-z])\1$/.test(s) && !/(ll|ss|zz)$/.test(s)) s = s.slice(0, -1);
  if (s.endsWith('e') && s.length > 4) s = s.slice(0, -1);
  return s;
}

export function normalize(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/next\.?js/g, 'nextjs')
    .replace(/node\.?js/g, 'nodejs')
    .replace(/c\+\+/g, 'cplusplus')
    .replace(/c#/g, 'csharp')
    .replace(/\b5\s*\/\s*24\b/g, 'fivetwentyfour')
    .replace(/\bfive[\s-]*twenty[\s-]*four\b/g, 'fivetwentyfour')
    .replace(/\b(in|use|uses|know|knows|with|and|language|languages) r\b/g, '$1 rlang')
    .replace(/\br (language|programming|studio)\b/g, 'rlang $1')
    .replace(/\ba\.m\./g, 'am')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/'s\b/g, '')
    .replace(/'/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function words(input) {
  const n = normalize(input);
  return n ? n.split(' ') : [];
}

export function analyze(input) {
  return words(input)
    .filter((w) => !STOP.has(w))
    .map(stem)
    .filter((w) => w.length > 1 || /\d/.test(w));
}

const GROUPS = [
  'job work intern internship employer role position career company',
  'school college university pitt study student major degree education class course coursework',
  'stack tech technology tool skill framework programming code coding language',
  'bravox credit card approval odds',
  'contact email reach message connect linkedin',
  'project portfolio build ship shipped made',
  'youtube recommendation algorithm feed video',
  'sleep fitbit health hrv night',
  'water netherlands dutch river',
  'lead leadership leader president club organization',
  'hobby hobbies fun sport sports gym weekend',
  'design designer ui ux visual interface frontend aesthetic',
  'ai ml machine learning model artificial intelligence',
  'secure security privacy safe hash hashing',
  'accurate accuracy reliable trust correct',
  'money revenue monetized monetization profit business',
  'goal looking seeking want opportunity hire future',
].map((g) => Array.from(new Set(g.split(' ').map(stem))));

const INDEX = new Map();
GROUPS.forEach((g, gi) => g.forEach((t) => {
  if (!INDEX.has(t)) INDEX.set(t, []);
  INDEX.get(t).push(gi);
}));

// Synonyms for the analyzed terms, excluding the terms themselves.
export function expand(terms) {
  const out = new Set();
  for (const t of terms) {
    for (const gi of INDEX.get(t) || []) GROUPS[gi].forEach((x) => { if (!terms.includes(x)) out.add(x); });
  }
  return Array.from(out);
}
