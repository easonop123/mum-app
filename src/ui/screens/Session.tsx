import { useEffect, useRef, useState } from 'react';
import { EXERCISES } from '../../content/exercises';
import { PROGRAM } from '../../content/program';
import { demonstrationsFor } from '../../content/videos';
import { finishSession, startSession, stopSession, updateActiveSession, type StartResult } from '../../data/actions';
import { todayOptions } from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { BILINGUAL } from '../../i18n/strings';
import { finishWarmup, isFullDose, nextPendingSet, recordSet, repsDone, skipExercise, startRestTimer, undoLastSet } from '../../program/session';
import { speak, speechSupported } from '../../lib/speech';
import { useWakeLock } from '../../lib/wakeLock';
import { Button, HelpNumbers, LinkButton, Page } from '../components/ui';
import { formatDose } from '../components/ProgramViews';
import { VideoDemo } from '../components/VideoDemo';
import { SpeakerIcon } from '../components/Icons';
import { navigate } from '../router';

function useNow(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, active]);
  return now;
}

function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type Ending = { kind: 'finished'; reps: number; full: boolean } | { kind: 'stopped' };

/** Start buttons, typed URLs and resumed practices all land here. */
export function SessionScreen({ mode }: { mode: 'full' | 'tiny' | null }) {
  const { data, today, apply } = useStore();
  const { t } = useI18n();
  const [ending, setEnding] = useState<Ending | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (ending || data.activeSession || startedRef.current) return;
    if (!mode) {
      navigate('/', { replace: true });
      return;
    }
    startedRef.current = true;
    let result: StartResult | null = null;
    void apply((d, c) => {
      result = startSession(d, mode, c);
      return result.data;
    }).then(() => {
      const r = result as StartResult | null;
      if (r && r.kind === 'blocked') setBlocked(r.reason);
    });
  }, [ending, data.activeSession, mode, apply]);

  if (ending) return <EndedView ending={ending} />;
  if (blocked) return <NotToday dayKind={todayOptions(data, today).day.kind} />;
  if (!data.activeSession) {
    return (
      <p className="banner" role="status">
        {t.continue}…
      </p>
    );
  }
  return <SessionRunner onEnded={setEnding} />;
}

function NotToday({ dayKind }: { dayKind: string }) {
  const { t } = useI18n();
  const text =
    dayKind === 'rest_after_yesterday'
      ? t.today.restAfterYesterday
      : dayKind === 'weekly_amount_done'
        ? t.today.weeklyDone
        : dayKind === 'practised_today'
          ? t.today.practisedToday
          : t.today.restAck;
  return (
    <Page title={t.nav.today}>
      <p className="card card--muted" data-testid="not-today">
        {text}
      </p>
      <LinkButton to="/" variant="primary" block>
        {t.finish.backToday}
      </LinkButton>
    </Page>
  );
}

function SessionRunner({ onEnded }: { onEnded: (e: Ending) => void }) {
  const { data, apply } = useStore();
  const [confirmStop, setConfirmStop] = useState(false);
  useWakeLock(true);
  const active = data.activeSession;

  // Save automatically as soon as the last set is recorded or skipped.
  useEffect(() => {
    if (active?.phase !== 'finish') return;
    onEnded({ kind: 'finished', reps: repsDone(active.performed), full: isFullDose(active.performed, active.prescription) });
    void apply((d, c) => (d.activeSession ? finishSession(d, c) : d));
  }, [active, apply, onEnded]);

  if (!active || active.phase === 'finish') return null;
  return (
    <>
      {confirmStop ? (
        <StopConfirm
          onKeepGoing={() => setConfirmStop(false)}
          onStop={() => {
            onEnded({ kind: 'stopped' });
            void apply((d, c) => (d.activeSession ? stopSession(d, c) : d));
          }}
        />
      ) : active.phase === 'warmup' ? (
        <WarmupStep />
      ) : (
        <ExerciseStep />
      )}
      {!confirmStop ? <StopBar onStop={() => setConfirmStop(true)} /> : null}
    </>
  );
}

function StopBar({ onStop }: { onStop: () => void }) {
  return (
    <div className="stop-bar">
      <button type="button" className="btn btn--safety btn--block btn--col" onClick={onStop} data-testid="stop-button">
        <span lang="zh-Hans">{BILINGUAL.stop}</span>
        <span className="btn-sub">{BILINGUAL.stopSub}</span>
      </button>
    </div>
  );
}

function StopConfirm({ onStop, onKeepGoing }: { onStop: () => void; onKeepGoing: () => void }) {
  const { t } = useI18n();
  return (
    <Page title={t.session.stopTitle}>
      <p>{t.session.stopBody}</p>
      <Button variant="safety" large block onClick={onStop}>
        {t.session.stopYes}
      </Button>
      <Button block onClick={onKeepGoing}>
        {t.session.keepGoing}
      </Button>
    </Page>
  );
}

function EndedView({ ending }: { ending: Ending }) {
  const { t } = useI18n();
  if (ending.kind === 'stopped') {
    return (
      <Page title={t.session.stoppedTitle}>
        <p className="card card--accent" data-testid="stopped-view">
          {t.session.stoppedBody}
        </p>
        <p>{t.session.stoppedHelp}</p>
        <HelpNumbers compact />
        <LinkButton to="/" variant="primary" block>
          {t.finish.backToday}
        </LinkButton>
      </Page>
    );
  }
  return (
    <Page title={t.finish.title}>
      <div className="card card--accent stack-sm" data-testid="finished-view">
        <p>{ending.full ? t.finish.full : t.finish.partial}</p>
        <p>{t.finish.reps(ending.reps)}</p>
      </div>
      <p>{t.tone.back}</p>
      <LinkButton to="/" variant="primary" large block>
        {t.finish.backToday}
      </LinkButton>
    </Page>
  );
}

function WarmupStep() {
  const { apply } = useStore();
  const { t } = useI18n();
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const now = useNow(1000, timerStart !== null);
  const remaining = timerStart ? Math.max(0, PROGRAM.warmupWalkSeconds - (now - timerStart) / 1000) : null;
  return (
    <Page title={t.session.warmupTitle}>
      <section className="card card--muted stack-sm">
        <h2 style={{ marginTop: 0 }}>{t.session.tipsTitle}</h2>
        <ul>
          {t.session.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
      <p>{t.session.warmupBody}</p>
      {remaining !== null ? (
        <p className="timer" role="timer" aria-live="off">
          {mmss(remaining)}
        </p>
      ) : (
        <Button onClick={() => setTimerStart(Date.now())}>{t.session.warmupTimer}</Button>
      )}
      <Button variant="primary" large block onClick={() => void apply((d, c) => updateActiveSession(d, (a) => finishWarmup(a, 'done', c.now), c))}>
        {t.session.warmupDone}
      </Button>
      <Button variant="quiet" block onClick={() => void apply((d, c) => updateActiveSession(d, (a) => finishWarmup(a, 'skipped', c.now), c))}>
        {t.session.warmupSkip}
      </Button>
    </Page>
  );
}

function ExerciseStep() {
  const { data, apply } = useStore();
  const { t, L, lang } = useI18n();
  const active = data.activeSession!;
  const pending = nextPendingSet(active);
  const [choosing, setChoosing] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [resting, setResting] = useState(() => active.lastSetRecordedAt !== null);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const restStartedAtMs = active.lastSetRecordedAt ? Date.parse(active.lastSetRecordedAt) : null;
  const timerStartedAtMs = active.restTimerStartedAt ? Date.parse(active.restTimerStartedAt) : null;
  const now = useNow(1000, resting);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [pending?.exerciseIndex]);

  if (!pending) return null;
  const item = active.prescription.items[pending.exerciseIndex]!;
  const performed = active.performed[pending.exerciseIndex]!;
  const set = performed.sets[pending.setIndex]!;
  const ex = EXERCISES[item.exerciseId];
  const demos = demonstrationsFor(item.exerciseId);

  // Rest between movements, between sets, or a side change.
  const prevSetSameExercise = pending.setIndex > 0;
  const sideChange = prevSetSameExercise && set.side === 'right' && performed.sets[pending.setIndex - 1]?.side === 'left';
  const betweenMovements = !prevSetSameExercise;
  const minRest = active.mode === 'tiny' && betweenMovements && active.prescription.minimumRestSeconds ? active.prescription.minimumRestSeconds : 0;
  // Timestamps (not counters) so backgrounding or locking the phone never skews rest.
  const elapsed = restStartedAtMs ? Math.max(0, (Math.max(now, Date.now()) - restStartedAtMs) / 1000) : Number.POSITIVE_INFINITY;
  const waitLeft = minRest > 0 ? Math.ceil(minRest - elapsed) : 0;
  const timerSeconds = sideChange ? 30 : active.prescription.restSeconds;
  const timerLeft = timerStartedAtMs ? timerSeconds - (now - timerStartedAtMs) / 1000 : null;

  const record = (reps: number) => {
    setChoosing(false);
    void apply((d, c) => updateActiveSession(d, (a) => recordSet(a, pending.exerciseIndex, pending.setIndex, reps, c.now), c)).then(() => setResting(true));
  };

  const voice = data.profile.voice;
  const readAloud = async () => {
    const kind = voice === 'english' ? 'english' : 'mandarin';
    const cues = kind === 'english' ? ex.cues.en : ex.cues.zh;
    const name = kind === 'english' ? ex.name.en : ex.name.zh;
    const result = await speak(`${name}. ${cues.join(' ')}`, kind);
    setVoiceMsg(result === 'ok' ? null : result === 'no_voice' ? t.settings.voiceMissingZh : t.settings.voiceUnsupported);
  };

  if (resting && active.lastSetRecordedAt) {
    return (
      <Page title={sideChange ? t.session.sideChange : t.session.rest}>
        <p className="muted">{t.session.movementOf(pending.exerciseIndex + 1, active.prescription.items.length)}</p>
        {betweenMovements ? <p className="set-line">{t.session.nextUp(L(ex.name))}</p> : null}
        {sideChange ? null : <p>{t.tone.start}</p>}
        {minRest > 0 ? <p className="card card--info">{t.session.tinyRestMin}</p> : null}
        {restStartedAtMs && elapsed < 600 ? (
          <p className="timer" role="timer" aria-live="off">
            {t.session.restElapsed(mmss(elapsed))}
          </p>
        ) : null}
        {timerLeft !== null ? (
          <p role="status">{timerLeft <= 0 ? t.session.restTimerDone(timerSeconds) : mmss(timerLeft)}</p>
        ) : (
          <Button onClick={() => void apply((d, c) => updateActiveSession(d, (a) => startRestTimer(a, c.now), c))}>{t.session.restTimer(timerSeconds)}</Button>
        )}
        <Button variant="primary" large block disabled={waitLeft > 0} onClick={() => setResting(false)}>
          {waitLeft > 0 ? t.session.readyIn(waitLeft) : t.session.ready}
        </Button>
        <Button variant="link" onClick={() => void apply((d, c) => updateActiveSession(d, (a) => undoLastSet(a, c.now), c)).then(() => setResting(false))}>
          {t.session.undo}
        </Button>
      </Page>
    );
  }

  return (
    <div className="stack">
      <p className="muted">{t.session.movementOf(pending.exerciseIndex + 1, active.prescription.items.length)}</p>
      <div>
        <h1 className="exercise-name" ref={headingRef} tabIndex={-1}>
          {L(ex.name)}
        </h1>
        <p className="dose">{formatDose(item, lang)}</p>
        <p className="set-line" aria-live="polite">
          {t.session.setOf(set.setNumber, item.sets)}
          {set.side ? ` · ${set.side === 'left' ? t.session.left : t.session.right}` : ''}
        </p>
      </div>

      <ol className="cue-list">
        {ex.cues[lang].map((cue) => (
          <li key={cue}>{cue}</li>
        ))}
      </ol>
      <p className="muted">{t.session.pace}</p>
      {voice !== 'off' && speechSupported() ? (
        <Button variant="quiet" onClick={() => void readAloud()}>
          <SpeakerIcon size={22} />
          <span>{t.session.readAloud}</span>
        </Button>
      ) : null}
      {voiceMsg ? <p role="status">{voiceMsg}</p> : null}

      {choosing ? (
        <fieldset className="choice-group card">
          <legend>{t.session.howMany}</legend>
          <div className="count-grid">
            {Array.from({ length: set.targetReps }, (_, n) => n).map((n) => (
              <button key={n} type="button" className="btn" onClick={() => record(n)}>
                {n}
              </button>
            ))}
          </div>
          <Button variant="link" onClick={() => setChoosing(false)}>
            {t.cancel}
          </Button>
        </fieldset>
      ) : confirmSkip ? (
        <div className="card stack-sm">
          <p>{t.session.skipConfirm}</p>
          <Button
            variant="primary"
            block
            onClick={() => {
              setConfirmSkip(false);
              void apply((d, c) => updateActiveSession(d, (a) => skipExercise(a, pending.exerciseIndex, c.now), c));
            }}
          >
            {t.session.skipYes}
          </Button>
          <Button variant="quiet" block onClick={() => setConfirmSkip(false)}>
            {t.cancel}
          </Button>
        </div>
      ) : (
        <div className="stack-sm">
          <Button variant="primary" large block onClick={() => record(set.targetReps)}>
            {t.session.doneN(set.targetReps)}
          </Button>
          <Button block onClick={() => setChoosing(true)}>
            {t.session.fewer}
          </Button>
          <Button variant="quiet" block onClick={() => setConfirmSkip(true)}>
            {t.session.skip}
          </Button>
        </div>
      )}

      <section className="stack-sm">
        <h2>{t.session.benefit}</h2>
        <p>{L(ex.benefit)}</p>
        <p className="muted">{L(ex.ifNotSuitable)}</p>
      </section>

      {demos.map((entry) => (
        <VideoDemo key={entry.variantId} entry={entry} />
      ))}
    </div>
  );
}
