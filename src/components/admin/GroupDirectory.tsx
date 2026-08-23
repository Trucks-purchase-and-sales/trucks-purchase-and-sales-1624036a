import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trans, useTranslation } from "react-i18next";
import {
  groupList,
  groupSave,
  groupDelete,
  staffList,
  type StaffScope,
  type StaffRole,
} from "@/lib/staff.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, UserPen, Users } from "lucide-react";

/** i18n keys for each group "side" label — call t(SIDE_LABEL_KEYS[side]) at render time. */
const SIDE_LABEL_KEYS: Record<StaffScope, string> = {
  purchase: "admin.users.scopes.purchase",
  sales: "admin.users.scopes.sales",
  both: "admin.users.groups.sides.both",
};

type GroupRow = {
  id: string;
  name: string;
  side: StaffScope;
  is_active: boolean;
  is_default: boolean;
  is_external: boolean;
  member_ids: string[];
};

type StaffRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: StaffRole;
  is_active: boolean;
};

export function GroupDirectory() {
  const { t } = useTranslation();
  const listFn = useServerFn(groupList);
  const staffFn = useServerFn(staffList);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-groups"], queryFn: () => listFn() });
  const { data: staffData } = useQuery({ queryKey: ["admin-staff"], queryFn: () => staffFn() });
  const groups = (data?.groups ?? []) as GroupRow[];
  const staff = (staffData?.staff ?? []) as StaffRow[]; // eslint-disable-line react-hooks/exhaustive-deps
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-groups"] });

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of staff)
      m[s.id] = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || (s.email ?? "");
    return m;
  }, [staff]);

  const delFn = useServerFn(groupDelete);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("admin.users.groups.toast.deleted"));
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(t("admin.common.failed"), { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          <Trans i18nKey="admin.users.groups.intro" components={{ strong: <strong /> }}>
            Un <strong>groupe</strong> réunit plusieurs employés. Les dossiers peuvent être affectés
            à un groupe plutôt qu&apos;à une personne : tous ses membres les voient et les traitent,
            ainsi que leur hiérarchie. Le groupe marqué <strong>par défaut</strong> reçoit les
            nouveaux dossiers de son côté (achat ou vente).
          </Trans>
        </p>
        <GroupDialog staff={staff} onDone={invalidate} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.users.groups.table.group")}</TableHead>
                <TableHead>{t("admin.users.groups.table.side")}</TableHead>
                <TableHead>{t("admin.users.groups.table.members")}</TableHead>
                <TableHead className="text-center">
                  {t("admin.users.employees.table.active")}
                </TableHead>
                <TableHead className="text-right">
                  {t("admin.users.employees.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && groups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t("admin.users.groups.table.empty")}
                  </TableCell>
                </TableRow>
              )}
              {groups.map((g) => (
                <TableRow key={g.id} className={g.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4 text-muted-foreground" /> {g.name}
                      {g.is_default && (
                        <Badge variant="secondary">{t("admin.users.groups.badge.default")}</Badge>
                      )}
                      {g.is_external && (
                        <Badge variant="outline">{t("admin.users.groups.badge.external")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{t(SIDE_LABEL_KEYS[g.side])}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {g.member_ids.length === 0
                      ? "—"
                      : g.member_ids.map((id) => nameById[id] ?? id).join(", ")}
                  </TableCell>
                  <TableCell className="text-center">
                    {g.is_active ? (
                      <Badge variant="secondary">{t("admin.users.groups.yes")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("admin.users.groups.no")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <GroupDialog staff={staff} row={g} onDone={invalidate} />
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("admin.common.delete")}
                        disabled={del.isPending}
                        onClick={() => del.mutate(g.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupDialog({
  staff,
  row,
  onDone,
}: {
  staff: StaffRow[];
  row?: GroupRow;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row?.name ?? "");
  const [side, setSide] = useState<StaffScope>(row?.side ?? "both");
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(row?.is_default ?? false);
  const [isExternal, setIsExternal] = useState(row?.is_external ?? false);
  const [memberIds, setMemberIds] = useState<string[]>(row?.member_ids ?? []);
  const saveFn = useServerFn(groupSave);

  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { id: row?.id, name, side, isActive, isDefault, isExternal, memberIds } }),
    onSuccess: () => {
      toast.success(
        row ? t("admin.users.groups.toast.updated") : t("admin.users.groups.toast.created"),
      );
      setOpen(false);
      onDone();
    },
    onError: (e: unknown) =>
      toast.error(t("admin.common.failed"), { description: e instanceof Error ? e.message : "" }),
  });

  const toggle = (id: string) =>
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? (
          <Button variant="ghost" size="icon" title={t("admin.common.edit")}>
            <UserPen className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> {t("admin.users.groups.new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {row
              ? t("admin.users.groups.editTitle", { name: row.name })
              : t("admin.users.groups.new")}
          </DialogTitle>
          <DialogDescription>{t("admin.users.groups.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("admin.users.groups.fields.name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wilmet Sales"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.users.groups.fields.side")}</Label>
              <Select value={side} onValueChange={(v) => setSide(v as StaffScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["purchase", "sales", "both"] as StaffScope[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(SIDE_LABEL_KEYS[s])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isActive} onCheckedChange={setIsActive} />{" "}
              {t("admin.users.employees.table.active")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />{" "}
              {t("admin.users.groups.fields.isDefault")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isExternal} onCheckedChange={setIsExternal} />{" "}
              {t("admin.users.groups.fields.isExternal")}
            </label>
          </div>
          <div className="space-y-2">
            <Label>{t("admin.users.groups.fields.members")}</Label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
              {staff.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("admin.users.groups.noStaffAvailable")}
                </p>
              )}
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={memberIds.includes(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                  />
                  <span>
                    {s.first_name} {s.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.email}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("admin.common.cancel")}
          </Button>
          <Button disabled={name.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>
            {t("admin.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
