// Tracker-style music sequencer (DESIGN.md §17.2). Songs are four layers (L0–L3) of tracks; each
// track is an instrument playing a note-text pattern that loops within the song's loop. Notes are
// scheduled 120 ms ahead on AudioContext.currentTime. Layer changes and cue changes happen on bar
// boundaries with a one-bar crossfade.
import type { Buses } from '../engine.ts';
import { INSTRUMENTS } from './instruments.ts';
import { parsePattern, type NoteEvent } from './notation.ts';

export interface Track {
  inst: string;
  notes: string;
  /** Linear level for the track (default 1). */
  gain?: number;
  /** Semitones added to every note. */
  transpose?: number;
  /** Reverb send, 0..1 (default 0.25). */
  reverb?: number;
}

export interface Song {
  id: string;
  /** Beats per minute, counting the beat that `beatsPerBar` counts (a dotted crotchet in 6/8). */
  bpm: number;
  beatsPerBar: number;
  /** Steps per beat: 2 for quavers, 3 for compound time, 4 for semiquavers. */
  stepsPerBeat: number;
  /** Delay of every off-beat step, as a fraction of a step (0 = straight, 0.33 ≈ triplet swing). */
  swing?: number;
  /** Loop length in bars. Every pattern's length must divide it. */
  bars: number;
  /** L0: bass and light percussion; L1: melody; L2: countermelody and full percussion; L3: brass and timpani. */
  layers: [Track[], Track[], Track[], Track[]];
  /** Stingers play once from the start and don't loop. */
  once?: boolean;
}

interface CompiledTrack {
  track: Track;
  steps: number;
  byStep: NoteEvent[][];
}

export interface CompiledSong {
  song: Song;
  barSteps: number;
  loopSteps: number;
  layers: CompiledTrack[][];
}

/** Parses and checks a song: bars are whole, and every pattern divides the loop. */
export function compileSong(song: Song): CompiledSong {
  const barSteps = song.beatsPerBar * song.stepsPerBeat;
  const loopSteps = barSteps * song.bars;
  const layers = song.layers.map((tracks, li) =>
    tracks.map((track, ti) => {
      if (!INSTRUMENTS[track.inst]) throw new Error(`${song.id} L${li} track ${ti}: unknown instrument '${track.inst}'`);
      let p;
      try {
        p = parsePattern(track.notes, barSteps);
      } catch (e) {
        throw new Error(`${song.id} L${li} track ${ti} (${track.inst}): ${(e as Error).message}`);
      }
      if (!song.once && loopSteps % p.steps !== 0) throw new Error(`${song.id} L${li} track ${ti}: ${p.steps} steps don't divide the ${loopSteps}-step loop`);
      const byStep: NoteEvent[][] = Array.from({ length: p.steps }, () => []);
      for (const ev of p.events) byStep[ev.step]!.push(ev);
      return { track, steps: p.steps, byStep };
    }),
  );
  const longest = Math.max(...layers.flat().map((t) => t.steps));
  return { song, barSteps, loopSteps: song.once ? longest : loopSteps, layers };
}

export const stepSeconds = (s: Song): number => 60 / s.bpm / s.stepsPerBeat;

/** Time offset of absolute step `k` from the song's start, swing included. */
export function stepTime(s: Song, k: number): number {
  const d = stepSeconds(s);
  return k * d + (k % 2 === 1 ? (s.swing ?? 0) * d : 0);
}

/** Schedules every note of absolute step `k` into the given per-track outputs. */
export function scheduleStep(c: BaseAudioContext, cs: CompiledSong, outs: AudioNode[][], k: number, t: number): void {
  const d = stepSeconds(cs.song);
  cs.layers.forEach((tracks, li) =>
    tracks.forEach((ct, ti) => {
      if (cs.song.once && k >= ct.steps) return;
      const evs = ct.byStep[k % ct.steps]!;
      if (!evs.length) return;
      const inst = INSTRUMENTS[ct.track.inst]!;
      for (const ev of evs) for (const m of ev.midi) inst(c, outs[li]![ti]!, t, m + (ct.track.transpose ?? 0), ev.len * d * 0.95, ev.accent ? 1 : 0.78);
    }),
  );
}

/** Per-track output nodes for one playing song: track gain → layer gain → out, plus a reverb send. */
export function trackOutputs(c: BaseAudioContext, cs: CompiledSong, layerGains: GainNode[], reverb: AudioNode | null): AudioNode[][] {
  return cs.layers.map((tracks, li) =>
    tracks.map((ct) => {
      const g = c.createGain();
      g.gain.value = ct.track.gain ?? 1;
      g.connect(layerGains[li]!);
      if (reverb) {
        const send = c.createGain();
        send.gain.value = ct.track.reverb ?? 0.25;
        g.connect(send).connect(reverb);
      }
      return g;
    }),
  );
}

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

interface Playing {
  cs: CompiledSong;
  t0: number;
  next: number;
  out: GainNode;
  layerGains: GainNode[];
  outs: AudioNode[][];
  /** Absolute step at which scheduling stops (fade-outs and stingers). */
  end: number;
  /** Dropped-in layer stems (R-AUD-3), looping inside their layer's gain. */
  stems: AudioBufferSourceNode[];
}

export class Sequencer {
  private readonly c: BaseAudioContext;
  private readonly buses: Buses;
  private current: Playing | null = null;
  private fading: Playing[] = [];
  private stingers: Playing[] = [];
  private layers = 2;
  private pendingLayers: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(c: BaseAudioContext, buses: Buses) {
    this.c = c;
    this.buses = buses;
  }

  /** Layers playing now (2–4); a requested change lands on the next bar line. */
  get activeLayers(): number {
    return this.layers;
  }

  get songId(): string | null {
    return this.current?.cs.song.id ?? null;
  }

  private start(cs: CompiledSong, t0: number, fadeIn: number, dest: AudioNode = this.buses.music, stemBufs: (AudioBuffer | undefined)[] = []): Playing {
    const out = this.c.createGain();
    out.connect(dest);
    out.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : 1, t0);
    if (fadeIn > 0) out.gain.linearRampToValueAtTime(1, t0 + fadeIn);
    const layerGains = [0, 1, 2, 3].map((i) => {
      const g = this.c.createGain();
      g.gain.value = i < this.layers ? 1 : 0;
      g.connect(out);
      return g;
    });
    // File stems loop at the song's bar-aligned loop length and start with the synth tracks.
    const loop = stepTime(cs.song, cs.loopSteps);
    const stems = stemBufs.flatMap((buf, i) => {
      if (!buf) return [];
      const src = this.c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopEnd = Math.min(loop, buf.duration);
      src.connect(layerGains[i]!);
      src.start(t0);
      return [src];
    });
    return { cs, t0, next: 0, out, layerGains, outs: trackOutputs(this.c, cs, layerGains, this.buses.reverb), end: cs.song.once ? cs.loopSteps : Infinity, stems };
  }

  /** Plays a looping cue. If one is already playing, the switch happens on its next bar line.
   * `stems[i]`, when given, is a recording of layer i that plays in its place. */
  play(song: Song, stems: (AudioBuffer | undefined)[] = []): void {
    if (this.current?.cs.song.id === song.id) return;
    const cs = compileSong(song);
    const now = this.c.currentTime + 0.05;
    const old = this.current;
    let t0 = now;
    if (old) {
      const bar = Math.max(old.next, Math.ceil(old.next / old.cs.barSteps) * old.cs.barSteps);
      t0 = Math.max(now, old.t0 + stepTime(old.cs.song, bar));
      const fade = stepSeconds(old.cs.song) * old.cs.barSteps;
      old.end = bar + old.cs.barSteps;
      old.out.gain.setValueAtTime(1, t0);
      old.out.gain.linearRampToValueAtTime(0.0001, t0 + fade);
      this.fading.push(old);
    }
    this.current = this.start(cs, t0, old ? stepSeconds(song) * cs.barSteps : 0.3, this.buses.music, stems);
    this.ensureTimer();
  }

  /** Fades the music out over `seconds`. */
  stop(seconds = 1): void {
    const p = this.current;
    if (!p) return;
    const t = this.c.currentTime;
    p.out.gain.cancelScheduledValues(t);
    p.out.gain.setValueAtTime(p.out.gain.value, t);
    p.out.gain.linearRampToValueAtTime(0.0001, t + seconds);
    p.end = p.next + Math.ceil(seconds / stepSeconds(p.cs.song));
    this.fading.push(p);
    this.current = null;
  }

  /** How many layers should play (2 = L0+L1, up to 4). Takes effect on the next bar line. */
  setLayers(n: number): void {
    if (n === this.layers && this.pendingLayers === null) return;
    this.pendingLayers = n;
  }

  /** Plays a one-shot cue over the music and returns its length in seconds. */
  stinger(song: Song): number {
    const cs = compileSong({ ...song, once: true });
    const p = this.start(cs, this.c.currentTime + 0.03, 0, this.buses.stinger);
    p.layerGains.forEach((g) => (g.gain.value = 1));
    this.stingers.push(p);
    this.ensureTimer();
    return stepTime(song, cs.loopSteps);
  }

  private ensureTimer(): void {
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
  }

  private pump(p: Playing, horizon: number, onBar?: (k: number, t: number) => void): void {
    while (p.next < p.end) {
      const t = p.t0 + stepTime(p.cs.song, p.next);
      if (t >= horizon) break;
      if (onBar && p.next % p.cs.barSteps === 0) onBar(p.next, t);
      scheduleStep(this.c, p.cs, p.outs, p.next, t);
      p.next++;
    }
  }

  tick(): void {
    const horizon = this.c.currentTime + LOOKAHEAD;
    if (this.current) {
      const p = this.current;
      this.pump(p, horizon, (_k, t) => {
        if (this.pendingLayers === null) return;
        const fade = stepSeconds(p.cs.song) * p.cs.barSteps;
        this.layers = this.pendingLayers;
        this.pendingLayers = null;
        p.layerGains.forEach((g, i) => {
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(i < this.layers ? 1 : 0, t + fade);
        });
      });
    }
    for (const list of [this.fading, this.stingers]) {
      for (const p of list) this.pump(p, horizon);
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        if (p.next >= p.end && this.c.currentTime > p.t0 + stepTime(p.cs.song, p.end) + 2) {
          for (const src of p.stems) src.stop();
          p.out.disconnect();
          list.splice(i, 1);
        }
      }
    }
    if (!this.current && !this.fading.length && !this.stingers.length && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
