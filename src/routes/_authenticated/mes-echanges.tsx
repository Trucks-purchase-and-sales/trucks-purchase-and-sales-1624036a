import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listMyInfoRequests } from "@/lib/opportunities.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";
import { formatDateTime } from "@/lib/wilmet-constants";

export const Route = createFileRoute("/_authenticated/mes-echanges")({ component: Page });

function Page() {
  const { t } = useTranslation();
  const listFn = useServerFn(listMyInfoRequests);
  const { data, isLoading } = useQuery({ queryKey: ["my-info-reqs"], queryFn: () => listFn() });
  const rows = data?.rows ?? [];
  const open = rows.filter((r: any) => r.status === "open"); // eslint-disable-line @typescript-eslint/no-explicit-any
  const closed = rows.filter((r: any) => r.status !== "open"); // eslint-disable-line @typescript-eslint/no-explicit-any

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("mesEchanges.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("mesEchanges.subtitle")}</p>
      </div>

      <Section
        title={t("mesEchanges.open")}
        items={open}
        empty={t("mesEchanges.emptyOpen")}
        isLoading={isLoading}
      />
      <Section
        title={t("mesEchanges.history")}
        items={closed}
        empty={t("mesEchanges.emptyHistory")}
        isLoading={false}
      />
    </div>
  );
}

function Section({
  title,
  items,
  empty,
  isLoading,
}: {
  title: string;
  items: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  empty: string;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="h-4 w-4 text-accent" /> {title}{" "}
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-card border border-border" />
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <Link key={r.id} to="/opportunities/$id" params={{ id: r.vehicle_opportunity_id }}>
              <Card className="border-border/70 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {r.opportunity?.reference_number ?? "—"} · {r.opportunity?.brand ?? ""}{" "}
                      {r.opportunity?.model ?? ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>
                  {r.response && (
                    <div className="mt-2 rounded-md border border-accent/30 bg-accent/5 p-2 text-sm">
                      <div className="text-[10px] uppercase tracking-widest text-accent">
                        {t("mesEchanges.yourResponse")}
                      </div>
                      <div className="whitespace-pre-wrap">{r.response}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
