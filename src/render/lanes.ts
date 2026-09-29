// DESIGN.md §9.1, R-LANE-2, ADR-0014: where the forest closes over a gate lane, drawn over the units, in
// cells beyond the map edge. Pure, so a test can check it against every level and window size.
import type { Edge } from '../data/schemas.ts';
import { LANE_IN } from '../sim/constants.ts';

/** An exit lane runs this far before the forest closes over it: past the edge of a common desktop window, so a leaker walks off it. */
export const EXIT_END = 8;
/** How far the forest edge's leaves (`terrain.z1.fringe.*`) spill onto the lane from where it closes, in cells (measured from the atlas). */
export const FRINGE_SPILL = 0.46;

/**
 * Where the forest closes over a lane in the given role. An entrance closes inside the spawn point by more
 * than any ground unit's sprite reaches towards the field, so a unit is hidden where it appears: 1.05 cells
 * sideways (the Dune Dredger), and on a south edge, where the field is up the screen, 1.85 (Kerblam Mech's head).
 */
export function laneEnd(edge: Edge, role: 'in' | 'out'): number {
  if (role === 'out') return EXIT_END;
  return LANE_IN - (edge === 'S' ? 2 : 1.25);
}
