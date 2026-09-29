// §12 progression: stars, level/zone/tower unlocks, minStars (R-PROG-1 basis), bests.
import { describe, expect, it } from 'vitest';
import { freshProfile, levelUnlocked, minStars, recordResult, totalStars, unlockedTowers, zoneOpen, endlessUnlocked } from '../../src/meta/progression.ts';
import { readJson } from '../../tools/lib/data.ts';
import type { Campaign } from '../../src/meta/progression.ts';
import { balance } from '../helpers/fixtures.ts';

const campaign = readJson('data/campaign.json') as Campaign;

describe('progression', () => {
  it('starts with only the first level and the zero-star towers', () => {
    const p = freshProfile();
    expect(levelUnlocked(p, campaign, balance(), 'z1-01')).toBe(true);
    expect(levelUnlocked(p, campaign, balance(), 'z1-02')).toBe(false);
    expect(unlockedTowers(p, balance())).toEqual(['rattler']);
  });

  it('a win unlocks the next level and keeps the best star count per level', () => {
    const p = freshProfile();
    recordResult(p, 'z1-01', 'casual', { won: true, lives: 18, seconds: 600, waves: 30, kills: 200 });
    expect(p.stars['z1-01']).toBe(1);
    recordResult(p, 'z1-01', 'heroic', { won: true, lives: 3, seconds: 900, waves: 40, kills: 400 });
    expect(p.stars['z1-01']).toBe(3);
    recordResult(p, 'z1-01', 'casual', { won: true, lives: 20, seconds: 500, waves: 30, kills: 200 });
    expect(p.stars['z1-01']).toBe(3);
    expect(p.bests['z1-01']!.casual).toEqual({ lives: 20, seconds: 500, kills: 200 });
    expect(levelUnlocked(p, campaign, balance(), 'z1-02')).toBe(true);
    expect(endlessUnlocked(p, 'z1-01')).toBe(true);
    expect(totalStars(p)).toBe(3);
  });

  it('a loss awards nothing', () => {
    const p = freshProfile();
    recordResult(p, 'z1-01', 'tough', { won: false, lives: 0, seconds: 300, waves: 12, kills: 90 });
    expect(p.stars['z1-01'] ?? 0).toBe(0);
    expect(levelUnlocked(p, campaign, balance(), 'z1-02')).toBe(false);
  });

  it('zone gates need both the previous final level and the star threshold', () => {
    const p = freshProfile();
    for (let i = 1; i <= 8; i++) recordResult(p, `z1-0${i}`, 'casual', { won: true, lives: 20, seconds: 1, waves: 1, kills: 1 });
    expect(totalStars(p)).toBe(8);
    expect(zoneOpen(p, campaign, balance(), 2)).toBe(true);
    for (let i = 1; i <= 8; i++) recordResult(p, `z2-0${i}`, 'casual', { won: true, lives: 20, seconds: 1, waves: 1, kills: 1 });
    // 16 stars < 18: Zone 3 stays shut until two more stars are earned.
    expect(zoneOpen(p, campaign, balance(), 3)).toBe(false);
    recordResult(p, 'z2-01', 'heroic', { won: true, lives: 20, seconds: 1, waves: 1, kills: 1 });
    expect(zoneOpen(p, campaign, balance(), 3)).toBe(true);
  });

  it('towers unlock at their star thresholds', () => {
    const p = freshProfile();
    recordResult(p, 'z1-01', 'heroic', { won: true, lives: 20, seconds: 1, waves: 1, kills: 1 });
    recordResult(p, 'z1-02', 'casual', { won: true, lives: 20, seconds: 1, waves: 1, kills: 1 });
    expect(unlockedTowers(p, balance())).toEqual(['rattler', 'treacle', 'skylark', 'thumper']);
  });

  it('minStars(k) = max(minStars(k−1) + 1, zoneGate(k)) and matches the tower thresholds (§12)', () => {
    const gates = balance().progression.zoneGates;
    expect(minStars(campaign, gates, 'z1-01')).toBe(0);
    expect(minStars(campaign, gates, 'z1-05')).toBe(4);
    expect(minStars(campaign, gates, 'z2-01')).toBe(8);
    expect(minStars(campaign, gates, 'z3-01')).toBe(18);
    expect(minStars(campaign, gates, 'z4-01')).toBe(30);
    expect(minStars(campaign, gates, 'z5-08')).toBe(51);
    const intro: Record<string, string> = { rattler: 'z1-01', treacle: 'z1-02', skylark: 'z1-03', thumper: 'z1-05', scorcher: 'z2-01', sparkplug: 'z2-03', piechucker: 'z2-06', icebox: 'z3-01', sunbeam: 'z3-04', bubbler: 'z3-06', teaurn: 'z4-01', bellower: 'z4-04' };
    for (const [tower, level] of Object.entries(intro)) expect(balance().progression.towerStars[tower]).toBe(minStars(campaign, gates, level));
  });
});
