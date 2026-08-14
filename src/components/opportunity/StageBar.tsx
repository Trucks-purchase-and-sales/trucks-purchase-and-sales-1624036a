import { Check, X } from "lucide-react";
import { PIPELINE_STAGES, STATUS_LABEL, TERMINAL_STATUSES, type OpportunityStatus } from "@/lib/wilmet-constants";
import { cn } from "@/lib/utils";

interface StageBarProps {
  status: OpportunityStatus;
  onSelect?: (stage: OpportunityStatus) => void;
  disabled?: boolean;
}

/** Salesforce-style chevron stage bar for the opportunity lifecycle. */
export function StageBar({ status, onSelect, disabled }: StageBarProps) {
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const isLost = status === "refusee";
  const isWon = status === "livree";

  // For terminal states, we still show the pipeline greyed with the final chip appended.
  const currentIdx = PIPELINE_STAGES.indexOf(status);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-max items-stretch gap-0.5">
        {PIPELINE_STAGES.map((s, i) => {
          const isCurrent = i === currentIdx && !isTerminal;
          const isPast = (currentIdx > -1 && i < currentIdx) || (isTerminal && !isLost);
          const clickable = !!onSelect && !disabled;

          return (
            <button
              key={s}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect?.(s)}
              className={cn(
                "relative flex h-10 items-center px-4 pl-6 text-xs font-medium transition-colors",
                "first:pl-3 last:pr-6",
                "clip-chevron",
                clickable && "cursor-pointer hover:brightness-110",
                isCurrent && "bg-accent text-accent-foreground",
                isPast && "bg-status-accepted text-status-accepted-foreground",
                !isCurrent && !isPast && "bg-secondary text-muted-foreground",
              )}
              style={{
                clipPath: i === 0
                  ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                  : i === PIPELINE_STAGES.length - 1
                  ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)"
                  : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
              }}
            >
              {isPast && <Check className="mr-1 h-3 w-3" />}
              <span>{STATUS_LABEL[s]}</span>
            </button>
          );
        })}
        {isTerminal && (
          <div className={cn(
            "ml-2 flex h-10 items-center gap-1.5 rounded-md px-4 text-xs font-semibold",
            isWon && "bg-status-accepted text-status-accepted-foreground",
            isLost && "bg-status-refused text-status-refused-foreground",
            !isWon && !isLost && "bg-status-archived text-status-archived-foreground",
          )}>
            {isWon ? <Check className="h-3.5 w-3.5" /> : isLost ? <X className="h-3.5 w-3.5" /> : null}
            {STATUS_LABEL[status]}
          </div>
        )}
      </div>
    </div>
  );
}
