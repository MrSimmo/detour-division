// Engine constants: fixed properties of how the simulation works, not balance.
// Balance numbers live only in data/balance/*.json (R-DMG-2); this file and
// src/sim/core/ are the only places the literal-number scan allows numbers.

// 2: v1.1 pacing (ADR-0011) changed the waves a stored battle was generated from.
// 3: v1.3 lanes (R-LANE-1) moved where ground units start and escape.
// 4: v1.4 (ADR-0014) moved the start further up the entrance lane.
export const SIM_VERSION = 4;

/** ADR-0003: fixed 30 Hz step. */
export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
/** A frame never runs more than this many ticks (avoids a spiral of death after a stall). */
export const MAX_TICKS_PER_FRAME = 12;

/** Steering looks ahead this many cells along the distance field (ADR-0004). */
export const LOOKAHEAD_CELLS = 4;
/** Look-ahead is refreshed every N ticks per enemy (staggered by id), or at once when paths change. */
export const LOOKAHEAD_REFRESH_TICKS = 3;
/** Line-of-sight sample spacing in cells. */
export const LOS_STEP = 0.2;
/** Max lateral lane offset in cells (§3.3). */
export const LANE_MAX = 0.22;
/** Speed floor while turning sharply (§3.3). */
export const TURN_SPEED_FLOOR = 0.35;

/** How far beyond the map edge air units spawn and leave, in cells. */
export const EDGE_OUTSIDE = 0.75;
/**
 * How far beyond the map edge ground units spawn, in cells: up the entrance lane, off screen on common
 * desktop windows (§9.1, R-LANE-1, ADR-0014). The renderer closes the lane with trees inside this, so a
 * unit is hidden when it appears on a wider window too (R-LANE-2).
 */
export const LANE_IN = 6.5;
/** How far beyond the map edge ground units escape, in cells: down the exit lane. The renderer walks them on out of sight (R-LANE-2). */
export const LANE_OUT = 2.75;

/** Towers re-evaluate their target priority this often. */
export const RETARGET_TICKS = 6;
/** Rockets detonate within this distance of their target (plus its radius). */
export const ROCKET_HIT_RADIUS = 0.15;
export const ROCKET_MAX_LIFE_S = 5;
/** Muzzle offset from the tower centre in cells. */
export const MUZZLE_OFFSET = 0.35;
/** Lateral spread between rockets in a salvo, in radians. */
export const SALVO_SPREAD = 0.35;

/** Splash reaches enemies whose centre is within radius + this fraction of their body radius. */
export const SPLASH_BODY_REACH = 0.5;

/** Generated waves stagger their groups by this many seconds (ADR-0007). */
export const GROUP_STAGGER_S = 2;
/** A generated wave gains an extra group from each of these wave numbers. */
export const GROUPS_FROM_WAVE: readonly number[] = [6, 16];
/** Mixed into the level seed so wave generation and in-play randomness use unrelated streams. */
export const LEVEL_WAVE_SALT = 7919;

/** Distance below which geometry comparisons treat points as coincident. */
export const EPS = 1e-9;
/** A unit enters a tunnel once within this distance of the mouth's centre. */
export const TUNNEL_ENTER_DIST = 0.12;
/** Spatial index margin in cells beyond the map, for off-map units. */
export const SPATIAL_MARGIN = 3;
/** Movement clearance is capped so large bodies (bosses, Lummox) still fit one-cell corridors (§16.1). */
export const MAX_CLEARANCE = 0.3;

/** Enemy movement phases (Enemy.phase). */
export const PHASE = { ENTER: 0, WALK: 1, EXIT: 2, TUNNEL: 3 } as const;
export const TICK_MS = 1000 / TICK_HZ;

/** Thumper T3 bomblets: flight time and scatter distance. */
export const BOMBLET_FLIGHT_S = 0.35;
export const BOMBLET_REACH = 0.7;
/** Ground zones refresh their slow/burn on units inside for this long. */
export const ZONE_SLOW_TICKS = 10;
export const ZONE_BURN_TICKS = 15;
/** Oldest zones are dropped beyond this many. */
export const MAX_ZONES = 80;

/** Split-offs spread this far apart along the parent's path (cells). */
export const SPLIT_SPREAD = 0.22;
/** Deployed units appear this far behind the parent, spaced sideways (cells). */
export const DEPLOY_BACK = 0.6;
export const DEPLOY_SIDE = 0.35;
