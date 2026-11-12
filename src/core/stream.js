function tokenize(text) {
  return String(text).match(/\S+\s*/g) || [];
}
function streamText(text, { onToken, onDone, instant = false, speed = 1 } = {}) {
  const tokens = tokenize(text);
  if (instant || !tokens.length) {
    if (tokens.length) onToken(tokens.join(""), 0, tokens.length);
    onDone && onDone();
    return { cancel() {
    } };
  }
  let i = 0;
  let timer = 0;
  let cancelled = false;
  const next = () => {
    if (cancelled) return;
    if (i >= tokens.length) {
      onDone && onDone();
      return;
    }
    const tok = tokens[i];
    onToken(tok, i, tokens.length);
    i += 1;
    const word = tok.trim();
    let delay = 10 + word.length * 1.8 + Math.random() * 14;
    if (/[.!?]["')\]]?$/.test(word)) delay += 110;
    else if (/[,;:]$/.test(word)) delay += 40;
    timer = setTimeout(next, delay / speed);
  };
  next();
  return { cancel() {
    cancelled = true;
    clearTimeout(timer);
  } };
}
export {
  streamText,
  tokenize
};
