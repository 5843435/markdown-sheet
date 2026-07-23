import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale, TranslationKey } from "./types";
import { en } from "./locales/en";
import { ja } from "./locales/ja";
import { zh } from "./locales/zh";
import { es } from "./locales/es";
import { hi } from "./locales/hi";
import { ar } from "./locales/ar";
import { pt } from "./locales/pt";

export type { Locale, TranslationKey } from "./types";

const DICTS: Record<Locale, Record<TranslationKey, string>> = { en, ja, zh, es, hi, ar, pt };

/** Display order for the language switcher. */
export const SUPPORTED_LOCALES: Locale[] = ["en", "ja", "zh", "es", "hi", "ar", "pt"];

/** Each language written in its own script — shown in the language switcher. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  zh: "简体中文",
  es: "Español",
  hi: "हिन्दी",
  ar: "العربية",
  pt: "Português",
};

/** English names used inside AI prompts so the model targets the right output language. */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  en: "English",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
  es: "Spanish",
  hi: "Hindi",
  ar: "Arabic",
  pt: "Portuguese",
};

const RTL_LOCALES: Locale[] = ["ar"];
const STORAGE_KEY = "md-lang";

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_LOCALES as string[]).includes(saved)) return saved as Locale;
  } catch {
    /* localStorage unavailable */
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  // Order matters: match the most specific expectations first.
  const prefixes: [string, Locale][] = [
    ["ja", "ja"],
    ["zh", "zh"],
    ["es", "es"],
    ["hi", "hi"],
    ["ar", "ar"],
    ["pt", "pt"],
    ["en", "en"],
  ];
  for (const [p, loc] of prefixes) {
    if (nav.startsWith(p)) return loc;
  }
  return "en";
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export type TFunc = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunc;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());
  const dir: "ltr" | "rtl" = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("lang", locale);
    document.documentElement.setAttribute("dir", dir);
  }, [locale, dir]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const t = useCallback<TFunc>(
    (key, params) => {
      const dict = DICTS[locale] || en;
      const template = dict[key] ?? en[key] ?? key;
      return interpolate(template, params);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t, dir }), [locale, setLocale, t, dir]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT(): TFunc {
  return useI18n().t;
}
