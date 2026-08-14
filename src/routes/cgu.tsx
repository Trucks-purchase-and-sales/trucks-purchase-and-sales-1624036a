import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "CGU — Conditions générales d'utilisation — Wilmet Trucks" },
      { name: "description", content: "Conditions générales d'utilisation de la plateforme Wilmet Trucks." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LegalLayout title="Conditions Générales d'Utilisation" updated="19 juillet 2026">
      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes CGU régissent l'accès et l'utilisation de la plateforme Wilmet Trucks, qui met en relation
          des vendeurs professionnels de véhicules industriels (partenaires, apporteurs d'affaires, fournisseurs) et
          des acheteurs professionnels via l'intermédiation de Wilmet.
        </p>
      </section>

      <section>
        <h2>2. Accès au service</h2>
        <p>
          L'accès à l'espace partenaire ou à l'espace acheteur nécessite la création d'un compte. L'utilisateur
          s'engage à fournir des informations exactes et à préserver la confidentialité de ses identifiants.
        </p>
      </section>

      <section>
        <h2>3. Rôle de Wilmet</h2>
        <p>
          Wilmet agit en qualité d'intermédiaire commercial. La plateforme permet de soumettre des opportunités
          de vente ou des demandes d'achat, d'échanger, et de suivre le processus jusqu'à la conclusion.
          Wilmet n'est pas propriétaire des véhicules proposés par les partenaires tant qu'un accord d'achat
          n'a pas été signé.
        </p>
      </section>

      <section>
        <h2>4. Obligations de l'utilisateur</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>Fournir des informations sincères sur les véhicules proposés (état, kilométrage, historique).</li>
          <li>Ne pas soumettre de véhicules dont il n'a pas la libre disposition.</li>
          <li>Ne pas utiliser la plateforme à des fins frauduleuses ou contraires à la loi.</li>
          <li>Respecter la confidentialité des données commerciales échangées.</li>
        </ul>
      </section>

      <section>
        <h2>5. Suspension et résiliation</h2>
        <p>
          Wilmet se réserve le droit de suspendre ou de résilier tout compte en cas de manquement aux présentes
          CGU, notamment en cas de fourniture d'informations mensongères ou de comportement frauduleux.
        </p>
      </section>

      <section>
        <h2>6. Propriété intellectuelle</h2>
        <p>
          La plateforme, sa marque, son code, son design et ses contenus éditoriaux sont la propriété exclusive
          de Wilmet. Toute reproduction non autorisée est interdite.
        </p>
      </section>

      <section>
        <h2>7. Loi applicable et juridiction</h2>
        <p>
          Les présentes CGU sont soumises au droit français. Tout litige relève de la compétence exclusive des
          tribunaux du siège social de Wilmet, sauf disposition impérative contraire.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        ⚠️ Modèle — à faire relire par un juriste avant mise en production.
      </p>
    </LegalLayout>
  );
}
