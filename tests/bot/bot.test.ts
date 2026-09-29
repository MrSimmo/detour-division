// §15.1 reference bot: the numbers the validator judges levels by.
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/data/load.ts';
import { runBot } from '../../src/bot/bot.ts';
import { balance, open, testLevel } from '../helpers/fixtures.ts';

describe('reference bot', () => {
  it('measures peak threat over the waves actually launched when a timed mode ends early (§8)', () => {
    const base = testLevel({ tiles: open(16, 7), startCash: 200, waves: { count: [60, 60, 60], interval: 4, recipe: { b0: 4, g: 1.03, pool: [{ enemy: 'footling', from: 1, weight: 1 }] } } });
    const lv = parseLevel({ ...base, mode: 'timeTrial', modeParams: { timer: [240, 240, 240], target: [40, 40, 40] } });
    const r = runBot(lv, balance(), 'casual');
    expect(r.result).toBe('won');
    // The kill target is reached long before the last third of the 60 scripted waves.
    expect(r.waves).toBeLessThan(40);
    expect(r.peak95).toBeGreaterThan(0);
  });
});
