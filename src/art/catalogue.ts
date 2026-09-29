// Every sprite the game can reference, and the per-tower art metadata the renderer
// needs. The bake writes these keys into public/assets/manifest.json (ADR-0006).
import { effectSprites } from './effects.ts';
import { enemySprites } from './enemies.ts';
import { iconSprites } from './icons.ts';
import type { SpriteSpec } from './spec.ts';
import { terrainSprites } from './terrain.ts';
import { TOWER_ART, TOWER_SCALE, towerSprites } from './towers.ts';
import { worldmapSprites } from './worldmap.ts';

export function allSprites(): SpriteSpec[] {
  return [...towerSprites(), ...enemySprites(), ...effectSprites(), ...terrainSprites(), ...iconSprites(), ...worldmapSprites()];
}

export function towerMeta(): Record<string, { headLift: number; muzzle: number; rotates: boolean }> {
  return Object.fromEntries(Object.entries(TOWER_ART).map(([k, a]) => [k, { headLift: a.headLift * TOWER_SCALE, muzzle: a.muzzle * TOWER_SCALE, rotates: a.rotates !== false }]));
}
