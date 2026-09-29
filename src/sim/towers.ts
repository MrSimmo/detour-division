// Tower targeting, turret slew and every attack kind (DESIGN.md §4, §6).
import type { TargetMode, TowerDef, TowerTierDef } from '../data/schemas.ts';
import { DT, MUZZLE_OFFSET, PHASE, RETARGET_TICKS, ROCKET_MAX_LIFE_S, SALVO_SPREAD, TICK_HZ } from './constants.ts';
import { dcos, dsin, rotateToward } from './core/math.ts';
import { damageEnemy, splashDamage } from './combat.ts';
import type { Sim } from './context.ts';
import { predictPosition } from './enemies.ts';
import { queryRadius } from './spatial.ts';
import { applyBubble, applyBurn, applyFreeze, applyReverse, applyStun, canBubble, immune, slowEnemy } from './status.ts';
import type { Enemy, Projectile, Tower } from './types.ts';

const ticks = (s: number): number => Math.round(s * TICK_HZ);

/** Effective tier values after the strongest Tea Urn aura. */
function range(t: Tower, tier: TowerTierDef): number {
  return tier.range * (1 + t.bRange);
}
function dmg(t: Tower, tier: TowerTierDef): number {
  return tier.damage * (1 + t.bDamage);
}

function canTarget(sim: Sim, def: TowerDef, tier: TowerTierDef, e: Enemy): boolean {
  if (e.dead || e.phase === PHASE.TUNNEL || (e.air ? !def.targets.air : !def.targets.ground)) return false;
  // Crowd-control towers ignore units they cannot affect, so they never waste a shot.
  if (def.kind === 'bubble') return canBubble(sim, e, tier.heavyOk);
  if (def.kind === 'bellow') return e.revImmT === 0 && e.bubbleT === 0 && !sim.balance.enemies[e.type]!.boss && !immune(sim, e, 'reverse');
  return true;
}

function inRange(t: Tower, tier: TowerTierDef, e: Enemy): boolean {
  const dx = e.x - t.x;
  const dy = e.y - t.y;
  const d2 = dx * dx + dy * dy;
  const r = range(t, tier);
  return d2 <= r * r && d2 >= tier.minRange * tier.minRange;
}

/** True if `a` should be preferred over `b` under `mode`; ties go to the lower id. */
function better(mode: TargetMode, t: Tower, a: Enemy, b: Enemy): boolean {
  let ka: number;
  let kb: number;
  if (mode === 'first') {
    ka = -a.remaining;
    kb = -b.remaining;
  } else if (mode === 'last') {
    ka = a.remaining;
    kb = b.remaining;
  } else if (mode === 'strongest') {
    ka = a.hp + a.shield;
    kb = b.hp + b.shield;
  } else {
    ka = -((a.x - t.x) * (a.x - t.x) + (a.y - t.y) * (a.y - t.y));
    kb = -((b.x - t.x) * (b.x - t.x) + (b.y - t.y) * (b.y - t.y));
  }
  return ka > kb || (ka === kb && a.id < b.id);
}

function candidates(sim: Sim, t: Tower, def: TowerDef, tier: TowerTierDef): Enemy[] {
  const out: Enemy[] = [];
  queryRadius(sim.spatial, t.x, t.y, range(t, tier), (e) => {
    if (canTarget(sim, def, tier, e) && inRange(t, tier, e)) out.push(e);
  });
  return out;
}

function acquire(sim: Sim, t: Tower, def: TowerDef, tier: TowerTierDef): Enemy | undefined {
  let best: Enemy | undefined;
  for (const e of candidates(sim, t, def, tier)) if (!best || better(t.mode, t, e, best)) best = e;
  return best;
}

function inCone(t: Tower, cosHalf: number, r: number, e: Enemy): boolean {
  const dx = e.x - t.x;
  const dy = e.y - t.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return false;
  const d = Math.sqrt(d2);
  return d === 0 || (dx * t.ax + dy * t.ay) / d >= cosHalf;
}

const aimed = { x: 0, y: 0 };

function newProjectile(sim: Sim, t: Tower, kind: Projectile['kind'], x: number, y: number, tx: number, ty: number, target: number, life: number, tier: TowerTierDef, def: TowerDef): Projectile {
  return {
    id: sim.state.nextId++,
    kind,
    tower: t.id,
    ttype: t.type,
    tier: t.tier,
    x,
    y,
    px: x,
    py: y,
    hx: t.ax,
    hy: t.ay,
    sx: x,
    sy: y,
    tx,
    ty,
    target,
    age: 0,
    life,
    damage: dmg(t, tier),
    dmgType: tier.dmgType,
    splash: tier.splash,
    splashEdge: tier.splashEdge,
    pen: tier.armourPen,
    air: def.targets.air,
    ground: def.targets.ground,
    speed: tier.projSpeed ?? 0,
    slow: tier.slow,
    slowT: ticks(tier.slowDur),
    shred: tier.shred,
    shredT: ticks(tier.shredDur),
    zoneSlow: tier.zoneSlow,
    zoneT: ticks(tier.zoneDur),
    zoneR: tier.zoneRadius,
    bomblets: tier.bomblets,
    bombDamage: tier.bombletDamage * (1 + t.bDamage),
    bombSplash: tier.bombletSplash,
    dead: false,
  };
}

function fire(sim: Sim, t: Tower, def: TowerDef, tier: TowerTierDef, target: Enemy, aimX: number, aimY: number): void {
  const st = sim.state;
  const mx = t.x + t.ax * MUZZLE_OFFSET;
  const my = t.y + t.ay * MUZZLE_OFFSET;
  sim.events.push({ e: 'fire', tower: t.id, ttype: t.type, tier: t.tier, x: mx, y: my, tx: aimX, ty: aimY, target: target.id });
  t.shots++;
  t.active = st.tick;
  const slowTicks = ticks(tier.slowDur);
  const damage = dmg(t, tier);
  switch (def.kind) {
    case 'hitscan': {
      const tx = target.x;
      const ty = target.y;
      damageEnemy(sim, target, damage, tier.dmgType, tier.armourPen);
      slowEnemy(sim, target, tier.slow, slowTicks);
      if (tier.splash > 0) splashDamage(sim, tx, ty, tier.splash, tier.splashEdge, damage, tier.dmgType, tier.armourPen, def.targets, { slow: tier.slow, slowTicks, exclude: target.id });
      if (tier.zoneSlow > 0) addZone(sim, 'puddle', tx, ty, tier.zoneRadius, ticks(tier.zoneDur), tier.zoneSlow, 0);
      return;
    }
    case 'chain': {
      const hit = new Set<number>();
      const pts: number[] = [mx, my];
      let cur: Enemy | undefined = target;
      let k = 0;
      const stunning = tier.stunEvery > 0 && t.shots % tier.stunEvery === 0;
      while (cur) {
        hit.add(cur.id);
        pts.push(cur.x, cur.y);
        let f = 1;
        for (let i = 0; i < k; i++) f *= 1 - tier.jumpFalloff;
        damageEnemy(sim, cur, damage * f, tier.dmgType, tier.armourPen);
        if (stunning) applyStun(sim, cur, tier.stunDur);
        if (k >= tier.jumps) break;
        let next: Enemy | undefined;
        let bestD = Infinity;
        const from: Enemy = cur;
        queryRadius(sim.spatial, from.x, from.y, tier.jumpRange, (e) => {
          if (hit.has(e.id) || !canTarget(sim, def, tier, e)) return;
          const d = (e.x - from.x) * (e.x - from.x) + (e.y - from.y) * (e.y - from.y);
          if (d < bestD || (d === bestD && next && e.id < next.id)) {
            bestD = d;
            next = e;
          }
        });
        cur = next;
        k++;
      }
      sim.events.push({ e: 'zap', tower: t.id, tier: t.tier, pts });
      return;
    }
    case 'pulse': {
      const r = range(t, tier);
      queryRadius(sim.spatial, t.x, t.y, r, (e) => {
        if (e.air || e.dead) return;
        damageEnemy(sim, e, damage, tier.dmgType, tier.armourPen);
        applyFreeze(sim, e, ticks(tier.freeze), tier.brittle, ticks(tier.brittleDur), tier.bossSlow, ticks(tier.bossSlowDur));
      });
      sim.events.push({ e: 'pulse', tower: t.id, tier: t.tier, x: t.x, y: t.y, r });
      return;
    }
    case 'bellow': {
      const r = range(t, tier);
      const cosHalf = sim.rt.coneCos[`${t.type}.${t.tier}`]!;
      queryRadius(sim.spatial, t.x, t.y, r, (e) => {
        if (e.air || !inCone(t, cosHalf, r, e)) return;
        applyReverse(sim, e, ticks(tier.reverse), ticks(tier.reverseImmune), ticks(tier.dizzy));
      });
      sim.events.push({ e: 'bellow', tower: t.id, tier: t.tier, x: t.x, y: t.y, ax: t.ax, ay: t.ay, cone: tier.cone ?? 0, r });
      return;
    }
    case 'bubble': {
      const list = candidates(sim, t, def, tier).sort((a, b) => (better(t.mode, t, a, b) ? -1 : better(t.mode, t, b, a) ? 1 : 0));
      for (const e of list.slice(0, tier.bubbles)) {
        if (applyBubble(e, ticks(tier.bubbleDur), tier.bubbleSpeed, tier.popDamage, tier.zoneSlow, ticks(tier.zoneDur), tier.zoneRadius)) {
          sim.events.push({ e: 'bubble', tower: t.id, id: e.id });
        }
      }
      return;
    }
    case 'homing':
    case 'lob': {
      const kind: Projectile['kind'] = def.kind === 'homing' ? 'rocket' : tier.shred > 0 ? 'pie' : 'shell';
      const life = kind === 'rocket' ? ticks(ROCKET_MAX_LIFE_S) : Math.max(1, ticks(tier.flight ?? 1));
      for (let i = 0; i < tier.salvo; i++) {
        const off = tier.salvo > 1 ? i / (tier.salvo - 1) - 0.5 : 0;
        const p = newProjectile(sim, t, kind, mx, my, aimX, aimY, target.id, life, tier, def);
        if (kind === 'rocket') {
          const c = dcos(off * SALVO_SPREAD * 2);
          const s = dsin(off * SALVO_SPREAD * 2);
          p.hx = t.ax * c - t.ay * s;
          p.hy = t.ax * s + t.ay * c;
        } else if (tier.spread > 0) {
          // Pies land in a line across the aim direction.
          p.tx = aimX - t.ay * off * tier.spread * 2;
          p.ty = aimY + t.ax * off * tier.spread * 2;
        }
        st.projectiles.push(p);
      }
      return;
    }
    default:
      return;
  }
}

export function addZone(sim: Sim, kind: 'puddle' | 'foam' | 'fire', x: number, y: number, r: number, t: number, slow: number, dps: number): void {
  sim.state.zones.push({ id: sim.state.nextId++, kind, x, y, r, t, slow, dps });
}

/** Strongest Tea Urn aura per tower (auras never stack, §4). */
function applyAuras(sim: Sim): void {
  const towers = sim.state.towers;
  for (const t of towers) {
    t.bRate = 0;
    t.bRange = 0;
    t.bDamage = 0;
  }
  for (const u of towers) {
    const def = sim.balance.towers[u.type]!;
    if (def.kind !== 'aura') continue;
    const tier = def.tiers[u.tier]!;
    for (const t of towers) {
      if (t === u || sim.balance.towers[t.type]!.kind === 'aura') continue;
      const dx = t.x - u.x;
      const dy = t.y - u.y;
      if (dx * dx + dy * dy > tier.range * tier.range || tier.auraRate <= t.bRate) continue;
      t.bRate = tier.auraRate;
      t.bRange = tier.auraRange;
      t.bDamage = tier.auraDamage;
    }
  }
}

function coneTick(sim: Sim, t: Tower, def: TowerDef, tier: TowerTierDef, target: Enemy): void {
  const r = range(t, tier);
  const cosHalf = sim.rt.coneCos[`${t.type}.${t.tier}`]!;
  const d = dmg(t, tier) * DT;
  queryRadius(sim.spatial, t.x, t.y, r, (e) => {
    if (!canTarget(sim, def, tier, e) || !inCone(t, cosHalf, r, e)) return;
    damageEnemy(sim, e, d, tier.dmgType, tier.armourPen);
    applyBurn(sim, e, t.id, tier.burnDps, ticks(tier.burnDur));
  });
  t.active = sim.state.tick;
  if (tier.patchDps > 0) {
    t.patchT -= DT;
    if (t.patchT <= 0) {
      t.patchT = tier.patchEvery;
      addZone(sim, 'fire', target.x, target.y, tier.zoneRadius, ticks(tier.patchDur), 0, tier.patchDps);
    }
  }
}

function beamFire(sim: Sim, t: Tower, def: TowerDef, tier: TowerTierDef): void {
  const r = range(t, tier);
  const x1 = t.x + t.ax * r;
  const y1 = t.y + t.ay * r;
  const half = tier.beamWidth / 2;
  const damage = dmg(t, tier);
  queryRadius(sim.spatial, (t.x + x1) / 2, (t.y + y1) / 2, r / 2 + half + 1, (e) => {
    if (!canTarget(sim, def, tier, e)) return;
    const along = (e.x - t.x) * t.ax + (e.y - t.y) * t.ay;
    if (along < 0 || along > r) return;
    const across = Math.abs((e.x - t.x) * -t.ay + (e.y - t.y) * t.ax);
    if (across > half + e.radius) return;
    damageEnemy(sim, e, damage, tier.dmgType, tier.armourPen);
    applyBurn(sim, e, t.id, tier.burnDps, ticks(tier.burnDur));
  });
  t.shots++;
  t.active = sim.state.tick;
  sim.events.push({ e: 'beam', tower: t.id, tier: t.tier, x0: t.x, y0: t.y, x1, y1, w: tier.beamWidth });
}

export function updateTowers(sim: Sim): void {
  applyAuras(sim);
  for (const t of sim.state.towers) {
    t.pax = t.ax;
    t.pay = t.ay;
    const def = sim.balance.towers[t.type]!;
    const tier = def.tiers[t.tier]!;
    if (def.kind === 'aura') continue;
    t.cd -= DT * (1 + t.bRate);
    if (def.kind === 'pulse') {
      if (t.cd <= 0) {
        let any = false;
        queryRadius(sim.spatial, t.x, t.y, range(t, tier), (e) => {
          if (!e.air && !e.dead) any = true;
        });
        if (any) {
          fire(sim, t, def, tier, sim.spatial.list[0]!, t.x, t.y);
          t.cd += 1 / tier.rate;
        } else t.cd = 0;
      }
      continue;
    }
    // Sunbeam: once charging, the beam fires along wherever the lens points.
    if (def.kind === 'beam' && t.charge > 0) {
      const tgt = t.target ? sim.byId.get(t.target) : undefined;
      if (tgt && !tgt.dead) aimAt(sim, t, tgt.x, tgt.y);
      if (--t.charge === 0) {
        beamFire(sim, t, def, tier);
        t.cd = Math.max(0, 1 / tier.rate - tier.charge);
      }
      continue;
    }
    let target = t.target ? sim.byId.get(t.target) : undefined;
    if (target && (!canTarget(sim, def, tier, target) || !inRange(t, tier, target))) target = undefined;
    if (!target || t.retarget <= 0) {
      target = acquire(sim, t, def, tier);
      t.retarget = RETARGET_TICKS;
    }
    t.retarget--;
    t.target = target ? target.id : 0;
    if (!target) {
      if (t.cd < 0) t.cd = 0;
      continue;
    }
    let aimX = target.x;
    let aimY = target.y;
    if (def.kind === 'lob') {
      const p = predictPosition(sim, target, tier.flight ?? 0);
      aimX = p.x;
      aimY = p.y;
    }
    const onTarget = aimAt(sim, t, aimX, aimY);
    if (def.kind === 'cone') {
      if (onTarget) coneTick(sim, t, def, tier, target);
      continue;
    }
    if (t.cd > 0) continue;
    if (!onTarget) {
      t.cd = 0;
      continue;
    }
    if (def.kind === 'beam') {
      t.charge = Math.max(1, ticks(tier.charge));
      continue;
    }
    fire(sim, t, def, tier, target, aimX, aimY);
    t.cd += 1 / tier.rate;
  }
}

/** Slews the turret towards (x,y); true once it points within the aim tolerance. */
function aimAt(sim: Sim, t: Tower, x: number, y: number): boolean {
  const dx = x - t.x;
  const dy = y - t.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return true;
  const turn = sim.rt.turretTurn[t.type]!;
  rotateToward(t.ax, t.ay, dx / d, dy / d, turn.c, turn.s, aimed);
  t.ax = aimed.x;
  t.ay = aimed.y;
  return (t.ax * dx + t.ay * dy) / d >= sim.rt.aimCos[t.type]!;
}

