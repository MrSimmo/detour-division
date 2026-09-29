// Homing rockets, lobbed shells, custard pies and cluster bomblets.
import type { DamageType } from '../data/schemas.ts';
import { BOMBLET_FLIGHT_S, BOMBLET_REACH, DT, ROCKET_HIT_RADIUS, PHASE, TICK_HZ } from './constants.ts';
import { rotateToward } from './core/math.ts';
import { damageEnemy, splashDamage } from './combat.ts';
import type { Sim } from './context.ts';
import { addZone } from './towers.ts';
import type { Projectile } from './types.ts';

function detonate(sim: Sim, p: Projectile, x: number, y: number): void {
  p.dead = true;
  const type = p.dmgType as DamageType;
  const targets = { ground: p.ground, air: p.air };
  const lobbed = p.kind !== 'rocket';
  if (p.splash > 0) {
    splashDamage(sim, x, y, p.splash, p.splashEdge, p.damage, type, p.pen, targets, { lobbed, slow: p.slow, slowTicks: p.slowT, shred: p.shred, shredTicks: p.shredT });
  } else {
    const t = sim.byId.get(p.target);
    if (t) damageEnemy(sim, t, p.damage, type, p.pen, { lobbed });
  }
  if (p.zoneSlow > 0) addZone(sim, 'puddle', x, y, p.zoneR, p.zoneT, p.zoneSlow, 0);
  sim.events.push({ e: 'boom', x, y, radius: p.splash, ttype: p.ttype, tier: p.tier });
  if (p.bomblets > 0) {
    // Cluster: bomblets scatter evenly round the impact (ring vectors precomputed, ADR-0003).
    const ring = sim.rt.ring[p.bomblets]!;
    for (const v of ring) {
      sim.state.projectiles.push({
        ...p,
        id: sim.state.nextId++,
        kind: 'bomblet',
        x,
        y,
        px: x,
        py: y,
        sx: x,
        sy: y,
        tx: x + v.x * BOMBLET_REACH,
        ty: y + v.y * BOMBLET_REACH,
        age: 0,
        life: Math.max(1, Math.round(BOMBLET_FLIGHT_S * TICK_HZ)),
        damage: p.bombDamage,
        splash: p.bombSplash,
        bomblets: 0,
        zoneSlow: 0,
        dead: false,
      });
    }
  }
}

const turned = { x: 0, y: 0 };

export function updateProjectiles(sim: Sim): void {
  for (const p of sim.state.projectiles.slice()) {
    if (p.dead) continue;
    p.px = p.x;
    p.py = p.y;
    p.age++;
    if (p.kind !== 'rocket') {
      const f = p.age / p.life;
      p.x = p.sx + (p.tx - p.sx) * f;
      p.y = p.sy + (p.ty - p.sy) * f;
      if (p.age >= p.life) detonate(sim, p, p.tx, p.ty);
      continue;
    }
    const target = sim.byId.get(p.target);
    if (target && !target.dead && target.phase !== PHASE.TUNNEL) {
      p.tx = target.x;
      p.ty = target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const reach = ROCKET_HIT_RADIUS + (target ? target.radius : 0);
    const step = p.speed * DT;
    if (d <= reach || d <= step) {
      p.x = p.tx;
      p.y = p.ty;
      detonate(sim, p, p.tx, p.ty);
      continue;
    }
    const turn = sim.rt.projTurn[`${p.ttype}.${p.tier}`]!;
    rotateToward(p.hx, p.hy, dx / d, dy / d, turn.c, turn.s, turned);
    p.hx = turned.x;
    p.hy = turned.y;
    p.x += p.hx * step;
    p.y += p.hy * step;
    if (p.age >= p.life) detonate(sim, p, p.x, p.y);
  }
}
