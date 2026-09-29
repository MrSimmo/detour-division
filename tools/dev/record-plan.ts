// Dev helper for puzzle authoring (§15.1): run the generic bot with every strategy on one difficulty,
// and turn the best winning run's commands into a `bot.plan`. With --write the plan becomes the
// level's reference solution (generic: false). Always re-run validate-levels afterwards.
// Usage: node tools/dev/record-plan.ts <level-file> [difficulty] [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { runBot, STRATEGIES } from '../../src/bot/bot.ts';
import type { Difficulty, PlanStep } from '../../src/data/schemas.ts';
import { loadBalance, loadLevelFile } from '../lib/data.ts';

const args = process.argv.slice(2);
const write = args.includes('--write');
const [file, difficulty = 'heroic'] = args.filter((a) => a !== '--write');
if (!file) throw new Error('usage: record-plan.ts <level-file> [difficulty] [--write]');
const b = loadBalance();
const lv = loadLevelFile(file);

let best: { plan: PlanStep[]; lives: number; strategy: string; seed: number } | null = null;
for (const strategy of STRATEGIES) {
  for (const seed of [lv.seed, lv.seed + 1]) {
    const plan: PlanStep[] = [];
    let launched = 0;
    // Commands are queued before the tick that launches a wave, so counting 'wave' events in order
    // gives the number of waves launched when each command was issued.
    const r = runBot(lv, b, difficulty as Difficulty, {
      plan: [],
      generic: true,
      strategy,
      seed,
      onEvent: (ev) => {
        if (ev.e === 'wave') launched++;
        else if (ev.e === 'build') plan.push({ wave: launched, build: { tower: ev.ttype, cx: ev.cx, cy: ev.cy } });
        else if (ev.e === 'upgrade') plan.push({ wave: launched, upgrade: { cx: ev.cx, cy: ev.cy } });
        else if (ev.e === 'sell') plan.push({ wave: launched, sell: { cx: ev.cx, cy: ev.cy } });
        else if (ev.e === 'clear') plan.push({ wave: launched, clear: { cx: ev.cx, cy: ev.cy } });
      },
    });
    console.log(`${strategy.padEnd(10)} seed ${seed}: ${r.result} ${r.lives}/${r.livesMax}, ${plan.length} steps`);
    if (r.result === 'won' && (!best || r.lives > best.lives)) best = { plan, lives: r.lives, strategy, seed };
  }
}
if (!best) {
  console.log('no winning run to record');
  process.exit(1);
}
console.log(`best: ${best.strategy} seed ${best.seed}, ${best.lives} lives, ${best.plan.length} steps`);
if (write) {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { bot?: unknown };
  raw.bot = { plan: best.plan, generic: false };
  writeFileSync(file, JSON.stringify(raw, null, 1) + '\n');
  console.log(`wrote the plan to ${file}`);
} else console.log(JSON.stringify(best.plan));
