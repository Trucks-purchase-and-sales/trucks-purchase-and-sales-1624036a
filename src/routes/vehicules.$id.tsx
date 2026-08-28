import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicShell } from "@/components/public/PublicShell";
import { useI18nInit } from "@/i18n/useI18nInit";
import { getPublicVehicle } from "@/lib/public-catalog.functions";
import { formatPrice } from "@/lib/wilmet-constants";

export const Route = createFileRoute("/vehicules/$id")({
  head: () => ({
    meta: [
      { title: "Fiche véhicule — Wilmet Trucks" },
      {
        name: "description",
        content:
          "Détail technique, photos et disponibilité d'un véhicule industriel d'occasion proposé par Wilmet Trucks.",
      },
      { property: "og:title", content: "Fiche véhicule — Wilmet Trucks" },
      {
        property: "og:description",
        content:
          "Détail technique, photos et disponibilité d'un véhicule industriel d'occasion proposé par Wilmet Trucks.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VehicleDetail,
});

const SPEC_KEYS = [
  "brand",
  "model",
  "version",
  "year",
  "mileage",
  "vehicleType",
  "bodyType",
  "fuelType",
  "gearbox",
  "power",
  "euroStandard",
  "grossVehicleWeight",
  "payload",
  "axleConfiguration",
  "cabinType",
  "generalCondition",
] as const;

function pretty(key: string, value: unknown) {
  if (value == null || value === "") return null;
  if (key === "mileage") return `${Number(value).toLocaleString("fr-FR")} km`;
  return String(value).replace(/_/g, " ");
}

function VehicleDetail() {
  useI18nInit();
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const fn = useServerFn(getPublicVehicle);
  const [active, setActive] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["public-vehicle", id],
    queryFn: () => fn({ data: { id } }),
  });
  const v = data?.vehicle ?? null;

  return (
    <PublicShell>
      <div className="container-page py-8">
        <Link
          to="/vehicules"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("catalog.back")}
        </Link>

        {isLoading && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <Skeleton className="aspect-[4/3] rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        )}

        {!isLoading && !v && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-10 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">{t("catalog.notFound.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("catalog.notFound.text")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/vehicules">{t("catalog.notFound.browse")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/chercher-un-vehicule">{t("catalog.empty.cta")}</Link>
              </Button>
            </div>
          </div>
        )}

        {v && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
                {v.images.length > 0 ? (
                  <img
                    src={v.images[active]}
                    alt={v.title}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-[4/3] w-full place-items-center text-muted-foreground">
                    <Truck className="h-12 w-12" />
                  </div>
                )}
              </div>
              {v.images.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {v.images.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={t("catalog.photo", { index: i + 1 })}
                      className={`overflow-hidden rounded-lg border ${i === active ? "border-accent" : "border-border"}`}
                    >
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {v.description && (
                <div className="mt-8">
                  <h2 className="text-lg font-semibold">{t("catalog.description")}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {v.description}
                  </p>
                </div>
              )}

              <div className="mt-8">
                <h2 className="text-lg font-semibold">{t("catalog.specsTitle")}</h2>
                <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {SPEC_KEYS.map((key) => {
                    const label = t(`catalog.spec.${key}`);
                    const value = pretty(key, (v.specs as Record<string, unknown>)[key]);
                    if (!value) return null;
                    return (
                      <div
                        key={key}
                        className="flex justify-between gap-4 border-b border-border/50 py-1.5 text-sm"
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    );
                  })}
                </dl>
                {v.specs.equipment.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">{t("catalog.equipment")}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {v.specs.equipment.map((e) => (
                        <Badge key={e} variant="outline">
                          {e.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border bg-card p-6">
                {v.reference && (
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("catalog.ref")} {v.reference}
                  </div>
                )}
                <h1 className="mt-1 text-xl font-bold leading-snug">{v.title}</h1>
                <div className="mt-4 text-2xl font-extrabold">
                  {v.price != null ? formatPrice(v.price) : t("catalog.priceOnRequest")}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("catalog.priceExclVat")}
                </div>

                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {(v.city || v.country) && (
                    <li>
                      {t("catalog.location")} : {[v.city, v.country].filter(Boolean).join(", ")}
                    </li>
                  )}
                  {v.availability && (
                    <li>
                      {t("catalog.availability")} : {v.availability.replace(/_/g, " ")}
                    </li>
                  )}
                  <li>
                    {t("catalog.status")} :{" "}
                    {v.status === "reservee" ? (
                      <Badge className="bg-status-pending text-status-pending-foreground">
                        {t("catalog.reserved")}
                      </Badge>
                    ) : (
                      <Badge className="bg-status-info text-status-info-foreground">
                        {t("catalog.available")}
                      </Badge>
                    )}
                  </li>
                </ul>

                <Button
                  asChild
                  size="lg"
                  className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Link
                    to="/chercher-un-vehicule"
                    search={{ vehicleRef: v.reference ? `${v.title} (${v.reference})` : v.title }}
                  >
                    {t("catalog.interested")}
                  </Link>
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t("catalog.replyNote")}
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
