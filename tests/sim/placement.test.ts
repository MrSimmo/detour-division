// R-BLOCK-1, R-BLOCK-2: the never-block rule, including enemies already on the field. R-BLOCK-4.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/data/load.ts';
import { rngFrom, rngInt, rngNext } from '../../src/sim/core/rng.ts';
import { apply, checkPlacement, createSim, unbuildableCells } from '../../src/sim/sim.ts';
import { spawnEnemy } from '../../src/sim/enemies.ts';
import { balance, open, simFor, testLevel } from '../helpers/fixtures.ts';

/** Oracle: 8-connected moves without corner-cutting reach exactly what 4-connected moves reach. */
function bfsReaches(walk: (x: number, y: number) => boolean, cols: number, rows: number, from: [number, number][], to: Set<string>): boolean {
  const seen = new Set<string>();
  const q: [number, number][] = [];
  for (const f of from) if (walk(f[0], f[1])) { q.push(f); seen.add(f.join(',')); }
  while (q.length) {
    const [x, y] = q.shift()!;
    if (to.has(`${x},${y}`)) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.has(k) || !walk(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return false;
}

describe('placement validation', () => {
  it('accepts a tower on open ground and rejects the same cell twice', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    expect(apply(sim, { t: 'build', tower: 'rattler', cx: 5, cy: 3 }).ok).toBe(true);
    const again = checkPlacement(sim, 5, 3, 'rattler');
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('OCCUPIED');
  });

  it('rejects rocks, the gate apron and out-of-bounds cells', () => {
    const tiles = open(12, 7);
    tiles[1] = '.....#......';
    const sim = simFor(testLevel({ tiles }));
    expect(checkPlacement(sim, 5, 1, 'rattler').reason).toBe('NOT_BUILDABLE');
    expect(checkPlacement(sim, 0, 3, 'rattler').reason).toBe('NOT_BUILDABLE'); // entrance span
    expect(checkPlacement(sim, 1, 2, 'rattler').reason).toBe('NOT_BUILDABLE'); // apron
    expect(checkPlacement(sim, 20, 3, 'rattler').reason).toBe('OUT_OF_BOUNDS');
  });

  it('rejects towers outside the loadout and when cash is short', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7), startCash: 10, loadout: ['rattler'] }));
    expect(checkPlacement(sim, 5, 3, 'thumper').reason).toBe('NOT_IN_LOADOUT');
    expect(checkPlacement(sim, 5, 3, 'rattler').reason).toBe('NO_CASH');
  });

  it('rejects a wall that seals the route and names the route', () => {
    const tiles = open(12, 7);
    const sim = simFor(testLevel({ tiles }));
    for (let y = 0; y < 6; y++) expect(apply(sim, { t: 'build', tower: 'rattler', cx: 6, cy: y }).ok).toBe(true);
    const r = checkPlacement(sim, 6, 6, 'rattler');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('BLOCKS_ROUTE');
    expect(r.routes).toEqual(['A']);
  });

  it('rejects a cell a ground enemy is standing on (ENEMY_IN_WAY)', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    const e = spawnEnemy(sim, 'footling', 0);
    e.x = 5.5; e.y = 3.5; e.phase = 1;
    const r = checkPlacement(sim, 5, 3, 'rattler');
    expect(r.reason).toBe('ENEMY_IN_WAY');
    expect(r.enemies).toEqual([e.id]);
  });

  it('ignores air units when checking for enemies in the way', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    const e = spawnEnemy(sim, 'whirligig', 0);
    e.x = 5.5; e.y = 3.5;
    expect(checkPlacement(sim, 5, 3, 'rattler').ok).toBe(true);
  });

  it('R-BLOCK-2: rejects sealing a pocket that holds an enemy even though the route stays open', () => {
    // A side pocket at the top, joined to the field by the single gap at (6,1).
    const tiles = [
      '............',
      '#####.######',
      '............',
      '............',
      '............',
      '............',
      '............',
    ];
    const sim = simFor(testLevel({ tiles }));
    const e = spawnEnemy(sim, 'footling', 0);
    e.x = 2.5; e.y = 0.5; e.phase = 1;
    const r = checkPlacement(sim, 5, 1, 'rattler');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('TRAPS_ENEMY');
    expect(r.enemies).toEqual([e.id]);
    // With the pocket empty the same placement is fine.
    e.x = 8.5; e.y = 4.5;
    expect(checkPlacement(sim, 5, 1, 'rattler').ok).toBe(true);
  });

  it('R-BLOCK-1: agrees with a BFS oracle on random grids', () => {
    const rng = rngFrom(4242);
    let rejected = 0;
    let accepted = 0;
    for (let trial = 0; trial < 120; trial++) {
      const cols = 11, rows = 7;
      const tiles = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, (_, x) => (x > 1 && x < cols - 2 && rngNext(rng) < 0.22 ? '#' : '.')).join(''),
      );
      tiles[3] = '.' + tiles[3]!.slice(1, -1) + '.';
      const level = testLevel({ tiles, startCash: 100000 });
      const sim = simFor(level);
      // Scatter some valid towers first.
      for (let k = 0; k < 10; k++) apply(sim, { t: 'build', tower: 'rattler', cx: rngInt(rng, 2, cols - 3), cy: rngInt(rng, 0, rows - 1) });
      const walk = (x: number, y: number): boolean => sim.grid.walk[y * cols + x] === 1;
      const from: [number, number][] = [[0, 2], [0, 3], [0, 4]];
      const to = new Set(['10,2', '10,3', '10,4']);
      for (let k = 0; k < 15; k++) {
        const cx = rngInt(rng, 2, cols - 3), cy = rngInt(rng, 0, rows - 1);
        const r = checkPlacement(sim, cx, cy, 'rattler');
        if (!walk(cx, cy)) { expect(r.ok).toBe(false); continue; }
        const expected = bfsReaches((x, y) => walk(x, y) && !(x === cx && y === cy), cols, rows, from, to);
        expect(r.ok).toBe(expected);
        if (!expected) expect(r.reason).toBe('BLOCKS_ROUTE');
        if (r.ok) accepted++; else rejected++;
      }
    }
    expect(accepted).toBeGreaterThan(50);
    expect(rejected).toBeGreaterThan(5);
  });

  it('never makes a sale invalid', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7) }));
    const b = apply(sim, { t: 'build', tower: 'rattler', cx: 5, cy: 3 });
    expect(b.ok && apply(sim, { t: 'sell', id: b.id! }).ok).toBe(true);
    expect(sim.grid.walk[3 * 12 + 5]).toBe(1);
  });
});

describe('unbuildable shading (R-BLOCK-4)', () => {
  it('shades exactly the cells checkPlacement refuses as NOT_BUILDABLE, on every level', () => {
    for (const zone of readdirSync('data/levels').filter((n) => /^z\d$/.test(n))) {
      for (const f of readdirSync(`data/levels/${zone}`).filter((n) => n.endsWith('.json'))) {
        const def = parseLevel(JSON.parse(readFileSync(`data/levels/${zone}/${f}`, 'utf8')));
        const loadout = def.loadout.fixed ?? def.loadout.bot;
        const sim = createSim({ level: def, balance: balance(), difficulty: 'casual', loadout });
        const refused: number[] = [];
        for (let cy = 0; cy < sim.level.rows; cy++) for (let cx = 0; cx < sim.level.cols; cx++) if (checkPlacement(sim, cx, cy, loadout[0]!).reason === 'NOT_BUILDABLE') refused.push(cy * sim.level.cols + cx);
        expect(unbuildableCells(sim), def.id).toEqual(refused);
      }
    }
  });
});
