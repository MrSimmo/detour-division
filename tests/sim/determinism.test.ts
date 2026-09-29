// R-SIM-1..3: determinism across runs, loop pacing and snapshot/restore.
import { describe, expect, it } from 'vitest';
import { apply, hashSim, restoreSim, snapshot, step, type Command } from '../../src/sim/sim.ts';
import { Clock } from '../../src/sim/clock.ts';
import { rngFrom, rngRange } from '../../src/sim/core/rng.ts';
import { balance, open, simFor, testLevel } from '../helpers/fixtures.ts';

const level = testLevel({
  tiles: open(16, 9),
  startCash: 400,
  waves: {
    count: [6, 6, 6],
    interval: 12,
    recipe: {
      b0: 6,
      g: 1.1,
      pool: [
        { enemy: 'footling', from: 1, weight: 3 },
        { enemy: 'scarper', from: 2, weight: 2 },
        { enemy: 'whirligig', from: 3, weight: 1 },
        { enemy: 'tinkettle', from: 4, weight: 1 },
      ],
    },
  },
});

const script: Record<number, Command[]> = {
  0: [{ t: 'callWave' }],
  5: [{ t: 'build', tower: 'rattler', cx: 5, cy: 3 }, { t: 'build', tower: 'treacle', cx: 5, cy: 5 }],
  40: [{ t: 'build', tower: 'skylark', cx: 8, cy: 1 }],
  200: [{ t: 'build', tower: 'thumper', cx: 10, cy: 7 }, { t: 'callWave' }],
  600: [{ t: 'build', tower: 'rattler', cx: 9, cy: 4 }, { t: 'target', id: 1, mode: 'strongest' }],
};

function run(seed: number, ticks: number): string {
  const sim = simFor(level, 'casual', seed);
  for (let t = 0; t < ticks; t++) {
    for (const c of script[sim.state.tick] ?? []) apply(sim, c);
    step(sim);
  }
  return hashSim(sim);
}

describe('determinism', () => {
  it('R-SIM-1: same seed and commands give the same hash', () => {
    expect(run(7, 3000)).toBe(run(7, 3000));
  });

  it('R-SIM-2: a different seed changes the hash', () => {
    expect(run(7, 3000)).not.toBe(run(8, 3000));
  });

  it('R-SIM-1: 1×, 2× and 3× loop pacing give identical results at the same tick', () => {
    const target = 2400;
    const hashes = [1, 2, 3].map((speed) => {
      const sim = simFor(level, 'casual', 7);
      const clock = new Clock();
      const frames = rngFrom(speed * 101);
      // step() stops advancing once the level is won or lost, so bound by the result too.
      while (sim.state.tick < target && sim.state.result === 'playing') {
        let n = clock.advance(rngRange(frames, 4, 40), speed);
        while (n-- > 0 && sim.state.tick < target && sim.state.result === 'playing') {
          for (const c of script[sim.state.tick] ?? []) apply(sim, c);
          step(sim);
        }
      }
      return hashSim(sim);
    });
    expect(hashes[1]).toBe(hashes[0]);
    expect(hashes[2]).toBe(hashes[0]);
  });

  it('R-SIM-3: snapshot, restore and continue matches the uninterrupted run', () => {
    const a = simFor(level, 'casual', 3);
    for (let t = 0; t < 1500; t++) {
      for (const c of script[a.state.tick] ?? []) apply(a, c);
      step(a);
    }
    const snap = JSON.parse(JSON.stringify(snapshot(a)));
    const b = restoreSim(snap, level, balance());
    for (let t = 0; t < 1500; t++) {
      for (const c of script[a.state.tick] ?? []) apply(a, c);
      step(a);
      for (const c of script[b.state.tick] ?? []) apply(b, c);
      step(b);
    }
    expect(hashSim(b)).toBe(hashSim(a));
  });

  it('caps a single frame at 12 ticks', () => {
    const clock = new Clock();
    expect(clock.advance(5000, 3)).toBe(12);
  });
});
