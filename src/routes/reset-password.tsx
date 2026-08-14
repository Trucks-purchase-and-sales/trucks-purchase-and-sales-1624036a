import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error("Impossible de mettre à jour", { description: error.message }); return; }
    toast.success("Mot de passe mis à jour");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="container-page flex min-h-screen items-center justify-center py-10">
        <Card className="w-full max-w-md border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Nouveau mot de passe</CardTitle>
            <CardDescription>Choisissez un nouveau mot de passe sécurisé.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Mot de passe</Label>
                <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Confirmer</Label>
                <Input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
                {loading ? "Mise à jour…" : "Enregistrer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
