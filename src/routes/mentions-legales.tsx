import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Wilmet Trucks" },
      { name: "description", content: "Mentions légales du site Wilmet Trucks : éditeur, hébergeur, propriété intellectuelle." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LegalLayout title="Mentions légales" updated="19 juillet 2026">
      <section>
        <h2>Éditeur du site</h2>
        <p>
          <strong>Wilmet</strong> — [Forme juridique, ex : SARL au capital de …]<br />
          Siège social : [Adresse complète]<br />
          RCS : [Ville et numéro] · SIREN : [numéro] · TVA intracommunautaire : [numéro]<br />
          Téléphone : [numéro] · Email : contact@wilmet.example
        </p>
        <p>Directeur de la publication : [Nom du représentant légal].</p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          Le site est hébergé par la plateforme Lovable Cloud, opérée par des infrastructures européennes
          fournies par Supabase et Cloudflare. Pour toute demande liée à l'hébergement, contactez
          l'éditeur ci-dessus.
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          L'ensemble des contenus, marques, logos, photographies et éléments graphiques présents sur ce site
          sont la propriété exclusive de Wilmet ou de ses partenaires. Toute reproduction ou représentation,
          totale ou partielle, sans autorisation écrite préalable est interdite.
        </p>
      </section>

      <section>
        <h2>Responsabilité</h2>
        <p>
          Wilmet s'efforce d'assurer l'exactitude des informations diffusées sur ce site mais ne saurait être
          tenu responsable d'éventuelles inexactitudes, omissions ou d'une indisponibilité temporaire du service.
        </p>
      </section>

      <section>
        <h2>Signalement</h2>
        <p>
          Tout contenu illicite peut être signalé à <a href="mailto:contact@wilmet.example">contact@wilmet.example</a>.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        ⚠️ Modèle générique — remplacez les champs entre crochets par les informations légales de la société avant mise en production.
      </p>
    </LegalLayout>
  );
}
