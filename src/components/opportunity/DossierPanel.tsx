import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getOpportunityDossier,
  upsertOpportunityDocument,
  saveOpportunityDecision,
} from "@/lib/opportunity-dossier.functions";
import {
  DOCUMENT_CHECKLIST,
  DOCUMENT_STATUS_OPTIONS,
  DECISION_CRITERIA,
  DECISION_VERDICTS,
  formatDateTime,
} from "@/lib/wilmet-constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

type DocRow = {
  id: string;
  doc_type: string;
  status: string;
  notes: string | null;
  verified_at: string | null;
  updated_at: string;
};

export function DossierPanel({ opportunityId }: { opportunityId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const loadFn = useServerFn(getOpportunityDossier);
  const docFn = useServerFn(upsertOpportunityDocument);
  const decisionFn = useServerFn(saveOpportunityDecision);

  const { data, isLoading } = useQuery({
    queryKey: ["opp-dossier", opportunityId],
    queryFn: () => loadFn({ data: { opportunityId } }),
  });

  const docs = (data?.documents ?? []) as DocRow[]; // eslint-disable-line react-hooks/exhaustive-deps
  const byType = useMemo(() => {
    const m: Record<string, DocRow> = {};
    for (const d of docs) m[d.doc_type] = d;
    return m;
  }, [docs]);

  const requiredList = DOCUMENT_CHECKLIST.filter((d) => d.required);
  const validatedRequired = requiredList.filter((d) => byType[d.value]?.status === "valide").length;
  const completion = requiredList.length
    ? Math.round((validatedRequired / requiredList.length) * 100)
    : 0;

  async function setDocStatus(docType: string, status: string, notes?: string | null) {
    try {
      await docFn({
        data: {
          opportunityId,
          docType,
          status: status as never,
          notes: notes ?? byType[docType]?.notes ?? null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["opp-dossier", opportunityId] });
    } catch (e) {
      toast.error(t("admin.opportunityDetail.dossier.saveError"), {
        description: (e as Error).message,
      });
    }
  }

  // ---- Go / No-Go grid state
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState(false);

  const effectiveScores =
    scores ?? (data?.decision?.scores as Record<string, number> | undefined) ?? {};
  const effectiveVerdict = verdict ?? data?.decision?.verdict ?? null;
  const effectiveNotes = notes ?? data?.decision?.notes ?? "";

  const scoreValues = DECISION_CRITERIA.map((c) => effectiveScores[c.key]).filter(
    (v): v is number => typeof v === "number",
  );
  const liveTotal = scoreValues.length
    ? Math.round((scoreValues.reduce((s, n) => s + n, 0) / (scoreValues.length * 5)) * 100)
    : null;

  async function saveDecision() {
    setSavingDecision(true);
    try {
      const res = await decisionFn({
        data: {
          opportunityId,
          scores: effectiveScores,
          verdict: (effectiveVerdict as never) ?? null,
          notes: effectiveNotes || null,
        },
      });
      toast.success(
        t("admin.opportunityDetail.dossier.decisionSavedToast", { score: res.total_score ?? 0 }),
      );
      await qc.invalidateQueries({ queryKey: ["opp-dossier", opportunityId] });
    } catch (e) {
      toast.error(t("admin.opportunityDetail.dossier.saveError"), {
        description: (e as Error).message,
      });
    } finally {
      setSavingDecision(false);
    }
  }

  const groups = useMemo(() => {
    const g: Record<string, typeof DECISION_CRITERIA> = {};
    for (const c of DECISION_CRITERIA) (g[c.group] ??= []).push(c);
    return g;
  }, []);

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        {t("admin.opportunityDetail.dossier.loadingLabel")}
      </p>
    );

  return (
    <div className="space-y-4">
      {/* Level 2 — compliance checklist */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-accent" />{" "}
              {t("admin.opportunityDetail.dossier.complianceHeading")}
            </div>
            <Badge variant="outline">
              {t("admin.opportunityDetail.dossier.validatedBadge", {
                validated: validatedRequired,
                total: requiredList.length,
              })}
            </Badge>
          </div>
          <Progress value={completion} className="h-1.5" />

          <div className="divide-y divide-border/60">
            {DOCUMENT_CHECKLIST.map((doc) => {
              const row = byType[doc.value];
              const status = row?.status ?? "manquant";
              return (
                <div key={doc.value} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-sm">
                      {doc.label}
                      {doc.required && <span className="ml-1 text-destructive">*</span>}
                    </div>
                    {row?.verified_at && (
                      <div className="text-[11px] text-muted-foreground">
                        {t("admin.opportunityDetail.dossier.validatedOnLabel")}{" "}
                        {formatDateTime(row.verified_at)}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      status === "valide"
                        ? "bg-status-accepted-foreground"
                        : status === "recu"
                          ? "bg-status-info-foreground"
                          : status === "demande"
                            ? "bg-status-analysis-foreground"
                            : "bg-muted-foreground/40",
                    )}
                  />
                  <Select value={status} onValueChange={(v) => setDocStatus(doc.value, v)}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Level 3 — Go / No-Go grid */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="h-4 w-4 text-accent" />{" "}
              {t("admin.opportunityDetail.dossier.goNoGoHeading")}
            </div>
            <Badge variant="outline">
              {t("admin.opportunityDetail.dossier.scoreBadge", { score: liveTotal ?? "—" })}
            </Badge>
          </div>

          {Object.entries(groups).map(([group, criteria]) => (
            <div key={group} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </div>
              {criteria.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2"
                >
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm">{c.label}</div>
                    {c.hint && <div className="text-[11px] text-muted-foreground">{c.hint}</div>}
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScores({ ...effectiveScores, [c.key]: n })}
                        className={cn(
                          "h-7 w-7 rounded-md border text-xs font-medium transition-colors",
                          effectiveScores[c.key] === n
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-accent/50",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                {t("admin.opportunityDetail.dossier.verdictLabel")}
              </div>
              <Select value={effectiveVerdict ?? ""} onValueChange={setVerdict}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_VERDICTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                {t("admin.opportunityDetail.dossier.notesLabel")}
              </div>
              <Textarea
                rows={3}
                value={effectiveNotes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("admin.opportunityDetail.dossier.notesPlaceholder")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {data?.decision?.decided_at
                ? t("admin.opportunityDetail.dossier.lastDecisionLabel", {
                    date: formatDateTime(data.decision.decided_at),
                  })
                : t("admin.opportunityDetail.dossier.noDecision")}
            </div>
            <Button onClick={saveDecision} disabled={savingDecision}>
              {savingDecision
                ? t("admin.opportunityDetail.dossier.savingLabel")
                : t("admin.opportunityDetail.dossier.saveDecisionButton")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
