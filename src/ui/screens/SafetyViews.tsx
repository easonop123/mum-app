import type { ProgramAccess } from '../../safety/gate';
import { useI18n } from '../../i18n/I18n';
import { BILINGUAL } from '../../i18n/strings';
import { HelpNumbers, LinkButton, ReasonList, StatusLabel } from '../components/ui';

/**
 * Calm emergency screen. No exercise entry points, no "try seated instead",
 * no "just walk", no rewards. Returning requires the re-screen flow.
 */
export function EmergencyView({ access }: { access: ProgramAccess }) {
  const { t } = useI18n();
  return (
    <section className="stack" aria-labelledby="emergency-heading" data-testid="emergency-view">
      <div className="card card--safety stack-sm">
        <StatusLabel kind="safety">
          <span id="emergency-heading" className="safety-heading">
            {t.emergency.heading}
          </span>
        </StatusLabel>
        <p lang="zh-Hans" style={{ fontSize: '1.35rem', fontWeight: 600 }}>
          {BILINGUAL.emergencyZh}
        </p>
        <p lang="en">{t.emergency.english}</p>
      </div>
      <HelpNumbers />
      <div className="card card--muted">
        <ReasonList reasons={access.reasons} />
        <p>{t.emergency.paused}</p>
      </div>
      <LinkButton to="/rescreen" block>
        {t.emergency.returnButton}
      </LinkButton>
    </section>
  );
}

export function UrgentView({ access }: { access: ProgramAccess }) {
  const { t } = useI18n();
  return (
    <section className="stack" aria-labelledby="urgent-heading" data-testid="urgent-view">
      <div className="card card--safety stack-sm">
        <StatusLabel kind="safety">
          <span id="urgent-heading" className="safety-heading">
            {t.urgent.heading}
          </span>
        </StatusLabel>
        <p>{t.urgent.body}</p>
        <ReasonList reasons={access.reasons} />
      </div>
      <p>{t.urgent.what}</p>
      <HelpNumbers />
      <p>{t.urgent.noExercise}</p>
      <LinkButton to="/rescreen" block>
        {t.urgent.returnButton}
      </LinkButton>
    </section>
  );
}

/** Shown in place of any workout route that the gate does not allow. */
export function BlockedPractice({ access }: { access: ProgramAccess }) {
  const { t } = useI18n();
  if (access.state === 'emergency_stop') return <EmergencyView access={access} />;
  if (access.state === 'urgent_assessment') return <UrgentView access={access} />;
  return (
    <section className="stack" data-testid="practice-blocked">
      <div className="card card--muted stack-sm">
        <StatusLabel kind="pause">{t.today.reasonsTitle}</StatusLabel>
        <ReasonList reasons={access.reasons} />
      </div>
      <LinkButton to="/" variant="primary" block>
        {t.checkIn.goToday}
      </LinkButton>
    </section>
  );
}
