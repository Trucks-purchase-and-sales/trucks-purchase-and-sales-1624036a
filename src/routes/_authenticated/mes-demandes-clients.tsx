import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listDemandOpportunities } from "@/lib/demand-opportunities.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mes-demandes-clients")({ component: Page });

function Page() {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    nouvelle: t("mesDemandesClients.status.nouvelle"),
    qualifiee: t("mesDemandesClients.status.qualifiee"),
    en_recherche: t("mesDemandesClients.status.enRecherche"),
    proposition_envoyee: t("mesDemandesClients.status.propositionEnvoyee"),
    negociation: t("mesDemandesClients.status.negociation"),
    gagnee: t("mesDemandesClients.status.gagnee"),
    perdue: t("mesDemandesClients.status.perdue"),
    archivee: t("mesDemandesClients.status.archivee"),
  };
  const listFn = useServerFn(listDemandOpportunities);
  const { data, isLoading } = useQuery({
    queryKey: ["demand-opps", "mine"],
    queryFn: () => listFn({ data: { scope: "mine" } }),
  });
  const rows = (data?.rows ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

  return (
    <div className="pb-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("mesDemandesClients.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("mesDemandesClients.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("mesDemandesClients.empty")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">{t("mesDemandesClients.columns.ref")}</th>
                  <th className="p-2 text-left">{t("mesDemandesClients.columns.status")}</th>
                  <th className="p-2 text-left">{t("mesDemandesClients.columns.client")}</th>
                  <th className="p-2 text-left">{t("mesDemandesClients.columns.search")}</th>
                  <th className="p-2 text-left">{t("mesDemandesClients.columns.budget")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = data?.buyers?.[r.buyer_lead_id];
                  return (
                    <tr key={r.id} className="border-t border-border/60 hover:bg-accent/40">
                      <td className="p-2 font-mono text-xs">
                        <Link
                          to="/admin/demand-opportunities/$id"
                          params={{ id: r.id }}
                          className="text-primary hover:underline"
                        >
                          {r.reference_number}
                        </Link>
                      </td>
                      <td className="p-2">
                        <Badge variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                      </td>
                      <td className="p-2">
                        {b ? (
                          <>
                            <div className="font-medium">
                              {b.first_name} {b.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {b.company_name ?? b.email}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        {r.brand ?? "—"} {r.model ?? ""}
                        {r.city && (
                          <div className="text-muted-foreground">
                            {r.city} · {r.country}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        {r.max_budget_ht
                          ? `${Number(r.max_budget_ht).toLocaleString("fr-FR")} €`
                          : "—"}
                      </td>
                      <td className="p-2 text-right">
                        <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
