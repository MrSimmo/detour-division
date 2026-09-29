// Zone 2 theme: "Scorchsand Shuffle" (DESIGN.md §17.2). A Dorian, swung 4/4, 96 bpm, quaver steps.
// A spaghetti-western march: a whistled lead with long held notes and wide leaps, a twangy plucked
// bass and picking, a harmonica-like reed answering the whistle, trumpet stabs and clip-clop clicks.
// Dorian colour: the major IV (D, with F#) against the minor i.
//   A | Am | Am | D | Am | G | G | Em   | Am |
//   B | C  | G  | D | Am | C | G | Em D | Am |
// Boss cue: the same leap-and-fall motif darkened to A Aeolian (F natural, with an E7 dominant),
// 108 bpm, on trumpet with trombone hits and timpani.
//   | Am | Am | Dm | Am | F | G | E7 | Am || F | G | Dm | Am | F | G | E7 | Am |
import type { Song } from '../sequencer.ts';

type Bar = string | [string, string];

interface Chord {
  root: string;
  fifth: string;
  /** Picking pattern notes: root, third, fifth, octave. */
  arp: [string, string, string, string];
  stab: string;
  timp: string;
}

const C: Record<string, Chord> = {
  Am: { root: 'A2', fifth: 'E2', arp: ['A3', 'C4', 'E4', 'A4'], stab: 'C5+E5', timp: 'A2' },
  D: { root: 'D3', fifth: 'A2', arp: ['D3', 'A3', 'D4', 'F#4'], stab: 'D5+F#5', timp: 'D3' },
  G: { root: 'G2', fifth: 'D3', arp: ['G3', 'B3', 'D4', 'G4'], stab: 'B4+D5', timp: 'G2' },
  Em: { root: 'E2', fifth: 'B2', arp: ['E3', 'G3', 'B3', 'E4'], stab: 'B4+E5', timp: 'E3' },
  C: { root: 'C3', fifth: 'G2', arp: ['C3', 'G3', 'C4', 'E4'], stab: 'E5+G5', timp: 'C3' },
  // Boss (A Aeolian) chords
  Dm: { root: 'D3', fifth: 'A2', arp: ['D3', 'A3', 'D4', 'F4'], stab: 'A3+D4+F4', timp: 'D3' },
  F: { root: 'F2', fifth: 'C3', arp: ['F3', 'A3', 'C4', 'F4'], stab: 'A3+C4+F4', timp: 'F2' },
  E7: { root: 'E2', fifth: 'B2', arp: ['E3', 'G#3', 'B3', 'D4'], stab: 'G#3+D4+E4', timp: 'E3' },
};
// Trombone hit voicings for the boss cue.
const HIT: Record<string, string> = { Am: 'A3+C4+E4', Dm: 'A3+D4+F4', F: 'A3+C4+F4', G: 'B3+D4+G4', E7: 'G#3+D4+E4' };

const bars = (xs: string[]): string => xs.join(' | ');
const ch = (n: string): Chord => C[n]!;
const last = (b: Bar): string => (typeof b === 'string' ? b : b[1]);
/** One pattern per bar: `one` for a whole-bar chord, `two` for a bar split at beat 3. */
const perBar = (h: Bar[], one: (c: Chord, name: string) => string, two: (a: Chord, b: Chord) => string): string =>
  bars(h.map((b) => (typeof b === 'string' ? one(ch(b), b) : two(ch(b[0]), ch(b[1])))));

const bass = (h: Bar[]): string => perBar(h, (c) => `${c.root}:2 .:1 ${c.root}:1 ${c.fifth}:2 .:1 ${c.fifth}:1`, (a, b) => `${a.root}:2 .:1 ${a.root}:1 ${b.root}:2 .:1 ${b.root}:1`);
const CLICKS = 'C6:1> G5:1 .:1 G5:1 C6:1> G5:1 .:1 G5:1';

// ---------------------------------------------------------------- the zone theme

const HARMONY: Bar[] = ['Am', 'Am', 'D', 'Am', 'G', 'G', 'Em', 'Am', 'C', 'G', 'D', 'Am', 'C', 'G', ['Em', 'D'], 'Am'];

const whistleTune = [
  'A5:4> E6:4', 'D6:1 C6:1 B5:1 A5:1 E5:4', 'F#5:2 A5:2 D6:3 C6:1', 'B5:1 A5:1 G5:1 A5:5',
  'G5:2 B5:2 D6:4', 'E6:1 D6:1 B5:1 G5:1 A5:4', 'B5:3 G5:1 E5:4', 'A5:6> .:2',
  'C6:2 E6:2 G6:4', 'F#6:1 E6:1 D6:1 B5:1 G5:4', 'A5:2 D6:2 F#6:3 E6:1', 'E6:4 C6:2 A5:2',
  'G5:2 C6:2 E6:4', 'D6:1 E6:1 D6:1 B5:1 G5:4', 'E5:2 G5:2 F#5:2 A5:2', 'A5:8>',
];

// The "harmonica" answers while the whistle holds its long notes.
const harmonica = [
  '.:4 E5:1 D5:1 C5:1 A4:1', 'C5:4 .:1 E4:1 G4:1 A4:1', 'A4:4 F#4:2 A4:2', '.:3 E5:1 C5:2 A4:2',
  'B4:4 .:1 D5:1 E5:1 D5:1', 'B4:4 A4:1 B4:1 D5:2', 'G4:4 .:1 B4:1 E5:1 G5:1', 'E5:2 D5:1 C5:1 A4:4',
  'E4:4 G4:4', '.:4 B4:1 D5:1 G5:2', 'F#4:4 A4:4', 'C5:4 .:1 A4:1 C5:1 E5:1',
  '.:4 G4:1 C5:1 E5:2', 'B4:4 .:1 G4:1 B4:1 D5:1', 'B4:2 E5:2 A4:2 D5:2', 'E5:2 C5:2 A4:4',
];

const picking = perBar(
  HARMONY,
  (c) => { const [r, t, f, o] = c.arp; return `${r}:1 ${t}:1 ${f}:1 ${o}:1 ${f}:1 ${t}:1 ${f}:1 ${t}:1`; },
  (a, b) => `${a.arp[0]}:1 ${a.arp[1]}:1 ${a.arp[2]}:1 ${a.arp[1]}:1 ${b.arp[0]}:1 ${b.arp[1]}:1 ${b.arp[2]}:1 ${b.arp[1]}:1`,
);

export const z2: Song = {
  id: 'z2',
  bpm: 96,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  swing: 0.3,
  bars: 16,
  layers: [
    [
      { inst: 'pluck', notes: bass(HARMONY), gain: 0.65, reverb: 0.15 },
      { inst: 'click', notes: CLICKS, gain: 0.45, reverb: 0.1 },
    ],
    [{ inst: 'whistle', notes: bars(whistleTune), gain: 1.15, reverb: 0.4 }],
    [
      { inst: 'reed', notes: bars(harmonica), gain: 0.5, reverb: 0.3 },
      { inst: 'pluck', notes: picking, gain: 0.6, reverb: 0.25 },
      { inst: 'snare', notes: '.:2 C4:1> .:1 .:2 C4:1> C4:1', gain: 0.4, reverb: 0.15 },
      { inst: 'kick', notes: 'C2:1> .:3 C2:1> .:3', gain: 0.55, reverb: 0 },
    ],
    [
      { inst: 'trumpet', notes: bars(HARMONY.map((b) => `.:5 ${ch(last(b)).stab}:1> .:1 ${ch(last(b)).stab}:1>`)), gain: 0.5, reverb: 0.35 },
      { inst: 'timpani', notes: perBar(HARMONY, (c) => `${c.timp}:2> .:2 ${c.timp}:2 .:2`, (a, b) => `${a.timp}:2> .:2 ${b.timp}:2 .:2`), gain: 0.7, reverb: 0.3 },
      { inst: 'cymbal', notes: bars(['C4:1> .:7', '.:8', '.:8', '.:8']), gain: 0.45, reverb: 0.3 },
    ],
  ],
};

// ---------------------------------------------------------------- the boss cue

const BOSS: Bar[] = ['Am', 'Am', 'Dm', 'Am', 'F', 'G', 'E7', 'Am', 'F', 'G', 'Dm', 'Am', 'F', 'G', 'E7', 'Am'];

// The whistle's leap and fall, darkened: F natural for F#, G# leading back to A.
const bossTune = [
  'A4:4> E5:4', 'D5:1 C5:1 B4:1 A4:1 E4:4', 'F4:2 A4:2 D5:3 C5:1', 'B4:1 A4:1 G#4:1 A4:5',
  'C5:2 F5:2 A5:4', 'G5:1 F5:1 D5:1 B4:1 G4:4', 'G#4:2 B4:2 E5:4', 'A4:6> .:2',
  'C5:2 F5:2 A5:4', 'B5:1 A5:1 G5:1 D5:1 B4:4', 'D5:2 F5:2 A5:3 G5:1', 'E5:4 C5:2 A4:2',
  'F5:2 A5:2 C6:4', 'B5:1 C6:1 B5:1 G5:1 D5:4', 'E5:2 G#5:2 B5:2 D6:2', 'A5:8>',
];

export const bossZ2: Song = {
  id: 'boss.z2',
  bpm: 108,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  swing: 0.15,
  bars: 16,
  layers: [
    [
      { inst: 'pluck', notes: bass(BOSS), gain: 0.65, reverb: 0.12 },
      { inst: 'click', notes: CLICKS, gain: 0.45, reverb: 0.1 },
    ],
    [
      { inst: 'trumpet', notes: bars(bossTune), gain: 1.1, reverb: 0.35 },
      // The zone's whistle, an octave up and quiet, keeps it recognisably Scorchsand.
      { inst: 'whistle', notes: bars(bossTune), transpose: 12, gain: 0.35, reverb: 0.4 },
    ],
    [
      { inst: 'strings', notes: perBar(BOSS, (c) => { const [r, , f] = c.arp; return `${r}:1 ${r}:1 ${r}:1 ${r}:1 ${f}:1 ${f}:1 ${f}:1 ${f}:1`; }, (a, b) => `${a.arp[0]}:1 ${a.arp[0]}:1 ${a.arp[0]}:1 ${a.arp[0]}:1 ${b.arp[0]}:1 ${b.arp[0]}:1 ${b.arp[0]}:1 ${b.arp[0]}:1`), gain: 0.5, reverb: 0.25 },
      { inst: 'snare', notes: '.:2 C4:1> C4:1 .:2 C4:1> C4:1', gain: 0.45, reverb: 0.12 },
      { inst: 'kick', notes: 'C2:1> .:1 C2:1 .:1 C2:1> .:3', gain: 0.6, reverb: 0 },
    ],
    [
      { inst: 'trombone', notes: bars(BOSS.map((b) => { const h = HIT[last(b)]!; return `${h}:1> .:1 ${h}:1> .:3 ${h}:2>`; })), gain: 0.38, reverb: 0.3 },
      { inst: 'timpani', notes: perBar(BOSS, (c) => `${c.timp}:1> ${c.timp}:1 .:2 ${c.timp}:2> .:2`, (a, b) => `${a.timp}:1> ${a.timp}:1 .:2 ${b.timp}:2> .:2`), gain: 0.6, reverb: 0.3 },
      { inst: 'cymbal', notes: bars(['C4:1> .:7', '.:8', '.:8', '.:8']), gain: 0.45, reverb: 0.3 },
    ],
  ],
};
