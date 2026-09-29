// SFX patches (DESIGN.md §17.3): one synth patch per key in `keys.ts`, rendered at boot into 3 variants.
// A patch draws into `out` starting at time 0. `r()` is seeded per variant: use it for small
// differences in pitch, timing and noise offset so the variants don't sound identical.
// The sounds live in patches-towers.ts and patches-world.ts; the level trims live here, in one table.
import type { SfxDef } from './player.ts';
import { BOOM_SFX, TOWER_SFX } from './patches-towers.ts';
import { AMBIENCE_SFX, BOSS_SFX, ENEMY_SFX, UI_SFX } from './patches-world.ts';

/** Level trims in dB, measured with `tools/dev/audio-check.ts sfx`, so that after the trim shots peak
 * at about 0.45, impacts and bosses at about 0.75, UI at about 0.4 and ambience at about 0.15. Sustained
 * sounds (whistles, buzzes, hums) are also capped by RMS, so they sit a little lower in peak. */
const TRIM: Record<string, number> = {
  'tower.rattler.t1': -3,
  'tower.rattler.t2': -3,
  'tower.rattler.t3': -4.5,
  'tower.treacle.t1': -1,
  'tower.treacle.t2': -1.5,
  'tower.treacle.t3': -1,
  'tower.skylark.t1': 4.5,
  'tower.skylark.t2': 5.5,
  'tower.skylark.t3': 4.5,
  'tower.thumper.t1': -6,
  'tower.thumper.t2': -6.5,
  'tower.thumper.t3': -5.5,
  'tower.scorcher.t1': 2.5,
  'tower.scorcher.t2': 2.5,
  'tower.scorcher.t3': 2.5,
  'tower.sparkplug.t1': 1.5,
  'tower.sparkplug.t2': 1.5,
  'tower.sparkplug.t3': -3.5,
  'tower.sunbeam.t1': 1.5,
  'tower.sunbeam.t2': 2,
  'tower.sunbeam.t3': 2,
  'tower.icebox.t1': -6.5,
  'tower.icebox.t2': -6,
  'tower.icebox.t3': -6.5,
  'tower.teaurn.t1': -3.5,
  'tower.teaurn.t2': -3.5,
  'tower.teaurn.t3': -4,
  'tower.bellower.t1': -1.5,
  'tower.bellower.t2': -3,
  'tower.bellower.t3': -1,
  'tower.bubbler.t1': -0.5,
  'tower.bubbler.t2': -1,
  'tower.bubbler.t3': -2,
  'tower.piechucker.t1': -1.5,
  'tower.piechucker.t2': -1,
  'tower.piechucker.t3': -3,
  'boom.thumper': -1.5,
  'boom.piechucker': -0.5,
  'boom.skylark': 1,
  'boom.small': 1,
  'enemy.pop': -3.5,
  'enemy.clank': -6,
  'enemy.air': 5.5,
  'enemy.leak': 0.5,
  'enemy.shieldbreak': -4.5,
  'enemy.shieldup': 3,
  'enemy.heal': 3.5,
  'enemy.split': 4,
  'enemy.tunnel': -2,
  'status.freeze': 5.5,
  'status.pop': -4,
  'status.reverse': -5,
  'boss.arrive': -0.5,
  'boss.phase': 1,
  'boss.drop': -1,
  'boss.death': 2,
  'ui.click': -4,
  'ui.select': 0,
  'ui.build': -5,
  'ui.upgrade': -2.5,
  'ui.sell': -4,
  'ui.error': -10.5,
  'ui.clear': -1.5,
  'ui.coins': -3.5,
  'ui.wave': -4.5,
  'amb.z1': 1.5,
  'amb.z2': -2,
  'amb.z3': 1,
  'amb.z4': -6,
  'amb.z5': -2,
};

const ALL: Record<string, SfxDef> = { ...TOWER_SFX, ...BOOM_SFX, ...ENEMY_SFX, ...BOSS_SFX, ...UI_SFX, ...AMBIENCE_SFX };

export const SFX: Record<string, SfxDef> = Object.fromEntries(Object.entries(ALL).map(([k, d]) => [k, { ...d, gain: TRIM[k] ?? 0 }]));
