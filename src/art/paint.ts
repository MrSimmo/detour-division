// Painting toolkit for the code art (DESIGN.md §16.1). Drawing happens in "art
// units" (64 per cell) with the origin at the sprite's anchor.
//
// Lighting is fixed in screen space at the top-left even when a part is rotated or
// mirrored: `lightDir` maps the screen light direction into the current local
// transform, and every shaded primitive places its highlight along it. That is what
// lets a turret be baked at 16 facings without its lighting turning with it (ADR-0006).
import { P } from './palette.ts';

export type Ctx = CanvasRenderingContext2D;

/** Outline width in art units. */
export const LINE = 2.4;
export const LINE_THIN = 1.4;

// ------------------------------------------------------------ colour maths

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fmt(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two palette colours. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return fmt(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Lighten (amt > 0, towards a warm white) or darken (amt < 0, towards ink). */
export function tone(c: string, amt: number): string {
  return amt >= 0 ? mix(c, P.flowerWhite, amt) : mix(c, P.ink, -amt);
}

export function alpha(c: string, a: number): string {
  const [r, g, b] = parse(c);
  return `rgba(${r},${g},${b},${a})`;
}

// ------------------------------------------------------------ light

/** Unit vector, in the current local space, pointing towards the screen-space top-left light. */
export function lightDir(ctx: Ctx): { x: number; y: number } {
  const inv = ctx.getTransform().inverse();
  const x = -inv.a - inv.c;
  const y = -inv.b - inv.d;
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

// ------------------------------------------------------------ deterministic noise for textures

export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------ primitives

export function ink(ctx: Ctx, width = LINE, colour: string = P.ink): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** A painted, lit volume: radial highlight towards the light, darker away from it. */
export function ball(ctx: Ctx, x: number, y: number, rx: number, ry: number, base: string, opts: { line?: number; hi?: number; lo?: number } = {}): void {
  const L = lightDir(ctx);
  const r = Math.max(rx, ry);
  const g = ctx.createRadialGradient(x + L.x * rx * 0.5, y + L.y * ry * 0.5, r * 0.05, x - L.x * rx * 0.15, y - L.y * ry * 0.15, r * 1.25);
  g.addColorStop(0, tone(base, opts.hi ?? 0.45));
  g.addColorStop(0.45, base);
  g.addColorStop(1, tone(base, -(opts.lo ?? 0.35)));
  ellipsePath(ctx, x, y, rx, ry);
  ctx.fillStyle = g;
  ctx.fill();
  if (opts.line !== 0) ink(ctx, opts.line ?? LINE);
}

/** Fills the current path with a linear light→dark gradient across `extent` art units. */
export function litFill(ctx: Ctx, base: string, cx: number, cy: number, extent: number, hi = 0.35, lo = 0.35): void {
  const L = lightDir(ctx);
  const g = ctx.createLinearGradient(cx + L.x * extent, cy + L.y * extent, cx - L.x * extent, cy - L.y * extent);
  g.addColorStop(0, tone(base, hi));
  g.addColorStop(0.5, base);
  g.addColorStop(1, tone(base, -lo));
  ctx.fillStyle = g;
  ctx.fill();
}

/** A lit rounded box in local space (rotates with the context; light stays top-left). */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, base: string, line = LINE): void {
  roundRectPath(ctx, x, y, w, h, r);
  litFill(ctx, base, x + w / 2, y + h / 2, Math.max(w, h) * 0.6);
  if (line > 0) ink(ctx, line);
}

/**
 * Three-quarter-view cylinder standing on the ground: a front face of height `h`
 * under an elliptical top. (x,y) is the centre of the base on the ground.
 */
export function cylinder(ctx: Ctx, x: number, y: number, rx: number, ry: number, h: number, top: string, side: string, line = LINE): void {
  // Front face
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(x - rx, y - h);
  ctx.ellipse(x, y - h, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, tone(side, 0.25));
  g.addColorStop(0.45, side);
  g.addColorStop(1, tone(side, -0.4));
  ctx.fillStyle = g;
  ctx.fill();
  if (line > 0) ink(ctx, line);
  // Top
  ellipsePath(ctx, x, y - h, rx, ry);
  litFill(ctx, top, x, y - h, rx, 0.3, 0.2);
  if (line > 0) ink(ctx, line);
}

/** Soft oval contact shadow (ambient occlusion) directly under an object. */
export function contact(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.35): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, alpha(P.ink, a));
  g.addColorStop(1, alpha(P.ink, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** Scatter of small painterly dabs inside the current clip. */
export function dabs(ctx: Ctx, rnd: () => number, x: number, y: number, w: number, h: number, n: number, colour: string, size: number, a = 0.35): void {
  ctx.fillStyle = alpha(colour, a);
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const s = size * (0.5 + rnd());
    ctx.beginPath();
    ctx.ellipse(px, py, s, s * 0.7, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A bright specular glint towards the light. */
export function glint(ctx: Ctx, x: number, y: number, r: number, a = 0.8): void {
  const L = lightDir(ctx);
  ctx.fillStyle = alpha(P.flowerWhite, a);
  ellipsePath(ctx, x + L.x * r, y + L.y * r, r * 0.55, r * 0.35);
  ctx.fill();
}

/** Star-burst polygon path. */
export function starPath(ctx: Ctx, x: number, y: number, points: number, r0: number, r1: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const r = i % 2 === 0 ? r1 : r0;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
