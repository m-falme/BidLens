import type { RecommendationLabel } from "./labels";

/** What the Decision trail needs from an entry to group it. */
export interface GroupableTrailEntry {
  tenderId: string;
  tenderTitle: string;
  at: string;
  kind: "review" | "approve" | "override";
  finalLabel?: RecommendationLabel;
}

export interface TrailGroup<T extends GroupableTrailEntry> {
  tenderId: string;
  tenderTitle: string;
  /** Newest first. */
  entries: T[];
  /** The label of the newest approve or override. Null when no decision has been recorded yet. */
  latestDecision: { label: RecommendationLabel; action: "approve" | "override"; at: string } | null;
  /** The newest entry of any kind. */
  lastAt: string;
}

function newestFirst(a: { at: string }, b: { at: string }): number {
  return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
}

/**
 * One group per tender, the tender with the most recent activity first, each group's entries newest first.
 * Pass the entries that survived the search and filters, so the counts match what is on screen.
 */
export function groupTrailByTender<T extends GroupableTrailEntry>(entries: readonly T[]): TrailGroup<T>[] {
  const byTender = new Map<string, T[]>();
  for (const entry of entries) {
    const list = byTender.get(entry.tenderId) ?? [];
    list.push(entry);
    byTender.set(entry.tenderId, list);
  }
  const groups = [...byTender.values()].map((list): TrailGroup<T> => {
    const sorted = [...list].sort(newestFirst);
    const decision = sorted.find((entry) => entry.kind !== "review" && entry.finalLabel);
    return {
      tenderId: sorted[0].tenderId,
      tenderTitle: sorted[0].tenderTitle,
      entries: sorted,
      latestDecision:
        decision && decision.finalLabel && decision.kind !== "review"
          ? { label: decision.finalLabel, action: decision.kind, at: decision.at }
          : null,
      lastAt: sorted[0].at,
    };
  });
  return groups.sort((a, b) => newestFirst({ at: a.lastAt }, { at: b.lastAt }));
}
