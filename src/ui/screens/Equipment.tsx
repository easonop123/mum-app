import { useState, type ComponentType } from 'react';
import { SETUP_ITEM_IDS, type Answer, type DumbbellConfig, type SetupItemId } from '../../domain/types';
import { removeDumbbell, saveDumbbell, setSetupItem } from '../../data/actions';
import { setupComplete } from '../../data/selectors';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { BackLink, Button, ChoiceGroup, Page, StatusLabel } from '../components/ui';
import { BreathIcon, ChairIcon, CounterIcon, FloorIcon, PhoneIcon, ShoeIcon, WallIcon } from '../components/Icons';

const ITEM_ICONS: Record<SetupItemId, ComponentType<{ size?: number }>> = {
  chair_solid: ChairIcon,
  chair_wall_floor: WallIcon,
  chair_height: FloorIcon,
  counter_stable: CounterIcon,
  footwear_space: ShoeIcon,
  phone_position: PhoneIcon,
  breathing_pace: BreathIcon,
};

export function SetupScreen() {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const setup = data.equipment.find((e) => e.kind === 'setup_check');
  const items = setup && setup.kind === 'setup_check' ? setup.items : {};
  const done = setupComplete(data);
  return (
    <Page title={t.setup.title} lead={t.setup.intro}>
      <BackLink to="/settings" />
      <ol className="list-plain">
        {SETUP_ITEM_IDS.map((id) => {
          const Icon = ITEM_ICONS[id];
          return (
            <li key={id} className="stack-sm">
              <ChoiceGroup<Answer>
                name={`setup-${id}`}
                legend={
                  <span className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--accent)' }}>
                      <Icon size={34} />
                    </span>
                    <span>{t.setup.items[id]}</span>
                  </span>
                }
                value={items[id] ?? null}
                onChange={(v) => void apply((d, c) => setSetupItem(d, id, v, c))}
                choices={[
                  { value: 'yes', label: t.setup.answers.yes },
                  { value: 'no', label: t.setup.answers.no },
                  { value: 'unsure', label: t.setup.answers.unsure },
                ]}
              />
              {id === 'chair_height' ? <p className="muted">{t.setup.armrest}</p> : null}
            </li>
          );
        })}
      </ol>
      <div className={`card ${done ? 'card--accent' : 'card--info'}`} role="status">
        <StatusLabel kind="info">{done ? t.setup.complete : t.setup.incomplete}</StatusLabel>
      </div>
    </Page>
  );
}

function parseKg(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

/** Postponed calibration. Unknown values are allowed and never produce a prescription. */
export function DumbbellsScreen() {
  const { data, apply } = useStore();
  const { t } = useI18n();
  const dumbbells = data.equipment.filter((e): e is DumbbellConfig => e.kind === 'dumbbell');
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [handles, setHandles] = useState('');
  const [configs, setConfigs] = useState<Array<{ label: string; kg: string }>>([{ label: '', kg: '' }]);
  const [increment, setIncrement] = useState('');
  const [locking, setLocking] = useState<Answer>('unsure');
  const [weighed, setWeighed] = useState<Answer>('unsure');
  const [notes, setNotes] = useState('');

  return (
    <Page title={t.settings.sections.dumbbells}>
      <BackLink to="/settings" />
      <p>{t.dumbbells.intro}</p>
      <div className="card card--info stack-sm">
        <p>{t.dumbbells.unavailable}</p>
        <p>{t.dumbbells.maxNote}</p>
        <p>{t.dumbbells.recheck}</p>
      </div>
      {dumbbells.length === 0 ? <p className="muted">{t.dumbbells.none}</p> : null}
      <ul className="list-plain">
        {dumbbells.map((d) => (
          <li key={d.id} className="stack-sm">
            <p style={{ fontWeight: 650 }}>{d.label || '—'}</p>
            <p className="muted">
              {t.dumbbells.handles}: {d.handleCount ?? t.dumbbells.unknownValue} · {t.dumbbells.increment}: {d.smallestIncrementKg ?? t.dumbbells.unknownValue} ·{' '}
              {t.dumbbells.locking} {d.lockingSecure === 'yes' ? t.answers.yes : d.lockingSecure === 'no' ? t.answers.no : t.answers.unsure}
            </p>
            <ul>
              {d.configurations.map((c, i) => (
                <li key={i}>
                  {c.label || `${t.dumbbells.configLabel} ${i + 1}`}: {c.assembledKg === null ? t.dumbbells.unknownValue : `${c.assembledKg} ${t.dumbbells.kg}`}
                </li>
              ))}
            </ul>
            <Button variant="quiet" onClick={() => void apply((dd, c) => removeDumbbell(dd, d.id, c))}>
              {t.dumbbells.remove}
            </Button>
          </li>
        ))}
      </ul>
      {!editing ? (
        <Button onClick={() => setEditing(true)}>{t.dumbbells.add}</Button>
      ) : (
        <form
          className="stack card"
          onSubmit={(e) => {
            e.preventDefault();
            const handleCount = handles.trim() ? Math.max(0, Math.min(20, Math.round(Number(handles)) || 0)) : null;
            void apply((d, c) =>
              saveDumbbell(
                d,
                {
                  id: c.newId(),
                  kind: 'dumbbell',
                  label: label.slice(0, 100),
                  handleCount,
                  configurations: configs.filter((x) => x.label.trim() || x.kg.trim()).map((x) => ({ label: x.label.slice(0, 100), assembledKg: parseKg(x.kg) })),
                  smallestIncrementKg: parseKg(increment),
                  lockingSecure: locking,
                  weighedOnScale: weighed,
                  notes: notes.slice(0, 2000),
                  updatedAt: c.now,
                },
                c,
              ),
            );
            setEditing(false);
            setLabel('');
            setHandles('');
            setConfigs([{ label: '', kg: '' }]);
            setIncrement('');
            setNotes('');
          }}
        >
          <p className="muted">{t.dumbbells.weighTip}</p>
          <div className="field">
            <label htmlFor="db-label">{t.dumbbells.label}</label>
            <input id="db-label" type="text" maxLength={100} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="db-handles">{t.dumbbells.handles}</label>
            <input id="db-handles" type="number" inputMode="numeric" min={0} max={20} value={handles} onChange={(e) => setHandles(e.target.value)} placeholder={t.dumbbells.unknown} />
          </div>
          <fieldset className="choice-group stack-sm">
            <legend>{t.dumbbells.configs}</legend>
            {configs.map((cfg, i) => (
              <div key={i} className="row">
                <input
                  aria-label={`${t.dumbbells.configLabel} ${i + 1}`}
                  type="text"
                  maxLength={100}
                  style={{ flex: '2 1 8rem' }}
                  value={cfg.label}
                  placeholder={`${t.dumbbells.configLabel} ${i + 1}`}
                  onChange={(e) => setConfigs(configs.map((c, j) => (j === i ? { ...c, label: e.target.value } : c)))}
                />
                <input
                  aria-label={`${t.dumbbells.kg} (${t.dumbbells.configLabel} ${i + 1})`}
                  type="text"
                  inputMode="decimal"
                  style={{ flex: '1 1 5rem' }}
                  value={cfg.kg}
                  placeholder={`${t.dumbbells.kg} — ${t.dumbbells.unknown}`}
                  onChange={(e) => setConfigs(configs.map((c, j) => (j === i ? { ...c, kg: e.target.value } : c)))}
                />
              </div>
            ))}
            <Button variant="quiet" onClick={() => setConfigs([...configs, { label: '', kg: '' }])}>
              {t.dumbbells.addConfig}
            </Button>
          </fieldset>
          <div className="field">
            <label htmlFor="db-increment">{t.dumbbells.increment}</label>
            <input id="db-increment" type="text" inputMode="decimal" value={increment} onChange={(e) => setIncrement(e.target.value)} placeholder={t.dumbbells.unknown} />
          </div>
          <ChoiceGroup<Answer>
            legend={t.dumbbells.locking}
            name="db-locking"
            value={locking}
            onChange={setLocking}
            choices={[
              { value: 'yes', label: t.answers.yes },
              { value: 'no', label: t.answers.no },
              { value: 'unsure', label: t.answers.unknown },
            ]}
          />
          <ChoiceGroup<Answer>
            legend={t.dumbbells.weighed}
            name="db-weighed"
            value={weighed}
            onChange={setWeighed}
            choices={[
              { value: 'yes', label: t.answers.yes },
              { value: 'no', label: t.answers.no },
              { value: 'unsure', label: t.answers.unknown },
            ]}
          />
          <div className="field">
            <label htmlFor="db-notes">{t.dumbbells.notes}</label>
            <textarea id="db-notes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="row">
            <Button type="submit" variant="primary">
              {t.save}
            </Button>
            <Button variant="quiet" onClick={() => setEditing(false)}>
              {t.cancel}
            </Button>
          </div>
        </form>
      )}
    </Page>
  );
}
