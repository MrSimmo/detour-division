// The live simulation object: plain-data state plus derived structures that are
// rebuilt from it (grid, fields, spatial index) and the static level/balance inputs.
import type { BalanceDef, Immunity, TraitsDef } from '../data/schemas.ts';
import type { GridRT } from './grid.ts';
import type { LevelRT } from './level.ts';
import type { Field } from './path.ts';
import type { Spatial } from './spatial.ts';
import type { Enemy, SimEvent, SimState } from './types.ts';

export interface Turn {
  c: number;
  s: number;
}

/** Per-tick values derived once from balance data (cos/sin of per-tick turn angles). */
export interface Derived {
  enemyTurn: Record<string, Turn>;
  turretTurn: Record<string, Turn>;
  aimCos: Record<string, number>;
  /** Keyed `${tower}.${tier}`. */
  projTurn: Record<string, Turn>;
  /** cos(cone/2) keyed `${tower}.${tier}`. */
  coneCos: Record<string, number>;
  /** Merged traits and immunities keyed `${enemy}.${elite ? 1 : 0}`. */
  traits: Record<string, { traits: TraitsDef; immune: Set<Immunity> }>;
  /** Unit vectors for evenly spaced bomblets / salvos, keyed by count. */
  ring: Record<number, { x: number; y: number }[]>;
}

export interface Sim {
  level: LevelRT;
  balance: BalanceDef;
  rt: Derived;
  state: SimState;
  grid: GridRT;
  /** One field per distinct exit (level.exits order). */
  fields: Field[];
  /** One field per route leading back to its entrance (reversal and bubbles). */
  entryFields: Field[];
  events: SimEvent[];
  spatial: Spatial;
  byId: Map<number, Enemy>;
}
