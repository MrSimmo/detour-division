// §17.3 the SFX catalogue: every key the game asks for has a patch, and every patch is asked for.
import { describe, expect, it } from 'vitest';
import { SFX } from '../../src/audio/sfx/patches.ts';
import { SFX_KEYS } from '../../src/audio/sfx/keys.ts';
import { PRIORITY } from '../../src/audio/sfx/voices.ts';

describe('SFX catalogue', () => {
  it('patches implement exactly the catalogue keys', () => {
    expect(Object.keys(SFX).sort()).toEqual([...SFX_KEYS].sort());
  });

  it('every patch has sane limits: caps, retrigger, a length, a known priority', () => {
    const priorities = new Set<number>(Object.values(PRIORITY));
    for (const [k, d] of Object.entries(SFX)) {
      expect(d.cap, k).toBeGreaterThanOrEqual(1);
      expect(d.cap, k).toBeLessThanOrEqual(8);
      expect(d.retrigMs, k).toBeGreaterThanOrEqual(0);
      expect(d.dur, k).toBeGreaterThan(0);
      expect(d.dur, k).toBeLessThanOrEqual(10);
      expect(priorities.has(d.priority), k).toBe(true);
    }
    expect(SFX['tower.rattler.t1']!.cap).toBe(4);
    expect(SFX['tower.rattler.t1']!.retrigMs).toBe(45);
  });
});
