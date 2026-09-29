// R-DMG-1 (full) and R-ENEMY-1: scenario tests for every tower special and enemy trait.
import { describe, expect, it } from 'vitest';
import { apply, drainEvents, step } from '../../src/sim/sim.ts';
import { damageEnemy } from '../../src/sim/combat.ts';
import { spawnEnemy } from '../../src/sim/enemies.ts';
import { applyBurn, applyFreeze } from '../../src/sim/status.ts';
import { TICK_HZ } from '../../src/sim/constants.ts';
import type { Sim } from '../../src/sim/context.ts';
import type { Enemy, Tower } from '../../src/sim/types.ts';
import { open, simFor, testLevel } from '../helpers/fixtures.ts';

const ALL = ['rattler', 'treacle', 'skylark', 'thumper', 'scorcher', 'sparkplug'];

function field(cols = 16, rows = 9, loadout = ALL): Sim {
  return simFor(testLevel({ tiles: open(cols, rows), startCash: 100000, lives: 1000, loadout }));
}

function tower(sim: Sim, type: string, cx: number, cy: number, tier = 0): Tower {
  if (!sim.state.loadout.includes(type)) sim.state.loadout.push(type);
  const r = apply(sim, { t: 'build', tower: type, cx, cy });
  expect(r.ok).toBe(true);
  const t = sim.state.towers.find((x) => x.id === r.id)!;
  t.tier = tier;
  return t;
}

/** A unit placed on the field; `still` pins it in place (speed 0). */
function unit(sim: Sim, type: string, x: number, y: number, o: { elite?: boolean; still?: boolean } = {}): Enemy {
  const route = sim.balance.enemies[type]!.air ? 0 : 0;
  const e = spawnEnemy(sim, type, route, o.elite ?? false);
  e.x = e.px = x;
  e.y = e.py = y;
  e.phase = 1;
  if (e.air) {
    e.x0 = x - 5;
    e.y0 = y;
    e.x1 = x + 5;
    e.y1 = y;
    e.len = 10;
    e.t = 0.5;
  }
  if (o.still) e.speed = 0;
  return e;
}

const ticks = (sim: Sim, s: number): void => {
  for (let i = 0; i < Math.round(s * TICK_HZ); i++) step(sim);
};

describe('tower specials', () => {
  it('Scorcher burns what is in its cone, not what is behind it', () => {
    const sim = field();
    const t = tower(sim, 'scorcher', 8, 4);
    const front = unit(sim, 'lummox', 9.9, 4.5, { still: true });
    const behind = unit(sim, 'lummox', 7.1, 4.5, { still: true });
    ticks(sim, 2);
    expect(t.target).toBe(front.id);
    expect(front.hp).toBeLessThan(front.maxHp - 20);
    expect(front.burns.length).toBe(1);
    expect(behind.hp).toBe(behind.maxHp);
  });

  it('Sparkplug chains to nearby units with falloff and hits shields twice as hard', () => {
    const sim = field();
    const sp = tower(sim, 'sparkplug', 8, 4);
    apply(sim, { t: 'target', id: sp.id, mode: 'closest' });
    const a = unit(sim, 'lummox', 10, 4.5, { still: true });
    const b = unit(sim, 'lummox', 11.2, 4.5, { still: true });
    const far = unit(sim, 'lummox', 14.5, 4.5, { still: true });
    const brolly = unit(sim, 'brolly', 12.4, 4.5, { still: true });
    ticks(sim, 0.4);
    const ev = drainEvents(sim).filter((e) => e.e === 'zap');
    expect(ev.length).toBeGreaterThan(0);
    expect(a.maxHp - a.hp).toBeGreaterThan(b.maxHp - b.hp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(far.hp).toBe(far.maxHp);
    // Third link: 40 × 0.8² = 25.6 shock ×2 against the shield.
    expect(brolly.maxShield - brolly.shield).toBeCloseTo(51.2, 6);
  });

  it('Sunbeam waits for its charge, then pierces everything on the line', () => {
    const sim = field(16, 9, ['sunbeam']);
    tower(sim, 'sunbeam', 2, 4);
    const line = [4, 5, 6].map((x) => unit(sim, 'lummox', x + 0.5, 4.5, { still: true }));
    ticks(sim, 0.9);
    expect(line.every((e) => e.hp === e.maxHp)).toBe(true);
    ticks(sim, 0.5);
    expect(line.every((e) => e.hp < e.maxHp - 100)).toBe(true);
  });

  it('Icebox freezes nearby ground units, which are brittle after they thaw; bosses are only slowed', () => {
    const sim = field(16, 9, ['icebox']);
    tower(sim, 'icebox', 8, 4);
    const e = unit(sim, 'footling', 9.5, 4.5);
    const boss = unit(sim, 'flattener', 7.2, 4.5);
    step(sim);
    expect(e.stunT).toBeGreaterThan(0);
    expect(e.frozen).toBe(true);
    const x = e.x;
    ticks(sim, 0.5);
    expect(e.x).toBe(x);
    expect(boss.stunT).toBe(0);
    expect(boss.slow).toBeCloseTo(0.3, 9);
    ticks(sim, 0.6);
    expect(e.brittle).toBeCloseTo(0.2, 9);
  });

  it('Tea Urn speeds up nearby towers, and auras do not stack', () => {
    const shots = (urns: number): number => {
      const sim = field(16, 9, ['rattler', 'teaurn']);
      const r = tower(sim, 'rattler', 8, 4);
      if (urns > 0) tower(sim, 'teaurn', 8, 3);
      if (urns > 1) tower(sim, 'teaurn', 8, 5);
      unit(sim, 'lummox', 9.6, 4.5, { still: true }).hp = 1e9;
      ticks(sim, 10);
      return r.shots;
    };
    const base = shots(0);
    expect(shots(1) / base).toBeCloseTo(1.15, 1);
    expect(shots(2)).toBe(shots(1));
  });

  it('Bellower marches ground units backwards, then they ignore it for a while', () => {
    const sim = field(16, 9, ['bellower']);
    tower(sim, 'bellower', 9, 4);
    const e = unit(sim, 'footling', 7.5, 4.5);
    e.hx = 1;
    e.hy = 0;
    // The horn has to swing round from east to face west first.
    ticks(sim, 0.6);
    expect(e.revT).toBeGreaterThan(0);
    const x = e.x;
    ticks(sim, 0.5);
    expect(e.x).toBeLessThan(x);
    expect(e.revImmT).toBeGreaterThan(0);
  });

  it('Bubbler lifts a unit back along its route and pops it; bosses and (at T1) heavy units are immune', () => {
    const sim = field(16, 9, ['bubbler']);
    tower(sim, 'bubbler', 9, 1);
    const e = unit(sim, 'footling', 9.5, 3.5, { still: false });
    ticks(sim, 0.3);
    expect(e.bubbleT).toBeGreaterThan(0);
    const x = e.x;
    ticks(sim, 1);
    expect(e.x).toBeLessThan(x);
    ticks(sim, 2);
    expect(e.bubbleT).toBe(0);
    expect(e.hp).toBeLessThan(e.maxHp);
    const sim2 = field(16, 9, ['bubbler']);
    tower(sim2, 'bubbler', 9, 1);
    const heavy = unit(sim2, 'tinkettle', 9.5, 3.5, { still: true });
    const boss = unit(sim2, 'flattener', 10.5, 3.5, { still: true });
    ticks(sim2, 1);
    expect(heavy.bubbleT).toBe(0);
    expect(boss.bubbleT).toBe(0);
  });

  it('Pie Chucker custard strips armour so small guns bite', () => {
    const sim = field(16, 9, ['piechucker']);
    tower(sim, 'piechucker', 3, 4);
    const k = unit(sim, 'tinkettle', 6.5, 4.5, { still: true });
    ticks(sim, 1.5);
    expect(k.shred).toBe(4);
    const before = k.hp;
    damageEnemy(sim, k, 4, 'kinetic', 0);
    expect(before - k.hp).toBeCloseTo(4 - (6 - 4), 9);
  });

  it('Thumper T3 scatters bomblets', () => {
    const sim = field(16, 9, ['thumper']);
    tower(sim, 'thumper', 2, 4, 2);
    unit(sim, 'lummox', 7.5, 4.5, { still: true }).hp = 1e9;
    ticks(sim, 3);
    const booms = drainEvents(sim).filter((e) => e.e === 'boom');
    expect(booms.length).toBeGreaterThanOrEqual(5);
  });

  it('Treacle T3 leaves a puddle that slows whoever walks through later', () => {
    const sim = field(16, 9, ['treacle']);
    tower(sim, 'treacle', 8, 3, 2);
    unit(sim, 'lummox', 8.5, 4.6, { still: true }).hp = 1e9;
    ticks(sim, 1);
    expect(sim.state.zones.some((z) => z.kind === 'puddle')).toBe(true);
  });
});

describe('enemy traits', () => {
  it('Brolly Guard: shield absorbs first, regenerates after a pause; fire does half to shields', () => {
    const sim = field();
    const b = unit(sim, 'brolly', 5, 4.5, { still: true });
    damageEnemy(sim, b, 40, 'fire', 0);
    expect(b.shield).toBeCloseTo(40, 9);
    expect(b.hp).toBe(b.maxHp);
    // 90: 40 finishes the shield, 50 reaches the 60 HP underneath.
    damageEnemy(sim, b, 90, 'kinetic', 0);
    expect(b.shield).toBe(0);
    expect(b.hp).toBeCloseTo(b.maxHp - 50, 9);
    ticks(sim, 2.9);
    expect(b.shield).toBe(0);
    ticks(sim, 1.2);
    expect(b.shield).toBeGreaterThan(0);
  });

  it('Sawbones heals allies nearby, not itself', () => {
    const sim = field();
    const m = unit(sim, 'sawbones', 5, 4.5, { still: true });
    const a = unit(sim, 'lummox', 6, 4.5, { still: true });
    a.hp = 100;
    m.hp = 10;
    ticks(sim, 2.2);
    expect(a.hp).toBeCloseTo(100 + 0.08 * a.maxHp, 6);
    expect(m.hp).toBe(10);
  });

  it('Trenchcoat Trio splits into three Tiddlers (elite into elite Tiddlers)', () => {
    for (const elite of [false, true]) {
      const sim = field();
      const t = unit(sim, 'trio', 6, 4.5, { elite });
      damageEnemy(sim, t, 1e6, 'kinetic', 0);
      const kids = sim.state.enemies.filter((e) => e.type === 'tiddler');
      expect(kids.length).toBe(3);
      expect(kids.every((k) => k.elite === elite)).toBe(true);
    }
  });

  it('Tub-Thumper speeds up nearby allies by 25%, and auras do not stack', () => {
    const sim = field();
    unit(sim, 'tubthumper', 6, 4.5, { still: true });
    unit(sim, 'tubthumper', 6, 5.5, { still: true });
    const a = unit(sim, 'footling', 6.8, 4.5);
    step(sim);
    expect(a.auraSpeed).toBeCloseTo(0.25, 9);
    const band = field();
    unit(band, 'tubthumper', 6, 4.5, { still: true, elite: true });
    const b = unit(band, 'footling', 6.8, 4.5);
    step(band);
    expect(b.auraSpeed).toBeCloseTo(0.35, 9);
    expect(b.auraArmour).toBe(1);
  });

  it('Big Lummox halves slows; the elite ignores Bellowers and Bubblers', () => {
    const sim = field(16, 9, ['treacle']);
    const l = unit(sim, 'lummox', 6, 4.5);
    tower(sim, 'treacle', 6, 3);
    ticks(sim, 0.9);
    expect(l.slow).toBeCloseTo(0.35 * 0.5, 9);
    const sim2 = field(16, 9, ['bellower']);
    tower(sim2, 'bellower', 9, 4);
    const c = unit(sim2, 'lummox', 7.5, 4.5, { elite: true, still: true });
    const plain = unit(sim2, 'lummox', 7.5, 3.9, { still: true });
    ticks(sim2, 0.8);
    expect(plain.revT).toBeGreaterThan(0);
    expect(c.revT).toBe(0);
  });

  it('Dreadnought Gasbag releases two Whirligigs when it goes down', () => {
    const sim = field();
    const g = unit(sim, 'gasbag', 6, 4.5, { elite: true });
    damageEnemy(sim, g, 1e7, 'kinetic', 0);
    expect(sim.state.enemies.filter((e) => e.type === 'whirligig').length).toBe(2);
  });

  it('Sprinter Scarper bolts when first hit; Boilerplate Kettle dashes below half HP', () => {
    const sim = field();
    const s = unit(sim, 'scarper', 6, 4.5, { elite: true });
    damageEnemy(sim, s, 1, 'kinetic', 0);
    expect(s.sprintT).toBeGreaterThan(0);
    const k = unit(sim, 'tinkettle', 6, 5.5, { elite: true });
    damageEnemy(sim, k, k.maxHp * 0.6, 'fire', 0);
    step(sim);
    expect(k.dashing).toBe(true);
  });

  it('burns stack from up to three sources; a freeze grants 1.5 s of immunity', () => {
    const sim = field();
    const e = unit(sim, 'lummox', 6, 4.5, { still: true });
    for (let src = 1; src <= 5; src++) applyBurn(sim, e, src, 5, 30);
    expect(e.burns.length).toBe(3);
    const f = unit(sim, 'footling', 6, 5.5, { still: true });
    applyFreeze(sim, f, 30, 0.2, 60, 0.3, 30);
    ticks(sim, 1.2);
    applyFreeze(sim, f, 30, 0.2, 60, 0.3, 30);
    expect(f.stunT).toBe(0);
  });
});

describe('bosses', () => {
  it('Old Flattener bursts forward below half HP', () => {
    const sim = field();
    const b = unit(sim, 'flattener', 3, 4.5);
    damageEnemy(sim, b, b.maxHp * 0.55 + 100, 'fire', 0);
    step(sim);
    expect(b.burstT).toBeGreaterThan(0);
  });

  it('Dune Dredger deploys Putt-Putts every 6 s', () => {
    const sim = field(24, 9);
    unit(sim, 'dredger', 3, 4.5);
    ticks(sim, 6.2);
    expect(sim.state.enemies.filter((e) => e.type === 'puttputt').length).toBe(2);
  });

  it('Glacier Grinder: breaking the ice shield stuns it for 2 s; the shield regrows after 8 s', () => {
    const sim = field(24, 9);
    const g = unit(sim, 'grinder', 3, 4.5);
    expect(g.shield).toBe(2000);
    damageEnemy(sim, g, 1000, 'shock', 0);
    expect(g.shield).toBe(0);
    step(sim);
    expect(g.stunT).toBeGreaterThan(55);
    ticks(sim, 8.2);
    expect(g.shield).toBe(2000);
  });

  it('Smogmother drops a Tin Kettle onto a routable cell', () => {
    const sim = field(24, 9);
    unit(sim, 'smogmother', 12, 4.5, { still: true });
    ticks(sim, 8.1);
    const k = sim.state.enemies.find((e) => e.type === 'tinkettle');
    expect(k).toBeDefined();
    expect(sim.grid.walk[Math.floor(k!.y) * 24 + Math.floor(k!.x)]).toBe(1);
  });

  it('Kerblam Mech launches Whirligigs below 66% and sheds its plating below 33%', () => {
    const sim = field(24, 9);
    const k = unit(sim, 'kerblam', 3, 4.5, { still: true });
    damageEnemy(sim, k, k.maxHp * 0.4, 'fire', 0);
    ticks(sim, 0.2);
    expect(k.bossPhase).toBe(1);
    ticks(sim, 10);
    expect(sim.state.enemies.filter((e) => e.type === 'whirligig').length).toBeGreaterThanOrEqual(3);
    damageEnemy(sim, k, k.maxHp * 0.3, 'fire', 0);
    step(sim);
    expect(k.bossPhase).toBe(2);
    expect(k.armour).toBe(0);
  });

  it('an escaped boss costs 5 lives', () => {
    const sim = field(10, 7);
    const b = unit(sim, 'flattener', 9.4, 3.5);
    b.speed = 3;
    ticks(sim, 3);
    expect(sim.state.lives).toBe(995);
  });
});
