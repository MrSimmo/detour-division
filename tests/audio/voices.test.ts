// §17.3 voice limiting: caps per sound and overall, retrigger intervals, priorities, merging.
import { describe, expect, it } from 'vitest';
import { PRIORITY, VoiceLimiter, type SoundSpec } from '../../src/audio/sfx/voices.ts';

const rattler: SoundSpec = { cap: 4, retrigMs: 45, priority: PRIORITY.shot };
const boom: SoundSpec = { cap: 6, retrigMs: 30, priority: PRIORITY.explosion };
const roar: SoundSpec = { cap: 1, retrigMs: 0, priority: PRIORITY.boss };

describe('voice limiter', () => {
  it('R-AUD-1: 50 Rattlers firing never exceed the Rattler cap or the global cap', () => {
    const v = new VoiceLimiter(24);
    let s = 7;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    // 50 towers at 5 shots a second for 4 seconds, plus explosions, at random milliseconds.
    const triggers: { t: number; key: string }[] = [];
    for (let k = 0; k < 50 * 5 * 4; k++) triggers.push({ t: Math.floor(rnd() * 4000), key: 'rattler' });
    for (let k = 0; k < 60; k++) triggers.push({ t: Math.floor(rnd() * 4000), key: 'boom' });
    triggers.sort((a, z) => a.t - z.t);
    let peak = 0;
    let peakRattler = 0;
    for (const tr of triggers) {
      v.request(tr.key, tr.key === 'rattler' ? rattler : boom, tr.t, tr.t + 180);
      peak = Math.max(peak, v.active(tr.t));
      peakRattler = Math.max(peakRattler, v.activeFor('rattler', tr.t));
    }
    expect(peakRattler).toBeLessThanOrEqual(4);
    expect(peak).toBeLessThanOrEqual(24);
  });

  it('keeps the minimum retrigger interval by merging into the recent voice', () => {
    const v = new VoiceLimiter(24);
    expect(v.request('rattler', rattler, 0, 200).kind).toBe('play');
    expect(v.request('rattler', rattler, 20, 220).kind).toBe('merge');
    expect(v.request('rattler', rattler, 50, 250).kind).toBe('play');
  });

  it('merges simultaneous triggers into one voice with gain rising by the log of the count', () => {
    const v = new VoiceLimiter(24);
    const first = v.request('boom', boom, 100, 400);
    const gains = [2, 3, 4].map(() => {
      const d = v.request('boom', boom, 100, 400);
      return d.kind === 'merge' ? d.gain : NaN;
    });
    expect(first.kind).toBe('play');
    expect(v.activeFor('boom', 100)).toBe(1);
    expect(gains[0]).toBeGreaterThan(1);
    expect(gains[2]! - gains[1]!).toBeLessThan(gains[1]! - gains[0]!);
  });

  it('steals the oldest voice of the lowest priority when the global cap is hit', () => {
    const v = new VoiceLimiter(3);
    const a = v.request('shotA', { cap: 4, retrigMs: 0, priority: PRIORITY.shot }, 0, 5000);
    v.request('shotB', { cap: 4, retrigMs: 0, priority: PRIORITY.shot }, 10, 5000);
    v.request('ui', { cap: 4, retrigMs: 0, priority: PRIORITY.ui }, 20, 5000);
    const d = v.request('roar', roar, 30, 5000);
    expect(d.kind).toBe('play');
    expect(d.kind === 'play' && d.steal).toBe(a.kind === 'play' ? a.id : -1);
    // A shot can't push out anything more important than itself.
    const full = new VoiceLimiter(1);
    full.request('roar', roar, 0, 5000);
    expect(full.request('shotA', { cap: 4, retrigMs: 0, priority: PRIORITY.shot }, 10, 5000).kind).toBe('drop');
  });
});
