import { describe, expect, it } from 'vitest';
import { apply, routePaths } from '../../src/sim/sim.ts';
import { open, simFor, testLevel } from '../helpers/fixtures.ts';

describe('distance fields', () => {
  it('measures straight and diagonal costs to the exit', () => {
    const sim = simFor(testLevel({ tiles: open(8, 5) }));
    const f = sim.fields[0]!;
    // Exit span is the east column rows 1..3.
    expect(f.dist[2 * 8 + 7]).toBe(0);
    expect(f.dist[2 * 8 + 0]).toBeCloseTo(7, 12);
    // (0,0) → (1,1) diagonal then 5 east to (6,1) then 1 east: 1 diagonal + 6 straight.
    expect(f.dist[0]).toBeCloseTo(Math.SQRT2 + 6, 12);
  });

  it('does not cut corners between diagonal blockers', () => {
    // (0,0) is walled in orthogonally by (1,0) and (0,1); only a corner-cut could reach it.
    const tiles = [
      '.#......',
      '#.......',
      '........',
      '........',
      '........',
      '........',
      '........',
    ];
    const sim = simFor(testLevel({ tiles }));
    expect(sim.fields[0]!.dist[0]).toBe(Infinity);
  });

  it('routes around a wall and reports a polyline from entrance to exit', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    const length = (pts: { x: number; y: number }[]): number => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y), 0);
    const before = length(routePaths(sim)[0]!);
    for (let y = 0; y < 5; y++) apply(sim, { t: 'build', tower: 'rattler', cx: 6, cy: y });
    const after = routePaths(sim)[0]!;
    expect(length(after)).toBeGreaterThan(before + 1);
    expect(after[0]!.x).toBeLessThan(1);
    expect(after[after.length - 1]!.x).toBeGreaterThan(11);
    // The detour passes below the wall.
    expect(after.some((p) => Math.floor(p.x) === 6 && p.y > 5)).toBe(true);
  });

  it('uses tunnels as graph edges with their length as cost', () => {
    const tiles = [
      '............',
      'o..........o',
      '############',
      '............',
      '............',
    ];
    const level = testLevel({
      tiles,
      routes: [{ id: 'A', entrance: { edge: 'W', from: 3, to: 4 }, exit: { edge: 'E', from: 0, to: 1 } }],
      tunnels: [{ a: [0, 1], b: [11, 1], length: 3 }],
    });
    const sim = simFor(level);
    // The entrance side can only reach the exit side through... nothing: rock splits it.
    expect(sim.fields[0]!.dist[3 * 12]).toBe(Infinity);
    const level2 = testLevel({
      tiles: ['o...........', '############', '............', '...........o'],
      routes: [{ id: 'A', entrance: { edge: 'W', from: 0, to: 0 }, exit: { edge: 'E', from: 2, to: 3 } }],
      tunnels: [{ a: [0, 0], b: [11, 3], length: 3 }],
    });
    const s2 = simFor(level2);
    expect(s2.fields[0]!.dist[0]).toBeCloseTo(3, 12);
  });
});
