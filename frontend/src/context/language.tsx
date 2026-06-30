/**
 * Global language system: English (`en`) or Indonesian (`id`), persisted to
 * localStorage. Exposes a `t()` helper bound to the current language so
 * components translate without threading the language through props.
 *
 * Section/product names (Dashboard, Heatmap, Hotspots, Borobudur, etc.) stay
 * English in both locales — see lib/i18n.ts for why.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { translate } from "../lib/i18n";
import type { Lang, TranslationKey } from "../lib/i18n";

const STORAGE_KEY = "borobudur.lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a key for the current language, with optional `{var}` values. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLang(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "id" ? stored : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  // Persist and reflect the language on <html lang> for a11y/SEO.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
