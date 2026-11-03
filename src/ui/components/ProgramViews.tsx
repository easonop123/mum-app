import { PROGRAM } from '../../content/program';
import { EXERCISES } from '../../content/exercises';
import type { ExerciseId, GoalId, Lang, PrescriptionItem, Stage } from '../../domain/types';
import { useI18n } from '../../i18n/I18n';
import { STAGES } from '../../domain/types';

/** "1 set · 5 repetitions / 1 组 · 5 次", "5 each side / 左右各 5 次" — exact supplied quantities. */
export function formatDose(item: Pick<PrescriptionItem, 'sets' | 'reps' | 'perSide'>, lang: Lang): string {
  if (lang === 'zh') {
    return item.perSide ? `${item.sets} 组 · 左右各 ${item.reps} 次` : `${item.sets} 组 · ${item.reps} 次`;
  }
  const sets = `${item.sets} ${item.sets === 1 ? 'set' : 'sets'}`;
  return item.perSide ? `${sets} · ${item.reps} each side` : `${sets} · ${item.reps} repetitions`;
}

/** The eight-stage table, rendered directly from the supplied JSON. */
export function StageTable({ currentStage }: { currentStage?: Stage }) {
  const { t, L } = useI18n();
  return (
    <div className="table-wrap" role="region" aria-label={t.plan.tableCaption} tabIndex={0}>
      <table className="stage-table">
        <caption>{t.plan.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.plan.stage}</th>
            {PROGRAM.exerciseOrder.map((id) => {
              const perSide = id === 'supported-side-leg-lift' && PROGRAM.sideLegLiftRepsArePerSide;
              return (
                <th scope="col" key={id}>
                  {L(EXERCISES[id].shortName)}
                  {perSide ? <span className="th-sub">{t.plan.eachSide}</span> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {STAGES.map((stage) => {
            const dose = PROGRAM.stageDoses.find((d) => d.stage === stage)!;
            const isCurrent = stage === currentStage;
            return (
              <tr key={stage} className={isCurrent ? 'is-current' : undefined} aria-current={isCurrent ? 'step' : undefined}>
                <th scope="row">
                  {stage}
                  {stage === 8 ? <span className="th-sub">{t.plan.hold}</span> : null}
                  {isCurrent ? <span className="th-sub th-now">{t.plan.youAreHere}</span> : null}
                </th>
                {PROGRAM.exerciseOrder.map((id, i) => (
                  <td key={id}>{`${dose.sets[i]} × ${dose.reps[i]}`}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Technique, how to count, benefit and "if it doesn't feel right" for one movement. */
export function ExerciseText({ id, goal, compact }: { id: ExerciseId; goal: GoalId | null; compact?: boolean }) {
  const { t, L, lang } = useI18n();
  const ex = EXERCISES[id];
  const goalLink = goal && goal !== 'own' ? ex.goalLinks[goal] : null;
  return (
    <div className="stack-sm">
      <h2>{t.learn.whatToDo}</h2>
      <ol className="cue-list">
        {ex.cues[lang].map((cue) => (
          <li key={cue}>{cue}</li>
        ))}
      </ol>
      {!compact ? <p>{L(ex.technique)}</p> : null}
      <p>
        <strong>{t.learn.howToCount}:</strong> {L(ex.repDefinition)}
      </p>
      <h2>{t.learn.whyItHelps}</h2>
      <p>{L(ex.benefit)}</p>
      {goalLink ? (
        <p>
          <strong>{t.session.whyGoal}:</strong> {L(goalLink)}
        </p>
      ) : null}
      {!compact ? (
        <>
          <h2>{t.learn.ifNotRight}</h2>
          <p>{L(ex.ifNotSuitable)}</p>
        </>
      ) : null}
    </div>
  );
}
