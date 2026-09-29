// DESIGN.md §6 hit resolution: vulnerability, brittle, cover, shields, armour
// (with aura armour, custard shred and penetration), minimum chip.
import type { DamageType } from '../data/schemas.ts';
import { PHASE, SPLASH_BODY_REACH, SPLIT_SPREAD, TICK_HZ } from './constants.ts';
import type { Sim } from './context.ts';
import { spawnChild } from './enemies.ts';
import { cellAt } from './grid.ts';
import { applyShred, slowEnemy, traitsOf } from './status.ts';
import { T } from './terrain.ts';
import type { Enemy } from './types.ts';

export interface HitOpts {
  /** Lobbed attacks ignore trench cover. */
  lobbed?: boolean;
}

/** Applies one hit and returns the HP actually removed. Kills (once) at ≤ 0 HP. */
export function damageEnemy(sim: Sim, e: Enemy, amount: number, type: DamageType, flatPen: number, opts: HitOpts = {}): number {
  if (e.dead || amount <= 0) return 0;
  const rules = sim.balance.damage;
  const def = sim.balance.enemies[e.type]!;
  let raw = amount * (def.vuln[type] ?? 1) * (1 + e.brittle);
  if (!opts.lobbed && rules.directFire.includes(type) && !e.air) {
    const c = cellAt(sim.grid, e.x, e.y);
    if (c >= 0 && sim.grid.terrain[c] === T.TRENCH) raw *= rules.coverMul;
  }
  if (e.shield > 0) {
    const mul = rules.types[type].shieldMul;
    const s = raw * mul;
    const absorbed = Math.min(e.shield, s);
    e.shield -= absorbed;
    raw = (s - absorbed) / mul;
    const ice = traitsOf(sim, e).iceShield;
    if (!ice) e.shieldT = Math.round((e.elite ? def.elite.shieldDelay ?? def.shieldDelay : def.shieldDelay) * TICK_HZ);
    if (e.shield <= 0) {
      e.shield = 0;
      sim.events.push({ e: 'shieldBreak', id: e.id, x: e.x, y: e.y });
      if (ice) {
        // The one stun a boss takes: its ice shield shattering (§5).
        e.stunT = Math.max(e.stunT, Math.round(ice.stun * TICK_HZ));
        e.shieldT = Math.round(ice.regrow * TICK_HZ);
      }
    }
  }
  let dealt = 0;
  if (raw > 0) {
    const effArmour = Math.max(0, e.armour + e.auraArmour - e.shred - flatPen) * (1 - rules.types[type].pen);
    dealt = Math.max(raw * rules.minChip, raw - effArmour);
    e.hp -= dealt;
  }
  const sprint = traitsOf(sim, e).sprint;
  if (sprint && !e.sprinted) {
    e.sprinted = true;
    e.sprintT = Math.round(sprint.dur * TICK_HZ);
  }
  if (e.hp <= 0) killEnemy(sim, e);
  return dealt;
}

export function killEnemy(sim: Sim, e: Enemy): void {
  if (e.dead) return;
  e.dead = true;
  const st = sim.state;
  st.cash += e.bounty;
  st.stats.earned += e.bounty;
  st.stats.bounty += e.bounty;
  st.stats.kills++;
  if (e.progress > st.stats.peakProgress) st.stats.peakProgress = e.progress;
  sim.events.push({ e: 'kill', id: e.id, type: e.type, elite: e.elite, x: e.x, y: e.y, bounty: e.bounty, wave: e.wave, progress: e.progress });
  const tr = traitsOf(sim, e);
  if (tr.split && !e.air && e.phase !== PHASE.TUNNEL) {
    sim.events.push({ e: 'split', id: e.id, x: e.x, y: e.y });
    for (let i = 0; i < tr.split.count; i++) {
      // Spread the pieces a little along the way it came.
      const back = (i - (tr.split.count - 1) / 2) * SPLIT_SPREAD;
      spawnChild(sim, e, tr.split.into, e.elite, e.x - e.hx * back - e.hy * back * 0.5, e.y - e.hy * back + e.hx * back * 0.5);
    }
  }
  if (tr.release) for (let i = 0; i < tr.release.count; i++) spawnChild(sim, e, tr.release.type, false, e.x, e.y);
}

/** Only the strongest slow applies; an equal slow refreshes its duration; a weaker one is ignored. */
export function applySlow(e: Enemy, slow: number, ticks: number): void {
  if (slow <= 0 || e.dead) return;
  if (slow > e.slow || e.slowT <= 0) {
    e.slow = slow;
    e.slowT = ticks;
  } else if (slow === e.slow && ticks > e.slowT) {
    e.slowT = ticks;
  }
}

export interface Targets {
  ground: boolean;
  air: boolean;
}

export interface SplashOpts {
  slow?: number;
  slowTicks?: number;
  shred?: number;
  shredTicks?: number;
  lobbed?: boolean;
  /** Skip one enemy (the direct target). */
  exclude?: number;
}

/**
 * Damage falling off linearly from 1 at the centre to `edge` at `radius`, plus optional
 * slow and custard. Returns the number of enemies hit.
 */
export function splashDamage(sim: Sim, x: number, y: number, radius: number, edge: number, damage: number, type: DamageType, pen: number, targets: Targets, o: SplashOpts = {}): number {
  let hits = 0;
  for (const e of sim.state.enemies) {
    if (e.dead || e.phase === PHASE.TUNNEL || e.id === o.exclude) continue;
    if (e.air ? !targets.air : !targets.ground) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius + e.radius * SPLASH_BODY_REACH) continue;
    const frac = Math.min(1, d / radius);
    if (o.shred) applyShred(e, o.shred, o.shredTicks ?? 0);
    damageEnemy(sim, e, damage * (1 - (1 - edge) * frac), type, pen, { lobbed: o.lobbed ?? false });
    if (o.slow) slowEnemy(sim, e, o.slow, o.slowTicks ?? 0);
    hits++;
  }
  return hits;
}
