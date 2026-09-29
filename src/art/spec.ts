import type { Ctx } from './paint.ts';

/** One baked frame. Box size is in cells; the anchor is a fraction of the box. */
export interface SpriteSpec {
  key: string;
  /** Atlas group; each group packs into its own pages (≤ 2048², ADR-0006). */
  atlas: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
  /** Draws in art units (64 per cell) with the origin at the anchor. */
  draw: (ctx: Ctx) => void;
  /** Opaque tiles: copy edge pixels outwards so filtering never shows seams. */
  extrude?: boolean;
  /** Bake only at these scales (default: all). The world map is @1x only to save GPU memory. */
  scales?: number[];
}

/** Art units per cell. */
export const U = 64;

/** 16 facings (index 0 = east, clockwise with screen y down). */
export const FACINGS = 16;
export const facingAngle = (i: number, n = FACINGS): number => (i * Math.PI * 2) / n;
export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Three-quarter squash applied to the ground plane. */
export const TILT = 0.78;

export interface Part {
  /** Local position on the rotated ground plane, for painter's ordering. */
  lx: number;
  ly: number;
  draw: () => void;
}

/** Draws parts back-to-front for facing angle `a` (screen-y of each part after rotation). */
export function drawParts(parts: Part[], a: number): void {
  const s = Math.sin(a);
  const c = Math.cos(a);
  parts
    .map((p, i) => ({ p, i, y: p.lx * s + p.ly * c }))
    .sort((m, n) => m.y - n.y || m.i - n.i)
    .forEach((m) => m.p.draw());
}
