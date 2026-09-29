// Note text for the music patterns (DESIGN.md §17.2). One token per event, separated by spaces:
//   C4  F#3  Bb2       a note (pitch class, optional # or b, octave; A4 = MIDI 69)
//   C4+E4+G4           a chord
//   :n                 length in steps (default 1), e.g. C4:2, .:4
//   >                  accent, e.g. C4:2>
//   .                  a rest
//   |                  a bar line (checked against the bar length when one is given)
//   (C4 D4)x2          repeat a group
// Patterns hold pitch and rhythm only. The song decides the step length and the instrument.

export interface NoteEvent {
  step: number;
  len: number;
  midi: number[];
  accent: boolean;
}

export interface Pattern {
  steps: number;
  events: NoteEvent[];
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midiOf(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note '${name}'`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + PC[m[1]!]! + acc;
}

function expand(text: string): string {
  // Innermost groups first, so groups can nest.
  let s = text;
  const group = /\(([^()]*)\)x(\d+)/;
  for (let m = group.exec(s); m; m = group.exec(s)) s = s.slice(0, m.index) + Array(Number(m[2])).fill(m[1]).join(' ') + s.slice(m.index + m[0].length);
  return s;
}

export function parsePattern(text: string, barSteps?: number): Pattern {
  const events: NoteEvent[] = [];
  let step = 0;
  let barStart = 0;
  let bar = 1;
  const checkBar = (): void => {
    if (barSteps !== undefined && step - barStart !== barSteps) throw new Error(`bar ${bar} is ${step - barStart} steps, not ${barSteps}`);
    barStart = step;
    bar++;
  };
  for (const tok of expand(text).split(/\s+/).filter(Boolean)) {
    if (tok === '|') {
      checkBar();
      continue;
    }
    const m = /^([^:>]+)(?::(\d+))?(>?)$/.exec(tok);
    if (!m) throw new Error(`bad token '${tok}'`);
    const len = m[2] ? Number(m[2]) : 1;
    if (m[1] !== '.') events.push({ step, len, midi: m[1]!.split('+').map(midiOf), accent: m[3] === '>' });
    step += len;
  }
  if (step > barStart) checkBar();
  return { steps: step, events };
}
