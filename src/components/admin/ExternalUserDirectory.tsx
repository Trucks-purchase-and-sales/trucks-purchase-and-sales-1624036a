import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  adminListExternalUsers,
  userDelete,
  userSetActive,
  type ExternalUserKind,
} from "@/lib/users-admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/wilmet-constants";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  is_active: boolean;
};

/** i18n keys for the per-kind copy — call t(COPY_KEYS[kind].intro) etc. at render time. */
const COPY_KEYS: Record<ExternalUserKind, { intro: string; empty: string; countLabel: string }> = {
  client: {
    intro: "admin.users.external.client.intro",
    empty: "admin.users.external.client.empty",
    countLabel: "admin.users.external.client.countLabel",
  },
  seller: {
    intro: "admin.users.external.seller.intro",
    empty: "admin.users.external.seller.empty",
    countLabel: "admin.users.external.seller.countLabel",
  },
};

export function ExternalUserDirectory({ kind }: { kind: ExternalUserKind }) {
  const { t } = useTranslation();
  const listFn = useServerFn(adminListExternalUsers);
  const setActiveFn = useServerFn(userSetActive);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const queryKey = ["admin-external-users", kind];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => listFn({ data: { kind } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey });

  const rows = (data?.profiles ?? []) as Row[];
  const counts = (data?.counts ?? {}) as Record<string, number>;
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) =>
        [r.first_name, r.last_name, r.company_name, r.email, r.city]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      )
    : rows;

  const setActive = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setActiveFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(
        v.active
          ? t("admin.users.employees.toast.reactivated")
          : t("admin.users.employees.toast.deactivated"),
      );
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(t("admin.common.failed"), { description: e instanceof Error ? e.message : "" }),
  });

  const copy = COPY_KEYS[kind];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{t(copy.intro)}</p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.common.searchPlaceholder")}
          className="w-full max-w-xs"
        />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}
      {!isLoading && filtered.length === 0 && (
        <div className="text-sm text-muted-foreground">{t(copy.empty)}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Card
            key={p.id}
            className={p.is_active ? "border-border/70" : "border-border/70 opacity-60"}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.company_name || "—"}</div>
                </div>
                {kind === "seller" ? (
                  <Badge className="bg-accent text-accent-foreground">
                    {t("admin.users.external.sellerBadge")}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t("admin.users.external.clientBadge")}</Badge>
                )}
              </div>
              <div className="text-xs break-all">{p.email}</div>
              <div className="text-xs text-muted-foreground">
                {p.phone ?? "—"} · {p.city ?? "—"}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {t("admin.users.external.registeredOn", { date: formatDate(p.created_at) })}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
                  {counts[p.id] ?? 0} {t(copy.countLabel)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={p.is_active}
                    disabled={setActive.isPending}
                    onCheckedChange={(v) => setActive.mutate({ userId: p.id, active: v })}
                  />
                  {t("admin.users.employees.table.active")}
                </label>
                <DeleteUserDialog row={p} onDone={invalidate} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DeleteUserDialog({ row, onDone }: { row: Row; onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const fn = useServerFn(userDelete);
  const del = useMutation({
    mutationFn: () => fn({ data: { userId: row.id } }),
    onSuccess: () => {
      toast.success(t("admin.users.external.toast.deleted"));
      setOpen(false);
      onDone();
    },
    onError: (e: unknown) =>
      toast.error(t("admin.users.external.toast.deleteFailed"), {
        description: e instanceof Error ? e.message : "",
      }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setConfirm("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t("admin.common.delete")}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("admin.users.employees.deleteTitle", { name: `${row.first_name} ${row.last_name}` })}
          </DialogTitle>
          <DialogDescription>{t("admin.users.external.deleteDescription")}</DialogDescription>
        </DialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={row.email ?? ""}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("admin.common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={
              del.isPending ||
              confirm.trim().toLowerCase() !== String(row.email ?? "").toLowerCase()
            }
            onClick={() => del.mutate()}
          >
            {t("admin.users.external.deletePermanently")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
