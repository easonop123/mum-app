import { AppDataSchema, formatIssues, type AppData } from './schema';
import { migrateToCurrent } from './migrations';

// IndexedDB persistence. One validated document holds the person's data.
// Anything unreadable is copied to a quarantine store (never silently
// dropped), and save errors are surfaced to the UI rather than faked.

const DB_NAME = 'a-little-stronger';
const DB_VERSION = 1;
const STORE = 'kv';
const QUARANTINE = 'quarantine';
const KEY = 'appData';

export class StorageError extends Error {
  readonly kind: 'unavailable' | 'invalid' | 'write_failed' | 'quota';
  constructor(kind: StorageError['kind'], message: string) {
    super(message);
    this.name = 'StorageError';
    this.kind = kind;
  }
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; data: AppData; migratedFrom: number | null }
  | { status: 'corrupt'; errors: string[]; quarantined: boolean }
  | { status: 'unavailable'; error: string };

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('unavailable', 'IndexedDB is not available in this browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(QUARANTINE)) db.createObjectStore(QUARANTINE, { autoIncrement: true });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(new StorageError('unavailable', request.error?.message ?? 'Could not open storage'));
    request.onblocked = () => reject(new StorageError('unavailable', 'Storage is blocked by another open tab'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** For tests: forget the cached connection. */
export async function closeDatabaseForTests(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
}

export function validateStoredData(raw: unknown): { ok: true; data: AppData; migratedFrom: number | null } | { ok: false; errors: string[] } {
  const migrated = migrateToCurrent(raw);
  if (!migrated.ok) return { ok: false, errors: [migrated.error] };
  const parsed = AppDataSchema.safeParse(migrated.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };
  return { ok: true, data: parsed.data, migratedFrom: migrated.migratedFrom };
}

export async function loadAppData(): Promise<LoadResult> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch (e) {
    return { status: 'unavailable', error: e instanceof Error ? e.message : 'Storage unavailable' };
  }
  try {
    const tx = db.transaction(STORE, 'readonly');
    const raw = await promisify(tx.objectStore(STORE).get(KEY));
    if (raw === undefined) return { status: 'empty' };
    const result = validateStoredData(raw);
    if (result.ok) return { status: 'ok', data: result.data, migratedFrom: result.migratedFrom };
    const quarantined = await quarantine(raw, result.errors).then(
      () => true,
      () => false,
    );
    return { status: 'corrupt', errors: result.errors, quarantined };
  } catch (e) {
    return { status: 'unavailable', error: e instanceof Error ? e.message : 'Storage unavailable' };
  }
}

/** Validates, then writes. Throws StorageError so callers can show a real failure. */
export async function saveAppData(data: AppData): Promise<void> {
  const parsed = AppDataSchema.safeParse(data);
  if (!parsed.success) {
    throw new StorageError('invalid', `Refusing to save invalid data: ${formatIssues(parsed.error).join('; ')}`);
  }
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch (e) {
    throw new StorageError('unavailable', e instanceof Error ? e.message : 'Storage unavailable');
  }
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(parsed.data, KEY);
    await txDone(tx);
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    throw new StorageError(name === 'QuotaExceededError' ? 'quota' : 'write_failed', e instanceof Error ? e.message : 'Write failed');
  }
}

async function quarantine(raw: unknown, errors: string[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(QUARANTINE, 'readwrite');
  let copy: string;
  try {
    copy = JSON.stringify(raw).slice(0, 5_000_000);
  } catch {
    copy = String(raw).slice(0, 100_000);
  }
  tx.objectStore(QUARANTINE).add({ savedAt: new Date().toISOString(), errors, raw: copy });
  await txDone(tx);
}

export async function listQuarantine(): Promise<Array<{ savedAt: string; errors: string[]; raw: string }>> {
  const db = await openDatabase();
  const tx = db.transaction(QUARANTINE, 'readonly');
  return promisify(tx.objectStore(QUARANTINE).getAll());
}

/** Destructive: removes all local data, including quarantined copies. */
export async function deleteAllLocalData(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE, QUARANTINE], 'readwrite');
  tx.objectStore(STORE).clear();
  tx.objectStore(QUARANTINE).clear();
  await txDone(tx);
}

export type PersistResult = 'granted' | 'not_granted' | 'unsupported';

/** Asks the browser to keep this site's data; the browser may still say no. */
export async function requestPersistentStorage(): Promise<PersistResult> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted?.()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'not_granted';
  } catch {
    return 'unsupported';
  }
}

export async function persistenceStatus(): Promise<PersistResult> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'granted' : 'not_granted';
  } catch {
    return 'unsupported';
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || e.usage === undefined || e.quota === undefined) return null;
    return { usage: e.usage, quota: e.quota };
  } catch {
    return null;
  }
}
