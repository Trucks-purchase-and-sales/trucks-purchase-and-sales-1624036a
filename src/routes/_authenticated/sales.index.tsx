import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { salesAgentKpis } from "@/lib/dashboards.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, ClipboardList, CheckCircle2, XCircle, Users, Inbox, Sparkles, ArrowRight } from "lucide-react";
import { StatTileLink } from "@/components/dashboard/StatTile";
import { StageTilesLinked } from "@/components/dashboard/StageTiles";

export const Route = createFileRoute("/_authenticated/sales/")({
  component: SalesHome,
});

function SalesHome() {
  const fn = useServerFn(salesAgentKpis);
  const { userId } = Route.useRouteContext() as { userId: string };
  const { data, isLoading } = useQuery({ queryKey: ["sales-kpis"], queryFn: () => fn() });

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Espace commercial</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vue synthétique de votre portefeuille.</p>
      </div>


      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTileLink loading={isLoading} label="Opportunités assignées" value={data?.assigned ?? 0} icon={Briefcase}
            linkProps={{ to: "/admin", search: { view: "list" } }} />
          <StatTileLink loading={isLoading} label="En traitement" value={data?.analysis ?? 0} icon={ClipboardList} tint="analysis"
            linkProps={{ to: "/admin", search: { view: "list", status: "en_cours_analyse" } }} />
          <StatTileLink loading={isLoading} label="Achetées" value={data?.accepted ?? 0} icon={CheckCircle2} tint="accepted"
            linkProps={{ to: "/admin", search: { view: "list", status: "achetee" } }} />
          <StatTileLink loading={isLoading} label="Non abouties" value={data?.refused ?? 0} icon={XCircle} tint="refused"
            linkProps={{ to: "/admin", search: { view: "list", status: "refusee" } }} />
          <StatTileLink loading={isLoading} label="Demandes acheteurs" value={data?.leads ?? 0} icon={Users}
            linkProps={{ to: "/admin/leads" }} />
        </div>

        <StageTilesLinked
          counts={data?.byStatus ?? {}}
          loading={isLoading}
          buildLink={(st) => ({ to: "/admin", search: { view: "list", status: st } })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickAction
          to="/admin/leads"
          icon={Inbox}
          title="Inbox des leads"
          description="Prenez en charge les demandes acheteurs entrantes."
        />
        <QuickAction
          to="/admin"
          icon={Briefcase}
          title="Pipeline opportunités"
          description="Suivez vos opportunités en cours, par étape."
        />
        <QuickAction
          to="/admin/matching"
          icon={Sparkles}
          title="Matching IA"
          description="Alignez automatiquement demandes et offres."
        />
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="group">
      <Card className="h-full border-border/70 transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary">
              <Icon className="h-4 w-4" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
