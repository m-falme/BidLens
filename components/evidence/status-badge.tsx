import { Badge } from "@/components/ui/badge";
import type { FieldStatus } from "@/lib/db/vocab";
import { cn } from "@/lib/utils";

/** AGENTS.md §5 status colours: confirmed green, AI-inferred amber, blank grey, needs human red. */
export const STATUS_META: Record<FieldStatus, { label: string; className: string; dot: string }> = {
  source_confirmed: {
    label: "Confirmed",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    dot: "bg-green-600",
  },
  ai_inferred: {
    label: "AI-inferred",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  blank_in_source: {
    label: "Blank in source",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    dot: "bg-zinc-500",
  },
  needs_human: {
    label: "Needs human",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-600",
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
