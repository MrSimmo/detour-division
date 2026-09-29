// §17.2 music patterns are note text; the parser turns them into timed events.
import { describe, expect, it } from 'vitest';
import { midiOf, parsePattern } from '../../src/audio/music/notation.ts';

describe('note text', () => {
  it('names notes by pitch class, accidental and octave (A4 = 69)', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('F#3')).toBe(54);
    expect(midiOf('Bb2')).toBe(46);
    expect(() => midiOf('H2')).toThrow();
  });

  it('parses notes, rests, lengths, chords and accents into steps', () => {
    const p = parsePattern('C4:2 . E4+G4:1 | A4:3> .:1');
    expect(p.steps).toBe(8);
    expect(p.events).toEqual([
      { step: 0, len: 2, midi: [60], accent: false },
      { step: 3, len: 1, midi: [64, 67], accent: false },
      { step: 4, len: 3, midi: [69], accent: true },
    ]);
  });

  it('checks that every bar is the same length when a bar length is given', () => {
    expect(() => parsePattern('C4:4 | D4:4', 4)).not.toThrow();
    expect(() => parsePattern('C4:4 | D4:3', 4)).toThrow(/bar 2/);
  });

  it('repeats a group with (…)xN', () => {
    const p = parsePattern('(C4 D4)x2 E4:2');
    expect(p.steps).toBe(6);
    expect(p.events.map((e) => e.step)).toEqual([0, 1, 2, 3, 4]);
  });
});
