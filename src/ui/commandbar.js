import { $, $$, escapeHTML } from "../core/dom.js";
import { streamText } from "../core/stream.js";
import { motion } from "../core/motion.js";
import { attachFeedback } from "./feedback.js";
import { DEFAULTS } from "../ai/engine.js";
const DECLINED = new Set(["private", "confidential", "injection", "comparison", "offtopic", "not-found", "unknown-term"]);
function initCommandBar({ engine, driver, holo, readouts }) {
  const form = $("[data-cmd]");
  const input = $("#cmd-input");
  const panel = $("[data-answer]");
  const scroller = $("[data-answer-scroll]");
  const live = $("[data-live]");
  let ctx = {};
  let current = null;
  let busy = false;
  let introCancel = null;
  readouts.set("engine", driver.name);
  readouts.set("entries", String(engine.size));
  function sourcesHTML(sources) {
    if (!sources.length) return "";
    return `<span class="mono">Sources</span>${sources.map((s) => {
      const ext = /^https?:/.test(s.href);
      return `<a class="chip chip--sm" href="${escapeHTML(s.href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${escapeHTML(s.title)}</a>`;
    }).join("")}`;
  }
  function finishCurrent() {
    if (!current) return;
    current.ctl.cancel();
    current.textEl.textContent = current.finalText();
    current.caret.remove();
    current.finish();
    current = null;
  }
  function ask(question) {
    const q = String(question || "").trim();
    if (!q) return;
    if (introCancel) introCancel();
    finishCurrent();
    panel.hidden = false;
    const item = document.createElement("article");
    item.className = "qa";
    item.innerHTML = `<p class="qa__q mono"></p><p class="qa__a"><span data-text></span><span class="caret caret--sm" aria-hidden="true"></span></p><div class="qa__src"></div><p class="meta mono"></p>`;
    $(".qa__q", item).textContent = q;
    scroller.append(item);
    while (scroller.children.length > 4) scroller.firstElementChild.remove();
    const follow = () => {
      const anchor = item.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 6;
      scroller.scrollTop = Math.min(anchor, scroller.scrollHeight - scroller.clientHeight);
    };
    follow();
    holo.setMode("retrieving");
    holo.pulse(0.35);
    busy = true;
    const local = engine.ask(q, DEFAULTS, ctx);
    ctx = engine.remember(ctx, local);
    readouts.set("latency", `${local.trace.ms.toFixed(2)} ms`);
    holo.setTopic(local.topic);
    const textEl = $("[data-text]", item);
    const caret = $(".caret", item);
    let text = "";
    let engineName = driver.name;
    const finish = () => {
      busy = false;
      $(".qa__src", item).innerHTML = sourcesHTML(local.sources);
      const meta = [`<span>${escapeHTML(engineName)}</span>`];
      if (local.route === "answer" || local.route === "followup") meta.push(`<span>${local.sources.length} ${local.sources.length === 1 ? "source" : "sources"}</span>`);
      else meta.push(`<span>${escapeHTML(local.trace.decision || local.route)}</span>`);
      meta.push(`<span>retrieved in ${local.trace.ms.toFixed(2)} ms</span>`);
      $(".meta", item).innerHTML = meta.join("");
      readouts.set("engine", engineName);
      attachFeedback(item, q, local, "hero");
      holo.setMode(document.activeElement === input ? "listening" : "idle");
      follow();
    };
    const ctl = driver.run(q, local, {
      instant: motion.reduced,
      onEngine: (name) => {
        engineName = name;
      },
      onStart: () => holo.setMode(DECLINED.has(local.route) ? "declined" : "streaming"),
      onToken: (tok) => {
        text += tok;
        textEl.textContent = text;
        holo.pulse(0.12);
        const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
        if (nearBottom) follow();
      },
      onDone: (final) => {
        textEl.textContent = final;
        caret.remove();
        live.textContent = final;
        current = null;
        finish();
      }
    });
    current = { ctl, textEl, caret, finish, finalText: () => text.length > local.text.length ? text : local.text };
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = "";
    ask(q);
  });
  $$("[data-preset]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.preset)));
  $("[data-answer-clear]").addEventListener("click", () => {
    finishCurrent();
    scroller.innerHTML = "";
    panel.hidden = true;
    ctx = {};
    holo.setTopic("core");
    holo.setMode("idle");
    input.focus();
  });
  input.addEventListener("focus", () => {
    if (!busy) holo.setMode("listening");
  });
  input.addEventListener("blur", () => {
    if (!busy) holo.setMode("idle");
  });
  input.addEventListener("input", () => {
    if (introCancel) introCancel();
    holo.pulse(0.05);
  });
  return {
    ask,
    startIntro() {
      introCancel = heroIntro(holo, () => {
        introCancel = null;
      });
    }
  };
}
function heroIntro(holo, done) {
  const qEl = $("[data-hero-q]");
  const aEl = $("[data-hero-a]");
  const sources = $("[data-hero-sources]");
  if (!qEl || !aEl || motion.reduced) {
    done();
    return null;
  }
  const question = qEl.textContent;
  const words = aEl.textContent.trim().split(/\s+/);
  aEl.innerHTML = words.map((w) => `<span class="w">${escapeHTML(w)}</span>`).join(" ");
  const spans = $$(".w", aEl);
  aEl.classList.add("is-streaming");
  sources.classList.add("is-pending");
  qEl.textContent = "";
  const caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");
  let timers = [];
  let stream = null;
  let finished = false;
  const later = (fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.push(t);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    timers = [];
    if (stream) stream.cancel();
    qEl.textContent = question;
    spans.forEach((s) => s.classList.add("on"));
    aEl.classList.remove("is-streaming");
    caret.remove();
    sources.classList.remove("is-pending");
    holo.setMode("idle");
    done();
  };
  holo.setMode("retrieving");
  let i = 0;
  const typeQ = () => {
    if (i <= question.length) {
      qEl.textContent = question.slice(0, i);
      i += 1;
      later(typeQ, 26);
      return;
    }
    later(() => {
      holo.setMode("streaming");
      let n = 0;
      stream = streamText(aEl.textContent, {
        onToken: () => {
          const s = spans[n];
          if (s) {
            s.classList.add("on");
            s.after(caret);
          }
          n += 1;
          holo.pulse(0.16);
        },
        onDone: () => later(finish, 650)
      });
    }, 380);
  };
  later(typeQ, 450);
  return finish;
}
export {
  initCommandBar
};
