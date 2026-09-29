// SFX playback (DESIGN.md §17.3): each sound is a synth patch rendered at boot through an
// OfflineAudioContext into 3 variants, or a dropped-in file. Playback varies rate by ±6% and
// gain by ±2 dB, pans by screen x within ±0.8, and asks the voice limiter first.
import type { Ctx } from '../synth.ts';
import { db, rng } from '../synth.ts';
import { VoiceLimiter, type SoundSpec } from './voices.ts';

/** Draws one variant into `out`, starting at time 0. `r` is seeded per variant. */
export type Patch = (c: Ctx, out: AudioNode, r: () => number) => void;

export interface SfxDef extends SoundSpec {
  /** Rendered length in seconds (the tail is cut here). */
  dur: number;
  bus: 'sfx' | 'ui';
  /** Level trim in dB, applied at playback. */
  gain?: number;
  patch: Patch;
}

export const VARIANTS = 3;
const SAMPLE_RATE = 44100;

export async function renderVariants(def: SfxDef, seed: number): Promise<AudioBuffer[]> {
  const out: AudioBuffer[] = [];
  for (let v = 0; v < VARIANTS; v++) {
    const c = new OfflineAudioContext(1, Math.ceil(def.dur * SAMPLE_RATE), SAMPLE_RATE);
    def.patch(c, c.destination, rng(seed * 7 + v + 1));
    out.push(await c.startRendering());
  }
  return out;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

interface Live {
  src: AudioBufferSourceNode;
  gain: GainNode;
  base: number;
}

export class SfxPlayer {
  /** Sounds started, for tests (R-AUD-2: none before the first gesture). */
  played = 0;
  readonly limiter: VoiceLimiter;
  private readonly c: BaseAudioContext;
  private readonly out: { sfx: AudioNode; ui: AudioNode };
  private readonly defs: Record<string, SfxDef>;
  private buffers = new Map<string, AudioBuffer[]>();
  private sources = new Map<string, 'synth' | 'file'>();
  private live = new Map<number, Live>();

  constructor(c: BaseAudioContext, out: { sfx: AudioNode; ui: AudioNode }, defs: Record<string, SfxDef>, globalCap = 24) {
    this.c = c;
    this.out = out;
    this.defs = defs;
    this.limiter = new VoiceLimiter(globalCap);
  }

  /** Renders every synth sound that hasn't been replaced by a file. */
  async renderAll(): Promise<void> {
    for (const [key, def] of Object.entries(this.defs)) {
      if (this.buffers.has(key)) continue;
      const bufs = await renderVariants(def, hash(key));
      if (!this.buffers.has(key)) {
        this.buffers.set(key, bufs);
        this.sources.set(key, 'synth');
      }
    }
  }

  /** R-AUD-3: a dropped-in file replaces the synth for this key. */
  setFile(key: string, buf: AudioBuffer): void {
    this.buffers.set(key, [buf]);
    this.sources.set(key, 'file');
  }

  /** The first variant, for sounds the caller loops itself (ambience). */
  buffer(key: string): AudioBuffer | undefined {
    return this.buffers.get(key)?.[0];
  }

  source(key: string): 'synth' | 'file' | undefined {
    return this.sources.get(key);
  }

  play(key: string, pan = 0, when = this.c.currentTime): boolean {
    const def = this.defs[key];
    const bufs = this.buffers.get(key);
    if (!def || !bufs) return false;
    const buf = bufs[Math.floor(Math.random() * bufs.length)]!;
    const rate = 1 + (Math.random() * 2 - 1) * 0.06;
    const d = this.limiter.request(key, def, when * 1000, (when + buf.duration / rate) * 1000);
    if (d.kind === 'drop') return false;
    if (d.kind === 'merge') {
      const v = this.live.get(d.id);
      if (v) v.gain.gain.setValueAtTime(v.base * d.gain, Math.max(when, this.c.currentTime));
      return true;
    }
    if (d.steal !== undefined) this.stop(d.steal, when);
    const src = this.c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const base = db((def.gain ?? 0) + (Math.random() * 2 - 1) * 2);
    const gain = this.c.createGain();
    gain.gain.value = base;
    const panner = this.c.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    src.connect(gain).connect(panner).connect(this.out[def.bus]);
    src.start(when);
    const id = d.id;
    src.onended = () => {
      this.live.delete(id);
      this.limiter.release(id);
    };
    this.live.set(id, { src, gain, base });
    this.played++;
    return true;
  }

  /** Stops a stolen voice with a 10 ms fade so it doesn't click. */
  private stop(id: number, when: number): void {
    const v = this.live.get(id);
    if (!v) return;
    const t = Math.max(when, this.c.currentTime);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + 0.01);
    v.src.stop(t + 0.012);
    this.live.delete(id);
  }
}
