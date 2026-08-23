import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trans, useTranslation } from "react-i18next";
import {
  staffList,
  staffCreate,
  staffUpdate,
  staffSetActive,
  staffResetPassword,
  staffDelete,
  STAFF_ROLES,
  type StaffRole,
  type StaffScope,
} from "@/lib/staff.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
import { KeyRound, Plus, Trash2, UserPen } from "lucide-react";

/** i18n keys for each staff role label — call t(ROLE_LABEL_KEYS[role]) at render time. */
// eslint-disable-next-line react-refresh/only-export-components
export const ROLE_LABEL_KEYS: Record<StaffRole, string> = {
  platform_admin: "admin.users.roles.platformAdmin",
  admin: "admin.users.roles.admin",
  company_management: "admin.users.roles.companyManagement",
  sales_manager: "admin.users.roles.salesManager",
  sales_agent: "admin.users.roles.salesAgent",
  external_agent: "admin.users.roles.externalAgent",
};

/** i18n keys for each staff scope label — call t(SCOPE_LABEL_KEYS[scope]) at render time. */
// eslint-disable-next-line react-refresh/only-export-components
export const SCOPE_LABEL_KEYS: Record<StaffScope, string> = {
  purchase: "admin.users.scopes.purchase",
  sales: "admin.users.scopes.sales",
  both: "admin.users.scopes.both",
};

type StaffRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  staff_scope: StaffScope | null;
  commission_rate: number | null;
  is_external: boolean;
  is_active: boolean;
  created_at: string;
  role: StaffRole;
  assigned_count: number;
  is_self: boolean;
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  for (const n of arr) out += chars[n % chars.length];
  return out;
}

export function EmployeeDirectory() {
  const { t } = useTranslation();
  const listFn = useServerFn(staffList);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-staff"], queryFn: () => listFn() });
  const staff = (data?.staff ?? []) as StaffRow[];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-staff"] });

  const setActiveFn = useServerFn(staffSetActive);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          <Trans i18nKey="admin.users.employees.intro" components={{ strong: <strong /> }}>
            Les employés travaillent pour Wilmet, en interne ou comme{" "}
            <strong>prestataires externes</strong> (ces derniers ne voient que leurs propres
            dossiers). Le <strong>périmètre</strong> définit ce qu&apos;un commercial voit : achat
            (leads vendeurs), vente (demandes acheteurs) ou les deux. Managers et direction voient
            tout.
          </Trans>
        </p>
        <CreateEmployeeDialog onDone={invalidate} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.users.employees.table.employee")}</TableHead>
                <TableHead>{t("admin.users.employees.fields.role")}</TableHead>
                <TableHead>{t("admin.users.employees.fields.scope")}</TableHead>
                <TableHead className="text-center">
                  {t("admin.users.employees.table.commission")}
                </TableHead>
                <TableHead className="text-center">
                  {t("admin.users.employees.table.files")}
                </TableHead>
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
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    {t("admin.users.employees.table.empty")}
                  </TableCell>
                </TableRow>
              )}
              {staff.map((s) => (
                <TableRow key={s.id} className={s.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {s.first_name} {s.last_name}
                      {s.is_self && (
                        <Badge variant="secondary" className="ml-2">
                          {t("admin.users.employees.badge.me")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline">
                        {ROLE_LABEL_KEYS[s.role] ? t(ROLE_LABEL_KEYS[s.role]) : s.role}
                      </Badge>
                      {s.is_external && (
                        <Badge variant="secondary">
                          {t("admin.users.employees.badge.external")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {isManagementRole(s.role)
                      ? t("admin.users.employees.scopeManagement")
                      : t(SCOPE_LABEL_KEYS[(s.staff_scope ?? "both") as StaffScope])}
                  </TableCell>

                  <TableCell className="text-center text-sm">
                    {isManagementRole(s.role) || s.commission_rate == null
                      ? "—"
                      : `${s.commission_rate} %`}
                  </TableCell>
                  <TableCell className="text-center text-sm">{s.assigned_count}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.is_active}
                      disabled={s.is_self || setActive.isPending}
                      onCheckedChange={(v) => setActive.mutate({ userId: s.id, active: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <EditEmployeeDialog row={s} onDone={invalidate} />
                      <ResetPasswordDialog row={s} />
                      <DeleteEmployeeDialog row={s} staff={staff} onDone={invalidate} />
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

/** Management roles always cover everything — no perimeter to choose. */
const MANAGEMENT_ROLES: StaffRole[] = [
  "platform_admin",
  "admin",
  "company_management",
  "sales_manager",
];
// eslint-disable-next-line react-refresh/only-export-components
export function isManagementRole(r: StaffRole) {
  return MANAGEMENT_ROLES.includes(r);
}

function RoleScopeFields({
  role,
  scope,
  setRole,
  setScope,
}: {
  role: StaffRole;
  scope: StaffScope;
  setRole: (r: StaffRole) => void;
  setScope: (s: StaffScope) => void;
}) {
  const { t } = useTranslation();
  const management = isManagementRole(role);
  return (
    <>
      <div className="space-y-1.5">
        <Label>{t("admin.users.employees.fields.role")}</Label>
        <Select
          value={role}
          onValueChange={(v) => {
            const next = v as StaffRole;
            setRole(next);
            if (isManagementRole(next)) setScope("both");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAFF_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(ROLE_LABEL_KEYS[r])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {management ? (
        <p className="text-xs text-muted-foreground">
          {t("admin.users.employees.managementScopeNote")}
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label>{t("admin.users.employees.fields.scope")}</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as StaffScope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["purchase", "sales", "both"] as StaffScope[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(SCOPE_LABEL_KEYS[s])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

function CreateEmployeeDialog({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("sales_agent");
  const [scope, setScope] = useState<StaffScope>("both");
  const [commissionRate, setCommissionRate] = useState("");
  const [password, setPassword] = useState(() => randomPassword());
  const createFn = useServerFn(staffCreate);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          email,
          firstName,
          lastName,
          phone: phone || null,
          role,
          scope,
          commissionRate:
            isManagementRole(role) || commissionRate === "" ? null : Number(commissionRate),
          password,
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.users.employees.toast.created"), {
        description: t("admin.users.employees.toast.createdPasswordDescription", { password }),
      });
      setOpen(false);
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setPassword(randomPassword());
      onDone();
    },
    onError: (e: unknown) =>
      toast.error(t("admin.common.failed"), { description: e instanceof Error ? e.message : "" }),
  });

  const valid = email.includes("@") && firstName.trim() && lastName.trim() && password.length >= 10;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> {t("admin.users.employees.new")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.employees.new")}</DialogTitle>
          <DialogDescription>{t("admin.users.employees.createDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("admin.users.employees.fields.firstName")}</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.users.employees.fields.lastName")}</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("admin.users.employees.fields.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.users.employees.fields.phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.users.employees.fields.tempPassword")}</Label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
                ↻
              </Button>
            </div>
          </div>
          <RoleScopeFields role={role} scope={scope} setRole={setRole} setScope={setScope} />
          {!isManagementRole(role) && (
            <>
              <div className="space-y-1.5">
                <Label>{t("admin.users.employees.fields.commissionRate")}</Label>
                <Input
                  inputMode="decimal"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder={t("admin.users.employees.fields.commissionPlaceholder")}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("admin.common.cancel")}
          </Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {t("admin.users.employees.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({ row, onDone }: { row: StaffRow; onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(row.first_name ?? "");
  const [lastName, setLastName] = useState(row.last_name ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [role, setRole] = useState<StaffRole>(row.role);
  const [scope, setScope] = useState<StaffScope>((row.staff_scope ?? "both") as StaffScope);
  const [commissionRate, setCommissionRate] = useState(
    row.commission_rate == null ? "" : String(row.commission_rate),
  );
  const updateFn = useServerFn(staffUpdate);

  const update = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          userId: row.id,
          firstName,
          lastName,
          phone: phone || null,
          role,
          scope,
          commissionRate:
            isManagementRole(role) || commissionRate === "" ? null : Number(commissionRate),
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.users.employees.toast.updated"));
      setOpen(false);
      onDone();
    },
    onError: (e: unknown) =>
      toast.error(t("admin.common.failed"), { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t("admin.common.edit")}>
          <UserPen className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.employees.editTitle", { email: row.email })}</DialogTitle>
          <DialogDescription>{t("admin.users.employees.editDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("admin.users.employees.fields.firstName")}</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.users.employees.fields.lastName")}</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("admin.users.employees.fields.phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <RoleScopeFields role={role} scope={scope} setRole={setRole} setScope={setScope} />
          {!isManagementRole(role) && (
            <>
              <div className="space-y-1.5">
                <Label>{t("admin.users.employees.fields.commissionRate")}</Label>
                <Input
                  inputMode="decimal"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder={t("admin.users.employees.fields.commissionPlaceholder")}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("admin.common.cancel")}
          </Button>
          <Button disabled={update.isPending} onClick={() => update.mutate()}>
            {t("admin.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ row }: { row: StaffRow }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(() => randomPassword());
  const fn = useServerFn(staffResetPassword);
  const reset = useMutation({
    mutationFn: () => fn({ data: { userId: row.id, password } }),
    onSuccess: () => {
      toast.success(t("admin.users.employees.toast.passwordReset"), { description: password });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(t("admin.common.failed"), { description: e instanceof Error ? e.message : "" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t("admin.users.employees.resetPassword")}>
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.employees.resetPassword")}</DialogTitle>
          <DialogDescription>
            {t("admin.users.employees.resetPasswordDescription", { email: row.email })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
            ↻
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("admin.common.cancel")}
          </Button>
          <Button disabled={password.length < 10 || reset.isPending} onClick={() => reset.mutate()}>
            {t("admin.users.employees.resetPasswordConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEmployeeDialog({
  row,
  staff,
  onDone,
}: {
  row: StaffRow;
  staff: StaffRow[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [transferTo, setTransferTo] = useState<string>("");
  const fn = useServerFn(staffDelete);
  const others = useMemo(
    () =>
      staff.filter(
        (s) =>
          s.id !== row.id &&
          s.is_active &&
          (s.role === "sales_agent" || s.role === "external_agent" || s.role === "sales_manager"),
      ),
    [staff, row.id],
  );
  const del = useMutation({
    mutationFn: () => fn({ data: { userId: row.id, transferToId: transferTo || null } }),
    onSuccess: () => {
      toast.success(t("admin.users.employees.toast.deleted"));
      setOpen(false);
      onDone();
    },
    onError: (e: unknown) =>
      toast.error(t("admin.common.failed"), { description: e instanceof Error ? e.message : "" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t("admin.common.delete")} disabled={row.is_self}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("admin.users.employees.deleteTitle", { name: `${row.first_name} ${row.last_name}` })}
          </DialogTitle>
          <DialogDescription>
            {row.assigned_count > 0
              ? t("admin.users.employees.deleteWithAssigned", { count: row.assigned_count })
              : t("admin.users.employees.deleteNoAssigned")}
          </DialogDescription>
        </DialogHeader>
        {row.assigned_count > 0 && (
          <div className="space-y-1.5">
            <Label>{t("admin.users.employees.transferLabel")}</Label>
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.users.employees.transferPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {others.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.first_name} {o.last_name} — {t(ROLE_LABEL_KEYS[o.role])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("admin.common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={del.isPending || (row.assigned_count > 0 && !transferTo)}
            onClick={() => del.mutate()}
          >
            {t("admin.common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
