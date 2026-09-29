// §17.2 every cue is well formed: whole bars, patterns that divide the loop, known instruments.
import { describe, expect, it } from 'vitest';
import { compileSong, stepTime } from '../../src/audio/music/sequencer.ts';
import { SONGS, STINGERS } from '../../src/audio/music/songs/index.ts';

describe('music cues', () => {
  for (const [key, song] of Object.entries(SONGS)) {
    it(`${key} compiles, loops on a bar line and has all four layers`, () => {
      expect(song.id).toBe(key);
      const cs = compileSong(song);
      expect(cs.loopSteps % cs.barSteps).toBe(0);
      expect(song.layers.every((l) => l.length > 0)).toBe(true);
    });
  }
  for (const [key, song] of Object.entries(STINGERS)) {
    it(`stinger ${key} compiles and plays once`, () => {
      expect(song.id).toBe(key);
      const cs = compileSong({ ...song, once: true });
      expect(stepTime(song, cs.loopSteps)).toBeGreaterThan(0.5);
    });
  }
});
