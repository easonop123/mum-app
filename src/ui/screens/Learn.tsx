import { useEffect } from 'react';
import { EXERCISES } from '../../content/exercises';
import { PROGRAM } from '../../content/program';
import { EDUCATION_ENTRIES, demonstrationsFor, formatDuration } from '../../content/videos';
import { isExerciseId, type ExerciseId } from '../../domain/types';
import { noteDemoOpened, recordLearningVisit, setLearned } from '../../data/actions';
import { programAccess } from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { weekdayLabel } from '../../lib/dates';
import { Button, LinkButton, Page, StatusLabel } from '../components/ui';
import { ExerciseText, StageTable, formatDose } from '../components/ProgramViews';
import { VideoDemo } from '../components/VideoDemo';
import { ExternalIcon } from '../components/Icons';
import { href } from '../router';
import { BlockedPractice } from './SafetyViews';
import { getFixedStagePrescription } from '../../program/prescription';

function useLearningGate() {
  const { data, today } = useStore();
  return programAccess(data, today);
}

export function LearnScreen({ exerciseId }: { exerciseId: string | null }) {
  const { data, apply } = useStore();
  const { t, L, lang } = useI18n();
  const access = useLearningGate();

  useEffect(() => {
    if (access.canLearn) void apply((d, c) => recordLearningVisit(d, c));
  }, [access.canLearn, apply]);

  if (!access.canLearn) {
    return (
      <Page title={t.learn.title}>
        <p>{t.learn.blocked}</p>
        <BlockedPractice access={access} />
      </Page>
    );
  }

  const practising = access.canStartFull || access.blockedBy === 'setup';
  const banner = (
    <div className={`card ${practising ? 'card--accent' : 'card--info'}`}>
      <StatusLabel kind="info">{practising ? t.learn.allowedBanner : t.learn.pendingBanner}</StatusLabel>
    </div>
  );

  if (exerciseId && isExerciseId(exerciseId)) {
    return <LearnOne id={exerciseId} banner={banner} />;
  }

  const currentItems = getFixedStagePrescription(PROGRAM.programId, data.stage).items;
  return (
    <Page title={t.learn.title}>
      {banner}
      <ul className="list-plain">
        {PROGRAM.exerciseOrder.map((id, i) => {
          const learned = !!data.exerciseProgress[id]?.learnedAt;
          return (
            <li key={id} className="stack-sm">
              <h2>
                <a href={href(`/learn/${id}`)}>
                  {i + 1}. {L(EXERCISES[id].name)}
                </a>
              </h2>
              <p className="muted">
                {formatDose(currentItems[i]!, lang)}
                {learned ? ` · ✓ ${t.learn.learned}` : ''}
              </p>
              <p>{L(EXERCISES[id].benefit)}</p>
            </li>
          );
        })}
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

function LearnOne({ id, banner }: { id: ExerciseId; banner: React.ReactNode }) {
  const { data, apply } = useStore();
  const { t, L } = useI18n();
  const learned = !!data.exerciseProgress[id]?.learnedAt;
  return (
    <Page title={L(EXERCISES[id].name)}>
      <p>
        <a href={href('/learn')}>← {t.learn.title}</a>
      </p>
      {banner}
      <ExerciseText id={id} goal={data.profile.goal} />
      {demonstrationsFor(id).map((entry) => (
        <VideoDemo key={entry.variantId} entry={entry} onOpened={() => void apply((d, c) => noteDemoOpened(d, id, c))} />
      ))}
      <div className="card card--muted stack-sm">
        <p className="muted">{t.learn.learnedNote}</p>
        {learned ? (
          <div className="row">
            <span className="status-label">✓ {t.learn.learned}</span>
            <Button variant="link" onClick={() => void apply((d, c) => setLearned(d, id, false, c))}>
              {t.learn.unmark}
            </Button>
          </div>
        ) : (
          <Button variant="primary" block onClick={() => void apply((d, c) => setLearned(d, id, true, c))}>
            {t.learn.markLearned}
          </Button>
        )}
      </div>
    </Page>
  );
}

export function PlanScreen() {
  const { data } = useStore();
  const { t, lang } = useI18n();
  const access = useLearningGate();
  if (!access.canLearn) {
    return (
      <Page title={t.plan.title}>
        <BlockedPractice access={access} />
      </Page>
    );
  }
  const badge = data.programStatus === 'reviewed_for_use' ? t.plan.reviewed : data.programStatus === 'paused_for_review' ? t.plan.paused : t.plan.draft;
  const days = data.schedule.weekdays.map((d) => weekdayLabel(d, lang)).join(lang === 'zh' ? '、' : ' and ');
  return (
    <Page title={t.plan.title}>
      <p>
        <span className={`badge ${data.programStatus === 'reviewed_for_use' ? '' : 'badge--draft'}`}>{badge}</span>
      </p>
      <p>{t.plan.intro}</p>
      <StageTable currentStage={data.stage} />
      <p>{t.plan.stageRule}</p>
      <p>{t.plan.stage8}</p>
      <p>{t.plan.schedule(days)}</p>
      <p>{t.plan.walking}</p>
      <div className="card card--muted stack-sm">
        <p>{t.plan.coverage}</p>
      </div>
      <div className="card card--info stack-sm" lang={lang === 'zh' ? 'zh-Hans' : 'en'}>
        <p>{t.plan.aboutNumbers}</p>
      </div>
      <LinkButton to="/learn" block>
        {t.settings.sections.learn}
      </LinkButton>
      <LinkButton to="/settings/summary" block>
        {t.settings.sections.summary}
      </LinkButton>
    </Page>
  );
}
