# Abhi Kanani, portfolio

Live at https://abhikanani07.github.io/Portfolio-Website/

A static site: a WebGL2 hologram that is also an assistant, four product case studies with working demos, an experience timeline, and an In between section with a searchable Roblox library. Nothing runs on a server; esbuild bundles `src/` into `docs/`, which GitHub Pages serves.

## Structure

```
docs/               What GitHub Pages serves: index.html, assets/, knowledge.json, roblox.json after a sync
src/ai/             The assistant: knowledge.js (the record), engine.js, text.js, drivers.js, prompt.js
src/hologram/       WebGL2 renderer, shaders with eight shapes, labels around the hologram
src/ui/             Nav, command bar, palette, dock, drawer, sandbox, Roblox engine
src/demos/          Bravox odds, Keystroke pass builder, YouTube ranker, sleep explainer, water anomalies
src/data/           Sample Roblox data, shown only in previews
tools/              build.mjs, roblox-sync.mjs, engine-test.mjs
api/ask.js          Optional Vercel Edge Function that lets a language model phrase answers from the same record
.github/workflows/  roblox.yml, a daily Roblox sync
```

## Updating

- What the assistant knows: edit `src/ai/knowledge.js`, then `npm run build`. The file ships to the browser, so keep it to public facts.
- Page copy: edit `docs/index.html`.
- Retrain the models after editing the record: `node tools/train.mjs` (about a second). It rebuilds `src/ai/model.js` and reports accuracy on held-out questions.
- Test the assistant: `npm test` runs 124 questions, including typos, multi-part questions, private topics, injection attempts, gibberish, and non-English input.

## How the assistant works

It runs in the browser. For each question it:

1. Normalizes the text and corrects spelling against the record's own vocabulary, so "pyhton" becomes "python".
2. Routes by rules: greetings, help, questions about the assistant, private topics, internal Quest details, other people, abuse, off-topic tasks, and non-English input.
3. Computes what it can: time at each role ("how long at Quest"), local time in Pittsburgh, and "does he know X" answers backed by curated evidence.
4. Retrieves with BM25 over the record, plus synonyms and intent boosts. Questions with several parts are split and answered part by part.
5. Guards and composes: it answers only from entries that clear the honesty floor and cites them. Otherwise it says the answer isn't in the record.

The Sandbox section shows each stage live. To let a language model phrase answers, deploy `api/ask.js` to Vercel and put its URL in the `ask-endpoint` meta tag.

## Roblox library

1. Put your Roblox username in `tools/roblox.config.json`, then run `npm run roblox` (Node 18 or newer). Favorites sync with no key.
2. Recently played needs a Roblox Open Cloud API key, because Roblox stopped serving badge lists to signed-out requests in March 2026. Create one at create.roblox.com under Creator Dashboard, Credentials, API Keys, with read access to the inventory-item API. Then, in PowerShell, run `$env:ROBLOX_API_KEY = "<key>"` and `npm run roblox` again. The variable lasts only for that terminal session.
3. For the daily sync, add the key as a repository secret named `ROBLOX_API_KEY` (Settings, Secrets and variables, Actions), and the username as a variable named `ROBLOX_USER` if it isn't in the config file.
4. No key? List recent games by hand in `recentPlaceIds`, as roblox.com/games links or place IDs. `pinnedPlaceIds` marks top picks.

Never put the key in `tools/roblox.config.json` or any committed file; the sync ignores a key found there. Commit `docs/roblox.json` after a local sync. Until the first sync, the live site says "Syncing soon" and local previews show labeled sample data.

## Build

`npm run build` bundles into `docs/assets/`. `npm run build:single` writes a one-file preview to `dist/`. `npm run serve` serves `docs/` locally.
