// UI icons and portraits for the DOM overlay, drawn in the same painted style as the
// world (DESIGN.md §16.5: no icon fonts, no emoji). Baked into the 'ui' atlas.
import { INFANTRY, VEHICLES } from './enemies.ts';
import { P } from './palette.ts';
import { LINE, LINE_THIN, alpha, ball, box, ellipsePath, glint, ink, litFill, roundRectPath, starPath, type Ctx } from './paint.ts';
import type { SpriteSpec } from './spec.ts';
import { TOWER_ART } from './towers.ts';

const icon = (key: string, draw: (c: Ctx) => void, w = 0.75, h = 0.75): SpriteSpec => ({ key: `ui.icon.${key}`, atlas: 'ui', w, h, ax: 0.5, ay: 0.5, draw });

function coin(c: Ctx): void {
  ball(c, 0, 0, 19, 19, P.brass, { hi: 0.6, line: LINE + 0.6 });
  ellipsePath(c, 0, 0, 12, 12);
  c.lineWidth = 2.4;
  c.strokeStyle = P.brassDark;
  c.stroke();
  roundRectPath(c, -2.5, -7, 5, 14, 2);
  c.fillStyle = P.brassDark;
  c.fill();
  glint(c, -2, -2, 11, 0.7);
}

function biscuitTin(c: Ctx): void {
  roundRectPath(c, -18, -8, 36, 22, 6);
  litFill(c, P.stop, 0, 3, 20);
  ink(c, LINE + 0.6);
  ellipsePath(c, 0, -8, 18, 7);
  litFill(c, P.stopLight, 0, -8, 18);
  ink(c, LINE + 0.6);
  // Biscuit peeking over the rim.
  ball(c, 3, -14, 9, 7, P.hay, { line: LINE });
  c.fillStyle = P.hayDark;
  for (const [x, y] of [
    [0, -15],
    [5, -13],
    [3, -17],
  ]) {
    ellipsePath(c, x!, y!, 1.2, 1.2);
    c.fill();
  }
  c.fillStyle = alpha(P.cream, 0.9);
  c.fillRect(-14, 2, 28, 3);
}

function flag(c: Ctx): void {
  c.beginPath();
  c.moveTo(-12, 20);
  c.lineTo(-12, -20);
  ink(c, 4.5, P.ink);
  ink(c, 2.5, P.wood);
  c.beginPath();
  c.moveTo(-11, -19);
  c.quadraticCurveTo(0, -24, 16, -15);
  c.lineTo(16, -1);
  c.quadraticCurveTo(0, -8, -11, -3);
  c.closePath();
  litFill(c, P.maroon, 0, -10, 14);
  ink(c, LINE);
}

/** The white flag of a lost battle (§16.1: "a white flag and Retreat!"). */
function whiteFlag(c: Ctx): void {
  c.beginPath();
  c.moveTo(-12, 20);
  c.lineTo(-12, -20);
  ink(c, 4.5, P.ink);
  ink(c, 2.5, P.wood);
  c.beginPath();
  c.moveTo(-11, -19);
  c.quadraticCurveTo(-2, -15, 6, -20);
  c.quadraticCurveTo(12, -23, 17, -18);
  c.lineTo(15, -3);
  c.quadraticCurveTo(10, -8, 3, -4);
  c.quadraticCurveTo(-4, 0, -11, -4);
  c.closePath();
  litFill(c, P.rocketWhite, -2, -12, 16);
  ink(c, LINE);
}

function play(c: Ctx): void {
  c.beginPath();
  c.moveTo(-10, -15);
  c.lineTo(15, 0);
  c.lineTo(-10, 15);
  c.closePath();
  litFill(c, P.cream, 0, 0, 14);
  ink(c, LINE + 0.6);
}

function pause(c: Ctx): void {
  for (const x of [-10, 4]) {
    roundRectPath(c, x, -15, 7, 30, 2.5);
    litFill(c, P.cream, x + 3, 0, 14);
    ink(c, LINE + 0.6);
  }
}

function chevrons(c: Ctx, n: number): void {
  const w = 11;
  const x0 = (-(n - 1) * w) / 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w;
    c.beginPath();
    c.moveTo(x - 7, -13);
    c.lineTo(x + 6, 0);
    c.lineTo(x - 7, 13);
    c.lineTo(x - 2, 0);
    c.closePath();
    litFill(c, P.cream, x, 0, 12);
    ink(c, LINE);
  }
}

function star(c: Ctx, filled: boolean): void {
  starPath(c, 0, 1, 5, 8.5, 19, -Math.PI / 2);
  if (filled) litFill(c, P.gold, 0, 0, 18, 0.5, 0.3);
  else {
    c.fillStyle = alpha(P.ink, 0.35);
    c.fill();
  }
  ink(c, LINE + 0.6);
}

function lock(c: Ctx): void {
  c.beginPath();
  c.arc(0, -4, 9, Math.PI, 0);
  ink(c, 7, P.ink);
  ink(c, 4, P.steel);
  box(c, -14, -4, 28, 20, 4, P.brass, LINE + 0.4);
  ellipsePath(c, 0, 4, 3, 3);
  c.fillStyle = P.ink;
  c.fill();
}

function wings(c: Ctx): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0, 2);
    c.quadraticCurveTo(s * 12, -16, s * 22, -8);
    c.quadraticCurveTo(s * 16, 0, s * 20, 4);
    c.quadraticCurveTo(s * 10, 6, 0, 8);
    c.closePath();
    litFill(c, P.cream, s * 10, -2, 12);
    ink(c, LINE);
  }
  ball(c, 0, 4, 5, 5, P.info, { line: LINE });
}

function crown(c: Ctx): void {
  c.beginPath();
  c.moveTo(-18, 10);
  c.lineTo(-20, -10);
  c.lineTo(-9, -1);
  c.lineTo(0, -16);
  c.lineTo(9, -1);
  c.lineTo(20, -10);
  c.lineTo(18, 10);
  c.closePath();
  litFill(c, P.gold, 0, 0, 18, 0.5, 0.3);
  ink(c, LINE + 0.6);
  for (const x of [-9, 0, 9]) ball(c, x, 5, 2.6, 2.6, P.stop, { line: 1.2 });
}

function arrowUp(c: Ctx): void {
  c.beginPath();
  c.moveTo(0, -18);
  c.lineTo(15, -2);
  c.lineTo(6, -2);
  c.lineTo(6, 16);
  c.lineTo(-6, 16);
  c.lineTo(-6, -2);
  c.lineTo(-15, -2);
  c.closePath();
  litFill(c, P.goLight, 0, 0, 16);
  ink(c, LINE + 0.6);
}

function cross(c: Ctx): void {
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    c.save();
    c.rotate(r);
    roundRectPath(c, -16, -4.5, 32, 9, 4);
    litFill(c, P.cream, 0, 0, 16);
    ink(c, LINE + 0.4);
    c.restore();
  }
}

function route(c: Ctx): void {
  c.beginPath();
  c.moveTo(-18, 12);
  c.quadraticCurveTo(-18, -6, 0, -4);
  c.quadraticCurveTo(18, -2, 16, -16);
  c.lineWidth = 9;
  c.lineCap = 'round';
  c.strokeStyle = P.ink;
  c.stroke();
  c.lineWidth = 5;
  c.setLineDash([6, 5]);
  c.strokeStyle = P.cream;
  c.stroke();
  c.setLineDash([]);
  ball(c, -18, 13, 4.5, 4.5, P.go, { line: LINE });
  ball(c, 16, -16, 4.5, 4.5, P.stop, { line: LINE });
}

function crosshair(c: Ctx): void {
  ellipsePath(c, 0, 0, 14, 14);
  ink(c, 7, P.ink);
  ink(c, 3.5, P.cream);
  for (const [x, y] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]) {
    c.beginPath();
    c.moveTo(x! * 8, y! * 8);
    c.lineTo(x! * 20, y! * 20);
    ink(c, 6, P.ink);
    ink(c, 2.8, P.cream);
  }
  ball(c, 0, 0, 3.5, 3.5, P.stop, { line: 1.4 });
}

function speaker(c: Ctx, on: boolean): void {
  c.beginPath();
  c.moveTo(-16, -6);
  c.lineTo(-8, -6);
  c.lineTo(2, -15);
  c.lineTo(2, 15);
  c.lineTo(-8, 6);
  c.lineTo(-16, 6);
  c.closePath();
  litFill(c, P.cream, -6, 0, 14);
  ink(c, LINE + 0.4);
  if (on) {
    for (const r of [8, 14]) {
      c.beginPath();
      c.arc(4, 0, r, -0.8, 0.8);
      ink(c, 5, P.ink);
      ink(c, 2.4, P.cream);
    }
  } else {
    c.beginPath();
    c.moveTo(8, -8);
    c.lineTo(20, 8);
    c.moveTo(20, -8);
    c.lineTo(8, 8);
    ink(c, 6, P.ink);
    ink(c, 2.8, P.stopLight);
  }
}


// ------------------------------------------------------------ M2 icons

function mapIcon(c: Ctx): void {
  // A folded map with a dotted route.
  c.beginPath();
  c.moveTo(-18, -12);
  c.lineTo(-6, -16);
  c.lineTo(6, -12);
  c.lineTo(18, -16);
  c.lineTo(18, 12);
  c.lineTo(6, 16);
  c.lineTo(-6, 12);
  c.lineTo(-18, 16);
  c.closePath();
  litFill(c, P.parchment, 0, 0, 18);
  ink(c, LINE + 0.4);
  c.fillStyle = P.parchmentShade;
  c.beginPath();
  c.moveTo(-6, -16);
  c.lineTo(6, -12);
  c.lineTo(6, 16);
  c.lineTo(-6, 12);
  c.closePath();
  c.fill();
  ink(c, LINE_THIN);
  c.beginPath();
  c.moveTo(-13, 9);
  c.quadraticCurveTo(-4, -2, 3, 4);
  c.quadraticCurveTo(9, 9, 12, -7);
  c.setLineDash([3, 3]);
  ink(c, 2.4, P.stop);
  c.setLineDash([]);
  ball(c, 12, -8, 3, 3, P.stop, { line: 1.2 });
}

function bookIcon(c: Ctx): void {
  roundRectPath(c, -15, -18, 30, 36, 4);
  litFill(c, P.go, 0, 0, 18);
  ink(c, LINE + 0.4);
  c.fillStyle = P.cream;
  c.fillRect(-15, 12, 30, 4);
  roundRectPath(c, -15, -18, 6, 36, 3);
  c.fillStyle = P.goDark;
  c.fill();
  ink(c, LINE_THIN);
  starPath(c, 3, -2, 5, 3.4, 8, -Math.PI / 2);
  litFill(c, P.gold, 3, -2, 8, 0.5, 0.3);
  ink(c, LINE_THIN + 0.2);
}

function gearIcon(c: Ctx): void {
  c.beginPath();
  const teeth = 8;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 19 : 14.5;
    const a0 = a - Math.PI / (teeth * 2.6);
    const a1 = a + Math.PI / (teeth * 2.6);
    c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    c.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  c.closePath();
  litFill(c, P.steel, 0, 0, 18);
  ink(c, LINE + 0.4);
  ellipsePath(c, 0, 0, 6, 6);
  c.fillStyle = P.ink;
  c.fill();
}

function backIcon(c: Ctx): void {
  c.beginPath();
  c.moveTo(-18, 0);
  c.lineTo(-2, -15);
  c.lineTo(-2, -6);
  c.lineTo(16, -6);
  c.lineTo(16, 6);
  c.lineTo(-2, 6);
  c.lineTo(-2, 15);
  c.closePath();
  litFill(c, P.cream, 0, 0, 16);
  ink(c, LINE + 0.6);
}

function endlessIcon(c: Ctx): void {
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(8, -14, 20, -10, 20, 0);
  c.bezierCurveTo(20, 10, 8, 14, 0, 0);
  c.bezierCurveTo(-8, -14, -20, -10, -20, 0);
  c.bezierCurveTo(-20, 10, -8, 14, 0, 0);
  ink(c, 9, P.ink);
  ink(c, 5, P.brass);
  c.lineWidth = 1.6;
  c.strokeStyle = P.brassLight;
  c.stroke();
}

function restartIcon(c: Ctx): void {
  c.beginPath();
  c.arc(0, 1, 13, Math.PI * 1.25, Math.PI * 2.95);
  ink(c, 9, P.ink);
  ink(c, 5, P.cream);
  const a = Math.PI * 1.25;
  const x = Math.cos(a) * 13;
  const y = 1 + Math.sin(a) * 13;
  c.beginPath();
  c.moveTo(x - 9, y - 1);
  c.lineTo(x + 5, y - 9);
  c.lineTo(x + 3, y + 7);
  c.closePath();
  litFill(c, P.cream, x, y, 8);
  ink(c, LINE);
}

function infoIcon(c: Ctx): void {
  ball(c, 0, 0, 18, 18, P.info, { line: LINE + 0.6 });
  ball(c, 0, -9, 3.2, 3.2, P.cream, { line: 1.4 });
  roundRectPath(c, -3, -3, 6, 15, 2.5);
  litFill(c, P.cream, 0, 4, 6);
  ink(c, 1.4);
}

function checkIcon(c: Ctx): void {
  c.beginPath();
  c.moveTo(-15, 1);
  c.lineTo(-5, 12);
  c.lineTo(16, -12);
  ink(c, 11, P.ink);
  ink(c, 6, P.goLight);
}

function bootIcon(c: Ctx): void {
  c.beginPath();
  c.moveTo(-9, -18);
  c.lineTo(5, -18);
  c.lineTo(5, 2);
  c.quadraticCurveTo(18, 3, 18, 12);
  c.lineTo(18, 15);
  c.lineTo(-11, 15);
  c.quadraticCurveTo(-12, 0, -9, -18);
  c.closePath();
  litFill(c, P.woodDark, 0, 0, 18);
  ink(c, LINE + 0.4);
  c.fillStyle = P.ink;
  c.fillRect(-11, 11, 29, 4);
  c.fillStyle = P.brass;
  for (const y of [-12, -6, 0]) {
    ellipsePath(c, 2, y, 1.4, 1.4);
    c.fill();
  }
}

function timerIcon(c: Ctx): void {
  box(c, -4, -21, 8, 5, 2, P.steel, LINE_THIN + 0.4);
  ball(c, 0, 2, 17, 17, P.cream, { line: LINE + 0.6, hi: 0.2 });
  c.beginPath();
  c.arc(0, 2, 12, -Math.PI / 2, Math.PI * 0.2);
  c.lineTo(0, 2);
  c.closePath();
  c.fillStyle = alpha(P.stop, 0.85);
  c.fill();
  c.beginPath();
  c.moveTo(0, 2);
  c.lineTo(0, -9);
  ink(c, 2.4);
  ball(c, 0, 2, 2.2, 2.2, P.ink, { line: 0 });
}

function killsIcon(c: Ctx): void {
  // A cartoon "poof" cloud: defeated soldiers go poof, not splat.
  for (const [x, y, r] of [
    [-9, 4, 9],
    [9, 4, 9],
    [0, -5, 11],
    [0, 7, 8],
  ]) {
    ball(c, x!, y!, r!, r! * 0.9, P.cream, { line: LINE, hi: 0.3, lo: 0.25 });
  }
  starPath(c, 14, -12, 4, 1.4, 5, 0.3);
  c.fillStyle = P.flash;
  c.fill();
}

function puzzleIcon(c: Ctx): void {
  c.beginPath();
  c.moveTo(-14, -14);
  c.lineTo(-4, -14);
  c.arc(0, -15, 4.5, Math.PI, 0);
  c.lineTo(14, -14);
  c.lineTo(14, -4);
  c.arc(15, 0, 4.5, -Math.PI / 2, Math.PI / 2);
  c.lineTo(14, 14);
  c.lineTo(-14, 14);
  c.lineTo(-14, 4);
  c.arc(-13, 0, 4.5, Math.PI / 2, -Math.PI / 2, true);
  c.closePath();
  litFill(c, P.info, 0, 0, 16);
  ink(c, LINE + 0.4);
}

function trophyIcon(c: Ctx): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.arc(s * 13, -8, 6, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5);
    ink(c, 6, P.ink);
    ink(c, 3, P.brassDark);
  }
  c.beginPath();
  c.moveTo(-13, -17);
  c.lineTo(13, -17);
  c.quadraticCurveTo(13, 4, 0, 6);
  c.quadraticCurveTo(-13, 4, -13, -17);
  c.closePath();
  litFill(c, P.gold, 0, -6, 14, 0.5, 0.3);
  ink(c, LINE + 0.4);
  box(c, -3, 5, 6, 7, 1, P.brassDark, LINE_THIN + 0.4);
  box(c, -10, 11, 20, 6, 2, P.wood, LINE + 0.2);
  glint(c, -5, -10, 5, 0.7);
}

function portraitTower(type: string): SpriteSpec {
  const art = TOWER_ART[type]!;
  return {
    key: `ui.tower.${type}`,
    atlas: 'ui',
    w: 1.25,
    h: 1.25,
    ax: 0.5,
    ay: 0.64,
    draw: (c) => {
      art.base(c, 0);
      c.save();
      c.translate(0, -art.headLift);
      // Towers that never turn were baked at facing 0 only.
      art.head(c, 0, art.rotates === false ? 0 : Math.PI / 4);
      c.restore();
    },
  };
}

export function iconSprites(): SpriteSpec[] {
  const out: SpriteSpec[] = [
    icon('coin', coin),
    icon('lives', biscuitTin),
    icon('wave', flag),
    icon('whiteflag', whiteFlag),
    icon('play', play),
    icon('pause', pause),
    icon('speed1', (c) => chevrons(c, 1)),
    icon('speed2', (c) => chevrons(c, 2)),
    icon('speed3', (c) => chevrons(c, 3)),
    icon('star', (c) => star(c, true)),
    icon('star-empty', (c) => star(c, false)),
    icon('lock', lock),
    icon('air', wings),
    icon('elite', (c) => {
      starPath(c, 0, 1, 5, 8.5, 19, -Math.PI / 2);
      litFill(c, P.gold, 0, 0, 18, 0.5, 0.3);
      ink(c, LINE + 0.6);
    }),
    icon('boss', crown),
    icon('upgrade', arrowUp),
    icon('sell', coin),
    icon('close', cross),
    icon('route', route),
    icon('target', crosshair),
    icon('sound-on', (c) => speaker(c, true)),
    icon('sound-off', (c) => speaker(c, false)),
    icon('map', mapIcon),
    icon('book', bookIcon),
    icon('gear', gearIcon),
    icon('back', backIcon),
    icon('endless', endlessIcon),
    icon('restart', restartIcon),
    icon('info', infoIcon),
    icon('check', checkIcon),
    icon('ground', bootIcon),
    icon('timer', timerIcon),
    icon('kills', killsIcon),
    icon('puzzle', puzzleIcon),
    icon('trophy', trophyIcon),
  ];
  for (const type of Object.keys(TOWER_ART)) out.push(portraitTower(type));
  for (const [type, inf] of Object.entries(INFANTRY)) {
    for (const elite of [false, true]) {
      out.push({ key: `ui.enemy.${type}.${elite ? 'e' : 'n'}`, atlas: 'ui', w: inf.box[0] * 1.2, h: inf.box[1], ax: 0.5, ay: 0.86, draw: (c) => inf.draw(c, elite, Math.PI / 2 - 0.35, 0) });
    }
  }
  for (const [type, v] of Object.entries(VEHICLES)) {
    for (const elite of [false, true]) {
      out.push({ key: `ui.enemy.${type}.${elite ? 'e' : 'n'}`, atlas: 'ui', w: v.box, h: v.box, ax: 0.5, ay: 0.68, draw: (c) => v.draw(c, Math.PI * 0.75, 0, elite) });
    }
  }
  return out;
}
