// §3.10 / §9.4 Endless: continues the recipe, climbs to all-elite, zone boss every 10 waves.
import { describe, expect, it } from 'vitest';
import { expandWaves } from '../../src/sim/waves.ts';
import { createSim } from '../../src/sim/sim.ts';
import { balance, open, testLevel } from '../helpers/fixtures.ts';

const level = testLevel({
  tiles: open(14, 7),
  waves: { count: [10, 12, 14], interval: 10, recipe: { b0: 5, g: 1.06, eliteFrom: 5, pool: [{ enemy: 'footling', from: 1, weight: 1 }, { enemy: 'scarper', from: 2, weight: 1 }] } },
});

describe('endless', () => {
  it('continues well beyond the scripted waves with the zone boss every 10th wave', () => {
    const waves = expandWaves(level, balance(), 'tough', true);
    expect(waves.length).toBeGreaterThan(100);
    const bossWaves = waves.map((w, i) => (w.groups.some((g) => balance().enemies[g.enemy]!.boss) ? i + 1 : 0)).filter(Boolean);
    expect(bossWaves.slice(0, 3)).toEqual([20, 30, 40]);
    expect(waves[12 + 30 + 5]!.groups.every((g) => g.elite || balance().enemies[g.enemy]!.boss)).toBe(true);
  });

  it('uses Tough multipliers and never wins by running out of waves early', () => {
    const sim = createSim({ level, balance: balance(), difficulty: 'casual', endless: true });
    expect(sim.state.difficulty).toBe('tough');
    expect(sim.state.endless).toBe(true);
    expect(sim.level.waves.length).toBeGreaterThan(100);
  });
});
