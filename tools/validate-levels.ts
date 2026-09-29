// `npm run validate-levels` (DESIGN.md §15, R-VAL-1/2): every level on every difficulty.
// Usage: node tools/validate-levels.ts [id-prefix...]   e.g. z1 or z2-03
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { LevelReport } from './lib/validate.ts';

const filters = process.argv.slice(2);
const files: string[] = [];
// Zone folders only: Finder leaves .DS_Store files beside them.
for (const zone of readdirSync('data/levels').filter((n) => /^z\d$/.test(n)).sort()) {
  for (const f of readdirSync(`data/levels/${zone}`).sort()) {
    if (f.endsWith('.json') && (!filters.length || filters.some((p) => f.startsWith(p)))) files.push(`data/levels/${zone}/${f}`);
  }
}
const t0 = performance.now();
const queue = files.slice();
const reports: LevelReport[] = [];
const n = Math.max(1, Math.min(files.length, availableParallelism() - 1));
await Promise.all(
  Array.from({ length: n }, () =>
    new Promise<void>((resolve, reject) => {
      const w = new Worker(new URL('./validate-worker.ts', import.meta.url));
      const next = (): void => {
        const f = queue.shift();
        w.postMessage(f ?? null);
        if (f === undefined) resolve();
      };
      w.on('message', (m: LevelReport | 'ready') => {
        if (m !== 'ready') reports.push(m);
        next();
      });
      w.on('error', reject);
    }),
  ),
);
reports.sort((a, z) => a.file.localeCompare(z.file));

// Difficulty curve (warning only): Casual margins should broadly fall across the campaign.
const margins = reports.map((r) => r.diffs.find((d) => d.difficulty === 'casual')?.margin ?? NaN);
for (let i = 3; i < reports.length; i++) {
  const avg = (margins[i - 1]! + margins[i - 2]! + margins[i - 3]!) / 3;
  if (margins[i]! > avg + 0.15) reports[i]!.warnings.push(`Casual margin ${margins[i]!.toFixed(2)} is easier than the three before it (${avg.toFixed(2)})`);
}

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
const mmss = (s: number): string => {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
console.log(`${pad('level', 7)} ${pad('name', 22)} ${pad('mode', 11)} ${['casual', 'tough', 'heroic'].map((d) => pad(d, 28)).join(' ')} result`);
for (const r of reports) {
  const cols = ['casual', 'tough', 'heroic'].map((d) => {
    const x = r.diffs.find((q) => q.difficulty === d);
    return pad(x ? `${x.bot.result === 'won' ? '✓' : '✗'} ${x.bot.lives}/${x.bot.livesMax} ${x.bot.earned}c ${mmss(x.bot.seconds)} ${x.bot.strategy[0]}` : '-', 28);
  });
  console.log(`${pad(r.id, 7)} ${pad(r.name.slice(0, 22), 22)} ${pad(r.mode, 11)} ${cols.join(' ')} ${r.ok ? 'PASS' : 'FAIL'}`);
  for (const e of r.errors) console.log(`        ✗ ${e}`);
  for (const w of r.warnings) console.log(`        ! ${w}`);
}
mkdirSync('reports', { recursive: true });
writeFileSync('reports/levels.json', JSON.stringify(reports, null, 1));
const failed = reports.filter((r) => !r.ok);
console.log(`\n${reports.length} levels, ${reports.length - failed.length} passed, ${failed.length} failed in ${((performance.now() - t0) / 1000).toFixed(1)} s with ${n} workers. Report: reports/levels.json`);
process.exit(failed.length ? 1 : 0);
