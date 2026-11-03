import { useEffect, useState } from 'react';
import { EXERCISES } from '../../content/exercises';
import { PROGRAM } from '../../content/program';
import { EDUCATION_ENTRIES, demonstrationsFor, formatDuration } from '../../content/videos';
import { STAGES, isExerciseId, type ExerciseId } from '../../domain/types';
import { recordLearningVisit, setStage } from '../../data/actions';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { weekdayLabel } from '../../lib/dates';
import { getFixedStagePrescription } from '../../program/prescription';
import { Button, LinkButton, Page } from '../components/ui';
import { ExerciseText, StageTable, formatDose } from '../components/ProgramViews';
import { VideoDemo } from '../components/VideoDemo';
import { ExternalIcon } from '../components/Icons';
import { href } from '../router';

export function LearnScreen({ exerciseId }: { exerciseId: string | null }) {
  const { data, apply } = useStore();
  const { t, L, lang } = useI18n();

  useEffect(() => {
    void apply((d, c) => recordLearningVisit(d, c));
  }, [apply]);

  if (exerciseId && isExerciseId(exerciseId)) return <LearnOne id={exerciseId} />;

  const currentItems = getFixedStagePrescription(PROGRAM.programId, data.stage).items;
  return (
    <Page title={t.learn.title} lead={t.learn.intro}>
      <ul className="list-plain">
        {PROGRAM.exerciseOrder.map((id, i) => (
          <li key={id} className="stack-sm">
            <h2>
              <a href={href(`/learn/${id}`)}>
                {i + 1}. {L(EXERCISES[id].name)}
              </a>
            </h2>
            <p className="muted">{formatDose(currentItems[i]!, lang)}</p>
            <p>{L(EXERCISES[id].benefit)}</p>
          </li>
        ))}
      </ul>
      <h2>{t.learn.longer}</h2>
      <ul className="list-plain">
        {EDUCATION_ENTRIES.map((e) => (
          <li key={e.id} className="stack-sm">
            <p style={{ fontWeight: 600 }}>{L(e.label)}</p>
            <p className="muted">
              {e.publisher} · {formatDuration(e.durationSeconds)}
            </p>
            <p>{L(e.note)}</p>
            <div className="row">
              <a className="btn" href={e.watchUrl} target="_blank" rel="noopener noreferrer">
                <ExternalIcon size={20} /> {t.video.open}
              </a>
              <a className="btn btn--quiet" href={e.pageUrl} target="_blank" rel="noopener noreferrer">
                {t.learn.open} ({e.publisher.split(' (')[0]})
              </a>
              {e.transcriptUrl ? (
                <a className="btn btn--quiet" href={e.transcriptUrl} target="_blank" rel="noopener noreferrer" lang="zh-Hant">
                  文字稿 / Transcript
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function LearnOne({ id }: { id: ExerciseId }) {
  const { t, L } = useI18n();
  return (
    <Page title={L(EXERCISES[id].name)}>
      <p>
        <a href={href('/learn')}>← {t.learn.title}</a>
      </p>
      <ExerciseText id={id} />
      {demonstrationsFor(id).map((entry) => (
        <VideoDemo key={entry.variantId} entry={entry} />
      ))}
    </Page>
  );
}

export function PlanScreen() {
  const { data, apply } = useStore();
  const { t, lang } = useI18n();
  const [changed, setChanged] = useState<number | null>(null);
  const days = data.schedule.weekdays.map((d) => weekdayLabel(d, lang)).join(lang === 'zh' ? '、' : ' and ');
  return (
    <Page title={t.plan.title}>
      <p>{t.plan.intro}</p>
      <StageTable currentStage={data.stage} />
      <p>{t.plan.stageRule}</p>

      <section className="card stack-sm" aria-labelledby="choose-stage">
        <h2 id="choose-stage" style={{ marginTop: 0 }}>
          {t.plan.chooseTitle}
        </h2>
        <p className="muted">{t.plan.chooseHint}</p>
        <p style={{ fontWeight: 650 }} role="status">
          {changed ? t.plan.changed(changed) : t.plan.current(data.stage)}
        </p>
        <div className="count-grid" role="group" aria-label={t.plan.chooseTitle}>
          {STAGES.map((s) => (
            <Button
              key={s}
              variant={s === data.stage ? 'primary' : 'default'}
              ariaLabel={t.plan.use(s)}
              disabled={!!data.activeSession}
              onClick={() => {
                if (s === data.stage) return;
                void apply((d, c) => setStage(d, s, c));
                setChanged(s);
              }}
            >
              {s}
            </Button>
          ))}
        </div>
      </section>

      <p>{t.plan.schedule(days)}</p>
      <p>{t.plan.walking}</p>
      <div className="card card--muted stack-sm">
        <p>{t.plan.coverage}</p>
        <p>{t.plan.aboutNumbers}</p>
      </div>
      <LinkButton to="/learn" block>
        {t.settings.sections.learn}
      </LinkButton>
    </Page>
  );
}
