// Node-side loaders for balance and level JSON (tests, validator, bench).
import { readFileSync, readdirSync } from 'node:fs';
import { parseBalance, parseLevel } from '../../src/data/load.ts';
import type { BalanceDef, LevelDef } from '../../src/data/schemas.ts';

const root = new URL('../../', import.meta.url);
const BALANCE_FILES = ['towers', 'enemies', 'damage', 'economy', 'difficulty', 'terrain', 'progression', 'modes'] as const;

export function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
}

export function loadBalance(): BalanceDef {
  const raw: Record<string, unknown> = {};
  for (const f of BALANCE_FILES) raw[f] = readJson(`data/balance/${f}.json`);
  return parseBalance(raw);
}

export function loadLevelFile(rel: string): LevelDef {
  return parseLevel(readJson(rel));
}

/** Every level file under data/levels, sorted by id. */
export function loadAllLevels(): LevelDef[] {
  const out: LevelDef[] = [];
  // Zone folders only: Finder leaves .DS_Store files beside them.
  for (const zone of readdirSync(new URL('data/levels/', root)).filter((n) => /^z\d$/.test(n)).sort()) {
    for (const f of readdirSync(new URL(`data/levels/${zone}/`, root)).sort()) {
      if (f.endsWith('.json')) out.push(loadLevelFile(`data/levels/${zone}/${f}`));
    }
  }
  return out;
}
