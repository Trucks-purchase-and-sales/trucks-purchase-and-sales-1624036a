import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "wilmet_cookie_consent_v1";

/**
 * Minimal RGPD-friendly banner.
 * Wilmet currently only sets strictly-necessary cookies, so a simple "OK" is enough.
 * If analytics/marketing cookies are added later, expand this to a proper preference center.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — do nothing
    }
  }, []);

  if (!visible) return null;

  function accept() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, ts: Date.now(), essential: true })); } catch { /* noop */ }
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentement cookies"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-lg border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Wilmet Trucks utilise uniquement les cookies strictement nécessaires à l'authentification et à la mémorisation
          de vos préférences. Aucun cookie d'audience ou publicitaire n'est déposé.{" "}
          <Link to="/cookies" className="underline underline-offset-2 hover:text-foreground">En savoir plus</Link>.
        </p>
        <Button onClick={accept} className="shrink-0" size="sm">J'ai compris</Button>
      </div>
    </div>
  );
}
