// Zone terrain and decoration (DESIGN.md §11, §14.3, §16.1) for all five zones:
// Buttercup Downs, Scorchsand Flats, Frostnip Fells, Grimebottom Works, Mount Kerblam.
//
// Dual-grid autotiles (water/ice/trench): a tile sits on a grid VERTEX shared by four
// cells. Index bits: TL=1, TR=2, BL=4, BR=8, set when that neighbouring cell has the
// terrain. The tile is one cell square, anchored at its centre (the vertex), and covers
// the quarter of each of the four cells nearest the vertex. Tiles are shaded per pixel
// from a bilinear field of the four corner values plus a noise that is periodic over one
// cell, so every edge a tile shares with a neighbour matches exactly.
import { P } from './palette.ts';
import { PZ } from './palette-zones.ts';
import { LINE, LINE_THIN, alpha, ball, box, contact, dabs, ellipsePath, glint, ink, litFill, mix, roundRectPath, seeded, tone, type Ctx } from './paint.ts';
import { pad2, type SpriteSpec } from './spec.ts';

// ------------------------------------------------------------ per-pixel raster helper

export type RGBA = [number, number, number, number];

export function rgb(hex: string, a = 1): RGBA {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function lerpRGBA(a: RGBA, b: RGBA, t: number): RGBA {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

/** Source-over composite of `top` onto `base` with extra coverage `c` (0..1). */
export function over(base: RGBA, top: RGBA, c: number): RGBA {
  const a = top[3] * c;
  const out = a + base[3] * (1 - a);
  if (out <= 0) return [0, 0, 0, 0];
  const k = base[3] * (1 - a);
  return [(top[0] * a + base[0] * k) / out, (top[1] * a + base[1] * k) / out, (top[2] * a + base[2] * k) / out, out];
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Shades the local rectangle (x0,y0,w,h) pixel by pixel at the context's device
 * resolution, then draws it through the current transform. `shade` receives art-unit
 * coordinates and the art-unit size of one pixel (for anti-aliasing).
 */
export function raster(ctx: Ctx, x0: number, y0: number, w: number, h: number, shade: (x: number, y: number, pw: number) => RGBA): void {
  const m = ctx.getTransform();
  const s = Math.hypot(m.a, m.b) || 1;
  const W = Math.max(1, Math.round(w * s));
  const H = Math.max(1, Math.round(h * s));
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const o = off.getContext('2d')!;
  const img = o.createImageData(W, H);
  const d = img.data;
  const pw = w / W;
  for (let py = 0; py < H; py++) {
    const y = y0 + ((py + 0.5) * h) / H;
    for (let px = 0; px < W; px++) {
      const c = shade(x0 + (px + 0.5) * pw, y, pw);
      const i = (py * W + px) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = Math.round(c[3] * 255);
    }
  }
  o.putImageData(img, 0, 0);
  ctx.drawImage(off, x0, y0, w, h);
}

// ------------------------------------------------------------ zone looks

interface ZoneLook {
  n: number;
  ground: string;
  dab1: string;
  dab2: string;
  detail: 'grass' | 'sand' | 'snow' | 'paving' | 'ash';
  patch: [string, string];
  liquid: 'water' | 'oasis' | 'icy' | 'sludge' | 'lava';
  shore: string;
  rim: string;
  trenchWall: string;
  trenchFloor: string;
}

const ZONES: ZoneLook[] = [
  { n: 1, ground: P.grass, dab1: P.grassLight, dab2: P.grassMid, detail: 'grass', patch: [P.grassMid, P.grassLight], liquid: 'water', shore: P.dirt, rim: P.grassLight, trenchWall: P.dirtDark, trenchFloor: P.bark },
  { n: 2, ground: PZ.sand, dab1: PZ.bone, dab2: PZ.sandMid, detail: 'sand', patch: [PZ.sandMid, PZ.bone], liquid: 'oasis', shore: PZ.sandMid, rim: PZ.bone, trenchWall: PZ.sandDark, trenchFloor: PZ.mesaDark },
  { n: 3, ground: PZ.snow, dab1: P.white, dab2: PZ.snowMid, detail: 'snow', patch: [PZ.snowMid, P.white], liquid: 'icy', shore: PZ.snowMid, rim: P.white, trenchWall: PZ.snowDark, trenchFloor: PZ.timber },
  { n: 4, ground: PZ.concrete, dab1: PZ.concreteLight, dab2: PZ.concreteDark, detail: 'paving', patch: [PZ.concreteDark, PZ.concreteLight], liquid: 'sludge', shore: PZ.concreteDark, rim: PZ.concreteLight, trenchWall: PZ.steelDark, trenchFloor: PZ.rustDark },
  { n: 5, ground: PZ.ash, dab1: PZ.ashLight, dab2: PZ.basaltLight, detail: 'ash', patch: [PZ.basaltLight, PZ.ashLight], liquid: 'lava', shore: PZ.basaltDark, rim: PZ.ashLight, trenchWall: PZ.basaltDark, trenchFloor: PZ.basalt },
];

// ------------------------------------------------------------ Zone 1: Buttercup Downs (v1.1 art sample)
//
// One continuous painted meadow instead of cell tiles: a seamless texture MEADOW cells square
// (periodic noise and wrapped strokes, so it repeats without a seam), drawn by the scene as one
// TilingSprite, with soft drifts, tufts and worn patches scattered over it to hide the repeat.
// Trees, bushes and the border canopy share one leaf-cluster painter: an ink silhouette round the
// whole canopy, then clusters in three layers (a dark base mass, a mid layer, small sunlit clusters
// towards the top left), each with leaf marks on its shaded side and a rim light on the lit one.

const TAU1 = Math.PI * 2;

/** Cells per side of the repeating meadow texture. */
export const MEADOW = 8;

/** Zone 1 colours, derived from the §16.3 tokens: a deeper, warmer, less acid green than the raw grass token. */
const Z1 = {
  base: mix(mix(P.grass, P.grassMid, 0.45), P.khaki, 0.12),
  deep: mix(mix(P.grassDark, P.grassMid, 0.35), P.khaki, 0.08),
  lit: mix(mix(P.grassLight, P.hay, 0.25), P.khaki, 0.08),
  warm: mix(P.grass, P.hay, 0.35),
  cool: mix(P.grassMid, P.water, 0.18),
  tip: mix(P.grassLight, P.flowerWhite, 0.3),
  shade: mix(P.hedge, P.ink, 0.25),
  clover: mix(P.grassDark, P.hedge, 0.4),
  leafDeep: mix(P.hedgeDark, P.ink, 0.2),
  leafMid: mix(P.hedge, P.grassMid, 0.55),
  leafSun: mix(P.grassLight, P.hay, 0.4),
};

/** Smooth value noise that repeats every `period` art units, over `cells` lattice cells per period. */
function periodicNoise(seed: number, period: number, cells: number): (x: number, y: number) => number {
  const rnd = seeded(seed);
  const g = Array.from({ length: cells * cells }, () => rnd());
  const k = cells / period;
  return (x, y) => {
    const fx = x * k;
    const fy = y * k;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const i0 = ((x0 % cells) + cells) % cells;
    const j0 = ((y0 % cells) + cells) % cells;
    const i1 = (i0 + 1) % cells;
    const j1 = (j0 + 1) % cells;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = g[j0 * cells + i0]!;
    const b = g[j0 * cells + i1]!;
    const c = g[j1 * cells + i0]!;
    const d = g[j1 * cells + i1]!;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Calls `f` at (x, y) and at each copy one period away that reaches into the tile, so wrapped strokes meet. */
function wrapped(half: number, x: number, y: number, reach: number, f: (x: number, y: number) => void): void {
  const T = half * 2;
  for (const ox of [-T, 0, T]) {
    for (const oy of [-T, 0, T]) {
      const px = x + ox;
      const py = y + oy;
      if (px + reach < -half || px - reach > half || py + reach < -half || py - reach > half) continue;
      f(px, py);
    }
  }
}

/** One tapered grass blade from its foot (x, y) up to its tip, leaning by `lean`. */
function blade(ctx: Ctx, x: number, y: number, len: number, lean: number, w: number, colour: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.2 + lean * 0.25, y - len * 0.6, x + lean, y - len);
  ctx.quadraticCurveTo(x + w * 0.6 + lean * 0.35, y - len * 0.5, x + w, y);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

/** A clump of blades: dark ones behind, lit ones in front with tips catching the light, and a soft shadow at the foot. */
function clump(ctx: Ctx, rnd: () => number, x: number, y: number, s: number, n: number): void {
  const sx = x + s * 0.25;
  const sy = y + s * 0.08;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s);
  g.addColorStop(0, alpha(Z1.shade, 0.4));
  g.addColorStop(1, alpha(Z1.shade, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(sx, sy, s, s * 0.34, 0, 0, TAU1);
  ctx.fill();
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const bx = x + (rnd() - 0.5) * s * 0.9;
    const len = s * (0.6 + rnd() * 0.6);
    // A light breeze leans most blades to the right.
    const lean = (rnd() - 0.32) * s * 0.7;
    const colour = t < 0.35 ? Z1.deep : t < 0.75 ? mix(Z1.base, Z1.deep, 0.25 * rnd()) : mix(Z1.lit, Z1.base, 0.2 * rnd());
    const w = 0.9 + rnd() * 0.7;
    const by = y + rnd() * 1.5;
    blade(ctx, bx, by, len, lean, w, colour);
    if (t > 0.5) blade(ctx, bx + lean * 0.62, by - len * 0.62, len * 0.38, lean * 0.38, w * 0.45, alpha(Z1.tip, 0.75));
  }
}

function daisy(ctx: Ctx, x: number, y: number, s: number): void {
  ellipsePath(ctx, x + s * 0.4, y + s * 0.45, s * 1.05, s * 0.55);
  ctx.fillStyle = alpha(Z1.shade, 0.3);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU1;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.5, s * 0.5, s * 0.26, a, 0, TAU1);
    ctx.fillStyle = i >= 1 && i <= 3 ? mix(P.flowerWhite, P.parchmentShade, 0.45) : P.flowerWhite;
    ctx.fill();
  }
  ball(ctx, x, y, s * 0.4, s * 0.36, P.flowerYellow, { line: 0, hi: 0.5, lo: 0.3 });
}

function buttercup(ctx: Ctx, x: number, y: number, s: number): void {
  ellipsePath(ctx, x + s * 0.35, y + s * 0.45, s * 0.9, s * 0.45);
  ctx.fillStyle = alpha(Z1.shade, 0.3);
  ctx.fill();
  ball(ctx, x, y, s * 0.8, s * 0.7, P.flowerYellow, { line: 0.6, hi: 0.55, lo: 0.3 });
  ellipsePath(ctx, x + s * 0.12, y + s * 0.12, s * 0.34, s * 0.26);
  ctx.fillStyle = alpha(P.hayDark, 0.7);
  ctx.fill();
  glint(ctx, x, y, s * 0.45, 0.85);
}

function clover(ctx: Ctx, x: number, y: number, r: number): void {
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i / 3) * TAU1;
    ball(ctx, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.6, r * 0.7, r * 0.6, Z1.clover, { line: 0, hi: 0.35, lo: 0.25 });
  }
}

/** The seamless Zone 1 meadow, MEADOW cells square, origin at its centre (key `meadow`). */
function meadow(ctx: Ctx): void {
  const T = MEADOW * 64;
  const h = T / 2;
  const broad = periodicNoise(901, T, 3);
  const mid = periodicNoise(902, T, 9);
  const fine = periodicNoise(903, T, 28);
  const grain = periodicNoise(904, T, 96);
  const hue = periodicNoise(905, T, 4);
  const deep = rgb(Z1.deep);
  const base = rgb(Z1.base);
  const lit = rgb(Z1.lit);
  const warm = rgb(Z1.warm);
  const cool = rgb(Z1.cool);
  const light = (x: number, y: number): number => clamp01(0.5 + (0.46 * broad(x, y) + 0.3 * mid(x, y) + 0.16 * fine(x, y) + 0.08 * grain(x, y) - 0.5) * 1.6);
  raster(ctx, -h, -h, T, T, (x, y) => {
    const v = light(x, y);
    let c = v < 0.5 ? lerpRGBA(deep, base, Math.sqrt(v * 2)) : lerpRGBA(base, lit, ((v - 0.5) * 2) ** 1.6);
    const w = hue(x, y) - 0.5;
    c = lerpRGBA(c, w > 0 ? warm : cool, Math.min(0.45, Math.abs(w) * 1.1));
    return c;
  });
  ctx.save();
  ctx.beginPath();
  ctx.rect(-h, -h, T, T);
  ctx.clip();
  const rnd = seeded(910);
  // Fine blade strokes everywhere: darker in the shaded drifts, lighter in the sunlit ones.
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 5200; i++) {
    const x = -h + rnd() * T;
    const y = -h + rnd() * T;
    const dark = rnd() > light(x, y);
    const len = 3 + rnd() * 4;
    const a = -Math.PI / 2 + (rnd() - 0.4) * 0.9;
    ctx.strokeStyle = dark ? alpha(Z1.deep, 0.45) : alpha(Z1.lit, 0.5);
    wrapped(h, x, y, 8, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      ctx.stroke();
    });
  }
  // Clover in low, cool drifts.
  for (let i = 0; i < 16; i++) {
    const cx = -h + rnd() * T;
    const cy = -h + rnd() * T;
    const n = 6 + Math.floor(rnd() * 8);
    for (let j = 0; j < n; j++) {
      const x = cx + (rnd() - 0.5) * 24;
      const y = cy + (rnd() - 0.5) * 12;
      const r = 1.5 + rnd() * 0.7;
      wrapped(h, x, y, 6, (px, py) => clover(ctx, px, py, r));
    }
  }
  // Grass clumps, back to front.
  const clumps = Array.from({ length: 300 }, () => ({ x: -h + rnd() * T, y: -h + rnd() * T, s: 6 + rnd() * 6, n: 5 + Math.floor(rnd() * 4), seed: Math.floor(rnd() * 1e9) })).sort((a, b) => a.y - b.y);
  for (const c of clumps) wrapped(h, c.x, c.y, c.s * 1.6, (px, py) => clump(ctx, seeded(c.seed), px, py, c.s, c.n));
  // A sprinkle of daisies and buttercups.
  for (let i = 0; i < 26; i++) {
    const x = -h + rnd() * T;
    const y = -h + rnd() * T;
    const s = 1.8 + rnd() * 0.6;
    const kind = i % 2;
    wrapped(h, x, y, 6, (px, py) => (kind ? daisy(ctx, px, py, s) : buttercup(ctx, px, py, s)));
  }
  ctx.restore();
}

/** Broad, soft drifts of sunlight or shade laid over the meadow (keys patch.0–3: two sunlit, a shade, a clover mottle). */
function drift(ctx: Ctx, k: number): void {
  const rnd = seeded(920 + k);
  const colour = k < 2 ? Z1.lit : k === 2 ? Z1.deep : Z1.clover;
  const a = k < 2 ? 0.24 : 0.2;
  const W = 96;
  const H = 57;
  for (let i = 0; i < 9; i++) {
    const r = 20 + rnd() * 20;
    const x = (rnd() - 0.5) * 2 * (W - r - 2);
    const y = (rnd() - 0.5) * 2 * (H - r * 0.65 - 2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, alpha(colour, a));
    g.addColorStop(0.6, alpha(colour, a * 0.45));
    g.addColorStop(1, alpha(colour, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.65, 0, 0, TAU1);
    ctx.fill();
  }
}

/** A single bigger clump scattered off the grid (keys tuft.0–3; the last carries a dandelion). */
function tuft(ctx: Ctx, k: number): void {
  const rnd = seeded(940 + k);
  clump(ctx, rnd, -3, 0, 11 + k, 8 + k);
  clump(ctx, rnd, 7, 2, 7, 5);
  if (k === 3) {
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.quadraticCurveTo(3, -9, 2, -16);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = Z1.deep;
    ctx.stroke();
    buttercup(ctx, 2, -17, 3);
  }
}

/** A small stone: shaded, with a highlight and a contact shadow, and no outline (outlined, they read as rings). */
function pebble(ctx: Ctx, x: number, y: number, r: number): void {
  ellipsePath(ctx, x + r * 0.4, y + r * 0.5, r * 1.1, r * 0.55);
  ctx.fillStyle = alpha(P.ink, 0.3);
  ctx.fill();
  ball(ctx, x, y, r, r * 0.72, P.rock, { line: 0, hi: 0.55, lo: 0.4 });
}

/** A worn patch of bare earth with an irregular soft edge, stones, and grass creeping over the rim (keys worn.0–1). */
function worn(ctx: Ctx, k: number): void {
  const rnd = seeded(960 + k);
  const n = 11;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU1;
    const j = 0.72 + rnd() * 0.36;
    return { x: Math.cos(a) * 25 * j, y: Math.sin(a) * 11 * j };
  });
  const path = new Path2D();
  pts.forEach((q, i) => {
    const r = pts[(i + 1) % n]!;
    const m = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    if (i === 0) path.moveTo(m.x, m.y);
    const nx = pts[(i + 2) % n]!;
    path.quadraticCurveTo(r.x, r.y, (r.x + nx.x) / 2, (r.y + nx.y) / 2);
  });
  path.closePath();
  // The grass rim is a little darker, then the earth, lit towards the top left and soft at its edge.
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = alpha(Z1.deep, 0.35);
  ctx.stroke(path);
  const g = ctx.createRadialGradient(-6, -3, 2, 0, 0, 27);
  g.addColorStop(0, alpha(tone(P.dirt, 0.15), 0.9));
  g.addColorStop(0.65, alpha(P.dirt, 0.8));
  g.addColorStop(1, alpha(P.dirtDark, 0.55));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.clip(path);
  dabs(ctx, rnd, -26, -12, 52, 24, 16, P.dirtDark, 1.5, 0.4);
  dabs(ctx, rnd, -26, -12, 40, 18, 8, P.flowerWhite, 1, 0.25);
  ctx.restore();
  for (let i = 0; i < 5; i++) pebble(ctx, (rnd() - 0.5) * 36, (rnd() - 0.5) * 12, 1.2 + rnd() * 1.1);
  for (let i = 0; i < 6; i++) {
    const q = pts[Math.floor(rnd() * n)]!;
    clump(ctx, rnd, q.x * 1.02, q.y * 1.02 + 2, 5 + rnd() * 3, 4);
  }
}

/** The forest's edge spilling onto the meadow, one per side of the field (keys fringe.n/s/w/e): leaf clusters
 * straddling the edge with their shade on the grass, repeating every 2 cells along it. The light stays
 * top-left, so each side is painted separately rather than rotated. */
function fringe(ctx: Ctx, side: 'n' | 's' | 'w' | 'e'): void {
  const rnd = seeded(980 + 'nswe'.indexOf(side));
  // Clusters in edge coordinates: `along` the edge (period 128) and `out` into the meadow.
  const base: { along: number; out: number; r: number; d: number; seed: number }[] = [];
  for (let i = 0; i < 7; i++) base.push({ along: -64 + (i + rnd() * 0.6) * (128 / 7), out: -4 + rnd() * 8, r: 13 + rnd() * 5, d: 0, seed: 4000 + i });
  for (let i = 0; i < 5; i++) base.push({ along: -64 + (i + rnd() * 0.8) * (128 / 5), out: 1 + rnd() * 7, r: 9 + rnd() * 4, d: 0.5, seed: 4100 + i });
  for (let i = 0; i < 4; i++) base.push({ along: -64 + (i + rnd()) * 32, out: -2 + rnd() * 6, r: 6 + rnd() * 3, d: 0.9, seed: 4200 + i });
  const place = (along: number, out: number): { x: number; y: number } =>
    side === 'n' ? { x: along, y: out } : side === 's' ? { x: along, y: -out } : side === 'w' ? { x: out, y: along } : { x: -out, y: along };
  const clusters: Leafy[] = [];
  for (const c of base) {
    for (const o of [-128, 0, 128]) {
      if (Math.abs(c.along + o) > 64 + c.r * 1.3) continue;
      const q = place(c.along + o, c.out);
      clusters.push({ x: q.x, y: q.y, r: c.r, d: c.d, seed: c.seed });
    }
  }
  const vertical = side === 'w' || side === 'e';
  ctx.save();
  ctx.beginPath();
  if (vertical) ctx.rect(-51, -64, 102, 128);
  else ctx.rect(-64, -51, 128, 102);
  ctx.clip();
  // Shade on the grass, cast down and to the right.
  for (const c of clusters) contact(ctx, c.x + 6, c.y + 8, c.r * 1.25, c.r * 0.8, 0.28);
  canopy(ctx, clusters, { deep: mix(P.hedgeDark, P.ink, 0.2), base: mix(P.hedge, P.hedgeDark, 0.25), lit: P.hedge, sun: mix(P.hedge, P.grassMid, 0.6) }, { crown: false });
  ctx.restore();
}

/** The shade the border canopy casts over the meadow's edge; the scene stretches it along each side (key edge). */
function edgeShade(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, -32, 0, 32);
  g.addColorStop(0, alpha(Z1.shade, 0.6));
  g.addColorStop(0.3, alpha(Z1.shade, 0.42));
  g.addColorStop(0.6, alpha(Z1.shade, 0.14));
  g.addColorStop(1, alpha(Z1.shade, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-32, -32, 64, 64);
}

/**
 * The same shade fading out along its length, full at the left and none at the right (key edge.end):
 * where the shade stops at a gate, which has no trees over it (§16.1, V-10). Needs its own canvas.
 */
function edgeShadeEnd(ctx: Ctx): void {
  edgeShade(ctx);
  const f = ctx.createLinearGradient(-32, 0, 32, 0);
  f.addColorStop(0, alpha(P.ink, 1));
  f.addColorStop(0.25, alpha(P.ink, 0.88));
  f.addColorStop(0.5, alpha(P.ink, 0.5));
  f.addColorStop(0.75, alpha(P.ink, 0.12));
  f.addColorStop(1, alpha(P.ink, 0));
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = f;
  ctx.fillRect(-32, -32, 64, 64);
  ctx.globalCompositeOperation = 'source-over';
}

interface Leafy {
  x: number;
  y: number;
  r: number;
  /** Painting layer: 0 the dark base mass, 0.5 the mid layer, 0.9 the small sunlit clusters. */
  d: number;
  seed: number;
}

interface LeafPalette {
  deep: string;
  base: string;
  lit: string;
  sun: string;
}

/** A scalloped leaf-cluster outline. */
function scallop(x: number, y: number, r: number, seed: number, ry = 0.88): Path2D {
  const rnd = seeded(seed);
  const n = 7 + Math.floor(rnd() * 4);
  const a0 = rnd() * TAU1;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * TAU1;
    const k = 0.84 + rnd() * 0.1;
    return [x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * ry] as const;
  });
  const p = new Path2D();
  p.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 0; i < n; i++) {
    const q = pts[(i + 1) % n]!;
    const am = a0 + ((i + 0.5) / n) * TAU1;
    const b = 1.12 + rnd() * 0.08;
    p.quadraticCurveTo(x + Math.cos(am) * r * b, y + Math.sin(am) * r * b * ry, q[0], q[1]);
  }
  p.closePath();
  return p;
}

/**
 * Paints leaf clusters as one canopy. An ink silhouette goes round the whole shape; then each cluster
 * (back layers first) is filled, from one light gradient across the crown when `crown` is set, and
 * given its own form: a lit spot towards the top left and a shaded crescent at the bottom right,
 * leaf marks, a rim light on the upper layers, and an inner contour on its shaded side only.
 */
function canopy(ctx: Ctx, clusters: Leafy[], pal: LeafPalette, opts: { line?: number; crown?: boolean } = {}): void {
  const line = opts.line ?? LINE;
  const list = [...clusters].sort((a, b) => a.d - b.d || a.y - b.y);
  const paths = list.map((c) => scallop(c.x, c.y, c.r, c.seed));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of list) {
    x0 = Math.min(x0, c.x - c.r);
    y0 = Math.min(y0, c.y - c.r);
    x1 = Math.max(x1, c.x + c.r);
    y1 = Math.max(y1, c.y + c.r);
  }
  const cw = x1 - x0;
  const ch = y1 - y0;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // The outline pass: every cluster stroked twice as thick, so the fills leave only the outer silhouette.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = line * 2;
  for (const p of paths) ctx.stroke(p);
  let crownFill: CanvasGradient | null = null;
  if (opts.crown !== false) {
    crownFill = ctx.createRadialGradient(x0 + cw * 0.3, y0 + ch * 0.26, 0, x0 + cw * 0.45, y0 + ch * 0.42, Math.max(cw, ch) * 0.78);
    crownFill.addColorStop(0, pal.lit);
    crownFill.addColorStop(0.45, pal.base);
    crownFill.addColorStop(1, pal.deep);
  }
  list.forEach((c, i) => {
    const p = paths[i]!;
    const rnd = seeded(c.seed + 7);
    ctx.fillStyle = crownFill ?? (c.d < 0.34 ? mix(pal.deep, pal.base, 0.45) : c.d < 0.67 ? pal.base : mix(pal.base, pal.lit, 0.4));
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    // Form: a lit spot towards the light and a shaded crescent turned away from it, in one gradient.
    const sun = c.d > 0.67 ? pal.sun : pal.lit;
    const lift = c.d < 0.34 ? 0.14 : c.d < 0.67 ? 0.38 : 0.62;
    const f = ctx.createRadialGradient(c.x - c.r * 0.42, c.y - c.r * 0.48, 0, c.x - c.r * 0.2, c.y - c.r * 0.24, c.r * 1.45);
    f.addColorStop(0, alpha(sun, lift));
    f.addColorStop(0.42, alpha(sun, 0));
    f.addColorStop(0.72, alpha(pal.deep, 0));
    f.addColorStop(1, alpha(pal.deep, 0.7));
    ctx.fillStyle = f;
    ctx.fillRect(c.x - c.r * 1.5, c.y - c.r * 1.5, c.r * 3, c.r * 3);
    // Leaf marks: small dark scallops on the shaded side, light leaves towards the sun.
    const marks = c.d < 0.34 ? 2 : 3 + Math.floor(c.r * 0.18);
    ctx.lineWidth = Math.max(0.8, c.r * 0.07);
    ctx.strokeStyle = alpha(pal.deep, 0.7);
    for (let m = 0; m < marks; m++) {
      const a = -0.1 + rnd() * 2.2;
      const rr = c.r * (0.4 + rnd() * 0.45);
      const s = c.r * (0.13 + rnd() * 0.07);
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.88 - s, s, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    if (c.d > 0) {
      ctx.fillStyle = alpha(pal.sun, c.d > 0.67 ? 0.85 : 0.5);
      for (let m = 0; m < 2 + Math.floor(c.r * 0.15); m++) {
        const a = Math.PI + 0.25 + rnd() * 1.3;
        const rr = c.r * (0.3 + rnd() * 0.45);
        ctx.beginPath();
        ctx.ellipse(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.88, c.r * 0.14, c.r * 0.08, -0.6 + rnd() * 0.5, 0, TAU1);
        ctx.fill();
      }
    }
    if (c.d >= 0.5) {
      // Rim light along the top-left edge.
      ctx.beginPath();
      ctx.ellipse(c.x + c.r * 0.06, c.y + c.r * 0.08, c.r * 0.97, c.r * 0.86, 0, Math.PI * 1.02, Math.PI * 1.52);
      ctx.lineWidth = Math.max(1.2, c.r * 0.12);
      ctx.strokeStyle = alpha(pal.sun, 0.6);
      ctx.stroke();
    }
    ctx.restore();
    if (c.d > 0) {
      // Inner contour on the shaded (lower right) half only, where a cluster sits over the one behind.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c.x + c.r * 2, c.y - c.r * 2.3);
      ctx.lineTo(c.x + c.r * 2, c.y + c.r * 2);
      ctx.lineTo(c.x - c.r * 2.3, c.y + c.r * 2);
      ctx.closePath();
      ctx.clip();
      ctx.lineWidth = LINE_THIN;
      ctx.strokeStyle = alpha(P.ink, 0.6);
      ctx.stroke(p);
      ctx.restore();
    }
  });
  ctx.restore();
}

/** Three painting layers of clusters filling an elliptical crown centred on (cx, cy). */
function crown(rnd: () => number, cx: number, cy: number, w: number, h: number, sizes: [number, number, number], counts: [number, number, number], seed: number): Leafy[] {
  const out: Leafy[] = [];
  const layers = [
    { d: 0, dx: 0, dy: 0, spread: 1 },
    { d: 0.5, dx: -0.12, dy: -0.14, spread: 0.78 },
    { d: 0.9, dx: -0.26, dy: -0.32, spread: 0.5 },
  ];
  layers.forEach((L, li) => {
    for (let i = 0; i < counts[li]!; i++) {
      const a = rnd() * TAU1;
      const rad = Math.sqrt(rnd()) * L.spread;
      const r = sizes[li]! * (0.8 + rnd() * 0.4);
      out.push({ x: cx + L.dx * w + Math.cos(a) * (w - r * 0.6) * rad, y: cy + L.dy * h + Math.sin(a) * (h - r * 0.5) * rad, r, d: L.d, seed: seed + li * 100 + i });
    }
  });
  return out;
}

/**
 * The lowest point the crown surely covers across the columns [-hw, hw]: in each column the lowest
 * covered y, then the highest of those. A cluster's scallop always holds an ellipse of 0.75 × its radius
 * (its points sit at 0.84–0.94 × r, 7 or more of them), so that is the part counted here.
 */
function crownUnderside(clusters: Leafy[], hw: number): number {
  let top = Infinity;
  for (let x = -hw; x <= hw; x += hw / 4) {
    let low = -Infinity;
    for (const c of clusters) {
      const r = c.r * 0.75;
      const dx = x - c.x;
      if (Math.abs(dx) < r) low = Math.max(low, c.y + Math.sqrt(r * r - dx * dx) * 0.88);
    }
    top = Math.min(top, low);
  }
  return top;
}

/** A tree trunk with roots flaring into the ground, lit on the left and shaded under the canopy. */
function trunk(ctx: Ctx, w: number, h: number, rnd: () => number): void {
  const p = new Path2D();
  p.moveTo(-w * 0.95, 2);
  p.quadraticCurveTo(-w * 0.45, -1, -w * 0.42, -h * 0.35);
  p.lineTo(-w * 0.34, -h);
  p.lineTo(w * 0.34, -h);
  p.lineTo(w * 0.42, -h * 0.35);
  p.quadraticCurveTo(w * 0.45, -1, w * 0.95, 2);
  p.quadraticCurveTo(0, 5, -w * 0.95, 2);
  p.closePath();
  const g = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
  g.addColorStop(0, tone(P.bark, 0.28));
  g.addColorStop(0.45, P.bark);
  g.addColorStop(1, P.barkDark);
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  const s = ctx.createLinearGradient(0, -h, 0, -h * 0.35);
  s.addColorStop(0, alpha(P.ink, 0.6));
  s.addColorStop(1, alpha(P.ink, 0));
  ctx.fillStyle = s;
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = alpha(P.barkDark, 0.85);
  for (let i = 0; i < 4; i++) {
    const x = (rnd() - 0.5) * w * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.15 - rnd() * h * 0.2);
    ctx.quadraticCurveTo(x + (rnd() - 0.5) * 3, -h * 0.5, x + (rnd() - 0.5) * 2, -h * 0.85);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.lineWidth = LINE;
  ctx.strokeStyle = P.ink;
  ctx.stroke(p);
}

const OAK: LeafPalette = { deep: mix(P.hedgeDark, P.ink, 0.15), base: P.hedge, lit: mix(P.hedge, P.grassMid, 0.6), sun: mix(P.grassMid, P.grassLight, 0.6) };
const LIME: LeafPalette = { deep: mix(P.hedgeDark, P.hedge, 0.3), base: mix(P.hedge, P.grassMid, 0.45), lit: P.grassMid, sun: mix(P.grassLight, P.hay, 0.25) };
const APPLE: LeafPalette = { deep: P.hedge, base: mix(P.grassMid, P.hedge, 0.3), lit: mix(P.grassMid, P.grassLight, 0.45), sun: mix(P.grassLight, P.hay, 0.4) };

/** Zone 1 trees (keys tree.0–2): a broad oak, a tall lime and a little apple tree. */
function treeZ1(ctx: Ctx, k: number): void {
  const rnd = seeded(430 + k);
  const t = [
    { cy: -62, w: 50, h: 36, trunkH: 30, trunkW: 13, sizes: [23, 16, 10] as [number, number, number], counts: [7, 5, 4] as [number, number, number], pal: OAK },
    { cy: -74, w: 32, h: 42, trunkH: 36, trunkW: 11, sizes: [19, 14, 9] as [number, number, number], counts: [8, 6, 4] as [number, number, number], pal: LIME },
    { cy: -52, w: 38, h: 28, trunkH: 24, trunkW: 10, sizes: [18, 13, 8] as [number, number, number], counts: [6, 5, 4] as [number, number, number], pal: APPLE },
  ][k]!;
  // The canopy's cast shadow falls down-right onto the ground (§16.1); the trunk sits in its own contact shade.
  contact(ctx, 16, 2, t.w + 12, 15, 0.3);
  contact(ctx, 1, 1, t.trunkW * 1.2, 4, 0.5);
  // The crown's clusters are placed at random, so a fixed trunk could stop short of it (V-9). The trunk
  // reaches 5 px up into whatever the crown covers. Its grain takes its 16 draws first, as it always has,
  // so every crown keeps its shape.
  const grain = Array.from({ length: 16 }, rnd);
  const clusters = crown(rnd, 0, t.cy, t.w, t.h, t.sizes, t.counts, 1000 + k * 1000);
  let g = 0;
  trunk(ctx, t.trunkW, Math.max(t.trunkH, 5 - crownUnderside(clusters, t.trunkW * 0.34)), () => grain[g++]!);
  canopy(ctx, clusters, t.pal);
  if (k === 2) {
    // Apples on the outer clusters.
    for (const c of clusters.filter((q) => q.d > 0).slice(0, 4)) {
      const a = rnd() * TAU1;
      const x = c.x + Math.cos(a) * c.r * 0.45;
      const y = c.y + Math.sin(a) * c.r * 0.4;
      ball(ctx, x, y, 3.2, 3, P.stop, { line: LINE_THIN, hi: 0.5, lo: 0.35 });
      glint(ctx, x, y, 2.4, 0.8);
    }
  }
}

/** Zone 1 bushes (keys bush.0–1): a round box bush, and one in pink blossom. */
function bushZ1(ctx: Ctx, k: number): void {
  const rnd = seeded(520 + k);
  contact(ctx, 5, 1, 27, 8, 0.38);
  const clusters = crown(rnd, 0, -12, 17, 9, [11, 8, 5], [4, 3, 3], 2600 + k * 100);
  canopy(ctx, clusters, k === 1 ? APPLE : OAK);
  if (k === 1) {
    for (const c of clusters.filter((q) => q.d > 0)) {
      for (let i = 0; i < 2; i++) {
        const x = c.x + (rnd() - 0.5) * c.r;
        const y = c.y + (rnd() - 0.5) * c.r * 0.8;
        for (let j = 0; j < 5; j++) {
          const a = (j / 5) * TAU1;
          ellipsePath(ctx, x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.3, 1.3, 1.1);
          ctx.fillStyle = j < 2 ? tone(P.flowerPink, 0.3) : P.flowerPink;
          ctx.fill();
        }
        ellipsePath(ctx, x, y, 0.8, 0.8);
        ctx.fillStyle = P.flowerWhite;
        ctx.fill();
      }
    }
  }
}

/** Tileable dense canopy (2×2 cells) seen from above, for the letterbox behind the border trees (key border). */
function canopyBorder(ctx: Ctx): void {
  const rnd = seeded(760);
  ctx.fillStyle = mix(P.hedgeDark, P.ink, 0.3);
  ctx.fillRect(-64, -64, 128, 128);
  const base: Leafy[] = [];
  const layer = (n: number, rMin: number, rVar: number, d: number, seed: number): void => {
    for (let i = 0; i < n; i++) base.push({ x: -64 + rnd() * 128, y: -64 + rnd() * 128, r: rMin + rnd() * rVar, d, seed: seed + i });
  };
  layer(18, 15, 9, 0, 3000);
  layer(15, 10, 6, 0.5, 3100);
  layer(10, 6, 4, 0.9, 3200);
  const all: Leafy[] = [];
  for (const c of base) wrapped(64, c.x, c.y, c.r * 1.3, (x, y) => all.push({ ...c, x, y }));
  ctx.save();
  ctx.beginPath();
  ctx.rect(-64, -64, 128, 128);
  ctx.clip();
  canopy(ctx, all, { deep: mix(P.hedgeDark, P.ink, 0.25), base: mix(P.hedge, P.hedgeDark, 0.35), lit: P.hedge, sun: mix(P.hedge, P.grassMid, 0.6) }, { line: LINE_THIN, crown: false });
  ctx.restore();
}

/** One faceted stone: a lit top plane, a shaded right side, grain, a crack and a moss cap. */
function stone(ctx: Ctx, x: number, y: number, rx: number, ry: number, rnd: () => number, moss: boolean): void {
  const n = 7;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * TAU1 + (rnd() - 0.5) * 0.35;
    const k = 0.82 + rnd() * 0.22;
    return { x: x + Math.cos(a) * rx * k, y: y + Math.sin(a) * ry * k };
  });
  const body = new Path2D();
  pts.forEach((p, i) => (i ? body.lineTo(p.x, p.y) : body.moveTo(p.x, p.y)));
  body.closePath();
  const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  g.addColorStop(0, P.rockLight);
  g.addColorStop(0.45, P.rock);
  g.addColorStop(1, P.rockDark);
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // The side turned away from the light.
  ctx.beginPath();
  ctx.moveTo(x + rx * 0.2, y - ry * 1.3);
  ctx.lineTo(x + rx * 1.4, y - ry * 0.4);
  ctx.lineTo(x + rx * 1.4, y + ry * 1.4);
  ctx.lineTo(x - rx * 0.15, y + ry * 1.4);
  ctx.closePath();
  ctx.fillStyle = alpha(P.rockDark, 0.4);
  ctx.fill();
  // Ambient occlusion where it meets the ground.
  const ao = ctx.createLinearGradient(0, y + ry * 0.2, 0, y + ry);
  ao.addColorStop(0, alpha(P.ink, 0));
  ao.addColorStop(1, alpha(P.ink, 0.35));
  ctx.fillStyle = ao;
  ctx.fillRect(x - rx * 1.5, y - ry * 1.5, rx * 3, ry * 3);
  // The top plane: the outline pulled in towards a point above the centre and flattened.
  const tx = x - rx * 0.14;
  const ty = y - ry * 0.55;
  const top = new Path2D();
  pts.forEach((p, i) => {
    const qx = tx + (p.x - tx) * 0.64;
    const qy = ty + (p.y - ty) * 0.46;
    if (i) top.lineTo(qx, qy);
    else top.moveTo(qx, qy);
  });
  top.closePath();
  const tg = ctx.createLinearGradient(tx - rx * 0.6, ty - ry * 0.4, tx + rx * 0.6, ty + ry * 0.4);
  tg.addColorStop(0, tone(P.rockLight, 0.35));
  tg.addColorStop(1, mix(P.rockLight, P.rock, 0.5));
  ctx.fillStyle = tg;
  ctx.fill(top);
  ctx.lineWidth = 1;
  ctx.strokeStyle = alpha(P.rockDark, 0.55);
  ctx.stroke(top);
  dabs(ctx, rnd, x - rx, y - ry, rx * 2, ry * 2, 8, P.rockDark, 1.4, 0.3);
  dabs(ctx, rnd, x - rx, y - ry, rx * 1.2, ry * 1.2, 5, P.flowerWhite, 0.9, 0.35);
  // A crack running down the front.
  ctx.beginPath();
  let cx = x + (rnd() - 0.2) * rx * 0.5;
  let cy = y - ry * 0.25;
  ctx.moveTo(cx, cy);
  for (let i = 0; i < 3; i++) {
    cx += (rnd() - 0.5) * rx * 0.35;
    cy += ry * 0.3;
    ctx.lineTo(cx, cy);
  }
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = alpha(P.ink, 0.55);
  ctx.stroke();
  if (moss) {
    const mp = scallop(tx + rx * 0.02, ty + ry * 0.02, rx * 0.5, Math.floor(rnd() * 1e6), 0.5);
    const mg = ctx.createLinearGradient(tx - rx * 0.5, ty - ry * 0.4, tx + rx * 0.5, ty + ry * 0.4);
    mg.addColorStop(0, Z1.leafSun);
    mg.addColorStop(1, Z1.leafMid);
    ctx.fillStyle = mg;
    ctx.fill(mp);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = alpha(Z1.leafDeep, 0.7);
    ctx.stroke(mp);
    for (let i = 0; i < 2; i++) {
      ellipsePath(ctx, tx + (rnd() - 0.2) * rx * 0.6, ty + ry * (0.35 + rnd() * 0.25), 1.2, 2);
      ctx.fillStyle = Z1.leafMid;
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.lineWidth = LINE;
  ctx.strokeStyle = P.ink;
  ctx.stroke(body);
}

/** Zone 1 boulders (keys rock.0–2): two or three faceted stones with a contact shadow and pebbles. */
function rockZ1(ctx: Ctx, k: number): void {
  const rnd = seeded(340 + k);
  contact(ctx, 4, 3, 30, 11, 0.5);
  const stones = [
    [
      { x: -7, y: -9, rx: 15, ry: 12, moss: true },
      { x: 11, y: -3, rx: 10, ry: 8, moss: false },
    ],
    [
      { x: 1, y: -10, rx: 17, ry: 13, moss: true },
      { x: -15, y: -1, rx: 6, ry: 5, moss: false },
    ],
    [
      { x: 8, y: -11, rx: 12, ry: 11, moss: true },
      { x: -9, y: -7, rx: 11, ry: 9, moss: false },
      { x: 2, y: 0, rx: 7, ry: 5, moss: false },
    ],
  ][k]!.sort((a, b) => a.y - b.y);
  for (const s of stones) stone(ctx, s.x, s.y, s.rx, s.ry, rnd, s.moss);
  for (let i = 0; i < 3; i++) pebble(ctx, -18 + rnd() * 36, 3 + rnd() * 3, 1.6 + rnd());
}

/** Zone 1 flower clumps (keys flowers.0–2): buttercups, daisies, and pink clover with a daisy. */
function flowersZ1(ctx: Ctx, k: number): void {
  const rnd = seeded(640 + k);
  contact(ctx, 2, 1, 18, 5, 0.3);
  for (let i = 0; i < 8; i++) {
    const a = rnd() * TAU1;
    const x = Math.cos(a) * 9;
    const y = Math.sin(a) * 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 2, a, 0, TAU1);
    ctx.fillStyle = i % 2 ? Z1.clover : Z1.leafMid;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = alpha(P.ink, 0.4);
    ctx.stroke();
  }
  clump(ctx, rnd, 0, 1, 8, 5);
  const heads = Array.from({ length: 5 }, () => ({ x: (rnd() - 0.5) * 28, y: -2 + (rnd() - 0.5) * 6, stem: 6 + rnd() * 6, lean: (rnd() - 0.5) * 3 })).sort((a, b) => a.y - b.y);
  heads.forEach((f, i) => {
    ctx.beginPath();
    ctx.moveTo(f.x, f.y + 3);
    ctx.quadraticCurveTo(f.x + f.lean * 0.3, f.y - f.stem * 0.5, f.x + f.lean, f.y - f.stem);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = Z1.deep;
    ctx.stroke();
    const hx = f.x + f.lean;
    const hy = f.y - f.stem;
    if (k === 0) buttercup(ctx, hx, hy, 3.2);
    else if (k === 1) daisy(ctx, hx, hy, 3.4);
    else if (i % 2) daisy(ctx, hx, hy, 3.2);
    else {
      ball(ctx, hx, hy, 2.8, 3.2, P.flowerPink, { line: 0.7, hi: 0.45, lo: 0.3 });
      dabs(ctx, rnd, hx - 2.5, hy - 3, 5, 6, 5, tone(P.flowerPink, -0.25), 0.7, 0.6);
    }
  });
}

/** Zone 1 signposts (keys sign.in, sign.out): the same boards as the other zones, with grain, bevels and nails. */
function signZ1(ctx: Ctx, out: boolean): void {
  contact(ctx, 3, 2, 16, 6, 0.4);
  const post = new Path2D();
  post.roundRect(-3, -38, 6, 40, 2);
  const pg = ctx.createLinearGradient(-3, 0, 3, 0);
  pg.addColorStop(0, tone(P.bark, 0.3));
  pg.addColorStop(0.5, P.bark);
  pg.addColorStop(1, P.barkDark);
  ctx.fillStyle = pg;
  ctx.fill(post);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = alpha(P.barkDark, 0.8);
  ctx.beginPath();
  ctx.moveTo(-0.8, -20);
  ctx.lineTo(-0.6, 0);
  ctx.stroke();
  ctx.lineJoin = 'round';
  ctx.lineWidth = LINE;
  ctx.strokeStyle = P.ink;
  ctx.stroke(post);
  const board = new Path2D();
  if (out) board.roundRect(-17, -45, 34, 19, 4);
  else {
    board.moveTo(-16, -45);
    board.lineTo(9, -45);
    board.lineTo(18, -35.5);
    board.lineTo(9, -26);
    board.lineTo(-16, -26);
    board.closePath();
  }
  const face = out ? P.stop : P.cream;
  const bg = ctx.createLinearGradient(0, -45, 0, -26);
  bg.addColorStop(0, tone(face, 0.3));
  bg.addColorStop(0.35, face);
  bg.addColorStop(1, tone(face, -0.25));
  ctx.fillStyle = bg;
  ctx.fill(board);
  ctx.save();
  ctx.clip(board);
  // Planks, a bevel of light along the top and a darker lip along the bottom.
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = alpha(P.ink, 0.22);
  ctx.beginPath();
  ctx.moveTo(-18, -35.5);
  ctx.lineTo(19, -35.5);
  ctx.stroke();
  ctx.fillStyle = alpha(P.flowerWhite, 0.45);
  ctx.fillRect(-18, -45, 38, 2.2);
  ctx.fillStyle = alpha(P.ink, 0.18);
  ctx.fillRect(-18, -28.2, 38, 2.5);
  ctx.restore();
  ctx.lineWidth = LINE;
  ctx.strokeStyle = P.ink;
  ctx.stroke(board);
  for (const nx of [-12, out ? 12 : 4]) {
    ball(ctx, nx, -41.5, 1.2, 1.2, P.steel, { line: 0.6, hi: 0.6 });
  }
  if (out) {
    // A little biscuit on the sign: this is where the Stores are.
    ball(ctx, 0, -35.5, 6.2, 5.2, P.hay, { line: LINE_THIN, hi: 0.5 });
    ctx.fillStyle = P.hayDark;
    for (const [x, y] of [
      [-2, -36.5],
      [2, -34.5],
      [0, -38],
    ]) {
      ellipsePath(ctx, x!, y!, 0.8, 0.8);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(-10, -35.5);
    ctx.lineTo(6, -35.5);
    ink(ctx, LINE + 0.6, P.stop);
    ctx.beginPath();
    ctx.moveTo(1, -40);
    ctx.lineTo(7, -35.5);
    ctx.lineTo(1, -31);
    ink(ctx, LINE + 0.6, P.stop);
  }
}

// ------------------------------------------------------------ shared: patches, rocks (Zones 1 and 3), hay, signs

function patch(ctx: Ctx, k: number, colours: [string, string], seed: number): void {
  const rnd = seeded(seed + k);
  const colour = k % 2 ? colours[1] : colours[0];
  for (let i = 0; i < 7; i++) {
    const x = (rnd() - 0.5) * 90;
    const y = (rnd() - 0.5) * 50;
    const r = 18 + rnd() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, alpha(colour, 0.45));
    g.addColorStop(1, alpha(colour, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

interface RockLook {
  base: string;
  dark: string;
  moss?: string;
  snow?: boolean;
}

function rock(ctx: Ctx, k: number, look: RockLook = { base: P.rock, dark: P.rockDark, moss: P.grassMid }, seed = 300): void {
  const rnd = seeded(seed + k);
  contact(ctx, 2, 4, 30, 14, 0.4);
  const lumps = [
    { x: -8, y: -6, rx: 16, ry: 14 },
    { x: 9, y: -3, rx: 13, ry: 11 },
    { x: 1, y: -13, rx: 12, ry: 11 },
  ].slice(0, 2 + (k % 2));
  for (const l of lumps) {
    const jx = (rnd() - 0.5) * 4;
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.85 + rnd() * 0.25;
      const px = l.x + jx + Math.cos(a) * l.rx * r;
      const py = l.y + Math.sin(a) * l.ry * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    litFill(ctx, look.base, l.x, l.y, l.rx, 0.45, 0.4);
    ink(ctx, LINE);
    ctx.save();
    ctx.clip();
    dabs(ctx, rnd, l.x - l.rx, l.y - l.ry, l.rx * 2, l.ry * 2, 6, look.dark, 2, 0.35);
    if (look.snow) {
      // Snow cap: a lumpy white blanket over the top of each lump.
      ctx.beginPath();
      ctx.moveTo(l.x - l.rx * 1.2, l.y - l.ry * 0.15);
      for (let i = 0; i <= 6; i++) ctx.quadraticCurveTo(l.x - l.rx + (i + 0.5) * (l.rx / 3), l.y - l.ry * (0.05 + rnd() * 0.3), l.x - l.rx + (i + 1) * (l.rx / 3), l.y - l.ry * 0.15);
      ctx.lineTo(l.x + l.rx * 1.2, l.y - l.ry * 1.3);
      ctx.lineTo(l.x - l.rx * 1.2, l.y - l.ry * 1.3);
      ctx.closePath();
      litFill(ctx, PZ.snow, l.x, l.y - l.ry, l.rx, 0.2, 0.25);
      ctx.lineWidth = LINE_THIN;
      ctx.strokeStyle = alpha(PZ.snowDark, 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (look.moss) {
    ellipsePath(ctx, -10, -15, 6, 3);
    ctx.fillStyle = alpha(look.moss, 0.8);
    ctx.fill();
  }
}

function hay(ctx: Ctx): void {
  contact(ctx, 2, 4, 26, 11, 0.35);
  ellipsePath(ctx, 0, -10, 22, 14);
  litFill(ctx, P.hay, 0, -10, 20);
  ink(ctx, LINE);
  ctx.save();
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(i * 5, -10, 3, 14, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = alpha(P.hayDark, 0.6);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = P.stop;
  ctx.fillRect(-2, -24, 4, 28);
}

function sign(ctx: Ctx, out: boolean): void {
  contact(ctx, 0, 2, 14, 6, 0.35);
  roundRectPath(ctx, -2.5, -38, 5, 40, 2);
  litFill(ctx, P.bark, 0, -18, 4);
  ink(ctx, LINE);
  ctx.beginPath();
  if (out) {
    roundRectPath(ctx, -17, -44, 34, 18, 4);
  } else {
    ctx.moveTo(-16, -44);
    ctx.lineTo(10, -44);
    ctx.lineTo(18, -35);
    ctx.lineTo(10, -26);
    ctx.lineTo(-16, -26);
    ctx.closePath();
  }
  litFill(ctx, out ? P.stop : P.cream, 0, -35, 16);
  ink(ctx, LINE);
  if (out) {
    // A little biscuit on the sign: this is where the Stores are.
    ball(ctx, 0, -35, 6, 5, P.hay, { line: LINE_THIN });
    ctx.fillStyle = P.hayDark;
    for (const [x, y] of [
      [-2, -36],
      [2, -34],
      [0, -37.5],
    ]) {
      ellipsePath(ctx, x!, y!, 0.8, 0.8);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(-10, -35);
    ctx.lineTo(6, -35);
    ink(ctx, LINE + 0.6, P.stop);
  }
}

// ------------------------------------------------------------ ground tiles, zones 2-5

function groundTile(ctx: Ctx, z: ZoneLook, k: number): void {
  const rnd = seeded(100 * z.n + k);
  ctx.fillStyle = z.ground;
  ctx.fillRect(-32, -32, 64, 64);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-30, -30, 60, 60);
  ctx.clip();
  dabs(ctx, rnd, -30, -30, 60, 60, 10, z.dab1, 5, 0.25);
  dabs(ctx, rnd, -30, -30, 60, 60, 8, z.dab2, 5, 0.22);
  ctx.lineCap = 'round';
  if (z.detail === 'sand') {
    for (let i = 0; i < 3; i++) {
      const x = -20 + rnd() * 40;
      const y = -20 + rnd() * 40;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.quadraticCurveTo(x, y - 4, x + 8, y);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = alpha(PZ.sandDark, 0.45);
      ctx.stroke();
    }
    for (let i = 0; i < 2; i++) ball(ctx, -22 + rnd() * 44, -22 + rnd() * 44, 2.2, 1.6, PZ.mesaDark, { line: 0.8, hi: 0.4 });
  } else if (z.detail === 'snow') {
    for (let i = 0; i < 3; i++) {
      ellipsePath(ctx, -20 + rnd() * 40, -20 + rnd() * 40, 6 + rnd() * 5, 2.5);
      ctx.fillStyle = alpha(PZ.snowDark, 0.35);
      ctx.fill();
    }
    ctx.strokeStyle = alpha(P.white, 0.95);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const x = -22 + rnd() * 44;
      const y = -22 + rnd() * 44;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y);
      ctx.lineTo(x + 2.5, y);
      ctx.moveTo(x, y - 2.5);
      ctx.lineTo(x, y + 2.5);
      ctx.stroke();
    }
  } else if (z.detail === 'paving') {
    // Hairline cracks and the odd bolt.
    ctx.beginPath();
    let x = -20 + rnd() * 40;
    let y = -20 + rnd() * 40;
    ctx.moveTo(x, y);
    for (let i = 0; i < 4; i++) {
      x += (rnd() - 0.5) * 16;
      y += (rnd() - 0.5) * 16;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = alpha(P.ink, 0.35);
    ctx.stroke();
    if (k % 2 === 0) {
      ellipsePath(ctx, -10 + rnd() * 20, -10 + rnd() * 20, 7 + rnd() * 5, 4);
      ctx.fillStyle = alpha(P.ink, 0.12);
      ctx.fill();
    }
    for (const [bx, by] of [
      [-24, -24],
      [24, 24],
    ]) {
      if (rnd() < 0.6) ball(ctx, bx!, by!, 1.6, 1.6, PZ.steel, { line: 0.7, hi: 0.5 });
    }
  } else if (z.detail === 'ash') {
    dabs(ctx, rnd, -30, -30, 60, 60, 6, PZ.basaltDark, 3, 0.3);
    if (k % 2 === 0) {
      ctx.beginPath();
      const x0 = -18 + rnd() * 36;
      const y0 = -18 + rnd() * 36;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + 6, y0 + 3);
      ctx.lineTo(x0 + 10, y0 - 1);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = alpha(PZ.lavaDark, 0.7);
      ctx.stroke();
    }
    for (let i = 0; i < 2; i++) {
      ellipsePath(ctx, -24 + rnd() * 48, -24 + rnd() * 48, 1, 1);
      ctx.fillStyle = PZ.ember;
      ctx.fill();
    }
  }
  ctx.restore();
  if (z.detail === 'paving') {
    // Slab joints along the tile edge: each tile draws half, so adjacent tiles form one joint.
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = alpha(P.ink, 0.22);
    ctx.strokeRect(-31.3, -31.3, 62.6, 62.6);
  }
}

// ------------------------------------------------------------ rocks, trees, bushes, flowers, zones 2-5

function sandstone(ctx: Ctx, k: number): void {
  const rnd = seeded(320 + k);
  contact(ctx, 2, 5, 32, 13, 0.4);
  const blocks = [
    { x: -6, w: 30, h: 22 + k * 3 },
    { x: 11, w: 18, h: 14 },
  ].slice(0, k === 2 ? 1 : 2);
  for (const b of blocks) {
    const top = -b.h;
    // Front face (strata) then the flat top.
    ctx.beginPath();
    ctx.moveTo(b.x - b.w / 2, 0);
    ctx.lineTo(b.x - b.w / 2 + 2, top);
    ctx.lineTo(b.x + b.w / 2 - 2, top);
    ctx.lineTo(b.x + b.w / 2, 0);
    ctx.closePath();
    litFill(ctx, PZ.mesa, b.x, top / 2, b.w * 0.6);
    ink(ctx, LINE);
    ctx.save();
    ctx.clip();
    for (let s = top + 5; s < 0; s += 5 + rnd() * 3) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.w, s);
      ctx.quadraticCurveTo(b.x, s + (rnd() - 0.5) * 3, b.x + b.w, s);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = alpha(PZ.mesaDark, 0.6);
      ctx.stroke();
    }
    ctx.restore();
    ellipsePath(ctx, b.x, top, b.w / 2 - 2, 4);
    litFill(ctx, PZ.mesaLight, b.x, top, b.w / 2);
    ink(ctx, LINE_THIN + 0.4);
  }
}

function scrapPile(ctx: Ctx, k: number): void {
  contact(ctx, 2, 5, 32, 13, 0.4);
  // Pallet
  roundRectPath(ctx, -24, -4, 48, 8, 2);
  litFill(ctx, P.crate, 0, 0, 24);
  ink(ctx, LINE);
  crate(ctx, -10, -4, 18, k === 0 ? P.crate : PZ.rust);
  if (k !== 2) crate(ctx, 10, -4, 14, P.crateDark);
  // A length of pipe lying across the top.
  roundRectPath(ctx, -20, -30 + k * 2, 30, 8, 4);
  litFill(ctx, PZ.steel, -5, -26, 14);
  ink(ctx, LINE_THIN + 0.4);
  ellipsePath(ctx, 10, -26 + k * 2, 3, 4);
  ctx.fillStyle = PZ.steelDark;
  ctx.fill();
  ink(ctx, LINE_THIN);
}

function crate(ctx: Ctx, x: number, baseY: number, s: number, colour: string): void {
  box(ctx, x - s / 2, baseY - s, s, s, 2, colour);
  ctx.beginPath();
  ctx.moveTo(x - s / 2 + 2, baseY - s + 2);
  ctx.lineTo(x + s / 2 - 2, baseY - 2);
  ctx.moveTo(x + s / 2 - 2, baseY - s + 2);
  ctx.lineTo(x - s / 2 + 2, baseY - 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = alpha(P.woodDark, 0.8);
  ctx.stroke();
}

function basaltColumns(ctx: Ctx, k: number): void {
  const rnd = seeded(360 + k);
  contact(ctx, 2, 5, 32, 13, 0.45);
  // Distinct clusters per variant; columns further back (smaller y) are drawn first.
  const sets = [
    [
      { x: -11, y: -3, h: 24, r: 9 },
      { x: 9, y: -2, h: 34, r: 10 },
    ],
    [
      { x: -2, y: -8, h: 38, r: 9 },
      { x: -14, y: 1, h: 20, r: 8.5 },
      { x: 12, y: 2, h: 16, r: 8 },
    ],
    [
      { x: 0, y: -2, h: 28, r: 12 },
      { x: 15, y: 3, h: 12, r: 7 },
    ],
  ];
  const cols = sets[k]!.map((c) => ({ ...c, h: c.h + rnd() * 4 }));
  cols.sort((a, b) => a.y - b.y);
  for (const c of cols) {
    const hex = (cy: number): [number, number][] => [0, 1, 2, 3, 4, 5].map((i) => [c.x + Math.cos((i * Math.PI) / 3) * c.r, cy + Math.sin((i * Math.PI) / 3) * c.r * 0.5]);
    const top = hex(c.y - c.h);
    // Front faces: the lower half of the hexagon extruded down to the ground.
    ctx.beginPath();
    ctx.moveTo(top[3]![0], top[3]![1]);
    ctx.lineTo(top[3]![0], c.y);
    ctx.lineTo(top[0]![0], c.y);
    ctx.lineTo(top[0]![0], top[0]![1]);
    ctx.closePath();
    litFill(ctx, PZ.basalt, c.x, c.y - c.h / 2, c.r);
    ink(ctx, LINE);
    ctx.beginPath();
    ctx.moveTo(c.x, top[1]![1]);
    ctx.lineTo(c.x, c.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = alpha(P.ink, 0.5);
    ctx.stroke();
    ctx.beginPath();
    top.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    litFill(ctx, PZ.basaltLight, c.x, c.y - c.h, c.r);
    ink(ctx, LINE_THIN + 0.4);
  }
  // A glowing seam in the tallest column.
  const t = cols.reduce((m, c) => (c.h > m.h ? c : m));
  ctx.beginPath();
  ctx.moveTo(t.x - 3, t.y - t.h * 0.7);
  ctx.lineTo(t.x + 1, t.y - t.h * 0.45);
  ctx.lineTo(t.x - 2, t.y - t.h * 0.2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = PZ.lava;
  ctx.stroke();
}

function cactus(ctx: Ctx, k: number): void {
  const rnd = seeded(420 + k);
  contact(ctx, 3, 5, 28, 12, 0.35);
  const limb = (x: number, y: number, w: number, h: number): void => {
    roundRectPath(ctx, x - w / 2, y - h, w, h, w / 2);
    litFill(ctx, PZ.cactus, x, y - h / 2, w);
    ink(ctx, LINE);
    ctx.beginPath();
    for (const dx of [-w * 0.2, w * 0.2]) {
      ctx.moveTo(x + dx, y - h + w * 0.5);
      ctx.lineTo(x + dx, y - 3);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = alpha(PZ.cactusDark, 0.7);
    ctx.stroke();
  };
  const flower = (x: number, y: number): void => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ellipsePath(ctx, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.2, 2.2, 1.8);
      ctx.fillStyle = k === 1 ? P.flowerYellow : P.flowerPink;
      ctx.fill();
    }
    ellipsePath(ctx, x, y, 1.4, 1.4);
    ctx.fillStyle = P.flowerYellow;
    ctx.fill();
  };
  if (k === 1) {
    // Prickly pear: stacked paddles.
    const pads = [
      { x: 0, y: -12, rx: 11, ry: 13 },
      { x: -10, y: -30, rx: 8, ry: 10 },
      { x: 9, y: -33, rx: 8, ry: 10 },
      { x: 0, y: -48, rx: 7, ry: 9 },
    ];
    for (const p of pads) {
      ball(ctx, p.x, p.y, p.rx, p.ry, PZ.cactus, { hi: 0.35 });
      ctx.fillStyle = alpha(PZ.bone, 0.9);
      for (let i = 0; i < 4; i++) {
        ellipsePath(ctx, p.x + (rnd() - 0.5) * p.rx, p.y + (rnd() - 0.5) * p.ry, 0.7, 0.7);
        ctx.fill();
      }
    }
    flower(0, -57);
    flower(-10, -40);
    return;
  }
  // Saguaro with arms (k 0 tall, k 2 with a little one beside it).
  const h = k === 0 ? 76 : 60;
  limb(-18, -26, 9, 22);
  limb(16, -34, 9, 26);
  ctx.beginPath();
  ctx.moveTo(-18, -30);
  ctx.quadraticCurveTo(-18, -18, -6, -20);
  ctx.moveTo(16, -36);
  ctx.quadraticCurveTo(16, -24, 6, -26);
  ctx.lineWidth = 9 + LINE * 2;
  ctx.strokeStyle = P.ink;
  ctx.stroke();
  ctx.lineWidth = 9;
  ctx.strokeStyle = PZ.cactus;
  ctx.stroke();
  limb(0, 0, 16, h);
  flower(0, -h + 2);
  flower(16, -58);
  if (k === 2) {
    limb(24, 2, 10, 22);
    flower(24, -19);
  }
}

function pine(ctx: Ctx, k: number): void {
  const s = [1, 0.85, 1.12][k]!;
  contact(ctx, 4, 6, 34 * s, 14, 0.35);
  roundRectPath(ctx, -5, -16, 10, 20, 3);
  litFill(ctx, PZ.timber, 0, -6, 6);
  ink(ctx, LINE);
  const tiers = [
    { y: -12, w: 40, h: 34 },
    { y: -34, w: 32, h: 30 },
    { y: -54, w: 22, h: 26 },
  ];
  for (const t of tiers) {
    const w = t.w * s;
    const y = t.y * s;
    const hgt = t.h * s;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.quadraticCurveTo(0, y + 6, w, y);
    ctx.lineTo(0, y - hgt);
    ctx.closePath();
    litFill(ctx, PZ.pine, 0, y - hgt / 2, w);
    ink(ctx, LINE);
    // Snow along the upper slopes.
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, y - hgt * 0.42);
    ctx.quadraticCurveTo(-w * 0.2, y - hgt * 0.3, 0, y - hgt * 0.38);
    ctx.quadraticCurveTo(w * 0.3, y - hgt * 0.28, w * 0.5, y - hgt * 0.45);
    ctx.lineTo(0, y - hgt);
    ctx.closePath();
    litFill(ctx, PZ.snow, 0, y - hgt * 0.7, w * 0.5, 0.2, 0.2);
    ctx.lineWidth = LINE_THIN;
    ctx.strokeStyle = alpha(PZ.snowDark, 0.9);
    ctx.stroke();
  }
}

function chimney(ctx: Ctx, k: number): void {
  const rnd = seeded(440 + k);
  if (k === 0) {
    contact(ctx, 3, 5, 28, 12, 0.4);
    roundRectPath(ctx, -12, -84, 24, 86, 3);
    litFill(ctx, PZ.brick, 0, -40, 16);
    ink(ctx, LINE);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = alpha(PZ.brickDark, 0.7);
    ctx.lineWidth = 1;
    for (let y = -80; y < 0; y += 6) {
      ctx.beginPath();
      ctx.moveTo(-12, y);
      ctx.lineTo(12, y);
      ctx.stroke();
      for (let x = ((y / 6) % 2 ? -8 : -2); x < 12; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 6);
        ctx.stroke();
      }
    }
    ctx.restore();
    for (const y of [-70, -30]) {
      ctx.fillStyle = PZ.hazard;
      ctx.fillRect(-12, y, 24, 3);
    }
    box(ctx, -15, -90, 30, 8, 2, PZ.brickDark);
    for (let i = 0; i < 3; i++) ball(ctx, (rnd() - 0.3) * 14 + i * 6, -100 - i * 12, 8 + i * 2, 7 + i * 2, P.smokeLight, { line: LINE_THIN, hi: 0.3 });
  } else if (k === 1) {
    contact(ctx, 3, 5, 30, 12, 0.4);
    for (const [x, h] of [
      [-12, 58],
      [0, 72],
      [12, 50],
    ] as const) {
      roundRectPath(ctx, x - 5, -h, 10, h + 2, 4);
      litFill(ctx, PZ.steel, x, -h / 2, 8);
      ink(ctx, LINE);
      box(ctx, x - 6.5, -h * 0.55, 13, 5, 2, PZ.steelDark, LINE_THIN + 0.4);
      ball(ctx, x, -h, 5, 2.4, PZ.steelDark, { line: LINE_THIN });
    }
    ctx.fillStyle = PZ.hazard;
    ctx.fillRect(-17, -24, 34, 3);
  } else {
    // Water tower on legs.
    contact(ctx, 3, 5, 30, 12, 0.4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = P.ink;
    for (const x of [-14, 14, -6, 6]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x * 0.7, -44);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-12, -12);
    ctx.lineTo(12, -30);
    ctx.moveTo(12, -12);
    ctx.lineTo(-12, -30);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -44);
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI);
    ctx.lineTo(-18, -24);
    ctx.ellipse(0, -24, 18, 6, 0, Math.PI, 0, true);
    ctx.closePath();
    litFill(ctx, PZ.rust, 0, -12, 18);
    ink(ctx, LINE);
    ellipsePath(ctx, 0, -24, 18, 6);
    litFill(ctx, PZ.steelLight, 0, -24, 16);
    ink(ctx, LINE);
    ctx.beginPath();
    ctx.moveTo(-8, -30);
    ctx.lineTo(0, -40);
    ctx.lineTo(8, -30);
    ctx.closePath();
    litFill(ctx, PZ.steelDark, 0, -34, 8);
    ink(ctx, LINE_THIN + 0.4);
    ctx.restore();
  }
}

function charredTree(ctx: Ctx, k: number): void {
  const rnd = seeded(460 + k);
  if (k === 1) {
    // Basalt spire
    contact(ctx, 3, 5, 26, 11, 0.45);
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-10, -30);
    ctx.lineTo(-6, -28);
    ctx.lineTo(-2, -70);
    ctx.lineTo(4, -64);
    ctx.lineTo(8, -40);
    ctx.lineTo(12, -44);
    ctx.lineTo(18, 0);
    ctx.closePath();
    litFill(ctx, PZ.basalt, 0, -30, 22);
    ink(ctx, LINE);
    ctx.beginPath();
    ctx.moveTo(-2, -50);
    ctx.lineTo(2, -34);
    ctx.lineTo(-1, -16);
    ctx.lineWidth = 2;
    ctx.strokeStyle = PZ.lava;
    ctx.stroke();
    return;
  }
  if (k === 2) {
    // Steam vent: a rock mound puffing.
    contact(ctx, 2, 4, 26, 10, 0.4);
    ball(ctx, 0, -8, 20, 11, PZ.basalt, { hi: 0.3 });
    ellipsePath(ctx, 0, -14, 6, 2.6);
    ctx.fillStyle = PZ.lavaDark;
    ctx.fill();
    // Steam drifts up and to the right, thinning as it rises.
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.globalAlpha = 0.85 - i * 0.14;
      ball(ctx, i * 7 + (rnd() - 0.5) * 6, -24 - i * 11, 6 + i * 3.5, 5 + i * 2.6, P.smokeLight, { line: LINE_THIN, hi: 0.25 });
      ctx.restore();
    }
    return;
  }
  contact(ctx, 3, 5, 26, 11, 0.4);
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number): void => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = w + LINE * 1.4;
    ctx.strokeStyle = P.ink;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = w;
    ctx.strokeStyle = PZ.basaltDark;
    ctx.stroke();
    if (depth > 0) {
      branch(x2, y2, a - 0.5 - rnd() * 0.3, len * 0.65, w * 0.6, depth - 1);
      branch(x2, y2, a + 0.45 + rnd() * 0.3, len * 0.6, w * 0.6, depth - 1);
    }
  };
  branch(0, 2, -Math.PI / 2, 38, 8, 2);
  for (let i = 0; i < 3; i++) {
    ellipsePath(ctx, (rnd() - 0.5) * 24, -30 - rnd() * 30, 1.6, 1.6);
    ctx.fillStyle = PZ.ember;
    ctx.fill();
  }
}

function zoneBush(ctx: Ctx, z: number, k: number): void {
  const rnd = seeded(520 + z * 10 + k);
  contact(ctx, 2, 3, 24, 9, 0.35);
  if (z === 2) {
    if (k === 0) {
      const blobs = Array.from({ length: 4 }, () => ({ x: (rnd() - 0.5) * 22, y: -8 + (rnd() - 0.5) * 8, r: 8 + rnd() * 4 })).sort((a, b) => a.y - b.y);
      for (const b of blobs) ball(ctx, b.x, b.y, b.r, b.r * 0.8, P.olive, { hi: 0.3 });
    } else {
      // Tumbleweed: a scribbly ball.
      ellipsePath(ctx, 0, -12, 13, 12);
      ctx.fillStyle = alpha(PZ.sandDark, 0.35);
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = PZ.mesaDark;
      for (let i = 0; i < 14; i++) {
        const a = rnd() * Math.PI * 2;
        const b = a + 1 + rnd() * 2;
        ctx.beginPath();
        ctx.arc(0, -12, 4 + rnd() * 9, a, b);
        ctx.stroke();
      }
    }
  } else if (z === 3) {
    if (k === 0) {
      const blobs = Array.from({ length: 4 }, () => ({ x: (rnd() - 0.5) * 22, y: -8 + (rnd() - 0.5) * 8, r: 8 + rnd() * 4 })).sort((a, b) => a.y - b.y);
      for (const b of blobs) {
        ball(ctx, b.x, b.y, b.r, b.r * 0.8, PZ.pine, { hi: 0.3 });
        ball(ctx, b.x - 1, b.y - b.r * 0.45, b.r * 0.8, b.r * 0.38, PZ.snow, { line: LINE_THIN, hi: 0.15 });
      }
    } else {
      // A snowman with a carrot nose and a tiny scarf.
      ball(ctx, 0, -9, 11, 10, PZ.snow, { hi: 0.2 });
      ball(ctx, 0, -25, 8, 7.5, PZ.snow, { hi: 0.2 });
      ctx.fillStyle = P.ink;
      for (const [x, y] of [
        [-2.5, -27],
        [2.5, -27],
        [0, -11],
        [0, -6],
      ]) {
        ellipsePath(ctx, x!, y!, 1.1, 1.1);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(0, -24.5);
      ctx.lineTo(7, -23.5);
      ctx.lineTo(0, -22.5);
      ctx.closePath();
      ctx.fillStyle = PZ.carrot;
      ctx.fill();
      ctx.fillStyle = P.stop;
      ctx.fillRect(-6, -19, 12, 3);
      ctx.fillRect(3, -19, 3, 8);
    }
  } else if (z === 4) {
    if (k === 0) {
      for (const [x, c] of [
        [-8, PZ.rust],
        [8, P.olive],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(x, 0, 8, 3, 0, 0, Math.PI);
        ctx.lineTo(x - 8, -20);
        ctx.ellipse(x, -20, 8, 3, 0, Math.PI, 0, true);
        ctx.closePath();
        litFill(ctx, c, x, -10, 8);
        ink(ctx, LINE);
        ellipsePath(ctx, x, -20, 8, 3);
        litFill(ctx, tone(c, 0.2), x, -20, 8);
        ink(ctx, LINE_THIN + 0.4);
        ctx.fillStyle = alpha(P.ink, 0.35);
        ctx.fillRect(x - 8, -12, 16, 1.5);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        ellipsePath(ctx, 0, -4 - i * 7, 13, 5);
        litFill(ctx, P.tyre, 0, -4 - i * 7, 13, 0.25, 0.3);
        ink(ctx, LINE);
        ellipsePath(ctx, 0, -5 - i * 7, 5, 2);
        ctx.fillStyle = P.ink;
        ctx.fill();
      }
    }
  } else {
    if (k === 0) {
      for (const [x, r] of [
        [-7, 8],
        [6, 6],
      ] as const) {
        ball(ctx, x, -r * 0.6, r, r * 0.75, PZ.basalt, { hi: 0.3 });
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, -r * 0.6);
        ctx.lineTo(x + r * 0.3, -r * 0.3);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = PZ.lava;
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a) * 8, -8, Math.cos(a) * 14, Math.sin(a) * 18);
        ctx.strokeStyle = PZ.ash;
        ctx.stroke();
      }
    }
  }
}

function zoneDecal(ctx: Ctx, z: number, k: number): void {
  const rnd = seeded(620 + z * 10 + k);
  if (z === 2) {
    for (let i = 0; i < 6; i++) ball(ctx, (rnd() - 0.5) * 30, (rnd() - 0.5) * 14, 2 + rnd() * 1.5, 1.4 + rnd(), rnd() > 0.5 ? PZ.mesa : PZ.sandDark, { line: 0.8, hi: 0.4 });
    ellipsePath(ctx, 8, -2, 2, 2);
    ctx.fillStyle = k === 1 ? P.flowerPink : P.flowerYellow;
    ctx.fill();
  } else if (z === 3) {
    ctx.strokeStyle = P.white;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const x = (rnd() - 0.5) * 32;
      const y = (rnd() - 0.5) * 16;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y);
      ctx.lineTo(x + 2.5, y);
      ctx.moveTo(x, y - 2.5);
      ctx.lineTo(x, y + 2.5);
      ctx.stroke();
    }
    if (k === 2) {
      // Little footprints wandering off.
      ctx.fillStyle = alpha(PZ.snowDark, 0.8);
      for (let i = 0; i < 4; i++) {
        ellipsePath(ctx, -12 + i * 8, (i % 2 ? 2 : -2), 1.8, 1.2);
        ctx.fill();
      }
    }
  } else if (z === 4) {
    ellipsePath(ctx, 0, 0, 13, 5);
    ctx.fillStyle = alpha(P.ink, 0.18);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - 0.5) * 26;
      const y = (rnd() - 0.5) * 10;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * 2.6;
        const py = y + Math.sin(a) * 1.8;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      litFill(ctx, PZ.steelLight, x, y, 3);
      ink(ctx, 0.8);
    }
  } else {
    ellipsePath(ctx, 0, 0, 12, 5);
    ctx.fillStyle = alpha(PZ.basaltDark, 0.4);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ellipsePath(ctx, (rnd() - 0.5) * 26, (rnd() - 0.5) * 10, 1.3, 1.3);
      ctx.fillStyle = i % 2 ? PZ.ember : PZ.lava;
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------ borders (2×2, tileable)

function blobBorder(ctx: Ctx, seed: number, bg: string, fg: string, n: number, rMin: number, rVar: number, ry = 0.9, extra?: (x: number, y: number, r: number, rnd: () => number) => void): void {
  const rnd = seeded(seed);
  ctx.fillStyle = bg;
  ctx.fillRect(-64, -64, 128, 128);
  const blobs: { x: number; y: number; r: number; t: number }[] = [];
  for (let i = 0; i < n; i++) blobs.push({ x: -64 + rnd() * 128, y: -64 + rnd() * 128, r: rMin + rnd() * rVar, t: (rnd() - 0.5) * 0.2 });
  blobs.sort((a, b) => a.y - b.y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-64, -64, 128, 128);
  ctx.clip();
  for (const b of blobs) {
    for (const ox of [-128, 0, 128]) {
      for (const oy of [-128, 0, 128]) {
        ball(ctx, b.x + ox, b.y + oy, b.r, b.r * ry, tone(fg, b.t), { line: LINE_THIN, hi: 0.3, lo: 0.35 });
        extra?.(b.x + ox, b.y + oy, b.r, seeded(seed + Math.round(b.x * 7 + b.y)));
      }
    }
  }
  ctx.restore();
}

function duneBorder(ctx: Ctx): void {
  // Wavy dune crests; every curve has a period of 128 so the 2×2 tile repeats seamlessly.
  const rnd = seeded(725);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-64, -64, 128, 128);
  ctx.clip();
  ctx.fillStyle = PZ.sandDark;
  ctx.fillRect(-64, -64, 128, 128);
  const k = (Math.PI * 2) / 128;
  for (let row = -1; row < 6; row++) {
    const y0 = -64 + row * 24;
    const ph = row * 1.7;
    const crest = (x: number): number => y0 + 7 * Math.sin(k * x + ph) + 3 * Math.sin(k * 2 * x + ph * 1.3);
    ctx.beginPath();
    ctx.moveTo(-64, crest(-64));
    for (let x = -64; x <= 64; x += 4) ctx.lineTo(x, crest(x));
    ctx.lineTo(64, y0 + 30);
    ctx.lineTo(-64, y0 + 30);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y0 - 8, 0, y0 + 24);
    g.addColorStop(0, PZ.bone);
    g.addColorStop(0.35, PZ.sand);
    g.addColorStop(1, PZ.sandMid);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    for (let x = -64; x <= 64; x += 4) (x === -64 ? ctx.moveTo(x, crest(x)) : ctx.lineTo(x, crest(x)));
    ctx.lineWidth = LINE_THIN;
    ctx.strokeStyle = alpha(PZ.mesaDark, 0.8);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) ball(ctx, -52 + rnd() * 104, -52 + rnd() * 104, 3, 2, PZ.mesaDark, { line: 0.8, hi: 0.4 });
  ctx.restore();
}

function brickBorder(ctx: Ctx): void {
  const rnd = seeded(740);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-64, -64, 128, 128);
  ctx.clip();
  ctx.fillStyle = PZ.brickDark;
  ctx.fillRect(-64, -64, 128, 128);
  // 8 courses of 16 units, bricks 32 wide, alternate courses offset by 16: period 128.
  for (let row = 0; row < 8; row++) {
    const y = -64 + row * 16;
    const off = row % 2 ? 16 : 0;
    for (let i = -1; i < 4; i++) {
      const x = -64 + off + i * 32;
      roundRectPath(ctx, x + 1.2, y + 1.2, 29.6, 13.6, 2);
      litFill(ctx, tone(PZ.brick, (rnd() - 0.5) * 0.18), x + 16, y + 8, 16, 0.25, 0.3);
    }
  }
  // Riveted steel plates, kept inside the tile so they never cross an edge.
  for (const [x, y] of [
    [-40, -30],
    [18, 26],
  ] as const) {
    box(ctx, x, y, 30, 22, 2, PZ.steel, LINE_THIN + 0.4);
    ctx.fillStyle = PZ.steelDark;
    for (const [dx, dy] of [
      [3, 3],
      [27, 3],
      [3, 19],
      [27, 19],
    ]) {
      ellipsePath(ctx, x + dx!, y + dy!, 1.3, 1.3);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------ blockers and tunnel mouths

function blocker(ctx: Ctx, z: number, k: number): void {
  const rnd = seeded(800 + z * 10 + k);
  if (z === 1) {
    if (k === 0) return hay(ctx);
    contact(ctx, 2, 4, 28, 11, 0.35);
    for (const [x, y, w] of [
      [-12, 0, 22],
      [11, 0, 22],
      [0, -14, 22],
    ] as const) {
      box(ctx, x - w / 2, y - 14, w, 14, 3, P.hay);
      ctx.fillStyle = alpha(P.hayDark, 0.6);
      ctx.fillRect(x - w / 2 + 3, y - 12, w - 6, 1.2);
      ctx.fillRect(x - w / 2 + 3, y - 5, w - 6, 1.2);
      ctx.fillStyle = P.stop;
      ctx.fillRect(x - 2, y - 14, 1.6, 14);
    }
    return;
  }
  if (z === 5) {
    contact(ctx, 2, 4, 26, 11, 0.45);
    const lumps = k === 0 ? [{ x: 0, y: -12, r: 16 }] : [{ x: -8, y: -9, r: 11 }, { x: 8, y: -12, r: 13 }];
    for (const l of lumps) {
      ctx.beginPath();
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
        const r = l.r * (0.8 + rnd() * 0.3);
        const px = l.x + Math.cos(a) * r;
        const py = l.y + Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      litFill(ctx, PZ.obsidianLight, l.x, l.y, l.r, 0.35, 0.6);
      ink(ctx, LINE);
      ctx.save();
      ctx.clip();
      // Glassy facets: a couple of bright sharp glints.
      ctx.beginPath();
      ctx.moveTo(l.x - l.r * 0.5, l.y - l.r * 0.5);
      ctx.lineTo(l.x, l.y - l.r * 0.1);
      ctx.lineTo(l.x - l.r * 0.2, l.y + l.r * 0.5);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = alpha(P.white, 0.55);
      ctx.stroke();
      ctx.restore();
      glint(ctx, l.x - l.r * 0.2, l.y - l.r * 0.3, l.r * 0.5, 0.8);
    }
    return;
  }
  contact(ctx, 2, 4, 30, 12, 0.35);
  const crateCol = z === 4 ? P.crate : P.crateDark;
  if (k === 0) {
    crate(ctx, -9, 2, 20, crateCol);
    crate(ctx, 10, 2, 16, P.crate);
    crate(ctx, -2, -18, 16, P.crate);
    if (z === 4) {
      ctx.fillStyle = alpha(P.cream, 0.85);
      ctx.fillRect(-15, -10, 4, 4);
    }
  } else {
    // A barrel and a sack (z2, z3) or a stacked pallet (z4).
    if (z === 4) {
      roundRectPath(ctx, -22, -4, 44, 7, 2);
      litFill(ctx, P.crate, 0, 0, 22);
      ink(ctx, LINE);
      crate(ctx, -8, -4, 16, P.crateDark);
      crate(ctx, 9, -4, 16, P.crate);
    } else {
      ctx.beginPath();
      ctx.ellipse(-6, 0, 10, 4, 0, 0, Math.PI);
      ctx.lineTo(-16, -24);
      ctx.ellipse(-6, -24, 10, 4, 0, Math.PI, 0, true);
      ctx.closePath();
      litFill(ctx, P.wood, -6, -12, 10);
      ink(ctx, LINE);
      ctx.fillStyle = PZ.steelDark;
      ctx.fillRect(-16, -18, 20, 2);
      ctx.fillRect(-16, -7, 20, 2);
      ball(ctx, 11, -8, 9, 9, P.khaki, { hi: 0.3 });
    }
  }
  if (z === 3) {
    // Snow on the tops of whatever is here.
    const caps: [number, number, number][] =
      k === 0
        ? [
            [-9, -18, 10],
            [10, -14, 8],
            [-2, -34, 8],
          ]
        : [
            [-6, -24, 10],
            [11, -16, 7],
          ];
    for (const [x, y, w] of caps) ball(ctx, x, y, w, 3.2, PZ.snow, { line: LINE_THIN, hi: 0.15 });
  }
}

function tunnel(ctx: Ctx, z: number): void {
  contact(ctx, 0, 6, 34, 12, 0.4);
  const mouth = (): void => {
    ctx.beginPath();
    ctx.moveTo(-15, 4);
    ctx.lineTo(-15, -14);
    ctx.quadraticCurveTo(-15, -30, 0, -30);
    ctx.quadraticCurveTo(15, -30, 15, -14);
    ctx.lineTo(15, 4);
    ctx.closePath();
  };
  const dark = (): void => {
    mouth();
    const g = ctx.createLinearGradient(0, -30, 0, 4);
    g.addColorStop(0, P.ink);
    g.addColorStop(1, z === 5 ? PZ.lavaDark : tone(P.ink, 0.12));
    ctx.fillStyle = g;
    ctx.fill();
  };
  if (z === 4) {
    // Big pipe mouth with a bolted flange.
    ellipsePath(ctx, 0, -14, 26, 22);
    litFill(ctx, PZ.steel, 0, -14, 24);
    ink(ctx, LINE);
    ellipsePath(ctx, 0, -13, 18, 16);
    const g = ctx.createRadialGradient(0, -10, 2, 0, -13, 18);
    g.addColorStop(0, P.ink);
    g.addColorStop(1, tone(PZ.steelDark, -0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ink(ctx, LINE);
    ctx.fillStyle = PZ.steelDark;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ellipsePath(ctx, Math.cos(a) * 22, -14 + Math.sin(a) * 19, 1.5, 1.5);
      ctx.fill();
    }
    ellipsePath(ctx, 0, 3, 10, 3);
    ctx.fillStyle = alpha(PZ.sludge, 0.9);
    ctx.fill();
    return;
  }
  if (z === 3) {
    // Ice cave: chunky ice blocks around a dark arch, icicles hanging.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ball(ctx, Math.cos(a) * 20, -12 + Math.sin(a) * 22, 9, 8, i % 2 ? PZ.ice : PZ.iceDark, { hi: 0.5 });
    }
    dark();
    ink(ctx, LINE);
    ctx.fillStyle = PZ.ice;
    for (const x of [-9, -3, 4, 10]) {
      ctx.beginPath();
      ctx.moveTo(x - 2, -26);
      ctx.lineTo(x, -18 - (x % 3) * 2);
      ctx.lineTo(x + 2, -26);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // Earth / sandstone / basalt arch with a timber frame (z1, z2) or glowing cave (z5).
  const rockCol = z === 1 ? P.rock : z === 2 ? PZ.mesa : PZ.basalt;
  ctx.beginPath();
  ctx.moveTo(-28, 6);
  ctx.quadraticCurveTo(-30, -40, 0, -42);
  ctx.quadraticCurveTo(30, -40, 28, 6);
  ctx.closePath();
  litFill(ctx, rockCol, 0, -18, 28, 0.35, 0.4);
  ink(ctx, LINE);
  if (z === 1) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = alpha(P.grassMid, 0.9);
    ctx.fillRect(-30, -44, 60, 8);
    ctx.restore();
  }
  dark();
  ink(ctx, LINE);
  if (z !== 5) {
    // Timber frame.
    for (const x of [-15, 11]) box(ctx, x, -28, 4, 32, 1, P.wood, LINE_THIN + 0.4);
    box(ctx, -17, -32, 34, 5, 1.5, P.woodDark, LINE_THIN + 0.4);
    if (z === 2) {
      // Rails running out of the mine.
      ctx.strokeStyle = PZ.steelDark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(-9, 8);
      ctx.moveTo(6, -6);
      ctx.lineTo(9, 8);
      ctx.stroke();
    }
  } else {
    ellipsePath(ctx, 0, -4, 9, 4);
    ctx.fillStyle = alpha(PZ.lavaCore, 0.8);
    ctx.fill();
  }
}

// ------------------------------------------------------------ bridges, restricted, conveyors

function bridge(ctx: Ctx, z: number, vertical: boolean): void {
  ctx.save();
  if (vertical) ctx.rotate(Math.PI / 2);
  // Walkway runs along local x across the whole tile.
  if (z === 4) {
    roundRectPath(ctx, -32, -24, 64, 48, 0);
    litFill(ctx, PZ.steel, 0, 0, 30);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = alpha(PZ.steelDark, 0.8);
    ctx.lineWidth = 1.2;
    for (let i = -32; i <= 32; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, -24);
      ctx.lineTo(i + 12, 24);
      ctx.stroke();
    }
    ctx.restore();
    for (const y of [-24, 20]) {
      ctx.fillStyle = PZ.hazard;
      ctx.fillRect(-32, y, 64, 4);
      ctx.fillStyle = P.ink;
      for (let x = -32; x < 32; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x + 2, y + 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (z === 5) {
    roundRectPath(ctx, -32, -22, 64, 44, 0);
    litFill(ctx, PZ.basaltLight, 0, 0, 30);
    ctx.strokeStyle = alpha(P.ink, 0.5);
    ctx.lineWidth = 1.4;
    for (const x of [-32, 0]) {
      ctx.beginPath();
      ctx.moveTo(x + 0.7, -22);
      ctx.lineTo(x + 0.7, 22);
      ctx.stroke();
    }
    ctx.fillStyle = PZ.basaltDark;
    ctx.fillRect(-32, -24, 64, 4);
    ctx.fillRect(-32, 20, 64, 4);
  } else {
    const plank = z === 2 ? tone(P.wood, 0.15) : P.wood;
    for (let x = -32; x < 32; x += 8) {
      roundRectPath(ctx, x + 0.6, -21, 6.8, 42, 1.2);
      litFill(ctx, tone(plank, ((x / 8) % 2) * 0.06), x + 4, 0, 12, 0.25, 0.3);
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = alpha(P.woodDark, 0.9);
      ctx.stroke();
    }
    for (const y of [-24, 19]) {
      roundRectPath(ctx, -32, y, 64, 5, 0);
      litFill(ctx, P.woodDark, 0, y + 2.5, 30);
    }
    if (z === 3) {
      for (let x = -28; x < 32; x += 16) ball(ctx, x, -22, 6, 2.2, PZ.snow, { line: 0.8, hi: 0.1 });
    }
  }
  ctx.restore();
}

function restricted(ctx: Ctx, z: number): void {
  const rnd = seeded(900 + z);
  if (z === 1) {
    // A flower bed with a little white fence: keep off the grass.
    roundRectPath(ctx, -27, -27, 54, 54, 8);
    litFill(ctx, P.dirtDark, 0, 0, 28, 0.2, 0.25);
    ink(ctx, LINE_THIN + 0.4);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = -18 + c * 12 + (rnd() - 0.5) * 3;
        const y = -16 + r * 14 + (rnd() - 0.5) * 3;
        ball(ctx, x, y + 2, 4, 2.2, P.grassMid, { line: 0, hi: 0.2 });
        ball(ctx, x, y - 1, 2.6, 2.3, [P.flowerPink, P.flowerYellow, P.flowerWhite][(r + c) % 3]!, { line: 0.8, hi: 0.3 });
      }
    }
    ctx.strokeStyle = P.ink;
    ctx.fillStyle = P.cream;
    for (let x = -24; x <= 24; x += 8) {
      roundRectPath(ctx, x - 1.4, 18, 2.8, 10, 1);
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.fillRect(-25, 21, 50, 2);
    return;
  }
  if (z === 4) {
    // Rail track on a gravel bed: sleepers across, two rails along.
    ctx.fillStyle = PZ.concreteDark;
    ctx.fillRect(-32, -22, 64, 44);
    dabs(ctx, rnd, -32, -22, 64, 44, 26, PZ.steelDark, 1.6, 0.45);
    dabs(ctx, rnd, -32, -22, 64, 44, 18, PZ.concreteLight, 1.4, 0.45);
    for (let x = -26; x < 32; x += 13) {
      roundRectPath(ctx, x - 3.5, -19, 7, 38, 1);
      litFill(ctx, P.woodDark, x, 0, 8);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = P.ink;
      ctx.stroke();
    }
    for (const y of [-12, 10]) {
      ctx.fillStyle = P.ink;
      ctx.fillRect(-32, y - 1, 64, 5);
      ctx.fillStyle = PZ.steelLight;
      ctx.fillRect(-32, y, 64, 2.2);
    }
    return;
  }
  if (z === 5) {
    // Cooled lava crust with glowing cracks.
    roundRectPath(ctx, -28, -28, 56, 56, 10);
    litFill(ctx, PZ.basaltDark, 0, 0, 28, 0.25, 0.2);
    ctx.save();
    ctx.clip();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PZ.lavaDark;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      let x = -24 + rnd() * 48;
      let y = -24 + rnd() * 48;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (rnd() - 0.5) * 22;
        y += (rnd() - 0.5) * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = PZ.lavaCore;
    ctx.stroke();
    ctx.restore();
    return;
  }
  // z2 cordon rope on posts; z3 hazard-striped marker poles with bunting.
  const posts: [number, number][] = [
    [-24, -24],
    [24, -24],
    [24, 24],
    [-24, 24],
  ];
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = z === 2 ? P.stop : P.brass;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = posts[i]!;
    const [bx, by] = posts[(i + 1) % 4]!;
    ctx.moveTo(ax, ay - 10);
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 5, bx, by - 10);
  }
  ctx.stroke();
  if (z === 3) {
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = posts[i]!;
      const [bx, by] = posts[(i + 1) % 4]!;
      for (let t = 0.25; t < 1; t += 0.25) {
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t - 8;
        ctx.beginPath();
        ctx.moveTo(x - 2.5, y);
        ctx.lineTo(x + 2.5, y);
        ctx.lineTo(x, y + 4);
        ctx.closePath();
        ctx.fillStyle = [P.stop, P.brass, P.info][Math.round(t * 4) % 3]!;
        ctx.fill();
      }
    }
  }
  for (const [x, y] of posts) {
    roundRectPath(ctx, x - 2.2, y - 13, 4.4, 15, 1.5);
    if (z === 3) {
      ctx.fillStyle = PZ.hazard;
      ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.fillRect(x - 2.2, y - 10, 4.4, 2);
      ctx.fillRect(x - 2.2, y - 5, 4.4, 2);
      roundRectPath(ctx, x - 2.2, y - 13, 4.4, 15, 1.5);
    } else litFill(ctx, P.brass, x, y - 6, 4);
    ink(ctx, LINE_THIN);
  }
}

function conveyor(ctx: Ctx, dir: 'e' | 'w' | 'n' | 's', frame: number): void {
  ctx.save();
  ctx.rotate({ e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 }[dir]);
  // Belt running along local +x.
  ctx.fillStyle = PZ.belt;
  ctx.fillRect(-32, -32, 64, 64);
  ctx.strokeStyle = alpha(P.ink, 0.5);
  ctx.lineWidth = 1;
  for (let x = -32 + ((frame * 8) % 16); x < 32; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, -24);
    ctx.lineTo(x, 24);
    ctx.stroke();
  }
  // Chevrons every 32 units, advancing 8 units per frame (period 32 divides 64, so it tiles).
  ctx.save();
  ctx.beginPath();
  ctx.rect(-32, -22, 64, 44);
  ctx.clip();
  for (let x = -48 + frame * 8; x < 48; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x - 6, -12);
    ctx.lineTo(x + 6, 0);
    ctx.lineTo(x - 6, 12);
    ctx.lineTo(x - 11, 12);
    ctx.lineTo(x + 1, 0);
    ctx.lineTo(x - 11, -12);
    ctx.closePath();
    ctx.fillStyle = PZ.hazard;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
  }
  ctx.restore();
  // Side rails with roller bolts.
  for (const y of [-32, 24]) {
    roundRectPath(ctx, -32, y, 64, 8, 0);
    litFill(ctx, PZ.steel, 0, y + 4, 30);
    ctx.fillStyle = PZ.steelDark;
    for (let x = -24; x < 32; x += 16) {
      ellipsePath(ctx, x, y + 4, 1.6, 1.6);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------ dual-grid tiles

const TAU = Math.PI * 2;
const K = TAU / 64;

/** Noise periodic over one cell (64 art units) in x and y, roughly in [-1, 1]. */
function pnoise(x: number, y: number, seed: number): number {
  return 0.5 * Math.sin(K * x + seed + 1.3 * Math.sin(K * 2 * y + seed * 1.7)) + 0.5 * Math.sin(K * 2 * y + seed * 0.6 + 1.1 * Math.cos(K * x + seed));
}

function dualField(idx: number, x: number, y: number): { f: number; fx: number; fy: number } {
  const tl = idx & 1 ? 1 : 0;
  const tr = idx & 2 ? 1 : 0;
  const bl = idx & 4 ? 1 : 0;
  const br = idx & 8 ? 1 : 0;
  const u = (x + 32) / 64;
  const v = (y + 32) / 64;
  return {
    f: tl * (1 - u) * (1 - v) + tr * u * (1 - v) + bl * (1 - u) * v + br * u * v,
    fx: ((tr - tl) * (1 - v) + (br - bl) * v) / 64,
    fy: ((bl - tl) * (1 - u) + (br - tr) * u) / 64,
  };
}

interface Band {
  /** Field level above which this band paints. Bands must be in increasing order. */
  L: number;
  /** Colour at (x,y); `lit` > 0 where the edge faces the top-left light. */
  paint: (x: number, y: number, g: number, lit: number) => RGBA;
}

function dualTile(ctx: Ctx, idx: number, bands: Band[], wobble: number, seed: number): void {
  if (idx === 0) return;
  raster(ctx, -32, -32, 64, 64, (x, y, pw) => {
    const { f, fx, fy } = dualField(idx, x, y);
    const g = f + wobble * pnoise(x, y, seed);
    const gl = Math.hypot(fx, fy);
    const aa = Math.max(gl, 0.004) * pw;
    const lit = gl > 0 ? (fx + fy) / (gl * Math.SQRT2) : 0;
    let c: RGBA = [0, 0, 0, 0];
    for (const b of bands) {
      const cov = clamp01((g - b.L) / aa + 0.5);
      if (cov <= 0) break;
      c = over(c, b.paint(x, y, g, lit), cov);
    }
    return c;
  });
}

const solid =
  (c: RGBA): Band['paint'] =>
  () =>
    c;

/** Periodic ripple highlight: 0 or up to 1 along thin wavy lines. */
function ripple(x: number, y: number, seed: number): number {
  const v = Math.sin(K * 2 * (y + 5 * Math.sin(K * x + seed)) + seed) * Math.sin(K * (x + y) + seed * 2);
  return clamp01((v - 0.86) * 8);
}

function liquidBands(z: ZoneLook): { bands: Band[]; wobble: number } {
  const ink = rgb(P.ink, 0.85);
  const shore = rgb(z.shore);
  const shoreLit = rgb(tone(z.shore, 0.3));
  const shoreDark = rgb(tone(z.shore, -0.25));
  const bank: Band['paint'] = (_x, _y, _g, lit) => (lit > 0.2 ? shoreDark : lit < -0.2 ? shoreLit : shore);
  let edge: RGBA;
  let mid: RGBA;
  let deep: RGBA;
  let hi: RGBA;
  switch (z.liquid) {
    case 'oasis':
      [edge, mid, deep, hi] = [rgb(tone(PZ.oasis, 0.45)), rgb(PZ.oasis), rgb(PZ.oasisDeep), rgb(P.white, 0.8)];
      break;
    case 'icy':
      [edge, mid, deep, hi] = [rgb(PZ.ice), rgb(PZ.iceWater), rgb(PZ.iceWaterDeep), rgb(PZ.ice, 0.9)];
      break;
    case 'sludge':
      [edge, mid, deep, hi] = [rgb(PZ.sludgeLight), rgb(PZ.sludge), rgb(PZ.sludgeDark), rgb(PZ.sludgeLight, 0.9)];
      break;
    case 'lava':
      // Lava: orange body, yellow glow in the deep middle and along the ripples (no flat yellow lakes).
      [edge, mid, deep, hi] = [rgb(PZ.lavaDark), rgb(PZ.lava), lerpRGBA(rgb(PZ.lava), rgb(PZ.lavaCore), 0.35), rgb(PZ.lavaCore, 0.95)];
      break;
    default:
      [edge, mid, deep, hi] = [rgb(tone(P.water, 0.45)), rgb(P.water), rgb(P.waterDark), rgb(P.white, 0.75)];
  }
  const surface =
    (base: RGBA, seed: number): Band['paint'] =>
    (x, y) => {
      const r = ripple(x, y, seed);
      return r > 0 ? lerpRGBA(base, hi, r) : base;
    };
  return {
    wobble: 0.06,
    bands: [
      { L: 0.38, paint: solid(ink) },
      { L: 0.41, paint: bank },
      { L: 0.5, paint: solid(edge) },
      { L: 0.55, paint: surface(mid, 1.3) },
      { L: 0.82, paint: surface(deep, 2.1) },
    ],
  };
}

function iceBands(z: ZoneLook): { bands: Band[]; wobble: number } {
  const crack: Band['paint'] = (x, y) => {
    const v = Math.abs(Math.sin(K * (x * 1 + 9 * Math.sin(K * y * 2 + 0.4))));
    const w = Math.abs(Math.sin(K * (y * 1 - 7 * Math.sin(K * x + 1.1))));
    const c = Math.min(v, w);
    const base = rgb(PZ.ice);
    if (c < 0.05) return lerpRGBA(base, rgb(P.white), 0.85);
    const streak = clamp01((Math.sin(K * (x - y) * 2 + 0.7) - 0.75) * 4);
    return lerpRGBA(base, rgb(P.white, 1), streak * 0.6);
  };
  return {
    wobble: 0.05,
    bands: [
      { L: 0.41, paint: solid(rgb(P.ink, 0.45)) },
      { L: 0.44, paint: solid(rgb(z.rim)) },
      { L: 0.5, paint: crack },
      { L: 0.8, paint: (x, y, g, lit) => lerpRGBA(crack(x, y, g, lit), rgb(PZ.iceDark), 0.35) },
    ],
  };
}

function trenchBands(z: ZoneLook): { bands: Band[]; wobble: number } {
  const wall = rgb(z.trenchWall);
  const wallShadow = rgb(tone(z.trenchWall, -0.35));
  const wallLit = rgb(tone(z.trenchWall, 0.25));
  const floor = rgb(z.trenchFloor);
  return {
    wobble: 0.04,
    bands: [
      { L: 0.4, paint: solid(rgb(P.ink, 0.9)) },
      { L: 0.43, paint: solid(rgb(z.rim)) },
      // Inner walls: the top-left rim faces away from the light, so it is in shadow.
      { L: 0.47, paint: (_x, _y, _g, lit) => (lit > 0.15 ? wallShadow : lit < -0.15 ? wallLit : wall) },
      {
        L: 0.6,
        paint: (x, y) => {
          // Duckboard slats on the trench floor.
          const s = Math.sin(K * 4 * (x + y));
          return s > 0.6 ? lerpRGBA(floor, rgb(P.ink), 0.35) : floor;
        },
      },
    ],
  };
}

// ------------------------------------------------------------ catalogue

const ROCK_LOOK: Record<number, RockLook> = {
  3: { base: P.rock, dark: P.rockDark, snow: true },
};

export function terrainSprites(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  for (const z of ZONES) {
    const a = `terrain-z${z.n}`;
    const key = (s: string): string => `terrain.z${z.n}.${s}`;
    if (z.n === 1) {
      // Zone 1 (v1.1): one seamless meadow and loose decoration instead of cell tiles.
      out.push({ key: key('meadow'), atlas: a, w: MEADOW, h: MEADOW, ax: 0.5, ay: 0.5, extrude: true, draw: meadow });
      for (let k = 0; k < 4; k++) out.push({ key: key(`patch.${k}`), atlas: a, w: 3, h: 1.8, ax: 0.5, ay: 0.5, draw: (c) => drift(c, k) });
      for (let k = 0; k < 4; k++) out.push({ key: key(`tuft.${k}`), atlas: a, w: 0.7, h: 0.55, ax: 0.5, ay: 0.75, draw: (c) => tuft(c, k) });
      for (let k = 0; k < 2; k++) out.push({ key: key(`worn.${k}`), atlas: a, w: 1.2, h: 0.75, ax: 0.5, ay: 0.5, draw: (c) => worn(c, k) });
      // Extruded: the scene butts these end to end along the field's edge, so their ends mustn't fade.
      out.push({ key: key('edge'), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, extrude: true, draw: edgeShade });
      out.push({ key: key('edge.end'), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, extrude: true, draw: edgeShadeEnd });
      for (const side of ['n', 's', 'w', 'e'] as const) {
        const vertical = side === 'w' || side === 'e';
        out.push({ key: key(`fringe.${side}`), atlas: a, w: vertical ? 1.6 : 2, h: vertical ? 2 : 1.6, ax: 0.5, ay: 0.5, draw: (c) => fringe(c, side) });
      }
    } else {
      for (let k = 0; k < 6; k++) out.push({ key: key(`ground.${k}`), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, extrude: true, draw: (c) => groundTile(c, z, k) });
      for (let k = 0; k < 4; k++) out.push({ key: key(`patch.${k}`), atlas: a, w: 2, h: 1.3, ax: 0.5, ay: 0.5, draw: (c) => patch(c, k, z.patch, 200 + z.n * 10) });
    }
    for (let k = 0; k < 3; k++) {
      const draw = (c: Ctx): void => {
        c.scale(1.35, 1.35);
        if (z.n === 1) rockZ1(c, k);
        else if (z.n === 2) sandstone(c, k);
        else if (z.n === 4) scrapPile(c, k);
        else if (z.n === 5) basaltColumns(c, k);
        else rock(c, k, ROCK_LOOK[z.n], 330);
      };
      out.push({ key: key(`rock.${k}`), atlas: a, w: 1.2 * 1.35, h: (z.n === 5 ? 1.5 : 1.15) * 1.35, ax: 0.5, ay: z.n === 5 ? 0.78 : 0.72, draw });
    }
    for (let k = 0; k < 3; k++) {
      const draw = (c: Ctx): void => {
        if (z.n === 1) treeZ1(c, k);
        else if (z.n === 2) cactus(c, k);
        else if (z.n === 3) pine(c, k);
        else if (z.n === 4) chimney(c, k);
        else charredTree(c, k);
      };
      // Zone 1's trees are painted bigger (v1.1), in a box anchored at the foot of the trunk.
      if (z.n === 1) out.push({ key: key(`tree.${k}`), atlas: a, w: 2.3, h: 2.5, ax: 0.5, ay: 0.9, draw });
      else out.push({ key: key(`tree.${k}`), atlas: a, w: 1.8, h: z.n === 4 ? 2.7 : 2, ax: 0.5, ay: z.n === 4 ? 0.92 : 0.86, draw });
    }
    for (let k = 0; k < 2; k++) out.push({ key: key(`bush.${k}`), atlas: a, w: 0.9, h: z.n === 3 && k === 1 ? 0.9 : 0.7, ax: 0.5, ay: z.n === 3 && k === 1 ? 0.84 : 0.78, draw: (c) => (z.n === 1 ? bushZ1(c, k) : zoneBush(c, z.n, k)) });
    for (let k = 0; k < 3; k++) out.push({ key: key(`flowers.${k}`), atlas: a, w: 0.7, h: 0.5, ax: 0.5, ay: 0.6, draw: (c) => (z.n === 1 ? flowersZ1(c, k) : zoneDecal(c, z.n, k)) });
    out.push({
      key: key('sign.in'),
      atlas: a,
      w: 0.7 * 1.5,
      h: 0.85 * 1.5,
      ax: 0.5,
      ay: 0.92,
      draw: (c) => {
        c.scale(1.5, 1.5);
        if (z.n === 1) signZ1(c, false);
        else sign(c, false);
      },
    });
    out.push({
      key: key('sign.out'),
      atlas: a,
      w: 0.7 * 1.5,
      h: 0.85 * 1.5,
      ax: 0.5,
      ay: 0.92,
      draw: (c) => {
        c.scale(1.5, 1.5);
        if (z.n === 1) signZ1(c, true);
        else sign(c, true);
      },
    });
    const border = (c: Ctx): void => {
      if (z.n === 1) canopyBorder(c);
      else if (z.n === 2) duneBorder(c);
      else if (z.n === 3) blobBorder(c, 730, PZ.snowDark, PZ.snow, 24, 14, 12, 0.75);
      else if (z.n === 4) brickBorder(c);
      else
        blobBorder(c, 750, PZ.basaltDark, PZ.basalt, 24, 13, 12, 0.85, (x, y, r, rnd) => {
          if (rnd() < 0.25) {
            c.beginPath();
            c.moveTo(x - r * 0.4, y);
            c.lineTo(x + r * 0.2, y + r * 0.2);
            c.lineWidth = 1.6;
            c.strokeStyle = PZ.lava;
            c.stroke();
          }
        });
    };
    out.push({ key: key('border'), atlas: a, w: 2, h: 2, ax: 0.5, ay: 0.5, extrude: true, draw: border });
    for (let k = 0; k < 2; k++) {
      out.push({
        key: key(`blocker.${k}`),
        atlas: a,
        w: 1.1 * 1.25,
        h: 1.1 * 1.25,
        ax: 0.5,
        ay: 0.72,
        draw: (c) => {
          c.scale(1.25, 1.25);
          blocker(c, z.n, k);
        },
      });
    }
    out.push({
      key: key('tunnel'),
      atlas: a,
      w: 1.5,
      h: 1.4,
      ax: 0.5,
      ay: 0.72,
      draw: (c) => {
        c.scale(1.2, 1.2);
        tunnel(c, z.n);
      },
    });
    const liquid = liquidBands(z);
    const ice = iceBands(z);
    const trench = trenchBands(z);
    for (let i = 0; i < 16; i++) {
      out.push({ key: key(`water.${pad2(i)}`), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, draw: (c) => dualTile(c, i, liquid.bands, liquid.wobble, 0.7 + z.n) });
      out.push({ key: key(`ice.${pad2(i)}`), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, draw: (c) => dualTile(c, i, ice.bands, ice.wobble, 1.9 + z.n) });
      out.push({ key: key(`trench.${pad2(i)}`), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, draw: (c) => dualTile(c, i, trench.bands, trench.wobble, 3.1 + z.n) });
    }
    out.push({ key: key('bridge.h'), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, extrude: true, draw: (c) => bridge(c, z.n, false) });
    out.push({ key: key('bridge.v'), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, extrude: true, draw: (c) => bridge(c, z.n, true) });
    out.push({ key: key('restricted'), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, draw: (c) => restricted(c, z.n) });
    if (z.n === 1) out.push({ key: 'terrain.z1.hay', atlas: a, w: 0.8, h: 0.7, ax: 0.5, ay: 0.8, draw: hay });
    // Belts are Zone 4's hook, but any zone may use them (Zone 5's finale has every terrain type).
    {
      for (const d of ['e', 'w', 'n', 's'] as const) {
        for (let f = 0; f < 4; f++) out.push({ key: key(`conveyor.${d}.${f}`), atlas: a, w: 1, h: 1, ax: 0.5, ay: 0.5, extrude: true, draw: (c) => conveyor(c, d, f) });
      }
    }
  }
  return out;
}
