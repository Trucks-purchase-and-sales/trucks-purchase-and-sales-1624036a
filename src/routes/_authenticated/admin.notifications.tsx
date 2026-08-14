import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminBroadcastNotification, adminListRecentBroadcasts } from "@/lib/admin-refdata.functions";
import { formatDateTime } from "@/lib/wilmet-constants";

import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin"]);
  },
  component: Page,
});

const ROLE_LABELS: Record<string, string> = {
  partenaire: "Partenaires",
  buyer: "Acheteurs",
  sales_agent: "Commerciaux",
  sales_manager: "Managers commerciaux",
  company_management: "Direction",
  admin: "Admins",
  platform_admin: "Admins plateforme",
};

function Page() {
  const broadcastFn = useServerFn(adminBroadcastNotification);
  const listFn = useServerFn(adminListRecentBroadcasts);
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "role">("role");
  const [role, setRole] = useState<string>("partenaire");
  const [sending, setSending] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: async () => (await listFn()).rows as Array<{ id: string; metadata: any; created_at: string }>,
  });

  async function send() {
    if (title.trim().length < 2) { toast.error("Titre requis"); return; }
    setSending(true);
    try {
      const res = await broadcastFn({
        data: {
          title: title.trim(),
          body: body.trim() || undefined,
          audience,
          role: audience === "role" ? (role as any) : undefined,
          type: "broadcast",
        },
      });
      toast.success(`Notification envoyée à ${res.count} destinataire(s)`);
      setTitle(""); setBody("");
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    } catch (e) {
      toast.error("Envoi impossible", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pb-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications — diffusion</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Envoyez une notification interne à tous les utilisateurs ou à un rôle spécifique.
      </p>

      <Card className="mt-6 border-border/70">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-2">
            <Label htmlFor="notif-title">Titre</Label>
            <Input id="notif-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Ex : Nouvelle fonctionnalité disponible" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notif-body">Message (optionnel)</Label>
            <Textarea id="notif-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} placeholder="Détails, lien à mentionner, etc." />
          </div>

          <div className="grid gap-2">
            <Label>Audience</Label>
            <RadioGroup value={audience} onValueChange={(v) => setAudience(v as "all" | "role")} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="role" id="aud-role" /> Un rôle
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="all" id="aud-all" /> Tous les utilisateurs
              </label>
            </RadioGroup>
          </div>

          {audience === "role" && (
            <div className="grid gap-2">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={send} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-lg font-semibold">Historique</h2>
      <div className="mt-3 space-y-2">
        {(data ?? []).length === 0 && <div className="text-sm text-muted-foreground">Aucune diffusion pour l'instant.</div>}
        {(data ?? []).map((n) => {
          const m = n.metadata ?? {};
          return (
            <Card key={n.id} className="border-border/70"><CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{m.title ?? "Diffusion"}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.audience === "all" ? "Tous" : ROLE_LABELS[m.role] ?? m.role}</Badge>
                  <Badge>{m.count ?? 0} envois</Badge>
                </div>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{formatDateTime(n.created_at)}</div>
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}
