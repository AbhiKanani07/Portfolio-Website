# Abhi Kanani, portfolio

Live at https://abhikanani07.github.io/Portfolio-Website/

My personal site, with a WebGL2 hologram you can talk to. The assistant answers questions about me from a published record, shows its sources, and says so when something isn't in the record.

A static site: a WebGL2 hologram that is also an assistant, four product case studies with working demos, an experience timeline, and an In between section with a searchable Roblox library. Nothing runs on a server; esbuild bundles `src/` into `docs/`, which GitHub Pages serves.

## Structure

```
docs/               What GitHub Pages serves: index.html, assets/, knowledge.json, roblox.json after a sync
src/ai/             The assistant: knowledge.js (the record), engine.js, text.js, drivers.js, prompt.js
src/hologram/       WebGL2 renderer, shaders with eight shapes, labels pinned to the shape
src/ui/             Nav, command bar, palette, dock, pointer, drawer, sandbox, Roblox engine, boot log
src/demos/          Bravox odds, Keystroke pass builder, YouTube ranker, sleep explainer, water anomalies
src/data/           Sample Roblox data, shown only in previews
tools/              build.mjs, roblox-sync.mjs, engine-test.mjs
api/ask.js          Optional Vercel Edge Function that lets Claude phrase answers from the same record
.github/workflows/  roblox.yml, a daily Roblox sync
```

## Updating

- What the assistant knows: edit `src/ai/knowledge.js`, then `npm run build`. Every entry ships to the browser, so anyone can read it. Keep it to public facts.
- Page copy: edit `docs/index.html`.
- Test the assistant: `npm test` runs 124 questions, including typos, multi-part questions, private topics, injection attempts, gibberish, and non-English input.

## How the assistant works

It runs in the browser. For each question it:

1. Normalizes the text and corrects spelling against the record's own vocabulary, so "pyhton" becomes "python".
2. Routes by rules: greetings, help, questions about the assistant, private topics, internal Quest details, other people, abuse, off-topic tasks, and non-English input.
3. Computes what it can: time at each role ("how long at Quest"), local time in Pittsburgh, and "does he know X" answers backed by curated evidence.
4. Retrieves with BM25 over the record, plus synonyms and intent boosts. Questions with several parts are split and answered part by part.
5. Guards and composes: it answers only from entries that clear the honesty floor and cites them. Otherwise it says the answer isn't in the record.

The Sandbox section shows each stage live. By default the words come from the record itself. To let Claude phrase answers instead, deploy `api/ask.js` to Vercel and put its URL in the `ask-endpoint` meta tag.

## Roblox library

1. Put your Roblox username in `tools/roblox.config.json`, or add a repository variable named `ROBLOX_USER` under Settings, Secrets and variables, Actions, Variables.
2. Recently played needs a Roblox Open Cloud API key, stored as the repository secret `ROBLOX_API_KEY`. Never commit the key to any file.
3. Run the "Sync Roblox library" workflow from the Actions tab; it runs daily after that. To sync locally, set the key in your terminal session and run `npm run roblox`, then commit `docs/roblox.json`.
4. Optional: add place IDs (the number in a roblox.com/games/ link) to `pinnedPlaceIds` to mark top picks.

Until the first sync, the live site says "Syncing soon" and local previews show labeled sample data.

## Accessibility and performance

- Tested in headless Chromium at 1440, 1024, 768, and 390 px: no horizontal overflow, no overlapping HUD elements, every text element at WCAG AA contrast or better.
- `prefers-reduced-motion` gets a still hologram, instant answers, and no reveals. Without WebGL2, a CSS orb replaces the canvas.
- The hologram pauses offscreen and behind open case studies, lowers its point count on slow devices, and frees all GPU resources on `pagehide`. Add `?holo=full` to pin full density, `?debug` to expose `window.__portfolio`.

## Build

`npm run build` bundles into `docs/assets/`. `npm run build:single` writes a one-file preview to `dist/`. `npm run serve` serves `docs/` locally.