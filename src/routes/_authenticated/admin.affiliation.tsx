import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { requireAnyRole } from "@/lib/route-guards";
import {
  adminListAffiliates,
  adminSetAffiliateActive,
  adminRegenerateAffiliateCode,
  adminListAffiliateCandidates,
  adminCreateAffiliateLink,
  adminDeleteAffiliateLink,
} from "@/lib/affiliate.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, RefreshCw, Power, Plus, Trash2 } from "lucide-react";
import { buildAffiliateUrl } from "@/lib/referral";

/** i18n keys for each period filter — call t(p.labelKey) at render time. */
const PERIODS = [
  { key: "all", labelKey: "admin.affiliation.periods.all" },
  { key: "30", labelKey: "admin.affiliation.periods.30" },
  { key: "90", labelKey: "admin.affiliation.periods.90" },
] as const;

export const Route = createFileRoute("/_authenticated/admin/affiliation")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole(
      (context as { userId: string }).userId,
      ["admin", "platform_admin", "sales_manager", "company_management"],
      "/admin",
    );
  },
  head: () => ({
    meta: [
      { title: "Affiliation — Wilmet Trucks" },
      {
        name: "description",
        content:
          "Suivi des liens d'affiliation Wilmet Trucks : clics, comptes créés, demandes et offres apportées par chaque commercial ou partenaire.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAffiliates);
  const toggleFn = useServerFn(adminSetAffiliateActive);
  const regenFn = useServerFn(adminRegenerateAffiliateCode);
  const deleteFn = useServerFn(adminDeleteAffiliateLink);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");

  const fromDate =
    period === "all" ? undefined : new Date(Date.now() - Number(period) * 86_400_000).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-affiliates", period],
    queryFn: () => listFn({ data: fromDate ? { fromDate } : {} }),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
      await qc.invalidateQueries({ queryKey: ["affiliate-candidates"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.affiliation.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.affiliation.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? "default" : "outline"}
              onClick={() => setPeriod(p.key)}
            >
              {t(p.labelKey)}
            </Button>
          ))}
          <CreateLinkDialog
            onCreated={() => act(async () => {}, t("admin.affiliation.toast.linkCreated"))}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.affiliation.leaderboardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.affiliation.table.person")}</TableHead>
                    <TableHead>{t("admin.affiliation.table.code")}</TableHead>
                    <TableHead className="text-right">
                      {t("admin.affiliation.table.clicks")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("admin.affiliation.table.accounts")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("admin.affiliation.table.requests")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("admin.affiliation.table.offers")}
                    </TableHead>
                    <TableHead className="text-right">{t("admin.affiliation.table.won")}</TableHead>
                    <TableHead className="text-right">
                      {t("admin.affiliation.table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.rows ?? []).map((r) => (
                    <TableRow key={r.linkId}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.email}
                          {r.role ? ` · ${r.role}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="font-mono">
                            {r.code}
                          </Badge>
                          {!r.isActive && (
                            <Badge variant="destructive">{t("admin.affiliation.badge.off")}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.stats.clicks}</TableCell>
                      <TableCell className="text-right">{r.stats.signups}</TableCell>
                      <TableCell className="text-right">{r.stats.buyerLeads}</TableCell>
                      <TableCell className="text-right">{r.stats.vehicleOffers}</TableCell>
                      <TableCell className="text-right font-medium">{r.stats.won}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("admin.affiliation.actions.copyLink")}
                            onClick={async () => {
                              await navigator.clipboard.writeText(
                                buildAffiliateUrl(origin, r.code),
                              );
                              toast.success(t("admin.affiliation.toast.linkCopied"));
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("admin.affiliation.actions.regenerateCode")}
                            onClick={() =>
                              act(
                                () => regenFn({ data: { linkId: r.linkId } }),
                                t("admin.affiliation.toast.codeRegenerated"),
                              )
                            }
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={
                              r.isActive
                                ? t("admin.affiliation.actions.deactivate")
                                : t("admin.affiliation.actions.activate")
                            }
                            onClick={() =>
                              act(
                                () =>
                                  toggleFn({ data: { linkId: r.linkId, isActive: !r.isActive } }),
                                r.isActive
                                  ? t("admin.affiliation.toast.linkDeactivated")
                                  : t("admin.affiliation.toast.linkActivated"),
                              )
                            }
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                title={t("admin.affiliation.actions.deleteLink")}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t("admin.affiliation.deleteDialog.title", { name: r.name })}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("admin.affiliation.deleteDialog.description", {
                                    code: r.code,
                                  })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    act(
                                      () => deleteFn({ data: { linkId: r.linkId } }),
                                      t("admin.affiliation.toast.linkDeleted"),
                                    )
                                  }
                                >
                                  {t("admin.common.delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.rows ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("admin.affiliation.table.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateLinkDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const listFn = useServerFn(adminListAffiliateCandidates);
  const createFn = useServerFn(adminCreateAffiliateLink);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["affiliate-candidates"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data?.candidates ?? [];
    if (!needle) return all;
    return all.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(needle));
  }, [data?.candidates, q]);

  async function create(userId: string) {
    try {
      await createFn({ data: { userId } });
      toast.success(t("admin.affiliation.toast.linkCreated"));
      await refetch();
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> {t("admin.affiliation.createLink")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.affiliation.createDialog.title")}</DialogTitle>
          <DialogDescription>{t("admin.affiliation.createDialog.description")}</DialogDescription>
        </DialogHeader>
        <Input
          placeholder={t("admin.affiliation.createDialog.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {isLoading && (
            <div className="p-3 text-sm text-muted-foreground">{t("common.loading")}</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">
              {t("admin.affiliation.createDialog.empty")}
            </div>
          )}
          {filtered.map((c) => (
            <div
              key={c.userId}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.email}
                  {c.role ? ` · ${c.role}` : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => create(c.userId)}>
                {t("admin.affiliation.createDialog.create")}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("admin.affiliation.createDialog.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
