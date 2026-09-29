// Dynamic grid: terrain after cleared blockers, tower occupancy, and the walkable mask.
// Derived from SimState plus the level, so it is rebuilt on restore (ADR-0003).
import type { LevelRT } from './level.ts';
import { BUILDABLE, T, WALKABLE } from './terrain.ts';

export interface GridRT {
  cols: number;
  rows: number;
  n: number;
  terrain: Uint8Array;
  /** Tower id per cell, 0 when free. */
  occ: Int32Array;
  /** 1 where ground units can stand. */
  walk: Uint8Array;
}

export function buildGrid(level: LevelRT, cleared: readonly number[], towers: readonly { cell: number; id: number }[]): GridRT {
  const terrain = level.terrain.slice();
  for (const c of cleared) terrain[c] = T.GROUND;
  const occ = new Int32Array(level.n);
  for (const t of towers) occ[t.cell] = t.id;
  const g: GridRT = { cols: level.cols, rows: level.rows, n: level.n, terrain, occ, walk: new Uint8Array(level.n) };
  for (let c = 0; c < level.n; c++) refreshCell(g, c);
  return g;
}

export function refreshCell(g: GridRT, c: number): void {
  g.walk[c] = WALKABLE[g.terrain[c]!] === 1 && g.occ[c] === 0 ? 1 : 0;
}

export function isBuildableTerrain(level: LevelRT, g: GridRT, c: number): boolean {
  return BUILDABLE[g.terrain[c]!] === 1 && level.apron[c] === 0;
}

/** Cell under a point, or -1 outside the map. */
export function cellAt(g: GridRT, x: number, y: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return -1;
  return cy * g.cols + cx;
}

export function walkableAt(g: GridRT, x: number, y: number): boolean {
  const c = cellAt(g, x, y);
  return c >= 0 && g.walk[c] === 1;
}

/** True if an axis-aligned box of half-size r around (x,y) touches only walkable cells. */
export function bodyClear(g: GridRT, x: number, y: number, r: number): boolean {
  return walkableAt(g, x - r, y - r) && walkableAt(g, x + r, y - r) && walkableAt(g, x - r, y + r) && walkableAt(g, x + r, y + r);
}
