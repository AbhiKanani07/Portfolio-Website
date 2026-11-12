const SKIP = new Set(["empty", "greeting", "thanks", "abuse", "injection", "gibberish", "help"]);
const endpoint = () => {
  const m = document.querySelector('meta[name="feedback-endpoint"]');
  const v = m ? m.content.trim() : "";
  return /^https:\/\//.test(v) ? v : "";
};
export function attachFeedback(container, question, local, where) {
  const url = endpoint();
  if (!url || SKIP.has(local.route) || !container) return;
  const box = document.createElement("div");
  box.className = "qa__fb";
  box.innerHTML = '<span class="mono">Was this helpful?</span><button type="button" class="fb" data-v="1">Yes</button><button type="button" class="fb" data-v="0">No</button><span class="qa__fb-note">Sends this question and your rating to Abhi.</span>';
  box.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    const buttons = [...box.querySelectorAll("button")];
    buttons.forEach((x) => { x.disabled = true; });
    const helpful = b.dataset.v === "1";
    const note = box.querySelector(".qa__fb-note");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: String(question).slice(0, 300), entry: (local.used && local.used[0]) || "", route: local.route, confidence: Number((local.confidence || 0).toFixed(3)), helpful, where, at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      box.innerHTML = `<span class="mono">${helpful ? "Thanks. Rating sent." : "Thanks. Rating sent, so this answer can get better."}</span>`;
    } catch (err) {
      note.textContent = "Couldn't send the rating. Check your connection and try again.";
      buttons.forEach((x) => { x.disabled = false; });
    }
  });
  container.append(box);
}
