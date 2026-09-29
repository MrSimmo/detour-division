// R-ECON-1..3.
import { describe, expect, it } from 'vitest';
import { apply, step } from '../../src/sim/sim.ts';
import { spawnEnemy } from '../../src/sim/enemies.ts';
import { open, simFor, testLevel } from '../helpers/fixtures.ts';

describe('economy', () => {
  it('R-ECON-1: selling refunds floor(sellRate × total spent)', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7), startCash: 500 }));
    const b = apply(sim, { t: 'build', tower: 'rattler', cx: 5, cy: 3 });
    expect(sim.state.cash).toBe(485);
    apply(sim, { t: 'upgrade', id: b.id! });
    expect(sim.state.cash).toBe(465);
    apply(sim, { t: 'sell', id: b.id! });
    expect(sim.state.cash).toBe(465 + Math.floor(0.75 * 35));
  });

  it('R-ECON-2: calling early pays round(earlyRate × waveBounty × remaining / gap), once', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7), startCash: 0 }));
    apply(sim, { t: 'callWave' });
    expect(sim.state.cash).toBe(0); // starting the first wave pays nothing
    for (let i = 0; i < 150; i++) step(sim); // 5 s of a 20 s interval
    const remaining = sim.state.waves.nextAt - sim.state.tick;
    const expected = Math.round(0.25 * sim.level.waves[1]!.bounty * (remaining / sim.level.gapTicks[0]!));
    const r = apply(sim, { t: 'callWave' });
    expect(r.ok).toBe(true);
    expect(expected).toBeGreaterThan(0);
    expect(sim.state.cash).toBe(expected);
    expect(sim.state.waves.next).toBe(2);
  });

  it('R-ECON-2: on a quickening level the bonus is a share of the countdown running now', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7), startCash: 0, waves: { count: [6, 6, 6], interval: 20, intervalEnd: 10, recipe: { b0: 4, g: 1.06, pool: [{ enemy: 'footling', from: 1, weight: 1 }] } } }));
    apply(sim, { t: 'callWave' });
    apply(sim, { t: 'callWave' });
    apply(sim, { t: 'callWave' });
    const cash = sim.state.cash;
    // The third countdown is 15 s (20 → 10 over gaps 1–5), not the level's 20 s interval.
    expect(sim.level.gapTicks[2]).toBe(450);
    for (let i = 0; i < 90; i++) step(sim);
    const remaining = sim.state.waves.nextAt - sim.state.tick;
    const expected = Math.round(0.25 * sim.level.waves[3]!.bounty * (remaining / 450));
    apply(sim, { t: 'callWave' });
    expect(sim.state.cash - cash).toBe(expected);
  });

  it('pays bounty on a kill', () => {
    const sim = simFor(testLevel({ tiles: open(12, 7), startCash: 100 }));
    apply(sim, { t: 'build', tower: 'rattler', cx: 3, cy: 1 });
    const e = spawnEnemy(sim, 'footling', 0);
    e.hp = 1;
    // Long enough to walk in from up the entrance lane (R-LANE-1) and into the Rattler's range.
    for (let i = 0; i < 400 && sim.state.enemies.length; i++) step(sim);
    expect(sim.state.stats.kills).toBe(1);
    expect(sim.state.cash).toBe(85 + e.bounty);
  });

  it('R-ECON-3: cash = start + earned − spent at every tick of a scripted game', () => {
    const sim = simFor(testLevel({ tiles: open(14, 7), startCash: 300 }));
    apply(sim, { t: 'callWave' });
    const ids: number[] = [];
    for (let t = 0; t < 3000; t++) {
      if (t === 10) for (const [x, y] of [[4, 1], [4, 5], [7, 3], [10, 2]]) { const r = apply(sim, { t: 'build', tower: 'rattler', cx: x!, cy: y! }); if (r.ok) ids.push(r.id!); }
      if (t === 400) apply(sim, { t: 'upgrade', id: ids[0]! });
      if (t === 900) apply(sim, { t: 'sell', id: ids[1]! });
      if (t === 950) apply(sim, { t: 'callWave' });
      step(sim);
      expect(sim.state.cash).toBe(300 + sim.state.stats.earned - sim.state.stats.spent);
    }
  });
});
