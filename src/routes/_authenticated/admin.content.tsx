import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { adminListSiteContent, adminUpsertSiteContent } from "@/lib/admin-refdata.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/content")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin"]);
  },
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const listFn = useServerFn(adminListSiteContent);
  const upsertFn = useServerFn(adminUpsertSiteContent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-content"], queryFn: () => listFn() });
  const [nk, setNk] = useState({ key: "", locale: "fr", value: "" });

  async function save(key: string, locale: string, value: string) {
    try {
      await upsertFn({ data: { key, locale, value } });
      qc.invalidateQueries({ queryKey: ["admin-content"] });
      toast.success(t("admin.content.toast.saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="pb-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("admin.content.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.content.subtitle")}</p>
      </div>

      <Card className="border-border/70">
        <CardContent className="p-4 space-y-3">
          <Label>{t("admin.content.newEntry")}</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_2fr_auto]">
            <Input
              placeholder={t("admin.content.fields.keyPlaceholder")}
              value={nk.key}
              onChange={(e) => setNk((n) => ({ ...n, key: e.target.value }))}
            />
            <Input
              placeholder="fr"
              value={nk.locale}
              onChange={(e) => setNk((n) => ({ ...n, locale: e.target.value }))}
            />
            <Input
              placeholder={t("admin.content.fields.valuePlaceholder")}
              value={nk.value}
              onChange={(e) => setNk((n) => ({ ...n, value: e.target.value }))}
            />
            <Button
              onClick={() => {
                if (!nk.key) return;
                save(nk.key, nk.locale || "fr", nk.value);
                setNk({ key: "", locale: "fr", value: "" });
              }}
            >
              {t("admin.content.add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(data?.rows ?? []).map((r: any) => (
            <Card key={`${r.key}::${r.locale}`} className="border-border/70">
              <CardContent className="p-3 grid gap-2 sm:grid-cols-[240px_60px_1fr_auto] sm:items-start">
                <div className="font-mono text-xs text-muted-foreground">{r.key}</div>
                <div className="text-xs uppercase text-muted-foreground">{r.locale}</div>
                <Textarea
                  defaultValue={r.value}
                  className="min-h-[60px]"
                  onBlur={(e) => save(r.key, r.locale, e.target.value)}
                />
                <div className="text-[10px] text-muted-foreground">
                  {new Date(r.updated_at).toLocaleString("fr-FR")}
                </div>
              </CardContent>
            </Card>
          ))}
          {(data?.rows ?? []).length === 0 && (
            <Card className="border-border/70">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t("admin.content.empty")}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
