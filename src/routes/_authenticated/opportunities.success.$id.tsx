import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { getOpportunity } from "@/lib/opportunities.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Plus, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/opportunities/success/$id")({
  component: Success,
});

function Success() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const getFn = useServerFn(getOpportunity);
  const { data } = useQuery({ queryKey: ["opp", id], queryFn: () => getFn({ data: { id } }) });
  const ref = (data?.opp as { reference_number?: string } | undefined)?.reference_number;
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-status-accepted">
        <CheckCircle2 className="h-8 w-8 text-status-accepted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{t("wizard.success.title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("wizard.success.text")}</p>
      {ref && (
        <Card className="mx-auto mt-6 max-w-sm border-border/70">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("wizard.success.reference")}
            </div>
            <div className="mt-1 text-lg font-bold text-accent">{ref}</div>
          </CardContent>
        </Card>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline" size="lg">
          <Link to="/dashboard">
            <ListChecks className="mr-1.5 h-4 w-4" /> {t("wizard.success.viewMine")}
          </Link>
        </Button>
        <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/opportunities/new">
            <Plus className="mr-1.5 h-4 w-4" /> {t("wizard.success.proposeAnother")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
