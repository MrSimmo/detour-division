// Enemy traits that act each tick: auras, healing, dashes, boss bursts, deployments,
// drops and phases (DESIGN.md §5).
import { DEPLOY_BACK, DEPLOY_SIDE, TICK_HZ } from './constants.ts';
import type { Sim } from './context.ts';
import { spawnChild } from './enemies.ts';
import { cellIndex } from './level.ts';
import { cellCentre } from './path.ts';
import { tickStatus, traitsOf } from './status.ts';
import type { Enemy } from './types.ts';

const ticks = (s: number): number => Math.round(s * TICK_HZ);

function near(a: Enemy, b: Enemy, r: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= r * r;
}

/** Nearest walkable cell to (x,y) from which some ground route's exit is reachable. */
function dropCell(sim: Sim, x: number, y: number): { cell: number; route: number } | null {
  const lv = sim.level;
  let best: { cell: number; route: number } | null = null;
  let bestD = Infinity;
  for (let cy = 0; cy < lv.rows; cy++) {
    for (let cx = 0; cx < lv.cols; cx++) {
      const c = cellIndex(lv.cols, cx, cy);
      if (sim.grid.walk[c] !== 1) continue;
      const route = lv.routes.findIndex((r) => !r.airOnly && Number.isFinite(sim.fields[r.exitIndex]!.dist[c]!));
      if (route < 0) continue;
      const d = (cx + 0.5 - x) * (cx + 0.5 - x) + (cy + 0.5 - y) * (cy + 0.5 - y);
      if (d < bestD) {
        bestD = d;
        best = { cell: c, route };
      }
    }
  }
  return best;
}

export function updateTraits(sim: Sim): void {
  const list = sim.state.enemies;
  for (const e of list) {
    e.auraSpeed = 0;
    e.auraArmour = 0;
  }
  for (const src of list) {
    if (src.dead) continue;
    const tr = traitsOf(sim, src);
    if (tr.aura) {
      for (const e of list) {
        if (e === src || e.dead || !near(src, e, tr.aura.radius)) continue;
        if (tr.aura.speed > e.auraSpeed) e.auraSpeed = tr.aura.speed;
        if (tr.aura.armour > e.auraArmour) e.auraArmour = tr.aura.armour;
      }
    }
  }
  // Iterate over a snapshot: deployments append to the list.
  for (const e of list.slice()) {
    if (e.dead) continue;
    tickStatus(sim, e);
    if (e.dead) continue;
    const tr = traitsOf(sim, e);
    const def = sim.balance.enemies[e.type]!;
    const frac = e.hp / e.maxHp;
    if (tr.heal && --e.healT <= 0) {
      e.healT = ticks(tr.heal.every);
      sim.events.push({ e: 'heal', id: e.id, x: e.x, y: e.y, r: tr.heal.radius });
      for (const a of list) {
        if (a === e || a.dead || !near(e, a, tr.heal.radius)) continue;
        const pct = sim.balance.enemies[a.type]!.boss ? tr.heal.bossPct : tr.heal.pct;
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * pct);
        if (tr.heal.cleanse) {
          a.slow = 0;
          a.slowT = 0;
          a.burns = [];
        }
      }
    }
    e.dashing = tr.dash !== undefined && frac < tr.dash.below;
    if (tr.burst && !e.bursted && frac < tr.burst.below) {
      e.bursted = true;
      e.burstT = ticks(tr.burst.dur);
    }
    if (tr.phases) {
      while (e.bossPhase < tr.phases.length && frac < tr.phases[e.bossPhase]!.below) {
        const ph = tr.phases[e.bossPhase]!;
        e.bossPhase++;
        if (ph.armour !== undefined) e.armour = ph.armour;
        if (ph.speed !== undefined) e.speedMul = ph.speed / def.speed;
        if (ph.spawner) e.spawnT = ticks(ph.spawner.every);
        sim.events.push({ e: 'phase', id: e.id, phase: e.bossPhase });
      }
    }
    // The active deployment: the base trait, or the latest phase that brought one.
    let spawner = tr.spawner;
    if (tr.phases) for (let i = 0; i < e.bossPhase; i++) spawner = tr.phases[i]!.spawner ?? spawner;
    if (spawner && e.stunT === 0 && --e.spawnT <= 0) {
      e.spawnT = ticks(spawner.every);
      for (let i = 0; i < spawner.count; i++) {
        const side = (i - (spawner.count - 1) / 2) * DEPLOY_SIDE;
        spawnChild(sim, e, spawner.type, false, e.x - e.hx * DEPLOY_BACK - e.hy * side, e.y - e.hy * DEPLOY_BACK + e.hx * side);
      }
    }
    if (tr.dropper && --e.dropT <= 0) {
      e.dropT = ticks(tr.dropper.every);
      const at = dropCell(sim, e.x, e.y);
      if (at) {
        const p = cellCentre(sim.level.cols, at.cell);
        sim.events.push({ e: 'drop', id: e.id, x: p.x, y: p.y });
        spawnChild(sim, e, tr.dropper.type, false, p.x, p.y, at.route);
      }
    }
  }
}
