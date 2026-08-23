import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LegalLayout } from "@/components/LegalLayout";
import { useI18nInit } from "@/i18n/useI18nInit";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Wilmet Trucks" },
      {
        name: "description",
        content:
          "Mentions légales du site Wilmet Trucks : éditeur, hébergeur, propriété intellectuelle.",
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
    <LegalLayout title={t("legal.mentionsLegales.title")} updated={t("legal.updatedDate")}>
      <section>
        {/* Éditeur block intentionally left in French: it is a fill-in-the-blank
            legal-identity template (company form, address, RCS/SIREN/VAT numbers)
            pending the client's real registration data, not general UI copy. */}
        <h2>{t("legal.mentionsLegales.s1.heading")}</h2>
        <p>
          <strong>Wilmet</strong> — [Forme juridique, ex : SARL au capital de …]
          <br />
          Siège social : [Adresse complète]
          <br />
          RCS : [Ville et numéro] · SIREN : [numéro] · TVA intracommunautaire : [numéro]
          <br />
          Téléphone : [numéro] · Email : contact@wilmet.example
        </p>
        <p>Directeur de la publication : [Nom du représentant légal].</p>
      </section>

      <section>
        <h2>{t("legal.mentionsLegales.s2.heading")}</h2>
        <p>{t("legal.mentionsLegales.s2.body")}</p>
      </section>

      <section>
        <h2>{t("legal.mentionsLegales.s3.heading")}</h2>
        <p>{t("legal.mentionsLegales.s3.body")}</p>
      </section>

      <section>
        <h2>{t("legal.mentionsLegales.s4.heading")}</h2>
        <p>{t("legal.mentionsLegales.s4.body")}</p>
      </section>

      <section>
        <h2>{t("legal.mentionsLegales.s5.heading")}</h2>
        <p>
          {t("legal.mentionsLegales.s5.textBefore")}{" "}
          <a href="mailto:contact@wilmet.example">contact@wilmet.example</a>.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">{t("legal.mentionsLegales.draftNotice")}</p>
    </LegalLayout>
  );
}
