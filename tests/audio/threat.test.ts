// §17.2 adaptive layers: threat = Σ HP fraction × route progress², normalised, bosses weighted up.
import { describe, expect, it } from 'vitest';
import { layersFor, musicThreat } from '../../src/audio/music/threat.ts';

const unit = (hp: number, progress: number, type = 'footling') => ({ hp, maxHp: 100, progress, type });
const boss = (t: string) => t === 'flattener';

describe('music threat', () => {
  it('is zero on an empty field and grows with HP left and distance covered', () => {
    expect(musicThreat([], boss)).toBe(0);
    const near = musicThreat([unit(100, 0.9)], boss);
    expect(musicThreat([unit(100, 0.3)], boss)).toBeLessThan(near);
    expect(musicThreat([unit(20, 0.9)], boss)).toBeLessThan(near);
  });

  it('weights bosses up and stays within 0..1', () => {
    expect(musicThreat([unit(100, 0.5, 'flattener')], boss)).toBeGreaterThan(musicThreat([unit(100, 0.5)], boss) * 3);
    expect(musicThreat(Array.from({ length: 200 }, () => unit(100, 1)), boss)).toBe(1);
  });

  it('adds layers at 0.2 and 0.5: L0+L1, then +L2, then +L3', () => {
    expect(layersFor(0)).toBe(2);
    expect(layersFor(0.19)).toBe(2);
    expect(layersFor(0.2)).toBe(3);
    expect(layersFor(0.5)).toBe(3);
    expect(layersFor(0.51)).toBe(4);
  });
});
