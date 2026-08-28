import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Truck } from "lucide-react";
import { getMyBuyerLead } from "@/lib/buyer-leads.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mes-demandes/$id")({
  component: BuyerLeadDetail,
});

function field(label: string, value: unknown) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{String(value)}</dd>
    </div>
  );
}

function BuyerLeadDetail() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const fn = useServerFn(getMyBuyerLead);
  const { data, isLoading } = useQuery({
    queryKey: ["my-buyer-lead", id],
    queryFn: () => fn({ data: { id } }),
  });
  const row = data?.row ?? null;

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

  return (
    <div className="space-y-6 pb-10">
      <Link
        to="/mes-demandes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("mesDemandes.detail.back")}
      </Link>

      {isLoading && <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />}

      {!isLoading && !row && (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Truck className="h-8 w-8 text-muted-foreground" />
            <div className="text-lg font-semibold">{t("mesDemandes.detail.notFound")}</div>
            <p className="text-sm text-muted-foreground">{t("mesDemandes.detail.notFoundText")}</p>
          </CardContent>
        </Card>
      )}

      {row && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {row.preferred_brand ?? t("mesDemandes.vehicleSearch")} {row.preferred_model ?? ""}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.reference_number ? `${row.reference_number} · ` : ""}
                {t("mesDemandes.createdOn", {
                  date: new Date(row.created_at).toLocaleDateString("fr-FR"),
                })}
              </p>
            </div>
            <Badge variant="secondary">{STATUS_LABEL[row.status] ?? row.status}</Badge>
          </div>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold">{t("buyer.steps.vehicle")}</h2>
              <dl className="mt-2">
                {field(t("buyer.fields.vehicleCategory"), row.vehicle_category)}
                {field(t("buyer.fields.vehicleType"), row.vehicle_type)}
                {field(t("buyer.fields.brand"), row.preferred_brand)}
                {field(t("buyer.fields.model"), row.preferred_model)}
                {field(t("buyer.fields.minYear"), row.min_year)}
                {field(t("buyer.fields.maxMileage"), row.max_mileage)}
                {field(t("buyer.fields.intendedUse"), row.intended_use)}
                {field(t("buyer.fields.usageCountry"), row.usage_country)}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold">{t("buyer.steps.budget")}</h2>
              <dl className="mt-2">
                {field(
                  t("buyer.fields.maxBudget"),
                  row.max_budget_ht != null ? `${row.max_budget_ht} ${row.currency ?? ""}` : null,
                )}
                {field(t("buyer.fields.timeline"), row.buy_timeline)}
                {field(t("buyer.fields.financing"), row.financing_needed)}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold">{t("buyer.steps.contact")}</h2>
              <dl className="mt-2">
                {field(t("buyer.fields.firstName"), row.first_name)}
                {field(t("buyer.fields.lastName"), row.last_name)}
                {field(t("buyer.fields.email"), row.email)}
                {field(t("buyer.fields.phone"), row.phone)}
              </dl>
            </CardContent>
          </Card>

          {row.message && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold">{t("buyer.fields.message")}</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {row.message}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
