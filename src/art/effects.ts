// Effect and projectile sprites (DESIGN.md §16.1). White-filled markers are tinted at
// runtime; everything else is painted in final colours.
import { P } from './palette.ts';
import { PT } from './palette-towers.ts';
import { LINE, LINE_THIN, alpha, ball, box, ellipsePath, glint, ink, litFill, roundRectPath, seeded, starPath, tone, type Ctx } from './paint.ts';
import type { SpriteSpec } from './spec.ts';

function softShadow(ctx: Ctx): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 36);
  g.addColorStop(0, alpha(P.ink, 0.55));
  g.addColorStop(0.6, alpha(P.ink, 0.3));
  g.addColorStop(1, alpha(P.ink, 0));
  ctx.save();
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function muzzle(ctx: Ctx, k: number): void {
  const len = [22, 28, 18][k]!;
  ctx.save();
  ctx.scale(1, 0.62);
  starPath(ctx, len * 0.45, 0, 7, len * 0.18, len * 0.5, k * 0.4);
  ctx.fillStyle = P.flash;
  ctx.fill();
  ctx.restore();
  ellipsePath(ctx, len * 0.35, 0, len * 0.42, len * 0.18);
  ctx.fillStyle = P.flashCore;
  ctx.fill();
}

function tracer(ctx: Ctx): void {
  const g = ctx.createLinearGradient(-60, 0, 0, 0);
  g.addColorStop(0, alpha(P.flash, 0));
  g.addColorStop(0.7, alpha(P.flash, 0.85));
  g.addColorStop(1, P.flashCore);
  roundRectPath(ctx, -60, -2.2, 60, 4.4, 2.2);
  ctx.fillStyle = g;
  ctx.fill();
}

function puff(ctx: Ctx, seed: number, base: string, r: number): void {
  const rnd = seeded(seed);
  const blobs = Array.from({ length: 6 }, () => ({ x: (rnd() - 0.5) * r * 1.1, y: (rnd() - 0.5) * r * 0.8, r: r * (0.45 + rnd() * 0.35) })).sort((a, b) => a.y - b.y);
  for (const b of blobs) ball(ctx, b.x, b.y, b.r, b.r * 0.9, base, { line: LINE_THIN, hi: 0.3, lo: 0.25 });
}

function blast(ctx: Ctx, k: number): void {
  // Frames 0-4: flash, fireball, bloom, breaking up, smoke.
  const r = [14, 22, 28, 30, 30][k]!;
  const rnd = seeded(40 + k);
  if (k <= 3) {
    starPath(ctx, 0, 0, 9, r * 0.7, r * (k === 0 ? 1.2 : 1.05), rnd() * 2);
    ctx.fillStyle = k === 3 ? P.fireDark : P.fire;
    ctx.fill();
    ink(ctx, LINE);
  }
  if (k >= 1 && k <= 3) {
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      const d = r * 0.35 * rnd();
      ball(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.42, r * 0.38, k === 3 ? P.fire : P.flash, { line: 0, hi: 0.6 });
    }
  }
  if (k <= 1) {
    ellipsePath(ctx, 0, 0, r * 0.5, r * 0.45);
    ctx.fillStyle = P.flashCore;
    ctx.fill();
  }
  if (k >= 3) puff(ctx, 90 + k, k === 3 ? P.smoke : P.smokeLight, r * 0.8);
}

function debris(ctx: Ctx, k: number): void {
  if (k === 0) ball(ctx, 0, 0, 5, 4, P.dirtDark, { line: LINE_THIN });
  else if (k === 1) {
    roundRectPath(ctx, -5, -2, 10, 4, 1);
    litFill(ctx, P.steel, 0, 0, 5);
    ink(ctx, LINE_THIN);
  } else if (k === 2) ball(ctx, 0, 0, 4.5, 3, P.sandbag, { line: LINE_THIN });
  else {
    roundRectPath(ctx, -4, -1.6, 8, 3.2, 1);
    litFill(ctx, P.wood, 0, 0, 4);
    ink(ctx, LINE_THIN);
  }
}

function scorch(ctx: Ctx, k: number): void {
  const rnd = seeded(70 + k);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 18;
    const r = 10 + rnd() * 12;
    const g = ctx.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d * 0.6, 0, Math.cos(a) * d, Math.sin(a) * d * 0.6, r);
    g.addColorStop(0, alpha(P.scorch, 0.45));
    g.addColorStop(1, alpha(P.scorch, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.6, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function coin(ctx: Ctx): void {
  ball(ctx, 0, 0, 10, 10, P.brass, { hi: 0.6 });
  ellipsePath(ctx, 0, 0, 6, 6);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = P.brassDark;
  ctx.stroke();
  ctx.fillStyle = P.brassDark;
  roundRectPath(ctx, -1.2, -4, 2.4, 8, 1);
  ctx.fill();
}

/** A sold tower's packing crate (§16.1 juice): front and top faces, planks and a stencilled coin. */
function packingCrate(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-13, -6);
  ctx.lineTo(-7, -12);
  ctx.lineTo(15, -12);
  ctx.lineTo(9, -6);
  ctx.closePath();
  litFill(ctx, tone(P.crate, 0.18), 0, -9, 14);
  ink(ctx, LINE);
  ctx.beginPath();
  ctx.moveTo(9, -6);
  ctx.lineTo(15, -12);
  ctx.lineTo(15, 5);
  ctx.lineTo(9, 11);
  ctx.closePath();
  litFill(ctx, P.crateDark, 12, 0, 10);
  ink(ctx, LINE);
  box(ctx, -13, -6, 22, 17, 1.5, P.crate);
  ctx.beginPath();
  for (const y of [-1, 5]) {
    ctx.moveTo(-12, y);
    ctx.lineTo(8, y);
  }
  ink(ctx, LINE_THIN, alpha(P.crateDark, 0.9));
  ellipsePath(ctx, -2, 2.5, 3.2, 3.2);
  ctx.fillStyle = alpha(P.brassDark, 0.8);
  ctx.fill();
}

/** The parachute that carries the crate off: a striped canopy and its cords. */
function parachute(ctx: Ctx): void {
  ctx.beginPath();
  for (const x of [-17, -6, 6, 17]) {
    ctx.moveTo(x, -8);
    ctx.lineTo(0, 16);
  }
  ink(ctx, 1.4, alpha(P.ink, 0.85));
  ctx.beginPath();
  ctx.moveTo(-20, -6);
  ctx.quadraticCurveTo(-20, -26, 0, -26);
  ctx.quadraticCurveTo(20, -26, 20, -6);
  ctx.quadraticCurveTo(15, -10, 10, -6);
  ctx.quadraticCurveTo(5, -10, 0, -6);
  ctx.quadraticCurveTo(-5, -10, -10, -6);
  ctx.quadraticCurveTo(-15, -10, -20, -6);
  ctx.closePath();
  litFill(ctx, P.rocketWhite, -4, -18, 22);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = P.stop;
  for (const x of [-10, 4]) ctx.fillRect(x, -28, 6, 24);
  ctx.restore();
  ink(ctx, LINE);
}

/** The biscuit a leaker runs off with (§16.1): the Crown Biscuit Stores' finest. */
function biscuit(ctx: Ctx): void {
  ball(ctx, 0, 0, 8, 7, P.hay, { line: LINE, hi: 0.5 });
  ctx.fillStyle = P.hayDark;
  for (const [x, y] of [
    [-3, -2],
    [2, -3],
    [0, 2],
    [4, 1],
  ]) {
    ellipsePath(ctx, x!, y!, 1.1, 1.1);
    ctx.fill();
  }
}

function poof(ctx: Ctx, k: number): void {
  const r = [10, 16, 20, 22][k]!;
  const a = [1, 1, 0.8, 0.5][k]!;
  ctx.globalAlpha = a;
  puff(ctx, 20 + k, P.cream, r);
  ctx.globalAlpha = 1;
}

function rocket(ctx: Ctx): void {
  roundRectPath(ctx, -10, -3, 16, 6, 3);
  litFill(ctx, P.rocketWhite, 0, 0, 6);
  ink(ctx, LINE_THIN);
  ctx.beginPath();
  ctx.moveTo(5, -3);
  ctx.quadraticCurveTo(12, 0, 5, 3);
  ctx.closePath();
  ctx.fillStyle = P.rocketRed;
  ctx.fill();
  ink(ctx, LINE_THIN);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-3, s * 2.5);
    ctx.quadraticCurveTo(-8, s * 8, -11, s * 6);
    ctx.lineTo(-7, s * 2.5);
    ctx.closePath();
    ctx.fillStyle = P.rocketWhite;
    ctx.fill();
    ink(ctx, LINE_THIN * 0.8);
  }
}

function chevron(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-8, -9);
  ctx.lineTo(4, 0);
  ctx.lineTo(-8, 9);
  ctx.lineTo(-3, 0);
  ctx.closePath();
  ctx.fillStyle = P.white;
  ctx.fill();
  ink(ctx, LINE_THIN + 0.6, alpha(P.ink, 0.7));
}

function hatch(ctx: Ctx): void {
  // Transparent tile with white diagonal stripes, tinted at runtime (V-3).
  ctx.save();
  ctx.beginPath();
  ctx.rect(-32, -32, 64, 64);
  ctx.clip();
  ctx.strokeStyle = P.white;
  ctx.lineWidth = 7;
  for (let i = -96; i <= 96; i += 21.333) {
    ctx.beginPath();
    ctx.moveTo(i - 32, 32);
    ctx.lineTo(i + 32, -32);
    ctx.stroke();
  }
  ctx.restore();
}


// ------------------------------------------------------------ M2 effects

function flamePuff(ctx: Ctx, k: number): void {
  // An irregular cluster of fire blobs with a hot core: reads as a gout of flame in motion.
  const rnd = seeded(800 + k);
  const blobs = Array.from({ length: 5 }, (_, i) => ({
    x: (rnd() - 0.5) * 12 + (i - 2) * 2,
    y: (rnd() - 0.5) * 9,
    r: 6 + rnd() * 4,
  })).sort((a, b) => b.r - a.r);
  for (const b of blobs) {
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 0.9, rnd(), 0, Math.PI * 2);
    const g = ctx.createRadialGradient(b.x - b.r * 0.2, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
    g.addColorStop(0, P.flash);
    g.addColorStop(0.6, P.fire);
    g.addColorStop(1, P.fireDark);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(-1, -1, 5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = alpha(P.flashCore, 0.9);
  ctx.fill();
}

function fireTongues(ctx: Ctx, k: number): void {
  const hs = [
    [14, 20, 12],
    [17, 16, 19],
    [12, 22, 15],
    [19, 14, 17],
  ][k]!;
  hs.forEach((h, i) => {
    const x = (i - 1) * 6;
    ctx.beginPath();
    ctx.moveTo(x - 5, 0);
    ctx.quadraticCurveTo(x - 5, -h * 0.5, x + (i - 1) * 1.5, -h);
    ctx.quadraticCurveTo(x + 5, -h * 0.5, x + 5, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -h);
    g.addColorStop(0, P.fireDark);
    g.addColorStop(0.35, P.fire);
    g.addColorStop(0.8, P.flash);
    g.addColorStop(1, P.flashCore);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = LINE_THIN * 0.8;
    ctx.strokeStyle = alpha(P.fireDark, 0.9);
    ctx.stroke();
  });
}

function beamShaft(ctx: Ctx): void {
  // A soft horizontal shaft of warm sunlight; painted, not a neon line.
  const g = ctx.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, alpha(PT.sunlight, 0));
  g.addColorStop(0.3, alpha(PT.sunlight, 0.75));
  g.addColorStop(0.5, PT.sunCore);
  g.addColorStop(0.7, alpha(PT.sunlight, 0.75));
  g.addColorStop(1, alpha(PT.sunlight, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, -10, 64, 20);
}

function softGlow(ctx: Ctx, r: number, inner: string, outer: string, rays: number): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, alpha(inner, 0.95));
  g.addColorStop(0.4, alpha(outer, 0.6));
  g.addColorStop(1, alpha(outer, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (rays > 0) {
    ctx.fillStyle = alpha(inner, 0.55);
    starPath(ctx, 0, 0, rays, r * 0.12, r * 0.85, 0.3);
    ctx.fill();
  }
}

function spark(ctx: Ctx, fill: string): void {
  starPath(ctx, 0, 0, 4, 2.4, 8.5, 0.2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = alpha(P.infoDark, 0.7);
  ctx.stroke();
  ellipsePath(ctx, 0, 0, 2, 2);
  ctx.fillStyle = P.white;
  ctx.fill();
}

function iceShard(ctx: Ctx, k: number): void {
  const rnd = seeded(900 + k);
  ctx.beginPath();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const r = i % 2 ? 3 + rnd() * 2 : 6 + rnd() * 3;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  litFill(ctx, PT.iceBlue, 0, 0, 6, 0.5, 0.3);
  ink(ctx, LINE_THIN * 0.8, alpha(P.ink, 0.8));
}

function frozenBlock(ctx: Ctx): void {
  roundRectPath(ctx, -20, -44, 40, 46, 7);
  const g = ctx.createLinearGradient(-20, -44, 20, 2);
  g.addColorStop(0, alpha(P.white, 0.75));
  g.addColorStop(0.35, alpha(PT.iceBlue, 0.6));
  g.addColorStop(1, alpha(PT.iceDeep, 0.6));
  ctx.fillStyle = g;
  ctx.fill();
  ink(ctx, LINE_THIN + 0.4, alpha(P.infoDark, 0.9));
  ctx.strokeStyle = alpha(P.white, 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -36);
  ctx.lineTo(-8, -40);
  ctx.moveTo(-15, -28);
  ctx.lineTo(-3, -38);
  ctx.stroke();
  ctx.strokeStyle = alpha(PT.iceDeep, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, -44);
  ctx.lineTo(2, -30);
  ctx.lineTo(9, -22);
  ctx.stroke();
}

function frostRing(ctx: Ctx): void {
  const rnd = seeded(950);
  ctx.save();
  ctx.scale(1, 0.55);
  const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 62);
  g.addColorStop(0, alpha(PT.frost, 0));
  g.addColorStop(0.55, alpha(PT.frost, 0.55));
  g.addColorStop(0.85, alpha(PT.frostDeep, 0.5));
  g.addColorStop(1, alpha(PT.frost, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(P.white, 0.8);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 34 + rnd() * 24;
    ellipsePath(ctx, Math.cos(a) * r, Math.sin(a) * r, 1.6 + rnd() * 1.6, 1.6 + rnd() * 1.6);
    ctx.fill();
  }
  ctx.restore();
}

function soapBubble(ctx: Ctx): void {
  const r = 27;
  const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, r);
  g.addColorStop(0, alpha(P.white, 0.25));
  g.addColorStop(0.7, alpha(PT.soap, 0.28));
  g.addColorStop(0.88, alpha(PT.soapPink, 0.5));
  g.addColorStop(1, alpha(P.infoLight, 0.7));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = LINE_THIN;
  ctx.strokeStyle = alpha(P.infoDark, 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, Math.PI * 1.1, Math.PI * 1.45);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = alpha(P.white, 0.85);
  ctx.stroke();
  ellipsePath(ctx, 10, 12, 3, 2);
  ctx.fillStyle = alpha(P.white, 0.6);
  ctx.fill();
}

function bubblePop(ctx: Ctx, k: number): void {
  const r = [18, 25, 30][k]!;
  const a = [0.9, 0.7, 0.45][k]!;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + k * 0.2;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.4 - k * 0.6, 2 - k * 0.3, ang, 0, Math.PI * 2);
    ctx.fillStyle = alpha(i % 2 ? PT.soapPink : P.infoLight, a);
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = alpha(P.infoDark, a * 0.6);
    ctx.stroke();
  }
  if (k === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = alpha(P.white, 0.6);
    ctx.stroke();
  }
}

function foam(ctx: Ctx): void {
  const rnd = seeded(960);
  for (let i = 0; i < 11; i++) {
    const x = (rnd() - 0.5) * 42;
    const y = (rnd() - 0.5) * 18;
    const r = 4 + rnd() * 5;
    ball(ctx, x, y, r, r * 0.75, i % 3 === 0 ? PT.soap : P.white, { line: LINE_THIN * 0.6, hi: 0.1, lo: 0.2 });
  }
}

function pieTop(ctx: Ctx): void {
  ellipsePath(ctx, 0, 1.5, 10, 7);
  litFill(ctx, PT.crust, 0, 0, 10);
  ink(ctx, LINE_THIN + 0.3);
  ellipsePath(ctx, 0, 0, 7.6, 5);
  litFill(ctx, PT.custard, 0, 0, 8, 0.5, 0.2);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = PT.custardDark;
  ctx.stroke();
  glint(ctx, -1, -1, 4, 0.7);
}

function custardSplat(ctx: Ctx): void {
  const rnd = seeded(970);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 16;
    const r = 5 + rnd() * 7;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.55, r, r * 0.6, a, 0, Math.PI * 2);
    ctx.fillStyle = alpha(PT.custard, 0.9);
    ctx.fill();
  }
  ctx.fillStyle = alpha(PT.custardDark, 0.7);
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 18 + rnd() * 8;
    ellipsePath(ctx, Math.cos(a) * d, Math.sin(a) * d * 0.55, 2, 1.4);
    ctx.fill();
  }
  // Crust crumbs.
  ctx.fillStyle = PT.crust;
  for (let i = 0; i < 4; i++) {
    ellipsePath(ctx, (rnd() - 0.5) * 20, (rnd() - 0.5) * 8, 2.4, 1.6);
    ctx.fill();
  }
}

function custardDrip(ctx: Ctx): void {
  for (const [x, l] of [
    [-5, 7],
    [0, 11],
    [5, 6],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x! - 3, -6);
    ctx.lineTo(x! + 3, -6);
    ctx.lineTo(x! + 1.6, -6 + l!);
    ctx.arc(x!, -6 + l!, 1.6, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = PT.custard;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = PT.custardDark;
    ctx.stroke();
  }
}

function puddle(ctx: Ctx): void {
  const rnd = seeded(980);
  ctx.beginPath();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 26 + rnd() * 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.55;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = alpha(P.treacle, 0.8);
  ctx.fill();
  ctx.lineWidth = LINE_THIN;
  ctx.strokeStyle = alpha(tone(P.treacle, -0.4), 0.8);
  ctx.stroke();
  ellipsePath(ctx, -8, -5, 8, 2.6);
  ctx.fillStyle = alpha(P.treacleLight, 0.55);
  ctx.fill();
}

function note(ctx: Ctx, k: number): void {
  const draw = (): void => {
    if (k === 0) {
      ellipsePath(ctx, -3, 6, 5, 3.6);
      ctx.moveTo(1.6, 5);
      ctx.rect(1, -10, 2.2, 16);
      ctx.moveTo(3, -10);
      ctx.quadraticCurveTo(10, -6, 8, 0);
      ctx.quadraticCurveTo(8, -5, 3, -6);
    } else {
      ellipsePath(ctx, -7, 7, 4.2, 3);
      ctx.moveTo(8, 5);
      ctx.ellipse(5, 5, 4.2, 3, 0, 0, Math.PI * 2);
      ctx.rect(-4, -8, 2, 15);
      ctx.rect(8, -10, 2, 15);
      ctx.moveTo(-4, -8);
      ctx.lineTo(10, -10);
      ctx.lineTo(10, -6);
      ctx.lineTo(-4, -4);
      ctx.closePath();
    }
  };
  ctx.beginPath();
  draw();
  ctx.lineWidth = 3.4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.cream;
  ctx.stroke();
  ctx.fillStyle = PT.note;
  ctx.fill();
}

function dizzy(ctx: Ctx): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = alpha(P.ink, 0.35);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    starPath(ctx, Math.cos(a) * 14, Math.sin(a) * 5, 5, 1.8, 4.2, -Math.PI / 2);
    ctx.fillStyle = P.gold;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
  }
}

function heal(ctx: Ctx): void {
  // A leafy green sparkle (deliberately not a cross symbol).
  starPath(ctx, 0, 0, 4, 2.6, 10, Math.PI / 4);
  ctx.fillStyle = PT.heal;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = P.goDark;
  ctx.stroke();
  ellipsePath(ctx, 0, 0, 2.2, 2.2);
  ctx.fillStyle = P.white;
  ctx.fill();
  for (const [x, y] of [
    [9, -7],
    [-8, 7],
  ]) {
    starPath(ctx, x!, y!, 4, 1, 3.6, Math.PI / 4);
    ctx.fillStyle = P.goLight;
    ctx.fill();
  }
}

function speech(ctx: Ctx): void {
  // Anchor at the tail tip (0,0); the bubble body sits above it.
  ctx.beginPath();
  ctx.roundRect(-48, -44, 96, 34, 12);
  ctx.moveTo(-8, -11);
  ctx.lineTo(0, 0);
  ctx.lineTo(6, -11);
  ctx.fillStyle = P.parchment;
  ctx.fill();
  ink(ctx, LINE);
  // Cover the seam between the tail and the body.
  ctx.fillStyle = P.parchment;
  ctx.fillRect(-6.5, -13, 12, 4);
  ctx.fillStyle = alpha(P.white, 0.5);
  ctx.beginPath();
  ctx.roundRect(-42, -40, 60, 6, 3);
  ctx.fill();
}

function iceShield(ctx: Ctx): void {
  const rx = 70;
  const ry = 40;
  const h = 78;
  ctx.beginPath();
  ctx.moveTo(-rx, 0);
  ctx.bezierCurveTo(-rx, -h * 1.1, rx, -h * 1.1, rx, 0);
  ctx.ellipse(0, 0, rx, ry * 0.55, 0, 0, Math.PI);
  ctx.closePath();
  const g = ctx.createLinearGradient(-rx, -h, rx, 0);
  g.addColorStop(0, alpha(P.white, 0.55));
  g.addColorStop(0.4, alpha(PT.iceBlue, 0.35));
  g.addColorStop(1, alpha(PT.iceDeep, 0.45));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = LINE;
  ctx.strokeStyle = alpha(P.infoDark, 0.75);
  ctx.stroke();
  // Facets.
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = alpha(P.white, 0.7);
  ctx.beginPath();
  ctx.moveTo(-40, -60);
  ctx.lineTo(-20, -30);
  ctx.lineTo(-45, -8);
  ctx.moveTo(-20, -30);
  ctx.lineTo(10, -40);
  ctx.lineTo(35, -18);
  ctx.moveTo(10, -40);
  ctx.lineTo(18, -70);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-52, -40);
  ctx.quadraticCurveTo(-40, -66, -12, -76);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = alpha(P.white, 0.6);
  ctx.stroke();
}

function shieldHit(ctx: Ctx): void {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    starPath(ctx, Math.cos(a) * 18, Math.sin(a) * 18, 4, 1.4, 5.5, a);
    ctx.fillStyle = i % 2 ? P.infoLight : P.white;
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = alpha(P.infoDark, 0.8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = alpha(P.infoLight, 0.6);
  ctx.stroke();
}

function bomblet(ctx: Ctx): void {
  ball(ctx, 0, 0, 5, 5, P.gunmetal, { hi: 0.55, line: LINE_THIN + 0.3 });
  ellipsePath(ctx, 0, 0, 5.2, 1.6);
  ctx.fillStyle = P.brass;
  ctx.fill();
}

/** M2 sprites: flames, beams, ice, bubbles, custard, notes and boss shields. */
function m2Sprites(fx: (key: string, w: number, h: number, ax: number, ay: number, draw: (c: Ctx) => void) => SpriteSpec): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  for (let k = 0; k < 4; k++) out.push(fx(`fx.flame.${k}`, 0.45, 0.45, 0.5, 0.5, (c) => flamePuff(c, k)));
  for (let k = 0; k < 4; k++) out.push(fx(`fx.fire.${k}`, 0.4, 0.45, 0.5, 0.85, (c) => fireTongues(c, k)));
  out.push(
    fx('fx.beam', 1, 0.32, 0, 0.5, beamShaft),
    fx('fx.beamflare', 0.6, 0.6, 0.5, 0.5, (c) => softGlow(c, 19, PT.sunCore, PT.sunlight, 6)),
    fx('fx.charge', 0.7, 0.7, 0.5, 0.5, (c) => softGlow(c, 22, PT.sunCore, P.flash, 8)),
    fx('fx.spark.blue', 0.3, 0.3, 0.5, 0.5, (c) => spark(c, P.infoLight)),
    fx('fx.frozen', 0.75, 0.8, 0.5, 0.8, frozenBlock),
    fx('fx.frost', 2, 1.15, 0.5, 0.5, frostRing),
    fx('fx.bubble', 0.9, 0.9, 0.5, 0.5, soapBubble),
    fx('fx.foam', 0.9, 0.5, 0.5, 0.5, foam),
    fx('proj.pie', 0.35, 0.3, 0.5, 0.5, pieTop),
    fx('fx.custard.splat', 0.9, 0.6, 0.5, 0.5, custardSplat),
    fx('fx.custard.drip', 0.3, 0.3, 0.5, 0.25, custardDrip),
    fx('proj.bomblet', 0.18, 0.18, 0.5, 0.5, bomblet),
    fx('fx.puddle', 1, 0.62, 0.5, 0.5, puddle),
    fx('fx.dizzy', 0.5, 0.25, 0.5, 0.5, dizzy),
    fx('fx.heal', 0.36, 0.36, 0.5, 0.5, heal),
    fx('fx.speech', 1.6, 0.72, 0.5, 1, speech),
    fx('fx.iceshield', 2.4, 2.1, 0.5, 0.78, iceShield),
    fx('fx.shieldhit', 0.8, 0.8, 0.5, 0.5, shieldHit),
  );
  for (let k = 0; k < 3; k++) out.push(fx(`fx.ice.${k}`, 0.28, 0.25, 0.5, 0.5, (c) => iceShard(c, k)));
  for (let k = 0; k < 3; k++) out.push(fx(`fx.pop.${k}`, 1, 1, 0.5, 0.5, (c) => bubblePop(c, k)));
  for (let k = 0; k < 3; k++) out.push(fx(`fx.steam.${k}`, 0.6, 0.55, 0.5, 0.5, (c) => puff(c, 30 + k, k === 1 ? P.cream : P.white, 12)));
  for (let k = 0; k < 2; k++) out.push(fx(`fx.note.${k}`, 0.36, 0.4, 0.5, 0.5, (c) => note(c, k)));
  return out;
}

export function effectSprites(): SpriteSpec[] {
  const fx = (key: string, w: number, h: number, ax: number, ay: number, draw: (c: Ctx) => void): SpriteSpec => ({ key, atlas: 'fx', w, h, ax, ay, draw });
  const out: SpriteSpec[] = [
    fx('fx.shadow', 1.2, 0.65, 0.5, 0.5, softShadow),
    fx('fx.tracer', 1, 0.12, 1, 0.5, tracer),
    fx('fx.coin', 0.36, 0.36, 0.5, 0.5, coin),
    fx('fx.crate', 0.5, 0.42, 0.5, 0.6, packingCrate),
    fx('fx.parachute', 0.7, 0.7, 0.5, 0.75, parachute),
    fx('fx.biscuit', 0.3, 0.28, 0.5, 0.5, biscuit),
    fx('fx.spark', 0.3, 0.3, 0.5, 0.5, (c) => {
      starPath(c, 0, 0, 4, 2.5, 8, 0.4);
      c.fillStyle = P.flash;
      c.fill();
    }),
    fx('fx.dot', 0.2, 0.2, 0.5, 0.5, (c) => {
      ellipsePath(c, 0, 0, 4.5, 4.5);
      c.fillStyle = P.white;
      c.fill();
      ink(c, LINE_THIN, alpha(P.ink, 0.6));
    }),
    fx('fx.chevron', 0.4, 0.4, 0.5, 0.5, chevron),
    fx('fx.hatch', 1, 1, 0.5, 0.5, hatch),
    fx('fx.treacle.splat', 0.9, 0.6, 0.5, 0.5, (c) => {
      const rnd = seeded(5);
      for (let i = 0; i < 6; i++) {
        ellipsePath(c, (rnd() - 0.5) * 30, (rnd() - 0.5) * 14, 6 + rnd() * 8, 4 + rnd() * 4);
        c.fillStyle = alpha(P.treacle, 0.75);
        c.fill();
      }
      glintBlob(c);
    }),
    fx('fx.treacle.blob', 0.25, 0.25, 0.5, 0.5, (c) => ball(c, 0, 0, 5, 5, P.treacle, { line: LINE_THIN, hi: 0.5 })),
    fx('proj.rocket', 0.42, 0.3, 0.5, 0.5, rocket),
    fx('proj.shell', 0.3, 0.3, 0.5, 0.5, (c) => ball(c, 0, 0, 6.5, 6.5, P.gunmetal, { hi: 0.6 })),
  ];
  for (let k = 0; k < 3; k++) out.push(fx(`fx.muzzle.${k}`, 0.55, 0.4, 0.08, 0.5, (c) => muzzle(c, k)));
  for (let k = 0; k < 4; k++) out.push(fx(`fx.smoke.${k}`, 0.7, 0.6, 0.5, 0.5, (c) => puff(c, 10 + k, k % 2 ? P.smokeLight : P.smoke, 14)));
  for (let k = 0; k < 5; k++) out.push(fx(`fx.blast.${k}`, 1.3, 1.2, 0.5, 0.55, (c) => blast(c, k)));
  for (let k = 0; k < 4; k++) out.push(fx(`fx.debris.${k}`, 0.25, 0.2, 0.5, 0.5, (c) => debris(c, k)));
  for (let k = 0; k < 3; k++) out.push(fx(`fx.scorch.${k}`, 1.3, 0.85, 0.5, 0.5, (c) => scorch(c, k)));
  for (let k = 0; k < 4; k++) out.push(fx(`fx.poof.${k}`, 0.9, 0.8, 0.5, 0.6, (c) => poof(c, k)));
  out.push(...m2Sprites(fx));
  return out;
}

function glintBlob(ctx: Ctx): void {
  ellipsePath(ctx, -6, -3, 4, 1.6);
  ctx.fillStyle = alpha(tone(P.treacleLight, 0.3), 0.7);
  ctx.fill();
}
