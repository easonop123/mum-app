import { useEffect } from 'react';
import { updateProfile } from './data/actions';
import { StoreProvider, useStore, type StoreProviderProps } from './data/store';
import { I18nProvider, useI18n } from './i18n/I18n';
import { LogoMark } from './ui/components/Icons';
import { href, navigate, useRoute } from './ui/router';
import { AutoUpdate, type UpdateSource } from './pwa/UpdateBanner';
import { TodayScreen } from './ui/screens/Today';
import { WelcomeScreen } from './ui/screens/Onboarding';
import { SessionScreen } from './ui/screens/Session';
import { ProgressScreen } from './ui/screens/Progress';
import { HelpScreen } from './ui/screens/Help';
import { LearnScreen, PlanScreen } from './ui/screens/Learn';
import { AboutScreen, DisplaySettings, InstallScreen, RemindersScreen, ScheduleSettings, SettingsIndex, SourcesScreen } from './ui/screens/Settings';
import { DataScreen, RecoveryScreen } from './ui/screens/DataScreen';

export function App({ updateSource = null, store }: { updateSource?: UpdateSource | null; store?: Omit<StoreProviderProps, 'children'> }) {
  return (
    <StoreProvider {...store}>
      <AppInner updateSource={updateSource} />
    </StoreProvider>
  );
}

function AppInner({ updateSource }: { updateSource: UpdateSource | null }) {
  const { data, status } = useStore();
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(data.profile.textScale));
  }, [data.profile.textScale]);
  if (status.kind === 'loading') {
    return (
      <p className="banner" role="status">
        Loading… 正在加载…
      </p>
    );
  }
  return (
    <I18nProvider lang={data.profile.language}>
      <Shell updateSource={updateSource} />
    </I18nProvider>
  );
}

function Shell({ updateSource }: { updateSource: UpdateSource | null }) {
  const { data, status, saveError, retrySave, apply } = useStore();
  const { t, lang } = useI18n();
  const route = useRoute();
  const inSession = route.path.startsWith('/session') && data.activeSession !== null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  if (status.kind === 'corrupt') {
    return (
      <div className="app">
        <main className="app-main" id="main">
          <RecoveryScreen />
        </main>
      </div>
    );
  }

  const nav = [
    { to: '/', label: t.nav.today, match: (p: string) => p === '/' || p.startsWith('/session') || p === '/welcome' },
    { to: '/progress', label: t.nav.progress, match: (p: string) => p.startsWith('/progress') },
    { to: '/settings', label: t.nav.settings, match: (p: string) => p.startsWith('/settings') || p.startsWith('/learn') || p === '/plan' },
  ];

  return (
    <div className={`app${inSession ? ' app--session' : ''}`}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        {lang === 'zh' ? '跳到主要内容' : 'Skip to main content'}
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <a className="app-title" href={href('/')} aria-label={t.appNameFull}>
            <LogoMark size={30} />
            <span lang="zh-Hans">一点力</span>
            <span className="app-title__en" lang="en">
              A Little Stronger
            </span>
          </a>
          <button
            type="button"
            className="btn btn--quiet lang-toggle"
            lang={lang === 'zh' ? 'en' : 'zh-Hans'}
            aria-label={t.switchLanguageLabel}
            onClick={() => void apply((d, c) => updateProfile(d, { language: d.profile.language === 'zh' ? 'en' : 'zh' }, c))}
          >
            {t.switchLanguage}
          </button>
          <a className="btn help-link" href={href('/help')} data-testid="help-link" aria-label="帮助 Help">
            <span lang="zh-Hans">帮助</span>
            <span lang="en" className="help-link__en">
              Help
            </span>
          </a>
        </div>
      </header>

      {saveError ? (
        <div className="banner" role="alert" data-testid="save-error">
          <div className="card card--safety row">
            <span style={{ flex: '1 1 12rem' }}>{t.saveFailed}</span>
            <button type="button" className="btn" onClick={() => void retrySave()}>
              {t.tryAgain}
            </button>
          </div>
        </div>
      ) : null}
      {status.kind === 'ready' && status.persistence === 'memory' ? (
        <div className="banner" role="alert">
          <p className="card card--safety">{t.storageUnavailable}</p>
        </div>
      ) : null}
      <AutoUpdate source={updateSource} hasActiveSession={data.activeSession !== null} routePath={route.path} />

      <main className="app-main" id="main" tabIndex={-1}>
        <Routes path={route.path} segments={route.segments} />
      </main>

      {!inSession ? (
        <nav className="bottom-nav" aria-label={t.nav.label}>
          <ul>
            {nav.map((n) => (
              <li key={n.to}>
                <a href={href(n.to)} aria-current={n.match(route.path) ? 'page' : undefined}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

function Routes({ path, segments }: { path: string; segments: string[] }) {
  const [first, second] = segments;
  switch (first) {
    case undefined:
      return <TodayScreen />;
    case 'welcome':
    case 'onboarding':
      return <WelcomeScreen />;
    case 'session':
      return <SessionScreen key={path} mode={second === 'full' || second === 'tiny' ? second : null} />;
    case 'progress':
      return <ProgressScreen />;
    case 'help':
      return <HelpScreen />;
    case 'learn':
      return <LearnScreen key={path} exerciseId={second ?? null} />;
    case 'plan':
      return <PlanScreen />;
    case 'settings':
      switch (second) {
        case undefined:
          return <SettingsIndex />;
        case 'display':
          return <DisplaySettings />;
        case 'schedule':
          return <ScheduleSettings />;
        case 'reminders':
          return <RemindersScreen />;
        case 'install':
          return <InstallScreen />;
        case 'sources':
          return <SourcesScreen />;
        case 'data':
          return <DataScreen />;
        case 'about':
          return <AboutScreen />;
        default:
          return <SettingsIndex />;
      }
    default:
      return <NotFound />;
  }
}

function NotFound() {
  useEffect(() => navigate('/', { replace: true }), []);
  return null;
}
