// R-SIM-4 (purity) and R-DMG-2 (no literal balance numbers in simulation logic).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Removes comments and string/template literals so scans only see code. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

const BANNED: [RegExp, string][] = [
  [/\bMath\.(random|sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log2|log10|log1p|pow|hypot|cbrt)\b/, 'non-deterministic Math function'],
  [/\*\*/, 'exponent operator (use ipow)'],
  [/\b(Date|performance|setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/, 'time source'],
  [/\b(window|document|navigator|globalThis|localStorage|indexedDB|crypto|fetch|process)\b/, 'environment access'],
];

describe('simulation purity (R-SIM-4)', () => {
  const pure = ['src/sim', 'src/bot', 'src/data', 'src/meta'].flatMap((d) => {
    try {
      return files(join(ROOT, d));
    } catch {
      return [];
    }
  });

  it('scans a non-empty set of files', () => {
    expect(pure.length).toBeGreaterThan(10);
  });

  for (const [re, what] of BANNED) {
    it(`uses no ${what}`, () => {
      const hits = pure.filter((f) => re.test(codeOnly(readFileSync(f, 'utf8')))).map((f) => relative(ROOT, f));
      expect(hits).toEqual([]);
    });
  }
});

describe('no literal balance numbers in simulation logic (R-DMG-2)', () => {
  // Engine constants and structural tables are allowed their numbers; everything else
  // must read tunables from data/balance.
  const EXEMPT = new Set(['src/sim/constants.ts', 'src/sim/terrain.ts']);
  const ALLOWED = new Set(['0', '1', '2', '0.5']);
  const logic = files(join(ROOT, 'src/sim')).filter((f) => {
    const r = relative(ROOT, f);
    return !EXEMPT.has(r) && !r.startsWith('src/sim/core/');
  });

  it('finds only 0, 1, 2 and 0.5 as numeric literals', () => {
    const offenders: string[] = [];
    for (const f of logic) {
      const code = codeOnly(readFileSync(f, 'utf8'));
      for (const m of code.matchAll(/(?<![\w$.])(\d+(?:\.\d+)?(?:e[-+]?\d+)?)(?![\w.])/g)) {
        if (!ALLOWED.has(m[1]!)) offenders.push(`${relative(ROOT, f)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
