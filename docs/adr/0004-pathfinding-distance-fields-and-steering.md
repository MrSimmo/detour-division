# 0004. Pathfinding: per-exit distance fields with look-ahead steering

Date: 2026-09-24
Status: Accepted (M0 review, 2026-09-25)
Spec: DESIGN.md §3.2–3.3 (R-BLOCK-*, R-MOVE-*)

## Context
Up to 300 ground enemies must re-path at the instant a tower is built or sold, and turn smoothly onto the new route. Placement validation must prove every entrance can still reach its exit, and every enemy on the field its own exit. This includes enemies in pockets, reversing, bubbled or in tunnels. Terrain adds per-cell costs, conveyors whose cost depends on direction, and tunnel edges. Maps are at most 26×15, so 390 cells.

## Decision
- **One distance field per exit.** Dijkstra runs outward from the exit cells over reversed edges: 8-connected, with no corner-cutting, a cell cost of `1/speedMultiplier`, direction-aware conveyor costs, and tunnel edges costing their length. It is recomputed on build, sell or clear.
- **Placement validation.** Block the cell in a scratch copy, recompute each field, then require a finite distance from every entrance span and from every ground enemy's current cell. An enemy in a tunnel is checked from the tunnel's exit mouth.
- **Reversal and bubbles.** A "from-entrance" field per route gives the backward direction for Bellower reversal and ground bubbles.
- **Steering.** Each enemy follows the field downhill. It looks up to 4 cells ahead, to the furthest cell with line of sight at its body-radius clearance, and heads for it, with a capped turn rate, slowing on sharp turns, and a fixed seeded lane offset.

## Alternatives Considered
- A* for each enemy: 300 searches on every build, plus a separate proof of reachability. Distance fields answer every enemy with one search per exit.
- A navigation mesh with funnel smoothing: overkill on a small uniform grid, and it has to be rebuilt on every placement.
- Raw 8-direction flow following: zig-zags and snaps when the route changes, which breaks R-MOVE-2.
- Local separation and avoidance forces between enemies: costly, and they can push bodies into walls. Lane offsets give a crowd look deterministically.

## Consequences
Re-pathing costs about one Dijkstra run per exit, well under 1 ms. Line-of-sight checks happen per enemy per tick, and can be staggered if profiling needs it. Bosses larger than a cell still path on the 1-cell grid, which is accepted visually.
