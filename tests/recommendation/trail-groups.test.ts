import { describe, expect, it } from "vitest";

import { decisionTrail } from "@/lib/recommendation/trail";
import { groupTrailByTender, type GroupableTrailEntry } from "@/lib/recommendation/trail-groups";

function entry(
  tenderId: string,
  at: string,
  kind: GroupableTrailEntry["kind"],
  finalLabel?: GroupableTrailEntry["finalLabel"],
): GroupableTrailEntry {
  return { tenderId, tenderTitle: `Tender ${tenderId}`, at, kind, finalLabel };
}

describe("groupTrailByTender", () => {
  const entries = [
    entry("a", "2026-11-10T08:00:00Z", "review"),
    entry("b", "2026-11-12T08:00:00Z", "approve", "proceed_to_preparation"),
    entry("a", "2026-11-13T08:00:00Z", "approve", "resolve_blockers"),
    entry("a", "2026-11-11T08:00:00Z", "override", "consider_declining"),
    entry("c", "2026-11-09T08:00:00Z", "review"),
  ];
  const groups = groupTrailByTender(entries);

  it("makes one group per tender, most recent activity first", () => {
    expect(groups.map((group) => group.tenderId)).toEqual(["a", "b", "c"]);
    expect(groups.map((group) => group.entries.length)).toEqual([3, 1, 1]);
    expect(groups[0].lastAt).toBe("2026-11-13T08:00:00Z");
  });

  it("lists each tender's entries newest first", () => {
    expect(groups[0].entries.map((item) => item.at)).toEqual([
      "2026-11-13T08:00:00Z",
      "2026-11-11T08:00:00Z",
      "2026-11-10T08:00:00Z",
    ]);
  });

  it("takes the latest decision from the newest approve or override, not from a review", () => {
    expect(groups[0].latestDecision).toEqual({
      label: "resolve_blockers",
      action: "approve",
      at: "2026-11-13T08:00:00Z",
    });
    expect(groups[1].latestDecision?.label).toBe("proceed_to_preparation");
  });

  it("has no decision for a tender with only stage reviews", () => {
    expect(groups[2].latestDecision).toBeNull();
  });

  it("returns nothing for no entries and does not change its input", () => {
    expect(groupTrailByTender([])).toEqual([]);
    expect(entries[0].tenderId).toBe("a");
    expect(entries).toHaveLength(5);
  });

  it("works with the real trail: the decision entry carries the recorded label", () => {
    const trail = decisionTrail(
      [{ stage: "can_bid", reviewerName: "James", note: null, createdAt: "2026-11-12T09:00:00.000Z" }],
      [
        {
          recommendedLabel: "proceed_to_preparation",
          finalLabel: "consider_declining",
          action: "override",
          reason: "The bond cannot be raised.",
          reviewerName: "Amina",
          createdAt: "2026-11-12T10:00:00.000Z",
        },
      ],
    );
    const [group] = groupTrailByTender(trail.map((item) => ({ ...item, tenderId: "t", tenderTitle: "T" })));
    expect(group.latestDecision).toMatchObject({ label: "consider_declining", action: "override" });
    expect(group.entries).toHaveLength(2);
  });
});
