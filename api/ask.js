import { SYSTEM } from "./knowledge.js";
const config = { runtime: "edge" };
const MODEL = process.env.ASK_MODEL || "claude-haiku-5-5";
const ALLOWED = (process.env.ALLOWED_ORIGINS || "https://abhikanani07.github.io").split(",").map((s) => s.trim()).filter(Boolean);
const PER_MINUTE = 8;
const hits = new Map();
function allow(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 6e4);
  if (recent.length >= PER_MINUTE) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5e3) hits.clear();
  return true;
}
function sseToText() {
  let buf = "";
  return new TransformStream({
    transform(chunk, out) {
      buf += chunk.replace(/\r\n/g, "\n");
      let i;
      while ((i = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") out.enqueue(ev.delta.text);
          } catch (e) {
          }
        }
      }
    }
  });
}
async function handler(req) {
  const origin = req.headers.get("origin") || "";
  const ok = ALLOWED.includes(origin);
  const cors = { "access-control-allow-origin": ok ? origin : ALLOWED[0] || "", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "origin" };
  const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Send a POST request." }, 405);
  if (!ok) return json({ error: "This origin is not allowed." }, 403);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not set." }, 500);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!allow(ip)) return json({ error: "Too many questions. Try again in a minute." }, 429);
  let question = "";
  try {
    const body = await req.json();
    question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  } catch (e) {
    return json({ error: 'Send JSON like {"question": "..."}.' }, 400);
  }
  if (!question) return json({ error: "The question is empty." }, 400);
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, stream: true, system: SYSTEM, messages: [{ role: "user", content: question }] })
  });
  if (!upstream.ok || !upstream.body) return json({ error: `The model request failed (${upstream.status}).` }, 502);
  const text = upstream.body.pipeThrough(new TextDecoderStream()).pipeThrough(sseToText()).pipeThrough(new TextEncoderStream());
  return new Response(text, { headers: { ...cors, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
export {
  config,
  handler as default
};
