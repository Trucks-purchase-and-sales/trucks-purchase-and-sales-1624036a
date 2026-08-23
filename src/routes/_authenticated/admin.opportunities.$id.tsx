import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminGetOpportunity,
  adminChangeStatus,
  adminAddNote,
  adminRequestInfo,
  adminHandoverToPartenaire,
  adminReclaim,
  adminListSalesAgents,
  adminAssignSalesAgent,
  adminAssignToGroup,
  adminConvertToPurchase,
  adminMarkDelivered,
  adminCloseOpportunity,
  adminReopenOpportunity,
  listOpportunityActivities,
  addOpportunityActivity,
  completeOpportunityActivity,
} from "@/lib/admin.functions";
import { signPhotoUrls } from "@/lib/opportunities.functions";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StageBar } from "@/components/opportunity/StageBar";
import { CommissionPanel } from "@/components/finance/CommissionPanel";
import { SaleListingPanel } from "@/components/sales/SaleListingPanel";

import { DossierPanel } from "@/components/opportunity/DossierPanel";
import { BenchmarkPanel } from "@/components/opportunity/BenchmarkPanel";
import { DossierAuditPanel } from "@/components/opportunity/DossierAuditPanel";
import { useAiFeatures } from "@/hooks/useAiFeatures";
import {
  ArrowLeft,
  Circle,
  MessageCircle,
  Lock,
  Building2,
  User2,
  Send,
  Undo2,
  UserPlus,
  XCircle,
  Truck,
  PlayCircle,
} from "lucide-react";
import {
  AVAILABILITY_OPTIONS,
  CABIN_OPTIONS,
  CLOSED_LOST_REASONS,
  CONDITION_OPTIONS,
  FUEL_OPTIONS,
  GEARBOX_OPTIONS,
  NEGOTIABLE_OPTIONS,
  STATUS_LABEL,
  YES_NO_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  formatDate,
  formatDateTime,
  formatPrice,
  labelFor,
  type OpportunityStatus,
} from "@/lib/wilmet-constants";

export const Route = createFileRoute("/_authenticated/admin/opportunities/$id")({
  component: AdminDetail,
});

function AdminDetail() {
  const { t } = useTranslation();
  const ai = useAiFeatures();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetOpportunity);
  const signFn = useServerFn(signPhotoUrls);
  const chgFn = useServerFn(adminChangeStatus);
  const noteFn = useServerFn(adminAddNote);
  const reqFn = useServerFn(adminRequestInfo);
  const handoverFn = useServerFn(adminHandoverToPartenaire);
  const reclaimFn = useServerFn(adminReclaim);
  const listAgentsFn = useServerFn(adminListSalesAgents);
  const assignFn = useServerFn(adminAssignSalesAgent);
  const convertGroupFn = useServerFn(adminAssignToGroup);
  const convertFn = useServerFn(adminConvertToPurchase);
  const deliverFn = useServerFn(adminMarkDelivered);
  const closeFn = useServerFn(adminCloseOpportunity);
  const reopenFn = useServerFn(adminReopenOpportunity);
  const activitiesFn = useServerFn(listOpportunityActivities);
  const addActivityFn = useServerFn(addOpportunityActivity);
  const doneActivityFn = useServerFn(completeOpportunityActivity);

  const { data } = useQuery({
    queryKey: ["admin-opp", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["sales-agents"],
    queryFn: () => listAgentsFn(),
  });
  const { data: actData } = useQuery({
    queryKey: ["opp-activities", id],
    queryFn: () => activitiesFn({ data: { id } }),
  });
  const paths = useMemo(
    () => ((data?.photos ?? []) as any[]).map((p: any) => p.storage_path), // eslint-disable-line @typescript-eslint/no-explicit-any
    [data],
  );
  const { data: urlsData } = useQuery({
    queryKey: ["admin-opp-urls", paths.join("|")],
    queryFn: () => signFn({ data: { paths } }),
    enabled: paths.length > 0,
  });
  const urls = urlsData?.urls ?? {};

  const [note, setNote] = useState("");
  const [handoverMsg, setHandoverMsg] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [lostReason, setLostReason] = useState("prix");
  const [lostNotes, setLostNotes] = useState("");
  const [activityKind, setActivityKind] = useState<"note" | "call" | "email" | "meeting" | "task">(
    "note",
  );
  const [activityBody, setActivityBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  if (!data)
    return <div className="py-20 text-center text-muted-foreground">{t("common.loading")}</div>;
  const opp = data.opp as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const profile = data.profile as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const isPartenaireOwner = opp.owner_side === "partenaire";
  const status = opp.status as OpportunityStatus;
  const isTerminal = ["livree", "refusee", "archivee"].includes(status);
  const agents = agentsData?.agents ?? [];
  const activities = (actData?.activities ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-opp", id] });
    qc.invalidateQueries({ queryKey: ["opp-activities", id] });
  };

  async function run<T>(fn: () => Promise<T>, okMsg?: string) {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      invalidate();
    } catch (e) {
      toast.error(t("admin.common.error"), { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {t("admin.common.back")}
      </Button>
      {/* Header strip: title + KPIs */}
      <div className="rounded-xl border border-border/70 bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              {opp.reference_number && <Badge variant="outline">{opp.reference_number}</Badge>}
              <Badge
                variant="outline"
                className={
                  isPartenaireOwner
                    ? "border-status-info-foreground/40 text-status-info-foreground"
                    : "border-accent/40 text-accent"
                }
              >
                {isPartenaireOwner ? (
                  <>
                    <User2 className="mr-1 h-3 w-3" />{" "}
                    {t("admin.opportunityDetail.ownerBadge.partner")}
                  </>
                ) : (
                  <>
                    <Building2 className="mr-1 h-3 w-3" />{" "}
                    {t("admin.opportunityDetail.ownerBadge.wilmet")}
                  </>
                )}
              </Badge>
              {opp.withdrawn_at && (
                <Badge variant="destructive">{t("admin.opportunityDetail.withdrawnBadge")}</Badge>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {opp.brand} {opp.model}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {labelFor(VEHICLE_TYPE_OPTIONS, opp.vehicle_type)} ·{" "}
              {opp.first_registration_date
                ? formatDate(opp.first_registration_date)
                : (opp.year ?? "—")}{" "}
              · {profile?.first_name} {profile?.last_name}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label={t("admin.opportunityDetail.kpi.priceExclTax")}
              value={formatPrice(opp.desired_price_excl_tax)}
            />
            <Kpi
              label={t("admin.opportunityDetail.kpi.contractValue")}
              value={
                opp.total_contract_value_eur != null
                  ? formatPrice(opp.total_contract_value_eur)
                  : "—"
              }
            />
            <Kpi
              label={t("admin.opportunityDetail.kpi.expectedClose")}
              value={formatDate(opp.expected_close_date) || "—"}
            />
            <Kpi
              label={t("admin.opportunityDetail.kpi.purchase")}
              value={
                opp.purchase_price_excl_tax != null ? formatPrice(opp.purchase_price_excl_tax) : "—"
              }
            />
          </div>
        </div>

        {/* Stage bar (opportunities only) — leads show a triage hint instead. */}
        <div className="mt-5">
          {opp.assigned_sales_agent_id ? (
            <StageBar
              status={status}
              disabled={busy || isTerminal}
              onSelect={(s) =>
                run(
                  () => chgFn({ data: { id, status: s as any } }), // eslint-disable-line @typescript-eslint/no-explicit-any
                  `${t("admin.opportunityDetail.stage.toastPrefix")} ${STATUS_LABEL[s]}`,
                )
              }
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">
                  {t("admin.opportunityDetail.leadHint.title")}
                </span>{" "}
                {t("admin.opportunityDetail.leadHint.text")}
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => convertGroupFn({ data: { id } }),
                    t("admin.opportunityDetail.convertLead.successToast"),
                  )
                }
              >
                {t("admin.common.convertToOpportunity")}
              </Button>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="mt-5 flex flex-wrap gap-2">
          {!isTerminal && (
            <>
              {!isPartenaireOwner ? (
                <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Send className="mr-1.5 h-4 w-4" />{" "}
                      {t("admin.opportunityDetail.handover.button")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("admin.opportunityDetail.handover.dialogTitle")}</DialogTitle>
                      <DialogDescription>
                        {t("admin.opportunityDetail.handover.dialogDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      rows={4}
                      value={handoverMsg}
                      onChange={(e) => setHandoverMsg(e.target.value)}
                      placeholder={t("admin.opportunityDetail.handover.placeholder")}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setHandoverOpen(false)}>
                        {t("admin.common.cancel")}
                      </Button>
                      <Button
                        disabled={busy || !handoverMsg.trim()}
                        onClick={() =>
                          run(async () => {
                            await handoverFn({ data: { id, message: handoverMsg } });
                            setHandoverMsg("");
                            setHandoverOpen(false);
                          }, t("admin.opportunityDetail.handover.successToast"))
                        }
                      >
                        {t("admin.common.send")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => reclaimFn({ data: { id } }),
                      t("admin.opportunityDetail.reclaim.successToast"),
                    )
                  }
                >
                  <Undo2 className="mr-1.5 h-4 w-4" /> {t("admin.opportunityDetail.reclaim.button")}
                </Button>
              )}

              <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Truck className="mr-1.5 h-4 w-4" />{" "}
                    {t("admin.opportunityDetail.delivery.label")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.opportunityDetail.delivery.dialogTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("admin.opportunityDetail.delivery.dialogDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    rows={3}
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder={t("admin.opportunityDetail.delivery.notesPlaceholder")}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeliverOpen(false)}>
                      {t("admin.common.cancel")}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await deliverFn({ data: { id, notes: deliveryNotes || undefined } });
                          setDeliverOpen(false);
                          setDeliveryNotes("");
                        }, t("admin.opportunityDetail.delivery.successToast"))
                      }
                    >
                      {t("admin.common.confirm")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={lostOpen} onOpenChange={setLostOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-status-refused-foreground/40 text-status-refused-foreground"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />{" "}
                    {t("admin.opportunityDetail.lost.button")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.opportunityDetail.lost.dialogTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("admin.opportunityDetail.lost.dialogDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.opportunityDetail.lost.reasonLabel")}
                    </span>
                    <Select value={lostReason} onValueChange={setLostReason}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOSED_LOST_REASONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <Textarea
                    rows={3}
                    value={lostNotes}
                    onChange={(e) => setLostNotes(e.target.value)}
                    placeholder={t("admin.opportunityDetail.lost.detailsPlaceholder")}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setLostOpen(false)}>
                      {t("admin.common.cancel")}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const reason =
                            CLOSED_LOST_REASONS.find((r) => r.value === lostReason)?.label +
                            (lostNotes ? " — " + lostNotes : "");
                          await closeFn({ data: { id, outcome: "lost", reason } });
                          setLostOpen(false);
                          setLostNotes("");
                        }, t("admin.opportunityDetail.lost.successToast"))
                      }
                    >
                      {t("admin.opportunityDetail.lost.confirmButton")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">{t("admin.opportunityDetail.purchase.button")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.opportunityDetail.purchase.dialogTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("admin.opportunityDetail.purchase.dialogDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.opportunityDetail.purchase.priceLabel")}
                      </span>
                      <Input
                        type="number"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.opportunityDetail.purchase.referenceLabel")}
                      </span>
                      <Input value={purchaseRef} onChange={(e) => setPurchaseRef(e.target.value)} />
                    </label>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConvertOpen(false)}>
                      {t("admin.common.cancel")}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const price = Number(purchasePrice);
                          if (!price || price <= 0)
                            throw new Error(
                              t("admin.opportunityDetail.purchase.invalidPriceError"),
                            );
                          await convertFn({
                            data: { id, price, reference: purchaseRef || undefined },
                          });
                          setConvertOpen(false);
                          setPurchasePrice("");
                          setPurchaseRef("");
                        }, t("admin.opportunityDetail.purchase.successToast"))
                      }
                    >
                      {t("admin.common.save")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {isTerminal && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(
                  () => reopenFn({ data: { id } }),
                  t("admin.opportunityDetail.reopen.successToast"),
                )
              }
            >
              <PlayCircle className="mr-1.5 h-4 w-4" /> {t("admin.opportunityDetail.reopen.button")}
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={opp.assigned_sales_agent_id ?? "none"}
              onValueChange={(v) =>
                run(
                  () => assignFn({ data: { id, agentId: v === "none" ? null : v } }),
                  t("admin.opportunityDetail.assign.successToast"),
                )
              }
            >
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder={t("admin.opportunityDetail.assign.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t("admin.opportunityDetail.assign.unassigned")}
                </SelectItem>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {agents.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.first_name} {a.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {/* Transformation en offre de vente (visible dès que le véhicule est acheté) */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SaleListingPanel opportunityId={id} opp={opp} photos={(data.photos ?? []) as any[]} />
      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("admin.opportunityDetail.tabs.details")}</TabsTrigger>
          <TabsTrigger value="activity">{t("admin.opportunityDetail.tabs.activity")}</TabsTrigger>
          <TabsTrigger value="photos">{t("admin.opportunityDetail.tabs.photos")}</TabsTrigger>
          <TabsTrigger value="payment">{t("admin.opportunityDetail.tabs.payment")}</TabsTrigger>
          <TabsTrigger value="dossier">{t("admin.opportunityDetail.tabs.dossier")}</TabsTrigger>
          <TabsTrigger value="finance">{t("admin.opportunityDetail.tabs.finance")}</TabsTrigger>
          <TabsTrigger value="history">{t("admin.opportunityDetail.tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <FullVehicleCard opp={opp} />
              <Card className="border-border/70">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="h-4 w-4 text-accent" />{" "}
                    {t("admin.opportunityDetail.notes.heading")}
                  </div>
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("admin.opportunityDetail.notes.placeholder")}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy || !note.trim()}
                      onClick={() =>
                        run(async () => {
                          await noteFn({ data: { id, note } });
                          setNote("");
                        }, t("admin.opportunityDetail.notes.addedToast"))
                      }
                    >
                      <Lock className="mr-1.5 h-4 w-4" />{" "}
                      {t("admin.opportunityDetail.notes.internalButton")}
                    </Button>
                    <Button
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                      disabled={busy || !note.trim()}
                      onClick={() =>
                        run(async () => {
                          await reqFn({ data: { id, message: note } });
                          setNote("");
                        }, t("admin.opportunityDetail.notes.sentToast"))
                      }
                    >
                      {t("admin.opportunityDetail.notes.sendToPartnerButton")}
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(data.notes as any[]).map((n: any) => (
                      <div
                        key={n.id}
                        className="rounded-md border border-border bg-secondary/40 p-3 text-sm"
                      >
                        <div className="whitespace-pre-wrap">{n.note}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {formatDateTime(n.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="border-border/70">
                <CardContent className="p-5">
                  <div className="mb-2 text-sm font-semibold">
                    {t("admin.opportunityDetail.partnerCard.heading")}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">
                      {profile?.first_name} {profile?.last_name}
                      {profile?.company_name ? " · " + profile.company_name : ""}
                    </div>
                    <div className="text-muted-foreground">
                      {profile?.email} · {profile?.phone ?? "—"}
                    </div>
                    <div className="text-muted-foreground">
                      {profile?.city ?? "—"}, {profile?.country ?? "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/70">
                <CardContent className="p-5">
                  <div className="mb-3 text-sm font-semibold">
                    {t("admin.opportunityDetail.infoRequests.heading")}
                  </div>
                  {(data.infoRequests as any[]).length === 0 && ( // eslint-disable-line @typescript-eslint/no-explicit-any
                    <div className="text-sm text-muted-foreground">
                      {t("admin.opportunityDetail.infoRequests.empty")}
                    </div>
                  )}
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(data.infoRequests as any[]).map((r: any) => (
                      <div
                        key={r.id}
                        className="rounded-md border border-border bg-card p-3 text-sm"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">
                            {r.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateTime(r.created_at)}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap">{r.message}</div>
                        {r.response && (
                          <div className="mt-2 rounded-md border border-accent/30 bg-accent/5 p-2">
                            <div className="text-[10px] uppercase tracking-widest text-accent">
                              {t("admin.opportunityDetail.infoRequests.partnerReplyLabel")}
                            </div>
                            <div className="whitespace-pre-wrap text-sm">{r.response}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="border-border/70">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.opportunityDetail.activity.typeLabel")}
                  </span>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Select value={activityKind} onValueChange={(v) => setActivityKind(v as any)}>
                    {" "}
                    // eslint-disable-line @typescript-eslint/no-explicit-any // eslint-disable-line
                    @typescript-eslint/no-explicit-any
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">
                        {t("admin.opportunityDetail.activity.kind.note")}
                      </SelectItem>
                      <SelectItem value="call">
                        {t("admin.opportunityDetail.activity.kind.call")}
                      </SelectItem>
                      <SelectItem value="email">
                        {t("admin.opportunityDetail.activity.kind.email")}
                      </SelectItem>
                      <SelectItem value="meeting">
                        {t("admin.opportunityDetail.activity.kind.meeting")}
                      </SelectItem>
                      <SelectItem value="task">
                        {t("admin.opportunityDetail.activity.kind.task")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <Textarea
                  className="flex-1 min-w-[240px]"
                  rows={2}
                  value={activityBody}
                  onChange={(e) => setActivityBody(e.target.value)}
                  placeholder={t("admin.opportunityDetail.activity.placeholder")}
                />
                <Button
                  disabled={busy || !activityBody.trim()}
                  onClick={() =>
                    run(async () => {
                      await addActivityFn({ data: { id, kind: activityKind, body: activityBody } });
                      setActivityBody("");
                    }, t("admin.opportunityDetail.activity.addedToast"))
                  }
                >
                  {t("admin.common.add")}
                </Button>
              </div>
              <div className="space-y-2">
                {activities.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {t("admin.opportunityDetail.activity.empty")}
                  </div>
                )}
                {activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {a.kind}
                    </Badge>
                    <div className="flex-1">
                      <div className="whitespace-pre-wrap">{a.body}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {formatDateTime(a.created_at)}
                        {a.done_at ? ` · ${t("admin.opportunityDetail.activity.doneSuffix")}` : ""}
                      </div>
                    </div>
                    {a.kind === "task" && !a.done_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => doneActivityFn({ data: { activityId: a.id } }),
                            t("admin.opportunityDetail.activity.completedToast"),
                          )
                        }
                      >
                        {t("admin.opportunityDetail.activity.completeButton")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          {(data.photos as any[]).length === 0 ? ( // eslint-disable-line @typescript-eslint/no-explicit-any
            <div className="text-sm text-muted-foreground">
              {t("admin.opportunityDetail.photos.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(data.photos as any[]).map((p: any) => (
                <div
                  key={p.id}
                  className="aspect-square overflow-hidden rounded-md border border-border bg-secondary"
                >
                  {urls[p.storage_path] ? (
                    <img src={urls[p.storage_path]} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/70">
              <CardContent className="p-5">
                <div className="text-sm font-semibold">
                  {t("admin.opportunityDetail.payment.heading")}
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div>
                    {t("admin.opportunityDetail.payment.amountLabel")}{" "}
                    <span className="font-semibold">
                      {opp.total_contract_value_eur != null
                        ? formatPrice(opp.total_contract_value_eur)
                        : "—"}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {t("admin.opportunityDetail.payment.receivedLabel")}{" "}
                    {opp.payment_received_at ? formatDateTime(opp.payment_received_at) : "—"}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="p-5">
                <div className="text-sm font-semibold">
                  {t("admin.opportunityDetail.delivery.label")}
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="text-muted-foreground">
                    {t("admin.opportunityDetail.payment.deliveredLabel")}{" "}
                    {opp.delivered_at ? formatDateTime(opp.delivered_at) : "—"}
                  </div>
                  {opp.delivery_notes && (
                    <div className="whitespace-pre-wrap">{opp.delivery_notes}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="border-border/70">
            <CardContent className="p-5">
              <div className="text-sm font-semibold">
                {t("admin.opportunityDetail.purchase.dialogTitle")}
              </div>
              <div className="mt-2 text-sm">
                {opp.purchase_price_excl_tax != null ? (
                  <>
                    <div className="text-lg font-bold">
                      {formatPrice(opp.purchase_price_excl_tax)}
                    </div>
                    {opp.purchase_reference && (
                      <div className="text-xs text-muted-foreground">
                        {t("admin.opportunityDetail.payment.purchaseRefPrefix")}{" "}
                        {opp.purchase_reference}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    {t("admin.opportunityDetail.payment.notProvided")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {status === "refusee" && (
            <Card className="border-status-refused-foreground/40">
              <CardContent className="p-5">
                <div className="text-sm font-semibold text-status-refused-foreground">
                  {t("admin.opportunityDetail.payment.lostReasonHeading")}
                </div>
                <div className="mt-2 text-sm">{opp.close_reason || "—"}</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          <CommissionPanel opportunityId={id} isAdmin={true} />
        </TabsContent>

        <TabsContent value="dossier" className="space-y-4">
          <BenchmarkPanel
            opportunityId={id}
            askedPriceEur={
              opp.desired_price_excl_tax != null ? Number(opp.desired_price_excl_tax) : null
            }
            marketPriceEstimateEur={
              opp.market_price_estimate_eur != null ? Number(opp.market_price_estimate_eur) : null
            }
            marketPriceGapPct={
              opp.market_price_gap_pct != null ? Number(opp.market_price_gap_pct) : null
            }
            priceAttractive={opp.price_attractive ?? null}
            benchmarkComment={opp.benchmark_comment ?? null}
          />
          {ai.dossierAudit && <DossierAuditPanel opportunityId={id} />}
          <DossierPanel opportunityId={id} />
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-border/70">
            <CardContent className="p-5">
              <ol className="space-y-3">
                {(data.history as any[]).length === 0 && ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <li className="text-sm text-muted-foreground">
                    {t("admin.opportunityDetail.history.empty")}
                  </li>
                )}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(data.history as any[]).map((h: any) => (
                  <li key={h.id} className="flex gap-3">
                    <Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-accent stroke-accent" />
                    <div>
                      <div className="text-sm font-medium">
                        {STATUS_LABEL[h.new_status as OpportunityStatus] ?? h.new_status}
                      </div>
                      {h.message && (
                        <div className="text-xs text-muted-foreground">{h.message}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        {formatDateTime(h.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FullVehicleCard({ opp }: { opp: any }) {
  const { t } = useTranslation();
  const rows: [string, React.ReactNode][] = [
    [t("admin.opportunityDetail.vehicleFields.brand"), opp.brand ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.model"), opp.model ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.version"), opp.version ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.firstRegistrationDate"),
      formatDate(opp.first_registration_date),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.mileage"),
      opp.mileage ? opp.mileage.toLocaleString("fr-FR") + " km" : "—",
    ],
    [t("admin.opportunityDetail.vehicleFields.registrationNumber"), opp.registration_number ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.vin"), opp.vin ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.location"),
      `${opp.city ?? "—"}${opp.postal_code ? " (" + opp.postal_code + ")" : ""}, ${opp.country ?? ""}`,
    ],
    [
      t("admin.opportunityDetail.vehicleFields.visibleOnSite"),
      labelFor(VISIBILITY_OPTIONS, opp.visible_on_site),
    ],
    [t("admin.opportunityDetail.vehicleFields.fuelType"), labelFor(FUEL_OPTIONS, opp.fuel_type)],
    [t("admin.opportunityDetail.vehicleFields.gearbox"), labelFor(GEARBOX_OPTIONS, opp.gearbox)],
    [t("admin.opportunityDetail.vehicleFields.power"), opp.power ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.euroStandard"), opp.euro_standard ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.grossVehicleWeight"),
      opp.gross_vehicle_weight ?? "—",
    ],
    [t("admin.opportunityDetail.vehicleFields.payload"), opp.payload ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.axleConfiguration"), opp.axle_configuration ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.cabinType"), labelFor(CABIN_OPTIONS, opp.cabin_type)],
    [
      t("admin.opportunityDetail.vehicleFields.bodyType"),
      opp.body_type_other || opp.body_type || "—",
    ],
    [
      t("admin.opportunityDetail.vehicleFields.wheelbase"),
      opp.wheelbase_mm ? `${opp.wheelbase_mm.toLocaleString("fr-FR")} mm` : "—",
    ],
    [t("admin.opportunityDetail.vehicleFields.suspensionType"), opp.suspension_type ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.tyreSize"), opp.tyre_size ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.boxDimensions"),
      opp.box_depth_mm || opp.box_width_mm || opp.box_height_mm
        ? `${opp.box_depth_mm ?? "?"} × ${opp.box_width_mm ?? "?"} × ${opp.box_height_mm ?? "?"} mm`
        : "—",
    ],
    [t("admin.opportunityDetail.vehicleFields.equipment"), (opp.equipment ?? []).join(", ") || "—"],
    [t("admin.opportunityDetail.vehicleFields.otherEquipment"), opp.other_equipment_details ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.airConditioning"),
      labelFor(YES_NO_OPTIONS, opp.has_air_conditioning),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.additionalHeating"),
      labelFor(YES_NO_OPTIONS, opp.has_heating),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.hydraulicHook"),
      labelFor(YES_NO_OPTIONS, opp.has_hydraulic_hook),
    ],
    [t("admin.opportunityDetail.vehicleFields.crane"), labelFor(YES_NO_OPTIONS, opp.has_crane)],
    [t("admin.opportunityDetail.vehicleFields.craneDetails"), opp.crane_details ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.tailLift"),
      labelFor(YES_NO_OPTIONS, opp.tail_lift_present),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.tailLiftHomologated"),
      labelFor(YES_NO_OPTIONS, opp.tail_lift_homologated),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.tailLiftHomologationBook"),
      labelFor(YES_NO_OPTIONS, opp.tail_lift_homologation_book),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.tailLiftMaintenanceBook"),
      labelFor(YES_NO_OPTIONS, opp.tail_lift_maintenance_book),
    ],
    [t("admin.opportunityDetail.vehicleFields.tailLiftCondition"), opp.tail_lift_condition ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.tailLiftComment"), opp.tail_lift_comment ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.generalCondition"),
      labelFor(CONDITION_OPTIONS, opp.general_condition),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.vehicleRuns"),
      labelFor(YES_NO_OPTIONS, opp.vehicle_runs),
    ],
    [t("admin.opportunityDetail.vehicleFields.notRunningReason"), opp.not_running_reason ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.technicalInspection"),
      labelFor(YES_NO_OPTIONS, opp.technical_inspection_status),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.inspectionValidUntil"),
      formatDate(opp.inspection_valid_until),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.maintenanceStatus"),
      labelFor(YES_NO_OPTIONS, opp.maintenance_status),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.serviceBook"),
      labelFor(YES_NO_OPTIONS, opp.has_service_book),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.keysCount"),
      opp.keys_count ? String(opp.keys_count) : "—",
    ],

    [
      t("admin.opportunityDetail.vehicleFields.priceNegotiable"),
      labelFor(NEGOTIABLE_OPTIONS, opp.price_negotiable),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.marketEstimate"),
      opp.market_price_estimate_eur
        ? `${Number(opp.market_price_estimate_eur).toLocaleString("fr-FR")} €`
        : "—",
    ],
    [
      t("admin.opportunityDetail.vehicleFields.marketGap"),
      opp.market_price_gap_pct != null ? `${opp.market_price_gap_pct} %` : "—",
    ],
    [t("admin.opportunityDetail.vehicleFields.priceAttractive"), opp.price_attractive ?? "—"],
    [t("admin.opportunityDetail.vehicleFields.benchmarkComment"), opp.benchmark_comment ?? "—"],
    [t("admin.common.fields.availability"), labelFor(AVAILABILITY_OPTIONS, opp.availability)],
    [
      t("admin.opportunityDetail.vehicleFields.freeOfPledge"),
      labelFor(YES_NO_OPTIONS, opp.free_of_pledge ?? opp.free_of_commitment),
    ],
    [t("admin.opportunityDetail.vehicleFields.specialConditions"), opp.special_conditions ?? "—"],
    [
      t("admin.opportunityDetail.vehicleFields.defectsAndComments"),
      opp.defects_and_comments ||
        [opp.known_defects, opp.expected_repairs, opp.additional_comments]
          .filter(Boolean)
          .join(" — ") ||
        "—",
    ],
    [
      t("admin.opportunityDetail.vehicleFields.locationLink"),
      opp.location_url ? (
        <a href={opp.location_url} target="_blank" rel="noreferrer" className="underline">
          {t("admin.opportunityDetail.vehicleFields.openMap")}
        </a>
      ) : (
        "—"
      ),
    ],
    [
      t("admin.opportunityDetail.vehicleFields.onsiteContact"),
      `${opp.onsite_contact_name ?? "—"} · ${opp.onsite_contact_phone ?? ""} · ${opp.onsite_contact_email ?? ""}`,
    ],
  ];
  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="mb-3 text-sm font-semibold">
          {t("admin.opportunityDetail.vehicleFields.heading")}
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          {rows.map(([k, v], i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 border-b border-border/50 py-1"
            >
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="max-w-[60%] text-right text-sm">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
