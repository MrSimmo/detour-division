// SFX voice limiting (DESIGN.md §17.3, R-AUD-1). Pure bookkeeping, no Web Audio: the player asks
// before starting a sound and does what the decision says (play, possibly stealing a voice; merge
// into a voice already playing; or drop).

export const PRIORITY = { shot: 0, ui: 1, explosion: 2, boss: 3 } as const;

export interface SoundSpec {
  /** Most voices of this sound at once. */
  cap: number;
  /** A retrigger sooner than this after the last start merges into that voice instead. */
  retrigMs: number;
  priority: number;
}

export type Decision =
  | { kind: 'play'; id: number; steal?: number }
  | { kind: 'merge'; id: number; gain: number }
  | { kind: 'drop' };

interface Voice {
  id: number;
  key: string;
  priority: number;
  start: number;
  end: number;
  count: number;
}

/** Gain for a voice standing in for `n` triggers: grows with the log of the count. */
const mergedGain = (n: number): number => 1 + 0.5 * Math.log(n);

export class VoiceLimiter {
  private voices: Voice[] = [];
  private lastStart = new Map<string, number>();
  private nextId = 1;
  private readonly globalCap: number;

  constructor(globalCap = 24) {
    this.globalCap = globalCap;
  }

  private purge(now: number): void {
    if (this.voices.some((v) => v.end <= now)) this.voices = this.voices.filter((v) => v.end > now);
  }

  active(now: number): number {
    this.purge(now);
    return this.voices.length;
  }

  activeFor(key: string, now: number): number {
    this.purge(now);
    return this.voices.filter((v) => v.key === key).length;
  }

  /** The player stopped a voice early (for example, it was stolen). */
  release(id: number): void {
    this.voices = this.voices.filter((v) => v.id !== id);
  }

  request(key: string, spec: SoundSpec, now: number, end: number): Decision {
    this.purge(now);
    const mine = this.voices.filter((v) => v.key === key);
    const newest = mine.reduce<Voice | undefined>((a, v) => (!a || v.start > a.start ? v : a), undefined);
    const last = this.lastStart.get(key);
    if (newest && (newest.start === now || (last !== undefined && now - last < spec.retrigMs))) {
      newest.count++;
      return { kind: 'merge', id: newest.id, gain: mergedGain(newest.count) };
    }
    if (last !== undefined && now - last < spec.retrigMs) return { kind: 'drop' };
    let steal: Voice | undefined;
    if (mine.length >= spec.cap) steal = mine.reduce((a, v) => (v.start < a.start ? v : a));
    else if (this.voices.length >= this.globalCap) {
      for (const v of this.voices) {
        if (v.priority > spec.priority) continue;
        if (!steal || v.priority < steal.priority || (v.priority === steal.priority && v.start < steal.start)) steal = v;
      }
      if (!steal) return { kind: 'drop' };
    }
    if (steal) this.release(steal.id);
    const v: Voice = { id: this.nextId++, key, priority: spec.priority, start: now, end, count: 1 };
    this.voices.push(v);
    this.lastStart.set(key, now);
    return steal ? { kind: 'play', id: v.id, steal: steal.id } : { kind: 'play', id: v.id };
  }
}
