import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { requireAnyRole } from "@/lib/route-guards";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin"]);
  },
  component: Page,
});

function Page() {
  const read = useServerFn(getAppSettings);
  const save = useServerFn(updateAppSettings);
  const { data, refetch } = useQuery({ queryKey: ["app-settings"], queryFn: () => read() });

  const [autoAssign, setAutoAssign] = useState(true);
  const [assistantOn, setAssistantOn] = useState(false);
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [startHour, setStartHour] = useState(18);
  const [endHour, setEndHour] = useState(8);
  const [aiOn, setAiOn] = useState(false);
  const [aiOcr, setAiOcr] = useState(false);
  const [aiVoice, setAiVoice] = useState(false);
  const [aiAudit, setAiAudit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAutoAssign(data.lead_assignment.enabled);
    setAssistantOn(data.assistant.enabled);
    setAlwaysOn(data.assistant.always_on);
    setStartHour(data.assistant.start_hour);
    setEndHour(data.assistant.end_hour);
    setAiOn(data.ai_features.enabled);
    setAiOcr(data.ai_features.ocr);
    setAiVoice(data.ai_features.voice);
    setAiAudit(data.ai_features.dossier_audit);
  }, [data]);

  const onSave = async () => {
    setSaving(true);
    try {
      await save({
        data: {
          lead_assignment: { enabled: autoAssign },
          assistant: { enabled: assistantOn, always_on: alwaysOn, start_hour: startHour, end_hour: endHour },
          ai_features: { enabled: aiOn, ocr: aiOcr, voice: aiVoice, dossier_audit: aiAudit },
        },
      });
      toast.success("Paramètres enregistrés.");
      void refetch();
    } catch (e) {
      console.error(e);
      toast.error("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Paramètres</h1>
      <p className="mt-1 text-sm text-muted-foreground">Configuration du portail Wilmet Opportunités.</p>

      <Card className="mt-6 border-border/70">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Affectation automatique des leads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quand c'est activé, chaque nouveau dossier part directement dans le pool du groupe concerné :
              les propositions de véhicule vers le groupe Achat, les demandes acheteurs vers le groupe Vente.
              Aucun commercial n'est désigné : le groupe se répartit le travail.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="auto-assign" checked={autoAssign} onCheckedChange={setAutoAssign} />
            <Label htmlFor="auto-assign">Activer l'affectation automatique au groupe</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/70">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Assistant IA du site public</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Chat affiché sur le site vitrine : il qualifie le besoin d'un acheteur et crée
              automatiquement une demande acheteur avec ses coordonnées.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="assistant-on" checked={assistantOn} onCheckedChange={setAssistantOn} />
            <Label htmlFor="assistant-on">Activer l'assistant</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="assistant-always" checked={alwaysOn} onCheckedChange={setAlwaysOn} disabled={!assistantOn} />
            <Label htmlFor="assistant-always">Disponible 24/7 (sinon uniquement hors heures ouvrées)</Label>
          </div>
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="start-hour">Début (heure UTC)</Label>
              <Input id="start-hour" type="number" min={0} max={23} value={startHour} disabled={!assistantOn || alwaysOn}
                onChange={(e) => setStartHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
            <div>
              <Label htmlFor="end-hour">Fin (heure UTC)</Label>
              <Input id="end-hour" type="number" min={0} max={23} value={endHour} disabled={!assistantOn || alwaysOn}
                onChange={(e) => setEndHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Exemple : début 18 et fin 8 = assistant actif de 18 h à 8 h (UTC).
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/70">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Assistance IA dans les formulaires</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contrôle les aides IA proposées aux partenaires et aux commerciaux. Désactivée, une aide
              disparaît de l'interface et son traitement est refusé côté serveur.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="ai-on" checked={aiOn} onCheckedChange={setAiOn} />
            <Label htmlFor="ai-on">Activer l'assistance IA (interrupteur principal)</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="ai-ocr" checked={aiOcr} onCheckedChange={setAiOcr} disabled={!aiOn} />
            <Label htmlFor="ai-ocr">Pré-remplissage IA par photo / document (OCR)</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="ai-voice" checked={aiVoice} onCheckedChange={setAiVoice} disabled={!aiOn} />
            <Label htmlFor="ai-voice">Dictée vocale</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="ai-audit" checked={aiAudit} onCheckedChange={setAiAudit} disabled={!aiOn} />
            <Label htmlFor="ai-audit">Audit IA du dossier</Label>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Button onClick={() => void onSave()} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      <Card className="mt-6 border-border/70">
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold">Général</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Utilisez les sections Utilisateurs, Référentiel, Contenu et Notifications pour
            configurer le portail.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}