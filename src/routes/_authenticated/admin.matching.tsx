import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  listMatchingProfiles,
  saveMatchingProfile,
  deleteMatchingProfile,
  listMatchingSources,
  listMatchCandidates,
  runMatching,
  runGlobalMatching,
  setMatchStatus,
  voteMatch,
  notifyMatch,
  listAllMatches,
  matchingAnalytics,
} from "@/lib/matching.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
  Play,
  ThumbsUp,
  ThumbsDown,
  Pin,
  X,
  Check,
  Bell,
  Save,
  Trash2,
  Zap,
  LayoutGrid,
  Inbox,
  BarChart3,
  Grid3x3,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { formatPrice } from "@/lib/wilmet-constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RTooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/matching")({
  component: AdminMatching,
});

type Profile = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  weights: {
    attributes: number;
    geography: number;
    commercial: number;
    price: number;
    freeform: number;
  };
  hard_filters: {
    require_vehicle_type: boolean;
    require_brand: boolean;
    year_tolerance: number;
    price_tolerance_pct: number;
  };
  ai_blend: number;
  min_score: number;
  max_results: number;
  auto_notify: boolean;
  model_id: string;
};

const DEFAULT_PROFILE: Profile = {
  id: "",
  name: "Nouveau profil",
  description: "",
  is_default: false,
  weights: { attributes: 30, geography: 15, commercial: 20, price: 20, freeform: 15 },
  hard_filters: {
    require_vehicle_type: true,
    require_brand: false,
    year_tolerance: 2,
    price_tolerance_pct: 20,
  },
  ai_blend: 0.6,
  min_score: 60,
  max_results: 10,
  auto_notify: false,
  model_id: "google/gemini-3.5-flash",
};

function AdminMatching() {
  const { t } = useTranslation();
  const listProfilesFn = useServerFn(listMatchingProfiles);
  const profilesQ = useQuery({ queryKey: ["matching-profiles"], queryFn: () => listProfilesFn() });
  const profiles = (profilesQ.data ?? []) as Profile[]; // eslint-disable-line react-hooks/exhaustive-deps

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const activeProfile = useMemo(
    () =>
      profiles.find((p) => p.id === activeProfileId) ??
      profiles.find((p) => p.is_default) ??
      profiles[0] ??
      null,
    [profiles, activeProfileId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> {t("admin.matching.heading")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("admin.matching.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">
            {t("admin.matching.activeProfileLabel")}
          </Label>
          <Select value={activeProfile?.id ?? ""} onValueChange={setActiveProfileId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("admin.matching.profilePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.is_default ? ` (${t("admin.matching.defaultSuffix")})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">
            <Inbox className="h-4 w-4 mr-1" /> {t("admin.matching.tabs.inbox")}
          </TabsTrigger>
          <TabsTrigger value="heatmap">
            <Grid3x3 className="h-4 w-4 mr-1" /> {t("admin.matching.tabs.heatmap")}
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-1" /> {t("admin.matching.tabs.analytics")}
          </TabsTrigger>
          <TabsTrigger value="console">
            <LayoutGrid className="h-4 w-4 mr-1" /> {t("admin.matching.tabs.console")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="pt-4">
          <InboxTab activeProfile={activeProfile} />
        </TabsContent>
        <TabsContent value="heatmap" className="pt-4">
          <HeatmapTab activeProfile={activeProfile} />
        </TabsContent>
        <TabsContent value="analytics" className="pt-4">
          <AnalyticsTab activeProfile={activeProfile} />
        </TabsContent>
        <TabsContent value="console" className="pt-4">
          <ConsoleTab
            activeProfileId={activeProfile?.id ?? null}
            setActiveProfileId={setActiveProfileId}
            profiles={profiles}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// INBOX TAB: side-by-side compare
// ============================================================
function InboxTab({ activeProfile }: { activeProfile: Profile | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listAllFn = useServerFn(listAllMatches);
  const setStatusFn = useServerFn(setMatchStatus);
  const voteFn = useServerFn(voteMatch);
  const notifyFn = useServerFn(notifyMatch);
  const runGlobalFn = useServerFn(runGlobalMatching);

  const [minScore, setMinScore] = useState(60);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [onlyUnnotified, setOnlyUnnotified] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const matchesQ = useQuery({
    queryKey: ["all-matches", activeProfile?.id, minScore, statusFilter, onlyUnnotified],
    queryFn: () =>
      listAllFn({
        data: {
          profileId: activeProfile?.id,
          minScore,
          status: statusFilter === "all" ? undefined : (statusFilter as any), // eslint-disable-line @typescript-eslint/no-explicit-any
          onlyUnnotified,
          limit: 300,
        },
      }),
    enabled: !!activeProfile?.id,
  });
  const matches = (matchesQ.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const selected = matches.find((m) => m.id === selectedId) ?? matches[0] ?? null;

  async function handleGlobalRun() {
    if (!activeProfile?.id) return;
    if (!confirm(t("admin.matching.confirmGlobalRun"))) return;
    setBusy(true);
    try {
      const r = await runGlobalFn({ data: { profileId: activeProfile.id } });
      toast.success(
        t("admin.matching.globalRunResultToast", {
          processed: r.processed,
          matches: r.totalMatches,
        }),
      );
      qc.invalidateQueries({ queryKey: ["all-matches"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {t("admin.matching.inbox.matchesHeading", { count: matches.length })}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["all-matches"] })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={handleGlobalRun} disabled={busy || !activeProfile?.id}>
              <Zap className="h-3.5 w-3.5 mr-1" />{" "}
              {busy ? t("admin.matching.runningLabel") : t("admin.matching.runGlobalButton")}
            </Button>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>{t("admin.matching.scoreMinLabel")}</span>
              <span className="font-mono">{minScore}</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[minScore]}
              onValueChange={([v]) => setMinScore(v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.matching.status.all")}</SelectItem>
                <SelectItem value="suggested">{t("admin.matching.status.suggested")}</SelectItem>
                <SelectItem value="pinned">{t("admin.matching.status.pinned")}</SelectItem>
                <SelectItem value="confirmed">{t("admin.matching.status.confirmed")}</SelectItem>
                <SelectItem value="excluded">{t("admin.matching.status.excluded")}</SelectItem>
                <SelectItem value="dismissed">{t("admin.matching.status.dismissed")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs">
              <Switch checked={onlyUnnotified} onCheckedChange={setOnlyUnnotified} />
              <span>{t("admin.matching.onlyUnnotifiedLabel")}</span>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-1 -mx-2 px-2">
            {matchesQ.isLoading && (
              <div className="text-sm text-muted-foreground p-2">{t("common.loading")}</div>
            )}
            {!matchesQ.isLoading && !matches.length && (
              <div className="text-sm text-muted-foreground p-2">
                {t("admin.matching.inbox.empty")}
              </div>
            )}
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left rounded-md border p-2 hover:bg-muted transition ${selected?.id === m.id ? "bg-muted border-primary" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <ScorePill score={m.score} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground truncate">
                      {m.source?.reference_number ?? "?"} <ArrowRight className="inline h-3 w-3" />{" "}
                      {m.target?.reference_number ?? "?"}
                    </div>
                    <div className="text-xs truncate">
                      {sourceLabel(m)} <span className="text-muted-foreground">↔</span>{" "}
                      {targetLabel(m)}
                    </div>
                  </div>
                  <StatusDot status={m.status} />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <CompareView
          match={selected}
          onStatus={async (s) => {
            await setStatusFn({ data: { id: selected.id, status: s } });
            qc.invalidateQueries({ queryKey: ["all-matches"] });
            toast.success(t("admin.matching.statusUpdatedToast"));
          }}
          onVote={async (v) => {
            await voteFn({ data: { matchId: selected.id, vote: v } });
            toast.success(t("admin.matching.thanksToast"));
          }}
          onNotify={async () => {
            await notifyFn({ data: { id: selected.id } });
            toast.success(t("admin.matching.notifiedToast"));
            qc.invalidateQueries({ queryKey: ["all-matches"] });
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t("admin.matching.inbox.selectPrompt")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const s = Number(score || 0);
  const color = s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-slate-400";
  return (
    <div
      className={`flex-none h-10 w-10 rounded-full ${color} text-white text-sm font-bold flex items-center justify-center`}
    >
      {Math.round(s)}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    suggested: "bg-slate-300",
    pinned: "bg-blue-500",
    confirmed: "bg-emerald-500",
    excluded: "bg-red-400",
    dismissed: "bg-slate-400",
  };
  return (
    <span className={`h-2 w-2 rounded-full ${map[status] ?? "bg-slate-300"}`} title={status} />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sourceLabel(m: any) {
  const s = m.source ?? {};
  if (m.source_kind === "buyer_lead")
    return `${s.company_name ?? "?"} · ${s.preferred_brand ?? ""} ${s.preferred_model ?? ""}`.trim();
  return `${s.brand ?? "?"} ${s.model ?? ""} ${s.year ?? ""}`.trim();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function targetLabel(m: any) {
  const t = m.target ?? {};
  if (m.target_kind === "buyer_lead")
    return `${t.company_name ?? "?"} · ${t.preferred_brand ?? ""} ${t.preferred_model ?? ""}`.trim();
  return `${t.brand ?? "?"} ${t.model ?? ""} ${t.year ?? ""}`.trim();
}

function CompareView({
  match,
  onStatus,
  onVote,
  onNotify,
}: {
  match: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onStatus: (s: "pinned" | "excluded" | "confirmed" | "dismissed") => Promise<void>;
  onVote: (v: 1 | -1) => Promise<void>;
  onNotify: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const cb = match.criteria_breakdown ?? {};
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <ScorePill score={match.score} />
            <div className="flex-1">
              <CardTitle className="text-lg">
                {t("admin.matching.scoreLabel")} {Math.round(match.score)}{" "}
                <span className="text-sm text-muted-foreground font-normal">· {match.verdict}</span>
              </CardTitle>
              <div className="text-xs text-muted-foreground font-mono">
                {t("admin.matching.ruleScoreLabel")} {match.rule_score ?? "-"} ·{" "}
                {t("admin.matching.aiScoreLabel")} {match.ai_score ?? "-"}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => onStatus("pinned")}>
                <Pin className="h-3.5 w-3.5 mr-1" /> {t("admin.matching.pinButton")}
              </Button>
              <Button size="sm" onClick={() => onStatus("confirmed")}>
                <Check className="h-3.5 w-3.5 mr-1" /> {t("admin.common.confirm")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onStatus("excluded")}>
                <X className="h-3.5 w-3.5 mr-1" /> {t("admin.matching.excludeButton")}
              </Button>
              <Button size="sm" variant="outline" onClick={onNotify}>
                <Bell className="h-3.5 w-3.5 mr-1" /> {t("admin.matching.notifyButton")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onVote(1)}>
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onVote(-1)}>
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        {match.ai_rationale && (
          <CardContent className="pt-0">
            <div className="rounded-md bg-muted p-3 text-sm italic border-l-4 border-primary">
              « {match.ai_rationale} »
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EntityCard
          kind={match.source_kind}
          data={match.source}
          label={t("admin.matching.sourceLabel")}
        />
        <EntityCard
          kind={match.target_kind}
          data={match.target}
          label={t("admin.matching.targetLabel")}
        />
      </div>

      {Object.keys(cb).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {t("admin.matching.criteriaBreakdownHeading")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {Object.entries(cb).map(([k, v]: any) => {
              const val = typeof v === "number" ? v : (v?.score ?? 0);
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{k}</span>
                    <span className="font-mono">{Math.round(val)}</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div
                      className={`h-full ${val >= 70 ? "bg-emerald-500" : val >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EntityCard({ kind, data, label }: { kind: string; data: any; label: string }) {
  const { t } = useTranslation();
  if (!data)
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          {t("admin.matching.entityUnavailable")}
        </CardContent>
      </Card>
    );
  const isLead = kind === "buyer_lead";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant={isLead ? "secondary" : "outline"}>
            {isLead ? t("admin.matching.entityKind.lead") : t("admin.matching.entityKind.offer")}
          </Badge>
          <CardTitle className="text-sm">{data.reference_number ?? label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        {isLead ? (
          <>
            <Row label={t("admin.matching.entity.client")}>{data.company_name ?? "—"}</Row>
            <Row label={t("admin.matching.entity.search")}>
              {data.preferred_brand ?? "?"} {data.preferred_model ?? ""}
            </Row>
            <Row label={t("admin.matching.entity.type")}>{data.vehicle_type ?? "—"}</Row>
            <Row label={t("admin.matching.entity.minYear")}>{data.min_year ?? "—"}</Row>
            <Row label={t("admin.matching.entity.budget")}>
              {data.max_budget_ht ? formatPrice(data.max_budget_ht) : "—"}
            </Row>
            <Row label={t("admin.matching.entity.zone")}>
              {data.city ?? "—"} · {data.country ?? "—"}
            </Row>
          </>
        ) : (
          <>
            <Row label={t("admin.matching.entity.vehicle")}>
              {data.brand ?? "?"} {data.model ?? ""}
            </Row>
            <Row label={t("admin.matching.entity.type")}>{data.vehicle_type ?? "—"}</Row>
            <Row label={t("admin.matching.entity.year")}>{data.year ?? "—"}</Row>
            <Row label={t("admin.matching.entity.mileage")}>
              {data.mileage ? data.mileage.toLocaleString("fr-FR") : "—"}
            </Row>
            <Row label={t("admin.matching.entity.price")}>
              {data.desired_price_excl_tax ? formatPrice(data.desired_price_excl_tax) : "—"}
            </Row>
            <Row label={t("admin.matching.entity.zone")}>
              {data.city ?? "—"} · {data.country ?? "—"}
            </Row>
          </>
        )}
      </CardContent>
    </Card>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dashed last:border-0 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right truncate">{children}</span>
    </div>
  );
}

// ============================================================
// HEATMAP TAB
// ============================================================
function HeatmapTab({ activeProfile }: { activeProfile: Profile | null }) {
  const { t } = useTranslation();
  const listAllFn = useServerFn(listAllMatches);
  const [minScore, setMinScore] = useState(50);
  const matchesQ = useQuery({
    queryKey: ["heatmap-matches", activeProfile?.id, minScore],
    queryFn: () => listAllFn({ data: { profileId: activeProfile?.id, minScore, limit: 1000 } }),
    enabled: !!activeProfile?.id,
  });
  const matches = (matchesQ.data ?? []) as any[]; // eslint-disable-line react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any

  // Build axes: leads (rows) × opportunities (cols). Only matches where source=lead, target=opp
  const grid = useMemo(() => {
    const leadMap = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const oppMap = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const cells = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const m of matches) {
      const leadId =
        m.source_kind === "buyer_lead"
          ? m.source_id
          : m.target_kind === "buyer_lead"
            ? m.target_id
            : null;
      const oppId =
        m.source_kind === "opportunity"
          ? m.source_id
          : m.target_kind === "opportunity"
            ? m.target_id
            : null;
      if (!leadId || !oppId) continue;
      const lead = m.source_kind === "buyer_lead" ? m.source : m.target;
      const opp = m.source_kind === "opportunity" ? m.source : m.target;
      if (lead) leadMap.set(leadId, lead);
      if (opp) oppMap.set(oppId, opp);
      const key = `${leadId}|${oppId}`;
      const prev = cells.get(key);
      if (!prev || Number(m.score) > Number(prev.score)) cells.set(key, m);
    }
    return {
      leads: Array.from(leadMap.entries()).slice(0, 30),
      opps: Array.from(oppMap.entries()).slice(0, 30),
      cells,
    };
  }, [matches]);

  const [hovered, setHovered] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  function cellColor(score: number | null) {
    if (score == null) return "bg-muted/40";
    if (score >= 85) return "bg-emerald-600 text-white";
    if (score >= 70) return "bg-emerald-400 text-white";
    if (score >= 55) return "bg-amber-400";
    if (score >= 40) return "bg-orange-300";
    return "bg-red-200";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">{t("admin.matching.heatmap.heading")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("admin.matching.heatmap.subtitle")}</p>
          </div>
          <div className="w-64">
            <div className="flex justify-between text-xs mb-1">
              <span>{t("admin.matching.scoreMinLabel")}</span>
              <span className="font-mono">{minScore}</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[minScore]}
              onValueChange={([v]) => setMinScore(v)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {matchesQ.isLoading ? (
          <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : !grid.leads.length || !grid.opps.length ? (
          <div className="text-sm text-muted-foreground">
            {t("admin.matching.heatmap.notEnoughData")}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="border-separate border-spacing-0.5">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background z-10"></th>
                  {grid.opps.map(([id, o]) => (
                    <th
                      key={id}
                      className="text-[10px] font-normal text-muted-foreground align-bottom h-24 w-9 relative"
                    >
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 origin-bottom-left rotate-[-60deg] whitespace-nowrap max-w-[100px] truncate">
                        {o.reference_number ?? id.slice(0, 6)} · {o.brand ?? ""}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.leads.map(([lid, l]) => (
                  <tr key={lid}>
                    <td className="sticky left-0 bg-background z-10 text-[11px] pr-2 max-w-[220px] truncate">
                      <span className="font-medium">{l.reference_number ?? lid.slice(0, 6)}</span>
                      <span className="text-muted-foreground"> · {l.company_name ?? ""}</span>
                    </td>
                    {grid.opps.map(([oid]) => {
                      const cell = grid.cells.get(`${lid}|${oid}`);
                      const score = cell ? Number(cell.score) : null;
                      return (
                        <td key={oid} className="p-0">
                          <div
                            onMouseEnter={() => cell && setHovered(cell)}
                            onMouseLeave={() => setHovered(null)}
                            className={`h-9 w-9 rounded-sm ${cellColor(score)} text-[10px] font-bold flex items-center justify-center cursor-pointer transition hover:scale-110 hover:z-10 relative`}
                          >
                            {score != null ? Math.round(score) : ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hovered && (
          <div className="mt-4 rounded-md border p-3 text-sm bg-muted/30">
            <div className="font-medium">
              {sourceLabel(hovered)} ↔ {targetLabel(hovered)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("admin.matching.scoreLabel")} {Math.round(hovered.score)} ·{" "}
              {t("admin.matching.ruleScoreLabel")} {hovered.rule_score ?? "-"} ·{" "}
              {t("admin.matching.aiScoreLabel")} {hovered.ai_score ?? "-"}
            </div>
            {hovered.ai_rationale && (
              <div className="text-xs italic mt-1">« {hovered.ai_rationale} »</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// ANALYTICS TAB
// ============================================================
function AnalyticsTab({ activeProfile }: { activeProfile: Profile | null }) {
  const { t } = useTranslation();
  const analyticsFn = useServerFn(matchingAnalytics);
  const dataQ = useQuery({
    queryKey: ["matching-analytics", activeProfile?.id],
    queryFn: () => analyticsFn({ data: { profileId: activeProfile?.id } }),
    enabled: !!activeProfile?.id,
  });
  const d = dataQ.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (dataQ.isLoading)
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!d)
    return (
      <div className="text-sm text-muted-foreground">{t("admin.matching.analytics.noData")}</div>
    );

  const notifRate = d.total ? Math.round((d.notified / d.total) * 100) : 0;
  const confirmRate = d.total ? Math.round((d.confirmed / d.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label={t("admin.matching.analytics.kpi.total")} value={d.total} />
        <KPI label={t("admin.matching.analytics.kpi.avgScore")} value={d.avgScore} suffix="/100" />
        <KPI
          label={t("admin.matching.analytics.kpi.notified")}
          value={`${notifRate}%`}
          sub={`${d.notified} / ${d.total}`}
        />
        <KPI
          label={t("admin.matching.analytics.kpi.confirmed")}
          value={`${confirmRate}%`}
          sub={`${d.confirmed} / ${d.total}`}
        />
        <KPI label={t("admin.matching.analytics.kpi.excluded")} value={d.excluded} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t("admin.matching.analytics.scoreDistributionHeading")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.buckets}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="bucket" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("admin.matching.analytics.volumeHeading")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.days}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  suffix,
}: {
  label: string;
  value: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  sub?: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase">{label}</div>
        <div className="text-2xl font-bold mt-1">
          {value}
          {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// CONSOLE TAB (the previous full 3-column view)
// ============================================================
function ConsoleTab({
  activeProfileId,
  setActiveProfileId,
  profiles,
}: {
  activeProfileId: string | null;
  setActiveProfileId: (id: string) => void;
  profiles: Profile[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const saveProfileFn = useServerFn(saveMatchingProfile);
  const deleteProfileFn = useServerFn(deleteMatchingProfile);
  const listSourcesFn = useServerFn(listMatchingSources);
  const listCandidatesFn = useServerFn(listMatchCandidates);
  const runFn = useServerFn(runMatching);
  const runGlobalFn = useServerFn(runGlobalMatching);
  const setStatusFn = useServerFn(setMatchStatus);
  const voteFn = useServerFn(voteMatch);
  const notifyFn = useServerFn(notifyMatch);

  const [sourceKind, setSourceKind] = useState<"buyer_lead" | "opportunity">("buyer_lead");
  const [search, setSearch] = useState("");
  const [selectedSource, setSelectedSource] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [draftProfile, setDraftProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  const sourcesQ = useQuery({
    queryKey: ["matching-sources", sourceKind, search],
    queryFn: () => listSourcesFn({ data: { kind: sourceKind, search: search || undefined } }),
  });
  const sources = (sourcesQ.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

  const activeProfile = useMemo(
    () =>
      draftProfile ??
      profiles.find((p) => p.id === activeProfileId) ??
      profiles.find((p) => p.is_default) ??
      profiles[0] ??
      null,
    [draftProfile, profiles, activeProfileId],
  );

  const candidatesQ = useQuery({
    queryKey: ["match-candidates", sourceKind, selectedSource?.id, activeProfile?.id],
    queryFn: () =>
      listCandidatesFn({
        data: {
          sourceKind,
          sourceId: selectedSource.id,
          profileId: activeProfile?.id || undefined,
        },
      }),
    enabled: !!selectedSource && !!activeProfile?.id,
  });
  const candidates = (candidatesQ.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

  async function handleRun() {
    if (!selectedSource || !activeProfile?.id) return;
    setBusy(true);
    try {
      const res = await runFn({
        data: { sourceKind, sourceId: selectedSource.id, profileId: activeProfile.id },
      });
      toast.success(t("admin.matching.console.runResultToast", { count: res.count }));
      qc.invalidateQueries({ queryKey: ["match-candidates"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGlobalRun() {
    if (!activeProfile?.id) {
      toast.error(t("admin.matching.console.selectProfileError"));
      return;
    }
    if (!confirm(t("admin.matching.confirmGlobalRun"))) return;
    setBusy(true);
    try {
      const res = await runGlobalFn({ data: { profileId: activeProfile.id } });
      toast.success(
        t("admin.matching.globalRunResultToast", {
          processed: res.processed,
          matches: res.totalMatches,
        }),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!activeProfile) return;
    setBusy(true);
    try {
      const saved = await saveProfileFn({
        data: {
          ...(activeProfile.id ? { id: activeProfile.id } : {}),
          name: activeProfile.name,
          description: activeProfile.description,
          is_default: activeProfile.is_default,
          weights: activeProfile.weights,
          hard_filters: activeProfile.hard_filters,
          ai_blend: activeProfile.ai_blend,
          min_score: activeProfile.min_score,
          max_results: activeProfile.max_results,
          auto_notify: activeProfile.auto_notify,
          model_id: activeProfile.model_id,
        },
      });
      toast.success(t("admin.matching.console.profileSavedToast"));
      setDraftProfile(null);
      setActiveProfileId((saved as Profile).id);
      qc.invalidateQueries({ queryKey: ["matching-profiles"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile() {
    if (!activeProfile?.id) return;
    if (!confirm(t("admin.matching.console.confirmDeleteProfile"))) return;
    setBusy(true);
    try {
      await deleteProfileFn({ data: { id: activeProfile.id } });
      toast.success(t("admin.matching.console.profileDeletedToast"));
      setDraftProfile(null);
      qc.invalidateQueries({ queryKey: ["matching-profiles"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function patchProfile(patch: Partial<Profile>) {
    setDraftProfile((prev) => ({ ...(prev ?? activeProfile ?? DEFAULT_PROFILE), ...patch }));
  }
  function patchWeights(patch: Partial<Profile["weights"]>) {
    const base = draftProfile ?? activeProfile ?? DEFAULT_PROFILE;
    setDraftProfile({ ...base, weights: { ...base.weights, ...patch } });
  }
  function patchHardFilters(patch: Partial<Profile["hard_filters"]>) {
    const base = draftProfile ?? activeProfile ?? DEFAULT_PROFILE;
    setDraftProfile({ ...base, hard_filters: { ...base.hard_filters, ...patch } });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-4">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> {t("admin.matching.console.profileHeading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              setDraftProfile({
                ...DEFAULT_PROFILE,
                name: `${t("admin.matching.console.newProfileName")} ${profiles.length + 1}`,
              })
            }
          >
            {t("admin.matching.console.newProfileButton")}
          </Button>
          {activeProfile && (
            <>
              <div>
                <Label>{t("admin.matching.console.nameLabel")}</Label>
                <Input
                  value={activeProfile.name}
                  onChange={(e) => patchProfile({ name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("admin.common.fields.description")}</Label>
                <Textarea
                  rows={2}
                  value={activeProfile.description ?? ""}
                  onChange={(e) => patchProfile({ description: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("admin.matching.console.modelLabel")}</Label>
                <Select
                  value={activeProfile.model_id}
                  onValueChange={(v) => patchProfile({ model_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google/gemini-3.5-flash">Gemini 3.5 Flash</SelectItem>
                    <SelectItem value="google/gemini-3.1-pro-preview">Gemini 3.1 Pro</SelectItem>
                    <SelectItem value="openai/gpt-5.4-mini">GPT-5.4 Mini</SelectItem>
                    <SelectItem value="openai/gpt-5.5">GPT-5.5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  {t("admin.matching.console.weightsHeading")}
                </div>
                {(Object.keys(activeProfile.weights) as Array<keyof Profile["weights"]>).map(
                  (k) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs">
                        <span className="capitalize">{k}</span>
                        <span className="font-mono">{activeProfile.weights[k]}</span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[activeProfile.weights[k]]}
                        onValueChange={([v]) => patchWeights({ [k]: v } as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
                      />
                    </div>
                  ),
                )}
              </div>
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  {t("admin.matching.console.hardFiltersHeading")}
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("admin.matching.console.requireTypeLabel")}</Label>
                  <Switch
                    checked={activeProfile.hard_filters.require_vehicle_type}
                    onCheckedChange={(v) => patchHardFilters({ require_vehicle_type: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("admin.matching.console.requireBrandLabel")}</Label>
                  <Switch
                    checked={activeProfile.hard_filters.require_brand}
                    onCheckedChange={(v) => patchHardFilters({ require_brand: v })}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span>{t("admin.matching.console.yearToleranceLabel")}</span>
                    <span className="font-mono">±{activeProfile.hard_filters.year_tolerance}</span>
                  </div>
                  <Slider
                    min={0}
                    max={10}
                    step={1}
                    value={[activeProfile.hard_filters.year_tolerance]}
                    onValueChange={([v]) => patchHardFilters({ year_tolerance: v })}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span>{t("admin.matching.console.priceToleranceLabel")}</span>
                    <span className="font-mono">
                      ±{activeProfile.hard_filters.price_tolerance_pct}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={50}
                    step={1}
                    value={[activeProfile.hard_filters.price_tolerance_pct]}
                    onValueChange={([v]) => patchHardFilters({ price_tolerance_pct: v })}
                  />
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs">
                    <span>{t("admin.matching.console.aiVsRulesLabel")}</span>
                    <span className="font-mono">{Math.round(activeProfile.ai_blend * 100)}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[activeProfile.ai_blend * 100]}
                    onValueChange={([v]) => patchProfile({ ai_blend: v / 100 })}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span>{t("admin.matching.scoreMinLabel")}</span>
                    <span className="font-mono">{activeProfile.min_score}</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[activeProfile.min_score]}
                    onValueChange={([v]) => patchProfile({ min_score: v })}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span>{t("admin.matching.console.maxResultsLabel")}</span>
                    <span className="font-mono">{activeProfile.max_results}</span>
                  </div>
                  <Slider
                    min={1}
                    max={30}
                    step={1}
                    value={[activeProfile.max_results]}
                    onValueChange={([v]) => patchProfile({ max_results: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("admin.matching.console.autoNotifyLabel")}</Label>
                  <Switch
                    checked={activeProfile.auto_notify}
                    onCheckedChange={(v) => patchProfile({ auto_notify: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("admin.matching.console.isDefaultLabel")}</Label>
                  <Switch
                    checked={activeProfile.is_default}
                    onCheckedChange={(v) => patchProfile({ is_default: v })}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={saveProfile} disabled={busy}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {t("admin.common.save")}
                </Button>
                {activeProfile.id && (
                  <Button size="sm" variant="outline" onClick={removeProfile} disabled={busy}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">{t("admin.matching.console.sourceHeading")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGlobalRun}
              disabled={busy || !activeProfile?.id}
            >
              <Zap className="h-4 w-4 mr-1" /> {t("admin.matching.runGlobalButton")}
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs
              value={sourceKind}
              onValueChange={(v) => {
                setSourceKind(v as any); // eslint-disable-line @typescript-eslint/no-explicit-any
                setSelectedSource(null);
              }}
            >
              <TabsList>
                <TabsTrigger value="buyer_lead">
                  {t("admin.matching.console.tabs.leadToOffers")}
                </TabsTrigger>
                <TabsTrigger value="opportunity">
                  {t("admin.matching.console.tabs.offerToLeads")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value={sourceKind} className="pt-3">
                <Input
                  placeholder={t("admin.matching.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-64 overflow-y-auto rounded border">
                  {sourcesQ.isLoading && (
                    <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
                  )}
                  {sources.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSource(s)}
                      className={`block w-full text-left px-3 py-2 text-sm border-b hover:bg-muted ${selectedSource?.id === s.id ? "bg-muted" : ""}`}
                    >
                      <div className="font-medium">{s.reference_number ?? s.id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">
                        {sourceKind === "buyer_lead"
                          ? `${s.company_name ?? ""} — ${s.preferred_brand ?? "?"} ${s.preferred_model ?? ""} — ${s.city ?? ""}`
                          : `${s.brand ?? "?"} ${s.model ?? ""} ${s.year ?? ""} — ${s.city ?? ""}${s.desired_price_excl_tax ? " — " + formatPrice(s.desired_price_excl_tax) : ""}`}
                      </div>
                    </button>
                  ))}
                  {!sourcesQ.isLoading && !sources.length && (
                    <div className="p-4 text-sm text-muted-foreground">
                      {t("admin.matching.console.noSources")}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {selectedSource && (
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t("admin.matching.console.candidatesHeading")}
              </CardTitle>
              <Button onClick={handleRun} disabled={busy || !activeProfile?.id}>
                <Play className="h-4 w-4 mr-1" /> {t("admin.matching.console.runButton")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {candidatesQ.isLoading && (
                <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
              )}
              {!candidatesQ.isLoading && !candidates.length && (
                <div className="text-sm text-muted-foreground">
                  {t("admin.matching.console.noResults")}
                </div>
              )}
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  c={c}
                  onStatus={async (s) => {
                    await setStatusFn({ data: { id: c.id, status: s } });
                    qc.invalidateQueries({ queryKey: ["match-candidates"] });
                  }}
                  onVote={async (v) => {
                    await voteFn({ data: { matchId: c.id, vote: v } });
                    toast.success(t("admin.matching.thanksToast"));
                  }}
                  onNotify={async () => {
                    await notifyFn({ data: { id: c.id } });
                    toast.success(t("admin.matching.notifiedToast"));
                    qc.invalidateQueries({ queryKey: ["match-candidates"] });
                  }}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            {t("admin.matching.console.explainabilityHeading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>{t("admin.matching.console.explainabilityText1")}</p>
          <p>
            {t("admin.matching.console.explainabilityScorePrefix")}{" "}
            <span className="font-mono">{Math.round((activeProfile?.ai_blend ?? 0.6) * 100)}%</span>{" "}
            {t("admin.matching.console.explainabilityIA")}{" "}
            <span className="font-mono">
              {Math.round((1 - (activeProfile?.ai_blend ?? 0.6)) * 100)}%
            </span>{" "}
            {t("admin.matching.console.explainabilityRules")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CandidateRow({
  c,
  onStatus,
  onVote,
  onNotify,
}: {
  c: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onStatus: (s: "pinned" | "excluded" | "confirmed" | "dismissed") => void | Promise<void>;
  onVote: (v: 1 | -1) => void | Promise<void>;
  onNotify: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const t2 = c.target ?? {};
  const isOpp = c.target_kind === "opportunity";
  const scoreColor =
    c.score >= 80 ? "bg-emerald-500" : c.score >= 60 ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="rounded-md border p-3 flex gap-3">
      <div className="flex-none w-14 text-center">
        <div
          className={`inline-flex h-12 w-12 rounded-full items-center justify-center text-white font-bold ${scoreColor}`}
        >
          {c.score}
        </div>
        <Badge variant="outline" className="mt-1 text-[10px]">
          {c.verdict}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{t2.reference_number ?? c.target_id.slice(0, 8)}</span>
          <Badge variant="secondary" className="text-[10px]">
            {isOpp ? t("admin.matching.entityKind.offer") : t("admin.matching.entityKind.lead")}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {c.status}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {isOpp
            ? `${t2.brand ?? "?"} ${t2.model ?? ""} ${t2.year ?? ""} — ${t2.city ?? ""}${t2.desired_price_excl_tax ? " — " + formatPrice(t2.desired_price_excl_tax) : ""}`
            : `${t2.company_name ?? ""} recherche ${t2.preferred_brand ?? "?"} ${t2.preferred_model ?? ""}${t2.max_budget_ht ? " — budget " + formatPrice(t2.max_budget_ht) : ""}`}
        </div>
        {c.ai_rationale && <div className="text-xs mt-1 italic">« {c.ai_rationale} »</div>}
        <div className="flex gap-3 mt-1 text-[11px] font-mono text-muted-foreground">
          <span>
            {t("admin.matching.ruleScoreLabel")} {c.rule_score ?? "-"}
          </span>
          <span>
            {t("admin.matching.aiScoreLabel")} {c.ai_score ?? "-"}
          </span>
        </div>
      </div>
      <div className="flex-none flex flex-col gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatus("pinned")}
          title={t("admin.matching.pinButton")}
        >
          <Pin className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatus("confirmed")}
          title={t("admin.common.confirm")}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatus("excluded")}
          title={t("admin.matching.excludeButton")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onNotify()}
          title={t("admin.matching.notifyButton")}
        >
          <Bell className="h-3.5 w-3.5" />
        </Button>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onVote(1)}>
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onVote(-1)}>
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
