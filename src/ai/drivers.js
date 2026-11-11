// Who writes the words. The local engine always runs first: it decides the
// route, sources, and hologram shape. A driver then delivers the text.
//   local     paces the engine's own answer (default, works anywhere)
//   endpoint  streams from your deployed function (set <meta name="ask-endpoint">)
//   preview   calls Claude directly, only inside the claude.ai artifact preview
import { streamText } from '../core/stream.js';
import { buildSystemPrompt } from './prompt.js';

// Questions the guard already answered never go to a model.
const LOCAL_ONLY = new Set(['empty', 'injection', 'greeting', 'thanks', 'identity', 'comparison', 'private', 'confidential', 'followup']);

export function localDriver() {
  return {
    name: 'local retrieval',
    run(question, local, cb) {
      let cancelled = false;
      let ctl = null;
      const pause = cb.instant ? 0 : 180 + Math.min(260, local.trace.candidates.length * 30);
      const t = setTimeout(() => {
        if (cancelled) return;
        cb.onEngine && cb.onEngine('local retrieval');
        cb.onStart && cb.onStart();
        ctl = streamText(local.text, { onToken: cb.onToken, onDone: () => cb.onDone(local.text), instant: cb.instant });
      }, pause);
      return { cancel() { cancelled = true; clearTimeout(t); if (ctl) ctl.cancel(); } };
    },
  };
}

export function endpointDriver(url, fallback) {
  return {
    name: 'model via endpoint',
    run(question, local, cb) {
      if (LOCAL_ONLY.has(local.route)) return fallback.run(question, local, cb);
      const ac = new AbortController();
      let cancelled = false;
      let fb = null;
      let text = '';
      const timer = setTimeout(() => ac.abort(), 20000);
      (async () => {
        try {
          const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }), signal: ac.signal });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          cb.onEngine && cb.onEngine('model via endpoint');
          cb.onStart && cb.onStart();
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) { text += chunk; cb.onToken(chunk); }
          }
          clearTimeout(timer);
          if (!cancelled) cb.onDone(text);
        } catch (err) {
          clearTimeout(timer);
          if (cancelled) return;
          if (text) { cb.onDone(text); return; }
          fb = fallback.run(question, local, cb);
        }
      })();
      return { cancel() { cancelled = true; ac.abort(); if (fb) fb.cancel(); } };
    },
  };
}

export function previewDriver(kb, fallback) {
  const system = buildSystemPrompt(kb);
  return {
    name: 'Claude (preview)',
    run(question, local, cb) {
      if (LOCAL_ONLY.has(local.route)) return fallback.run(question, local, cb);
      let cancelled = false;
      let ctl = null;
      let fb = null;
      (async () => {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system, messages: [{ role: 'user', content: question }] }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
          if (!text) throw new Error('empty response');
          if (cancelled) return;
          cb.onEngine && cb.onEngine('Claude (preview)');
          cb.onStart && cb.onStart();
          ctl = streamText(text, { onToken: cb.onToken, onDone: () => cb.onDone(text), instant: cb.instant });
        } catch (err) {
          if (!cancelled) fb = fallback.run(question, local, cb);
        }
      })();
      return { cancel() { cancelled = true; if (ctl) ctl.cancel(); if (fb) fb.cancel(); } };
    },
  };
}

// The claude.ai artifact preview is the only place a key-less API call works.
export function isClaudePreview() {
  try { return /(^|\.)claudeusercontent\.com$|(^|\.)claude\.ai$/.test(location.hostname); } catch (e) { return false; }
}

export function pickDriver(kb, { endpoint } = {}) {
  const local = localDriver();
  if (endpoint) return endpointDriver(endpoint, local);
  if (isClaudePreview()) return previewDriver(kb, local);
  return local;
}
