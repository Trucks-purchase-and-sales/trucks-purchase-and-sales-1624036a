import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveCommission,
  markCommissionPaid,
  cancelCommission,
  opportunityCommission,
  listCommissionBeneficiaries,
  updateCommissionDraft,
} from "@/lib/commissions.functions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  approved: "default",
  paid: "default",
  cancelled: "outline",
};
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
};

const personLabel = (p: Person) =>
  [
    [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id,
    p.company_name ? `— ${p.company_name}` : null,
  ]
    .filter(Boolean)
    .join(" ");

export function CommissionPanel({
  opportunityId,
  isAdmin,
}: {
  opportunityId: string;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    draft: t("admin.commissions.status.draft"),
    approved: t("admin.commissions.status.approved"),
    paid: t("admin.commissions.status.paid"),
    cancelled: t("admin.commissions.status.cancelled"),
  };
  const RULE_LABEL: Record<string, string> = {
    pct_of_purchase: t("admin.commissions.rule.pctOfPurchase"),
    pct_of_margin: t("admin.commissions.rule.pctOfMargin"),
    flat: t("admin.commissions.rule.flat"),
  };
  const BASIS_LABEL: Record<string, string> = {
    purchase: t("admin.commissions.basis.purchase"),
    sale: t("admin.commissions.basis.sale"),
  };

  const qc = useQueryClient();
  const financeFn = useServerFn(opportunityCommission);
  const approveFn = useServerFn(approveCommission);
  const payFn = useServerFn(markCommissionPaid);
  const cancelFn = useServerFn(cancelCommission);
  const peopleFn = useServerFn(listCommissionBeneficiaries);
  const saveFn = useServerFn(updateCommissionDraft);

  const { data } = useQuery({
    queryKey: ["op-finance", opportunityId],
    queryFn: () => financeFn({ data: { opportunityId } }),
  });
  const c = (data?.commission ?? null) as
    (Record<string, any> & { profiles?: Person | null }) | null; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: peopleData } = useQuery({
    queryKey: ["commission-beneficiaries"],
    queryFn: () => peopleFn(),
    enabled: isAdmin,
  });
  const people = (peopleData?.people ?? []) as Person[];

  const editable = !!c && c.status !== "paid" && c.status !== "cancelled" && isAdmin;

  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [beneficiary, setBeneficiary] = useState<string>("");
  const [basis, setBasis] = useState<string>("purchase");
  const [basisAmount, setBasisAmount] = useState<string>("");
  const [ruleKind, setRuleKind] = useState<string>("pct_of_purchase");
  const [ruleValue, setRuleValue] = useState<string>("");

  useEffect(() => {
    if (!c) return;
    setBeneficiary(c.partenaire_id ?? "");
    setBasis(c.basis ?? "purchase");
    setBasisAmount(c.basis_amount_eur != null ? String(c.basis_amount_eur) : "");
    setRuleKind(c.rule_kind ?? "pct_of_purchase");
    setRuleValue(c.rule_value != null ? String(c.rule_value) : "");
  }, [c?.id, c?.updated_at, c?.computed_amount_eur]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    const v = Number(ruleValue);
    const b = Number(basisAmount);
    if (!Number.isFinite(v)) return null;
    if (ruleKind === "flat") return v;
    if (!Number.isFinite(b)) return null;
    return Math.round(((b * v) / 100) * 100) / 100;
  }, [ruleKind, ruleValue, basisAmount]);

  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["op-finance", opportunityId] });
      qc.invalidateQueries({ queryKey: ["commissions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.common.error"));
    }
  }

  async function save() {
    if (!c) return;
    if (!beneficiary) {
      toast.error(t("admin.commissions.panel.beneficiaryRequiredError"));
      return;
    }
    const v = Number(ruleValue);
    const b = Number(basisAmount || 0);
    if (!Number.isFinite(v) || v < 0) {
      toast.error(t("admin.commissions.panel.invalidRateError"));
      return;
    }
    if (ruleKind !== "flat" && (!Number.isFinite(b) || b <= 0)) {
      toast.error(t("admin.commissions.panel.basisRequiredError"));
      return;
    }
    setBusy(true);
    try {
      await saveFn({
        data: {
          id: c.id,
          partenaireId: beneficiary,
          basis: basis as "purchase" | "sale",
          basisAmount: b,
          ruleKind: ruleKind as "pct_of_purchase" | "pct_of_margin" | "flat",
          ruleValue: v,
        },
      });
      toast.success(t("admin.commissions.panel.updatedToast"));
      setEdit(false);
      qc.invalidateQueries({ queryKey: ["op-finance", opportunityId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/70">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">{t("admin.commissions.panel.heading")}</div>
          {c && (
            <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
          )}
        </div>

        {!c ? (
          <div className="text-sm text-muted-foreground">
            {t("admin.commissions.panel.autoCreateNotePrefix")}{" "}
            <em>{t("admin.commissions.panel.autoCreateNoteBought")}</em>{" "}
            {t("admin.commissions.panel.autoCreateNoteOr")}{" "}
            <em>{t("admin.commissions.panel.autoCreateNoteDelivered")}</em>.
          </div>
        ) : edit ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("admin.commissions.panel.beneficiaryLabel")}</Label>
              <Select value={beneficiary} onValueChange={setBeneficiary}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.commissions.panel.beneficiaryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {personLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("admin.commissions.panel.basisLabel")}</Label>
                <Select value={basis} onValueChange={setBasis}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BASIS_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.commissions.panel.basisAmountLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={basisAmount}
                  onChange={(e) => setBasisAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("admin.commissions.panel.ruleKindLabel")}</Label>
                <Select value={ruleKind} onValueChange={setRuleKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RULE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  {ruleKind === "flat"
                    ? t("admin.commissions.panel.ruleValueFlatLabel")
                    : t("admin.commissions.panel.ruleValuePctLabel")}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ruleValue}
                  onChange={(e) => setRuleValue(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
              {t("admin.commissions.panel.previewLabel")}{" "}
              <span className="font-semibold">{preview != null ? fmt(preview) : "—"}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={busy}>
                {t("admin.common.save")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(false)} disabled={busy}>
                {t("admin.common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{fmt(Number(c.computed_amount_eur))}</div>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div>
                {t("admin.commissions.panel.beneficiaryDisplayLabel")}{" "}
                {c.profiles ? (
                  <span className="font-medium text-foreground">{personLabel(c.profiles)}</span>
                ) : (
                  <span className="text-status-refused-foreground">
                    {t("admin.commissions.panel.beneficiaryUndefined")}
                  </span>
                )}
              </div>
              <div>
                {t("admin.commissions.panel.basisDisplayLabel", {
                  basis: BASIS_LABEL[c.basis] ?? c.basis,
                })}{" "}
                {fmt(Number(c.basis_amount_eur))}
              </div>
              <div>
                {t("admin.commissions.panel.ruleDisplayLabel")}{" "}
                {RULE_LABEL[c.rule_kind] ?? c.rule_kind} — {Number(c.rule_value)}
                {c.rule_kind === "flat" ? " €" : " %"}
              </div>
              {c.approved_at && (
                <div>
                  {t("admin.commissions.panel.approvedOnLabel")}{" "}
                  {new Date(c.approved_at).toLocaleDateString("fr-FR")}
                </div>
              )}
              {c.paid_at && (
                <div>
                  {t("admin.commissions.panel.paidOnLabel")}{" "}
                  {new Date(c.paid_at).toLocaleDateString("fr-FR")}
                </div>
              )}
            </div>

            {isAdmin && c.status !== "cancelled" && (
              <div className="flex flex-wrap gap-2 pt-1">
                {editable && (
                  <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
                    {t("admin.commissions.panel.editButton")}
                  </Button>
                )}
                {c.status === "draft" && (
                  <Button
                    size="sm"
                    disabled={!c.partenaire_id}
                    onClick={() =>
                      act(
                        () => approveFn({ data: { id: c.id } }),
                        t("admin.commissions.panel.approvedToast"),
                      )
                    }
                  >
                    {t("admin.commissions.approveButton")}
                  </Button>
                )}
                {c.status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      act(
                        () => payFn({ data: { id: c.id } }),
                        t("admin.commissions.panel.paidToast"),
                      )
                    }
                  >
                    {t("admin.commissions.markPaidButton")}
                  </Button>
                )}
                {c.status !== "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      act(
                        () => cancelFn({ data: { id: c.id } }),
                        t("admin.commissions.panel.cancelledToast"),
                      )
                    }
                  >
                    {t("admin.common.cancel")}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
