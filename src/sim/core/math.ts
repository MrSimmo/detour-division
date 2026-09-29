// ADR-0003: Math.sin/cos/atan2/pow are implementation-defined in JS engines, so the
// simulation uses these polynomial versions built only from IEEE-exact + − × ÷.

export const PI = 3.141592653589793;
export const TWO_PI = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;
export const DEG = PI / 180;

// Taylor series in Horner form; |x| ≤ π/4 keeps truncation error below 1e-17.
function sinPoly(x: number): number {
  const x2 = x * x;
  return (
    x *
    (1 -
      (x2 / 6) *
        (1 -
          (x2 / 20) *
            (1 - (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - (x2 / 156) * (1 - (x2 / 210) * (1 - x2 / 272))))))))
  );
}

function cosPoly(x: number): number {
  const x2 = x * x;
  return (
    1 -
    (x2 / 2) *
      (1 -
        (x2 / 12) *
          (1 - (x2 / 30) * (1 - (x2 / 56) * (1 - (x2 / 90) * (1 - (x2 / 132) * (1 - (x2 / 182) * (1 - x2 / 240)))))))
  );
}

function reduce(x: number): { q: number; y: number } {
  const r = x - TWO_PI * Math.round(x / TWO_PI);
  const q = Math.round(r / HALF_PI);
  return { q: ((q % 4) + 4) % 4, y: r - q * HALF_PI };
}

export function dsin(x: number): number {
  const { q, y } = reduce(x);
  if (q === 0) return sinPoly(y);
  if (q === 1) return cosPoly(y);
  if (q === 2) return -sinPoly(y);
  return -cosPoly(y);
}

export function dcos(x: number): number {
  const { q, y } = reduce(x);
  if (q === 0) return cosPoly(y);
  if (q === 1) return -sinPoly(y);
  if (q === 2) return -cosPoly(y);
  return sinPoly(y);
}

export interface Vec {
  x: number;
  y: number;
}

/**
 * Rotates unit heading (hx,hy) towards unit direction (dx,dy) by at most the angle
 * whose cosine/sine are (cosMax, sinMax). Writes into and returns `out`.
 */
export function rotateToward(
  hx: number,
  hy: number,
  dx: number,
  dy: number,
  cosMax: number,
  sinMax: number,
  out: Vec = { x: 0, y: 0 },
): Vec {
  const dot = hx * dx + hy * dy;
  if (dot >= cosMax) {
    out.x = dx;
    out.y = dy;
    return out;
  }
  const s = hx * dy - hy * dx >= 0 ? sinMax : -sinMax;
  const x = hx * cosMax - hy * s;
  const y = hx * s + hy * cosMax;
  const len = Math.sqrt(x * x + y * y);
  out.x = x / len;
  out.y = y / len;
  return out;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** base^n for integer n ≥ 0 by repeated multiplication (no Math.pow). */
export function ipow(base: number, n: number): number {
  let r = 1;
  for (let i = 0; i < n; i++) r *= base;
  return r;
}
