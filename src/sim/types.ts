// Plain-data simulation state (ADR-0003): everything in SimState serialises to JSON
// unchanged, so snapshots, hashes and restores are exact.
import type { Difficulty, TargetMode } from '../data/schemas.ts';
import type { Rng } from './core/rng.ts';
import type { PHASE } from './constants.ts';

export type Result = 'playing' | 'won' | 'lost';

/** 0 entering from off-map · 1 walking the maze · 2 leaving past the exit · 3 inside a tunnel. */
export type Phase = (typeof PHASE)[keyof typeof PHASE];

export interface Enemy {
  id: number;
  type: string;
  elite: boolean;
  air: boolean;
  route: number;
  exit: number;
  wave: number;
  phase: Phase;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Unit heading. */
  hx: number;
  hy: number;
  /** Entry cell (ground). */
  entry: number;
  /** Current look-ahead waypoint cell (ground). */
  wp: number;
  /** Ticks until the look-ahead is refreshed. */
  wpT: number;
  /** Path version the waypoint was chosen against. */
  wpV: number;
  /** Air lane endpoints, progress 0..1 and length. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  len: number;
  hp: number;
  maxHp: number;
  armour: number;
  /** Base speed in cells/s after difficulty and elite modifiers. */
  speed: number;
  radius: number;
  lane: number;
  bounty: number;
  leak: number;
  slow: number;
  slowT: number;
  /** Shield pool (Brolly, Glacier Grinder's ice) and ticks until it regenerates/regrows. */
  shield: number;
  maxShield: number;
  shieldT: number;
  /** Stunned or frozen: no movement. */
  stunT: number;
  frozen: boolean;
  freezeImmT: number;
  /** Brittle: extra damage taken; the pending value applies when a freeze thaws. */
  brittle: number;
  brittleT: number;
  pBrittle: number;
  pBrittleT: number;
  /** Burns from up to N sources (§6). */
  burns: { src: number; dps: number; t: number }[];
  /** Custard armour shred. */
  shred: number;
  shredT: number;
  /** About turn (Bellower): marching back, immunity, dizzy on recovery. */
  revT: number;
  revImmT: number;
  pDizzyT: number;
  /** Bubbled: floats back along the route, then pops. */
  bubbleT: number;
  bubbleSpeed: number;
  bubblePop: number;
  bubbleZone: number;
  bubbleZoneT: number;
  bubbleZoneR: number;
  /** Strongest ally aura this tick (Tub-Thumper). */
  auraSpeed: number;
  auraArmour: number;
  /** Trait timers. */
  healT: number;
  sprintT: number;
  sprinted: boolean;
  dashing: boolean;
  spawnT: number;
  burstT: number;
  bursted: boolean;
  dropT: number;
  bossPhase: number;
  /** Speed multiplier from a boss phase (1 = none). */
  speedMul: number;
  /** Remaining route distance in cells (targeting "first"/"last"). */
  remaining: number;
  /** Route progress 0..1 (threat metric). */
  progress: number;
  tunnelT: number;
  tunnelTo: number;
  dead: boolean;
}

export interface Tower {
  id: number;
  type: string;
  /** 0-based tier index. */
  tier: number;
  cell: number;
  cx: number;
  cy: number;
  x: number;
  y: number;
  spent: number;
  mode: TargetMode;
  /** Seconds until the next shot may fire. */
  cd: number;
  target: number;
  /** Unit aim vector, and its value on the previous tick (for interpolation). */
  ax: number;
  ay: number;
  pax: number;
  pay: number;
  retarget: number;
  shots: number;
  /** Sunbeam charge ticks remaining (0 = idle). */
  charge: number;
  /** Tea Urn buffs received this tick (fractions). */
  bRate: number;
  bRange: number;
  bDamage: number;
  /** Tick of the last active shot/flame (render cue). */
  active: number;
  /** Scorcher T3 burning-patch timer (s). */
  patchT: number;
}

export interface Projectile {
  id: number;
  kind: 'rocket' | 'shell' | 'pie' | 'bomblet';
  tower: number;
  ttype: string;
  tier: number;
  x: number;
  y: number;
  px: number;
  py: number;
  hx: number;
  hy: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  target: number;
  age: number;
  life: number;
  damage: number;
  dmgType: string;
  splash: number;
  splashEdge: number;
  pen: number;
  air: boolean;
  ground: boolean;
  speed: number;
  /** On-impact effects. */
  slow: number;
  slowT: number;
  shred: number;
  shredT: number;
  zoneSlow: number;
  zoneT: number;
  zoneR: number;
  bomblets: number;
  bombDamage: number;
  bombSplash: number;
  dead: boolean;
}

/** A lingering ground effect: treacle puddle, custard foam or burning patch. */
export interface Zone {
  id: number;
  kind: 'puddle' | 'foam' | 'fire';
  x: number;
  y: number;
  r: number;
  t: number;
  slow: number;
  dps: number;
}

export interface Spawner {
  wave: number;
  group: number;
  left: number;
  at: number;
}

export interface SimState {
  v: number;
  level: string;
  difficulty: Difficulty;
  /** Endless run (§3.10): waves never run out; the score is waves survived. */
  endless: boolean;
  seed: number;
  tick: number;
  rng: Rng;
  cash: number;
  lives: number;
  result: Result;
  nextId: number;
  loadout: string[];
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  zones: Zone[];
  waves: { next: number; nextAt: number; started: boolean; spawners: Spawner[] };
  stats: { kills: number; leaks: number; earned: number; spent: number; bounty: number; early: number; peakProgress: number };
  /** Cells whose removable blocker has been cleared. */
  cleared: number[];
  /** Increments whenever the maze changes; enemies refresh look-ahead when it does. */
  pathV: number;
  /** Mode clock (ticks left, -1 before the first wave) and Time Trial target. */
  mode: { timer: number; target: number };
}

export type SimEvent =
  | { e: 'spawn'; id: number; type: string; elite: boolean; air: boolean; wave: number; x: number; y: number }
  | { e: 'fire'; tower: number; ttype: string; tier: number; x: number; y: number; tx: number; ty: number; target: number }
  | { e: 'hit'; target: number; x: number; y: number; dmg: number; dmgType: string }
  | { e: 'kill'; id: number; type: string; elite: boolean; x: number; y: number; bounty: number; wave: number; progress: number }
  | { e: 'leak'; id: number; type: string; x: number; y: number; lives: number }
  | { e: 'boom'; x: number; y: number; radius: number; ttype: string; tier: number }
  | { e: 'build'; tower: number; ttype: string; cx: number; cy: number }
  | { e: 'upgrade'; tower: number; ttype: string; tier: number; cx: number; cy: number }
  | { e: 'sell'; tower: number; ttype: string; cx: number; cy: number; refund: number }
  | { e: 'clear'; cx: number; cy: number; cost: number }
  | { e: 'paths' }
  | { e: 'wave'; index: number; early: boolean; bonus: number }
  | { e: 'tunnel'; id: number; x: number; y: number }
  | { e: 'zap'; tower: number; tier: number; pts: number[] }
  | { e: 'beam'; tower: number; tier: number; x0: number; y0: number; x1: number; y1: number; w: number }
  | { e: 'pulse'; tower: number; tier: number; x: number; y: number; r: number }
  | { e: 'bellow'; tower: number; tier: number; x: number; y: number; ax: number; ay: number; cone: number; r: number }
  | { e: 'reverse'; id: number; x: number; y: number }
  | { e: 'bubble'; tower: number; id: number }
  | { e: 'pop'; id: number; x: number; y: number }
  | { e: 'freeze'; id: number; x: number; y: number }
  | { e: 'shieldBreak'; id: number; x: number; y: number }
  | { e: 'shieldUp'; id: number }
  | { e: 'heal'; id: number; x: number; y: number; r: number }
  | { e: 'split'; id: number; x: number; y: number }
  | { e: 'phase'; id: number; phase: number }
  | { e: 'drop'; id: number; x: number; y: number }
  | { e: 'result'; result: Result };

export type Command =
  | { t: 'build'; tower: string; cx: number; cy: number }
  | { t: 'upgrade'; id: number }
  | { t: 'sell'; id: number }
  | { t: 'target'; id: number; mode: TargetMode }
  | { t: 'callWave' }
  | { t: 'clear'; cx: number; cy: number };

export type PlaceReason =
  | 'OUT_OF_BOUNDS'
  | 'LEVEL_OVER'
  | 'NOT_IN_LOADOUT'
  | 'NOT_BUILDABLE'
  | 'OCCUPIED'
  | 'ENEMY_IN_WAY'
  | 'BLOCKS_ROUTE'
  | 'TRAPS_ENEMY'
  | 'NO_CASH';

export type CommandReason = PlaceReason | 'NO_SUCH_TOWER' | 'MAX_TIER' | 'NO_MORE_WAVES' | 'NOT_A_BLOCKER';

export interface CommandResult {
  ok: boolean;
  reason?: CommandReason;
  id?: number;
  routes?: string[];
  enemies?: number[];
}
