import { formatReviewedAt } from "@/lib/tenders/stage-review";
import type { TrailEntry } from "@/lib/recommendation/trail";

export function DecisionTrail({ entries }: { entries: TrailEntry[] }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Decision trail">
      <h2 className="text-2xl font-semibold tracking-tight">Decision trail</h2>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">No reviews or decisions yet.</p>
      ) : (
        <ol className="flex flex-col gap-4 border-l border-primary/30 pl-4">
          {entries.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="flex flex-col gap-1">
              <p className="font-medium">{entry.what}</p>
              <p className="text-muted-foreground">
                {entry.who} · {formatReviewedAt(entry.at)}
              </p>
              {entry.note && <p>{entry.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
