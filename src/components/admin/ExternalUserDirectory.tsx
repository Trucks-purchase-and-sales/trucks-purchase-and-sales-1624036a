import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListExternalUsers, userDelete, userSetActive, type ExternalUserKind } from "@/lib/users-admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
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

const COPY: Record<ExternalUserKind, { intro: string; empty: string; countLabel: string }> = {
  client: {
    intro: "Les clients sont des comptes externes acheteurs : ils ne voient que leurs propres demandes.",
    empty: "Aucun client.",
    countLabel: "demandes",
  },
  seller: {
    intro:
      "Les partenaires vendeurs sont des comptes externes apporteurs d'affaire : ils ne voient que leurs propres véhicules.",
    empty: "Aucun partenaire vendeur.",
    countLabel: "véhicules",
  },
};

export function ExternalUserDirectory({ kind }: { kind: ExternalUserKind }) {
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
    onSuccess: (_r, v) => { toast.success(v.active ? "Compte réactivé" : "Compte désactivé"); invalidate(); },
    onError: (e: unknown) => toast.error("Échec", { description: e instanceof Error ? e.message : "" }),
  });

  const copy = COPY[kind];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{copy.intro}</p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full max-w-xs"
        />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Chargement…</div>}
      {!isLoading && filtered.length === 0 && <div className="text-sm text-muted-foreground">{copy.empty}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id} className={p.is_active ? "border-border/70" : "border-border/70 opacity-60"}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{p.first_name} {p.last_name}</div>
                  <div className="text-xs text-muted-foreground">{p.company_name || "—"}</div>
                </div>
                {kind === "seller" ? (
                  <Badge className="bg-accent text-accent-foreground">Vendeur</Badge>
                ) : (
                  <Badge variant="outline">Client</Badge>
                )}
              </div>
              <div className="text-xs break-all">{p.email}</div>
              <div className="text-xs text-muted-foreground">{p.phone ?? "—"} · {p.city ?? "—"}</div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Inscrit {formatDate(p.created_at)}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
                  {counts[p.id] ?? 0} {copy.countLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={p.is_active}
                    disabled={setActive.isPending}
                    onCheckedChange={(v) => setActive.mutate({ userId: p.id, active: v })}
                  />
                  Actif
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
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const fn = useServerFn(userDelete);
  const del = useMutation({
    mutationFn: () => fn({ data: { userId: row.id } }),
    onSuccess: () => { toast.success("Compte supprimé"); setOpen(false); onDone(); },
    onError: (e: unknown) => toast.error("Suppression impossible", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirm(""); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Supprimer">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer {row.first_name} {row.last_name} ?</DialogTitle>
          <DialogDescription>
            Action définitive et réservée aux administrateurs. La suppression est refusée si le compte est rattaché à des
            dossiers : désactivez-le dans ce cas. Saisissez l&apos;e-mail du compte pour confirmer.
          </DialogDescription>
        </DialogHeader>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={row.email ?? ""} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={del.isPending || confirm.trim().toLowerCase() !== String(row.email ?? "").toLowerCase()}
            onClick={() => del.mutate()}
          >
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
