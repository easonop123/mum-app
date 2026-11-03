import { useState } from 'react';
import { WEEKDAYS, type GoalId, type Weekday } from '../../domain/types';
import { commitScreening, setScheduleDetails, setWeekdays, updateProfile } from '../../data/actions';
import { requestPersistentStorage } from '../../data/db';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { weekdayLabel } from '../../lib/dates';
import { validateScheduleDays } from '../../program/schedule';
import { Button, ChoiceGroup, Page } from '../components/ui';
import { navigate } from '../router';
import { ScreeningFlow } from './ScreeningFlow';

type Step = 'welcome' | 'not_now' | 'language' | 'region' | 'health_intro' | 'health' | 'goal' | 'cue' | 'days';

export function OnboardingScreen() {
  const { data, apply } = useStore();
  const { t, lang } = useI18n();
  const p = data.profile;
  const initial: Step = !p.optedIn ? 'welcome' : !p.languageConfirmed ? 'language' : !p.regionConfirmed ? 'region' : 'health_intro';
  const [step, setStep] = useState<Step>(initial);
  const [firstRun] = useState(() => data.readiness.answeredAt === null);

  if (step === 'welcome') {
    return (
      <Page title={t.welcome.title}>
        <p>{t.welcome.body}</p>
        <p className="card card--muted">{t.welcome.notMedical}</p>
        <h2>{t.welcome.question}</h2>
        <Button
          variant="primary"
          large
          block
          onClick={() => {
            void apply((d, c) => updateProfile(d, { optedIn: true }, c));
            setStep('language');
          }}
        >
          {t.welcome.yes}
        </Button>
        <Button block onClick={() => setStep('not_now')}>
          {t.welcome.notNow}
        </Button>
      </Page>
    );
  }

  if (step === 'not_now') {
    return (
      <Page title={t.welcome.notNowTitle}>
        <p>{t.welcome.notNowBody}</p>
        <Button onClick={() => setStep('welcome')}>{t.welcome.changedMind}</Button>
      </Page>
    );
  }

  if (step === 'language') {
    return (
      <Page title={t.languageStep.title} lead={t.languageStep.body}>
        <ChoiceGroup
          legend={t.languageStep.title}
          name="language"
          value={p.language}
          onChange={(v) => void apply((d, c) => updateProfile(d, { language: v as 'en' | 'zh' }, c))}
          choices={[
            { value: 'en', label: <span lang="en">English</span> },
            { value: 'zh', label: <span lang="zh-Hans">简体中文</span> },
          ]}
        />
        <ChoiceGroup
          legend={t.languageStep.voiceTitle}
          hint={t.languageStep.voiceBody}
          name="voice"
          value={p.voice}
          onChange={(v) => void apply((d, c) => updateProfile(d, { voice: v as 'off' | 'mandarin' | 'english' }, c))}
          choices={[
            { value: 'off', label: t.languageStep.voiceOff },
            { value: 'mandarin', label: t.languageStep.voiceMandarin },
            { value: 'english', label: t.languageStep.voiceEnglish },
          ]}
        />
        <Button
          variant="primary"
          large
          block
          onClick={() => {
            void apply((d, c) => updateProfile(d, { languageConfirmed: true }, c));
            setStep(p.regionConfirmed ? 'health_intro' : 'region');
          }}
        >
          {t.continue}
        </Button>
      </Page>
    );
  }

  if (step === 'region') {
    return <RegionStep onDone={() => setStep('health_intro')} />;
  }

  if (step === 'health_intro') {
    return (
      <Page title={t.healthIntro.title}>
        <p>{t.healthIntro.body}</p>
        <p className="card card--info">{t.healthIntro.helperNote}</p>
        <Button variant="primary" large block onClick={() => setStep('health')}>
          {t.healthIntro.start}
        </Button>
      </Page>
    );
  }

  if (step === 'health') {
    return (
      <Page title={t.healthIntro.title}>
        <ScreeningFlow
          onInterrupt={(answers, notes) => {
            void apply((d, c) => commitScreening(d, answers, notes, false, c));
            navigate('/', { replace: true });
          }}
          onComplete={(answers, notes) => {
            void apply((d, c) => commitScreening(d, answers, notes, true, c));
            if (firstRun) setStep('goal');
            else navigate('/', { replace: true });
          }}
        />
      </Page>
    );
  }

  if (step === 'goal') {
    return <GoalStep onDone={() => setStep('cue')} />;
  }

  if (step === 'cue') {
    return <CueStep onDone={() => setStep('days')} />;
  }

  // days — finishing set-up is a deliberate action, so this is when the app asks
  // the browser to keep its data (never at first launch).
  return (
    <DaysStep
      lang={lang}
      onDone={() => {
        void requestPersistentStorage();
        navigate('/', { replace: true });
      }}
    />
  );
}

function RegionStep({ onDone }: { onDone: () => void }) {
  const { apply } = useStore();
  const { t } = useI18n();
  const [notNz, setNotNz] = useState(false);
  return (
    <Page title={t.regionStep.title} lead={t.regionStep.body}>
      <Button
        variant="primary"
        large
        block
        onClick={() => {
          void apply((d, c) => updateProfile(d, { regionConfirmed: true, region: 'NZ' }, c));
          onDone();
        }}
      >
        {t.regionStep.confirm}
      </Button>
      <Button block onClick={() => setNotNz(true)}>
        {t.regionStep.notNz}
      </Button>
      {notNz ? (
        <p className="card card--info" role="status">
          {t.regionStep.notNzBody}
        </p>
      ) : null}
    </Page>
  );
}

export function GoalStep({ onDone }: { onDone: () => void }) {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const [goal, setGoal] = useState<GoalId | null>(data.profile.goal);
  const [own, setOwn] = useState(data.profile.goalText ?? '');
  return (
    <Page title={t.goalStep.title} lead={t.goalStep.body}>
      <ChoiceGroup<GoalId>
        legend={t.settings.goal}
        name="goal"
        value={goal}
        onChange={setGoal}
        choices={(['chair_rising', 'carrying', 'standing', 'confidence', 'own'] as GoalId[]).map((g) => ({ value: g, label: t.goals[g] }))}
      />
      {goal === 'own' ? (
        <div className="field">
          <label htmlFor="goal-own">{t.goalOwnLabel}</label>
          <input id="goal-own" type="text" maxLength={200} value={own} onChange={(e) => setOwn(e.target.value)} />
        </div>
      ) : null}
      <Button
        variant="primary"
        large
        block
        disabled={!goal || (goal === 'own' && !own.trim())}
        onClick={() => {
          void apply((d, c) => updateProfile(d, { goal, goalText: goal === 'own' ? own.trim().slice(0, 200) : null }, c));
          onDone();
        }}
      >
        {t.continue}
      </Button>
      <Button variant="link" onClick={onDone}>
        {t.goalStep.skip}
      </Button>
    </Page>
  );
}

export function CueStep({ onDone }: { onDone: () => void }) {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const options = t.cueStep.options;
  const existing = data.schedule.cue;
  const [choice, setChoice] = useState<string | null>(existing ? (options.includes(existing) ? existing : '__custom') : null);
  const [custom, setCustom] = useState(existing && !options.includes(existing) ? existing : '');
  const cue = choice === '__custom' ? custom.trim() : choice;
  return (
    <Page title={t.cueStep.title} lead={t.cueStep.body}>
      <p style={{ fontSize: '1.35rem', fontWeight: 600 }}>{t.cueStep.template}</p>
      <ChoiceGroup<string>
        legend={t.settings.cue}
        name="cue"
        value={choice}
        onChange={setChoice}
        choices={[...options.map((o) => ({ value: o, label: o })), { value: '__custom', label: t.cueStep.custom }]}
      />
      {choice === '__custom' ? (
        <div className="field">
          <label htmlFor="cue-custom">{t.cueStep.customLabel}</label>
          <input id="cue-custom" type="text" maxLength={200} value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
      ) : null}
      {cue ? <p className="card card--accent">{t.cueSentence(cue)}</p> : null}
      <Button
        variant="primary"
        large
        block
        disabled={!cue}
        onClick={() => {
          void apply((d, c) => setScheduleDetails(d, { cue: cue ? cue.slice(0, 200) : null }, c));
          onDone();
        }}
      >
        {t.continue}
      </Button>
      <Button variant="link" onClick={onDone}>
        {t.cueStep.skip}
      </Button>
    </Page>
  );
}

export function DaysPicker({ onSaved, submitLabel }: { onSaved: () => void; submitLabel: string }) {
  const { data, apply } = useStore();
  const { t, lang } = useI18n();
  const [days, setDays] = useState<Weekday[]>(data.schedule.weekdays);
  const check = validateScheduleDays(days);
  return (
    <div className="stack">
      <fieldset className="choice-group">
        <legend>{t.settings.days}</legend>
        <p className="muted">{t.settings.daysHint}</p>
        <div className="choice-list">
          {WEEKDAYS.map((day) => (
            <label key={day} className="choice">
              <input
                type="checkbox"
                checked={days.includes(day)}
                onChange={(e) => setDays(e.target.checked ? [...days, day] : days.filter((d) => d !== day))}
              />
              <span>{weekdayLabel(day, lang)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {!check.ok ? (
        <p role="alert" className="card card--info">
          {t.settings.daysError[check.reason]}
        </p>
      ) : null}
      <Button
        variant="primary"
        large
        block
        disabled={!check.ok}
        onClick={() => {
          void apply((d, c) => setWeekdays(d, days, c));
          onSaved();
        }}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

function DaysStep({ onDone }: { lang: string; onDone: () => void }) {
  const { t } = useI18n();
  return (
    <Page title={t.daysStep.title} lead={t.daysStep.body}>
      <DaysPicker onSaved={onDone} submitLabel={t.finishOnboarding} />
    </Page>
  );
}
