import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { en, zh, type TranslationKey } from "./dictionaries";

export type { TranslationKey };

export type Locale = "zh" | "en";

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { zh, en };
const LOCALE_KEY = "ui:locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(LOCALE_KEY);
    return stored === "en" || stored === "zh" ? stored : "zh";
  });

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem(LOCALE_KEY, l);
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      interpolate(DICTIONARIES[locale][key] ?? DICTIONARIES.zh[key] ?? key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
