// Level tuner (M3): adjusts only a level's HP scale (recipe.hp) until every difficulty is won
// by the bot AND Heroic costs it real lives (at least 2 fewer than Casual, margin ≤ 0.8).
// Bigger waves pay more bounty and barely change difficulty; tougher troops do. Writes the file.
// Timed modes can't be read by lives (Sudden Death gives Heroic one life; Time Trial is about the
// clock), so for them it finds the hardest scale the bot still wins everywhere and backs off from it.
// Usage: node tools/tune-level.ts <level-file> [maxIterations]
import { readFileSync, writeFileSync } from 'node:fs';
import type { Campaign } from '../src/meta/progression.ts';
import { loadBalance, readJson } from './lib/data.ts';
import { validateLevel } from './lib/validate.ts';

const [file, maxIt = '16'] = process.argv.slice(2);
if (!file) throw new Error('usage: tune-level.ts <level-file> [maxIterations]');
const b = loadBalance();
const campaign = readJson('data/campaign.json') as Campaign;
const raw = JSON.parse(readFileSync(file, 'utf8')) as { mode: string; waves: { recipe: { hp?: number } } };
if (raw.mode === 'puzzle') throw new Error('puzzles are tuned by hand (their plan is the solution)');
raw.waves.recipe.hp ??= 1;
const timed = raw.mode === 'suddenDeath' || raw.mode === 'timeTrial';
const EDGE_BACKOFF = 1.1;
let lastGood: string | null = null;
let step = 1.25;
let dir = 0;
for (let i = 0; i < Number(maxIt); i++) {
  writeFileSync(file, JSON.stringify(raw, null, 1) + '\n');
  const rep = validateLevel(file, b, campaign);
  const get = (d: string) => rep.diffs.find((x) => x.difficulty === d);
  const c = get('casual');
  const h = get('heroic');
  const allWon = rep.diffs.length === 3 && rep.diffs.every((d) => d.bot.result === 'won');
  const tight = !timed && Boolean(allWon && c && h && h.bot.lives <= c.bot.lives - 2 && h.margin <= 0.8);
  const line = rep.diffs.map((d) => `${d.difficulty[0]}:${d.bot.result === 'won' ? d.bot.lives : 'x'}`).join(' ');
  console.log(`hp ${raw.waves.recipe.hp!.toFixed(3)}  ${line}  ${rep.ok ? (tight ? 'PASS' : 'pass (too easy)') : rep.errors[0]}`);
  if (rep.ok && tight) {
    lastGood = JSON.stringify(raw, null, 1);
    break;
  }
  if (rep.ok) lastGood = JSON.stringify(raw, null, 1);
  const want = allWon ? 1 : -1;
  if (dir !== 0 && want !== dir) step = Math.sqrt(step);
  dir = want;
  raw.waves.recipe.hp = Math.round(raw.waves.recipe.hp! * (want > 0 ? step : 1 / step) * 1000) / 1000;
  if (step < 1.02 && lastGood) break;
}
if (lastGood && timed) {
  const edge = JSON.parse(lastGood) as typeof raw;
  edge.waves.recipe.hp = Math.round((edge.waves.recipe.hp! / EDGE_BACKOFF) * 1000) / 1000;
  writeFileSync(file, JSON.stringify(edge, null, 1) + '\n');
  const rep = validateLevel(file, b, campaign);
  console.log(`edge ${JSON.parse(lastGood).waves.recipe.hp}, backed off to ${edge.waves.recipe.hp}: ${rep.ok ? 'pass' : rep.errors[0]}`);
  if (rep.ok) lastGood = JSON.stringify(edge, null, 1);
}
if (lastGood) {
  writeFileSync(file, lastGood + '\n');
  console.log(`kept hp ${JSON.parse(lastGood).waves.recipe.hp}`);
} else console.log('no passing version found: rework the level');
