// Bundled game data. Validated with the same Zod schemas the tests and validator use.
import damage from '../../data/balance/damage.json';
import difficulty from '../../data/balance/difficulty.json';
import economy from '../../data/balance/economy.json';
import enemies from '../../data/balance/enemies.json';
import modes from '../../data/balance/modes.json';
import progression from '../../data/balance/progression.json';
import terrain from '../../data/balance/terrain.json';
import towers from '../../data/balance/towers.json';
import { parseBalance, parseLevel } from '../data/load.ts';
import type { BalanceDef, LevelDef } from '../data/schemas.ts';

export const balance: BalanceDef = parseBalance({ towers, enemies, damage, economy, difficulty, terrain, progression, modes });

const files = import.meta.glob('../../data/levels/**/*.json', { eager: true, import: 'default' });

export const levels: Record<string, LevelDef> = {};
for (const raw of Object.values(files)) {
  const lv = parseLevel(raw);
  levels[lv.id] = lv;
}
