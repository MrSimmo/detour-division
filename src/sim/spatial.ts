// Uniform bucket grid (one bucket per map cell, with a margin for off-map units),
// rebuilt every tick after movement, so tower queries scan only nearby enemies.
import { SPATIAL_MARGIN as MARGIN, PHASE } from './constants.ts';
import type { Enemy } from './types.ts';

export interface Spatial {
  minX: number;
  minY: number;
  w: number;
  h: number;
  head: Int32Array;
  link: Int32Array;
  list: Enemy[];
}

export function newSpatial(cols: number, rows: number): Spatial {
  const w = cols + MARGIN * 2;
  const h = rows + MARGIN * 2;
  return { minX: -MARGIN, minY: -MARGIN, w, h, head: new Int32Array(w * h), link: new Int32Array(0), list: [] };
}

function bucketOf(s: Spatial, x: number, y: number): number {
  let bx = Math.floor(x) - s.minX;
  let by = Math.floor(y) - s.minY;
  if (bx < 0) bx = 0;
  else if (bx >= s.w) bx = s.w - 1;
  if (by < 0) by = 0;
  else if (by >= s.h) by = s.h - 1;
  return by * s.w + bx;
}

/** Indexes live, targetable-in-principle enemies (not dead, not inside a tunnel). */
export function rebuildSpatial(s: Spatial, enemies: readonly Enemy[]): void {
  s.head.fill(-1);
  s.list.length = 0;
  for (const e of enemies) if (!e.dead && e.phase !== PHASE.TUNNEL) s.list.push(e);
  if (s.link.length < s.list.length) s.link = new Int32Array(s.list.length * 2);
  for (let i = 0; i < s.list.length; i++) {
    const e = s.list[i]!;
    const b = bucketOf(s, e.x, e.y);
    s.link[i] = s.head[b]!;
    s.head[b] = i;
  }
}

/** Calls `fn` for every indexed enemy whose centre lies within r of (x,y), in index order per bucket. */
export function queryRadius(s: Spatial, x: number, y: number, r: number, fn: (e: Enemy) => void): void {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(x - r) - s.minX);
  const x1 = Math.min(s.w - 1, Math.floor(x + r) - s.minX);
  const y0 = Math.max(0, Math.floor(y - r) - s.minY);
  const y1 = Math.min(s.h - 1, Math.floor(y + r) - s.minY);
  for (let by = y0; by <= y1; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      for (let i = s.head[by * s.w + bx]!; i >= 0; i = s.link[i]!) {
        const e = s.list[i]!;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy <= r2) fn(e);
      }
    }
  }
}
