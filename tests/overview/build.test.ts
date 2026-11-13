import { describe, expect, it } from "vitest";

import { shellCrumb } from "@/components/app-shell/nav";
import {
  activeReviewNote,
  activeTenderStats,
  awaitingDecisionNote,
  evidenceCounts,
  evidenceNote,
  nextActions,
  profileInitials,
  rowPill,
  teamActivity,
  upcomingDeadline,
  type OverviewTender,
} from "@/lib/overview/build";

const AS_OF = new Date("2026-11-13T12:00:00+03:00");

function tender(overrides: Partial<OverviewTender> = {}): OverviewTender {
  return {
    id: "tender-1",
    title: "SUPPLY OF NETWORK EQUIPMENT",
    buyer: "Nairobi City County",
    reference: "NCC/1",
    closing: "24 November 2026",
    deadlineAt: "2026-11-24T08:00:00+03:00",
    needsHuman: 0,
    missingMandatory: 0,
    addendumConflicts: 0,
    finalLabel: null,
    reviewedStages: [],
    ...overrides,
  };
}

describe("profileInitials", () => {
  it("uses the company name, not a person", () => {
    expect(profileInitials("Zanari Analytics")).toBe("ZA");
    expect(profileInitials("BidLens")).toBe("BI");
    expect(profileInitials("")).toBe("BT");
  });
});

describe("shellCrumb", () => {
  it("puts workspace pages under Workspace and settings under Manage", () => {
    expect(shellCrumb("/")).toEqual({ group: "Workspace", page: "Overview" });
    expect(shellCrumb("/tenders/abc")).toEqual({ group: "Workspace", page: "Tenders" });
    expect(shellCrumb("/company")).toEqual({ group: "Workspace", page: "Company profile" });
    expect(shellCrumb("/settings")).toEqual({ group: "Manage", page: "Settings" });
    expect(shellCrumb("/trail")).toEqual({ group: "Manage", page: "Decision trail" });
  });
});

describe("overview stats", () => {
  it("counts reviews, decisions, expiry and the soonest closing date", () => {
    expect(activeTenderStats([tender(), tender({ id: "closed", deadlineAt: "2026-11-01T08:00:00+03:00", closing: "1 November 2026" })], AS_OF)).toEqual({
      total: 1,
      unreviewed: 1,
    });
    expect(activeReviewNote(1, 2)).toBe("1 with no review yet");
    expect(activeReviewNote(0, 2)).toBe("Each one has a review");
    expect(awaitingDecisionNote(2)).toBe("No bid decision recorded");
    expect(evidenceNote(0)).toBe("None past the expiry date");
    expect(
      evidenceCounts(
        [
          { holding: "have", expiresOn: "2026-11-01", neverExpires: false },
          { holding: "have", expiresOn: null, neverExpires: true },
          { holding: "dont_have", expiresOn: "2026-01-01", neverExpires: false },
        ],
        "2026-11-13",
      ),
    ).toEqual({ onFile: 2, expired: 1 });
    expect(upcomingDeadline([tender()], AS_OF)).toEqual({
      value: "11 days",
      note: "Nairobi City County · 24 November 2026",
    });
    expect(upcomingDeadline([tender({ deadlineAt: "2026-11-01T08:00:00+03:00", closing: "1 November 2026" })], AS_OF)).toEqual({
      value: "Closed",
      note: "Nairobi City County · 1 November 2026",
    });
    expect(upcomingDeadline([tender({ deadlineAt: null, closing: null })], AS_OF)).toEqual({
      value: "Not stated",
      note: "No uploaded tender states a closing date",
    });
  });
});

describe("row pill and next actions", () => {
  it("shows the decision, otherwise the first stage with no review", () => {
    expect(rowPill(tender()).label).toBe("Interpretation");
    expect(rowPill(tender({ reviewedStages: ["can_bid", "can_comply", "should_bid"] })).label).toBe("Recommendation");
    expect(rowPill(tender({ finalLabel: "proceed_to_preparation" })).label).toBe("Proceed to preparation");
  });

  it("builds actions only from gaps and leaves an empty list when there are none", () => {
    const open = nextActions([
      tender({ addendumConflicts: 1, needsHuman: 2, missingMandatory: 3 }),
    ]);
    expect(open.items.map((item) => item.title)).toEqual([
      "Resolve an addendum conflict",
      "Check facts that need a person",
      "Missing mandatory documents",
      "Record a bid decision",
    ]);
    expect(nextActions([tender({ finalLabel: "seek_clarification", reviewedStages: ["can_bid"] })]).items).toEqual([]);
  });
});

describe("team activity", () => {
  it("lists saved reviews and decisions, newest first, and stays empty without them", () => {
    const rows = teamActivity({
      titles: new Map([["tender-1", "SUPPLY OF NETWORK EQUIPMENT"]]),
      when: () => "13 Nov, 09:00",
      reviews: [
        { tenderId: "tender-1", stage: "can_bid", reviewerName: "Bid manager", createdAt: "2026-11-13T06:00:00Z" },
      ],
      decisions: [
        {
          tenderId: "tender-1",
          action: "approve",
          finalLabel: "proceed_to_preparation",
          reviewerName: "Bid manager",
          createdAt: "2026-11-13T08:00:00Z",
        },
      ],
    });
    expect(rows.map((row) => row.what)).toEqual(["Approved Proceed to preparation", "Interpretation reviewed"]);
    expect(rows[0]?.detail).toContain("Bid manager");
    expect(
      teamActivity({ titles: new Map(), when: () => "", reviews: [], decisions: [] }),
    ).toEqual([]);
  });
});
