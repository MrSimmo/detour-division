# PLAN — Detour Division

This is the milestone checklist. The spec is `DESIGN.md`, requirement IDs are written in brackets, and decisions are in `docs/adr/`. Session history is in `PROGRESS.md`. Tick a box only once its acceptance check has passed, with evidence recorded in PROGRESS.md.

Workflow: stop after M0 for review. Once it is approved, work straight through M1 to M6, stopping only if blocked. Commit at the end of every milestone, citing the requirement IDs.

---

## M0 — Design (stop for review)
- [x] DESIGN.md: towers, enemies, zones and levels, economy, difficulty, art and audio direction, stack pinned at npm versions checked 2026-09-24
- [x] ADR-0001 to ADR-0007 (Proposed)
- [x] PLAN.md, PROGRESS.md, CLAUDE.md
- [x] Your review and approval of DESIGN.md (2026-09-25; decisions recorded in §0.2). ADRs moved to Accepted.

## M1 — Vertical slice
One level, 4 towers (Rattler, Treacle Pump, Skylark, Thumper) and 5 enemies (Footling, Scarper, Putt-Putt, Tin Kettle, Whirligig).
- [x] Scaffold:
  - `package.json` with the exact pins from §22, and the lockfile
  - `tsconfig` project references: app, sim, node
  - Vite, Vitest and Playwright configs
  - `.nvmrc`
- [x] Simulation core: 30 Hz clock, sfc32, deterministic maths, IDs, commands, events, snapshot and restore, `hash()`, and the purity test [R-SIM-1..4]
- [x] Grid and terrain, per-exit distance fields, placement validation with reason codes, and `previewPlacement` [R-BLOCK-1, R-BLOCK-2]
- [x] Steering: look-ahead, turn rate, lane offsets; air lanes [R-MOVE-1..3, R-AIR-1]
- [x] The first set of balance data files and their Zod schemas. Combat: damage types, armour, the slow status, splash, homing, lobbed shells [R-DMG-1, R-DMG-2, R-DATA-1]
- [x] Economy: bounty, sell at 75%, the early-call bonus, lives and leaks [R-ECON-1..3]
- [x] Waves: a basic recipe expansion and the next-wave preview data [R-WAVE-1, R-WAVE-2]
- [x] Art: the bake pipeline, packer, manifest and `/dev/art.html`. First-pass code art for the 4 towers (3 tiers, 16 facings), the 5 enemies, the Z1 terrain, and the effects needed
- [x] Renderer: layers, interpolation, pooling, turret tracking, muzzle flashes, tracers, explosions, coin pops, hit flash, and the route marker with its preview
- [x] DOM UI: tokens, fonts, the HUD (cash, lives, wave x/y, preview, call early, speed, pause), the build bar, and the tower panel (range, stats, sell, targeting)
- [x] Input: mouse hover and click, right-click and Esc, keyboard shortcuts, touch drag with the ghost above the finger, the invalid ghost with a reason and a flashing route [R-BLOCK-3, R-INPUT-1]
- [x] Layout: fit and letterbox, safe areas, UI scale, no scroll or zoom, the rotate prompt, phone pinch and pan with double-tap reset [R-LAYOUT-1, R-LAYOUT-2]
- [x] Vitest suite green. Playwright smoke test plus screenshots at the 7 viewports, reviewed against §16

## M2 — Rosters, upgrades, meta
- [x] The remaining 8 towers, all specials, and 3 tiers each with a distinct look [§4]
- [x] The remaining enemies, elites for every type, and the 5 bosses with their behaviours [R-ENEMY-1]
- [x] Status effects: freeze, brittle, burn, custard, reversal, bubble, the shield and aura rules [R-DMG-1]
- [x] Upgrade flow in the panel, with costs and the stat changes
- [x] Loadout screen with a remembered loadout per level
- [x] Difficulty selection, star awards, and tower and zone unlocks from `progression.json` [§12]
- [x] Title menu, world map with zone gates, level briefing, and the victory and defeat screens
- [x] Field guide and its unlock rules
- [x] Endless mode [§3.10, §9.4]
- [x] Screenshot review

## M3 — Levels and validation
- [x] Final level Zod schema, plus `npm run gen-schema`, which writes `data/schema/level.schema.json` [R-LEVEL-1]
- [x] Every terrain type: bridges, restricted cells, trenches (cover), ice, conveyors, removable blockers, tunnels, water and lava [§14.3]
- [x] Modes: Sudden Death, Time Trial and Puzzle, each with its HUD variations [§10]
- [x] The wave generator: patterns, elites, bosses, overrides [R-WAVE-3]
- [x] Reference bot and its plan support [§15.1]
- [x] `npm run validate-levels`: parallel runs, the report, and `reports/levels.json` [R-VAL-2]
- [x] All 40 levels authored to the table in §11
- [x] All 40 × 3 pass validation, and the difficulty-curve warnings are reviewed [R-VAL-1, R-PROG-1]

## M4 — Audio
- [x] Engine: buses, per-bus volume and mute, limiter, ducking, unlock on first gesture [R-AUD-2]
- [x] Sequencer and synth instruments. The menu and 5 zone themes, the boss cue, and the stingers
- [x] Adaptive layers driven by threat, switching at bar boundaries
- [x] SFX for every tower and tier, plus enemies and UI. Variation and panning. Voice limiting [R-AUD-1]
- [x] Dropped-in files through the manifest [R-AUD-3]

## M5 — PWA, offline and saves
- [x] Web app manifest, icons, standalone display, landscape orientation
- [x] Service worker precaching everything; the CSP; no runtime network requests [V-4]
- [x] The update flow: badge on menus only, applied on the next launch
- [x] IndexedDB saves: schema versions, migrations, `persist()` [R-SAVE-1]
- [x] Snapshots at wave start and on visibilitychange and pagehide, plus the resume prompt [R-SAVE-2]
- [x] Export and import, as a file and as a text code
- [x] The iOS Add to Home Screen explainer
- [x] Playwright offline test [R-PWA-1]
- [~] iOS Simulator device pass (§23.4): steps that need a tap (Add to Home Screen, sound after the first tap, pinch and pan) can't be driven from `simctl`; see PROGRESS 2026-09-25 M5

## M6 — Polish
- [x] Effects and juice pass [§16.1]
- [x] UI feel pass
- [x] Performance: bench, throttled traces, auto quality, the WebGPU setting with fallback [R-PERF-1]
- [x] Accessibility: reduced motion, colour-blind mode, remappable keys, focus handling [R-A11Y-1]
- [x] Final screenshot review at all 7 viewports [V-6]
- [x] Real-device checklist handed over [§23.4]
- [x] Everything green: typecheck, unit tests, validate-levels, e2e. No console errors. PROGRESS.md lists anything deferred.

## v1.1 — Review fixes (DESIGN.md §0.3)
- [x] Dialogs fit the window, nothing scrolls, and every screen follows a resize; the map fits a desktop window [R-LAYOUT-3, V-2]
- [x] Map medallions keep their centre on hover [V-7]
- [x] Shorter Standard levels and a quickening wave countdown; all 40 levels re-tuned and validated [R-WAVE-4, ADR-0011]
- [x] One HUD height across the top [R-HUD-1]
- [x] Mouse drag and drop from the build bar; no stale refusal bubbles; unbuildable cells shaded while placing [R-INPUT-2, R-BLOCK-4]
- [x] Tooltips on hover, focus and long press [R-TIP-1]
- [x] Renderer Auto, measured; profile v4 [ADR-0012]
- [x] Found in review: big units wedged on wall corners (Grinder's Glacier stalled for an hour of game time) [R-MOVE-4]
- [x] Zone 1 art sample: terrain, the 4 starter towers, the 5 starter enemies [§16.1]
- [ ] Your approval of the art sample, then the roll-out to zones 2–5, the other 8 towers, the other enemies, bosses, effects, icons and the world map

## v1.2 — Phone review fixes (DESIGN.md §0.4)
- [x] Legible text on touch devices: a UI-scale floor of 0.9, phones scaled from the screen, dialogs shrink only to the floor [§16.4, V-8, ADR-0013]
- [x] Phone rails: the HUD left of the map, the build bar right of it, slots as large as the height allows; nothing covers the map [§18.2, R-LAYOUT-4, R-HUD-1]
- [x] Short landscape dialogs side by side: title, settings, saves, field guide, briefing, pause, result, explainer [§18.2 item 7, R-LAYOUT-3]
- [x] World map: drag works (a full-window layer took every press), pinch zoom on touch, bar inside the safe area [§18.2 item 8, R-LAYOUT-5]
- [x] Tower panel docked beside the map on phones, in two columns, on the side that keeps the tower in view [§18.4]
- [x] Desktop field guide at its intended width (it had shrunk to half size) [§18.2]
- [ ] Your check on a phone (docs/device-checklist.md, "v1.2 phone layout")


## v1.3 — Device review fixes (DESIGN.md §0.5)
- [x] WebGPU greyed out: the dev server's LAN address isn't a secure context, so browsers hide WebGPU. Settings now says so, and a long press shows it on touch [§19, R-GPU-1]
- [x] World map: the volcano stands in the land, one lava flow from crater to sea, smoke on the map, lava cracks taper out [§11]
- [x] Zone 1 trees: every trunk reaches up into its crown [§16.1, V-9]
- [x] Zone 1 gates: the forest's shade stops at each gate, so the lane runs into the field with no edge; a bush covers each hedge corner [§16.1, V-10]
- [x] Enemies walk the gate lanes: ground units start 2.75 cells up the entrance lane and escape 2.75 cells down the exit lane; all 40 levels re-validated [§9.1, R-LANE-1]
- [ ] Your look on a phone and in a desktop browser (docs/device-checklist.md, "v1.3")

## v1.4 — Lane fixes (DESIGN.md §0.6)
- [x] Ground units start 6.5 cells up the entrance lane, off screen on common desktop windows; all 40 levels re-validated, three re-tuned and two puzzle plans moved [§9.1, R-LANE-1, ADR-0014]
- [x] A leaker walks on down the exit lane until it's off screen; each lane ends under the forest's trees, drawn over the units [§9.1, R-LANE-2, ADR-0014]
- [ ] Your look in a desktop browser and on a phone (docs/device-checklist.md, "v1.4")
