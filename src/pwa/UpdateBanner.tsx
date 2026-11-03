import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18n';
import { canApplyUpdate } from './updateGuard';

export interface UpdateSource {
  subscribe: (l: (waiting: boolean) => void) => () => void;
  apply: () => Promise<void>;
}

export function UpdateBanner({ source, hasActiveSession, routePath }: { source: UpdateSource | null; hasActiveSession: boolean; routePath: string }) {
  const { t } = useI18n();
  const [waiting, setWaiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => (source ? source.subscribe(setWaiting) : undefined), [source]);
  if (!source || !waiting || dismissed || !canApplyUpdate({ hasActiveSession, routePath })) return null;
  return (
    <div className="banner no-print" role="status" data-testid="update-banner">
      <div className="card card--info row">
        <span style={{ flex: '1 1 12rem' }}>{t.updateReady}</span>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            if (canApplyUpdate({ hasActiveSession, routePath })) void source.apply();
          }}
        >
          {t.updateNow}
        </button>
        <button type="button" className="btn btn--quiet" onClick={() => setDismissed(true)}>
          {t.updateLater}
        </button>
      </div>
    </div>
  );
}
