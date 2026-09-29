# 0010. Allow 7 atlas pages per level at @2x, plus the boss's

Date: 2026-09-25
Status: Accepted
Spec: DESIGN.md §19 (amended)
Amends: the "at most 6 pages at @2x" line in §19

## Context
§19 set a budget of at most 6 atlas pages at @2x per level: zone terrain, units, towers, effects and UI. The baked art comes to more than that.

| Content | Pages at @2x |
|---|---|
| Towers | 1 |
| Units (12 enemy types, 8 facings × 4 walk frames, elites and variants) | 3 |
| Effects | 1 |
| UI | 1 |
| The zone's terrain | 1 |
| **Every level** | **7** |
| A boss level adds its boss | 1–2 (Kerblam has 2) |

The budget was a proxy for draw calls and texture memory. Both are now measured directly. R-PERF-1 on The Last Roundabout, which loads 7 pages, gives 10 draw calls at p95 (budget 30) and a 7.3 ms render at p95 (budget 8), under 4× CPU throttling.

## Decision
The budget becomes **7 pages at @2x per level, plus the level's boss (at most 2)**. Low quality uses the @1x atlases (§19), where every group fits in one page, so a level loads 5–7 smaller pages.

## Alternatives Considered
- **Per-enemy-type atlas groups**, loading only the types a level's waves use. Rejected for now:
  - Zone 5 uses every type, so its worst case doesn't improve.
  - Many small pages would count against a page budget anyway.
  - The field guide and Endless would need every group on demand.
- **Fewer unit frames**, for example 2 walk frames. Rejected: it visibly degrades the walk cycle, for no measured gain.
- **Lower-resolution units at @2x.** Rejected: blurry soldiers next to crisp towers.

## Consequences
- The worst case is 9 pages of up to 2048² at @2x, about 144 MB of texture memory, on the final boss level. Devices that struggle can choose Low quality (@1x).
- If a device shows memory pressure, per-zone unit groups are the next step. Their cost is duplicating shared enemy types across zones.
