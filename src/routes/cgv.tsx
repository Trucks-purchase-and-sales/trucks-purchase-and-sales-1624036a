import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LegalLayout } from "@/components/LegalLayout";
import { useI18nInit } from "@/i18n/useI18nInit";

export const Route = createFileRoute("/cgv")({
  head: () => ({
    meta: [
      { title: "CGV — Conditions générales de vente — Wilmet Trucks" },
      { name: "description", content: "Conditions générales de vente Wilmet Trucks." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: Page,
});

function Page() {
  useI18nInit();
  const { t } = useTranslation();
  return (
    <LegalLayout title={t("legal.cgv.title")} updated={t("legal.updatedDate")}>
      <section>
        <h2>{t("legal.cgv.s1.heading")}</h2>
        <p>{t("legal.cgv.s1.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgv.s2.heading")}</h2>
        <p>{t("legal.cgv.s2.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgv.s3.heading")}</h2>
        <p>{t("legal.cgv.s3.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgv.s4.heading")}</h2>
        <p>{t("legal.cgv.s4.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgv.s5.heading")}</h2>
        <p>{t("legal.cgv.s5.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgv.s6.heading")}</h2>
        <p>{t("legal.cgv.s6.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgv.s7.heading")}</h2>
        <p>{t("legal.cgv.s7.body")}</p>
      </section>

      <p className="text-xs text-muted-foreground">{t("legal.cgv.draftNotice")}</p>
    </LegalLayout>
  );
}
