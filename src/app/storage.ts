// IndexedDB (DESIGN.md §20): database `detour-division` with the stores `profile` and `snapshot`.
// A deliberately small wrapper: one key per store, whole-record reads and writes.

const DB_NAME = 'detour-division';
const DB_VERSION = 1;
export type Store = 'profile' | 'snapshot';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      for (const s of ['profile', 'snapshot']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB would not open'));
  });
  return dbp;
}

async function run<T>(store: Store, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = f(t.objectStore(store));
    // Resolve on commit, not on the request, so a reload straight after a write can't lose it.
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error ?? new Error('IndexedDB transaction failed'));
    t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export const storage = {
  get: <T>(store: Store, key: string): Promise<T | undefined> => run(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  put: (store: Store, key: string, value: unknown): Promise<IDBValidKey> => run(store, 'readwrite', (s) => s.put(value, key)),
  del: (store: Store, key: string): Promise<undefined> => run(store, 'readwrite', (s) => s.delete(key)),
};
