import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createInitialAppData } from './defaults';
import { loadAppData, saveAppData, StorageError } from './db';
import type { AppData } from './schema';
import { todayFor } from './selectors';
import type { Ctx } from './actions';

export type StoreStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; persistence: 'indexeddb' | 'memory' }
  | { kind: 'corrupt'; errors: string[]; quarantined: boolean };

export interface StoreValue {
  data: AppData;
  status: StoreStatus;
  /** Set when the last change could not be written. The UI must show it. */
  saveError: string | null;
  today: string;
  makeCtx: () => Ctx;
  /** Apply a pure transition and persist it. Resolves false if saving failed. */
  apply: (fn: (data: AppData, ctx: Ctx) => AppData) => Promise<boolean>;
  replaceAll: (data: AppData) => Promise<boolean>;
  retrySave: () => Promise<boolean>;
}

const StoreContext = createContext<StoreValue | null>(null);

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now().toString(36)}-${Math.floor(performance.now() * 1000).toString(36)}`;
  }
}

export interface StoreProviderProps {
  children: ReactNode;
  /** Tests can inject a clock. */
  now?: () => Date;
  /** Tests can start from known data instead of IndexedDB. */
  initialData?: AppData;
}

export function StoreProvider({ children, now = () => new Date(), initialData }: StoreProviderProps) {
  const [data, setData] = useState<AppData>(() => initialData ?? createInitialAppData(now().toISOString()));
  const [status, setStatus] = useState<StoreStatus>(initialData ? { kind: 'ready', persistence: 'indexeddb' } : { kind: 'loading' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const dataRef = useRef(data);
  const persistenceRef = useRef<'indexeddb' | 'memory'>('indexeddb');
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback(async (): Promise<boolean> => {
    if (persistenceRef.current === 'memory') return false;
    const run = writeChain.current.then(async () => {
      try {
        await saveAppData(dataRef.current); // always the latest snapshot
        setSaveError(null);
        return true;
      } catch (e) {
        const message = e instanceof StorageError ? `${e.kind}: ${e.message}` : 'write_failed';
        setSaveError(message);
        return false;
      }
    });
    writeChain.current = run;
    return run;
  }, []);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    void (async () => {
      const result = await loadAppData();
      if (cancelled) return;
      if (result.status === 'ok') {
        dataRef.current = result.data;
        setData(result.data);
        setStatus({ kind: 'ready', persistence: 'indexeddb' });
        // Write migrated data back straight away, so fields an older version
        // stored (e.g. removed health answers) don't linger on the device.
        if (result.migratedFrom !== null) await persist();
      } else if (result.status === 'empty') {
        const fresh = createInitialAppData(now().toISOString());
        dataRef.current = fresh;
        setData(fresh);
        setStatus({ kind: 'ready', persistence: 'indexeddb' });
        await persist();
      } else if (result.status === 'corrupt') {
        setStatus({ kind: 'corrupt', errors: result.errors, quarantined: result.quarantined });
      } else {
        persistenceRef.current = 'memory';
        setStatus({ kind: 'ready', persistence: 'memory' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notice a new local day (e.g. the app left open overnight or reopened later).
  useEffect(() => {
    const bump = () => setClockTick((t) => t + 1);
    const id = window.setInterval(bump, 60_000);
    document.addEventListener('visibilitychange', bump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', bump);
    };
  }, []);

  const today = useMemo(() => todayFor(data, now()), [data, now, clockTick]);

  const makeCtx = useCallback((): Ctx => {
    const n = now();
    return { now: n.toISOString(), today: todayFor(dataRef.current, n), newId };
  }, [now]);

  const apply = useCallback(
    async (fn: (d: AppData, ctx: Ctx) => AppData): Promise<boolean> => {
      const next = fn(dataRef.current, makeCtx());
      if (next === dataRef.current) return true;
      dataRef.current = next;
      setData(next);
      return persist();
    },
    [makeCtx, persist],
  );

  const replaceAll = useCallback(
    async (next: AppData): Promise<boolean> => {
      dataRef.current = next;
      setData(next);
      persistenceRef.current = persistenceRef.current === 'memory' ? 'memory' : 'indexeddb';
      setStatus({ kind: 'ready', persistence: persistenceRef.current });
      return persist();
    },
    [persist],
  );

  const value = useMemo<StoreValue>(
    () => ({ data, status, saveError, today, makeCtx, apply, replaceAll, retrySave: persist }),
    [data, status, saveError, today, makeCtx, apply, replaceAll, persist],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
