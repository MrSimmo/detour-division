// R-LANE-2 (ADR-0014): where the forest closes over each gate lane, checked against the baked sprites and
// against every level laid out at the desktop window sizes. Playwright checks the drawn result (e2e/lanes.spec.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/app/layout.ts';
import { LANE_IN } from '../../src/sim/constants.ts';
import { FRINGE_SPILL, laneEnd } from '../../src/render/lanes.ts';

type Edge = 'N' | 'S' | 'E' | 'W';
interface Frame {
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  anchor?: { x: number; y: number };
}
const CELL = 64;
const frames: Record<string, Frame> = {};
for (const f of readdirSync('public/assets/atlas').filter((n) => n.endsWith('@1x.json'))) Object.assign(frames, (JSON.parse(readFileSync(`public/assets/atlas/${f}`, 'utf8')) as { frames: Record<string, Frame> }).frames);

/** How far a frame's opaque pixels reach from its anchor, towards each side, in cells. */
function reach(f: Frame): Record<'l' | 'r' | 'u' | 'd', number> {
  const s = f.spriteSourceSize;
  const ax = (f.anchor?.x ?? 0.5) * f.sourceSize.w;
  const ay = (f.anchor?.y ?? 0.5) * f.sourceSize.h;
  return { l: (ax - s.x) / CELL, r: (s.x + s.w - ax) / CELL, u: (ay - s.y) / CELL, d: (s.y + s.h - ay) / CELL };
}
/** The side of a sprite that faces the field, for a unit on a lane at each edge. */
const TOWARDS_FIELD: Record<Edge, 'l' | 'r' | 'u' | 'd'> = { W: 'r', E: 'l', N: 'd', S: 'u' };

const enemies = JSON.parse(readFileSync('data/balance/enemies.json', 'utf8')) as Record<string, { radius: number; air?: boolean }>;
const ground = Object.entries(enemies).filter(([, e]) => !e.air);
const shadow = frames['fx.shadow']!;

interface Lv {
  id: string;
  grid: { cols: number; rows: number };
  routes: { airOnly?: boolean; entrance: { edge: Edge }; exit: { edge: Edge } }[];
}
const levels: Lv[] = [];
for (const z of readdirSync('data/levels').filter((n) => /^z\d$/.test(n))) for (const f of readdirSync(`data/levels/${z}`).filter((n) => n.endsWith('.json'))) levels.push(JSON.parse(readFileSync(`data/levels/${z}/${f}`, 'utf8')) as Lv);

describe('R-LANE-2: the lanes close under the trees', () => {
  it('1: every ground unit is wholly under the trees at its spawn point, on every edge', () => {
    const peeking: string[] = [];
    for (const edge of ['N', 'S', 'E', 'W'] as const) {
      const side = TOWARDS_FIELD[edge];
      for (const [type, e] of ground) {
        const keys = Object.keys(frames).filter((k) => k.startsWith(`enemy.${type}.n.`) || k.startsWith(`enemy.${type}.e.`));
        expect(keys.length, `${type} has frames`).toBeGreaterThan(0);
        let far = Math.max(...keys.map((k) => reach(frames[k]!)[side]));
        // The shadow is scaled to the unit's radius and drawn 3 px right and 2 px below its feet.
        const sw = (e.radius * 2.6) / (shadow.sourceSize.w / CELL);
        const sr = reach(shadow);
        far = Math.max(far, sr[side] * sw + (side === 'r' ? 3 : side === 'l' ? -3 : side === 'd' ? 2 : -2) / CELL);
        if (LANE_IN - far < laneEnd(edge, 'in')) peeking.push(`${type} on ${edge}: ${(LANE_IN - far).toFixed(2)} < ${laneEnd(edge, 'in')}`);
      }
    }
    expect(peeking).toEqual([]);
  });

  it("FRINGE_SPILL covers the lane end's leaves and corner bushes", () => {
    const spill: Record<Edge, number[]> = {
      W: [reach(frames['terrain.z1.fringe.w']!).r, reach(frames['terrain.z1.bush.0']!).r],
      E: [reach(frames['terrain.z1.fringe.e']!).l, reach(frames['terrain.z1.bush.0']!).l],
      // The corner bush stands 0.19 cells below the lane's end line.
      N: [reach(frames['terrain.z1.fringe.n']!).d, reach(frames['terrain.z1.bush.0']!).d + 0.19],
      S: [reach(frames['terrain.z1.fringe.s']!).u, reach(frames['terrain.z1.bush.0']!).u - 0.19],
    };
    for (const [edge, v] of Object.entries(spill)) expect(Math.max(...v), edge).toBeLessThanOrEqual(FRINGE_SPILL);
  });

  it('3: at the desktop windows, every lane end lies beyond the window edge on every level', () => {
    const windows = [
      [1366, 768],
      [1440, 789],
      [1920, 1080],
      [3840, 2160],
    ] as const;
    const seen: string[] = [];
    for (const [w, h] of windows) {
      for (const lv of levels) {
        const L = computeLayout({ w, h, safe: { t: 0, r: 0, b: 0, l: 0 }, cols: lv.grid.cols + 2, rows: lv.grid.rows + 2, device: 'desktop', slots: 6 });
        const { playfield: pf, cell: c } = L;
        // Cells of lane on screen beyond the playable edge (the playfield includes a one-cell border).
        const shown: Record<Edge, number> = { W: (pf.x + c) / c, E: (w - (pf.x + pf.w - c)) / c, N: (pf.y + c) / c, S: (h - (pf.y + pf.h - c)) / c };
        for (const r of lv.routes) {
          if (r.airOnly) continue;
          for (const [edge, role] of [[r.entrance.edge, 'in'], [r.exit.edge, 'out']] as const) {
            const end = laneEnd(edge, role) - FRINGE_SPILL;
            if (shown[edge] > end) seen.push(`${lv.id} ${w}×${h} ${role} ${edge}: ${shown[edge].toFixed(2)} cells shown, ends at ${end.toFixed(2)}`);
          }
        }
      }
    }
    expect(seen).toEqual([]);
  });
});
