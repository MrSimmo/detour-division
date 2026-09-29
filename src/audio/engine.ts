// Audio engine (DESIGN.md §17.1): buses, the master limiter, first-gesture unlock, ducking.
import { db, impulse } from './synth.ts';

export interface Buses {
  master: GainNode;
  music: GainNode;
  /** Ducking stage for the music bus (boss arrival, boss death, stingers). */
  musicDuck: GainNode;
  /** Stingers: at the music volume, but not ducked (they are what the music ducks for). */
  stinger: GainNode;
  sfx: GainNode;
  sfxDuck: GainNode;
  ui: GainNode;
  /** Music instruments send here for the shared code-generated reverb. */
  reverb: AudioNode;
  /** Last node before the speakers: closed (0) until the first gesture when `gated` (R-AUD-2). */
  gate: GainNode;
}

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
}

/** Builds the bus graph on any context, so an OfflineAudioContext test hears exactly the game's mix. */
export function buildBuses(c: BaseAudioContext, gated = false): Buses {
  // The master limiter: a hard-kneed, fast compressor just under full scale, then a little headroom.
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  const out = c.createGain();
  out.gain.value = db(-1.5);
  const gate = c.createGain();
  gate.gain.value = gated ? 0 : 1;
  const master = c.createGain();
  master.connect(limiter).connect(out).connect(gate).connect(c.destination);
  const musicDuck = c.createGain();
  const music = c.createGain();
  music.connect(musicDuck).connect(master);
  const stinger = c.createGain();
  stinger.connect(master);
  const sfxDuck = c.createGain();
  const sfx = c.createGain();
  sfx.connect(sfxDuck).connect(master);
  const ui = c.createGain();
  ui.connect(master);
  const conv = c.createConvolver();
  conv.buffer = impulse(c, 2.2, 3);
  const wet = c.createGain();
  wet.gain.value = 0.3;
  conv.connect(wet).connect(music);
  return { master, music, musicDuck, stinger, sfx, sfxDuck, ui, reverb: conv, gate };
}

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly buses: Buses;
  unlocked = false;
  private unlockCbs: (() => void)[] = [];

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    // R-AUD-2: nothing may sound before the first gesture, even where autoplay is allowed. WebKit can
    // start a context suspended and then resume it by itself, so any early resume is undone too.
    this.quiet(this.ctx.suspend());
    // Even if a browser runs the context early, nothing reaches the speakers until the gate opens.
    this.buses = buildBuses(this.ctx, true);
    for (const g of GESTURES) window.addEventListener(g, this.unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.unlocked) return;
      if (document.visibilityState === 'visible') this.quiet(this.ctx.resume());
      else this.quiet(this.ctx.suspend());
    });
    // iOS reports 'interrupted' after a call or Siri; resume once we're visible again.
    this.ctx.addEventListener('statechange', () => {
      if (!this.unlocked && this.ctx.state === 'running') this.quiet(this.ctx.suspend());
      else if ((this.ctx.state as string) === 'interrupted' && document.visibilityState === 'visible' && this.unlocked) this.quiet(this.ctx.resume());
    });
  }

  /** Suspend and resume can reject while the page is unloading ("navigated away"); that's harmless. */
  private quiet(p: Promise<void>): void {
    p.catch(() => undefined);
  }

  private unlock = (): void => {
    if (this.unlocked) return;
    this.unlocked = true;
    this.buses.gate.gain.value = 1;
    this.quiet(this.ctx.resume());
    for (const g of GESTURES) window.removeEventListener(g, this.unlock, { capture: true });
    for (const f of this.unlockCbs.splice(0)) f();
  };

  /** Runs `f` once audio is unlocked (at once if it already is). */
  onUnlock(f: () => void): void {
    if (this.unlocked) f();
    else this.unlockCbs.push(f);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  setVolumes(v: Volumes): void {
    const t = this.ctx.currentTime;
    this.buses.master.gain.setTargetAtTime(v.muted ? 0 : v.master, t, 0.02);
    this.buses.music.gain.setTargetAtTime(v.music, t, 0.02);
    this.buses.stinger.gain.setTargetAtTime(v.music, t, 0.02);
    this.buses.sfx.gain.setTargetAtTime(v.sfx, t, 0.02);
    this.buses.ui.gain.setTargetAtTime(v.ui, t, 0.02);
  }

  /** §17.1 ducking: music −9 dB (and SFX −4 dB under stingers), 40 ms attack, held, 700 ms release. */
  duck(hold: number, sfxToo: boolean): void {
    const t = this.ctx.currentTime;
    const ramp = (p: AudioParam, to: number): void => {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(to, t + 0.04);
      p.setValueAtTime(to, t + 0.04 + hold);
      p.linearRampToValueAtTime(1, t + 0.04 + hold + 0.7);
    };
    ramp(this.buses.musicDuck.gain, db(-9));
    if (sfxToo) ramp(this.buses.sfxDuck.gain, db(-4));
  }
}
