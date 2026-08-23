import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LegalLayout } from "@/components/LegalLayout";
import { useI18nInit } from "@/i18n/useI18nInit";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "CGU — Conditions générales d'utilisation — Wilmet Trucks" },
      {
        name: "description",
        content: "Conditions générales d'utilisation de la plateforme Wilmet Trucks.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: Page,
});

function Page() {
  useI18nInit();
  const { t } = useTranslation();
  return (
    <LegalLayout title={t("legal.cgu.title")} updated={t("legal.updatedDate")}>
      <section>
        <h2>{t("legal.cgu.s1.heading")}</h2>
        <p>{t("legal.cgu.s1.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgu.s2.heading")}</h2>
        <p>{t("legal.cgu.s2.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgu.s3.heading")}</h2>
        <p>{t("legal.cgu.s3.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgu.s4.heading")}</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>{t("legal.cgu.s4.item1")}</li>
          <li>{t("legal.cgu.s4.item2")}</li>
          <li>{t("legal.cgu.s4.item3")}</li>
          <li>{t("legal.cgu.s4.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("legal.cgu.s5.heading")}</h2>
        <p>{t("legal.cgu.s5.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgu.s6.heading")}</h2>
        <p>{t("legal.cgu.s6.body")}</p>
      </section>

      <section>
        <h2>{t("legal.cgu.s7.heading")}</h2>
        <p>{t("legal.cgu.s7.body")}</p>
      </section>

      <p className="text-xs text-muted-foreground">{t("legal.cgu.draftNotice")}</p>
    </LegalLayout>
  );
}
