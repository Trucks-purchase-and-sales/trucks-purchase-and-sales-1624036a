import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOpportunities, signPhotoUrls } from "@/lib/opportunities.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  ImageIcon,
  MapPin,
  Gauge,
  Calendar as CalendarIcon,
  Truck,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  VEHICLE_TYPE_OPTIONS,
  STATUS_LABEL,
  formatPrice,
  formatDate,
  labelFor,
  type OpportunityStatus,
} from "@/lib/wilmet-constants";
import { StatTileButton } from "@/components/dashboard/StatTile";
import { StageTiles } from "@/components/dashboard/StageTiles";

type Search = { status?: string; vtype?: string; q?: string };

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    vtype: typeof search["vtype"] === "string" ? search["vtype"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();
  const listFn = useServerFn(listMyOpportunities);
  const signFn = useServerFn(signPhotoUrls);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const status = search.status ?? "all";
  const vtype = search.vtype ?? "all";
  const q = search.q ?? "";
  const setStatus = (v: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, status: v === "all" ? undefined : v }) });
  const setVtype = (v: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, vtype: v === "all" ? undefined : v }) });
  const setQ = (v: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, q: v || undefined }) });
  /** "sent" is a virtual bucket: everything that left draft state. */
  const toggle = (next: string) => setStatus(status === next ? "all" : next);
  const { userId } = Route.useRouteContext() as { userId: string };

  // Only partner sellers belong on this dashboard. Everyone else (admin,
  // direction, sales manager, sales agent, client) is redirected to their
  // canonical landing route.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { resolveRoleHome } = await import("@/hooks/useRoleHome");
      const home = await resolveRoleHome(userId);
      if (!cancelled && home !== "/dashboard") {
        navigate({ to: home, replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-opps"],
    queryFn: () => listFn(),
  });

  const paths = useMemo(() => Object.values(data?.mainByOpp ?? {}), [data]);
  const { data: urlsData } = useQuery({
    queryKey: ["main-photo-urls", paths.join("|")],
    queryFn: () => signFn({ data: { paths } }),
    enabled: paths.length > 0,
  });
  const urls = urlsData?.urls ?? {};

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => {
      if (status === "sent") {
        if (r.status === "brouillon") return false;
      } else if (status !== "all" && r.status !== status) return false;
      if (vtype !== "all" && r.vehicle_type !== vtype) return false;
      if (q) {
        const s = q.toLowerCase();
        const hay =
          `${r.brand ?? ""} ${r.model ?? ""} ${r.city ?? ""} ${r.reference_number ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [data, status, vtype, q]);

  const summary = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      sent: rows.filter((r) => r.status !== "brouillon").length,
      analysis: rows.filter((r) => r.status === "en_cours_analyse").length,
      accepted: rows.filter((r) => r.status === "achetee").length,
      refused: rows.filter((r) => r.status === "refusee").length,
    };
  }, [data]);

  /** Count per status across the whole portfolio, independent of the filter. */
  const byStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of data?.rows ?? []) acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, [data]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("dashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/opportunities/new">
            <Plus className="mr-1.5 h-4 w-4" /> {t("dashboard.proposeVehicle")}
          </Link>
        </Button>
      </div>

      {(() => {
        const todo = (data?.rows ?? []).filter(
          (r) => (r as any).owner_side === "partenaire" && r.status !== "brouillon", // eslint-disable-line @typescript-eslint/no-explicit-any
        );
        if (todo.length === 0) return null;
        return (
          <Card className="border-accent/50 bg-accent/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-accent">
                    {t("dashboard.handedBack.title")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.handedBack.text")}
                  </div>
                </div>
                <div className="text-2xl font-bold text-accent">{todo.length}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {todo.slice(0, 6).map((r) => (
                  <Link
                    key={r.id}
                    to="/opportunities/$id"
                    params={{ id: r.id }}
                    className="rounded-md border border-accent/40 bg-background px-2.5 py-1 text-xs hover:bg-accent/10"
                  >
                    {r.reference_number ?? `${r.brand ?? ""} ${r.model ?? ""}`}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTileButton
            icon={Truck}
            label={t("dashboard.kpi.sent")}
            value={summary.sent}
            active={status === "sent"}
            onClick={() => toggle("sent")}
          />
          <StatTileButton
            icon={Truck}
            label={STATUS_LABEL.en_cours_analyse}
            value={summary.analysis}
            tint="analysis"
            active={status === "en_cours_analyse"}
            onClick={() => toggle("en_cours_analyse")}
          />
          <StatTileButton
            icon={Truck}
            label={t("dashboard.kpi.accepted")}
            value={summary.accepted}
            tint="accepted"
            active={status === "achetee"}
            onClick={() => toggle("achetee")}
          />
          <StatTileButton
            icon={Truck}
            label={t("dashboard.kpi.refused")}
            value={summary.refused}
            tint="refused"
            active={status === "refusee"}
            onClick={() => toggle("refusee")}
          />
        </div>

        <StageTiles counts={byStatus} activeStatus={status} onSelect={(s) => toggle(s)} />

        {status !== "all" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t("dashboard.filter.active")}{" "}
              <span className="font-medium text-foreground">
                {status === "sent"
                  ? t("dashboard.filter.sentShort")
                  : (STATUS_LABEL[status as OpportunityStatus] ?? status)}
              </span>
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setStatus("all")}>
              {t("dashboard.filter.reset")}
            </Button>
          </div>
        )}
      </div>

      <Card className="border-border/70">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("dashboard.search.placeholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={t("dashboard.filter.statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.filter.allStatuses")}</SelectItem>
              <SelectItem value="sent">{t("dashboard.filter.sentOption")}</SelectItem>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vtype} onValueChange={setVtype}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={t("dashboard.filter.vehicleTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.filter.allTypes")}</SelectItem>
              {VEHICLE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasAny={(data?.rows ?? []).length > 0}
          onCreate={() => navigate({ to: "/opportunities/new" })}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const path = data?.mainByOpp[r.id];
            const src = path ? urls[path] : undefined;
            return (
              <Link key={r.id} to="/opportunities/$id" params={{ id: r.id }} className="group">
                <Card className="overflow-hidden border-border/70 transition-shadow hover:shadow-md">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
                    {src ? (
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-10 w-10 opacity-50" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      <StatusBadge status={r.status as OpportunityStatus} />
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">
                          {r.brand || "—"} {r.model || ""}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {labelFor(VEHICLE_TYPE_OPTIONS, r.vehicle_type)}
                          {r.reference_number ? ` · ${r.reference_number}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-semibold text-accent">
                        {formatPrice(r.desired_price_excl_tax)}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <MetaLine icon={CalendarIcon}>{r.year || "—"}</MetaLine>
                      <MetaLine icon={Gauge}>
                        {r.mileage ? r.mileage.toLocaleString("fr-FR") + " km" : "—"}
                      </MetaLine>
                      <MetaLine icon={MapPin}>{r.city || "—"}</MetaLine>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t("dashboard.updatedAt", { date: formatDate(r.updated_at) })}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetaLine({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function EmptyState({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="border-dashed border-border/70">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
          <Truck className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <div className="text-lg font-semibold">
            {hasAny ? t("dashboard.empty.filteredTitle") : t("dashboard.empty.title")}
          </div>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {hasAny ? t("dashboard.empty.filteredText") : t("dashboard.empty.text")}
          </p>
        </div>
        <Button onClick={onCreate} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="mr-1.5 h-4 w-4" /> {t("dashboard.proposeVehicle")}
        </Button>
      </CardContent>
    </Card>
  );
}
