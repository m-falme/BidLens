import { describe, expect, it } from "vitest";

import { parseBidDecision } from "@/lib/recommendation/decision";
import { decisionTrail, latestBidDecision } from "@/lib/recommendation/trail";
import { daysUntilDeadline } from "@/lib/recommendation/deadline";
import type { BidDecisionRecord } from "@/lib/recommendation/decision";
import type { StageReviewRecord } from "@/lib/tenders/stage-review";

const TENDER = "11111111-1111-4111-8111-111111111111";

describe("parseBidDecision", () => {
  it("approves the recommended label and drops a blank reason", () => {
    const result = parseBidDecision({
      tenderId: TENDER,
      recommendedLabel: "proceed_to_preparation",
      finalLabel: "proceed_to_preparation",
      action: "approve",
      reason: "   ",
      reviewerName: "  Amina  ",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        tenderId: TENDER,
        recommendedLabel: "proceed_to_preparation",
        finalLabel: "proceed_to_preparation",
        action: "approve",
        reason: null,
        reviewerName: "Amina",
      },
    });
  });

  it("requires a name, a different label and a reason to override", () => {
    expect(
      parseBidDecision({
        tenderId: TENDER,
        recommendedLabel: "resolve_blockers",
        finalLabel: "consider_declining",
        action: "override",
        reason: "  The bond cannot be raised. ",
        reviewerName: "James",
      }),
    ).toMatchObject({
      ok: true,
      value: { action: "override", finalLabel: "consider_declining", reason: "The bond cannot be raised." },
    });
    expect(
      parseBidDecision({
        tenderId: TENDER,
        recommendedLabel: "resolve_blockers",
        finalLabel: "resolve_blockers",
        action: "override",
        reason: "Because",
        reviewerName: "James",
      }),
    ).toMatchObject({ ok: false, error: "Choose a different label." });
    expect(
      parseBidDecision({
        tenderId: TENDER,
        recommendedLabel: "resolve_blockers",
        finalLabel: "consider_declining",
        action: "override",
        reason: "  ",
        reviewerName: "James",
      }),
    ).toMatchObject({ ok: false, error: "Enter a reason for the override." });
    expect(
      parseBidDecision({
        tenderId: TENDER,
        recommendedLabel: "resolve_blockers",
        finalLabel: "consider_declining",
        action: "override",
        reason: "Because",
        reviewerName: " ",
      }),
    ).toMatchObject({ ok: false, error: "Enter your name." });
  });

  it("refuses an approval that changes the label", () => {
    expect(
      parseBidDecision({
        tenderId: TENDER,
        recommendedLabel: "seek_clarification",
        finalLabel: "proceed_to_preparation",
        action: "approve",
        reason: "",
        reviewerName: "Amina",
      }),
    ).toMatchObject({ ok: false, error: "Approve keeps the recommended label." });
  });
});

describe("decision trail", () => {
  const reviews: StageReviewRecord[] = [
    { stage: "can_bid", reviewerName: "Amina", note: "Closing date checked", createdAt: "2026-11-12T08:00:00.000Z" },
    { stage: "should_bid", reviewerName: "James", note: null, createdAt: "2026-11-12T12:00:00.000Z" },
  ];
  const decisions: BidDecisionRecord[] = [
    {
      recommendedLabel: "resolve_blockers",
      finalLabel: "consider_declining",
      action: "override",
      reason: "The bond cannot be raised.",
      reviewerName: "Amina",
      createdAt: "2026-11-12T10:00:00.000Z",
    },
  ];

  it("lists reviews and decisions newest first, with who, what and the note", () => {
    const trail = decisionTrail(reviews, decisions);
    expect(trail.map((entry) => entry.what)).toEqual([
      "Commercial reviewed",
      "Overrode the recommendation to Consider declining",
      "Interpretation reviewed",
    ]);
    expect(trail.map((entry) => entry.kind)).toEqual(["review", "override", "review"]);
    expect(trail[0]).toMatchObject({ who: "James", note: null });
    expect(trail[1]).toMatchObject({ who: "Amina", note: "The bond cannot be raised." });
    expect(latestBidDecision(decisions)?.finalLabel).toBe("consider_declining");
  });
});

describe("daysUntilDeadline", () => {
  const asOf = new Date("2026-11-13T00:30:00+03:00");

  it("counts Nairobi calendar days from a written closing date", () => {
    expect(daysUntilDeadline({ deadlineAt: null, closingText: "20 November 2026 at 11:00 am", asOf })).toBe(7);
    expect(daysUntilDeadline({ deadlineAt: null, closingText: "20th november, 2026 at 11:00 a.m.", asOf })).toBe(7);
    expect(daysUntilDeadline({ deadlineAt: null, closingText: "MONDAY 23RD NOVEMBER, 2026", asOf })).toBe(10);
  });

  it("prefers the stored deadline and returns null when nothing parses", () => {
    expect(
      daysUntilDeadline({
        deadlineAt: "2026-11-28T10:00:00+03:00",
        closingText: "20 November 2026",
        asOf,
      }),
    ).toBe(15);
    expect(daysUntilDeadline({ deadlineAt: null, closingText: "to be advised", asOf })).toBeNull();
    expect(daysUntilDeadline({ deadlineAt: null, closingText: null, asOf })).toBeNull();
  });
});
