// Music instruments (DESIGN.md §17.2): synthesised voice graphs, played live on the audio clock.
// Each plays one note (or chord member) into `out`, starting at `t`, lasting `len` seconds,
// at velocity `vel` (0..1). Drums ignore pitch or use it for tuning (timpani).
// Levels are calibrated (tools/dev/audio-check.ts tuning): a held A4 at full velocity gives an RMS of
// about 0.12 for leads and bass, and about 0.05 for plucked and bell sounds, so track gains start at 1.
// NOTE: the plucked strings (Karplus–Strong) get louder as they go lower, about 3× at A2, so plucked
// bass lines need a track gain of about 0.65–0.75. The songs are balanced around that.
import { adsr, chain, env, filter, glide, mtof, noise, osc, pluckBuffer, vibrato, type Ctx } from '../synth.ts';

export type Instrument = (c: Ctx, out: AudioNode, t: number, midi: number, len: number, vel: number) => void;

function sawPair(c: Ctx, f: number, t: number, dur: number, cents: number): AudioNode {
  const m = c.createGain();
  m.gain.value = 0.5;
  for (const d of [-cents, cents]) {
    const o = osc(c, 'sawtooth', f, t, dur);
    o.detune.value = d;
    vibrato(c, o.frequency, t, dur, 5.2, f * 0.006, 0.18);
    o.connect(m);
  }
  return m;
}

/** A brass voice; `bright` is the filter's opening in Hz, `attack` its speed. */
function brassVoice(bright: number, attack: number, level: number): Instrument {
  return (c, out, t, midi, len, vel) => {
    const f = mtof(midi);
    const dur = len + 0.2;
    const src = sawPair(c, f, t, dur, 6);
    const lp = filter(c, 'lowpass', f * 1.5, 1.2);
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.linearRampToValueAtTime(Math.min(9000, f * 1.5 + bright * vel), t + attack * 2);
    lp.frequency.setTargetAtTime(Math.min(8000, f * 1.3 + bright * 0.55 * vel), t + attack * 2, 0.15);
    chain(src, lp, adsr(c, t, len, level * vel, attack, 0.08, 0.75, 0.12), out);
  };
}

const brass = brassVoice(2600, 0.03, 0.5);
const trumpet = brassVoice(4200, 0.02, 0.5);
const horn = brassVoice(1100, 0.06, 0.5);
const trombone = brassVoice(1700, 0.045, 0.5);

/** The defeat "wah-wah": a trombone whose filter opens and closes over each note. */
const wahbone: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const src = sawPair(c, f, t, len + 0.2, 8);
  const lp = filter(c, 'lowpass', 300, 4);
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.linearRampToValueAtTime(1800, t + len * 0.35);
  lp.frequency.linearRampToValueAtTime(350, t + len);
  const o = src as GainNode;
  chain(o, lp, adsr(c, t, len, 0.4 * vel, 0.04, 0.05, 0.9, 0.15), out);
};

const tuba: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const m = c.createGain();
  m.gain.value = 0.6;
  osc(c, 'triangle', f, t, len + 0.1).connect(m);
  osc(c, 'sawtooth', f, t, len + 0.1).connect(chain(filter(c, 'lowpass', f * 3, 0.7), m));
  chain(m, filter(c, 'lowpass', 700, 0.8), adsr(c, t, Math.min(len, 0.5), 0.385 * vel, 0.015, 0.1, 0.6, 0.08), out);
};

const bassoon: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const o = osc(c, 'sawtooth', f, t, len + 0.15);
  vibrato(c, o.frequency, t, len, 5, f * 0.005, 0.2);
  chain(o, filter(c, 'bandpass', 520, 1.6), filter(c, 'lowpass', 1800, 0.7), adsr(c, t, len, 0.5 * vel, 0.03, 0.08, 0.7, 0.1), out);
};

/** Fife: a breathy, bright wooden flute, with vibrato. */
const fife: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const o = osc(c, 'triangle', f, t, len + 0.1);
  vibrato(c, o.frequency, t, len, 5.8, f * 0.008, 0.15);
  const s = osc(c, 'sine', f * 2, t, len + 0.1);
  const sg = c.createGain();
  sg.gain.value = 0.18;
  s.connect(sg);
  const breath = chain(noise(c, t, len + 0.1), filter(c, 'bandpass', f * 2, 3), env(c, t, 0.12, 0.25));
  const m = c.createGain();
  o.connect(m);
  sg.connect(m);
  breath.connect(m);
  chain(m, adsr(c, t, len, 0.28 * vel, 0.02, 0.05, 0.85, 0.06), out);
};

/** Whistled lead (the spaghetti-western whistle). */
const whistle: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const o = osc(c, 'sine', f * 0.985, t, len + 0.15);
  o.frequency.linearRampToValueAtTime(f, t + 0.05);
  vibrato(c, o.frequency, t, len, 6.2, f * 0.012, 0.1);
  chain(o, adsr(c, t, len, 0.21 * vel, 0.04, 0.05, 0.9, 0.1), out);
};

/** Reed "accordion": two detuned squares through a soft band-pass. */
const reed: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const m = c.createGain();
  m.gain.value = 0.5;
  for (const d of [-9, 9]) {
    const o = osc(c, 'square', f, t, len + 0.1);
    o.detune.value = d;
    o.connect(m);
  }
  chain(m, filter(c, 'bandpass', 1400, 0.7), filter(c, 'lowpass', 3200, 0.7), adsr(c, t, len, 0.48 * vel, 0.03, 0.06, 0.8, 0.08), out);
};

function plucked(damping: number, bright: number, level: number, maxDur: number): Instrument {
  return (c, out, t, midi, len, vel) => {
    const f = mtof(midi);
    const s = c.createBufferSource();
    s.buffer = pluckBuffer(c, f, Math.min(maxDur, len + 0.6), damping, midi);
    s.start(t);
    const g = c.createGain();
    g.gain.value = level * vel;
    chain(s, filter(c, 'lowpass', bright, 0.7), g, out);
  };
}

const pizz = plucked(0.985, 2400, 1.0, 0.45);
const pluck = plucked(0.997, 4200, 0.68, 1.6);

function bell(partials: [number, number][], decay: number, level: number): Instrument {
  return (c, out, t, midi, _len, vel) => {
    const f = mtof(midi);
    for (const [ratio, amp] of partials) chain(osc(c, 'sine', f * ratio, t, decay), env(c, t, decay / Math.sqrt(ratio), level * amp * vel, 0.002), out);
  };
}

const glock = bell([[1, 1], [2.76, 0.4], [5.4, 0.2]], 1.3, 0.27);
const celesta = bell([[1, 1], [2, 0.3], [4, 0.1]], 1.6, 0.24);

const strings: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const m = c.createGain();
  m.gain.value = 0.34;
  for (const d of [-7, 0, 7]) {
    const o = osc(c, 'sawtooth', f, t, len + 0.3);
    o.detune.value = d;
    o.connect(m);
  }
  chain(m, filter(c, 'lowpass', 2400, 0.6), adsr(c, t, len, 0.5 * vel, 0.07, 0.1, 0.85, 0.2), out);
};

/** "Aah" pad: a sawtooth through three vowel formants. */
const pad: Instrument = (c, out, t, midi, len, vel) => {
  const f = mtof(midi);
  const o = osc(c, 'sawtooth', f, t, len + 0.6);
  vibrato(c, o.frequency, t, len, 4.5, f * 0.006, 0.3);
  const sum = c.createGain();
  for (const [ff, q, a] of [[700, 7, 1], [1220, 9, 0.6], [2600, 11, 0.35]] as const) {
    const g = c.createGain();
    g.gain.value = a;
    chain(o, filter(c, 'bandpass', ff, q), g, sum);
  }
  chain(sum, adsr(c, t, len, 0.85 * vel, 0.3, 0.2, 0.85, 0.5), out);
};

const timpani: Instrument = (c, out, t, midi, _len, vel) => {
  const f = mtof(midi);
  const o = osc(c, 'sine', f * 1.02, t, 1.4);
  glide(o.frequency, f * 1.02, f, t, 0.08);
  chain(o, env(c, t, 1.3, 0.6 * vel, 0.004), out);
  chain(noise(c, t, 0.2), filter(c, 'lowpass', 400, 0.7), env(c, t, 0.18, 0.35 * vel), out);
};

const kick: Instrument = (c, out, t, _m, _len, vel) => {
  const o = osc(c, 'sine', 120, t, 0.4);
  glide(o.frequency, 120, 42, t, 0.12);
  chain(o, env(c, t, 0.35, 0.6 * vel, 0.002), out);
};

const snare: Instrument = (c, out, t, _m, _len, vel) => {
  chain(noise(c, t, 0.2, (t * 7.3) % 1.4), filter(c, 'highpass', 1400, 0.7), env(c, t, 0.16, 0.4 * vel, 0.001), out);
  chain(osc(c, 'triangle', 190, t, 0.1), env(c, t, 0.08, 0.3 * vel, 0.001), out);
};

/** Woodblock click (the western "clip-clop"). */
const click: Instrument = (c, out, t, midi, _len, vel) => {
  chain(osc(c, 'sine', mtof(midi), t, 0.06), env(c, t, 0.05, 0.35 * vel, 0.001), out);
  chain(noise(c, t, 0.03, 0.4), filter(c, 'bandpass', 3000, 2), env(c, t, 0.02, 0.2 * vel, 0.001), out);
};

/** Sleigh shaker: a burst of high noise and tiny bells. */
const shaker: Instrument = (c, out, t, _m, _len, vel) => {
  chain(noise(c, t, 0.12, (t * 3.1) % 1.4), filter(c, 'highpass', 6500, 0.7), env(c, t, 0.1, 0.22 * vel, 0.008), out);
  for (const f of [2600, 3350, 4100]) chain(osc(c, 'sine', f, t, 0.15), env(c, t, 0.12, 0.05 * vel, 0.002), out);
};

const anvil: Instrument = (c, out, t, midi, _len, vel) => {
  const f = mtof(midi);
  for (const [r, a] of [[1, 1], [2.43, 0.6], [3.87, 0.4], [5.1, 0.25]] as const) chain(osc(c, 'sine', f * r, t, 0.5), env(c, t, 0.45 / r, 0.18 * a * vel, 0.001), out);
};

const ratchet: Instrument = (c, out, t, _m, len, vel) => {
  const n = Math.max(3, Math.round(len * 40));
  for (let i = 0; i < n; i++) chain(noise(c, t + i / 40, 0.02, (i * 0.13) % 1.4), filter(c, 'bandpass', 2200, 3), env(c, t + i / 40, 0.015, 0.3 * vel, 0.001), out);
};

const cymbal: Instrument = (c, out, t, _m, _len, vel) => {
  chain(noise(c, t, 1, 0.9), filter(c, 'highpass', 7000, 0.7), env(c, t, 0.9, 0.2 * vel, 0.002), out);
};

export const INSTRUMENTS: Record<string, Instrument> = {
  brass, trumpet, horn, trombone, wahbone, tuba, bassoon, fife, whistle, reed, pizz, pluck, glock, celesta, strings, pad,
  timpani, kick, snare, click, shaker, anvil, ratchet, cymbal,
};
