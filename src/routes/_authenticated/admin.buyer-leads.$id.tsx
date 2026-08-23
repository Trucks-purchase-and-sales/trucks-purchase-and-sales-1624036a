import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  adminGetBuyerLead,
  adminConvertBuyerLead,
  adminBuyerLeadRequestInfo,
  adminRejectBuyerLead,
} from "@/lib/demand-opportunities.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, UserPlus, MessageCircle, XCircle, ExternalLink } from "lucide-react";
import { formatDateTime, CLOSED_LOST_REASONS } from "@/lib/wilmet-constants";

export const Route = createFileRoute("/_authenticated/admin/buyer-leads/$id")({ component: Page });

function Page() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(adminGetBuyerLead);
  const convertFn = useServerFn(adminConvertBuyerLead);
  const infoFn = useServerFn(adminBuyerLeadRequestInfo);
  const rejectFn = useServerFn(adminRejectBuyerLead);

  const { data, isLoading } = useQuery({
    queryKey: ["buyer-lead", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [rejOpen, setRejOpen] = useState(false);
  const [rejReason, setRejReason] = useState("prix");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["buyer-lead", id] });
      after?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!data)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("admin.buyerLeads.detail.notFound")}
      </div>
    );

  const lead = data.lead;
  const demand = data.demand;

  return (
    <div className="pb-10 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/buyer-leads">
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("admin.common.back")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {lead.reference_number}
            </h1>
            <Badge variant="secondary">{lead.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.buyerLeads.detail.receivedLabel", {
              date: formatDateTime(lead.created_at),
              source: lead.source,
            })}
          </p>
        </div>
        {demand ? (
          <Button asChild>
            <Link to="/admin/demand-opportunities/$id" params={{ id: demand.id }}>
              {t("admin.buyerLeads.detail.openOpportunityButton")}{" "}
              <ExternalLink className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await convertFn({ data: { id, agentId: null } });
                  nav({ to: "/admin/demand-opportunities/$id", params: { id: res.id } });
                }, t("admin.buyerLeads.detail.convertedToast"))
              }
            >
              <UserPlus className="mr-1.5 h-4 w-4" /> {t("admin.common.convertToOpportunity")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInfoMsg("");
                setInfoOpen(true);
              }}
              disabled={busy}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />{" "}
              {t("admin.buyerLeads.detail.requestInfoButton")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRejReason("prix");
                setRejOpen(true);
              }}
              disabled={busy}
            >
              <XCircle className="mr-1.5 h-4 w-4" /> {t("admin.buyerLeads.detail.rejectButton")}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("admin.buyerLeads.detail.contactHeading")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">
              {lead.first_name} {lead.last_name}
            </div>
            {lead.company_name && <div className="text-muted-foreground">{lead.company_name}</div>}
            <div>
              <a className="text-primary hover:underline" href={`mailto:${lead.email}`}>
                {lead.email}
              </a>
            </div>
            {lead.phone && (
              <div>
                <a className="text-primary hover:underline" href={`tel:${lead.phone}`}>
                  {lead.phone}
                </a>
              </div>
            )}
            {(lead.city || lead.country) && (
              <div className="text-muted-foreground">
                {[lead.city, lead.country].filter(Boolean).join(" · ")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("admin.buyerLeads.detail.searchHeading")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Field label={t("admin.buyerLeads.detail.fields.type")} value={lead.vehicle_type} />
            <Field label={t("admin.buyerLeads.detail.fields.bodyType")} value={lead.body_type} />
            <Field
              label={t("admin.buyerLeads.detail.fields.brandModel")}
              value={[lead.preferred_brand, lead.preferred_model].filter(Boolean).join(" ") || "—"}
            />
            <Field label={t("admin.buyerLeads.detail.fields.minYear")} value={lead.min_year} />
            <Field
              label={t("admin.buyerLeads.detail.fields.maxMileage")}
              value={lead.max_mileage ? `${lead.max_mileage.toLocaleString("fr-FR")} km` : null}
            />
            <Field
              label={t("admin.buyerLeads.detail.fields.minEuroNorm")}
              value={lead.min_euro_norm}
            />
            <Field label={t("admin.buyerLeads.detail.fields.fuel")} value={lead.fuel_type} />
            <Field label={t("admin.buyerLeads.detail.fields.gearbox")} value={lead.gearbox} />
            <Field
              label={t("admin.buyerLeads.detail.fields.maxBudget")}
              value={
                lead.max_budget_ht
                  ? `${Number(lead.max_budget_ht).toLocaleString("fr-FR")} €`
                  : null
              }
            />
            <Field
              label={t("admin.buyerLeads.detail.fields.financing")}
              value={lead.financing_needed}
            />
            <Field label={t("admin.buyerLeads.detail.fields.timeline")} value={lead.buy_timeline} />
          </CardContent>
        </Card>
      </div>

      {lead.message && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("admin.buyerLeads.detail.messageHeading")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{lead.message}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.buyerLeads.detail.historyHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {(data.history ?? []).length === 0 ? (
            <div className="text-muted-foreground">{t("admin.buyerLeads.detail.noHistory")}</div>
          ) : (
            <ul className="space-y-1.5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.history.map((h: any) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                  <span>
                    {h.old_status ?? "—"} → <b>{h.new_status}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Info request */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.buyerLeads.detail.infoDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.buyerLeads.detail.infoDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={infoMsg}
            onChange={(e) => setInfoMsg(e.target.value)}
            placeholder={t("admin.buyerLeads.detail.infoDialog.placeholder")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              disabled={busy || infoMsg.trim().length < 2}
              onClick={() =>
                run(async () => {
                  await infoFn({ data: { id, message: infoMsg } });
                  setInfoOpen(false);
                }, t("admin.buyerLeads.detail.infoDialog.sentToast"))
              }
            >
              {t("admin.common.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={rejOpen} onOpenChange={setRejOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.buyerLeads.detail.rejectDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.buyerLeads.detail.rejectDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <Select value={rejReason} onValueChange={setRejReason}>
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
            <Button variant="outline" onClick={() => setRejOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await rejectFn({ data: { id, reason: rejReason } });
                  setRejOpen(false);
                  nav({ to: "/admin/buyer-leads" });
                }, t("admin.buyerLeads.detail.rejectDialog.successToast"))
              }
            >
              {t("admin.common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
