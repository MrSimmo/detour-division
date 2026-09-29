// Stingers (DESIGN.md §17.2): one-shot cues played over the music, which ducks under them.
// All four layers of a stinger play together.
import type { Song } from '../sequencer.ts';

/** Wave start: a two-bar bugle call over a snare, climbing the C major arpeggio to top C. */
export const waveStinger: Song = {
  id: 'wave',
  bpm: 140,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 2,
  once: true,
  layers: [
    [{ inst: 'snare', notes: 'C4:1> C4:1 C4:2 C4:1 C4:1 C4:2 .:8 | C4:1> C4:1 C4:1 C4:1 C4:4> .:8', gain: 0.5, reverb: 0.2 }],
    [{ inst: 'trumpet', notes: 'G4:2 C5:2 E5:2 G5:4> E5:2 G5:4 | C6:12> .:4', gain: 1.1, reverb: 0.35 }],
    [{ inst: 'kick', notes: 'C2:4> .:12 | C2:4> .:12', gain: 0.5, reverb: 0 }],
    [{ inst: 'cymbal', notes: '.:16 | C4:4> .:12', gain: 0.4, reverb: 0.3 }],
  ],
};

/** Boss arrival: four bars of low brass hits over a timpani roll, C minor darkened by D♭ and B. */
export const bossArriveStinger: Song = {
  id: 'bossArrive',
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 4,
  once: true,
  layers: [
    [{ inst: 'tuba', notes: 'C2:8> .:8 | Db2:8> .:8 | C2:8> .:8 | G1:4> G1:4> G1:8>', gain: 0.9, reverb: 0.2 }],
    [
      {
        inst: 'trombone',
        notes: 'C3+G3+C4:4> .:12 | Db3+Ab3+Db4:4> .:12 | C3+G3+C4:4> .:12 | B2+F3+Ab3:2> .:2 B2+F3+Ab3:2> .:2 C3+G3+C4:8>',
        gain: 0.55,
        reverb: 0.35,
      },
    ],
    [{ inst: 'timpani', notes: '(C3:2)x8 | (Db3:2)x8 | (C3:2)x8 | G2:2> G2:2 G2:2 G2:2 C3:8>', gain: 0.35, reverb: 0.35 }],
    [
      { inst: 'trumpet', notes: '.:16 | .:16 | .:8 G5+Ab5:4> .:4 | .:8 C5+G5+C6:8>', gain: 0.35, reverb: 0.35 },
      { inst: 'cymbal', notes: '.:16 | .:16 | .:16 | .:8 C4:8>', gain: 0.5, reverb: 0.3 },
    ],
  ],
};

/** Victory: a fanfare in C, about 7 s, glock sparkle, a snare roll, then the full major chord and a crash. */
export const victoryStinger: Song = {
  id: 'victory',
  bpm: 136,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 4,
  once: true,
  layers: [
    [{ inst: 'tuba', notes: 'C2:4> G2:4 C2:4 E2:4 | F2:4> C2:4 C2:4> G2:4 | D2:4> F2:4 G2:4> G2:4 | C2:4> .:12', gain: 0.85, reverb: 0.15 }],
    [
      {
        inst: 'trumpet',
        notes: 'G4:2 C5:2 E5:2 G5:2 E5:3 G5:1 C6:4> | A5:3 G5:1 F5:2 A5:2 G5:4> E5:4 | F5:2 A5:2 G5:2 F5:2 E5:2 D5:2 B4:2 D5:2 | C6:16>',
        gain: 1.1,
        reverb: 0.35,
      },
    ],
    [
      { inst: 'glock', notes: 'C6:2 E6:2 G6:2 C7:2 .:8 | .:8 E6:2 G6:2 C7:4 | .:16 | E6:2 G6:2 C7:2 E7:2 G7:8', gain: 0.8, reverb: 0.45 },
      { inst: 'snare', notes: '.:16 | .:16 | (C4:1)x15 C4:1> | C4:4> .:12', gain: 0.4, reverb: 0.2 },
    ],
    [
      {
        inst: 'brass',
        notes: 'C4+E4+G4:4> .:12 | F4+A4+C5:4> .:4 E4+G4+C5:4> .:4 | F4+A4+D5:4> .:4 D4+G4+B4:4> .:4 | C4+E4+G4+C5:16>',
        gain: 0.4,
        reverb: 0.35,
      },
      { inst: 'timpani', notes: 'C3:4> .:12 | F2:4> .:4 C3:4> .:4 | D3:4> .:4 G2:4> G2:2 G2:2 | C3:4> .:12', gain: 0.6, reverb: 0.3 },
      { inst: 'cymbal', notes: '.:16 | .:16 | .:16 | C4:16>', gain: 0.55, reverb: 0.35 },
    ],
  ],
};

/** Defeat: the sad trombone, "wah, wah, wah, waaah", sliding down B♭–A–A♭ to a long G (4 s in 3/4). */
export const defeatStinger: Song = {
  id: 'defeat',
  bpm: 90,
  beatsPerBar: 3,
  stepsPerBeat: 4,
  bars: 2,
  once: true,
  layers: [
    [{ inst: 'tuba', notes: 'Bb2:4 A2:4 Ab2:4 | G2:12', gain: 0.6, reverb: 0.2 }],
    [{ inst: 'wahbone', notes: 'Bb3:4> A3:4 Ab3:4 | G3:12>', gain: 1.1, reverb: 0.3 }],
    [{ inst: 'pizz', notes: '.:12 | .:8 D4:2 G3:2', gain: 0.7, reverb: 0.2 }],
    [{ inst: 'timpani', notes: '.:12 | G2:4 .:8', gain: 0.35, reverb: 0.3 }],
  ],
};

/** Stars: chimes that climb one note further for each star (E6; E6–G6; E6–G6–C7), a second each. */
function starStinger(id: string, glock: string, celesta: string, shaker: string, under: string): Song {
  return {
    id,
    bpm: 120,
    beatsPerBar: 2,
    stepsPerBeat: 4,
    bars: 1,
    once: true,
    layers: [
      [{ inst: 'celesta', notes: under, gain: 0.5, reverb: 0.45 }],
      [{ inst: 'glock', notes: glock, gain: 1, reverb: 0.5 }],
      [{ inst: 'celesta', notes: celesta, gain: 0.7, reverb: 0.5 }],
      [{ inst: 'shaker', notes: shaker, gain: 0.5, reverb: 0.3 }],
    ],
  };
}

export const star1Stinger = starStinger('star1', 'E6:8>', 'G5:8', 'C4:1 .:7', 'C5+E5:8');
export const star2Stinger = starStinger('star2', 'E6:2 G6:6>', '.:2 B5:6', 'C4:1 .:1 C4:1 .:5', 'C5+E5:8');
export const star3Stinger = starStinger('star3', 'E6:2 G6:2 C7:4>', '.:4 E6:4', 'C4:1 .:1 C4:1 .:1 C4:1 .:3', 'C5+E5+G5:8');

export const STINGER_SONGS: Record<string, Song> = {
  wave: waveStinger,
  bossArrive: bossArriveStinger,
  victory: victoryStinger,
  defeat: defeatStinger,
  star1: star1Stinger,
  star2: star2Stinger,
  star3: star3Stinger,
};
