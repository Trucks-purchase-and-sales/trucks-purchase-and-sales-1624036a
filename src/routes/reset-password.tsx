import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useI18nInit } from "@/i18n/useI18nInit";
import { NEW_PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  useI18nInit();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateNewPassword(password);
    if (!validation.valid) {
      toast.error(t("auth.password.tooShortTitle"), { description: validation.message });
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.reset.mismatchError"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(t("auth.reset.updateErrorTitle"), { description: error.message });
      return;
    }
    toast.success(t("auth.reset.successTitle"));
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="container-page flex min-h-screen items-center justify-center py-10">
        <Card className="w-full max-w-md border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>{t("auth.reset.title")}</CardTitle>
            <CardDescription>{t("auth.reset.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("auth.fields.password")}
                </Label>
                <Input
                  type="password"
                  required
                  minLength={NEW_PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  {t("auth.passwordHelp", { min: NEW_PASSWORD_MIN_LENGTH })}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("auth.reset.confirmLabel")}
                </Label>
                <Input
                  type="password"
                  required
                  minLength={NEW_PASSWORD_MIN_LENGTH}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button
                disabled={loading}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                size="lg"
              >
                {loading ? t("auth.common.sendingLoading") : t("auth.reset.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
