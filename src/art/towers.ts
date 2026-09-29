// Tower art (DESIGN.md §4): a static base per tier plus a head baked at 16 facings.
// Heads are drawn in their own sprite anchored at the pivot, lifted by `headLift`.
import { P } from './palette.ts';
import { PT } from './palette-towers.ts';
import { LINE, LINE_THIN, alpha, ball, box, contact, cylinder, dabs, ellipsePath, glint, ink, lightDir, litFill, roundRectPath, seeded, tone, type Ctx } from './paint.ts';
import { FACINGS, TILT, drawParts, facingAngle, pad2, type Part, type SpriteSpec } from './spec.ts';

export interface TowerArt {
  /** Head pivot height above the cell centre, in art units. */
  headLift: number;
  /** Muzzle distance from the pivot along the facing, in art units. */
  muzzle: number;
  /** False for towers whose head never turns (baked once, as facing 00). Default true. */
  rotates?: boolean;
  base: (ctx: Ctx, tier: number) => void;
  head: (ctx: Ctx, tier: number, a: number) => void;
}

// ------------------------------------------------------------ shared pieces

/** Sets up the rotated, tilted ground plane for a head at facing `a`. */
function plane(ctx: Ctx, a: number): void {
  ctx.scale(1, TILT);
  ctx.rotate(a);
}

// ------------------------------------------------------------ v1.1 materials (starter towers)
// The v1.1 art sample (DESIGN.md §0.3 item 9, §16.1): soft contact shadows, real three-quarter volume
// for turning parts, and material rendering (canvas, gunmetal, brass, copper, wood).

/** Uniform scale of the current transform, for the few things Canvas draws in device pixels. */
function deviceScale(ctx: Ctx): number {
  const m = ctx.getTransform();
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}

/** A soft shadow cast down and to the right of the next fill. Canvas shadows ignore the transform's
 * rotation, which is what a fixed top-left light needs; their size is scaled here by hand. */
function shadowOn(ctx: Ctx, dx: number, dy: number, blur: number, a: number): void {
  const k = deviceScale(ctx);
  ctx.shadowColor = alpha(P.ink, a);
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = dx * k;
  ctx.shadowOffsetY = dy * k;
}

function shadowOff(ctx: Ctx): void {
  ctx.shadowColor = alpha(P.ink, 0);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** A small domed rivet or bolt head. */
function rivet(ctx: Ctx, x: number, y: number, r = 1.1, colour: string = P.steelLight): void {
  ball(ctx, x, y, r, r, colour, { line: 0.7, hi: 0.6, lo: 0.45 });
}

/**
 * Draws `path` (a shape on the tilted ground plane of a head at facing `a`) as a solid `h` art units
 * thick, seen in three-quarter view: a side face hanging below a lit top. `m0` is the head's transform
 * before `plane()`, so the thickness is always straight down the screen, whatever the facing.
 * `lift` raises the whole solid (negative is up).
 */
function extrude(ctx: Ctx, m0: DOMMatrix, a: number, lift: number, h: number, path: () => void, top: string, side: string, extent: number, line = LINE_THIN + 0.5): void {
  const put = (dz: number): void => {
    ctx.setTransform(m0);
    ctx.translate(0, lift + dz);
    plane(ctx, a);
  };
  const steps = Math.max(1, Math.ceil(h / 1.1));
  ctx.save();
  // The outline of the whole solid first, then its side face, then the lit top.
  for (let i = steps; i >= 0; i--) {
    put((h * i) / steps);
    path();
    ink(ctx, line * 2);
  }
  for (let i = steps; i >= 1; i--) {
    put((h * i) / steps);
    path();
    ctx.fillStyle = i === steps ? tone(side, -0.25) : side;
    ctx.fill();
  }
  put(0);
  path();
  litFill(ctx, top, 0, 0, extent, 0.4, 0.3);
  ink(ctx, line);
  ctx.restore();
}

/** Metal round bar along local +x on the ground plane: dark rims, a narrow specular streak on the side
 * facing the light, and reflected light along the far edge. */
function metalBar(ctx: Ctx, x0: number, y: number, len: number, r: number, colour: string = P.gunmetal, line = LINE_THIN + 0.3): void {
  const L = lightDir(ctx);
  const lit = L.y >= 0 ? 1 : -1;
  roundRectPath(ctx, x0, y - r, len, r * 2, r * 0.9);
  const g = ctx.createLinearGradient(0, y + lit * r, 0, y - lit * r);
  g.addColorStop(0, tone(colour, 0.2));
  g.addColorStop(0.17, tone(colour, 0.78));
  g.addColorStop(0.3, tone(colour, 0.28));
  g.addColorStop(0.56, colour);
  g.addColorStop(0.82, tone(colour, -0.42));
  g.addColorStop(0.93, tone(colour, -0.1));
  g.addColorStop(1, tone(colour, -0.45));
  ctx.fillStyle = g;
  ctx.fill();
  if (line > 0) ink(ctx, line);
}

/** An upright metal drum (screen space): banded, with a specular strip and a lit top. */
function metalDrum(ctx: Ctx, x: number, y: number, rx: number, ry: number, h: number, colour: string, line = LINE): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(x - rx, y - h);
  ctx.ellipse(x, y - h, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, tone(colour, 0.05));
  g.addColorStop(0.2, tone(colour, 0.7));
  g.addColorStop(0.34, tone(colour, 0.2));
  g.addColorStop(0.62, colour);
  g.addColorStop(0.86, tone(colour, -0.45));
  g.addColorStop(1, tone(colour, -0.2));
  ctx.fillStyle = g;
  ctx.fill();
  if (line > 0) ink(ctx, line);
  ellipsePath(ctx, x, y - h, rx, ry);
  litFill(ctx, tone(colour, 0.15), x, y - h, rx, 0.45, 0.25);
  if (line > 0) ink(ctx, line);
}

function pillowPath(ctx: Ctx, L: number, T: number): void {
  ctx.beginPath();
  ctx.moveTo(-L, -T * 0.3);
  ctx.bezierCurveTo(-L, -T * 1.05, -L * 0.72, -T, 0, -T * 1.02);
  ctx.bezierCurveTo(L * 0.72, -T, L, -T * 1.05, L, -T * 0.3);
  ctx.quadraticCurveTo(L * 1.1, 0, L, T * 0.3);
  ctx.bezierCurveTo(L, T * 1.05, L * 0.72, T, 0, T * 1.02);
  ctx.bezierCurveTo(-L * 0.72, T, -L, T * 1.05, -L, T * 0.3);
  ctx.quadraticCurveTo(-L * 1.1, 0, -L, -T * 0.3);
  ctx.closePath();
}

/** One stuffed canvas sandbag: rounded like a pillow, pinched at the tied ends, with a stitched seam,
 * a little weave, and a soft shadow on whatever it rests on. */
function sandbag(ctx: Ctx, x: number, y: number, rot: number, len: number, thick: number, seed: number): void {
  const L = len / 2;
  const T = thick / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const Ld = lightDir(ctx);
  pillowPath(ctx, L, T);
  shadowOn(ctx, 1.1, 1.8, 2.6, 0.5);
  const g = ctx.createRadialGradient(Ld.x * L * 0.4, Ld.y * T * 0.55, 0.4, -Ld.x * L * 0.1, -Ld.y * T * 0.2, Math.max(L, T) * 1.1);
  g.addColorStop(0, tone(P.sandbag, 0.38));
  g.addColorStop(0.28, tone(P.sandbag, 0.08));
  g.addColorStop(0.62, tone(P.sandbag, -0.08));
  g.addColorStop(1, tone(P.sandbagDark, -0.28));
  ctx.fillStyle = g;
  ctx.fill();
  shadowOff(ctx);
  ctx.save();
  pillowPath(ctx, L, T);
  ctx.clip();
  const rnd = seeded(seed);
  dabs(ctx, rnd, -L, -T, L * 2, T * 2, 12, P.sandbagDark, 0.7, 0.4);
  dabs(ctx, rnd, -L, -T, L * 2, T * 2, 5, P.flowerWhite, 0.55, 0.25);
  // The underside curls away from the light: a darker band along the edge away from it.
  ctx.translate(Ld.x * T * 0.5, Ld.y * T * 0.5);
  pillowPath(ctx, L * 1.02, T * 1.02);
  ctx.rect(-L * 3, -T * 3, L * 6, T * 6);
  ctx.fillStyle = alpha(P.ink, 0.2);
  ctx.fill('evenodd');
  ctx.restore();
  // Gathered, tied ends.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * L * 1.02, 0);
    ctx.lineTo(s * L * 0.72, -T * 0.42);
    ctx.moveTo(s * L * 1.02, 0);
    ctx.lineTo(s * L * 0.74, T * 0.38);
    ink(ctx, 0.7, alpha(P.sandbagDark, 0.95));
  }
  // Stitched seam near one end.
  ctx.beginPath();
  ctx.moveTo(L * 0.5, -T * 0.78);
  ctx.quadraticCurveTo(L * 0.56, 0, L * 0.5, T * 0.78);
  ctx.setLineDash([1.1, 1.2]);
  ink(ctx, 0.75, tone(P.sandbagDark, -0.2));
  ctx.setLineDash([]);
  pillowPath(ctx, L, T);
  ink(ctx, LINE_THIN + 0.45);
  ctx.restore();
}

/**
 * A low sandbag wall round an ellipse, in three-quarter view: `courses` rows, brick-bonded, each bag
 * as long as its stretch of the ring looks on screen (short at the sides, long front and back).
 */
function sandbagWall(ctx: Ctx, cy: number, rx: number, ry: number, n: number, courses: number, bag: number, seed: number): void {
  const H = bag * 0.66;
  const items: { x: number; y: number; rot: number; len: number; key: number; s: number }[] = [];
  for (let k = 0; k < courses; k++) {
    const shrink = 1 - k * 0.07;
    for (let i = 0; i < n; i++) {
      const th = ((i + (k % 2) * 0.5) / n) * Math.PI * 2;
      const ex = rx * shrink;
      const ey = ry * shrink;
      const yg = cy + Math.sin(th) * ey;
      let rot = Math.atan2(ey * Math.cos(th), -ex * Math.sin(th));
      if (rot > Math.PI / 2) rot -= Math.PI;
      if (rot < -Math.PI / 2) rot += Math.PI;
      const len = Math.hypot(ex * Math.sin(th), ey * Math.cos(th)) * ((Math.PI * 2) / n) * 1.18;
      items.push({ x: Math.cos(th) * ex, y: yg - k * H, rot, len: Math.max(bag * 1.2, len), key: yg + k * 0.9, s: seed + k * 31 + i });
    }
  }
  items.sort((p, q) => p.key - q.key);
  for (const b of items) sandbag(ctx, b.x, b.y, b.rot, b.len, bag * 1.12, b.s);
}

/** The dug floor inside a gun pit: shaded under the back wall, lit towards the front, speckled with
 * soil and pebbles, with `casings` spent brass cases lying about. */
function pitFloor(ctx: Ctx, cy: number, rx: number, ry: number, seed: number, casings = 0): void {
  ellipsePath(ctx, 0, cy, rx, ry);
  const g = ctx.createRadialGradient(rx * 0.25, cy + ry * 0.35, 1, 0, cy, rx * 1.05);
  g.addColorStop(0, tone(P.dirt, -0.08));
  g.addColorStop(0.55, P.dirtDark);
  g.addColorStop(1, tone(P.dirtDark, -0.5));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ellipsePath(ctx, 0, cy, rx, ry);
  ctx.clip();
  const rnd = seeded(seed);
  dabs(ctx, rnd, -rx, cy - ry, rx * 2, ry * 2, 22, P.ink, 0.8, 0.22);
  dabs(ctx, rnd, -rx, cy - ry, rx * 2, ry * 2, 12, P.dirt, 0.9, 0.35);
  for (let i = 0; i < 4; i++) {
    const px = (rnd() - 0.5) * rx * 1.3;
    const py = cy + (rnd() - 0.3) * ry * 0.9;
    ball(ctx, px, py, 1.3 + rnd(), 1 + rnd() * 0.6, P.rock, { line: 0.6 });
  }
  for (let i = 0; i < casings; i++) {
    const px = (rnd() - 0.3) * rx * 1.1;
    const py = cy + (rnd() - 0.1) * ry * 0.8;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rnd() * Math.PI);
    roundRectPath(ctx, -2.2, -0.9, 4.4, 1.8, 0.9);
    litFill(ctx, P.brass, 0, 0, 2.5, 0.6, 0.35);
    ink(ctx, 0.6);
    ctx.restore();
  }
  ctx.restore();
}

/** A wooden box in three-quarter view (screen space): planked top, darker front, iron corners.
 * `boards` runs the top's planks front to back (a floor, a cart bed) instead of side to side. */
function woodBox(ctx: Ctx, x: number, y: number, w: number, d: number, h: number, colour: string, seed: number, boards = 0): void {
  // Front face (x..x+w, y..y+h), with the top face above it (y-d..y).
  shadowOn(ctx, 1.5, 2, 3, 0.45);
  roundRectPath(ctx, x, y - d, w, d + h, 1.6);
  ctx.fillStyle = tone(colour, -0.3);
  ctx.fill();
  shadowOff(ctx);
  roundRectPath(ctx, x, y, w, h, 1.4);
  litFill(ctx, tone(colour, -0.12), x + w / 2, y + h / 2, w * 0.6, 0.25, 0.35);
  roundRectPath(ctx, x, y - d, w, d, 1.4);
  litFill(ctx, tone(colour, 0.12), x + w / 2, y - d / 2, w * 0.6, 0.35, 0.2);
  if (boards > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    woodGrain(ctx, 0, 0, d, w, seed, boards);
    ctx.restore();
  } else woodGrain(ctx, x, y - d, w, d, seed, 2);
  woodGrain(ctx, x, y, w, h, seed + 7, 2);
  roundRectPath(ctx, x, y - d, w, d + h, 1.6);
  ink(ctx, LINE_THIN + 0.4);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ink(ctx, LINE_THIN);
  for (const cx of [x + 1.6, x + w - 1.6]) rivet(ctx, cx, y + h * 0.5, 0.8, P.steel);
}

/** Planks with grain lines and a knot or two, inside the rectangle (clipped). */
function woodGrain(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, planks: number): void {
  const rnd = seeded(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const py = y + p * ph;
    ctx.fillStyle = alpha(p % 2 ? P.ink : P.flowerWhite, 0.06);
    ctx.fillRect(x, py, w, ph);
    for (let k = 0; k < 2; k++) {
      const gy = py + ph * (0.3 + k * 0.35) + (rnd() - 0.5);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.bezierCurveTo(x + w * 0.3, gy - 0.8 + rnd(), x + w * 0.6, gy + 0.8 - rnd(), x + w, gy);
      ink(ctx, 0.45, alpha(P.woodDark, 0.55));
    }
    if (rnd() < 0.5) {
      ellipsePath(ctx, x + w * (0.2 + rnd() * 0.6), py + ph * 0.5, 1.1, 0.6);
      ctx.fillStyle = alpha(P.woodDark, 0.6);
      ctx.fill();
    }
    if (p > 0) {
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
      ink(ctx, 0.7, alpha(P.ink, 0.7));
    }
  }
  ctx.restore();
}

/** A spoked cart wheel seen side-on: iron tyre, wooden felloe and spokes, a brass hub. */
function spokedWheel(ctx: Ctx, x: number, y: number, r: number): void {
  const rx = r * 0.46;
  shadowOn(ctx, 1.5, 2, 2.5, 0.4);
  ellipsePath(ctx, x, y, rx, r);
  ctx.fillStyle = PT.iron;
  ctx.fill();
  shadowOff(ctx);
  ellipsePath(ctx, x, y, rx, r);
  litFill(ctx, PT.ironLight, x, y, r, 0.35, 0.5);
  ink(ctx, LINE);
  ellipsePath(ctx, x, y, rx * 0.78, r * 0.8);
  litFill(ctx, P.wood, x, y, r, 0.3, 0.4);
  ink(ctx, LINE_THIN);
  ellipsePath(ctx, x, y, rx * 0.56, r * 0.6);
  ctx.fillStyle = tone(P.woodDark, -0.2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(t) * rx * 0.62, y + Math.sin(t) * r * 0.62);
    ink(ctx, 1.9, P.ink);
    ink(ctx, 0.9, P.wood);
  }
  ball(ctx, x, y, rx * 0.34, r * 0.22, P.brass, { line: LINE_THIN, hi: 0.7 });
}

/** Draws `fn` on the ground plane of a head at facing `a`, raised by `lift` (negative is up). */
function onPlane(ctx: Ctx, m0: DOMMatrix, a: number, lift: number, fn: () => void): void {
  ctx.save();
  ctx.setTransform(m0);
  ctx.translate(0, lift);
  plane(ctx, a);
  fn();
  ctx.restore();
}

/** A metal ammunition can in three-quarter view: olive, riveted, with a carry handle and a stencil. */
function ammoCan(ctx: Ctx, x: number, y: number, w: number, d: number, h: number): void {
  shadowOn(ctx, 1.5, 2, 3, 0.45);
  roundRectPath(ctx, x, y - d, w, d + h, 1.8);
  ctx.fillStyle = P.oliveDark;
  ctx.fill();
  shadowOff(ctx);
  roundRectPath(ctx, x, y, w, h, 1.5);
  litFill(ctx, P.oliveDark, x + w / 2, y + h / 2, w * 0.6, 0.3, 0.3);
  roundRectPath(ctx, x, y - d, w, d, 1.5);
  litFill(ctx, P.oliveLight, x + w / 2, y - d / 2, w * 0.6, 0.35, 0.3);
  roundRectPath(ctx, x, y - d, w, d + h, 1.8);
  ink(ctx, LINE_THIN + 0.4);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ink(ctx, LINE_THIN);
  // Stencilled marks, a brass latch and a folding handle.
  ctx.fillStyle = alpha(P.cream, 0.75);
  ctx.fillRect(x + 2, y + h * 0.35, w * 0.45, 0.9);
  ctx.fillRect(x + 2, y + h * 0.6, w * 0.3, 0.9);
  box(ctx, x + w - 4.5, y - 0.8, 2.8, 2.6, 0.6, P.brass, 0.7);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y - d * 0.5);
  ctx.quadraticCurveTo(x + w * 0.5, y - d * 0.5 - 3.5, x + w * 0.7, y - d * 0.5);
  ink(ctx, 1.8, P.ink);
  ink(ctx, 0.8, P.steelLight);
  for (const rx of [x + 1.4, x + w - 1.4]) rivet(ctx, rx, y + h - 1.4, 0.7);
}

// ------------------------------------------------------------ Rattler

const rattler: TowerArt = {
  headLift: 9,
  muzzle: 26,
  base(ctx, tier) {
    contact(ctx, 0, 8, 34, 22, 0.38);
    const rx = tier === 2 ? 24 : 22.5;
    const ry = tier === 2 ? 17 : 16;
    if (tier >= 1) ammoCan(ctx, 10, -12, 15, 6, 8);
    if (tier === 2) {
      woodBox(ctx, -27, -10, 13, 5, 8, P.crate, 7);
      ctx.fillStyle = P.stop;
      ctx.fillRect(-26, -7, 11, 2);
    }
    pitFloor(ctx, 6, rx - 4.5, ry - 4, 11 + tier, tier === 0 ? 1 : tier + 2);
    sandbagWall(ctx, 6, rx, ry, tier === 2 ? 14 : 12, tier === 0 ? 1 : 2, 7, 40 + tier * 5);
  },
  head(ctx, tier, a) {
    const m0 = ctx.getTransform();
    const toward = Math.sin(a) > 0.3;
    const barrels = tier === 2 ? [-3.9, 0, 3.9] : [-2.9, 2.9];
    const len = tier === 0 ? 20 : 22;
    const r = tier === 2 ? 2 : 1.9;
    const drumR = tier === 2 ? 7.6 : 6.3;
    // The pintle post, down to the pit floor.
    metalDrum(ctx, 0, 9, 2.8, 1.7, 9, P.steelDark, LINE_THIN + 0.4);
    const parts: Part[] = [];
    // Receiver: an olive box with a lit top, panel line, rivets and a rear sight.
    parts.push({
      lx: 0,
      ly: 0,
      draw: () => {
        extrude(ctx, m0, a, -3, 3.5, () => roundRectPath(ctx, -11, -5.5, 20, 11, 5), P.olive, P.oliveDark, 11);
        onPlane(ctx, m0, a, -3, () => {
          // Raised top cover with a cocking handle, a rear sight and rivets.
          roundRectPath(ctx, -7, -3.4, 12, 6.8, 3);
          litFill(ctx, P.oliveLight, -1, 0, 7, 0.4, 0.3);
          ink(ctx, 0.9);
          if (tier === 2) {
            roundRectPath(ctx, -4.5, -3.4, 2.6, 6.8, 0.8);
            ctx.fillStyle = P.stop;
            ctx.fill();
          }
          for (const [x, y] of [[-9, -3.6], [-9, 3.6], [7, -3.6], [7, 3.6]] as const) rivet(ctx, x, y, 0.85);
          box(ctx, -10.5, -1.5, 3, 3, 0.9, P.gunmetal, 0.8);
          box(ctx, 1, 3.2, 3.2, 2.2, 0.7, P.steel, 0.7);
        });
      },
    });
    // Barrels: perforated cooling jackets, a specular streak, flash hiders.
    for (const y of barrels) {
      parts.push({
        lx: 16,
        ly: y,
        draw: () =>
          onPlane(ctx, m0, a, -1.5, () => {
            metalBar(ctx, 6, y, len, r);
            metalBar(ctx, 5, y, len * 0.55, r + 0.9, P.gunmetal);
            for (let k = 0; k < 4; k++) {
              ellipsePath(ctx, 8 + k * 2.6, y, 0.7, 0.6);
              ctx.fillStyle = P.ink;
              ctx.fill();
            }
            metalBar(ctx, 6 + len - 3, y, 4.2, r * 1.4, P.gunmetal);
            if (toward) {
              ellipsePath(ctx, 6 + len + 1, y, 0.7, r * 0.8);
              ctx.fillStyle = P.ink;
              ctx.fill();
            }
          }),
      });
    }
    if (tier === 2) {
      // A clamp ring holding the three barrels together.
      parts.push({
        lx: 17,
        ly: 0,
        draw: () =>
          onPlane(ctx, m0, a, -1.5, () => {
            roundRectPath(ctx, 6 + len * 0.62, -7.6, 2.8, 15.2, 1.2);
            litFill(ctx, P.steel, 6 + len * 0.62, 0, 8, 0.5, 0.35);
            ink(ctx, LINE_THIN);
          }),
      });
    }
    // The brass pan drum on the left, with its feed chute.
    const dy = -5.5 - drumR * 0.72;
    parts.push({
      lx: -2,
      ly: dy,
      draw: () => {
        onPlane(ctx, m0, a, -2, () => {
          roundRectPath(ctx, -4, -6.5, 6, 3, 1);
          litFill(ctx, P.oliveDark, -1, -5, 4);
          ink(ctx, LINE_THIN);
        });
        extrude(ctx, m0, a, -3.5, 4.5, () => ellipsePath(ctx, -2, dy, drumR, drumR), P.brass, P.brassDark, drumR);
        onPlane(ctx, m0, a, -3.5, () => {
          ellipsePath(ctx, -2, dy, drumR * 0.6, drumR * 0.6);
          ink(ctx, 0.8, alpha(P.brassDark, 0.9));
          for (let k = 0; k < 6; k++) {
            const t = (k / 6) * Math.PI * 2;
            rivet(ctx, -2 + Math.cos(t) * drumR * 0.8, dy + Math.sin(t) * drumR * 0.8, 0.7, P.brassLight);
          }
          ball(ctx, -2, dy, drumR * 0.25, drumR * 0.25, P.steel, { line: 0.7 });
          if (tier === 2) {
            // Spinning: bright motion arcs on the drum face.
            for (const t0 of [0.3, 2.4, 4.5]) {
              ctx.beginPath();
              ctx.arc(-2, dy, drumR * 0.45, t0, t0 + 1.1);
              ink(ctx, 0.9, alpha(P.brassLight, 0.9));
            }
          }
        });
      },
    });
    if (tier >= 1) {
      // Gun shield: a curved steel plate standing across the barrels, riveted along the top.
      parts.push({
        lx: 8,
        ly: 0,
        draw: () => {
          const shield = (): void => {
            ctx.beginPath();
            ctx.moveTo(6, -10.5);
            ctx.quadraticCurveTo(9.5, 0, 6, 10.5);
            ctx.lineTo(4.2, 10);
            ctx.quadraticCurveTo(7.6, 0, 4.2, -10);
            ctx.closePath();
          };
          extrude(ctx, m0, a, -9.5, 8.5, shield, P.oliveLight, P.olive, 10);
          onPlane(ctx, m0, a, -9.5, () => {
            for (const y of [-7, 0, 7]) rivet(ctx, 5.1 + (1 - (y * y) / 110) * 2.6, y, 0.6);
          });
        },
      });
    }
    drawParts(parts, a);
  },
};

// ------------------------------------------------------------ Treacle Pump

/** A glossy blob of treacle (a drip, a stain or a puddle), lit from the top left. */
function treacleBlob(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ellipsePath(ctx, x, y, rx, ry);
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 0.2, x, y, Math.max(rx, ry));
  g.addColorStop(0, P.treacleLight);
  g.addColorStop(0.45, P.treacle);
  g.addColorStop(1, tone(P.treacle, -0.45));
  ctx.fillStyle = g;
  ctx.fill();
  ink(ctx, 0.8, alpha(P.ink, 0.9));
  ellipsePath(ctx, x - rx * 0.35, y - ry * 0.35, rx * 0.28, ry * 0.2);
  ctx.fillStyle = alpha(P.flowerWhite, 0.75);
  ctx.fill();
}

/** A riveted copper boiler standing on the cart, with brass bands and a valve. */
function boiler(ctx: Ctx, x: number, y: number): void {
  contact(ctx, x + 1, y + 1, 10, 4, 0.4);
  metalDrum(ctx, x, y, 8, 4.6, 15, P.copper);
  for (const hy of [3.5, 11]) {
    ctx.beginPath();
    ctx.ellipse(x, y - hy, 8, 4.6, 0, 0.1, Math.PI - 0.1);
    ink(ctx, 2.4, P.brassDark);
    ink(ctx, 1.2, P.brass);
    for (let k = 1; k < 5; k++) {
      const t = (k / 5) * Math.PI;
      rivet(ctx, x + Math.cos(t) * 8, y - hy + Math.sin(t) * 4.6, 0.6, P.brassLight);
    }
  }
  metalDrum(ctx, x + 2, y - 15.5, 1.6, 1, 3, P.brass, LINE_THIN);
  ball(ctx, x + 2, y - 19.5, 2.4, 1.5, P.stop, { line: 0.8 });
}

const treacle: TowerArt = {
  headLift: 12,
  muzzle: 24,
  base(ctx, tier) {
    contact(ctx, 0, 9, 33, 19, 0.38);
    // Pull shafts and their crossbar, behind the cart.
    for (const [x0, x1] of [[-17, -31], [-6, -20]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, -13);
      ctx.lineTo(x1, -27);
      ink(ctx, 4.4, P.ink);
      ink(ctx, 2.4, P.wood);
    }
    ctx.beginPath();
    ctx.moveTo(-32, -26);
    ctx.lineTo(-19, -28);
    ink(ctx, 4, P.ink);
    ink(ctx, 2, tone(P.wood, 0.15));
    woodBox(ctx, -24, -1, 48, 14, 11, P.wood, 21 + tier, 5);
    // Side boards round the bed, so it reads as a tray.
    for (const [x, y, w, h] of [[-24, -15.5, 48, 2.6], [-24, -15.5, 2.6, 14.5], [21.4, -15.5, 2.6, 14.5]] as const) {
      roundRectPath(ctx, x, y, w, h, 1);
      litFill(ctx, tone(P.wood, 0.18), x + w / 2, y + h / 2, 10, 0.3, 0.3);
      ink(ctx, 0.9);
    }
    // Iron straps with rivets over the front boards.
    for (const x of [-15, 13]) {
      ctx.fillStyle = PT.iron;
      ctx.fillRect(x, -1, 2.4, 11);
      rivet(ctx, x + 1.2, 1.5, 0.6);
      rivet(ctx, x + 1.2, 7.5, 0.6);
    }
    spokedWheel(ctx, -25, 5, 10);
    spokedWheel(ctx, 25, 5, 10);
    // Treacle spilt on the boards and dripping over the edge.
    treacleBlob(ctx, 5, -7, 7.5, 3);
    for (const [x, len] of [[8.5, 5], [3, 3]] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 1, -1.5);
      ctx.lineTo(x + 1, -1.5);
      ctx.lineTo(x + 0.5, len - 1);
      ctx.lineTo(x - 0.5, len - 1);
      ctx.closePath();
      ctx.fillStyle = P.treacle;
      ctx.fill();
      treacleBlob(ctx, x, len, 1.4, 1.7);
    }
    if (tier >= 1) boiler(ctx, -13, -5);
    if (tier === 2) {
      boiler(ctx, 14, -5);
      treacleBlob(ctx, 22, 20, 9, 3.4);
    }
  },
  head(ctx, tier, a) {
    const m0 = ctx.getTransform();
    const r = tier === 0 ? 10.5 : 12;
    const hoses = tier === 2 ? [-5, 5] : [0];
    const away = Math.sin(a) < 0;
    const hose = (y: number): void =>
      onPlane(ctx, m0, a, 2, () => {
        // Ribbed rubber hose out of the belly, then a brass nozzle with a treacle drip.
        metalBar(ctx, r * 0.6, y, 12, 2.3, PT.iron);
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.moveTo(r * 0.6 + 2 + k * 2.2, y - 2.1);
          ctx.lineTo(r * 0.6 + 2 + k * 2.2, y + 2.1);
          ink(ctx, 0.6, alpha(P.ink, 0.8));
        }
        ctx.beginPath();
        ctx.moveTo(r * 0.6 + 11, y - 2.8);
        ctx.lineTo(r + 13.5, y - 1.4);
        ctx.lineTo(r + 13.5, y + 1.4);
        ctx.lineTo(r * 0.6 + 11, y + 2.8);
        ctx.closePath();
        litFill(ctx, P.brass, r + 12, y, 4, 0.6, 0.35);
        ink(ctx, LINE_THIN);
        treacleBlob(ctx, r + 14.3, y, 1.4, 1.9);
      });
    // A handle at the back.
    onPlane(ctx, m0, a, -2, () => {
      ctx.beginPath();
      ctx.arc(-r * 0.95, 0, 4.2, Math.PI * 0.55, Math.PI * 1.45);
      ink(ctx, LINE + 1.4, P.ink);
      ink(ctx, LINE - 0.8, P.brass);
    });
    if (away) hoses.forEach(hose);
    // The pot-bellied copper kettle: narrow neck, round belly, reflected light low on the right.
    const body = (): void => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.72);
      ctx.bezierCurveTo(-r * 1.2, -r * 0.5, -r * 1.12, r * 0.72, -r * 0.62, r * 0.82);
      ctx.lineTo(r * 0.62, r * 0.82);
      ctx.bezierCurveTo(r * 1.12, r * 0.72, r * 1.2, -r * 0.5, r * 0.5, -r * 0.72);
      ctx.closePath();
    };
    shadowOn(ctx, 1.2, 1.8, 3, 0.45);
    body();
    ctx.fillStyle = P.copper;
    ctx.fill();
    shadowOff(ctx);
    body();
    const g = ctx.createRadialGradient(-r * 0.42, -r * 0.3, 0.5, -r * 0.1, 0, r * 1.25);
    g.addColorStop(0, tone(P.copperLight, 0.55));
    g.addColorStop(0.16, P.copperLight);
    g.addColorStop(0.5, P.copper);
    g.addColorStop(0.82, tone(P.copper, -0.45));
    g.addColorStop(1, tone(P.copper, -0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ink(ctx, LINE);
    // Riveted seam band round the belly.
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 1.02, r * 0.28, 0, 0.12, Math.PI - 0.12);
    ink(ctx, 2.6, P.brassDark);
    ink(ctx, 1.3, P.brass);
    for (let k = 1; k < 6; k++) {
      const t = (k / 6) * Math.PI;
      rivet(ctx, Math.cos(t) * r * 1.0, r * 0.12 + Math.sin(t) * r * 0.28, 0.6, P.brassLight);
    }
    // Lid, knob and the pump lever.
    ball(ctx, 0, -r * 0.74, r * 0.52, r * 0.19, P.copperLight, { line: LINE_THIN, hi: 0.6 });
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(-r * 0.75, -r * 1.25);
    ink(ctx, 2.8, P.ink);
    ink(ctx, 1.3, P.steel);
    box(ctx, -r * 0.95, -r * 1.36, 3.6, 2.4, 1, P.wood, 0.8);
    ball(ctx, 0, -r * 0.92, 2.2, 1.8, P.brass, { line: LINE_THIN, hi: 0.7 });
    if (tier >= 1) {
      // A pressure gauge: brass bezel, cream dial, a needle in the red.
      ball(ctx, -r * 0.42, -r * 0.12, 3.3, 3.1, P.brass, { line: LINE_THIN });
      ball(ctx, -r * 0.42, -r * 0.12, 2.3, 2.1, P.cream, { line: 0.6, hi: 0.3, lo: 0.1 });
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.12);
      ctx.lineTo(-r * 0.42 + 1.5, -r * 0.12 - 1.2);
      ink(ctx, 0.8, P.stop);
    }
    glint(ctx, -r * 0.35, -r * 0.2, r * 0.4, 0.8);
    if (!away) hoses.forEach(hose);
  },
};

// ------------------------------------------------------------ Skylark

/** A bird-winged rocket along local +x on the ground plane: exhaust bell, red fins, a shiny white
 * body with a red band, feathered wings, a red nose and a painted eye. */
function birdRocket(ctx: Ctx, x0: number, y: number, len: number): void {
  const r = 2.5;
  const nose = x0 + len * 0.74;
  metalBar(ctx, x0 - 2.4, y, 3, r * 0.85, P.gunmetal, LINE_THIN);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x0 + 3, y + s * r * 0.6);
    ctx.lineTo(x0 - 1.5, y + s * (r + 3));
    ctx.lineTo(x0 + 0.5, y + s * r * 0.6);
    ctx.closePath();
    litFill(ctx, P.rocketRed, x0 + 1, y + s * 3, 3);
    ink(ctx, LINE_THIN * 0.8);
  }
  metalBar(ctx, x0, y, nose - x0 + 1, r, P.rocketWhite, LINE_THIN);
  roundRectPath(ctx, x0 + len * 0.22, y - r, 2.2, r * 2, 0.6);
  ctx.fillStyle = P.rocketRed;
  ctx.fill();
  // Little feathered wings, swept back (short, so a rack of rockets stays readable).
  for (const s of [-1, 1]) {
    const wx = x0 + len * 0.52;
    ctx.beginPath();
    ctx.moveTo(wx + 1.5, y + s * r * 0.6);
    ctx.quadraticCurveTo(wx - 1, y + s * (r + 2.6), wx - 5, y + s * (r + 2.2));
    ctx.quadraticCurveTo(wx - 4, y + s * (r + 1.3), wx - 4.6, y + s * (r + 0.8));
    ctx.lineTo(wx - 2.5, y + s * r * 0.6);
    ctx.closePath();
    litFill(ctx, tone(P.rocketWhite, -0.04), wx - 2, y + s * (r + 1.4), 3, 0.25, 0.5);
    ink(ctx, LINE_THIN * 0.8);
  }
  ctx.beginPath();
  ctx.moveTo(nose, y - r);
  ctx.quadraticCurveTo(x0 + len + 1.5, y - r * 0.2, x0 + len + 2, y);
  ctx.quadraticCurveTo(x0 + len + 1.5, y + r * 0.2, nose, y + r);
  ctx.closePath();
  litFill(ctx, P.rocketRed, nose + 2, y, 4, 0.55, 0.35);
  ink(ctx, LINE_THIN);
  ellipsePath(ctx, nose - 1.6, y - 0.9, 1.15, 1.05);
  ctx.fillStyle = P.flowerWhite;
  ctx.fill();
  ink(ctx, 0.5);
  ellipsePath(ctx, nose - 1.3, y - 0.9, 0.55, 0.55);
  ctx.fillStyle = P.ink;
  ctx.fill();
}

const skylark: TowerArt = {
  headLift: 14,
  muzzle: 18,
  base(ctx, tier) {
    contact(ctx, 0, 9, 32, 19, 0.38);
    if (tier === 2) {
      // Radar dish on a post at the back left, with its cable.
      ctx.beginPath();
      ctx.moveTo(-16, -16);
      ctx.quadraticCurveTo(-24, -12, -21, -4);
      ink(ctx, 1.4, P.ink);
      metalDrum(ctx, -16, -15, 1.6, 1, 17, P.steel, LINE_THIN + 0.3);
      ctx.save();
      ctx.translate(-16, -34);
      ctx.rotate(-0.45);
      ellipsePath(ctx, 0, 0, 10, 5);
      const g = ctx.createRadialGradient(2, 1.5, 0.5, 0, 0, 10);
      g.addColorStop(0, P.steelLight);
      g.addColorStop(0.6, P.steel);
      g.addColorStop(1, P.steelDark);
      ctx.fillStyle = g;
      ctx.fill();
      ink(ctx, LINE_THIN + 0.4);
      ellipsePath(ctx, 0, 0, 7.5, 3.6);
      ink(ctx, 0.7, alpha(P.ink, 0.5));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -7);
      ink(ctx, 1.2);
      ball(ctx, 0, -7.5, 1.4, 1.4, P.stop, { line: 0.6, hi: 0.8 });
      ctx.restore();
    }
    woodBox(ctx, -22, -3, 44, 15, 13, P.crate, 31 + tier, 4);
    // The turntable's seat: a shadow on the lid where the rack turns.
    contact(ctx, 1, -9.5, 14, 7, 0.45);
    // Stencilled star, a little worn.
    ctx.save();
    ctx.translate(0, 3.5);
    ctx.fillStyle = alpha(P.cream, 0.88);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? 5 : 2.2;
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
    dabs(ctx, seeded(77), -5, -5, 10, 10, 6, P.crate, 0.8, 0.8);
    ctx.restore();
    // Rope handles and steel corner caps on the front.
    for (const x of [-16, 12]) {
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.quadraticCurveTo(x + 2, 6.5, x + 4, 2);
      ink(ctx, 2.2, P.ink);
      ink(ctx, 1.1, P.hay);
    }
    for (const x of [-22, 18.6]) {
      roundRectPath(ctx, x, -3, 3.4, 13, 1);
      litFill(ctx, tier >= 1 ? P.brass : P.steel, x + 1.7, 3.5, 4, 0.5, 0.35);
      ink(ctx, 0.8);
      rivet(ctx, x + 1.7, 0, 0.6);
      rivet(ctx, x + 1.7, 7, 0.6);
    }
    if (tier >= 1) {
      // Brass straps across the top.
      for (const x of [-12, 9]) {
        ctx.fillStyle = alpha(P.brassDark, 0.95);
        ctx.fillRect(x, -18, 3, 15);
        ctx.fillStyle = alpha(P.brassLight, 0.8);
        ctx.fillRect(x, -18, 1, 15);
      }
    }
  },
  head(ctx, tier, a) {
    const m0 = ctx.getTransform();
    const n = tier === 0 ? 2 : tier === 1 ? 3 : 4;
    const gap = 5.4;
    const ys = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap);
    const half = ((n - 1) / 2) * gap + 4.2;
    // Turntable, then the launch cradle with steel rails between the rockets.
    extrude(ctx, m0, a, 1, 3, () => ellipsePath(ctx, 0, 0, 9, 9), P.steel, P.steelDark, 9);
    extrude(ctx, m0, a, -2, 3, () => roundRectPath(ctx, -11, -half, 21, half * 2, 3), P.olive, P.oliveDark, 12);
    onPlane(ctx, m0, a, -2, () => {
      for (const y of [-half + 1.3, half - 1.3]) {
        roundRectPath(ctx, -10, y - 0.9, 19, 1.8, 0.8);
        litFill(ctx, P.steelLight, 0, y, 4, 0.5, 0.3);
        ink(ctx, 0.6);
      }
      for (const [x, y] of [[-9, -half + 2.6], [-9, half - 2.6], [7.5, -half + 2.6], [7.5, half - 2.6]] as const) rivet(ctx, x, y, 0.7);
    });
    const parts: Part[] = ys.map((y) => ({ lx: 6, ly: y, draw: () => onPlane(ctx, m0, a, -5, () => birdRocket(ctx, -8, y, 20)) }));
    drawParts(parts, a);
  },
};

// ------------------------------------------------------------ 3D helpers
// The camera looks north and down: ground y is squashed by TILT and heights are drawn
// at full scale. VIEW points from the scene towards the camera.
const VIEW = { x: 0, y: Math.sqrt(1 - TILT * TILT), z: TILT };

interface V3 {
  x: number;
  y: number;
  z: number;
}

function norm3(x: number, y: number, z: number): V3 {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

/** Screen point for local ground-plane coordinates (lx along facing a, ly across) at height z. */
function at(a: number, lx: number, ly: number, z = 0): { x: number; y: number } {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: lx * c - ly * s, y: (lx * s + ly * c) * TILT - z };
}

/** Screen displacement of a 3D vector. */
function screen3(v: V3, len: number): { x: number; y: number } {
  return { x: v.x * len, y: (v.y * TILT - v.z) * len };
}

/**
 * Builds the ellipse path of a disc of radius r whose normal is n (a lens, a horn mouth,
 * a bore). Returns true if the disc's front faces the camera.
 */
function disc(ctx: Ctx, x: number, y: number, n: V3, r: number, minFrac = 0.2): boolean {
  const facing = n.x * VIEW.x + n.y * VIEW.y + n.z * VIEW.z;
  const sx = n.x;
  const sy = n.y * TILT - n.z;
  const rot = Math.hypot(sx, sy) > 1e-6 ? Math.atan2(sy, sx) : 0;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, r * Math.max(minFrac, Math.abs(facing))), r, rot, 0, Math.PI * 2);
  return facing >= 0;
}

/** A lit tapered tube between two screen points (radii across the tube, screen space). */
function tubeBody(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, colour: string, line = LINE): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l;
  let ny = dx / l;
  // Put the highlight on the side facing the top-left light.
  if (-nx - ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  ctx.beginPath();
  ctx.moveTo(x0 + nx * r0, y0 + ny * r0);
  ctx.lineTo(x1 + nx * r1, y1 + ny * r1);
  ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
  ctx.lineTo(x0 - nx * r0, y0 - ny * r0);
  ctx.closePath();
  const R = Math.max(r0, r1);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const g = ctx.createLinearGradient(mx + nx * R, my + ny * R, mx - nx * R, my - ny * R);
  g.addColorStop(0, tone(colour, 0.42));
  g.addColorStop(0.45, colour);
  g.addColorStop(1, tone(colour, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  if (line > 0) ink(ctx, line);
}

/** Lit iron wheel seen side-on at the front of a cart. */
function ironWheel(ctx: Ctx, x: number, y: number, r: number): void {
  ellipsePath(ctx, x, y, r * 0.45, r);
  litFill(ctx, PT.iron, x, y, r);
  ink(ctx, LINE);
  ellipsePath(ctx, x, y, r * 0.2, r * 0.4);
  ctx.fillStyle = P.brass;
  ctx.fill();
  ink(ctx, LINE_THIN);
}

/** Front slab + top of a wooden cart bed. */
function cartBed(ctx: Ctx, w: number, top: string = P.wood, side: string = P.woodDark): void {
  roundRectPath(ctx, -w / 2, 0, w, 11, 4);
  litFill(ctx, side, 0, 5, w / 2);
  ink(ctx, LINE);
  roundRectPath(ctx, -w / 2, -15, w, 17, 4);
  litFill(ctx, top, 0, -7, w / 2);
  ink(ctx, LINE);
}

// ------------------------------------------------------------ Thumper

/** A tapered metal tube between two screen points, with a specular streak and reflected light. */
function metalTube(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, colour: string): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l;
  let ny = dx / l;
  if (-nx - ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  ctx.beginPath();
  ctx.moveTo(x0 + nx * r0, y0 + ny * r0);
  ctx.lineTo(x1 + nx * r1, y1 + ny * r1);
  ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
  ctx.lineTo(x0 - nx * r0, y0 - ny * r0);
  ctx.closePath();
  const R = Math.max(r0, r1);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const g = ctx.createLinearGradient(mx + nx * R, my + ny * R, mx - nx * R, my - ny * R);
  g.addColorStop(0, tone(colour, 0.2));
  g.addColorStop(0.16, tone(colour, 0.75));
  g.addColorStop(0.3, tone(colour, 0.25));
  g.addColorStop(0.55, colour);
  g.addColorStop(0.82, tone(colour, -0.42));
  g.addColorStop(0.93, tone(colour, -0.1));
  g.addColorStop(1, tone(colour, -0.45));
  ctx.fillStyle = g;
  ctx.fill();
  ink(ctx, LINE);
}

/** The half of a band round a tube that faces the camera (the tube hides the rest), as a path.
 * Same ellipse as disc(); the mortar always shows its muzzle, so the near half is the lower one. */
function nearHalf(ctx: Ctx, x: number, y: number, n: V3, r: number): void {
  const facing = n.x * VIEW.x + n.y * VIEW.y + n.z * VIEW.z;
  const sx = n.x;
  const sy = n.y * TILT - n.z;
  const rot = Math.hypot(sx, sy) > 1e-6 ? Math.atan2(sy, sx) : 0;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, r * Math.max(0.2, Math.abs(facing))), r, rot, Math.PI / 2, Math.PI * 1.5);
}

/** A crate of mortar shells, lid off: olive shells with brass fuzes standing in a row. */
function shellCrate(ctx: Ctx, x: number, y: number): void {
  woodBox(ctx, x, y, 15, 5, 8, P.crate, 61, 0);
  for (let i = 0; i < 3; i++) {
    const sx = x + 3.2 + i * 4.3;
    metalDrum(ctx, sx, y - 2, 1.6, 0.9, 4.5, P.olive, 0.7);
    ball(ctx, sx, y - 7, 1.5, 1.2, P.brass, { line: 0.6, hi: 0.7 });
  }
}

const thumper: TowerArt = {
  headLift: 4,
  muzzle: 12,
  base(ctx, tier) {
    contact(ctx, 0, 8, 35, 22, 0.38);
    if (tier >= 1) shellCrate(ctx, -31, -11);
    if (tier === 2) ammoCan(ctx, 15, -13, 14, 5, 7);
    pitFloor(ctx, 6, 20.5, 13.5, 51 + tier, 0);
    sandbagWall(ctx, 6, 25, 18, tier === 0 ? 13 : 14, tier === 0 ? 1 : 2, 7.5, 70 + tier * 5);
  },
  head(ctx, tier, a) {
    const m0 = ctx.getTransform();
    const tubes = tier === 2 ? [-7, 7] : [0];
    const len = tier === 0 ? 16 : 18;
    const r = tier === 0 ? 6.2 : 7;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Base plate: a steel disc bolted round its rim, with a brass traverse ring.
    extrude(ctx, m0, a, 1, 3, () => ellipsePath(ctx, 0, 0, 14, 12.5), P.steel, P.steelDark, 14);
    onPlane(ctx, m0, a, 1, () => {
      ellipsePath(ctx, 0, 0, 7.5, 7);
      ink(ctx, 2.2, P.brassDark);
      ink(ctx, 1.1, P.brass);
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * Math.PI * 2 + 0.2;
        rivet(ctx, Math.cos(t) * 11.5, Math.sin(t) * 10.2, 0.85);
      }
    });
    // Tube leans about 35° off vertical towards the facing.
    const D = norm3(c * 0.72, s * 0.72, 1);
    const order = tubes.map((off) => ({ off, y: at(a, 0, off).y })).sort((p, q) => p.y - q.y);
    for (const { off } of order) {
      const b = at(a, -3, off, 3);
      const d = screen3(D, len);
      const m = { x: b.x + d.x, y: b.y + d.y };
      const mid = { x: b.x + d.x * 0.45, y: b.y + d.y * 0.45 };
      // Bipod legs from mid-tube down to little feet at the plate's front edge.
      for (const k of [-5, 5]) {
        const f = at(a, 10, off + k, 0);
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        ctx.lineTo(f.x, f.y);
        ink(ctx, 3.8, P.ink);
        ink(ctx, 2, P.steelDark);
        ctx.beginPath();
        ctx.moveTo(mid.x - 0.4, mid.y - 0.4);
        ctx.lineTo(f.x - 0.4, f.y - 0.4);
        ink(ctx, 0.7, alpha(P.steelLight, 0.8));
        ball(ctx, f.x, f.y, 2, 1.2, P.steelDark, { line: 0.8 });
      }
      // Recoil collar at the breech.
      disc(ctx, b.x, b.y, D, r + 2.6);
      litFill(ctx, P.steel, b.x, b.y, r + 3, 0.5, 0.35);
      ink(ctx, LINE);
      metalTube(ctx, b.x, b.y, m.x, m.y, r, r * 1.08, P.steelDark);
      // Two brass bands, and a sight on the side.
      for (const t of [0.3, 0.72]) {
        const band = { x: b.x + d.x * t, y: b.y + d.y * t };
        nearHalf(ctx, band.x, band.y, D, r * (1.02 + t * 0.06));
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = P.brassDark;
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = P.brass;
        ctx.stroke();
      }
      const sight = at(a, 1, off - (r + 1.5), 3 + len * 0.55);
      box(ctx, sight.x - 2, sight.y - 2.5, 4, 5, 1, P.brass, LINE_THIN);
      if (tier >= 1) {
        // The elevating handwheel beside the breech.
        const hw = at(a, -4, off + r + 2.5, 5);
        ellipsePath(ctx, hw.x, hw.y, 3.2, 3.2);
        ink(ctx, 2.6, P.ink);
        ink(ctx, 1.2, P.stop);
        ball(ctx, hw.x, hw.y, 0.9, 0.9, P.steel, { line: 0.5 });
      }
      // Reinforced muzzle lip and a dark bore.
      disc(ctx, m.x, m.y, D, r * 1.3);
      litFill(ctx, P.steelDark, m.x, m.y, r * 1.3, 0.55, 0.3);
      ink(ctx, LINE);
      disc(ctx, m.x, m.y, D, r * 0.82);
      const bore = ctx.createRadialGradient(m.x - 1, m.y - 1, 0.3, m.x, m.y, r);
      bore.addColorStop(0, tone(P.ink, -0.4));
      bore.addColorStop(1, tone(P.gunmetal, -0.3));
      ctx.fillStyle = bore;
      ctx.fill();
    }
  },
};

// ------------------------------------------------------------ Scorcher

const scorcher: TowerArt = {
  headLift: 27,
  muzzle: 24,
  base(ctx, tier) {
    contact(ctx, 0, 9, 30, 18, 0.32);
    cartBed(ctx, 44);
    ironWheel(ctx, -22, 7, 9);
    ironWheel(ctx, 22, 7, 9);
    const r = tier === 0 ? 16 : 18;
    if (tier === 2) {
      // Chimney belching soot, at the back left.
      tubeBody(ctx, -10, -22, -12, -50, 4.2, 4.2, PT.ironLight);
      ellipsePath(ctx, -12, -51, 6.5, 2.8);
      litFill(ctx, PT.iron, -12, -51, 6);
      ink(ctx, LINE);
    }
    // Pot belly on stubby legs.
    for (const x of [-9, 9]) box(ctx, x - 2.5, -8, 5, 7, 1.5, PT.iron, LINE_THIN + 0.4);
    ball(ctx, 0, -19, r, r * 0.92, PT.iron, { hi: 0.3 });
    if (tier >= 1) {
      ellipsePath(ctx, 0, -19, r * 1.01, r * 0.35);
      ctx.lineWidth = 3;
      ctx.strokeStyle = P.brass;
      ctx.stroke();
    }
    // Glowing fire door on the front.
    roundRectPath(ctx, -7, -17, 14, 11, 3);
    const g = ctx.createRadialGradient(0, -11, 1, 0, -11, 9);
    g.addColorStop(0, PT.emberCore);
    g.addColorStop(0.5, PT.ember);
    g.addColorStop(1, P.fireDark);
    ctx.fillStyle = g;
    ctx.fill();
    ink(ctx, LINE);
    ctx.strokeStyle = PT.iron;
    ctx.lineWidth = 1.6;
    for (const x of [-3, 0, 3]) {
      ctx.beginPath();
      ctx.moveTo(x, -16);
      ctx.lineTo(x, -7);
      ctx.stroke();
    }
    glint(ctx, -6, -24, 6, 0.4);
  },
  head(ctx, tier, a) {
    const len = [16, 18, 19][tier]!;
    ctx.save();
    plane(ctx, a);
    const parts: Part[] = [
      {
        lx: 10,
        ly: 0,
        draw: () => {
          // Tapered brass nozzle with a copper flared tip.
          ctx.beginPath();
          ctx.moveTo(3, -4);
          ctx.lineTo(3 + len, -2.6);
          ctx.lineTo(3 + len, 2.6);
          ctx.lineTo(3, 4);
          ctx.closePath();
          litFill(ctx, P.brass, 3 + len / 2, 0, 6);
          ink(ctx, LINE_THIN + 0.5);
          ctx.beginPath();
          ctx.moveTo(1 + len, -3.2);
          ctx.lineTo(6 + len, -5.2);
          ctx.lineTo(6 + len, 5.2);
          ctx.lineTo(1 + len, 3.2);
          ctx.closePath();
          litFill(ctx, P.copper, 4 + len, 0, 5);
          ink(ctx, LINE_THIN + 0.5);
          ellipsePath(ctx, 6.2 + len, 0, 1.8, 3.6);
          ctx.fillStyle = P.ink;
          ctx.fill();
        },
      },
      { lx: 0, ly: 0, draw: () => ball(ctx, 0, 0, 8, 7.5, P.brass, { hi: 0.55 }) },
    ];
    if (tier === 2) {
      parts.push({ lx: -8, ly: 6, draw: () => ball(ctx, -8, 6, 5, 4.5, P.copper, { line: LINE_THIN + 0.4 }) });
    }
    drawParts(parts, a);
    ctx.restore();
    // Pilot light and valve knob, upright.
    ball(ctx, 0, -5, 3, 2.4, tier >= 1 ? P.stop : P.oliveDark, { line: LINE_THIN });
    const tip = at(a, len + 7, 0);
    ball(ctx, tip.x, tip.y - 1, 1.8, 1.8, PT.ember, { line: 0.8 });
  },
};

// ------------------------------------------------------------ Sparkplug

function coilBands(ctx: Ctx, x: number, y0: number, y1: number, rx: number, ry: number): void {
  for (let y = y0; y <= y1; y += 3) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
    ink(ctx, 2.6, P.ink);
    ink(ctx, 1.5, PT.coil);
  }
}

const sparkplug: TowerArt = {
  headLift: 20,
  muzzle: 5,
  base(ctx, tier) {
    contact(ctx, 0, 8, 30, 18, 0.32);
    // Dynamo drum with copper windings.
    cylinder(ctx, 0, 6, 20, 13, 18, P.oliveLight, P.olive);
    coilBands(ctx, 0, -9, 3, 20, 7);
    // Brass terminals and wire loops.
    for (const x of [-14, 14]) {
      ball(ctx, x, -14, 3, 2.4, P.brass, { line: LINE_THIN });
    }
    if (tier >= 1) {
      // A pressure gauge on the front.
      ball(ctx, -11, 1, 4, 4, P.cream, { line: LINE_THIN + 0.3 });
      ctx.beginPath();
      ctx.moveTo(-11, 1);
      ctx.lineTo(-9, -1.5);
      ink(ctx, 1);
    }
    if (tier === 2) {
      // Twin side coils with copper spheres.
      for (const x of [-24, 24]) {
        cylinder(ctx, x, 6, 5, 3.4, 22, PT.coil, P.copper, LINE_THIN + 0.6);
        ball(ctx, x, -20, 5, 4.6, P.copperLight, { hi: 0.6 });
      }
    }
  },
  head(ctx, tier, a) {
    const tall = [20, 24, 26][tier]!;
    // Threads and hex nut.
    cylinder(ctx, 0, 0, 7, 4.5, 4, P.steelLight, P.steel, LINE_THIN + 0.5);
    ctx.beginPath();
    const hy = -4;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(ang) * 9;
      const py = hy + Math.sin(ang) * 6;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    litFill(ctx, P.steel, 0, hy, 9);
    ink(ctx, LINE);
    // Ribbed porcelain insulator.
    tubeBody(ctx, 0, -6, 0, -6 - tall, 6.5, 4.6, PT.porcelain);
    for (let y = -10; y > -6 - tall + 3; y -= 4) {
      ctx.beginPath();
      ctx.ellipse(0, y, 6.4 - (-y - 6) * 0.07, 2, 0, 0, Math.PI);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = PT.porcelainShade;
      ctx.stroke();
    }
    if (tier >= 1) {
      ellipsePath(ctx, 0, -12, 6.8, 2.2);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = P.copper;
      ctx.stroke();
    }
    // Terminal cap.
    const top = -6 - tall;
    cylinder(ctx, 0, top + 1, 4.5, 2.8, 4, P.steelLight, P.steelDark, LINE_THIN + 0.4);
    // Electrode hook bent towards the target.
    const hooks = tier === 2 ? [-3.5, 3.5] : [0];
    const tipZ = -top + 8;
    for (const off of hooks) {
      const root = { x: -Math.sin(a) * off, y: Math.cos(a) * off * TILT + top - 3 };
      const tip = at(a, 6, off, tipZ);
      ctx.beginPath();
      ctx.moveTo(root.x, root.y);
      ctx.lineTo(root.x, tip.y);
      ctx.lineTo(tip.x, tip.y);
      ink(ctx, 4.2, P.ink);
      ink(ctx, 2.2, P.steelLight);
    }
    ball(ctx, 0, top - 3, 2.4, 2.2, P.brassLight, { line: LINE_THIN });
    if (tier === 2) ball(ctx, 0, -6 - tall * 0.5, 3, 2.4, P.gold, { line: LINE_THIN });
  },
};

// ------------------------------------------------------------ Sunbeam

const sunbeam: TowerArt = {
  headLift: 27,
  muzzle: 7,
  base(ctx, tier) {
    contact(ctx, 0, 6, 28, 16, 0.3);
    // Wooden tripod.
    const apex = { x: 0, y: -26 };
    const feet = [
      { x: -20, y: 4 },
      { x: 20, y: 4 },
      { x: 0, y: -6 },
    ].sort((p, q) => p.y - q.y);
    for (const f of feet) {
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(f.x, f.y);
      ink(ctx, 6.4, P.ink);
      ink(ctx, 3.6, P.wood);
      ball(ctx, f.x, f.y, 3, 2, P.woodDark, { line: LINE_THIN });
    }
    // Brass mount at the apex.
    cylinder(ctx, 0, -24, 5.5, 3.5, 4, P.brassLight, P.brass, LINE_THIN + 0.4);
    if (tier >= 1) {
      // Counterweight hanging under the apex.
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(0, -10);
      ink(ctx, 1.4, P.ink);
      ball(ctx, 0, -8, 4.2, 4.2, P.gunmetal, { line: LINE_THIN });
    }
    if (tier === 2) {
      // Brass bands on the legs.
      for (const f of feet) {
        const bx = apex.x + (f.x - apex.x) * 0.55;
        const by = apex.y + (f.y - apex.y) * 0.55;
        ellipsePath(ctx, bx, by, 3.6, 2);
        ctx.fillStyle = P.brass;
        ctx.fill();
        ink(ctx, LINE_THIN);
      }
    }
  },
  head(ctx, tier, a) {
    const lensR = [12, 14, 16][tier]!;
    const n = norm3(Math.cos(a), Math.sin(a), 0.12);
    const lens = at(a, 7, 0);
    const dish = at(a, -8, 0);
    const parts: Part[] = [
      {
        lx: -8,
        ly: 0,
        draw: () => {
          // Mirror dish behind the lens, reflecting forward.
          const front = disc(ctx, dish.x, dish.y, n, 10);
          if (front) {
            const g = ctx.createRadialGradient(dish.x - 2, dish.y - 3, 1, dish.x, dish.y, 11);
            g.addColorStop(0, P.white);
            g.addColorStop(0.5, P.steelLight);
            g.addColorStop(1, P.steel);
            ctx.fillStyle = g;
            ctx.fill();
          } else litFill(ctx, P.steelDark, dish.x, dish.y, 10);
          ink(ctx, LINE);
        },
      },
      {
        lx: 0,
        ly: 0,
        draw: () => {
          // Yoke from the pivot to the lens.
          ctx.beginPath();
          ctx.moveTo(dish.x, dish.y);
          ctx.lineTo(lens.x, lens.y);
          ink(ctx, 5, P.ink);
          ink(ctx, 3, P.brassDark);
          ball(ctx, 0, 0, 4.2, 3.8, P.brass, { line: LINE_THIN + 0.3 });
        },
      },
      {
        lx: 7,
        ly: 0,
        draw: () => {
          // Brass rim, then glass with a highlight; glass reads from either side.
          disc(ctx, lens.x, lens.y, n, lensR + 2.4);
          litFill(ctx, P.brass, lens.x, lens.y, lensR, 0.5, 0.35);
          ink(ctx, LINE);
          disc(ctx, lens.x, lens.y, n, lensR);
          const g = ctx.createRadialGradient(lens.x - lensR * 0.35, lens.y - lensR * 0.4, 1, lens.x, lens.y, lensR * 1.1);
          g.addColorStop(0, alpha(P.white, 0.95));
          g.addColorStop(0.35, alpha(PT.lensGlass, 0.9));
          g.addColorStop(1, alpha(P.infoLight, 0.75));
          ctx.fillStyle = g;
          ctx.fill();
          ctx.lineWidth = LINE_THIN;
          ctx.strokeStyle = P.brassDark;
          ctx.stroke();
          glint(ctx, lens.x, lens.y, lensR * 0.6, 0.7);
        },
      },
    ];
    drawParts(parts, a);
    if (tier === 2) {
      // A little prism on top of the yoke.
      ctx.beginPath();
      ctx.moveTo(-3, -5);
      ctx.lineTo(0, -11);
      ctx.lineTo(3, -5);
      ctx.closePath();
      litFill(ctx, PT.lensGlass, 0, -8, 4);
      ink(ctx, LINE_THIN);
    }
  },
};

// ------------------------------------------------------------ Icebox

const icebox: TowerArt = {
  headLift: 23,
  muzzle: 0,
  rotates: false,
  base(ctx, tier) {
    contact(ctx, 0, 8, 32, 18, 0.32);
    const w = tier === 0 ? 46 : 50;
    // Front face, then the lid.
    roundRectPath(ctx, -w / 2, -6, w, 18, 5);
    litFill(ctx, PT.enamelShade, 0, 3, w / 2);
    ink(ctx, LINE);
    roundRectPath(ctx, -w / 2, -24, w, 20, 5);
    litFill(ctx, PT.enamel, 0, -14, w / 2, 0.4, 0.25);
    ink(ctx, LINE);
    // Chrome handle and frosty vents.
    roundRectPath(ctx, -8, -3, 16, 4, 2);
    litFill(ctx, P.steelLight, 0, -1, 8);
    ink(ctx, LINE_THIN);
    for (const x of [-16, -12, 12, 16]) {
      roundRectPath(ctx, x - 1.2, 3, 2.4, 7, 1.2);
      ctx.fillStyle = PT.frostDeep;
      ctx.fill();
    }
    if (tier >= 1) {
      // Icicles hanging from the lid edge.
      ctx.fillStyle = PT.iceBlue;
      for (let i = 0; i < 7; i++) {
        const x = -w / 2 + 5 + i * ((w - 10) / 6);
        const l = 3 + ((i * 7) % 5);
        ctx.beginPath();
        ctx.moveTo(x - 2, -5);
        ctx.lineTo(x + 2, -5);
        ctx.lineTo(x, -5 + l);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = alpha(P.ink, 0.6);
        ctx.stroke();
      }
    }
    if (tier === 2) {
      // Blue stripe and a stencilled snowflake.
      ctx.fillStyle = P.info;
      ctx.fillRect(-w / 2 + 2, 6, w - 4, 3);
      ctx.save();
      ctx.translate(15, -14);
      ctx.strokeStyle = P.info;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Frost dabs on the lid.
    ctx.fillStyle = alpha(PT.frost, 0.9);
    for (const [x, y, r] of [
      [-16, -18, 3],
      [-11, -20, 2],
      [18, -9, 2.4],
    ]) {
      ellipsePath(ctx, x!, y!, r!, r! * 0.7);
      ctx.fill();
    }
  },
  head(ctx, tier) {
    const fans = tier === 2 ? [-11, 11] : [0];
    const r = tier === 0 ? 9 : 10;
    for (const fx of fans) {
      cylinder(ctx, fx, 2, r, r * TILT, 5, P.steelLight, P.steel);
      // Fan blades seen from above, under a cage.
      ctx.save();
      ctx.translate(fx, -3);
      ctx.scale(1, TILT);
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.ellipse(r * 0.45, 0, r * 0.42, r * 0.22, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = PT.iceBlue;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = P.ink;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = P.steelDark;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = alpha(P.ink, 0.7);
      for (const cr of [r * 0.55, r * 0.85]) {
        ctx.beginPath();
        ctx.arc(0, 0, cr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  },
};

// ------------------------------------------------------------ Tea Urn

function bunting(ctx: Ctx, x0: number, x1: number, y: number, sag: number, n: number): void {
  const cols = [PT.bunting1, PT.bunting2, PT.bunting3];
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y);
  ink(ctx, 1.4, P.ink);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t;
    const yy = y + sag * 4 * t * (1 - t);
    ctx.beginPath();
    ctx.moveTo(x - 3, yy);
    ctx.lineTo(x + 3, yy);
    ctx.lineTo(x, yy + 6);
    ctx.closePath();
    ctx.fillStyle = cols[i % 3]!;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
  }
}

const teaurn: TowerArt = {
  headLift: 43,
  muzzle: 0,
  rotates: false,
  base(ctx, tier) {
    contact(ctx, 0, 8, 30, 17, 0.32);
    // Trestle table.
    cartBed(ctx, 46, P.cream, P.parchmentShade);
    for (const x of [-18, 18]) box(ctx, x - 2, 9, 4, 6, 1, P.woodDark, LINE_THIN + 0.3);
    bunting(ctx, -24, 24, 3, 3, tier === 0 ? 5 : 7);
    // The urn: a tall brass body with shoulders.
    const r = tier === 0 ? 13 : 14.5;
    cylinder(ctx, 0, -8, r, r * 0.55, 28, P.brassLight, P.brass);
    ball(ctx, 0, -36, r * 0.95, r * 0.5, P.brass, { hi: 0.55 });
    // Handles.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * (r + 1), -26, 4.5, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5);
      ink(ctx, 4.4, P.ink);
      ink(ctx, 2.2, P.brassDark);
    }
    // Tap and a cup waiting underneath.
    box(ctx, -2, -16, 4, 6, 1.5, P.brassDark, LINE_THIN + 0.3);
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, -7);
    ink(ctx, 2.4, P.ink);
    cylinder(ctx, 0, -3, 4.5, 2.4, 4, P.cream, P.parchment, LINE_THIN + 0.3);
    if (tier >= 1) cylinder(ctx, -13, -3, 4, 2.2, 3.5, P.cream, P.parchment, LINE_THIN + 0.3);
    if (tier === 2) {
      cylinder(ctx, 13, -3, 4, 2.2, 3.5, P.cream, P.parchment, LINE_THIN + 0.3);
      ellipsePath(ctx, 0, -24, r * 1.01, r * 0.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = P.stop;
      ctx.stroke();
    }
    glint(ctx, -5, -26, 7, 0.55);
  },
  head(ctx, tier) {
    // Lid, finial and a little steam vent.
    ball(ctx, 0, 0, 7.5, 3.6, P.brassLight, { line: LINE_THIN + 0.4 });
    ball(ctx, 0, -4, 3, 3, tier === 2 ? P.gold : P.brassDark, { line: LINE_THIN });
    box(ctx, 5, -6, 3, 5, 1, P.steelLight, LINE_THIN);
  },
};

// ------------------------------------------------------------ Bellower

const bellower: TowerArt = {
  headLift: 22,
  muzzle: 21,
  base(ctx, tier) {
    contact(ctx, 0, 9, 30, 17, 0.32);
    // Podium with a front drape and steps.
    roundRectPath(ctx, -20, -8, 40, 20, 3);
    litFill(ctx, P.woodDark, 0, 2, 22);
    ink(ctx, LINE);
    roundRectPath(ctx, -20, -22, 40, 16, 3);
    litFill(ctx, P.wood, 0, -14, 22);
    ink(ctx, LINE);
    // Drape: red with a cream fringe.
    ctx.beginPath();
    ctx.moveTo(-17, -7);
    ctx.lineTo(17, -7);
    ctx.lineTo(15, 8);
    ctx.quadraticCurveTo(0, 12, -15, 8);
    ctx.closePath();
    litFill(ctx, P.stop, 0, 0, 18);
    ink(ctx, LINE_THIN + 0.4);
    ctx.fillStyle = P.cream;
    for (let x = -14; x <= 14; x += 4) {
      ellipsePath(ctx, x, 9 - Math.abs(x) * 0.07, 1.5, 2);
      ctx.fill();
    }
    // Step.
    roundRectPath(ctx, -12, 11, 24, 5, 2);
    litFill(ctx, P.wood, 0, 13, 12);
    ink(ctx, LINE_THIN + 0.4);
    if (tier >= 1) {
      ctx.fillStyle = P.brass;
      ctx.fillRect(-20, -9, 40, 2.4);
    }
    if (tier === 2) {
      // Brass bell on a bracket at the back right.
      ctx.beginPath();
      ctx.moveTo(17, -20);
      ctx.lineTo(17, -34);
      ctx.lineTo(10, -34);
      ink(ctx, 3.4, P.ink);
      ink(ctx, 1.8, P.brassDark);
      ctx.beginPath();
      ctx.moveTo(6, -24);
      ctx.quadraticCurveTo(6, -33, 10, -33);
      ctx.quadraticCurveTo(14, -33, 14, -24);
      ctx.closePath();
      litFill(ctx, P.brass, 10, -28, 5);
      ink(ctx, LINE_THIN + 0.4);
      bunting(ctx, -20, 20, -22, 2, 6);
    }
  },
  head(ctx, tier, a) {
    const bell = [11, 13, 15][tier]!;
    const len = 20;
    const n = norm3(Math.cos(a), Math.sin(a), 0.28);
    const root = at(a, 0, 0, 2);
    const mouthOffset = screen3(n, len);
    const mouth = { x: root.x + mouthOffset.x, y: root.y + mouthOffset.y };
    const neck = { x: root.x + mouthOffset.x * 0.35, y: root.y + mouthOffset.y * 0.35 };
    // Swivel stand.
    cylinder(ctx, 0, 2, 5, 3, 5, P.brassLight, P.brassDark, LINE_THIN + 0.4);
    const front = disc(ctx, mouth.x, mouth.y, n, bell);
    const drawMouth = (): void => {
      disc(ctx, mouth.x, mouth.y, n, bell);
      if (front) {
        const g = ctx.createRadialGradient(mouth.x, mouth.y, 0, mouth.x, mouth.y, bell);
        g.addColorStop(0, P.woodDark);
        g.addColorStop(0.6, P.brassDark);
        g.addColorStop(1, P.brass);
        ctx.fillStyle = g;
        ctx.fill();
      } else litFill(ctx, P.brass, mouth.x, mouth.y, bell, 0.45, 0.3);
      ink(ctx, LINE);
      disc(ctx, mouth.x, mouth.y, n, bell);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = P.brassLight;
      ctx.stroke();
    };
    if (!front) drawMouth();
    // Horn: a narrow neck flaring into the bell.
    tubeBody(ctx, root.x, root.y, neck.x, neck.y, 2.6, 3.6, P.brass);
    tubeBody(ctx, neck.x, neck.y, mouth.x, mouth.y, 3.6, bell * 0.95, P.brass);
    if (front) drawMouth();
    ball(ctx, root.x, root.y, 3.6, 3.2, P.brassDark, { line: LINE_THIN });
  },
};

// ------------------------------------------------------------ Bubbler

const bubbler: TowerArt = {
  headLift: 17,
  muzzle: 19,
  base(ctx, tier) {
    contact(ctx, 0, 9, 32, 17, 0.32);
    // Claw feet peeking out under the front.
    for (const x of [-18, 18]) {
      ball(ctx, x, 8, 4, 3.2, P.brass, { line: LINE_THIN + 0.3 });
    }
    // Tub: front face then the rim with a basin of suds.
    ctx.beginPath();
    ctx.moveTo(-26, -12);
    ctx.lineTo(26, -12);
    ctx.quadraticCurveTo(25, 6, 16, 8);
    ctx.lineTo(-16, 8);
    ctx.quadraticCurveTo(-25, 6, -26, -12);
    ctx.closePath();
    litFill(ctx, PT.enamel, 0, -2, 26, 0.3, 0.3);
    ink(ctx, LINE);
    ellipsePath(ctx, 0, -12, 26, 11);
    litFill(ctx, PT.enamel, 0, -12, 26);
    ink(ctx, LINE);
    ellipsePath(ctx, 0, -12, 21, 8);
    ctx.fillStyle = PT.soap;
    ctx.fill();
    ink(ctx, LINE_THIN);
    // Suds.
    for (const [x, y, r] of [
      [-12, -13, 4],
      [-6, -15, 3],
      [9, -11, 3.6],
      [14, -14, 2.6],
    ]) {
      ball(ctx, x!, y!, r!, r! * 0.85, P.white, { line: LINE_THIN * 0.7, hi: 0.1, lo: 0.2 });
    }
    // Rubber duck on the rim.
    const duck = (x: number, y: number): void => {
      ball(ctx, x, y, 5.2, 4, PT.duck, { line: LINE_THIN + 0.3 });
      ball(ctx, x + 3, y - 4.2, 3.2, 3, PT.duck, { line: LINE_THIN + 0.3 });
      ctx.beginPath();
      ctx.moveTo(x + 5.4, y - 4.6);
      ctx.lineTo(x + 8.4, y - 3.8);
      ctx.lineTo(x + 5.4, y - 3);
      ctx.closePath();
      ctx.fillStyle = PT.duckBeak;
      ctx.fill();
      ink(ctx, 0.9);
      ellipsePath(ctx, x + 3.6, y - 5, 0.8, 0.8);
      ctx.fillStyle = P.ink;
      ctx.fill();
    };
    duck(-19, -18);
    if (tier >= 1) {
      // Brass taps at the back.
      for (const x of [2, 8]) box(ctx, x - 1.8, -25, 3.6, 6, 1.2, P.brass, LINE_THIN);
    }
    if (tier === 2) duck(18, -16);
  },
  head(ctx, tier, a) {
    const rings = tier === 0 ? [0] : tier === 1 ? [-5, 5] : [-7, 0, 7];
    const n = norm3(Math.cos(a), Math.sin(a), 0.15);
    const stickEnd = at(a, 12, 0);
    // Stick (and a fork for several rings).
    ctx.beginPath();
    const r0 = at(a, -3, 0);
    ctx.moveTo(r0.x, r0.y);
    ctx.lineTo(stickEnd.x, stickEnd.y);
    ink(ctx, 5, P.ink);
    ink(ctx, 2.8, P.wood);
    const order = rings.map((off) => ({ off, y: at(a, 19, off).y })).sort((p, q) => p.y - q.y);
    for (const { off } of order) {
      const c = at(a, 19, off);
      if (off !== 0) {
        ctx.beginPath();
        ctx.moveTo(stickEnd.x, stickEnd.y);
        ctx.lineTo(c.x, c.y);
        ink(ctx, 3.6, P.ink);
        ink(ctx, 1.8, P.wood);
      }
      // Soap film then the ring.
      disc(ctx, c.x, c.y, n, 6.5);
      ctx.fillStyle = alpha(PT.soap, 0.55);
      ctx.fill();
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = P.ink;
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = PT.soapPink;
      ctx.stroke();
    }
    ball(ctx, 0, 0, 3.4, 3, P.brass, { line: LINE_THIN });
  },
};

// ------------------------------------------------------------ Pie Chucker

function pie(ctx: Ctx, x: number, y: number, r: number): void {
  ellipsePath(ctx, x, y + r * 0.2, r, r * 0.55);
  litFill(ctx, PT.crust, x, y, r);
  ink(ctx, LINE_THIN + 0.3);
  ellipsePath(ctx, x, y - r * 0.05, r * 0.78, r * 0.38);
  litFill(ctx, PT.custard, x, y, r, 0.45, 0.2);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = PT.custardDark;
  ctx.stroke();
}

const piechucker: TowerArt = {
  headLift: 16,
  muzzle: -12,
  base(ctx, tier) {
    contact(ctx, 0, 9, 30, 17, 0.32);
    cartBed(ctx, 44);
    ironWheel(ctx, -22, 7, 8.5);
    ironWheel(ctx, 22, 7, 8.5);
    // Striped bakery awning trim along the front.
    for (let i = 0; i < 6; i++) {
      roundRectPath(ctx, -21 + i * 7, 0, 7, 5, 1.5);
      ctx.fillStyle = i % 2 ? P.cream : P.stop;
      ctx.fill();
      ink(ctx, 0.9);
    }
    // Stacks of pies at the back.
    const stack = (x: number, n: number): void => {
      for (let i = 0; i < n; i++) pie(ctx, x, -10 - i * 3.6, 6.5);
    };
    stack(-15, tier === 0 ? 2 : 3);
    if (tier >= 1) stack(15, 2);
    if (tier === 2) stack(-15 + 30, 3);
  },
  head(ctx, tier, a) {
    const cupR = tier === 2 ? 8 : 6.5;
    // Frame on the ground plane.
    ctx.save();
    plane(ctx, a);
    for (const y of [-7, 7]) {
      roundRectPath(ctx, -6, y - 1.8, 12, 3.6, 1.5);
      litFill(ctx, P.woodDark, 0, y, 6);
      ink(ctx, LINE_THIN + 0.3);
    }
    ctx.restore();
    // Throwing arm pointing back and up, cup (with pies) at the end.
    const pivot = at(a, 0, 0, 3);
    const cup = at(a, -14, 0, 15);
    const armFront = Math.sin(a) > 0;
    const drawArm = (): void => {
      tubeBody(ctx, pivot.x, pivot.y, cup.x, cup.y, 2.4, 2.2, P.wood, LINE_THIN + 0.4);
    };
    const drawCup = (): void => {
      disc(ctx, cup.x, cup.y + 1, { x: 0, y: 0, z: 1 }, cupR);
      litFill(ctx, P.steel, cup.x, cup.y, cupR);
      ink(ctx, LINE);
      if (tier === 2) {
        pie(ctx, cup.x - 3, cup.y - 1, 4.2);
        pie(ctx, cup.x + 3, cup.y - 1, 4.2);
        pie(ctx, cup.x, cup.y - 4, 4.2);
      } else pie(ctx, cup.x, cup.y - 1.5, cupR * 0.85);
    };
    if (armFront) {
      drawCup();
      drawArm();
    } else {
      drawArm();
      drawCup();
    }
    // Spring coil at the pivot.
    for (let i = -2; i <= 2; i++) {
      const p = at(a, 0, i * 1.6, 3);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 1.6, 3.4, 0, 0, Math.PI * 2);
      ink(ctx, 2.4, P.ink);
      ink(ctx, 1.2, P.steelLight);
    }
  },
};

export const TOWER_ART: Record<string, TowerArt> = { rattler, treacle, skylark, thumper, scorcher, sparkplug, sunbeam, icebox, teaurn, bellower, bubbler, piechucker };

/** Sprite list for every tower with art. */
/** Towers are drawn a little larger than their art units so a base fills its cell. */
export const TOWER_SCALE = 1.2;

export function towerSprites(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  const S = TOWER_SCALE;
  for (const [type, art] of Object.entries(TOWER_ART)) {
    for (let tier = 0; tier < 3; tier++) {
      out.push({ key: `tower.${type}.t${tier + 1}.base`, atlas: 'towers', w: 1.3 * S, h: 1.4 * S, ax: 0.5, ay: 0.62, draw: (ctx) => { ctx.scale(S, S); art.base(ctx, tier); } });
      for (let f = 0; f < (art.rotates === false ? 1 : FACINGS); f++) {
        const a = facingAngle(f);
        out.push({ key: `tower.${type}.t${tier + 1}.head.${pad2(f)}`, atlas: 'towers', w: 1.1 * S, h: 1.1 * S, ax: 0.5, ay: 0.6, draw: (ctx) => { ctx.scale(S, S); art.head(ctx, tier, a); } });
      }
    }
  }
  return out;
}
