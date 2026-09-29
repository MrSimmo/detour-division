# Detour Division — Design

**Status:** Approved 2026-09-25 (M0 review). Drafted 2026-09-24.
**Role:** the single spec for this project. It covers behaviour, content, the visual contract and the stack. Requirement IDs (`R-…`, `V-…`) are cited by tests, commits and `PLAN.md`. If code and this file disagree, this file is amended first (see `CLAUDE.md`).
**Decisions:** the reasons for the key choices, and the options rejected, are in `docs/adr/0001`–`0007`.

---

## 0. Brief as understood

**What you asked for.** A commercial-quality, offline-first browser tower defence with an original world, cast, art and music. Its core is open-field mazing: the player builds the route. The simulation is deterministic, runs headless and is driven by data. There are 40 levels in 5 zones, and a bot proves that each one is winnable. Art and music are generated in code, and hand-made assets can replace them without code changes. It runs on desktop, iOS and Android browsers, installs as a PWA, and uses UK English.

**Placeholders filled in** (confirmed at review):

| Placeholder | Value used |
|---|---|
| `[GAME NAME]` | **Detour Division** (chosen at review) |
| Lives `[20]` | 20 (some levels fewer) |
| Sell `[75]%` | 75% of total spent |
| `[40]` levels, `[5]` zones | 40 levels, 8 per zone: temperate, desert, snow, industrial, volcanic |
| Music style | Playful military / orchestral-arcade |

### 0.1 Assumptions (confirmed at review)

1. Waves launch on a timer whether or not the field is clear. Falling behind stacks the pressure. "Call early" skips the rest of the countdown. On Standard levels the countdown shortens as the level goes on (§3.8, amended at the v1.1 review).
2. Difficulty changes enemy HP, speed, starting cash and bounty, **and** the wave count (Tough +5 waves, Heroic +10), so Heroic is both harder and longer.
3. An escaped boss costs 5 lives. Every other enemy costs 1.
4. Each level keeps its best result: a Casual win is 1 star, Tough is 2, Heroic is 3. All three difficulties are open as soon as a level unlocks.
5. Building, upgrading and selling are instant. There is no build timer.
6. Pinch-zoom is phones only, as briefed. Tablets and desktop always show the whole map.
7. Combat has no randomness: no critical hits, dodges or miss chances. The seeded RNG is used only for wave generation, spawn jitter and cosmetic variety. Outcomes follow from the player's maze.
8. The world is Umbershire, invaded by General Bluster's Grand Blustering Army (§2). Everything is original.

### 0.2 Review decisions (2026-09-25)

1. **Title:** *Detour Division*.
2. **Boss leak cost:** 5 lives. Agreed.
3. **Wave count scales with difficulty** (+5 on Tough, +10 on Heroic). Agreed.
4. **Sudden Death lives:** 5 / 3 / 1. Agreed.
5. **Baked atlases are committed to git.** Agreed (ADR-0006).
6. **Devices:** iOS and iPadOS Safari are verified in the Xcode iOS Simulator, driven through `xcrun simctl` and Safari Web Inspector. Desktop Chrome, Edge, Firefox and Safari engines are covered by Playwright (Chromium, Firefox, WebKit), with Android Chrome emulated in Chromium. A physical Android phone was not available, so that one item stays on the handover checklist in §23.4.

### 0.3 v1.1 review (2026-09-25)

The first play-through of v1 raised these points. Each row names the section that now covers it.

| # | Report | Decision | Spec |
|---|---|---|---|
| 1 | Dialogs scroll to fit | Every dialog scales down as a whole to fit the window; nothing scrolls | §18.2, R-LAYOUT-3 |
| 2 | Map medallions jump on hover | Hover and press never move a control off its anchor | §16.5, V-7 |
| 3 | 30 waves feels long | Standard levels have about a third fewer waves (Zone 1: 20/25/30) | §10, §11, ADR-0011 |
| 4 | Music cut out on the briefing | Not reproduced. Sound stops by design while the page is hidden, which Chromium on macOS also reports for a fully covered window. No change, agreed | §17.1 |
| 5 | HUD buttons differ in height | One top-face height and one lip across the top HUD | §18.4, R-HUD-1 |
| 6 | Placing needs click, move, click | Mouse drag and drop from the build bar; click-to-arm still works | §18.5, R-INPUT-2 |
| 7 | "Can't build here" on open grass | Unbuildable cells, including the gate apron, are shaded while placing | §3.1, R-BLOCK-4 |
| 8 | "Something's already here" on empty ground | The ghost no longer re-checks the cell a tower was just built on | §18.5, R-INPUT-2 |
| 9 | Art looks simplistic | An art pass. Zone 1 is repainted as a sample for approval first | §16.1 |
| 10 | Waves don't speed up | The countdown between waves shrinks from 20 s to 14 s over a Standard level | §3.8, R-WAVE-4, ADR-0011 |
| 11 | Resizing the desktop window doesn't resize the game | Every screen re-lays out on resize; the map fits the window on desktop | §18.2, R-LAYOUT-3 |
| 12 | Descriptions on hover, and on touch | Tooltips: hover or focus on desktop, long press on touch | §18.6, R-TIP-1 |
| 13 | WebGL or WebGPU is jargon | Renderer "Auto" is the default | §19, ADR-0012 |

### 0.4 v1.2 phone review (2026-09-26)

Played on a physical phone in Safari, landscape. The root cause of 1, 3, 5 and 6 was the same: on phones the UI scale sat at its floor of 0.69, and dialogs then shrank further to fit, so text rendered at 5–9 CSS px.

| # | Report | Decision | Spec |
|---|---|---|---|
| 1 | Menu text far too small | Touch devices have a UI-scale floor of 0.9, and phones take their scale from the screen, not the map | §16.4, §18.2, V-8 |
| 2 | Build-bar icons too small; the HUD hides the enemies' entrance | Phones use side rails: the HUD in a column on the left, the build bar on the right, slots as large as the height allows. Nothing covers the map | §18.2, R-LAYOUT-4, ADR-0013 |
| 3 | Result card text too small | As 1 | §16.4 |
| 4 | World map cut off and can't be zoomed | Pinch to zoom out to the whole map and back in; drag to pan. Dragging had never worked: a full-window layer over the map took every press | §18.2, R-LAYOUT-5 |
| 5 | Field guide runs off the bottom, with tiny text | As 1, plus a side-by-side layout for short screens. The fit no longer collapses the entry grid into one column. On desktop the guide also gets back its intended width: the generic card cap had squeezed it to three entries a row, and the fit then shrank it to half size | §18.2, R-LAYOUT-3 |
| 6 | Settings text far too small | As 1, plus a header row (title, tabs, Done) on short screens | §18.2 |

### 0.5 v1.3 review (2026-09-28)

Played on a phone (Safari) and in a desktop browser, both on the dev server.

| # | Report | Decision | Spec |
|---|---|---|---|
| 1 | WebGPU is greyed out in Settings on both, though both browsers support it | Not a detection fault. Browsers expose WebGPU only on a secure page (https, or localhost), and the dev server's LAN address is plain http. The option stays disabled there, and now says why, instead of "This browser has no WebGPU" | §19, R-GPU-1 |
| 2 | The world map's volcano doesn't look part of the map, and its lines don't match up | It was a flat triangle laid over the land: an inked straight base, one corner out at sea, its smoke cut off by the map's top edge, and a lava river starting beside the end of the flank's lava instead of from it. Redrawn to stand in the land, with one lava flow from the crater to the sea. The ground's lava cracks taper out instead of stopping dead | §11 |
| 3 | Some trees' branches don't touch the trunk | The trunk had a fixed height, while the crown's leaf clusters are placed at random, so a crown could end above its trunk (the lime, and nearly the apple). Every trunk now reaches up into its crown | §16.1, V-9 |
| 4 | A line where each entrance and exit meets the field | The forest's shade darkened the meadow's outer ring right up to each gate, and the lane beyond it had none. The shade now fades out over a cell either side of a gate, so a lane runs into the field with no edge. Zone 1 only: zones 2–5 get gate lanes with the art roll-out (§16.1) | §16.1, V-10 |
| 5 | Enemies appear at the edge of the map and don't use the entry and exit lanes | Ground units now start 2.75 cells beyond the edge, up the entrance lane, and walk in; a leaker walks 2.75 cells out down the exit lane before it escapes. A change to the simulation, chosen over a visual-only walk: each unit reaches the field a few seconds later, and towers in range can hit it in a lane. Lobbed shells now lead a unit in a lane, and a split-off carries on along the lane its parent fell in. All 40 levels re-validated; three puzzles (Cracked Ice, Sludge Sluice, Obsidian Knot) have new reference plans, each one or two towers moved. Air units keep their 0.75-cell start and finish | §9.1, R-LANE-1 |

### 0.6 v1.4 review (2026-09-29)

Played in a desktop browser and on a phone, on the dev server. Both reports have one cause: a desktop window shows more of a lane than the 2.75 cells a unit walked there. The letterbox beside the map shows the lane, and so does the build-bar column, which has no background. Measured over all 40 levels at common window sizes, up to 4.7 cells of an entrance lane and 6.9 of an exit lane are on screen. Lanes that run up and down show at most 2.7 cells, which is why only levels whose road runs across the screen looked wrong.

| # | Report | Decision | Spec |
|---|---|---|---|
| 1 | Enemies appear halfway down the entrance lane instead of walking onto the screen | Ground units now start 6.5 cells out, and the entrance lane ends under the forest's trees 5.25 cells out, drawn over the units. On common desktop windows both are off screen, so units walk on from the window's edge; on a wider window they step out of the trees. Chosen, of the three options offered, over leaving the simulation alone: each ground unit reaches the field a few seconds later, so all 40 levels were re-validated | §9.1, R-LANE-1, R-LANE-2, ADR-0014 |
| 2 | Leakers vanish halfway down the exit lane instead of walking off the screen | A leaker still escapes, and costs its lives, 2.75 cells out. It is then drawn walking on down the lane until it is off the screen, or under the trees where the exit lane ends, 8 cells out | §9.1, R-LANE-2, ADR-0014 |

---

## 1. Pillars

1. **The maze is the game.** Every decision is about route length, and about which kill zones the route passes through. Nothing may undermine that: no blocking, no teleporting enemies, no invisible rules.
2. **Readable chaos.** There can be 300 small, silly enemies on screen, and the player can still read the route, the threat and the next wave at a glance.
3. **Cheerful, comic military.** Saturday-morning cartoon warfare with seaside-postcard humour and no gore. Defeated soldiers go *poof* and drop their helmets.
4. **Provably fair.** Every level on every difficulty is validated by a bot. The simulation is deterministic, so a replay, a resumed save and a validation run all match what the player sees.
5. **Anywhere, offline.** It installs once and plays forever on a phone on a train. No player data leaves the device.

## 2. Premise and tone

General Bluster's Grand Blustering Army is marching across Umbershire to raid the Crown Biscuit Stores. You command the Umbershire Irregulars, an engineering corps with more imagination than budget. You can't stop the Army from marching, but you can send it the long way round.

- **Voice.** UK English throughout (colour, defence, armour, metre, "Cheerio"). Labels are short and punchy. Jokes go in field-guide entries, loading tips, level names and flavour text. Instructions and error messages are always plain.
- **Lives** are the biscuits left in the Stores: the HUD icon is a biscuit tin and the label is "Lives". A leaking enemy runs off with a biscuit under its arm.

---

## 3. Core rules

### 3.1 Grid and building

- The playfield is a square grid. A typical map has 22×13 playable cells, and the range is 18×11 up to 26×15. A 1-cell decorative border, with trees and props framing the map, surrounds the playable grid but is not part of it.
- Every tower occupies exactly one cell. A tower can go on any **buildable, free** cell (terrain rules in §14.3).
- Cells within one cell of an entrance or exit span form the "gate apron". They are unbuildable, and signposts mark them.
- **Showing where you can't build.** While a tower is being placed (a tower is armed, or being dragged), every cell that would refuse it as `NOT_BUILDABLE` is shaded with a faint hatch in the invalid colour. That covers the gate apron and every unbuildable terrain, so a refusal is never a surprise on what looks like open ground.
- Placing requires enough cash, a tower in the current loadout, and passing the block rules (§3.2).

### 3.2 Routes and the never-block rule

- A **route** runs from one entrance span to one exit span. A level has 1–3 ground routes. Each route has an air lane unless the route is `airOnly` (§3.5).
- A placement (or clearing a blocker, §14.3) is **rejected** if any of these is true:
  1. The cell is not buildable, or is already occupied (reason `NOT_BUILDABLE`, `OCCUPIED`).
  2. A ground enemy's body circle overlaps the cell (reason `ENEMY_IN_WAY`).
  3. With the cell blocked, some route's entrance can no longer reach its exit (reason `BLOCKS_ROUTE`, plus the route IDs).
  4. With the cell blocked, some ground enemy on the field can no longer reach its own exit from where it is. That includes enemies that are reversing, bubbled, or inside a tunnel, which are checked from the tunnel's exit mouth (reason `TRAPS_ENEMY`, plus the enemy IDs).
  5. There is not enough cash, or the tower is not in the loadout (reason `NO_CASH`, `NOT_IN_LOADOUT`).
- **Showing why.** The ghost turns to the invalid colour with a hatch pattern, and a short plain-English bubble appears: "That would block the road", "Someone's standing there", "You'd trap them", "Can't build here", "Not enough cash". For `BLOCKS_ROUTE` the part of the route that would be cut flashes (3 pulses, 600 ms). For `TRAPS_ENEMY` and `ENEMY_IN_WAY` the enemies concerned flash.
- Selling never makes a route invalid. It only opens space, so a sale is always accepted.

**Acceptance**
- **R-BLOCK-1**: For any grid, a placement succeeds if and only if conditions 1–5 all pass. This is property-tested on random grids against a brute-force breadth-first search oracle.
- **R-BLOCK-2**: An enemy standing in a pocket that the placement would seal leads to rejection with `TRAPS_ENEMY`, even when every entrance still reaches its exit. This includes enemies mid-field, reversing, and in a tunnel.
- **R-BLOCK-3**: A rejected ghost shows the invalid colour plus the hatch, the reason text, and the flash on the broken route or the enemies involved.
- **R-BLOCK-4**: While a tower is armed or dragged, exactly the cells where `checkPlacement` gives `NOT_BUILDABLE` are shaded, and the shading goes when placing ends.

### 3.3 Re-pathing and movement

- Each exit has a **distance field**: the cost of travelling from every cell to that exit, on 8-connected moves with no corner-cutting. It is recomputed at the tick where a build, sell or blocker clear is applied (ADR-0004). Enemies read the new field on that same tick.
- **Steering.** Each ground enemy follows the field downhill. It looks ahead up to 4 cells to the furthest cell it can see with body-radius clearance, and heads for it. That gives any-angle movement instead of 8-direction zig-zags.
- **Turning.** Heading changes at no more than a set turn rate (default 360°/s). Speed drops on sharp turns, to a floor of 35%. A new route therefore produces a smooth arc, never a snap.
- **Lanes.** Each enemy has a small fixed lane offset of ±0.22 cells, seeded, so a column reads as a crowd rather than single file. The offset is clamped so bodies never clip unwalkable cells.

**Acceptance**
- **R-MOVE-1** (no teleport): Between consecutive ticks no enemy moves further than `speed × dt × 1.01` along its path. The only exceptions are tunnel transits and scripted boss drops, which emit explicit events.
- **R-MOVE-2** (no jitter): During a re-path, an enemy's heading changes by no more than `turnRate × dt` per tick, and it never reverses heading on two consecutive ticks unless an effect caused it.
- **R-MOVE-3**: Enemies use the new route on the tick after a build or sell is applied.
- **R-MOVE-4**: A ground enemy of any size, on the widest lane offset, never wedges against a wall: walking a corridor past a short wall on its lane side, it reaches the exit without standing still while it isn't stunned. (Found at the v1.1 review: a Glacier Grinder stood still for an hour of game time on Grinder's Glacier.)

### 3.4 Path marker and live preview

- Animated chevrons along each current ground route, and a dotted line for each air lane, show every route. The marker is on by default. It toggles with a HUD button, the `R` key, and a setting.
- While a tower is being dragged or hovered, the would-be routes are drawn as bright animated chevrons and the current routes dim. The preview is a read-only query and does not change the simulation (`previewPlacement`).

**Acceptance**
- **R-MARK-1**: The marker toggles without changing the simulation.
- **R-MARK-2**: The preview updates within one frame of the ghost moving to a new cell.

### 3.5 Air units

- Air units fly a straight line from their spawn point on the entrance span to the matching point on the exit span, and ignore the maze. Some levels have **air-only entrances**.
- Only these towers hit air: Rattler, Skylark, Sparkplug, Sunbeam and Bubbler. The build bar and the tower panel mark each tower "Ground", "Air" or "Ground + Air".

**Acceptance**
- **R-AIR-1**: An air unit's position is always on the segment from its spawn to its exit, and towers never alter its path. Bubbler is the exception: it pushes air units back along the same segment.

### 3.6 Lives and losing

- Lives start at the level's value (default 20). An escaping enemy removes its leak cost: 1, or 5 for bosses. At 0 lives the level is lost.

### 3.7 Tower tiers and selling

- Every tower has 3 tiers. You build T1 and upgrade to T2, then T3. Each tier changes the stats and the look.
- Selling refunds `floor(0.75 × total spent)`, where total spent is the build cost plus all upgrades. The panel shows the refund before you confirm.
- **R-ECON-1**: A sale refunds exactly `floor(sellRate × totalSpent)`, with `sellRate` taken from `economy.json` (0.75).

### 3.8 Waves and calling early

- Waves launch on a countdown, measured from the previous launch. The first wave waits until the player presses Start.
- **The countdown quickens** (ADR-0011). On a Standard level with N waves, the countdown after wave k is `interval + (intervalEnd − interval) × (k − 1) / (N − 2)` seconds, rounded to whole ticks, for k = 1 … N − 1. The first countdown is the level's `interval` (20 s by default) and the last is its `intervalEnd` (14 s on Standard levels). A level without `intervalEnd` keeps a fixed countdown; Sudden Death, Time Trial and Puzzle levels do. Endless waves beyond the script keep `intervalEnd`.
- **Call early** launches the next wave now and pays `round(earlyRate × waveBounty × remaining / gap)`, where `gap` is the full length of the countdown running now, and `earlyRate = 0.25` by default. The button shows the bonus as a live number. Several waves can be in flight at once.
- **R-ECON-2**: The early bonus matches the formula, is paid once per wave, and is zero once the countdown reaches 0.
- **R-WAVE-4**: On a Standard level, the ticks between consecutive wave launches follow the formula above: the first gap is `interval`, the last is `intervalEnd`, and no gap is longer than the one before it.

### 3.9 Difficulty and stars

- Every level offers Casual, Tough and Heroic, worth 1, 2 and 3 stars. The level keeps the best result. A Heroic win awards all 3 stars in one go.
- Stars unlock zones and towers (§12).

### 3.10 Endless

- Winning a level on any difficulty unlocks Endless on that level. It uses Tough multipliers, and waves keep escalating after the level's last scripted wave (§9.4). Your score is the number of waves survived. The best per level is saved. Endless does not award stars.

---

## 4. Towers

Twelve towers. The numbers below are **starting balance values**; the live values are in `data/balance/towers.json`. Ranges are in cells. DPS is at T1 against an unarmoured target.

| # | Tower | Role | Hits | Cost (T1 / T2 / T3) | Range | Damage and rate at T1 | Damage type |
|---|---|---|---|---|---|---|---|
| 1 | **Rattler** | Cheap rapid fire | Ground + Air | 15 / 20 / 45 | 2.5 | 4 × 5/s (20 DPS) | kinetic |
| 2 | **Treacle Pump** | Slowing | Ground | 25 / 30 / 60 | 2.25 | 2 × 1.2/s, slows 35% for 2 s | kinetic |
| 3 | **Skylark** | Homing anti-air | Air | 35 / 40 / 80 | 4.0 | 30 × 0.8/s, splash 0.5 | explosive |
| 4 | **Scorcher** | Short-range area burn | Ground | 45 / 50 / 100 | 1.75, 60° cone | 18 DPS in the cone plus a burn of 6 DPS for 3 s | fire |
| 5 | **Sparkplug** | Chain lightning | Ground + Air | 70 / 70 / 140 | 3.0 | 40 × 0.8/s, 3 jumps (−20% per jump, 1.5-cell hop) | shock |
| 6 | **Thumper** | Long-range artillery | Ground | 60 / 60 / 130 | 6.0, minimum 1.75 | 70 × 0.4/s, splash 1.0 (50% at the edge), 1.2 s flight | explosive |
| 7 | **Sunbeam** | Piercing beam | Ground + Air | 90 / 90 / 180 | 5.0 | 120 to everything in the line, every 2.0 s (1.2 s charge) | beam |
| 8 | **Icebox** | Freeze / stun | Ground | 65 / 70 / 140 | radius 1.75 | Pulse every 3.5 s: freeze 1.0 s, 10 damage, then Brittle (+20% damage taken) for 2 s | cold |
| 9 | **Tea Urn** | Support buff | — | 80 / 80 / 160 | aura 1.5 | Towers in the aura fire 15% faster | — |
| 10 | **Bellower** | Signature: about turn | Ground | 75 / 70 / 150 | 2.25, 90° cone | Every 5 s, ground enemies in the cone march *backwards* for 1.2 s | — |
| 11 | **Bubbler** | Signature: bubble lift | Ground + Air | 55 / 60 / 130 | 3.0 | Every 4 s, bubbles 1 target for 2.5 s; it floats back along its route and pops for 15 | — |
| 12 | **Pie Chucker** | Signature: custard volley | Ground | 50 / 55 / 120 | 4.0, minimum 1.0 | 25 × 0.6/s, splash 0.75, Custarded: −4 armour and −15% speed for 4 s | kinetic (lobbed) |

**Tier changes and look.** Every tower is drawn with a top face and a front face and lit from the top left. Each tier adds visible parts, so a T3 reads differently from a T1 at phone size.

1. **Rattler.** A twin-barrel gun behind a ring of sandbags, with a brass ammo drum.
   - T2: 7 damage, range 2.75. Gains a gun shield.
   - T3: 11 damage at 6/s, with *steel-tipped rounds* (armour penetration 3). Gains triple barrels and a spinning drum.
2. **Treacle Pump.** A copper kettle-pump on a handcart with a hose nozzle.
   - T2: slows 45%, range 2.5. Gains a bigger boiler.
   - T3: slows 55% with a 0.75 splash, and leaves sticky puddles that slow for 3 s. Gains twin nozzles.
3. **Skylark.** A crate launcher that fires bird-winged rockets from a rotating rack.
   - T2: 50 damage, range 4.5.
   - T3: a twin salvo of 2 rockets at 60 damage each. Gains a radar dish.
4. **Scorcher.** A pot-bellied stove on wheels with a swivel nozzle.
   - T2: 30 DPS, range 2.0.
   - T3: 48 DPS, and leaves 2-second burning patches. Gains a chimney that belches smoke.
5. **Sparkplug.** A giant spark plug on a dynamo, wrapped in copper coils.
   - T2: 60 damage, 4 jumps.
   - T3: 85 damage, 6 jumps, and every 4th zap stuns for 0.4 s (not bosses). Does double damage to shields at every tier.
6. **Thumper.** A stubby mortar in a sandbag pit.
   - T2: 110 damage, range 6.5.
   - T3: each shell also scatters 4 bomblets of 25 damage. Gains a second tube.
7. **Sunbeam.** A giant brass magnifying lens on a tripod with a mirror dish.
   - T2: 190 damage, 1.0 s charge.
   - T3: 280 damage, beam width 0.5, and the beam sets targets alight (burn of 10 DPS for 2 s).
8. **Icebox.** A chunky freezer chest with frosty vents and a fan on top.
   - T2: freeze 1.3 s, radius 2.0.
   - T3: pulses every 2.8 s, and Brittle rises to +35%.
9. **Tea Urn.** A big brass urn with bunting, puffing steam.
   - T2: +25% fire rate and +10% range to towers in the aura.
   - T3: +30% fire rate, +15% range and +15% damage.
   - Auras never stack; a tower takes the strongest one covering it.
10. **Bellower.** A gramophone-horn megaphone on a parade podium. The enemies it hits get an "ABOUT TURN!" speech bubble.
    - T2: 1.6 s reversal, 110° cone.
    - T3: 2.0 s reversal, and enemies are dizzy for 0.3 s at the end.
    - An enemy that has just been reversed ignores Bellowers for 4 s. Bosses are immune.
11. **Bubbler.** A clawfoot bathtub on legs with a giant bubble wand and a rubber duck.
    - T2: bubbles 2 targets for 3 s.
    - T3: bubbles 3 targets, and each popping bubble leaves a slowing foam (30% for 2 s).
    - Bosses are immune. Big Lummox and Tin Kettle can only be bubbled by T2 and above.
12. **Pie Chucker.** A spring catapult on a bakery cart with a stack of custard pies.
    - T2: 40 damage, −6 armour.
    - T3: throws 3 pies per volley.

**Targeting priority.** Every tower that attacks offers First, Last, Strongest and Closest. The default is First.
- First is the least remaining route distance. For air units it is the straight-line distance to their exit.
- Strongest is the highest current HP plus shield.
- Ties go to the lower entity ID.

Tea Urn and Icebox (a pulse) have no targeting control.

**Loadout.** Before each level the player picks up to 6 unlocked towers. Puzzle levels fix the set.

---

## 5. Enemies

The Grand Blustering Army are small, round, moustachioed soldiers in maroon tunics with mustard trim and tall fuzzy plumed helmets. They are slightly silly, and they read clearly as chunky silhouettes about 0.4 cells across. Vehicles are dented and patched with rivets. Skin tones vary across the Army.

The numbers below are starting values; the live values are in `data/balance/enemies.json`. HP is at wave 1 and scales per wave (§9.3). Speed is in cells per second. Bounty is in coins. Threat is the wave-budget cost.

| # | Enemy | Role | HP | Speed | Armour | Trait | Bounty | Threat | Elite variant (HP ×2.5 and bounty ×2.5 unless noted) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Footling** | Infantry | 50 | 1.0 | 0 | — | 2 | 1 | *Veteran*: armour 2, medal ribbons |
| 2 | **Scarper** | Fast runner | 35 | 1.9 | 0 | — | 2 | 1.2 | *Sprinter*: speed 2.2, plus a 2 s burst of +50% when first hit |
| 3 | **Putt-Putt** | Fragile fast bike | 20 | 2.8 | 0 | Arrives in packs of 6–10 | 1 | 0.6 | *Crash Helmet*: armour 2 |
| 4 | **Tin Kettle** | Armoured car | 180 | 0.75 | 6 | Takes +25% from fire | 6 | 4 | *Boilerplate*: armour 10, plus a +40% steam dash below 50% HP |
| 5 | **Big Lummox** | Heavy brute | 400 | 0.55 | 2 | Slows and stuns on it are halved | 10 | 8 | *Colossal*: immune to Bellower and Bubbler |
| 6 | **Brolly Guard** | Shielded | 60 + 60 shield | 0.9 | 0 | The shield regenerates at 20/s after 3 s without damage. Shock does ×2 to shields and fire ×0.5. A broken brolly flips inside out, comically. | 4 | 2.5 | *Storm Brolly*: 120 shield, regenerates after 2 s |
| 7 | **Sawbones** | Medic | 80 | 0.9 | 0 | Every 2 s, heals allies within 1.5 cells for 8% of their max HP (bosses 2%) | 5 | 3 | *Surgeon-General*: heals 12% and cleanses slow and burn |
| 8 | **Trenchcoat Trio** | Splitter | 150 | 0.85 | 1 | Three soldiers in one long coat. On death it splits into 3 Tiddlers spread along the route. | 4 | 4 | *Greatcoat Trio*: splits into elite Tiddlers |
| 9 | **Tiddler** | Split-off | 30 | 1.4 | 0 | Only ever spawned by a Trio | 1 | — | *Elite Tiddler*: 60 HP, armour 1 |
| 10 | **Tub-Thumper** | Speed aura | 90 | 1.0 | 1 | Allies within 1.5 cells move 25% faster (does not stack; does not affect itself) | 5 | 3 | *Bandmaster*: +35%, and allies also gain +1 armour |
| 11 | **Whirligig** | Fast air | 45 | 1.8 | 0 | Air | 3 | 1.5 | *Ace*: armour 1 |
| 12 | **Gasbag** | Heavy air | 500 | 0.45 | 3 | Air | 12 | 10 | *Dreadnought*: 1100 HP, releases 2 Whirligigs on death |

**Bosses.** There is one per zone. An escaped boss costs 5 lives. Every boss is immune to stun, reversal and bubbles, and slows on a boss are capped at 30%. On Heroic, bosses have 1.25× the multiplied HP, plus gold trim.

| Zone | Boss | HP | Speed | Armour | Behaviour |
|---|---|---|---|---|---|
| 1 | **Old Flattener**: a steamroller with a brass whistle | 3000 | 0.4 | 4 | At 50% HP it vents steam and speeds up to 0.6 for 5 s |
| 2 | **Dune Dredger**: a sand crawler with a rear hatch | 5000 | 0.45 | 3 | Every 6 s it deploys 2 Putt-Putts behind itself |
| 3 | **Glacier Grinder**: an icebreaker on sledge runners | 7000 | 0.4 | 5 | Has a 2000-point ice shield. When the shield breaks, the boss is stunned for 2 s (the one stun a boss takes), and the shield regrows 8 s later. Shock does ×2 to the shield. |
| 4 | **Smogmother**: an air boss, a smoky zeppelin | 9000 | 0.35 | 4 | Every 8 s it drops a Tin Kettle onto the nearest cell below it that still has a route to that Kettle's exit |
| 5 | **Kerblam Mech**: General Bluster's walking boiler | 16000 | 0.45 | 6 | Three phases. Below 66% HP it launches 3 Whirligigs every 10 s. Below 33% it sheds its plating (armour 0) and speeds up to 0.7. On defeat, Bluster flees in a tiny escape pod (cosmetic). |

**R-ENEMY-1**: Every enemy type and its elite variant behave as described in this table. Bosses included: each has a Vitest scenario test.

---

## 6. Combat model

Damage types are kinetic, explosive, fire, shock, beam and cold. For each type, `data/balance/damage.json` gives an armour penetration, a multiplier against shields, and a per-enemy vulnerability multiplier.

| Type | Armour penetration | Against shield | Note |
|---|---|---|---|
| kinetic | 0 | ×1 | Rattler's T3 adds a flat 3 penetration |
| explosive | 0.3 | ×1 | |
| fire | 1.0 (ignores armour) | ×0.5 | Burn is applied as damage-over-time ticks |
| shock | 0.5 | ×2 | |
| beam | 0.5 | ×1 | |
| cold | 1.0 | ×1 | |

**Hit resolution** (applied in this order, in `src/sim/combat/damage.ts`):

```
raw = hit × vulnerability[enemy][type] × (brittle ? 1 + brittleBonus : 1) × coverMul
if shield > 0:                                  # shields ignore armour
    s = raw × shieldMul[type];  absorbed = min(shield, s);  shield −= absorbed
    raw = (s − absorbed) / shieldMul[type]      # leftover, back in HP terms
effArmour = max(0, armour − custardShred − flatPen) × (1 − pen[type])
dealtHP   = raw > 0 ? max(raw × minChip, raw − effArmour) : 0      # minChip = 0.15
```

- **Armour shrugs off small hits.** A T1 Rattler does 4 damage, which is 0.6 damage (the 15% minimum) against a Tin Kettle's armour of 6. Thumper, Sunbeam, Pie Chucker and burn are the counters.
- **Cover.** Units in a trench take ×0.6 from direct fire (kinetic, beam and shock that is not lobbed). Lobbed, explosive, fire and cold attacks take full effect.
- **Status stacking.**
  - Slow: only the strongest applies, and bosses are capped at 30%.
  - Freeze: after a freeze, the enemy is immune to freezing for 1.5 s.
  - Burn: refreshes duration, and stacks up to 3 sources.
  - Brittle and Custarded: take the strongest and refresh.
  - Reversal: 4 s immunity afterwards.
  - Bubble: bubbled units ignore forward movement and all other movement effects.
- **Projectiles.**
  - Rattler, Sparkplug and Sunbeam resolve on the tick they fire; tracers and bolts are visual only.
  - Skylark rockets home in, with a turn rate.
  - Thumper and Pie Chucker shells lead the target: they aim at its predicted route position when they land, and resolve the splash on landing.
  - Scorcher applies its cone every tick.

**Acceptance**
- **R-DMG-1**: Table-driven unit tests cover every row of the damage-type table, the minimum chip, the shield overflow, cover, and each stacking rule.
- **R-DMG-2**: Balance values come only from `data/balance/*.json`. A test fails if `src/sim` contains a literal balance number (tower or enemy stats) outside the loader.

---

## 7. Economy

These are starting values; the live values are in `data/balance/economy.json`.

- **Starting cash** is set per level: 150–400, rising through the zones.
- **Bounty** is paid on each kill: enemy bounty × zone multiplier × difficulty multiplier × `(1 + 0.02 × (wave − 1))`.
- **Early-call bonus** is defined in §3.8.
- **Selling** is defined in §3.7.
- **Clearing a removable blocker** costs the amount the level sets (10–60 coins).
- There is no interest and no income tower. Puzzle levels switch bounty off; their cash is fixed.
- Coin pops show every payout at the point where it was earned.

**R-ECON-3**: Bounty, early bonus, refunds and blocker clearing are unit-tested, together with a cash ledger invariant: `cash = start + income − spend` at every tick of a scripted game.

---

## 8. Difficulty model

Values live in `data/balance/difficulty.json`.

| | Casual | Tough | Heroic |
|---|---|---|---|
| Enemy HP | ×1.00 | ×1.25 | ×1.45 |
| Enemy speed | ×1.00 | ×1.04 | ×1.08 |
| Starting cash | ×1.00 | ×0.95 | ×0.90 |
| Bounty | ×1.00 | ×1.00 | ×0.95 |
| Extra elite share | +0% | +10% | +20% |
| Waves | N | N+5 | N+10 |
| Stars | 1 | 2 | 3 |

These values were softened on 2026-09-25 during M3 level validation. The first proposal (HP ×1.30 and ×1.65, cash ×0.90 and ×0.80) left Heroic unwinnable for the reference bot on most Zone 1 levels, once combined with the extra waves.

Lives are set per level and are the same on every difficulty. The exceptions are Sudden Death and Puzzle, which set lives per difficulty (§10).

**"Measurably harder"** is defined, for the validator, as either of these:
- the bot's remaining lives on Heroic are **at least 2 fewer** than on Casual; or
- if both sides are at full lives, the bot's **peak threat** on Heroic is at least 0.05 higher than on Casual. Peak threat is the furthest fraction of its route any enemy covered before it died, as a 95th percentile over the last third of the waves launched. (Sudden Death and Time Trial end on the clock or the kill count, usually before the scripted waves run out, so the window is taken from the waves actually played.)

§15 describes the validator.

---

## 9. Waves

### 9.1 Structure

- A wave is made of 1–4 **groups**. A group is a number of units of one enemy type (plain or elite) on one route, spawned at a set spacing in seconds.
- Ground units spawn up the entrance lane, 6.5 cells beyond the map edge, spread across the entrance span, and walk down the lane into the field. A leaker walks out down the exit lane and escapes 2.75 cells beyond the edge, where it costs its lives. It is then drawn walking on down the lane until it is out of sight; it is no longer in the simulation, so nothing can hit it. In a lane a unit can be hit by any tower in range. (Zone 1 paints the lanes; until the art roll-out the other zones' units walk in over the border.)
- **A lane ends under the trees.** The forest closes over each entrance lane 5.25 cells beyond the edge (4.5 on a south edge, where the tallest units reach furthest towards the field), and over each exit lane 8 cells beyond it. Those trees are drawn over the units. On common desktop windows both ends are off screen, so a unit walks on from the window's edge and a leaker walks off it. On a wider window a unit steps out of the trees and a leaker walks into them. A ground unit is never drawn popping into or out of view on open ground. (In zones 2–5, until they get lanes, the zone's border is drawn over the units instead.)
- Air units spawn and escape 0.75 cells beyond the edge (§3.5).
- Air groups use the route's air lane.

### 9.2 Generation (ADR-0007)

Hand-writing 40 × 60 waves is not practical. Each level instead has a **recipe**, and the recipe is expanded deterministically from the level seed and the difficulty.
- A **budget curve**: `budget(w) = b0 × g^(w−1)`, with defaults `b0 = 8` and `g = 1.06`.
- An **enemy pool**: each type has the wave it first appears (`fromWave`) and a weight.
- **Pattern rules**: which waves are air-only (for example every 7th), which are elite waves (every 10th, and the final ones), and where mixed waves fall.
- **Overrides**: specific waves written out in full, such as intros, boss waves and puzzles.

Puzzle levels, and any level that wants it, can list every wave explicitly. The generator is pure and deterministic. The **next-wave preview** is exact, because every wave is generated when the level loads.

### 9.3 Scaling

- Enemy HP multiplier at wave w: `1 + 0.035 × (w − 1)`, times the level's own HP scale (`recipe.hp`, default 1, the main tuning lever), times the zone multiplier (Z1 1.0, Z2 1.25, Z3 1.55, Z4 1.9, Z5 2.3), times the difficulty multiplier.
- The elite share rises from 0 at the first elite wave to 35% by the final wave, plus the difficulty's extra share.
- The boss wave is the final wave of boss levels. A zone boss can also appear as a mid-level mini-boss where the level sets it.

### 9.4 Endless

Endless continues the level's recipe beyond its final wave:
- the budget and HP growth carry on;
- the elite share climbs towards 100% over the next 30 waves;
- the zone boss appears every 10 waves.

### 9.5 Next-wave preview

The HUD shows a chip for each group in the next wave: an enemy icon, a count, and badges for elite (a gold star), air (wings) and boss (a crown). Tapping or hovering expands it to show the wave after that as well.

**Acceptance**
- **R-LANE-1**: A ground unit spawns 6.5 cells beyond its entrance edge, walks to the map edge without breaking R-MOVE-1, and leaks only once it is 2.75 cells beyond its exit edge.
- **R-LANE-2** (drawn):
  1. At its spawn point, every ground unit's sprite lies wholly under the trees at its lane's end.
  2. After a leak the unit is still drawn, walking on down its exit lane, until its sprite lies wholly off the screen or under the trees at the lane's end. Then it is removed.
  3. On every level, at the desktop viewports (1366×768, 1920×1080 and 3840×2160, plus a 1440×789 laptop browser window), the trees at every ground lane's end lie beyond the window's edge, their fringe of leaves included.

  Checked by Vitest over the layout (1, 3) and by Playwright on Kettle Crossing at 1440×789 (1, 2), where 2.9 cells of the entrance lane are on screen.
- **R-WAVE-1**: The same level, difficulty and seed expand to identical waves.
- **R-WAVE-2**: The preview matches what actually spawns.
- **R-WAVE-3**: Every recipe produces waves whose threat is non-decreasing, within ±15% noise, apart from breather waves the recipe tags explicitly.

---

## 10. Modes

| Mode | Win | Lose | Per-difficulty parameters |
|---|---|---|---|
| **Standard** | Survive every wave (20–40) | Lives reach 0 | Wave count N / N+5 / N+10 |
| **Sudden Death** | Survive the timer against a continuous stream that escalates | Lives reach 0 | Timer, stream rate, lives 5 / 3 / 1 |
| **Time Trial** | Kill X enemies before the clock runs out | Clock runs out first, or lives reach 0 | X (the kill target), with the same timer on every difficulty |
| **Puzzle** | Survive the fixed waves | Lives reach 0 | Fixed cash and tower set, no bounty, lives 10 / 5 / 1 |
| **Endless** | — (score is waves survived) | Lives reach 0 | Tough multipliers |

### 10.1 Mode HUD variations

- Sudden Death shows a countdown timer in place of the wave counter.
- Time Trial shows kills against the target, and the timer.
- Puzzle shows "Fixed budget". There is no call-early bonus.

### 10.2 Sudden Death lives

5 / 3 / 1 by difficulty, as agreed at review.

---

## 11. Zones and levels

The world map is a painted overworld: five regions linked by a dotted road. Level nodes are medallions showing the level number and its stars. A locked zone is shown under a drift of cloud, with its star requirement. Every landmark stands on land, with a contact shadow, and lies wholly inside the map, its smoke included. Mount Kerblam's lava is one unbroken flow from the crater, down the flank and across the land to the sea.

| Zone | Name | Theme and decoration | Stars to enter* |
|---|---|---|---|
| 1 | **Buttercup Downs** | Farmland: hedgerows, haybales, sheep, a windmill, oaks along the edges | 0 |
| 2 | **Scorchsand Flats** | Desert: mesas, flowering cacti, sandstone arches, mine carts, wind pumps | 8 |
| 3 | **Frostnip Fells** | Snow: pines, snowmen, frozen meres, log cabins | 18 |
| 4 | **Grimebottom Works** | Industrial: chimneys, pipes, gears, crates, rail yards, sludge canals | 30 |
| 5 | **Mount Kerblam** | Volcanic: basalt columns, lava rivers, steam vents, charred trees | 44 |

\*You also need to have won the previous zone's final level. The zone thresholds mean a player who only plays Casual must earn 2 extra stars before Zone 3, 6 before Zone 4 and 12 before Zone 5.

**Level list.** *Wave counts are Casual / Tough / Heroic (cut by about a third at the v1.1 review, ADR-0011).* "New" marks what each level introduces. Every level introduces at least one thing.

| # | ID | Name | Mode | Waves / params | Routes | Lives | New / hook |
|---|---|---|---|---|---|---|---|
| 1 | z1-01 | Primrose Lane | Standard | 20/25/30 | 1 (W→E) | 20 | **Rattler**, **Footling**. Tutorial: an open meadow with a few rocks. Learn to maze. |
| 2 | z1-02 | Treacle Tart Farm | Standard | 20/25/30 | 1 (N→S) | 20 | **Treacle Pump**, **Scarper**. Fast runners outpace a maze that doesn't slow them. |
| 3 | z1-03 | Skylark Common | Standard | 20/25/30 | 1 + air lane | 20 | **Skylark**, **Whirligig**. Air ignores the maze. |
| 4 | z1-04 | Haybale Hollow | Puzzle | 12 waves; Rattler and Treacle Pump only | 1 | 10/5/1 | First puzzle. **Removable haybales**: pay to clear them and open a longer route. |
| 5 | z1-05 | Kettle Crossing | Standard | 21/26/31 | 1 | 20 | **Tin Kettle** (armour) and **Thumper**, whose minimum range must be respected. |
| 6 | z1-06 | Two Stiles | Standard | 21/26/31 | 2 entrances → 1 exit | 20 | Converging routes. **Flower beds** (restricted build: "Keep off the grass"). |
| 7 | z1-07 | Millrace Meadow | Standard | 23/28/33 | 1 | 20 | **River and bridges** as chokepoints. **Big Lummox**. First **elite wave**. |
| 8 | z1-08 | Flattener's Folly | Standard (boss) | 23/28/33 | 1 | 20 | Boss: **Old Flattener**. |
| 9 | z2-01 | Dustdevil Drift | Standard | 21/26/31 | 1 | 20 | **Scorcher**, **Putt-Putt** packs on wide sand. |
| 10 | z2-02 | Mineshaft Gulch | Standard | 23/28/33 | 1 | 20 | **Mine tunnels**: hidden transit that you can't maze. |
| 11 | z2-03 | Brolly Pass | Standard | 23/28/33 | 1 | 20 | **Sparkplug**, **Brolly Guard** (shock breaks shields). Narrow canyon. |
| 12 | z2-04 | Forked Mesa | Standard | 23/28/33 | 2 entrances → 2 exits, crossing | 20 | First **separate exits**. One maze has to serve two crossing routes. |
| 13 | z2-05 | Sandglass | Sudden Death | 4:00 / 5:00 / 6:00 | 1 | 5/3/1 | First **Sudden Death**. |
| 14 | z2-06 | Custard Oasis | Standard | 23/28/33 | 1 | 20 | **Pie Chucker**, **Trenchcoat Trio** and Tiddlers. Oasis pools. |
| 15 | z2-07 | The Long Mirage | Time Trial | kill 180 / 230 / 280 in 5:00 | 1 + air | 20 | First **Time Trial**. |
| 16 | z2-08 | Dredger Dunes | Standard (boss) | 25/30/35 | 1 | 20 | Boss: **Dune Dredger**. |
| 17 | z3-01 | Snowdrop Slope | Standard | 23/28/33 | 1 | 20 | **Icebox**. **Ice patches**: walkable, unbuildable, enemies ×1.35 speed. |
| 18 | z3-02 | Gasbag Ridge | Standard | 24/29/34 | 1 + **air-only entrance** | 20 | **Gasbag**. First air-only entrance. |
| 19 | z3-03 | Sawbones Hollow | Standard | 24/29/34 | 1 | 20 | **Sawbones**. **Snow trenches**, which give cover against direct fire. |
| 20 | z3-04 | Glassy Mere | Standard | 25/30/35 | 1 | 20 | **Sunbeam**. A frozen mere with long causeways that line enemies up. |
| 21 | z3-05 | Cracked Ice | Puzzle | 15 waves; Icebox, Sunbeam and Rattler | 1 + air | 10/5/1 | First puzzle with air and freeze timing. |
| 22 | z3-06 | Bubble Pass | Standard | 25/30/35 | 1 + air | 20 | **Bubbler**. Mixed air and ground in every wave from wave 10. |
| 23 | z3-07 | Whiteout | Sudden Death | 5:00 / 6:00 / 7:00 | 2 → 1 | 5/3/1 | First Sudden Death with more than one route. |
| 24 | z3-08 | Grinder's Glacier | Standard (boss) | 27/32/37 | 1 | 20 | Boss: **Glacier Grinder**. |
| 25 | z4-01 | Conveyor Junction | Standard | 25/30/35 | 1 | 20 | **Tea Urn**. **Conveyor belts** that push units along. |
| 26 | z4-02 | Drumbeat Depot | Standard | 25/30/35 | 1 | 20 | **Tub-Thumper**. **Removable crates** that make shortcuts, at a price. |
| 27 | z4-03 | Railyard Rumble | Standard | 27/32/37 | 2 → 2 | 15 | **Rail lines** (restricted strips). **Sludge canals** with bridges. Fewer lives. |
| 28 | z4-04 | Megaphone Mill | Standard | 27/32/37 | 1 | 20 | **Bellower**. Long machine-hall corridors. |
| 29 | z4-05 | Pipeworks | Time Trial | kill 260 / 320 / 380 in 6:00 | 1 | 20 | **Three tunnel pairs** (pipes). First Time Trial with tunnels. |
| 30 | z4-06 | Sludge Sluice | Puzzle | 16 waves; Tea Urn, Pie Chucker, Thumper and Rattler | 1 | 10/5/1 | Support-placement puzzle on conveyors. |
| 31 | z4-07 | Night Shift | Sudden Death | 6:00 / 7:00 / 8:00 | 3 → 1 | 5/3/1 | Three converging entrances. A **night** lighting variant with lamp pools. |
| 32 | z4-08 | Smogmother's Stacks | Standard (boss) | 28/33/38 | 1 + air | 20 | Air boss: **Smogmother** (drops Tin Kettles). |
| 33 | z5-01 | Cinder Steps | Standard | 27/32/37 | 1 | 20 | **Lava rivers** and narrow basalt bridges. |
| 34 | z5-02 | Ashfall Terrace | Time Trial | kill 320 / 390 / 460 in 6:00 | 2 → 1 | 20 | An **all-elite** stream. |
| 35 | z5-03 | Three Craters | Standard | 28/33/38 | 3 → 3, interleaved | 20 | Three routes that each placement affects together. |
| 36 | z5-04 | Obsidian Knot | Puzzle | 18 waves; 5 fixed towers | 1 + air | 10/5/1 | Many removable obsidian blocks: clearing budget against building budget. |
| 37 | z5-05 | Magma Tunnels | Standard | 29/34/39 | 1 | 12 | Tunnels under lava, plus trenches. Fewer lives. |
| 38 | z5-06 | Eruption | Sudden Death | 6:00 / 7:30 / 9:00 | 2 → 1 | 5/3/1 | **Bosses in the stream**: Old Flattener as a recurring mini-boss. |
| 39 | z5-07 | The Last Roundabout | Standard | 30/35/40 | 2 + air-only | 10 | The largest map (26×15), with every terrain type. |
| 40 | z5-08 | Bluster's Last Stand | Standard (boss) | 30/35/40 | 2 + air | 20 | Final boss: **Kerblam Mech**, in three phases. |

That is 29 Standard levels (5 of them boss levels), 4 Sudden Death, 3 Time Trial and 4 Puzzle.

---

## 12. Progression, unlocks, loadouts and field guide

- **Levels** unlock in order: winning one on any difficulty unlocks the next. The first level of each zone also needs that zone's star threshold (§11).
- **Towers** unlock permanently at star thresholds, held in `data/balance/progression.json`:

  | Tower | Stars |
  |---|---|
  | Rattler | 0 |
  | Treacle Pump | 1 |
  | Skylark | 2 |
  | Thumper | 4 |
  | Scorcher | 8 |
  | Sparkplug | 10 |
  | Pie Chucker | 13 |
  | Icebox | 18 |
  | Sunbeam | 21 |
  | Bubbler | 23 |
  | Tea Urn | 30 |
  | Bellower | 33 |

  Each threshold equals the fewest stars any player can have on reaching that tower's introduction level. The fewest stars at level *k* is `minStars(k) = max(minStars(k−1) + 1, zoneGate(k))`, with `minStars(1) = 0`. So every player has a tower by the time its introduction level arrives, and a player who earns 3-star wins unlocks towers earlier.
- **Loadout screen.** Choose up to 6 unlocked towers before a level. Your last loadout is remembered per level. Puzzle levels show their fixed set, locked in.
- **Field guide.**
  - A tower's entry unlocks when the tower does.
  - An enemy's entry, and its elite entry, unlocks the first time that enemy spawns in front of you.
  - Each entry has a large portrait, a line of flavour text, stats, and a tip.
- **Per-level bests** are saved for each difficulty: the win, lives remaining, and the fastest sim time. Time Trial also keeps the most kills, and Endless keeps the most waves.

**R-PROG-1**: The validator confirms that every level's bot loadout uses only towers unlocked at `minStars(level)` (§15).

---

## 13. Architecture

```
src/
  sim/        Pure TypeScript simulation. No DOM lib, no timers, no Math.random. Runs in Node.
    core/     Fixed-step clock (30 Hz), seeded PRNG (sfc32), deterministic maths, IDs, state hash
    grid/     Terrain, occupancy, spatial hash
    path/     Per-exit distance fields, placement validation, steering, tunnels
    entities/ Plain-data records for enemies, towers, projectiles, zones
    systems/  spawn, move, status, target, fire, projectile, damage, economy, waves, modes
    level/    Load a LevelDef and expand it (waves, per-difficulty numbers)
    api.ts    createSim · step · apply(command) · previewPlacement · snapshot · restore · events
  bot/        Reference bot. Pure TS that only issues commands.
  data/       Zod schemas for balance files and levels. Types are inferred from the schemas.
  render/     PixiJS scene. Observes sim state and events and interpolates between ticks.
  audio/      Web Audio engine, sequencer, synths, SFX. Observes sim events.
  ui/         DOM overlay: HUD, panels, menus, world map, field guide, settings.
  app/        Boot, main loop, input, layout and scaling, saves, PWA, asset manifest.
  art/        Code-art drawing functions, used by the bake tool and the dev art gallery.
data/balance/*.json   data/levels/z*/**.json   data/schema/*.schema.json (generated)
tools/        bake-art, validate-levels, gen-schema, bench
tests/        Vitest (sim, bot, data, saves)   e2e/  Playwright
```

**Simulation contract** (ADR-0003):
- **Fixed step.** The clock ticks at 30 Hz (`dt = 1/30`). Every duration is converted to integer ticks at load.
- **Game speed.** 1×, 2× and 3× run 1, 2 and 3 ticks per 33 ms of real time. A frame runs at most 12 ticks. Pause runs none. Game speed therefore never changes outcomes.
- **Determinism.** Arithmetic is float64 using only `+ − × ÷` and `Math.sqrt`, which IEEE 754 defines exactly. Trigonometry and powers come from `sim/core/math.ts`, which is deterministic. The PRNG is `sfc32`, and its state is held in the simulation state. Every iteration is in ID order, and every sort uses a total comparator.
- **Purity is enforced two ways.**
  - `tsconfig.sim.json` compiles `src/sim`, `src/bot` and `src/data` with `lib: ["ES2023"]` and `types: []`, so any DOM reference fails to compile.
  - A Vitest "purity" test bans these in those folders: `Math.random`, `Math.sin`/`cos`/`tan`/`atan2`/`exp`/`log`/`pow`/`hypot`, `Date`, `performance`, and timers.
- **Commands** are the only way state changes: `build`, `upgrade`, `sell`, `setTargeting`, `callWave`, `clearBlocker`. They queue, and apply at the next tick boundary.
- **Events.** The simulation emits events that are drained once per frame. Rendering and audio use them. Examples: `spawned`, `fired{towerId, targetId, tier}`, `hit`, `killed{bounty,x,y}`, `leaked`, `built`, `sold`, `pathsChanged`, `waveStarted`, `bossArrived`.
- **Snapshots.** `snapshot()` returns plain JSON: the tick, the RNG state, every entity, the economy, waves and mode state, and a `simVersion`. `restore()` rebuilds derived data (distance fields and the spatial hash). `hash()` is an FNV-1a hash of a canonical serialisation, used by tests and the validator.
- **Rendering interpolates.** Entities hold their position from the previous tick, and the renderer blends between the two.

**Acceptance**
- **R-SIM-1**: The same seed, level and command log give an identical `hash()` after N ticks. This is checked across repeated runs, and across 1×, 2× and 3× loop pacing.
- **R-SIM-2**: A different seed changes the hash of a level with generated waves.
- **R-SIM-3**: Taking a snapshot at tick T, restoring it into a fresh simulation and continuing gives a hash identical to the uninterrupted run.
- **R-SIM-4**: The purity test and `tsc -p tsconfig.sim.json` both pass.
- **R-SIM-5**: `validate-levels` runs the same simulation code in Node that the browser runs. There is no separate implementation.

---

## 14. Data files and the level schema

### 14.1 Balance data

All tuning lives in `data/balance/`:

| File | Contents |
|---|---|
| `towers.json` | Per tower and tier: cost, range, rate, damage, type, special parameters, targets (ground and/or air) |
| `enemies.json` | Per enemy: HP, speed, armour, shield, radius, bounty, threat, leak cost, traits, elite overrides |
| `damage.json` | Per damage type: armour penetration, shield multiplier; per enemy: vulnerabilities |
| `economy.json` | Sell rate, early-call rate, bounty growth, HP growth, zone multipliers |
| `difficulty.json` | The table in §8 |
| `terrain.json` | Ice speed, conveyor push, and direction-aware conveyor path costs (§14.3) |
| `progression.json` | Zone gates, tower star thresholds |
| `modes.json` | Defaults for each mode |

- A Zod schema validates every file at test time and at validation time.
- In development, editing a file hot-reloads the current level.
- **R-DATA-1**: Changing a value in a balance file changes behaviour without touching any `.ts` file.

### 14.2 Level JSON

Levels are written by hand as JSON and validated against `data/schema/level.schema.json`. That schema is generated from the Zod schema by `npm run gen-schema`, and `$schema` links it so editors can autocomplete. An abridged example:

```json
{
  "$schema": "../../schema/level.schema.json",
  "id": "z1-06", "zone": 1, "name": "Two Stiles", "mode": "standard",
  "seed": 1606, "grid": { "cols": 22, "rows": 13 },
  "tiles": ["......................", "...##......x.........", "…13 rows…"],
  "routes": [
    { "id": "A", "entrance": { "edge": "W", "from": 5, "to": 7 }, "exit": { "edge": "E", "from": 5, "to": 7 } },
    { "id": "B", "entrance": { "edge": "N", "from": 9, "to": 11 }, "exit": { "edge": "E", "from": 5, "to": 7 } }
  ],
  "tunnels": [], "blockers": { "clearCost": 20 },
  "lives": 20, "startCash": 200,
  "loadout": { "fixed": null, "bot": ["rattler", "treacle", "skylark", "thumper"] },
  "waves": { "count": [21, 26, 31], "interval": 20, "intervalEnd": 14, "recipe": { "b0": 8, "g": 1.06, "pool": [ … ], "patterns": [ … ] }, "overrides": [ … ] },
  "hints": ["Two roads, one gate. Make them share a long way round."],
  "bot": { "plan": null }
}
```

### 14.3 Tile legend

| Char | Terrain | Ground can walk | Can build | Effect |
|---|---|---|---|---|
| `.` | Ground | ✓ | ✓ | — |
| `#` | Rock | ✗ | ✗ | Fixed blocker |
| `~` | Water (lava in Z5, sludge in Z4) | ✗ | ✗ | Air flies over |
| `=` | Bridge | ✓ | ✗ | — |
| `x` | Restricted (flower bed, rail) | ✓ | ✗ | — |
| `t` | Trench | ✓ | ✗ | Cover: ×0.6 from direct fire |
| `i` | Ice | ✓ | ✗ | Speed ×1.35 |
| `> < ^ v` | Conveyor | ✓ | ✗ | Pushes 0.6 cells/s in its direction; direction-aware path cost |
| `b` | Removable blocker (haybale, crate, obsidian) | ✗ | ✗ | `clearBlocker` for `clearCost` turns it into `.` |
| `o` | Tunnel mouth | ✓ | ✗ | Paired in `tunnels[]` with a `length`. Units inside can't be targeted. |

- Ground path cost is `1 / speedMultiplier` per cell. A diagonal costs √2 times that.
- Conveyors cost 0.6 when travelled along their direction, 1.8 against it, and 1.0 across it.
- Tunnels are graph edges whose cost is their `length`.

**R-LEVEL-1**: Every level file passes the schema. Rows and columns match the grid. Every tunnel mouth is paired. Every entrance and exit span lies on the map edge and on walkable cells.

---

## 15. Level validation (`npm run validate-levels`)

For every level, and for each of Casual, Tough and Heroic, the validator does the following:

1. **Schema and structure.** Checks R-LEVEL-1.
2. **Connectivity.** On the empty map, every route's entrance reaches its exit, and every air lane lies within the map.
3. **No towers.** Runs the simulation with no commands. The level must be **lost**; for Time Trial, the kill target must be missed.
4. **Bot win.** The reference bot plays and must **win**. This records:
   - margin: lives left ÷ lives at the start
   - cash earned
   - sim duration (mm:ss) and wall time
   - towers built, upgrades bought, and peak threat
5. **Measurably harder.** Heroic compared with Casual, as defined in §8.
6. **Loadout availability.** The bot loadout is a subset of the towers unlocked at `minStars(level)`, or it is the level's fixed set.
7. **Determinism.** Two bot runs give the same final hash.

**Report.** A table goes to stdout and `reports/levels.json` is written. The report also flags any difficulty-curve **warnings**, which don't fail the run: a Casual margin that isn't generally falling across the campaign, by more than 0.15 against the 3-level moving average. The process exits non-zero if any check fails. Levels run in parallel across worker threads.

### 15.1 The reference bot (`src/bot`)

The bot is deterministic, sensible, and not optimal. It uses only the public command API.
- **Maze step.** It scores candidate free cells near the current routes as:
  `3 × Δ(route length, weighted by each route's traffic) + 1 × (route cells inside the new tower's range) + 0.5 × adjacency to existing walls`.
  It places the best **valid** candidate.
- **Tower mix.** It keeps a target mix from its loadout: roughly 50% primary damage, 20% slow or crowd control, 20% splash, and 10% or more anti-air. It builds anti-air when air appears in the next 3 waves and its anti-air damage along the air lane is below what is needed.
- **Upgrades.** It upgrades when the best upgrade's DPS per coin beats the best new tower's. It never calls waves early.
- **Plans.** A level can supply `bot.plan`: a list of scripted commands run first, as hints. Puzzle levels **must** supply a complete plan, which serves as their reference solution. The report shows whether a win needed a plan. For puzzle levels it also reports whether the generic bot alone fails, as an indicator of how tight the puzzle is.

**Acceptance**
- **R-VAL-1**: `npm run validate-levels` exits 0 on all 40 levels × 3 difficulties before any release commit.
- **R-VAL-2**: The report contains the bot margin, cash earned and duration for every level and difficulty.

---

## 16. Art direction and visual tokens

### 16.1 Camera and look

- **Camera.** A top-down orthographic view of the ground, with a slight three-quarter "cheat". Every object shows its **top face and front (south) face**. Objects are anchored at their base on the cell centre, and taller parts overlap the cell above. Ground objects are depth-sorted by y. Air units sit on a higher layer and cast offset shadows further away.
- **Light.** It always comes from the **top left**.
  - Highlights sit on top-left edges, and the core shadow on the bottom right.
  - Cast shadows are soft blurred ellipses, offset (+0.12, +0.18) cells, at 35% ink.
- **Painted style.**
  - Chunky silhouettes with a warm-ink outline (`--ink`, 2.5 px at 2×), never pure black.
  - Layered gradient fills: a base colour, a radial highlight at the top left, ambient occlusion at contact points, and a faint bounce light at the bottom right.
  - A subtle baked noise texture, so surfaces read as painted rather than flat.
- **Scale.** A cell is 64 world units, and art is baked at @1x (64 px per cell) and @2x (128 px). An infantry soldier is about 0.42 cells across, a vehicle about 0.7, and a boss 1.6–2.2 cells. Bosses still path on the 1-cell grid.
- **Facings.**
  - Turret heads are baked in **16 facings**, and the renderer rotates the nearest facing by the remainder (at most ±11.25°). The head tracks its target smoothly and reads correctly at every angle while the lighting stays fixed.
  - Muzzle offsets are recorded for each facing.
  - Infantry: 8 facings × 4 walk frames. East-facing frames are mirrored to make west.
  - Vehicles: 16 facings.
- **The v1.1 art standard** (the Zone 1 sample, pending approval before it is rolled out to every zone and the whole roster):
  - The ground is one continuous painted surface with no visible cell grid. It is a seamless tiling texture with broad lit and shaded drifts, lit clumps and fine strokes, plus tufts, worn patches and flowers scattered off the grid.
  - Border trees and bushes are volumetric: one ink silhouette per canopy, three lit layers from the top left, leaf marks, a rim light, a visible trunk and a cast shadow. The trunk always reaches up into its crown. There are several species and sizes, the forest spills a fringe onto the field, and each gate opens a lane through it, which ends where the forest closes over it (§9.1).
  - The forest's shade falls along the field's edge but not across a gate: it fades out over a cell either side of each gate, so a lane runs into the field with no visible edge.
  - Towers show their materials: stitched sandbags laid in courses, gunmetal with a specular streak, brass hot-spots, wood grain, rivets and straps. Turning parts have real three-quarter thickness at every facing.
  - Units have one chunky ink outline round the whole figure, with thin inner lines, a core shadow away from the light, a warm bounce on the lower right, and period detail: shakos, epaulettes, buttons, buckles and goggles.
  - Colours still come only from the tokens, through `tone()`, `mix()` and `alpha()` (V-1). The sample needed no new tokens.
- **Terrain.**
  - Ground is painted per zone with variation.
  - Edges between water, rock and lava blend using marching squares.
  - Decoration is scattered from the level seed, with trees framing the map edges.
  - Minor decoration on buildable cells is hidden when you build there.
- **Effects.**
  - Muzzle flashes at the muzzle offset for each facing.
  - Rattler tracers.
  - Smoke puffs.
  - Explosions throw debris in a fake height axis.
  - Scorch decals fade over 8 s, capped in number.
  - A 60 ms hit flash (white tint).
  - Coin pops arc upwards with a "+N".
  - Treacle drips, custard splats, ice crystals and bubbles.
  - Sparkplug bolts are jagged polylines. Sunbeam's beam is a warm shaft of sunlight with soft edges, not a neon beam.
  - Screen shake on big hits (Thumper T3, boss deaths), toggleable in settings.
- **Juice.**
  - A placed tower drops in with a squash and a dust puff.
  - An upgrade snaps new parts on with a sparkle.
  - A sold tower is crated up and carried off by a parachute crate.
  - Defeated enemies go *poof*, and their helmet bounces.
  - Leakers run off with a biscuit, and the lives counter wobbles.
  - A boss gets an entrance banner. A win gets a medal ceremony with stamped stars. A loss gets a white flag and "Retreat!".

### 16.2 Art pipeline (ADR-0006)

- All v1 art is drawn by code with Canvas 2D in `src/art/`.
- `npm run bake-art` runs the drawing in Playwright's headless Chromium and writes:
  - atlas pages of at most 2048×2048, at @1x and @2x (PNG plus Pixi spritesheet JSON), packed by our own MaxRects packer;
  - the UI atlas;
  - the PWA icons;
  - `public/assets/manifest.json`.
- **Every** sprite is referenced by a manifest key, for example `tower.rattler.t2.head.f07`, `enemy.footling.elite.walk.se.2` or `ui.icon.coin`. No code mentions atlas files. Hand-painted atlases that use the same keys are a drop-in replacement: replace the PNG and JSON, and the manifest resolves them.
- `/dev/art.html` (development builds only) shows a gallery of every key at both scales, for review.

### 16.3 Colour tokens

These are defined once, in `src/app/tokens.ts` and `src/ui/tokens.css`. The art code and CSS use only tokens (V-1). There is no light/dark mode: the game has one themed look, and each zone has its own terrain palette.

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#2B1D14` | Outlines, text on light surfaces |
| `--ink-soft` | `#5A4332` | Secondary text, disabled outlines |
| `--parchment` | `#F6E7C1` | Panel face |
| `--parchment-shade` | `#E6CF98` | Panel inset |
| `--parchment-deep` | `#CDAE6E` | Panel dividers |
| `--wood` / `--wood-dark` | `#9A6431` / `#5E3A1A` | Panel frames, letterbox borders |
| `--brass` / `--brass-light` / `--brass-dark` | `#E3A92B` / `#FFE08A` / `#A8700F` | Secondary buttons, highlights, focus ring |
| `--go` / `--go-light` / `--go-dark` | `#5E9A2E` / `#92CF55` / `#3A6419` | Primary buttons |
| `--stop` / `--stop-light` / `--stop-dark` | `#D5452F` / `#F47E62` / `#8E2415` | Danger, sell, invalid placement |
| `--info` / `--info-light` / `--info-dark` | `#2F9BD6` / `#7CCBF2` / `#1B6592` | Range ring, valid placement, route marker |
| `--warn` | `#F2932B` | Warnings, boss banner |
| `--text-on-dark` | `#FFF6E0` | HUD numerals, text on wood |
| `--shadow` | `rgba(43,29,20,0.35)` | Cast shadows, UI drop shadows |
| `--cb-ok` / `--cb-bad` | `#0072B2` / `#E69F00` | Colour-blind mode (Okabe–Ito) for valid/invalid and range |

**Zone palettes** (terrain only):
- **Z1 Buttercup Downs**
  - grass `#7CC24A` `#5AA336` `#3F7D26`
  - dirt `#C9A064`
  - hedge `#2F6B2A`
  - flowers `#F7D348` `#F29CB7`
  - water `#4FB3E0` `#2D86BF`
- **Z2 Scorchsand Flats**
  - sand `#F0CF86` `#DDAE62` `#B9854A`
  - mesa `#C8764A` `#9A5238`
  - cactus `#5E9B45`
  - oasis `#4FC1D9`
- **Z3 Frostnip Fells**
  - snow `#F4F8FC` `#D6E4F0` `#A9C1D8`
  - ice `#BFE6F5` `#84C6E6`
  - pine `#2E6B4F` `#1F4D39`
  - timber `#8A5A35`
- **Z4 Grimebottom Works**
  - concrete `#B7B2A6` `#8F8A80`
  - steel `#7D8791` `#56606A`
  - rust `#C0612F`
  - hazard `#F2C230`
  - sludge `#6E8B3D` `#4E6B26`
  - brick `#A8553A`
- **Z5 Mount Kerblam**
  - basalt `#4A3B3A` `#33282A`
  - ash `#8C817B`
  - lava `#FF7A1F` `#FFB63B` `#D2461A`
  - obsidian `#26222A`

**Factions:**
- **Enemy Army:** maroon `#A33440`, mustard `#E8B53E`, khaki `#B9A56A`, moustache `#5B3A22`.
- **Enemy skin tones:** `#F2C6A0`, `#D39B6C`, `#9C6644`, `#6B4430`.
- **Irregulars' kit:** olive drab `#6F7F3A`, copper `#C9733A`, cream paint `#F2E3BD`, with red accent stripes in `--stop`.

### 16.4 Typography

- **Display: Lilita One** (OFL). Used for titles, HUD numerals, button labels and banners.
- **UI and body: Fredoka** (OFL) at weights 500, 600 and 700. Used for descriptions, stats and the field guide.
- Both are self-hosted through `@fontsource`. The first screen is not shown until `document.fonts.ready`. `sans-serif` appears only as a technical fallback in the CSS stack.
- **Scale** (px at `--ui-scale: 1`): 12 caption, 14 small, 16 body, 20 button/label, 24 HUD, 32 title, 48 banner, 72 hero.
- **Legibility floor on touch devices.** On phones and tablets the effective scale of any text, including a dialog shrunk to fit, is never below 0.9, and nothing renders below 11 CSS px (V-8). The type scale above is sized for that: at 0.9 a caption is 11 px and body copy about 15 px. (Found at the v1.2 phone review: a phone's scale of 0.69, shrunk again by the dialog fit, put text at 5–9 px.)
- **HUD text over the playfield** always has a 3 px `--ink` stroke plus a 0 2px 0 `--ink` drop, so it has at least 4.5:1 effective contrast.

### 16.5 Spacing, layout and components

- **Spacing.** Base unit 4 px, with steps of 4, 8, 12, 16, 24, 32 and 48. Radii are 8, 14 and 22. The outline is 3 px `--ink`. Everything is multiplied by `--ui-scale` (§18.2).
- **Buttons are chunky blocks with the same top-and-front-face look as the world.** Each has a top face, a 5 px front "lip" in the darker shade of its colour, and a highlight on the inner top-left edge.
  - Variants: primary (`--go`), secondary (`--brass`), danger (`--stop`), quiet (`--parchment`).
  - Hover: lifts 1 px and brightens. The lift is added to whatever positions the control, so a control centred on a point (a map medallion) keeps its centre.
  - Pressed: the top face sinks into the lip, over `--t-press`.
  - Focus: a 4 px `--brass-light` ring plus an ink ring.
  - Disabled: 60% desaturated, `--ink-soft` outline, and a lock or coin glyph so the state isn't shown by colour alone.
- **Panels.** A parchment face, a 3 px ink border inside an 8 px wood frame, an inset shade, and a speech-bubble tail when anchored to a tower.
- **Other components.**
  - Next-wave chip
  - Targeting segmented control
  - Chunky toggle and slider (with a brass knob)
  - Level medallion
  - Stamped star
  - Build-bar slot: 64 px at scale 1, holding the tower icon, a cost tag, a hotkey number, and a "G / A / G+A" badge
  - Modal
- **Icons** are drawn in code in the same painted style and baked into the UI atlas. There are no icon fonts and no emoji.

### 16.6 Motion

| Token | Value |
|---|---|
| `--t-press` | 70 ms |
| `--t-quick` | 140 ms |
| `--t-pop` | 220 ms `cubic-bezier(.34,1.56,.64,1)` |
| `--t-panel` | 240 ms `cubic-bezier(.2,.8,.2,1)` |
| coin pop | 700 ms |
| number tick-up | 300 ms |
| screen shake | 120–350 ms, at most 6 px × the UI scale |

**Reduced motion** is on when `prefers-reduced-motion` is set, or by the setting. It switches off overshoot and shake, reduces particle counts to 30%, and turns entrances into fades of 150 ms or less.

### 16.7 Visual acceptance and don'ts

- **V-1**: No hex or rgb literals appear outside the token files and the art palette module. A test greps for them.
- **V-2**: Every interactive element is at least 44×44 CSS px at every supported viewport (Playwright). A desktop window with a fine pointer that is smaller than 1366×768 may shrink targets in proportion, to no less than 24×24 CSS px (the WCAG 2.2 minimum target size), so that the whole screen still fits (§18.2). Touch devices keep 44 px. The one exception is the world map on a touch device when the player pinches it smaller than its opening size: the medallions then shrink with the picture, and they are back to 44 px at the opening zoom (§18.2 item 8).
- **V-8**: On a touch device, no visible UI text renders below 11 CSS px, on any screen or dialog, at the phone and tablet screenshot viewports (Playwright).
- **V-7**: Hovering or pressing a button moves it by at most its 1 px lift or its lip. It never leaves its anchor.
- **V-3**: Valid/invalid placement and range never rely on colour alone. Invalid always adds a hatch pattern and a reason bubble.
- **V-4**: The network log during e2e tests shows only same-origin requests (fonts included).
- **V-5**: UI strings contain no emoji code points (test), and CSS contains no `backdrop-filter`.
- **V-6**: The screenshot review (§23.3) finds no off-direction lighting, no pixel art, no flat or material styling, no neon, and no purple gradients.
- **V-9**: In every baked tree sprite with a trunk under a crown (Zone 1's oak, lime and apple; Zone 3's pines), the vertical line through the trunk is opaque from the foot of the trunk to the top of the crown: no gap between trunk and crown (Playwright, reading the atlases at both scales).
- **V-10**: At a Zone 1 gate, the ground has no edge where the lane meets the field: with the route markers hidden, the mean brightness of neighbouring pixel columns across the lane never steps by more than 5 (of 255) (measured on a 1920×1080 screenshot; the step was 15.6 before v1.3).
- **Don'ts:**
  - pixel art
  - flat, material or ripple UI
  - neon or cyberpunk glow
  - glassmorphism or `backdrop-filter`
  - purple gradients
  - emoji as icons
  - system fonts
  - pure black outlines
  - light from anywhere but the top left
  - text over the playfield without an outline
  - red/green-only signalling

---

## 17. Audio direction

### 17.1 Engine

- **Buses.** Everything uses the Web Audio API. The `master` bus is `DynamicsCompressor` configured as a limiter, then the destination. Under master sit `music`, `sfx` and `ui`, each with its own gain and mute. Settings add a master mute and a volume per bus.
- **Ducking.**
  - For boss arrival, a boss death and the stingers, the music bus drops −9 dB with a 40 ms attack and a 700 ms release.
  - Under stingers, SFX drop −4 dB.
- **Unlock.**
  - The AudioContext is created suspended, and resumed on the first `pointerdown`, `keydown` or `touchend`. The boot splash's "Tap to start" provides that gesture.
  - It is resumed again on `visibilitychange` and after the iOS `interrupted` state.
- **Drop-in audio.** Every sound and music stem is a manifest key that maps to either `{ synth: id }` or `{ file: "audio/….m4a" }`. If a file is present, it is used. Music file stems loop at bar-aligned loop points and are started together.
  - The manifest is `public/assets/audio.json`, written by `npm run gen-audio-manifest`. The generator keeps any entries that already point at files.
  - Keys: `sfx.<sound>` (the catalogue in `src/audio/sfx/keys.ts`), `music.<cue>.L<n>` (one stem per layer, where cue is `menu`, `z1`–`z5` or `boss.z1`–`boss.z5`), and `stinger.<name>`.
  - A file stem replaces its layer's synth tracks and plays inside that layer's gain, so it follows the adaptive layers like the synth does. It must be recorded at the cue's tempo and loop length.
  - A file that fails to load or decode falls back to the synth, with a console warning.

### 17.2 Music

The music is composed in code:
- a tracker-style sequencer schedules notes 120 ms ahead on `AudioContext.currentTime`;
- patterns live in `src/audio/music/*.ts` as note text;
- the instruments are synthesised voice graphs: brass, fife, reed, pizzicato strings, glockenspiel/celesta, tuba, timpani, snare, bass drum, and a plucked string (Karplus–Strong);
- reverb uses a code-generated impulse response.

The aim is hummable melodies with call-and-response brass. It should never sound like a string of beeps.

| Cue | Key and metre | Character |
|---|---|---|
| Menu: *Muster on the Green* | C major, 2/4, 116 bpm | A brass march tune, a glockenspiel countermelody, and an oom-pah tuba |
| Z1 *Buttercup Downs* | G major, 6/8, 104 | Fife and drum, a reed "accordion", pizzicato; pastoral and jaunty |
| Z2 *Scorchsand Shuffle* | A Dorian, swung 4/4, 96 | Spaghetti-western march: whistled lead, twangy pluck, trumpet stabs, clicks |
| Z3 *Frostnip Fells* | E minor ↔ G major, 3/4, 132 | A waltz-march with celesta, sleigh shaker, and a horn melody |
| Z4 *Grimebottom Works* | F minor, 4/4, 120 | Clockwork percussion (anvil, ratchet), bassoon bass, muted brass, a factory-whistle motif |
| Z5 *Mount Kerblam* | C minor → E♭, 4/4, 138 | Timpani, low brass, a string ostinato, an "aah" formant pad, a heroic brass line |
| Boss | The zone's motif in the relative minor, +12 bpm | Brass hits and timpani |
| Stingers | — | Wave-start bugle (2 bars), boss arrival (4), victory fanfare (about 7 s), defeat "wah-wah" trombone (about 4 s), and chimes for 1, 2 and 3 stars |

**When cues play.**
- The menu theme plays on the title, the world map and the briefing, and the zone theme in a level.
- A boss's arrival plays the boss-arrival stinger and switches to the zone's boss cue. The zone theme returns when the last boss is gone.
- The wave-start bugle plays for the first wave and for every wave the player calls early. Waves that start on their own timer get a short snare roll (`sfx.ui.wave`) instead, so the bugle doesn't sound 40 times a level.
- The victory or defeat stinger plays as the level ends. The star chime for the stars earned follows once the result card is up.
- Each zone has a quiet ambience loop (`sfx.amb.z1`–`z5`) under the music.

**Adaptive layers.** Each theme is built from 4 layers:
- L0: bass and light percussion
- L1: melody
- L2: countermelody and full percussion
- L3: brass and timpani intensity

**Threat** is the sum, over enemies, of HP fraction × route progress², normalised, with bosses weighted up. It sets which layers are active: below 0.2 you hear L0 and L1; from 0.2 to 0.5, +L2; above 0.5, +L3. Layers change at bar boundaries with a 1-bar crossfade. A boss wave crossfades into the boss cue on the bar.

### 17.3 SFX

- **Distinct per tower and tier.** Each tower tier has its own synthesised patch, for example:
  - Rattler T1: pop-pop; T3: a heavier chatter plus a tinkle of spent brass.
  - Treacle Pump: a glug-splat.
  - Skylark: a whoosh-chirp.
  - Scorcher: a whumph and a crackle.
  - Sparkplug: a zap-crackle.
  - Thumper: a thoomp, then a whistle, then a boom.
  - Sunbeam: a rising hum, then a searing shimmer.
  - Icebox: a crystalline crack.
  - Tea Urn: a kettle whistle when it buffs.
  - Bellower: a comic horn blast.
  - Bubbler: a blub-pop.
  - Pie Chucker: a boing-splat.

  Enemies, UI and ambience get their own patches too.
- **Rendering.** SFX are rendered at boot through `OfflineAudioContext` into AudioBuffers, 3 variants each, and play back with ±6% `playbackRate` and ±2 dB gain. A `StereoPanner` places each sound by screen x, from −0.8 to 0.8.
- **Voice limiting.**
  - A cap per sound (for example Rattler 4, explosions 6) and a global cap of 24.
  - A minimum retrigger interval per sound (Rattler 45 ms).
  - Priorities: boss, then explosion, then UI, then shots. When a cap is hit, the oldest voice of the lowest priority is stolen.
  - Simultaneous triggers merge into one voice, with gain scaled by the log of the count.
  - The master limiter catches whatever is left.

**Acceptance**
- **R-AUD-1**: With 50 Rattlers firing, the active voices stay at or below the caps. An `OfflineAudioContext` test of the mix peaks below 0 dBFS.
- **R-AUD-2**: Nothing plays before the first gesture, and the first gesture unlocks audio in the Chromium and WebKit e2e tests.
- **R-AUD-3**: When a manifest key names a file, the file plays instead of the synth, with no code change.

---

## 18. Platforms, layout and input

### 18.1 Targets

- **Desktop:** current Chrome, Edge, Firefox and Safari.
- **Mobile:** Safari on iOS and iPadOS; Chrome on Android.
- **Orientation:** landscape is primary. A phone in portrait gets a themed rotate prompt ("Turn your device sideways, Commander"). Phone detection is `pointer: coarse` together with a short side under 500 CSS px. Tablets and desktop accept any aspect ratio.

### 18.2 Layout and scaling

The layout is recomputed on resize, on orientation change, and when `visualViewport` changes.

1. **Safe area.** Start from the viewport minus the safe-area insets (`env(safe-area-inset-*)`, which needs `viewport-fit=cover`).
2. **Candidate arrangements.**
   - **Bottom bar**: the build bar is along the bottom, and the HUD across the top.
   - **Side bar**: the build bar is a column on the right, and the HUD sits in the top corners.
   - **Band**: for tall aspects such as iPad portrait, the HUD and build bar sit in letterbox bands above and below the map.
   - **Rails** (phones only, and always on phones, ADR-0013): the HUD is a column down the left edge and the build bar a column down the right edge, with the map between them at full height. A landscape phone is about twice as wide as it is tall and the maps are about 1.6:1, so the spare width at the sides holds the HUD, and nothing covers the map. The HUD column reads top to bottom: lives, cash, the wave counter with its next-wave chips, call early, and a row of route marker, speed and pause at the foot. Build slots are as large as the column's height allows for the loadout, from 44 px up to 64 × `--ui-scale`.

   For each arrangement, the reserved bands are sized from a base UI size multiplied by `--ui-scale`. No arrangement lets the HUD or build bar overlap the playfield, including its decorative border, where enemies enter.
3. **Pick the arrangement with the largest playfield.** The playfield is the largest rectangle with the map's aspect ratio (including its decorative border) that fits. Phones always use Rails.
4. **UI scale.**
   - Desktop and tablets: `--ui-scale` is the playfield scale relative to a 1280×720 reference, clamped to 0.75–2.5, so the HUD scales with the playfield. On a tablet the floor is 0.9 instead of 0.75 (§16.4).
   - Phones: `--ui-scale` comes from the safe viewport, not the playfield: `min(height ÷ 360, width ÷ 750)`, clamped to 0.9–1.25. A phone's CSS pixel is physically small, so scaling phone text by a phone-sized map made it unreadable. An iPhone 17 Pro in Safari lands at 1, an iPhone SE at 0.9.
5. **Letterbox.** Space outside the playfield shows the zone's themed border (hedge, sandbags, snowbank, brick or basalt), drawn as part of the scene.
6. **Menus and dialogs use the same scale, on every screen.** `--ui-scale` is recomputed on every resize and orientation change, not only in a level. Outside a level it comes from the reference map (Primrose Lane) laid out for the current window. The minimum target size is the `--tap` token: 44 px, or smaller in a small desktop window (V-2).
7. **Dialogs fit; nothing scrolls.** A dialog that would not fit inside the safe viewport is scaled down as a whole, by a factor on its own `--u`, until it fits. That covers the title, settings on every tab, saves, the briefing, the field guide, pause and the result card.
   - **Short landscape screens** (at most 500 px tall: phones, and small desktop windows) lay dialogs out side by side instead of in one tall column: the title, any tabs and the Done or Close button share a header row, and the content sits in columns below it. The title menu puts its buttons beside the name.
   - **On touch devices a dialog shrinks only to the legibility floor** (§16.4). The short-screen layouts fit at the floor at every phone screenshot viewport. If a smaller window still can't hold a dialog at the floor, that dialog scrolls rather than shrinking its text: the one case where anything scrolls.
   - Shrinking never reflows a dialog into a taller shape: the field guide's entries keep their columns as the card shrinks.
8. **The world map.**
   - On desktop the whole map is drawn inside the window, and its medallions and labels scale with it.
   - On touch devices the map opens at a minimum drawn width, because medallions need about 70 px spacing at the 44 px touch minimum, centred on the latest level open. A pinch zooms it, between the whole map fitting the view and 1.5 times the opening size, about the point between the fingers; one finger drags it. Below the opening size the medallions and labels shrink with the picture. A drag that starts on a medallion pans rather than opening the level.
   - The map's back button, star count and field-guide button sit inside the safe area.

- **No page scroll or browser zoom.**
  - The viewport meta includes `maximum-scale=1, user-scalable=no, viewport-fit=cover`.
  - `html` and `body` are fixed with overflow hidden, plus `overscroll-behavior: none`.
  - The canvas and UI have `touch-action: none`.
  - `gesturestart` and `dblclick` defaults are prevented, because iOS ignores `user-scalable`.
- **Phone zoom.**
  - On phones only, a two-finger pinch zooms (1×–2.5×) and pans.
  - The view is clamped to the map bounds.
  - A double tap on empty ground resets the view.

**Acceptance**
- **R-LAYOUT-1**: At every screenshot viewport (§23.2) the page has no scroll: `scrollWidth ≤ innerWidth` and `scrollHeight ≤ innerHeight`. Every HUD element's rectangle lies inside the viewport minus the safe area, and no two HUD clusters overlap.
- **R-LAYOUT-2**: Phone portrait shows the rotate prompt. Tablet portrait is playable.
- **R-LAYOUT-3**: At every screenshot viewport, and in a desktop window resized to 1024×600 and to 800×500, no screen or dialog scrolls and every dialog lies inside the viewport. No scroll container (an element with `overflow` auto or scroll) hides content: its `scrollHeight ≤ clientHeight + 1` and `scrollWidth ≤ clientWidth + 1`. On desktop, every world-map medallion lies inside the viewport. After a resize, the level, the world map and any open dialog are laid out for the new size within 250 ms.
- **R-LAYOUT-4**: At every screenshot viewport, no HUD cluster and no build-bar slot overlaps the playfield rectangle (the map including its decorative border). On a phone the arrangement is Rails, with the HUD left of the playfield and the build bar right of it.
- **R-LAYOUT-5**: On a touch device the world map zooms out, by a pinch, until the whole map is inside the view, and zooms back in to 1.5 times its opening size, never further.

### 18.3 Screens

1. Boot splash ("Tap to start", audio unlock)
2. Title menu: Play, Field Guide, Settings, Saves, Credits. A credit line runs along the foot of the title card: "Idea by MrSimmo, cemented by Claude and pals", in the UI font at the small size (14) in `--ink-soft`, above a `--parchment-deep` rule. It is inside the card, so the dialog fit (§18.2 item 7) and the legibility floor (§16.4) cover it.
3. World map
4. Level briefing: difficulty, mode rules, loadout, Endless when unlocked, hints
5. In-level: HUD, build bar, tower panel, pause menu
6. Victory / defeat
7. Field guide
8. Settings: audio, quality, renderer (Auto by default), screen shake, reduced motion, colour-blind mode, route marker default, ghost offset, key bindings. Three tabs: Sound, Display and Controls. The renderer choice takes effect at the next launch.
9. Saves: export and import
10. Credits
11. Overlays: rotate prompt, iOS Add to Home Screen explainer, "Update ready" badge (menus only), resume prompt

- **R-TITLE-1**: At every screenshot viewport the title menu shows the credit line "Idea by MrSimmo, cemented by Claude and pals" inside the title card, below its buttons, and the title still passes R-LAYOUT-3 and, on touch devices, V-8 (Playwright).

### 18.4 HUD and panels

- **HUD.**
  - Lives and cash
  - "Wave 12 / 35" (in other modes, a timer or kills)
  - Next-wave chips
  - Call early, showing its live bonus
  - Speed (1× / 2× / 3×)
  - Pause
  - Route marker toggle

  Every control across the top shares one top-face height and one 5 px lip: the lives, cash and wave plates, the call-wave button and the round buttons. The call-wave countdown is a bar inside the call-wave button, not a strip under it. In the phone Rails arrangement the same plates and buttons stack in the left column, each the column's width; the wave plate is two lines there, with its next-wave chips under the counter.
- **R-HUD-1**: The top faces of the HUD plates and buttons are equal in height to within 1 CSS px, and their tops align, at every screenshot viewport. In Rails the tops stack instead of aligning, the left edges align, and the two-line wave plate is exempt from the equal height.
- **Build bar.** Up to 6 slots showing the icon, cost and hotkey. An unaffordable slot shows a desaturated icon and a coin glyph.
- **Tower panel** opens on a tap or click. It is anchored to the tower. On phones it is docked beside the map instead, over the HUD column or the build bar, whichever side keeps the tower in view. There it is laid out in two columns to fit the height: the stats on the left, the actions and targeting on the right, and the one-line description left to the build bar's tooltip. It shows:
  - the name and tier pips
  - the range ring (drawn on the field)
  - stats
  - **Upgrade**, with its cost and each stat's change ("Damage 7 → 11")
  - **Sell**, with the refund shown
  - targeting: First, Last, Strongest, Closest

### 18.5 Input

- **Mouse.**
  - **Drag and drop.** Press on a build-bar slot, drag onto the field and release to place: the ghost, its range and the route preview follow the pointer. Releasing over the build bar or off the field cancels. This is the same gesture as touch, with the ghost under the pointer instead of above a finger.
  - **Click to arm.** A click on a slot without dragging arms that tower (as does its hotkey). Each click on the field then places one, and the tower stays armed for fast building until Esc, a right-click, or a second click on the slot.
  - Hovering a cell with a tower armed shows the ghost, its range and the route preview. Hovering a placed tower shows its range.
  - After a tower is placed, the ghost does not report that tower's own cell as occupied. It reappears when the pointer moves to another cell.
  - Right-click or Esc cancels.
  - Clicking a placed tower opens its panel.
- **Touch.**
  - Drag a tower from the build bar onto the field. The ghost is drawn **above the finger**, offset 1.4 cells (at least 48 px), and the offset can be changed in settings.
  - Release to place. Releasing over the build bar or off the field cancels.
  - Tapping a placed tower opens its panel.
  - Hit tests use at least 44 pt around a tower.
- **Keyboard** (defaults; remappable in M6):

  | Key | Action |
  |---|---|
  | `1`–`6` | Loadout slots |
  | `Esc` | Cancel / close |
  | `Space` | Pause |
  | `F` | Cycle speed |
  | `N` | Call next wave |
  | `U` | Upgrade |
  | `S` | Sell (press twice to confirm) |
  | `T` | Cycle targeting |
  | `R` | Route marker |
  | `M` | Mute |

- **Pointer events** handle every input device. There are no separate mouse or touch code paths, except for gestures.

**R-INPUT-1**: The e2e tests drive a mouse placement, a touch drag placement (placed on the cell under the ghost, not under the finger), a right-click cancel, and each keyboard shortcut.

**R-INPUT-2**: The e2e tests drive a mouse drag from a slot to a cell, which builds there in one press-and-release and leaves no tower armed. After a click-to-arm placement, no refusal bubble shows while the pointer stays on the new tower's cell.

### 18.6 Tooltips

- **What has one.** Every icon-only control, and every tower and enemy icon, has a plain description:
  - the HUD: lives, cash, the wave counter, each next-wave chip (count, name, elite or air), call early (with its bonus), the route marker, speed and pause;
  - build-bar slots: name, what the tower does, what it hits, cost and hotkey;
  - the tower panel's actions and targeting options;
  - world-map medallions (name, mode, best result) and the map bar;
  - briefing loadout slots and field-guide entries.
- **Desktop.** A tooltip shows after the pointer rests on the control for 400 ms, or at once on keyboard focus. It hides on leave, blur, Esc, or when the control is pressed.
- **Touch.** A long press (450 ms without moving more than 10 px) shows the tooltip until the finger lifts, and that press does not trigger the control. Dragging a build-bar slot still drags; the tooltip hides as soon as the drag starts.
- **Look.** Tooltips are DOM elements styled from the tokens: a parchment face with an ink outline, the name in the display font and the description in the UI font. They stay inside the viewport, above or beside the control and clear of the finger. Native `title` tooltips are not used.
- **R-TIP-1**: The e2e tests cover these: resting the mouse on a build-bar slot shows its tower's tooltip within 1 s; keyboard focus on a HUD button shows its tooltip; a touch long press on a slot shows the tooltip and doesn't arm the tower.

---

## 19. Rendering and performance

- **Renderer.** The setting has three choices, and **Auto** is the default (ADR-0012):
  - **Auto** tries WebGL, then WebGPU if WebGL can't start. WebGL was measured as fast as WebGPU or faster for this game on every engine tried, and PixiJS recommends it for production.
  - **WebGL** uses only WebGL.
  - **WebGPU**, offered where `navigator.gpu` exists, tries WebGPU first. If it fails to start, the game falls back to WebGL and says so once, in Settings.
  - Browsers expose `navigator.gpu` only on a secure page: https, or localhost. Opened over plain http (a dev server's LAN address, for example), the WebGPU option is disabled, and its tooltip says it needs a secure address, not that the browser lacks it. The installed game is always served over https.

  Each option explains itself in its tooltip, so nobody needs to know what the names mean.
- **R-GPU-1**: On a page that isn't a secure context, Settings shows WebGPU disabled, and its tooltip, shown by hover and by a touch long press, says it needs a secure (https) address (Playwright, with the secure context switched off by an init script).
- **Scene layers:**
  1. Terrain, cached to a texture in chunks of at most 2048²
  2. Ground decals (scorch, custard, puddles)
  3. Shadows
  4. Ground entities, sorted by y
  5. Projectiles and effects (a `ParticleContainer`)
  6. Air units and their shadows
  7. World UI: range rings, ghost, route marker
  8. Floating text (`BitmapText`)

  Sprites, particles and text are pooled, and nothing is allocated per frame in the steady state.
- **Atlas limits.** Atlas pages are at most 2048². A level loads at most 7 pages at @2x (zone terrain 1, units 3, towers 1, effects 1, UI 1), plus its boss's pages (at most 2). The device pixel ratio is capped at 2 on phones. (Amended by ADR-0010; the first budget was 6 pages.)
- **Quality levels.**
  - **High**: full particles, soft shadows, @2x.
  - **Low**: 30% particles, hard shadows, @1x, and resolution 1.
  - **Auto** starts at High on desktop and at DPR-capped High on phones. It steps down when the mean frame time stays above 18 ms for 2 s: particles first, then resolution to 1.5, then 1. It steps back up after 10 s under 12 ms. It never stutters to recover.
- **Budgets.**
  - The target is 60 fps with 300 enemies and heavy effects on a mid-range phone, at every speed.
  - The proxy for that is 4× CPU throttling in Chromium. There, a simulation tick must take at most 2 ms at p95, and a render frame at most 8 ms at p95, both with 300 enemies at 3×.
  - Draw calls should stay at or below 30.
  - The JS heap must not grow across 10 waves.
- **Fallback lever.** If the budgets can't be met, move the simulation into a Web Worker, sending positions each tick. The pure simulation makes this a contained change (ADR-0003).

**R-PERF-1**: `npm run bench`, a headless stress scenario, and a throttled Playwright trace both meet the budgets above.

---

## 20. PWA, offline and saves

- **Manifest.**
  - name "Detour Division", short_name "Detour Div.", `display: standalone`, `orientation: landscape`, themed colours
  - icons at 192 and 512, a maskable 512, and an `apple-touch-icon` at 180, all baked from code art
- **Offline.**
  - vite-plugin-pwa `generateSW` precaches every build asset at install: JS, CSS, HTML, fonts, atlases, JSON and audio.
  - The game makes no runtime network requests.
  - A CSP meta tag enforces `default-src 'self'` (`img-src 'self' data: blob:`, `media-src 'self' blob:`). Compatibility with Pixi is verified in M5.
    - The full policy also allows `worker-src 'self' blob:` (Pixi's image-decoding worker) and `connect-src 'self' data: blob:`, and sets `object-src 'none'` and `base-uri 'self'`.
    - Eval stays forbidden. `src/app/csp.ts`, the first import in `main.ts`, switches Pixi (`pixi.js/unsafe-eval`) and Zod (`jitless`) to their eval-free code paths, which also stops their feature probes logging violations. Verified by R-PWA-1: no console errors under the policy in Chromium and WebKit.
  - Atlases are lossy WebP (ADR-0009), so the precache is about 19 MB (99 entries, measured after the v1.1 art sample; 16.2 MB of it is atlases).
  - There is no analytics or telemetry.
- **Updates.**
  - Registration uses `registerType: 'prompt'`.
  - When a new worker is waiting, an "Update ready" badge appears **on menu screens only**.
  - At the next cold launch, if a worker is waiting, the boot splash activates it and reloads before the menu appears. An update is never applied mid-level.
- **Saves.**
  - IndexedDB database `detour-division` with the stores `profile` and `snapshot`, through a small in-house wrapper.
  - Every record carries `schemaVersion`. Migrations are pure functions, `migrate[n](data) → data(n+1)`, chained at load, and each has a Vitest test against a fixture.
  - `navigator.storage.persist()` is requested on first launch.
- **What is stored.**
  - The profile: unlocks, stars, per-level bests, the field guide, and settings (including key bindings). From profile v2, also `flags`: one-time notices already shown (the iOS explainer) and requests already made (`persist()`). v3 added the ghost offset. v4 added the renderer choice `auto`, and a v3 `webgl` (the old default) becomes `auto`, which also starts WebGL.
  - The in-progress snapshot: taken at each wave start, and on `visibilitychange` to hidden and `pagehide`.
- **Resume.** On launch, if a snapshot exists, the title menu offers "Resume *Level name*, wave 12?".
  - The battle resumes paused, on the pause menu.
  - Starting any other level, or finishing or quitting this one, clears the snapshot.
  - A snapshot whose `simVersion` has a migration is migrated.
  - Otherwise it is discarded with a plain notice. All profile progress is kept; only the battle in progress is lost.
  - Profile saves are always migrated and never discarded.
- **Export and import.**
  - A file (`.ddsave`, JSON with a format tag and version), and a copyable text code: `DD1-` plus base64url of deflate-raw of the JSON, plus a CRC32.
  - Import validates with Zod, migrates, and asks before overwriting.
  - Both live on the Saves screen (§18.3 screen 9), reached from the title. The confirmation shows the star counts on both sides.
  - The text code is `DD1-` + base64url + `.` + the CRC-32 in hex. The dot is needed because base64url uses `-` itself. Spaces and line breaks picked up while copying are ignored.
- **Add to Home Screen.** On iOS or iPadOS Safari, when the game is not installed, a one-time dismissible explainer appears. It shows the Share → Add to Home Screen steps, and explains that Safari can clear the storage of sites you haven't visited for a while, while installed web apps are much less exposed to that.
- **Hosting** (ADR-0015). The production build is published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`. Pages serves a project site under the repository's sub-path, so the workflow passes that path to Vite as `--base`; every runtime URL is built from `import.meta.env.BASE_URL`, and the service worker's scope is the sub-path. Development, preview and the e2e suite stay at `/`. Pages serves https, so the service worker and WebGPU are available to players.

**Acceptance**
- **R-HOST-1**: A production build with a sub-path base, served under that sub-path, boots through the title into a level with no failed request, no console error and no request outside the sub-path, and registers its service worker with the sub-path as its scope. Checked by hand against a local static server, since the e2e suite serves at `/`.
- **R-PWA-1**: Load, wait for the service worker, go offline, reload, and play a level. No request fails, and there are no console errors (Playwright, Chromium and WebKit).
- **R-SAVE-1**: Every migration from v1 to the current version passes against fixtures, and a round trip through export and import is lossless.
- **R-SAVE-2**: After a simulated `visibilitychange` to hidden, followed by a reload, the level resumes with an identical `hash()`.

---

## 21. Accessibility

- **Reduced motion** follows the OS setting plus an in-game setting (§16.6).
- **Colour-blind safety.**
  - Valid/invalid placement and range use blue and red by default, always with a pattern and a text cue.
  - The colour-blind mode swaps to Okabe–Ito blue and orange.
  - Enemy HP bars are a single-hue light fill on ink, never green-to-red.
  - Threat is shown by icon and number, not colour alone.
- **Remappable keys.** Every action in §18.5 can be rebound. Conflicts are detected, and bindings persist in the profile.
  - Binding a key that another action uses swaps the two, and the screen says what moved where.
  - Esc cancels a rebinding, unless Cancel itself is the action being bound.
  - "Reset keys" restores the defaults.
- **Keyboard and focus.**
  - Menus and panels are DOM buttons with ARIA labels and a visible focus ring, navigable with arrows, Tab and Enter.
  - Unless the player set the speed, the game pauses when the window loses focus. At normal speed it pauses. On fast-forward, which the player chose, it keeps running.
  - Arrow keys move focus through the buttons of the menu or dialog on top. Tab and Enter work as usual.
- **Screen shake** can be switched off, independently of reduced motion.
- **R-A11Y-1**: The e2e tests cover rebinding a key, turning on reduced motion (no shake transform is applied), and colour-blind mode (the ghost's colours match the CB tokens).

---

## 22. Stack (pinned)

Versions were checked on the npm registry on 2026-09-24. `package.json` pins exact versions (no `^`), and `package-lock.json` is committed. ADR-0002 has the reasoning and the alternatives.

| Package | Version | Kind | Reason |
|---|---|---|---|
| Node.js | 24.16.0 | Toolchain | Already installed. Runs `.ts` scripts natively through type stripping, so no `tsx` is needed (verified: `process.features.typescript === 'strip'`) |
| typescript | 7.0.2 | dev | Type-checking only. Vite transpiles. The native compiler is fast, and project references let the simulation be typed without the DOM |
| vite | 8.3.1 | dev | Dev server and bundler |
| pixi.js | 8.21.0 | runtime | Sprite batching on WebGL and WebGPU, as briefed |
| vite-plugin-pwa | 1.3.0 | dev | Generates the Workbox service worker. Its peer range includes Vite 8 |
| workbox-window | 7.4.1 | runtime | Service worker registration and update detection (via `virtual:pwa-register`) |
| workbox-build | 7.4.1 | dev | Peer of vite-plugin-pwa |
| vitest | 5.0.1 | dev | Unit, property and scenario tests. Its peer range includes Vite 8 |
| @playwright/test | 1.63.0 | dev | End-to-end tests, screenshots, the offline test, and the Chromium that bakes the art |
| zod | 4.6.5 | runtime | **Added dependency.** One schema source gives TypeScript types, validation of balance and level files (build and test time), validation of imported saves (the runtime boundary), and the level JSON Schema (`z.toJSONSchema`) |
| @fontsource/lilita-one | 5.3.0 | runtime asset | **Added dependency.** Self-hosted display font, OFL-1.1 |
| @fontsource/fredoka | 5.3.0 | runtime asset | **Added dependency.** Self-hosted UI font, OFL-1.1 |
| @types/node | 24.13.6 | dev | Matches the Node 24 runtime, deliberately not the latest 26.x |

**Deliberately not added:**
- **A UI framework.** The DOM UI is plain TypeScript with a small internal `h()` helper and signals.
- **ESLint.** Purity is enforced by `tsconfig.sim.json` and the purity test.
- **tsx.** Node's type stripping replaces it.
- **idb.** A wrapper of about 60 lines is enough.
- **An audio library** or **a texture packer.** Both are written in-house, because they are small and specific to this game.

---

## 23. Verification plan

### 23.1 Vitest (`npm test`)

- **Pathfinding and block rules** (R-BLOCK-1, R-BLOCK-2): property tests on random grids against a brute-force oracle, plus these cases:
  - an enemy trapped mid-field
  - a sealed pocket that contains an enemy
  - reversing, bubbled, and in-tunnel enemies
  - multiple routes
  - tunnels
  - blocker clearing
- **Movement** (R-MOVE-1 to R-MOVE-3): no teleporting and no jitter across a scripted re-path.
- **Damage and armour** (R-DMG-1, R-DMG-2), and the **economy** (R-ECON-1 to R-ECON-3).
- **Determinism** (R-SIM-1 to R-SIM-3) and **purity** (R-SIM-4).
- **Waves** (R-WAVE-1 to R-WAVE-3), and **save migrations** (R-SAVE-1).
- **Scenario tests** for every enemy trait and every tower special (R-ENEMY-1).

### 23.2 Playwright (`npm run e2e`)

- **Offline** (R-PWA-1) and **resume** (R-SAVE-2).
- **Input** (R-INPUT-1), **audio unlock** (R-AUD-2), and **accessibility** (R-A11Y-1).
- **Screenshots** of the title, world map, briefing and loadout, a level mid-wave, the tower panel, and the victory screen, at each of:

  | Viewport | Size and scale |
  |---|---|
  | iPhone SE, landscape | 667×375 @2 |
  | Large iPhone, landscape | 932×430 @3, with the notch's safe-area insets emulated |
  | iPhone 17 Pro, Safari landscape | 874×378 @3, with the notch and home-indicator insets (0, 62, 20, 62) emulated (added at the v1.2 phone review) |
  | iPad, portrait | 820×1180 @2 |
  | iPad, landscape | 1180×820 @2 |
  | Desktop | 1366×768 |
  | Desktop | 1920×1080 |
  | Desktop | 3840×2160 |

- **Layout** (R-LAYOUT-1 to R-LAYOUT-5) and the visual rules V-2 to V-5 and V-8, at every viewport.
- Every test fails on any `console.error` or failed request.
- Projects: Chromium, WebKit and Firefox.

### 23.3 Screenshot review

At M1, M2 and M6 I read every screenshot and compare it against §16, then fix whatever doesn't match. Findings and fixes are logged in `PROGRESS.md`.

### 23.4 Device verification

**Done in the Xcode iOS Simulator**: iPhone 16e (the smallest current iPhone, standing in for SE-class screens), iPhone 17 Pro Max, and iPad Pro 11-inch in both orientations, all running Mobile Safari. For each, `xcrun simctl openurl` loads the game from a preview server on the LAN address.
1. Load the game, and add it to the Home Screen.
2. Stop the preview server, so the game has to run offline.
3. Cold-launch from the Home Screen icon.
4. Play 3 waves.
5. Terminate the app with `simctl terminate`, then relaunch, and confirm the resume prompt appears.
6. Check sound after the first tap.
7. Check pinch and pan with a Simulator gesture (phones only).
8. Rotate to portrait and check the rotate prompt (phones only).
9. Check for console errors in Safari Web Inspector.
10. Take a screenshot at each state with `simctl io screenshot`.

**Handover, which needs you:** a physical Android phone (Chrome, installed PWA). Run the same steps 1–9, using `chrome://inspect` in place of the Web Inspector.

---

## 24. Risks

| Risk | Mitigation |
|---|---|
| TypeScript 7 is recent, and some tool may not accept it | It is only used for type-checking. Fall back to TS 6.x through a superseding ADR |
| Mid-range phones miss the frame budget with 300 enemies at 3× | Pooling, the spatial hash, auto quality, and moving the simulation into a Worker (§19) |
| The bot is too strong or too weak, which distorts the difficulty signal | The bot is fixed, and levels are tuned against it. Margin targets are Casual ≥ 0.6, Tough 0.3–0.7 and Heroic 0.05–0.4. Per-level `bot.plan` hints are the escape hatch |
| iOS Safari evicts storage, or writes are lost on kill | `persist()`, the Add to Home Screen explainer, snapshots on `visibilitychange`, and export codes |
| Pixi v8 conflicts with a strict CSP | Verify in M5, and relax only the directive that has to change, recorded in an ADR |
| Validation run time for 240 runs (40 levels × 3 difficulties, each with and without the bot) | Worker threads, and a headless simulation with no observers. The budget is under 10 minutes on the development machine |
| The Simulator isn't real hardware: thermals, GPU and storage eviction all differ | Perf budgets are also checked under throttling (§19). Physical Android is on the handover checklist (§23.4) |
