import { describe, expect, it } from 'vitest';
import { rngFrom, rngNext, rngInt } from '../../src/sim/core/rng.ts';
import { dcos, dsin, rotateToward } from '../../src/sim/core/math.ts';
import { hashState } from '../../src/sim/core/hash.ts';

describe('sfc32 rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = rngFrom(1234);
    const b = rngFrom(1234);
    const sa = Array.from({ length: 20 }, () => rngNext(a));
    const sb = Array.from({ length: 20 }, () => rngNext(b));
    expect(sa).toEqual(sb);
  });

  it('produces different sequences for different seeds', () => {
    const a = rngFrom(1);
    const b = rngFrom(2);
    expect(rngNext(a)).not.toEqual(rngNext(b));
  });

  it('yields values in [0, 1) and integers in [lo, hi]', () => {
    const r = rngFrom(99);
    for (let i = 0; i < 2000; i++) {
      const v = rngNext(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = rngInt(r, 3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('state is plain data: a JSON copy continues the identical sequence', () => {
    const a = rngFrom(7);
    rngNext(a);
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(rngNext(a)).toBe(rngNext(b));
  });
});

describe('deterministic trig', () => {
  it('matches Math.sin/cos closely across several turns', () => {
    for (let x = -20; x <= 20; x += 0.137) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-12);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-12);
    }
  });
});

describe('rotateToward', () => {
  it('snaps to the desired direction when within the max turn', () => {
    const r = rotateToward(1, 0, dcos(0.1), dsin(0.1), dcos(0.2), dsin(0.2));
    expect(r.x).toBeCloseTo(dcos(0.1), 12);
    expect(r.y).toBeCloseTo(dsin(0.1), 12);
  });

  it('turns by exactly the max angle towards the desired side', () => {
    const max = 0.25;
    const left = rotateToward(1, 0, 0, 1, dcos(max), dsin(max));
    expect(left.x).toBeCloseTo(dcos(max), 12);
    expect(left.y).toBeCloseTo(dsin(max), 12);
    const right = rotateToward(1, 0, 0, -1, dcos(max), dsin(max));
    expect(right.y).toBeCloseTo(-dsin(max), 12);
  });
});

describe('hashState', () => {
  it('is stable for equal data and changes when data changes', () => {
    const s = { a: 1, b: [1.5, 2], c: { d: 'x' } };
    expect(hashState(s)).toBe(hashState(JSON.parse(JSON.stringify(s))));
    expect(hashState(s)).not.toBe(hashState({ ...s, a: 2 }));
  });
});
