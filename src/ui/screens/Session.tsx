import { useCallback, useEffect, useRef, useState } from 'react';
import { EXERCISES } from '../../content/exercises';
import { PROGRAM } from '../../content/program';
import { demonstrationsFor } from '../../content/videos';
import type { Answer, Effort, SessionFeeling, SymptomCode } from '../../domain/types';
import {
  finishSession,
  mayContinueSession,
  noteDemoOpened,
  startSession,
  stopSession,
  updateActiveSession,
} from '../../data/actions';
import { programAccess, todayOptions } from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { BILINGUAL } from '../../i18n/strings';
import { finishWarmup, isFullDose, nextPendingSet, recordSet, skipExercise, startRestTimer, undoLastSet } from '../../program/session';
import { holdForStopChoice } from '../../safety/holds';
import { speak, speechSupported } from '../../lib/speech';
import { useWakeLock } from '../../lib/wakeLock';
import { Button, ChoiceGroup, HelpNumbers, LinkButton, Page, ReasonList, StatusLabel } from '../components/ui';
import { formatDose } from '../components/ProgramViews';
import { VideoDemo } from '../components/VideoDemo';
import { SpeakerIcon } from '../components/Icons';
import { navigate } from '../router';
import { BlockedPractice } from './SafetyViews';
import type { CheckInDecision } from '../../safety/checkIn';

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

/**
 * Every workout entry point lands here: the start buttons, a typed URL, or a
 * resumed session after refresh/backgrounding. The gate is re-checked each time.
 */
export function SessionScreen({ mode }: { mode: 'full' | 'tiny' | null }) {
  const { data, today, makeCtx } = useStore();
  const { t } = useI18n();
  const [held, setHeld] = useState<CheckInDecision | null>(null);
  const [finished, setFinished] = useState<'saved' | 'stopped' | null>(null);
  const [stopOutcome, setStopOutcome] = useState<SymptomCode | 'just_stop' | null>(null);

  if (stopOutcome) return <StopOutcome choice={stopOutcome} />;
  if (finished === 'saved') return <FinishedView />;
  if (held) return <HeldView decision={held} />;

  const access = programAccess(data, today);
  if (data.activeSession) {
    if (!mayContinueSession(data, makeCtx())) {
      return (
        <Page title={t.checkIn.notAvailable}>
          <BlockedPractice access={access} />
          <ResumeFinishOnly />
        </Page>
      );
    }
    return <SessionRunner onStopped={setStopOutcome} onFinished={() => setFinished('saved')} />;
  }

  if (!mode) return <RedirectHome />;

  const options = todayOptions(data, today);
  const allowed = mode === 'tiny' ? options.canStartTiny : options.canStartFull;
  if (!allowed) {
    return (
      <Page title={t.checkIn.notAvailable}>
        <BlockedPractice access={access} />
      </Page>
    );
  }
  return <CheckIn mode={mode} onHeld={setHeld} />;
}

function RedirectHome() {
  useEffect(() => navigate('/', { replace: true }), []);
  return null;
}

function ResumeFinishOnly() {
  const { apply } = useStore();
  const { t } = useI18n();
  return (
    <Button block onClick={() => void apply((d, c) => stopSession(d, 'just_stop', c).data)}>
      {t.today.finishHere}
    </Button>
  );
}

function CheckIn({ mode, onHeld }: { mode: 'full' | 'tiny'; onHeld: (d: CheckInDecision) => void }) {
  const { apply } = useStore();
  const { t } = useI18n();
  const [newOrWorse, setNewOrWorse] = useState<Answer | null>(null);
  const [emergency, setEmergency] = useState<Answer | null>(null);
  const [urgent, setUrgent] = useState<Answer | null>(null);
  const needsDetail = newOrWorse === 'yes' || newOrWorse === 'unsure';
  const ready = newOrWorse !== null && (!needsDetail || (emergency !== null && urgent !== null));

  const submit = () => {
    if (!ready || !newOrWorse) return;
    let outcome: ReturnType<typeof startSession> | null = null;
    void apply((d, c) => {
      outcome = startSession(d, mode, { newOrWorse, emergencySigns: needsDetail ? emergency : null, urgentSigns: needsDetail ? urgent : null }, c);
      return outcome.data;
    }).then(() => {
      const o = outcome as ReturnType<typeof startSession> | null;
      if (o && o.kind === 'held') onHeld(o.decision);
    });
  };

  return (
    <Page title={t.checkIn.title}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <ChoiceGroup<Answer>
          legend={t.checkIn.q}
          name="checkin"
          value={newOrWorse}
          onChange={setNewOrWorse}
          choices={[
            { value: 'no', label: t.checkIn.no },
            { value: 'yes', label: t.checkIn.yes },
            { value: 'unsure', label: t.checkIn.unsure },
          ]}
        />
        {needsDetail ? (
          <>
            <ChoiceGroup<Answer>
              legend={t.questions.emergencySigns.q}
              hint={
                <ul className="symptom-list">
                  {t.questions.emergencySigns.items!.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              }
              name="checkin-emergency"
              value={emergency}
              onChange={setEmergency}
              choices={[
                { value: 'yes', label: t.answerYesAny },
                { value: 'no', label: t.answerNoneOfThese },
                { value: 'unsure', label: t.answers.unsure },
              ]}
            />
            <ChoiceGroup<Answer>
              legend={t.questions.urgentSigns.q}
              hint={
                <ul className="symptom-list">
                  {t.questions.urgentSigns.items!.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              }
              name="checkin-urgent"
              value={urgent}
              onChange={setUrgent}
              choices={[
                { value: 'yes', label: t.answerYesAny },
                { value: 'no', label: t.answerNoneOfThese },
                { value: 'unsure', label: t.answers.unsure },
              ]}
            />
          </>
        ) : null}
        {newOrWorse === 'no' ? <p className="card card--muted">{t.checkIn.setupReminder}</p> : null}
        <Button type="submit" variant="primary" large block disabled={!ready}>
          {t.checkIn.start}
        </Button>
        <LinkButton to="/" variant="quiet" block>
          {t.cancel}
        </LinkButton>
      </form>
    </Page>
  );
}

function HeldView({ decision }: { decision: CheckInDecision }) {
  const { t } = useI18n();
  const serious = decision.state === 'emergency_stop' || decision.state === 'urgent_assessment';
  return (
    <Page title={decision.state === 'emergency_stop' ? t.emergency.heading : t.checkIn.heldTitle}>
      <div className={`card ${serious ? 'card--safety' : 'card--info'} stack-sm`} data-testid="held-view">
        {decision.state === 'emergency_stop' ? (
          <p lang="zh-Hans" style={{ fontWeight: 600, fontSize: '1.3rem' }}>
            {BILINGUAL.emergencyZh}
          </p>
        ) : (
          <p>{t.checkIn.heldBody}</p>
        )}
        <ReasonList reasons={decision.reasons} />
      </div>
      <HelpNumbers />
      <LinkButton to="/" block>
        {t.checkIn.goToday}
      </LinkButton>
    </Page>
  );
}

function StopBar({ onStop }: { onStop: () => void }) {
  return (
    <div className="stop-bar">
      <button type="button" className="btn btn--safety btn--block btn--col" onClick={onStop} data-testid="stop-button">
        <span lang="zh-Hans">停止 / Stop</span>
        <span className="btn-sub">{BILINGUAL.stopSub}</span>
      </button>
    </div>
  );
}

function SessionRunner({ onStopped, onFinished }: { onStopped: (c: SymptomCode | 'just_stop') => void; onFinished: () => void }) {
  const { data } = useStore();
  const [stopOpen, setStopOpen] = useState(false);
  useWakeLock(true);
  const active = data.activeSession;
  useEffect(() => {
    document.body.classList.add('in-session');
    return () => document.body.classList.remove('in-session');
  }, []);
  if (!active) return null;
  return (
    <>
      {stopOpen ? (
        <StopFlow onCancel={() => setStopOpen(false)} onStopped={onStopped} />
      ) : active.phase === 'warmup' ? (
        <WarmupStep />
      ) : active.phase === 'finish' ? (
        <FinishStep onFinished={onFinished} onSymptoms={() => setStopOpen(true)} />
      ) : (
        <ExerciseStep />
      )}
      {!stopOpen ? <StopBar onStop={() => setStopOpen(true)} /> : null}
    </>
  );
}

function WarmupStep() {
  const { apply } = useStore();
  const { t } = useI18n();
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const now = useNow(1000, timerStart !== null);
  const total = PROGRAM.warmupWalkSeconds;
  const remaining = timerStart ? Math.max(0, total - (now - timerStart) / 1000) : null;
  return (
    <Page title={t.session.warmupTitle}>
      <p>{t.session.warmupBody}</p>
      <p className="card card--muted">{t.session.warmupNote}</p>
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
      <p className="muted">{t.tone.small}</p>
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
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const restStartedAtMs = active.lastSetRecordedAt ? Date.parse(active.lastSetRecordedAt) : null;
  const timerStartedAtMs = active.restTimerStartedAt ? Date.parse(active.restTimerStartedAt) : null;
  const now = useNow(1000, resting);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const onUnavailable = useCallback((u: boolean) => setVideoUnavailable(u), []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [pending?.exerciseIndex]);

  if (!pending) return null;
  const item = active.prescription.items[pending.exerciseIndex]!;
  const performed = active.performed[pending.exerciseIndex]!;
  const set = performed.sets[pending.setIndex]!;
  const ex = EXERCISES[item.exerciseId];
  const progress = data.exerciseProgress[item.exerciseId];
  const learned = !!progress?.learnedAt;
  const demos = demonstrationsFor(item.exerciseId);
  const goal = data.profile.goal;
  const goalLink = goal && goal !== 'own' ? ex.goalLinks[goal] : null;

  // What kind of rest is this? Between movements, between sets, or a side change.
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

  const totalSets = item.sets;
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
          {t.session.setOf(set.setNumber, totalSets)}
          {set.side ? ` · ${set.side === 'left' ? t.session.left : t.session.right}` : ''}
        </p>
      </div>

      {!learned && videoUnavailable ? (
        <div className="card card--info stack-sm" role="status">
          <p>{t.session.notLearnedUnavailable}</p>
          <Button onClick={() => setConfirmSkip(true)}>{t.session.skip}</Button>
        </div>
      ) : null}

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
        {goalLink ? (
          <p>
            <strong>{t.session.whyGoal}:</strong> {L(goalLink)}
          </p>
        ) : null}
      </section>

      {demos.map((entry, i) => (
        <VideoDemo
          key={entry.variantId}
          entry={entry}
          onUnavailable={i === 0 ? onUnavailable : undefined}
          onOpened={() => void apply((d, c) => noteDemoOpened(d, item.exerciseId, c))}
        />
      ))}
    </div>
  );
}

function FinishStep({ onFinished, onSymptoms }: { onFinished: () => void; onSymptoms: () => void }) {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const active = data.activeSession!;
  const [feeling, setFeeling] = useState<SessionFeeling | null>(null);
  const [controlled, setControlled] = useState<Answer | null>(null);
  const [more, setMore] = useState<Answer | null>(null);
  const [effort, setEffort] = useState<Effort | null>(null);
  const [note, setNote] = useState('');
  const full = isFullDose(active.performed, active.prescription);
  const ready = feeling !== null && (feeling === 'new_or_worse' || (controlled !== null && more !== null));

  return (
    <Page title={t.finish.title}>
      {!full ? <p className="card card--muted">{t.finish.partialNote}</p> : null}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready || !feeling) return;
          if (feeling === 'new_or_worse') {
            onSymptoms();
            return;
          }
          void apply((d, c) => finishSession(d, { feeling, controlledMovement: controlled, couldDoMore: more, effort, note: note || null }, c)).then(onFinished);
        }}
      >
        <ChoiceGroup<SessionFeeling>
          legend={t.finish.feelQ}
          name="feeling"
          value={feeling}
          onChange={setFeeling}
          choices={[
            { value: 'comfortable', label: t.finish.comfortable },
            { value: 'tired_ok', label: t.finish.tiredOk },
            { value: 'too_much', label: t.finish.tooMuch },
            { value: 'new_or_worse', label: t.finish.newOrWorse },
          ]}
        />
        {feeling === 'too_much' ? <p className="card card--muted">{t.finish.tooMuchNote}</p> : null}
        {feeling && feeling !== 'new_or_worse' ? (
          <>
            <ChoiceGroup<Answer>
              legend={t.finish.controlledQ}
              name="controlled"
              value={controlled}
              onChange={setControlled}
              choices={[
                { value: 'yes', label: t.answers.yes },
                { value: 'no', label: t.answers.no },
                { value: 'unsure', label: t.answers.unsure },
              ]}
            />
            <ChoiceGroup<Answer>
              legend={t.finish.couldDoMoreQ}
              name="could-do-more"
              value={more}
              onChange={setMore}
              choices={[
                { value: 'yes', label: t.answers.yes },
                { value: 'no', label: t.answers.no },
                { value: 'unsure', label: t.answers.unsure },
              ]}
            />
            <ChoiceGroup<Effort>
              legend={t.finish.effortQ}
              name="effort"
              value={effort}
              onChange={setEffort}
              choices={[
                { value: 'easy', label: t.finish.effort.easy },
                { value: 'moderate', label: t.finish.effort.moderate },
                { value: 'hard', label: t.finish.effort.hard },
              ]}
            />
            <div className="field">
              <label htmlFor="session-note">{t.finish.noteQ}</label>
              <textarea id="session-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </>
        ) : null}
        <p className="card card--info">{t.finish.nextDayExplain}</p>
        <Button type="submit" variant="primary" large block disabled={!ready}>
          {feeling === 'new_or_worse' ? t.continue : t.finish.save}
        </Button>
      </form>
    </Page>
  );
}

function FinishedView() {
  const { t } = useI18n();
  return (
    <Page title={t.finish.savedTitle}>
      <p>{t.tone.back}</p>
      <p className="card card--info">{t.finish.nextDayExplain}</p>
      <LinkButton to="/" variant="primary" large block>
        {t.finish.backToday}
      </LinkButton>
    </Page>
  );
}

function StopFlow({ onCancel, onStopped }: { onCancel: () => void; onStopped: (c: SymptomCode | 'just_stop') => void }) {
  const { apply } = useStore();
  const { t } = useI18n();
  const [choice, setChoice] = useState<SymptomCode | 'just_stop' | null>(null);
  const options: Array<SymptomCode | 'just_stop'> = ['chest_faint_breathing', 'numb_weak_spreading', 'back_pain_worse_sharp', 'dizzy_unwell', 'other', 'unsure', 'just_stop'];
  return (
    <Page title={t.stopFlow.title}>
      <p className="card card--safety">{t.stopFlow.body}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!choice) return;
          void apply((d, c) => stopSession(d, choice, c).data).then(() => onStopped(choice));
        }}
      >
        <ChoiceGroup<SymptomCode | 'just_stop'>
          legend={t.stopFlow.q}
          name="stop-reason"
          value={choice}
          onChange={setChoice}
          choices={options.map((o) => ({ value: o, label: t.stopFlow.options[o] }))}
        />
        <Button type="submit" variant="safety" large block disabled={!choice}>
          {t.continue}
        </Button>
        <Button variant="quiet" block onClick={onCancel}>
          {t.back}
        </Button>
      </form>
      <HelpNumbers compact />
    </Page>
  );
}

function StopOutcome({ choice }: { choice: SymptomCode | 'just_stop' }) {
  const { t } = useI18n();
  const hold = holdForStopChoice(choice);
  return (
    <Page title={hold?.state === 'emergency_stop' ? t.emergency.heading : t.stopFlow.title}>
      {hold?.state === 'emergency_stop' ? (
        <div className="card card--safety stack-sm" data-testid="stop-emergency">
          <p lang="zh-Hans" style={{ fontWeight: 600, fontSize: '1.3rem' }}>
            {BILINGUAL.emergencyZh}
          </p>
          <p lang="en">{t.emergency.english}</p>
        </div>
      ) : null}
      {hold && hold.state !== 'emergency_stop' ? (
        <div className="card card--info stack-sm">
          <StatusLabel kind="pause">{t.stopFlow.advice}</StatusLabel>
          {choice === 'dizzy_unwell' ? <p>{t.stopFlow.dizzy}</p> : null}
          {choice === 'unsure' ? <p>{t.stopFlow.unsure}</p> : null}
        </div>
      ) : null}
      {!hold ? <p className="card card--accent">{t.stopFlow.justStop}</p> : <p>{t.stopFlow.saved}</p>}
      {hold ? <HelpNumbers /> : null}
      <LinkButton to="/" block>
        {t.finish.backToday}
      </LinkButton>
    </Page>
  );
}
