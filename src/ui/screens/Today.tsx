import { useEffect, useState } from 'react';
import type { NextDayResponse } from '../../domain/types';
import { answerNextDayCheck, ensureReturnMode, goToAdvisedMaxStage, keepCurrentAmount, acceptStageOffer, stopSession } from '../../data/actions';
import type { AppData } from '../../data/schema';
import {
  dueNextDayChecks,
  programAccess,
  returnSuggestionFor,
  sessionById,
  stageOfferFor,
  todayOptions,
  weekActivity,
} from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { formatLocalDate } from '../../lib/dates';
import { getFixedStagePrescription } from '../../program/prescription';
import type { StageOffer } from '../../program/progression';
import { nextScheduledDay } from '../../program/schedule';
import { EXERCISES } from '../../content/exercises';
import { Button, ChoiceGroup, LinkButton, Page, ReasonList, StatusLabel } from '../components/ui';
import { formatDose } from '../components/ProgramViews';
import { navigate } from '../router';
import { EmergencyView, UrgentView } from './SafetyViews';

export function needsOnboarding(data: AppData): boolean {
  const p = data.profile;
  return !p.optedIn || !p.languageConfirmed || !p.regionConfirmed || (data.readiness.answeredAt === null && !data.readiness.rescreenRequired);
}

export function TodayScreen() {
  const { data, today, apply } = useStore();
  const { t, L, lang } = useI18n();
  const access = programAccess(data, today);
  const onboarding = needsOnboarding(data);
  const [restChosen, setRestChosen] = useState(false);
  const [nextDayAnswer, setNextDayAnswer] = useState<NextDayResponse | null>(null);

  useEffect(() => {
    if (onboarding && access.state !== 'emergency_stop' && access.state !== 'urgent_assessment') {
      navigate('/onboarding', { replace: true });
    }
  }, [onboarding, access.state]);

  // After a long gap, start the gentle Stage 1 return (never catch-up work).
  const suggestion = returnSuggestionFor(data, today);
  useEffect(() => {
    if (suggestion.kind === 'long_gap' && !data.activeSession && access.canLearn) {
      void apply((d, c) => ensureReturnMode(d, c));
    }
  }, [suggestion.kind, data.activeSession, access.canLearn, apply]);

  if (access.state === 'emergency_stop') {
    return (
      <Page title={t.emergency.heading}>
        <EmergencyView access={access} />
      </Page>
    );
  }
  if (access.state === 'urgent_assessment') {
    return (
      <Page title={t.urgent.heading}>
        <UrgentView access={access} />
      </Page>
    );
  }
  if (onboarding) return null;

  const hour = new Date().getHours();
  const goal = data.profile.goal ? (data.profile.goal === 'own' ? data.profile.goalText : t.goals[data.profile.goal]) : null;
  const options = todayOptions(data, today);
  const week = weekActivity(data, today);
  const due = dueNextDayChecks(data, today);
  const offer = access.canStartFull || access.blockedBy === 'setup' ? stageOfferFor(data, today) : null;
  const nextDay = nextScheduledDay(data.schedule, today, false);
  const firstEver = data.sessions.length === 0;

  return (
    <Page title={t.greeting(hour, data.profile.displayName)}>
      {data.profile.encouragementNote ? (
        <p className="card card--accent pre-wrap">
          <span className="visually-hidden">{t.today.note}: </span>
          {data.profile.encouragementNote}
        </p>
      ) : null}
      {goal ? <p>{t.today.goal(goal)}</p> : null}
      {data.schedule.cue ? <p className="muted">{t.cueSentence(data.schedule.cue)}</p> : null}

      {data.readiness.rescreenRequired ? (
        <section className="card card--info stack-sm">
          <StatusLabel kind="info">{t.today.onboardingTitle}</StatusLabel>
          <ReasonList reasons={access.reasons} />
          <LinkButton to="/rescreen" variant="primary" block>
            {t.today.answerQuestions}
          </LinkButton>
        </section>
      ) : null}

      {data.activeSession ? <ResumeCard canContinue={data.activeSession.mode === 'tiny' ? access.canStartTiny : access.canStartFull} /> : null}

      {nextDayAnswer ? (
        <section className={`card ${nextDayAnswer === 'worse' ? 'card--safety' : 'card--muted'}`} role="status" data-testid="next-day-follow-up">
          <p>{nextDayAnswer === 'worse' ? t.nextDay.worseFollow : nextDayAnswer === 'unsure' ? t.nextDay.unsureFollow : t.nextDay.thanks}</p>
        </section>
      ) : null}
      {due[0] ? <NextDayCard key={due[0].sessionId} sessionId={due[0].sessionId} onAnswered={setNextDayAnswer} /> : null}

      {!access.canStartFull && !access.canStartTiny && access.blockedBy !== 'setup' && access.blockedBy !== 'onboarding' ? (
        <WaitingCard />
      ) : null}

      {access.blockedBy === 'setup' ? (
        <section className="card card--info stack-sm">
          <StatusLabel kind="info">{t.today.setupNeeded}</StatusLabel>
          <LinkButton to="/settings/setup" variant="primary" block>
            {t.today.doSetup}
          </LinkButton>
        </section>
      ) : null}

      {offer && (offer.kind === 'offer' || offer.kind === 'return_offer') ? <OfferCard offer={offer} /> : null}
      {offer && offer.kind === 'maintenance' ? (
        <section className="card card--muted stack-sm">
          <ReasonList reasons={offer.reasons} />
          <LinkButton to="/plan">{t.today.maintenance}</LinkButton>
        </section>
      ) : null}

      {(access.canStartFull || access.canStartTiny || access.blockedBy === 'setup') && !data.activeSession ? (
        <section className="stack-sm" aria-labelledby="practice-heading">
          <h2 id="practice-heading">{t.today.stageLine(data.stage)}</h2>
          {suggestion.kind === 'short_gap' ? <p>{t.today.shortGap(suggestion.stage)}</p> : null}
          {suggestion.kind === 'long_gap' || (suggestion.kind === 'return_in_progress' && suggestion.status === 'awaiting_return_session') ? (
            <p>{t.today.longGap(suggestion.targetStage)}</p>
          ) : null}
          {suggestion.kind === 'return_in_progress' && suggestion.status !== 'awaiting_return_session' ? <p>{t.today.returnWaiting}</p> : null}
          <DayMessage kind={options.day.kind} />
          {restChosen ? (
            <p className="card card--accent" role="status">
              {t.today.restAck}
            </p>
          ) : null}
          {options.canStartFull ? (
            <>
              <NextPracticePreview />
              <LinkButton to="/session/full" variant="primary" large block>
                {data.progression.returnMode ? t.today.returnSession : t.today.startFull}
              </LinkButton>
              <p className="muted">{t.today.startHint(firstEver)}</p>
            </>
          ) : null}
          {options.canStartTiny ? (
            <LinkButton to="/session/tiny" block>
              <span className="btn--col" style={{ display: 'flex' }}>
                <span>{t.today.smaller}</span>
                <span className="btn-sub">{t.today.smallerHint}</span>
              </span>
            </LinkButton>
          ) : null}
          {options.canStartFull || options.canStartTiny ? (
            <Button variant="quiet" block onClick={() => setRestChosen(true)}>
              {t.today.rest}
            </Button>
          ) : null}
          {options.canStartFull ? <p className="muted">{firstEver ? t.tone.start : t.tone.keep}</p> : null}
        </section>
      ) : null}

      {access.state === 'review_before_program' && access.blockedBy === 'routine_review' && data.professionalAdvice?.maxStage && data.stage > data.professionalAdvice.maxStage ? (
        <Button block onClick={() => void apply((d, c) => goToAdvisedMaxStage(d, c))}>
          {t.today.goMaxStage(data.professionalAdvice.maxStage)}
        </Button>
      ) : null}

      <section className="card card--muted stack-sm">
        <p style={{ fontWeight: 650, fontSize: '1.3rem' }}>{t.today.weekCount(week.practiceDays)}</p>
        {data.sessions.length > 0 && week.practiceDays === 0 ? <p>{t.tone.keep}</p> : null}
        {nextDay && (access.canStartFull || access.blockedBy === 'setup') ? <p>{t.today.nextDay(formatLocalDate(nextDay, lang))}</p> : null}
      </section>
      <p className="muted">{L({ en: 'Need help? Use the Help button at the top at any time.', zh: '需要帮助？随时点顶部的“帮助”按钮。' })}</p>
    </Page>
  );
}

function DayMessage({ kind }: { kind: string }) {
  const { t } = useI18n();
  const text =
    kind === 'scheduled_today'
      ? t.today.practiceDay
      : kind === 'moved_day_available'
        ? t.today.movedDay
        : kind === 'rest_after_yesterday'
          ? t.today.restAfterYesterday
          : kind === 'weekly_amount_done'
            ? t.today.weeklyDone
            : kind === 'practised_today'
              ? t.today.practisedToday
              : null;
  return text ? <p>{text}</p> : null;
}

function NextPracticePreview() {
  const { data, today } = useStore();
  const { L, lang } = useI18n();
  const suggestion = returnSuggestionFor(data, today);
  let items;
  try {
    const stage = suggestion.kind === 'short_gap' ? suggestion.stage : data.progression.returnMode || suggestion.kind === 'long_gap' ? 1 : data.stage;
    items = getFixedStagePrescription(data.programId, stage).items;
  } catch {
    return null;
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={item.exerciseId}>
          {L(EXERCISES[item.exerciseId].name)} — {formatDose(item, lang)}
        </li>
      ))}
    </ul>
  );
}

function WaitingCard() {
  const { data, today } = useStore();
  const { t } = useI18n();
  const access = programAccess(data, today);
  const title =
    access.blockedBy === 'hold'
      ? t.today.holdTitle
      : access.blockedBy === 'paused_for_review'
        ? t.today.pausedTitle
        : access.blockedBy === 'routine_review'
          ? t.today.routineTitle
          : t.today.waitingTitle;
  const body =
    access.blockedBy === 'hold' ? t.today.holdBody : access.blockedBy === 'paused_for_review' ? t.today.pausedBody : access.blockedBy === 'assessment_pending' ? t.today.waitingBody : null;
  return (
    <section className="stack-sm" data-testid="waiting-card">
      <div className="card card--info stack-sm">
        <StatusLabel kind="pause">{title}</StatusLabel>
        {body ? <p>{body}</p> : null}
        <details>
          <summary>{t.today.reasonsTitle}</summary>
          <ReasonList reasons={access.reasons} />
        </details>
      </div>
      <h2>{t.today.whatYouCanDo}</h2>
      <div className="stack-sm">
        {access.blockedBy === 'hold' || access.blockedBy === 'readiness' ? (
          <LinkButton to="/rescreen" variant="primary" block>
            {t.today.rescreen}
          </LinkButton>
        ) : null}
        <LinkButton to="/settings/summary" block>
          {t.today.summary}
        </LinkButton>
        <LinkButton to="/settings/advice" block>
          {t.today.recordAdvice}
        </LinkButton>
        <LinkButton to="/plan" block>
          {t.today.seePlan}
        </LinkButton>
        <LinkButton to="/learn" block>
          {t.today.learn}
        </LinkButton>
      </div>
      <p className="card card--muted">{t.today.everyday}</p>
    </section>
  );
}

function ResumeCard({ canContinue }: { canContinue: boolean }) {
  const { apply } = useStore();
  const { t } = useI18n();
  return (
    <section className="card card--accent stack-sm" data-testid="resume-card">
      <StatusLabel kind="info">{t.today.resumeTitle}</StatusLabel>
      <p>{t.today.resumeBody}</p>
      {canContinue ? (
        <LinkButton to="/session" variant="primary" block>
          {t.today.resume}
        </LinkButton>
      ) : null}
      <Button block onClick={() => void apply((d, c) => stopSession(d, 'just_stop', c).data)}>
        {t.today.finishHere}
      </Button>
    </section>
  );
}

function NextDayCard({ sessionId, onAnswered }: { sessionId: string; onAnswered: (r: NextDayResponse) => void }) {
  const { data, apply } = useStore();
  const { t, lang } = useI18n();
  const [choice, setChoice] = useState<NextDayResponse | null>(null);
  const session = sessionById(data, sessionId);
  if (!session) return null;
  return (
    <section className="card stack-sm" data-testid="next-day-card">
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!choice) return;
          onAnswered(choice);
          void apply((d, c) => answerNextDayCheck(d, sessionId, choice, c));
        }}
      >
        <ChoiceGroup<NextDayResponse>
          legend={t.nextDay.title(formatLocalDate(session.localDate, lang))}
          hint={t.nextDay.explain}
          name={`next-day-${sessionId}`}
          value={choice}
          onChange={setChoice}
          choices={[
            { value: 'usual', label: t.nextDay.usual },
            { value: 'mild_soreness', label: t.nextDay.mildSoreness },
            { value: 'worse', label: t.nextDay.worse },
            { value: 'unsure', label: t.nextDay.unsure },
            { value: 'cant_remember', label: t.nextDay.cantRemember },
          ]}
        />
        <Button type="submit" variant="primary" block disabled={!choice}>
          {t.save}
        </Button>
      </form>
    </section>
  );
}

function OfferCard({ offer }: { offer: Extract<StageOffer, { kind: 'offer' | 'return_offer' }> }) {
  const { apply } = useStore();
  const { t, L, lang } = useI18n();
  const [result, setResult] = useState<string | null>(null);
  if (result) {
    return (
      <p className="card card--accent" role="status">
        {result}
      </p>
    );
  }
  const from = getFixedStagePrescription('mum-home-foundation-v2', offer.fromStage).items;
  const to = getFixedStagePrescription('mum-home-foundation-v2', offer.toStage).items;
  const changes = to.filter((item, i) => item.sets !== from[i]!.sets || item.reps !== from[i]!.reps);
  return (
    <section className="card card--accent stack-sm" data-testid="offer-card">
      <h2>{offer.kind === 'return_offer' ? t.offer.returnTitle(offer.toStage) : t.offer.title}</h2>
      <ReasonList reasons={offer.reasons} />
      <h3>{t.offer.changes}</h3>
      <ul>
        {changes.map((item) => (
          <li key={item.exerciseId}>
            {L(EXERCISES[item.exerciseId].name)}: {formatDose(from.find((f) => f.exerciseId === item.exerciseId)!, lang)} → {formatDose(item, lang)}
          </li>
        ))}
      </ul>
      <Button
        variant="primary"
        large
        block
        onClick={() => {
          void apply((d, c) => keepCurrentAmount(d, offer, c));
          setResult(t.offer.kept);
        }}
      >
        {t.offer.keep}
      </Button>
      <Button
        block
        onClick={() => {
          void apply((d, c) => acceptStageOffer(d, offer, c));
          setResult(t.offer.accepted(offer.toStage));
        }}
      >
        {t.offer.accept(offer.toStage)}
      </Button>
    </section>
  );
}
