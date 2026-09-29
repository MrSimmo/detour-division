import { BalanceZ, LevelZ, type BalanceDef, type LevelDef } from './schemas.ts';

export function parseBalance(raw: unknown): BalanceDef {
  return BalanceZ.parse(raw);
}

export function parseLevel(raw: unknown): LevelDef {
  return LevelZ.parse(raw);
}
