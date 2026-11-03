import { useEffect, useState } from 'react';
import { availableOffline, embedUrlFor, formatDuration, needsDoseNote, type VideoManifestEntry } from '../../content/videos';
import { useI18n } from '../../i18n/I18n';
import { BILINGUAL } from '../../i18n/strings';
import { ExternalIcon, PlayIcon } from './Icons';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const SLOW_MS = 12_000;

/**
 * Click-to-load demonstration. Nothing loads from YouTube until the person
 * taps. Playback is never used to record repetitions or set the pace, and the
 * component never claims the embed works: an external link and the written
 * steps are always available.
 */
export function VideoDemo({
  entry,
  onOpened,
  onUnavailable,
}: {
  entry: VideoManifestEntry;
  onOpened?: () => void;
  /** Reports when the person can't see this demonstration (offline or it didn't play). */
  onUnavailable?: (unavailable: boolean) => void;
}) {
  const { t, L } = useI18n();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [instance, setInstance] = useState(0);
  const [watchedOnce, setWatchedOnce] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);

  const local = entry.platform === 'local';
  const offlineOk = availableOffline(entry);
  const reachable = online || offlineOk;

  useEffect(() => {
    onUnavailable?.(!reachable || failed);
  }, [reachable, failed, onUnavailable]);

  useEffect(() => {
    if (!open || loaded) return;
    setSlow(false);
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, [open, loaded, instance]);

  const start = () => {
    setFailed(false);
    setLoaded(false);
    setOpen(true);
    setInstance((n) => n + 1);
    setWatchedOnce(true);
    onOpened?.();
  };

  const label = L(entry.label);
  const isCandidate = entry.role === 'chinese-candidate';

  return (
    <section className="video stack-sm" aria-label={label}>
      <p className="status-label">
        <PlayIcon size={24} />
        <span>{label}</span>
      </p>
      {isCandidate ? <p className="badge badge--draft">{t.video.chineseCandidate}</p> : null}
      <p className="muted">{local ? `${entry.publisher} · ${formatDuration(entry.durationSeconds)}` : t.video.source(entry.publisher, formatDuration(entry.durationSeconds))}</p>
      {needsDoseNote(entry) ? (
        <div className="dose-note" data-testid="dose-note">
          <p lang="zh-Hans">{BILINGUAL.doseNoteZh}</p>
          <p lang="en">{t.video.doseNoteEn}</p>
        </div>
      ) : null}
      <p className="muted">{L(entry.qualification)}</p>

      {open && reachable && !failed && local ? (
        <div className="stack-sm">
          <div className="video__frame">
            {/* Owned/licensed clip: plays only when the person presses play; never autoplays or loops. */}
            <video key={instance} src={entry.localSrc} controls playsInline preload="metadata" title={t.video.frameTitle(label)} onError={() => setFailed(true)}>
              {entry.captionsSrc ? <track kind="captions" src={entry.captionsSrc} srcLang="zh-Hans" label="中文" default /> : null}
            </video>
          </div>
          <div className="row">
            <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>
              {t.video.close}
            </button>
          </div>
        </div>
      ) : null}

      {open && online && !failed && !local ? (
        <div className="stack-sm">
          <div className="video__frame">
            <iframe
              key={instance}
              src={embedUrlFor(entry)}
              title={t.video.frameTitle(label)}
              loading="lazy"
              allow="encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              onLoad={() => setLoaded(true)}
            />
          </div>
          {slow && !loaded ? <p role="status">{t.video.slow}</p> : null}
          <div className="row">
            <button type="button" className="btn btn--quiet" onClick={() => setFailed(true)}>
              {t.video.notWorking}
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>
              {t.video.close}
            </button>
          </div>
        </div>
      ) : null}

      {!reachable ? (
        <p role="status" className="card card--info">
          {t.video.offline}
        </p>
      ) : null}
      {failed ? (
        <p role="status" className="card card--info">
          {t.video.failed}
        </p>
      ) : null}

      <div className="stack-sm">
        <button type="button" className="btn btn--primary btn--large btn--block" onClick={start} disabled={!reachable} aria-disabled={!reachable}>
          <PlayIcon size={26} />
          <span>{watchedOnce ? t.video.watchAgain : t.video.watch}</span>
        </button>
        {!local ? (
          <a className="btn btn--block" href={entry.watchUrl} target="_blank" rel="noopener noreferrer">
            <ExternalIcon size={22} />
            <span>{t.video.open}</span>
          </a>
        ) : null}
      </div>
      <p className="muted">
        {offlineOk ? t.video.savedOffline : `${t.video.needsInternet} ${t.video.notCached}`}
      </p>
    </section>
  );
}
