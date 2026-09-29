// R-DMG-1 (M1 subset): armour, penetration, minimum chip, vulnerability, slow stacking, splash.
import { describe, expect, it } from 'vitest';
import { applySlow, damageEnemy, splashDamage } from '../../src/sim/combat.ts';
import { spawnEnemy } from '../../src/sim/enemies.ts';
import { open, simFor, testLevel } from '../helpers/fixtures.ts';

function setup() {
  return simFor(testLevel({ tiles: open(12, 7) }));
}

describe('hit resolution', () => {
  it('armour shrugs off small kinetic hits down to the 15% minimum chip', () => {
    const sim = setup();
    const e = spawnEnemy(sim, 'tinkettle', 0);
    const hp = e.hp;
    expect(damageEnemy(sim, e, 4, 'kinetic', 0)).toBeCloseTo(0.6, 12);
    expect(e.hp).toBeCloseTo(hp - 0.6, 12);
  });

  it('explosive penetrates 30% of armour', () => {
    const sim = setup();
    const e = spawnEnemy(sim, 'tinkettle', 0);
    expect(damageEnemy(sim, e, 70, 'explosive', 0)).toBeCloseTo(70 - 6 * 0.7, 12);
  });

  it('fire ignores armour and applies vulnerability', () => {
    const sim = setup();
    const e = spawnEnemy(sim, 'tinkettle', 0);
    expect(damageEnemy(sim, e, 10, 'fire', 0)).toBeCloseTo(12.5, 12);
  });

  it('flat penetration reduces armour before the type penetration', () => {
    const sim = setup();
    const e = spawnEnemy(sim, 'tinkettle', 0);
    expect(damageEnemy(sim, e, 11, 'kinetic', 3)).toBeCloseTo(8, 12);
  });

  it('kills at zero HP and records the kill once', () => {
    const sim = setup();
    const e = spawnEnemy(sim, 'footling', 0);
    damageEnemy(sim, e, 1000, 'kinetic', 0);
    damageEnemy(sim, e, 1000, 'kinetic', 0);
    expect(e.hp).toBeLessThanOrEqual(0);
    expect(sim.state.stats.kills).toBe(1);
  });

  it('only the strongest slow applies, and a weaker one does not shorten it', () => {
    const sim = setup();
    const e = spawnEnemy(sim, 'footling', 0);
    applySlow(e, 0.35, 60);
    applySlow(e, 0.2, 90);
    expect(e.slow).toBe(0.35);
    expect(e.slowT).toBe(60);
    applySlow(e, 0.45, 30);
    expect(e.slow).toBe(0.45);
  });

  it('splash falls off linearly to splashEdge at the radius and ignores air', () => {
    const sim = setup();
    const a = spawnEnemy(sim, 'footling', 0);
    const b = spawnEnemy(sim, 'footling', 0);
    const c = spawnEnemy(sim, 'whirligig', 0);
    for (const e of [a, b, c]) e.phase = 1;
    a.x = 5; a.y = 3; b.x = 6; b.y = 3; c.x = 5; c.y = 3;
    const ha = a.hp, hb = b.hp, hc = c.hp;
    splashDamage(sim, 5, 3, 1, 0.5, 20, 'explosive', 0, { ground: true, air: false });
    expect(ha - a.hp).toBeCloseTo(20, 12);
    expect(hb - b.hp).toBeCloseTo(10, 12);
    expect(c.hp).toBe(hc);
  });
});
