# 0008. Tune levels by a per-level HP scale, found by the reference bot

Date: 2026-09-25
Status: Accepted
Spec: DESIGN.md §8, §9.3, §15

## Context
Forty levels, each on three difficulties, have to pass the validator (§15). The reference bot must win every difficulty, a level must be lost with no towers, and Heroic must be measurably harder than Casual. Tuning that many levels by hand is slow, and hand tuning drifts as the bot and the sim change.

## Decision
- **One lever per level.** `recipe.hp` scales enemy HP on top of wave growth, the zone multiplier and the difficulty multiplier. `tools/tune-level.ts` searches it: up when every difficulty is won, down when any is lost, with the step shrinking whenever the direction changes.
- **Standard levels** stop at the first scale where the bot wins everywhere and Heroic costs it real lives (at least 2 fewer than Casual, and a Heroic margin of 0.8 or less).
- **Timed modes** (Sudden Death, Time Trial) can't be judged by lives. Sudden Death gives Heroic a single life, and a Time Trial is decided by the clock. For these the tuner finds the hardest scale the bot still wins everywhere, then backs off by 10% so the level isn't on a knife edge.
- **Puzzles** are not tuned by HP. Their reference plan is the solution, so a puzzle is tuned by its purse. The purse is set so that the generic bot seldom or never wins Heroic, and the reference plan does. The plan is either written by hand or found by a search script, then checked by hand. `tools/dev/record-plan.ts` turns a winning bot run into a plan.

## Alternatives Considered
- **Tuning the wave budget (`b0`).** Rejected: bigger waves also pay more bounty, so the bot's economy grows with the threat and difficulty barely moves.
- **Per-difficulty scales.** Rejected for now: the §8 table already separates the difficulties, and a second knob per difficulty would triple the search for little gain.
- **Accepting the edge for timed modes.** Rejected: at the edge, any later change to the sim or the bot could tip a level into failing.

## Consequences
- Re-tuning after a sim or bot change is one command per level, and the validator confirms it.
- Some standard levels pass with Heroic only just won, for example 1 life left of 15. They are correct but fragile. A later sim change should be followed by `npm run validate-levels`, and any level that then fails is re-tuned.
- The level JSON is the source of truth. Any script used to lay out a level has to keep the tuned `recipe.hp` (and a puzzle's plan) when it rewrites the file.
