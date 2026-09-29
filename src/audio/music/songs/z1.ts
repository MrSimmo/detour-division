// Zone 1 theme: "Buttercup Downs" (DESIGN.md §17.2). G major, 6/8, 104 bpm (dotted crotchets),
// quaver steps. A fife-and-drum jig: the fife tune in AABA (32 bars), a reed "accordion" answering
// in the fife's held notes, pizzicato bass and off-beat chords, and trumpet calls at the cadences.
//   A  | G | G | C | D  | G | Em | Am D | G |
//   A' | G | G | C | Am | G | C  | D    | G |
//   B  | Em | Em | C | G | Am | D | G  | D |
//   A  (as the first strain)
// Boss cue: the same jig motif in E minor (the relative minor), 116 bpm, on brass with hits and timpani.
//   | Em | Em | C | B7 | Em | C | Am B7 | Em || Am | Em | C | B7 | Em | D | C B7 | Em |
import type { Song } from '../sequencer.ts';

type Bar = string | [string, string];

interface Chord {
  root: string;
  fifth: string;
  /** Off-beat chord for the pizzicato "pah-pah". */
  triad: string;
  /** Two-note brass voicing. */
  pair: string;
  timp: string;
  /** Strings ostinato: root, fifth, octave. */
  ost: [string, string, string];
}

const C: Record<string, Chord> = {
  G: { root: 'G2', fifth: 'D3', triad: 'B3+D4+G4', pair: 'B3+D4', timp: 'G2', ost: ['G3', 'D4', 'G4'] },
  C: { root: 'C3', fifth: 'G2', triad: 'C4+E4+G4', pair: 'C4+E4', timp: 'C3', ost: ['C3', 'G3', 'C4'] },
  D: { root: 'D3', fifth: 'A2', triad: 'A3+D4+F#4', pair: 'D4+F#4', timp: 'D3', ost: ['D3', 'A3', 'D4'] },
  Em: { root: 'E2', fifth: 'B2', triad: 'B3+E4+G4', pair: 'B3+E4', timp: 'E3', ost: ['E3', 'B3', 'E4'] },
  Am: { root: 'A2', fifth: 'E3', triad: 'A3+C4+E4', pair: 'A3+C4', timp: 'A2', ost: ['A2', 'E3', 'A3'] },
  B7: { root: 'B2', fifth: 'F#2', triad: 'A3+D#4+F#4', pair: 'D#4+F#4', timp: 'B2', ost: ['B2', 'F#3', 'B3'] },
};

const bars = (xs: string[]): string => xs.join(' | ');
const ch = (n: string): Chord => C[n]!;
/** One pattern per bar: `one` for a whole-bar chord, `two` for a bar split into two dotted crotchets. */
const perBar = (h: Bar[], one: (c: Chord) => string, two: (a: Chord, b: Chord) => string): string =>
  bars(h.map((b) => (typeof b === 'string' ? one(ch(b)) : two(ch(b[0]), ch(b[1])))));

// ---------------------------------------------------------------- the zone theme

const HARMONY: Bar[] = [
  'G', 'G', 'C', 'D', 'G', 'Em', ['Am', 'D'], 'G',
  'G', 'G', 'C', 'Am', 'G', 'C', 'D', 'G',
  'Em', 'Em', 'C', 'G', 'Am', 'D', 'G', 'D',
  'G', 'G', 'C', 'D', 'G', 'Em', ['Am', 'D'], 'G',
];

const tuneA = [
  'G5:2 B5:1 D6:2 B5:1', 'C6:1 B5:1 A5:1 G5:2 D5:1', 'E5:2 G5:1 C6:2 E6:1', 'D6:2 C6:1 A5:3',
  'B5:2 A5:1 G5:1 A5:1 B5:1', 'E6:2 D6:1 B5:3', 'A5:1 B5:1 C6:1 D6:1 C6:1 A5:1', 'G5:3> .:2 D5:1',
];
const tuneA2 = [
  'G5:2 B5:1 D6:2 G6:1', 'F#6:1 E6:1 D6:1 B5:2 G5:1', 'E6:2 D6:1 C6:2 E6:1', 'A5:2 B5:1 C6:3',
  'B5:2 D6:1 G5:2 B5:1', 'C6:1 B5:1 A5:1 E6:3', 'D6:1 E6:1 F#6:1 A6:1 F#6:1 D6:1', 'G6:3> .:3',
];
const tuneB = [
  'B5:3 E6:2 D6:1', 'B5:2 G5:1 E5:3', 'G5:3 C6:2 B5:1', 'B5:2 A5:1 G5:3',
  'A5:2 C6:1 E6:2 C6:1', 'D6:2 C6:1 A5:2 F#5:1', 'G5:2 B5:1 D6:2 B5:1', 'A5:3 .:2 D5:1',
];

// The accordion moves where the fife holds, and holds where the fife runs.
const counterA = [
  'B4:3 D5:3', 'D5:3 B4:3', 'C5:3 E5:3', 'F#5:1 E5:1 D5:1 C5:1 D5:1 F#5:1',
  'D5:3 G4:3', 'G4:1 A4:1 B4:1 E5:1 D5:1 B4:1', 'C5:3 A4:3', 'B4:1 D5:1 G5:1 D5:1 B4:1 .:1',
];
const counterA2 = [
  'B4:3 D5:3', 'A4:3 B4:3', 'G4:3 C5:3', 'E5:1 D5:1 C5:1 E5:3',
  'D5:3 B4:3', 'E5:3 G5:3', 'F#5:3 A5:3', 'B4:1 D5:1 G5:1 B5:1 G5:1 D5:1',
];
const counterB = [
  'G4:3 B4:3', 'E5:1 F#5:1 G5:1 B4:3', 'E5:3 G5:3', 'D5:3 B4:1 A4:1 G4:1',
  'C5:3 E5:3', 'F#5:3 D5:3', 'D5:3 G5:3', 'F#5:1 G5:1 A5:1 F#5:1 E5:1 D5:1',
];

// Trumpet calls answer the fife at each cadence bar, in the second half of the bar.
const CALLS: Record<number, string> = {
  4: 'D5:1> F#5:1 A5:1', 8: 'D5:1> G5:1 B5:1', 12: 'E5:1> A5:1 E5:1', 16: 'G5:1> B5:1 D6:1',
  20: 'B4:1> D5:1 G5:1', 24: 'A4:1> D5:1 F#5:1', 28: 'D5:1> F#5:1 A5:1', 32: 'D5:1> G5:1 B5:1',
};
const calls = bars(HARMONY.map((_, i) => (CALLS[i + 1] ? `.:3 ${CALLS[i + 1]}` : '.:6')));

export const z1: Song = {
  id: 'z1',
  bpm: 104,
  beatsPerBar: 2,
  stepsPerBeat: 3,
  bars: 32,
  layers: [
    [
      { inst: 'pizz', notes: perBar(HARMONY, (c) => `${c.root}:2 .:1 ${c.fifth}:2 .:1`, (a, b) => `${a.root}:2 .:1 ${b.root}:2 .:1`), gain: 0.75, reverb: 0.15 },
      { inst: 'snare', notes: 'C4:1 .:2 C4:1 .:2', gain: 0.25, reverb: 0.1 },
    ],
    [{ inst: 'fife', notes: bars([...tuneA, ...tuneA2, ...tuneB, ...tuneA]), gain: 1.1, reverb: 0.3 }],
    [
      { inst: 'reed', notes: bars([...counterA, ...counterA2, ...counterB, ...counterA]), gain: 0.5, reverb: 0.25 },
      { inst: 'pizz', notes: perBar(HARMONY, (c) => `.:1 ${c.triad}:1 ${c.triad}:1 .:1 ${c.triad}:1 ${c.triad}:1`, (a, b) => `.:1 ${a.triad}:1 ${a.triad}:1 .:1 ${b.triad}:1 ${b.triad}:1`), gain: 0.35, reverb: 0.2 },
      { inst: 'snare', notes: 'C4:1> C4:1 C4:1 C4:1> .:1 C4:1', gain: 0.4, reverb: 0.12 },
      { inst: 'kick', notes: 'C2:3> C2:3', gain: 0.5, reverb: 0 },
    ],
    [
      { inst: 'trumpet', notes: calls, gain: 0.6, reverb: 0.3 },
      { inst: 'horn', notes: perBar(HARMONY, (c) => `${c.pair}:3> ${c.pair}:3`, (a, b) => `${a.pair}:3> ${b.pair}:3`), gain: 0.4, reverb: 0.25 },
      { inst: 'timpani', notes: perBar(HARMONY, (c) => `${c.timp}:3> .:3`, (a, b) => `${a.timp}:3> ${b.timp}:3`), gain: 0.7, reverb: 0.3 },
      { inst: 'cymbal', notes: bars(['C4:1> .:5', '.:6', '.:6', '.:6', '.:6', '.:6', '.:6', '.:6']), gain: 0.45, reverb: 0.3 },
    ],
  ],
};

// ---------------------------------------------------------------- the boss cue

const BOSS: Bar[] = [
  'Em', 'Em', 'C', 'B7', 'Em', 'C', ['Am', 'B7'], 'Em',
  'Am', 'Em', 'C', 'B7', 'Em', 'D', ['C', 'B7'], 'Em',
];

// The jig's opening arpeggio and its run down, now in E minor and on brass.
const bossTune = [
  'E4:2 G4:1 B4:2 G4:1', 'A4:1 G4:1 F#4:1 E4:2 B3:1', 'C4:2 E4:1 G4:2 C5:1', 'B4:2 A4:1 F#4:3',
  'G4:2 F#4:1 E4:1 F#4:1 G4:1', 'C5:2 B4:1 G4:3', 'A4:1 B4:1 C5:1 B4:1 A4:1 F#4:1', 'E4:3> .:3',
  'A4:2 C5:1 E5:2 C5:1', 'B4:2 G4:1 E4:3', 'G4:2 C5:1 E5:2 D5:1', 'D#5:3> B4:3',
  'E5:2 D5:1 B4:2 G4:1', 'F#4:2 A4:1 D5:3', 'C5:1 B4:1 A4:1 B4:1 A4:1 D#4:1', 'E4:3> .:3',
];

export const bossZ1: Song = {
  id: 'boss.z1',
  bpm: 116,
  beatsPerBar: 2,
  stepsPerBeat: 3,
  bars: 16,
  layers: [
    [
      { inst: 'tuba', notes: perBar(BOSS, (c) => `${c.root}:2> .:1 ${c.fifth}:2 .:1`, (a, b) => `${a.root}:2> .:1 ${b.root}:2 .:1`), gain: 1, reverb: 0.1 },
      { inst: 'snare', notes: 'C4:1 .:2 C4:1 .:2', gain: 0.3, reverb: 0.1 },
    ],
    [
      { inst: 'brass', notes: bars(bossTune), gain: 1.1, reverb: 0.25 },
      // The zone's fife, an octave up, keeps it recognisably Buttercup Downs.
      { inst: 'fife', notes: bars(bossTune), transpose: 12, gain: 0.45, reverb: 0.3 },
    ],
    [
      { inst: 'strings', notes: perBar(BOSS, (c) => `${c.ost[0]}:1 ${c.ost[1]}:1 ${c.ost[2]}:1 ${c.ost[0]}:1 ${c.ost[1]}:1 ${c.ost[2]}:1`, (a, b) => `${a.ost[0]}:1 ${a.ost[1]}:1 ${a.ost[2]}:1 ${b.ost[0]}:1 ${b.ost[1]}:1 ${b.ost[2]}:1`), gain: 0.55, reverb: 0.25 },
      { inst: 'snare', notes: 'C4:1> C4:1 C4:1 C4:1> C4:1 C4:1', gain: 0.4, reverb: 0.12 },
      { inst: 'kick', notes: 'C2:3> C2:3>', gain: 0.6, reverb: 0 },
    ],
    [
      { inst: 'trumpet', notes: perBar(BOSS, (c) => `${c.triad}:1> .:2 ${c.triad}:1> .:2`, (a, b) => `${a.triad}:1> .:2 ${b.triad}:1> .:2`), gain: 0.33, transpose: 12, reverb: 0.3 },
      { inst: 'timpani', notes: perBar(BOSS, (c) => `${c.timp}:2> ${c.timp}:1 ${c.timp}:3>`, (a, b) => `${a.timp}:2> ${a.timp}:1 ${b.timp}:3>`), gain: 0.6, reverb: 0.3 },
      { inst: 'cymbal', notes: bars(['C4:1> .:5', '.:6', '.:6', '.:6']), gain: 0.45, reverb: 0.3 },
    ],
  ],
};
