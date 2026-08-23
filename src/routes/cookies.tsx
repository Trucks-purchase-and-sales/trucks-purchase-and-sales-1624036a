import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LegalLayout } from "@/components/LegalLayout";
import { Button } from "@/components/ui/button";
import { useI18nInit } from "@/i18n/useI18nInit";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Politique cookies — Wilmet Trucks" },
      { name: "description", content: "Gestion des cookies sur la plateforme Wilmet Trucks." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: Page,
});

function Page() {
  useI18nInit();
  const { t } = useTranslation();

  function resetConsent() {
    try {
      localStorage.removeItem("wilmet_cookie_consent_v1");
    } catch {
      /* noop */
    }
    // Reload so the banner reappears
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <LegalLayout title={t("legal.cookies.title")} updated={t("legal.updatedDate")}>
      <section>
        <p>{t("legal.cookies.intro")}</p>
      </section>

      <section>
        <h2>{t("legal.cookies.s1.heading")}</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>{t("legal.cookies.s1.item1")}</li>
          <li>{t("legal.cookies.s1.item2")}</li>
          <li>{t("legal.cookies.s1.item3")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("legal.cookies.s2.heading")}</h2>
        <p>{t("legal.cookies.s2.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cookies.s3.heading")}</h2>
        <p>{t("legal.cookies.s3.body")}</p>
        <div className="mt-3">
          <Button onClick={resetConsent} variant="outline">
            {t("legal.cookies.resetButton")}
          </Button>
        </div>
      </section>
    </LegalLayout>
  );
}
