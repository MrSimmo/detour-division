// The player's profile and the battle in progress, persisted to IndexedDB (DESIGN.md §20).
// `profile` is one object for the whole session; loading replaces its contents in place.
import { freshProfile, PROFILE_VERSION, type Profile } from '../meta/progression.ts';
import { migrateProfile, type SnapshotRecord } from '../meta/save.ts';
import { storage } from './storage.ts';

export const profile: Profile = freshProfile();

interface ProfileRecord {
  schemaVersion: number;
  data: unknown;
}

/** Loads the stored profile, migrating it. A profile that can't be read is set aside, never overwritten. */
export async function loadProfile(): Promise<'fresh' | 'loaded'> {
  let rec: ProfileRecord | undefined;
  try {
    rec = await storage.get<ProfileRecord>('profile', 'main');
  } catch (e) {
    console.warn('saves: IndexedDB is unavailable; progress will not be kept', e);
    return 'fresh';
  }
  if (!rec) return 'fresh';
  try {
    Object.assign(profile, migrateProfile(rec.data));
    return 'loaded';
  } catch (e) {
    console.warn('saves: the stored profile could not be read; it has been kept aside', e);
    await storage.put('profile', `unreadable-${rec.schemaVersion}`, rec).catch(() => undefined);
    return 'fresh';
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;
let lastWrite: Promise<unknown> = Promise.resolve();

/** Writes the profile now. */
export function flushProfile(): Promise<unknown> {
  if (pending) clearTimeout(pending);
  pending = null;
  lastWrite = storage.put('profile', 'main', { schemaVersion: PROFILE_VERSION, data: JSON.parse(JSON.stringify(profile)) } satisfies ProfileRecord).catch((e: unknown) => console.warn('saves: could not write the profile', e));
  return lastWrite;
}

/** Writes the profile shortly (changes that come in bursts, such as slider drags, share one write). */
export function saveProfile(): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => void flushProfile(), 300);
}

/** Replaces the whole profile (an import), and writes it. */
export function replaceProfile(p: Profile): Promise<unknown> {
  for (const k of Object.keys(profile)) delete (profile as unknown as Record<string, unknown>)[k];
  Object.assign(profile, p);
  return flushProfile();
}

/** Marks a field-guide entry as seen. Returns true if it is new. */
export function markSeen(key: string): boolean {
  if (profile.seen[key]) return false;
  profile.seen[key] = true;
  saveProfile();
  return true;
}

export const snapshots = {
  load: (): Promise<unknown> => storage.get('snapshot', 'current').catch(() => undefined),
  save: (rec: SnapshotRecord): Promise<unknown> => {
    const w = storage.put('snapshot', 'current', rec).catch((e: unknown) => console.warn('saves: could not write the snapshot', e));
    lastWrite = Promise.all([lastWrite, w]);
    return w;
  },
  clear: (): Promise<unknown> => storage.del('snapshot', 'current').catch(() => undefined),
};

/** Settles once every write issued so far has committed (tests and page hide). */
export function savesSettled(): Promise<unknown> {
  return lastWrite;
}
