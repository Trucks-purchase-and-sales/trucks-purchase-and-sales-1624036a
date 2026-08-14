import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Wilmet Trucks" },
      { name: "description", content: "Politique de confidentialité et traitement des données personnelles chez Wilmet Trucks." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="19 juillet 2026">
      <section>
        <h2>Responsable de traitement</h2>
        <p>
          Wilmet, [adresse], est responsable du traitement des données personnelles collectées via la
          plateforme Wilmet Trucks.
        </p>
      </section>

      <section>
        <h2>Données collectées</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>Identité et contact : nom, prénom, société, email, téléphone, adresse.</li>
          <li>Données professionnelles : rôle, historique des opportunités et demandes.</li>
          <li>Données de connexion : logs, adresse IP, empreinte navigateur.</li>
          <li>Documents transmis : photos et documents relatifs aux véhicules.</li>
        </ul>
      </section>

      <section>
        <h2>Finalités et base légale</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>Exécution du service (contrat) : gestion des comptes, opportunités, transactions.</li>
          <li>Obligations légales : facturation, conservation comptable.</li>
          <li>Intérêt légitime : sécurité, prévention de la fraude, amélioration de la plateforme.</li>
          <li>Consentement : communications commerciales, cookies non essentiels.</li>
        </ul>
      </section>

      <section>
        <h2>Durées de conservation</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>Compte actif : durée de la relation + 3 ans.</li>
          <li>Documents comptables : 10 ans.</li>
          <li>Logs de sécurité : 12 mois.</li>
        </ul>
      </section>

      <section>
        <h2>Sous-traitants</h2>
        <p>
          Les données sont hébergées au sein de l'Union européenne. Wilmet fait appel aux sous-traitants
          suivants, tous soumis à des accords de traitement conformes au RGPD :
        </p>
        <ul className="ml-6 list-disc space-y-1">
          <li>Lovable Cloud / Supabase — hébergement, base de données, authentification.</li>
          <li>Cloudflare — CDN et protection.</li>
          <li>Google Gemini via AI Gateway — analyse de rapprochement d'offres/demandes.</li>
        </ul>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation,
          d'opposition, et de portabilité de vos données. Pour exercer ces droits, écrivez à
          <a href="mailto:dpo@wilmet.example"> dpo@wilmet.example</a>. Vous pouvez également introduire une
          réclamation auprès de la CNIL.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        ⚠️ Modèle — à faire relire par un DPO ou juriste, et à compléter avec l'adresse réelle du DPO.
      </p>
    </LegalLayout>
  );
}
