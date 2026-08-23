import { useTranslation } from "react-i18next";
import { STATUS_LABEL, FUNNEL_STAGES, type OpportunityStatus } from "@/lib/wilmet-constants";
import { StatTileButton, StatTileLink, type TileTint } from "./StatTile";
import type { LinkComponentProps } from "@tanstack/react-router";

const TINT: Partial<Record<OpportunityStatus, TileTint>> = {
  brouillon: "neutral",
  envoyee: "info",
  en_cours_analyse: "analysis",
  offre_envoyee: "info",
  en_negociation: "info",
  achetee: "accepted",
  livree: "accepted",
  refusee: "refused",
  archivee: "neutral",
};

type Common = {
  counts: Partial<Record<string, number>>;
  /** Hide stages with a zero count (used on the partner space). */
  hideEmpty?: boolean;
  loading?: boolean;
  title?: string;
  /** Which stages to render. Defaults to the full funnel. */
  stages?: OpportunityStatus[];
};

function stages(counts: Common["counts"], hideEmpty?: boolean, list?: OpportunityStatus[]) {
  return (list ?? FUNNEL_STAGES).filter(
    (s: OpportunityStatus) => !hideEmpty || (counts[s] ?? 0) > 0,
  );
}

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title ?? t("dashboard.stageTiles.defaultTitle")}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">{children}</div>
    </div>
  );
}

/** Stage tiles that filter the list on the same page. */
export function StageTiles({
  counts,
  activeStatus,
  onSelect,
  hideEmpty,
  loading,
  title,
  stages: stageList,
}: Common & { activeStatus?: string | null; onSelect: (status: OpportunityStatus) => void }) {
  const list = stages(counts, hideEmpty, stageList);
  if (list.length === 0) return null;
  return (
    <Shell title={title}>
      {list.map((s: OpportunityStatus) => (
        <StatTileButton
          key={s}
          compact
          loading={loading}
          label={STATUS_LABEL[s]}
          value={counts[s] ?? 0}
          tint={TINT[s] ?? "neutral"}
          active={activeStatus === s}
          onClick={() => onSelect(s)}
        />
      ))}
    </Shell>
  );
}

/** Stage tiles that link to another page, pre-filtered by status. */
export function StageTilesLinked({
  counts,
  buildLink,
  hideEmpty,
  loading,
  title,
  stages: stageList,
}: Common & { buildLink: (status: OpportunityStatus) => LinkComponentProps }) {
  const list = stages(counts, hideEmpty, stageList);
  if (list.length === 0) return null;
  return (
    <Shell title={title}>
      {list.map((s: OpportunityStatus) => (
        <StatTileLink
          key={s}
          compact
          loading={loading}
          label={STATUS_LABEL[s]}
          value={counts[s] ?? 0}
          tint={TINT[s] ?? "neutral"}
          linkProps={buildLink(s)}
        />
      ))}
    </Shell>
  );
}
