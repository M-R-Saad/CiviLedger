import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import en from "./locales/en.json";
import bn from "./locales/bn.json";

/**
 * Zero-dependency bilingual layer. Interface is deliberately shaped like
 * react-i18next's `t()` so Phase 1 can swap in the real library without
 * touching call sites.
 */

export type Lang = "en" | "bn";

const catalogs: Record<Lang, Record<string, string>> = {
  en: en as Record<string, string>,
  bn: bn as Record<string, string>,
};

const LS_KEY = "civiledger_lang";

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "en" || stored === "bn") return stored;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {
      /* storage unavailable */
    }
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let value = catalogs[lang][key] ?? catalogs.en[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replace(
            new RegExp(`\\{${name}\\}`, "g"),
            String(replacement)
          );
        }
      }
      return value;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within an I18nProvider");
  return ctx;
}
