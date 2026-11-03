import { useMemo, useState } from 'react';
import { EXERCISES } from '../../content/exercises';
import { PROGRAM } from '../../content/program';
import { EXERCISE_IDS, READINESS_QUESTION_IDS, STAGES, type Answer, type ExerciseApproval, type ExerciseId, type PrivateAdviceRecord, type ProfessionalSaid, type ReadinessAnswers, type Stage } from '../../domain/types';
import { clearProfessionalAdvice, commitScreening, recordClinicianPlan, recordProfessionalAdvice, submitRescreen, type RescreenOutcome } from '../../data/actions';
import { programAccess } from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { formatLocalDate, isLocalDate, localDateInZone } from '../../lib/dates';
import { buildClinicianSummary } from '../../lib/summary';
import { copyText, shareText } from '../../lib/download';
import { programStatusFromAdvice } from '../../program/prescription';
import { unresolvedHolds } from '../../safety/holds';
import { reasonsFromCodes } from '../../safety/reasons';
import { Button, ChoiceGroup, LinkButton, Page, ReasonList, StatusLabel, BackLink } from '../components/ui';
import { navigate } from '../router';
import { ScreeningFlow, type ScreeningNotes } from './ScreeningFlow';

function answerLabel(a: Answer | undefined, t: ReturnType<typeof useI18n>['t']): string {
  return a === 'yes' ? t.answers.yes : a === 'no' ? t.answers.no : a === 'unsure' ? t.answers.unsure : '—';
}

export function HealthAnswersScreen() {
  const { data, today } = useStore();
  const { t, lang } = useI18n();
  const access = programAccess(data, today);
  const holds = unresolvedHolds(data.holds);
  const answeredOn = data.readiness.answeredAt ? formatLocalDate(localDateInZone(data.readiness.answeredAt, data.schedule.timezone), lang) : null;
  return (
    <Page title={t.health.title}>
      <BackLink to="/settings" />
      <p className="muted">{answeredOn ? t.health.answeredOn(answeredOn) : t.health.never}</p>
      <section className="card card--info stack-sm">
        <StatusLabel kind="info">{t.health.statusNow}</StatusLabel>
        <ReasonList reasons={access.reasons} />
      </section>
      {holds.length > 0 ? (
        <section className="card card--safety stack-sm">
          <h2>{t.health.holdsTitle}</h2>
          <ul>
            {holds.map((h) => (
              <li key={h.id}>
                {formatLocalDate(h.localDate, lang)}: {reasonsFromCodes(h.reasonCodes).map((r) => (lang === 'zh' ? r.zh : r.en)).join(' ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <LinkButton to="/rescreen" variant="primary" block>
        {t.health.rescreen}
      </LinkButton>
      <p className="muted">{t.health.rescreenHint}</p>
      <dl className="stack-sm">
        {READINESS_QUESTION_IDS.filter((q) => data.readiness.answers[q] !== undefined).map((q) => (
          <div key={q} className="card">
            <dt>{t.questions[q].q}</dt>
            <dd style={{ margin: '0.35rem 0 0', fontWeight: 650 }}>{answerLabel(data.readiness.answers[q], t)}</dd>
          </div>
        ))}
      </dl>
      {data.readiness.restrictionsNote ? (
        <p className="card pre-wrap">
          {t.health.note}: {data.readiness.restrictionsNote}
        </p>
      ) : null}
      {data.readiness.activityAdviceNote ? (
        <p className="card pre-wrap">
          {t.health.note}: {data.readiness.activityAdviceNote}
        </p>
      ) : null}
    </Page>
  );
}

/**
 * The return-to-program flow: asks about medical advice (when something is
 * on hold) AND current symptoms, answered fresh. It never just resets a box.
 */
export function RescreenScreen() {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const holds = unresolvedHolds(data.holds);
  const needsAdvice = holds.length > 0;
  const [talked, setTalked] = useState<'yes' | 'no' | null>(null);
  const [said, setSaid] = useState<ProfessionalSaid | null>(null);
  const [note, setNote] = useState('');
  const [adviceDone, setAdviceDone] = useState(!needsAdvice);
  const [result, setResult] = useState<RescreenOutcome | null>(null);

  const submit = (answers: ReadinessAnswers, notes: ScreeningNotes, interrupted: boolean) => {
    let outcome: RescreenOutcome | null = null;
    void apply((d, c) => {
      // Fresh answers + the medical-advice answers. Holds resolve only where the rules allow.
      const o = submitRescreen(d, { answers, talkedToProfessional: talked ?? 'no', professionalSaid: talked === 'yes' ? said : null, note, ...notes }, c);
      outcome = o;
      // Emergency/urgent answers also record a screening hold before Today shows the safety view.
      return interrupted ? commitScreening(o.data, answers, notes, false, c) : o.data;
    }).then(() => {
      if (interrupted) navigate('/', { replace: true });
      else setResult(outcome);
    });
  };

  if (result) {
    const anyHeld = result.results.some((r) => !r.decision.resolved);
    const paused = result.data.programStatus === 'paused_for_review';
    return (
      <Page title={t.rescreen.title}>
        <div className="card card--info stack-sm" role="status">
          <p>{paused ? t.rescreen.resultPaused : anyHeld ? t.rescreen.resultHeld : t.rescreen.resultResolved}</p>
          <ReasonList reasons={result.results.flatMap((r) => r.decision.reasons)} />
        </div>
        <LinkButton to="/" variant="primary" block>
          {t.checkIn.goToday}
        </LinkButton>
      </Page>
    );
  }

  if (!adviceDone) {
    return (
      <Page title={t.rescreen.title} lead={t.rescreen.intro}>
        <ChoiceGroup<'yes' | 'no'>
          legend={t.rescreen.adviceQ}
          name="talked"
          value={talked}
          onChange={setTalked}
          choices={[
            { value: 'yes', label: t.answers.yes },
            { value: 'no', label: t.answers.no },
          ]}
        />
        {talked === 'yes' ? (
          <ChoiceGroup<ProfessionalSaid>
            legend={t.rescreen.saidQ}
            name="said"
            value={said}
            onChange={setSaid}
            choices={(['ok_to_continue', 'continue_with_changes', 'stop_for_now', 'unsure'] as ProfessionalSaid[]).map((v) => ({ value: v, label: t.rescreen.said[v] }))}
          />
        ) : null}
        <div className="field">
          <label htmlFor="rescreen-note">{t.rescreen.noteQ}</label>
          <textarea id="rescreen-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button variant="primary" large block disabled={!talked || (talked === 'yes' && !said)} onClick={() => setAdviceDone(true)}>
          {t.next}
        </Button>
      </Page>
    );
  }

  return (
    <Page title={t.rescreen.title} lead={needsAdvice ? undefined : t.rescreen.intro}>
      <ScreeningFlow onInterrupt={(a, n) => submit(a, n, true)} onComplete={(a, n) => submit(a, n, false)} />
    </Page>
  );
}

function emptyApprovals(): Record<ExerciseId, ExerciseApproval | null> {
  return Object.fromEntries(EXERCISE_IDS.map((id) => [id, null])) as Record<ExerciseId, ExerciseApproval | null>;
}

export function AdviceScreen() {
  const { data, apply, today } = useStore();
  const { t, L, lang } = useI18n();
  const existing = data.professionalAdvice;
  const [adviceDate, setAdviceDate] = useState(existing?.adviceDate ?? '');
  const [professional, setProfessional] = useState<PrivateAdviceRecord['professional'] | null>(existing?.professional ?? null);
  const [assessed, setAssessed] = useState<Answer | null>(existing?.assessedBackHistory ?? null);
  const [approvals, setApprovals] = useState<Record<ExerciseId, ExerciseApproval | null>>(existing ? { ...existing.exerciseApprovals } : emptyApprovals());
  const [progression, setProgression] = useState<PrivateAdviceRecord['progressionApproved'] | null>(existing?.progressionApproved ?? null);
  const [maxStage, setMaxStage] = useState<string>(existing?.maxStage ? String(existing.maxStage) : 'none');
  const [restrictions, setRestrictions] = useState(existing?.restrictionsNote ?? '');
  const [other, setOther] = useState(existing?.otherNotes ?? '');
  const [enteredWith, setEnteredWith] = useState<PrivateAdviceRecord['enteredWith'] | null>(existing?.enteredWith ?? null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const complete = professional && assessed && progression && enteredWith && EXERCISE_IDS.every((id) => approvals[id] !== null);

  const preview = useMemo(() => {
    if (!complete) return null;
    return programStatusFromAdvice({
      recordedAt: '',
      updatedAt: '',
      adviceDate: null,
      professional: professional!,
      assessedBackHistory: assessed!,
      exerciseApprovals: approvals as Record<ExerciseId, ExerciseApproval>,
      progressionApproved: progression!,
      maxStage: null,
      restrictionsNote: '',
      otherNotes: '',
      enteredWith: enteredWith!,
    });
  }, [complete, professional, assessed, approvals, progression, enteredWith]);

  return (
    <Page title={t.advice.title} lead={t.advice.intro}>
      <BackLink to="/settings" />
      {existing ? <p className="muted">{t.advice.recordedOn(formatLocalDate(localDateInZone(existing.updatedAt, data.schedule.timezone), lang))}</p> : null}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!complete) return;
          void apply((d, c) =>
            recordProfessionalAdvice(
              d,
              {
                recordedAt: existing?.recordedAt ?? c.now,
                updatedAt: c.now,
                adviceDate: isLocalDate(adviceDate) && adviceDate <= today ? adviceDate : null,
                professional: professional!,
                assessedBackHistory: assessed!,
                exerciseApprovals: approvals as Record<ExerciseId, ExerciseApproval>,
                progressionApproved: progression!,
                maxStage: maxStage === 'none' ? null : (Number(maxStage) as Stage),
                restrictionsNote: restrictions.slice(0, 2000),
                otherNotes: other.slice(0, 2000),
                enteredWith: enteredWith!,
              },
              c,
            ),
          );
          setSavedStatus(preview === 'reviewed_for_use' ? t.advice.statusReviewed : preview === 'paused_for_review' ? t.advice.statusPaused : t.advice.statusPending);
        }}
      >
        <div className="field">
          <label htmlFor="advice-date">{t.advice.dateQ}</label>
          <input id="advice-date" type="date" max={today} value={adviceDate} onChange={(e) => setAdviceDate(e.target.value)} />
        </div>
        <ChoiceGroup
          legend={t.advice.whoQ}
          name="professional"
          value={professional}
          onChange={(v) => setProfessional(v)}
          choices={(['gp', 'physio', 'other'] as const).map((v) => ({ value: v, label: t.advice.who[v] }))}
        />
        <ChoiceGroup<Answer>
          legend={t.advice.assessedQ}
          name="assessed"
          value={assessed}
          onChange={setAssessed}
          choices={[
            { value: 'yes', label: t.answers.yes },
            { value: 'no', label: t.answers.no },
            { value: 'unsure', label: t.answers.unsure },
          ]}
        />
        <h2>{t.advice.perExerciseQ}</h2>
        {PROGRAM.exerciseOrder.map((id) => (
          <ChoiceGroup<ExerciseApproval>
            key={id}
            legend={L(EXERCISES[id].name)}
            name={`approval-${id}`}
            value={approvals[id]}
            onChange={(v) => setApprovals({ ...approvals, [id]: v })}
            choices={(['ok', 'not_ok', 'not_discussed'] as const).map((v) => ({ value: v, label: t.advice.approval[v] }))}
          />
        ))}
        <ChoiceGroup
          legend={t.advice.progressionQ}
          name="progression"
          value={progression}
          onChange={(v) => setProgression(v)}
          choices={(['yes', 'no', 'not_discussed'] as const).map((v) => ({ value: v, label: t.advice.progression[v] }))}
        />
        <div className="field">
          <label htmlFor="max-stage">{t.advice.maxStageQ}</label>
          <select id="max-stage" value={maxStage} onChange={(e) => setMaxStage(e.target.value)}>
            <option value="none">{t.advice.noLimit}</option>
            {STAGES.map((s) => (
              <option key={s} value={String(s)}>
                {t.advice.upToStage(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="restrictions">{t.advice.restrictionsQ}</label>
          <textarea id="restrictions" maxLength={2000} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="other-notes">{t.advice.otherQ}</label>
          <textarea id="other-notes" maxLength={2000} value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
        <ChoiceGroup
          legend={t.advice.enteredWithQ}
          name="entered-with"
          value={enteredWith}
          onChange={(v) => setEnteredWith(v)}
          choices={(['myself', 'with_helper'] as const).map((v) => ({ value: v, label: t.advice.enteredWith[v] }))}
        />
        <p className="card card--muted">{t.advice.changesNote}</p>
        <Button type="submit" variant="primary" large block disabled={!complete}>
          {t.advice.save}
        </Button>
        {savedStatus ? (
          <p className="card card--info" role="status">
            {savedStatus}
          </p>
        ) : null}
      </form>
      {existing ? (
        <Button
          variant="quiet"
          onClick={() => {
            void apply((d, c) => clearProfessionalAdvice(d, c));
            setSavedStatus(t.advice.statusPending);
          }}
        >
          {t.advice.clear}
        </Button>
      ) : null}
    </Page>
  );
}

export function ClinicianPlanScreen() {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const [text, setText] = useState(data.clinicianPlan?.text ?? '');
  const [source, setSource] = useState<'gp' | 'physio' | 'other' | null>(data.clinicianPlan?.source ?? null);
  const [status, setStatus] = useState<string | null>(null);
  return (
    <Page title={t.clinicianPlan.title} lead={t.clinicianPlan.intro}>
      <BackLink to="/settings" />
      <ChoiceGroup
        legend={t.clinicianPlan.sourceQ}
        name="plan-source"
        value={source}
        onChange={(v) => setSource(v)}
        choices={(['physio', 'gp', 'other'] as const).map((v) => ({ value: v, label: t.advice.who[v] }))}
      />
      <div className="field">
        <label htmlFor="plan-text">{t.clinicianPlan.label}</label>
        <textarea id="plan-text" maxLength={2000} rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Button
        variant="primary"
        block
        disabled={!text.trim() || !source}
        onClick={() => {
          void apply((d, c) => recordClinicianPlan(d, { text: text.trim().slice(0, 2000), source: source!, recordedAt: c.now }, c));
          setStatus(t.saved);
        }}
      >
        {t.clinicianPlan.save}
      </Button>
      {data.clinicianPlan ? (
        <Button
          variant="quiet"
          onClick={() => {
            void apply((d, c) => recordClinicianPlan(d, null, c));
            setText('');
            setStatus(t.saved);
          }}
        >
          {t.clinicianPlan.remove}
        </Button>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
    </Page>
  );
}

export function SummaryScreen() {
  const { data } = useStore();
  const { t, lang } = useI18n();
  const [version, setVersion] = useState<'en' | 'zh'>(lang === 'zh' ? 'zh' : 'en');
  const [status, setStatus] = useState<string | null>(null);
  const text = useMemo(() => buildClinicianSummary(data, version), [data, version]);
  return (
    <Page title={t.summary.title} lead={t.summary.intro}>
      <BackLink to="/settings" />
      <div className="row no-print" role="group" aria-label={t.summary.title}>
        <Button variant={version === 'en' ? 'primary' : 'quiet'} onClick={() => setVersion('en')}>
          {t.summary.versionEn}
        </Button>
        <Button variant={version === 'zh' ? 'primary' : 'quiet'} onClick={() => setVersion('zh')}>
          {t.summary.versionZh}
        </Button>
      </div>
      <div className="summary-text" lang={version === 'zh' ? 'zh-Hans' : 'en'} data-testid="summary-text">
        {text}
      </div>
      <div className="row no-print">
        <Button
          onClick={async () => {
            setStatus((await copyText(text)) === 'copied' ? t.summary.copied : t.summary.copyFailed);
          }}
        >
          {t.summary.copy}
        </Button>
        <Button
          onClick={async () => {
            const r = await shareText(text);
            if (r === 'copied') setStatus(t.summary.copied);
          }}
        >
          {t.summary.share}
        </Button>
        <Button onClick={() => window.print()}>{t.summary.print}</Button>
      </div>
      {status ? <p role="status">{status}</p> : null}
    </Page>
  );
}
