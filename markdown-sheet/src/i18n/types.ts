import { en } from "./locales/en";

/** Every translation key. Derived from the English locale so it stays the single source of truth. */
export type TranslationKey = keyof typeof en;

/** Supported UI locales. `zh` is Simplified Chinese; `ar` is right-to-left. */
export type Locale = "en" | "ja" | "zh" | "es" | "hi" | "ar" | "pt";
