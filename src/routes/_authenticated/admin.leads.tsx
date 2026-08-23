import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  adminListLeads,
  adminAssignToGroup,
  adminRequestInfo,
  adminDisqualifyLead,
} from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatPrice, CLOSED_LOST_REASONS } from "@/lib/wilmet-constants";
import { Inbox, UserPlus, MessageCircle, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/leads")({ component: AdminLeads });

function AdminLeads() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListLeads);
  const assignGroupFn = useServerFn(adminAssignToGroup);
  const reqFn = useServerFn(adminRequestInfo);
  const disqualifyFn = useServerFn(adminDisqualifyLead);

  const { data, isLoading } = useQuery({ queryKey: ["admin-leads"], queryFn: () => listFn() });
  const rows = (data?.rows ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const profiles = data?.profiles ?? {};

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [infoFor, setInfoFor] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState("");
  const [disqualFor, setDisqualFor] = useState<string | null>(null);
  const [disqualReason, setDisqualReason] = useState("prix");

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["admin-leads"] });
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const p = profiles[r.partenaire_id];
    const hay =
      `${r.brand ?? ""} ${r.model ?? ""} ${r.city ?? ""} ${r.reference_number ?? ""} ${p?.first_name ?? ""} ${p?.last_name ?? ""} ${p?.company_name ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("admin.leads.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.leads.subtitle")}</p>
        </div>
        <Input
          placeholder={t("admin.common.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-lg font-semibold">{t("admin.leads.empty.title")}</div>
            <p className="max-w-sm text-sm text-muted-foreground">{t("admin.leads.empty.text")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const p = profiles[r.partenaire_id];
            return (
              <Card key={r.id} className="border-border/70">
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/admin/opportunities/$id"
                        params={{ id: r.id }}
                        className="truncate text-base font-semibold hover:underline"
                      >
                        {r.brand ?? "—"} {r.model ?? ""}
                      </Link>
                      <StatusBadge status={r.status} />
                      {typeof r.completion_pct === "number" && (
                        <Badge variant="secondary" className="text-xs">
                          {t("admin.leads.completionPct", { pct: r.completion_pct })}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.reference_number} · {r.year ?? "—"} · {r.city ?? "—"} ·{" "}
                      {formatPrice(r.desired_price_excl_tax)} ·{" "}
                      {t("admin.leads.receivedOn", {
                        date: formatDate(r.submitted_at ?? r.created_at),
                      })}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p
                        ? `${p.first_name ?? ""} ${p.last_name ?? ""}${p.company_name ? " · " + p.company_name : ""}`
                        : t("admin.leads.unknownPartner")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => assignGroupFn({ data: { id: r.id } }),
                          t("admin.leads.toast.converted"),
                        )
                      }
                    >
                      <UserPlus className="mr-1.5 h-4 w-4" /> {t("admin.leads.convert")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setInfoFor(r.id);
                        setInfoMsg("");
                      }}
                      disabled={busy}
                    >
                      <MessageCircle className="mr-1.5 h-4 w-4" /> {t("admin.leads.requestInfo")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDisqualFor(r.id);
                        setDisqualReason("prix");
                      }}
                      disabled={busy}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" /> {t("admin.leads.reject")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info request */}
      <Dialog open={!!infoFor} onOpenChange={(o) => !o && setInfoFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.leads.infoDialog.title")}</DialogTitle>
            <DialogDescription>{t("admin.leads.infoDialog.description")}</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={infoMsg}
            onChange={(e) => setInfoMsg(e.target.value)}
            placeholder={t("admin.leads.infoDialog.placeholder")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoFor(null)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              disabled={busy || !infoMsg.trim()}
              onClick={() =>
                run(async () => {
                  await reqFn({ data: { id: infoFor!, message: infoMsg } });
                  setInfoFor(null);
                }, t("admin.leads.toast.infoSent"))
              }
            >
              {t("admin.leads.infoDialog.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disqualify */}
      <Dialog open={!!disqualFor} onOpenChange={(o) => !o && setDisqualFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.leads.rejectDialog.title")}</DialogTitle>
            <DialogDescription>{t("admin.leads.rejectDialog.description")}</DialogDescription>
          </DialogHeader>
          <Select value={disqualReason} onValueChange={setDisqualReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLOSED_LOST_REASONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisqualFor(null)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await disqualifyFn({ data: { id: disqualFor!, reason: disqualReason } });
                  setDisqualFor(null);
                }, t("admin.leads.toast.rejected"))
              }
            >
              {t("admin.leads.rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
