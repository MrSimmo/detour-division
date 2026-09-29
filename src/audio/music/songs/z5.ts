// Zone 5 theme: "Mount Kerblam" (DESIGN.md §17.2). C minor moving to E♭ major, 4/4, 138 bpm,
// semiquaver steps. A tuba and a driving string ostinato underneath; a brooding brass line in
// C minor that turns heroic when the tune climbs into E♭ major; trombones answer in its held
// notes over an "aah" pad; trumpet hits and timpani at the top.
// Harmony: | Cm | Cm | Ab | G | Cm | Fm | G | G7 || Eb | Bb | Cm | Ab | Eb | Bb | Ab | G |
//
// Boss cue: the same opening motif pushed harder, 150 bpm, with the Neapolitan D♭ in place of Fm.
// Harmony: | Cm | Ab | Cm | G | Cm | Db | G | G7 |
import type { Song } from '../sequencer.ts';

type Chord = 'Cm' | 'Ab' | 'G' | 'G7' | 'Fm' | 'Eb' | 'Bb' | 'Db';

const CHORDS: Chord[] = ['Cm', 'Cm', 'Ab', 'G', 'Cm', 'Fm', 'G', 'G7', 'Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb', 'Ab', 'G'];
const BOSS_CHORDS: Chord[] = ['Cm', 'Ab', 'Cm', 'G', 'Cm', 'Db', 'G', 'G7'];

/** String ostinato: quavers rocking between the chord's upper notes and a pedal below. */
const OSTINATO: Record<Chord, string> = {
  Cm: 'C4:2 G3:2 Eb4:2 G3:2 C4:2 G3:2 Eb4:2 G3:2',
  Ab: 'C4:2 Ab3:2 Eb4:2 Ab3:2 C4:2 Ab3:2 Eb4:2 Ab3:2',
  G: 'B3:2 G3:2 D4:2 G3:2 B3:2 G3:2 D4:2 G3:2',
  G7: 'B3:2 G3:2 D4:2 G3:2 F4:2 G3:2 D4:2 G3:2',
  Fm: 'C4:2 F3:2 Ab3:2 F3:2 C4:2 F3:2 Ab3:2 F3:2',
  Eb: 'Bb3:2 G3:2 Eb4:2 G3:2 Bb3:2 G3:2 Eb4:2 G3:2',
  Bb: 'Bb3:2 F3:2 D4:2 F3:2 Bb3:2 F3:2 D4:2 F3:2',
  Db: 'Db4:2 Ab3:2 F4:2 Ab3:2 Db4:2 Ab3:2 F4:2 Ab3:2',
};

const PAD: Record<Chord, string> = {
  Cm: 'C4+Eb4+G4', Ab: 'C4+Eb4+Ab4', G: 'B3+D4+G4', G7: 'B3+D4+F4', Fm: 'C4+F4+Ab4', Eb: 'Eb4+G4+Bb4', Bb: 'D4+F4+Bb4', Db: 'Db4+F4+Ab4',
};

const STAB: Record<Chord, string> = {
  Cm: 'G4+C5+Eb5', Ab: 'Ab4+C5+Eb5', G: 'G4+B4+D5', G7: 'G4+B4+F5', Fm: 'F4+Ab4+C5', Eb: 'G4+Bb4+Eb5', Bb: 'F4+Bb4+D5', Db: 'F4+Ab4+Db5',
};

/** Timpani: root, then fifth. */
const TIMP: Record<Chord, [string, string]> = {
  Cm: ['C3', 'G2'], Ab: ['Ab2', 'Eb3'], G: ['G2', 'D3'], G7: ['G2', 'D3'], Fm: ['F2', 'C3'], Eb: ['Eb3', 'Bb2'], Bb: ['Bb2', 'F2'], Db: ['Db3', 'Ab2'],
};

/** Tuba roots and fifths (and a walking fourth beat at the ends of phrases). */
const TUBA: Record<Chord, string> = {
  Cm: 'C2:4 .:4 G1:4 .:4', Ab: 'Ab1:4 .:4 Eb2:4 .:4', G: 'G1:4 .:4 D2:4 .:4', G7: 'G1:4 .:4 B1:4 D2:4',
  Fm: 'F1:4 .:4 C2:4 .:4', Eb: 'Eb2:4 .:4 Bb1:4 .:4', Bb: 'Bb1:4 .:4 F2:4 .:4', Db: 'Db2:4 .:4 Ab1:4 .:4',
};
const TUBA_DRIVE: Record<Chord, string> = {
  Cm: 'C2:2 C2:2 G1:2 C2:2 C2:2 C2:2 G1:2 C2:2', Ab: 'Ab1:2 Ab1:2 Eb2:2 Ab1:2 Ab1:2 Ab1:2 Eb2:2 Ab1:2',
  G: 'G1:2 G1:2 D2:2 G1:2 G1:2 G1:2 D2:2 G1:2', G7: 'G1:2 G1:2 D2:2 G1:2 B1:2 B1:2 D2:2 F2:2',
  Fm: 'F1:2 F1:2 C2:2 F1:2 F1:2 F1:2 C2:2 F1:2', Eb: 'Eb2:2 Eb2:2 Bb1:2 Eb2:2 Eb2:2 Eb2:2 Bb1:2 Eb2:2',
  Bb: 'Bb1:2 Bb1:2 F2:2 Bb1:2 Bb1:2 Bb1:2 F2:2 Bb1:2', Db: 'Db2:2 Db2:2 Ab1:2 Db2:2 Db2:2 Db2:2 Ab1:2 Db2:2',
};

const bars = (list: string[]): string => list.join(' | ');
const REST = '.:16';

// ---- The theme ----

const tubaLine = bars(CHORDS.map((c, i) => (i === 1 ? 'C2:4 .:4 G1:4 Bb1:4' : i === 13 ? 'Bb1:4 .:4 D2:4 F2:4' : i === 14 ? 'Ab1:4 .:4 C2:4 Eb2:4' : i === 15 ? 'G1:4 .:4 D2:4 B1:4' : TUBA[c])));

const melody = bars([
  // C minor: brooding, the motif rising to E♭ and falling back.
  'G4:4> C5:4 Eb5:6 D5:2', 'C5:4 G4:4 Eb4:8', 'Ab4:4 C5:4 Eb5:4 D5:2 C5:2', 'D5:4 B4:4 G4:8',
  'G4:4> C5:4 Eb5:6 F5:2', 'Ab5:8> G5:4 F5:4', 'Eb5:4 D5:4 B4:4 G4:4', 'D5:4 F5:4 B4:8',
  // E♭ major: the same shape made heroic.
  'Bb4:2 Eb5:2 G5:4> F5:2 Eb5:2 Bb4:4', 'F5:6 D5:2 Bb4:8', 'C5:2 Eb5:2 G5:4> Ab5:2 G5:2 Eb5:4', 'C5:6 Eb5:2 Ab5:8>',
  'G5:4> Bb5:4 G5:4 Eb5:4', 'F5:4 D5:4 Bb4:4 D5:4', 'Eb5:4 C5:4 Ab4:4 C5:4', 'D5:8> B4:4 G4:4',
]);

// Trombones answer in the second half of every even bar, where the melody holds.
const answer = bars([
  REST, '.:8 C4:2 D4:2 Eb4:4', REST, '.:8 D4:2 C4:2 B3:4',
  REST, '.:8 C4:2 Ab3:2 F3:4', REST, '.:8 F3:2 G3:2 B3:4',
  REST, '.:8 F3:2 G3:2 Bb3:4', REST, '.:8 Eb4:2 C4:2 Ab3:4',
  REST, '.:8 D4:4 F4:4', REST, '.:8 B3:2 C4:2 D4:4',
]);

const stabs = bars(CHORDS.map((c) => `${STAB[c]}:2> .:6 ${STAB[c]}:2> .:2 ${STAB[c]}:2 .:2`));
const timps = bars(CHORDS.map((c) => `${TIMP[c][0]}:4> .:4 ${TIMP[c][1]}:4 .:2 ${TIMP[c][1]}:2`));

export const z5: Song = {
  id: 'z5',
  bpm: 138,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 16,
  layers: [
    [
      { inst: 'tuba', notes: tubaLine, gain: 0.95, reverb: 0.1 },
      { inst: 'strings', notes: bars(CHORDS.map((c) => OSTINATO[c])), gain: 0.4, reverb: 0.25 },
      { inst: 'kick', notes: 'C2:4 .:12', gain: 0.45, reverb: 0 },
    ],
    [{ inst: 'brass', notes: melody, gain: 1.2, reverb: 0.3 }],
    [
      { inst: 'trombone', notes: answer, gain: 0.9, reverb: 0.3 },
      { inst: 'pad', notes: bars(CHORDS.map((c) => `${PAD[c]}:16`)), gain: 0.4, reverb: 0.45 },
      { inst: 'snare', notes: '.:4 C4:4> .:4 C4:4', gain: 0.45, reverb: 0.15 },
      { inst: 'kick', notes: 'C2:4> .:6 C2:2 C2:4', gain: 0.5, reverb: 0 },
    ],
    [
      { inst: 'trumpet', notes: stabs, gain: 0.3, reverb: 0.3 },
      { inst: 'timpani', notes: timps, gain: 0.7, reverb: 0.3 },
      { inst: 'cymbal', notes: `C4:1> .:15 | ${REST} | ${REST} | ${REST}`, gain: 0.5, reverb: 0.3 },
    ],
  ],
};

// ---- The boss cue ----

const bossMelody = bars([
  'G4:4> C5:4 Eb5:6 D5:2', 'C5:4 Ab4:4 Eb4:8', 'G4:4> C5:4 Eb5:6 F5:2', 'D5:4> B4:4 G4:8',
  'G4:2 C5:2 Eb5:2 G5:2 Eb5:4> C5:4', 'Ab5:4> F5:4 Db5:8', 'D5:4> B4:4 G4:4 B4:4', 'F5:8> D5:4 B4:4',
]);
const bossAnswer = bars([REST, '.:8 C4:2 D4:2 Eb4:4', REST, '.:8 D4:2 C4:2 B3:4', REST, '.:8 F3:2 Ab3:2 Db4:4', REST, '.:8 F3:2 G3:2 B3:4']);
const bossStabs = bars(BOSS_CHORDS.map((c) => `${STAB[c]}:2> .:2 ${STAB[c]}:2> .:4 ${STAB[c]}:2> .:4`));
const bossTimps = bars(BOSS_CHORDS.map((c) => {
  const [r, f] = TIMP[c];
  return `${r}:2> ${r}:2 ${f}:2 ${r}:2 ${r}:2> ${r}:2 ${f}:2 ${f}:2`;
}));

export const bossZ5: Song = {
  id: 'boss.z5',
  bpm: 150,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  bars: 8,
  layers: [
    [
      { inst: 'tuba', notes: bars(BOSS_CHORDS.map((c) => TUBA_DRIVE[c])), gain: 0.85, reverb: 0.1 },
      { inst: 'strings', notes: bars(BOSS_CHORDS.map((c) => OSTINATO[c])), gain: 0.4, reverb: 0.25 },
      { inst: 'kick', notes: 'C2:4 C2:4 C2:4 C2:4', gain: 0.4, reverb: 0 },
    ],
    [{ inst: 'brass', notes: bossMelody, gain: 1.25, reverb: 0.3 }],
    [
      { inst: 'trombone', notes: bossAnswer, gain: 0.9, reverb: 0.3 },
      { inst: 'pad', notes: bars(BOSS_CHORDS.map((c) => `${PAD[c]}:16`)), gain: 0.35, reverb: 0.45 },
      { inst: 'snare', notes: 'C4:2 .:2 C4:4> C4:1 C4:1 .:2 C4:4>', gain: 0.45, reverb: 0.15 },
      { inst: 'kick', notes: 'C2:4> .:2 C2:2 C2:4> .:4', gain: 0.5, reverb: 0 },
    ],
    [
      { inst: 'trumpet', notes: bossStabs, gain: 0.3, reverb: 0.3 },
      { inst: 'timpani', notes: bossTimps, gain: 0.45, reverb: 0.3 },
      { inst: 'cymbal', notes: `C4:1> .:15 | ${REST}`, gain: 0.5, reverb: 0.3 },
    ],
  ],
};
