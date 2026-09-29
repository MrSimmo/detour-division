// Lingering ground effects: treacle puddles and foam slow, burning patches burn.
import { PHASE, ZONE_SLOW_TICKS, ZONE_BURN_TICKS, MAX_ZONES } from './constants.ts';
import type { Sim } from './context.ts';
import { applyBurn, slowEnemy } from './status.ts';

export function updateZones(sim: Sim): void {
  const st = sim.state;
  if (st.zones.length > MAX_ZONES) st.zones.splice(0, st.zones.length - MAX_ZONES);
  for (const z of st.zones) {
    z.t--;
    for (const e of st.enemies) {
      if (e.dead || e.air || e.phase === PHASE.TUNNEL) continue;
      const dx = e.x - z.x;
      const dy = e.y - z.y;
      if (dx * dx + dy * dy > z.r * z.r) continue;
      if (z.kind === 'fire') applyBurn(sim, e, -z.id, z.dps, ZONE_BURN_TICKS);
      else slowEnemy(sim, e, z.slow, ZONE_SLOW_TICKS);
    }
  }
  if (st.zones.some((z) => z.t <= 0)) st.zones = st.zones.filter((z) => z.t > 0);
}
