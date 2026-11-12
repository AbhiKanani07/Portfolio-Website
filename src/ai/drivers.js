import { streamText } from "../core/stream.js";
import { buildSystemPrompt } from "./prompt.js";
const LOCAL_ONLY = new Set(["empty", "injection", "abuse", "language", "greeting", "thanks", "help", "identity", "assistant", "name", "comparison", "private", "confidential", "task", "gibberish", "time", "duration", "skill", "flagship", "followup"]);
function localDriver() {
  return {
    name: "local retrieval",
    run(question, local, cb) {
      let cancelled = false;
      let ctl = null;
      const pause = cb.instant ? 0 : 180 + Math.min(260, local.trace.candidates.length * 30);
      const t = setTimeout(() => {
        if (cancelled) return;
        cb.onEngine && cb.onEngine("local retrieval");
        cb.onStart && cb.onStart();
        ctl = streamText(local.text, { onToken: cb.onToken, onDone: () => cb.onDone(local.text), instant: cb.instant });
      }, pause);
      return { cancel() {
        cancelled = true;
        clearTimeout(t);
        if (ctl) ctl.cancel();
      } };
    }
  };
}
function endpointDriver(url, fallback) {
  return {
    name: "model via endpoint",
    run(question, local, cb) {
      if (LOCAL_ONLY.has(local.route)) return fallback.run(question, local, cb);
      const ac = new AbortController();
      let cancelled = false;
      let fb = null;
      let text = "";
      const timer = setTimeout(() => ac.abort(), 2e4);
      (async () => {
        try {
          const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }), signal: ac.signal });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          cb.onEngine && cb.onEngine("model via endpoint");
          cb.onStart && cb.onStart();
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          for (; ; ) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) {
              text += chunk;
              cb.onToken(chunk);
            }
          }
          clearTimeout(timer);
          if (!cancelled) cb.onDone(text);
        } catch (err) {
          clearTimeout(timer);
          if (cancelled) return;
          if (text) {
            cb.onDone(text);
            return;
          }
          fb = fallback.run(question, local, cb);
        }
      })();
      return { cancel() {
        cancelled = true;
        ac.abort();
        if (fb) fb.cancel();
      } };
    }
  };
}
function pickDriver(kb, { endpoint } = {}) {
  const local = localDriver();
  if (endpoint) return endpointDriver(endpoint, local);
  return local;
}
export {
  endpointDriver,
  localDriver,
  pickDriver
};
