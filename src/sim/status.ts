// Status effects and their stacking rules (DESIGN.md §6).
import type { Immunity, TraitsDef } from '../data/schemas.ts';
import { TICK_HZ } from './constants.ts';
import { applySlow, damageEnemy } from './combat.ts';
import type { Sim } from './context.ts';
import type { Enemy } from './types.ts';

export function traitsOf(sim: Sim, e: Enemy): TraitsDef {
  return sim.rt.traits[`${e.type}.${e.elite ? 1 : 0}`]!.traits;
}

export function immune(sim: Sim, e: Enemy, what: Immunity): boolean {
  return sim.rt.traits[`${e.type}.${e.elite ? 1 : 0}`]!.immune.has(what);
}

const ticks = (s: number): number => Math.round(s * TICK_HZ);

/** A slow after resistance; bosses are capped (§5). */
export function slowEnemy(sim: Sim, e: Enemy, slow: number, t: number): void {
  const def = sim.balance.enemies[e.type]!;
  let s = slow * (1 - def.slowResist);
  if (def.boss) s = Math.min(s, sim.balance.damage.status.bossSlowCap);
  applySlow(e, s, t);
}

/** Freeze (Icebox). Bosses are slowed instead; a thawed unit is immune for a while and then brittle. */
export function applyFreeze(sim: Sim, e: Enemy, t: number, brittle: number, brittleT: number, bossSlow: number, bossSlowT: number): void {
  if (e.dead) return;
  const def = sim.balance.enemies[e.type]!;
  if (def.boss || immune(sim, e, 'freeze')) {
    slowEnemy(sim, e, bossSlow, bossSlowT);
    return;
  }
  if (e.freezeImmT > 0) return;
  const dur = Math.round(t * (1 - def.stunResist));
  e.stunT = Math.max(e.stunT, dur);
  e.frozen = true;
  e.freezeImmT = dur + ticks(sim.balance.damage.status.freezeImmune);
  e.pBrittle = Math.max(e.pBrittle, brittle);
  e.pBrittleT = Math.max(e.pBrittleT, brittleT);
  sim.events.push({ e: 'freeze', id: e.id, x: e.x, y: e.y });
}

/** A short stun (Sparkplug T3, Bellower dizzy). Bosses and stun-immune units ignore it. */
export function applyStun(sim: Sim, e: Enemy, t: number): void {
  const def = sim.balance.enemies[e.type]!;
  if (e.dead || def.boss || immune(sim, e, 'stun')) return;
  e.stunT = Math.max(e.stunT, Math.round(t * (1 - def.stunResist)));
}

/** Burns refresh per source and stack up to the configured number of sources. */
export function applyBurn(sim: Sim, e: Enemy, src: number, dps: number, t: number): void {
  if (e.dead || dps <= 0 || t <= 0) return;
  const existing = e.burns.find((b) => b.src === src);
  if (existing) {
    existing.dps = Math.max(existing.dps, dps);
    existing.t = Math.max(existing.t, t);
    return;
  }
  if (e.burns.length < sim.balance.damage.status.burnStacks) {
    e.burns.push({ src, dps, t });
    return;
  }
  let weakest = 0;
  for (let i = 1; i < e.burns.length; i++) if (e.burns[i]!.dps < e.burns[weakest]!.dps) weakest = i;
  if (dps > e.burns[weakest]!.dps) e.burns[weakest] = { src, dps, t };
}

/** Custard: the strongest shred applies, and an equal one refreshes. */
export function applyShred(e: Enemy, shred: number, t: number): void {
  if (e.dead || shred <= 0) return;
  if (shred > e.shred || e.shredT <= 0) {
    e.shred = shred;
    e.shredT = t;
  } else if (shred === e.shred) e.shredT = Math.max(e.shredT, t);
}

/** About turn (Bellower). Returns true if it took effect. */
export function applyReverse(sim: Sim, e: Enemy, t: number, immuneT: number, dizzyT: number): boolean {
  if (e.dead || e.air || e.revImmT > 0 || e.bubbleT > 0 || sim.balance.enemies[e.type]!.boss || immune(sim, e, 'reverse')) return false;
  e.revT = t;
  e.revImmT = t + immuneT;
  e.pDizzyT = dizzyT;
  sim.events.push({ e: 'reverse', id: e.id, x: e.x, y: e.y });
  return true;
}

export function canBubble(sim: Sim, e: Enemy, heavyOk: boolean): boolean {
  const def = sim.balance.enemies[e.type]!;
  return !e.dead && e.bubbleT === 0 && !def.boss && !immune(sim, e, 'bubble') && (heavyOk || !def.heavy);
}

/** Bubble (Bubbler): floats the unit back along its route, then pops. */
export function applyBubble(e: Enemy, t: number, speed: number, pop: number, zoneSlow: number, zoneT: number, zoneR: number): boolean {
  if (e.bubbleT > 0) return false;
  e.bubbleT = t;
  e.bubbleSpeed = speed;
  e.bubblePop = pop;
  e.bubbleZone = zoneSlow;
  e.bubbleZoneT = zoneT;
  e.bubbleZoneR = zoneR;
  e.revT = 0;
  return true;
}

/** Per-tick status bookkeeping, before movement. */
export function tickStatus(sim: Sim, e: Enemy): void {
  if (e.slowT > 0 && --e.slowT === 0) e.slow = 0;
  if (e.freezeImmT > 0) e.freezeImmT--;
  if (e.stunT > 0) {
    e.stunT--;
    if (e.stunT === 0 && e.frozen) {
      e.frozen = false;
      if (e.pBrittle > 0) {
        e.brittle = e.pBrittle;
        e.brittleT = e.pBrittleT;
        e.pBrittle = 0;
        e.pBrittleT = 0;
      }
    }
  }
  if (e.brittleT > 0 && --e.brittleT === 0) e.brittle = 0;
  if (e.shredT > 0 && --e.shredT === 0) e.shred = 0;
  if (e.revImmT > 0) e.revImmT--;
  if (e.revT > 0 && --e.revT === 0 && e.pDizzyT > 0) {
    applyStun(sim, e, e.pDizzyT / TICK_HZ);
    e.pDizzyT = 0;
  }
  if (e.sprintT > 0) e.sprintT--;
  if (e.burstT > 0) e.burstT--;
  // Shields: regenerate after a pause, or (ice shield) regrow whole after a delay.
  if (e.maxShield > 0 && e.shield < e.maxShield) {
    const ice = traitsOf(sim, e).iceShield;
    if (e.shieldT > 0) e.shieldT--;
    else if (ice) {
      if (e.shield <= 0) {
        e.shield = e.maxShield;
        sim.events.push({ e: 'shieldUp', id: e.id });
      }
    } else {
      const regen = sim.balance.enemies[e.type]!.shieldRegen / TICK_HZ;
      if (regen > 0) {
        if (e.shield <= 0) sim.events.push({ e: 'shieldUp', id: e.id });
        e.shield = Math.min(e.maxShield, e.shield + regen);
      }
    }
  }
  for (let i = e.burns.length - 1; i >= 0; i--) {
    const b = e.burns[i]!;
    damageEnemy(sim, e, b.dps / TICK_HZ, 'fire', 0);
    if (--b.t <= 0) e.burns.splice(i, 1);
  }
  if (e.bubbleT > 0 && --e.bubbleT === 0 && !e.dead) {
    sim.events.push({ e: 'pop', id: e.id, x: e.x, y: e.y });
    if (e.bubbleZone > 0) sim.state.zones.push({ id: sim.state.nextId++, kind: 'foam', x: e.x, y: e.y, r: e.bubbleZoneR, t: e.bubbleZoneT, slow: e.bubbleZone, dps: 0 });
    damageEnemy(sim, e, e.bubblePop, 'kinetic', 0);
  }
}
