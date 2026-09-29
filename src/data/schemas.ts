// Zod schemas are the single source of truth for balance and level data: they
// validate the JSON, infer the TypeScript types, and generate the level JSON Schema
// (ADR-0002). Every number the simulation uses comes from these files (R-DATA-1).
import { z } from 'zod';

export const DamageTypeZ = z.enum(['kinetic', 'explosive', 'fire', 'shock', 'beam', 'cold']);
export type DamageType = z.infer<typeof DamageTypeZ>;

export const DifficultyZ = z.enum(['casual', 'tough', 'heroic']);
export type Difficulty = z.infer<typeof DifficultyZ>;
export const DIFFICULTIES: readonly Difficulty[] = ['casual', 'tough', 'heroic'];

export const TargetModeZ = z.enum(['first', 'last', 'strongest', 'closest']);
export type TargetMode = z.infer<typeof TargetModeZ>;

// ---------------------------------------------------------------- towers

export const TowerTierZ = z
  .object({
    cost: z.number().int().positive(),
    range: z.number().positive(),
    minRange: z.number().min(0).default(0),
    /** Shots (or pulses) per second. */
    rate: z.number().positive(),
    damage: z.number().min(0).default(0),
    dmgType: DamageTypeZ.default('kinetic'),
    /** Flat armour ignored per hit (R-DMG-1, Rattler T3 "steel-tipped rounds"). */
    armourPen: z.number().min(0).default(0),
    /** Splash radius in cells; 0 = single target. */
    splash: z.number().min(0).default(0),
    /** Damage fraction at the splash edge (linear falloff from 1 at the centre). */
    splashEdge: z.number().min(0).max(1).default(1),
    slow: z.number().min(0).max(1).default(0),
    slowDur: z.number().min(0).default(0),
    /** Projectile speed in cells/s (homing). */
    projSpeed: z.number().positive().optional(),
    /** Homing turn rate in degrees/s. */
    projTurn: z.number().positive().optional(),
    /** Lobbed shell flight time in seconds. */
    flight: z.number().positive().optional(),
    /** Projectiles per volley. */
    salvo: z.number().int().positive().default(1),
    /** Landing spread between shells in a volley, in cells. */
    spread: z.number().min(0).default(0),
    /** Full cone angle in degrees (Scorcher flame, Bellower blast). */
    cone: z.number().positive().optional(),
    burnDps: z.number().min(0).default(0),
    burnDur: z.number().min(0).default(0),
    /** Scorcher T3: burning ground patches. */
    patchDps: z.number().min(0).default(0),
    patchDur: z.number().min(0).default(0),
    patchEvery: z.number().positive().default(0.5),
    /** Chain lightning. */
    jumps: z.number().int().min(0).default(0),
    jumpRange: z.number().min(0).default(0),
    jumpFalloff: z.number().min(0).max(1).default(0),
    /** Every Nth zap stuns (0 = never). */
    stunEvery: z.number().int().min(0).default(0),
    stunDur: z.number().min(0).default(0),
    /** Sunbeam charge time (s) and beam width (cells). */
    charge: z.number().min(0).default(0),
    beamWidth: z.number().min(0).default(0),
    /** Icebox. */
    freeze: z.number().min(0).default(0),
    brittle: z.number().min(0).default(0),
    brittleDur: z.number().min(0).default(0),
    bossSlow: z.number().min(0).max(1).default(0),
    bossSlowDur: z.number().min(0).default(0),
    /** Tea Urn aura (radius is `range`). */
    auraRate: z.number().min(0).default(0),
    auraRange: z.number().min(0).default(0),
    auraDamage: z.number().min(0).default(0),
    /** Bellower. */
    reverse: z.number().min(0).default(0),
    reverseImmune: z.number().min(0).default(0),
    dizzy: z.number().min(0).default(0),
    /** Bubbler. */
    bubbles: z.number().int().min(0).default(0),
    bubbleDur: z.number().min(0).default(0),
    bubbleSpeed: z.number().min(0).default(0),
    popDamage: z.number().min(0).default(0),
    heavyOk: z.boolean().default(false),
    /** Leaves a slowing zone on landing/popping (Treacle T3 puddle, Bubbler T3 foam). */
    zoneSlow: z.number().min(0).max(1).default(0),
    zoneDur: z.number().min(0).default(0),
    zoneRadius: z.number().min(0).default(0),
    /** Pie Chucker custard: armour shred and slow. */
    shred: z.number().min(0).default(0),
    shredDur: z.number().min(0).default(0),
    /** Thumper T3 cluster bomblets. */
    bomblets: z.number().int().min(0).default(0),
    bombletDamage: z.number().min(0).default(0),
    bombletSplash: z.number().min(0).default(0),
  })
  .strict();
export type TowerTierDef = z.infer<typeof TowerTierZ>;

export const TowerZ = z
  .object({
    name: z.string(),
    kind: z.enum(['hitscan', 'homing', 'lob', 'cone', 'chain', 'beam', 'pulse', 'aura', 'bellow', 'bubble']),
    /** Shows the targeting-priority control (not for pulses and auras). */
    targeting: z.boolean().default(true),
    targets: z.object({ ground: z.boolean(), air: z.boolean() }).strict(),
    /** Turret slew rate in degrees/s. */
    turretTurn: z.number().positive(),
    /** Fires only when the turret points within this many degrees of the target. */
    aimTolerance: z.number().positive(),
    tiers: z.tuple([TowerTierZ, TowerTierZ, TowerTierZ]),
  })
  .strict();
export type TowerDef = z.infer<typeof TowerZ>;

// ---------------------------------------------------------------- enemies

const VulnZ = z.partialRecord(DamageTypeZ, z.number().positive());

export const ImmunityZ = z.enum(['stun', 'freeze', 'reverse', 'bubble']);
export type Immunity = z.infer<typeof ImmunityZ>;

const SpawnerZ = z.object({ type: z.string(), count: z.number().int().positive(), every: z.number().positive() }).strict();

/** Enemy behaviours (DESIGN.md §5). Elites may override any of them. */
export const TraitsZ = z
  .object({
    /** Heals allies in `radius` by `pct` of max HP every `every` s (bosses get `bossPct`). */
    heal: z.object({ every: z.number().positive(), radius: z.number().positive(), pct: z.number().positive(), bossPct: z.number().min(0), cleanse: z.boolean().default(false) }).strict().optional(),
    /** Speed (fraction) and armour granted to allies in `radius`; strongest aura wins. */
    aura: z.object({ radius: z.number().positive(), speed: z.number().min(0), armour: z.number().min(0).default(0) }).strict().optional(),
    /** On death, splits into `count` × `into`. */
    split: z.object({ into: z.string(), count: z.number().int().positive() }).strict().optional(),
    /** On death, releases `count` × `type` (air). */
    release: z.object({ type: z.string(), count: z.number().int().positive() }).strict().optional(),
    /** Speed ×mul for `dur` s after the first hit. */
    sprint: z.object({ mul: z.number().positive(), dur: z.number().positive() }).strict().optional(),
    /** Speed ×mul while below `below` of max HP. */
    dash: z.object({ below: z.number().positive(), mul: z.number().positive() }).strict().optional(),
    /** Deploys units behind itself. */
    spawner: SpawnerZ.optional(),
    /** Once below `below` HP, runs at `speed` cells/s for `dur` s. */
    burst: z.object({ below: z.number().positive(), speed: z.number().positive(), dur: z.number().positive() }).strict().optional(),
    /** Regrowing ice shield; stuns the owner for `stun` s when it breaks (the one stun a boss takes). */
    iceShield: z.object({ hp: z.number().positive(), regrow: z.number().positive(), stun: z.number().positive() }).strict().optional(),
    /** Air unit that drops `type` onto the nearest routable cell every `every` s. */
    dropper: z.object({ type: z.string(), every: z.number().positive() }).strict().optional(),
    /** Boss phases entered below HP fractions (in descending order). */
    phases: z.array(z.object({ below: z.number().positive(), armour: z.number().min(0).optional(), speed: z.number().positive().optional(), spawner: SpawnerZ.optional() }).strict()).optional(),
  })
  .strict();
export type TraitsDef = z.infer<typeof TraitsZ>;

export const EliteZ = z
  .object({
    name: z.string(),
    hpMul: z.number().positive().default(2.5),
    bountyMul: z.number().positive().default(2.5),
    threatMul: z.number().positive().default(2.5),
    armour: z.number().min(0).optional(),
    speed: z.number().positive().optional(),
    shield: z.number().min(0).optional(),
    shieldDelay: z.number().min(0).optional(),
    immune: z.array(ImmunityZ).optional(),
    traits: TraitsZ.optional(),
  })
  .strict();

export const EnemyZ = z
  .object({
    name: z.string(),
    hp: z.number().positive(),
    /** Cells per second. */
    speed: z.number().positive(),
    armour: z.number().min(0).default(0),
    /** Body radius in cells (placement overlap and steering clearance). */
    radius: z.number().positive(),
    bounty: z.number().min(0),
    /** Wave-budget cost (ADR-0007). */
    threat: z.number().positive(),
    leak: z.number().int().positive().default(1),
    air: z.boolean().default(false),
    /** Heading slew rate in degrees/s (R-MOVE-2). */
    turnRate: z.number().positive(),
    /** Default seconds between spawns within a group. */
    spacing: z.number().positive(),
    /** Group size bounds when generated, e.g. Putt-Putt packs. */
    pack: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    vuln: VulnZ.default({}),
    /** Shield pool absorbed before HP (Brolly Guard). */
    shield: z.number().min(0).default(0),
    shieldRegen: z.number().min(0).default(0),
    shieldDelay: z.number().min(0).default(0),
    boss: z.boolean().default(false),
    /** Heavy units can only be bubbled by towers with `heavyOk`. */
    heavy: z.boolean().default(false),
    slowResist: z.number().min(0).max(1).default(0),
    stunResist: z.number().min(0).max(1).default(0),
    immune: z.array(ImmunityZ).default([]),
    traits: TraitsZ.default({}),
    elite: EliteZ,
  })
  .strict();
export type EnemyDef = z.infer<typeof EnemyZ>;

// ---------------------------------------------------------------- rules

export const DamageRulesZ = z
  .object({
    types: z.record(DamageTypeZ, z.object({ pen: z.number().min(0).max(1), shieldMul: z.number().positive() }).strict()),
    minChip: z.number().min(0).max(1),
    coverMul: z.number().min(0).max(1),
    directFire: z.array(DamageTypeZ),
    /** Status stacking rules (§6). */
    status: z
      .object({
        freezeImmune: z.number().min(0),
        burnStacks: z.number().int().positive(),
        bossSlowCap: z.number().min(0).max(1),
      })
      .strict(),
  })
  .strict();

export const EconomyZ = z
  .object({
    sellRate: z.number().min(0).max(1),
    earlyRate: z.number().min(0),
    bountyGrowth: z.number().min(0),
    hpGrowth: z.number().min(0),
    zoneHp: z.array(z.number().positive()).length(5),
    zoneBounty: z.array(z.number().positive()).length(5),
  })
  .strict();

const DifficultyRuleZ = z
  .object({
    hp: z.number().positive(),
    speed: z.number().positive(),
    cash: z.number().positive(),
    bounty: z.number().positive(),
    eliteExtra: z.number().min(0).max(1),
    stars: z.number().int().min(1).max(3),
    bossHp: z.number().positive(),
  })
  .strict();
export const DifficultyRulesZ = z.record(DifficultyZ, DifficultyRuleZ);

export const TerrainRulesZ = z
  .object({
    iceSpeed: z.number().positive(),
    conveyorPush: z.number().min(0),
    conveyorCost: z.object({ along: z.number().positive(), against: z.number().positive(), across: z.number().positive() }).strict(),
  })
  .strict();

export const ProgressionZ = z
  .object({
    zoneGates: z.array(z.number().int().min(0)).length(5),
    towerStars: z.record(z.string(), z.number().int().min(0)),
  })
  .strict();

export const ModesZ = z
  .object({
    suddenDeath: z.object({ lives: z.tuple([z.number().int(), z.number().int(), z.number().int()]) }).strict(),
    puzzle: z.object({ lives: z.tuple([z.number().int(), z.number().int(), z.number().int()]) }).strict(),
    endless: z
      .object({ difficulty: DifficultyZ, eliteRampWaves: z.number().int().positive(), bossEvery: z.number().int().positive(), bosses: z.array(z.string()).length(5), extraWaves: z.number().int().positive() })
      .strict(),
  })
  .strict();

export const BalanceZ = z
  .object({
    towers: z.record(z.string(), TowerZ),
    enemies: z.record(z.string(), EnemyZ),
    damage: DamageRulesZ,
    economy: EconomyZ,
    difficulty: DifficultyRulesZ,
    terrain: TerrainRulesZ,
    progression: ProgressionZ,
    modes: ModesZ,
  })
  .strict();
export type BalanceDef = z.infer<typeof BalanceZ>;

// ---------------------------------------------------------------- levels

export const EdgeZ = z.enum(['N', 'S', 'E', 'W']);
export type Edge = z.infer<typeof EdgeZ>;

export const SpanZ = z.object({ edge: EdgeZ, from: z.number().int().min(0), to: z.number().int().min(0) }).strict();
export type Span = z.infer<typeof SpanZ>;

export const RouteZ = z
  .object({
    id: z.string(),
    entrance: SpanZ,
    exit: SpanZ,
    /** Air-only entrance: spawns only air units, has no ground route. */
    airOnly: z.boolean().default(false),
  })
  .strict();

export const GroupZ = z
  .object({
    enemy: z.string(),
    count: z.number().int().positive(),
    elite: z.boolean().default(false),
    /** Route id; defaults to cycling through the level's routes. */
    route: z.string().optional(),
    spacing: z.number().positive().optional(),
    /** Seconds after the wave launches before this group starts. */
    delay: z.number().min(0).default(0),
  })
  .strict();
export type GroupDef = z.infer<typeof GroupZ>;

export const RecipeZ = z
  .object({
    b0: z.number().positive(),
    g: z.number().positive(),
    /** The level's own HP scale on top of wave growth, zone and difficulty (§9.3); the main tuning lever. */
    hp: z.number().positive().default(1),
    pool: z.array(z.object({ enemy: z.string(), from: z.number().int().min(1), to: z.number().int().min(1).optional(), weight: z.number().positive() }).strict()).min(1),
    /** Every Nth wave is air-only (0 = never). */
    airEvery: z.number().int().min(0).default(0),
    /** First wave at which elites may appear (0 = never). */
    eliteFrom: z.number().int().min(0).default(0),
    /** Every Nth wave from eliteFrom is an all-elite wave (0 = never). */
    eliteEvery: z.number().int().min(0).default(0),
    eliteShareMax: z.number().min(0).max(1).default(0.35),
    /** Waves allowed to dip below the curve (R-WAVE-3). */
    breathers: z.array(z.number().int().min(1)).default([]),
  })
  .strict();
export type RecipeDef = z.infer<typeof RecipeZ>;

const CellZ = z.object({ cx: z.number().int().min(0), cy: z.number().int().min(0) }).strict();

export const PlanStepZ = z
  .object({
    /** Wait until this many waves have launched (0 = before the first). */
    wave: z.number().int().min(0).default(0),
    build: z.object({ tower: z.string(), cx: z.number().int().min(0), cy: z.number().int().min(0) }).strict().optional(),
    upgrade: CellZ.optional(),
    sell: CellZ.optional(),
    clear: CellZ.optional(),
    target: z.object({ cx: z.number().int().min(0), cy: z.number().int().min(0), mode: TargetModeZ }).strict().optional(),
  })
  .strict();
export type PlanStep = z.infer<typeof PlanStepZ>;

export const WaveOverrideZ = z
  .object({ wave: z.number().int().min(1), groups: z.array(GroupZ).min(1), difficulties: z.array(DifficultyZ).optional() })
  .strict();

export const LevelZ = z
  .object({
    $schema: z.string().optional(),
    id: z.string().regex(/^z[1-5]-0[1-8]$/),
    zone: z.number().int().min(1).max(5),
    index: z.number().int().min(1).max(8),
    name: z.string(),
    mode: z.enum(['standard', 'suddenDeath', 'timeTrial', 'puzzle']),
    /** Sudden Death / Time Trial: timer (seconds) and, for Time Trial, the kill target, per difficulty. */
    modeParams: z
      .object({
        timer: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).optional(),
        target: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]).optional(),
      })
      .strict()
      .default({}),
    seed: z.number().int(),
    grid: z.object({ cols: z.number().int().min(6).max(32), rows: z.number().int().min(4).max(20) }).strict(),
    tiles: z.array(z.string()),
    routes: z.array(RouteZ).min(1).max(4),
    tunnels: z.array(z.object({ a: z.tuple([z.number().int(), z.number().int()]), b: z.tuple([z.number().int(), z.number().int()]), length: z.number().positive() }).strict()).default([]),
    blockers: z.object({ clearCost: z.number().int().min(0) }).strict().default({ clearCost: 20 }),
    lives: z.number().int().positive(),
    startCash: z.number().int().min(0),
    loadout: z.object({ fixed: z.array(z.string()).max(6).nullable().default(null), bot: z.array(z.string()).min(1).max(6) }).strict(),
    waves: z
      .object({
        count: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]),
        /** Seconds between wave launches (§3.8). */
        interval: z.number().positive(),
        /** The countdown shrinks linearly to this by the last wave (§3.8, ADR-0011); absent, it stays at `interval`. */
        intervalEnd: z.number().positive().optional(),
        recipe: RecipeZ,
        overrides: z.array(WaveOverrideZ).default([]),
      })
      .strict(),
    hints: z.array(z.string()).default([]),
    bot: z
      .object({
        /** Scripted steps run first, in order, each once its wave has launched and it is affordable (§15.1). */
        plan: z.array(PlanStepZ).nullable().default(null),
        /** False for puzzles: the plan is the whole reference solution. */
        generic: z.boolean().default(true),
      })
      .strict()
      .default({ plan: null, generic: true }),
    /** Night lighting variant (§11, level 31). */
    night: z.boolean().default(false),
  })
  .strict();
export type LevelDef = z.infer<typeof LevelZ>;
