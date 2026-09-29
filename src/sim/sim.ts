// Public simulation API (DESIGN.md §13). Everything outside src/sim talks to the
// simulation through these functions: create/restore, step, apply(command),
// checkPlacement (preview), snapshot and hash. Rendering and audio read state and
// drain events; they never mutate.
import type { BalanceDef, Difficulty, Immunity, LevelDef } from '../data/schemas.ts';
import { DT, SIM_VERSION, TICK_HZ, PHASE } from './constants.ts';
import { DEG, TWO_PI, dcos, dsin, type Vec } from './core/math.ts';
import { hashState } from './core/hash.ts';
import { rngFrom } from './core/rng.ts';
import type { Derived, Sim, Turn } from './context.ts';
import { spawnEnemy, updateEnemies } from './enemies.ts';
import { buildGrid, isBuildableTerrain, refreshCell } from './grid.ts';
import { cellIndex, prepareLevel } from './level.ts';
import { computeField, exitFields, newField, routePolyline, type Field } from './path.ts';
import { updateProjectiles } from './projectiles.ts';
import { newSpatial, rebuildSpatial } from './spatial.ts';
import { T } from './terrain.ts';
import { updateTowers } from './towers.ts';
import { updateTraits } from './traits.ts';
import { updateZones } from './zones.ts';
import type { LevelRT } from './level.ts';
import type { GridRT } from './grid.ts';
import type { Command, CommandResult, PlaceReason, SimEvent, SimState, Tower } from './types.ts';

export type { Command, CommandResult, SimEvent, SimState } from './types.ts';
export type { Sim } from './context.ts';

function turn(degPerSecond: number): Turn {
  const a = degPerSecond * DEG * DT;
  return { c: dcos(a), s: dsin(a) };
}

function derive(balance: BalanceDef): Derived {
  const d: Derived = { enemyTurn: {}, turretTurn: {}, aimCos: {}, projTurn: {}, coneCos: {}, traits: {}, ring: {} };
  for (const [k, e] of Object.entries(balance.enemies)) {
    d.enemyTurn[k] = turn(e.turnRate);
    d.traits[`${k}.0`] = { traits: e.traits, immune: new Set<Immunity>(e.immune) };
    d.traits[`${k}.1`] = { traits: { ...e.traits, ...(e.elite.traits ?? {}) }, immune: new Set<Immunity>([...e.immune, ...(e.elite.immune ?? [])]) };
  }
  for (const [k, t] of Object.entries(balance.towers)) {
    d.turretTurn[k] = turn(t.turretTurn);
    d.aimCos[k] = dcos(t.aimTolerance * DEG);
    t.tiers.forEach((tier, i) => {
      if (tier.projTurn !== undefined) d.projTurn[`${k}.${i}`] = turn(tier.projTurn);
      if (tier.cone !== undefined) d.coneCos[`${k}.${i}`] = dcos((tier.cone / 2) * DEG);
      if (tier.bomblets > 0 && !d.ring[tier.bomblets]) {
        d.ring[tier.bomblets] = Array.from({ length: tier.bomblets }, (_, j) => {
          const a = (j / tier.bomblets) * TWO_PI;
          return { x: dcos(a), y: dsin(a) };
        });
      }
    });
  }
  return d;
}

function entryFields(level: LevelRT, grid: GridRT, rules: BalanceDef['terrain'], reuse?: Field[]): Field[] {
  return level.routes.map((r, i) => computeField(level, grid, rules, r.airOnly ? [] : r.entrance.cells, -1, reuse?.[i] ?? newField(level.n)));
}

function assemble(level: LevelDef, balance: BalanceDef, state: SimState): Sim {
  const lv = prepareLevel(level, balance, state.difficulty, state.endless);
  const grid = buildGrid(lv, state.cleared, state.towers);
  const sim: Sim = {
    level: lv,
    balance,
    rt: derive(balance),
    state,
    grid,
    fields: exitFields(lv, grid, balance.terrain, -1),
    entryFields: entryFields(lv, grid, balance.terrain),
    events: [],
    spatial: newSpatial(lv.cols, lv.rows),
    byId: new Map(),
  };
  indexEnemies(sim);
  return sim;
}

export interface CreateOpts {
  level: LevelDef;
  balance: BalanceDef;
  difficulty: Difficulty;
  /** In-play randomness (spawn points, lanes). Defaults to the level seed. Waves always use the level seed. */
  seed?: number;
  /** Towers the player may build; defaults to the level's fixed set, else its bot loadout. */
  loadout?: string[];
  /** Endless mode: Tough multipliers and an unending wave list. */
  endless?: boolean;
}

export function createSim(o: CreateOpts): Sim {
  const seed = o.seed ?? o.level.seed;
  const endless = o.endless ?? false;
  const difficulty = endless ? o.balance.modes.endless.difficulty : o.difficulty;
  const lv = prepareLevel(o.level, o.balance, difficulty, endless);
  const state: SimState = {
    v: SIM_VERSION,
    level: o.level.id,
    difficulty,
    endless,
    seed,
    tick: 0,
    rng: rngFrom(seed),
    cash: lv.startCash,
    lives: lv.lives,
    result: 'playing',
    nextId: 1,
    loadout: o.loadout ?? o.level.loadout.fixed ?? o.level.loadout.bot,
    enemies: [],
    towers: [],
    projectiles: [],
    zones: [],
    waves: { next: 0, nextAt: -1, started: false, spawners: [] },
    stats: { kills: 0, leaks: 0, earned: 0, spent: 0, bounty: 0, early: 0, peakProgress: 0 },
    cleared: [],
    pathV: 0,
    mode: { timer: -1, target: lv.target },
  };
  return assemble(o.level, o.balance, state);
}

export interface Snapshot {
  v: number;
  state: SimState;
}

export function snapshot(sim: Sim): Snapshot {
  return { v: SIM_VERSION, state: JSON.parse(JSON.stringify(sim.state)) as SimState };
}

export function restoreSim(snap: Snapshot, level: LevelDef, balance: BalanceDef): Sim {
  if (snap.v !== SIM_VERSION) throw new Error(`snapshot version ${snap.v} is not ${SIM_VERSION}`);
  if (snap.state.level !== level.id) throw new Error(`snapshot is for ${snap.state.level}, not ${level.id}`);
  return assemble(level, balance, JSON.parse(JSON.stringify(snap.state)) as SimState);
}

export function hashSim(sim: Sim): string {
  return hashState(sim.state);
}

export function drainEvents(sim: Sim): SimEvent[] {
  const ev = sim.events;
  sim.events = [];
  return ev;
}

function indexEnemies(sim: Sim): void {
  sim.byId.clear();
  for (const e of sim.state.enemies) if (!e.dead) sim.byId.set(e.id, e);
  rebuildSpatial(sim.spatial, sim.state.enemies);
}

function mazeChanged(sim: Sim): void {
  sim.fields = exitFields(sim.level, sim.grid, sim.balance.terrain, -1, sim.fields);
  sim.entryFields = entryFields(sim.level, sim.grid, sim.balance.terrain, sim.entryFields);
  sim.state.pathV++;
  sim.events.push({ e: 'paths' });
}

// ---------------------------------------------------------------- waves

function launchWave(sim: Sim, early: boolean, bonus: number): void {
  const st = sim.state;
  const k = st.waves.next;
  const wave = sim.level.waves[k]!;
  wave.groups.forEach((g, gi) => st.waves.spawners.push({ wave: k, group: gi, left: g.count, at: st.tick + g.delay }));
  st.waves.next = k + 1;
  st.waves.nextAt = st.tick + sim.level.gapTicks[k]!;
  sim.events.push({ e: 'wave', index: k, early, bonus });
}

function updateWaves(sim: Sim): void {
  const st = sim.state;
  const w = st.waves;
  if (w.started && w.next < sim.level.waves.length && st.tick >= w.nextAt) launchWave(sim, false, 0);
  for (const sp of w.spawners) {
    const g = sim.level.waves[sp.wave]!.groups[sp.group]!;
    while (sp.left > 0 && sp.at <= st.tick) {
      spawnEnemy(sim, g.enemy, g.route, g.elite, sp.wave);
      sp.left--;
      sp.at += g.spacing;
    }
  }
  if (w.spawners.some((sp) => sp.left === 0)) w.spawners = w.spawners.filter((sp) => sp.left > 0);
}

/** Bonus for calling the next wave now (§3.8, R-ECON-2). */
export function earlyBonus(sim: Sim): number {
  const w = sim.state.waves;
  if (!w.started || w.next >= sim.level.waves.length) return 0;
  const remaining = Math.max(0, w.nextAt - sim.state.tick);
  return Math.round((sim.balance.economy.earlyRate * sim.level.waves[w.next]!.bounty * remaining) / sim.level.gapTicks[w.next - 1]!);
}

// ---------------------------------------------------------------- tick

export function step(sim: Sim): void {
  const st = sim.state;
  if (st.result !== 'playing') return;
  for (const e of st.enemies) {
    e.px = e.x;
    e.py = e.y;
  }
  updateWaves(sim);
  updateTraits(sim);
  updateEnemies(sim);
  indexEnemies(sim);
  updateTowers(sim);
  updateProjectiles(sim);
  updateZones(sim);
  if (st.enemies.some((e) => e.dead)) st.enemies = st.enemies.filter((e) => !e.dead);
  if (st.projectiles.some((p) => p.dead)) st.projectiles = st.projectiles.filter((p) => !p.dead);
  if (st.enemies.length !== sim.byId.size) indexEnemies(sim);
  const w = st.waves;
  const mode = sim.level.mode;
  if (st.result === 'playing') {
    let outcome: 'won' | 'lost' | null = null;
    if (mode === 'suddenDeath') {
      if (st.mode.timer > 0 && --st.mode.timer === 0) outcome = 'won';
    } else if (mode === 'timeTrial') {
      if (st.stats.kills >= st.mode.target) outcome = 'won';
      else if (st.mode.timer > 0 && --st.mode.timer === 0) outcome = 'lost';
    } else if (w.started && w.next >= sim.level.waves.length && w.spawners.length === 0 && st.enemies.length === 0) outcome = 'won';
    if (outcome) {
      st.result = outcome;
      sim.events.push({ e: 'result', result: outcome });
    }
  }
  st.tick++;
}

// ---------------------------------------------------------------- placement

export interface PlaceCheck {
  ok: boolean;
  reason?: PlaceReason;
  routes?: string[];
  enemies?: number[];
  /** Hypothetical fields with the cell blocked, when the geometry was tested (route preview). */
  fields?: Field[];
}

/** Read-only placement check (R-BLOCK-1/2); also the source of the live route preview. */
export function checkPlacement(sim: Sim, cx: number, cy: number, tower: string): PlaceCheck {
  const st = sim.state;
  const lv = sim.level;
  if (cx < 0 || cy < 0 || cx >= lv.cols || cy >= lv.rows) return { ok: false, reason: 'OUT_OF_BOUNDS' };
  if (st.result !== 'playing') return { ok: false, reason: 'LEVEL_OVER' };
  if (!st.loadout.includes(tower) || !sim.balance.towers[tower]) return { ok: false, reason: 'NOT_IN_LOADOUT' };
  const c = cellIndex(lv.cols, cx, cy);
  if (sim.grid.occ[c] !== 0) return { ok: false, reason: 'OCCUPIED' };
  if (!isBuildableTerrain(lv, sim.grid, c)) return { ok: false, reason: 'NOT_BUILDABLE' };
  const inWay: number[] = [];
  for (const e of st.enemies) {
    if (e.dead || e.air || e.phase === PHASE.TUNNEL) continue;
    const nx = Math.max(cx, Math.min(e.x, cx + 1));
    const ny = Math.max(cy, Math.min(e.y, cy + 1));
    if ((e.x - nx) * (e.x - nx) + (e.y - ny) * (e.y - ny) < e.radius * e.radius) inWay.push(e.id);
  }
  if (inWay.length) return { ok: false, reason: 'ENEMY_IN_WAY', enemies: inWay };
  const fields = exitFields(lv, sim.grid, sim.balance.terrain, c);
  const cut: string[] = [];
  for (const r of lv.routes) {
    if (r.airOnly) continue;
    const f = fields[r.exitIndex]!;
    if (!r.entrance.cells.some((ec) => Number.isFinite(f.dist[ec]!))) cut.push(r.id);
  }
  if (cut.length) return { ok: false, reason: 'BLOCKS_ROUTE', routes: cut, fields };
  const trapped: number[] = [];
  for (const e of st.enemies) {
    if (e.dead || e.air) continue;
    const ref = e.phase === PHASE.TUNNEL ? e.tunnelTo : e.phase === PHASE.ENTER ? e.entry : cellIndex(lv.cols, Math.floor(e.x), Math.floor(e.y));
    if (e.phase === PHASE.EXIT) continue;
    if (!Number.isFinite(fields[e.exit]!.dist[ref]!)) trapped.push(e.id);
  }
  if (trapped.length) return { ok: false, reason: 'TRAPS_ENEMY', enemies: trapped, fields };
  if (st.cash < sim.balance.towers[tower]!.tiers[0].cost) return { ok: false, reason: 'NO_CASH', fields };
  return { ok: true, fields };
}

/** Cells where any tower would be refused as NOT_BUILDABLE (R-BLOCK-4): the gate apron and unbuildable terrain. */
export function unbuildableCells(sim: Sim): number[] {
  const out: number[] = [];
  for (let c = 0; c < sim.level.n; c++) if (!isBuildableTerrain(sim.level, sim.grid, c)) out.push(c);
  return out;
}

/** Current (or hypothetical) ground route polylines, one per route; air-only routes give []. */
export function routePaths(sim: Sim, fields: Field[] = sim.fields): Vec[][] {
  return sim.level.routes.map((r) => (r.airOnly ? [] : routePolyline(sim.level, fields[r.exitIndex]!, r)));
}

export function sellValue(sim: Sim, t: Tower): number {
  return Math.floor(sim.balance.economy.sellRate * t.spent);
}

// ---------------------------------------------------------------- commands

export function apply(sim: Sim, cmd: Command): CommandResult {
  const st = sim.state;
  const lv = sim.level;
  switch (cmd.t) {
    case 'build': {
      const chk = checkPlacement(sim, cmd.cx, cmd.cy, cmd.tower);
      if (!chk.ok) return { ok: false, reason: chk.reason!, ...(chk.routes ? { routes: chk.routes } : {}), ...(chk.enemies ? { enemies: chk.enemies } : {}) };
      const cost = sim.balance.towers[cmd.tower]!.tiers[0].cost;
      const c = cellIndex(lv.cols, cmd.cx, cmd.cy);
      const t: Tower = {
        id: st.nextId++,
        type: cmd.tower,
        tier: 0,
        cell: c,
        cx: cmd.cx,
        cy: cmd.cy,
        x: cmd.cx + 0.5,
        y: cmd.cy + 0.5,
        spent: cost,
        mode: 'first',
        cd: 0,
        target: 0,
        ax: 1,
        ay: 0,
        pax: 1,
        pay: 0,
        retarget: 0,
        shots: 0,
        charge: 0,
        bRate: 0,
        bRange: 0,
        bDamage: 0,
        active: -1,
        patchT: 0,
      };
      st.towers.push(t);
      st.cash -= cost;
      st.stats.spent += cost;
      sim.grid.occ[c] = t.id;
      refreshCell(sim.grid, c);
      sim.events.push({ e: 'build', tower: t.id, ttype: t.type, cx: t.cx, cy: t.cy });
      mazeChanged(sim);
      return { ok: true, id: t.id };
    }
    case 'upgrade': {
      const t = st.towers.find((x) => x.id === cmd.id);
      if (!t) return { ok: false, reason: 'NO_SUCH_TOWER' };
      const tiers = sim.balance.towers[t.type]!.tiers;
      if (t.tier >= tiers.length - 1) return { ok: false, reason: 'MAX_TIER' };
      const cost = tiers[t.tier + 1]!.cost;
      if (st.result !== 'playing') return { ok: false, reason: 'LEVEL_OVER' };
      if (st.cash < cost) return { ok: false, reason: 'NO_CASH' };
      st.cash -= cost;
      st.stats.spent += cost;
      t.spent += cost;
      t.tier++;
      sim.events.push({ e: 'upgrade', tower: t.id, ttype: t.type, tier: t.tier, cx: t.cx, cy: t.cy });
      return { ok: true, id: t.id };
    }
    case 'sell': {
      const i = st.towers.findIndex((x) => x.id === cmd.id);
      if (i < 0) return { ok: false, reason: 'NO_SUCH_TOWER' };
      if (st.result !== 'playing') return { ok: false, reason: 'LEVEL_OVER' };
      const t = st.towers[i]!;
      const refund = sellValue(sim, t);
      st.towers.splice(i, 1);
      st.cash += refund;
      st.stats.earned += refund;
      sim.grid.occ[t.cell] = 0;
      refreshCell(sim.grid, t.cell);
      sim.events.push({ e: 'sell', tower: t.id, ttype: t.type, cx: t.cx, cy: t.cy, refund });
      mazeChanged(sim);
      return { ok: true, id: t.id };
    }
    case 'target': {
      const t = st.towers.find((x) => x.id === cmd.id);
      if (!t) return { ok: false, reason: 'NO_SUCH_TOWER' };
      t.mode = cmd.mode;
      t.retarget = 0;
      return { ok: true, id: t.id };
    }
    case 'callWave': {
      if (st.result !== 'playing') return { ok: false, reason: 'LEVEL_OVER' };
      if (st.waves.next >= lv.waves.length) return { ok: false, reason: 'NO_MORE_WAVES' };
      if (!st.waves.started) {
        st.waves.started = true;
        if (lv.timerTicks > 0) st.mode.timer = lv.timerTicks;
        launchWave(sim, false, 0);
        return { ok: true };
      }
      const bonus = earlyBonus(sim);
      st.cash += bonus;
      st.stats.earned += bonus;
      st.stats.early += bonus;
      launchWave(sim, true, bonus);
      return { ok: true };
    }
    case 'clear': {
      if (cmd.cx < 0 || cmd.cy < 0 || cmd.cx >= lv.cols || cmd.cy >= lv.rows) return { ok: false, reason: 'OUT_OF_BOUNDS' };
      const c = cellIndex(lv.cols, cmd.cx, cmd.cy);
      if (sim.grid.terrain[c] !== T.BLOCKER) return { ok: false, reason: 'NOT_A_BLOCKER' };
      const cost = lv.def.blockers.clearCost;
      if (st.cash < cost) return { ok: false, reason: 'NO_CASH' };
      st.cash -= cost;
      st.stats.spent += cost;
      st.cleared.push(c);
      sim.grid.terrain[c] = T.GROUND;
      refreshCell(sim.grid, c);
      sim.events.push({ e: 'clear', cx: cmd.cx, cy: cmd.cy, cost });
      mazeChanged(sim);
      return { ok: true };
    }
  }
}

/** Seconds of sim time elapsed. */
export function simSeconds(sim: Sim): number {
  return sim.state.tick / TICK_HZ;
}
