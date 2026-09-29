// The game scene: observes the simulation (state + drained events) and draws it with
// interpolation between ticks. It never mutates the simulation (ADR-0003).
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { P } from '../art/palette.ts';
import { FACINGS, TILT, pad2 } from '../art/spec.ts';
import type { Sim } from '../sim/context.ts';
import { routePaths } from '../sim/sim.ts';
import { DT } from '../sim/constants.ts';
import { spanOutside, type SpanRT } from '../sim/level.ts';
import { T } from '../sim/terrain.ts';
import type { Enemy, Projectile, SimEvent, Tower, Zone } from '../sim/types.ts';
import type { Art } from './assets.ts';
import { CELL, Fx, setTex } from './fx.ts';
import { EXIT_END, laneEnd } from './lanes.ts';
import { RouteMarker } from './routes.ts';

const AIR_Z = 0.85 * CELL;
/** Art-unit heights (× tower scale) where some towers' effects start, from the tower art notes. */
const EMIT_LIFT: Record<string, number> = { sparkplug: 36 * 1.2, bellower: 6 * 1.2, piechucker: 15 * 1.2, teaurn: 8 };
/** Overlays are drawn for a Footling-sized body and scaled by radius. */
const BODY_R = 0.2;
const TWO_PI = Math.PI * 2;
const STEP16 = TWO_PI / FACINGS;

/** Stable per-cell hash for decoration variety. */
function cellHash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return a + d * t;
}

/** Screen angle of a ground-plane aim direction → the art facing that draws it (ADR-0006). */
function facingFor(screenAngle: number): { index: number; residual: number } {
  // A head baked at facing a points along (cos a, TILT·sin a) on screen.
  const a = Math.atan2(Math.sin(screenAngle) / TILT, Math.cos(screenAngle));
  const i = Math.round(a / STEP16);
  const index = ((i % FACINGS) + FACINGS) % FACINGS;
  const shown = Math.atan2(Math.sin(i * STEP16) * TILT, Math.cos(i * STEP16));
  let residual = screenAngle - shown;
  while (residual > Math.PI) residual -= TWO_PI;
  while (residual < -Math.PI) residual += TWO_PI;
  return { index, residual };
}

interface EnemyView {
  id: number;
  /** The unit as last drawn; a leaker keeps it to walk on after the simulation has removed it. */
  e: Enemy;
  body: Sprite;
  shadow: Sprite;
  hpBg: Sprite;
  hpFill: Sprite;
  flash: Sprite;
  /** Big overlay (frozen block, bubble, ice dome) and small overlay (flames, dizzy stars, custard). */
  big: Sprite;
  small: Sprite;
  noteT: number;
  flashT: number;
  redT: number;
  walk: number;
  lastHp: number;
  infantry: boolean;
  frames: number;
  seen: boolean;
}

/** Lamp pool radii in cells, and their strength over the night overlay. */
const LAMP_TOWER_R = 1.8;
const LAMP_SIGN_R = 2.4;
const LAMP_ALPHA = 0.3;

/** A soft warm disc for the night variant's lamp pools, drawn once and shared by every scene. */
let lampCache: Texture | null = null;
function lampTexture(): Texture {
  if (lampCache) return lampCache;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, P.brass);
  grad.addColorStop(0.45, `${P.brass}99`);
  grad.addColorStop(1, `${P.brass}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  lampCache = Texture.from(c);
  return lampCache;
}

interface TowerView {
  id: number;
  base: Sprite;
  head: Sprite;
  shadow: Sprite;
  tier: number;
  recoil: number;
  drop: number;
  lastAngle: number;
  seen: boolean;
}

/** R-LANE-2: a leaker the simulation has removed, walking on down its exit lane, one step per sim tick. */
interface Leaver {
  v: EnemyView;
  x: number;
  y: number;
  px: number;
  py: number;
  dx: number;
  dy: number;
  /** The sim tick its position is at. */
  tick: number;
}

interface ProjView {
  id: number;
  s: Sprite;
  shadow: Sprite;
  seen: boolean;
  trail: number;
}

export interface GhostSpec {
  type: string;
  cx: number;
  cy: number;
  valid: boolean;
  range: number;
  minRange: number;
}

export class GameScene {
  readonly root = new Container();
  readonly world = new Container();
  private bg: TilingSprite;
  private terrain = new Container();
  private decals = new Container();
  private shadows = new Container();
  private rangeLayer = new Graphics();
  private entities = new Container();
  private projLayer = new Container();
  private fxLayer = new Container();
  /** Additive effects and the hit flashes, apart from normal sprites so batches don't break (§19). */
  private fxAddLayer = new Container();
  private flashLayer = new Container();
  private airLayer = new Container();
  private overlay = new Container();
  private textLayer = new Container();
  private hpLayer = new Container();
  /** R-LANE-2 (ADR-0014): the forest closing over each lane's far end, over the units and everything on them. */
  private laneEnds = new Container();
  /** The border texture covering each lane's far end. */
  private covers: TilingSprite[] = [];
  /** Leakers still walking out of sight (read by the e2e tests). */
  readonly leavers: Leaver[] = [];
  private screenW = 0;
  private screenH = 0;
  readonly fx: Fx;
  readonly routes: RouteMarker;
  private enemies = new Map<number, EnemyView>();
  private towers = new Map<number, TowerView>();
  private projs = new Map<number, ProjView>();
  private zones = new Map<number, Sprite>();
  private glows = new Map<number, Sprite>();
  private decor = new Map<number, Sprite[]>();
  /** Removable blockers by cell (cleared by the player). */
  private blockers = new Map<number, Sprite>();
  /** Conveyor tiles, animated through their frames. */
  private belts: { s: Sprite; key: string }[] = [];
  private night: Graphics | null = null;
  /** Night variant (§11, Night Shift): additive lamp pools at every tower and road sign. */
  private lamps: Container | null = null;
  private lampTex: Texture | null = null;
  private towerLamps = new Map<number, Sprite>();
  private ghost = new Container();
  private ghostBase = new Sprite();
  private ghostHead = new Sprite();
  private ghostHatch: TilingSprite;
  /** The seamless meadow of a zone painted as one (Zone 1, v1.1); its gate lanes continue its pattern. */
  private meadow: TilingSprite | null = null;
  /** R-BLOCK-4: faint hatching on the cells that refuse a tower, while one is being placed. */
  private buildMask = new Graphics();
  /** The cells hatched now (read by the e2e tests). */
  maskCells: readonly number[] = [];
  private pathV = -1;
  private time = 0;
  private selected = 0;
  private hover = 0;
  private infantryCache = new Map<string, boolean>();

  private art: Art;

  private sim: Sim;

  constructor(art: Art, sim: Sim) {
    this.art = art;

    this.sim = sim;
    const zone = `z${sim.level.zone}`;
    this.bg = new TilingSprite({ texture: art.tex(`terrain.${zone}.border`), width: 64, height: 64 });
    this.world.addChild(this.bg, this.terrain, this.decals, this.shadows, this.rangeLayer);
    this.routes = new RouteMarker(art);
    this.world.addChild(this.routes.layer, this.entities, this.projLayer, this.fxLayer, this.fxAddLayer, this.airLayer, this.flashLayer, this.hpLayer, this.laneEnds, this.overlay, this.textLayer);
    this.entities.sortableChildren = true;
    this.airLayer.sortableChildren = true;
    this.root.addChild(this.world);
    this.fx = new Fx(art, this.fxLayer, this.decals, this.textLayer, this.fxAddLayer);
    this.ghostHatch = new TilingSprite({ texture: art.tex('fx.hatch'), width: CELL, height: CELL });
    this.ghostHatch.anchor.set(0.5);
    this.ghost.addChild(this.ghostHatch, this.ghostBase, this.ghostHead);
    this.ghost.visible = false;
    this.overlay.addChild(this.buildMask, this.ghost);
    this.buildTerrain();
    this.routes.setAir(
      sim.level.routes.map((r) => {
        const a = spanOutside(r.entrance, 0.5);
        const b = spanOutside(r.exit, 0.5);
        return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
      }),
    );
  }

  // ------------------------------------------------------------ terrain

  private buildTerrain(): void {
    const lv = this.sim.level;
    const z = `z${lv.zone}`;
    const { cols, rows } = lv;
    const meadow = `terrain.${z}.meadow`;
    if (this.art.has(meadow)) {
      // A zone painted as one seamless meadow (Zone 1, v1.1): a single tiling sprite instead of a tile
      // per cell, reaching one cell into the border so the frame's trees stand on grass. The repeat is
      // shifted per level so levels don't share a pattern.
      const m = new TilingSprite({ texture: this.art.tex(meadow), width: (cols + 2) * CELL, height: (rows + 2) * CELL });
      m.position.set(-CELL, -CELL);
      m.tilePosition.set(-Math.floor(cellHash(lv.def.seed, 1, 21) * 8) * CELL, -Math.floor(cellHash(lv.def.seed, 2, 21) * 8) * CELL);
      this.terrain.addChild(m);
      this.meadow = m;
    } else {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const s = new Sprite(this.art.tex(`terrain.${z}.ground.${Math.floor(cellHash(x, y) * 6)}`));
          s.position.set((x + 0.5) * CELL, (y + 0.5) * CELL);
          this.terrain.addChild(s);
        }
      }
    }
    // Soft colour patches break up the tile grid (painterly variation).
    for (let i = 0; i < Math.round((cols * rows) / 9); i++) {
      const s = new Sprite(this.art.tex(`terrain.${z}.patch.${i % 4}`));
      s.position.set(cellHash(i, 1, 7) * cols * CELL, cellHash(i, 2, 7) * rows * CELL);
      s.alpha = 0.8;
      s.scale.set(0.8 + cellHash(i, 3, 7) * 0.6);
      this.terrain.addChild(s);
    }
    if (this.art.has(`terrain.${z}.tuft.0`)) {
      // Loose tufts and the odd worn patch, off the cell grid, break up the meadow's repeat. Like the
      // flowers they belong to a cell, and hide when a tower is built there.
      const loose = (count: number, salt: number, key: (i: number) => string): void => {
        for (let i = 0; i < count; i++) {
          const x = cellHash(i, salt, 31) * cols;
          const y = cellHash(i, salt, 32) * rows;
          const c = Math.floor(y) * cols + Math.floor(x);
          if (lv.terrain[c] !== T.GROUND) continue;
          const s = new Sprite(this.art.tex(key(i)));
          s.position.set(x * CELL, y * CELL);
          this.terrain.addChild(s);
          this.decor.set(c, [...(this.decor.get(c) ?? []), s]);
        }
      };
      loose(Math.round(cols * rows * 0.015), 2, (i) => `terrain.${z}.worn.${i % 2}`);
      loose(Math.round(cols * rows * 0.45), 3, (i) => `terrain.${z}.tuft.${i % 4}`);
    }
    const edgeKey = `terrain.${z}.edge`;
    const meadowEdge = this.art.has(edgeKey);
    if (!meadowEdge) {
      // Map edge: a soft inner shade where the meadow meets the hedge border.
      const edge = new Graphics();
      edge.rect(0, 0, cols * CELL, rows * CELL).stroke({ width: 10, color: P.ink, alpha: 0.18, alignment: 1 });
      this.terrain.addChild(edge);
    }
    this.areaTerrain();
    // A meadow zone's edges go over its area terrain, so a river runs on under the forest.
    if (meadowEdge) {
      // The border canopy's shade on the meadow, stretched strips along each side, darkest under the trees
      // (the outer ring of meadow) and fading a cell into the field. The light is top-left, so the
      // trees along the top and left throw more shade onto the field than those along the bottom and right.
      // A gate has no trees over it, so the shade stops there, fading out over the cell either side, and
      // the lane runs into the field with no edge (V-10).
      const endKey = `${edgeKey}.end`;
      const band = 1.9 * CELL;
      const mid = band / 2 - CELL;
      const W = cols * CELL;
      const H = rows * CELL;
      type Span = (typeof lv.routes)[number]['entrance'];
      // `dir` is the way the strip's texture runs along the side (+1 with x or y increasing).
      const sides: { n: number; gate: (s: Span) => boolean; at: (d: number) => { x: number; y: number }; rot: number; dir: number; a: number }[] = [
        { n: cols, gate: (s) => s.ny < 0, at: (d) => ({ x: d, y: mid }), rot: 0, dir: 1, a: 1 },
        { n: cols, gate: (s) => s.ny > 0, at: (d) => ({ x: d, y: H - mid }), rot: Math.PI, dir: -1, a: 0.55 },
        { n: rows, gate: (s) => s.nx < 0, at: (d) => ({ x: mid, y: d }), rot: -Math.PI / 2, dir: -1, a: 0.9 },
        { n: rows, gate: (s) => s.nx > 0, at: (d) => ({ x: W - mid, y: d }), rot: Math.PI / 2, dir: 1, a: 0.55 },
      ];
      for (const side of sides) {
        const strip = (key: string, from: number, to: number, flip: number): void => {
          const s = new Sprite(this.art.tex(key));
          s.anchor.set(0.5);
          const p = side.at(((from + to) / 2) * CELL);
          s.position.set(p.x, p.y);
          s.rotation = side.rot;
          s.width = (to - from) * CELL;
          s.height = band;
          s.scale.x *= flip;
          s.alpha = side.a;
          this.terrain.addChild(s);
        };
        // This side's gates as cell ranges along it, in order; two routes may share one.
        const gates = lv.routes
          .flatMap((r) => [r.entrance, r.exit])
          .filter(side.gate)
          .map((s) => s.cells.map((c) => (s.nx !== 0 ? Math.floor(c / cols) : c % cols)))
          .map((v) => [Math.min(...v), Math.max(...v) + 1] as const)
          .sort((p, q) => p[0] - q[0]);
        // Shade from one corner to the other, round the gates; the end piece fades towards a gate.
        let a = -1;
        let fadeA = false;
        for (const [g0, g1] of [...gates, [side.n + 1, side.n + 1] as const]) {
          const fadeB = g0 <= side.n;
          if (g0 > a) {
            const f = Math.min(1, (g0 - a) / (Number(fadeA) + Number(fadeB) || 1));
            if (fadeA) strip(endKey, a, a + f, -side.dir);
            if (g0 - (fadeB ? f : 0) > a + (fadeA ? f : 0)) strip(edgeKey, a + (fadeA ? f : 0), g0 - (fadeB ? f : 0), 1);
            if (fadeB) strip(endKey, g0 - f, g0, side.dir);
          }
          a = Math.max(a, g1);
          fadeA = true;
        }
      }
      // Each gate opens a grassy lane out through the forest (the meadow texture continued), and the
      // forest edge spills over every boundary of grass: the field's and the lanes' sides. Pieces are
      // 2 cells long; one that would cross a gate moves a cell along instead.
      // Past where an exit lane closes (R-LANE-2), and a whole number of 2-cell hedge pieces long: a west or
      // north lane's pieces are laid from its far end, and must end at the mouth, as the field's do.
      const LANE = EXIT_END;
      const gates = new Set<string>();
      const lanes: { x: number; y: number; w: number; h: number; across: boolean }[] = [];
      for (const r of lv.routes) {
        for (const span of [r.entrance, r.exit]) {
          const xs = span.cells.map((c) => c % cols);
          const ys = span.cells.map((c) => Math.floor(c / cols));
          for (let i = 0; i < xs.length; i++) gates.add(`${xs[i]! + span.nx},${ys[i]! + span.ny}`);
          if (span.nx !== 0) lanes.push({ x: span.nx < 0 ? -1 - LANE : cols + 1, y: Math.min(...ys), w: LANE, h: ys.length, across: true });
          else lanes.push({ x: Math.min(...xs), y: span.ny < 0 ? -1 - LANE : rows + 1, w: xs.length, h: LANE, across: false });
        }
      }
      const m = this.meadow!;
      const origin = { x: m.x + m.tilePosition.x, y: m.y + m.tilePosition.y };
      for (const l of lanes) {
        const s = new TilingSprite({ texture: this.art.tex(meadow), width: l.w * CELL, height: l.h * CELL });
        s.position.set(l.x * CELL, l.y * CELL);
        s.tilePosition.set(origin.x - s.x, origin.y - s.y);
        this.terrain.addChild(s);
      }
      const piece = (side: 'n' | 's' | 'w' | 'e', x: number, y: number): void => {
        const s = new Sprite(this.art.tex(`terrain.${z}.fringe.${side}`));
        s.position.set(x * CELL, y * CELL);
        this.terrain.addChild(s);
      };
      const run = (side: 'n' | 's' | 'w' | 'e', from: number, to: number, fixed: number, cellAt: (i: number) => string): void => {
        for (let a = from; a < to; a += 2) {
          const g0 = gates.has(cellAt(a));
          const g1 = gates.has(cellAt(a + 1));
          if (g0 && g1) continue;
          const at = g0 ? a + 1 : g1 ? a - 1 : a;
          if (side === 'n' || side === 's') piece(side, at + 1, fixed);
          else piece(side, fixed, at + 1);
        }
      };
      run('n', -1, cols + 1, -1, (i) => `${i},-1`);
      run('s', -1, cols + 1, rows + 1, (i) => `${i},${rows}`);
      run('w', -1, rows + 1, -1, (i) => `-1,${i}`);
      run('e', -1, rows + 1, cols + 1, (i) => `${cols},${i}`);
      for (const l of lanes) {
        const none = (): string => '';
        if (l.across) {
          run('n', l.x, l.x + l.w, l.y, none);
          run('s', l.x, l.x + l.w, l.y + l.h, none);
        } else {
          run('w', l.y, l.y + l.h, l.x, none);
          run('e', l.y, l.y + l.h, l.x + l.w, none);
        }
        // A run ends in a straight cut through its leaves, and at a gate's mouth the lane's hedge and the
        // field's both end at one corner. A bush on each corner covers the join (V-10); its crown sits
        // 0.19 cells above its foot.
        const edge = l.across ? (l.x < 0 ? -1 : cols + 1) : l.y < 0 ? -1 : rows + 1;
        for (const [cx, cy] of l.across ? [[edge, l.y], [edge, l.y + l.h]] : [[l.x, edge], [l.x + l.w, edge]]) {
          const s = new Sprite(this.art.tex(`terrain.${z}.bush.0`));
          s.position.set(cx! * CELL, (cy! + 0.19) * CELL);
          this.terrain.addChild(s);
        }
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = y * cols + x;
        const code = lv.terrain[c];
        if (code === T.ROCK) this.prop(`terrain.${z}.rock.${Math.floor(cellHash(x, y, 3) * 3)}`, x + 0.5, y + 0.62);
        else if (code === T.BLOCKER) this.blockers.set(c, this.prop(`terrain.${z}.blocker.${Math.floor(cellHash(x, y, 4) * 2)}`, x + 0.5, y + 0.72));
        else if (code === T.TUNNEL) this.prop(`terrain.${z}.tunnel`, x + 0.5, y + 0.7);
        else if (code === T.GROUND && lv.apron[c] === 0 && cellHash(x, y, 5) < 0.12) {
          const f = new Sprite(this.art.tex(`terrain.${z}.flowers.${Math.floor(cellHash(x, y, 6) * 3)}`));
          f.position.set((x + 0.2 + cellHash(x, y, 8) * 0.6) * CELL, (y + 0.3 + cellHash(x, y, 9) * 0.5) * CELL);
          this.terrain.addChild(f);
          this.decor.set(c, [...(this.decor.get(c) ?? []), f]);
        }
      }
    }
    // Trees and bushes framing the map edges, in the border band and just beyond.
    const frame = (x: number, y: number, i: number): void => {
      const r = cellHash(x, y, 11 + i);
      if (r < 0.55) this.prop(`terrain.${z}.tree.${Math.floor(cellHash(x, y, 12) * 3)}`, x + 0.5 + (cellHash(x, y, 13) - 0.5) * 0.5, y + 0.8, 0.9 + cellHash(x, y, 14) * 0.25);
      else if (r < 0.8) this.prop(`terrain.${z}.bush.${Math.floor(cellHash(x, y, 15) * 2)}`, x + 0.5, y + 0.75);
    };
    const gateCells = new Set<string>();
    for (const r of lv.routes) {
      for (const span of [r.entrance, r.exit]) {
        for (const c of span.cells) {
          const cx = c % cols;
          const cy = Math.floor(c / cols);
          for (let k = -1; k <= 1; k++) gateCells.add(`${cx + span.nx + (span.tx ? k : 0)},${cy + span.ny + (span.ty ? k : 0)}`);
          // Ground units walk the gate lane through the outer ring too (R-LANE-1), so no tree stands in it.
          for (let k = -1; k <= 1; k++) gateCells.add(`${cx + 2 * span.nx + (span.tx ? k : 0)},${cy + 2 * span.ny + (span.ty ? k : 0)}`);
        }
      }
    }
    for (let x = -2; x <= cols + 1; x++) {
      for (const y of [-2, -1, rows, rows + 1]) if (!gateCells.has(`${x},${y}`)) frame(x, y, 0);
    }
    for (let y = 0; y < rows; y++) {
      for (const x of [-2, -1, cols, cols + 1]) if (!gateCells.has(`${x},${y}`)) frame(x, y, 1);
    }
    // Signposts at each entrance and exit.
    for (const r of lv.routes) {
      const a = spanOutside(r.entrance, 1.08);
      this.prop(`terrain.${z}.sign.in`, a.x - r.entrance.nx * 0.25, a.y - r.entrance.ny * 0.25 + 0.3);
      const b = spanOutside(r.exit, 1.08);
      this.prop(`terrain.${z}.sign.out`, b.x - r.exit.nx * 0.25, b.y - r.exit.ny * 0.25 + 0.3);
    }
    this.buildLaneEnds();
  }

  /**
   * R-LANE-2 (ADR-0014): the forest closes over each ground gate's lane, drawn over the units, so a unit is
   * hidden where it appears, and a leaker walks in under the trees on a window wide enough to show them. The
   * cover repeats the border texture in step with the background, so its outline doesn't show. In a meadow
   * zone its open face gets the forest edge's fringe, and a bush on each corner hides the join with the
   * lane's own hedges.
   */
  private buildLaneEnds(): void {
    const lv = this.sim.level;
    const z = `z${lv.zone}`;
    const { cols, rows } = lv;
    // Each gate once, closing where the nearer of its roles needs (an entrance closes inside the spawn point).
    const gates = new Map<string, { span: SpanRT; end: number }>();
    for (const r of lv.routes) {
      if (r.airOnly) continue;
      for (const [span, role] of [[r.entrance, 'in'], [r.exit, 'out']] as const) {
        const key = `${span.edge}${span.cells[0]}`;
        const end = laneEnd(span.edge, role);
        if (end < (gates.get(key)?.end ?? Infinity)) gates.set(key, { span, end });
      }
    }
    // The cover reaches this far either side of the lane: the tallest sprite (1.85 cells) walking its outer
    // cell (0.28 in from the side) stays under it. And far enough along to pass any window.
    const SIDE = 2;
    const LONG = 40;
    const fringe = this.art.has(`terrain.${z}.fringe.w`);
    const piece = (key: string, x: number, y: number): void => {
      const s = new Sprite(this.art.tex(key));
      s.position.set(x * CELL, y * CELL);
      this.laneEnds.addChild(s);
    };
    for (const { span, end } of gates.values()) {
      const xs = span.cells.map((c) => c % cols);
      const ys = span.cells.map((c) => Math.floor(c / cols));
      const a0 = span.nx !== 0 ? Math.min(...ys) : Math.min(...xs);
      const a1 = (span.nx !== 0 ? Math.max(...ys) : Math.max(...xs)) + 1;
      // `face` is the line the lane closes on; the forest lies on the outward side of it.
      const face = span.nx < 0 ? -end : span.nx > 0 ? cols + end : span.ny < 0 ? -end : rows + end;
      const from = span.nx + span.ny < 0 ? face - LONG : face;
      const r = span.nx !== 0 ? { x: from, y: a0 - SIDE, w: LONG, h: a1 - a0 + 2 * SIDE } : { x: a0 - SIDE, y: from, w: a1 - a0 + 2 * SIDE, h: LONG };
      const cover = new TilingSprite({ texture: this.art.tex(`terrain.${z}.border`), width: r.w * CELL, height: r.h * CELL });
      cover.position.set(r.x * CELL, r.y * CELL);
      cover.tilePosition.set(-cover.x, -cover.y);
      this.laneEnds.addChild(cover);
      this.covers.push(cover);
      if (!fringe) continue;
      const side = span.nx < 0 ? 'w' : span.nx > 0 ? 'e' : span.ny < 0 ? 'n' : 's';
      // Fringe pieces are 2 cells long, centred on their position, as along the field's edges.
      for (let a = a0; a < a1; a += 2) {
        if (span.nx !== 0) piece(`terrain.${z}.fringe.${side}`, face, a + 1);
        else piece(`terrain.${z}.fringe.${side}`, a + 1, face);
      }
      // A bush's crown sits 0.19 cells above its foot (as at the lanes' mouths).
      for (const a of [a0, a1]) {
        if (span.nx !== 0) piece(`terrain.${z}.bush.0`, face, a + 0.19);
        else piece(`terrain.${z}.bush.0`, a, face + 0.19);
      }
    }
  }

  private prop(key: string, x: number, y: number, scale = 1): Sprite {
    const s = new Sprite(this.art.tex(key));
    s.position.set(x * CELL, y * CELL);
    s.scale.set(scale);
    s.zIndex = y * CELL;
    this.entities.addChild(s);
    return s;
  }

  /**
   * Area terrain drawn with dual-grid autotiles (liquids, ice, trenches): each tile sits on a
   * grid vertex, indexed by which of its four cells (TL=1, TR=2, BL=4, BR=8) hold the terrain.
   * Cells beyond the edge copy the nearest edge cell so rivers run off the map.
   */
  private areaTerrain(): void {
    const lv = this.sim.level;
    const z = `z${lv.zone}`;
    const { cols, rows } = lv;
    const at = (x: number, y: number): number => lv.terrain[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))]!;
    const layers: { key: string; has: (code: number) => boolean }[] = [
      { key: 'trench', has: (c) => c === T.TRENCH },
      { key: 'ice', has: (c) => c === T.ICE },
      { key: 'water', has: (c) => c === T.WATER || c === T.BRIDGE },
    ];
    // A meadow zone's grass reaches a cell into the border, and its rivers run on under the trees.
    const ext = this.meadow ? 1 : 0;
    for (const layer of layers) {
      for (let vy = -ext; vy <= rows + ext; vy++) {
        for (let vx = -ext; vx <= cols + ext; vx++) {
          const i = (layer.has(at(vx - 1, vy - 1)) ? 1 : 0) + (layer.has(at(vx, vy - 1)) ? 2 : 0) + (layer.has(at(vx - 1, vy)) ? 4 : 0) + (layer.has(at(vx, vy)) ? 8 : 0);
          if (i === 0) continue;
          const key = `terrain.${z}.${layer.key}.${pad2(i)}`;
          if (!this.art.has(key)) continue;
          const s = new Sprite(this.art.tex(key));
          s.position.set(vx * CELL, vy * CELL);
          this.terrain.addChild(s);
        }
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const code = lv.terrain[y * cols + x]!;
        const put = (key: string): Sprite | null => {
          if (!this.art.has(key)) return null;
          const s = new Sprite(this.art.tex(key));
          s.position.set((x + 0.5) * CELL, (y + 0.5) * CELL);
          this.terrain.addChild(s);
          return s;
        };
        if (code === T.BRIDGE) {
          const across = at(x - 1, y) !== T.WATER && at(x + 1, y) !== T.WATER;
          put(`terrain.${z}.bridge.${across ? 'h' : 'v'}`);
        } else if (code === T.RESTRICTED) put(`terrain.${z}.restricted`);
        else if (code >= T.CONV_E && code <= T.CONV_S) {
          const dir = ['e', 'w', 'n', 's'][code - T.CONV_E]!;
          const key = `terrain.${z}.conveyor.${dir}`;
          const s = put(`${key}.0`);
          if (s) this.belts.push({ s, key });
        }
      }
    }
    if (lv.def.night) {
      this.night = new Graphics();
      // Far past the map on every side, so the darkness reaches the screen edges whatever the aspect ratio.
      this.night.rect(-cols * CELL * 2, -rows * CELL * 2, cols * CELL * 5, rows * CELL * 5).fill({ color: P.infoDark, alpha: 0.42 });
      this.textLayer.addChildAt(this.night, 0);
      this.lampTex = lampTexture();
      this.lamps = new Container();
      this.textLayer.addChildAt(this.lamps, 1);
      for (const r of lv.routes) for (const sp of [r.entrance, r.exit]) this.addLamp(spanOutside(sp, 0.6), LAMP_SIGN_R);
    }
  }

  private addLamp(at: { x: number; y: number }, radius: number): Sprite {
    const s = new Sprite(this.lampTex!);
    s.anchor.set(0.5);
    s.position.set(at.x * CELL, at.y * CELL);
    s.width = s.height = radius * 2 * CELL;
    s.blendMode = 'add';
    s.alpha = LAMP_ALPHA;
    this.lamps!.addChild(s);
    return s;
  }

  /** Fits the world to a playfield rectangle (CSS px) whose border is one cell wide. */
  layout(pf: { x: number; y: number; w: number; h: number }, cell: number, screenW: number, screenH: number, zoom = 1, pan = { x: 0, y: 0 }): void {
    const k = (cell / CELL) * zoom;
    this.screenW = screenW;
    this.screenH = screenH;
    this.world.scale.set(k);
    this.world.position.set(pf.x + cell * zoom + pan.x, pf.y + cell * zoom + pan.y);
    // Background tiling covers the whole screen in world space.
    const wx = -this.world.position.x / k;
    const wy = -this.world.position.y / k;
    this.bg.position.set(wx - CELL, wy - CELL);
    this.bg.width = screenW / k + CELL * 2;
    this.bg.height = screenH / k + CELL * 2;
    this.bg.tilePosition.set(-(wx - CELL), -(wy - CELL));
  }

  // ------------------------------------------------------------ views

  private isInfantry(type: string): boolean {
    let v = this.infantryCache.get(type);
    if (v === undefined) {
      v = this.art.has(`enemy.${type}.n.0.0`);
      this.infantryCache.set(type, v);
    }
    return v;
  }

  private enemyKey(e: Enemy, v: EnemyView, angle: number): string {
    const variant = e.elite ? 'e' : 'n';
    // Variant suffixes: a Brolly whose umbrella is broken, a Kerblam Mech that shed its plating.
    const suffix = e.type === 'brolly' && e.shield <= 0 ? '.b' : e.type === 'kerblam' && e.bossPhase >= 2 ? '.bare' : '';
    let key: string;
    if (v.infantry) {
      const d = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
      key = `enemy.${e.type}.${variant}.${d}.${Math.floor(v.walk) % 4}`;
    } else {
      const d = ((Math.round(angle / STEP16) % 16) + 16) % 16;
      key = `enemy.${e.type}.${variant}.${pad2(d)}.${Math.floor(v.walk) % v.frames}`;
    }
    return suffix && this.art.has(key + suffix) ? key + suffix : key;
  }

  private newEnemyView(e: Enemy): EnemyView {
    const infantry = this.isInfantry(e.type);
    const frames = infantry ? 4 : this.art.has(`enemy.${e.type}.n.00.3`) ? 4 : this.art.has(`enemy.${e.type}.n.00.2`) ? 3 : 2;
    const v: EnemyView = {
      id: e.id,
      e,
      body: new Sprite(),
      shadow: new Sprite(this.art.tex('fx.shadow')),
      hpBg: new Sprite(Texture.WHITE),
      hpFill: new Sprite(Texture.WHITE),
      flash: new Sprite(),
      big: new Sprite(),
      small: new Sprite(),
      noteT: Math.random(),
      flashT: 0,
      redT: 0,
      walk: Math.random() * 4,
      lastHp: e.hp,
      infantry,
      frames,
      seen: true,
    };
    v.shadow.scale.set((e.radius * 2.6 * CELL) / 77, (e.radius * 2.6 * CELL) / 77);
    v.shadow.alpha = e.air ? 0.35 : 0.8;
    v.hpBg.tint = P.ink;
    v.hpBg.alpha = 0.75;
    v.hpFill.tint = P.textOnDark;
    v.flash.blendMode = 'add';
    v.flash.visible = false;
    v.big.visible = v.small.visible = false;
    this.shadows.addChild(v.shadow);
    (e.air ? this.airLayer : this.entities).addChild(v.body, v.big, v.small);
    this.flashLayer.addChild(v.flash);
    this.hpLayer.addChild(v.hpBg, v.hpFill);
    return v;
  }

  /** R-LANE-2: the simulation has let this unit escape; it walks on, straight down its exit lane, at its last pace. */
  private leave(v: EnemyView): void {
    const e = v.e;
    const out = this.sim.level.routes[e.route]!.exit;
    // A unit that stood still on its last tick walks at its own speed.
    const step = Math.hypot(e.x - e.px, e.y - e.py) || e.speed * DT;
    v.hpBg.visible = v.hpFill.visible = v.flash.visible = v.big.visible = v.small.visible = false;
    this.leavers.push({ v, x: e.x, y: e.y, px: e.x - out.nx * step, py: e.y - out.ny * step, dx: out.nx * step, dy: out.ny * step, tick: this.sim.state.tick });
  }

  private walkLeavers(alpha: number, dt: number): void {
    const tick = this.sim.state.tick;
    for (let i = this.leavers.length - 1; i >= 0; i--) {
      const l = this.leavers[i]!;
      for (; l.tick < tick; l.tick++) {
        l.px = l.x;
        l.py = l.y;
        l.x += l.dx;
        l.y += l.dy;
      }
      const v = l.v;
      const x = (l.px + (l.x - l.px) * alpha) * CELL;
      const y = (l.py + (l.y - l.py) * alpha) * CELL;
      const moved = Math.hypot(l.dx, l.dy);
      v.walk += v.infantry ? moved * 9 : dt * 10 + moved * 4;
      setTex(v.body, this.art.tex(this.enemyKey(v.e, v, Math.atan2(v.e.hy, v.e.hx))));
      v.body.position.set(x, y);
      v.body.zIndex = y;
      v.shadow.position.set(x + 3, y + 2);
      if (this.outOfSight(v)) {
        this.dropEnemyView(v);
        this.leavers.splice(i, 1);
      }
    }
  }

  /** Whether all of a unit, shadow included, is off the screen or under a lane's end (R-LANE-2). */
  private outOfSight(v: EnemyView): boolean {
    const a = v.body.getBounds();
    const s = v.shadow.getBounds();
    const minX = Math.min(a.minX, s.minX);
    const minY = Math.min(a.minY, s.minY);
    const maxX = Math.max(a.maxX, s.maxX);
    const maxY = Math.max(a.maxY, s.maxY);
    if (maxX <= 0 || minX >= this.screenW || maxY <= 0 || minY >= this.screenH) return true;
    return this.covers.some((c) => {
      const r = c.getBounds();
      return minX >= r.minX && maxX <= r.maxX && minY >= r.minY && maxY <= r.maxY;
    });
  }

  private dropEnemyView(v: EnemyView): void {
    v.body.destroy();
    v.shadow.destroy();
    v.hpBg.destroy();
    v.hpFill.destroy();
    v.flash.destroy();
    v.big.destroy();
    v.small.destroy();
  }

  private towerView(t: Tower): TowerView {
    const v: TowerView = {
      id: t.id,
      base: new Sprite(),
      head: new Sprite(),
      shadow: new Sprite(this.art.tex('fx.shadow')),
      tier: -1,
      recoil: 0,
      drop: 1,
      lastAngle: Math.atan2(t.ay, t.ax),
      seen: true,
    };
    v.shadow.scale.set(1.25, 1.1);
    v.shadow.alpha = 0.55;
    v.shadow.position.set((t.x + 0.12) * CELL, (t.y + 0.22) * CELL);
    this.shadows.addChild(v.shadow);
    this.entities.addChild(v.base, v.head);
    return v;
  }

  // ------------------------------------------------------------ per frame

  setSelected(id: number): void {
    this.selected = id;
  }

  setHover(id: number): void {
    this.hover = id;
  }

  setGhost(g: GhostSpec | null): void {
    if (!g) {
      this.ghost.visible = false;
      return;
    }
    const meta = this.art.manifest.towers[g.type];
    this.ghost.visible = true;
    this.ghost.position.set((g.cx + 0.5) * CELL, (g.cy + 0.5) * CELL);
    setTex(this.ghostBase, this.art.tex(`tower.${g.type}.t1.base`));
    const f = meta?.rotates === false ? { index: 0 } : facingFor(Math.PI / 4);
    setTex(this.ghostHead, this.art.tex(`tower.${g.type}.t1.head.${pad2(f.index)}`));
    this.ghostHead.position.set(0, -(meta?.headLift ?? 0));
    this.ghostBase.alpha = this.ghostHead.alpha = g.valid ? 0.8 : 0.65;
    this.ghostBase.tint = this.ghostHead.tint = g.valid ? 0xffffff : this.colourBlind ? P.cbBad : P.stopLight;
    this.ghostHatch.visible = !g.valid;
    this.ghostHatch.tint = P.stop;
    this.ghostHatch.alpha = 0.55;
    this.ghostRange = g;
  }

  private ghostRange: GhostSpec | null = null;

  /** Hatches `cells` (the NOT_BUILDABLE ones, §3.1) in the invalid colour, or clears the hatching. */
  setBuildMask(cells: readonly number[] | null): void {
    const g = this.buildMask;
    this.maskCells = cells ?? [];
    g.clear();
    if (!cells?.length) return;
    const cols = this.sim.level.cols;
    const colour = this.colourBlind ? P.cbBad : P.stop;
    const step = CELL / 4;
    for (const c of cells) {
      const x = (c % cols) * CELL;
      const y = Math.floor(c / cols) * CELL;
      g.rect(x, y, CELL, CELL).fill({ color: colour, alpha: 0.1 });
    }
    // One stroke for every cell's diagonal lines, clipped to each cell: a single batched draw.
    for (const c of cells) {
      const x = (c % cols) * CELL;
      const y = Math.floor(c / cols) * CELL;
      for (let d = step; d < CELL * 2; d += step) g.moveTo(x + Math.max(0, d - CELL), y + Math.min(d, CELL)).lineTo(x + Math.min(d, CELL), y + Math.max(0, d - CELL));
    }
    g.stroke({ width: 3, color: colour, alpha: 0.3 });
  }

  flashEnemies(ids: number[]): void {
    for (const id of ids) {
      const v = this.enemies.get(id);
      if (v) v.redT = 0.6;
    }
  }

  /** Colour-blind mode (§21): valid and invalid use the Okabe–Ito blue and orange. */
  colourBlind = false;

  private drawRanges(): void {
    const g = this.rangeLayer;
    g.clear();
    const ring = (x: number, y: number, r: number, min: number, ok: boolean, strong: boolean): void => {
      const colour = ok ? (this.colourBlind ? P.cbOk : P.info) : this.colourBlind ? P.cbBad : P.stop;
      g.circle(x * CELL, y * CELL, r * CELL).fill({ color: colour, alpha: strong ? 0.14 : 0.08 }).stroke({ width: 3, color: colour, alpha: strong ? 0.8 : 0.5 });
      if (min > 0) g.circle(x * CELL, y * CELL, min * CELL).fill({ color: P.ink, alpha: 0.12 }).stroke({ width: 2, color: colour, alpha: 0.6 });
    };
    if (this.ghost.visible && this.ghostRange) {
      const gr = this.ghostRange;
      ring(gr.cx + 0.5, gr.cy + 0.5, gr.range, gr.minRange, gr.valid, true);
    }
    for (const id of [this.selected, this.hover]) {
      if (!id) continue;
      const t = this.sim.state.towers.find((x) => x.id === id);
      if (!t) continue;
      const tier = this.sim.balance.towers[t.type]!.tiers[t.tier]!;
      ring(t.x, t.y, tier.range, tier.minRange, true, id === this.selected);
    }
  }

  onEvents(events: SimEvent[]): void {
    const meta = this.art.manifest.towers;
    for (const ev of events) {
      switch (ev.e) {
        case 'fire': {
          const v = this.towers.get(ev.tower);
          const m = meta[ev.ttype];
          if (v && m) {
            v.recoil = 1;
            const sa = v.lastAngle;
            const hx = v.base.x;
            const hy = v.base.y - m.headLift;
            const mx = hx + Math.cos(sa) * m.muzzle;
            const my = hy + Math.sin(sa) * m.muzzle * 0.85;
            if (ev.ttype === 'bubbler') {
              this.fx.smoke(mx, my, 1, 0.4);
            } else if (ev.ttype === 'piechucker') {
              // The spring arm slaps forward; the pie itself is a projectile.
              v.recoil = 1.6;
            } else if (ev.ttype === 'rattler') {
              this.fx.muzzle(mx, my, sa, ev.tier === 2);
              this.fx.tracer(mx, my, ev.tx * CELL, ev.ty * CELL - 12);
              if (Math.random() < 0.5) this.fx.spark(ev.tx * CELL + (Math.random() - 0.5) * 10, ev.ty * CELL - 10);
            } else if (ev.ttype === 'treacle') {
              this.fx.splat(ev.tx * CELL, ev.ty * CELL);
            } else if (ev.ttype === 'thumper') {
              this.fx.muzzle(hx, hy - 14, -Math.PI / 2, true);
              this.fx.smoke(hx, hy - 20, 2, 0.8);
              this.fx.kick(1.5);
            } else {
              this.fx.smoke(mx, my, 1, 0.6);
            }
          }
          break;
        }
        case 'boom':
          if (ev.ttype === 'piechucker') {
            this.fx.decal('fx.custard.splat', ev.x * CELL, ev.y * CELL, 0.9, 5);
            this.fx.poof(ev.x * CELL, ev.y * CELL, null);
          } else if (ev.ttype === 'bubbler') {
            // Pops are drawn from the 'pop' event.
          } else this.fx.blast(ev.x * CELL, ev.y * CELL, ev.radius);
          break;
        case 'zap': {
          const t = this.sim.state.towers.find((x) => x.id === ev.tower);
          const pts = ev.pts.map((n) => n * CELL);
          if (t) {
            pts[0] = t.x * CELL;
            pts[1] = t.y * CELL - (meta['sparkplug']?.headLift ?? 0) - (EMIT_LIFT['sparkplug'] ?? 0) + 10;
          }
          this.fx.bolt(pts);
          break;
        }
        case 'beam': {
          const lift = meta['sunbeam']?.headLift ?? 0;
          this.fx.beam(ev.x0 * CELL + (ev.x1 - ev.x0) * 7, ev.y0 * CELL - lift, ev.x1 * CELL, ev.y1 * CELL - lift * 0.4, ev.w);
          break;
        }
        case 'pulse':
          this.fx.frost(ev.x * CELL, ev.y * CELL, ev.r);
          break;
        case 'bellow': {
          const sa = Math.atan2(ev.ay * TILT, ev.ax);
          this.fx.soundwave(ev.x * CELL + Math.cos(sa) * 21, ev.y * CELL + Math.sin(sa) * 21 - (EMIT_LIFT['bellower'] ?? 0), sa, ev.cone, ev.r);
          this.fx.kick(1);
          break;
        }
        case 'reverse': {
          const id = ev.id;
          this.fx.speech('About turn!', () => {
            const view = this.enemies.get(id);
            return view ? { x: view.body.x, y: view.body.y } : null;
          });
          break;
        }
        case 'pop':
          this.fx.poof(ev.x * CELL, ev.y * CELL - 12, null);
          break;
        case 'freeze':
          this.fx.sparkle('fx.ice.0', ev.x * CELL, ev.y * CELL - 14, 3, 14);
          break;
        case 'shieldBreak':
          this.fx.sparkle('fx.shieldhit', ev.x * CELL, ev.y * CELL - 20, 1, 4);
          break;
        case 'heal':
          this.fx.sparkle('fx.heal', ev.x * CELL, ev.y * CELL - 16, 5, ev.r * CELL * 0.6);
          break;
        case 'split':
          this.fx.poof(ev.x * CELL, ev.y * CELL, null);
          break;
        case 'phase':
          this.fx.kick(6);
          this.fx.smoke(this.enemies.get(ev.id)?.body.x ?? 0, (this.enemies.get(ev.id)?.body.y ?? 0) - 40, 4, 1.4);
          break;
        case 'drop':
        case 'tunnel':
          this.fx.dust(ev.x * CELL, ev.y * CELL + 10);
          break;
        case 'kill': {
          const helmet = `enemy.${ev.type}.helmet`;
          const v = this.enemies.get(ev.id);
          const lift = v && this.sim.balance.enemies[ev.type]?.air ? AIR_Z : 0;
          this.fx.poof(ev.x * CELL, ev.y * CELL - lift, lift ? null : helmet);
          this.fx.coins(ev.x * CELL, ev.y * CELL - lift - 20, ev.bounty);
          break;
        }
        case 'clear': {
          const c = ev.cy * this.sim.level.cols + ev.cx;
          const s = this.blockers.get(c);
          if (s) {
            s.destroy();
            this.blockers.delete(c);
          }
          this.fx.dust((ev.cx + 0.5) * CELL, (ev.cy + 0.7) * CELL);
          this.fx.poof((ev.cx + 0.5) * CELL, (ev.cy + 0.6) * CELL, null);
          break;
        }
        case 'build': {
          this.fx.dust((ev.cx + 0.5) * CELL, (ev.cy + 0.7) * CELL);
          for (const s of this.decor.get(ev.cy * this.sim.level.cols + ev.cx) ?? []) s.visible = false;
          break;
        }
        case 'sell':
          this.fx.poof((ev.cx + 0.5) * CELL, (ev.cy + 0.6) * CELL, null);
          this.fx.sold((ev.cx + 0.5) * CELL, (ev.cy + 0.55) * CELL);
          this.fx.coins((ev.cx + 0.5) * CELL, (ev.cy + 0.2) * CELL, ev.refund);
          for (const s of this.decor.get(ev.cy * this.sim.level.cols + ev.cx) ?? []) s.visible = true;
          break;
        case 'leak': {
          // R-LANE-2: a ground leaker walks on down its exit lane until it is out of sight.
          const v = this.enemies.get(ev.id);
          if (v && !v.e.air) {
            this.enemies.delete(ev.id);
            this.leave(v);
          }
          // Off it goes, towards whichever edge is nearer, with a biscuit.
          const lv = this.sim.level;
          const dx = ev.x - lv.cols / 2;
          const dy = ev.y - lv.rows / 2;
          const d = Math.max(1e-3, Math.hypot(dx, dy));
          this.fx.biscuit(ev.x * CELL, ev.y * CELL, dx / d, dy / d);
          break;
        }
        case 'upgrade': {
          const x = (ev.cx + 0.5) * CELL;
          const y = (ev.cy + 0.3) * CELL;
          for (let i = 0; i < 6; i++) this.fx.spark(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 30);
          break;
        }
        default:
          break;
      }
    }
  }

  update(alpha: number, dt: number): void {
    this.time += dt;
    const st = this.sim.state;
    if (st.pathV !== this.pathV) {
      this.pathV = st.pathV;
      this.routes.setCurrent(routePaths(this.sim).filter((p) => p.length));
    }
    // Enemies
    for (const v of this.enemies.values()) v.seen = false;
    for (const e of st.enemies) {
      let v = this.enemies.get(e.id);
      if (!v) {
        v = this.newEnemyView(e);
        this.enemies.set(e.id, v);
      }
      v.seen = true;
      v.e = e;
      const x = (e.px + (e.x - e.px) * alpha) * CELL;
      const y = (e.py + (e.y - e.py) * alpha) * CELL;
      const hidden = e.phase === 3;
      v.body.visible = v.shadow.visible = !hidden;
      const angle = Math.atan2(e.hy, e.hx);
      const moved = Math.hypot(e.x - e.px, e.y - e.py);
      v.walk += v.infantry ? moved * 9 : dt * 10 + moved * 4;
      setTex(v.body, this.art.tex(this.enemyKey(e, v, angle)));
      const lift = e.air ? AIR_Z + Math.sin(this.time * 3 + e.id) * 3 : 0;
      v.body.position.set(x, y - lift);
      v.body.zIndex = y;
      v.shadow.position.set(x + (e.air ? 22 : 3), y + (e.air ? 26 : 2));
      // Hit flash when HP drops; red pulses when a placement is refused because of this unit.
      if (e.hp < v.lastHp - 0.01) v.flashT = 0.07;
      v.lastHp = e.hp;
      v.flashT = Math.max(0, v.flashT - dt);
      v.redT = Math.max(0, v.redT - dt);
      v.flash.visible = !hidden && (v.flashT > 0 || (v.redT > 0 && Math.floor(v.redT / 0.1) % 2 === 0));
      if (v.flash.visible) {
        setTex(v.flash, v.body.texture);
        v.flash.position.copyFrom(v.body.position);
        v.flash.zIndex = v.body.zIndex + 0.01;
        v.flash.tint = v.redT > 0 ? P.stop : 0xffffff;
        v.flash.alpha = v.redT > 0 ? 0.9 : 0.7;
      }
      this.overlays(e, v, x, y - lift, hidden, dt);
      const damaged = e.hp < e.maxHp && !hidden;
      v.hpBg.visible = v.hpFill.visible = damaged;
      if (damaged) {
        const w = 34;
        const top = y - lift - (e.air ? 44 : 50);
        v.hpBg.position.set(x - w / 2 - 2, top - 2);
        v.hpBg.width = w + 4;
        v.hpBg.height = 8;
        v.hpFill.position.set(x - w / 2, top);
        v.hpFill.width = Math.max(1, w * (e.hp / e.maxHp));
        v.hpFill.height = 4;
      }
    }
    for (const [id, v] of this.enemies) {
      if (!v.seen) {
        this.dropEnemyView(v);
        this.enemies.delete(id);
      }
    }
    this.walkLeavers(alpha, dt);
    // Towers
    const meta = this.art.manifest.towers;
    for (const v of this.towers.values()) v.seen = false;
    for (const t of st.towers) {
      let v = this.towers.get(t.id);
      if (!v) {
        v = this.towerView(t);
        this.towers.set(t.id, v);
      }
      v.seen = true;
      const m = meta[t.type] ?? { headLift: 0, muzzle: 0, rotates: true };
      if (v.tier !== t.tier) {
        v.tier = t.tier;
        setTex(v.base, this.art.tex(`tower.${t.type}.t${t.tier + 1}.base`));
      }
      v.drop = Math.max(0, v.drop - dt * 6);
      const squash = v.drop > 0 ? 1 + Math.sin(v.drop * Math.PI) * 0.15 : 1;
      const x = t.x * CELL;
      const y = t.y * CELL;
      v.base.position.set(x, y - v.drop * v.drop * 40);
      v.base.scale.set(squash, 2 - squash);
      v.base.zIndex = y;
      const aim = lerpAngle(Math.atan2(t.pay, t.pax), Math.atan2(t.ay, t.ax), alpha);
      const sa = Math.atan2(Math.sin(aim) * TILT, Math.cos(aim));
      v.lastAngle = sa;
      const f = m.rotates === false ? { index: 0, residual: 0 } : facingFor(sa);
      setTex(v.head, this.art.tex(`tower.${t.type}.t${t.tier + 1}.head.${pad2(f.index)}`));
      v.recoil = Math.max(0, v.recoil - dt * 12);
      v.head.rotation = f.residual;
      this.towerCues(t, v, m.headLift, sa, dt);
      v.head.position.set(x - Math.cos(sa) * v.recoil * 3, y - m.headLift - Math.sin(sa) * v.recoil * 2 - v.drop * v.drop * 40);
      v.head.zIndex = y + 0.5;
      if (this.lamps && !this.towerLamps.has(t.id)) this.towerLamps.set(t.id, this.addLamp({ x: t.x, y: t.y }, LAMP_TOWER_R));
    }
    for (const [id, v] of this.towers) {
      if (!v.seen) {
        v.base.destroy();
        v.head.destroy();
        v.shadow.destroy();
        this.towerLamps.get(id)?.destroy();
        this.towerLamps.delete(id);
        this.glows.get(id)?.destroy();
        this.glows.delete(id);
        this.towers.delete(id);
      }
    }
    this.drawZones(st.zones);
    // Projectiles
    for (const v of this.projs.values()) v.seen = false;
    for (const p of st.projectiles) this.drawProjectile(p, alpha, dt);
    for (const [id, v] of this.projs) {
      if (!v.seen) {
        v.s.destroy();
        v.shadow.destroy();
        this.projs.delete(id);
      }
    }
    this.drawRanges();
    if (this.belts.length) {
      const f = Math.floor(this.time * 8) % 4;
      for (const b of this.belts) setTex(b.s, this.art.tex(`${b.key}.${f}`));
    }
    this.routes.update(dt);
    this.fx.update(dt);
    if (this.fx.shake > 0) {
      this.root.position.set((Math.random() - 0.5) * this.fx.shake, (Math.random() - 0.5) * this.fx.shake);
    } else this.root.position.set(0, 0);
  }

  /** Status overlays drawn over a unit (frozen, bubble, ice dome; flames, dizzy, custard). */
  private overlays(e: Enemy, v: EnemyView, x: number, y: number, hidden: boolean, dt: number): void {
    const k = e.radius / BODY_R;
    let big: string | null = null;
    if (e.bubbleT > 0) big = 'fx.bubble';
    else if (e.frozen) big = 'fx.frozen';
    else if (e.type === 'grinder' && e.shield > 0) big = 'fx.iceshield';
    v.big.visible = !hidden && big !== null;
    if (big) {
      setTex(v.big, this.art.tex(big));
      const bob = big === 'fx.bubble' ? Math.sin(this.time * 5 + e.id) * 3 : 0;
      v.big.position.set(x, big === 'fx.bubble' ? y - 14 * k + bob : y + 2);
      v.big.scale.set(big === 'fx.iceshield' ? 1 : Math.max(0.8, k));
      v.big.alpha = big === 'fx.frozen' ? 0.85 : 0.9;
      v.big.zIndex = v.body.zIndex + 0.02;
    }
    let small: string | null = null;
    if (e.burns.length > 0) small = `fx.fire.${Math.floor(this.time * 12 + e.id) % 4}`;
    else if (e.stunT > 0 && !e.frozen) small = 'fx.dizzy';
    else if (e.shred > 0) small = 'fx.custard.drip';
    v.small.visible = !hidden && small !== null && big !== 'fx.bubble';
    if (small) {
      setTex(v.small, this.art.tex(small));
      v.small.position.set(x, small === 'fx.dizzy' ? y - 34 * k : small === 'fx.custard.drip' ? y - 24 * k : y);
      v.small.rotation = small === 'fx.dizzy' ? this.time * 4 : 0;
      v.small.scale.set(Math.max(0.7, k * 0.9));
      v.small.zIndex = v.body.zIndex + 0.03;
    }
    // Tub-Thumpers leave a trail of little notes.
    if (!hidden && e.type === 'tubthumper') {
      v.noteT -= dt;
      if (v.noteT <= 0) {
        v.noteT = 0.45;
        this.fx.sparkle(`fx.note.${Math.floor(Math.random() * 2)}`, x, y - 30, 1, 6);
      }
    }
  }

  /** Tower cues that come from state rather than events: Sunbeam charge, Scorcher flames, Tea Urn steam. */
  private towerCues(t: Tower, v: TowerView, lift: number, sa: number, dt: number): void {
    const x = t.x * CELL;
    const y = t.y * CELL - lift;
    if (t.type === 'sunbeam') {
      let g = this.glows.get(t.id);
      if (t.charge > 0) {
        if (!g) {
          g = new Sprite(this.art.tex('fx.charge'));
          g.blendMode = 'add';
          this.fxAddLayer.addChild(g);
          this.glows.set(t.id, g);
        }
        const total = Math.max(1, Math.round(this.sim.balance.towers[t.type]!.tiers[t.tier]!.charge * 30));
        const f = 1 - t.charge / total;
        g.visible = true;
        g.position.set(x + Math.cos(sa) * 8, y + Math.sin(sa) * 6);
        g.scale.set(0.5 + f * 0.9);
        g.alpha = 0.3 + f * 0.7;
      } else if (g) g.visible = false;
    } else if (t.type === 'scorcher') {
      if (t.active >= this.sim.state.tick - 1) {
        const r = this.sim.balance.towers[t.type]!.tiers[t.tier]!.range * CELL;
        for (let i = 0; i < 2; i++) this.fx.flame(x + Math.cos(sa) * 24, y + Math.sin(sa) * 20, sa, r);
      }
    } else if (t.type === 'teaurn') {
      v.recoil = 0;
      if (Math.random() < dt * 1.4) this.fx.smoke(x, y - (EMIT_LIFT['teaurn'] ?? 0), 1, 0.45);
    }
  }

  private drawZones(zones: Zone[]): void {
    const live = new Set<number>();
    for (const z of zones) {
      live.add(z.id);
      let s = this.zones.get(z.id);
      if (!s) {
        s = new Sprite();
        this.decals.addChild(s);
        this.zones.set(z.id, s);
      }
      const key = z.kind === 'puddle' ? 'fx.puddle' : z.kind === 'foam' ? 'fx.foam' : `fx.fire.${Math.floor(this.time * 12 + z.id) % 4}`;
      setTex(s, this.art.tex(key));
      s.position.set(z.x * CELL, z.y * CELL + (z.kind === 'fire' ? 8 : 0));
      s.scale.set(z.kind === 'fire' ? 1.1 : (z.r * 2) / 1);
      s.alpha = Math.min(1, z.t / 20);
    }
    for (const [id, s] of this.zones) {
      if (!live.has(id)) {
        s.destroy();
        this.zones.delete(id);
      }
    }
  }

  private drawProjectile(p: Projectile, alpha: number, dt: number): void {
    let v = this.projs.get(p.id);
    if (!v) {
      const key = p.kind === 'rocket' ? 'proj.rocket' : p.kind === 'pie' ? 'proj.pie' : p.kind === 'bomblet' ? 'proj.bomblet' : 'proj.shell';
      v = { id: p.id, s: new Sprite(this.art.tex(key)), shadow: new Sprite(this.art.tex('fx.shadow')), seen: true, trail: 0 };
      v.shadow.scale.set(0.3, 0.3);
      v.shadow.alpha = 0.5;
      this.projLayer.addChild(v.s);
      this.shadows.addChild(v.shadow);
      this.projs.set(p.id, v);
    }
    v.seen = true;
    const x = (p.px + (p.x - p.px) * alpha) * CELL;
    const y = (p.py + (p.y - p.py) * alpha) * CELL;
    if (p.kind !== 'rocket') {
      const f = Math.min(1, (p.age + alpha) / p.life);
      const peak = p.kind === 'bomblet' ? 0.6 : 1.8;
      const z = 4 * peak * CELL * f * (1 - f);
      v.s.position.set(x, y - z);
      if (p.kind === 'pie') v.s.rotation += dt * 9;
      v.shadow.position.set(x, y);
      v.shadow.scale.set(0.3 + 0.15 * (1 - z / (1.8 * CELL)));
    } else {
      v.s.position.set(x, y - AIR_Z * 0.7);
      v.s.rotation = Math.atan2(p.hy, p.hx);
      v.shadow.position.set(x + 16, y + 20);
      v.trail += dt;
      if (v.trail > 0.05) {
        v.trail = 0;
        this.fx.smoke(x - p.hx * 10, y - AIR_Z * 0.7 - p.hy * 10, 1, 0.35);
      }
    }
  }
}
