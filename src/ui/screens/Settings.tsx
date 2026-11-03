import { useEffect, useState } from 'react';
import { SOURCES } from '../../content/sources';
import { CONTENT_REVIEW_DATE } from '../../content/version';
import { PROGRAM } from '../../content/program';
import { VIDEO_ENTRIES, EDUCATION_ENTRIES, formatDuration } from '../../content/videos';
import type { GoalId } from '../../domain/types';
import { setScheduleDetails, updateProfile } from '../../data/actions';
import { DEFAULT_TIMEZONE } from '../../data/defaults';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { deviceTimeZone, formatLocalDate, weekdayLabel } from '../../lib/dates';
import { buildPracticeIcs } from '../../lib/ics';
import { downloadText } from '../../lib/download';
import { findVoice, speak, speechSupported, voicesReady } from '../../lib/speech';
import { nextScheduledDay } from '../../program/schedule';
import { BackLink, Button, ChoiceGroup, LinkButton, Page } from '../components/ui';
import { href } from '../router';
import { DaysPicker, CueStep, GoalStep } from './Onboarding';

export function SettingsIndex() {
  const { t } = useI18n();
  const s = t.settings.sections;
  const links: Array<[string, string]> = [
    ['/settings/display', s.display],
    ['/settings/schedule', s.schedule],
    ['/plan', s.plan],
    ['/learn', s.learn],
    ['/settings/health', s.health],
    ['/settings/advice', s.advice],
    ['/settings/clinician-plan', s.clinicianPlan],
    ['/settings/summary', s.summary],
    ['/settings/setup', s.setup],
    ['/settings/dumbbells', s.dumbbells],
    ['/settings/reminders', s.reminders],
    ['/settings/install', s.install],
    ['/settings/data', s.data],
    ['/settings/sources', s.sources],
    ['/settings/about', s.about],
  ];
  return (
    <Page title={t.settings.title}>
      <ul className="list-plain settings-list">
        {links.map(([to, label]) => (
          <li key={to}>
            <a href={href(to)}>{label}</a>
          </li>
        ))}
      </ul>
    </Page>
  );
}

const TEXT_SCALES = [1, 1.15, 1.3, 1.5];

export function DisplaySettings() {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [name, setName] = useState(data.profile.displayName ?? '');
  const [year, setYear] = useState(data.profile.birthYear ? String(data.profile.birthYear) : '');
  const [yearError, setYearError] = useState(false);
  const device = deviceTimeZone();

  useEffect(() => {
    if (data.profile.voice === 'off') {
      setVoiceStatus(null);
      return;
    }
    if (!speechSupported()) {
      setVoiceStatus(t.settings.voiceUnsupported);
      return;
    }
    void voicesReady().then(() => {
      setVoiceStatus(data.profile.voice === 'mandarin' && !findVoice('mandarin') ? t.settings.voiceMissingZh : null);
    });
  }, [data.profile.voice, t]);

  return (
    <Page title={t.settings.sections.display}>
      <BackLink to="/settings" />
      <ChoiceGroup
        legend={t.languageStep.title}
        name="lang"
        value={data.profile.language}
        onChange={(v) => void apply((d, c) => updateProfile(d, { language: v as 'en' | 'zh' }, c))}
        choices={[
          { value: 'en', label: <span lang="en">English</span> },
          { value: 'zh', label: <span lang="zh-Hans">简体中文</span> },
        ]}
      />
      <ChoiceGroup
        legend={t.settings.textSize}
        name="text-size"
        value={String(data.profile.textScale)}
        onChange={(v) => void apply((d, c) => updateProfile(d, { textScale: Number(v) }, c))}
        choices={TEXT_SCALES.map((s, i) => ({ value: String(s), label: t.settings.textSizes[i]! }))}
      />
      <ChoiceGroup
        legend={t.settings.voice}
        hint={t.languageStep.voiceBody}
        name="voice"
        value={data.profile.voice}
        onChange={(v) => void apply((d, c) => updateProfile(d, { voice: v as 'off' | 'mandarin' | 'english' }, c))}
        choices={[
          { value: 'off', label: t.languageStep.voiceOff },
          { value: 'mandarin', label: t.languageStep.voiceMandarin },
          { value: 'english', label: t.languageStep.voiceEnglish },
        ]}
      />
      {data.profile.voice !== 'off' ? (
        <Button
          onClick={async () => {
            const kind = data.profile.voice === 'english' ? 'english' : 'mandarin';
            const r = await speak(kind === 'english' ? 'Hello. This is how the spoken cues will sound.' : '你好。语音提示就是这样的声音。', kind);
            setVoiceStatus(r === 'ok' ? null : r === 'no_voice' ? t.settings.voiceMissingZh : t.settings.voiceUnsupported);
          }}
        >
          {t.settings.testVoice}
        </Button>
      ) : null}
      {voiceStatus ? <p role="status">{voiceStatus}</p> : null}

      <section className="stack-sm">
        <h2>{t.settings.region}</h2>
        <p>{t.settings.timezone(data.schedule.timezone)}</p>
        {device && device !== data.schedule.timezone ? (
          <Button onClick={() => void apply((d, c) => setScheduleDetails(d, { timezone: device }, c))}>{t.settings.useDeviceTz(device)}</Button>
        ) : null}
        {data.schedule.timezone !== DEFAULT_TIMEZONE ? (
          <Button variant="quiet" onClick={() => void apply((d, c) => setScheduleDetails(d, { timezone: DEFAULT_TIMEZONE }, c))}>
            {t.settings.useAuckland}
          </Button>
        ) : null}
      </section>

      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const y = year.trim() ? Number(year) : null;
          const valid = y === null || (Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear());
          setYearError(!valid);
          if (!valid) return;
          void apply((d, c) => updateProfile(d, { displayName: name.trim() ? name.trim().slice(0, 60) : null, birthYear: y }, c));
        }}
      >
        <div className="field">
          <label htmlFor="display-name">{t.settings.name}</label>
          <input id="display-name" type="text" maxLength={60} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="birth-year">{t.settings.birthYear}</label>
          <input id="birth-year" type="number" inputMode="numeric" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} aria-invalid={yearError} />
        </div>
        {yearError ? <p role="alert">{t.settings.birthYearInvalid}</p> : null}
        <Button type="submit">{t.save}</Button>
      </form>
    </Page>
  );
}

export function ScheduleSettings() {
  const { data } = useStore();
  const { t } = useI18n();
  const [section, setSection] = useState<'days' | 'cue' | 'goal' | null>(null);
  const [saved, setSaved] = useState(false);
  if (section === 'cue') return <CueStep onDone={() => setSection(null)} />;
  if (section === 'goal') return <GoalStep onDone={() => setSection(null)} />;
  const goal: GoalId | null = data.profile.goal;
  return (
    <Page title={t.settings.sections.schedule}>
      <BackLink to="/settings" />
      <DaysPicker onSaved={() => setSaved(true)} submitLabel={t.save} />
      {saved ? <p role="status">{t.saved}</p> : null}
      <section className="card stack-sm">
        <h2>{t.settings.cue}</h2>
        <p>{data.schedule.cue ? t.cueSentence(data.schedule.cue) : t.cueStep.template}</p>
        <Button onClick={() => setSection('cue')}>{t.settings.cue}</Button>
      </section>
      <section className="card stack-sm">
        <h2>{t.settings.goal}</h2>
        <p>{goal ? (goal === 'own' ? data.profile.goalText : t.goals[goal]) : '—'}</p>
        <Button onClick={() => setSection('goal')}>{t.settings.goal}</Button>
      </section>
    </Page>
  );
}

export function RemindersScreen() {
  const { data, today } = useStore();
  const { t, lang } = useI18n();
  const [time, setTime] = useState(data.schedule.reminderTime ?? '10:00');
  const [made, setMade] = useState(false);
  const days = data.schedule.weekdays.map((d) => weekdayLabel(d, lang)).join(lang === 'zh' ? '、' : ', ');
  return (
    <Page title={t.reminders.title} lead={t.reminders.intro}>
      <BackLink to="/settings" />
      <section className="card stack-sm">
        <h2>{t.reminders.remindersTitle}</h2>
        <ol>
          {t.reminders.remindersSteps(days).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="muted">{t.reminders.labelsVary}</p>
      </section>
      <section className="card stack-sm">
        <h2>{t.reminders.calendarTitle}</h2>
        <p>{t.reminders.calendarBody}</p>
        <div className="field">
          <label htmlFor="reminder-time">{t.reminders.time}</label>
          <input id="reminder-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Button
          variant="primary"
          block
          disabled={!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)}
          onClick={() => {
            const first = nextScheduledDay(data.schedule, today) ?? today;
            const ics = buildPracticeIcs({
              weekdays: data.schedule.weekdays,
              time,
              timezone: data.schedule.timezone,
              firstDate: first,
              title: t.reminders.eventTitle,
              description: t.reminders.eventBody,
              uid: `${crypto.randomUUID?.() ?? Date.now()}@a-little-stronger.app`,
              nowIso: new Date().toISOString(),
            });
            downloadText('a-little-practice.ics', ics, 'text/calendar;charset=utf-8');
            setMade(true);
          }}
        >
          {t.reminders.makeFile}
        </Button>
        {made ? <p role="status">{t.reminders.made}</p> : null}
      </section>
    </Page>
  );
}

export function InstallScreen() {
  const { t } = useI18n();
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return (
    <Page title={t.install.title}>
      <BackLink to="/settings" />
      <p className="card card--muted">{standalone ? t.install.installed : t.install.inBrowser}</p>
      <ol>
        {t.install.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="muted">{t.install.note}</p>
      <p className="card card--info">{t.install.dataNote}</p>
      <p>{t.install.offline}</p>
      <LinkButton to="/settings/data">{t.settings.sections.data}</LinkButton>
    </Page>
  );
}

export function SourcesScreen() {
  const { t, L, lang } = useI18n();
  return (
    <Page title={t.sources.title}>
      <BackLink to="/settings" />
      <p>{t.sources.reviewed(formatLocalDate(CONTENT_REVIEW_DATE, lang), PROGRAM.version)}</p>
      <h2>{t.sources.limitationsTitle}</h2>
      <ul>
        {t.sources.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <h2>{t.sources.guidanceTitle}</h2>
      <ul className="list-plain">
        {SOURCES.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {L(s.label)}
            </a>
            <p className="muted" style={{ margin: 0 }}>
              {L(s.usedFor)}
            </p>
          </li>
        ))}
      </ul>
      <h2>{t.sources.videosTitle}</h2>
      <ul className="list-plain">
        {VIDEO_ENTRIES.map((v) => (
          <li key={v.variantId}>
            <a href={v.watchUrl} target="_blank" rel="noopener noreferrer">
              {L(v.label)}
            </a>
            <p className="muted" style={{ margin: 0 }}>
              {v.publisher} · {formatDuration(v.durationSeconds)} · {v.videoId}
            </p>
            <ul>
              {v.role === 'reference-only' ? <li>{t.sources.videoStatus.referenceOnly}</li> : null}
              <li>{t.sources.videoStatus.sourceChecked(v.sourceCheckedAt ?? '?')}</li>
              <li>{t.sources.videoStatus.visualPending}</li>
              <li>{t.sources.videoStatus.notTested}</li>
              <li>{t.sources.videoStatus.offline}</li>
              <li>{L(v.qualification)}</li>
            </ul>
          </li>
        ))}
        {EDUCATION_ENTRIES.map((e) => (
          <li key={e.id}>
            <a href={e.watchUrl} target="_blank" rel="noopener noreferrer">
              {L(e.label)}
            </a>
            <p className="muted" style={{ margin: 0 }}>
              {e.publisher} · {formatDuration(e.durationSeconds)}
            </p>
            <p style={{ margin: 0 }}>{L(e.note)}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function AboutScreen() {
  const { t } = useI18n();
  return (
    <Page title={t.about.title}>
      <BackLink to="/settings" />
      {t.about.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <p lang="zh-Hans" className="card card--info">
        关于这些数字：起始的量和每个阶段之间的变化，是为这个应用定下的谨慎建议，不是专门为你开的医疗处方。请以你的医生或物理治疗师的意见为准。
      </p>
      <p>{t.plan.coverage}</p>
    </Page>
  );
}
