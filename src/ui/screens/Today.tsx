import { useEffect, useState } from 'react';
import { EXERCISES } from '../../content/exercises';
import { PROGRAM } from '../../content/program';
import { acceptStageOffer, keepCurrentAmount, startAgainAtStageOne, stopSession } from '../../data/actions';
import { gapSuggestionFor, nextPrescription, stageOfferFor, todayOptions, weekActivity } from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { formatLocalDate } from '../../lib/dates';
import { getFixedStagePrescription } from '../../program/prescription';
import type { StageOffer } from '../../program/progression';
import { nextScheduledDay } from '../../program/schedule';
import { Button, LinkButton, Page, StatusLabel } from '../components/ui';
import { formatDose } from '../components/ProgramViews';
import { navigate } from '../router';

export function TodayScreen() {
  const { data, today, apply } = useStore();
  const { t, L, lang } = useI18n();
  const [restChosen, setRestChosen] = useState(false);
  const [gapDismissed, setGapDismissed] = useState(false);
  const [offerResult, setOfferResult] = useState<string | null>(null);

  useEffect(() => {
    if (!data.profile.optedIn) navigate('/welcome', { replace: true });
  }, [data.profile.optedIn]);
  if (!data.profile.optedIn) return null;

  const hour = new Date().getHours();
  const options = todayOptions(data, today);
  const week = weekActivity(data, today);
  const offer = stageOfferFor(data);
  const gap = gapDismissed ? null : gapSuggestionFor(data, today);
  const nextDay = nextScheduledDay(data.schedule, today, false);
  const firstEver = data.sessions.length === 0;
  const prescription = nextPrescription(data);

  return (
    <Page title={t.greeting(hour, data.profile.displayName)}>
      {data.profile.encouragementNote ? (
        <p className="card card--accent pre-wrap">
          <span className="visually-hidden">{t.today.note}: </span>
          {data.profile.encouragementNote}
        </p>
      ) : null}

      {data.activeSession ? (
        <section className="card card--accent stack-sm" data-testid="resume-card">
          <StatusLabel kind="info">{t.today.resumeTitle}</StatusLabel>
          <p>{t.today.resumeBody}</p>
          <LinkButton to="/session" variant="primary" block>
            {t.today.resume}
          </LinkButton>
          <Button block onClick={() => void apply((d, c) => stopSession(d, c))}>
            {t.today.finishHere}
          </Button>
        </section>
      ) : null}

      {gap && !data.activeSession ? (
        <section className="card card--info stack-sm" data-testid="gap-card">
          <h2 style={{ marginTop: 0 }}>{t.today.gapTitle}</h2>
          <p>{t.today.gapBody(gap.gapDays, gap.currentStage)}</p>
          <Button variant="primary" block onClick={() => void apply((d, c) => startAgainAtStageOne(d, c))}>
            {t.today.gapRestart}
          </Button>
          <Button block onClick={() => setGapDismissed(true)}>
            {t.today.gapKeep(gap.currentStage)}
          </Button>
        </section>
      ) : null}

      {offerResult ? (
        <p className="card card--accent" role="status" data-testid="offer-result">
          {offerResult}
        </p>
      ) : null}
      {offer.kind === 'offer' && !data.activeSession ? <OfferCard offer={offer} onDone={setOfferResult} /> : null}

      <section className="stack-sm" aria-labelledby="practice-heading">
        <h2 id="practice-heading">{t.today.stageLine(data.stage)}</h2>
        <DayMessage kind={options.day.kind} />
        {prescription.ok ? (
          <ul>
            {prescription.prescription.items.map((item) => (
              <li key={item.exerciseId}>
                {L(EXERCISES[item.exerciseId].name)} — {formatDose(item, lang)}
              </li>
            ))}
          </ul>
        ) : null}
        {restChosen ? (
          <p className="card card--accent" role="status">
            {t.today.restAck}
          </p>
        ) : null}
        {options.canStartFull ? (
          <>
            <LinkButton to="/session/full" variant="primary" large block>
              {t.today.startFull}
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
        {offer.kind === 'hold' && offer.holdReason === 'need_more_sessions' ? (
          <p className="muted">{t.offer.progress(offer.fullPractices, PROGRAM.minimumFullSessionsPerStage)}</p>
        ) : null}
        {offer.kind === 'maintenance' ? <p className="card card--muted">{t.today.maintenance}</p> : null}
        <p className="muted">{firstEver ? t.tone.start : t.tone.keep}</p>
      </section>

      <div className="row">
        <LinkButton to="/learn">{t.today.learn}</LinkButton>
        <LinkButton to="/plan">{t.today.seePlan}</LinkButton>
      </div>

      <section className="card card--muted stack-sm">
        <p style={{ fontWeight: 650, fontSize: '1.3rem' }}>{t.today.weekCount(week.practiceDays)}</p>
        {nextDay ? <p>{t.today.nextDay(formatLocalDate(nextDay, lang))}</p> : null}
      </section>
      <p className="muted">{t.today.help}</p>
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

function OfferCard({ offer, onDone }: { offer: Extract<StageOffer, { kind: 'offer' }>; onDone: (message: string) => void }) {
  const { apply } = useStore();
  const { t, L, lang } = useI18n();
  const from = getFixedStagePrescription('mum-home-foundation-v2', offer.fromStage).items;
  const to = getFixedStagePrescription('mum-home-foundation-v2', offer.toStage).items;
  const changes = to.filter((item, i) => item.sets !== from[i]!.sets || item.reps !== from[i]!.reps);
  return (
    <section className="card card--accent stack-sm" data-testid="offer-card">
      <h2 style={{ marginTop: 0 }}>{t.offer.title}</h2>
      <p>{t.offer.body(offer.basedOnSessionIds.length)}</p>
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
          onDone(t.offer.kept);
          void apply((d, c) => keepCurrentAmount(d, offer, c));
        }}
      >
        {t.offer.keep}
      </Button>
      <Button
        block
        onClick={() => {
          onDone(t.offer.accepted(offer.toStage));
          void apply((d, c) => acceptStageOffer(d, offer, c));
        }}
      >
        {t.offer.accept(offer.toStage)}
      </Button>
    </section>
  );
}
