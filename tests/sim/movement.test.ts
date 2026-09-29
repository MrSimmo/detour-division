// R-MOVE-1..4 and R-AIR-1.
import { describe, expect, it } from 'vitest';
import { apply, step } from '../../src/sim/sim.ts';
import { damageEnemy } from '../../src/sim/combat.ts';
import { predictPosition, spawnEnemy } from '../../src/sim/enemies.ts';
import { DT, PHASE } from '../../src/sim/constants.ts';
import { open, simFor, testLevel } from '../helpers/fixtures.ts';

describe('ground movement', () => {
  it('R-MOVE-4: the widest lane offset never wedges a big body against a wall corner', () => {
    // Found on Grinder's Glacier: a Glacier Grinder already walking on its lane line (0.22 off the
    // cell centre) met a two-cell wall beside the corridor and stood still for an hour of game time.
    // The unit starts just short of the wall, on its lane line, heading east (the observed state).
    const wallAbove = ['..##........', '............', '............', '............', '............'];
    const wallBelow = ['............', '............', '..##........', '............', '............'];
    const routes = [{ id: 'A', entrance: { edge: 'W', from: 1, to: 1 }, exit: { edge: 'E', from: 1, to: 1 } }];
    for (const type of ['grinder', 'tinkettle', 'lummox']) {
      for (const [lane, tiles] of [[-0.22, wallAbove], [0.22, wallBelow]] as const) {
        const sim = simFor(testLevel({ tiles: [...tiles], routes, lives: 100 }));
        const e = spawnEnemy(sim, type, 0);
        Object.assign(e, { lane, phase: PHASE.WALK, x: 1.6, y: 1.5 + lane, px: 1.6, py: 1.5 + lane, hx: 1, hy: 0 });
        let still = 0;
        let worst = 0;
        for (let t = 0; t < 30 * 90 && sim.state.enemies.includes(e); t++) {
          const x = e.x;
          const y = e.y;
          step(sim);
          still = e.x === x && e.y === y && e.stunT === 0 ? still + 1 : 0;
          worst = Math.max(worst, still);
        }
        expect(worst, `${type} lane ${lane}: ticks standing still`).toBeLessThan(3);
        expect(sim.state.enemies.includes(e), `${type} lane ${lane} reached the exit`).toBe(false);
      }
    }
  });

  it('R-LANE-1: a ground unit starts up the entrance lane, walks in, and escapes only down the exit lane', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    const e = spawnEnemy(sim, 'footling', 0);
    // West entrance at x = 0, east exit at x = 12.
    expect(e.x).toBeCloseTo(-6.5, 9);
    let maxStepRatio = 0;
    let lastBeyond = -Infinity;
    let leakX = NaN;
    for (let t = 0; t < 30 * 60 && Number.isNaN(leakX); t++) {
      const x = e.x;
      const y = e.y;
      step(sim);
      for (const ev of sim.events) if (ev.e === 'leak' && ev.id === e.id) leakX = ev.x;
      sim.events.length = 0;
      if (!Number.isNaN(leakX)) break;
      maxStepRatio = Math.max(maxStepRatio, Math.hypot(e.x - x, e.y - y) / (e.speed * DT));
      lastBeyond = e.x - 12;
    }
    expect(maxStepRatio).toBeLessThanOrEqual(1.01);
    expect(lastBeyond, 'still on the lane on the tick before it escapes').toBeLessThan(2.75);
    expect(leakX - 12, 'escapes 2.75 cells beyond the exit').toBeGreaterThanOrEqual(2.75);
    expect(sim.state.lives).toBe(19);
  });

  it('R-LANE-1: a Trio killed in a lane splits into Tiddlers that carry on along that lane', () => {
    for (const [phase, x] of [[PHASE.ENTER, -1.5], [PHASE.EXIT, 13.5]] as const) {
      const sim = simFor(testLevel({ tiles: open(12, 7) }));
      const t = spawnEnemy(sim, 'trio', 0);
      Object.assign(t, { phase, x, y: 3.5, px: x, py: 3.5, hx: 1, hy: 0 });
      damageEnemy(sim, t, 1e6, 'kinetic', 0);
      const kids = sim.state.enemies.filter((e) => e.type === 'tiddler');
      expect(kids.length).toBe(3);
      for (const k of kids) {
        expect(k.phase).toBe(phase);
        expect(Math.abs(k.x - x), 'appears where the Trio fell, not on the map').toBeLessThan(0.5);
      }
    }
  });

  it('R-LANE-1: a lobbed shell leads a unit walking in or out along a lane', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    const e = spawnEnemy(sim, 'footling', 0);
    const lead = 1.2 * e.speed;
    expect(predictPosition(sim, e, 1.2).x).toBeCloseTo(e.x + lead, 6);
    Object.assign(e, { phase: PHASE.EXIT, x: 12.5, y: 3.5, hx: 1, hy: 0 });
    expect(predictPosition(sim, e, 1.2).x).toBeCloseTo(12.5 + lead, 6);
  });

  it('walks from entrance to exit and costs one life', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    spawnEnemy(sim, 'footling', 0);
    let ticks = 0;
    while (sim.state.enemies.length && ticks < 30 * 60) { step(sim); ticks++; }
    expect(sim.state.lives).toBe(19);
    // 12 cells of field, 6.5 cells of entrance lane and 2.75 of exit lane (R-LANE-1), at 1 cell/s: 638 ticks.
    expect(ticks).toBeGreaterThan(530);
    expect(ticks).toBeLessThan(750);
  });

  it('R-MOVE-1/2: no teleporting, no heading snaps, never inside a blocked cell, while the maze changes', () => {
    const sim = simFor(testLevel({ tiles: open(16, 9), startCash: 100000 }));
    const cols = 16;
    for (let i = 0; i < 12; i++) spawnEnemy(sim, i % 2 ? 'scarper' : 'footling', 0);
    const walls: [number, number][] = [];
    for (let y = 0; y < 7; y++) walls.push([5, y]);
    for (let y = 2; y < 9; y++) walls.push([9, y]);
    for (let y = 0; y < 7; y++) walls.push([12, y]);
    let maxStepRatio = 0;
    let maxTurnRatio = 0;
    for (let tick = 0; tick < 30 * 40 && sim.state.enemies.length; tick++) {
      if (tick % 12 === 0 && walls.length) {
        const [x, y] = walls.shift()!;
        apply(sim, { t: 'build', tower: 'rattler', cx: x, cy: y });
      }
      const before = new Map(sim.state.enemies.map((e) => [e.id, { x: e.x, y: e.y, hx: e.hx, hy: e.hy }]));
      step(sim);
      for (const e of sim.state.enemies) {
        const b = before.get(e.id);
        if (!b || e.phase === 3) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        maxStepRatio = Math.max(maxStepRatio, d / (e.speed * DT));
        const dot = Math.max(-1, Math.min(1, e.hx * b.hx + e.hy * b.hy));
        const turnMax = sim.balance.enemies[e.type]!.turnRate * (Math.PI / 180) * DT;
        maxTurnRatio = Math.max(maxTurnRatio, Math.acos(dot) / turnMax);
        const cx = Math.floor(e.x), cy = Math.floor(e.y);
        if (cx >= 0 && cy >= 0 && cx < cols && cy < 9) expect(sim.grid.walk[cy * cols + cx]).toBe(1);
      }
    }
    expect(maxStepRatio).toBeLessThanOrEqual(1.01);
    expect(maxTurnRatio).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('R-MOVE-3: uses the new route on the tick after a build', () => {
    const sim = simFor(testLevel({ tiles: open(14, 7), startCash: 100000 }));
    const e = spawnEnemy(sim, 'footling', 0);
    // Up the entrance lane first (R-LANE-1), then a few ticks on the map.
    while (e.phase !== PHASE.WALK) step(sim);
    for (let i = 0; i < 10; i++) step(sim);
    // Wall straight across the enemy's current line, leaving a gap at the bottom. Skylarks only
    // shoot air, so the footling survives to prove the detour.
    for (let y = 0; y < 6; y++) expect(apply(sim, { t: 'build', tower: 'skylark', cx: 7, cy: y }).ok).toBe(true);
    step(sim);
    expect(sim.grid.walk[e.wp]).toBe(1);
    const f = sim.fields[e.exit]!;
    expect(Number.isFinite(f.dist[e.wp])).toBe(true);
    let reachedGap = false;
    for (let i = 0; i < 30 * 30 && sim.state.enemies.length; i++) {
      step(sim);
      if (Math.floor(e.x) === 7 && Math.floor(e.y) === 6) reachedGap = true;
    }
    expect(reachedGap).toBe(true);
  });
});

describe('air movement', () => {
  it('R-AIR-1: flies a straight line from spawn to exit, ignoring towers', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7), startCash: 100000 }));
    for (let y = 0; y < 6; y++) apply(sim, { t: 'build', tower: 'thumper', cx: 6, cy: y });
    const e = spawnEnemy(sim, 'whirligig', 0);
    const { x0, y0, x1, y1 } = e;
    let maxOff = 0;
    while (sim.state.enemies.includes(e)) {
      step(sim);
      const cross = (x1 - x0) * (e.y - y0) - (y1 - y0) * (e.x - x0);
      maxOff = Math.max(maxOff, Math.abs(cross) / Math.hypot(x1 - x0, y1 - y0));
    }
    expect(maxOff).toBeLessThan(1e-9);
    expect(sim.state.lives).toBe(19);
  });
});
