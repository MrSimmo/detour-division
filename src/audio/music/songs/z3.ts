// Zone 3 theme: "Frostnip Fells" (DESIGN.md §17.2). E minor ↔ G major, 3/4, 132 bpm, quaver steps.
// A waltz-march: a horn melody in AABA (32 bars) that turns from E minor to G major and back, a
// celesta answering in the horn's long notes, pizzicato bass with a sleigh-shaker "pah-pah".
//   A  | Em | Em | Am | B7 | Em | C  | B7 | Em |
//   A' | Em | Em | C  | D  | G  | Em | D  | G  |   (turns to G major)
//   B  | C  | D  | G  | Em | Am | D  | G  | B7 |   (in G, back to E minor through B7)
//   A  (as the first strain)
// Boss cue: the waltz motif in E harmonic minor (the relative minor of the zone's G major),
// 144 bpm, on brass with trumpet hits and timpani.
//   | Em | Em | Am | B7 | Em | C | B7 | Em || Am | Em | C | B7 | Em | Am | B7 | Em |
import type { Song } from '../sequencer.ts';

interface Chord {
  root: string;
  fifth: string;
  /** Pizzicato "pah-pah" chord. */
  triad: string;
  /** Trombone / trumpet voicing. */
  brass: string;
  timp: string;
  /** Strings ostinato: root, fifth, octave. */
  ost: [string, string, string];
}

const C: Record<string, Chord> = {
  Em: { root: 'E2', fifth: 'B2', triad: 'E4+G4+B4', brass: 'G3+B3+E4', timp: 'E3', ost: ['E3', 'B3', 'E4'] },
  Am: { root: 'A2', fifth: 'E3', triad: 'A3+C4+E4', brass: 'A3+C4+E4', timp: 'A2', ost: ['A2', 'E3', 'A3'] },
  B7: { root: 'B2', fifth: 'F#2', triad: 'A3+D#4+F#4', brass: 'A3+D#4+F#4', timp: 'B2', ost: ['B2', 'F#3', 'B3'] },
  C: { root: 'C3', fifth: 'G2', triad: 'C4+E4+G4', brass: 'G3+C4+E4', timp: 'C3', ost: ['C3', 'G3', 'C4'] },
  D: { root: 'D3', fifth: 'A2', triad: 'A3+D4+F#4', brass: 'A3+D4+F#4', timp: 'D3', ost: ['D3', 'A3', 'D4'] },
  G: { root: 'G2', fifth: 'D3', triad: 'B3+D4+G4', brass: 'G3+B3+D4', timp: 'G2', ost: ['G2', 'D3', 'G3'] },
};

const bars = (xs: string[]): string => xs.join(' | ');
const perBar = (h: string[], f: (c: Chord) => string): string => bars(h.map((n) => f(C[n]!)));

// ---------------------------------------------------------------- the zone theme

const A = ['Em', 'Em', 'Am', 'B7', 'Em', 'C', 'B7', 'Em'];
const HARMONY = [...A, 'Em', 'Em', 'C', 'D', 'G', 'Em', 'D', 'G', 'C', 'D', 'G', 'Em', 'Am', 'D', 'G', 'B7', ...A];

const hornA = ['B4:4 E4:2', 'G4:2 F#4:2 E4:2', 'C5:4 A4:2', 'B4:4 F#4:2', 'G4:3 A4:1 B4:2', 'C5:4 G4:2', 'A4:2 F#4:2 D#4:2', 'E4:6>'];
const hornA2 = ['B4:4 E5:2', 'D5:2 B4:2 G4:2', 'G4:2 C5:2 E5:2', 'D5:4 A4:2', 'B4:3 C5:1 D5:2', 'B4:4 G4:2', 'A4:2 B4:2 C5:1 A4:1', 'G4:6>'];
const hornB = ['E5:4 D5:1 C5:1', 'D5:4 A4:2', 'B4:4 G4:2', 'E5:3 D5:1 B4:2', 'C5:4 E5:2', 'D5:2 C5:2 A4:2', 'B4:2 D5:2 G4:2', 'F#4:4 D#4:2'];

// The celesta answers on beats 2 and 3, where the horn holds.
const celA = ['.:2 G5:2 B5:2', 'E6:4 .:2', '.:2 E5:2 A5:2', 'F#5:2 A5:2 B5:2', '.:2 B5:2 E6:2', 'G6:4 E6:2', 'D#6:2 F#6:2 A6:2', 'G6:2 E6:2 B5:2'];
const celA2 = ['.:2 G5:2 B5:2', 'G5:4 .:2', '.:2 C6:2 E6:2', 'F#6:4 D6:2', '.:2 D6:2 G6:2', 'E6:4 B5:2', '.:2 F#5:2 A5:2', 'B5:2 D6:2 G6:2'];
const celB = ['C6:2 E6:2 G6:2', 'F#6:4 D6:2', '.:2 D6:2 B5:2', 'G5:4 B5:2', 'A5:2 C6:2 E6:2', 'F#6:2 E6:2 D6:2', '.:2 B5:2 D6:2', 'D#6:2 F#6:2 B6:2'];

const eightBars = (first: string): string => bars([first, '.:6', '.:6', '.:6', '.:6', '.:6', '.:6', '.:6']);

export const z3: Song = {
  id: 'z3',
  bpm: 132,
  beatsPerBar: 3,
  stepsPerBeat: 2,
  bars: 32,
  layers: [
    [
      { inst: 'pizz', notes: perBar(HARMONY, (c) => `${c.root}:2> .:2 ${c.fifth}:2`), gain: 0.7, reverb: 0.2 },
      // The sleigh shaker is the waltz's "pah-pah".
      { inst: 'shaker', notes: '.:2 C4:2 C4:2', gain: 0.4, reverb: 0.2 },
    ],
    [{ inst: 'horn', notes: bars([...hornA, ...hornA2, ...hornB, ...hornA]), gain: 1.15, reverb: 0.35 }],
    [
      { inst: 'celesta', notes: bars([...celA, ...celA2, ...celB, ...celA]), gain: 1.2, reverb: 0.45 },
      { inst: 'pizz', notes: perBar(HARMONY, (c) => `.:2 ${c.triad}:2 ${c.triad}:2`), gain: 0.33, reverb: 0.25 },
      { inst: 'snare', notes: 'C4:2> C4:1 C4:1 C4:2', gain: 0.3, reverb: 0.15 },
      { inst: 'kick', notes: 'C2:2> .:4', gain: 0.55, reverb: 0 },
      { inst: 'shaker', notes: 'C4:1 C4:1 C4:1 C4:1 C4:1 C4:1', gain: 0.25, reverb: 0.2 },
    ],
    [
      { inst: 'trombone', notes: perBar(HARMONY, (c) => `${c.brass}:4> ${c.brass}:2`), gain: 0.4, reverb: 0.3 },
      { inst: 'timpani', notes: perBar(HARMONY, (c) => `${c.timp}:2> .:4`), gain: 0.7, reverb: 0.3 },
      { inst: 'cymbal', notes: eightBars('C4:1> .:5'), gain: 0.4, reverb: 0.35 },
    ],
  ],
};

// ---------------------------------------------------------------- the boss cue

const BOSS = ['Em', 'Em', 'Am', 'B7', 'Em', 'C', 'B7', 'Em', 'Am', 'Em', 'C', 'B7', 'Em', 'Am', 'B7', 'Em'];

// The horn's opening fall (B–E, then G–F#–E), made heavy and driven.
const bossTune = [
  'B4:4> E4:2', 'G4:2 F#4:2 E4:2', 'C5:4> A4:2', 'B4:4 D#4:2', 'G4:2 A4:2 B4:2', 'C5:4> G4:2', 'F#4:2 A4:2 D#5:2', 'E5:4> B4:2',
  'C5:2 B4:2 A4:2', 'B4:2 G4:2 E4:2', 'E5:4> C5:2', 'B4:4 F#4:2', 'G4:2 B4:2 E5:2', 'C5:2 A4:2 E4:2', 'D#4:2 F#4:2 A4:2', 'E4:6>',
];

export const bossZ3: Song = {
  id: 'boss.z3',
  bpm: 144,
  beatsPerBar: 3,
  stepsPerBeat: 2,
  bars: 16,
  layers: [
    [
      { inst: 'tuba', notes: perBar(BOSS, (c) => `${c.root}:2> .:2 ${c.fifth}:2`), gain: 1, reverb: 0.1 },
      { inst: 'shaker', notes: '.:2 C4:2 C4:2', gain: 0.35, reverb: 0.2 },
    ],
    [
      { inst: 'brass', notes: bars(bossTune), gain: 1.1, reverb: 0.3 },
      // The zone's celesta, an octave up, keeps the frost in it.
      { inst: 'celesta', notes: bars(bossTune), transpose: 12, gain: 0.8, reverb: 0.45 },
    ],
    [
      { inst: 'strings', notes: perBar(BOSS, (c) => `${c.ost[0]}:1 ${c.ost[1]}:1 ${c.ost[2]}:1 ${c.ost[1]}:1 ${c.ost[0]}:1 ${c.ost[1]}:1`), gain: 0.55, reverb: 0.25 },
      { inst: 'snare', notes: 'C4:1> C4:1 C4:1 C4:1 C4:1> C4:1', gain: 0.4, reverb: 0.12 },
      { inst: 'kick', notes: 'C2:2> .:2 C2:2', gain: 0.6, reverb: 0 },
    ],
    [
      { inst: 'trumpet', notes: perBar(BOSS, (c) => `${c.brass}:1> .:1 ${c.brass}:1> .:1 ${c.brass}:2>`), transpose: 12, gain: 0.33, reverb: 0.3 },
      { inst: 'timpani', notes: perBar(BOSS, (c) => `${c.timp}:1> ${c.timp}:1 ${c.timp}:2> .:2`), gain: 0.6, reverb: 0.3 },
      { inst: 'cymbal', notes: bars(['C4:1> .:5', '.:6', '.:6', '.:6']), gain: 0.45, reverb: 0.3 },
    ],
  ],
};
