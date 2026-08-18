import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { startAuthBootstrap } from "@/lib/auth-bootstrap";
import { captureRefFromUrl } from "@/lib/referral";

import "@/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Un problème est survenu
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous pouvez réessayer ou revenir à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Wilmet Opportunités — Proposez vos véhicules à Wilmet" },
      {
        name: "description",
        content:
          "Proposez camions, utilitaires, tracteurs, semi-remorques et véhicules spécialisés à Wilmet en quelques minutes depuis votre téléphone.",
      },
      { name: "author", content: "Wilmet" },
      { property: "og:title", content: "Wilmet Opportunités — Proposez vos véhicules à Wilmet" },
      {
        property: "og:description",
        content:
          "Proposez camions, utilitaires, tracteurs, semi-remorques et véhicules spécialisés à Wilmet en quelques minutes depuis votre téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Wilmet Opportunités — Proposez vos véhicules à Wilmet" },
      { name: "twitter:description", content: "Proposez camions, utilitaires, tracteurs, semi-remorques et véhicules spécialisés à Wilmet en quelques minutes depuis votre téléphone." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d196e87d-3035-4c0f-af00-49bbcd4b82d8/id-preview-dc2b020b--826a4c2b-5667-4a10-93bb-fff26e51b724.lovable.app-1783581680574.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d196e87d-3035-4c0f-af00-49bbcd4b82d8/id-preview-dc2b020b--826a4c2b-5667-4a10-93bb-fff26e51b724.lovable.app-1783581680574.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => startAuthBootstrap({
    client: supabase,
    onRelevantEvent: (event) => {
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    },
    onError: (error) => {
      // Authentication remains fail-closed on protected routes, but an auth
      // bootstrap/configuration failure must not take down the public shell.
      console.error("[root/auth] auth bootstrap failed; public shell remains anonymous", error);
    },
  }), [router, queryClient]);

  // Affiliate capture: any page can carry ?ref=CODE, so listen on every navigation.
  const pathname = useRouterState({ select: (s) => s.location.pathname + s.location.searchStr });
  useEffect(() => { captureRefFromUrl(); }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-right" />
      <CookieConsent />
    </QueryClientProvider>
  );
}
