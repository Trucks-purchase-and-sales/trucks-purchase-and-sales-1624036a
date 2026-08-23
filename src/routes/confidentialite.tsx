import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LegalLayout } from "@/components/LegalLayout";
import { useI18nInit } from "@/i18n/useI18nInit";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Wilmet Trucks" },
      {
        name: "description",
        content:
          "Politique de confidentialité et traitement des données personnelles chez Wilmet Trucks.",
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
    <LegalLayout title={t("legal.confidentialite.title")} updated={t("legal.updatedDate")}>
      <section>
        <h2>{t("legal.confidentialite.s1.heading")}</h2>
        <p>{t("legal.confidentialite.s1.body")}</p>
      </section>

      <section>
        <h2>{t("legal.confidentialite.s2.heading")}</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>{t("legal.confidentialite.s2.item1")}</li>
          <li>{t("legal.confidentialite.s2.item2")}</li>
          <li>{t("legal.confidentialite.s2.item3")}</li>
          <li>{t("legal.confidentialite.s2.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("legal.confidentialite.s3.heading")}</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>{t("legal.confidentialite.s3.item1")}</li>
          <li>{t("legal.confidentialite.s3.item2")}</li>
          <li>{t("legal.confidentialite.s3.item3")}</li>
          <li>{t("legal.confidentialite.s3.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("legal.confidentialite.s4.heading")}</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>{t("legal.confidentialite.s4.item1")}</li>
          <li>{t("legal.confidentialite.s4.item2")}</li>
          <li>{t("legal.confidentialite.s4.item3")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("legal.confidentialite.s5.heading")}</h2>
        <p>{t("legal.confidentialite.s5.intro")}</p>
        <ul className="ml-6 list-disc space-y-1">
          <li>{t("legal.confidentialite.s5.item1")}</li>
          <li>{t("legal.confidentialite.s5.item2")}</li>
          <li>{t("legal.confidentialite.s5.item3")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("legal.confidentialite.s6.heading")}</h2>
        <p>
          {t("legal.confidentialite.s6.textBefore")}
          <a href="mailto:dpo@wilmet.example"> dpo@wilmet.example</a>.{" "}
          {t("legal.confidentialite.s6.textAfter")}
        </p>
      </section>

      <p className="text-xs text-muted-foreground">{t("legal.confidentialite.draftNotice")}</p>
    </LegalLayout>
  );
}
