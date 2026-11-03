import { useState } from 'react';
import { WEEKDAYS, type Weekday } from '../../domain/types';
import { setWeekdays, updateProfile } from '../../data/actions';
import { requestPersistentStorage } from '../../data/db';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { weekdayLabel } from '../../lib/dates';
import { validateScheduleDays } from '../../program/schedule';
import { Button, ChoiceGroup, Page } from '../components/ui';
import { navigate } from '../router';

/** One screen: choose a language and start. No questions. */
export function WelcomeScreen() {
  const { data, apply } = useStore();
  const { t } = useI18n();
  return (
    <Page title={t.welcome.title}>
      <p>{t.welcome.body}</p>
      <ChoiceGroup
        legend={t.welcome.language}
        name="language"
        value={data.profile.language}
        onChange={(v) => void apply((d, c) => updateProfile(d, { language: v as 'en' | 'zh' }, c))}
        choices={[
          { value: 'en', label: <span lang="en">English</span> },
          { value: 'zh', label: <span lang="zh-Hans">简体中文</span> },
        ]}
      />
      <p className="card card--muted">{t.welcome.note}</p>
      <Button
        variant="primary"
        large
        block
        onClick={() => {
          void apply((d, c) => updateProfile(d, { optedIn: true }, c));
          // Ask the browser to keep the data (never at first launch, only on this tap).
          void requestPersistentStorage();
          navigate('/', { replace: true });
        }}
      >
        {t.welcome.start}
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
