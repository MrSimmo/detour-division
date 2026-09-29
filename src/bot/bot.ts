// The reference bot (DESIGN.md §15.1): deterministic, sensible, not optimal. It only
// uses the public simulation API, so a win proves a player could win the same way.
import type { BalanceDef, Difficulty, LevelDef, PlanStep, TowerDef, TowerTierDef } from '../data/schemas.ts';
import { TICK_HZ } from '../sim/constants.ts';
import type { Sim } from '../sim/context.ts';
import { cellIndex, spanOutside } from '../sim/level.ts';
import { apply, checkPlacement, createSim, drainEvents, hashSim, routePaths, step } from '../sim/sim.ts';
import type { SimEvent, Tower } from '../sim/types.ts';

/** Decisions happen this often (ticks). */
const DECIDE_EVERY = 15;
/** Value of one extra cell of route length, in "damage-per-second × cell" units. */
const W_LENGTH = 9;
/** Bonus for building against something solid (grows walls rather than islands). */
const W_WALL = 1.5;
/** Crowd-control and support towers are valued as if they added this much damage per covered cell. */
const W_CONTROL = 7;
/** Air units coming within this many waves make anti-air a priority. */
const AIR_LOOKAHEAD = 3;
/** Hard stop for a run (sim seconds). */
const MAX_SECONDS = 4 * 3600;
/** Serpentine walls every this many cells across the main axis (a wall and a two-lane gap). */
const WALL_PITCH = 3;
/** Preference for the next serpentine cell (its length pays off only once the wall closes). */
const W_PLAN = 40;

export interface BotRun {
  result: 'won' | 'lost' | 'timeout';
  strategy: Strategy;
  /** In-play seed of the run (spawn points and lanes). */
  seed?: number;
  lives: number;
  livesMax: number;
  seconds: number;
  earned: number;
  spent: number;
  towers: number;
  upgrades: number;
  kills: number;
  leaks: number;
  waves: number;
  /** 95th percentile of route progress at death over the last third of the waves (§8). */
  peak95: number;
  planUsed: boolean;
  hash: string;
}

/** Fraction of a hit that gets through `armour` (§6 resolution, ignoring shields and cover). */
function throughArmour(b: BalanceDef, t: TowerTierDef, armour: number): number {
  const hit = t.damage > 0 ? t.damage : 1;
  const eff = Math.max(0, armour - t.armourPen) * (1 - b.damage.types[t.dmgType].pen);
  return Math.max(b.damage.minChip, (hit - eff) / hit);
}

/** Rough damage per second of a tower tier against `armour`, for comparing options (not used by the sim). */
export function tierDps(def: TowerDef, t: TowerTierDef, b?: BalanceDef, armour = 0): number {
  const k = b ? throughArmour(b, t, armour) : 1;
  return k * rawDps(def, t);
}

function rawDps(def: TowerDef, t: TowerTierDef): number {
  switch (def.kind) {
    case 'hitscan':
      return t.damage * t.rate * (t.splash > 0 ? 2 : 1);
    case 'homing':
      return t.damage * t.rate * t.salvo * (t.splash > 0 ? 1.4 : 1);
    case 'lob':
      return t.damage * t.rate * t.salvo * (1 + t.splash * 2) + t.bomblets * t.bombletDamage * t.rate;
    case 'cone':
      return t.damage * 2 + t.burnDps;
    case 'chain':
      return t.damage * t.rate * (1 + t.jumps * 0.6);
    case 'beam':
      return t.damage * t.rate * 2.5;
    case 'pulse':
      return t.damage * t.rate * 3;
    default:
      return 0;
  }
}

function controlValue(def: TowerDef, t: TowerTierDef): number {
  if (def.kind === 'pulse') return W_CONTROL * t.freeze * t.rate * 4;
  if (def.kind === 'bellow') return W_CONTROL * t.reverse * t.rate * 3;
  if (def.kind === 'bubble') return W_CONTROL * t.bubbles * t.bubbleDur * t.rate * 2;
  if (t.slow > 0) return W_CONTROL * t.slow * 2;
  return 0;
}

interface Ctx {
  sim: Sim;
  b: BalanceDef;
  loadout: string[];
  /** Cells on the current ground routes (with multiplicity per route). */
  routeCells: number[];
  airPts: { x: number; y: number }[];
  pathV: number;
  lenNow: number;
  upgrades: number;
  /** Weight of air-lane coverage, from the air share of the coming waves. */
  airWeight: number;
  /** Serpentine wall cells still to build. */
  walls: Set<number>;
  /** Threat-weighted armour of the coming waves. */
  armour: number;
  strategy: Strategy;
}

/**
 * Three playing styles (§15.1). The validator keeps the best result per difficulty, so a level
 * counts as winnable if any sensible style wins it.
 * - greedy: best value per coin anywhere near the road, with a soft bonus for serpentine walls
 * - serpentine: finishes the serpentine walls before anything else (anti-air and upgrades aside)
 * - upgrader: greedy, but values upgrades more highly
 */
export type Strategy = 'greedy' | 'serpentine' | 'upgrader' | 'fort';
export const STRATEGIES: readonly Strategy[] = ['greedy', 'serpentine', 'upgrader', 'fort'];
const UPGRADE_BIAS: Record<Strategy, number> = { greedy: 1, serpentine: 1, upgrader: 1.8, fort: 1.3 };
/** Fort: the first towers stay within this many cells of an exit, where every road converges. */
const FORT_RADIUS = 4.5;
const FORT_TOWERS = 10;

/** Threat-weighted armour of the next few waves (elites and bosses included). */
function comingArmour(sim: Sim): number {
  let sum = 0;
  let w = 0;
  const next = sim.state.waves.next;
  for (let i = Math.max(0, next - 1); i < Math.min(sim.level.waves.length, next + AIR_LOOKAHEAD); i++) {
    for (const g of sim.level.waves[i]!.groups) {
      const e = sim.balance.enemies[g.enemy]!;
      const a = g.elite && e.elite.armour !== undefined ? e.elite.armour : e.armour;
      const th = g.count * e.threat * (g.elite ? e.elite.threatMul : 1);
      sum += a * th;
      w += th;
    }
  }
  return w > 0 ? sum / w : 0;
}

/**
 * A human-style maze plan: walls across the main entrance→exit axis every WALL_PITCH cells,
 * each with a one-cell gap alternating between the two ends, built middle-out, each wall
 * from its gap end. Cells that are already blocked or unbuildable are simply skipped later.
 */
function serpentine(sim: Sim): number[] {
  const lv = sim.level;
  const r = lv.routes.find((x) => !x.airOnly);
  if (!r) return [];
  const mid = (cells: number[]): { x: number; y: number } => {
    const c = cells[(cells.length - 1) >> 1]!;
    return { x: c % lv.cols, y: Math.floor(c / lv.cols) };
  };
  const a = mid(r.entrance.cells);
  const z = mid(r.exit.cells);
  const horizontal = Math.abs(z.x - a.x) >= Math.abs(z.y - a.y);
  const along = horizontal ? lv.cols : lv.rows;
  const across = horizontal ? lv.rows : lv.cols;
  const lines: number[] = [];
  for (let k = 2; k < along - 2; k += WALL_PITCH) lines.push(k);
  const centre = (along - 1) / 2;
  const order = lines.map((k, i) => ({ k, i })).sort((p, q) => Math.abs(p.k - centre) - Math.abs(q.k - centre) || p.k - q.k);
  const out: number[] = [];
  for (const { k, i } of order) {
    const gapLow = i % 2 === 0;
    const run = Array.from({ length: across - 1 }, (_, j) => (gapLow ? j + 1 : across - 2 - j));
    for (const t of run) out.push(horizontal ? cellIndex(lv.cols, k, t) : cellIndex(lv.cols, t, k));
  }
  return out;
}

function routeLength(sim: Sim, fields = sim.fields): number {
  let n = 0;
  for (const r of sim.level.routes) {
    if (r.airOnly) continue;
    const cells = r.entrance.cells;
    const d = fields[r.exitIndex]!.dist[cells[(cells.length - 1) >> 1]!]!;
    n += Number.isFinite(d) ? d : 0;
  }
  return n;
}

function refresh(c: Ctx): void {
  if (c.pathV === c.sim.state.pathV && c.routeCells.length) return;
  c.pathV = c.sim.state.pathV;
  c.lenNow = routeLength(c.sim);
  c.routeCells = routeCellsOf(c.sim, c.sim.fields);
}

function routeCellsOf(sim: Sim, fields: Sim['fields']): number[] {
  const cols = sim.level.cols;
  const out: number[] = [];
  for (const path of routePaths(sim, fields)) {
    for (const p of path) {
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      if (cx >= 0 && cy >= 0 && cx < cols && cy < sim.level.rows) out.push(cellIndex(cols, cx, cy));
    }
  }
  return out;
}

/** Route (and air-lane) cells within range; `route` defaults to the current road. */
function coverage(c: Ctx, x: number, y: number, t: TowerTierDef, def: TowerDef, route: number[] = c.routeCells): number {
  const cols = c.sim.level.cols;
  let n = 0;
  const r2 = t.range * t.range;
  const m2 = t.minRange * t.minRange;
  if (def.targets.ground) {
    for (const cell of route) {
      const px = (cell % cols) + 0.5;
      const py = Math.floor(cell / cols) + 0.5;
      const d2 = (px - x) * (px - x) + (py - y) * (py - y);
      if (d2 <= r2 && d2 >= m2) n++;
    }
  }
  if (def.targets.air) {
    for (const p of c.airPts) {
      const d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d2 <= r2) n += c.airWeight;
    }
  }
  return n;
}

interface Option {
  value: number;
  cost: number;
  run: () => boolean;
}

/** Air share of the next few waves' threat (0..1), used to weight anti-air coverage. */
function airPressure(sim: Sim): number {
  let air = 0;
  let all = 0;
  const w = sim.state.waves.next;
  for (let i = Math.max(0, w - 1); i < Math.min(sim.level.waves.length, w + AIR_LOOKAHEAD); i++) {
    for (const g of sim.level.waves[i]!.groups) {
      const e = sim.balance.enemies[g.enemy]!;
      const th = g.count * e.threat;
      all += th;
      if (e.air) air += th;
    }
  }
  return all > 0 ? air / all : 0;
}

function bestOption(c: Ctx): Option | null {
  const { sim, b } = c;
  const st = sim.state;
  refresh(c);
  const cols = sim.level.cols;
  const rows = sim.level.rows;
  let best: Option | null = null;
  const consider = (o: Option): void => {
    if (o.cost > st.cash || o.value <= 0) return;
    if (!best || o.value / o.cost > best.value / best.cost) best = o;
  };
  const airP = airPressure(sim);
  c.airWeight = airP > 0 ? 1 + airP * 6 : 0;
  c.armour = comingArmour(sim);
  // Candidate cells: near the current routes (the maze grows beside the road).
  const near = new Set<number>();
  for (const cell of c.routeCells) {
    const x0 = cell % cols;
    const y0 = Math.floor(cell / cols);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x >= 0 && y >= 0 && x < cols && y < rows) near.add(cellIndex(cols, x, y));
    }
  }
  // Serpentine wall cells: the strict style builds only these (best-valued first) until the
  // walls are done; the other styles give them a bonus. Cells that can no longer be built are dropped.
  for (const w of [...c.walls]) if (sim.grid.occ[w] !== 0 || !checkPlacement(sim, w % cols, Math.floor(w / cols), c.loadout[0]!).fields) c.walls.delete(w);
  const strict = c.strategy === 'serpentine' && c.walls.size > 0;
  if (strict) near.clear();
  for (const w of c.walls) near.add(w);
  if (airP > 0) for (const p of c.airPts) near.add(cellIndex(cols, Math.min(cols - 1, Math.max(0, Math.floor(p.x))), Math.min(rows - 1, Math.max(0, Math.floor(p.y)))));
  if (c.strategy === 'fort' && st.towers.length < FORT_TOWERS) {
    for (const cell of [...near]) {
      const x = (cell % cols) + 0.5;
      const y = Math.floor(cell / cols) + 0.5;
      if (!sim.level.exits.some((ex) => ex.cells.some((q) => ((q % cols) + 0.5 - x) * ((q % cols) + 0.5 - x) + (Math.floor(q / cols) + 0.5 - y) * (Math.floor(q / cols) + 0.5 - y) <= FORT_RADIUS * FORT_RADIUS))) near.delete(cell);
    }
  }
  const cells = [...near].sort((a, z) => a - z);
  for (const cell of cells) {
    const cx = cell % cols;
    const cy = Math.floor(cell / cols);
    const bonus = c.walls.has(cell) ? W_PLAN * (strict ? 1 : Math.max(1, st.towers.length * 0.15)) : 0;
    let geometry: { ok: boolean; dLen: number; wall: number; route: number[] } | null = null;
    for (const type of c.loadout) {
      const def = b.towers[type]!;
      const t1 = def.tiers[0];
      if (t1.cost > st.cash) continue;
      if (!geometry) {
        const chk = checkPlacement(sim, cx, cy, type);
        if (!chk.ok) {
          geometry = { ok: false, dLen: 0, wall: 0, route: [] };
        } else {
          let wall = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= cols || y >= rows || sim.grid.walk[cellIndex(cols, x, y)] === 0) wall++;
          }
          // Coverage is judged on the road this placement produces, not today's road.
          geometry = { ok: true, dLen: routeLength(sim, chk.fields) - c.lenNow, wall, route: routeCellsOf(sim, chk.fields!) };
        }
      }
      if (!geometry.ok) break;
      if (strict && !c.walls.has(cell) && !(def.targets.air && !def.targets.ground)) continue;
      const cov = coverage(c, cx + 0.5, cy + 0.5, t1, def, geometry.route);
      const dps = tierDps(def, t1, b, c.armour);
      let value = dps * cov + controlValue(def, t1) * cov + W_LENGTH * Math.max(0, geometry.dLen) * Math.max(1, st.towers.length * 0.4) + W_WALL * geometry.wall;
      if (def.kind === 'aura') {
        let buffed = 0;
        for (const o of st.towers) {
          const od = b.towers[o.type]!;
          const ox = o.x - cx - 0.5;
          const oy = o.y - cy - 0.5;
          if (ox * ox + oy * oy <= t1.range * t1.range) buffed += tierDps(od, od.tiers[o.tier]!, b, c.armour) * t1.auraRate * 12;
        }
        value = buffed + W_WALL * geometry.wall;
      }
      if (def.kind !== 'aura' && bonus > 0 && (def.targets.ground || !airP)) value += bonus;
      consider({
        value,
        cost: t1.cost,
        run: () => {
          const ok = apply(sim, { t: 'build', tower: type, cx, cy }).ok;
          if (ok) c.walls.delete(cell);
          return ok;
        },
      });
    }
  }
  for (const tw of st.towers) consider(upgradeOption(c, tw));
  return best;
}

function upgradeOption(c: Ctx, tw: Tower): Option {
  const def = c.b.towers[tw.type]!;
  const next = def.tiers[tw.tier + 1];
  if (!next) return { value: 0, cost: Infinity, run: () => false };
  const cur = def.tiers[tw.tier]!;
  const cov = coverage(c, tw.x, tw.y, next, def);
  let value = (tierDps(def, next, c.b, c.armour) - tierDps(def, cur, c.b, c.armour)) * cov + (controlValue(def, next) - controlValue(def, cur)) * cov;
  if (def.kind === 'aura') value = (next.auraRate - cur.auraRate) * 200 + next.auraDamage * 300;
  value *= UPGRADE_BIAS[c.strategy];
  return {
    value,
    cost: next.cost,
    run: () => {
      const ok = apply(c.sim, { t: 'upgrade', id: tw.id }).ok;
      if (ok) c.upgrades++;
      return ok;
    },
  };
}

function towerAt(sim: Sim, cx: number, cy: number): Tower | undefined {
  return sim.state.towers.find((t) => t.cx === cx && t.cy === cy);
}

/** Executes the next plan step if its wave has come and it is affordable. Returns true if it did. */
function planStep(sim: Sim, s: PlanStep): 'done' | 'wait' {
  if (sim.state.waves.next < s.wave) return 'wait';
  const r = s.build
    ? apply(sim, { t: 'build', tower: s.build.tower, cx: s.build.cx, cy: s.build.cy })
    : s.upgrade
      ? (() => {
          const t = towerAt(sim, s.upgrade.cx, s.upgrade.cy);
          return t ? apply(sim, { t: 'upgrade', id: t.id }) : { ok: false, reason: 'NO_SUCH_TOWER' as const };
        })()
      : s.sell
        ? (() => {
            const t = towerAt(sim, s.sell.cx, s.sell.cy);
            return t ? apply(sim, { t: 'sell', id: t.id }) : { ok: false, reason: 'NO_SUCH_TOWER' as const };
          })()
        : s.clear
          ? apply(sim, { t: 'clear', cx: s.clear.cx, cy: s.clear.cy })
          : s.target
            ? (() => {
                const t = towerAt(sim, s.target.cx, s.target.cy);
                return t ? apply(sim, { t: 'target', id: t.id, mode: s.target.mode }) : { ok: false, reason: 'NO_SUCH_TOWER' as const };
              })()
            : { ok: true };
  if (r.ok) return 'done';
  // Waiting for cash is fine; anything else is a broken plan step and is skipped.
  return r.reason === 'NO_CASH' || r.reason === 'ENEMY_IN_WAY' ? 'wait' : 'done';
}

export interface BotOpts {
  plan?: PlanStep[] | null;
  generic?: boolean;
  seed?: number;
  strategy?: Strategy;
  /** Called with the finished simulation (dev tools only). */
  inspect?: (sim: Sim) => void;
  /** Sees every event in order, including the bot's own commands (dev tools only: plan recording). */
  onEvent?: (ev: SimEvent) => void;
}

export function runBot(level: LevelDef, b: BalanceDef, difficulty: Difficulty, o: BotOpts = {}): BotRun {
  const loadout = level.loadout.fixed ?? level.loadout.bot;
  const sim = createSim({ level, balance: b, difficulty, loadout, ...(o.seed === undefined ? {} : { seed: o.seed }) });
  const plan = (o.plan ?? level.bot.plan ?? []).slice();
  const generic = o.generic ?? level.bot.generic;
  const airPts: { x: number; y: number }[] = [];
  for (const r of sim.level.routes) {
    const a = spanOutside(r.entrance, 0.5);
    const z = spanOutside(r.exit, 0.5);
    const len = Math.sqrt((z.x - a.x) * (z.x - a.x) + (z.y - a.y) * (z.y - a.y));
    for (let d = 0; d < len; d += 0.5) airPts.push({ x: a.x + ((z.x - a.x) * d) / len, y: a.y + ((z.y - a.y) * d) / len });
  }
  const c: Ctx = { sim, b, loadout, routeCells: [], airPts, pathV: -1, lenNow: 0, upgrades: 0, airWeight: 0, walls: new Set(serpentine(sim)), armour: 0, strategy: o.strategy ?? 'greedy' };
  const progress: { wave: number; p: number }[] = [];
  const decide = (): void => {
    while (plan.length && planStep(sim, plan[0]!) === 'done') plan.shift();
    if (plan.length || !generic) return;
    for (let k = 0; k < 40; k++) {
      const opt = bestOption(c);
      if (!opt || !opt.run()) break;
    }
  };
  decide();
  apply(sim, { t: 'callWave' });
  const cap = MAX_SECONDS * TICK_HZ;
  while (sim.state.result === 'playing' && sim.state.tick < cap) {
    if (sim.state.tick % DECIDE_EVERY === 0) decide();
    step(sim);
    for (const ev of drainEvents(sim)) {
      o.onEvent?.(ev);
      if (ev.e === 'kill') progress.push({ wave: ev.wave, p: ev.progress });
      else if (ev.e === 'leak') progress.push({ wave: sim.state.waves.next - 1, p: 1 });
    }
  }
  o.inspect?.(sim);
  // Waves actually launched: timed modes end before the script does (§8 "the last third of the waves").
  const total = sim.state.waves.next;
  const late = progress.filter((x) => x.wave >= Math.floor((total * 2) / 3)).map((x) => x.p).sort((a, z) => a - z);
  const st = sim.state;
  return {
    result: st.result === 'playing' ? 'timeout' : st.result,
    strategy: c.strategy,
    lives: st.lives,
    livesMax: sim.level.lives,
    seconds: st.tick / TICK_HZ,
    earned: st.stats.earned,
    spent: st.stats.spent,
    towers: st.towers.length,
    upgrades: c.upgrades,
    kills: st.stats.kills,
    leaks: st.stats.leaks,
    waves: st.waves.next,
    peak95: late.length ? late[Math.min(late.length - 1, Math.floor(late.length * 0.95))]! : 0,
    planUsed: (level.bot.plan?.length ?? 0) > 0,
    hash: hashSim(sim),
  };
}

/** Best of the bot's styles: a win with the most lives left (ties: the earliest style). */
export function runBest(level: LevelDef, b: BalanceDef, difficulty: Difficulty): BotRun {
  if (!level.bot.generic) return runBot(level, b, difficulty);
  let best: BotRun | null = null;
  const score = (x: BotRun): number => (x.result === 'won' ? 1000 : 0) + x.lives + x.waves / 1000;
  for (const strategy of STRATEGIES) {
    for (const seed of [level.seed, level.seed + 1]) {
      const r = runBot(level, b, difficulty, { strategy, seed });
      if (!best || score(r) > score(best)) best = { ...r, seed };
    }
  }
  return best!;
}

/** The same level with no towers at all: it must be lost (§15 step 3). */
export function runIdle(level: LevelDef, b: BalanceDef, difficulty: Difficulty): BotRun {
  return runBot(level, b, difficulty, { plan: [], generic: false });
}
