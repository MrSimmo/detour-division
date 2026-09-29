// §10 modes: Sudden Death (survive the timer), Time Trial (kill X before the clock), Puzzle.
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/data/load.ts';
import { apply, createSim, step } from '../../src/sim/sim.ts';
import { spawnEnemy } from '../../src/sim/enemies.ts';
import { damageEnemy } from '../../src/sim/combat.ts';
import { TICK_HZ } from '../../src/sim/constants.ts';
import { balance, open, testLevel } from '../helpers/fixtures.ts';

function withMode(mode: string, modeParams: unknown, lives = 20) {
  const base = testLevel({ tiles: open(14, 7), lives, waves: { count: [40, 40, 40], interval: 4, recipe: { b0: 2, g: 1.02, pool: [{ enemy: 'footling', from: 1, weight: 1 }] } } });
  return parseLevel({ ...base, mode, modeParams });
}

const run = (sim: ReturnType<typeof createSim>, seconds: number): void => {
  for (let i = 0; i < seconds * TICK_HZ && sim.state.result === 'playing'; i++) step(sim);
};

describe('modes', () => {
  it('Sudden Death: winning means outlasting the timer, which starts with the first wave', () => {
    const lv = withMode('suddenDeath', { timer: [30, 40, 50] });
    const sim = createSim({ level: lv, balance: balance(), difficulty: 'casual' });
    expect(sim.state.lives).toBe(5);
    run(sim, 5);
    expect(sim.state.result).toBe('playing');
    expect(sim.state.mode.timer).toBe(-1);
    // Lots of guns so nothing leaks.
    for (let x = 3; x < 11; x++) apply(sim, { t: 'build', tower: 'rattler', cx: x, cy: 1 });
    for (let x = 3; x < 11; x++) apply(sim, { t: 'build', tower: 'rattler', cx: x, cy: 5 });
    apply(sim, { t: 'callWave' });
    expect(sim.state.mode.timer).toBe(30 * TICK_HZ);
    run(sim, 29);
    expect(sim.state.result).toBe('playing');
    run(sim, 2);
    expect(sim.state.result).toBe('won');
  });

  it('Time Trial: wins at the kill target, loses when the clock runs out', () => {
    const lv = withMode('timeTrial', { timer: [60, 60, 60], target: [3, 4, 5] });
    const sim = createSim({ level: lv, balance: balance(), difficulty: 'casual' });
    apply(sim, { t: 'callWave' });
    for (let i = 0; i < 3; i++) damageEnemy(sim, spawnEnemy(sim, 'footling', 0), 1e6, 'kinetic', 0);
    step(sim);
    expect(sim.state.result).toBe('won');
    const slow = createSim({ level: lv, balance: balance(), difficulty: 'tough', seed: 2 });
    slow.state.lives = 10000;
    apply(slow, { t: 'callWave' });
    run(slow, 61);
    expect(slow.state.result).toBe('lost');
  });

  it('Puzzle: fixed loadout, fixed cash, no bounty, lives by difficulty', () => {
    const base = testLevel({ tiles: open(14, 7), startCash: 77 });
    const lv = parseLevel({ ...base, mode: 'puzzle', loadout: { fixed: ['rattler', 'treacle'], bot: ['rattler', 'treacle'] } });
    for (const [d, lives] of [['casual', 10], ['tough', 5], ['heroic', 1]] as const) {
      const sim = createSim({ level: lv, balance: balance(), difficulty: d });
      expect(sim.state.lives).toBe(lives);
      expect(sim.state.cash).toBe(77);
      expect(sim.state.loadout).toEqual(['rattler', 'treacle']);
      const e = spawnEnemy(sim, 'footling', 0);
      expect(e.bounty).toBe(0);
    }
  });
});
