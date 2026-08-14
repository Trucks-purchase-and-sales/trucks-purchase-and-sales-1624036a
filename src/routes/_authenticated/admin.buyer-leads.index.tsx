import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListBuyerLeads } from "@/lib/admin-refdata.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, ChevronRight } from "lucide-react";


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
  converted: "Convertie",
};

export const Route = createFileRoute("/_authenticated/admin/buyer-leads/")({ component: Page });

function Page() {
  const listFn = useServerFn(adminListBuyerLeads);
  const [archived, setArchived] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-buyer-leads", archived],
    queryFn: () => listFn({ data: { archived } }),
  });

  return (
    <div className="pb-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Demandes acheteurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived
              ? "Demandes déjà traitées : converties, gagnées, perdues ou archivées."
              : "Demandes à traiter. Une fois convertie ou rejetée, la demande sort de cette liste."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setArchived((v: boolean) => !v)}>
          <Archive className="mr-1.5 h-4 w-4" />
          {archived ? "Voir les demandes à traiter" : "Voir les demandes traitées"}
        </Button>
      </div>


      <Card className="border-border/70">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Réf.</th>
                  <th className="p-2 text-left">Statut</th>
                  <th className="p-2 text-left">Contact</th>
                  <th className="p-2 text-left">Recherche</th>
                  <th className="p-2 text-left">Budget</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((r: any) => (
                  <tr
                    key={r.id}
                    className="border-t border-border/60 align-top hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={(e) => {
                      const a = e.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]");
                      if (a && !(e.target as HTMLElement).closest("a")) a.click();
                    }}
                  >
                    <td className="p-2 font-mono text-xs">
                      <Link to="/admin/buyer-leads/$id" params={{ id: r.id }} data-row-link className="text-primary hover:underline">
                        {r.reference_number ?? "—"}
                      </Link>
                    </td>
                    <td className="p-2"><Badge variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                    <td className="p-2">
                      <div className="font-medium">{r.first_name} {r.last_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                      {r.company_name && <div className="text-xs text-muted-foreground">{r.company_name}</div>}
                    </td>
                    <td className="p-2 text-xs">
                      {r.preferred_brand ?? "—"} {r.preferred_model ?? ""}
                      {r.city && <div className="text-muted-foreground">{r.city} · {r.country}</div>}
                    </td>
                    <td className="p-2 text-xs">{r.max_budget_ht ? `${r.max_budget_ht.toLocaleString("fr-FR")} €` : "—"}</td>
                    <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-2 text-right"><ChevronRight className="inline h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
                {(data?.rows ?? []).length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Aucune demande</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}