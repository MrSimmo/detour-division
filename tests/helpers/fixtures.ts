import { parseLevel } from '../../src/data/load.ts';
import type { BalanceDef, LevelDef } from '../../src/data/schemas.ts';
import { loadBalance } from '../../tools/lib/data.ts';
import { createSim, type Sim } from '../../src/sim/sim.ts';

let cached: BalanceDef | undefined;
export function balance(): BalanceDef {
  cached ??= loadBalance();
  return cached;
}

export interface TestLevelOpts {
  tiles: string[];
  routes?: unknown[];
  startCash?: number;
  lives?: number;
  waves?: unknown;
  tunnels?: unknown[];
  seed?: number;
  loadout?: string[];
}

/** A level whose single route runs west→east through the middle three rows by default. */
export function testLevel(o: TestLevelOpts): LevelDef {
  const rows = o.tiles.length;
  const cols = o.tiles[0]!.length;
  const mid = Math.floor(rows / 2);
  return parseLevel({
    id: 'z1-01',
    zone: 1,
    index: 1,
    name: 'Test Field',
    mode: 'standard',
    seed: o.seed ?? 1,
    grid: { cols, rows },
    tiles: o.tiles,
    routes: o.routes ?? [
      { id: 'A', entrance: { edge: 'W', from: mid - 1, to: mid + 1 }, exit: { edge: 'E', from: mid - 1, to: mid + 1 } },
    ],
    tunnels: o.tunnels ?? [],
    lives: o.lives ?? 20,
    startCash: o.startCash ?? 1000,
    loadout: { bot: o.loadout ?? ['rattler', 'treacle', 'skylark', 'thumper'] },
    waves: o.waves ?? {
      count: [3, 4, 5],
      interval: 20,
      recipe: { b0: 4, g: 1.06, pool: [{ enemy: 'footling', from: 1, weight: 1 }] },
    },
  });
}

export function open(cols: number, rows: number): string[] {
  return Array.from({ length: rows }, () => '.'.repeat(cols));
}

export function simFor(level: LevelDef, difficulty: 'casual' | 'tough' | 'heroic' = 'casual', seed?: number): Sim {
  return createSim({ level, balance: balance(), difficulty, ...(seed === undefined ? {} : { seed }) });
}
