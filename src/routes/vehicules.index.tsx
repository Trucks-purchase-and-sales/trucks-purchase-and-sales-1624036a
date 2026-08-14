import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useServerFn } from "@tanstack/react-start";
import { Gauge, CalendarDays, MapPin, Search, Truck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicShell } from "@/components/public/PublicShell";
import { useI18nInit } from "@/i18n/useI18nInit";
import { listPublicVehicles } from "@/lib/public-catalog.functions";
import { formatPrice } from "@/lib/wilmet-constants";

export const Route = createFileRoute("/vehicules/")({
  head: () => ({
    meta: [
      { title: "Véhicules à vendre — Wilmet Trucks" },
      { name: "description", content: "Camions, tracteurs, remorques et utilitaires d'occasion disponibles chez Wilmet Trucks. Véhicules contrôlés, prix hors TVA, livraison en Europe." },
      { property: "og:title", content: "Véhicules à vendre — Wilmet Trucks" },
      { property: "og:description", content: "Découvrez les véhicules industriels d'occasion actuellement disponibles chez Wilmet Trucks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  useI18nInit();
  const { t } = useTranslation();
  const fn = useServerFn(listPublicVehicles);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["public-vehicles"],
    queryFn: () => fn({ data: {} }),
  });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((v) =>
      [v.title, v.brand, v.model, v.city, v.country, v.reference]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle)),
    );
  }, [data, q]);

  return (
    <PublicShell>
      <section className="border-b border-border/60 bg-primary py-12 text-primary-foreground">
        <div className="container-page">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t("catalog.eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("catalog.title")}</h1>
          <p className="mt-3 max-w-2xl text-sm text-primary-foreground/80 sm:text-base">
            {t("catalog.subtitle")}
          </p>
          <div className="mt-6 flex max-w-xl items-center gap-2 rounded-xl bg-background p-1.5">
            <Search className="ml-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("catalog.searchPlaceholder")}
              className="border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0"
              aria-label={t("catalog.searchLabel")}
            />
          </div>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">{t("catalog.empty.title")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {t("catalog.empty.text")}
            </p>
            <Button asChild className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/chercher-un-vehicule">{t("catalog.empty.cta")}</Link>
            </Button>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <>
            <div className="mb-6 text-sm text-muted-foreground">
              {t("catalog.count", { count: items.length })}
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((v) => (
                <Link
                  key={v.id}
                  to="/vehicules/$id"
                  params={{ id: v.id }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-accent/60 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                    {v.cover ? (
                      <img
                        src={v.cover}
                        alt={v.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <Truck className="h-10 w-10" />
                      </div>
                    )}
                    {v.status === "reservee" && (
                      <Badge className="absolute left-3 top-3 bg-status-pending text-status-pending-foreground">{t("catalog.reserved")}</Badge>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {[v.brand, v.model].filter(Boolean).join(" ") || v.reference || t("catalog.vehicle")}
                    </div>
                    <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-snug">{v.title}</h2>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {v.year && <li className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{v.year}</li>}
                      {v.mileage != null && <li className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{v.mileage.toLocaleString("fr-FR")} km</li>}
                      {(v.city || v.country) && <li className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[v.city, v.country].filter(Boolean).join(", ")}</li>}
                    </ul>
                    <div className="mt-4 flex items-end justify-between border-t border-border/60 pt-4">
                      <div>
                        <div className="text-lg font-bold">{v.price != null ? formatPrice(v.price) : t("catalog.priceOnRequest")}</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("catalog.exclVat")}</div>
                      </div>
                      <span className="text-sm font-medium text-accent group-hover:underline">{t("catalog.viewDetails")}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </PublicShell>
  );
}
