// Grand Blustering Army art (DESIGN.md §5): small, round, moustachioed soldiers.
// Infantry: 8 directions × 4 walk frames. Vehicles, air units and bosses: 16 facings.
//
// Heavy kit is drawn as real volumes under the game's oblique three-quarter projection
// (screen x = ground x, screen y = TILT·ground y − height): spheroids by their exact
// projected ellipse, cylinders as the hull of their two end ellipses, and hulls as
// extruded ground-plane footprints. Silhouettes and the fixed top-left light then stay
// consistent at all 16 facings.
import { P } from './palette.ts';
import { PU } from './palette-units.ts';
import { LINE, LINE_THIN, alpha, ball, contact, cylinder, dabs, ellipsePath, glint, ink, lightDir, litFill, mix, roundRectPath, seeded, starPath, tone, type Ctx } from './paint.ts';
import { TILT, drawParts, facingAngle, pad2, type Part, type SpriteSpec } from './spec.ts';

export interface Kit {
  tunic: string;
  trim: string;
  skin: string;
  hat: 'shako' | 'cap';
  elite: boolean;
  /** Body scale. */
  size: number;
  slim?: boolean;
}

const STRIDE = [3.2, 0, -3.2, 0];
const BOB = [0, -1, 0, -1];

function moustache(ctx: Ctx, x: number, y: number, fx: number): void {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * 2.8 + fx * 0.6, y, 3.2, 1.7, s * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = P.moustache;
    ctx.fill();
    ink(ctx, LINE_THIN * 0.8);
  }
}

/** A grander moustache with curled ends (brutes, officers, the General). */
function handlebar(ctx: Ctx, x: number, y: number, fx: number, s = 1, colour: string = P.moustache): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + fx * 0.6 * s, y - 0.8 * s);
    ctx.quadraticCurveTo(x + side * 4.5 * s, y - 2.6 * s, x + side * 6.8 * s, y + 0.4 * s);
    ctx.quadraticCurveTo(x + side * 8.2 * s, y - 2.8 * s, x + side * 6.6 * s, y - 3.4 * s);
    ctx.quadraticCurveTo(x + side * 8.8 * s, y - 1.2 * s, x + side * 7 * s, y + 1.8 * s);
    ctx.quadraticCurveTo(x + side * 3.5 * s, y + 1.6 * s, x + fx * 0.6 * s, y + 1 * s);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ink(ctx, LINE_THIN * 0.8);
  }
}


// ------------------------------------------------------------ troopers (generalised soldiers)

/** Pose geometry handed to a trooper's accessory painters. */
interface Geo {
  fx: number;
  fy: number;
  px: number;
  py: number;
  bx: number;
  by: number;
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  hr: number;
  bob: number;
  stride: number;
  k: number;
  /** Screen position of a hand (side ±1). */
  hand: (side: number) => { x: number; y: number };
}

type HatKind = 'shako' | 'cap' | 'basin' | 'fieldcap' | 'forage';

interface Trooper {
  tunic: string;
  trim: string;
  skin: string;
  elite: boolean;
  size: number;
  slim?: boolean;
  rx?: number;
  ry?: number;
  hr?: number;
  hat: HatKind;
  plume?: number;
  arm?: number;
  fists?: boolean;
  tache?: 'normal' | 'handlebar';
  specs?: boolean;
  /** Painted before the body (things carried behind it). */
  behind?: (ctx: Ctx, g: Geo) => void;
  /** Painted over the body, before arms that are in front. */
  onBody?: (ctx: Ctx, g: Geo) => void;
  /** Painted last (things held overhead). */
  after?: (ctx: Ctx, g: Geo) => void;
}

function hat(ctx: Ctx, kind: HatKind, hx: number, hy: number, fx: number, fy: number, px: number, s: number, tunic: string, trim: string, elite: boolean, plume = 1): void {
  if (kind === 'shako') {
    const top = hy - 17 * s;
    roundRectPath(ctx, hx - 5.8 * s, top, 11.6 * s, 14 * s, 3 * s);
    litFill(ctx, elite ? P.maroonDark : P.maroon, hx, top + 7 * s, 8 * s);
    ink(ctx, LINE_THIN + 0.4);
    ctx.fillStyle = elite ? P.gold : trim;
    ctx.fillRect(hx - 5.6 * s, top + 9.5 * s, 11.2 * s, 2.4 * s);
    ellipsePath(ctx, hx + fx * 3 * s, hy - 4 * s + fy * 1.2 * s, 6.5 * s, 2.2 * s);
    ctx.fillStyle = P.ink;
    ctx.fill();
    const pr = (elite ? 5 : 4) * s * plume;
    ball(ctx, hx - fx * 2 * s, top - 2.5 * s * plume, pr, pr * 1.15, P.plume, { line: LINE_THIN, hi: 0.2 });
    ball(ctx, hx - fx * 2.8 * s, top - 6 * s * plume, pr * 0.7, pr * 0.8, elite ? P.gold : P.plume, { line: LINE_THIN, hi: 0.2 });
  } else if (kind === 'cap') {
    ball(ctx, hx - fx * 0.5 * s, hy - 5 * s, 6.8 * s, 3.8 * s, tunic, { line: LINE_THIN + 0.3 });
    ctx.fillStyle = elite ? P.gold : trim;
    ctx.fillRect(hx - 6 * s, hy - 4.5 * s, 12 * s, 1.6 * s);
    ellipsePath(ctx, hx + fx * 4 * s, hy - 3.2 * s + fy * s, 4.5 * s, 1.7 * s);
    ctx.fillStyle = P.ink;
    ctx.fill();
  } else if (kind === 'basin') {
    // Steel pot helmet with a wide brim; elites get a gold band and spike.
    ellipsePath(ctx, hx, hy - 4.6 * s, 8.6 * s, 3 * s);
    litFill(ctx, P.steelDark, hx, hy - 4.6 * s, 8 * s);
    ink(ctx, LINE_THIN + 0.3);
    ball(ctx, hx, hy - 6.8 * s, 6.4 * s, 4.6 * s, elite ? P.steelDark : P.steel, { line: LINE_THIN + 0.4, hi: 0.55 });
    if (elite) {
      ctx.fillStyle = P.gold;
      ctx.fillRect(hx - 6 * s, hy - 5.8 * s, 12 * s, 1.6 * s);
      ctx.beginPath();
      ctx.moveTo(hx - 1.4 * s, hy - 10.8 * s);
      ctx.lineTo(hx, hy - 15.2 * s);
      ctx.lineTo(hx + 1.4 * s, hy - 10.8 * s);
      ctx.closePath();
      ctx.fillStyle = P.gold;
      ctx.fill();
      ink(ctx, LINE_THIN * 0.8);
    }
  } else if (kind === 'fieldcap') {
    roundRectPath(ctx, hx - 6.2 * s, hy - 11.5 * s, 12.4 * s, 7.4 * s, 2.4 * s);
    litFill(ctx, P.cream, hx, hy - 8 * s, 7 * s);
    ink(ctx, LINE_THIN + 0.3);
    ctx.fillStyle = elite ? P.gold : P.maroon;
    ctx.fillRect(hx - 6 * s, hy - 6.6 * s, 12 * s, 1.9 * s);
    ellipsePath(ctx, hx + fx * 3.6 * s, hy - 4 * s + fy * s, 5 * s, 1.8 * s);
    ctx.fillStyle = P.ink;
    ctx.fill();
  } else {
    // Forage cap: a little boat-shaped side cap perched at an angle.
    ctx.save();
    ctx.translate(hx + px * 0.8 * s, hy - 5.2 * s);
    ctx.rotate(-0.25);
    ctx.beginPath();
    ctx.moveTo(-6.4 * s, 1.2 * s);
    ctx.quadraticCurveTo(0, -5.4 * s, 6.4 * s, 1.2 * s);
    ctx.closePath();
    litFill(ctx, tunic, 0, -1 * s, 6 * s);
    ink(ctx, LINE_THIN + 0.3);
    ctx.fillStyle = elite ? P.gold : trim;
    ctx.fillRect(-6 * s, 0, 12 * s, 1.3 * s);
    ball(ctx, 3.2 * s, -1.4 * s, 1.1 * s, 1.1 * s, elite ? P.gold : trim, { line: 0.7 });
    ctx.restore();
  }
}

/** A soldier with per-type proportions and accessories, feet on the origin. */
function trooper(ctx: Ctx, o: Trooper, a: number, k: number): void {
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const px = -fy;
  const py = fx;
  const rx = o.rx ?? (o.slim ? 8.2 : 9.6);
  const ry = o.ry ?? 10.2;
  const hr = o.hr ?? 6.4;
  const w = rx / 9.6;
  const hs = hr / 6.4;
  const stride = STRIDE[k]! * (o.slim ? 1.3 : 1) * w;
  const bob = BOB[k]!;
  const lean = o.slim ? 1.5 : 0;
  const armK = o.arm ?? 1;
  ctx.save();
  ctx.scale(o.size, o.size);
  contact(ctx, 0, 0, 11 * w, 5 * w, 0.3);
  const spread = 3.8 * w;
  const feet = [
    { x: px * spread + fx * stride, y: (py * spread + fy * stride) * 0.5 },
    { x: -px * spread - fx * stride, y: (-py * spread - fy * stride) * 0.5 },
  ].sort((p, q) => p.y - q.y);
  for (const f of feet) ball(ctx, f.x, f.y - 1, 3.4 * w, 2.4 * w, P.ink, { line: 0, hi: 0.25 });
  const bx = fx * lean;
  const by = -(ry + 1.8) + bob;
  const armAt = (side: number): { x: number; y: number } => ({
    x: bx + px * side * (rx - 0.6) - fx * stride * 0.6 * side,
    y: by + py * side * (rx - 0.6) * 0.3,
  });
  const arm = (side: number): void => {
    const p = armAt(side);
    ball(ctx, p.x, p.y, 3.2 * armK, 4.2 * armK, o.tunic, { line: LINE_THIN + 0.2 });
    if (o.fists) ball(ctx, p.x + fx * 1.2, p.y + 3.6 * armK, 2.5 * armK, 2.3 * armK, o.skin, { line: LINE_THIN });
  };
  const hx = bx + fx * 1.2;
  const hy = by - (ry * 0.62 + hr * 0.72);
  const g: Geo = {
    fx,
    fy,
    px,
    py,
    bx,
    by,
    hx,
    hy,
    rx,
    ry,
    hr,
    bob,
    stride,
    k,
    hand: (side) => {
      const p = armAt(side);
      return { x: p.x + fx * 1.2, y: p.y + 3.6 * armK };
    },
  };
  o.behind?.(ctx, g);
  if (fy < 0) {
    arm(1);
    arm(-1);
  }
  ball(ctx, bx, by, rx, ry, o.tunic, { hi: 0.4 });
  ctx.save();
  ellipsePath(ctx, bx, by, rx, ry);
  ctx.clip();
  ctx.fillStyle = o.trim;
  ctx.fillRect(bx - rx - 1.5, by + 2 * (ry / 10.2), (rx + 1.5) * 2, 3 * (ry / 10.2));
  if (fy > -0.3) {
    for (const yy of [-5, -1.5]) {
      ellipsePath(ctx, bx + fx * 3.5 * w, by + yy * (ry / 10.2), 1.2 * w, 1.2 * w);
      ctx.fill();
    }
  }
  ctx.restore();
  if (o.elite && fy > -0.3) {
    ctx.fillStyle = P.stop;
    ctx.fillRect(bx + fx * 3 * w - 4.5 * w + px * 2, by - 6 * (ry / 10.2), 3 * w, 3 * w);
    ball(ctx, bx + fx * 3 * w - 3 * w + px * 2, by - 2 * (ry / 10.2), 1.7 * w, 1.7 * w, P.gold, { line: 0.8 });
  }
  o.onBody?.(ctx, g);
  if (fy >= 0) {
    arm(1);
    arm(-1);
  }
  ball(ctx, hx, hy, hr, hr * 0.94, o.skin, { line: LINE_THIN + 0.4 });
  if (fy > -0.35) {
    ctx.fillStyle = P.ink;
    for (const s of [-1, 1]) {
      ellipsePath(ctx, hx + fx * 2.6 * hs + px * s * 2.2 * hs, hy - hs + fy * 0.8, 0.9 * hs, 1.1 * hs);
      ctx.fill();
    }
    if (o.specs) {
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = o.elite ? P.gold : P.ink;
      for (const s of [-1, 1]) {
        ellipsePath(ctx, hx + fx * 2.6 * hs + px * s * 2.3 * hs, hy - hs + fy * 0.8, 2 * hs, 1.9 * hs);
        ctx.stroke();
      }
      ctx.fillStyle = alpha(P.glass, 0.35);
      for (const s of [-1, 1]) {
        ellipsePath(ctx, hx + fx * 2.6 * hs + px * s * 2.3 * hs, hy - hs + fy * 0.8, 1.7 * hs, 1.6 * hs);
        ctx.fill();
      }
    }
    if (o.tache === 'handlebar') handlebar(ctx, hx + fx * 2.8 * hs, hy + 2.6 * hs + fy * 0.5, fx, hs);
    else moustache(ctx, hx + fx * 2.8 * hs, hy + 2.6 * hs + fy * 0.5, fx);
  }
  hat(ctx, o.hat, hx, hy, fx, fy, px, hs, o.tunic, o.trim, o.elite, o.plume ?? 1);
  o.after?.(ctx, g);
  ctx.restore();
}

// ------------------------------------------------------------ new infantry

function sash(ctx: Ctx, g: Geo, colour: string): void {
  ctx.save();
  ellipsePath(ctx, g.bx, g.by, g.rx, g.ry);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(g.bx + g.px * g.rx * 0.9, g.by - g.ry * 0.85);
  ctx.lineTo(g.bx - g.px * g.rx * 0.9, g.by + g.ry * 0.7);
  ink(ctx, 6.4, P.ink);
  ink(ctx, 4.2, colour);
  ctx.restore();
}

const lummox: InfantryDraw = (ctx, elite, a, k) =>
  trooper(
    ctx,
    {
      tunic: elite ? P.maroonDark : P.maroon,
      trim: elite ? P.gold : P.mustard,
      skin: P.skin3,
      elite,
      size: 1.45,
      rx: 11.8,
      ry: 11.2,
      hr: 5.2,
      hat: 'basin',
      arm: 1.65,
      fists: true,
      tache: 'handlebar',
      onBody: (c, g) => sash(c, g, elite ? P.gold : P.mustard),
    },
    a,
    k,
  );

function umbrella(ctx: Ctx, g: Geo, elite: boolean, broken: boolean): void {
  const hand = g.hand(1);
  const cx = g.bx + g.fx * 1.5;
  const cy = g.hy - 18;
  const r = elite ? 19 : 17;
  const main = elite ? P.maroonDark : P.maroon;
  const stripe = elite ? P.gold : P.mustard;
  // Shaft from the hand up to the canopy.
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y + 2);
  ctx.quadraticCurveTo(hand.x - 1, hand.y + 5, hand.x - 3, hand.y + 3);
  ink(ctx, 3.2, P.ink);
  ink(ctx, 1.8, P.wood);
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y + 2);
  ctx.lineTo(cx, broken ? cy + 1 : cy);
  ink(ctx, 3, P.ink);
  ink(ctx, 1.6, P.wood);
  if (!broken) {
    // Canopy: a dome over a scalloped rim, panels alternating maroon and mustard.
    const dome = (): void => {
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.quadraticCurveTo(cx - r * 0.9, cy - r * 0.62, cx, cy - r * 0.68);
      ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 0.62, cx + r, cy);
      for (let i = 0; i < 8; i++) {
        const x0 = cx + r - (i * 2 * r) / 8;
        const x1 = cx + r - ((i + 1) * 2 * r) / 8;
        ctx.quadraticCurveTo((x0 + x1) / 2, cy + 3.4, x1, cy);
      }
      ctx.closePath();
    };
    dome();
    litFill(ctx, main, cx, cy - r * 0.3, r);
    ctx.save();
    dome();
    ctx.clip();
    for (let i = 0; i < 8; i += 2) {
      const x0 = cx - r + (i * 2 * r) / 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.7);
      ctx.lineTo(x0, cy + 4);
      ctx.lineTo(x0 + (2 * r) / 8, cy + 4);
      ctx.closePath();
      ctx.fillStyle = alpha(stripe, 0.9);
      ctx.fill();
    }
    ctx.restore();
    dome();
    ink(ctx, LINE_THIN + 0.5);
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.68);
      ctx.lineTo(cx - r + (i * 2 * r) / 8, cy);
      ink(ctx, 0.7, alpha(P.ink, 0.5));
    }
    glint(ctx, cx - r * 0.2, cy - r * 0.28, 3.2, 0.5);
    ball(ctx, cx, cy - r * 0.74, 1.8, 1.8, elite ? P.gold : P.brass, { line: 0.9 });
  } else {
    // Blown inside out: a ragged cup opening upwards, ribs splayed.
    const cup = (): void => {
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.05, cy - r * 0.9);
      ctx.quadraticCurveTo(cx - r * 0.5, cy + 1, cx, cy + 1.5);
      ctx.quadraticCurveTo(cx + r * 0.5, cy + 1, cx + r * 1.05, cy - r * 0.9);
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const x = cx + r * 1.05 - (i * 2.1 * r) / n;
        ctx.lineTo(x + (2.1 * r) / n / 2, cy - r * 0.72 + (i % 2 ? 3.5 : -1.5));
        ctx.lineTo(x, cy - r * 0.9 + (i % 3 === 0 ? 2 : 0));
      }
      ctx.closePath();
    };
    cup();
    litFill(ctx, tone(main, -0.15), cx, cy - r * 0.4, r);
    ctx.save();
    cup();
    ctx.clip();
    for (let i = 0; i < 6; i += 2) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx - r * 1.1 + (i * 2.2 * r) / 6, cy - r);
      ctx.lineTo(cx - r * 1.1 + ((i + 1) * 2.2 * r) / 6, cy - r);
      ctx.closePath();
      ctx.fillStyle = alpha(stripe, 0.85);
      ctx.fill();
    }
    ctx.restore();
    cup();
    ink(ctx, LINE_THIN + 0.5);
    for (const t of [-1, -0.45, 0.45, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 1.5);
      ctx.quadraticCurveTo(cx + t * r * 0.5, cy - r * 0.2, cx + t * r * 1.1, cy - r * (0.95 + Math.abs(t) * 0.1));
      ink(ctx, 1, P.ink);
    }
  }
}

function brollyGuard(ctx: Ctx, elite: boolean, a: number, k: number, broken: boolean): void {
  trooper(
    ctx,
    {
      tunic: elite ? P.maroonDark : P.maroon,
      trim: elite ? P.gold : P.mustard,
      skin: P.skin2,
      elite,
      size: 1,
      hat: 'cap',
      after: (c, g) => umbrella(c, g, elite, broken),
    },
    a,
    k,
  );
}

const sawbones: InfantryDraw = (ctx, elite, a, k) =>
  trooper(
    ctx,
    {
      tunic: elite ? P.maroonDark : P.maroon,
      trim: elite ? P.gold : P.mustard,
      skin: P.skin4,
      elite,
      size: 1,
      hat: 'fieldcap',
      specs: true,
      behind: (c, g) => {
        // Satchel on the hip, behind the body when facing away from us.
        if (g.fy >= 0) return;
        ball(c, g.bx - g.px * (g.rx - 1), g.by + 4, 4.4, 3.8, PU.satchel, { line: LINE_THIN + 0.2 });
      },
      onBody: (c, g) => {
        if (g.fy > -0.3) {
          // White apron over the tunic.
          c.save();
          ellipsePath(c, g.bx, g.by, g.rx, g.ry);
          c.clip();
          roundRectPath(c, g.bx + g.fx * 2.5 - 5.5, g.by - 5, 11, 16, 3);
          litFill(c, P.cream, g.bx, g.by, 8);
          ink(c, LINE_THIN);
          c.restore();
        }
        // Satchel strap across the chest, and the satchel itself when it faces us.
        c.save();
        ellipsePath(c, g.bx, g.by, g.rx, g.ry);
        c.clip();
        c.beginPath();
        c.moveTo(g.bx + g.px * g.rx, g.by - g.ry * 0.8);
        c.lineTo(g.bx - g.px * g.rx, g.by + g.ry * 0.5);
        ink(c, 3.4, P.ink);
        ink(c, 2, PU.satchel);
        c.restore();
        if (g.fy >= 0) ball(c, g.bx - g.px * (g.rx - 1), g.by + 4, 4.4, 3.8, PU.satchel, { line: LINE_THIN + 0.2 });
        if (elite) {
          for (const s of [-1, 1]) ball(c, g.bx + g.px * s * (g.rx - 2), g.by - g.ry * 0.78, 2.4, 1.5, P.gold, { line: 0.8 });
        }
      },
      after: (c, g) => {
        // A bandage roll in the leading hand.
        const h = g.hand(-1);
        c.save();
        c.translate(h.x + g.fx * 1.5, h.y);
        c.rotate(0.4);
        roundRectPath(c, -3, -2.2, 6, 4.4, 1.4);
        litFill(c, P.flowerWhite, 0, 0, 3);
        ink(c, LINE_THIN * 0.8);
        c.beginPath();
        c.moveTo(3, 0);
        c.quadraticCurveTo(6, 2, 5, 5);
        ink(c, 1.6, P.ink);
        ink(c, 0.9, P.flowerWhite);
        c.restore();
      },
    },
    a,
    k,
  );

const trio: InfantryDraw = (ctx, elite, a, k) => {
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const px = -fy;
  const py = fx;
  const coat = elite ? P.maroonDark : PU.coat;
  const trim = elite ? P.gold : P.mustard;
  const bob = BOB[k]!;
  const st = STRIDE[k]! * 0.8;
  contact(ctx, 0, 0, 14, 5.5, 0.3);
  // Six little feet shuffle out of step under one hem.
  const feet: { x: number; y: number }[] = [];
  [-6.5, 0, 6.5].forEach((off, i) => {
    const s = i % 2 ? -st : st;
    for (const side of [-1, 1]) {
      feet.push({ x: px * (off + side * 1.8) + fx * s * side, y: (py * (off + side * 1.8) + fy * s * side) * 0.5 });
    }
  });
  feet.sort((p, q) => p.y - q.y);
  for (const f of feet) ball(ctx, f.x, f.y - 0.8, 2.6, 1.9, P.ink, { line: 0, hi: 0.25 });
  const top = -38 + bob;
  const hem = -1.5;
  const sleeve = (side: number): void => ball(ctx, px * side * 11.5 - fx * st * 0.4 * side, -26 + bob + py * side * 11.5 * 0.3, 3.6, 6.2, coat, { line: LINE_THIN + 0.2 });
  if (fy < 0) {
    sleeve(1);
    sleeve(-1);
  }
  const coatPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-9.5, top + 3);
    ctx.quadraticCurveTo(0, top - 2.5, 9.5, top + 3);
    ctx.lineTo(13.5, hem - 3);
    ctx.quadraticCurveTo(0, hem + 3, -13.5, hem - 3);
    ctx.closePath();
  };
  coatPath();
  litFill(ctx, coat, 0, (top + hem) / 2, 20);
  ink(ctx, LINE);
  ctx.save();
  coatPath();
  ctx.clip();
  ctx.fillStyle = tone(coat, -0.3);
  ctx.fillRect(-15, -18 + bob, 30, 3);
  // Coat hem seam and a vent line down the back or front.
  ctx.beginPath();
  ctx.moveTo(fx * 3.5, top + 2);
  ctx.lineTo(fx * 3.5, hem);
  ink(ctx, 0.9, alpha(P.ink, 0.45));
  ctx.restore();
  if (fy > -0.3) {
    for (const y of [-32, -27, -13, -8]) ball(ctx, fx * 3.5 + px * 1.8, y + bob, 1.3, 1.3, trim, { line: 0.8 });
    // The middle soldier peeps out between the buttons.
    const ey = -21.5 + bob;
    roundRectPath(ctx, fx * 3.5 - 5.5, ey - 2.6, 11, 5.2, 2.6);
    ctx.fillStyle = P.ink;
    ctx.fill();
    for (const s of [-1, 1]) {
      ellipsePath(ctx, fx * 3.5 + s * 2.4, ey, 1.6, 1.5);
      ctx.fillStyle = P.cream;
      ctx.fill();
      ellipsePath(ctx, fx * 3.5 + s * 2.4 + fx * 0.6, ey + 0.2, 0.7, 0.8);
      ctx.fillStyle = P.ink;
      ctx.fill();
    }
    // Collar lapels.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(fx * 2 + s * 1.5, top + 1);
      ctx.lineTo(fx * 2 + s * 8, top + 3);
      ctx.lineTo(fx * 2 + s * 3, top + 9);
      ctx.closePath();
      ctx.fillStyle = elite ? P.gold : P.maroon;
      ctx.fill();
      ink(ctx, LINE_THIN * 0.8);
    }
  }
  if (fy >= 0) {
    sleeve(1);
    sleeve(-1);
  }
  // The top soldier, doing his best to look tall.
  const hx = fx * 1.2;
  const hy = top - 5;
  ball(ctx, hx, hy, 6.2, 5.8, P.skin1, { line: LINE_THIN + 0.4 });
  if (fy > -0.35) {
    ctx.fillStyle = P.ink;
    for (const s of [-1, 1]) {
      ellipsePath(ctx, hx + fx * 2.6 + px * s * 2.2, hy - 1 + fy * 0.8, 0.9, 1.1);
      ctx.fill();
    }
    handlebar(ctx, hx + fx * 2.8, hy + 2.6 + fy * 0.5, fx, 0.95);
  }
  hat(ctx, 'shako', hx, hy, fx, fy, px, 1, coat, trim, elite);
};

const tiddler: InfantryDraw = (ctx, elite, a, k) =>
  trooper(
    ctx,
    {
      tunic: elite ? P.maroon : P.maroonLight,
      trim: elite ? P.gold : P.mustard,
      skin: P.skin2,
      elite,
      size: 0.72,
      slim: true,
      hat: elite ? 'basin' : 'forage',
    },
    a,
    k,
  );

function drum(ctx: Ctx, g: Geo, elite: boolean): void {
  const cx = g.bx + g.fx * 7.5;
  const cy = g.by + 3 + g.fy * 2;
  ball(ctx, cx, cy, 10.2, 9.4, elite ? P.maroonDark : P.maroon, { hi: 0.35 });
  // Rope tensioners round the shell.
  ctx.save();
  ellipsePath(ctx, cx, cy, 10.2, 9.4);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 7.6 : 10;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r * 0.92;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = elite ? P.gold : P.mustard;
  ctx.stroke();
  ctx.restore();
  ellipsePath(ctx, cx, cy, 7.2, 6.6);
  litFill(ctx, P.cream, cx, cy, 7, 0.4, 0.25);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = elite ? P.gold : P.brass;
  ctx.stroke();
  ink(ctx, 0.8, alpha(P.ink, 0.6));
}

function beaters(ctx: Ctx, g: Geo): void {
  const cx = g.bx + g.fx * 7.5;
  const cy = g.by + 3 + g.fy * 2;
  for (const side of [-1, 1]) {
    const h = g.hand(side);
    const up = (g.k % 2 === 0) === side > 0;
    const tx = cx + side * 3;
    const ty = up ? cy - 14 : cy - 2;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(tx, ty);
    ink(ctx, 2.6, P.ink);
    ink(ctx, 1.4, P.wood);
    ball(ctx, tx, ty, 2.2, 2.2, P.cream, { line: 0.9 });
  }
}

const tubthumper: InfantryDraw = (ctx, elite, a, k) =>
  trooper(
    ctx,
    {
      tunic: elite ? P.maroonDark : P.maroon,
      trim: elite ? P.gold : P.mustard,
      skin: P.skin1,
      elite,
      size: 1,
      hat: 'shako',
      plume: 1.45,
      behind: (c, g) => {
        if (g.fy < -0.2) drum(c, g, elite);
      },
      onBody: (c, g) => {
        if (g.fy >= -0.2) drum(c, g, elite);
        if (elite) for (const s of [-1, 1]) ball(c, g.bx + g.px * s * (g.rx - 2), g.by - g.ry * 0.78, 2.6, 1.6, P.gold, { line: 0.8 });
      },
      after: (c, g) => {
        if (g.fy >= -0.2) beaters(c, g);
      },
    },
    a,
    k,
  );

// ------------------------------------------------------------ volume helpers

interface V2 {
  x: number;
  y: number;
}

/** Ground-plane → screen for facing a (tilted). */
function proj(a: number, lx: number, ly: number): V2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: lx * c - ly * s, y: (lx * s + ly * c) * TILT };
}

/** A local point at height h, on screen. */
function at(a: number, lx: number, ly: number, h = 0): V2 {
  const p = proj(a, lx, ly);
  return { x: p.x, y: p.y - h };
}

/** Adds an ellipse with conjugate semi-axes u, v (screen) centred at c to the current path. */
function ellAxes(ctx: Ctx, c: V2, u: V2, v: V2): void {
  ctx.save();
  // An edge-on disc is a line; nudge it so the transform stays invertible.
  const det = u.x * v.y - u.y * v.x;
  ctx.transform(u.x + (Math.abs(det) < 1e-3 ? 1e-2 : 0), u.y, v.x, v.y, c.x, c.y);
  ctx.moveTo(1, 0);
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

/** Linear light→dark gradient across a region, light from the top left. */
function sideGrad(ctx: Ctx, c: V2, ext: number, base: string, hi = 0.35, lo = 0.4): CanvasGradient {
  const g = ctx.createLinearGradient(c.x - ext * 0.75, c.y - ext * 0.75, c.x + ext * 0.75, c.y + ext * 0.75);
  g.addColorStop(0, tone(base, hi));
  g.addColorStop(0.45, base);
  g.addColorStop(1, tone(base, -lo));
  return g;
}

interface Cyl {
  lx: number;
  ly: number;
  /** Height of the axis above the ground. */
  h: number;
  /** Local unit axis direction. */
  ax: number;
  ay: number;
  r: number;
  hl: number;
  side: string;
  /** Cap colour at the −axis end and at the +axis end. */
  capA: string;
  capB: string;
  line?: number;
  /** Surface lines along the axis (rotating rollers, drums), phase in radians. */
  stripes?: { n: number; phase: number; colour: string };
  capDetail?: (c: V2, u: V2, v: V2, isB: boolean) => void;
}

/** A horizontal cylinder: the hull of its two end ellipses, with the visible cap on top. */
function hcyl(ctx: Ctx, a: number, o: Cyl): void {
  const nx = -o.ay;
  const ny = o.ax;
  const u = proj(a, nx * o.r, ny * o.r);
  const v = { x: 0, y: -o.r };
  const cA = at(a, o.lx - o.ax * o.hl, o.ly - o.ay * o.hl, o.h);
  const cB = at(a, o.lx + o.ax * o.hl, o.ly + o.ay * o.hl, o.h);
  const bNear = proj(a, o.ax, o.ay).y >= 0;
  const near = bNear ? cB : cA;
  const far = bNear ? cA : cB;
  // Support point of the end ellipse perpendicular to the on-screen axis.
  const dx = cB.x - cA.x;
  const dy = cB.y - cA.y;
  const dl = Math.hypot(dx, dy) || 1;
  const qx = -dy / dl;
  const qy = dx / dl;
  const t = Math.atan2(qx * v.x + qy * v.y, qx * u.x + qy * u.y);
  const p = { x: u.x * Math.cos(t) + v.x * Math.sin(t), y: u.y * Math.cos(t) + v.y * Math.sin(t) };
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(cA.x + p.x, cA.y + p.y);
    ctx.lineTo(cB.x + p.x, cB.y + p.y);
    ctx.lineTo(cB.x - p.x, cB.y - p.y);
    ctx.lineTo(cA.x - p.x, cA.y - p.y);
    ctx.closePath();
  };
  const lw = o.line ?? LINE;
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw * 2;
  ctx.strokeStyle = P.ink;
  ctx.beginPath();
  ellAxes(ctx, far, u, v);
  ctx.stroke();
  body();
  ctx.stroke();
  ctx.beginPath();
  ellAxes(ctx, near, u, v);
  ctx.stroke();
  const mid = { x: (cA.x + cB.x) / 2, y: (cA.y + cB.y) / 2 };
  const g = sideGrad(ctx, mid, Math.max(o.r * 1.3, dl * 0.4), o.side);
  ctx.fillStyle = g;
  ctx.beginPath();
  ellAxes(ctx, far, u, v);
  ctx.fill();
  body();
  ctx.fill();
  if (o.stripes) {
    // World-y of the local perpendicular decides which surface lines face the camera.
    const perpY = nx * Math.sin(a) + ny * Math.cos(a);
    for (let i = 0; i < o.stripes.n; i++) {
      const th = o.stripes.phase + (i * Math.PI * 2) / o.stripes.n;
      if (perpY * Math.cos(th) + TILT * Math.sin(th) <= 0.05) continue;
      const w = { x: u.x * Math.cos(th) + v.x * Math.sin(th), y: u.y * Math.cos(th) + v.y * Math.sin(th) };
      ctx.beginPath();
      ctx.moveTo(far.x + w.x, far.y + w.y);
      ctx.lineTo(near.x + w.x, near.y + w.y);
      ink(ctx, 1.3, o.stripes.colour);
    }
  }
  ctx.beginPath();
  ellAxes(ctx, near, u, v);
  litFill(ctx, bNear ? o.capB : o.capA, near.x, near.y, o.r);
  ink(ctx, lw * 0.75);
  o.capDetail?.(near, u, v, bNear);
}

/** A spheroid (semi-axes L along the facing, R across, Rv up) by its exact projected ellipse. */
function spheroid(ctx: Ctx, a: number, lx: number, ly: number, h: number, L: number, R: number, Rv: number, base: string, opts: { hi?: number; lo?: number; line?: number } = {}): () => void {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const s11 = c * c * L * L + s * s * R * R;
  const s12 = c * s * TILT * (L * L - R * R);
  const s22 = s * s * TILT * TILT * L * L + c * c * TILT * TILT * R * R + Rv * Rv;
  const b11 = Math.sqrt(s11);
  const b21 = s12 / b11;
  const b22 = Math.sqrt(Math.max(1e-6, s22 - b21 * b21));
  const o = at(a, lx, ly, h);
  const path = (): void => {
    ctx.save();
    ctx.transform(b11, b21, 0, b22, o.x, o.y);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
  };
  const ex = b11;
  const ey = Math.sqrt(b21 * b21 + b22 * b22);
  const r = Math.max(ex, ey);
  const g = ctx.createRadialGradient(o.x - ex * 0.42, o.y - ey * 0.48, r * 0.05, o.x + ex * 0.12, o.y + ey * 0.1, r * 1.15);
  g.addColorStop(0, tone(base, opts.hi ?? 0.45));
  g.addColorStop(0.5, base);
  g.addColorStop(1, tone(base, -(opts.lo ?? 0.4)));
  path();
  ctx.fillStyle = g;
  ctx.fill();
  if (opts.line !== 0) ink(ctx, opts.line ?? LINE);
  return path;
}

/** The camera-facing half of a ring round a horizontal axis (bands on balloons and boilers). */
function ringArc(ctx: Ctx, a: number, lx: number, ly: number, h: number, ax: number, ay: number, rr: number, rv: number, colour: string, width: number): void {
  const nx = -ay;
  const ny = ax;
  const u = proj(a, nx * rr, ny * rr);
  const c = at(a, lx, ly, h);
  const perpY = nx * Math.sin(a) + ny * Math.cos(a);
  const n = 40;
  const pts: V2[][] = [[]];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const vis = perpY * Math.cos(t) + TILT * Math.sin(t) > 0;
    if (!vis) {
      if (pts[pts.length - 1]!.length) pts.push([]);
      continue;
    }
    pts[pts.length - 1]!.push({ x: c.x + u.x * Math.cos(t), y: c.y + u.y * Math.cos(t) - rv * Math.sin(t) });
  }
  for (const seg of pts) {
    if (seg.length < 2) continue;
    ctx.beginPath();
    seg.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ink(ctx, width + 1.6, P.ink);
    ink(ctx, width, colour);
  }
}

/**
 * Extrudes a ground-plane footprint straight up the screen by h (1-unit slices), with
 * an ink silhouette and a lit top. `sideAt` can colour individual slices (stripes).
 */
function prism(ctx: Ctx, a: number, path: () => void, h: number, top: string, side: string, extent: number, sideAt?: (i: number) => string | undefined): void {
  const slice = (i: number): void => {
    ctx.save();
    ctx.translate(0, -i);
    ctx.scale(1, TILT);
    ctx.rotate(a);
    path();
    ctx.restore();
  };
  ctx.lineJoin = 'round';
  for (let i = 0; i <= h; i++) {
    slice(i);
    ctx.lineWidth = LINE * 2;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
  }
  for (let i = 0; i <= h; i++) {
    slice(i);
    ctx.fillStyle = sideAt?.(i) ?? (i === 0 ? tone(side, -0.25) : side);
    ctx.fill();
  }
  slice(h);
  litFill(ctx, top, 0, -h, extent);
  ink(ctx, LINE_THIN + 0.4);
}

interface Slab {
  lx: number;
  ly: number;
  w: number;
  d: number;
  /** Height of the slab's base above the ground. */
  z: number;
  hgt: number;
  top: string;
  side: string;
  r?: number;
  sideAt?: (i: number) => string | undefined;
}

function slab(ctx: Ctx, a: number, o: Slab): void {
  ctx.save();
  ctx.translate(0, -o.z);
  prism(ctx, a, () => roundRectPath(ctx, o.lx - o.w / 2, o.ly - o.d / 2, o.w, o.d, o.r ?? 2), o.hgt, o.top, o.side, Math.max(o.w, o.d) / 2, o.sideAt);
  ctx.restore();
}

function hull(points: V2[]): V2[] {
  const p = points.slice().sort((m, n) => m.x - n.x || m.y - n.y);
  const cross = (o: V2, q: V2, r: V2): number => (q.x - o.x) * (r.y - o.y) - (q.y - o.y) * (r.x - o.x);
  const lower: V2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: V2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** A cone lying along the facing, from a base disc at lx0 to a tip at lx1 (drills). */
function cone(ctx: Ctx, a: number, lx0: number, lx1: number, h: number, r: number, colour: string, phase: number, groove: string): void {
  const c = at(a, lx0, 0, h);
  const tip = at(a, lx1, 0, h);
  const u = proj(a, 0, r);
  const v = { x: 0, y: -r };
  const pts: V2[] = [tip];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    pts.push({ x: c.x + u.x * Math.cos(t) + v.x * Math.sin(t), y: c.y + u.y * Math.cos(t) + v.y * Math.sin(t) });
  }
  const hl = hull(pts);
  const path = (): void => {
    ctx.beginPath();
    hl.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  };
  path();
  ctx.lineWidth = LINE * 2;
  ctx.strokeStyle = P.ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = sideGrad(ctx, { x: (c.x + tip.x) / 2, y: (c.y + tip.y) / 2 }, Math.max(r * 1.4, 10), colour);
  ctx.fill();
  const perpY = Math.cos(a);
  ctx.save();
  path();
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    const th = phase + (i * Math.PI) / 3;
    if (perpY * Math.cos(th) + TILT * Math.sin(th) <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(c.x + u.x * Math.cos(th) + v.x * Math.sin(th), c.y + u.y * Math.cos(th) + v.y * Math.sin(th));
    ctx.quadraticCurveTo(
      (c.x + tip.x) / 2 + (u.x * Math.cos(th + 0.8) + v.x * Math.sin(th + 0.8)) * 0.55,
      (c.y + tip.y) / 2 + (u.y * Math.cos(th + 0.8) + v.y * Math.sin(th + 0.8)) * 0.55,
      tip.x,
      tip.y,
    );
    ink(ctx, 1.3, groove);
  }
  ctx.restore();
  // The base disc shows when the drill points away from us.
  if (proj(a, -1, 0).y > 0) {
    ctx.beginPath();
    ellAxes(ctx, c, u, v);
    litFill(ctx, tone(colour, -0.2), c.x, c.y, r);
    ink(ctx, LINE_THIN + 0.4);
  }
}

/** A crewman standing upright at a screen point (drivers, commanders). */
function crewman(ctx: Ctx, x: number, y: number, fx: number, skin: string, capColour: string, elite: boolean, fur = false): void {
  ball(ctx, x, y - 5, 5.2, 5.4, P.maroon, { line: LINE_THIN + 0.3 });
  ball(ctx, x, y - 12, 4.6, 4.3, skin, { line: LINE_THIN + 0.3 });
  if (fur) {
    ball(ctx, x, y - 16, 5.4, 3.8, PU.fur, { line: LINE_THIN + 0.3, hi: 0.3 });
    dabs(ctx, seeded(9), x - 5, y - 19, 10, 6, 6, PU.furDark, 1, 0.5);
  } else {
    ball(ctx, x, y - 15.5, 5, 2.8, capColour, { line: LINE_THIN + 0.3 });
    ctx.fillStyle = elite ? P.gold : P.mustard;
    ctx.fillRect(x - 4.6, y - 15.2, 9.2, 1.3);
  }
  handlebar(ctx, x + fx * 1.2, y - 9.6, fx, 0.6);
}

// ------------------------------------------------------------ vehicles and air





/** Tail fins for a lighter-than-air envelope of half-length L and radius R centred at height h. */
function fins(ctx: Ctx, a: number, L: number, R: number, h: number, colour: string, bottom: boolean): void {
  const x0 = -L * 0.72;
  const x1 = -L * 1.08;
  const draw = (pts: V2[]): void => {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    litFill(ctx, colour, pts[0]!.x, pts[0]!.y, R);
    ink(ctx, LINE_THIN + 0.4);
  };
  const parts: { d: number; f: () => void }[] = [];
  for (const side of [-1, 1]) {
    parts.push({
      d: proj(a, x1, side * R).y,
      f: () => draw([at(a, x0, side * R * 0.35, h), at(a, x1, side * R * 1.35, h), at(a, x1 + 3, side * R * 0.25, h)]),
    });
  }
  parts.push({ d: proj(a, x1, 0).y - 0.5, f: () => draw([at(a, x0, 0, h + R * 0.4), at(a, x1, 0, h + R * 1.35), at(a, x1 + 3, 0, h + 2)]) });
  if (bottom) parts.push({ d: proj(a, x1, 0).y + 0.5, f: () => draw([at(a, x0, 0, h - R * 0.4), at(a, x1, 0, h - R * 1.25), at(a, x1 + 3, 0, h - 2)]) });
  parts.sort((m, n) => m.d - n.d).forEach((p) => p.f());
}

function propeller(ctx: Ctx, c: V2, k: number, r: number): void {
  ellipsePath(ctx, c.x, c.y, r, r * 0.9);
  ctx.fillStyle = alpha(P.steelLight, 0.2);
  ctx.fill();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = alpha(P.ink, 0.35);
  ctx.stroke();
  for (const off of [0, Math.PI]) {
    const t = k * 1.2 + off;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(t) * r, c.y + Math.sin(t) * r * 0.9);
    ink(ctx, 2.4, P.ink);
    ink(ctx, 1.2, P.wood);
  }
  ball(ctx, c.x, c.y, 1.4, 1.4, P.brass, { line: 0.8 });
}

/** Gasbag: a heavy barrage-balloon blimp with a gondola. Air (16 facings, 2 frames). */
export function gasbag(ctx: Ctx, a: number, k: number, elite: boolean): void {
  const env = elite ? PU.envelopeDark : P.maroon;
  const band = elite ? P.gold : P.mustard;
  const bob = k ? -1 : 0;
  const L = elite ? 34 : 31;
  const R = elite ? 14 : 13;
  const h = 30 + bob;
  const tailFar = proj(a, -1, 0).y < 0;
  // Gondola below, on ropes.
  const gz = 8 + bob;
  const rope = (lx: number, ly: number): void => {
    const p = at(a, lx, ly, gz + 6);
    const q = at(a, lx * 0.8, ly * 0.4, h - R * 0.85);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ink(ctx, 0.9, alpha(P.ink, 0.8));
  };
  for (const [lx, ly] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) rope(lx!, ly!);
  slab(ctx, a, { lx: 0, ly: 0, w: 14, d: 8, z: gz, hgt: 5, top: P.wood, side: P.woodDark, r: 2.5 });
  const pilot = at(a, 1, 0, gz + 5);
  ball(ctx, pilot.x, pilot.y - 2.5, 2.8, 2.6, P.skin3, { line: LINE_THIN });
  ball(ctx, pilot.x, pilot.y - 4.6, 3, 1.7, elite ? P.gold : P.khaki, { line: LINE_THIN });
  propeller(ctx, at(a, -8.5, 0, gz + 3), k, 3.6);
  if (tailFar) fins(ctx, a, L, R, h, band, false);
  const path = spheroid(ctx, a, 0, 0, h, L, R, R, env, { hi: 0.5 });
  ctx.save();
  path();
  ctx.clip();
  const o = at(a, 0, 0, h);
  dabs(ctx, seeded(elite ? 31 : 30), o.x - L, o.y - R, L * 2, R * 2, 10, P.ink, 2.2, 0.12);
  ctx.restore();
  for (const x of elite ? [-16, -4, 8, 20] : [-12, 10]) {
    const rr = R * Math.sqrt(Math.max(0, 1 - (x / L) * (x / L)));
    ringArc(ctx, a, x, 0, h, 1, 0, rr, rr, band, elite ? 2.2 : 1.8);
  }
  if (!tailFar) fins(ctx, a, L, R, h, band, false);
  glint(ctx, o.x - 6, o.y - R * 0.55, 7, 0.4);
}

// ------------------------------------------------------------ bosses

interface Layered {
  d: number;
  draw: () => void;
}

function paintLayers(parts: Layered[]): void {
  parts.sort((m, n) => m.d - n.d).forEach((p) => p.draw());
}

/** A wheel: a short cylinder across the facing, with a coloured hub and spokes. */
function wheel(ctx: Ctx, a: number, lx: number, ly: number, r: number, w: number, tyre: string, hub: string, spin: number, rim: string): void {
  hcyl(ctx, a, {
    lx,
    ly,
    h: r,
    ax: 0,
    ay: 1,
    r,
    hl: w / 2,
    side: tyre,
    capA: hub,
    capB: hub,
    line: LINE_THIN + 0.6,
    capDetail: (c, u, v) => {
      for (let i = 0; i < 6; i++) {
        const t = spin + (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + (u.x * Math.cos(t) + v.x * Math.sin(t)) * 0.85, c.y + (u.y * Math.cos(t) + v.y * Math.sin(t)) * 0.85);
        ink(ctx, 1.5, P.ink);
      }
      ctx.beginPath();
      ellAxes(ctx, c, { x: u.x * 0.85, y: u.y * 0.85 }, { x: v.x * 0.85, y: v.y * 0.85 });
      ink(ctx, 1.4, rim);
      ctx.beginPath();
      ellAxes(ctx, c, { x: u.x * 0.25, y: u.y * 0.25 }, { x: v.x * 0.25, y: v.y * 0.25 });
      ctx.fillStyle = rim;
      ctx.fill();
      ink(ctx, 0.8);
    },
  });
}

/** Old Flattener: a steamroller with a brass whistle (Zone 1 boss). */
export function flattener(ctx: Ctx, a: number, k: number, elite: boolean): void {
  const S = 1.2;
  ctx.save();
  ctx.scale(S, S);
  const body = elite ? P.maroonDark : P.maroon;
  const brass = elite ? P.gold : P.brass;
  const bob = k ? -0.6 : 0;
  const fx = Math.cos(a);
  contact(ctx, 2, 2, 32, 16, 0.35);
  const d = (lx: number, ly: number): number => proj(a, lx, ly).y;
  const low: Layered[] = [];
  for (const side of [-1, 1]) low.push({ d: d(-17, side * 15), draw: () => wheel(ctx, a, -17, side * 15, 12.5, 4, P.gunmetal, P.stop, k * 0.5, brass) });
  low.push({ d: d(-19, 0) - 0.5, draw: () => slab(ctx, a, { lx: -19, ly: 0, w: 20, d: 22, z: 9 + bob, hgt: 5, top: P.woodDark, side: tone(P.woodDark, -0.2) }) });
  low.push({
    d: d(-3, 0),
    draw: () => {
      hcyl(ctx, a, { lx: -3, ly: 0, h: 19 + bob, ax: 1, ay: 0, r: 10, hl: 15, side: body, capA: tone(body, -0.1), capB: PU.soot, capDetail: (c, u, v, isB) => {
        if (!isB) return;
        ctx.beginPath();
        ellAxes(ctx, c, { x: u.x * 0.6, y: u.y * 0.6 }, { x: v.x * 0.6, y: v.y * 0.6 });
        ink(ctx, 1.6, brass);
        ball(ctx, c.x, c.y, 1.6, 1.6, brass, { line: 0.8 });
      } });
      for (const x of [-12, 0, 10]) ringArc(ctx, a, -3 + x, 0, 19 + bob, 1, 0, 10.2, 10.2, brass, 1.8);
    },
  });
  low.push({
    d: d(24, 0),
    draw: () => {
      slab(ctx, a, { lx: 15, ly: 0, w: 8, d: 10, z: 20 + bob, hgt: 3, top: body, side: tone(body, -0.25) });
      hcyl(ctx, a, { lx: 24, ly: 0, h: 12, ax: 0, ay: 1, r: 12, hl: 16, side: PU.roller, capA: P.steelLight, capB: P.steelLight, stripes: { n: 6, phase: k * 0.5, colour: alpha(P.ink, 0.45) }, capDetail: (c, u, v) => {
        ctx.beginPath();
        ellAxes(ctx, c, { x: u.x * 0.7, y: u.y * 0.7 }, { x: v.x * 0.7, y: v.y * 0.7 });
        ink(ctx, 1.6, brass);
      } });
    },
  });
  paintLayers(low);
  // Upper works: chimney, the cab on its posts, the driver and the whistle.
  const high: Layered[] = [];
  high.push({
    d: d(9, 0),
    draw: () => {
      const b = at(a, 9, 0, 28 + bob);
      cylinder(ctx, b.x, b.y, 4.2, 3.2, 17, P.ink, P.gunmetal, LINE_THIN + 0.6);
      ellipsePath(ctx, b.x, b.y - 17, 5.4, 4);
      ink(ctx, 2.6, brass);
    },
  });
  high.push({
    d: d(-4, 0),
    draw: () => {
      const b = at(a, -4, 0, 29 + bob);
      cylinder(ctx, b.x, b.y, 1.8, 1.4, 7, brass, brass, LINE_THIN);
      ball(ctx, b.x, b.y - 8.5, 2.4, 1.8, brass, { line: LINE_THIN });
    },
  });
  high.push({
    d: d(-19, 0),
    draw: () => {
      const posts: [number, number][] = [
        [-28, -10],
        [-28, 10],
        [-11, -10],
        [-11, 10],
      ];
      const post = (lx: number, ly: number): void => {
        const p = at(a, lx, ly, 14 + bob);
        const q = at(a, lx, ly, 41 + bob);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ink(ctx, 3.4, P.ink);
        ink(ctx, 1.8, brass);
      };
      const sorted = posts.slice().sort((m, n) => d(m[0], m[1]) - d(n[0], n[1]));
      post(...sorted[0]!);
      post(...sorted[1]!);
      const drv = at(a, -19, 0, 14 + bob);
      crewman(ctx, drv.x, drv.y, fx, P.skin1, body, elite);
      post(...sorted[2]!);
      post(...sorted[3]!);
      slab(ctx, a, { lx: -19.5, ly: 0, w: 22, d: 25, z: 41 + bob, hgt: 3, top: body, side: brass, r: 3 });
    },
  });
  paintLayers(high);
  ctx.restore();
}

/** Dune Dredger: a sand crawler with a drill and a rear hatch (Zone 2 boss). */
export function dredger(ctx: Ctx, a: number, k: number, elite: boolean): void {
  const S = 1.15;
  ctx.save();
  ctx.scale(S, S);
  const body = elite ? P.maroonDark : P.maroon;
  const stripe = elite ? P.gold : P.mustard;
  const fx = Math.cos(a);
  contact(ctx, 0, 2, 34, 17, 0.35);
  const d = (lx: number, ly: number): number => proj(a, lx, ly).y;
  const parts: Layered[] = [];
  for (const side of [-1, 1]) {
    parts.push({
      d: d(0, side * 15),
      draw: () => {
        slab(ctx, a, { lx: 0, ly: side * 15, w: 60, d: 9, z: 0, hgt: 10, top: PU.sandDark, side: P.tyre, r: 4 });
        // Tread plates crawl along the top.
        ctx.save();
        ctx.translate(0, -10);
        ctx.scale(1, TILT);
        ctx.rotate(a);
        for (let x = -27 + (k ? 3 : 0); x <= 27; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, side * 15 - 4);
          ctx.lineTo(x, side * 15 + 4);
          ink(ctx, 1.2, alpha(P.ink, 0.6));
        }
        ctx.restore();
      },
    });
  }
  parts.push({
    d: d(-2, 0),
    draw: () => {
      ctx.save();
      ctx.translate(0, -8);
      prism(
        ctx,
        a,
        () => {
          ctx.beginPath();
          ctx.moveTo(-30, -12);
          ctx.lineTo(17, -12);
          ctx.lineTo(25, -7);
          ctx.lineTo(25, 7);
          ctx.lineTo(17, 12);
          ctx.lineTo(-30, 12);
          ctx.closePath();
        },
        15,
        PU.sand,
        body,
        26,
        (i) => (i >= 10 && i <= 12 ? stripe : undefined),
      );
      ctx.restore();
      // Rear hatch on the back face when it faces us.
      if (proj(a, -1, 0).y > 0.05) {
        const q = [at(a, -30.5, -6, 10), at(a, -30.5, 6, 10), at(a, -30.5, 6, 20), at(a, -30.5, -6, 20)];
        ctx.beginPath();
        q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        litFill(ctx, tone(body, -0.2), q[0]!.x, q[0]!.y, 8);
        ink(ctx, LINE_THIN + 0.4);
        for (const p of [at(a, -30.6, -4.5, 12), at(a, -30.6, -4.5, 18)]) ball(ctx, p.x, p.y, 1.3, 1.3, stripe, { line: 0.7 });
      }
    },
  });
  parts.push({
    d: d(34, 0),
    draw: () => cone(ctx, a, 25, 44, 15, 9, elite ? P.gold : P.steel, k * 0.5, alpha(P.ink, 0.55)),
  });
  paintLayers(parts);
  const high: Layered[] = [];
  high.push({ d: d(-14, 0), draw: () => slab(ctx, a, { lx: -14, ly: 0, w: 24, d: 17, z: 23, hgt: 9, top: body, side: PU.sand, r: 3 }) });
  for (const side of [-1, 1]) {
    high.push({
      d: d(-26, side * 7) + 0.1,
      draw: () => {
        const b = at(a, -26, side * 7, 23);
        cylinder(ctx, b.x, b.y, 2.2, 1.7, 11, PU.sootDark, P.gunmetal, LINE_THIN);
      },
    });
  }
  high.push({
    d: d(-10, 0) + 0.2,
    draw: () => {
      const b = at(a, -10, 0, 32);
      cylinder(ctx, b.x, b.y, 6, 4.5, 5, P.steelDark, P.steel, LINE_THIN + 0.4);
      crewman(ctx, b.x, b.y - 3, fx, P.skin2, P.khaki, elite);
      ctx.fillStyle = P.glass;
      ellipsePath(ctx, b.x + fx * 1.5 - 1.8, b.y - 15, 1.4, 1.1);
      ctx.fill();
      ellipsePath(ctx, b.x + fx * 1.5 + 1.8, b.y - 15, 1.4, 1.1);
      ctx.fill();
    },
  });
  paintLayers(high);
  ctx.restore();
}

/** Glacier Grinder: an icebreaker on sledge runners (Zone 3 boss). */
export function grinder(ctx: Ctx, a: number, k: number, elite: boolean): void {
  const S = 1.15;
  ctx.save();
  ctx.scale(S, S);
  const body = elite ? P.maroonDark : P.maroon;
  const trim = elite ? P.gold : P.mustard;
  const fx = Math.cos(a);
  contact(ctx, 2, 2, 32, 15, 0.3);
  const d = (lx: number, ly: number): number => proj(a, lx, ly).y;
  const parts: Layered[] = [];
  for (const side of [-1, 1]) {
    parts.push({
      d: d(0, side * 12),
      draw: () => {
        slab(ctx, a, { lx: 0, ly: side * 12, w: 62, d: 3.4, z: 0, hgt: 2, top: P.steelLight, side: P.steel, r: 1.5 });
        const p = at(a, 30, side * 12, 2);
        const q = at(a, 39, side * 12, 11);
        const m = at(a, 38, side * 12, 2);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(m.x, m.y, q.x, q.y);
        ink(ctx, 4.4, P.ink);
        ink(ctx, 2.2, P.steelLight);
      },
    });
  }
  parts.push({
    d: d(-2, 0),
    draw: () => {
      ctx.save();
      ctx.translate(0, -3);
      prism(
        ctx,
        a,
        () => {
          ctx.beginPath();
          ctx.moveTo(-28, -13);
          ctx.lineTo(18, -13);
          ctx.quadraticCurveTo(34, -5, 36, 0);
          ctx.quadraticCurveTo(34, 5, 18, 13);
          ctx.lineTo(-28, 13);
          ctx.closePath();
        },
        15,
        P.woodDark,
        PU.hull,
        26,
        (i) => (i <= 2 ? PU.iceBlue : i >= 9 && i <= 11 ? body : undefined),
      );
      ctx.restore();
      // Icicles along the near edge of the hull.
      const nearSide = proj(a, 0, 1).y >= 0 ? 1 : -1;
      for (let x = -24; x <= 12; x += 6) {
        const p = at(a, x, nearSide * 13.2, 5);
        ctx.beginPath();
        ctx.moveTo(p.x - 1.6, p.y);
        ctx.lineTo(p.x, p.y + 4.5 + ((x / 6) % 2 ? 1.5 : 0));
        ctx.lineTo(p.x + 1.6, p.y);
        ctx.closePath();
        ctx.fillStyle = PU.iceWhite;
        ctx.fill();
        ink(ctx, 0.8, alpha(P.ink, 0.6));
      }
    },
  });
  parts.push({
    d: d(34, 0),
    draw: () =>
      hcyl(ctx, a, {
        lx: 33,
        ly: 0,
        h: 8,
        ax: 0,
        ay: 1,
        r: 7.5,
        hl: 11,
        side: elite ? P.gold : P.steel,
        capA: P.steelLight,
        capB: P.steelLight,
        stripes: { n: 8, phase: k * 0.4, colour: PU.iceWhite },
      }),
  });
  paintLayers(parts);
  const high: Layered[] = [];
  high.push({
    d: d(-16, 0),
    draw: () => {
      slab(ctx, a, { lx: -16, ly: 0, w: 18, d: 16, z: 18, hgt: 10, top: PU.hull, side: PU.hull, r: 2 });
      // A row of warm window lights on the near long side.
      const nearSide = proj(a, 0, 1).y >= 0 ? 1 : -1;
      for (const x of [-21, -16, -11]) {
        const p = at(a, x, nearSide * 8.2, 24);
        ellipsePath(ctx, p.x, p.y, 1.8, 1.8);
        ctx.fillStyle = PU.window;
        ctx.fill();
        ink(ctx, 0.8);
      }
      slab(ctx, a, { lx: -16, ly: 0, w: 21, d: 19, z: 28, hgt: 2, top: body, side: trim, r: 3 });
      const cap = at(a, -16, 0, 30);
      crewman(ctx, cap.x, cap.y, fx, P.skin1, body, elite, true);
    },
  });
  high.push({
    d: d(3, 0),
    draw: () => {
      const b = at(a, 3, 0, 18);
      cylinder(ctx, b.x, b.y, 5, 3.8, 16, PU.sootDark, body, LINE_THIN + 0.6);
      ctx.fillStyle = trim;
      ctx.fillRect(b.x - 5, b.y - 12, 10, 2.4);
      ink(ctx, 0.1, P.ink);
      dabs(ctx, seeded(3), b.x - 5, b.y - 20, 10, 5, 5, PU.soot, 1.6, 0.6);
    },
  });
  paintLayers(high);
  ctx.restore();
}

/** Smogmother: a sooty zeppelin that drops Tin Kettles (Zone 4 air boss). */
export function smogmother(ctx: Ctx, a: number, k: number, elite: boolean): void {
  const S = 1.1;
  ctx.save();
  ctx.scale(S, S);
  const env = PU.envelope;
  const band = elite ? P.gold : P.mustard;
  const bob = k ? -1 : 0;
  const L = 46;
  const R = 16;
  const h = 38 + bob;
  const tailFar = proj(a, -1, 0).y < 0;
  // Gondola and its propellers hang below the envelope.
  const gz = 12 + bob;
  for (const [lx, ly] of [[-10, -4], [10, -4], [-10, 4], [10, 4]]) {
    const p = at(a, lx!, ly!, gz + 8);
    const q = at(a, lx! * 1.1, ly! * 0.5, h - R * 0.9);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ink(ctx, 1.2, alpha(P.ink, 0.8));
  }
  slab(ctx, a, { lx: 0, ly: 0, w: 32, d: 11, z: gz, hgt: 8, top: P.gunmetal, side: P.steelDark, r: 3 });
  const nearSide = proj(a, 0, 1).y >= 0 ? 1 : -1;
  for (const x of [-10, -4, 2, 8]) {
    const p = at(a, x, nearSide * 5.7, gz + 4.5);
    roundRectPath(ctx, p.x - 1.8, p.y - 1.6, 3.6, 3.2, 1);
    ctx.fillStyle = PU.window;
    ctx.fill();
    ink(ctx, 0.8);
  }
  if (elite) {
    ctx.save();
    ctx.translate(0, -(gz + 8));
    ctx.scale(1, TILT);
    ctx.rotate(a);
    roundRectPath(ctx, -16, -5.5, 32, 11, 3);
    ink(ctx, 1.4, P.gold);
    ctx.restore();
  }
  for (const side of [-1, 1]) propeller(ctx, at(a, -18, side * 7, gz + 4), k, 4.2);
  if (tailFar) fins(ctx, a, L, R, h, band, true);
  const path = spheroid(ctx, a, 0, 0, h, L, R, R, env, { hi: 0.4, lo: 0.45 });
  ctx.save();
  path();
  ctx.clip();
  const o = at(a, 0, 0, h);
  dabs(ctx, seeded(elite ? 51 : 50), o.x - L, o.y - R * 1.2, L * 2, R * 2.2, 26, PU.sootDark, 3.4, 0.28);
  ctx.restore();
  for (const x of [-26, -6, 14]) {
    const rr = R * Math.sqrt(Math.max(0, 1 - (x / L) * (x / L)));
    ringArc(ctx, a, x, 0, h, 1, 0, rr, rr, band, elite ? 2.6 : 2);
  }
  if (!tailFar) fins(ctx, a, L, R, h, band, true);
  // Two smokestacks on top, belching.
  const stacks = [-1, 1].map((side) => at(a, 6, side * 5, h + R * 0.92)).sort((m, n) => m.y - n.y);
  for (const b of stacks) {
    cylinder(ctx, b.x, b.y, 2.4, 1.8, 6, PU.sootDark, P.gunmetal, LINE_THIN);
    ball(ctx, b.x + 1, b.y - 9, 3.4, 3, PU.soot, { line: LINE_THIN, hi: 0.3 });
    ball(ctx, b.x + 3, b.y - 13, 2.6, 2.3, tone(PU.soot, 0.25), { line: LINE_THIN, hi: 0.3 });
  }
  glint(ctx, o.x - 10, o.y - R * 0.6, 8, 0.3);
  ctx.restore();
}

/** Kerblam Mech: General Bluster's walking boiler (Zone 5 boss), 2-frame stomp. `bare` = plating shed. */
export function kerblam(ctx: Ctx, a: number, k: number, elite: boolean, bare = false): void {
  const S = 1.2;
  ctx.save();
  ctx.scale(S, S);
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const plate = elite ? P.maroonDark : P.maroon;
  const trim = elite ? P.gold : P.mustard;
  const metal = P.gunmetal;
  contact(ctx, 0, 2, 26, 12, 0.4);
  // Two-frame stomp (atlas budget): left foot forward, then right.
  const stride = k ? -8 : 8;
  const lift = 0;
  const d = (lx: number, ly: number): number => proj(a, lx, ly).y;
  // Legs: hip → knee → clawed foot; the passing leg lifts.
  const leg = (side: number): Layered => {
    const fl = side > 0 ? stride : -stride;
    const fz = (side > 0 ? k === 3 : k === 1) ? lift : 0;
    return {
      d: d(fl, side * 11),
      draw: () => {
        const hip = at(a, 0, side * 12, 20);
        const knee = at(a, fl * 0.5 + 6, side * 14, 11 + fz * 0.5);
        const foot = at(a, fl, side * 13, fz);
        ctx.beginPath();
        ctx.moveTo(hip.x, hip.y);
        ctx.lineTo(knee.x, knee.y);
        ctx.lineTo(foot.x, foot.y - 2);
        ctx.lineJoin = 'round';
        ink(ctx, 11, P.ink);
        ink(ctx, 7, metal);
        ball(ctx, knee.x, knee.y, 4.4, 4.4, P.brass, { line: LINE_THIN });
        ball(ctx, foot.x, foot.y - 1.5, 8, 4.2, metal, { line: LINE_THIN + 0.4 });
        for (const t of [-0.5, 0, 0.5]) {
          const tip = at(a, fl + 9, side * 13 + t * 9, fz);
          ctx.beginPath();
          ctx.moveTo(foot.x + (tip.x - foot.x) * 0.4, foot.y - 1.5 + (tip.y - foot.y) * 0.4);
          ctx.lineTo(tip.x, tip.y - 0.5);
          ink(ctx, 3, P.ink);
          ink(ctx, 1.6, P.steelLight);
        }
      },
    };
  };
  const arm = (side: number): Layered => ({
    d: d(8, side * 22),
    draw: () => {
      const sh = at(a, 0, side * 20, 32);
      if (side > 0) {
        hcyl(ctx, a, { lx: 8, ly: side * 23, h: 30, ax: 1, ay: 0, r: 5.2, hl: 12, side: P.steelDark, capA: P.steelDark, capB: P.brass, line: LINE_THIN + 0.6, capDetail: (c, u, v, isB) => {
          if (!isB) return;
          ctx.beginPath();
          ellAxes(ctx, c, { x: u.x * 0.55, y: u.y * 0.55 }, { x: v.x * 0.55, y: v.y * 0.55 });
          ctx.fillStyle = P.ink;
          ctx.fill();
        } });
        for (const x of [0, 16]) ringArc(ctx, a, x, side * 23, 30, 1, 0, 5.4, 5.4, P.brass, 1.8);
      } else {
        const el = at(a, 11, side * 24, 26);
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(el.x, el.y);
        ink(ctx, 8, P.ink);
        ink(ctx, 4.8, metal);
        for (const t of [-1, 1]) {
          const tip = at(a, 21, side * 24 + t * 4.5, 26 + t * 2.5);
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.quadraticCurveTo((el.x + tip.x) / 2 + t * 2, (el.y + tip.y) / 2 - 4, tip.x, tip.y);
          ink(ctx, 4.6, P.ink);
          ink(ctx, 2.4, P.steelLight);
        }
      }
      ball(ctx, sh.x, sh.y, 6.4, 6, bare ? P.copper : plate, { line: LINE_THIN + 0.4 });
    },
  });
  const boiler: Layered = {
    d: d(0, 0),
    draw: () => {
      const b = at(a, 0, 0, 18);
      const rx = 21;
      const ry = 15;
      const hgt = 24;
      cylinder(ctx, b.x, b.y, rx, ry, hgt, bare ? P.copperLight : plate, bare ? P.copper : plate, LINE);
      // Seams (plates) or pipes and gauges (bare), on the visible front half.
      const vis = (t: number): boolean => Math.sin(t) > 0.08;
      if (!bare) {
        for (let i = 0; i < 6; i++) {
          const t = a + (i * Math.PI) / 3 + Math.PI / 6;
          if (!vis(t)) continue;
          const x = b.x + Math.cos(t) * rx;
          const y = b.y + Math.sin(t) * ry;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - hgt);
          ink(ctx, 1.1, alpha(P.ink, 0.55));
        }
        for (const z of [3, hgt - 3]) {
          for (let i = 0; i < 12; i++) {
            const t = a + (i * Math.PI) / 6;
            if (!vis(t)) continue;
            ball(ctx, b.x + Math.cos(t) * rx * 0.97, b.y + Math.sin(t) * ry * 0.97 - z, 0.9, 0.9, trim, { line: 0.5 });
          }
        }
        ctx.beginPath();
        ctx.ellipse(b.x, b.y - hgt * 0.55, rx, ry, 0, 0.1, Math.PI - 0.1);
        ink(ctx, 3.4, P.ink);
        ink(ctx, 2, trim);
      } else {
        for (const z of [7, 15]) {
          ctx.beginPath();
          ctx.ellipse(b.x, b.y - z, rx + 0.5, ry + 0.5, 0, 0.15, Math.PI - 0.15);
          ink(ctx, 3.4, P.ink);
          ink(ctx, 2, P.brass);
        }
        const t = a + 0.5;
        if (vis(t)) {
          const gx = b.x + Math.cos(t) * rx * 0.8;
          const gy = b.y + Math.sin(t) * ry * 0.8 - 18;
          ball(ctx, gx, gy, 3.4, 3.4, P.cream, { line: LINE_THIN });
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + 2, gy - 1.6);
          ink(ctx, 0.9, P.stop);
        }
        // Steam leaking from the exposed boiler.
        for (const [dx, dz] of [[-9, 20], [8, 9]]) ball(ctx, b.x + dx!, b.y - dz!, 3, 2.6, P.flowerWhite, { line: LINE_THIN * 0.6, hi: 0.1, lo: 0.15 });
      }
      // The furnace door glows on its front whenever the front faces us.
      if (vis(a)) {
        const dx = b.x + Math.cos(a) * rx * 0.86;
        const dy = b.y + Math.sin(a) * ry * 0.86 - 9;
        const w = 5.5 * (0.45 + 0.55 * Math.sin(a));
        ellipsePath(ctx, dx, dy, Math.max(1.8, w), 5.2);
        ctx.fillStyle = P.brass;
        ctx.fill();
        ink(ctx, LINE_THIN + 0.3);
        ellipsePath(ctx, dx, dy, Math.max(1, w * 0.62), 3.4);
        const fg = ctx.createRadialGradient(dx, dy, 0, dx, dy, 4);
        fg.addColorStop(0, P.flashCore);
        fg.addColorStop(0.5, P.fire);
        fg.addColorStop(1, P.fireDark);
        ctx.fillStyle = fg;
        ctx.fill();
      }
      // Chimney stack at the back of the top rim.
      const st = at(a, -13, 0, 18 + hgt);
      if (proj(a, -1, 0).y < 0) {
        cylinder(ctx, st.x, st.y, 3, 2.3, 9, PU.sootDark, metal, LINE_THIN);
      }
      // General Bluster in the cockpit dome.
      const top = { x: b.x, y: b.y - hgt };
      const hx = top.x + fx * 1.5;
      const hy = top.y - 8;
      ball(ctx, hx, hy + 5, 8, 4.5, plate, { line: LINE_THIN });
      ball(ctx, hx, hy, 6.4, 6, P.skin1, { line: LINE_THIN + 0.4 });
      if (fy > -0.35) {
        ctx.fillStyle = P.ink;
        for (const s of [-1, 1]) {
          ellipsePath(ctx, hx + fx * 2.6 - fy * s * 2.2, hy - 1 + fy * 0.8, 0.9, 1.1);
          ctx.fill();
        }
        handlebar(ctx, hx + fx * 2.8, hy + 2.6 + fy * 0.5, fx, 1.25, P.flowerWhite);
      }
      hat(ctx, 'shako', hx, hy, fx, fy, -fy, 1, plate, P.gold, true, 1.1);
      ellipsePath(ctx, top.x, top.y - 9, 14, 12.5);
      ctx.fillStyle = alpha(P.glass, 0.3);
      ctx.fill();
      ink(ctx, LINE, P.ink);
      ctx.beginPath();
      ctx.ellipse(top.x, top.y - 9, 14, 12.5, 0, 0, Math.PI);
      ink(ctx, 2, elite ? P.gold : P.brass);
      glint(ctx, top.x - 4, top.y - 14, 6, 0.7);
      if (proj(a, -1, 0).y >= 0) cylinder(ctx, st.x, st.y, 3, 2.3, 9, PU.sootDark, metal, LINE_THIN);
    },
  };
  paintLayers([leg(1), leg(-1)]);
  const arms = [arm(1), arm(-1)];
  const bodyD = boiler.d;
  paintLayers(arms.filter((x) => x.d < bodyD));
  boiler.draw();
  paintLayers(arms.filter((x) => x.d >= bodyD));
  ctx.restore();
}

// ------------------------------------------------------------ v1.1 painted starter units

// The v1.1 art sample (DESIGN.md §0.3 item 9): Footling, Scarper, Putt-Putt, Tin Kettle and
// Whirligig are painted with one chunky ink outline round the whole silhouette and thin inner
// lines, instead of a full-weight outline on every part.

/** Outline radius round a whole unit, in art units (≈ 3.75 px at @2x after UNIT_SCALE). */
const SILHOUETTE = 1.5;
/** Inner line weight between parts. */
const INNER = LINE_THIN * 0.72;

/**
 * Paints `paint` into a layer, then stamps an ink copy of the layer's silhouette in a ring
 * behind it: one outline for the whole figure. Needs a sprite of its own canvas (the bake draws
 * every sprite into a fresh canvas, src/art/bake.ts).
 */
function outlined(ctx: Ctx, radius: number, paint: (c: Ctx) => void): void {
  const src = ctx.canvas;
  const m = ctx.getTransform();
  const layer = document.createElement('canvas');
  layer.width = src.width;
  layer.height = src.height;
  const lc = layer.getContext('2d')!;
  lc.setTransform(m);
  paint(lc);
  const sil = document.createElement('canvas');
  sil.width = src.width;
  sil.height = src.height;
  const sc = sil.getContext('2d')!;
  sc.drawImage(layer, 0, 0);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = P.ink;
  sc.fillRect(0, 0, sil.width, sil.height);
  const r = radius * Math.hypot(m.a, m.b);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    ctx.drawImage(sil, Math.cos(t) * r, Math.sin(t) * r);
  }
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2 + 0.13;
    ctx.drawImage(sil, Math.cos(t) * r * 0.55, Math.sin(t) * r * 0.55);
  }
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/**
 * Round-volume shading inside the current path (clip it first): a core shadow crescent away from
 * the light, a faint warm bounce along the lower-right rim, a soft sheen towards the light, and
 * a little painterly grain. (x, y, rx, ry) is the volume's bounding ellipse.
 */
function modelVolume(c: Ctx, x: number, y: number, rx: number, ry: number, base: string, seed: number, o: { core?: number; sheen?: number; grain?: number } = {}): void {
  const L = lightDir(c);
  // Core shadow: the body ellipse minus a copy shifted towards the light.
  c.beginPath();
  c.ellipse(x, y, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
  c.ellipse(x + L.x * rx * 0.34, y + L.y * ry * 0.34, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
  c.fillStyle = alpha(tone(base, -0.55), o.core ?? 0.32);
  c.fill('evenodd');
  // Bounce: a thin, warm, lighter rim on the shadow side.
  c.beginPath();
  c.ellipse(x, y, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
  c.ellipse(x + L.x * rx * 0.1, y + L.y * ry * 0.1, rx * 1.01, ry * 1.01, 0, 0, Math.PI * 2);
  c.fillStyle = alpha(mix(base, P.flowerYellow, 0.35), 0.28);
  c.fill('evenodd');
  // Sheen towards the light.
  const sx = x + L.x * rx * 0.42;
  const sy = y + L.y * ry * 0.46;
  const g = c.createRadialGradient(sx, sy, 0, sx, sy, Math.max(rx, ry) * 0.55);
  g.addColorStop(0, alpha(P.flowerWhite, o.sheen ?? 0.34));
  g.addColorStop(1, alpha(P.flowerWhite, 0));
  c.fillStyle = g;
  c.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  dabs(c, seeded(seed), x - rx, y - ry, rx * 2, ry * 2, Math.round(rx * ry * 0.18), tone(base, -0.35), 0.6, o.grain ?? 0.1);
}

/** A lit ellipse volume with thin inner line and full modelling. */
function volume(c: Ctx, x: number, y: number, rx: number, ry: number, base: string, seed: number, o: { hi?: number; lo?: number; line?: number; core?: number; sheen?: number } = {}): void {
  ball(c, x, y, rx, ry, base, { line: 0, hi: o.hi ?? 0.38, lo: o.lo ?? 0.3 });
  c.save();
  ellipsePath(c, x, y, rx, ry);
  c.clip();
  modelVolume(c, x, y, rx, ry, base, seed, o);
  c.restore();
  if (o.line !== 0) {
    ellipsePath(c, x, y, rx, ry);
    ink(c, o.line ?? INNER);
  }
}

/** A limb: a round-capped tube from p to q, lit from the top left, with a thin inner edge. */
function limb(c: Ctx, p: V2, q: V2, width: number, base: string): void {
  c.beginPath();
  c.moveTo(p.x, p.y);
  c.lineTo(q.x, q.y);
  ink(c, width + INNER * 2);
  const g = c.createLinearGradient(Math.min(p.x, q.x) - width, Math.min(p.y, q.y) - width, Math.max(p.x, q.x) + width, Math.max(p.y, q.y) + width);
  g.addColorStop(0, tone(base, 0.3));
  g.addColorStop(0.5, base);
  g.addColorStop(1, tone(base, -0.32));
  c.beginPath();
  c.moveTo(p.x, p.y);
  c.lineTo(q.x, q.y);
  c.lineWidth = width;
  c.strokeStyle = g;
  c.lineCap = 'round';
  c.stroke();
}

/** A small specular button or rivet. */
function stud(c: Ctx, x: number, y: number, r: number, base: string): void {
  ball(c, x, y, r, r, base, { line: INNER * 0.7, hi: 0.6, lo: 0.4 });
  c.fillStyle = alpha(P.flowerWhite, 0.85);
  ellipsePath(c, x - r * 0.35, y - r * 0.4, r * 0.32, r * 0.24);
  c.fill();
}

const LEATHER = (): string => tone(P.woodDark, -0.45);
const TROUSERS = (): string => mix(P.maroonDark, P.ink, 0.45);

/** A walrus moustache under the nose, sweeping out to curled tips; strands catch the light. */
function walrus(c: Ctx, x: number, y: number, px: number, py: number, fx: number, w: number): void {
  for (const s of [-1, 1]) {
    const tipX = x + px * s * w + fx * (0.6 + Math.abs(fx) * 2.4);
    const tipY = y + py * s * w * 0.3 + 0.8;
    c.beginPath();
    c.moveTo(x + fx * 0.4, y - 1.4);
    c.quadraticCurveTo(x + px * s * w * 0.55, y - 2.2, tipX, tipY - 1.4);
    c.quadraticCurveTo(tipX + px * s * 1.2, tipY + 0.2, tipX - px * s * 0.4, tipY + 0.9);
    c.quadraticCurveTo(x + px * s * w * 0.45, y + 1.9, x + fx * 0.4, y + 1.2);
    c.closePath();
    const g = c.createLinearGradient(x, y - 2, x, y + 2);
    g.addColorStop(0, tone(P.moustache, 0.2));
    g.addColorStop(1, tone(P.moustache, -0.3));
    c.fillStyle = g;
    c.fill();
    ink(c, INNER);
    c.beginPath();
    c.moveTo(x + px * s * w * 0.2, y - 0.9);
    c.quadraticCurveTo(x + px * s * w * 0.55, y - 1.4, tipX - px * s * 0.6, tipY - 0.9);
    ink(c, 0.55, alpha(tone(P.moustache, 0.55), 0.8));
  }
}

/** The Footling's shako: a flared maroon cylinder with a leather top band, trim band, brass star
 * badge, leather peak and a fuzzy pompom plume. `hb` is the height of its base on screen. */
function shako(c: Ctx, hx: number, hb: number, fx: number, fy: number, tunicHat: string, trim: string, elite: boolean, sway: number): void {
  const H = 12.4;
  const rb = 5.8;
  const rt = 6.6;
  const e = 0.34;
  const top = hb - H;
  // Plume holder and plume behind the top when facing away (it sits at the front of the crown).
  const plumeX = hx + fx * 1.6 + sway;
  const plumeY = top - 3.9;
  const plume = (): void => {
    stud(c, hx + fx * 1.4, top - 0.4, 1.7, P.brass);
    const rnd = seeded(elite ? 91 : 73);
    const tufts: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 11; i++) {
      const t = (i / 11) * Math.PI * 2 + rnd() * 0.5;
      const d = 1.3 + rnd() * 1.9;
      tufts.push({ x: plumeX + Math.cos(t) * d * 1.05, y: plumeY + Math.sin(t) * d * 1.05 - 0.3, r: 2.2 + rnd() * 0.8 });
    }
    tufts.sort((p, q) => p.y - q.y);
    // A soft dark base so the tufts read as one fuzzy mass, then lit tufts over it.
    ball(c, plumeX, plumeY + 0.6, 4.6, 4.8, tone(P.plume, -0.35), { line: 0 });
    for (const t of tufts) {
      const base = elite && t.y < plumeY - 1 ? P.gold : P.plume;
      ball(c, t.x, t.y, t.r, t.r, base, { line: 0, hi: 0.3, lo: 0.32 });
    }
    // Fur: short strokes at the rim.
    c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * Math.PI * 2;
      const x0 = plumeX + Math.cos(t) * 3.6;
      const y0 = plumeY + Math.sin(t) * 3.9;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + Math.cos(t + 0.4) * 1.3, y0 + Math.sin(t + 0.4) * 1.3);
      ink(c, 0.7, alpha(tone(P.plume, t > Math.PI * 0.2 && t < Math.PI * 1.1 ? -0.45 : 0.2), 0.9));
    }
  };
  if (fy < -0.3) plume();
  // Body: lower front arc, up the sides, over the top ellipse.
  const bodyPath = (): void => {
    c.beginPath();
    c.moveTo(hx + rb, hb);
    c.ellipse(hx, hb, rb, rb * e, 0, 0, Math.PI);
    c.lineTo(hx - rt, top);
    c.ellipse(hx, top, rt, rt * e, 0, Math.PI, Math.PI * 2);
    c.closePath();
  };
  bodyPath();
  const g = c.createLinearGradient(hx - rt, 0, hx + rt, 0);
  g.addColorStop(0, tone(tunicHat, 0.3));
  g.addColorStop(0.42, tunicHat);
  g.addColorStop(1, tone(tunicHat, -0.45));
  c.fillStyle = g;
  c.fill();
  c.save();
  bodyPath();
  c.clip();
  // Bands follow the cylinder: the region between two lower arcs.
  const band = (y0: number, y1: number, colour: string): void => {
    const r0 = rb + (rt - rb) * ((hb - y0) / H);
    const r1 = rb + (rt - rb) * ((hb - y1) / H);
    c.beginPath();
    c.ellipse(hx, y0, r0 + 0.3, r0 * e, 0, 0, Math.PI);
    c.ellipse(hx, y1, r1 + 0.3, r1 * e, 0, Math.PI, 0, true);
    c.closePath();
    const bg = c.createLinearGradient(hx - rt, 0, hx + rt, 0);
    bg.addColorStop(0, tone(colour, 0.3));
    bg.addColorStop(0.42, colour);
    bg.addColorStop(1, tone(colour, -0.42));
    c.fillStyle = bg;
    c.fill();
  };
  band(hb - 2.2, hb - 4.3, trim);
  band(top + 2.4, top - 0.2, LEATHER());
  // A painted sheen down the lit side.
  c.fillStyle = alpha(P.flowerWhite, 0.2);
  c.fillRect(hx - rt * 0.62, top, 1.6, H);
  dabs(c, seeded(31), hx - rt, top, rt * 2, H, 14, tone(tunicHat, -0.3), 0.6, 0.12);
  c.restore();
  bodyPath();
  ink(c, INNER);
  // The top: a leather disc.
  ellipsePath(c, hx, top, rt, rt * e);
  litFill(c, tone(LEATHER(), 0.18), hx, top, rt, 0.35, 0.2);
  ink(c, INNER);
  // Badge and peak on the front.
  if (fy > -0.35) {
    const bx = hx + fx * rt * 0.6;
    const squash = Math.sqrt(Math.max(0.2, 1 - fx * fx * 0.7));
    c.save();
    c.translate(bx, hb - 8.2);
    c.scale(squash, 1);
    starPath(c, 0, 0, 6, 1.4, 2.8, -Math.PI / 2);
    litFill(c, P.brass, 0, 0, 2.8, 0.55, 0.35);
    ink(c, INNER * 0.8);
    c.restore();
    c.fillStyle = alpha(P.flowerWhite, 0.8);
    ellipsePath(c, bx - 0.8, hb - 9.2, 0.6, 0.45);
    c.fill();
    // The peak juts forward just above the eyes.
    const vx = hx + fx * rb * 0.7;
    const vy = hb + 0.4 + fy * 0.5;
    ellipsePath(c, vx, vy, 5.4 - Math.abs(fx) * 1.4, 1.6);
    litFill(c, tone(LEATHER(), 0.1), vx, vy, 5, 0.3, 0.3);
    ink(c, INNER);
    c.beginPath();
    c.ellipse(vx, vy - 0.2, 4.2 - Math.abs(fx) * 1.2, 0.9, 0, Math.PI * 1.1, Math.PI * 1.7);
    ink(c, 0.6, alpha(P.flowerWhite, 0.55));
  }
  if (fy >= -0.3) plume();
}

/** The Scarper's soft peaked cap, with its trim band and a button on top. */
function softCap(c: Ctx, hx: number, hy: number, fx: number, fy: number, colour: string, trim: string): void {
  const cx = hx - fx * 0.4;
  const cy = hy - 6;
  const visor = (): void => {
    const vx = hx + fx * 4.4;
    const vy = hy - 4.3 + fy * 0.8;
    ellipsePath(c, vx, vy, 5 - Math.abs(fx) * 1.2, 2);
    litFill(c, tone(LEATHER(), 0.1), vx, vy, 5, 0.3, 0.3);
    ink(c, INNER);
    c.beginPath();
    c.ellipse(vx, vy - 0.2, 3.8 - Math.abs(fx), 1.1, 0, Math.PI * 1.1, Math.PI * 1.7);
    ink(c, 0.6, alpha(P.flowerWhite, 0.55));
  };
  if (fy < -0.2) visor();
  volume(c, cx, cy, 7.3, 4.6, colour, 43, { sheen: 0.4 });
  c.save();
  ellipsePath(c, cx, cy, 7.3, 4.6);
  c.clip();
  c.beginPath();
  c.ellipse(cx, cy + 1.6, 7.6, 2.4, 0, 0, Math.PI);
  c.lineWidth = 2.2;
  c.strokeStyle = trim;
  c.stroke();
  c.restore();
  stud(c, cx - 0.6, cy - 4.2, 1.1, trim);
  if (fy >= -0.2) visor();
}

/** A long trim-coloured scarf streaming back from the neck, rippling by walk frame. */
function scarf(c: Ctx, x: number, y: number, fx: number, fy: number, px: number, k: number, colour: string): void {
  const n = 10;
  const len = 13;
  const left: V2[] = [];
  const right: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Flies back from the neck, rippling up and down (a wave travelling along it by frame).
    const wave = Math.sin(t * Math.PI * 1.6 - k * (Math.PI / 2)) * 2.2 * t;
    const cx = x - fx * len * t + px * wave * 0.4;
    const cy = y - fy * len * t * 0.5 + wave + t * 1.2;
    const w = 2.3 - t * 0.9;
    left.push({ x: cx + px * w * 0.3, y: cy - w });
    right.push({ x: cx - px * w * 0.3, y: cy + w });
  }
  c.beginPath();
  left.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i]!.x, right[i]!.y);
  c.closePath();
  litFill(c, colour, x - fx * len * 0.5, y - 1, len * 0.6, 0.3, 0.35);
  ink(c, INNER);
  // A fold down the middle and two maroon stripes near the end.
  c.beginPath();
  for (let i = 1; i < n; i++) {
    const m = { x: (left[i]!.x + right[i]!.x) / 2, y: (left[i]!.y + right[i]!.y) / 2 + 0.3 };
    if (i === 1) c.moveTo(m.x, m.y);
    else c.lineTo(m.x, m.y);
  }
  ink(c, 0.7, alpha(tone(colour, -0.45), 0.7));
  for (const i of [7, 8]) {
    c.beginPath();
    c.moveTo(left[i]!.x, left[i]!.y);
    c.lineTo(right[i]!.x, right[i]!.y);
    ink(c, 1, P.maroon);
  }
}

/** v1.1: a Grand Blustering Army soldier (Footling, Scarper) facing `a` on walk frame `k`, feet on the origin. */
function footman(ctx: Ctx, kit: Kit, a: number, k: number): void {
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const px = -fy;
  const py = fx;
  const slim = Boolean(kit.slim);
  const stride = STRIDE[k]! * (slim ? 1.35 : 1);
  const bob = BOB[k]!;
  const rx = slim ? 8.4 : 9.8;
  const ry = 10.2;
  const bx = fx * (slim ? 1.8 : 0.4);
  const by = -14.4 + bob;
  const hr = 6.4;
  const hx = bx + fx * 1.4;
  const hy = by - 11.2;
  ctx.save();
  ctx.scale(kit.size, kit.size);
  contact(ctx, 0, 0, 12, 5, 0.34);
  outlined(ctx, SILHOUETTE, (c) => {
    const scarfAt = { x: hx - fx * 1.2, y: hy + 5.6 };
    const scarfBehind = kit.hat === 'cap' && fy > 0.25;
    const scarfOver = kit.hat === 'cap' && !scarfBehind;
    if (scarfBehind) scarf(c, scarfAt.x, scarfAt.y, fx, fy, px, k, kit.trim);
    // Legs: short dark trousers and polished boots, far leg first.
    const legs = [1, -1]
      .map((s) => ({
        hip: { x: bx + px * s * 3.6, y: by + 7.4 + py * s * 1.1 },
        foot: { x: px * s * 3.9 + fx * stride * s, y: (py * s * 3.9 + fy * stride * s) * 0.5 },
      }))
      .sort((p, q) => p.foot.y - q.foot.y);
    for (const l of legs) {
      limb(c, l.hip, { x: l.foot.x, y: l.foot.y - 2 }, 4.4, TROUSERS());
      const bootL = 3.6 + Math.abs(fx) * 0.8;
      volume(c, l.foot.x + fx * 0.8, l.foot.y - 1.1, bootL, 2.4, LEATHER(), 5, { hi: 0.5, sheen: 0.5 });
    }
    // Arms swing against the legs; the far one goes behind the body.
    const arm = (s: number): { shoulder: V2; hand: V2; front: boolean } => {
      const shoulder = { x: bx + px * s * (rx - 1.4), y: by - 4.6 + py * s * (rx - 1.4) * 0.3 };
      const swing = -stride * s * 0.9;
      const hand = { x: shoulder.x + fx * swing + px * s * 1.2, y: shoulder.y + 7.4 + fy * swing * 0.5 };
      return { shoulder, hand, front: py * s > 0.2 || (Math.abs(py) <= 0.2 && fy > 0) };
    };
    const drawArm = (s: number): void => {
      const { shoulder, hand } = arm(s);
      limb(c, shoulder, hand, 5.4, kit.tunic);
      const cuff = { x: shoulder.x + (hand.x - shoulder.x) * 0.78, y: shoulder.y + (hand.y - shoulder.y) * 0.78 };
      limb(c, cuff, { x: shoulder.x + (hand.x - shoulder.x) * 0.86, y: shoulder.y + (hand.y - shoulder.y) * 0.86 }, 5.6, kit.trim);
      volume(c, hand.x, hand.y + 0.4, 2.3, 2.2, kit.skin, 7, { line: INNER * 0.9, core: 0.25 });
      // Epaulette with a fringe.
      volume(c, shoulder.x, shoulder.y - 1.1, 2.9, 1.6, kit.trim, 11, { line: INNER * 0.8, sheen: 0.5 });
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(shoulder.x + i * 1, shoulder.y + 0.2);
        c.lineTo(shoulder.x + i * 1.05, shoulder.y + 1.4);
        ink(c, 0.7, tone(kit.trim, -0.3));
      }
    };
    for (const s of [1, -1]) if (!arm(s).front) drawArm(s);
    // Tunic.
    volume(c, bx, by, rx, ry, kit.tunic, 17, { hi: 0.42, lo: 0.36 });
    c.save();
    ellipsePath(c, bx, by, rx, ry);
    c.clip();
    // Belt round the middle, with a brass buckle on the front.
    c.beginPath();
    c.ellipse(bx, by + 2.2, rx + 0.6, 2.5, 0, 0, Math.PI);
    c.lineWidth = 3.4;
    c.strokeStyle = LEATHER();
    c.stroke();
    c.beginPath();
    c.ellipse(bx, by + 1.0, rx + 0.4, 2.5, 0, Math.PI * 0.15, Math.PI * 0.85);
    ink(c, 0.6, alpha(P.flowerWhite, 0.25));
    const front = fy > -0.3;
    const fxOff = bx + fx * rx * 0.58;
    if (front) {
      // Trim piping down the front and two rows of brass buttons (one in profile).
      c.beginPath();
      c.moveTo(fxOff, by - ry);
      c.lineTo(fxOff, by + 2);
      ink(c, 1.3, kit.trim);
      const cols = Math.abs(fy) > 0.45 ? [-2.3, 2.3] : [fx > 0 ? -1.8 : 1.8];
      for (const col of cols) for (const yy of [-6.4, -3.3, -0.4]) stud(c, fxOff + col * (Math.abs(fy) > 0.45 ? Math.abs(fy) : 1), by + yy, 1.05, P.brass);
    } else {
      // The back: a centre seam and the coat's vent.
      c.beginPath();
      c.moveTo(bx - fx * 2, by - ry);
      c.lineTo(bx - fx * 2, by + ry);
      ink(c, 0.7, alpha(tone(kit.tunic, -0.5), 0.6));
    }
    c.restore();
    if (front) {
      const buckleY = by + 2.2 + 2.5 * Math.sqrt(Math.max(0, 1 - fx * fx * 0.34));
      roundRectPath(c, fxOff - 1.8, buckleY - 1.6, 3.6, 3, 0.8);
      litFill(c, P.brass, fxOff, buckleY, 2.4, 0.55, 0.35);
      ink(c, INNER * 0.8);
    }
    // Collar in the trim colour.
    ellipsePath(c, hx - fx * 0.3, by - ry * 0.8, 5.4, 2.2);
    litFill(c, kit.trim, hx, by - ry * 0.8, 5, 0.35, 0.35);
    ink(c, INNER);
    if (kit.elite && front) {
      // Veterans: a ribbon bar and a medal.
      const mx = bx + fx * 2.4 + px * 3.4;
      const my = by - 5.6;
      const stripes = [P.stop, P.gold, P.infoDark];
      stripes.forEach((col, i) => {
        c.fillStyle = col;
        c.fillRect(mx - 2.25 + i * 1.5, my - 1.1, 1.5, 2.2);
      });
      c.beginPath();
      c.rect(mx - 2.25, my - 1.1, 4.5, 2.2);
      ink(c, INNER * 0.7);
      c.beginPath();
      c.moveTo(mx, my + 1.1);
      c.lineTo(mx, my + 2.6);
      ink(c, 1.1, P.stop);
      stud(c, mx, my + 3.8, 1.5, P.gold);
    }
    for (const s of [1, -1]) if (arm(s).front) drawArm(s);
    if (scarfOver) {
      scarf(c, scarfAt.x, scarfAt.y, fx, fy, px, k, kit.trim);
      volume(c, hx - fx * 0.6, hy + 5.2, 4.2, 2, kit.trim, 13, { line: INNER });
    }
    // Head.
    const face = fy > -0.35;
    const earSide = Math.abs(fy) > 0.55;
    if (earSide) for (const s of [-1, 1]) volume(c, hx + s * (hr - 0.6), hy + 0.6, 1.5, 2, tone(kit.skin, -0.05), 3, { line: INNER * 0.9, core: 0.2 });
    volume(c, hx, hy, hr, hr * 0.95, kit.skin, 23, { hi: 0.36, lo: 0.26, core: 0.24, sheen: 0.3 });
    if (!earSide) {
      const ex = hx - fx * 1.1;
      ellipsePath(c, ex, hy + 0.4, 1.4, 1.9);
      c.fillStyle = tone(kit.skin, -0.1);
      c.fill();
      c.beginPath();
      c.ellipse(ex + fx * 0.2, hy + 0.4, 0.8, 1.2, 0, fx > 0 ? Math.PI * 0.6 : -Math.PI * 0.4, fx > 0 ? Math.PI * 1.6 : Math.PI * 0.6);
      ink(c, 0.6, tone(kit.skin, -0.4));
    }
    if (face) {
      // Rosy cheeks, bushy brows, a big round nose, and the walrus moustache.
      for (const s of [-1, 1]) {
        if (Math.abs(px) < 0.3 && s < 0) continue;
        const cx = hx + fx * 2.4 + px * s * 3.4;
        const cy = hy + 1.6;
        const cg = c.createRadialGradient(cx, cy, 0, cx, cy, 2.4);
        cg.addColorStop(0, alpha(mix(kit.skin, P.stop, 0.55), 0.42));
        cg.addColorStop(1, alpha(mix(kit.skin, P.stop, 0.55), 0));
        c.fillStyle = cg;
        c.fillRect(cx - 2.4, cy - 2.4, 4.8, 4.8);
      }
      for (const s of [-1, 1]) {
        if (Math.abs(px) < 0.3 && s < 0) continue;
        const ex = hx + fx * 2.7 + px * s * 2.3;
        const ey = hy - 1.3 + fy * 0.6;
        ellipsePath(c, ex, ey, 0.95, 1.25);
        c.fillStyle = P.ink;
        c.fill();
        c.fillStyle = alpha(P.flowerWhite, 0.9);
        ellipsePath(c, ex - 0.3, ey - 0.45, 0.32, 0.32);
        c.fill();
        c.beginPath();
        c.moveTo(ex - 1.5 - fx * 0.3, ey - 2.1);
        c.quadraticCurveTo(ex, ey - 3.1, ex + 1.5 - fx * 0.3, ey - 2.4);
        ink(c, 1.1, P.moustache);
      }
      // In profile the nose pushes past the head's edge, so the silhouette outline wraps it.
      const side = Math.abs(fx);
      volume(c, hx + fx * (4.4 + side * 1.4), hy + 0.9 + fy * 0.4, 1.9 + side * 0.3, 1.7, tone(kit.skin, -0.08), 29, { line: side > 0.8 ? 0 : INNER * 0.8, hi: 0.55, core: 0.3 });
      walrus(c, hx + fx * (3.4 + side * 1.2), hy + 3.1 + fy * 0.4, px, py, fx, 4.9);
    } else {
      // Back of the head: short back and sides above a bare nape.
      c.save();
      ellipsePath(c, hx, hy, hr, hr * 0.95);
      c.clip();
      c.beginPath();
      c.ellipse(hx, hy - 3.2, hr * 1.2, hr * 0.95, 0, 0, Math.PI * 2);
      const hg = c.createLinearGradient(hx - hr, hy - hr, hx + hr, hy + hr);
      hg.addColorStop(0, tone(P.moustache, 0.15));
      hg.addColorStop(1, tone(P.moustache, -0.35));
      c.fillStyle = hg;
      c.fill();
      c.beginPath();
      c.ellipse(hx, hy - 3.2, hr * 1.2, hr * 0.95, 0, Math.PI * 0.15, Math.PI * 0.85);
      ink(c, INNER * 0.8, tone(P.moustache, -0.4));
      c.restore();
    }
    if (kit.hat === 'shako') shako(c, hx, hy - hr * 0.8, fx, fy, kit.elite ? P.maroonDark : P.maroon, kit.elite ? P.gold : kit.trim, kit.elite, (k % 2 ? -0.35 : 0.35) * fx);
    else softCap(c, hx, hy, fx, fy, kit.tunic, kit.trim);
  });
  ctx.restore();
}

/** A spheroid volume (as `spheroid`) with full modelling; returns its path for clipping. */
function shell(c: Ctx, a: number, lx: number, ly: number, h: number, L: number, R: number, Rv: number, base: string, seed: number, o: { hi?: number; lo?: number; sheen?: number; core?: number } = {}): () => void {
  const path = spheroid(c, a, lx, ly, h, L, R, Rv, base, { line: 0, hi: o.hi ?? 0.42, lo: o.lo ?? 0.38 });
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const ex = Math.sqrt(cs * cs * L * L + sn * sn * R * R);
  const ey = Math.sqrt(sn * sn * TILT * TILT * L * L + cs * cs * TILT * TILT * R * R + Rv * Rv);
  const o2 = at(a, lx, ly, h);
  c.save();
  path();
  c.clip();
  modelVolume(c, o2.x, o2.y, ex, ey, base, seed, o);
  c.restore();
  path();
  ink(c, INNER);
  return path;
}

/** A tyre on a lateral axle: treads turning by `spin`, a lit hub with lug nuts. */
function tyre(c: Ctx, a: number, lx: number, ly: number, r: number, halfWidth: number, spin: number, hub: string): void {
  hcyl(c, a, {
    lx,
    ly,
    h: r,
    ax: 0,
    ay: 1,
    r,
    hl: halfWidth,
    side: P.tyre,
    capA: tone(P.tyre, 0.12),
    capB: tone(P.tyre, 0.12),
    line: INNER,
    stripes: { n: 12, phase: spin, colour: tone(P.tyre, 0.35) },
    capDetail: (ctr, u, v) => {
      const s = 0.5;
      c.beginPath();
      ellAxes(c, ctr, { x: u.x * s, y: u.y * s }, { x: v.x * s, y: v.y * s });
      litFill(c, hub, ctr.x, ctr.y, r * 0.5, 0.55, 0.35);
      ink(c, INNER * 0.8);
      c.fillStyle = alpha(P.ink, 0.6);
      for (let i = 0; i < 5; i++) {
        const t = spin + (i / 5) * Math.PI * 2;
        const q = { x: ctr.x + (u.x * Math.cos(t) + v.x * Math.sin(t)) * 0.3, y: ctr.y + (u.y * Math.cos(t) + v.y * Math.sin(t)) * 0.3 };
        ellipsePath(c, q.x, q.y, 0.45, 0.45);
        c.fill();
      }
      c.fillStyle = alpha(P.flowerWhite, 0.7);
      ellipsePath(c, ctr.x - u.x * 0.18 - 0.5, ctr.y + v.y * 0.2, 0.7, 0.5);
      c.fill();
    },
  });
}

/** A seated or peeking crew member's head: cap or helmet, goggles, face towards the facing. */
function crewHead(c: Ctx, a: number, x: number, y: number, r: number, skin: string, cap: string, o: { goggles?: string; helmet?: boolean; band?: string }): void {
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const px = -fy;
  const py = fx;
  volume(c, x, y, r, r * 0.95, skin, 61, { hi: 0.36, lo: 0.26, core: 0.24 });
  const face = fy > -0.3;
  if (face) {
    const side = Math.abs(fx);
    volume(c, x + fx * (r * 0.7 + side * 1.1), y + r * 0.2 + fy * 0.3, 1.2 + side * 0.2, 1.1, tone(skin, -0.08), 29, { line: side > 0.8 ? 0 : INNER * 0.7, hi: 0.55 });
    walrus(c, x + fx * (r * 0.55 + side), y + r * 0.55, px, py, fx, r * 0.78);
  }
  // Cap or helmet over the top of the head.
  const hx = x - fx * 0.3;
  const hy = y - r * 0.42;
  volume(c, hx, hy, r * 1.06, r * 0.78, cap, 67, { sheen: o.helmet ? 0.6 : 0.3, hi: o.helmet ? 0.55 : 0.36 });
  if (o.band) {
    c.save();
    ellipsePath(c, hx, hy, r * 1.06, r * 0.78);
    c.clip();
    if (o.helmet) {
      // A stripe over the crown, along the direction of travel.
      c.beginPath();
      c.moveTo(hx - fx * r * 1.2, hy - r * 0.2 - fy * r * 0.3);
      c.lineTo(hx + fx * r * 1.2, hy - r * 0.2 + fy * r * 0.3);
      c.lineWidth = r * 0.42;
      c.strokeStyle = o.band;
      c.stroke();
    } else {
      c.beginPath();
      c.ellipse(hx, hy + r * 0.34, r * 1.1, r * 0.34, 0, 0, Math.PI);
      c.lineWidth = r * 0.3;
      c.strokeStyle = o.band;
      c.stroke();
    }
    c.restore();
  }
  if (o.goggles) {
    if (face) {
      for (const s of [-1, 1]) {
        if (Math.abs(px) < 0.3 && s < 0) continue;
        const gx = x + fx * r * 0.62 + px * s * r * 0.36;
        const gy = y - r * 0.12 + fy * 0.3;
        ellipsePath(c, gx, gy, r * 0.32, r * 0.28);
        c.fillStyle = P.glass;
        c.fill();
        c.lineWidth = 0.8;
        c.strokeStyle = o.goggles;
        c.stroke();
        c.fillStyle = alpha(P.flowerWhite, 0.9);
        ellipsePath(c, gx - r * 0.1, gy - r * 0.1, r * 0.1, r * 0.08);
        c.fill();
      }
    } else {
      c.save();
      ellipsePath(c, x, y, r, r * 0.95);
      c.clip();
      c.beginPath();
      c.moveTo(x - r, y - r * 0.1);
      c.lineTo(x + r, y - r * 0.1);
      ink(c, r * 0.3, LEATHER());
      c.restore();
    }
  }
}

/** v1.1 Putt-Putt: a mustard moped with a maroon rider in goggles, a scarf and exhaust puffs. */
function puttputtV2(ctx: Ctx, a: number, k: number, elite: boolean): void {
  contact(ctx, 0, 0, 16, 6.5, 0.32);
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  outlined(ctx, SILHOUETTE, (c) => {
    const bob = k === 1 ? -0.6 : 0;
    const body = P.mustard;
    const stripe = elite ? P.maroonDark : P.maroon;
    const skin = elite ? P.skin1 : P.skin2;
    const R = 4.5;
    const spin = k * 0.26;
    const up = (p: V2): V2 => ({ x: p.x, y: p.y + bob });
    const rider = (): void => {
      const torso = up(at(a, -2.8, 0, 16.2));
      const near = (s: number): boolean => s * fx > 0;
      const leg = (s: number): void => {
        const hip = up(at(a, -3.6, s * 2.4, 12.4));
        const knee = up(at(a, 1.8, s * 3.8, 11.6));
        const foot = at(a, 1.4, s * 3.9, 5.8);
        limb(c, hip, knee, 3.4, TROUSERS());
        limb(c, knee, foot, 3, TROUSERS());
        volume(c, foot.x + fx * 0.8, foot.y, 2.2, 1.5, LEATHER(), 5, { hi: 0.5 });
      };
      const arm = (s: number): void => {
        const sh = up(at(a, -1.8, s * 3.4, 18.6));
        const hand = up(at(a, 10.2, s * 4.6, 15.4));
        limb(c, sh, hand, 2.8, P.maroon);
        volume(c, hand.x, hand.y, 1.4, 1.3, skin, 7, { line: INNER * 0.8 });
      };
      const scarfBehind = fy > 0.25;
      const neck = up(at(a, -1.8, 0, 20.2));
      if (scarfBehind) scarf(c, neck.x, neck.y, fx, fy, -fy, k, elite ? P.cream : P.mustard);
      for (const s of [1, -1]) if (!near(s)) leg(s), arm(s);
      volume(c, torso.x, torso.y, 4.4, 4.9, P.maroon, 71, { hi: 0.42 });
      c.save();
      ellipsePath(c, torso.x, torso.y, 4.4, 4.9);
      c.clip();
      c.beginPath();
      c.ellipse(torso.x, torso.y + 1.4, 4.8, 1.4, 0, 0, Math.PI);
      c.lineWidth = 1.8;
      c.strokeStyle = LEATHER();
      c.stroke();
      c.restore();
      if (!scarfBehind) scarf(c, neck.x, neck.y, fx, fy, -fy, k, elite ? P.cream : P.mustard);
      for (const s of [1, -1]) if (near(s)) leg(s), arm(s);
      const head = up(at(a, -1.0, 0, 23.6));
      crewHead(c, a, head.x, head.y, 4, skin, elite ? P.steelLight : tone(P.woodDark, 0.35), elite ? { goggles: P.brass, helmet: true, band: P.gold } : { goggles: P.brass });
    };
    const parts: Part[] = [
      { lx: -9.5, ly: 0, draw: () => tyre(c, a, -9.5, 0, R, 1.6, spin, P.steelLight) },
      { lx: 9.8, ly: 0, draw: () => tyre(c, a, 9.8, 0, R, 1.6, spin, P.steelLight) },
      {
        lx: -7,
        ly: 3.4,
        draw: () => {
          hcyl(c, a, { lx: -7, ly: 3.4, h: 4.4 - bob, ax: 1, ay: 0, r: 1.1, hl: 3.6, side: P.steel, capA: P.gunmetal, capB: P.gunmetal, line: INNER });
          // Exhaust puffs, bigger on the second frame.
          const puffs = k === 1 ? [{ lx: -12.6, h: 5, r: 2 }, { lx: -15.4, h: 6.6, r: 1.4 }] : [{ lx: -11.8, h: 4.6, r: 1.3 }];
          for (const pf of puffs) {
            const q = at(a, pf.lx, 3.6, pf.h);
            volume(c, q.x, q.y, pf.r, pf.r * 0.9, P.smokeLight, 83, { line: INNER * 0.8, core: 0.2 });
          }
        },
      },
      {
        lx: 0,
        ly: 0,
        draw: () => {
          shell(c, a, -7.4, 0, 8.4 - bob, 5.2, 2.9, 2.8, body, 89);
          const tank = shell(c, a, 1.4, 0, 8.8 - bob, 7.6, 3.4, 4, body, 97);
          c.save();
          tank();
          c.clip();
          const s0 = up(at(a, -6.6, 0, 8.6));
          const s1 = up(at(a, 9.2, 0, 8.6));
          c.beginPath();
          c.moveTo(s0.x, s0.y);
          c.lineTo(s1.x, s1.y);
          ink(c, 1.8, stripe);
          c.restore();
          const seat = up(at(a, -4.2, 0, 11.8));
          ellipsePath(c, seat.x, seat.y, 3.2 + Math.abs(fx) * 1.2, 1.7);
          litFill(c, LEATHER(), seat.x, seat.y, 3, 0.4, 0.3);
          ink(c, INNER);
        },
      },
      { lx: -3, ly: 0, draw: rider },
      {
        lx: 10.8,
        ly: 0,
        draw: () => {
          for (const s of [-1, 1]) limb(c, at(a, 9.8, s * 1.3, R), up(at(a, 11, s * 1.1, 13.6)), 1.3, P.steel);
          const bl = up(at(a, 10.6, -5.2, 15.4));
          const br = up(at(a, 10.6, 5.2, 15.4));
          limb(c, bl, br, 1.3, P.steel);
          const lamp = up(at(a, 12.8, 0, 12.4));
          volume(c, lamp.x, lamp.y, 2.4, 2.2, P.brass, 101, { sheen: 0.6, hi: 0.55 });
          if (fy > -0.3) {
            const lens = up(at(a, 14.2, 0, 12.4));
            c.beginPath();
            ellAxes(c, lens, proj(a, 0, 1.7), { x: 0, y: -1.7 });
            c.fillStyle = mix(P.glass, P.flowerWhite, 0.4);
            c.fill();
            ink(c, INNER * 0.8);
          }
          // The hands on the grips, over the bar whichever way round it is drawn.
          for (const s of [-1, 1]) {
            const hand = up(at(a, 10.2, s * 4.6, 15.4));
            volume(c, hand.x, hand.y, 1.4, 1.3, skin, 7, { line: INNER * 0.8 });
          }
        },
      },
    ];
    drawParts(parts, a);
  });
}

/** Screen points along a quadratic curve. */
function curvePts(p0: V2, p1: V2, p2: V2, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
  }
  return out;
}

function polyStroke(c: Ctx, pts: V2[], width: number, colour: string): void {
  c.beginPath();
  pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  c.lineWidth = width;
  c.strokeStyle = colour;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

/** Points of a horizontal ring round the kettle at height h, keeping only the camera-facing half. */
function visibleRing(a: number, cx: number, h: number, L: number, R: number, n: number, from = 0, to = Math.PI * 2): V2[][] {
  const runs: V2[][] = [[]];
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    const nx = Math.cos(t) / L;
    const ny = Math.sin(t) / R;
    if (proj(a, nx, ny).y < -0.002) {
      if (runs[runs.length - 1]!.length) runs.push([]);
      continue;
    }
    runs[runs.length - 1]!.push(at(a, cx + Math.cos(t) * L, Math.sin(t) * R, h));
  }
  return runs.filter((r) => r.length > 1);
}

/** v1.1 Tin Kettle: a riveted, dented kettle of an armoured car with a spout gun, a handle,
 * a livery band and a commander in the hatch. Boilerplate elites add bolted plates and gold. */
function tinkettleV2(ctx: Ctx, a: number, k: number, elite: boolean): void {
  contact(ctx, 0, 1, 24, 11, 0.36);
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  outlined(ctx, SILHOUETTE, (c) => {
    const bob = k === 1 ? -0.6 : 0;
    const steel = elite ? tone(P.steel, -0.18) : P.steel;
    const livery = elite ? P.gold : P.maroon;
    const pin = elite ? P.maroonDark : P.mustard;
    const skin = elite ? P.skin4 : P.skin3;
    const up = (p: V2): V2 => ({ x: p.x, y: p.y + bob });
    const cx = -0.5;
    const ch = 17.4;
    const L = 13.2;
    const Rw = 11;
    const Rv = 9.4;
    const spin = k * 0.26;
    const frontNear = fy > 0;
    const spout = (): void => {
      const p0 = up(at(a, 10.4, 0, 16.2));
      const p1 = up(at(a, 21.6, 0, 20.6));
      limb(c, p0, p1, 4.8, P.gunmetal);
      c.beginPath();
      c.moveTo(p0.x - 0.4, p0.y - 1.4);
      c.lineTo(p1.x - 0.4, p1.y - 1.2);
      ink(c, 0.9, alpha(P.steelLight, 0.7));
      volume(c, p1.x, p1.y, 2.6, 2.4, tone(P.gunmetal, -0.1), 103, { line: INNER });
      if (frontNear || Math.abs(fx) > 0.5) {
        const m = up(at(a, 22.4, 0, 20.9));
        c.beginPath();
        ellAxes(c, m, proj(a, 0, 1.2), { x: 0, y: -1.2 });
        c.fillStyle = P.ink;
        c.fill();
      }
    };
    const handle = (): void => {
      const p0 = up(at(a, -9.8, 0, 24.2));
      const p1 = up(at(a, -19.6, 0, 26));
      const p2 = up(at(a, -15.2, 0, 11.6));
      const pts = curvePts(p0, p1, p2, 16);
      polyStroke(c, pts, 5.2 + INNER * 2, P.ink);
      polyStroke(c, pts, 5.2, P.gunmetal);
      polyStroke(c, pts.slice(5, 12), 5.8, P.wood);
      polyStroke(c, pts.slice(5, 12).map((q) => ({ x: q.x - 0.6, y: q.y - 0.8 })), 1.1, alpha(P.flowerWhite, 0.35));
    };
    const parts: Part[] = [
      ...[
        [10.5, 10.8],
        [10.5, -10.8],
        [-10.5, 10.8],
        [-10.5, -10.8],
      ].map(([lx, ly]) => ({ lx: lx!, ly: ly!, draw: () => tyre(c, a, lx!, ly!, 4.8, 2, spin, elite ? P.brass : P.steelLight) })),
      {
        lx: 0,
        ly: 0,
        draw: () => {
          // Riveted chassis plinth.
          const foot = (): void => roundRectPath(c, -15.6, -9.8, 31.2, 19.6, 4.5);
          const z0 = 4.2 - bob;
          const hgt = 5;
          for (let i = 0; i <= hgt; i++) {
            c.save();
            c.translate(0, -z0 - i);
            c.scale(1, TILT);
            c.rotate(a);
            foot();
            c.restore();
            c.fillStyle = tone(P.steelDark, -0.3 + (0.25 * i) / hgt);
            c.fill();
          }
          c.save();
          c.translate(0, -z0 - hgt);
          c.scale(1, TILT);
          c.rotate(a);
          foot();
          c.restore();
          litFill(c, tone(P.steelDark, 0.15), 0, -z0 - hgt, 16, 0.35, 0.3);
          ink(c, INNER);
          // Rivets along the plinth's rim, on the near side.
          for (let i = 0; i < 20; i++) {
            const t = (i / 20) * Math.PI * 2;
            const lx = Math.cos(t) * 14.2;
            const ly = Math.sin(t) * 8.6;
            if (proj(a, Math.cos(t), Math.sin(t)).y < 0.05) continue;
            const q = at(a, lx, ly, z0 + hgt - 1.6);
            stud(c, q.x, q.y, 0.6, P.steelLight);
          }
          if (!frontNear) spout();
          if (frontNear) handle();
          // The kettle.
          const body = shell(c, a, cx, 0, ch - bob, L, Rw, Rv, steel, 107, { sheen: 0.5, hi: 0.5 });
          c.save();
          body();
          c.clip();
          // Livery band with a pinstripe, rivets above it.
          const band = (h: number, w: number, colour: string): void => {
            const dh = h - ch;
            const k2 = Math.sqrt(Math.max(0, 1 - (dh / Rv) * (dh / Rv)));
            for (const run of visibleRing(a, cx, h - bob, L * k2 + 0.3, Rw * k2 + 0.3, 48)) {
              polyStroke(c, run, w + INNER * 2, P.ink);
              polyStroke(c, run, w, colour);
            }
          };
          band(13.6, 3.2, livery);
          band(15.6, 0.7, pin);
          {
            const h = 21;
            const dh = h - ch;
            const k2 = Math.sqrt(1 - (dh / Rv) * (dh / Rv));
            for (let i = 0; i < 16; i++) {
              const t = (i / 16) * Math.PI * 2 + 0.2;
              if (proj(a, Math.cos(t) / L, Math.sin(t) / Rw).y < 0.02) continue;
              const q = up(at(a, cx + Math.cos(t) * L * k2, Math.sin(t) * Rw * k2, h));
              stud(c, q.x, q.y, 0.75, tone(steel, 0.4));
            }
          }
          // Dents catch the light on their far rim.
          for (const [t, h] of [
            [0.9, 17.4],
            [2.6, 15.8],
            [4.2, 18.6],
            [5.5, 16.4],
          ] as const) {
            if (proj(a, Math.cos(t) / L, Math.sin(t) / Rw).y < 0.1) continue;
            const dh = h - ch;
            const k2 = Math.sqrt(1 - (dh / Rv) * (dh / Rv));
            const q = up(at(a, cx + Math.cos(t) * L * k2 * 0.96, Math.sin(t) * Rw * k2 * 0.96, h));
            ellipsePath(c, q.x, q.y, 2.4, 1.4);
            c.fillStyle = alpha(P.ink, 0.22);
            c.fill();
            ellipsePath(c, q.x + 0.7, q.y + 0.6, 1.9, 0.9);
            c.fillStyle = alpha(P.flowerWhite, 0.4);
            c.fill();
          }
          // A riveted patch plate on whichever side faces us (bolted plates on Boilerplates).
          const plateT = proj(a, 0, 1).y > 0 ? Math.PI / 2 : -Math.PI / 2;
          const plates = elite ? [plateT - 0.35, plateT + 0.45] : [plateT + 0.15];
          for (const t0 of plates) {
            const corners = [
              [t0 - 0.22, 12.6],
              [t0 + 0.22, 12.6],
              [t0 + 0.2, 18.6],
              [t0 - 0.2, 18.6],
            ].map(([t, h]) => {
              const dh = h! - ch;
              const k2 = Math.sqrt(1 - (dh / Rv) * (dh / Rv));
              return up(at(a, cx + Math.cos(t!) * L * k2, Math.sin(t!) * Rw * k2, h!));
            });
            c.beginPath();
            corners.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.fillStyle = tone(steel, elite ? -0.2 : 0.12);
            c.fill();
            ink(c, INNER);
            const mid = { x: corners.reduce((s2, q) => s2 + q.x, 0) / 4, y: corners.reduce((s2, q) => s2 + q.y, 0) / 4 };
            for (const q of corners) stud(c, q.x + (mid.x - q.x) * 0.2, q.y + (mid.y - q.y) * 0.2, 0.55, tone(steel, 0.45));
          }
          c.restore();
          if (frontNear) spout();
          if (!frontNear) handle();
          // The lid, the hatch standing open behind the commander, and the commander.
          const lid = up(at(a, cx, 0, 26.4));
          ellipsePath(c, lid.x, lid.y, 6.2, 2.7);
          litFill(c, tone(steel, 0.25), lid.x, lid.y, 6, 0.4, 0.3);
          ink(c, INNER);
          const hatchC = up(at(a, cx - 5.6, 0, 30.2));
          const hatch = (): void => {
            c.beginPath();
            ellAxes(c, hatchC, proj(a, 0, 4.6), { x: -proj(a, 1.8, 0).x, y: -4.6 });
            litFill(c, tone(steel, 0.1), hatchC.x, hatchC.y, 4.6, 0.4, 0.4);
            ink(c, INNER);
          };
          if (fy > -0.2) hatch();
          const cmd = up(at(a, cx + 0.8, 0, 28.6));
          volume(c, cmd.x, cmd.y, 4.4, 2.6, P.maroon, 109, { hi: 0.4 });
          crewHead(c, a, cmd.x + fx * 0.4, cmd.y - 4.6, 3.3, skin, P.maroon, { band: elite ? P.gold : P.mustard });
          if (fy <= -0.2) hatch();
          // A curl of steam from under the lid.
          const puffs = elite ? [[3, 4.6, 28, 1.6 + k * 0.4], [4.4, 6.2, 31, 1.2 + k * 0.3]] : [[3.2, 4.8, 28.4, 1.2 + k * 0.3]];
          for (const [lx, ly, h, r] of puffs) {
            const q = up(at(a, lx!, ly!, h!));
            volume(c, q.x, q.y, r!, r! * 0.9, P.smokeLight, 113, { line: INNER * 0.8, core: 0.18, sheen: 0.5 });
          }
        },
      },
    ];
    drawParts(parts, a);
  });
}

/** v1.1 Whirligig: a little maroon autogyro with a tractor propeller, mustard tail and cowling,
 * a goggled pilot and a two-bladed rotor. No contact shadow: it flies (the scene casts one). */
function whirligigV2(ctx: Ctx, a: number, k: number, elite: boolean): void {
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const paint = elite ? P.maroonDark : P.maroon;
  const trim = elite ? P.gold : P.mustard;
  const skin = elite ? P.skin2 : P.skin1;
  const hub = at(a, 0, 0, 19);
  const rotorR = 19;
  outlined(ctx, SILHOUETTE, (c) => {
    const tail: Part = {
      lx: -18,
      ly: 0,
      draw: () => {
        limb(c, at(a, -8.2, 0, 6.2), at(a, -20.2, 0, 7.6), 2.5, paint);
        const plane = [at(a, -17.4, -6.2, 7.6), at(a, -21.2, -6.4, 7.6), at(a, -21.2, 6.4, 7.6), at(a, -17.4, 6.2, 7.6)];
        c.beginPath();
        plane.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
        c.closePath();
        litFill(c, trim, (plane[0]!.x + plane[2]!.x) / 2, (plane[0]!.y + plane[2]!.y) / 2, 6, 0.35, 0.35);
        ink(c, INNER);
        const fin = [at(a, -17.6, 0, 7.6), at(a, -21.2, 0, 15.4), at(a, -23.8, 0, 15.4), at(a, -23, 0, 6.8)];
        c.beginPath();
        fin.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
        c.closePath();
        litFill(c, trim, fin[1]!.x, fin[1]!.y + 4, 5, 0.35, 0.35);
        ink(c, INNER);
        const s0 = at(a, -19.4, 0, 11.4);
        const s1 = at(a, -23.3, 0, 11.4);
        c.beginPath();
        c.moveTo(s0.x, s0.y);
        c.lineTo(s1.x, s1.y);
        ink(c, 1.4, paint);
      },
    };
    const gear: Part[] = [-1, 1].map((s) => ({
      lx: 3,
      ly: s * 4.6,
      draw: () => {
        limb(c, at(a, 2, s * 2.6, 2.6), at(a, 3, s * 4.4, -0.4), 1, P.steelDark);
        tyre(c, a, 3, s * 4.8, 1.8, 0.8, k * 0.5, P.steelLight);
      },
    }));
    const body: Part = {
      lx: 0,
      ly: 0,
      draw: () => {
        const fus = shell(c, a, 1, 0, 5, 11.6, 5.6, 5.4, paint, 127, { sheen: 0.5 });
        c.save();
        fus();
        c.clip();
        const s0 = at(a, -10, 0, 4.4);
        const s1 = at(a, 10.6, 0, 4.4);
        c.beginPath();
        c.moveTo(s0.x, s0.y);
        c.lineTo(s1.x, s1.y);
        ink(c, 1.5, trim);
        c.restore();
        ringArc(c, a, 8.6, 0, 5, 1, 0, 4.2, 4, trim, 2);
        // The cockpit and windscreen, the pilot's shoulders and head, a scarf in the slipstream.
        const pit = at(a, -1.2, 0, 10.1);
        ellipsePath(c, pit.x, pit.y, 3.4 + Math.abs(fy) * 0.6, 2 + Math.abs(fx) * 0.2);
        c.fillStyle = tone(P.ink, 0.1);
        c.fill();
        const neck = at(a, -1.4, 0, 12.6);
        const scarfOver = fy <= 0.25;
        if (!scarfOver) scarf(c, neck.x, neck.y, fx, fy, -fy, k, elite ? P.cream : P.mustard);
        const sh = at(a, -1.2, 0, 11.2);
        volume(c, sh.x, sh.y, 3.6, 2.2, P.khaki, 131);
        if (scarfOver) scarf(c, neck.x, neck.y, fx, fy, -fy, k, elite ? P.cream : P.mustard);
        const head = at(a, -1.1, 0, 15);
        crewHead(c, a, head.x, head.y, 3.2, skin, tone(P.woodDark, 0.35), { goggles: elite ? P.gold : P.brass });
        const ws = at(a, 2.8, 0, 11.4);
        c.beginPath();
        ellAxes(c, ws, proj(a, 0, 2.6), { x: 0, y: -1.9 });
        c.fillStyle = alpha(mix(P.glass, P.flowerWhite, 0.3), 0.85);
        c.fill();
        ink(c, INNER * 0.8);
      },
    };
    const prop: Part = {
      lx: 12.6,
      ly: 0,
      draw: () => {
        const ctr = at(a, 12.8, 0, 5);
        const u = proj(a, 0, 6.8);
        const v = { x: 0, y: -6.8 };
        const th = (k / 3) * Math.PI + 0.4;
        for (const off of [0, Math.PI]) {
          const t = th + off;
          const tip = { x: ctr.x + u.x * Math.cos(t) + v.x * Math.sin(t), y: ctr.y + u.y * Math.cos(t) + v.y * Math.sin(t) };
          limb(c, ctr, tip, 1.8, P.wood);
        }
        volume(c, ctr.x, ctr.y, 1.8, 1.7, P.brass, 137, { sheen: 0.6, hi: 0.55 });
      },
    };
    drawParts([tail, ...gear, body, prop], a);
    // The rotor mast and blades, above everything.
    for (const s of [-1, 1]) limb(c, at(a, 0.4, s * 1.6, 10.2), hub, 1, P.steelDark);
    const th = (k / 3) * Math.PI;
    for (const off of [0, Math.PI]) {
      const t = th + off;
      const dx = Math.cos(t);
      const dy = Math.sin(t) * TILT;
      const nx = -dy;
      const ny = dx;
      const nl = Math.hypot(nx, ny) || 1;
      const w0 = 1.3;
      const w1 = 0.8;
      const tip = { x: hub.x + dx * rotorR, y: hub.y + dy * rotorR };
      c.beginPath();
      c.moveTo(hub.x + (nx / nl) * w0, hub.y + (ny / nl) * w0);
      c.lineTo(tip.x + (nx / nl) * w1, tip.y + (ny / nl) * w1);
      c.lineTo(tip.x - (nx / nl) * w1, tip.y - (ny / nl) * w1);
      c.lineTo(hub.x - (nx / nl) * w0, hub.y - (ny / nl) * w0);
      c.closePath();
      litFill(c, P.cream, (hub.x + tip.x) / 2, (hub.y + tip.y) / 2, rotorR * 0.5, 0.3, 0.3);
      ink(c, INNER * 0.8);
      const b0 = { x: hub.x + dx * rotorR * 0.82, y: hub.y + dy * rotorR * 0.82 };
      c.beginPath();
      c.moveTo(b0.x, b0.y);
      c.lineTo(hub.x + dx * rotorR * 0.92, hub.y + dy * rotorR * 0.92);
      ink(c, w1 * 2 + 0.2, paint);
    }
    volume(c, hub.x, hub.y, 1.7, 1.4, P.brass, 139, { sheen: 0.6 });
  });
  // Motion blur of the rotor and propeller: translucent, so outside the outline.
  ellipsePath(ctx, hub.x, hub.y, rotorR, rotorR * TILT);
  ctx.fillStyle = alpha(P.steelLight, 0.13);
  ctx.fill();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = alpha(P.ink, 0.22);
  ctx.stroke();
  const pc = at(a, 12.8, 0, 5);
  ctx.beginPath();
  ellAxes(ctx, pc, proj(a, 0, 6.8), { x: 0, y: -6.8 });
  ctx.fillStyle = alpha(P.steelLight, 0.16);
  ctx.fill();
}

// ------------------------------------------------------------ catalogue

const KITS: Record<string, (elite: boolean) => Kit> = {
  // Skin tones vary across the Army (§5): each type and its elite differ.
  footling: (elite) => ({ tunic: elite ? P.maroonDark : P.maroon, trim: elite ? P.gold : P.mustard, skin: elite ? P.skin3 : P.skin1, hat: 'shako', elite, size: 1 }),
  scarper: (elite) => ({ tunic: elite ? P.maroonDark : P.maroonLight, trim: elite ? P.gold : P.mustard, skin: elite ? P.skin4 : P.skin2, hat: 'cap', elite, size: 0.92, slim: true }),
};

/** An infantry drawer: (ctx, elite, facing angle, walk frame 0-3), feet on the origin. */
export type InfantryDraw = (ctx: Ctx, elite: boolean, a: number, k: number) => void;
export type VehicleDraw = (ctx: Ctx, a: number, k: number, elite: boolean) => void;

/** Death-bounce hats drawn around the origin (the helmet sprite shifts them into its box). */
function hatOnly(kind: HatKind, s = 1, tunic: string = P.maroon, plume = 1): (ctx: Ctx) => void {
  return (ctx) => hat(ctx, kind, 0, 0, 0, 1, -1, s, tunic, P.mustard, false, plume);
}

/** Infantry types: 8 directions × 4 walk frames. Keys `enemy.<type>.<n|e>.<d>.<k>`. */
export const INFANTRY: Record<string, { draw: InfantryDraw; box: [number, number]; helmet?: (ctx: Ctx) => void }> = {
  footling: { draw: (c, e, a, k) => footman(c, KITS.footling!(e), a, k), box: [0.75, 1.05], helmet: (c) => hatSprite(c, KITS.footling!(false)) },
  scarper: { draw: (c, e, a, k) => footman(c, KITS.scarper!(e), a, k), box: [0.75, 1.05], helmet: (c) => hatSprite(c, KITS.scarper!(false)) },
  lummox: { draw: lummox, box: [1.15, 1.45], helmet: hatOnly('basin', 1.25) },
  brolly: { draw: (c, e, a, k) => brollyGuard(c, e, a, k, false), box: [0.95, 1.35], helmet: hatOnly('cap') },
  sawbones: { draw: sawbones, box: [0.8, 1.1], helmet: hatOnly('fieldcap') },
  trio: { draw: trio, box: [0.85, 1.45], helmet: hatOnly('shako') },
  tiddler: { draw: tiddler, box: [0.55, 0.8], helmet: hatOnly('forage', 0.8, P.maroonLight) },
  tubthumper: { draw: tubthumper, box: [0.9, 1.25], helmet: hatOnly('shako', 1, P.maroon, 1.45) },
};

/** Extra per-frame infantry variants, keyed `<normal frame key>.<suffix>`. */
export const INFANTRY_VARIANTS: Record<string, { suffix: string; draw: InfantryDraw }[]> = {
  // Brolly Guard with the shield broken: the umbrella blown inside out.
  brolly: [{ suffix: 'b', draw: (c, e, a, k) => brollyGuard(c, e, a, k, true) }],
};

/** Vehicles, air units and bosses: 16 facings × `frames`. Keys `enemy.<type>.<n|e>.<dd>.<k>`. */
export const VEHICLES: Record<string, { draw: VehicleDraw; frames: number; box: number; atlas?: string }> = {
  puttputt: { draw: puttputtV2, frames: 2, box: 1 },
  tinkettle: { draw: tinkettleV2, frames: 2, box: 1.3 },
  whirligig: { draw: whirligigV2, frames: 3, box: 1.4 },
  gasbag: { draw: gasbag, frames: 2, box: 1.8 },
  flattener: { draw: flattener, frames: 2, box: 2.2, atlas: 'boss' },
  dredger: { draw: dredger, frames: 2, box: 2.4, atlas: 'boss' },
  grinder: { draw: grinder, frames: 2, box: 2.4, atlas: 'boss' },
  smogmother: { draw: smogmother, frames: 2, box: 2.6, atlas: 'boss' },
  kerblam: { draw: (c, a, k, e) => kerblam(c, a, k, e, false), frames: 2, box: 2.4, atlas: 'boss' },
};

/** Extra per-frame vehicle variants, keyed `<normal frame key>.<suffix>`. */
export const VEHICLE_VARIANTS: Record<string, { suffix: string; draw: VehicleDraw }[]> = {
  // Kerblam Mech's final phase: plating shed, boiler exposed.
  kerblam: [{ suffix: 'bare', draw: (c, a, k, e) => kerblam(c, a, k, e, true) }],
};

/** The hat that bounces off a defeated soldier, drawn round the origin like the soldier's own. */
function hatSprite(ctx: Ctx, k: Kit): void {
  outlined(ctx, SILHOUETTE, (c) => {
    // Kept clear of the helmet sprite's box edges (enemySprites: 0.45 × 0.55 cells).
    if (k.hat === 'shako') shako(c, 0, -8.9, 0.35, 0.94, P.maroon, k.trim, false, 0);
    else softCap(c, 0, -5.4, 0.35, 0.94, k.tunic, k.trim);
  });
}

/** Units are drawn larger than their collision radius so they read at phone sizes. */
export const UNIT_SCALE = 1.25;

export const INFANTRY_DIRS = 8;
export const VEHICLE_DIRS = 16;
export const WALK_FRAMES = 4;

export function enemySprites(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  for (const [type, inf] of Object.entries(INFANTRY)) {
    const variants = [{ suffix: '', draw: inf.draw }, ...(INFANTRY_VARIANTS[type] ?? []).map((v) => ({ suffix: `.${v.suffix}`, draw: v.draw }))];
    for (const variant of variants) {
      for (const elite of [false, true]) {
        const v = elite ? 'e' : 'n';
        for (let d = 0; d < INFANTRY_DIRS; d++) {
          for (let k = 0; k < WALK_FRAMES; k++) {
            out.push({
              key: `enemy.${type}.${v}.${d}.${k}${variant.suffix}`,
              atlas: 'units',
              w: inf.box[0] * UNIT_SCALE,
              h: inf.box[1] * UNIT_SCALE,
              ax: 0.5,
              ay: 0.85,
              draw: (ctx) => {
                ctx.scale(UNIT_SCALE, UNIT_SCALE);
                variant.draw(ctx, elite, facingAngle(d, INFANTRY_DIRS), k);
              },
            });
          }
        }
      }
    }
    if (inf.helmet) {
      const hatDraw = inf.helmet;
      out.push({
        key: `enemy.${type}.helmet`,
        atlas: 'units',
        w: 0.45 * UNIT_SCALE,
        h: 0.55 * UNIT_SCALE,
        ax: 0.5,
        ay: 0.6,
        draw: (ctx) => {
          ctx.scale(UNIT_SCALE, UNIT_SCALE);
          ctx.translate(0, 17);
          hatDraw(ctx);
        },
      });
    }
  }
  for (const [type, v] of Object.entries(VEHICLES)) {
    const variants = [{ suffix: '', draw: v.draw }, ...(VEHICLE_VARIANTS[type] ?? []).map((x) => ({ suffix: `.${x.suffix}`, draw: x.draw }))];
    for (const variant of variants) {
      for (const elite of [false, true]) {
        for (let d = 0; d < VEHICLE_DIRS; d++) {
          for (let k = 0; k < v.frames; k++) {
            out.push({
              key: `enemy.${type}.${elite ? 'e' : 'n'}.${pad2(d)}.${k}${variant.suffix}`,
              // One atlas group per boss, so a boss level loads only its own boss art.
              atlas: v.atlas === 'boss' ? `boss-${type}` : (v.atlas ?? 'units'),
              w: v.box * UNIT_SCALE,
              h: v.box * UNIT_SCALE,
              ax: 0.5,
              ay: 0.68,
              draw: (ctx) => {
                ctx.scale(UNIT_SCALE, UNIT_SCALE);
                variant.draw(ctx, facingAngle(d, VEHICLE_DIRS), k, elite);
              },
            });
          }
        }
      }
    }
  }
  return out;
}
