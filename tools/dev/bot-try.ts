// Dev helper: run the reference bot on one level. Usage: node tools/dev/bot-try.ts <level-file> [difficulty...]
import { runBot, runIdle } from '../../src/bot/bot.ts';
import { loadBalance, loadLevelFile } from '../lib/data.ts';

const [file = 'data/levels/z1/z1-01.json', ...diffs] = process.argv.slice(2);
const b = loadBalance();
const lv = loadLevelFile(file);
for (const d of (diffs.length ? diffs : ['casual', 'tough', 'heroic']) as ('casual' | 'tough' | 'heroic')[]) {
  const t0 = performance.now();
  const r = runBot(lv, b, d);
  const idle = runIdle(lv, b, d);
  console.log(`${lv.id} ${d.padEnd(6)} bot ${r.result.padEnd(4)} lives ${r.lives}/${r.livesMax} waves ${r.waves} towers ${r.towers} upg ${r.upgrades} earned ${r.earned} ${Math.round(r.seconds)}s p95 ${r.peak95.toFixed(2)} | idle ${idle.result} | ${Math.round(performance.now() - t0)} ms`);
}
