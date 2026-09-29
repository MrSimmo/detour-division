// Small Web Audio building blocks shared by the SFX patches (rendered offline) and the music
// instruments (played live). Everything takes a BaseAudioContext, so the same code runs in an
// AudioContext and an OfflineAudioContext.

export type Ctx = BaseAudioContext;

export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
export const db = (x: number): number => Math.pow(10, x / 20);

/** A seeded 0..1 generator, so each SFX variant renders the same way every boot. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const noiseCache = new WeakMap<Ctx, AudioBuffer>();
/** Two seconds of white noise, made once per context. */
export function noiseBuffer(c: Ctx): AudioBuffer {
  let b = noiseCache.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    const r = rng(12345);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}

/** Looping white noise; `offset` (0..1.5 s) picks a different stretch, so variants differ. */
export function noise(c: Ctx, t0: number, dur: number, offset = 0): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c);
  s.loop = true;
  s.start(t0, offset);
  s.stop(t0 + dur + 0.05);
  return s;
}

export function osc(c: Ctx, type: OscillatorType, freq: number, t0: number, dur: number): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  return o;
}

/** A gain node shaped as attack → peak → exponential decay to silence by t0 + dur. */
export function env(c: Ctx, t0: number, dur: number, peak = 1, attack = 0.005, hold = 0): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (hold > 0) g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + hold + 0.01));
  return g;
}

/** Attack, sustain level, release: for held notes whose length is known. */
export function adsr(c: Ctx, t0: number, len: number, peak: number, a: number, d: number, sus: number, r: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.linearRampToValueAtTime(peak * sus, t0 + a + d);
  g.gain.setValueAtTime(peak * sus, t0 + Math.max(len, a + d));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(len, a + d) + r);
  return g;
}

export function filter(c: Ctx, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Chains nodes left to right and returns the last one. */
export function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.connect(nodes[i + 1]!);
  return nodes[nodes.length - 1]!;
}

/** Pitch glide on an oscillator or buffer source's frequency/playbackRate parameter. */
export function glide(p: AudioParam, from: number, to: number, t0: number, dur: number): void {
  p.setValueAtTime(from, t0);
  p.exponentialRampToValueAtTime(Math.max(0.0001, to), t0 + dur);
}

/** Vibrato: an LFO added to a frequency parameter, fading in after `delay`. */
export function vibrato(c: Ctx, p: AudioParam, t0: number, dur: number, rate: number, depthHz: number, delay = 0.12): void {
  const lfo = osc(c, 'sine', rate, t0, dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(depthHz, t0 + delay + 0.1);
  lfo.connect(g).connect(p);
}

/** A Karplus–Strong plucked string, computed into a buffer (no AudioWorklet needed). The loop is
 * the classic delay line plus two-point average (half a sample of delay), and a first-order allpass
 * supplies the fractional part of the period, so the pitch is exact at any frequency. */
export function pluckBuffer(c: Ctx, freq: number, dur: number, damping = 0.996, seed = 1): AudioBuffer {
  const n = Math.ceil(c.sampleRate * dur);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  const period = c.sampleRate / freq;
  const len = Math.max(2, Math.floor(period - 0.5));
  const frac = period - 0.5 - len;
  const a = (1 - frac) / (1 + frac);
  const ring = new Float32Array(len);
  const r = rng(seed);
  for (let i = 0; i < len; i++) ring[i] = r() * 2 - 1;
  let idx = 0;
  let last = 0;
  let apX = 0;
  let apY = 0;
  for (let i = 0; i < n; i++) {
    const out = ring[idx]!;
    const avg = damping * 0.5 * (out + last);
    last = out;
    const ap = a * avg + apX - a * apY;
    apX = avg;
    apY = ap;
    ring[idx] = ap;
    d[i] = out;
    idx = (idx + 1) % len;
  }
  return b;
}

/** A code-generated reverb impulse: decaying stereo noise with a softened top end. */
export function impulse(c: Ctx, seconds: number, decay: number): AudioBuffer {
  const n = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    const r = rng(99 + ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += 0.35 * (r() * 2 - 1 - lp);
      d[i] = lp * Math.pow(1 - i / n, decay);
    }
  }
  return b;
}
