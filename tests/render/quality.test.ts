// §19 auto quality: down after 2 s of slow frames (particles, then resolution 1.5, then 1),
// back up after 10 s of fast ones, and never flapping in between.
import { describe, expect, it } from 'vitest';
import { AutoQuality } from '../../src/render/quality.ts';

const run = (q: AutoQuality, ms: number, seconds: number): number => {
  let changes = 0;
  for (let t = 0; t < seconds * 1000; t += ms) if (q.frame(ms)) changes++;
  return changes;
};

describe('auto quality', () => {
  it('holds steady at 60 fps', () => {
    const q = new AutoQuality(2);
    expect(run(q, 16.7, 30)).toBe(0);
    expect(q.current()).toEqual({ density: 1, resolution: 2 });
  });

  it('steps down particles first, then resolution to 1.5, then 1, one step per 2 s of slow frames', () => {
    const q = new AutoQuality(2);
    run(q, 25, 2.5);
    expect(q.current()).toEqual({ density: 0.5, resolution: 2 });
    run(q, 25, 2.2);
    expect(q.current()).toEqual({ density: 0.5, resolution: 1.5 });
    run(q, 25, 2.2);
    expect(q.current()).toEqual({ density: 0.5, resolution: 1 });
    run(q, 25, 10);
    expect(q.current()).toEqual({ density: 0.5, resolution: 1 });
  });

  it('steps back up only after 10 s under 12 ms, and middling frames change nothing', () => {
    const q = new AutoQuality(2);
    run(q, 25, 2.5);
    expect(run(q, 15, 30)).toBe(0);
    run(q, 8, 9);
    expect(q.current().density).toBe(0.5);
    run(q, 8, 1.5);
    expect(q.current()).toEqual({ density: 1, resolution: 2 });
  });

  it('never asks for more resolution than the device has', () => {
    const q = new AutoQuality(1);
    run(q, 25, 4.5);
    expect(q.current().resolution).toBe(1);
  });
});
