import { readFile, writeFile } from "node:fs/promises";
const file = process.argv[2];
if (!file) {
  console.log("Usage: node tools/feedback.mjs <export.json or export.csv>");
  process.exit(0);
}
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let f = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') quoted = false; else f += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...rest] = rows.filter((r) => r.some((x) => x !== ""));
  return rest.map((r) => Object.fromEntries(head.map((k, i) => [k.trim(), r[i]])));
};
const raw = await readFile(file, "utf8");
let rows = file.toLowerCase().endsWith(".csv") ? parseCSV(raw) : JSON.parse(raw);
if (!Array.isArray(rows)) rows = rows.submissions || rows.data || [];
const yes = (v) => v === true || v === "true" || v === "1" || v === 1 || v === "yes";
const incoming = rows.map((r) => ({ question: String(r.question || "").trim(), entry: String(r.entry || "").trim(), route: String(r.route || ""), helpful: yes(r.helpful), at: String(r.at || r._date || r.created_at || "") })).filter((r) => r.question);
const out = new URL("./feedback.json", import.meta.url);
const prev = JSON.parse(await readFile(out, "utf8").catch(() => "[]"));
const key = (r) => `${r.question.toLowerCase()}|${r.entry}|${r.helpful}|${r.at}`;
const seen = new Set(prev.map(key));
const added = incoming.filter((r) => !seen.has(key(r)));
const all = prev.concat(added);
await writeFile(out, `${JSON.stringify(all, null, 2)}\n`);
const good = all.filter((r) => r.helpful).length;
console.log(`${all.length} ratings saved to tools/feedback.json (${added.length} new), ${all.length ? Math.round((good / all.length) * 100) : 0}% marked helpful.`);
const bad = all.filter((r) => !r.helpful).slice(-12);
if (bad.length) {
  console.log("Marked not helpful. Improve these by adding keywords or a better entry in src/ai/knowledge.js:");
  bad.forEach((r) => console.log(`  "${r.question}"  answered from: ${r.entry || r.route}`));
}
console.log("Helpful ratings become training questions the next time you run node tools/train.mjs.");
