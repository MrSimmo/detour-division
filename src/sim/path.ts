// ADR-0004: one distance field per exit, by Dijkstra over reversed edges.
// 8-connected with no corner-cutting, terrain-aware costs, and tunnel edges.
import type { BalanceDef } from '../data/schemas.ts';
import type { Vec } from './core/math.ts';
import type { GridRT } from './grid.ts';
import { spanOutside, type LevelRT, type RouteRT } from './level.ts';
import { CONVEYOR_DX, CONVEYOR_DY, NEIGHBOURS, T, isConveyor } from './terrain.ts';

export interface Field {
  /** Travel cost from each cell to the target cells; Infinity if unreachable. */
  dist: Float64Array;
  /** Next cell along the cheapest route, or -1. */
  next: Int32Array;
  /** 1 where `next` is the far mouth of a tunnel. */
  tunnel: Uint8Array;
}

export function newField(n: number): Field {
  return { dist: new Float64Array(n), next: new Int32Array(n), tunnel: new Uint8Array(n) };
}

/** Binary min-heap on (dist, cell); ties break on cell index so results never depend on insertion order. */
class Heap {
  d: number[] = [];
  c: number[] = [];
  top = 0;
  get size(): number {
    return this.c.length;
  }
  private less(i: number, j: number): boolean {
    const a = this.d[i]!;
    const b = this.d[j]!;
    return a < b || (a === b && this.c[i]! < this.c[j]!);
  }
  private swap(i: number, j: number): void {
    const td = this.d[i]!;
    this.d[i] = this.d[j]!;
    this.d[j] = td;
    const tc = this.c[i]!;
    this.c[i] = this.c[j]!;
    this.c[j] = tc;
  }
  push(d: number, c: number): void {
    this.d.push(d);
    this.c.push(c);
    let i = this.c.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const cell = this.c[0]!;
    this.top = this.d[0]!;
    const lastD = this.d.pop()!;
    const lastC = this.c.pop()!;
    if (this.c.length > 0) {
      this.d[0] = lastD;
      this.c[0] = lastC;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.c.length && this.less(l, m)) m = l;
        if (r < this.c.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return cell;
  }
}

function enterCost(g: GridRT, rules: BalanceDef['terrain'], v: number, dx: number, dy: number, len: number): number {
  const code = g.terrain[v]!;
  if (code === T.ICE) return 1 / rules.iceSpeed;
  if (isConveyor(code)) {
    const dot = (dx * CONVEYOR_DX[code]! + dy * CONVEYOR_DY[code]!) / len;
    if (dot > 0.5) return rules.conveyorCost.along;
    if (dot < -0.5) return rules.conveyorCost.against;
    return rules.conveyorCost.across;
  }
  return 1;
}

/**
 * Fills `out` with the cost-to-reach `targets` from every cell. `blocked` is an extra
 * cell treated as unwalkable (placement preview), or -1.
 */
export function computeField(level: LevelRT, g: GridRT, rules: BalanceDef['terrain'], targets: readonly number[], blocked: number, out: Field): Field {
  const { cols, rows } = g;
  const { dist, next, tunnel } = out;
  dist.fill(Infinity);
  next.fill(-1);
  tunnel.fill(0);
  const walk = (c: number): boolean => g.walk[c] === 1 && c !== blocked;
  const heap = new Heap();
  for (const t of targets) {
    if (walk(t) && dist[t] !== 0) {
      dist[t] = 0;
      heap.push(0, t);
    }
  }
  while (heap.size > 0) {
    const v = heap.pop();
    const d = heap.top;
    if (d > dist[v]!) continue;
    const vx = v % cols;
    const vy = (v - vx) / cols;
    for (const [dx, dy] of NEIGHBOURS) {
      const ux = vx - dx;
      const uy = vy - dy;
      if (ux < 0 || uy < 0 || ux >= cols || uy >= rows) continue;
      const u = uy * cols + ux;
      if (!walk(u)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!walk(uy * cols + ux + dx) || !walk((uy + dy) * cols + ux))) continue;
      const len = diagonal ? Math.SQRT2 : 1;
      const nd = d + len * enterCost(g, rules, v, dx, dy, len);
      if (nd < dist[u]!) {
        dist[u] = nd;
        next[u] = v;
        tunnel[u] = 0;
        heap.push(nd, u);
      }
    }
    const p = level.tunnelPartner[v]!;
    if (p >= 0 && walk(p)) {
      const nd = d + level.tunnelLength[v]!;
      if (nd < dist[p]!) {
        dist[p] = nd;
        next[p] = v;
        tunnel[p] = 1;
        heap.push(nd, p);
      }
    }
  }
  return out;
}

export function exitFields(level: LevelRT, g: GridRT, rules: BalanceDef['terrain'], blocked: number, reuse?: Field[]): Field[] {
  return level.exits.map((ex, i) => computeField(level, g, rules, ex.cells, blocked, reuse?.[i] ?? newField(level.n)));
}

export function cellCentre(cols: number, c: number): Vec {
  const cx = c % cols;
  return { x: cx + 0.5, y: (c - cx) / cols + 0.5 };
}

/** Polyline for a ground route: off-map entrance → cell centres → off-map exit. Empty if unreachable. */
export function routePolyline(level: LevelRT, f: Field, route: RouteRT): Vec[] {
  const cells = route.entrance.cells;
  const start = cells[(cells.length - 1) >> 1]!;
  if (!Number.isFinite(f.dist[start]!)) return [];
  const pts: Vec[] = [spanOutside(route.entrance, 0.5)];
  let c = start;
  for (let guard = 0; guard <= level.n; guard++) {
    pts.push(cellCentre(level.cols, c));
    if (f.dist[c] === 0) break;
    c = f.next[c]!;
    if (c < 0) return [];
  }
  pts.push(spanOutside(route.exit, 0.5));
  return pts;
}
