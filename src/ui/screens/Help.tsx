import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { HelpNumbers, LinkButton, Page } from '../components/ui';

/** Always reachable from the header, in both languages. */
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
        {t.help.call111Items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p>{t.help.soreness}</p>
      <p>{t.help.gp}</p>
      {data.activeSession ? (
        <LinkButton to="/session" variant="primary" block>
          {t.help.backToSession}
        </LinkButton>
      ) : null}
    </Page>
  );
}
