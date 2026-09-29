// ADR-0007: waves are expanded from the level recipe when the level loads, so the
// next-wave preview is exact and every run of a level faces the same waves.
import { DIFFICULTIES, type BalanceDef, type Difficulty, type GroupDef, type LevelDef } from '../data/schemas.ts';
import { GROUP_STAGGER_S, GROUPS_FROM_WAVE, LEVEL_WAVE_SALT, TICK_HZ } from './constants.ts';
import { ipow } from './core/math.ts';
import { rngFrom, rngNext, type Rng } from './core/rng.ts';

export interface GroupRT {
  enemy: string;
  count: number;
  elite: boolean;
  route: number;
  /** Ticks between spawns. */
  spacing: number;
  /** Ticks after the wave launches. */
  delay: number;
}

export interface WaveRT {
  groups: GroupRT[];
  /** Total bounty of the wave (the early-call bonus is a share of it). */
  bounty: number;
  threat: number;
  air: boolean;
  elite: boolean;
}

/** Bounty for one kill (§7). Puzzle levels pay nothing. */
export function enemyBounty(balance: BalanceDef, level: LevelDef, difficulty: Difficulty, type: string, elite: boolean, waveIndex: number): number {
  if (level.mode === 'puzzle') return 0;
  const e = balance.enemies[type]!;
  const raw =
    e.bounty *
    (elite ? e.elite.bountyMul : 1) *
    balance.economy.zoneBounty[level.zone - 1]! *
    balance.difficulty[difficulty].bounty *
    (1 + balance.economy.bountyGrowth * waveIndex);
  return Math.max(1, Math.round(raw));
}

/** Spawn HP (§9.3). */
export function enemyHp(balance: BalanceDef, level: LevelDef, difficulty: Difficulty, type: string, elite: boolean, waveIndex: number): number {
  const e = balance.enemies[type]!;
  const puzzle = level.mode === 'puzzle';
  return (
    e.hp *
    (elite ? e.elite.hpMul : 1) *
    (1 + balance.economy.hpGrowth * waveIndex) *
    level.waves.recipe.hp *
    balance.economy.zoneHp[level.zone - 1]! *
    (puzzle ? 1 : balance.difficulty[difficulty].hp)
  );
}

function pickWeighted<T extends { weight: number }>(rng: Rng, items: T[]): T {
  let total = 0;
  for (const it of items) total += it.weight;
  let r = rngNext(rng) * total;
  for (const it of items) {
    r -= it.weight;
    if (r < 0) return it;
  }
  return items[items.length - 1]!;
}

/** `endless` continues the recipe past the scripted waves (§9.4). */
export function expandWaves(def: LevelDef, balance: BalanceDef, difficulty: Difficulty, endless = false): WaveRT[] {
  const diffIndex = DIFFICULTIES.indexOf(difficulty);
  const E = balance.modes.endless;
  const base = def.waves.count[diffIndex]!;
  const count = endless ? base + E.extraWaves : base;
  const recipe = def.waves.recipe;
  const rng = rngFrom(def.seed * LEVEL_WAVE_SALT + diffIndex);
  const routeIndex = new Map(def.routes.map((r, i) => [r.id, i]));
  const groundRoutes = def.routes.map((r, i) => (r.airOnly ? -1 : i)).filter((i) => i >= 0);
  const allRoutes = def.routes.map((_, i) => i);
  const eliteExtra = balance.difficulty[difficulty].eliteExtra;
  const waves: WaveRT[] = [];

  const resolve = (g: GroupDef, gi: number, w: number): GroupRT => {
    const e = balance.enemies[g.enemy];
    if (!e) throw new Error(`${def.id}: wave ${w} uses unknown enemy '${g.enemy}'`);
    let route: number;
    if (g.route !== undefined) {
      const r = routeIndex.get(g.route);
      if (r === undefined) throw new Error(`${def.id}: wave ${w} uses unknown route '${g.route}'`);
      if (!e.air && def.routes[r]!.airOnly) throw new Error(`${def.id}: wave ${w} sends ground '${g.enemy}' down air-only route ${g.route}`);
      route = r;
    } else {
      const pool = e.air ? allRoutes : groundRoutes;
      route = pool[(w + gi) % pool.length]!;
    }
    return {
      enemy: g.enemy,
      count: g.count,
      elite: g.elite,
      route,
      spacing: Math.max(1, Math.round((g.spacing ?? e.spacing) * TICK_HZ)),
      delay: Math.round(g.delay * TICK_HZ),
    };
  };

  for (let i = 0; i < count; i++) {
    const w = i + 1;
    const override = def.waves.overrides.find((o) => o.wave === w && (!o.difficulties || o.difficulties.includes(difficulty)));
    let groups: GroupRT[];
    let airWave = false;
    let eliteWave = false;
    if (override) {
      groups = override.groups.map((g, gi) => resolve(g, gi, w));
    } else {
      const budget = recipe.b0 * ipow(recipe.g, i);
      airWave = recipe.airEvery > 0 && w % recipe.airEvery === 0;
      eliteWave = recipe.eliteEvery > 0 && recipe.eliteFrom > 0 && w >= recipe.eliteFrom && (w - recipe.eliteFrom) % recipe.eliteEvery === 0;
      const inRange = recipe.pool.filter((p) => p.from <= w && (p.to === undefined || p.to >= w));
      let candidates = inRange.filter((p) => !airWave || balance.enemies[p.enemy]?.air);
      if (candidates.length === 0) {
        airWave = false;
        candidates = inRange;
      }
      if (candidates.length === 0) throw new Error(`${def.id}: no enemies in the pool for wave ${w}`);
      let eliteShare = 0;
      if (recipe.eliteFrom > 0 && w >= recipe.eliteFrom) {
        const span = Math.max(1, base - recipe.eliteFrom + 1);
        eliteShare = Math.min(1, (recipe.eliteShareMax * Math.min(w - recipe.eliteFrom + 1, span)) / span + eliteExtra);
      }
      // Endless: the elite share climbs to 100% over eliteRampWaves beyond the script.
      if (w > base) eliteShare = Math.max(eliteShare, Math.min(1, (w - base) / E.eliteRampWaves));
      let nGroups = 1;
      for (const from of GROUPS_FROM_WAVE) if (w >= from) nGroups++;
      nGroups = Math.min(nGroups, candidates.length);
      const shares: number[] = [];
      let shareTotal = 0;
      for (let k = 0; k < nGroups; k++) {
        const s = 1 + rngNext(rng);
        shares.push(s);
        shareTotal += s;
      }
      let remaining = candidates.slice();
      groups = [];
      for (let k = 0; k < nGroups; k++) {
        const pick = pickWeighted(rng, remaining);
        remaining = remaining.filter((p) => p !== pick);
        const e = balance.enemies[pick.enemy]!;
        const elite = eliteWave || rngNext(rng) < eliteShare;
        const unit = e.threat * (elite ? e.elite.threatMul : 1);
        let n = Math.max(1, Math.round((budget * shares[k]!) / shareTotal / unit));
        if (e.pack) n = Math.min(Math.max(n, e.pack[0]), e.pack[1]);
        groups.push(resolve({ enemy: pick.enemy, count: n, elite, delay: k * GROUP_STAGGER_S }, k, w));
      }
      if (w > base && w % E.bossEvery === 0) groups.push(resolve({ enemy: E.bosses[def.zone - 1]!, count: 1, elite: false, delay: nGroups * GROUP_STAGGER_S }, nGroups, w));
    }
    let bounty = 0;
    let threat = 0;
    for (const g of groups) {
      const e = balance.enemies[g.enemy]!;
      bounty += g.count * enemyBounty(balance, def, difficulty, g.enemy, g.elite, i);
      threat += g.count * e.threat * (g.elite ? e.elite.threatMul : 1);
    }
    waves.push({
      groups,
      bounty,
      threat,
      air: groups.every((g) => balance.enemies[g.enemy]!.air),
      elite: eliteWave || groups.every((g) => g.elite),
    });
  }
  return waves;
}
