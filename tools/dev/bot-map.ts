// Dev helper: ASCII picture of the bot's maze when a run ends.
// Usage: node tools/dev/bot-map.ts <file> <difficulty> [waves]
import { runBot } from '../../src/bot/bot.ts';
import type { Difficulty } from '../../src/data/schemas.ts';
import { routePaths } from '../../src/sim/sim.ts';
import { loadBalance, loadLevelFile } from '../lib/data.ts';

const [file = 'data/levels/z1/z1-07.json', diff = 'heroic', upTo] = process.argv.slice(2);
const b = loadBalance();
let lv = loadLevelFile(file);
if (upTo) lv = { ...lv, waves: { ...lv.waves, count: lv.waves.count.map((n) => Math.min(n, Number(upTo))) as [number, number, number] } };
const letters: Record<string, string> = { rattler: 'R', treacle: 'T', skylark: 'S', thumper: 'M', scorcher: 'F', sparkplug: 'Z', sunbeam: 'B', icebox: 'I', teaurn: 'U', bellower: 'L', bubbler: 'O', piechucker: 'P' };
const r = runBot(lv, b, diff as Difficulty, {
  inspect: (sim) => {
    const rows = lv.tiles.map((row) => row.split(''));
    for (const p of routePaths(sim).flat()) {
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      if (rows[y]?.[x] === '.') rows[y]![x] = '·';
    }
    for (const t of sim.state.towers) rows[t.cy]![t.cx] = t.tier > 0 ? letters[t.type]!.toLowerCase() : letters[t.type]!;
    console.log(rows.map((r2) => r2.join('')).join('\n'));
  },
});
console.log(`${r.result} lives ${r.lives}/${r.livesMax} wave ${r.waves} towers ${r.towers} upgrades ${r.upgrades} earned ${r.earned} spent ${r.spent}`);
