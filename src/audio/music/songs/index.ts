// Every music cue (DESIGN.md §17.2), by manifest key.
import type { Song } from '../sequencer.ts';
import { menu } from './menu.ts';
import { STINGER_SONGS } from './stingers.ts';
import { bossZ1, z1 } from './z1.ts';
import { bossZ2, z2 } from './z2.ts';
import { bossZ3, z3 } from './z3.ts';
import { bossZ4, z4 } from './z4.ts';
import { bossZ5, z5 } from './z5.ts';

/** Looping cues: the menu, a theme per zone, and a boss cue per zone. */
export const SONGS: Record<string, Song> = {
  menu,
  z1, 'boss.z1': bossZ1,
  z2, 'boss.z2': bossZ2,
  z3, 'boss.z3': bossZ3,
  z4, 'boss.z4': bossZ4,
  z5, 'boss.z5': bossZ5,
};

/** One-shot cues: wave, bossArrive, victory, defeat, star1–star3. */
export const STINGERS: Record<string, Song> = STINGER_SONGS;
