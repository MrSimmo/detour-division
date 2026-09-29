// ADR-0003: sfc32 uses only 32-bit integer operations, so every JS engine produces
// the same sequence. State is plain data so it survives JSON snapshots.

export interface Rng {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Seeds via splitmix32 so nearby integer seeds give unrelated streams. */
export function rngFrom(seed: number): Rng {
  let s = seed >>> 0;
  const mix = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  const r: Rng = { a: mix(), b: mix(), c: mix(), d: mix() };
  for (let i = 0; i < 12; i++) rngU32(r);
  return r;
}

export function rngU32(r: Rng): number {
  let t = (r.a + r.b) | 0;
  r.a = (r.b ^ (r.b >>> 9)) >>> 0;
  r.b = (r.c + (r.c << 3)) >>> 0;
  let c = ((r.c << 21) | (r.c >>> 11)) >>> 0;
  r.d = (r.d + 1) >>> 0;
  t = (t + r.d) | 0;
  c = (c + t) >>> 0;
  r.c = c;
  return t >>> 0;
}

/** Uniform in [0, 1). */
export function rngNext(r: Rng): number {
  return rngU32(r) / 4294967296;
}

/** Uniform integer in [lo, hi] inclusive. */
export function rngInt(r: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rngNext(r) * (hi - lo + 1));
}

/** Uniform in [lo, hi). */
export function rngRange(r: Rng, lo: number, hi: number): number {
  return lo + rngNext(r) * (hi - lo);
}

export function rngCopy(r: Rng): Rng {
  return { a: r.a, b: r.b, c: r.c, d: r.d };
}
