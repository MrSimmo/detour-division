// R-WAVE-1, R-WAVE-2, R-WAVE-4.
import { describe, expect, it } from 'vitest';
import { expandWaves } from '../../src/sim/waves.ts';
import { waveGaps } from '../../src/sim/level.ts';
import { apply, drainEvents, step } from '../../src/sim/sim.ts';
import { balance, open, simFor, testLevel } from '../helpers/fixtures.ts';

// Lives are high so that the unguarded level survives long enough for every wave to spawn.
const level = testLevel({
  tiles: open(14, 7),
  lives: 1000,
  waves: {
    count: [8, 10, 12],
    interval: 6,
    recipe: {
      b0: 5,
      g: 1.08,
      airEvery: 4,
      eliteFrom: 5,
      pool: [
        { enemy: 'footling', from: 1, weight: 3 },
        { enemy: 'scarper', from: 2, weight: 2 },
        { enemy: 'puttputt', from: 3, weight: 1 },
        { enemy: 'whirligig', from: 1, weight: 1 },
      ],
    },
    overrides: [{ wave: 1, groups: [{ enemy: 'footling', count: 5 }] }],
  },
});

describe('wave expansion', () => {
  it('R-WAVE-1: same level, difficulty and seed expand identically', () => {
    expect(expandWaves(level, balance(), 'tough')).toEqual(expandWaves(level, balance(), 'tough'));
  });

  it('uses the per-difficulty wave count and honours overrides', () => {
    expect(expandWaves(level, balance(), 'casual')).toHaveLength(8);
    expect(expandWaves(level, balance(), 'heroic')).toHaveLength(12);
    const w1 = expandWaves(level, balance(), 'casual')[0]!;
    expect(w1.groups).toHaveLength(1);
    expect(w1.groups[0]).toMatchObject({ enemy: 'footling', count: 5, elite: false });
  });

  it('makes every airEvery-th wave air-only', () => {
    const waves = expandWaves(level, balance(), 'casual');
    expect(waves[3]!.groups.every((g) => balance().enemies[g.enemy]!.air)).toBe(true);
    expect(waves[3]!.air).toBe(true);
  });

  it('R-WAVE-2: what spawns matches the preview', () => {
    const sim = simFor(level);
    apply(sim, { t: 'callWave' });
    const seen = new Map<number, Map<string, number>>();
    for (let t = 0; t < 30 * 200 && sim.state.result === 'playing'; t++) {
      step(sim);
      for (const ev of drainEvents(sim)) {
        if (ev.e !== 'spawn') continue;
        const m = seen.get(ev.wave) ?? new Map<string, number>();
        const k = `${ev.type}${ev.elite ? '*' : ''}`;
        m.set(k, (m.get(k) ?? 0) + 1);
        seen.set(ev.wave, m);
      }
    }
    sim.level.waves.forEach((w, i) => {
      const expected = new Map<string, number>();
      for (const g of w.groups) {
        const k = `${g.enemy}${g.elite ? '*' : ''}`;
        expected.set(k, (expected.get(k) ?? 0) + g.count);
      }
      expect(seen.get(i)).toEqual(expected);
    });
  });
});

describe('the quickening countdown (R-WAVE-4, ADR-0011)', () => {
  const launches = (intervalEnd?: number): number[] => {
    const lv = testLevel({ tiles: open(14, 7), lives: 1000, waves: { count: [10, 10, 10], interval: 20, ...(intervalEnd ? { intervalEnd } : {}), recipe: { b0: 2, g: 1.02, pool: [{ enemy: 'footling', from: 1, weight: 1 }] } } });
    const sim = simFor(lv);
    // Launches inside step() are seen after the tick counter advances; count this one the same way.
    apply(sim, { t: 'callWave' });
    const ticks = [sim.state.tick + 1];
    drainEvents(sim);
    while (sim.state.waves.next < 10) {
      step(sim);
      for (const ev of drainEvents(sim)) if (ev.e === 'wave') ticks.push(sim.state.tick);
    }
    return ticks.slice(1).map((t, i) => t - ticks[i]!);
  };

  it('runs from interval to intervalEnd, never lengthening', () => {
    const gaps = launches(14);
    expect(gaps).toHaveLength(9);
    expect(gaps[0]).toBe(600);
    expect(gaps.at(-1)).toBe(420);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]!);
  });

  it('stays fixed without intervalEnd', () => {
    expect(new Set(launches())).toEqual(new Set([600]));
  });

  it('keeps intervalEnd for Endless waves beyond the script', () => {
    const g = waveGaps(20, 14, 10, 15);
    expect(g.slice(8)).toEqual([420, 420, 420, 420, 420, 420, 420]);
  });
});
