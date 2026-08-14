import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { directionKpis } from "@/lib/dashboards.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, TrendingUp, CheckCircle2, XCircle, Clock, Users, Trophy } from "lucide-react";
import { StatTileLink } from "@/components/dashboard/StatTile";
import { StageTilesLinked } from "@/components/dashboard/StageTiles";

export const Route = createFileRoute("/_authenticated/direction/")({
  component: DirectionHome,
});

function DirectionHome() {
  const fn = useServerFn(directionKpis);
  const { data, isLoading } = useQuery({ queryKey: ["direction-kpis"], queryFn: () => fn() });

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Direction de l'entreprise</h1>
        <p className="mt-1 text-sm text-muted-foreground">Indicateurs stratégiques Wilmet.</p>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTileLink loading={isLoading} label="Opportunités totales" value={data?.total ?? 0} icon={TrendingUp}
            linkProps={{ to: "/admin", search: { view: "list" } }} />
          <StatTileLink loading={isLoading} label="En traitement" value={data?.analysis ?? 0} icon={Clock} tint="analysis"
            linkProps={{ to: "/admin", search: { view: "list", status: "en_cours_analyse" } }} />
          <StatTileLink loading={isLoading} label="Achetées" value={data?.accepted ?? 0} icon={CheckCircle2} tint="accepted"
            linkProps={{ to: "/admin", search: { view: "list", status: "achetee" } }} />
          <StatTileLink loading={isLoading} label="Non abouties" value={data?.refused ?? 0} icon={XCircle} tint="refused"
            linkProps={{ to: "/admin", search: { view: "list", status: "refusee" } }} />
          <StatTileLink loading={isLoading} label="Partenaires actifs" value={data?.partenaires ?? 0} icon={Users}
            linkProps={{ to: "/admin/users" }} />
          <StatTileLink loading={isLoading} label="Demandes acheteurs" value={data?.leads ?? 0} icon={Building2}
            linkProps={{ to: "/admin/buyer-leads" }} />
          <StatTileLink loading={isLoading} label="Deals gagnés" value={data?.leadsWon ?? 0} icon={Trophy} tint="accepted"
            linkProps={{ to: "/admin/buyer-leads" }} />
        </div>

        <StageTilesLinked counts={data?.byStatus ?? {}} loading={isLoading}
          buildLink={(st) => ({ to: "/admin", search: { view: "list", status: st } })} />
      </div>
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Les graphiques d'évolution et répartitions détaillées arrivent prochainement.
        </CardContent>
      </Card>
    </div>
  );
}
