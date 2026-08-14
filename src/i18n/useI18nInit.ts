import { useEffect } from "react";
import { applyClientLocale, initI18n } from "@/i18n";

export function useI18nInit() {
  useEffect(() => {
    initI18n();
    // Apply the user's preferred locale AFTER hydration so SSR and initial
    // client render match (both start in FR).
    applyClientLocale();
  }, []);
}
