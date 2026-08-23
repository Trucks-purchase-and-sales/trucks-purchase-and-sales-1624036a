import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listDemandOpportunities } from "@/lib/demand-opportunities.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/demand-opportunities/")({
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    nouvelle: t("admin.demandOpportunities.status.new"),
    qualifiee: t("admin.demandOpportunities.status.qualified"),
    en_recherche: t("admin.demandOpportunities.status.searching"),
    proposition_envoyee: t("admin.demandOpportunities.status.proposalSent"),
    negociation: t("admin.demandOpportunities.status.negotiation"),
    gagnee: t("admin.demandOpportunities.status.won"),
    perdue: t("admin.demandOpportunities.status.lost"),
    archivee: t("admin.demandOpportunities.status.archived"),
  };

  const listFn = useServerFn(listDemandOpportunities);
  const { data, isLoading } = useQuery({
    queryKey: ["demand-opps", "all"],
    queryFn: () => listFn({ data: { scope: "all" } }),
  });
  const [q, setQ] = useState("");
  const rows = (data?.rows ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const filtered = rows.filter((r) => {
    if (!q) return true;
    const b = data?.buyers?.[r.buyer_lead_id];
    const hay =
      `${r.reference_number ?? ""} ${r.brand ?? ""} ${r.model ?? ""} ${r.city ?? ""} ${b?.first_name ?? ""} ${b?.last_name ?? ""} ${b?.company_name ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="pb-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.demandOpportunities.index.heading")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.demandOpportunities.index.subtitle")}
          </p>
        </div>
        <Input
          placeholder={t("admin.common.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("admin.demandOpportunities.index.empty")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">
                    {t("admin.demandOpportunities.index.columns.ref")}
                  </th>
                  <th className="p-2 text-left">
                    {t("admin.demandOpportunities.index.columns.status")}
                  </th>
                  <th className="p-2 text-left">
                    {t("admin.demandOpportunities.index.columns.client")}
                  </th>
                  <th className="p-2 text-left">
                    {t("admin.demandOpportunities.index.columns.search")}
                  </th>
                  <th className="p-2 text-left">
                    {t("admin.demandOpportunities.index.columns.agent")}
                  </th>
                  <th className="p-2 text-left">
                    {t("admin.demandOpportunities.index.columns.budget")}
                  </th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const b = data?.buyers?.[r.buyer_lead_id];
                  const a = data?.agents?.[r.assigned_sales_agent_id];
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
                      <td className="p-2 text-xs">{a ? `${a.first_name} ${a.last_name}` : "—"}</td>
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
