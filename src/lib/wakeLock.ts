import { useEffect, useState } from 'react';

export type WakeLockStatus = 'idle' | 'active' | 'unsupported' | 'unavailable';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
}

/**
 * Keeps the screen on during a practice where the Screen Wake Lock API is
 * available. Rejection or release (e.g. switching apps) is handled quietly;
 * no hidden looping video is used to fake it.
 */
export function useWakeLock(active: boolean): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>('idle');
  useEffect(() => {
    if (!active) return;
    const api = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!api) {
      setStatus('unsupported');
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        sentinel = await api.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        setStatus('active');
        sentinel.addEventListener('release', () => {
          if (!cancelled) setStatus('idle');
        });
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
    };
  }, [active]);
  return status;
}
