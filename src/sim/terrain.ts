// Terrain codes and their fixed properties (DESIGN.md §14.3). Speed and cost values
// that are tunable live in data/balance/terrain.json; this table is structural.

export const T = {
  GROUND: 0,
  ROCK: 1,
  WATER: 2,
  BRIDGE: 3,
  RESTRICTED: 4,
  TRENCH: 5,
  ICE: 6,
  CONV_E: 7,
  CONV_W: 8,
  CONV_N: 9,
  CONV_S: 10,
  BLOCKER: 11,
  TUNNEL: 12,
} as const;

export const TILE_CHARS: Readonly<Record<string, number>> = {
  '.': T.GROUND,
  '#': T.ROCK,
  '~': T.WATER,
  '=': T.BRIDGE,
  x: T.RESTRICTED,
  t: T.TRENCH,
  i: T.ICE,
  '>': T.CONV_E,
  '<': T.CONV_W,
  '^': T.CONV_N,
  v: T.CONV_S,
  b: T.BLOCKER,
  o: T.TUNNEL,
};

//                         G  R  W  B  X  T  I  E  W  N  S  b  o
export const WALKABLE = [1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1] as const;
export const BUILDABLE = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as const;

/** Conveyor push direction by terrain code (0,0 for non-conveyors). */
export const CONVEYOR_DX = [0, 0, 0, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0] as const;
export const CONVEYOR_DY = [0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 1, 0, 0] as const;

export function isConveyor(code: number): boolean {
  return code >= T.CONV_E && code <= T.CONV_S;
}

/** 8-neighbourhood in a fixed order, so Dijkstra tie-breaks are deterministic. */
export const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
