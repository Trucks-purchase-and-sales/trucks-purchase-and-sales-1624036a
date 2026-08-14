import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";

const LINKS = [
  { to: "/mentions-legales", label: "Mentions légales" },
  { to: "/cgu", label: "CGU" },
  { to: "/cgv", label: "CGV" },
  { to: "/confidentialite", label: "Confidentialité" },
  { to: "/cookies", label: "Cookies" },
] as const;

export function LegalLayout({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background">
        <div className="container-page flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-8 w-auto" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Accueil</Link>
        </div>
      </header>

      <main className="container-page grid gap-8 py-10 md:grid-cols-[220px_1fr]">
        <aside className="text-sm">
          <div className="sticky top-6 space-y-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
                activeProps={{ className: "active" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </aside>

        <article className="prose prose-slate max-w-none dark:prose-invert">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {updated && <p className="text-sm text-muted-foreground">Dernière mise à jour : {updated}</p>}
          <div className="mt-6 space-y-4 leading-relaxed">{children}</div>
        </article>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Wilmet · Tous droits réservés
      </footer>
    </div>
  );
}
