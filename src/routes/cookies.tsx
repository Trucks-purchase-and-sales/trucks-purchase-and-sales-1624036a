import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";
import { Button } from "@/components/ui/button";

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
  function resetConsent() {
    try { localStorage.removeItem("wilmet_cookie_consent_v1"); } catch { /* noop */ }
    // Reload so the banner reappears
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <LegalLayout title="Politique cookies" updated="19 juillet 2026">
      <section>
        <p>
          Un cookie est un petit fichier déposé sur votre terminal lors de la visite d'un site. Wilmet Trucks
          utilise uniquement les cookies strictement nécessaires au fonctionnement du service. Aucun cookie de
          mesure d'audience ou publicitaire n'est déposé sans votre consentement.
        </p>
      </section>

      <section>
        <h2>Cookies strictement nécessaires (exemptés de consentement)</h2>
        <ul className="ml-6 list-disc space-y-1">
          <li>Session d'authentification (Supabase Auth).</li>
          <li>Préférence de langue.</li>
          <li>Préférence de consentement cookies.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies soumis à consentement</h2>
        <p>
          À ce jour, Wilmet Trucks n'utilise pas de cookies d'analyse (Google Analytics, Plausible…) ni de
          cookies publicitaires. Si cela évolue, votre consentement sera recueilli avant tout dépôt.
        </p>
      </section>

      <section>
        <h2>Gérer votre consentement</h2>
        <p>Vous pouvez à tout moment retirer votre consentement et effacer votre choix ci-dessous :</p>
        <div className="mt-3">
          <Button onClick={resetConsent} variant="outline">Réinitialiser mon consentement</Button>
        </div>
      </section>
    </LegalLayout>
  );
}
