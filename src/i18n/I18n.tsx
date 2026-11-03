import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Lang, LocalizedText } from '../domain/types';
import { en, zh, type Strings } from './strings';

interface I18nValue {
  lang: Lang;
  t: Strings;
  /** Pick the right side of engine/content bilingual text. */
  L: (text: LocalizedText) => string;
}

const I18nContext = createContext<I18nValue>({ lang: 'en', t: en, L: (x) => x.en });

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ lang, t: lang === 'zh' ? zh : en, L: (x) => (lang === 'zh' ? x.zh : x.en) }), [lang]);
  useEffect(() => {
    document.documentElement.lang = value.t.htmlLang;
    document.title = lang === 'zh' ? '一点力' : '一点力 · A Little Stronger';
  }, [value, lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
