import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { resolveRoleHome } from "@/hooks/useRoleHome";
import { supabase } from "@/integrations/supabase/client";
import { startPublicSessionBootstrap } from "@/lib/auth-bootstrap";

/**
 * Session-aware account actions shared by public pages.
 *
 * Anonymous visitors see sign-in + seller-signup CTAs. Authenticated users see
 * a single canonical "Mon espace" entry point instead of being offered a second
 * account that /auth would immediately redirect away from.
 */
export function PublicAccountActions() {
  const { t } = useTranslation();
  const [home, setHome] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    const resolveSessionHome = async (userId?: string) => {
      if (!active) return;
      if (!userId) {
        setHome(null);
        return;
      }

      try {
        const nextHome = await resolveRoleHome(userId);
        if (active) setHome(nextHome);
      } catch {
        // Authenticated routes remain fail-closed; this is only a public-shell
        // fallback so a transient role lookup failure does not expose signup.
        if (active) setHome("/dashboard");
      }
    };

    const cleanup = startPublicSessionBootstrap({
      client: supabase,
      onSession: (userId) => {
        void resolveSessionHome(userId);
      },
      onError: (error) => {
        console.error("[public/auth] session bootstrap failed; showing anonymous controls", error);
      },
    });

    return () => {
      active = false;
      cleanup();
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher compact />
      {home === undefined ? null : home ? (
        <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to={home as never}>{t("nav.mySpace")}</Link>
        </Button>
      ) : (
        <>
          <Link
            to="/auth"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            {t("nav.signIn")}
          </Link>
          <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/auth" search={{ mode: "signup", kind: "seller" } as never}>
              {t("nav.propose")}
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
