import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

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
  return (
    <LegalLayout title="Conditions Générales de Vente" updated="19 juillet 2026">
      <section>
        <h2>1. Champ d'application</h2>
        <p>
          Les présentes CGV s'appliquent à toute transaction de véhicule industriel conclue entre Wilmet et un
          acheteur professionnel via la plateforme Wilmet Trucks.
        </p>
      </section>

      <section>
        <h2>2. Commande et acompte</h2>
        <p>
          Toute commande devient ferme à réception d'un bon de commande signé et du versement d'un acompte,
          généralement de 20 % du prix HT, sauf mention contraire. Le solde est réglé avant enlèvement du véhicule
          ou selon les modalités précisées dans le bon de commande.
        </p>
      </section>

      <section>
        <h2>3. Prix</h2>
        <p>
          Les prix sont exprimés en Euros (EUR), hors taxes. La TVA applicable et son régime (autoliquidation
          intracommunautaire, marge, etc.) sont précisés sur chaque devis et facture.
        </p>
      </section>

      <section>
        <h2>4. Livraison et transfert de propriété</h2>
        <p>
          Sauf clause de réserve de propriété expressément stipulée, le transfert de propriété intervient au
          paiement complet du prix. Les frais de transport et d'immatriculation sont à la charge de l'acheteur,
          sauf accord contraire.
        </p>
      </section>

      <section>
        <h2>5. Garantie</h2>
        <p>
          Les véhicules sont vendus d'occasion, en l'état, avec les garanties légales applicables aux ventes
          entre professionnels. L'acheteur reconnaît avoir pris connaissance de l'état du véhicule avant
          signature.
        </p>
      </section>

      <section>
        <h2>6. Rétractation</h2>
        <p>
          La vente entre professionnels ne bénéficie pas du droit de rétractation prévu par le Code de la
          consommation.
        </p>
      </section>

      <section>
        <h2>7. Litiges</h2>
        <p>
          Les présentes CGV sont soumises au droit français. Tout litige relève de la compétence exclusive
          des tribunaux du siège social de Wilmet.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        ⚠️ Modèle — à personnaliser (délais, pénalités de retard, clause de réserve de propriété) et faire relire.
      </p>
    </LegalLayout>
  );
}
