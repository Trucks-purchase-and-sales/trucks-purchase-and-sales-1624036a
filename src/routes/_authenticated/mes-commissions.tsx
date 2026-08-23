import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { partnerCommissionSummary } from "@/lib/commissions.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mes-commissions")({ component: Page });

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  approved: "default",
  paid: "default",
  cancelled: "outline",
};
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function Page() {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    draft: t("mesCommissions.status.draft"),
    approved: t("mesCommissions.status.approved"),
    paid: t("mesCommissions.status.paid"),
    cancelled: t("mesCommissions.status.cancelled"),
  };
  const fn = useServerFn(partnerCommissionSummary);
  const { data, isLoading } = useQuery({ queryKey: ["my-commissions"], queryFn: () => fn() });
  const rows = (data?.commissions ?? []) as Array<{
    id: string;
    status: string;
    computed_amount_eur: number;
    created_at: string;
    approved_at: string | null;
    paid_at: string | null;
    opportunity?: { reference_number: string | null; brand: string | null; model: string | null };
  }>;
  const totals = data?.totals ?? { draft: 0, approved: 0, paid: 0 };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("mesCommissions.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("mesCommissions.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPI label={t("mesCommissions.status.draft")} value={totals.draft} tone="muted" />
        <KPI label={t("mesCommissions.status.approved")} value={totals.approved} tone="accent" />
        <KPI label={t("mesCommissions.status.paid")} value={totals.paid} tone="success" />
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-accent" /> {t("mesCommissions.detail")}
        </div>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("mesCommissions.empty")}</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="border-border/70">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-sm font-medium">
                      {r.opportunity?.reference_number ?? "—"} · {r.opportunity?.brand ?? ""}{" "}
                      {r.opportunity?.model ?? ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("mesCommissions.createdOn", {
                        date: new Date(r.created_at).toLocaleDateString("fr-FR"),
                      })}
                      {r.paid_at &&
                        ` · ${t("mesCommissions.paidOn", { date: new Date(r.paid_at).toLocaleDateString("fr-FR") })}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold">
                      {fmt(Number(r.computed_amount_eur))}
                    </div>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "accent" | "success";
}) {
  const cls =
    tone === "success"
      ? "text-status-received-foreground"
      : tone === "accent"
        ? "text-accent"
        : "text-foreground";
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${cls}`}>{fmt(Number(value))}</div>
      </CardContent>
    </Card>
  );
}
