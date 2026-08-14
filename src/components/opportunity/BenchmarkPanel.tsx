import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveOpportunityBenchmark } from "@/lib/opportunity-dossier.functions";
import { PRICE_ATTRACTIVE_OPTIONS } from "@/lib/wilmet-constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      : marketPriceGapPct ?? null;

  async function save() {
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error("Estimation de marché invalide");
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
      toast.success("Benchmark enregistré");
      await qc.invalidateQueries({ queryKey: ["admin-opportunity", opportunityId] });
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Benchmark prix marché</h3>
          {liveGap != null && (
            <Badge variant={liveGap > 10 ? "destructive" : "secondary"}>
              Écart {liveGap > 0 ? "+" : ""}
              {liveGap} %
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Prix demandé :{" "}
          {askedPriceEur != null ? `${askedPriceEur.toLocaleString("fr-FR")} €` : "non renseigné"}.
          L'écart est calculé automatiquement par rapport à l'estimation de marché saisie.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Estimation marché (€ HT)</label>
            <Input
              inputMode="decimal"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="Ex : 24500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Prix attractif ?</label>
            <Select value={attractive || undefined} onValueChange={setAttractive}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
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
          <label className="text-xs text-muted-foreground">Commentaire benchmark</label>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comparables observés, arguments de négociation…"
          />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer le benchmark"}
        </Button>
      </CardContent>
    </Card>
  );
}
