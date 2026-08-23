import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18nInit } from "@/i18n/useI18nInit";

type Search = { ref?: string; tracked?: number };

export const Route = createFileRoute("/chercher-un-vehicule/merci")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    tracked: s.tracked === 1 || s.tracked === "1" ? 1 : 0,
  }),
  head: () => ({
    meta: [{ title: "Merci — Wilmet Trucks" }, { name: "robots", content: "noindex" }],
  }),
  component: BuyerLeadThanks,
});

function BuyerLeadThanks() {
  useI18nInit();
  const { t } = useTranslation();
  const { ref, tracked } = Route.useSearch();

  // Presentation only: the flag comes from the submit result, and the live
  // session acts as a sanity check so a signed-in buyer never sees a
  // "create an account" CTA.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setSignedIn(!!data?.user);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isTracked = tracked === 1 || signedIn === true;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-9 w-auto" />
          </Link>
          <LanguageSwitcher compact />
        </div>
      </header>
      <main className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("buyer.success.title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {isTracked ? t("buyer.success.trackedText") : t("buyer.success.text")}
          </p>
          {ref && (
            <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("buyer.success.reference")}
              </span>
              <span className="mt-1 font-mono text-sm font-semibold">{ref}</span>
            </div>
          )}
          {!isTracked && (
            <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-muted-foreground">
              {t("buyer.success.untrackedNote")}
            </p>
          )}
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
            {isTracked ? (
              <>
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Link to="/mes-demandes">
                    {t("buyer.success.viewRequests")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/chercher-un-vehicule">{t("buyer.success.newRequest")}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Link to="/auth" search={{ mode: "signup", kind: "client" } as never}>
                    {t("buyer.success.createAccount")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/">{t("buyer.success.home")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
