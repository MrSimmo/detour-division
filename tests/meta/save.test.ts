// §20 saves: versioned records, chained migrations, the save file, CRC32 and snapshot acceptance (R-SAVE-1).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { freshProfile, PROFILE_VERSION } from '../../src/meta/progression.ts';
import { acceptSnapshot, crc32, migrateProfile, PROFILE_MIGRATIONS, readSaveFile, saveFileText } from '../../src/meta/save.ts';

const v1 = JSON.parse(readFileSync('tests/fixtures/profile-v1.json', 'utf8')) as Record<string, unknown>;

describe('profile migrations', () => {
  it('has a migration for every version from 1 up to the current one', () => {
    for (let n = 1; n < PROFILE_VERSION; n++) expect(typeof PROFILE_MIGRATIONS[n], `migrate[${n}]`).toBe('function');
  });

  it('R-SAVE-1: a v1 fixture migrates to the current version and keeps everything it had', () => {
    const p = migrateProfile(structuredClone(v1));
    expect(p.v).toBe(PROFILE_VERSION);
    expect(p.stars).toEqual(v1.stars);
    expect(p.bests).toEqual(v1.bests);
    expect(p.seen).toEqual(v1.seen);
    expect(p.loadouts).toEqual(v1.loadouts);
    // v3 → v4 turns the old default renderer into Auto (ADR-0012).
    expect(p.settings).toEqual({ ...(v1.settings as object), ghostOffset: 1.4, renderer: 'auto' });
    expect(p.flags).toEqual({});
  });

  it('each step on its own: v1 → v2 adds flags, v2 → v3 adds the ghost offset (§18.5), v3 → v4 the Auto renderer', () => {
    const v2 = PROFILE_MIGRATIONS[1]!(structuredClone(v1));
    expect(v2).toMatchObject({ v: 2, flags: {} });
    const v3 = PROFILE_MIGRATIONS[2]!(v2);
    expect(v3).toMatchObject({ v: 3 });
    expect((v3.settings as { ghostOffset: number }).ghostOffset).toBe(1.4);
    // v3 → v4 (ADR-0012): the old default 'webgl' becomes 'auto'; a chosen 'webgpu' stays.
    const v4 = PROFILE_MIGRATIONS[3]!(v3);
    expect(v4).toMatchObject({ v: 4, settings: { renderer: 'auto' } });
    const gpu = PROFILE_MIGRATIONS[3]!({ ...v3, settings: { ...(v3.settings as object), renderer: 'webgpu' } });
    expect((gpu.settings as { renderer: string }).renderer).toBe('webgpu');
  });

  it('leaves a current profile as it is', () => {
    const p = freshProfile();
    p.stars['z2-01'] = 2;
    expect(migrateProfile(structuredClone(p))).toEqual(p);
  });

  it('refuses rubbish and profiles from a newer game', () => {
    expect(() => migrateProfile({ hello: 'world' })).toThrow();
    expect(() => migrateProfile({ ...freshProfile(), v: PROFILE_VERSION + 1 })).toThrow(/newer/);
    expect(() => migrateProfile({ ...freshProfile(), stars: { 'z1-01': 7 } })).toThrow();
  });
});

describe('save file', () => {
  it('R-SAVE-1: a round trip through the save file is lossless', () => {
    const p = migrateProfile(structuredClone(v1));
    p.flags.iosExplainer = true;
    expect(readSaveFile(saveFileText(p))).toEqual(p);
  });

  it('reads an old save file by migrating it', () => {
    const text = JSON.stringify({ format: 'detour-division-save', version: 1, profile: v1 });
    expect(readSaveFile(text).v).toBe(PROFILE_VERSION);
  });

  it('refuses a file that is not a Detour Division save', () => {
    expect(() => readSaveFile('{"format":"something-else","version":1,"profile":{}}')).toThrow(/not a Detour Division save/);
    expect(() => readSaveFile('not json')).toThrow();
  });
});

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('snapshots', () => {
  const rec = { schemaVersion: 1, levelId: 'z1-01', levelName: 'Primrose Lane', wave: 3, snap: { v: 1, state: { level: 'z1-01' } } };
  it('accepts a snapshot from this sim version', () => {
    expect(acceptSnapshot(rec, 1)).toMatchObject({ ok: true });
  });
  it('hands back the state exactly as stored: same keys in the same order, so its hash matches (R-SAVE-2)', () => {
    const state = { tick: 1210, cash: 42, level: 'z1-01', enemies: [{ id: 3, hp: 10 }], waves: { next: 3 } };
    const r = acceptSnapshot({ ...rec, snap: { v: 1, state } }, 1);
    expect(r.ok && JSON.stringify(r.rec.snap.state)).toBe(JSON.stringify(state));
  });
  it('discards one from an older sim with no migration, saying why', () => {
    expect(acceptSnapshot(rec, 2)).toEqual({ ok: false, reason: 'outdated' });
    expect(acceptSnapshot({ nonsense: true }, 1)).toEqual({ ok: false, reason: 'unreadable' });
  });
});
