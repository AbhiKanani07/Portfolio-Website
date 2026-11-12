import { KB } from "../src/ai/knowledge.js";
import { createEngine } from "../src/ai/engine.js";
import { MODEL } from "../src/ai/model.js";
import { createModel } from "../src/ai/ml.js";
const eng = createEngine(KB, { now: () => new Date("2026-11-11T21:00:00Z"), model: createModel(MODEL) });
import { CASES as T } from "./cases.mjs";
let pass = 0;
const fails = [];
for (const [q, want] of T) {
  const r = eng.ask(q);
  const got = ["answer", "followup"].includes(r.route) ? (r.used || [])[0] : r.route;
  if (want.split("|").includes(got)) pass++;
  else fails.push(`MISS want=${want.padEnd(16)} got=${String(got).padEnd(16)} ${q}  -> ${r.text.slice(0, 70)}`);
}
fails.forEach((f) => console.log(f));
console.log(`${pass}/${T.length} as expected`);
let ctx = {};
for (const q of ["What is Bravox?", "How does it work?", "why", "tell me more about it", "Tell me about Bravox and its odds"]) {
  const r = eng.ask(q, {}, ctx);
  ctx = eng.remember(ctx, r);
  console.log(`chain ${r.route.padEnd(9)} ${String((r.used || [])[0]).padEnd(16)} ${q}`);
}
for (const q of ["Does he know pyhton?", "How long has he been at Quest?", "What's his salary and his stack?", "how is your agent coded", "What time is it there?"]) {
  const r = eng.ask(q);
  console.log(`
${q}
  -> ${r.text}
  corrections=${JSON.stringify(r.trace.corrections)} sources=${r.sources.map((s) => s.id).join(",")}`);
}
