// The painted overworld of Umbershire (DESIGN.md §11). 32×18 cells, baked as a 4×2 grid
// of tiles 'map.world.<col>.<row>' (8×9 cells each, anchor top-left) so every tile fits a
// 2048 atlas page at @2x. Each map pixel takes the zone of its nearest level node, so the
// DOM's level medallions always sit in their own zone. No text and no medallions here.
import campaign from '../../data/campaign.json';
import { P } from './palette.ts';
import { PZ } from './palette-zones.ts';
import { LINE, LINE_THIN, alpha, ball, box, contact, ellipsePath, ink, litFill, roundRectPath, seeded, type Ctx } from './paint.ts';
import type { SpriteSpec } from './spec.ts';
import { clamp01, lerpRGBA, over, raster, rgb, type RGBA } from './terrain.ts';

export const MAP_COLS = 4;
export const MAP_ROWS = 2;
const TILE_W = 8 * 64;
const TILE_H = 9 * 64;
const W = MAP_COLS * TILE_W;
const H = MAP_ROWS * TILE_H;

interface Node {
  x: number;
  y: number;
  zone: number;
}

const NODES: Node[] = campaign.levels.map((l) => ({ x: l.x * W, y: l.y * H, zone: l.zone }));
const STORES = { x: 0.05 * W, y: 0.69 * H };

// ------------------------------------------------------------ smooth deterministic noise

function noise(x: number, y: number): number {
  return (
    0.5 * Math.sin(x * 0.011 + 1.3 + Math.sin(y * 0.007) * 1.5) +
    0.3 * Math.sin(y * 0.017 + x * 0.004 + 0.4) +
    0.2 * Math.sin((x + y) * 0.023 + Math.sin(x * 0.019) * 0.8)
  );
}

// ------------------------------------------------------------ land shape

function landSdf(x: number, y: number): number {
  const hx = W / 2 - 40;
  const hy = H / 2 - 30;
  const r = 140;
  const qx = Math.abs(x - W / 2) - hx + r;
  const qy = Math.abs(y - H / 2) - hy + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r - 30 * noise(x * 1.7, y * 1.7);
}

// ------------------------------------------------------------ zone distance field (coarse grid, bilinear)

const GS = 32;
const GW = Math.ceil(W / GS) + 1;
const GH = Math.ceil(H / GS) + 1;
let grid: Float32Array | null = null;

function zoneGrid(): Float32Array {
  if (grid) return grid;
  grid = new Float32Array(GW * GH * 5);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = gx * GS;
      const y = gy * GS;
      const d = [Infinity, Infinity, Infinity, Infinity, Infinity];
      for (const n of NODES) {
        const dd = Math.hypot(n.x - x, (n.y - y) * 1.1);
        if (dd < d[n.zone - 1]!) d[n.zone - 1] = dd;
      }
      // Pull the Stores' corner into the meadows.
      d[0] = Math.min(d[0]!, Math.hypot(STORES.x - x, STORES.y - y));
      for (let z = 0; z < 5; z++) grid[(gy * GW + gx) * 5 + z] = d[z]! + 26 * noise(x * 2.3 + z * 97, y * 2.3 - z * 41);
    }
  }
  return grid;
}

function zoneDistances(x: number, y: number, out: number[]): void {
  const g = zoneGrid();
  const fx = Math.min(GW - 1.001, Math.max(0, x / GS));
  const fy = Math.min(GH - 1.001, Math.max(0, y / GS));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  for (let z = 0; z < 5; z++) {
    const a = g[(y0 * GW + x0) * 5 + z]!;
    const b = g[(y0 * GW + x0 + 1) * 5 + z]!;
    const c = g[((y0 + 1) * GW + x0) * 5 + z]!;
    const d = g[((y0 + 1) * GW + x0 + 1) * 5 + z]!;
    out[z] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
}

// ------------------------------------------------------------ zone ground colours

const C = {
  grass: rgb(P.grass),
  grassLight: rgb(P.grassLight),
  grassMid: rgb(P.grassMid),
  field: rgb(PZ.field),
  gold: rgb(PZ.fieldGold),
  hedge: rgb(P.hedge),
  sand: rgb(PZ.sand),
  sandMid: rgb(PZ.sandMid),
  sandDark: rgb(PZ.sandDark),
  snow: rgb(PZ.snow),
  snowMid: rgb(PZ.snowMid),
  snowDark: rgb(PZ.snowDark),
  concrete: rgb(PZ.concrete),
  concreteDark: rgb(PZ.concreteDark),
  brick: rgb(PZ.brick),
  steelDark: rgb(PZ.steelDark),
  ash: rgb(PZ.ash),
  basalt: rgb(PZ.basalt),
  basaltLight: rgb(PZ.basaltLight),
  lava: rgb(PZ.lava),
  lavaCore: rgb(PZ.lavaCore),
  sea: rgb(PZ.sea),
  seaDeep: rgb(PZ.seaDeep),
  seaLight: rgb(PZ.seaLight),
  beach: rgb(PZ.beach),
  foam: rgb(P.white, 0.9),
  ink: rgb(P.ink, 0.85),
};

function hash2(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function zoneColour(z: number, x: number, y: number): RGBA {
  switch (z) {
    case 0: {
      // Patchwork fields with hedgerows (rotated grid, wobbly edges).
      const a = 0.35;
      const u = (x * Math.cos(a) - y * Math.sin(a) + 12 * noise(x * 3, y * 3)) / 96;
      const v = (x * Math.sin(a) + y * Math.cos(a) + 12 * noise(y * 3, x * 3)) / 78;
      const i = Math.floor(u);
      const j = Math.floor(v);
      const edge = Math.min(u - i, 1 - (u - i), v - j, 1 - (v - j));
      const pick = [C.grass, C.grassLight, C.field, C.gold, C.grassMid][Math.floor(hash2(i, j) * 5)]!;
      const streak = 0.04 * Math.sin((u - i) * 40);
      const base = lerpRGBA(pick, C.hedge, clamp01(streak));
      return edge < 0.035 ? lerpRGBA(base, C.hedge, clamp01((0.035 - edge) / 0.012)) : base;
    }
    case 1: {
      const v = Math.sin(x * 0.045 + Math.sin(y * 0.021) * 3 + noise(x, y));
      const base = v > 0.55 ? lerpRGBA(C.sand, C.sandMid, (v - 0.55) * 2) : C.sand;
      return lerpRGBA(base, C.sandDark, clamp01(noise(x * 2.1, y * 2.1) - 0.55));
    }
    case 2: {
      const s = noise(x * 1.6, y * 1.6);
      return lerpRGBA(C.snow, s > 0 ? C.snowMid : C.snow, Math.abs(s) * 0.8);
    }
    case 3: {
      // Works yards: concrete lots separated by narrow lanes, the odd rust-roofed shed.
      const wx = x + 14 * noise(y * 1.3, x * 1.3);
      const wy = y + 14 * noise(x * 1.3, y * 1.3);
      const bx = ((wx % 72) + 72) % 72 / 72;
      const by = ((wy % 58) + 58) % 58 / 58;
      const lane = Math.min(bx, 1 - bx, by, 1 - by);
      const block = hash2(Math.floor(wx / 72), Math.floor(wy / 58));
      let base = lerpRGBA(C.concrete, C.concreteDark, block * 0.35);
      if (block < 0.1 && lane > 0.18) base = lerpRGBA(C.brick, C.concrete, 0.45);
      return lane < 0.035 ? lerpRGBA(base, C.steelDark, 0.4) : base;
    }
    default: {
      const n = noise(x * 2.2, y * 2.2);
      const base = lerpRGBA(C.ash, C.basalt, clamp01(0.4 + n * 0.6));
      // Sparse, irregular glowing fissures.
      const crack = Math.abs(Math.sin(x * 0.021 + 2.6 * Math.sin(y * 0.013 + x * 0.004) + noise(x * 0.8, y * 0.8)));
      // A second noise gates them on and off; they thin to nothing over its 0.25–0.45 band instead of stopping dead.
      const on = clamp01((noise(x * 0.9 + 500, y * 0.9 - 300) - 0.25) / 0.2);
      return crack < 0.018 * on ? lerpRGBA(C.lava, C.lavaCore, 0.3) : crack < 0.04 * on ? lerpRGBA(base, C.lava, 0.4) : base;
    }
  }
}

const dz = [0, 0, 0, 0, 0];

function shadeMap(x: number, y: number, pw: number): RGBA {
  const d = landSdf(x, y);
  const aa = pw * 1.2;
  // Sea
  const depth = clamp01(d / 110);
  let sea = lerpRGBA(C.seaLight, depth < 0.5 ? C.sea : C.seaDeep, depth < 0.5 ? depth * 2 : (depth - 0.5) * 2);
  const wave = Math.sin(x * 0.07 + Math.sin(y * 0.05) * 2.5) * Math.sin(y * 0.13 + x * 0.01);
  if (wave > 0.9 && d > 14) sea = lerpRGBA(sea, C.seaLight, (wave - 0.9) * 8);
  if (d > 0 && d < 9) sea = lerpRGBA(sea, C.foam, 1 - d / 9);
  if (d > 1.5 + aa) return sea;
  // Land
  zoneDistances(x, y, dz);
  let a = 0;
  let b = 1;
  if (dz[b]! < dz[a]!) [a, b] = [b, a];
  for (let z = 2; z < 5; z++) {
    if (dz[z]! < dz[a]!) {
      b = a;
      a = z;
    } else if (dz[z]! < dz[b]!) b = z;
  }
  const margin = dz[b]! - dz[a]!;
  let land = zoneColour(a, x, y);
  if (margin < 6) land = lerpRGBA(land, zoneColour(b, x, y), 0.5 * (1 - margin / 6));
  // A faint painted line where two regions meet.
  if (margin < 2.2) land = lerpRGBA(land, C.ink, 0.28 * (1 - margin / 2.2));
  // Large-scale painted light: gentle brightening towards the top-left of each rise.
  const hill = noise(x * 0.6 + 300, y * 0.6 - 200);
  land = lerpRGBA(land, hill > 0 ? rgb(P.flowerWhite) : rgb(P.ink), Math.abs(hill) * 0.06);
  // Beach (snow in the north-west, ash in the volcanic east).
  if (d > -26) {
    const shore = a === 2 ? C.snow : a === 4 ? C.basaltLight : C.beach;
    land = lerpRGBA(land, shore, clamp01((d + 26) / 6));
  }
  let c: RGBA = over(sea, land, clamp01((-d + 0.5 * aa) / aa + 0.5));
  // Ink coastline
  const line = 1 - clamp01((Math.abs(d) - 1.1) / aa);
  if (line > 0) c = over(c, C.ink, line);
  return c;
}

// ------------------------------------------------------------ props

function windmill(ctx: Ctx, x: number, y: number): void {
  contact(ctx, x + 4, y + 2, 26, 8, 0.35);
  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x - 10, y - 50);
  ctx.lineTo(x + 10, y - 50);
  ctx.lineTo(x + 16, y);
  ctx.closePath();
  litFill(ctx, P.cream, x, y - 25, 16);
  ink(ctx, LINE);
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 50);
  ctx.quadraticCurveTo(x, y - 66, x + 13, y - 50);
  ctx.closePath();
  litFill(ctx, PZ.roof, x, y - 56, 12);
  ink(ctx, LINE);
  roundRectPath(ctx, x - 4, y - 14, 8, 14, 3);
  ctx.fillStyle = P.woodDark;
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const a = 0.4 + (i * Math.PI) / 2;
    ctx.save();
    ctx.translate(x, y - 50);
    ctx.rotate(a);
    roundRectPath(ctx, 2, -4, 38, 8, 2);
    litFill(ctx, P.wood, 20, 0, 18);
    ink(ctx, LINE_THIN + 0.4);
    ctx.restore();
  }
  ball(ctx, x, y - 50, 4, 4, P.brass, { line: LINE_THIN });
}

function sheep(ctx: Ctx, x: number, y: number): void {
  contact(ctx, x + 1, y + 1, 9, 3, 0.3);
  ball(ctx, x, y - 5, 8, 6, P.flowerWhite, { hi: 0.15 });
  ball(ctx, x + 7, y - 6, 3.4, 3, P.ink, { line: 0.8, hi: 0.3 });
}

function oak(ctx: Ctx, x: number, y: number, s: number, seed: number): void {
  const rnd = seeded(seed);
  contact(ctx, x + 3, y + 2, 16 * s, 6 * s, 0.35);
  roundRectPath(ctx, x - 3 * s, y - 14 * s, 6 * s, 15 * s, 2);
  litFill(ctx, P.bark, x, y - 7 * s, 4);
  ink(ctx, LINE_THIN + 0.4);
  const blobs = Array.from({ length: 4 }, () => ({ x: x + (rnd() - 0.5) * 20 * s, y: y - 24 * s + (rnd() - 0.5) * 14 * s, r: (9 + rnd() * 4) * s })).sort((a, b) => a.y - b.y);
  for (const b of blobs) ball(ctx, b.x, b.y, b.r, b.r * 0.9, P.hedge, { line: LINE_THIN + 0.3, hi: 0.35 });
}

function stores(ctx: Ctx, x: number, y: number): void {
  // The Crown Biscuit Stores: a giant biscuit tin on a stone plinth, bunting flying.
  contact(ctx, x + 6, y + 4, 64, 16, 0.4);
  box(ctx, x - 58, y - 16, 116, 20, 4, P.rock);
  ctx.beginPath();
  ctx.ellipse(x, y - 16, 48, 14, 0, 0, Math.PI);
  ctx.lineTo(x - 48, y - 70);
  ctx.ellipse(x, y - 70, 48, 14, 0, Math.PI, 0, true);
  ctx.closePath();
  litFill(ctx, P.stop, x, y - 43, 48);
  ink(ctx, LINE);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = P.brass;
  ctx.fillRect(x - 50, y - 54, 100, 6);
  ctx.fillRect(x - 50, y - 30, 100, 4);
  ctx.restore();
  ellipsePath(ctx, x, y - 70, 50, 15);
  litFill(ctx, P.stopLight, x, y - 72, 44);
  ink(ctx, LINE);
  // A biscuit the size of a door.
  ball(ctx, x, y - 36, 14, 12, P.hay, { line: LINE });
  ctx.fillStyle = P.hayDark;
  for (const [dx, dy] of [
    [-5, -3],
    [4, 2],
    [0, -7],
    [6, -5],
  ]) {
    ellipsePath(ctx, x + dx!, y - 36 + dy!, 1.6, 1.6);
    ctx.fill();
  }
  // Flagpole with a pennant.
  ctx.beginPath();
  ctx.moveTo(x, y - 84);
  ctx.lineTo(x, y - 124);
  ink(ctx, 3.4);
  ctx.beginPath();
  ctx.moveTo(x, y - 124);
  ctx.lineTo(x + 24, y - 118);
  ctx.lineTo(x, y - 110);
  ctx.closePath();
  litFill(ctx, P.brass, x + 8, y - 117, 10);
  ink(ctx, LINE_THIN);
}

function mesa(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  contact(ctx, x + 6, y + 2, w * 0.6, 8, 0.35);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2 + 10, y - h);
  ctx.lineTo(x + w / 2 - 10, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  litFill(ctx, PZ.mesa, x, y - h / 2, w * 0.5);
  ink(ctx, LINE);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = alpha(PZ.mesaDark, 0.6);
  ctx.lineWidth = 1.6;
  for (let s = y - h + 8; s < y; s += 8) {
    ctx.beginPath();
    ctx.moveTo(x - w, s);
    ctx.lineTo(x + w, s + 2);
    ctx.stroke();
  }
  ctx.restore();
  ellipsePath(ctx, x, y - h, w / 2 - 10, 6);
  litFill(ctx, PZ.mesaLight, x, y - h, w / 2);
  ink(ctx, LINE_THIN + 0.4);
}

function miniCactus(ctx: Ctx, x: number, y: number): void {
  contact(ctx, x + 2, y + 1, 7, 3, 0.3);
  roundRectPath(ctx, x - 3.5, y - 22, 7, 22, 3.5);
  litFill(ctx, PZ.cactus, x, y - 11, 5);
  ink(ctx, LINE_THIN + 0.3);
  roundRectPath(ctx, x + 3, y - 16, 5, 9, 2.5);
  litFill(ctx, PZ.cactus, x + 5, y - 12, 4);
  ink(ctx, LINE_THIN);
  ellipsePath(ctx, x, y - 23, 2, 2);
  ctx.fillStyle = P.flowerPink;
  ctx.fill();
}

function palm(ctx: Ctx, x: number, y: number, lean: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.4, y - 20, x + lean, y - 38);
  ink(ctx, 6.5);
  ink(ctx, 4, P.bark);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.7;
    ctx.beginPath();
    ctx.moveTo(x + lean, y - 38);
    ctx.quadraticCurveTo(x + lean + Math.cos(a) * 14, y - 38 + Math.sin(a) * 14 - 4, x + lean + Math.cos(a) * 22, y - 38 + Math.sin(a) * 10 + 6);
    ink(ctx, 5.5);
    ink(ctx, 3.2, PZ.cactus);
  }
}

function mountain(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w * 0.08, y - h);
  ctx.lineTo(x + w * 0.06, y - h * 0.92);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  litFill(ctx, PZ.snowDark, x, y - h / 2, w * 0.45, 0.35, 0.45);
  ink(ctx, LINE);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.08 - w * 0.17, y - h * 0.6);
  ctx.lineTo(x - w * 0.08, y - h);
  ctx.lineTo(x + w * 0.06, y - h * 0.92);
  ctx.lineTo(x + w * 0.2, y - h * 0.58);
  ctx.quadraticCurveTo(x + w * 0.05, y - h * 0.66, x - w * 0.02, y - h * 0.55);
  ctx.quadraticCurveTo(x - w * 0.12, y - h * 0.64, x - w * 0.25, y - h * 0.6);
  ctx.closePath();
  litFill(ctx, PZ.snow, x, y - h * 0.8, w * 0.2, 0.2, 0.2);
  ink(ctx, LINE_THIN + 0.4);
}

function pineTree(ctx: Ctx, x: number, y: number, s: number): void {
  contact(ctx, x + 2, y + 1, 8 * s, 3 * s, 0.3);
  for (const [dy, w, h] of [
    [0, 11, 14],
    [-9, 8, 12],
    [-17, 5.5, 10],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x - w * s, y + dy * s);
    ctx.lineTo(x + w * s, y + dy * s);
    ctx.lineTo(x, y + (dy - h) * s);
    ctx.closePath();
    litFill(ctx, PZ.pine, x, y + (dy - h / 2) * s, w * s);
    ink(ctx, LINE_THIN + 0.3);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45 * s, y + (dy - h * 0.5) * s);
    ctx.lineTo(x + w * 0.45 * s, y + (dy - h * 0.5) * s);
    ctx.lineTo(x, y + (dy - h) * s);
    ctx.closePath();
    ctx.fillStyle = PZ.snow;
    ctx.fill();
  }
}

function snowman(ctx: Ctx, x: number, y: number): void {
  contact(ctx, x + 2, y + 1, 8, 3, 0.3);
  ball(ctx, x, y - 6, 7, 6.5, PZ.snow, { line: LINE_THIN + 0.3, hi: 0.15 });
  ball(ctx, x, y - 16, 5, 4.8, PZ.snow, { line: LINE_THIN + 0.3, hi: 0.15 });
  ctx.fillStyle = PZ.carrot;
  ctx.beginPath();
  ctx.moveTo(x, y - 16.5);
  ctx.lineTo(x + 6, y - 16);
  ctx.lineTo(x, y - 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.stop;
  ctx.fillRect(x - 4, y - 12.5, 8, 2);
}

function frozenLake(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ellipsePath(ctx, x, y, rx, ry);
  litFill(ctx, PZ.ice, x, y, rx, 0.4, 0.2);
  ink(ctx, LINE);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = alpha(P.white, 0.9);
  ctx.lineWidth = 2;
  for (const [a, b, c, d] of [
    [-0.6, -0.2, 0.1, 0.3],
    [0.2, -0.5, 0.6, 0.1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + a * rx, y + b * ry);
    ctx.lineTo(x + c * rx, y + d * ry);
    ctx.stroke();
  }
  ctx.restore();
}

function factory(ctx: Ctx, x: number, y: number, seed: number): void {
  const rnd = seeded(seed);
  contact(ctx, x + 6, y + 3, 44, 10, 0.4);
  // Saw-tooth roofed shed.
  box(ctx, x - 38, y - 26, 76, 28, 3, PZ.brick);
  ctx.beginPath();
  ctx.moveTo(x - 38, y - 26);
  for (let i = 0; i < 4; i++) {
    ctx.lineTo(x - 38 + i * 19 + 12, y - 40);
    ctx.lineTo(x - 38 + i * 19 + 19, y - 26);
  }
  ctx.closePath();
  litFill(ctx, PZ.steel, x, y - 33, 38);
  ink(ctx, LINE);
  ctx.fillStyle = PZ.hazard;
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 32 + i * 18, y - 18, 8, 7);
  // Chimney with smoke.
  roundRectPath(ctx, x + 22, y - 76, 11, 52, 2);
  litFill(ctx, PZ.brickLight, x + 27, y - 50, 7);
  ink(ctx, LINE);
  ctx.fillStyle = P.white;
  ctx.fillRect(x + 22, y - 66, 11, 3);
  for (let i = 0; i < 4; i++) ball(ctx, x + 30 + i * 9 + rnd() * 4, y - 84 - i * 11, 7 + i * 2.5, 6 + i * 2.2, P.smokeLight, { line: LINE_THIN, hi: 0.25 });
}

function gear(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.22;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
  }
  ctx.closePath();
  litFill(ctx, PZ.steel, x, y, r);
  ink(ctx, LINE);
  ellipsePath(ctx, x, y, r * 0.35, r * 0.28);
  ctx.fillStyle = PZ.steelDark;
  ctx.fill();
  ink(ctx, LINE_THIN);
}

/**
 * Mount Kerblam, standing in the land (§11): concave flanks, a base that curves round the front and
 * fades into the ground instead of an inked edge, a contact shadow down-right, and one lava flow from
 * the crater down the face and on across the land to the sea (`flow`, in map units after the crater).
 */
function volcano(ctx: Ctx, x: number, y: number, flow: [number, number][]): void {
  const w = 300;
  const h = 215;
  const rim = 38;
  const baseRy = 22;
  const rnd = seeded(9001);
  contact(ctx, x + 26, y + 10, w * 0.62, 34, 0.4);
  // The cone goes into a layer of its own, so its foot can fade into the ground. Needs the canvas's
  // size and transform (as `outlined` in enemies.ts); the tile's clip still applies when it's drawn back.
  const layer = document.createElement('canvas');
  layer.width = ctx.canvas.width;
  layer.height = ctx.canvas.height;
  const lc = layer.getContext('2d')!;
  lc.setTransform(ctx.getTransform());
  const flank = (c: Ctx): void => {
    c.moveTo(x - w / 2, y);
    c.quadraticCurveTo(x - w * 0.27, y - h * 0.28, x - rim, y - h);
    c.lineTo(x + rim, y - h);
    c.quadraticCurveTo(x + w * 0.27, y - h * 0.28, x + w / 2, y);
  };
  lc.beginPath();
  flank(lc);
  lc.ellipse(x, y, w / 2, baseRy, 0, 0, Math.PI);
  lc.closePath();
  litFill(lc, PZ.basalt, x, y - h / 2, w * 0.45, 0.35, 0.5);
  // Ink on the flanks only: the base has no outline.
  lc.beginPath();
  flank(lc);
  ink(lc, LINE + 1);
  // Two short tongues down the face; the main flow is drawn over everything below.
  for (const [dx, len, bend] of [
    [-18, 0.62, -34],
    [2, 0.45, 12],
  ] as const) {
    lc.beginPath();
    lc.moveTo(x + dx, y - h + 4);
    lc.quadraticCurveTo(x + dx + bend * 0.5, y - h * (1 - len * 0.5), x + dx + bend, y - h * (1 - len));
    ink(lc, 13);
    ink(lc, 9, PZ.lava);
    ink(lc, 3.5, PZ.lavaCore);
  }
  const fade = lc.createLinearGradient(0, y - 18, 0, y + baseRy);
  fade.addColorStop(0, alpha(P.ink, 1));
  fade.addColorStop(1, alpha(P.ink, 0));
  lc.globalCompositeOperation = 'destination-in';
  lc.fillStyle = fade;
  lc.fillRect(x - w, y - h - 20, w * 2, h + baseRy + 40);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  // The main flow: from the crater lip, down the face and away to the coast, in one line.
  lavaRiver(ctx, [[x + 12, y - h + 4], ...flow]);
  // Crater
  ellipsePath(ctx, x, y - h, rim + 2, 11);
  ctx.fillStyle = PZ.lavaDark;
  ctx.fill();
  ink(ctx, LINE);
  ellipsePath(ctx, x, y - h - 1, rim - 12, 6);
  ctx.fillStyle = PZ.lavaCore;
  ctx.fill();
  // Smoke plume drifting east, low enough to stay on the map.
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    ball(ctx, x + t * 140 + (rnd() - 0.5) * 16, y - h - 26 - t * 52 - (rnd() - 0.5) * 12, 18 + t * 22, 15 + t * 18, i % 2 ? P.smoke : P.smokeLight, { line: LINE_THIN + 0.4, hi: 0.25 });
  }
}

function lavaRiver(ctx: Ctx, pts: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[i + 1]!;
    ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
  }
  const last = pts[pts.length - 1]!;
  ctx.lineTo(last[0], last[1]);
  ink(ctx, 17);
  ink(ctx, 12.5, PZ.lavaDark);
  ink(ctx, 8.5, PZ.lava);
  ink(ctx, 3.5, PZ.lavaCore);
}

function spire(ctx: Ctx, x: number, y: number, h: number): void {
  contact(ctx, x + 3, y + 1, 10, 4, 0.35);
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x - 3, y - h);
  ctx.lineTo(x + 2, y - h * 0.8);
  ctx.lineTo(x + 9, y);
  ctx.closePath();
  litFill(ctx, PZ.basalt, x, y - h / 2, 9);
  ink(ctx, LINE_THIN + 0.4);
}

function cloud(ctx: Ctx, x: number, y: number, s: number, seed: number): void {
  const rnd = seeded(seed);
  ctx.save();
  ctx.globalAlpha = 0.92;
  const puffs = Array.from({ length: 6 }, () => ({ x: x + (rnd() - 0.5) * 120 * s, y: y + (rnd() - 0.5) * 30 * s, r: (26 + rnd() * 22) * s })).sort((a, b) => a.y - b.y);
  for (const p of puffs) ball(ctx, p.x, p.y, p.r, p.r * 0.72, PZ.cloud, { line: LINE_THIN + 0.4, hi: 0.1, lo: 0.12 });
  ctx.restore();
}

function road(ctx: Ctx): void {
  const pts: { x: number; y: number }[] = [STORES, ...NODES];
  // Catmull-Rom through every node, in campaign order.
  const at = (i: number): { x: number; y: number } => pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 17;
  ctx.strokeStyle = alpha(P.ink, 0.75);
  ctx.stroke();
  ctx.lineWidth = 12;
  ctx.strokeStyle = PZ.road;
  ctx.stroke();
  ctx.setLineDash([0.1, 14]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = P.woodDark;
  ctx.stroke();
  ctx.setLineDash([]);
}

function props(ctx: Ctx): void {
  const X = (f: number): number => f * W;
  const Y = (f: number): number => f * H;
  // Zone 3 mountains along the north-west, drawn first (they sit behind everything).
  for (const [x, y, w, h] of [
    [0.05, 0.18, 150, 110],
    [0.12, 0.16, 190, 150],
    [0.2, 0.17, 150, 110],
    [0.27, 0.15, 170, 130],
  ] as const) {
    mountain(ctx, X(x), Y(y), w, h);
  }
  frozenLake(ctx, X(0.14), Y(0.345), 46, 22);
  for (const [x, y, s] of [
    [0.04, 0.5, 1.4],
    [0.06, 0.53, 1.1],
    [0.19, 0.335, 1.2],
    [0.27, 0.33, 1.3],
    [0.3, 0.38, 1],
    [0.03, 0.3, 1.2],
    [0.35, 0.4, 1.1],
  ] as const) {
    pineTree(ctx, X(x), Y(y), s);
  }
  snowman(ctx, X(0.05), Y(0.235));
  snowman(ctx, X(0.34), Y(0.33));
  // Zone 4 works
  factory(ctx, X(0.44), Y(0.08), 11);
  factory(ctx, X(0.6), Y(0.1), 12);
  factory(ctx, X(0.395), Y(0.33), 13);
  gear(ctx, X(0.52), Y(0.07), 20);
  gear(ctx, X(0.69), Y(0.34), 16);
  // Zone 5
  // Wholly on land: the east coast is at X(0.971) beside its foot, and the smoke stays below the map's top.
  volcano(ctx, X(0.886), Y(0.304), [
    [X(0.903), Y(0.217)],
    [X(0.93), Y(0.319)],
    [X(0.956), Y(0.391)],
    [X(0.972), Y(0.46)],
    [X(0.983), Y(0.51)],
  ]);
  for (const [x, y, h] of [
    [0.75, 0.55, 40],
    [0.94, 0.8, 34],
    [0.72, 0.62, 28],
    [0.97, 0.66, 30],
  ] as const) {
    spire(ctx, X(x), Y(y), h);
  }
  // Zone 2 desert
  mesa(ctx, X(0.46), Y(0.95), 90, 34);
  mesa(ctx, X(0.645), Y(0.9), 110, 42);
  mesa(ctx, X(0.63), Y(0.64), 80, 30);
  ellipsePath(ctx, X(0.47), Y(0.71), 36, 16);
  litFill(ctx, PZ.oasis, X(0.47), Y(0.71), 36, 0.35, 0.3);
  ink(ctx, LINE);
  palm(ctx, X(0.455), Y(0.705), -8);
  palm(ctx, X(0.49), Y(0.715), 9);
  for (const [x, y] of [
    [0.45, 0.78],
    [0.58, 0.93],
    [0.52, 0.92],
    [0.61, 0.73],
    [0.4, 0.66],
    [0.55, 0.6],
  ] as const) {
    miniCactus(ctx, X(x), Y(y));
  }
  // Zone 1 meadows
  for (const [x, y, s, seed] of [
    [0.13, 0.62, 1.4, 1],
    [0.08, 0.64, 1.1, 2],
    [0.3, 0.6, 1.2, 3],
    [0.02, 0.62, 1.3, 4],
    [0.26, 0.94, 1.2, 5],
    [0.34, 0.9, 1.1, 6],
  ] as const) {
    oak(ctx, X(x), Y(y), s, seed);
  }
  windmill(ctx, X(0.285), Y(0.905));
  for (const [x, y] of [
    [0.12, 0.925],
    [0.145, 0.915],
    [0.225, 0.935],
    [0.2, 0.6],
  ] as const) {
    sheep(ctx, X(x), Y(y));
  }
  stores(ctx, STORES.x, STORES.y - 26);
}

function clouds(ctx: Ctx): void {
  for (const [x, y, s, seed] of [
    [0.02, 0.07, 1.2, 31],
    [0.985, 0.06, 1.3, 32],
    [0.985, 0.96, 1.1, 33],
    [0.72, 0.985, 1, 34],
    [0.01, 0.97, 1, 35],
    [0.33, 0.015, 0.9, 36],
  ] as const) {
    cloud(ctx, x * W, y * H, s, seed);
  }
}

function drawTile(ctx: Ctx, col: number, row: number): void {
  const x0 = col * TILE_W;
  const y0 = row * TILE_H;
  ctx.translate(-x0, -y0);
  // Every tile draws all the props; clip so a tile only ever shows its own window.
  ctx.beginPath();
  ctx.rect(x0, y0, TILE_W, TILE_H);
  ctx.clip();
  raster(ctx, x0, y0, TILE_W, TILE_H, shadeMap);
  props(ctx);
  road(ctx);
  clouds(ctx);
}

export function worldmapSprites(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      out.push({ key: `map.world.${col}.${row}`, atlas: 'map', w: 8, h: 9, ax: 0, ay: 0, extrude: true, scales: [1], draw: (c) => drawTile(c, col, row) });
    }
  }
  return out;
}
