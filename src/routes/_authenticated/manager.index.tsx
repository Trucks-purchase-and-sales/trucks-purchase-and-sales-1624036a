import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { managerKpis } from "@/lib/dashboards.functions";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Clock, CheckCircle2, XCircle, UserMinus, Users } from "lucide-react";
import { StatTileLink } from "@/components/dashboard/StatTile";
import { StageTilesLinked } from "@/components/dashboard/StageTiles";

export const Route = createFileRoute("/_authenticated/manager/")({
  component: ManagerHome,
});

function ManagerHome() {
  const fn = useServerFn(managerKpis);
  const { data, isLoading } = useQuery({ queryKey: ["manager-kpis"], queryFn: () => fn() });

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Direction commerciale</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pilotage global du portefeuille et de l'équipe.</p>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatTileLink loading={isLoading} label="Opportunités actives" value={data?.total ?? 0} icon={TrendingUp}
            linkProps={{ to: "/admin", search: { view: "list" } }} />
          <StatTileLink loading={isLoading} label="En traitement" value={data?.analysis ?? 0} icon={Clock} tint="analysis"
            linkProps={{ to: "/admin", search: { view: "list", status: "en_cours_analyse" } }} />
          <StatTileLink loading={isLoading} label="Achetées" value={data?.accepted ?? 0} icon={CheckCircle2} tint="accepted"
            linkProps={{ to: "/admin", search: { view: "list", status: "achetee" } }} />
          <StatTileLink loading={isLoading} label="Non abouties" value={data?.refused ?? 0} icon={XCircle} tint="refused"
            linkProps={{ to: "/admin", search: { view: "list", status: "refusee" } }} />
          <StatTileLink loading={isLoading} label="Non assignées" value={data?.unassigned ?? 0} icon={UserMinus}
            linkProps={{ to: "/admin", search: { view: "list" } }} />
          <StatTileLink loading={isLoading} label="Demandes acheteurs" value={data?.leads ?? 0} icon={Users}
            linkProps={{ to: "/admin/leads" }} />
        </div>

        <StageTilesLinked counts={data?.byStatus ?? {}} loading={isLoading}
          buildLink={(st) => ({ to: "/admin", search: { view: "list", status: st } })} />
      </div>
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Le pipeline détaillé et la charge par commercial seront disponibles prochainement.
        </CardContent>
      </Card>
    </div>
  );
}
