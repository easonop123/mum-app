import { useState } from 'react';
import { EXERCISES } from '../../content/exercises';
import { PROGRAM } from '../../content/program';
import { updateProfile } from '../../data/actions';
import { totals, weekActivity } from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { formatLocalDate, formatMonth, monthDates, monthOf, shiftMonth, weekDates, weekdayLabel, weekdayOf, weekdayIndex } from '../../lib/dates';
import { shareText, copyText } from '../../lib/download';
import { WEEKDAYS } from '../../domain/types';
import { Button, Page } from '../components/ui';
import { repsDone } from '../../program/session';

export function ProgressScreen() {
  const { data, today, apply } = useStore();
  const { t, L, lang } = useI18n();
  const week = weekActivity(data, today);
  const sum = totals(data);
  const [month, setMonth] = useState(() => monthOf(today));
  const practiceDays = new Set(data.sessions.map((s) => s.localDate));
  const learnDays = new Set(data.learningVisits);
  const recent = [...data.sessions].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, 10);

  const dayCell = (d: string) => {
    const practised = practiceDays.has(d);
    const learned = learnDays.has(d);
    const label = `${formatLocalDate(d, lang)}${practised ? ` — ${t.progress.practisedOn}` : ''}${learned ? ` — ${t.progress.learnedOn}` : ''}`;
    return (
      <div key={d} className={`calendar__day${d === today ? ' is-today' : ''}`} role="listitem" aria-label={label}>
        <span aria-hidden="true">{Number(d.slice(8, 10))}</span>
        <span aria-hidden="true" className="progress-dots">
          {practised ? <span className="mark mark--practice" /> : null}
          {learned ? <span className="mark mark--learn" /> : null}
        </span>
      </div>
    );
  };

  const days = monthDates(month.year, month.month);
  const leading = weekdayIndex(weekdayOf(days[0]!));

  return (
    <Page title={t.progress.title}>
      <section className="card card--accent stack-sm">
        <p style={{ fontWeight: 700, fontSize: '1.35rem' }}>{t.progress.weekCount(week.practiceDays)}</p>
        {week.learningDays > 0 ? <p>{t.progress.learningCount(week.learningDays)}</p> : null}
        <p>{t.progress.practices(sum.practices)}</p>
        <p>{t.progress.reps(sum.repetitions)}</p>
        <p>{t.progress.stage(data.stage)}</p>
        {sum.practices > 0 ? <p>{t.tone.keep}</p> : null}
      </section>

      {sum.practices === 0 && data.learningVisits.length === 0 ? <p>{t.progress.none}</p> : null}

      <section className="stack-sm">
        <h2>{t.progress.week}</h2>
        <div className="calendar" role="list" aria-label={t.progress.week}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="calendar__head" aria-hidden="true">
              {weekdayLabel(w, lang, 'short')}
            </div>
          ))}
          {weekDates(today).map(dayCell)}
        </div>
        <p className="muted">
          <span className="mark mark--practice" aria-hidden="true" /> / <span className="mark mark--learn" aria-hidden="true" /> {t.progress.legend}
        </p>
      </section>

      <section className="stack-sm">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{formatMonth(month.year, month.month, lang)}</h2>
          <div className="row">
            <Button variant="quiet" ariaLabel={t.progress.prevMonth} onClick={() => setMonth(shiftMonth(month.year, month.month, -1))}>
              ‹
            </Button>
            <Button variant="quiet" ariaLabel={t.progress.nextMonth} onClick={() => setMonth(shiftMonth(month.year, month.month, 1))}>
              ›
            </Button>
          </div>
        </div>
        <div className="calendar" role="list" aria-label={formatMonth(month.year, month.month, lang)}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="calendar__head" aria-hidden="true">
              {weekdayLabel(w, lang, 'short')}
            </div>
          ))}
          {Array.from({ length: leading }, (_, i) => (
            <div key={`pad-${i}`} aria-hidden="true" />
          ))}
          {days.map(dayCell)}
        </div>
      </section>

      {sum.practices > 0 ? (
        <section className="stack-sm">
          <h2>{t.progress.byExercise}</h2>
          <ul>
            {PROGRAM.exerciseOrder.map((id) => (
              <li key={id}>
                {L(EXERCISES[id].name)}: {t.progress.times(sum.byExercise[id] ?? 0)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="stack-sm">
          <h2>{t.progress.recent}</h2>
          <ul className="list-plain">
            {recent.map((s) => (
              <li key={s.id}>
                <p style={{ fontWeight: 600, margin: 0 }}>
                  {formatLocalDate(s.localDate, lang)} · {t.progress.mode[s.mode]}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  {t.progress.outcome[s.outcome]} · {repsDone(s.performed)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EncouragementNote
        value={data.profile.encouragementNote}
        onSave={(v) => void apply((d, c) => updateProfile(d, { encouragementNote: v }, c))}
      />

      <section className="card card--muted stack-sm">
        <h2>{t.progress.laterTitle}</h2>
        <p>{t.plan.coverage}</p>
        <p>{t.plan.aboutNumbers}</p>
      </section>

      <ShareUpdate count={week.practiceDays} />
    </Page>
  );
}

function EncouragementNote({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState(value ?? '');
  const [saved, setSaved] = useState(false);
  return (
    <section className="stack-sm">
      <h2>
        <label htmlFor="encouragement">{t.progress.encouragement}</label>
      </h2>
      <p className="muted">{t.progress.encouragementHint}</p>
      <textarea
        id="encouragement"
        maxLength={500}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <Button
        onClick={() => {
          onSave(text.trim() ? text.trim() : null);
          setSaved(true);
        }}
      >
        {t.save}
      </Button>
      {saved ? <p role="status">{t.saved}</p> : null}
    </section>
  );
}

/** Opt-in, editable, never automatic. Contains no symptoms or missed sessions by default. */
function ShareUpdate({ count }: { count: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => t.progress.shareDefault(count));
  const [status, setStatus] = useState<string | null>(null);
  if (!open) {
    return (
      <Button block onClick={() => setOpen(true)}>
        {t.progress.shareTitle}
      </Button>
    );
  }
  return (
    <section className="card stack-sm" aria-labelledby="share-heading">
      <h2 id="share-heading">{t.progress.shareTitle}</h2>
      <p>{t.progress.shareIntro}</p>
      <div className="field">
        <label htmlFor="share-text">{t.progress.shareText}</label>
        <textarea id="share-text" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Button
        variant="primary"
        block
        onClick={async () => {
          const r = await shareText(text);
          setStatus(r === 'copied' ? t.progress.copied : null);
        }}
      >
        {t.progress.shareOpen}
      </Button>
      <Button
        block
        onClick={async () => {
          const r = await copyText(text);
          setStatus(r === 'copied' ? t.progress.copied : t.progress.copyFailed);
        }}
      >
        {t.progress.shareCopy}
      </Button>
      {status ? <p role="status">{status}</p> : null}
      <Button variant="link" onClick={() => setOpen(false)}>
        {t.progress.shareDone}
      </Button>
    </section>
  );
}
