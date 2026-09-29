# 0014. Ground units start off screen, and each lane ends under the trees

Date: 2026-09-29
Status: Accepted (v1.4 review)
Spec: DESIGN.md §0.6, §9.1 (R-LANE-1, R-LANE-2)
Amends: the 2.75-cell spawn distance chosen at the v1.3 review (§0.5 row 5). Its leak distance stands.

## Context
At v1.3, ground units started 2.75 cells up the entrance lane and escaped 2.75 cells down the exit lane, which was meant to be off screen on most displays. It isn't on desktop. Zone 1 paints each lane 7 cells long. A desktop window shows part of it in the letterbox beside the map, and more through the build-bar column, which has no background. Measured over all 40 levels with `computeLayout`:

| Window | Entrance lane on screen | Exit lane on screen |
|---|---|---|
| 1366×768, 1920×1080, 3840×2160 | up to 4.3 cells | up to 6.5 cells |
| 1440×789 (a typical laptop browser window) | up to 4.7 cells | up to 6.9 cells |
| 2560×1300 | up to 6.1 cells | up to 8.3 cells |

Lanes that run up and down show at most 2.7 cells, so only levels whose road runs across the screen looked wrong. The simulation can't depend on the window: it must give the same result in the validator, on every device and after a resume (ADR-0003).

## Decision
- **The simulation:** ground units start 6.5 cells beyond the entrance edge (`LANE_IN`), and still escape 2.75 cells beyond the exit edge (`LANE_OUT`). `SIM_VERSION` goes to 4.
- **The renderer:** the forest closes over each lane, drawn over the units:
  - 5.25 cells out at an entrance. That is `LANE_IN` minus 1.25, the Dune Dredger's reach towards the field plus a margin, so every unit is hidden when it appears.
  - 4.5 cells out at a south entrance, where the tallest sprites (Kerblam Mech's head, 1.85 cells) reach towards the field.
  - 8 cells out at an exit.

  The forest edge's leaves spill about 0.46 cells onto the lane, so the visible end is 4.79 cells out at an entrance and 7.54 at an exit. Both are off screen at every window in the table above except 2560×1300.
- **A leaker is drawn walking on** after it escapes, at its last speed, until its sprite is off the screen or under the trees. It's cosmetic: the simulation has already removed it and taken the lives.
- Zones 2–5 have no painted lanes yet, so there the zone's border texture covers the same area, drawn over the units.

## Alternatives Considered
- **Leave the simulation alone; close each lane with trees just past the 2.75-cell spawn.** No balance change and no re-validation. But units would never come from the screen edge, and the open lane would be only 1¾ cells past the hedge. This was the second option offered at the review; the player chose the walk from off screen.
- **Trees at the entrance, a cosmetic walk-off at the exit.** Also no re-validation, but again no walk-on from off screen. The third option offered.
- **Start units further out, beyond the widest window.** A 2560×1300 window needs about 7.5 cells, and a phone's left rail shows 13 cells between its HUD plates. A Footling would take 8 s or more to reach the field, and a slow boss 20 s. The trees at the lane's end cover the rare wider window instead.
- **Lengthen the exit walk in the simulation to 8 cells.** Towers by an exit would get more shots, and lives would drop several seconds after a unit passed the last tower, for no visible gain over the cosmetic walk-off.
- **Opaque HUD and build-bar bands.** They would hide part of the lanes, but not the letterbox, and they would cost the map area that ADR-0013 gave it.

## Consequences
- Each ground unit reaches the field about 3.75 cells later than at v1.3: about 4 s for a Footling and 9 s for a slow boss. The whole level shifts by that much, because wave countdowns run from each launch. The first wave takes that much longer to arrive after Start.
- A tower within range of an entrance lane gets longer shots up it. All 40 levels were re-validated (PROGRESS.md, 2026-09-29).
- A boss's banner and arrival sting play when it spawns, now up to 16 s before it reaches the field. At 1920×1080 a slow boss (0.4 cells a second) comes into view about 7 s after its banner.
- A window much wider than 16:9 shows the trees at a lane's end on some levels (on Kettle Crossing at 2800×1100, both ends), and the units step out of them. That is by design, not a regression. In zones 2–5 the cover is the plain border texture, so there a unit is wiped into or out of view along a straight line until those zones get lanes.
