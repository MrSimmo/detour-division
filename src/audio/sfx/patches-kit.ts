// Private building blocks for the SFX patches: tones, filtered noise, bells, clicks and loop fades.
// Built only on synth.ts, so every patch renders the same way in any BaseAudioContext.
import { chain, env, filter, glide, noise, osc, type Ctx } from '../synth.ts';
import type { SfxDef } from './player.ts';
import { PRIORITY } from './voices.ts';

export type R = () => number;
type Spec = Pick<SfxDef, 'cap' | 'retrigMs' | 'priority' | 'bus'>;

export const shot = (cap: number, retrigMs: number): Spec => ({ cap, retrigMs, priority: PRIORITY.shot, bus: 'sfx' });
export const blast = (): Spec => ({ cap: 6, retrigMs: 30, priority: PRIORITY.explosion, bus: 'sfx' });
export const bossSpec = (cap: number, retrigMs: number): Spec => ({ cap, retrigMs, priority: PRIORITY.boss, bus: 'sfx' });
export const uiSpec = (cap: number, retrigMs: number): Spec => ({ cap, retrigMs, priority: PRIORITY.ui, bus: 'ui' });
/** Enemy and status feedback: on the SFX bus, above shots so a crowd of guns can't hide it. */
export const cue = (cap: number, retrigMs: number): Spec => ({ cap, retrigMs, priority: PRIORITY.ui, bus: 'sfx' });

/** An oscillator with an attack–decay envelope, optionally gliding to `to` over `glideDur`. */
export function tone(c: Ctx, out: AudioNode, type: OscillatorType, f: number, t: number, dur: number, peak: number, o: { to?: number; glideDur?: number; attack?: number; detune?: number } = {}): OscillatorNode {
  const s = osc(c, type, f, t, dur);
  if (o.detune) s.detune.value = o.detune;
  if (o.to !== undefined) glide(s.frequency, f, o.to, t, o.glideDur ?? dur);
  chain(s, env(c, t, dur, peak, o.attack ?? 0.002), out);
  return s;
}

/** Filtered noise with an envelope; the filter can sweep to `to` over the sound. */
export function hiss(c: Ctx, out: AudioNode, r: R, t: number, dur: number, peak: number, type: BiquadFilterType, freq: number, q = 0.7, o: { to?: number; attack?: number } = {}): BiquadFilterNode {
  const f = filter(c, type, freq, q);
  if (o.to !== undefined) glide(f.frequency, freq, o.to, t, dur);
  chain(noise(c, t, dur, r() * 1.5), f, env(c, t, dur, peak, o.attack ?? 0.002), out);
  return f;
}

/** Struck metal or glass: sine partials at `ratios` of `f`, the higher ones dying away faster. */
export function partials(c: Ctx, out: AudioNode, t: number, f: number, ratios: readonly (readonly [number, number])[], decay: number, peak: number): void {
  for (const [ratio, amp] of ratios) chain(osc(c, 'sine', f * ratio, t, decay), env(c, t, decay / Math.sqrt(ratio), peak * amp, 0.001), out);
}

export const METAL = [[1, 1], [2.41, 0.55], [3.93, 0.35], [5.37, 0.2]] as const;
export const GLASS = [[1, 1], [1.5, 0.5], [2.25, 0.35], [3.4, 0.2]] as const;
export const BELL = [[1, 1], [2.76, 0.4], [5.4, 0.18]] as const;

/** `n` short noise ticks at seeded times within [t, t + span). */
export function clicks(c: Ctx, out: AudioNode, r: R, t: number, span: number, n: number, peak: number, freq: number, q = 2): void {
  for (let i = 0; i < n; i++) {
    const at = t + r() * span;
    hiss(c, out, r, at, 0.012 + r() * 0.01, peak * (0.6 + r() * 0.4), 'bandpass', freq * (0.8 + r() * 0.4), q, { attack: 0.0005 });
  }
}

/** A coin: two bright metal partials and a short ring. */
export function coin(c: Ctx, out: AudioNode, r: R, t: number, peak: number): void {
  const f = 2300 + r() * 700;
  partials(c, out, t, f, [[1, 1], [1.34, 0.6], [2.7, 0.3]], 0.25 + r() * 0.1, peak);
}

/** A gain that fades in over the first and out over the last `fade` seconds, so a rendered loop repeats without a click. */
export function loopFade(c: Ctx, out: AudioNode, dur: number, fade = 0.06): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(1, fade);
  g.gain.setValueAtTime(1, dur - fade);
  g.gain.linearRampToValueAtTime(0, dur);
  g.connect(out);
  return g;
}

/** A slowly wandering level (for wind and hum): linear ramps between seeded values every `step` seconds. */
export function wander(c: Ctx, r: R, dur: number, step: number, lo: number, hi: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(lo + (hi - lo) * r(), 0);
  for (let t = step; t <= dur + step; t += step) g.gain.linearRampToValueAtTime(lo + (hi - lo) * r(), t);
  return g;
}

/** Amplitude modulation: `node` → gain whose level wobbles at `rate` Hz by ±`depth` around `centre`. */
export function tremolo(c: Ctx, t: number, dur: number, rate: number, centre: number, depth: number): GainNode {
  const g = c.createGain();
  g.gain.value = centre;
  const lfo = osc(c, 'sine', rate, t, dur);
  const d = c.createGain();
  d.gain.value = depth;
  lfo.connect(d).connect(g.gain);
  return g;
}

/** Frequency jitter for electric sounds: a square LFO added to `p`. */
export function jitter(c: Ctx, p: AudioParam, t: number, dur: number, rate: number, depth: number): void {
  const lfo = osc(c, 'square', rate, t, dur);
  const d = c.createGain();
  d.gain.value = depth;
  lfo.connect(d).connect(p);
}
