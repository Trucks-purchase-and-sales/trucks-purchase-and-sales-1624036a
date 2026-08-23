import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminBroadcastNotification,
  adminListRecentBroadcasts,
} from "@/lib/admin-refdata.functions";
import { formatDateTime } from "@/lib/wilmet-constants";

import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin"]);
  },
  component: Page,
});

/** i18n keys for each broadcast audience role — call t(ROLE_LABEL_KEYS[role]) at render time. */
const ROLE_LABEL_KEYS: Record<string, string> = {
  partenaire: "admin.notifications.roles.partenaire",
  buyer: "admin.notifications.roles.buyer",
  sales_agent: "admin.notifications.roles.salesAgent",
  sales_manager: "admin.notifications.roles.salesManager",
  company_management: "admin.notifications.roles.companyManagement",
  admin: "admin.notifications.roles.admin",
  platform_admin: "admin.notifications.roles.platformAdmin",
};

function Page() {
  const { t } = useTranslation();
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
    queryFn: async () =>
      (await listFn()).rows as Array<{ id: string; metadata: any; created_at: string }>, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  async function send() {
    if (title.trim().length < 2) {
      toast.error(t("admin.notifications.toast.titleRequired"));
      return;
    }
    setSending(true);
    try {
      const res = await broadcastFn({
        data: {
          title: title.trim(),
          body: body.trim() || undefined,
          audience,
          role: audience === "role" ? (role as any) : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
          type: "broadcast",
        },
      });
      toast.success(t("admin.notifications.toast.sent", { count: res.count }));
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    } catch (e) {
      toast.error(t("admin.notifications.toast.sendFailed"), { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pb-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {t("admin.notifications.title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("admin.notifications.subtitle")}</p>

      <Card className="mt-6 border-border/70">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-2">
            <Label htmlFor="notif-title">{t("admin.notifications.fields.title")}</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder={t("admin.notifications.fields.titlePlaceholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notif-body">{t("admin.notifications.fields.body")}</Label>
            <Textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={t("admin.notifications.fields.bodyPlaceholder")}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("admin.notifications.fields.audience")}</Label>
            <RadioGroup
              value={audience}
              onValueChange={(v) => setAudience(v as "all" | "role")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="role" id="aud-role" />{" "}
                {t("admin.notifications.audience.role")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="all" id="aud-all" /> {t("admin.notifications.audience.all")}
              </label>
            </RadioGroup>
          </div>

          {audience === "role" && (
            <div className="grid gap-2">
              <Label>{t("admin.notifications.fields.role")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABEL_KEYS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {t(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={send} disabled={sending} className="gap-2">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? t("admin.notifications.sending") : t("admin.notifications.send")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-lg font-semibold">{t("admin.notifications.history.title")}</h2>
      <div className="mt-3 space-y-2">
        {(data ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground">
            {t("admin.notifications.history.empty")}
          </div>
        )}
        {(data ?? []).map((n) => {
          const m = n.metadata ?? {};
          return (
            <Card key={n.id} className="border-border/70">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {m.title ?? t("admin.notifications.history.defaultTitle")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {m.audience === "all"
                        ? t("admin.notifications.history.all")
                        : ROLE_LABEL_KEYS[m.role]
                          ? t(ROLE_LABEL_KEYS[m.role])
                          : m.role}
                    </Badge>
                    <Badge>
                      {t("admin.notifications.history.sentCount", { count: m.count ?? 0 })}
                    </Badge>
                  </div>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {formatDateTime(n.created_at)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
