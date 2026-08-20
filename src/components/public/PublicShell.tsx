import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";
import { PublicAccountActions } from "@/components/public/PublicAccountActions";

/** Header + footer chrome shared by the public catalogue pages. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}

function PublicHeader() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex shrink-0 items-center">
          <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/vehicules" className="hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            {t("catalog.nav.vehicles")}
          </Link>
          <Link to="/chercher-un-vehicule" className="hover:text-foreground">
            {t("catalog.nav.search")}
          </Link>
        </nav>

        <PublicAccountActions />
      </div>
    </header>
  );
}

function PublicFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container-page flex flex-col gap-6 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-7 w-auto" />
            <span>· {t("footer.tagline")}</span>
          </div>
          <span>© {new Date().getFullYear()} Wilmet. {t("footer.rights")}</span>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-border/40 pt-4 text-xs">
          <Link to="/vehicules" className="hover:text-foreground">{t("catalog.nav.vehiclesForSale")}</Link>
          <Link to="/mentions-legales" className="hover:text-foreground">{t("catalog.nav.legal")}</Link>
          <Link to="/cgu" className="hover:text-foreground">{t("catalog.nav.cgu")}</Link>
          <Link to="/cgv" className="hover:text-foreground">{t("catalog.nav.cgv")}</Link>
          <Link to="/confidentialite" className="hover:text-foreground">{t("catalog.nav.privacy")}</Link>
          <Link to="/cookies" className="hover:text-foreground">{t("catalog.nav.cookies")}</Link>
        </nav>

      </div>
    </footer>
  );
}
