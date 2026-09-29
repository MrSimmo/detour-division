// Menu theme: "Muster on the Green" (DESIGN.md §17.2). C major, 2/4, 116 bpm, semiquaver steps.
// A brass march tune in two 8-bar strains (a call, then a softer answer), a glockenspiel
// countermelody that fills the melody's held notes, and an oom-pah tuba.
// Harmony: | C | F | G7 | C | C | F | G | C || Am | Em | F | C | Dm | G | G7 | C |
import type { Song } from '../sequencer.ts';

const tuba = [
  'C2:2 .:2 G2:2 .:2', 'F2:2 .:2 C3:2 .:2', 'G2:2 .:2 D3:2 .:2', 'C2:2 .:2 G2:2 .:2',
  'C2:2 .:2 E2:2 .:2', 'F2:2 .:2 A2:2 .:2', 'G2:2 .:2 B2:2 .:2', 'C2:2 .:2 G2:2 .:2',
  'A2:2 .:2 E2:2 .:2', 'E2:2 .:2 B2:2 .:2', 'F2:2 .:2 C3:2 .:2', 'C2:2 .:2 G2:2 .:2',
  'D2:2 .:2 A2:2 .:2', 'G2:2 .:2 D3:2 .:2', 'G2:2 .:2 F2:2 .:2', 'C2:2 .:2 G2:2 .:2',
].join(' | ');

const melody = [
  'G4:3 G4:1 C5:2 E5:2', 'F5:2 E5:2 D5:2 C5:2', 'B4:2 D5:2 G5:3 F5:1', 'E5:4 .:2 G4:2',
  'C5:2 E5:2 G5:2 E5:2', 'A5:3 G5:1 F5:2 A5:2', 'G5:2 F5:2 E5:2 D5:2', 'C5:4 .:4',
  'E5:3 D5:1 C5:2 E5:2', 'B4:4 G4:2 B4:2', 'A4:3 B4:1 C5:2 A4:2', 'G4:4 E4:2 G4:2',
  'F4:2 A4:2 D5:2 F5:2', 'E5:3 D5:1 B4:2 G4:2', 'D5:2 F5:2 B4:2 D5:2', 'C5:4 G4:2 G4:2',
].join(' | ');

const glock = [
  '.:4 E6:2 G6:2', 'A6:4 .:4', '.:4 D6:2 F6:2', 'G6:2 E6:2 C6:2 .:2',
  '.:4 G6:2 C7:2', 'C7:4 .:4', 'B6:2 A6:2 G6:2 F6:2', 'E6:2 G6:2 C7:4',
  '.:4 A6:2 C7:2', 'B6:4 .:4', '.:4 F6:2 A6:2', 'G6:2 E6:2 C6:4',
  '.:4 F6:2 A6:2', 'B6:4 G6:4', 'F6:2 D6:2 B5:2 D6:2', 'C6:4 .:4',
].join(' | ');

const pahChords = ['E4+G4', 'F4+A4', 'B3+F4', 'E4+G4', 'E4+G4', 'F4+A4', 'B3+D4', 'E4+G4', 'E4+A4', 'E4+G4', 'F4+A4', 'E4+G4', 'F4+A4', 'B3+D4', 'B3+F4', 'E4+G4'];
const pah = pahChords.map((c) => `.:2 ${c}:2 .:2 ${c}:2`).join(' | ');

const stabChords = ['E5+G5', 'F5+A5', 'D5+F5', 'E5+G5', 'E5+G5', 'F5+A5', 'D5+G5', 'E5+G5', 'E5+A5', 'E5+G5', 'F5+A5', 'E5+G5', 'F5+A5', 'D5+G5', 'D5+F5', 'E5+G5'];
const stabs = stabChords.map((c) => `${c}:1> ${c}:1 .:6`).join(' | ');

const timps = ['C3', 'F2', 'G2', 'C3', 'C3', 'F2', 'G2', 'C3', 'A2', 'E2', 'F2', 'C3', 'D3', 'G2', 'G2', 'C3'].map((n) => `${n}:4> .:4`).join(' | ');

export const menu: Song = {
  id: 'menu',
  bpm: 116,
  beatsPerBar: 2,
  stepsPerBeat: 4,
  bars: 16,
  layers: [
    [
      { inst: 'tuba', notes: tuba, gain: 0.9, reverb: 0.1 },
      { inst: 'click', notes: '.:2 G5:2 .:2 G5:2', gain: 0.5, reverb: 0.1 },
    ],
    [{ inst: 'brass', notes: melody, reverb: 0.25 }],
    [
      { inst: 'glock', notes: glock, gain: 0.8, reverb: 0.4 },
      { inst: 'horn', notes: pah, gain: 0.45, reverb: 0.2 },
      { inst: 'snare', notes: 'C4:1> C4:1 .:2 C4:2 C4:1 C4:1', gain: 0.55, reverb: 0.15 },
      { inst: 'kick', notes: 'C2:2> .:2 C2:2 .:2', gain: 0.7, reverb: 0 },
    ],
    [
      { inst: 'trumpet', notes: stabs, gain: 0.55, reverb: 0.3 },
      { inst: 'timpani', notes: timps, gain: 0.8, reverb: 0.3 },
      { inst: 'cymbal', notes: 'C4:1> .:7 | .:8 | .:8 | .:8', gain: 0.6, reverb: 0.3 },
    ],
  ],
};
