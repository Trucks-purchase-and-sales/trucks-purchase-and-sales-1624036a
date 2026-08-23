import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getDemandOpportunity,
  updateDemandStage,
  linkVehicleMatch,
  suggestVehiclesForDemand,
} from "@/lib/demand-opportunities.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Check, X, Link2, Sparkles } from "lucide-react";
import { formatDateTime, CLOSED_LOST_REASONS } from "@/lib/wilmet-constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/demand-opportunities/$id")({
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const STAGES: {
    key: "qualification" | "sourcing" | "proposition" | "negociation" | "cloture";
    label: string;
  }[] = [
    { key: "qualification", label: t("admin.demandOpportunities.detail.stages.qualification") },
    { key: "sourcing", label: t("admin.demandOpportunities.detail.stages.sourcing") },
    { key: "proposition", label: t("admin.demandOpportunities.detail.stages.proposition") },
    { key: "negociation", label: t("admin.demandOpportunities.detail.stages.negotiation") },
    { key: "cloture", label: t("admin.demandOpportunities.detail.stages.closing") },
  ];
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

  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getDemandOpportunity);
  const stageFn = useServerFn(updateDemandStage);
  const linkFn = useServerFn(linkVehicleMatch);
  const suggestFn = useServerFn(suggestVehiclesForDemand);

  const { data, isLoading } = useQuery({
    queryKey: ["demand-opp", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const {
    data: suggestions,
    refetch: refetchSuggest,
    isFetching: sugLoading,
  } = useQuery({
    queryKey: ["demand-opp-suggest", id],
    queryFn: () => suggestFn({ data: { id } }),
    enabled: false,
  });

  const [busy, setBusy] = useState(false);
  const [lostReason, setLostReason] = useState("prix");

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["demand-opp", id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  const { opp, lead, history, agent, matchedVehicle } = data;
  const isTerminal = ["gagnee", "perdue", "archivee"].includes(opp.status);

  return (
    <div className="pb-10 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/demand-opportunities">
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("admin.common.back")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {opp.reference_number}
            </h1>
            <Badge>{STATUS_LABEL[opp.status] ?? opp.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead ? `${lead.first_name} ${lead.last_name}` : "—"} ·{" "}
            {t("admin.demandOpportunities.detail.createdOnLabel")} {formatDateTime(opp.created_at)}
            {agent && (
              <>
                {" "}
                · {t("admin.demandOpportunities.detail.agentLabel")}{" "}
                <b>
                  {agent.first_name} {agent.last_name}
                </b>
              </>
            )}
          </p>
        </div>
        {!isTerminal && (
          <div className="flex gap-2">
            <Button
              onClick={() =>
                run(
                  () => stageFn({ data: { id, status: "gagnee", stage: "cloture" } }),
                  t("admin.demandOpportunities.detail.wonToast"),
                )
              }
              disabled={busy}
            >
              <Check className="mr-1.5 h-4 w-4" /> {t("admin.demandOpportunities.status.won")}
            </Button>
            <Select value={lostReason} onValueChange={setLostReason}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOSED_LOST_REASONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() =>
                run(
                  () =>
                    stageFn({
                      data: { id, status: "perdue", stage: "cloture", lost_reason: lostReason },
                    }),
                  t("admin.demandOpportunities.detail.lostToast"),
                )
              }
              disabled={busy}
            >
              <X className="mr-1.5 h-4 w-4" /> {t("admin.demandOpportunities.status.lost")}
            </Button>
          </div>
        )}
      </div>

      {/* Stage bar */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s, i) => {
          const currentIdx = STAGES.findIndex((x) => x.key === opp.stage);
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <button
              key={s.key}
              disabled={busy || isTerminal}
              onClick={() =>
                run(
                  () => stageFn({ data: { id, stage: s.key } }),
                  t("admin.demandOpportunities.detail.stageUpdatedToast"),
                )
              }
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isCurrent && "bg-accent text-accent-foreground",
                isPast && "bg-status-accepted text-status-accepted-foreground",
                !isCurrent && !isPast && "bg-secondary text-muted-foreground hover:bg-secondary/80",
                (busy || isTerminal) && "cursor-not-allowed opacity-70",
              )}
            >
              {isPast && <Check className="mr-1 inline h-3 w-3" />}
              {s.label}
            </button>
          );
        })}
      </div>

      <Tabs defaultValue="detail">
        <TabsList>
          <TabsTrigger value="detail">
            {t("admin.demandOpportunities.detail.tabs.details")}
          </TabsTrigger>
          <TabsTrigger value="matching">
            {t("admin.demandOpportunities.detail.tabs.matching")}
          </TabsTrigger>
          <TabsTrigger value="history">
            {t("admin.demandOpportunities.detail.tabs.history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.demandOpportunities.detail.clientHeading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {lead ? (
                  <>
                    <div className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </div>
                    {lead.company_name && (
                      <div className="text-muted-foreground">{lead.company_name}</div>
                    )}
                    <div>
                      <a className="text-primary hover:underline" href={`mailto:${lead.email}`}>
                        {lead.email}
                      </a>
                    </div>
                    {lead.phone && <div>{lead.phone}</div>}
                  </>
                ) : (
                  "—"
                )}
                <div className="pt-2">
                  <Link
                    to="/admin/buyer-leads/$id"
                    params={{ id: opp.buyer_lead_id }}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("admin.demandOpportunities.detail.viewLeadLink")}
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.demandOpportunities.detail.needsHeading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <F
                  label={t("admin.demandOpportunities.detail.fields.brandModel")}
                  v={[opp.brand, opp.model].filter(Boolean).join(" ") || "—"}
                />
                <F label={t("admin.demandOpportunities.detail.fields.type")} v={opp.vehicle_type} />
                <F label={t("admin.demandOpportunities.detail.fields.minYear")} v={opp.year_min} />
                <F
                  label={t("admin.demandOpportunities.detail.fields.maxMileage")}
                  v={opp.max_mileage ? `${opp.max_mileage.toLocaleString("fr-FR")} km` : null}
                />
                <F
                  label={t("admin.demandOpportunities.detail.fields.maxBudget")}
                  v={
                    opp.max_budget_ht
                      ? `${Number(opp.max_budget_ht).toLocaleString("fr-FR")} €`
                      : null
                  }
                />
                <F
                  label={t("admin.demandOpportunities.detail.fields.zone")}
                  v={[opp.city, opp.country].filter(Boolean).join(" · ")}
                />
              </CardContent>
            </Card>
          </div>

          {opp.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("admin.demandOpportunities.detail.notesHeading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{opp.notes}</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="matching" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {t("admin.demandOpportunities.detail.matchedVehicleHeading")}
              </CardTitle>
              {matchedVehicle && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(
                      () => linkFn({ data: { demandId: id, vehicleOpportunityId: null } }),
                      t("admin.demandOpportunities.detail.matchRemovedToast"),
                    )
                  }
                  disabled={busy}
                >
                  <X className="mr-1 h-3.5 w-3.5" />{" "}
                  {t("admin.demandOpportunities.detail.removeMatchButton")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="text-sm">
              {matchedVehicle ? (
                <div className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {matchedVehicle.brand} {matchedVehicle.model} ({matchedVehicle.year})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {matchedVehicle.reference_number} ·{" "}
                        {Number(matchedVehicle.desired_price_excl_tax ?? 0).toLocaleString("fr-FR")}{" "}
                        €
                      </div>
                    </div>
                    <Link
                      to="/admin/opportunities/$id"
                      params={{ id: matchedVehicle.id }}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("admin.demandOpportunities.detail.openMatchLink")}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  {t("admin.demandOpportunities.detail.noMatch")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {t("admin.demandOpportunities.detail.suggestionsHeading")}
              </CardTitle>
              <Button size="sm" onClick={() => refetchSuggest()} disabled={sugLoading}>
                <Sparkles className="mr-1.5 h-4 w-4" />{" "}
                {sugLoading
                  ? t("admin.demandOpportunities.detail.searchingLabel")
                  : t("admin.demandOpportunities.detail.findVehiclesButton")}
              </Button>
            </CardHeader>
            <CardContent className="text-sm">
              {!suggestions ? (
                <div className="text-muted-foreground">
                  {t("admin.demandOpportunities.detail.suggestionsPrompt", {
                    button: t("admin.demandOpportunities.detail.findVehiclesButton"),
                  })}
                </div>
              ) : suggestions.rows.length === 0 ? (
                <div className="text-muted-foreground">
                  {t("admin.demandOpportunities.detail.noSuggestions")}
                </div>
              ) : (
                <ul className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {suggestions.rows.map((v: any) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between rounded-md border border-border/60 p-3"
                    >
                      <div>
                        <div className="font-medium">
                          {v.brand} {v.model} ({v.year})
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.reference_number} ·{" "}
                          {Number(v.desired_price_excl_tax ?? 0).toLocaleString("fr-FR")} € ·{" "}
                          {v.city} · {v.mileage ? `${v.mileage.toLocaleString("fr-FR")} km` : "—"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(
                            () => linkFn({ data: { demandId: id, vehicleOpportunityId: v.id } }),
                            t("admin.demandOpportunities.detail.linkedToast"),
                          )
                        }
                        disabled={busy}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" />{" "}
                        {t("admin.demandOpportunities.detail.linkButton")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-4 text-sm">
              {history.length === 0 ? (
                <div className="text-muted-foreground">
                  {t("admin.demandOpportunities.detail.noHistory")}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {history.map((h: any) => (
                    <li key={h.id} className="flex flex-wrap gap-2 text-xs">
                      <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                      <span>
                        {h.old_status ?? "—"} → <b>{h.new_status}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function F({ label, v }: { label: string; v: React.ReactNode }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
