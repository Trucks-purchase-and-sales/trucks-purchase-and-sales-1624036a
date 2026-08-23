import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  createMyAffiliateLink,
  getMyAffiliateLink,
  getMyAffiliateStats,
} from "@/lib/affiliate.functions";
import { buildAffiliateUrl } from "@/lib/referral";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Link2, MousePointerClick, UserPlus, Search, Truck, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mon-lien")({
  head: () => ({
    meta: [
      { title: "Mon lien d'affiliation — Wilmet Trucks" },
      {
        name: "description",
        content:
          "Partagez votre lien personnel Wilmet Trucks et suivez les clics, comptes et dossiers qui vous sont crédités.",
      },
    ],
  }),
  component: Page,
});

const TARGET_KEYS = [
  { path: "/", key: "monLien.targets.home" },
  { path: "/chercher-un-vehicule", key: "monLien.targets.searchForm" },
  { path: "/vehicules", key: "monLien.targets.catalog" },
  { path: "/auth?mode=signup&kind=seller", key: "monLien.targets.proposeVehicle" },
] as const;

function Page() {
  const { t } = useTranslation();
  const TARGETS = useMemo(
    () => TARGET_KEYS.map((tg) => ({ path: tg.path, label: t(tg.key) })),
    [t],
  );
  const linkFn = useServerFn(getMyAffiliateLink);
  const createFn = useServerFn(createMyAffiliateLink);
  const statsFn = useServerFn(getMyAffiliateStats);
  const qc = useQueryClient();
  const [target, setTarget] = useState("/");

  const { data, isLoading } = useQuery({
    queryKey: ["my-affiliate-link"],
    queryFn: () => linkFn(),
  });
  const link = data?.link ?? null;
  const { data: stats } = useQuery({
    queryKey: ["my-affiliate-stats"],
    queryFn: () => statsFn({ data: {} }),
    enabled: !!link,
  });

  const create = useMutation({
    mutationFn: () => createFn(),
    onSuccess: async () => {
      toast.success(t("monLien.toast.linkCreated"));
      await qc.invalidateQueries({ queryKey: ["my-affiliate-link"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : t("monLien.toast.failure")),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = useMemo(
    () => (link?.code ? buildAffiliateUrl(origin, link.code, target) : ""),
    [link?.code, origin, target],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("monLien.toast.linkCopied"));
    } catch {
      toast.error(t("monLien.toast.copyError"));
    }
  }

  if (isLoading)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("monLien.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("monLien.subtitle")}</p>
    </div>
  );

  if (!data?.eligible) {
    return (
      <div className="space-y-6 pb-10">
        {header}
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("monLien.notEligible")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="space-y-6 pb-10">
        {header}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> {t("monLien.noLink.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("monLien.noLink.text")}</p>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              <Link2 className="mr-1.5 h-4 w-4" /> {t("monLien.noLink.generate")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {header}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> {t("monLien.yourLink")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("monLien.code")}</span>
            <Badge variant="secondary" className="font-mono">
              {link.code}
            </Badge>
            {!link.isActive && <Badge variant="destructive">{t("monLien.deactivated")}</Badge>}
          </div>

          <div className="flex flex-wrap gap-2">
            {TARGETS.map((tg) => (
              <Button
                key={tg.path}
                size="sm"
                variant={target === tg.path ? "default" : "outline"}
                onClick={() => setTarget(tg.path)}
              >
                {tg.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button onClick={copy}>
              <Copy className="mr-1.5 h-4 w-4" /> {t("monLien.copy")}
            </Button>
          </div>

          {url && (
            <div className="flex items-center gap-4 rounded-lg border border-border/60 p-4">
              <img
                alt={t("monLien.qrAlt", { code: link.code })}
                className="h-32 w-32 shrink-0"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`}
              />
              <p className="text-sm text-muted-foreground">{t("monLien.qrText")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={MousePointerClick} label={t("monLien.stats.clicks")} value={stats?.clicks} />
        <Stat icon={UserPlus} label={t("monLien.stats.signups")} value={stats?.signups} />
        <Stat icon={Search} label={t("monLien.stats.buyerLeads")} value={stats?.buyerLeads} />
        <Stat icon={Truck} label={t("monLien.stats.vehicleOffers")} value={stats?.vehicleOffers} />
        <Stat icon={Trophy} label={t("monLien.stats.won")} value={stats?.won} />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-2xl font-semibold">{value ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
