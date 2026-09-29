// Validation of one level file (DESIGN.md §15). Shared by the validate-levels workers.
import { runBest, runBot, runIdle, type BotRun } from '../../src/bot/bot.ts';
import { DIFFICULTIES, type BalanceDef, type Difficulty, type LevelDef } from '../../src/data/schemas.ts';
import { minStars, type Campaign } from '../../src/meta/progression.ts';
import { prepareLevel } from '../../src/sim/level.ts';
import { createSim } from '../../src/sim/sim.ts';
import { loadLevelFile } from './data.ts';

export interface DiffReport {
  difficulty: Difficulty;
  bot: Omit<BotRun, 'hash'>;
  idle: BotRun['result'];
  margin: number;
}

export interface LevelReport {
  file: string;
  id: string;
  name: string;
  mode: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  diffs: DiffReport[];
  wallMs: number;
}

/** §8: Heroic is measurably harder than Casual. */
export function harder(casual: BotRun, heroic: BotRun): boolean {
  if (heroic.lives <= casual.lives - 2) return true;
  return heroic.lives === heroic.livesMax && casual.lives === casual.livesMax && heroic.peak95 >= casual.peak95 + 0.05;
}

export function validateLevel(file: string, b: BalanceDef, campaign: Campaign): LevelReport {
  const t0 = performance.now();
  const rep: LevelReport = { file, id: '?', name: '?', mode: '?', ok: false, errors: [], warnings: [], diffs: [], wallMs: 0 };
  let lv: LevelDef;
  try {
    lv = loadLevelFile(file);
  } catch (e) {
    rep.errors.push(`schema: ${(e as Error).message.slice(0, 600)}`);
    rep.wallMs = performance.now() - t0;
    return rep;
  }
  rep.id = lv.id;
  rep.name = lv.name;
  rep.mode = lv.mode;
  const entry = campaign.levels.find((l) => l.id === lv.id);
  if (!entry) rep.errors.push('not listed in data/campaign.json');
  else {
    if (entry.name !== lv.name) rep.errors.push(`name '${lv.name}' differs from campaign '${entry.name}'`);
    if (entry.mode !== lv.mode) rep.errors.push(`mode '${lv.mode}' differs from campaign '${entry.mode}'`);
    if (entry.zone !== lv.zone || entry.index !== lv.index) rep.errors.push('zone/index differ from campaign');
  }
  for (const t of [...lv.loadout.bot, ...(lv.loadout.fixed ?? [])]) if (!b.towers[t]) rep.errors.push(`unknown tower '${t}' in loadout`);
  if (!lv.loadout.fixed && entry) {
    const have = minStars(campaign, b.progression.zoneGates, lv.id);
    const late = lv.loadout.bot.filter((t) => (b.progression.towerStars[t] ?? Infinity) > have);
    if (late.length) rep.errors.push(`R-PROG-1: bot loadout uses ${late.join(', ')} before a Casual-only player has it (${have} stars)`);
  }
  try {
    for (const d of DIFFICULTIES) prepareLevel(lv, b, d);
  } catch (e) {
    rep.errors.push(`structure: ${(e as Error).message}`);
  }
  if (rep.errors.length) {
    rep.wallMs = performance.now() - t0;
    return rep;
  }
  // Connectivity on the empty map.
  const sim = createSim({ level: lv, balance: b, difficulty: 'casual' });
  for (const r of sim.level.routes) {
    if (r.airOnly) continue;
    if (!r.entrance.cells.some((c) => Number.isFinite(sim.fields[r.exitIndex]!.dist[c]!))) rep.errors.push(`route ${r.id}: entrance cannot reach its exit`);
  }
  if ((lv.mode === 'suddenDeath' || lv.mode === 'timeTrial') && lv.modeParams.timer) {
    DIFFICULTIES.forEach((d, i) => {
      const covered = lv.waves.count[i]! * lv.waves.interval;
      if (covered < lv.modeParams.timer![i]!) rep.errors.push(`${d}: waves run out after ${covered}s, before the ${lv.modeParams.timer![i]}s timer`);
    });
  }
  const runs: Partial<Record<Difficulty, BotRun>> = {};
  for (const d of DIFFICULTIES) {
    const bot = runBest(lv, b, d);
    const idle = runIdle(lv, b, d);
    runs[d] = bot;
    const { hash: _hash, ...summary } = bot;
    rep.diffs.push({ difficulty: d, bot: summary, idle: idle.result, margin: bot.lives / bot.livesMax });
    if (bot.result !== 'won') rep.errors.push(`${d}: the bot did not win (${bot.result} on wave ${bot.waves}, ${bot.lives} lives)`);
    if (idle.result === 'won') rep.errors.push(`${d}: won with no towers`);
  }
  if (runs.casual && runs.heroic && !harder(runs.casual, runs.heroic)) {
    rep.errors.push(`Heroic is not measurably harder than Casual (lives ${runs.heroic.lives} vs ${runs.casual.lives}, p95 ${runs.heroic.peak95.toFixed(2)} vs ${runs.casual.peak95.toFixed(2)})`);
  }
  const again = runBot(lv, b, 'casual', { strategy: runs.casual?.strategy ?? 'greedy', ...(runs.casual?.seed === undefined ? {} : { seed: runs.casual.seed }) });
  if (runs.casual && again.hash !== runs.casual.hash) rep.errors.push('determinism: two casual bot runs differ');
  rep.ok = rep.errors.length === 0;
  rep.wallMs = performance.now() - t0;
  return rep;
}
