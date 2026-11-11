# Abhi Kanani: portfolio

My personal site with a WebGL2 hologram you can talk to. The assistant answers questions about Abhi from a published record, shows its sources, and says so when something isn't in the record.

Live: https://abhikanani07.github.io/Portfolio-Website/

## What's here

```
docs/                 the site GitHub Pages serves (built output, commit it)
  index.html          all content, readable without JavaScript
  assets/site.js      bundled from src/ (do not edit by hand)
  assets/site.css     bundled from src/styles/
  knowledge.json      the assistant's record, published for transparency
  *.html              redirects from the old site's URLs, plus 404.html
src/
  ai/knowledge.js     EDIT THIS to change what the assistant knows
  ai/engine.js        routing, guard rails, BM25 retrieval, composition
  ai/drivers.js       local retrieval, optional endpoint, claude.ai preview
  hologram/           WebGL2 renderer and GLSL shaders
  ui/                 nav, command bar, bento, drawer, sandbox, motion
  demos/              the four case study demos
  core/               springs, streaming, helpers
api/ask.js            optional Claude endpoint (Vercel Edge Function)
tools/build.mjs       bundles src/ into docs/
```

## Update the site

1. Edit `src/ai/knowledge.js` for facts, or `docs/index.html` for page copy.
2. `npm install` once, then `npm run build`.
3. `npm run serve` and open http://localhost:8080 to check.
4. Commit and push. GitHub Pages serves `docs/` from `main`.

Every entry in `knowledge.js` ships to the browser, so anyone can read it.

## The assistant

Each question runs through five stages in the browser: parse, route, retrieve (BM25 over the record), guard, compose. The Sandbox section on the page shows them live. Private topics (pay, GPA, age, phone), internal Quest details, comparisons with other people, and prompt-injection attempts are answered by the guard and never sent anywhere.

FBy default the words come from the record itself. For open-source work: if you want to have Claude write them instead:

1. Import this repo into Vercel. `vercel.json` builds it and serves `docs/`.
2. Set `ANTHROPIC_API_KEY`, and `ALLOWED_ORIGINS` (comma-separated, default `https://abhikanani07.github.io`). Optional: `ASK_MODEL` (default `claude-haiku-5-5`).
3. Put the function URL in `docs/index.html`: `<meta name="ask-endpoint" content="https://YOUR-PROJECT.vercel.app/api/ask">`, then push.

The status readout under the hologram shows which engine answered. If the endpoint fails, the site falls back to local retrieval.

## Quality notes

- Tested in headless Chromium at 1440, 1024, 768, 390, and 360 px: no horizontal overflow, no overlapping HUD elements, every text element at WCAG AA contrast or better.
- `prefers-reduced-motion` gets a still hologram, instant answers, and no reveals. Without WebGL2, a CSS orb replaces the canvas.
- The hologram pauses offscreen, lowers its point count on slow devices, and frees all GPU resources on `pagehide`. Add `?holo=full` to pin full density, `?debug` to expose `window.__portfolio`.
