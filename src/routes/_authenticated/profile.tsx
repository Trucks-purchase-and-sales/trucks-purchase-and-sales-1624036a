import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROVIDER_TYPE_OPTIONS } from "@/lib/wilmet-constants";

export const Route = createFileRoute("/_authenticated/profile")({ component: ProfilePage });

function ProfilePage() {
  const { userId, email } = Route.useRouteContext();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    first_name: "", last_name: "", company_name: "", phone: "",
    provider_type: "", city: "", country: "France",
  });
  useEffect(() => {
    if (profile) setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      company_name: profile.company_name ?? "",
      phone: profile.phone ?? "",
      provider_type: profile.provider_type ?? "",
      city: profile.city ?? "",
      country: profile.country ?? "France",
    });
  }, [profile]);

  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: form.first_name, last_name: form.last_name,
      company_name: form.company_name, phone: form.phone,
      provider_type: (form.provider_type || null) as never,
      city: form.city, country: form.country,
    }).eq("id", userId);
    setSaving(false);
    if (error) { toast.error("Enregistrement impossible", { description: error.message }); return; }
    toast.success("Profil mis à jour");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mon profil</h1>
      <p className="mt-1 text-sm text-muted-foreground">Vos informations de partenaire.</p>

      <Card className="mt-6 border-border/70">
        <CardHeader><CardTitle className="text-lg">Informations personnelles</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <F l="Prénom"><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></F>
              <F l="Nom"><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></F>
            </div>
            <F l="Société"><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></F>
            <F l="Type de partenaire">
              <Select value={form.provider_type} onValueChange={(v) => setForm({ ...form, provider_type: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F l="Téléphone"><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
              <F l="Email"><Input value={email} disabled /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F l="Ville"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></F>
              <F l="Pays"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></F>
            </div>
            <Button disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{l}</Label>
      {children}
    </div>
  );
}
