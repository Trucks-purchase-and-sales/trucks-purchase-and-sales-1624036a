import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListOpportunities, adminExportOpportunitiesCsv } from "@/lib/admin.functions";
import { signPhotoUrls } from "@/lib/opportunities.functions";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Truck,
  Search,
  ImageIcon,
  Download,
  Building2,
  User2,
  LayoutGrid,
  List,
  Columns3,
} from "lucide-react";
import {
  STATUS_LABEL,
  VEHICLE_TYPE_OPTIONS,
  formatPrice,
  formatDate,
  labelFor,
  type OpportunityStatus,
} from "@/lib/wilmet-constants";
import { StageTiles } from "@/components/dashboard/StageTiles";

type View = "tiles" | "list" | "kanban";
type Search = { status?: string; view?: View };

const VIEWS: View[] = ["tiles", "list", "kanban"];

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    view: VIEWS.includes(search["view"] as View) ? (search["view"] as View) : undefined,
  }),
  component: AdminList,
});

function AdminList() {
  const { t } = useTranslation();
  const listFn = useServerFn(adminListOpportunities);
  const signFn = useServerFn(signPhotoUrls);
  const exportFn = useServerFn(adminExportOpportunitiesCsv);

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const view: View = search.view ?? "tiles";
  const status = search.status ?? "all";
  const setView = (v: View) =>
    navigate({ search: (prev: Search) => ({ ...prev, view: v === "tiles" ? undefined : v }) });
  const setStatus = (v: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, status: v === "all" ? undefined : v }) });
  /** Clicking a stage tile filters the current view; clicking again clears it. */
  const toggleStatus = (next: string) => {
    const clear = status === next;
    navigate({ search: (prev: Search) => ({ ...prev, status: clear ? undefined : next }) });
  };
  const [q, setQ] = useState("");
  const [vtype, setVtype] = useState("all");
  const [ownerSide, setOwnerSide] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filters = useMemo(
    () => ({
      status: status !== "all" ? [status] : undefined,
      ownerSide: ownerSide !== "all" ? (ownerSide as "partenaire" | "wilmet") : undefined,
      vehicleType: vtype !== "all" ? vtype : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [status, ownerSide, vtype, minPrice, maxPrice, fromDate, toDate],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-opps", filters],
    queryFn: () => listFn({ data: filters }),
  });

  // Counts must stay stable while a status filter is active, so they come from
  // an unfiltered fetch of the same scope.
  const { data: allData } = useQuery({
    queryKey: ["admin-opps-counts"],
    queryFn: () => listFn({ data: {} }),
  });
  const byStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of (allData?.rows ?? []) as { status: string }[])
      acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, [allData]);
  const paths = useMemo(() => Object.values(data?.mainByOpp ?? {}), [data]);
  const { data: urls } = useQuery({
    queryKey: ["admin-urls", paths.join("|")],
    queryFn: () => signFn({ data: { paths } }),
    enabled: paths.length > 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = ((data?.rows ?? []) as any[]).filter((r: any) => {
    if (!q) return true;
    const p = data?.profiles?.[r.partenaire_id];
    const hay =
      `${r.brand ?? ""} ${r.model ?? ""} ${r.city ?? ""} ${r.reference_number ?? ""} ${p?.first_name ?? ""} ${p?.last_name ?? ""} ${p?.company_name ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  async function downloadCsv() {
    try {
      const res = await exportFn({ data: filters });
      const blob = new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wilmet-opportunites-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("admin.opportunities.toast.exportSuccess", { count: res.count }));
    } catch (e) {
      toast.error(t("admin.opportunities.toast.exportError"), {
        description: (e as Error).message,
      });
    }
  }

  const kanbanCols: { key: OpportunityStatus; title: string }[] = [
    { key: "envoyee", title: t("admin.opportunities.kanban.envoyee") },
    { key: "en_cours_analyse", title: t("admin.opportunities.kanban.enTraitement") },
    { key: "offre_envoyee", title: t("admin.opportunities.kanban.offreEnvoyee") },
    { key: "achetee", title: t("admin.opportunities.kanban.achetees") },
    { key: "livree", title: t("admin.opportunities.kanban.livrees") },
    { key: "refusee", title: t("admin.opportunities.kanban.nonAbouties") },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.opportunities.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.opportunities.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="tiles">
                <LayoutGrid className="mr-1.5 h-4 w-4" /> {t("admin.opportunities.tabs.tiles")}
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="mr-1.5 h-4 w-4" /> {t("admin.opportunities.tabs.list")}
              </TabsTrigger>
              <TabsTrigger value="kanban">
                <Columns3 className="mr-1.5 h-4 w-4" /> {t("admin.opportunities.tabs.kanban")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={downloadCsv}>
            <Download className="mr-1.5 h-4 w-4" /> {t("admin.opportunities.exportCsv")}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <StageTiles counts={byStatus} activeStatus={status} onSelect={(s) => toggleStatus(s)} />

        {status !== "all" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t("admin.opportunities.filters.activeFilter")}{" "}
              <span className="font-medium text-foreground">
                {STATUS_LABEL[status as OpportunityStatus] ?? status}
              </span>
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setStatus("all")}>
              {t("admin.opportunities.filters.reset")}
            </Button>
          </div>
        )}
      </div>

      <Card className="border-border/70">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("admin.opportunities.filters.searchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.opportunities.filters.statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.opportunities.filters.allStatuses")}</SelectItem>
              {Object.entries(STATUS_LABEL)
                .filter(([v]) => v !== "brouillon")
                .map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={ownerSide} onValueChange={setOwnerSide}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.opportunities.filters.ownerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.opportunities.filters.allOwners")}</SelectItem>
              <SelectItem value="wilmet">{t("admin.opportunities.filters.ownerWilmet")}</SelectItem>
              <SelectItem value="partenaire">
                {t("admin.opportunities.filters.ownerPartner")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={vtype} onValueChange={setVtype}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.opportunities.filters.vehicleTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("admin.opportunities.filters.allVehicleTypes")}
              </SelectItem>
              {VEHICLE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("admin.opportunities.filters.minPrice")}
            value={minPrice}
            type="number"
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <Input
            placeholder={t("admin.opportunities.filters.maxPrice")}
            value={maxPrice}
            type="number"
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <Input
            placeholder={t("admin.opportunities.filters.fromDate")}
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Input
            placeholder={t("admin.opportunities.filters.toDate")}
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : view === "kanban" ? (
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {kanbanCols.map((col) => {
            const items = filtered.filter((r) => r.status === col.key);
            return (
              <div key={col.key} className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">{col.title}</div>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((r) => (
                    <KanbanCard key={r.id} r={r} profiles={data?.profiles} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "list" ? (
        <Card className="overflow-hidden border-border/70">
          <div className="divide-y divide-border/60">
            {filtered.map((r) => {
              const p = data?.profiles?.[r.partenaire_id];
              return (
                <Link
                  key={r.id}
                  to="/admin/opportunities/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {r.brand} {r.model}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.reference_number} · {labelFor(VEHICLE_TYPE_OPTIONS, r.vehicle_type)} ·{" "}
                      {r.city ?? "—"}
                    </div>
                  </div>
                  <div className="hidden min-w-0 flex-1 text-xs text-muted-foreground sm:block">
                    {p
                      ? `${p.first_name} ${p.last_name}${p.company_name ? " · " + p.company_name : ""}`
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(r.submitted_at)}</div>
                  <div className="text-sm font-semibold text-accent">
                    {formatPrice(r.desired_price_excl_tax)}
                  </div>
                  <StatusBadge status={r.status as OpportunityStatus} />
                </Link>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const p = data?.profiles?.[r.partenaire_id];
            const path = data?.mainByOpp?.[r.id];
            const src = path ? urls?.urls?.[path] : undefined;
            return (
              <Link key={r.id} to="/admin/opportunities/$id" params={{ id: r.id }}>
                <Card className="overflow-hidden border-border/70 transition-shadow hover:shadow-md">
                  <div className="relative aspect-[16/10] w-full bg-secondary">
                    {src ? (
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <ImageIcon className="h-10 w-10 opacity-50" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1">
                      <StatusBadge status={r.status as OpportunityStatus} />
                      <Badge variant="outline" className="bg-background/80">
                        {r.owner_side === "partenaire" ? (
                          <>
                            <User2 className="mr-1 h-3 w-3" />{" "}
                            {t("admin.opportunities.ownerBadge.partner")}
                          </>
                        ) : (
                          <>
                            <Building2 className="mr-1 h-3 w-3" />{" "}
                            {t("admin.opportunities.ownerBadge.wilmet")}
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">
                          {r.brand} {r.model}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {labelFor(VEHICLE_TYPE_OPTIONS, r.vehicle_type)} · {r.reference_number}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-accent">
                        {formatPrice(r.desired_price_excl_tax)}
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      {t("admin.opportunities.contributor")}{" "}
                      <span className="font-medium text-foreground">
                        {p
                          ? `${p.first_name} ${p.last_name}${p.company_name ? " · " + p.company_name : ""}`
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {t("admin.opportunities.sentOn", { date: formatDate(r.submitted_at) })}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KanbanCard({ r, profiles }: { r: any; profiles?: Record<string, any> }) {
  const { t } = useTranslation();
  const p = profiles?.[r.partenaire_id];
  return (
    <Link to="/admin/opportunities/$id" params={{ id: r.id }}>
      <div className="rounded-md border border-border bg-card p-2 text-xs shadow-sm hover:shadow">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-sm font-semibold">
            {r.brand} {r.model}
          </span>
          <span className="shrink-0 font-semibold text-accent">
            {formatPrice(r.desired_price_excl_tax)}
          </span>
        </div>
        <div className="mt-1 truncate text-muted-foreground">
          {r.reference_number} · {r.city ?? "—"}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate">{p ? `${p.first_name} ${p.last_name}` : "—"}</span>
          <Badge variant="outline" className="text-[9px]">
            {r.owner_side === "partenaire"
              ? t("admin.opportunities.ownerBadge.partner")
              : t("admin.opportunities.ownerBadge.wilmet")}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <Card className="border-dashed border-border/70">
      <CardContent className="p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
          <Truck className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="mt-4 text-lg font-semibold">{t("admin.opportunities.empty.title")}</div>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {t("admin.opportunities.empty.text")}
        </p>
      </CardContent>
    </Card>
  );
}
