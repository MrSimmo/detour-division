// `npm run bench` (DESIGN.md §19, R-PERF-1): a headless stress scenario for the simulation.
// 300 enemies are kept on the field of a real level while towers of several kinds fire into them,
// at 3× speed (three ticks per frame). Reports tick times and heap growth, and fails over budget.
// The §19 budget is 2 ms per tick at p95 under 4× CPU throttling in Chromium; unthrottled here, the
// same budget is 0.5 ms. The throttled browser trace is e2e/perf.spec.ts.
import { spawnEnemy } from '../src/sim/enemies.ts';
import { apply, createSim, step } from '../src/sim/sim.ts';
import { loadBalance, loadLevelFile } from './lib/data.ts';

const LEVEL = process.argv[2] ?? 'data/levels/z3/z3-04.json';
const ENEMIES = 300;
const SECONDS = 60;
const BUDGET_P95_MS = 2 / 4;

const b = loadBalance();
const lv = loadLevelFile(LEVEL);
// Six kinds (a level's most) that between them cover hitscan, lobbed, chain, pulse, beam and splash fire.
const kinds = ['rattler', 'thumper', 'sparkplug', 'icebox', 'sunbeam', 'piechucker'];
const sim = createSim({ level: lv, balance: b, difficulty: 'heroic', seed: 7, loadout: kinds });
sim.state.cash = 1e9;
sim.state.lives = 1e9;
// Towers on a sparse grid (a solid line would block the route and be refused).
let built = 0;
let tried = 0;
for (let y = 1; y < lv.grid.rows - 1 && built < 40; y += 2) {
  for (let x = 1; x < lv.grid.cols - 1 && built < 40; x += 3) {
    const r = apply(sim, { t: 'build', tower: kinds[tried++ % kinds.length]!, cx: x, cy: y });
    if (r.ok) built++;
  }
}
const types = ['footling', 'scarper', 'tinkettle', 'brolly', 'trio', 'whirligig', 'sawbones', 'tubthumper'];
let k = 0;
const topUp = (): void => {
  while (sim.state.enemies.length < ENEMIES) spawnEnemy(sim, types[k++ % types.length]!, k % sim.level.routes.length);
};
topUp();
// Warm up the JIT before measuring.
for (let i = 0; i < 300; i++) {
  step(sim);
  topUp();
}
const heapStart = process.memoryUsage().heapUsed;
const times: number[] = [];
const ticks = SECONDS * 30;
for (let i = 0; i < ticks; i++) {
  const t0 = performance.now();
  step(sim);
  times.push(performance.now() - t0);
  topUp();
  sim.events = [];
}
global.gc?.();
const heapGrowth = (process.memoryUsage().heapUsed - heapStart) / 1048576;
times.sort((a, z) => a - z);
const at = (p: number): number => times[Math.min(times.length - 1, Math.floor(times.length * p))]!;
console.log(`${lv.id}: ${built} towers, ${ENEMIES} enemies kept on the field, ${ticks} ticks (${SECONDS} s of play)`);
console.log(`tick p50 ${at(0.5).toFixed(3)} ms · p95 ${at(0.95).toFixed(3)} ms · max ${times[times.length - 1]!.toFixed(3)} ms (budget p95 ${BUDGET_P95_MS} ms unthrottled)`);
console.log(`frame at 3× (three ticks) p95 ≈ ${(at(0.95) * 3).toFixed(3)} ms · heap change ${heapGrowth.toFixed(1)} MB`);
if (at(0.95) > BUDGET_P95_MS) {
  console.log('OVER BUDGET');
  process.exit(1);
}
