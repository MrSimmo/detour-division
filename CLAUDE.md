# CLAUDE.md — Detour Division

An offline-first PWA tower-defence game in the open-field mazing genre. **Status (2026-09-29):** milestones M0–M6 are all done and committed (see `PLAN.md`). Only items that need a person remain: listening to the audio, and tap-only device checks (`docs/device-checklist.md`). The v1.1 review fixes (DESIGN.md §0.3), the v1.2 phone fixes (§0.4), the v1.3 device fixes (§0.5) and the v1.4 lane fixes (§0.6) are committed. On 2026-09-29 the history was squashed into one commit for publication on GitHub Pages (ADR-0015). The Zone 1 art sample awaits approval before the roll-out.

## Where things are
- **Spec:** `DESIGN.md`. It is a single file, and its requirement IDs are `R-*` and `V-*`. It also holds the visual design tokens (§16). If a behaviour isn't in it, or contradicts it, amend the spec before writing code.
- **Plan:** `PLAN.md`, the milestone checklist. **Log:** `PROGRESS.md`, which is local only (gitignored, ADR-0015). Resume from any `[!]` items first, then `[ ]`. The `[~]` items are deferred, and each has its reason and its unblocking condition.
- **Decisions:** `docs/adr/0001`–`0016`. **Licence:** PolyForm Noncommercial 1.0.0 (`LICENSE.md`, ADR-0016). **Lessons:** `docs/lessons/`. Read the relevant lesson before touching a tricky area.

## Code map
| Path | What |
|---|---|
| `src/sim` | Deterministic 30 Hz simulation: pathing, towers, enemies, waves, modes, snapshots. Pure. |
| `src/bot` | The reference bot the validator plays with (§15.1). Pure. |
| `src/data` | Zod schemas for balance and level files. `src/meta` holds progression and saves (migrations, the save file, CRC). Pure. |
| `src/render` | Pixi scene, effects, routes, world map, auto quality (`quality.ts`). |
| `src/art` | Code-drawn art, baked to atlases by `npm run bake-art`. Colours live only in `palette*.ts`. |
| `src/audio` | Engine, sequencer, instruments, songs (`music/songs/*`), SFX patches (`sfx/*`), the director. |
| `src/app` | App flow, Game controller, input, saves (IndexedDB), PWA updates, settings, CSP set-up, test hooks. |
| `src/ui` | DOM screens and HUD. Styles: `tokens.css` and `styles.css`. |
| `data/levels/z1..z5/*.json` | The 40 levels. **The JSON is the source of truth**; edit the files directly (tiles are strings). |
| `.github/workflows/pages.yml` | Builds and publishes the game to GitHub Pages on every push to `main` (ADR-0015). |
| `tools/` | Bake, validate, tune, the schema and audio-manifest generators, the bench, and `tools/dev/*` helpers. |

## Commands
Every command needs the shell preamble in `docs/lessons/agent-shell-node.md`.

| Command | Use |
|---|---|
| `npm run dev` | Dev server on :5173. The service worker is off in dev. |
| `npm run typecheck` / `npm test` | Three tsconfigs / Vitest (210 tests). |
| `npm run e2e` | Playwright on Chromium, WebKit and Firefox, against the production preview build (it builds first). |
| `npm run perf` | The throttled R-PERF-1 trace. It runs alone and is excluded from `e2e`. |
| `npm run bench` | Headless sim stress test (R-PERF-1). |
| `npm run validate-levels [z3 z5-07 …]` | R-VAL-1 on all 40 levels × 3 difficulties, about 4.5 min. **Run it after any change to the sim, balance or bot.** |
| `node tools/tune-level.ts <level.json>` | Re-tunes one level's `recipe.hp` (ADR-0008). Puzzles are tuned by their purse and plan instead. |
| `npm run bake-art` | Re-bakes the atlases (WebP, ADR-0009) and the app icons after any change under `src/art`. |
| `npm run gen-audio-manifest` | Run after adding or removing an SFX key or a song. A test checks it's current. |
| `npm run gen-schema` | Run after changing the level Zod schema. |
| `node tools/dev/audio-check.ts sfx\|music\|layers\|tuning [filter]` | Render audio offline and check levels. Needs the dev server. |
| `node tools/dev/level-shots.ts <dir> <level-id>…` | Screenshot levels. Needs the dev server. |
| `node tools/dev/{leaks,record-plan,bot-try,bot-map}.ts` | Level debugging and puzzle-plan recording. |
| `node tools/dev/plan-search.ts <level.json> [radius]` | A puzzle's plan stopped winning: finds single tower moves that win again, ranked over 5 seeds. |
| `node tools/dev/renderer-bench.ts [url]` | WebGL against WebGPU on the R-PERF-1 scene (ADR-0012). Run it against a preview build, not the dev server. |

## Rules specific to this repo
- `src/sim`, `src/bot`, `src/data` and `src/meta` are pure. They have no DOM, no timers, no `Math.random`, no `Date`, and no transcendental `Math.*`; use `sim/core/math.ts` (ADR-0003). `tsconfig.sim.json` and `tests/sim/purity.test.ts` enforce this.
- Balance numbers belong only in `data/balance/*.json` (R-DMG-2, R-DATA-1).
- Sprites and sounds are referenced only by asset-manifest key (ADR-0006, R-AUD-3).
- Every colour comes from a token (V-1, which `tests/app/visual-rules.test.ts` enforces). Use UK English in all in-game text.
- Pinned versions: DESIGN.md §22. Never use `^` ranges.
- **Saves are versioned.** A change to the profile shape bumps `PROFILE_VERSION` (`src/meta/progression.ts`), and needs a migration in `src/meta/save.ts` plus a test. The profile is currently v4.
- **Test hooks** exist only under `?e2e`: `__app`, `__game`, `__hash`, `__spawn`, `__audio`, `__audioLab`, `__saves`, `__profile`, and the query parameters `auto=title|<level>`, `diag=1`, `ios=0|1`, `safe=t,r,b,l` (`src/app/devdrive.ts`, `platform.ts`).

## Shell
In the agent shell, `node`, `npm` and `npx` are broken nvm lazy-load functions. See `docs/lessons/agent-shell-node.md`.
