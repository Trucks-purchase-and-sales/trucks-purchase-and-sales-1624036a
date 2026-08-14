import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";
import de from "./locales/de.json";

export const SUPPORTED_LOCALES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Deutsch" },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  nl: { translation: nl },
  de: { translation: de },
};


// Initialize immediately at import time with a deterministic FR language on
// both server and client, so SSR HTML matches the initial client render
// (avoids React hydration mismatch / minified error #418).
// The detected/preferred language is applied AFTER hydration (see below).
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: "fr",
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
    interpolation: { escapeValue: false },
  });
}

/**
 * Called from a client-only effect after hydration to switch to the user's
 * preferred locale (localStorage → navigator). Safe to call multiple times.
 */
export function applyClientLocale() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem("wilmet.locale");
    const navLang = window.navigator?.language?.slice(0, 2);
    const supported = SUPPORTED_LOCALES.map((l) => l.code) as string[];
    const target =
      stored && supported.includes(stored)
        ? stored
        : navLang && supported.includes(navLang)
          ? navLang
          : "fr";
    if (target !== i18n.language) void i18n.changeLanguage(target);
  } catch {
    /* ignore */
  }
}

export function initI18n() { return i18n; }

export default i18n;
