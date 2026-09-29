// Music threat (DESIGN.md §17.2): how close the field is to leaking, for the adaptive layers.

/** Six full-health enemies standing at the exit count as full threat. */
const FULL = 6;
/** A boss counts as this many ordinary enemies. */
const BOSS_WEIGHT = 5;

export interface ThreatUnit {
  hp: number;
  maxHp: number;
  progress: number;
  type: string;
}

/** Σ HP fraction × route progress², bosses weighted up, normalised to 0..1. */
export function musicThreat(enemies: readonly ThreatUnit[], isBoss: (type: string) => boolean): number {
  let sum = 0;
  for (const e of enemies) sum += (isBoss(e.type) ? BOSS_WEIGHT : 1) * (e.hp / e.maxHp) * e.progress * e.progress;
  return Math.min(1, sum / FULL);
}

/** Layers playing at a threat level: L0 and L1 always, L2 from 0.2, L3 above 0.5. */
export function layersFor(threat: number): 2 | 3 | 4 {
  return threat > 0.5 ? 4 : threat >= 0.2 ? 3 : 2;
}
