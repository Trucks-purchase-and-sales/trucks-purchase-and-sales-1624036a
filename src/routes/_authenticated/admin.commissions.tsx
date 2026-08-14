import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listCommissions, approveCommission, markCommissionPaid, cancelCommission,
} from "@/lib/commissions.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin", "sales_manager", "company_management"]);
  },
  component: Page,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "À valider", approved: "Validée", paid: "Versée", cancelled: "Annulée",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary", approved: "default", paid: "default", cancelled: "outline",
};
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const listFn = useServerFn(listCommissions);
  const approveFn = useServerFn(approveCommission);
  const payFn = useServerFn(markCommissionPaid);
  const cancelFn = useServerFn(cancelCommission);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-commissions", status],
    queryFn: () => listFn({ data: { status: status === "all" ? undefined : (status as "draft" | "approved" | "paid" | "cancelled") } }),
  });
  const rows = (data?.commissions ?? []) as Array<Record<string, unknown> & {
    id: string; status: string; computed_amount_eur: number; created_at: string;
    opportunity?: { reference_number: string | null; brand: string | null; model: string | null };
    partner?: { first_name: string | null; last_name: string | null; company_name: string | null };
  }>;

  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["admin-commissions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Commissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Approuver et suivre les commissions des partenaires.</p>
        </div>
        <div className="w-48">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="draft">À valider</SelectItem>
              <SelectItem value="approved">Validées</SelectItem>
              <SelectItem value="paid">Versées</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Aucune commission dans cette vue.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const partnerName =
              r.partner?.company_name ||
              (`${r.partner?.first_name ?? ""} ${r.partner?.last_name ?? ""}`.trim() || "—");
            return (
              <Card key={r.id} className="border-border/70">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      <Link
                        to="/admin/opportunities/$id"
                        params={{ id: r.vehicle_opportunity_id as string }}
                        className="hover:underline"
                      >
                        {r.opportunity?.reference_number ?? "—"}
                      </Link>{" "}
                      · {r.opportunity?.brand ?? ""} {r.opportunity?.model ?? ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Partenaire : {partnerName} · créée le {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold">{fmt(Number(r.computed_amount_eur))}</div>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {r.status === "draft" && (
                      <Button size="sm" onClick={() => act(() => approveFn({ data: { id: r.id } }), "Validée")}>
                        Valider
                      </Button>
                    )}
                    {r.status === "approved" && (
                      <Button size="sm" onClick={() => act(() => payFn({ data: { id: r.id } }), "Versée")}>
                        Marquer versée
                      </Button>
                    )}
                    {r.status !== "paid" && r.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => act(() => cancelFn({ data: { id: r.id } }), "Annulée")}>
                        Annuler
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
