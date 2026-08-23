import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { saveOpportunityBenchmark } from "@/lib/opportunity-dossier.functions";
import { PRICE_ATTRACTIVE_OPTIONS } from "@/lib/wilmet-constants";
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
import { LineChart } from "lucide-react";

type Props = {
  opportunityId: string;
  askedPriceEur?: number | null;
  marketPriceEstimateEur?: number | null;
  marketPriceGapPct?: number | null;
  priceAttractive?: string | null;
  benchmarkComment?: string | null;
};

export function BenchmarkPanel({
  opportunityId,
  askedPriceEur,
  marketPriceEstimateEur,
  marketPriceGapPct,
  priceAttractive,
  benchmarkComment,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveOpportunityBenchmark);
  const [estimate, setEstimate] = useState(
    marketPriceEstimateEur != null ? String(marketPriceEstimateEur) : "",
  );
  const [attractive, setAttractive] = useState(priceAttractive ?? "");
  const [comment, setComment] = useState(benchmarkComment ?? "");
  const [saving, setSaving] = useState(false);

  const parsed = estimate.trim() === "" ? null : Number(estimate.replace(",", "."));
  const liveGap =
    askedPriceEur != null && parsed != null && parsed > 0
      ? Math.round(((askedPriceEur - parsed) / parsed) * 1000) / 10
      : (marketPriceGapPct ?? null);

  async function save() {
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error(t("admin.opportunityDetail.benchmark.invalidEstimateError"));
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          opportunityId,
          marketPriceEstimateEur: parsed,
          priceAttractive: attractive || null,
          benchmarkComment: comment || null,
        },
      });
      toast.success(t("admin.opportunityDetail.benchmark.savedToast"));
      await qc.invalidateQueries({ queryKey: ["admin-opportunity", opportunityId] });
    } catch {
      toast.error(t("admin.opportunityDetail.dossier.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">
            {t("admin.opportunityDetail.benchmark.heading")}
          </h3>
          {liveGap != null && (
            <Badge variant={liveGap > 10 ? "destructive" : "secondary"}>
              {t("admin.opportunityDetail.benchmark.gapBadgePrefix")} {liveGap > 0 ? "+" : ""}
              {liveGap} %
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("admin.opportunityDetail.benchmark.askedPricePrefix")}{" "}
          {askedPriceEur != null
            ? `${askedPriceEur.toLocaleString("fr-FR")} €`
            : t("admin.opportunityDetail.benchmark.notProvided")}
          . {t("admin.opportunityDetail.benchmark.autoCalcNote")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              {t("admin.opportunityDetail.benchmark.estimateLabel")}
            </label>
            <Input
              inputMode="decimal"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder={t("admin.opportunityDetail.benchmark.estimatePlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              {t("admin.opportunityDetail.benchmark.attractiveLabel")}
            </label>
            <Select value={attractive || undefined} onValueChange={setAttractive}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                {PRICE_ATTRACTIVE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            {t("admin.opportunityDetail.vehicleFields.benchmarkComment")}
          </label>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("admin.opportunityDetail.benchmark.commentPlaceholder")}
          />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving
            ? t("admin.opportunityDetail.benchmark.savingLabel")
            : t("admin.opportunityDetail.benchmark.saveButton")}
        </Button>
      </CardContent>
    </Card>
  );
}
