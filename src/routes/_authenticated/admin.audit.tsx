import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListAuditLogs } from "@/lib/admin-refdata.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin"]);
  },
  component: Page,
});

function Page() {
  const listFn = useServerFn(adminListAuditLogs);
  const { data, isLoading } = useQuery({ queryKey: ["admin-audit"], queryFn: () => listFn() });

  return (
    <div className="pb-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Journal d'audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">200 derniers événements enregistrés.</p>
      </div>

      <Card className="border-border/70">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Action</th>
                  <th className="p-2 text-left">Entité</th>
                  <th className="p-2 text-left">Acteur</th>
                  <th className="p-2 text-left">Détails</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-2"><Badge variant="secondary">{r.action}</Badge></td>
                    <td className="p-2 font-mono text-xs">{r.entity_type}{r.entity_id ? `:${r.entity_id.slice(0, 8)}` : ""}</td>
                    <td className="p-2 font-mono text-xs">{r.actor_id ? r.actor_id.slice(0, 8) : "—"}</td>
                    <td className="p-2"><pre className="max-w-md overflow-x-auto text-[11px]">{JSON.stringify(r.metadata ?? {}, null, 0)}</pre></td>
                  </tr>
                ))}
                {(data?.rows ?? []).length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Aucun événement</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
