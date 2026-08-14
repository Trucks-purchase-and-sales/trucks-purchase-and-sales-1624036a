import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18nInit } from "@/i18n/useI18nInit";

type Search = { ref?: string };

export const Route = createFileRoute("/chercher-un-vehicule/merci")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: () => ({ meta: [{ title: "Merci — Wilmet Trucks" }, { name: "robots", content: "noindex" }] }),
  component: BuyerLeadThanks,
});

function BuyerLeadThanks() {
  useI18nInit();
  const { t } = useTranslation();
  const { ref } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center"><img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-9 w-auto" /></Link>
          <LanguageSwitcher compact />
        </div>
      </header>
      <main className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{t("buyer.success.title")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{t("buyer.success.text")}</p>
          {ref && (
            <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{t("buyer.success.reference")}</span>
              <span className="mt-1 font-mono text-sm font-semibold">{ref}</span>
            </div>
          )}
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/auth" search={{ mode: "signup", kind: "client" } as never}>{t("buyer.success.createAccount")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg"><Link to="/">{t("buyer.success.home")}</Link></Button>
          </div>
        </div>
      </main>
    </div>
  );
}
