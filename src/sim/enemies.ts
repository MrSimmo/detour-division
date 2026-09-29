// Spawning and movement. Ground units follow their exit's distance field with
// look-ahead steering and a capped turn rate (ADR-0004); air units fly straight lanes.
// Reversed and bubbled units drift back along their route's entrance field.
import { DT, EPS, LANE_IN, LANE_MAX, LANE_OUT, MAX_CLEARANCE, LOOKAHEAD_CELLS, LOOKAHEAD_REFRESH_TICKS, LOS_STEP, PHASE, TICK_HZ, TUNNEL_ENTER_DIST, TURN_SPEED_FLOOR } from './constants.ts';
import { rotateToward } from './core/math.ts';
import { rngInt, rngNext, rngRange } from './core/rng.ts';
import type { Sim } from './context.ts';
import { bodyClear, cellAt, type GridRT } from './grid.ts';
import { spanOutside } from './level.ts';
import { cellCentre, type Field } from './path.ts';
import { traitsOf } from './status.ts';
import { CONVEYOR_DX, CONVEYOR_DY, T, isConveyor } from './terrain.ts';
import type { Enemy } from './types.ts';
import { enemyBounty, enemyHp } from './waves.ts';

function blank(sim: Sim, type: string, route: number, elite: boolean, wave: number): Enemy {
  const st = sim.state;
  const def = sim.balance.enemies[type];
  if (!def) throw new Error(`unknown enemy '${type}'`);
  const r = sim.level.routes[route]!;
  const puzzle = sim.level.mode === 'puzzle';
  const speed = (elite && def.elite.speed !== undefined ? def.elite.speed : def.speed) * (puzzle ? 1 : sim.balance.difficulty[st.difficulty].speed);
  const hp = enemyHp(sim.balance, sim.level.def, st.difficulty, type, elite, wave);
  const tr = sim.rt.traits[`${type}.${elite ? 1 : 0}`]!.traits;
  const shield = tr.iceShield ? tr.iceShield.hp : elite && def.elite.shield !== undefined ? def.elite.shield : def.shield;
  return {
    id: st.nextId++,
    type,
    elite,
    air: def.air,
    route,
    exit: r.exitIndex,
    wave,
    phase: PHASE.ENTER,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    hx: -r.entrance.nx,
    hy: -r.entrance.ny,
    entry: r.entrance.cells[0] ?? 0,
    wp: -1,
    wpT: 0,
    wpV: -1,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    t: 0,
    len: 0,
    hp,
    maxHp: hp,
    armour: elite && def.elite.armour !== undefined ? def.elite.armour : def.armour,
    speed,
    radius: def.radius,
    lane: 0,
    bounty: enemyBounty(sim.balance, sim.level.def, st.difficulty, type, elite, wave) * sim.level.bountyMul,
    leak: def.leak,
    slow: 0,
    slowT: 0,
    shield,
    maxShield: shield,
    shieldT: 0,
    stunT: 0,
    frozen: false,
    freezeImmT: 0,
    brittle: 0,
    brittleT: 0,
    pBrittle: 0,
    pBrittleT: 0,
    burns: [],
    shred: 0,
    shredT: 0,
    revT: 0,
    revImmT: 0,
    pDizzyT: 0,
    bubbleT: 0,
    bubbleSpeed: 0,
    bubblePop: 0,
    bubbleZone: 0,
    bubbleZoneT: 0,
    bubbleZoneR: 0,
    auraSpeed: 0,
    auraArmour: 0,
    healT: tr.heal ? Math.round(tr.heal.every * TICK_HZ) : 0,
    sprintT: 0,
    sprinted: false,
    dashing: false,
    spawnT: tr.spawner ? Math.round(tr.spawner.every * TICK_HZ) : 0,
    burstT: 0,
    bursted: false,
    dropT: tr.dropper ? Math.round(tr.dropper.every * TICK_HZ) : 0,
    bossPhase: 0,
    speedMul: 1,
    remaining: 0,
    progress: 0,
    tunnelT: 0,
    tunnelTo: -1,
    dead: false,
  };
}

function setAirLane(e: Enemy, ax: number, ay: number, bx: number, by: number): void {
  e.x0 = ax;
  e.y0 = ay;
  e.x1 = bx;
  e.y1 = by;
  e.len = Math.max(EPS, Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)));
  e.hx = (bx - ax) / e.len;
  e.hy = (by - ay) / e.len;
  e.x = ax;
  e.y = ay;
  e.t = 0;
  e.phase = PHASE.WALK;
  e.remaining = e.len;
}

function push(sim: Sim, e: Enemy): Enemy {
  e.px = e.x;
  e.py = e.y;
  sim.state.enemies.push(e);
  sim.events.push({ e: 'spawn', id: e.id, type: e.type, elite: e.elite, air: e.air, wave: e.wave, x: e.x, y: e.y });
  return e;
}

export function spawnEnemy(sim: Sim, type: string, route: number, elite = false, wave = 0): Enemy {
  const st = sim.state;
  const e = blank(sim, type, route, elite, wave);
  const r = sim.level.routes[route]!;
  if (e.air) {
    const f = rngNext(st.rng);
    const a = spanOutside(r.entrance, f);
    const b = spanOutside(r.exit, f);
    setAirLane(e, a.x, a.y, b.x, b.y);
  } else {
    const cells = r.entrance.cells;
    e.entry = cells[rngInt(st.rng, 0, cells.length - 1)]!;
    const c = cellCentre(sim.level.cols, e.entry);
    e.x = c.x + r.entrance.nx * (0.5 + LANE_IN);
    e.y = c.y + r.entrance.ny * (0.5 + LANE_IN);
    e.lane = rngRange(st.rng, -LANE_MAX, LANE_MAX);
    e.wpT = e.id % LOOKAHEAD_REFRESH_TICKS;
    e.remaining = sim.fields[e.exit]!.dist[e.entry]! + 0.5 + LANE_IN;
  }
  return push(sim, e);
}

/**
 * A unit that appears mid-field: split-offs, releases, deployed and dropped units.
 * Ground children start walking where they are (falling back to a walkable cell).
 */
export function spawnChild(sim: Sim, parent: Enemy, type: string, elite: boolean, x: number, y: number, route = parent.route): Enemy {
  const e = blank(sim, type, route, elite, parent.wave);
  if (e.air) {
    const r = sim.level.routes[route]!;
    const end = parent.air ? { x: parent.x1, y: parent.y1 } : spanOutside(r.exit, 0.5);
    setAirLane(e, x, y, end.x, end.y);
  } else if (!parent.air && (parent.phase === PHASE.ENTER || parent.phase === PHASE.EXIT)) {
    // A ground parent still walking in, or already walking out, down a gate lane (R-LANE-1): the child
    // carries on along the lane from where it appears. Placing it on the map instead put a Trio killed
    // on its way out back beside the exit as three Tiddlers, each of which then leaked.
    e.x = x;
    e.y = y;
    e.hx = parent.hx;
    e.hy = parent.hy;
    e.phase = parent.phase;
    e.lane = rngRange(sim.state.rng, -LANE_MAX, LANE_MAX);
    e.entry = parent.entry;
    e.remaining = parent.remaining;
  } else {
    const g = sim.grid;
    const inside = cellAt(g, x, y);
    const ok = inside >= 0 && g.walk[inside] === 1;
    const at = ok && bodyClear(g, x, y, clearance(e)) ? { x, y } : cellCentre(sim.level.cols, ok ? inside : parent.wp >= 0 ? parent.wp : parent.entry);
    e.x = at.x;
    e.y = at.y;
    e.hx = parent.hx;
    e.hy = parent.hy;
    e.phase = PHASE.WALK;
    e.lane = rngRange(sim.state.rng, -LANE_MAX, LANE_MAX);
    e.entry = parent.entry;
  }
  return push(sim, e);
}

/** Radius used for wall clearance while moving. */
function clearance(e: Enemy): number {
  return Math.min(e.radius, MAX_CLEARANCE);
}

function lineClear(g: GridRT, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.ceil(Math.sqrt(dx * dx + dy * dy) / LOS_STEP);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!bodyClear(g, x0 + dx * t, y0 + dy * t, r)) return false;
  }
  return true;
}

/** Furthest cell along the field chain (up to LOOKAHEAD_CELLS) visible with body clearance. */
function pickWaypoint(sim: Sim, e: Enemy, c: number, f: Field): number {
  const cols = sim.level.cols;
  let best = f.next[c]!;
  if (best < 0) return c;
  let cur = best;
  for (let k = 1; k < LOOKAHEAD_CELLS; k++) {
    if (f.dist[cur] === 0 || f.tunnel[cur] === 1) break;
    const cand = f.next[cur]!;
    if (cand < 0) break;
    const p = cellCentre(cols, cand);
    if (!lineClear(sim.grid, e.x, e.y, p.x, p.y, clearance(e))) break;
    best = cand;
    cur = cand;
  }
  return best;
}

function leak(sim: Sim, e: Enemy): void {
  e.dead = true;
  const st = sim.state;
  st.lives = Math.max(0, st.lives - e.leak);
  st.stats.leaks++;
  sim.events.push({ e: 'leak', id: e.id, type: e.type, x: e.x, y: e.y, lives: st.lives });
  if (st.lives === 0 && st.result === 'playing') {
    st.result = 'lost';
    sim.events.push({ e: 'result', result: 'lost' });
  }
}

const turned = { x: 0, y: 0 };

function steer(sim: Sim, e: Enemy, tx: number, ty: number, speedMul: number, collide: boolean): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS) return;
  const ux = dx / d;
  const uy = dy / d;
  const turn = sim.rt.enemyTurn[e.type]!;
  rotateToward(e.hx, e.hy, ux, uy, turn.c, turn.s, turned);
  e.hx = turned.x;
  e.hy = turned.y;
  const align = e.hx * ux + e.hy * uy;
  const step = Math.min(d, e.speed * speedMul * Math.max(TURN_SPEED_FLOOR, align) * DT);
  let nx = e.x + e.hx * step;
  let ny = e.y + e.hy * step;
  if (collide) {
    const g = sim.grid;
    const c = cellAt(g, e.x, e.y);
    if (c >= 0 && isConveyor(g.terrain[c]!)) {
      const code = g.terrain[c]!;
      nx += CONVEYOR_DX[code]! * sim.balance.terrain.conveyorPush * DT;
      ny += CONVEYOR_DY[code]! * sim.balance.terrain.conveyorPush * DT;
    }
    if (!bodyClear(g, nx, ny, clearance(e))) {
      if (bodyClear(g, nx, e.y, clearance(e))) ny = e.y;
      else if (bodyClear(g, e.x, ny, clearance(e))) nx = e.x;
      else return;
    }
  }
  e.x = nx;
  e.y = ny;
}

/** Drift (facing unchanged) towards (tx,ty): the comic moonwalk of About turn, and bubbles. */
function drift(sim: Sim, e: Enemy, tx: number, ty: number, speed: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS) return;
  const step = Math.min(d, speed * DT);
  const nx = e.x + (dx / d) * step;
  const ny = e.y + (dy / d) * step;
  if (bodyClear(sim.grid, nx, ny, clearance(e))) {
    e.x = nx;
    e.y = ny;
  }
}

function terrainSpeed(sim: Sim, c: number): number {
  return c >= 0 && sim.grid.terrain[c] === T.ICE ? sim.balance.terrain.iceSpeed : 1;
}

/** Status and trait speed multiplier: slow, auras, sprints, dashes, boss bursts and phases. */
function speedFactor(sim: Sim, e: Enemy): number {
  const tr = traitsOf(sim, e);
  const def = sim.balance.enemies[e.type]!;
  let k = (1 - e.slow) * (1 + e.auraSpeed) * e.speedMul;
  if (e.sprintT > 0 && tr.sprint) k *= tr.sprint.mul;
  if (e.dashing && tr.dash) k *= tr.dash.mul;
  if (e.burstT > 0 && tr.burst) k *= tr.burst.speed / def.speed;
  return k;
}

function moveBack(sim: Sim, e: Enemy, speed: number): void {
  if (e.phase !== PHASE.WALK) return;
  const c = cellAt(sim.grid, e.x, e.y);
  const f = sim.entryFields[e.route];
  if (c < 0 || !f || !Number.isFinite(f.dist[c]!) || f.dist[c] === 0 || f.tunnel[c] === 1) return;
  const n = f.next[c]!;
  if (n < 0) return;
  const p = cellCentre(sim.level.cols, n);
  drift(sim, e, p.x, p.y, speed);
  e.wpT = 0;
}

function moveGround(sim: Sim, e: Enemy): void {
  const g = sim.grid;
  const cols = sim.level.cols;
  const f = sim.fields[e.exit]!;
  const route = sim.level.routes[e.route]!;
  const routeLen = f.dist[e.entry]! + 0.5 + LANE_IN;
  const k = speedFactor(sim, e);

  if (e.stunT > 0) {
    // Frozen, stunned or dizzy: stands still.
  } else if (e.bubbleT > 0) {
    moveBack(sim, e, e.bubbleSpeed);
  } else if (e.revT > 0) {
    moveBack(sim, e, e.speed * k);
  } else if (e.phase === PHASE.TUNNEL) {
    e.tunnelT--;
    e.remaining = f.dist[e.tunnelTo]! + e.tunnelT * e.speed * DT;
    if (e.tunnelT <= 0) {
      const p = cellCentre(cols, e.tunnelTo);
      e.x = p.x;
      e.y = p.y;
      e.px = p.x;
      e.py = p.y;
      e.phase = PHASE.WALK;
      e.wpT = 0;
      sim.events.push({ e: 'tunnel', id: e.id, x: e.x, y: e.y });
    }
  } else if (e.phase === PHASE.ENTER) {
    const p = cellCentre(cols, e.entry);
    steer(sim, e, p.x, p.y, k, false);
    // Stay in the entering phase until the whole body is on the map, so collision never pins it at the edge.
    if (cellAt(g, e.x, e.y) === e.entry && bodyClear(g, e.x, e.y, clearance(e))) e.phase = PHASE.WALK;
    e.remaining = f.dist[e.entry]! + Math.sqrt((p.x - e.x) * (p.x - e.x) + (p.y - e.y) * (p.y - e.y));
  } else if (e.phase === PHASE.WALK) {
    const c = cellAt(g, e.x, e.y);
    if (c < 0 || f.dist[c] === 0) {
      e.phase = PHASE.EXIT;
    } else if (f.tunnel[c] === 1) {
      const p = cellCentre(cols, c);
      steer(sim, e, p.x, p.y, k * terrainSpeed(sim, c), true);
      if ((p.x - e.x) * (p.x - e.x) + (p.y - e.y) * (p.y - e.y) < TUNNEL_ENTER_DIST * TUNNEL_ENTER_DIST) {
        e.phase = PHASE.TUNNEL;
        e.tunnelTo = f.next[c]!;
        e.tunnelT = Math.max(1, Math.ceil((sim.level.tunnelLength[c]! / e.speed) * TICK_HZ));
      }
      e.remaining = f.dist[c]!;
    } else {
      if (e.wpT <= 0 || e.wpV !== sim.state.pathV || g.walk[e.wp] !== 1) {
        e.wp = pickWaypoint(sim, e, c, f);
        e.wpV = sim.state.pathV;
        e.wpT = LOOKAHEAD_REFRESH_TICKS;
      }
      e.wpT--;
      const p = cellCentre(cols, e.wp);
      let tx = p.x;
      let ty = p.y;
      // Lane offset perpendicular to the direction of travel, only where it stays clear. §3.3: it is
      // clamped so the body never clips the next row. A big body (clearance 0.3) on a 0.22 lane
      // would, and then wedged against a wall corner beside the corridor (R-MOVE-4).
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > EPS) {
        const reach = 0.5 - clearance(e) - EPS;
        const lane = Math.max(-reach, Math.min(reach, e.lane));
        const ox = tx - (dy / d) * lane;
        const oy = ty + (dx / d) * lane;
        if (bodyClear(g, ox, oy, clearance(e))) {
          tx = ox;
          ty = oy;
        }
      }
      steer(sim, e, tx, ty, k * terrainSpeed(sim, c), true);
      e.remaining = f.dist[e.wp]! + d;
    }
  }
  if (e.phase === PHASE.EXIT && e.stunT === 0) {
    steer(sim, e, e.x + route.exit.nx, e.y + route.exit.ny, k, false);
    const beyond = route.exit.edge === 'E' ? e.x - sim.level.cols : route.exit.edge === 'W' ? -e.x : route.exit.edge === 'S' ? e.y - sim.level.rows : -e.y;
    e.remaining = Math.max(0, LANE_OUT - beyond);
    if (beyond >= LANE_OUT) leak(sim, e);
  }
  e.progress = Math.min(1, Math.max(0, 1 - e.remaining / routeLen));
}

function moveAir(sim: Sim, e: Enemy): void {
  if (e.stunT > 0) return;
  if (e.bubbleT > 0) e.t = Math.max(0, e.t - (e.bubbleSpeed * DT) / e.len);
  else e.t += (e.speed * speedFactor(sim, e) * DT) / e.len;
  if (e.t >= 1) {
    e.t = 1;
    e.x = e.x1;
    e.y = e.y1;
    leak(sim, e);
    return;
  }
  e.x = e.x0 + (e.x1 - e.x0) * e.t;
  e.y = e.y0 + (e.y1 - e.y0) * e.t;
  e.remaining = (1 - e.t) * e.len;
  e.progress = e.t;
}

export function updateEnemies(sim: Sim): void {
  for (const e of sim.state.enemies) {
    if (e.dead) continue;
    if (e.air) moveAir(sim, e);
    else moveGround(sim, e);
  }
}

/** Where a unit will be in `seconds` if it keeps its current route and speed (lobbed-shell lead). */
export function predictPosition(sim: Sim, e: Enemy, seconds: number): { x: number; y: number } {
  const moving = e.stunT === 0 && e.bubbleT === 0 && e.revT === 0;
  const travel = moving ? e.speed * speedFactor(sim, e) * seconds : 0;
  if (e.air) {
    const t = Math.min(1, e.t + travel / e.len);
    return { x: e.x0 + (e.x1 - e.x0) * t, y: e.y0 + (e.y1 - e.y0) * t };
  }
  // A unit walking out down its exit lane heads straight out; one walking in heads for its entry cell,
  // then follows the route. Without a lead there, shells landed behind units in the lanes (R-LANE-1).
  if (e.phase === PHASE.EXIT) {
    const out = sim.level.routes[e.route]!.exit;
    return { x: e.x + out.nx * travel, y: e.y + out.ny * travel };
  }
  const first = e.phase === PHASE.ENTER ? e.entry : e.phase === PHASE.WALK ? e.wp : -1;
  if (first < 0 || travel === 0) return { x: e.x, y: e.y };
  const f = sim.fields[e.exit]!;
  const cols = sim.level.cols;
  let x = e.x;
  let y = e.y;
  let left = travel;
  let c = first;
  for (let guard = 0; guard < sim.level.n && left > 0 && c >= 0; guard++) {
    const p = cellCentre(cols, c);
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= left) return { x: x + (dx / d) * left, y: y + (dy / d) * left };
    left -= d;
    x = p.x;
    y = p.y;
    if (f.dist[c] === 0 || f.tunnel[c] === 1) break;
    c = f.next[c]!;
  }
  return { x, y };
}
