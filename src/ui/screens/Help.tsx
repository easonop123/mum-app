import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { BILINGUAL } from '../../i18n/strings';
import { HelpNumbers, LinkButton, Page } from '../components/ui';

/** Always reachable from the header, in both languages, even in an emergency state. */
export function HelpScreen() {
  const { data } = useStore();
  const { t } = useI18n();
  return (
    <Page title={t.help.title}>
      <div className="card card--safety stack-sm">
        <p style={{ fontWeight: 650 }}>{t.help.emergency}</p>
        <p>{t.help.healthline}</p>
      </div>
      <HelpNumbers />
      <p className="card card--muted">{t.help.whileExercising}</p>
      <h2>{t.help.call111If}</h2>
      <ul>
        {t.questions.emergencySigns.items!.map((i) => (
          <li key={i}>{i}</li>
        ))}
        <li>{t.stopFlow.options.chest_faint_breathing}</li>
      </ul>
      <p lang="zh-Hans" className="card card--muted">
        {BILINGUAL.emergencyZh}
      </p>
      <h2>{t.help.gpSoon}</h2>
      <ul>
        {[...t.questions.urgentSigns.items!, ...t.questions.reviewSigns.items!].map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p>{t.help.soreness}</p>
      <p>{t.help.cantDiagnose}</p>
      {data.activeSession ? (
        <LinkButton to="/session" variant="primary" block>
          {t.help.backToSession}
        </LinkButton>
      ) : null}
    </Page>
  );
}
