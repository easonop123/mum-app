import { useMemo, useState } from 'react';
import type { Answer, ReadinessAnswers, ReadinessQuestionId } from '../../domain/types';
import { evaluateReadiness, needsClinicianCheckQuestion } from '../../safety/readiness';
import { useI18n } from '../../i18n/I18n';
import { Button, ChoiceGroup } from '../components/ui';

const BASE_ORDER: ReadinessQuestionId[] = [
  'emergencySigns',
  'urgentSigns',
  'reviewSigns',
  'currentBackPain',
  'backPainNewOrWorse',
  'backPainLimitsTasks',
  'spreadingNumbWeak',
  'knownDiagnosisOrRestrictions',
  'injurySurgeryFracture',
  'conditionOrExertionalSymptoms',
  'activityAdvice',
  'canStandWithSupport',
  'fallsDizziness',
  'clinicianPlan',
  'clinicianCheckedConcerns',
];

const GROUP_QUESTIONS: ReadinessQuestionId[] = ['emergencySigns', 'urgentSigns', 'reviewSigns'];
const CONFIRM_YES: ReadinessQuestionId[] = ['emergencySigns', 'urgentSigns'];

/** The questions that apply to these answers, in order (conditional ones included only when relevant). */
export function applicableQuestions(answers: ReadinessAnswers): ReadinessQuestionId[] {
  return BASE_ORDER.filter((q) => {
    if (q === 'backPainNewOrWorse' || q === 'backPainLimitsTasks') return answers.currentBackPain !== undefined && answers.currentBackPain !== 'no';
    if (q === 'clinicianCheckedConcerns') return needsClinicianCheckQuestion(answers);
    return true;
  });
}

export interface ScreeningNotes {
  restrictionsNote: string | null;
  activityAdviceNote: string | null;
}

/**
 * One topic per screen. Answers are kept fresh (never pre-filled from an
 * earlier screening). Emergency or urgent answers interrupt immediately via
 * onInterrupt so they are stored and acted on straight away.
 */
export function ScreeningFlow({
  onInterrupt,
  onComplete,
  intro,
}: {
  onInterrupt: (answers: ReadinessAnswers, notes: ScreeningNotes) => void;
  onComplete: (answers: ReadinessAnswers, notes: ScreeningNotes) => void;
  intro?: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const [answers, setAnswers] = useState<ReadinessAnswers>({});
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<Answer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState<ScreeningNotes>({ restrictionsNote: null, activityAdviceNote: null });

  const questions = useMemo(() => applicableQuestions(answers), [answers]);
  const id = questions[Math.min(index, questions.length - 1)]!;
  const q = t.questions[id];
  const current = pending ?? answers[id] ?? null;

  const isGroup = GROUP_QUESTIONS.includes(id);
  const choices: { value: Answer; label: string }[] = [
    { value: 'yes', label: isGroup ? t.answerYesAny : t.answers.yes },
    { value: 'no', label: isGroup ? t.answerNoneOfThese : t.answers.no },
    { value: 'unsure', label: id === 'knownDiagnosisOrRestrictions' && lang === 'zh' ? '不清楚' : t.answers.unsure },
  ];

  function commitAnswer(answer: Answer) {
    const next: ReadinessAnswers = { ...answers, [id]: answer };
    // Changing current back pain to "no" removes its follow-ups.
    if (id === 'currentBackPain' && answer === 'no') {
      delete next.backPainNewOrWorse;
      delete next.backPainLimitsTasks;
    }
    setAnswers(next);
    setPending(null);
    setConfirming(false);
    const decision = evaluateReadiness(next);
    if (decision.state === 'emergency_stop' || decision.state === 'urgent_assessment') {
      onInterrupt(next, notes);
      return;
    }
    const nextQuestions = applicableQuestions(next);
    const position = nextQuestions.indexOf(id);
    if (position >= nextQuestions.length - 1) {
      onComplete(next, notes);
    } else {
      setIndex(position + 1);
    }
  }

  function onNext() {
    if (!current) return;
    if (current === 'yes' && CONFIRM_YES.includes(id) && !confirming) {
      setConfirming(true);
      return;
    }
    commitAnswer(current);
  }

  if (confirming) {
    return (
      <div className="stack" aria-live="polite">
        <h2>{t.confirmYes.title}</h2>
        <p>{t.confirmYes.body}</p>
        {q.items ? (
          <ul className="symptom-list">
            {q.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <Button variant="safety" large block onClick={() => commitAnswer('yes')}>
          {t.confirmYes.yes}
        </Button>
        <Button
          variant="quiet"
          block
          onClick={() => {
            setConfirming(false);
            setPending(null);
          }}
        >
          {t.confirmYes.no}
        </Button>
      </div>
    );
  }

  return (
    <div className="stack">
      {intro && index === 0 ? intro : null}
      <p className="muted" aria-live="polite">
        {t.stepOf(index + 1, questions.length)}
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <ChoiceGroup<Answer>
          key={id}
          name={`q-${id}`}
          legend={q.q}
          hint={
            q.items || q.hint ? (
              <>
                {q.items ? (
                  <ul className="symptom-list">
                    {q.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {q.hint ? <p className="muted">{q.hint}</p> : null}
              </>
            ) : undefined
          }
          choices={choices}
          value={current}
          onChange={setPending}
        />
        {id === 'knownDiagnosisOrRestrictions' && current === 'yes' ? (
          <div className="field">
            <label htmlFor="restrictions-note">{t.noteOptional}</label>
            <textarea
              id="restrictions-note"
              maxLength={2000}
              value={notes.restrictionsNote ?? ''}
              onChange={(e) => setNotes({ ...notes, restrictionsNote: e.target.value || null })}
            />
          </div>
        ) : null}
        {id === 'activityAdvice' && current === 'yes' ? (
          <div className="field">
            <label htmlFor="activity-note">{t.noteOptional}</label>
            <textarea
              id="activity-note"
              maxLength={2000}
              value={notes.activityAdviceNote ?? ''}
              onChange={(e) => setNotes({ ...notes, activityAdviceNote: e.target.value || null })}
            />
          </div>
        ) : null}
        <div className="row">
          {index > 0 ? (
            <Button
              variant="quiet"
              onClick={() => {
                setPending(null);
                setIndex(index - 1);
              }}
            >
              {t.back}
            </Button>
          ) : null}
          <Button type="submit" variant="primary" large disabled={!current}>
            {t.next}
          </Button>
        </div>
      </form>
    </div>
  );
}
