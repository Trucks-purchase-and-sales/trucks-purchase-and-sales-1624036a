import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { myBuyerLeads } from "@/lib/dashboards.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus } from "lucide-react";
import { StatTileButton } from "@/components/dashboard/StatTile";

type Search = { status?: string };

export const Route = createFileRoute("/_authenticated/mes-demandes")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    status: typeof search["status"] === "string" ? search["status"] : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const userId = (context as { userId: string }).userId;
    const [{ data: rolesRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("partner_kind").eq("id", userId).maybeSingle(),
    ]);
    const roles = new Set((rolesRows ?? []).map((r) => r.role));
    const isInternal =
      roles.has("admin") ||
      roles.has("platform_admin") ||
      roles.has("sales_manager") ||
      roles.has("sales_agent") ||
      roles.has("company_management");
    if (isInternal) return; // staff can view for support
    if (profile?.partner_kind !== "client") {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: MyRequests,
});

function MyRequests() {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    nouveau: t("mesDemandes.status.nouveau"),
    a_qualifier: t("mesDemandes.status.aQualifier"),
    match_possible: t("mesDemandes.status.matchPossible"),
    en_recherche: t("mesDemandes.status.enRecherche"),
    offre_envoyee: t("mesDemandes.status.offreEnvoyee"),
    option_posee: t("mesDemandes.status.optionPosee"),
    gagne: t("mesDemandes.status.gagne"),
    perdu: t("mesDemandes.status.perdu"),
    archive: t("mesDemandes.status.archive"),
  };
  const fn = useServerFn(myBuyerLeads);
  const { userId } = Route.useRouteContext() as { userId: string };
  const { data, isLoading } = useQuery({ queryKey: ["my-buyer-leads"], queryFn: () => fn() });
  const allRows = (data?.rows ?? []) as any[]; // eslint-disable-line react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const toggle = (next: string) =>
    navigate({
      search: (prev: Search) => ({ ...prev, status: prev.status === next ? undefined : next }),
    });

  const byStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of allRows) acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, [allRows]);
  const rows = useMemo(
    () => (status ? allRows.filter((r) => r.status === status) : allRows),
    [allRows, status],
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("mesDemandes.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("mesDemandes.subtitle")}</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/chercher-un-vehicule">
            <Plus className="mr-1.5 h-4 w-4" /> {t("mesDemandes.newRequest")}
          </Link>
        </Button>
      </div>

      {allRows.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {Object.keys(STATUS_LABEL)
              .filter((k) => (byStatus[k] ?? 0) > 0)
              .map((k) => (
                <StatTileButton
                  key={k}
                  compact
                  label={STATUS_LABEL[k] ?? k}
                  value={byStatus[k] ?? 0}
                  tint={
                    k === "gagne"
                      ? "accepted"
                      : k === "perdu"
                        ? "refused"
                        : k === "archive"
                          ? "archived"
                          : "info"
                  }
                  active={status === k}
                  onClick={() => toggle(k)}
                />
              ))}
          </div>
          {status && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("dashboard.filter.active")}{" "}
                <span className="font-medium text-foreground">
                  {STATUS_LABEL[status] ?? status}
                </span>
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => toggle(status)}>
                {t("dashboard.filter.reset")}
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : rows.length === 0 && status ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("mesDemandes.emptyForStatus")}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="text-lg font-semibold">{t("mesDemandes.emptyTitle")}</div>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {t("mesDemandes.emptyText")}
              </p>
            </div>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/chercher-un-vehicule">{t("mesDemandes.createRequest")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {rows.map((r: any) => (
            <Link key={r.id} to="/mes-demandes/$id" params={{ id: r.id }}>
              <Card className="border-border/70 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {r.preferred_brand ?? t("mesDemandes.vehicleSearch")}{" "}
                        {r.preferred_model ?? ""}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.reference_number ? `${r.reference_number} · ` : ""}
                        {t("mesDemandes.createdOn", {
                          date: new Date(r.created_at).toLocaleDateString("fr-FR"),
                        })}
                      </div>
                    </div>
                    <Badge variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
