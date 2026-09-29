// Campaign progression (DESIGN.md §12): stars, unlocks and per-level bests. Pure data
// and functions, so the save system (M5) and the validator share one implementation.
import type { BalanceDef, Difficulty } from '../data/schemas.ts';

export interface CampaignLevel {
  id: string;
  zone: number;
  index: number;
  name: string;
  mode: 'standard' | 'suddenDeath' | 'timeTrial' | 'puzzle';
  boss: boolean;
  x: number;
  y: number;
}

export interface Campaign {
  zones: { zone: number; name: string }[];
  levels: CampaignLevel[];
}

export interface Best {
  lives: number;
  seconds: number;
  kills: number;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
  quality: 'auto' | 'high' | 'low';
  /** §19, ADR-0012: Auto prefers WebGL and falls back to WebGPU (v4). */
  renderer: 'auto' | 'webgl' | 'webgpu';
  shake: boolean;
  reducedMotion: 'auto' | 'on' | 'off';
  colourBlind: boolean;
  routes: boolean;
  keys: Record<string, string>;
  /** How far above the finger the drag ghost sits, in cells (§18.5; v3). */
  ghostOffset: number;
}

export interface Profile {
  v: number;
  stars: Record<string, number>;
  bests: Record<string, Partial<Record<Difficulty, Best>> & { endless?: number }>;
  /** Field-guide entries seen, e.g. `enemy.footling.n`, `tower.rattler`. */
  seen: Record<string, true>;
  loadouts: Record<string, string[]>;
  settings: Settings;
  /** One-time notices already shown or requests already made (v2). */
  flags: { iosExplainer?: true; persistAsked?: true };
}

/** v2 added `flags`; v3 added `settings.ghostOffset`; v4 added the renderer `auto`. Migrations live in save.ts (§20). */
export const PROFILE_VERSION = 4;

export const DEFAULT_KEYS: Record<string, string> = {
  slot1: '1',
  slot2: '2',
  slot3: '3',
  slot4: '4',
  slot5: '5',
  slot6: '6',
  cancel: 'Escape',
  pause: ' ',
  speed: 'f',
  wave: 'n',
  upgrade: 'u',
  sell: 's',
  target: 't',
  routes: 'r',
  mute: 'm',
};

export function freshProfile(): Profile {
  return {
    v: PROFILE_VERSION,
    stars: {},
    bests: {},
    seen: {},
    loadouts: {},
    settings: { master: 0.9, music: 0.7, sfx: 0.8, ui: 0.8, muted: false, quality: 'auto', renderer: 'auto', shake: true, reducedMotion: 'auto', colourBlind: false, routes: true, keys: { ...DEFAULT_KEYS }, ghostOffset: 1.4 },
    flags: {},
  };
}

const STARS: Record<Difficulty, number> = { casual: 1, tough: 2, heroic: 3 };

export function totalStars(p: Profile): number {
  let n = 0;
  for (const v of Object.values(p.stars)) n += v;
  return n;
}

export interface RunResult {
  won: boolean;
  lives: number;
  seconds: number;
  waves: number;
  kills: number;
}

/** Records a finished run. Only wins award stars; bests keep the best of each measure. */
export function recordResult(p: Profile, levelId: string, difficulty: Difficulty, r: RunResult): void {
  if (!r.won) return;
  p.stars[levelId] = Math.max(p.stars[levelId] ?? 0, STARS[difficulty]);
  const bests = (p.bests[levelId] ??= {});
  const prev = bests[difficulty];
  bests[difficulty] = prev
    ? { lives: Math.max(prev.lives, r.lives), seconds: Math.min(prev.seconds, r.seconds), kills: Math.max(prev.kills, r.kills) }
    : { lives: r.lives, seconds: r.seconds, kills: r.kills };
}

export function recordEndless(p: Profile, levelId: string, waves: number): void {
  const bests = (p.bests[levelId] ??= {});
  bests.endless = Math.max(bests.endless ?? 0, waves);
}

export function zoneOpen(p: Profile, c: Campaign, b: BalanceDef, zone: number): boolean {
  if (zone <= 1) return true;
  const finalPrev = c.levels.find((l) => l.zone === zone - 1 && l.boss);
  return (finalPrev ? (p.stars[finalPrev.id] ?? 0) > 0 : true) && totalStars(p) >= b.progression.zoneGates[zone - 1]!;
}

export function levelUnlocked(p: Profile, c: Campaign, b: BalanceDef, id: string): boolean {
  const i = c.levels.findIndex((l) => l.id === id);
  if (i <= 0) return i === 0;
  const lv = c.levels[i]!;
  if (lv.index === 1) return zoneOpen(p, c, b, lv.zone);
  return (p.stars[c.levels[i - 1]!.id] ?? 0) > 0;
}

export function endlessUnlocked(p: Profile, id: string): boolean {
  return (p.stars[id] ?? 0) > 0;
}

/** Towers the player owns, in unlock order. */
export function unlockedTowers(p: Profile, b: BalanceDef): string[] {
  const stars = totalStars(p);
  return Object.entries(b.progression.towerStars)
    .filter(([, need]) => need <= stars)
    .sort((x, y) => x[1] - y[1])
    .map(([t]) => t);
}

/** Fewest stars any player can hold on reaching a level (§12): max(minStars(k−1)+1, gate). */
export function minStars(c: Campaign, gates: readonly number[], id: string): number {
  let m = 0;
  for (let i = 0; i < c.levels.length; i++) {
    const lv = c.levels[i]!;
    m = i === 0 ? 0 : Math.max(m + 1, lv.index === 1 ? gates[lv.zone - 1]! : 0);
    if (lv.id === id) return m;
  }
  throw new Error(`unknown level ${id}`);
}
