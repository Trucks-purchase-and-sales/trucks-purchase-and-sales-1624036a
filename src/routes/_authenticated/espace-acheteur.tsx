import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myBuyerLeads } from "@/lib/dashboards.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/dashboard/StatTile";
import { Search, Plus, ListChecks, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/espace-acheteur")({
  head: () => ({
    meta: [
      { title: "Espace acheteur — Wilmet Trucks" },
      { name: "description", content: "Vue d'ensemble de vos demandes de véhicules chez Wilmet Trucks." },
      { property: "og:title", content: "Espace acheteur — Wilmet Trucks" },
      { property: "og:description", content: "Vue d'ensemble de vos demandes de véhicules chez Wilmet Trucks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const userId = (context as { userId: string }).userId;
    const [{ data: rolesRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("partner_kind").eq("id", userId).maybeSingle(),
    ]);
    const roles = new Set((rolesRows ?? []).map((r) => r.role));
    const isInternal = roles.has("admin") || roles.has("platform_admin") ||
      roles.has("sales_manager") || roles.has("sales_agent") || roles.has("company_management");
    if (isInternal) return; // staff can view for support
    if (profile?.partner_kind !== "client") {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: BuyerHome,
});

const STATUS_LABEL: Record<string, string> = {
  nouveau: "Nouveau",
  a_qualifier: "À qualifier",
  match_possible: "Match possible",
  en_recherche: "En recherche",
  offre_envoyee: "Offre envoyée",
  option_posee: "Option posée",
  gagne: "Gagné",
  perdu: "Perdu",
  archive: "Archivé",
};

const OPEN = ["nouveau", "a_qualifier", "match_possible", "en_recherche", "offre_envoyee", "option_posee"];
const CLOSED = ["gagne", "perdu", "archive"];

function BuyerHome() {
  const fn = useServerFn(myBuyerLeads);
  const { data, isLoading } = useQuery({ queryKey: ["my-buyer-leads"], queryFn: () => fn() });
  const rows = (data?.rows ?? []) as any[];

  const summary = useMemo(() => ({
    total: rows.length,
    open: rows.filter((r) => OPEN.includes(r.status)).length,
    closed: rows.filter((r) => CLOSED.includes(r.status)).length,
  }), [rows]);

  const recent = rows.slice(0, 3);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vue d'ensemble de vos recherches de véhicules avec Wilmet.</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/chercher-un-vehicule"><Plus className="mr-1.5 h-4 w-4" /> Nouvelle demande</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={ListChecks} label="Demandes au total" value={summary.total} />
        <StatTile icon={Loader2} label="En cours" value={summary.open} tint="analysis" />
        <StatTile icon={CheckCircle2} label="Clôturées" value={summary.closed} tint="accepted" />
      </div>

      <Card className="border-border/70">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Demandes récentes</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/mes-demandes">Voir toutes mes demandes</Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Search className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Vous n'avez pas encore de demande.</p>
              <Button asChild className="mt-3" size="sm">
                <Link to="/chercher-un-vehicule">Créer ma première demande</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {[r.preferred_brand, r.preferred_model].filter(Boolean).join(" ") || "Demande de véhicule"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.reference_number ?? "—"}
                    </div>
                  </div>
                  <Badge variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
