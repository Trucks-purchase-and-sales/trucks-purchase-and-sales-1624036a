import { Link } from "@tanstack/react-router";
import type { LinkComponentProps } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TileTint = "neutral" | "analysis" | "accepted" | "refused" | "info" | "archived";

const TINT_CLASS: Record<TileTint, string> = {
  neutral: "bg-primary text-primary-foreground",
  analysis: "bg-status-analysis text-status-analysis-foreground",
  accepted: "bg-status-accepted text-status-accepted-foreground",
  refused: "bg-status-refused text-status-refused-foreground",
  info: "bg-status-info text-status-info-foreground",
  archived: "bg-status-archived text-status-archived-foreground",
};

type Body = {
  label: string;
  value: number | string;
  tint?: TileTint;
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  active?: boolean;
  compact?: boolean;
};

function TileBody({ label, value, tint = "neutral", icon: Icon, loading, compact }: Body) {
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-lg",
          compact ? "h-2.5 w-2.5 rounded-full" : "h-10 w-10",
          TINT_CLASS[tint],
        )}
      >
        {!compact && Icon ? <Icon className="h-5 w-5" /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn("block font-bold leading-none", compact ? "text-lg" : "text-2xl")}>
          {loading ? "…" : value}
        </span>
        <span className={cn("mt-1 block text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
          {label}
        </span>
      </span>
    </div>
  );
}

const SHELL = "border-border/70 transition-colors";
const ACTIVE = "border-accent ring-2 ring-accent/40 bg-accent/5";

/** Static KPI tile. */
export function StatTile(props: Body) {
  return (
    <Card className={cn(SHELL, props.active && ACTIVE)}>
      <CardContent className={props.compact ? "p-3" : "p-4"}>
        <TileBody {...props} />
      </CardContent>
    </Card>
  );
}

/** KPI tile that toggles a filter on the current page. */
export function StatTileButton({ onClick, ...body }: Body & { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!body.active}
      className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className={cn(SHELL, "h-full hover:border-accent/60 hover:shadow-sm", body.active && ACTIVE)}>
        <CardContent className={body.compact ? "p-3" : "p-4"}>
          <TileBody {...body} />
        </CardContent>
      </Card>
    </button>
  );
}

/** KPI tile that navigates to another page, optionally pre-filtered. */
export function StatTileLink({ linkProps, ...body }: Body & { linkProps: LinkComponentProps }) {
  return (
    <Link {...linkProps} className="rounded-xl">
      <Card className={cn(SHELL, "h-full hover:border-accent/60 hover:shadow-sm")}>
        <CardContent className={body.compact ? "p-3" : "p-4"}>
          <TileBody {...body} />
        </CardContent>
      </Card>
    </Link>
  );
}
