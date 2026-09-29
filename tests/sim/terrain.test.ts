// §14.3 terrain rules in play.
import { describe, expect, it } from 'vitest';
import { apply, checkPlacement, routePaths, step } from '../../src/sim/sim.ts';
import { damageEnemy } from '../../src/sim/combat.ts';
import { spawnEnemy } from '../../src/sim/enemies.ts';
import { simFor, testLevel } from '../helpers/fixtures.ts';

describe('terrain', () => {
  it('trench cover cuts direct fire to 60% but not lobbed fire', () => {
    const tiles = ['............', '............', '............', '.....tt.....', '............', '............', '............'];
    const sim = simFor(testLevel({ tiles }));
    const a = spawnEnemy(sim, 'footling', 0);
    a.phase = 1;
    a.x = 5.5;
    a.y = 3.5;
    const hp = a.hp;
    damageEnemy(sim, a, 10, 'kinetic', 0);
    expect(hp - a.hp).toBeCloseTo(6, 9);
    damageEnemy(sim, a, 10, 'kinetic', 0, { lobbed: true });
    expect(hp - a.hp).toBeCloseTo(16, 9);
  });

  it('trenches, ice, bridges, conveyors and restricted cells cannot be built on', () => {
    const tiles = ['............', '............', '..t.i.=.>.x.', '............', '............', '............', '............'];
    const sim = simFor(testLevel({ tiles }));
    for (const x of [2, 4, 6, 8, 10]) expect(checkPlacement(sim, x, 2, 'rattler').reason).toBe('NOT_BUILDABLE');
  });

  it('units cross ice faster and are pushed along conveyors', () => {
    const iceRow = ['..............', '..............', '..............', '..iiiiiiiiii..', '..............', '..............', '..............'];
    const plain = simFor(testLevel({ tiles: iceRow.map((r) => r.replace(/i/g, '.')) }));
    const icy = simFor(testLevel({ tiles: iceRow }));
    // Ticks spent on the map: the lane walk at each end (R-LANE-1) is the same on all three.
    const t = (sim: ReturnType<typeof simFor>): number => {
      const e = spawnEnemy(sim, 'footling', 0);
      let n = 0;
      for (let i = 0; sim.state.enemies.length && i < 3000; i++) {
        step(sim);
        if (e.x >= 0 && e.x < 14) n++;
      }
      return n;
    };
    expect(t(icy)).toBeLessThan(t(plain) * 0.85);
    const belt = simFor(testLevel({ tiles: iceRow.map((r) => r.replace(/i/g, '>')) }));
    expect(t(belt)).toBeLessThan(t(plain) * 0.85);
  });

  it('clearing a removable blocker opens a shorter road and costs the clear fee', () => {
    const tiles = ['............', '............', '............', '#####b######', '............', '............', '............'];
    const lv = testLevel({ tiles, startCash: 100, routes: [{ id: 'A', entrance: { edge: 'N', from: 5, to: 6 }, exit: { edge: 'S', from: 5, to: 6 } }] });
    const sim = simFor(lv);
    expect(routePaths(sim)[0]).toEqual([]);
    const r = apply(sim, { t: 'clear', cx: 5, cy: 3 });
    expect(r.ok).toBe(true);
    expect(sim.state.cash).toBe(80);
    expect(routePaths(sim)[0]!.length).toBeGreaterThan(2);
  });
});
