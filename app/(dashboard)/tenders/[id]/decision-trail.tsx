import Link from "next/link";

import { formatReviewedAt } from "@/lib/tenders/stage-review";
import type { TrailEntry } from "@/lib/recommendation/trail";

/** The latest entry on this tender. The full list lives on the Decision trail page. */
export function DecisionTrail({ tenderId, entries }: { tenderId: string; entries: TrailEntry[] }) {
  const latest = entries[0];
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4"
      aria-label="Decision trail"
    >
      <div className="min-w-0">
        <h2 className="font-heading text-lg font-semibold">Decision trail</h2>
        <p className="text-sm text-muted-foreground">
          {latest
            ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}. Latest: ${latest.what}, ${latest.who}, ${formatReviewedAt(latest.at)}.`
            : "No reviews or decisions on this tender yet."}
        </p>
      </div>
      <Link href={`/trail?tender=${tenderId}`} className="text-sm font-medium text-brand hover:underline">
        Open the decision trail
      </Link>
    </section>
  );
}
