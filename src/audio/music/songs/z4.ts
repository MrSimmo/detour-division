// Zone 4 theme: "Grimebottom Works" (DESIGN.md §17.2). F minor, 4/4, 120 bpm, semiquaver steps.
// Clockwork: a staccato bassoon bass under tick-tock woodblocks and a winding ratchet. The melody is
// call and response: a muted horn calls for two bars, and the factory whistle answers for two.
// Harmony: | Fm | Fm | Db | C7 | Fm | Bbm | C7 | Fm || Ab | Eb | Fm | Db | Bbm | Fm | Db | C7 |
//
// Boss cue: the horn call made menacing, 132 bpm. The Neapolitan G♭ darkens F minor, and the
// whistle's answer shrieks onto a flat ninth. Harmony: | Fm | Gb | Fm | C7 | Db | Gb | C7 | C7 |
import type { Song } from '../sequencer.ts';

type Chord = 'Fm' | 'Db' | 'C7' | 'Bbm' | 'Ab' | 'Eb' | 'Gb';

const CHORDS: Chord[] = ['Fm', 'Fm', 'Db', 'C7', 'Fm', 'Bbm', 'C7', 'Fm', 'Ab', 'Eb', 'Fm', 'Db', 'Bbm', 'Fm', 'Db', 'C7'];
const BOSS_CHORDS: Chord[] = ['Fm', 'Gb', 'Fm', 'C7', 'Db', 'Gb', 'C7', 'C7'];

/** Staccato bassoon: root, fifth, root, then third and fifth, one quaver each. */
const BASS: Record<Chord, string> = {
  Fm: 'F2:2 .:2 C3:2 .:2 F2:2 .:2 Ab2:2 C3:2',
  Db: 'Db2:2 .:2 Ab2:2 .:2 Db2:2 .:2 F2:2 Ab2:2',
  C7: 'C2:2 .:2 G2:2 .:2 C2:2 .:2 E2:2 Bb2:2',
  Bbm: 'Bb1:2 .:2 F2:2 .:2 Bb1:2 .:2 Db2:2 F2:2',
  Ab: 'Ab2:2 .:2 Eb3:2 .:2 Ab2:2 .:2 C3:2 Eb3:2',
  Eb: 'Eb2:2 .:2 Bb2:2 .:2 Eb2:2 .:2 G2:2 Bb2:2',
  Gb: 'Gb2:2 .:2 Db3:2 .:2 Gb2:2 .:2 Bb2:2 Db3:2',
};

/** The boss cue drives the bass in repeated quavers. */
const DRIVE: Record<Chord, string> = {
  Fm: 'F2:2 F2:2 C3:2 F2:2 F2:2 F2:2 Ab2:2 C3:2',
  Db: 'Db2:2 Db2:2 Ab2:2 Db2:2 Db2:2 Db2:2 F2:2 Ab2:2',
  C7: 'C2:2 C2:2 G2:2 C2:2 C2:2 C2:2 E2:2 Bb2:2',
  Bbm: 'Bb1:2 Bb1:2 F2:2 Bb1:2 Bb1:2 Bb1:2 Db2:2 F2:2',
  Ab: 'Ab2:2 Ab2:2 Eb3:2 Ab2:2 Ab2:2 Ab2:2 C3:2 Eb3:2',
  Eb: 'Eb2:2 Eb2:2 Bb2:2 Eb2:2 Eb2:2 Eb2:2 G2:2 Bb2:2',
  Gb: 'Gb2:2 Gb2:2 Db3:2 Gb2:2 Gb2:2 Gb2:2 Bb2:2 Db3:2',
};

/** Pizzicato clockwork: a quaver arpeggio winding up and back through the chord. */
const COGS: Record<Chord, string> = {
  Fm: 'F4:2 Ab4:2 C5:2 Ab4:2 F5:2 C5:2 Ab4:2 C5:2',
  Db: 'F4:2 Ab4:2 Db5:2 Ab4:2 F5:2 Db5:2 Ab4:2 Db5:2',
  C7: 'E4:2 G4:2 C5:2 G4:2 Bb4:2 G4:2 E4:2 G4:2',
  Bbm: 'F4:2 Bb4:2 Db5:2 Bb4:2 F5:2 Db5:2 Bb4:2 Db5:2',
  Ab: 'Eb4:2 Ab4:2 C5:2 Ab4:2 Eb5:2 C5:2 Ab4:2 C5:2',
  Eb: 'Eb4:2 G4:2 Bb4:2 G4:2 Eb5:2 Bb4:2 G4:2 Bb4:2',
  Gb: 'Gb4:2 Bb4:2 Db5:2 Bb4:2 Gb5:2 Db5:2 Bb4:2 Db5:2',
};

/** Muted-brass (trombone) voicings for the hits. */
const HIT: Record<Chord, string> = {
  Fm: 'F3+Ab3+C4', Db: 'F3+Ab3+Db4', C7: 'E3+G3+Bb3', Bbm: 'F3+Bb3+Db4', Ab: 'Eb3+Ab3+C4', Eb: 'Eb3+G3+Bb3', Gb: 'Gb3+Bb3+Db4',
};
const HIGH: Record<Chord, string> = { Fm: 'C5+F5', Db: 'Db5+F5', C7: 'E5+Bb5', Bbm: 'Db5+F5', Ab: 'C5+Eb5', Eb: 'Bb4+Eb5', Gb: 'Db5+Gb5' };

/** Timpani: root, then fifth. */
const TIMP: Record<Chord, [string, string]> = {
  Fm: ['F2', 'C3'], Db: ['Db3', 'Ab2'], C7: ['C3', 'G2'], Bbm: ['Bb2', 'F2'], Ab: ['Ab2', 'Eb3'], Eb: ['Eb3', 'Bb2'], Gb: ['Gb2', 'Db3'],
};

const bars = (list: string[]): string => list.join(' | ');
const REST = '.:16';

// ---- The theme ----

const bass = bars(CHORDS.map((c, i) => (i === 7 ? 'F2:4 C2:4 F2:8' : i === 15 ? 'C2:2 .:2 G2:2 .:2 C2:2 E2:2 G2:2 Bb2:2' : BASS[c])));

// The horn calls (bars 1–2, 5–6, 9–11, 13–14); the whistle answers (bars 3–4, 7–8, 12, 15–16).
const horn = bars([
  'C4:2 F4:2 Ab4:2 G4:1 F4:1 C5:4> Ab4:4', 'G4:2 F4:2 E4:2 F4:2 G4:6 .:2', REST, REST,
  'C4:2 F4:2 Ab4:2 G4:1 F4:1 C5:4> Bb4:4', 'Bb4:4 Ab4:2 F4:2 Db4:4 F4:4', REST, REST,
  'Eb4:4 Ab4:4 C5:6> Bb4:2', 'Bb4:4 G4:4 Eb4:8', 'F4:4 Ab4:4 C5:4> Ab4:2 F4:2', REST,
  'Bb3:2 Db4:2 F4:2 Bb4:2 Ab4:4> F4:4', 'Ab4:4 G4:2 F4:2 C4:8', REST, REST,
]);

const whistle = bars([
  REST, REST, 'Ab5:2 Db6:6> C6:4 Ab5:4', 'G5:2 Bb5:2 E6:4> C6:8',
  REST, REST, 'G5:2 C6:6> Bb5:4 G5:4', 'Ab5:4 G5:2 E5:2 F5:8',
  REST, REST, REST, 'F5:2 Ab5:2 Db6:4> C6:2 Ab5:2 F5:4',
  REST, REST, 'Ab5:2 Db6:6> F6:4 Db6:4', 'E6:4> C6:4 G5:4 E5:4',
]);

// Celesta chimes answer in the melody's held notes.
const chimes = bars([
  REST, '.:10 C6:2 Ab5:2 F5:2', REST, '.:8 G6:2 E6:2 C6:4',
  REST, REST, REST, '.:8 C6:2 Ab5:2 F5:4',
  REST, '.:8 G6:2 Eb6:2 Bb5:4', REST, REST,
  REST, '.:8 Ab5:2 G5:2 F5:4', REST, REST,
]);

const cogs = bars(CHORDS.map((c) => COGS[c]));
const hits = bars(CHORDS.map((c) => `${HIT[c]}:2> .:4 ${HIT[c]}:2 .:8`));
const timps = bars(CHORDS.map((c) => `${TIMP[c][0]}:8> ${TIMP[c][1]}:8`));

export const z4: Song = {
  id: 'z4',
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 16,
  layers: [
    [
      { inst: 'bassoon', notes: bass, gain: 1.35, reverb: 0.15 },
      { inst: 'click', notes: 'C6:1 .:3 G5:1 .:3 C6:1 .:3 G5:1 .:3', gain: 0.35, reverb: 0.2 },
      { inst: 'ratchet', notes: `${REST} | ${REST} | ${REST} | .:12 C4:4`, gain: 0.35, reverb: 0.25 },
    ],
    [
      { inst: 'horn', notes: horn, gain: 1.25, reverb: 0.25 },
      { inst: 'whistle', notes: whistle, gain: 1.05, reverb: 0.35 },
    ],
    [
      { inst: 'pizz', notes: cogs, gain: 0.8, reverb: 0.2 },
      { inst: 'celesta', notes: chimes, gain: 0.9, reverb: 0.4 },
      { inst: 'kick', notes: 'C2:4> .:4 C2:4 .:2 C2:2', gain: 0.6, reverb: 0 },
      { inst: 'snare', notes: '.:4 C4:4> .:4 C4:3 C4:1', gain: 0.45, reverb: 0.15 },
      { inst: 'anvil', notes: '.:4 A5:4> .:8 | .:4 A5:4> .:6 A5:2', gain: 0.5, reverb: 0.3 },
    ],
    [
      { inst: 'trombone', notes: hits, gain: 0.4, reverb: 0.25 },
      { inst: 'timpani', notes: timps, gain: 0.7, reverb: 0.3 },
      { inst: 'cymbal', notes: `C4:1> .:15 | ${REST} | ${REST} | ${REST}`, gain: 0.5, reverb: 0.3 },
    ],
  ],
};

// ---- The boss cue ----

const bossHorn = bars([
  'C4:2 F4:2 Ab4:2 G4:1 F4:1 C5:4> Ab4:4', 'Bb4:2 Ab4:2 Gb4:2 F4:1 Gb4:1 Db4:6 .:2', 'C4:2 F4:2 Ab4:2 G4:1 F4:1 C5:4> Bb4:4', REST,
  'Ab4:4> F4:4 Db4:8', 'Bb4:4> Gb4:4 Db4:8', REST, REST,
]);
const bossWhistle = bars([REST, REST, REST, 'E6:4> C6:4 G5:4 E5:4', REST, REST, 'G5:2 C6:6> Bb5:4 G5:4', 'E6:8> Db6:4 C6:4']);
const bossHits = bars(BOSS_CHORDS.map((c) => `${HIT[c]}:2> .:2 ${HIT[c]}:2> .:4 ${HIT[c]}:2> .:4`));
const bossStabs = bars(BOSS_CHORDS.map((c) => `${HIGH[c]}:2> .:2 ${HIGH[c]}:2> .:4 ${HIGH[c]}:2> .:4`));
const bossTimps = bars(BOSS_CHORDS.map((c) => {
  const [r, f] = TIMP[c];
  return `${r}:2> ${r}:2 ${f}:2 ${r}:2 ${r}:2> ${r}:2 ${f}:2 ${r}:2`;
}));

export const bossZ4: Song = {
  id: 'boss.z4',
  bpm: 132,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 8,
  layers: [
    [
      { inst: 'bassoon', notes: bars(BOSS_CHORDS.map((c) => DRIVE[c])), gain: 1.2, reverb: 0.15 },
      { inst: 'click', notes: '(C6:1 G5:1 G5:1 G5:1)x4', gain: 0.25, reverb: 0.2 },
      { inst: 'ratchet', notes: `${REST} | .:12 C4:4`, gain: 0.35, reverb: 0.25 },
    ],
    [
      { inst: 'horn', notes: bossHorn, gain: 1.3, reverb: 0.25 },
      { inst: 'whistle', notes: bossWhistle, gain: 1.05, reverb: 0.35 },
    ],
    [
      { inst: 'pizz', notes: bars(BOSS_CHORDS.map((c) => COGS[c])), gain: 0.75, reverb: 0.2 },
      { inst: 'kick', notes: 'C2:2> .:2 C2:2 .:2 C2:2> .:2 C2:2 .:2', gain: 0.48, reverb: 0 },
      { inst: 'snare', notes: '.:4 C4:4> .:4 C4:2 C4:1 C4:1', gain: 0.45, reverb: 0.15 },
      { inst: 'anvil', notes: 'A5:4> A5:4 A5:4> A5:4', gain: 0.28, reverb: 0.3 },
    ],
    [
      { inst: 'trombone', notes: bossHits, gain: 0.4, reverb: 0.25 },
      { inst: 'trumpet', notes: bossStabs, gain: 0.35, reverb: 0.3 },
      { inst: 'timpani', notes: bossTimps, gain: 0.45, reverb: 0.3 },
      { inst: 'cymbal', notes: `C4:1> .:15 | ${REST}`, gain: 0.5, reverb: 0.3 },
    ],
  ],
};
