import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffList, staffCreate, staffUpdate, staffSetActive, staffResetPassword, staffDelete,
  STAFF_ROLES, type StaffRole, type StaffScope,
} from "@/lib/staff.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2, UserPen } from "lucide-react";

export const ROLE_LABELS: Record<StaffRole, string> = {
  platform_admin: "Administrateur plateforme",
  admin: "Administrateur",
  company_management: "Direction",
  sales_manager: "Manager commercial",
  sales_agent: "Commercial",
  external_agent: "Commercial externe",
};

export const SCOPE_LABELS: Record<StaffScope, string> = {
  purchase: "Achat (vendeurs)",
  sales: "Vente (acheteurs)",
  both: "Les deux",
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
  const listFn = useServerFn(staffList);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-staff"], queryFn: () => listFn() });
  const staff = (data?.staff ?? []) as StaffRow[];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-staff"] });

  const setActiveFn = useServerFn(staffSetActive);
  const setActive = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setActiveFn({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.active ? "Compte réactivé" : "Compte désactivé"); invalidate(); },
    onError: (e: unknown) => toast.error("Échec", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Les employés travaillent pour Wilmet, en interne ou comme <strong>prestataires externes</strong> (ces derniers ne
          voient que leurs propres dossiers). Le <strong>périmètre</strong> définit ce qu&apos;un commercial voit : achat
          (leads vendeurs), vente (demandes acheteurs) ou les deux. Managers et direction voient tout.
        </p>
        <CreateEmployeeDialog onDone={invalidate} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Périmètre</TableHead>
                <TableHead className="text-center">Commission</TableHead>
                <TableHead className="text-center">Dossiers</TableHead>
                <TableHead className="text-center">Actif</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Chargement…</TableCell></TableRow>
              )}
              {!isLoading && staff.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Aucun employé.</TableCell></TableRow>
              )}
              {staff.map((s) => (
                <TableRow key={s.id} className={s.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {s.first_name} {s.last_name}
                      {s.is_self && <Badge variant="secondary" className="ml-2">moi</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline">{ROLE_LABELS[s.role] ?? s.role}</Badge>
                      {s.is_external && <Badge variant="secondary">Externe</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {isManagementRole(s.role) ? "Tout (encadrement)" : SCOPE_LABELS[(s.staff_scope ?? "both") as StaffScope]}
                  </TableCell>

                  <TableCell className="text-center text-sm">
                    {isManagementRole(s.role) || s.commission_rate == null ? "—" : `${s.commission_rate} %`}
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
const MANAGEMENT_ROLES: StaffRole[] = ["platform_admin", "admin", "company_management", "sales_manager"];
export function isManagementRole(r: StaffRole) {
  return MANAGEMENT_ROLES.includes(r);
}

function RoleScopeFields({
  role, scope, setRole, setScope,
}: { role: StaffRole; scope: StaffScope; setRole: (r: StaffRole) => void; setScope: (s: StaffScope) => void }) {
  const management = isManagementRole(role);
  return (
    <>
      <div className="space-y-1.5">
        <Label>Rôle</Label>
        <Select
          value={role}
          onValueChange={(v) => {
            const next = v as StaffRole;
            setRole(next);
            if (isManagementRole(next)) setScope("both");
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STAFF_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {management ? (
        <p className="text-xs text-muted-foreground">
          Ce rôle d'encadrement voit automatiquement tout (achat et vente) : aucun périmètre à définir.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label>Périmètre</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as StaffScope)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["purchase", "sales", "both"] as StaffScope[]).map((s) => (
                <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}


function CreateEmployeeDialog({ onDone }: { onDone: () => void }) {
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
    mutationFn: () => createFn({ data: { email, firstName, lastName, phone: phone || null, role, scope, commissionRate: isManagementRole(role) || commissionRate === "" ? null : Number(commissionRate), password } }),
    onSuccess: () => {
      toast.success("Employé créé", { description: `Mot de passe temporaire : ${password}` });
      setOpen(false);
      setEmail(""); setFirstName(""); setLastName(""); setPhone(""); setPassword(randomPassword());
      onDone();
    },
    onError: (e: unknown) => toast.error("Échec", { description: e instanceof Error ? e.message : "" }),
  });

  const valid = email.includes("@") && firstName.trim() && lastName.trim() && password.length >= 10;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Nouvel employé</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel employé</DialogTitle>
          <DialogDescription>Le compte est créé actif, avec un mot de passe temporaire à communiquer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Mot de passe temporaire</Label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>↻</Button>
            </div>
          </div>
          <RoleScopeFields role={role} scope={scope} setRole={setRole} setScope={setScope} />
          {!isManagementRole(role) && (
            <>
              <div className="space-y-1.5">
                <Label>Taux de commission (%)</Label>
                <Input inputMode="decimal" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="ex. 2,5" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({ row, onDone }: { row: StaffRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(row.first_name ?? "");
  const [lastName, setLastName] = useState(row.last_name ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [role, setRole] = useState<StaffRole>(row.role);
  const [scope, setScope] = useState<StaffScope>((row.staff_scope ?? "both") as StaffScope);
  const [commissionRate, setCommissionRate] = useState(row.commission_rate == null ? "" : String(row.commission_rate));
  const updateFn = useServerFn(staffUpdate);

  const update = useMutation({
    mutationFn: () => updateFn({ data: { userId: row.id, firstName, lastName, phone: phone || null, role, scope, commissionRate: isManagementRole(role) || commissionRate === "" ? null : Number(commissionRate) } }),
    onSuccess: () => { toast.success("Employé mis à jour"); setOpen(false); onDone(); },
    onError: (e: unknown) => toast.error("Échec", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Modifier"><UserPen className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Modifier {row.email}</DialogTitle><DialogDescription>Mettez à jour le rôle, le périmètre et le statut de cet employé.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <RoleScopeFields role={role} scope={scope} setRole={setRole} setScope={setScope} />
          {!isManagementRole(role) && (
            <>
              <div className="space-y-1.5">
                <Label>Taux de commission (%)</Label>
                <Input inputMode="decimal" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="ex. 2,5" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button disabled={update.isPending} onClick={() => update.mutate()}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ row }: { row: StaffRow }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(() => randomPassword());
  const fn = useServerFn(staffResetPassword);
  const reset = useMutation({
    mutationFn: () => fn({ data: { userId: row.id, password } }),
    onSuccess: () => { toast.success("Mot de passe réinitialisé", { description: password }); setOpen(false); },
    onError: (e: unknown) => toast.error("Échec", { description: e instanceof Error ? e.message : "" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Réinitialiser le mot de passe"><KeyRound className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>{row.email} — communiquez le nouveau mot de passe à l&apos;employé.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>↻</Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button disabled={password.length < 10 || reset.isPending} onClick={() => reset.mutate()}>Réinitialiser</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEmployeeDialog({ row, staff, onDone }: { row: StaffRow; staff: StaffRow[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [transferTo, setTransferTo] = useState<string>("");
  const fn = useServerFn(staffDelete);
  const others = useMemo(
    () => staff.filter((s) => s.id !== row.id && s.is_active && (s.role === "sales_agent" || s.role === "external_agent" || s.role === "sales_manager")),
    [staff, row.id],
  );
  const del = useMutation({
    mutationFn: () => fn({ data: { userId: row.id, transferToId: transferTo || null } }),
    onSuccess: () => { toast.success("Employé supprimé"); setOpen(false); onDone(); },
    onError: (e: unknown) => toast.error("Échec", { description: e instanceof Error ? e.message : "" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Supprimer" disabled={row.is_self}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer {row.first_name} {row.last_name} ?</DialogTitle>
          <DialogDescription>
            Action définitive. {row.assigned_count > 0
              ? `Cet employé a ${row.assigned_count} dossier(s) assigné(s) : choisissez un destinataire pour le transfert.`
              : "Préférez la désactivation si l'employé peut revenir."}
          </DialogDescription>
        </DialogHeader>
        {row.assigned_count > 0 && (
          <div className="space-y-1.5">
            <Label>Transférer les dossiers à</Label>
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger><SelectValue placeholder="Choisir un employé" /></SelectTrigger>
              <SelectContent>
                {others.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.first_name} {o.last_name} — {ROLE_LABELS[o.role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={del.isPending || (row.assigned_count > 0 && !transferTo)}
            onClick={() => del.mutate()}
          >
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
