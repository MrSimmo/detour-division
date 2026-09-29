// Dev helper for re-tuning a puzzle whose reference plan stopped winning (§15.1, ADR-0008): moves one
// build of `bot.plan` to each free ground cell within `radius` (the plan's upgrades and targeting at that
// cell follow it), keeps the moves that win all three difficulties on the level's seed, then ranks them
// by wins over 5 seeds × 3 difficulties, a guard against picking another knife-edge plan. Prints only;
// edit the chosen move into the level JSON by hand, then re-run validate-levels.
// Usage: node tools/dev/plan-search.ts <level-file> [radius]
import { runBot } from '../../src/bot/bot.ts';
import type { Difficulty, PlanStep } from '../../src/data/schemas.ts';
import { loadBalance, loadLevelFile } from '../lib/data.ts';

const [file, radius = '2'] = process.argv.slice(2);
if (!file) throw new Error('usage: plan-search.ts <level-file> [radius]');
const b = loadBalance();
const lv = loadLevelFile(file);
const base = lv.bot.plan ?? [];
const DIFFS: Difficulty[] = ['casual', 'tough', 'heroic'];

const moved = (fx: number, fy: number, tx: number, ty: number): PlanStep[] =>
  base.map((s) => {
    const k = Object.keys(s).find((key) => key !== 'wave') as keyof PlanStep;
    const p = s[k] as { cx?: number; cy?: number };
    return p && p.cx === fx && p.cy === fy ? ({ ...s, [k]: { ...p, cx: tx, cy: ty } } as PlanStep) : s;
  });
const run = (plan: PlanStep[], seeds: number): { wins: number; lives: number[] } => {
  const lives: number[] = [];
  let wins = 0;
  for (let s = 0; s < seeds; s++) {
    for (const d of DIFFS) {
      const r = runBot(lv, b, d, { plan, generic: false, seed: lv.seed + s });
      lives.push(r.lives);
      if (r.result === 'won') wins++;
    }
  }
  return { wins, lives };
};

const now = run(base, 5);
console.log(`plan as it is: ${now.wins}/15 wins over 5 seeds (level seed: ${now.lives.slice(0, 3).join('/')} lives)`);
const found: { move: string; wins: number; lives: number[] }[] = [];
for (const s of base) {
  if (!s.build) continue;
  const { cx, cy, tower } = s.build;
  const r = Number(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      if ((!dx && !dy) || lv.tiles[ty]?.[tx] !== '.' || base.some((o) => o.build?.cx === tx && o.build?.cy === ty)) continue;
      const plan = moved(cx, cy, tx, ty);
      if (run(plan, 1).wins < 3) continue;
      const all = run(plan, 5);
      found.push({ move: `${tower} ${cx},${cy} → ${tx},${ty}`, wins: all.wins, lives: all.lives });
    }
  }
}
found.sort((p, q) => q.wins - p.wins);
console.log(`${found.length} single moves win every difficulty on the level's seed; best over 5 seeds:`);
for (const f of found.slice(0, 10)) console.log(`  ${f.move.padEnd(26)} ${f.wins}/15  lives ${f.lives.join(' ')}`);
