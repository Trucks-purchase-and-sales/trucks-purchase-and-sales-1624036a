import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSaleListings } from "@/lib/sale-listings.functions";
import { SALE_LISTING_STATUS_LABEL, SALE_LISTING_STATUS_CLASS, marginOf } from "@/lib/sale-listings.constants";
import { formatPrice, formatDate } from "@/lib/wilmet-constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronRight, Tag } from "lucide-react";

const FILTERS = ["tous", "brouillon", "publiee", "reservee", "vendue", "retiree"] as const;

export const Route = createFileRoute("/_authenticated/admin/sale-listings/")({
  head: () => ({
    meta: [
      { title: "Offres de vente — Wilmet Trucks" },
      { name: "description", content: "Annonces de revente issues des véhicules achetés par Wilmet." },
    ],
  }),
  component: Page,
});

function Page() {
  const listFn = useServerFn(listSaleListings);
  const { data, isLoading } = useQuery({ queryKey: ["sale-listings"], queryFn: () => listFn({ data: {} }) });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("tous");

  const rows = (data?.rows ?? []) as any[];
  const filtered = rows.filter((r) => {
    if (status !== "tous" && r.status !== status) return false;
    if (!q) return true;
    const o = r.vehicle_opportunities ?? {};
    const hay = `${r.reference_number ?? ""} ${r.title ?? ""} ${r.city ?? ""} ${r.country ?? ""} ${o.reference_number ?? ""} ${o.brand ?? ""} ${o.model ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Tag className="h-6 w-6 text-accent" /> Offres de vente
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Annonces de revente créées depuis les véhicules achetés.
          </p>
        </div>
        <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full max-w-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={status === f ? "default" : "outline"} onClick={() => setStatus(f)}>
            {f === "tous" ? "Toutes" : SALE_LISTING_STATUS_LABEL[f]}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune offre de vente. Créez-en une depuis une opportunité achetée.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Réf.</th>
                    <th className="p-2 text-left">Véhicule</th>
                    <th className="p-2 text-left">Statut</th>
                    <th className="p-2 text-right">Achat</th>
                    <th className="p-2 text-right">Vente</th>
                    <th className="p-2 text-right">Marge</th>
                    <th className="p-2 text-left">Créée</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const m = marginOf(r.sold_price_excl_tax ?? r.sale_price_excl_tax, r.purchase_price_snapshot);
                    return (
                      <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/40">
                        <td className="p-2 font-mono text-xs">{r.reference_number ?? "—"}</td>
                        <td className="p-2">
                          <div className="font-medium">{r.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.vehicle_opportunities?.reference_number ?? "—"} · {r.city || "—"}
                          </div>
                        </td>
                        <td className="p-2">
                          <Badge className={SALE_LISTING_STATUS_CLASS[r.status]}>
                            {SALE_LISTING_STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">{formatPrice(r.purchase_price_snapshot)}</td>
                        <td className="p-2 text-right">{formatPrice(r.sold_price_excl_tax ?? r.sale_price_excl_tax)}</td>
                        <td className="p-2 text-right">
                          {m ? (
                            <span className={m.amount >= 0 ? "text-status-accepted-foreground" : "text-status-refused-foreground"}>
                              {formatPrice(m.amount)} ({m.pct.toFixed(0)} %)
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
                        <td className="p-2 text-right">
                          <Link to="/admin/sale-listings/$id" params={{ id: r.id }} className="inline-flex items-center text-accent">
                            Ouvrir <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
