// Saves (DESIGN.md §20): record validation, chained migrations, the save file format, CRC32 and
// snapshot acceptance. Pure: storage, compression and the clipboard live in src/app.
import { z } from 'zod';
import { DifficultyZ } from '../data/schemas.ts';
import { PROFILE_VERSION, type Profile } from './progression.ts';

const BestZ = z.object({ lives: z.number(), seconds: z.number(), kills: z.number() }).strict();

const SettingsZ = z
  .object({
    master: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    ui: z.number().min(0).max(1),
    muted: z.boolean(),
    quality: z.enum(['auto', 'high', 'low']),
    renderer: z.enum(['auto', 'webgl', 'webgpu']),
    shake: z.boolean(),
    reducedMotion: z.enum(['auto', 'on', 'off']),
    colourBlind: z.boolean(),
    routes: z.boolean(),
    keys: z.record(z.string(), z.string()),
    ghostOffset: z.number().min(0.5).max(3),
  })
  .strict();

/** The current profile shape. Anything older is migrated before it gets here. */
export const ProfileZ = z
  .object({
    v: z.literal(PROFILE_VERSION),
    stars: z.record(z.string(), z.number().int().min(0).max(3)),
    bests: z.record(z.string(), z.object({ endless: z.number().int().min(0).optional() }).catchall(BestZ)),
    seen: z.record(z.string(), z.literal(true)),
    loadouts: z.record(z.string(), z.array(z.string()).max(6)),
    settings: SettingsZ,
    flags: z.object({ iosExplainer: z.literal(true).optional(), persistAsked: z.literal(true).optional() }).strict(),
  })
  .strict();

type Raw = Record<string, unknown>;

/** `PROFILE_MIGRATIONS[n]` turns a version-n profile into version n + 1. Each has a fixture test. */
export const PROFILE_MIGRATIONS: Record<number, (d: Raw) => Raw> = {
  1: (d) => ({ ...d, v: 2, flags: {} }),
  2: (d) => ({ ...d, v: 3, settings: { ...(d.settings as Raw), ghostOffset: 1.4 } }),
  // ADR-0012: 'webgl' was the default, and Auto starts WebGL too, so it becomes 'auto'.
  3: (d) => {
    const settings = d.settings as Raw;
    return { ...d, v: 4, settings: { ...settings, renderer: settings.renderer === 'webgpu' ? 'webgpu' : 'auto' } };
  },
};

/** Brings stored or imported data up to the current profile, or throws if it can't be read. */
export function migrateProfile(data: unknown): Profile {
  if (!data || typeof data !== 'object') throw new Error('not a profile');
  let d = data as Raw;
  let v = typeof d.v === 'number' ? d.v : NaN;
  if (!Number.isInteger(v) || v < 1) throw new Error('not a profile');
  if (v > PROFILE_VERSION) throw new Error(`this save is from a newer version of the game (profile v${v})`);
  while (v < PROFILE_VERSION) {
    const step = PROFILE_MIGRATIONS[v];
    if (!step) throw new Error(`no migration from profile v${v}`);
    d = step(d);
    v++;
  }
  return ProfileZ.parse(d) as Profile;
}

export const SAVE_FORMAT = 'detour-division-save';
export const SAVE_FILE_VERSION = 1;

/** The `.ddsave` file: JSON with a format tag and version around the profile. */
export function saveFileText(p: Profile): string {
  return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_FILE_VERSION, profile: p });
}

export function readSaveFile(text: string): Profile {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error('this is not a Detour Division save');
  }
  const f = d as { format?: unknown; version?: unknown; profile?: unknown };
  if (!f || f.format !== SAVE_FORMAT || typeof f.version !== 'number') throw new Error('this is not a Detour Division save');
  if (f.version > SAVE_FILE_VERSION) throw new Error('this save is from a newer version of the game');
  return migrateProfile(f.profile);
}

let crcTable: Uint32Array | null = null;
/** CRC-32 (IEEE 802.3), as used on the end of the text save code. */
export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A battle in progress (§20): taken at each wave start and when the page is hidden or closed. */
export interface SnapshotRecord {
  schemaVersion: 1;
  levelId: string;
  levelName: string;
  difficulty: string;
  loadout: string[];
  endless: boolean;
  /** Waves launched, for the resume prompt. */
  wave: number;
  snap: { v: number; state: { level: string } & Raw };
}

const SnapshotRecordZ = z
  .object({
    schemaVersion: z.literal(1),
    levelId: z.string(),
    levelName: z.string(),
    difficulty: DifficultyZ.optional(),
    loadout: z.array(z.string()).optional(),
    endless: z.boolean().optional(),
    wave: z.number().int().min(0),
    snap: z.object({ v: z.number().int(), state: z.object({ level: z.string() }).passthrough() }),
  })
  .passthrough();

/** `SNAPSHOT_MIGRATIONS[n]` turns a sim-version-n state into version n + 1. None are needed yet. */
export const SNAPSHOT_MIGRATIONS: Record<number, (s: Raw) => Raw> = {};

/** Checks a stored snapshot against the running sim version, migrating it when a migration exists. */
export function acceptSnapshot(rec: unknown, simVersion: number): { ok: true; rec: SnapshotRecord } | { ok: false; reason: 'unreadable' | 'outdated' } {
  const r = SnapshotRecordZ.safeParse(rec);
  if (!r.success) return { ok: false, reason: 'unreadable' };
  // Zod's output rebuilds objects with the declared keys first; the sim hash is over JSON key order,
  // so hand back a copy of the record exactly as stored, now that it's known to be well formed.
  const out = JSON.parse(JSON.stringify(rec)) as SnapshotRecord;
  if (out.snap.v > simVersion) return { ok: false, reason: 'outdated' };
  while (out.snap.v < simVersion) {
    const step = SNAPSHOT_MIGRATIONS[out.snap.v];
    if (!step) return { ok: false, reason: 'outdated' };
    out.snap = { v: out.snap.v + 1, state: step(out.snap.state) as SnapshotRecord['snap']['state'] };
  }
  return { ok: true, rec: out };
}
