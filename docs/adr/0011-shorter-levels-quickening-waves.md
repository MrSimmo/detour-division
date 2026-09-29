# 0011. Shorter Standard levels with a quickening wave timer

Date: 2026-09-25
Status: Accepted (v1.1 review)
Spec: DESIGN.md §0.3, §3.8 (R-WAVE-4), §10, §11
Amends: the wave counts agreed at the M0 review (§0.2 decision 3 still holds: Tough +5, Heroic +10)

## Context
The first play-through found Standard levels long and flat. A level ran 30–60 waves on a fixed 20 s timer: Primrose Lane took about 10½ minutes on Casual and 14 on Heroic, and the final level about 20 on Heroic. Enemies don't speed up from wave to wave, so the pace felt the same from start to finish.

## Decision
For the 29 Standard levels only:
- **Wave counts** become `n = round(N × 2/3)`, then `[n, n + 5, n + 10]`. Zone 1 goes from 30/35/40 to 20/25/30, and the final level from 45/52/60 to 30/35/40.
- **The countdown quickens** from the level's `interval` (20 s) to a new optional `intervalEnd` (14 s), linearly over the level (§3.8). Levels without `intervalEnd` keep a fixed countdown.
- **The curve is compressed, not truncated.** The budget growth becomes `g^1.5`, so the last wave is about as big as before. Pool entries arriving after wave 6 arrive at `round(6 + (from − 6) × 2/3)`. `eliteFrom` and `eliteEvery` scale by 2/3 (with `eliteEvery` at least 3). Boss overrides move to the new final wave. Bubble Pass's per-wave overrides from wave 10 are resampled onto the shorter run, so its climax is kept.
- Each level is then re-tuned by its HP scale (ADR-0008) and validated (R-VAL-1).
- **One exception: Three Craters (z5-03)** keeps `g = 1.07` instead of the formula's 1.079. With the steeper curve, no HP scale passed. Casual's 28 waves reach the 14 s countdown sooner than Heroic's 38, and on its three interleaved routes the bot then lost Casual on the last waves, or won Heroic with lives to spare. At 1.07 it passes with HP 0.64 (Casual 14 lives, Tough 18, Heroic 5 of 20).

Sudden Death and Time Trial are unchanged: they run on clocks and kill targets, which already last 4–9 minutes. Puzzles are unchanged, because their reference solutions are tuned to their fixed waves.

## Alternatives Considered
- **Fewer waves with the fixed 20 s timer:** shorter, but just as flat. The report was about both length and pace.
- **The same counts, a faster timer and faster enemies:** keeps levels at 8–15 minutes, and a speed ramp changes every tower's reach per wave, which is harder to read and to tune.
- **Leave the length and rely on "call early":** the bonus is small, and the bot never calls early, so validation wouldn't reflect how the level is actually played.
- **A global speed or HP ramp in `economy.json`:** it would also change the timed modes and the puzzles, which then need re-tuning for no benefit.

## Consequences
- Zone 1 Casual comes to about 5½ minutes at 1×.
- Every Standard level's `recipe.hp` changes. The fragile Heroic wins listed in ADR-0008 need checking again.
- `SIM_VERSION` goes to 2, because a stored battle from v1 was generated from the old waves. On launch it is discarded with the plain notice that §20 describes.
- The transform was applied once by a script and is described here. The level JSON is still the source of truth.
