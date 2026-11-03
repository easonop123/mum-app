import { useEffect, useState } from 'react';
import { canApplyUpdate } from './updateGuard';

export interface UpdateSource {
  subscribe: (l: (waiting: boolean) => void) => () => void;
  apply: () => Promise<void>;
}

/**
 * Applies a downloaded app update automatically — but only when the person
 * is idle (no practice in progress and not on the practice screen), so an
 * update never reloads mid-set.
 */
export function AutoUpdate({ source, hasActiveSession, routePath }: { source: UpdateSource | null; hasActiveSession: boolean; routePath: string }) {
  const [waiting, setWaiting] = useState(false);
  const [applying, setApplying] = useState(false);
  useEffect(() => (source ? source.subscribe(setWaiting) : undefined), [source]);
  useEffect(() => {
    if (!source || !waiting || applying) return;
    if (!canApplyUpdate({ hasActiveSession, routePath })) return;
    setApplying(true);
    void source.apply();
  }, [source, waiting, applying, hasActiveSession, routePath]);
  return null;
}
