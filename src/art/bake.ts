// Browser-side bake: draws every sprite at a scale, packs them into ≤2048² pages and
// returns PNG data plus Pixi spritesheet JSON (TexturePacker "hash" format, with a
// per-frame anchor that Pixi v8 uses as the texture's defaultAnchor).
import { pack } from './pack.ts';
import { U, type SpriteSpec } from './spec.ts';

export const PAGE = 2048;
const GAP = 2;
const EXTRUDE = 2;

export interface BakedPage {
  file: string;
  /** The page image, base64 WebP. */
  data: string;
  json: unknown;
}

interface Drawn {
  spec: SpriteSpec;
  canvas: HTMLCanvasElement;
  /** Untrimmed source size. */
  w: number;
  h: number;
  /** Inset of the frame inside the canvas (extruded tiles carry a border). */
  inset: number;
  /** Trim offset of the canvas within the source. */
  tx: number;
  ty: number;
}

/** Crops fully transparent borders; returns the cropped canvas and its offset. */
function trim(c: HTMLCanvasElement): { canvas: HTMLCanvasElement; x: number; y: number } {
  const ctx = c.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) {
    x0 = y0 = 0;
    x1 = y1 = 0;
  }
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, -x0, -y0);
  return { canvas: out, x: x0, y: y0 };
}

function drawSprite(spec: SpriteSpec, scale: number): Drawn {
  const w = Math.ceil(spec.w * U * scale);
  const h = Math.ceil(spec.h * U * scale);
  const inset = spec.extrude ? EXTRUDE : 0;
  const inner = document.createElement('canvas');
  inner.width = w;
  inner.height = h;
  const ctx = inner.getContext('2d')!;
  ctx.translate(spec.ax * w, spec.ay * h);
  ctx.scale(scale, scale);
  spec.draw(ctx);
  if (!inset) {
    const t = trim(inner);
    return { spec, canvas: t.canvas, w, h, inset: 0, tx: t.x, ty: t.y };
  }
  const out = document.createElement('canvas');
  out.width = w + inset * 2;
  out.height = h + inset * 2;
  const o = out.getContext('2d')!;
  // Edges first (stretched 1px strips), then the tile itself on top.
  o.drawImage(inner, 0, 0, w, 1, inset, 0, w, inset);
  o.drawImage(inner, 0, h - 1, w, 1, inset, h + inset, w, inset);
  o.drawImage(inner, 0, 0, 1, h, 0, inset, inset, h);
  o.drawImage(inner, w - 1, 0, 1, h, w + inset, inset, inset, h);
  o.drawImage(inner, inset, inset);
  o.drawImage(inner, 0, 0, 1, 1, 0, 0, inset, inset);
  o.drawImage(inner, w - 1, 0, 1, 1, w + inset, 0, inset, inset);
  o.drawImage(inner, 0, h - 1, 1, 1, 0, h + inset, inset, inset);
  o.drawImage(inner, w - 1, h - 1, 1, 1, w + inset, h + inset, inset, inset);
  return { spec, canvas: out, w, h, inset, tx: 0, ty: 0 };
}

export function bakeGroup(group: string, specs: SpriteSpec[], scale: number): BakedPage[] {
  const drawn = specs.map((s) => drawSprite(s, scale));
  const { placed, pages } = pack(
    drawn.map((d) => ({ w: d.canvas.width, h: d.canvas.height, item: d })),
    PAGE,
    GAP,
  );
  return pages.map((pg, pi) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(pg.w / 4) * 4;
    canvas.height = Math.ceil(pg.h / 4) * 4;
    const ctx = canvas.getContext('2d')!;
    const frames: Record<string, unknown> = {};
    for (const p of placed.filter((q) => q.page === pi)) {
      const d = p.item;
      ctx.drawImage(d.canvas, p.x, p.y);
      const fw = d.canvas.width - d.inset * 2;
      const fh = d.canvas.height - d.inset * 2;
      frames[d.spec.key] = {
        frame: { x: p.x + d.inset, y: p.y + d.inset, w: fw, h: fh },
        rotated: false,
        trimmed: fw !== d.w || fh !== d.h,
        spriteSourceSize: { x: d.tx, y: d.ty, w: fw, h: fh },
        sourceSize: { w: d.w, h: d.h },
        anchor: { x: d.spec.ax, y: d.spec.ay },
      };
    }
    const file = `${group}-${pi}@${scale}x`;
    return {
      file,
      // ADR-0009: lossy WebP at quality 0.9 — a quarter of the PNG size, with no visible loss on this art.
      data: canvas.toDataURL('image/webp', 0.9).split(',')[1]!,
      json: { frames, meta: { app: 'detour-division code art', image: `${file}.webp`, format: 'RGBA8888', size: { w: canvas.width, h: canvas.height }, scale: String(scale) } },
    };
  });
}

export function bakeAll(specs: SpriteSpec[], scale: number): { pages: BakedPage[]; groups: Record<string, string[]> } {
  const byGroup = new Map<string, SpriteSpec[]>();
  for (const s of specs) {
    const list = byGroup.get(s.atlas) ?? [];
    list.push(s);
    byGroup.set(s.atlas, list);
  }
  const pages: BakedPage[] = [];
  const groups: Record<string, string[]> = {};
  for (const [g, list] of byGroup) {
    const baked = bakeGroup(g, list, scale);
    pages.push(...baked);
    groups[g] = baked.map((b) => `atlas/${b.file}.json`);
  }
  return { pages, groups };
}
