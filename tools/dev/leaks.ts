// Dev helper: which enemies leak, and on which wave, for a level's own bot run.
// Usage: node tools/dev/leaks.ts <level-file> [difficulty] [strategy]
import { runBot, type Strategy } from '../../src/bot/bot.ts';
import type { Difficulty } from '../../src/data/schemas.ts';
import { loadBalance, loadLevelFile } from '../lib/data.ts';

const [file = 'data/levels/z1/z1-01.json', diff = 'heroic', strategy = 'greedy'] = process.argv.slice(2);
const b = loadBalance();
const lv = loadLevelFile(file);
let wave = 0;
const leaks: string[] = [];
const r = runBot(lv, b, diff as Difficulty, {
  strategy: strategy as Strategy,
  onEvent: (ev) => {
    if (ev.e === 'wave') wave = ev.index + 1;
    else if (ev.e === 'leak') leaks.push(`w${wave} ${ev.type}`);
  },
});
console.log(`${r.result} ${r.lives}/${r.livesMax} — leaks: ${leaks.join(', ') || 'none'}`);
