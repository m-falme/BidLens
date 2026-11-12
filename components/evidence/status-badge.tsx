import { Badge } from "@/components/ui/badge";
import type { FieldStatus } from "@/lib/db/vocab";
import { cn } from "@/lib/utils";

/** Confirmed green, AI-inferred amber, blank blue-grey, needs human red. */
export const STATUS_META: Record<FieldStatus, { label: string; className: string; dot: string }> = {
  source_confirmed: {
    label: "Confirmed",
    className: "bg-confirmed/10 text-confirmed",
    dot: "bg-confirmed",
  },
  ai_inferred: {
    label: "AI-inferred",
    className: "bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  blank_in_source: {
    label: "Blank in source",
    className: "bg-blank/15 text-blank",
    dot: "bg-blank",
  },
  needs_human: {
    label: "Needs human",
    className: "bg-blocker/12 text-blocker",
    dot: "bg-blocker",
  },
};

export function StatusBadge({ status, className }: { status: FieldStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge className={cn("h-6 px-2.5 text-[13px]", meta.className, className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}

/** Small "p.134 · Blank in source" chip; clicking it opens the quote. */
export function EvidenceChip({
  status,
  page,
  onClick,
}: {
  status: FieldStatus;
  page: number | null;
  onClick: () => void;
}) {
  const meta = STATUS_META[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        meta.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {page ? `p.${page}` : "no page"} · {meta.label}
    </button>
  );
}
