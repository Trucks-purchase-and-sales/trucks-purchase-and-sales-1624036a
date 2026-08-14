import { STATUS_LABEL, STATUS_STYLE, type OpportunityStatus } from "@/lib/wilmet-constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: OpportunityStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
