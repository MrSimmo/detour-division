// Turns a validated LevelDef into the static runtime description the simulation
// uses: terrain arrays, route spans, the gate apron, tunnels and per-difficulty numbers.
import { DIFFICULTIES, type BalanceDef, type Difficulty, type Edge, type LevelDef, type Span } from '../data/schemas.ts';
import { EDGE_OUTSIDE, TICK_HZ } from './constants.ts';
import { T, TILE_CHARS, WALKABLE } from './terrain.ts';
import { expandWaves, type WaveRT } from './waves.ts';

export interface SpanRT {
  edge: Edge;
  cells: number[];
  /** Outward normal. */
  nx: number;
  ny: number;
  /** Unit tangent along the span. */
  tx: number;
  ty: number;
  /** Start of the span on the map edge line. */
  ex: number;
  ey: number;
  width: number;
}

export interface RouteRT {
  id: string;
  index: number;
  airOnly: boolean;
  entrance: SpanRT;
  exit: SpanRT;
  /** Index into the distinct exits (and Sim.fields). */
  exitIndex: number;
}

export interface TunnelRT {
  a: number;
  b: number;
  length: number;
}

export interface LevelRT {
  def: LevelDef;
  id: string;
  zone: number;
  mode: LevelDef['mode'];
  cols: number;
  rows: number;
  n: number;
  terrain: Uint8Array;
  apron: Uint8Array;
  routes: RouteRT[];
  exits: SpanRT[];
  tunnels: TunnelRT[];
  /** Partner mouth per cell, or -1. */
  tunnelPartner: Int32Array;
  tunnelLength: Float64Array;
  difficulty: Difficulty;
  diffIndex: number;
  lives: number;
  startCash: number;
  bountyMul: number;
  waves: WaveRT[];
  /** Ticks from launching wave k to launching wave k + 1 (§3.8, R-WAVE-4). */
  gapTicks: number[];
  endless: boolean;
  /** Sudden Death / Time Trial clock in ticks (0 = none) and Time Trial kill target. */
  timerTicks: number;
  target: number;
}

export function cellIndex(cols: number, cx: number, cy: number): number {
  return cy * cols + cx;
}

function spanRT(level: LevelDef, span: Span, where: string): SpanRT {
  const { cols, rows } = level.grid;
  const along = span.edge === 'N' || span.edge === 'S' ? cols : rows;
  if (span.from > span.to || span.to >= along) throw new Error(`${level.id}: ${where} span ${span.edge} ${span.from}-${span.to} is outside the edge`);
  const cells: number[] = [];
  for (let i = span.from; i <= span.to; i++) {
    if (span.edge === 'N') cells.push(cellIndex(cols, i, 0));
    else if (span.edge === 'S') cells.push(cellIndex(cols, i, rows - 1));
    else if (span.edge === 'W') cells.push(cellIndex(cols, 0, i));
    else cells.push(cellIndex(cols, cols - 1, i));
  }
  const horizontal = span.edge === 'N' || span.edge === 'S';
  return {
    edge: span.edge,
    cells,
    nx: span.edge === 'E' ? 1 : span.edge === 'W' ? -1 : 0,
    ny: span.edge === 'S' ? 1 : span.edge === 'N' ? -1 : 0,
    tx: horizontal ? 1 : 0,
    ty: horizontal ? 0 : 1,
    ex: span.edge === 'E' ? cols : horizontal ? span.from : 0,
    ey: span.edge === 'S' ? rows : horizontal ? 0 : span.from,
    width: span.to - span.from + 1,
  };
}

/** A point off the map beyond the span, at fraction f ∈ [0,1] along it. */
export function spanOutside(s: SpanRT, f: number): { x: number; y: number } {
  return { x: s.ex + s.tx * f * s.width + s.nx * EDGE_OUTSIDE, y: s.ey + s.ty * f * s.width + s.ny * EDGE_OUTSIDE };
}

export function prepareLevel(def: LevelDef, balance: BalanceDef, difficulty: Difficulty, endless = false): LevelRT {
  const { cols, rows } = def.grid;
  const n = cols * rows;
  if (def.tiles.length !== rows) throw new Error(`${def.id}: expected ${rows} tile rows, found ${def.tiles.length}`);
  const terrain = new Uint8Array(n);
  def.tiles.forEach((row, y) => {
    if (row.length !== cols) throw new Error(`${def.id}: tile row ${y} has ${row.length} columns, expected ${cols}`);
    for (let x = 0; x < cols; x++) {
      const code = TILE_CHARS[row[x]!];
      if (code === undefined) throw new Error(`${def.id}: unknown tile '${row[x]}' at ${x},${y}`);
      terrain[cellIndex(cols, x, y)] = code;
    }
  });

  const exits: SpanRT[] = [];
  const exitKey: string[] = [];
  const ids = new Set<string>();
  const routes: RouteRT[] = def.routes.map((r, index) => {
    if (ids.has(r.id)) throw new Error(`${def.id}: duplicate route id ${r.id}`);
    ids.add(r.id);
    const entrance = spanRT(def, r.entrance, `route ${r.id} entrance`);
    const exit = spanRT(def, r.exit, `route ${r.id} exit`);
    if (!r.airOnly) {
      for (const c of [...entrance.cells, ...exit.cells]) {
        if (!WALKABLE[terrain[c]!]) throw new Error(`${def.id}: route ${r.id} span cell ${c % cols},${Math.floor(c / cols)} is not walkable`);
      }
    }
    const key = `${r.exit.edge}${r.exit.from}-${r.exit.to}`;
    let exitIndex = exitKey.indexOf(key);
    if (exitIndex < 0) {
      exitIndex = exits.length;
      exits.push(exit);
      exitKey.push(key);
    }
    return { id: r.id, index, airOnly: r.airOnly, entrance, exit, exitIndex };
  });

  // Gate apron: span cells and their 8-neighbours are unbuildable (§3.1).
  const apron = new Uint8Array(n);
  for (const r of routes) {
    if (r.airOnly) continue;
    for (const c of [...r.entrance.cells, ...r.exit.cells]) {
      const cx = c % cols;
      const cy = (c - cx) / cols;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && y >= 0 && x < cols && y < rows) apron[cellIndex(cols, x, y)] = 1;
        }
      }
    }
  }

  const tunnelPartner = new Int32Array(n).fill(-1);
  const tunnelLength = new Float64Array(n);
  const tunnels: TunnelRT[] = def.tunnels.map((tn) => {
    const a = cellIndex(cols, tn.a[0], tn.a[1]);
    const b = cellIndex(cols, tn.b[0], tn.b[1]);
    for (const c of [a, b]) {
      if (terrain[c] !== T.TUNNEL) throw new Error(`${def.id}: tunnel end ${c % cols},${Math.floor(c / cols)} is not an 'o' tile`);
      if (tunnelPartner[c] !== -1) throw new Error(`${def.id}: tunnel mouth ${c % cols},${Math.floor(c / cols)} is used twice`);
    }
    tunnelPartner[a] = b;
    tunnelPartner[b] = a;
    tunnelLength[a] = tn.length;
    tunnelLength[b] = tn.length;
    return { a, b, length: tn.length };
  });
  for (let c = 0; c < n; c++) {
    if (terrain[c] === T.TUNNEL && tunnelPartner[c] === -1) throw new Error(`${def.id}: tunnel mouth ${c % cols},${Math.floor(c / cols)} has no partner`);
  }

  const diffIndex = DIFFICULTIES.indexOf(difficulty);
  const diff = balance.difficulty[difficulty];
  if ((def.mode === 'suddenDeath' || def.mode === 'timeTrial') && !def.modeParams.timer) throw new Error(`${def.id}: ${def.mode} needs modeParams.timer`);
  if (def.mode === 'timeTrial' && !def.modeParams.target) throw new Error(`${def.id}: timeTrial needs modeParams.target`);
  const lives =
    def.mode === 'suddenDeath' ? balance.modes.suddenDeath.lives[diffIndex]! : def.mode === 'puzzle' ? balance.modes.puzzle.lives[diffIndex]! : def.lives;
  const startCash = def.mode === 'puzzle' ? def.startCash : Math.round(def.startCash * diff.cash);
  const waves = expandWaves(def, balance, difficulty, endless);

  return {
    def,
    id: def.id,
    zone: def.zone,
    mode: def.mode,
    cols,
    rows,
    n,
    terrain,
    apron,
    routes,
    exits,
    tunnels,
    tunnelPartner,
    tunnelLength,
    difficulty,
    diffIndex,
    lives,
    startCash,
    bountyMul: def.mode === 'puzzle' ? 0 : 1,
    waves,
    endless,
    timerTicks: def.modeParams.timer ? Math.round(def.modeParams.timer[diffIndex]! * TICK_HZ) : 0,
    target: def.modeParams.target?.[diffIndex] ?? 0,
    gapTicks: waveGaps(def.waves.interval, def.waves.intervalEnd ?? def.waves.interval, def.waves.count[diffIndex]!, waves.length),
  };
}

/** §3.8: the countdown after wave k (1-based) runs from `start` to `end` seconds over the scripted
 * waves; Endless waves beyond the script keep `end`. Index k − 1 holds the gap after wave k. */
export function waveGaps(start: number, end: number, scripted: number, total: number): number[] {
  const gaps: number[] = [];
  for (let k = 1; k <= total; k++) {
    const t = scripted > 2 ? Math.min(1, (k - 1) / (scripted - 2)) : 1;
    gaps.push(Math.round((start + (end - start) * t) * TICK_HZ));
  }
  return gaps;
}
