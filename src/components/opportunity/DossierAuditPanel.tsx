import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { auditOpportunityDossier, type DossierAudit } from "@/lib/dossier-ai.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, ListChecks } from "lucide-react";

const RISK_LABEL: Record<string, string> = { faible: "Risque faible", moyen: "Risque moyen", eleve: "Risque élevé" };

export function DossierAuditPanel({ opportunityId }: { opportunityId: string }) {
  const auditFn = useServerFn(auditOpportunityDossier);
  const [running, setRunning] = useState(false);
  const [audit, setAudit] = useState<DossierAudit | null>(null);

  async function run() {
    setRunning(true);
    try {
      setAudit(await auditFn({ data: { opportunityId } }));
    } catch (e) {
      toast.error("Analyse impossible", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Contrôles IA du dossier
          </div>
          <div className="flex items-center gap-2">
            {audit && (
              <Badge variant={audit.risk_level === "eleve" ? "destructive" : audit.risk_level === "moyen" ? "secondary" : "default"}>
                {RISK_LABEL[audit.risk_level] ?? audit.risk_level}
              </Badge>
            )}
            <Button size="sm" onClick={run} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {running ? "Analyse…" : audit ? "Relancer" : "Analyser le dossier"}
            </Button>
          </div>
        </div>

        {!audit && !running && (
          <p className="text-sm text-muted-foreground">
            L'IA compare la fiche saisie, les documents et les valeurs extraites par OCR : incohérences,
            synthèse automatique et informations manquantes.
          </p>
        )}

        {audit && (
          <div className="space-y-4">
            {audit.summary && (
              <div className="rounded-md border bg-secondary/40 p-3 text-sm leading-relaxed">{audit.summary}</div>
            )}

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Incohérences détectées
              </div>
              {audit.inconsistencies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune incohérence détectée.</p>
              ) : (
                <ul className="space-y-2">
                  {audit.inconsistencies.map((i, idx) => (
                    <li key={idx} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <Badge
                        variant={i.severity === "haute" ? "destructive" : i.severity === "moyenne" ? "secondary" : "outline"}
                        className="mt-0.5 shrink-0"
                      >
                        {i.severity}
                      </Badge>
                      <span>
                        {i.field && <span className="font-medium">{i.field} — </span>}
                        {i.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" /> Informations manquantes
              </div>
              {audit.missing.length === 0 ? (
                <p className="text-sm text-muted-foreground">Dossier complet.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {audit.missing.map((m, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{m.field}</span>
                      {m.why ? ` — ${m.why}` : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
