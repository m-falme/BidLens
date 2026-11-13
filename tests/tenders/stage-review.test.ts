import { describe, expect, it } from "vitest";

import {
  becauseBullets,
  carriedFrom,
  commercialFinding,
  complianceFinding,
  formatReviewedAt,
  interpretationFinding,
  latestByStage,
  unreadPagesNotice,
  parseStageReview,
  preparationFinding,
  stageApprovalLine,
  unresolvedClause,
  type StageReviewRecord,
} from "@/lib/tenders/stage-review";

const TENDER = "11111111-1111-4111-8111-111111111111";

describe("parseStageReview", () => {
  it("keeps a trimmed name and drops a blank note", () => {
    const result = parseStageReview({
      tenderId: TENDER,
      stage: "can_bid",
      reviewerName: "  Amina  ",
      note: "   ",
    });
    expect(result).toEqual({
      ok: true,
      value: { tenderId: TENDER, stage: "can_bid", reviewerName: "Amina", note: null },
    });
  });

  it("keeps a note when one was written", () => {
    const result = parseStageReview({
      tenderId: TENDER,
      stage: "should_bid",
      reviewerName: "Amina",
      note: " Payment score is severe. ",
    });
    expect(result.ok && result.value.note).toBe("Payment score is severe.");
  });

  it("asks for a name and rejects an unknown step", () => {
    expect(parseStageReview({ tenderId: TENDER, stage: "can_bid", reviewerName: "  ", note: "" })).toMatchObject({
      ok: false,
      error: "Enter your name.",
    });
    expect(parseStageReview({ tenderId: TENDER, stage: "decide", reviewerName: "Amina", note: "" })).toMatchObject({
      ok: false,
      error: "Choose a step to review.",
    });
  });
});

describe("latestByStage", () => {
  it("shows the newest review on each step and keeps the others", () => {
    const reviews: StageReviewRecord[] = [
      { stage: "can_bid", reviewerName: "Amina", note: null, createdAt: "2026-11-12T08:00:00.000Z" },
      { stage: "can_bid", reviewerName: "James", note: "Second look", createdAt: "2026-11-12T10:00:00.000Z" },
      { stage: "should_bid", reviewerName: "Amina", note: null, createdAt: "2026-11-12T09:00:00.000Z" },
    ];
    const latest = latestByStage(reviews);
    expect(latest.can_bid?.reviewerName).toBe("James");
    expect(latest.can_comply).toBeNull();
    expect(latest.should_bid?.reviewerName).toBe("Amina");
  });
});

describe("formatReviewedAt", () => {
  it("prints Nairobi time", () => {
    expect(formatReviewedAt("2026-11-12T20:20:00.000Z")).toMatch(/12 Nov.*23:20/);
  });
});

describe("step findings", () => {
  it("summarises extracted facts in one sentence", () => {
    expect(interpretationFinding({ facts: 0, needsHuman: 0 })).toMatch(/No key facts/);
    expect(interpretationFinding({ facts: 1, needsHuman: 0 })).toBe("Found 1 fact.");
    expect(interpretationFinding({ facts: 12, needsHuman: 2 })).toBe(
      "Found 12 facts, and 2 still need a person to check.",
    );
    expect(interpretationFinding({ facts: 12, needsHuman: 1 })).toBe(
      "Found 12 facts, and 1 still needs a person to check.",
    );
    expect(interpretationFinding({ facts: 10, needsHuman: 2, unfilled: 3 })).toBe(
      "Found 10 facts, and 2 still need a person to check. Not filled in by the buyer: 3.",
    );
    expect(interpretationFinding({ facts: 4, needsHuman: 0, unfilled: 1 })).toBe(
      "Found 4 facts. Not filled in by the buyer: 1.",
    );
    expect(interpretationFinding({ facts: 0, needsHuman: 0, unfilled: 2 })).toBe("Not filled in by the buyer: 2.");
    expect(unreadPagesNotice([])).toBeNull();
    expect(unreadPagesNotice([18, 4, 4])).toBe("2 pages couldn't be read (p.4, 18)");
    expect(unreadPagesNotice([3])).toBe("1 page couldn't be read (p.3)");
  });

  it("names one missing requirement and shortens a bid bond to its amount", () => {
    expect(complianceFinding({ met: 0, gaps: 0 })).toMatch(/No mandatory requirements/);
    expect(complianceFinding({ met: 13, gaps: 0 })).toBe("All 13 requirements are covered.");
    expect(
      complianceFinding({
        met: 12,
        gaps: 1,
        missingText: "Attach a bid bond of Kshs. 800,000.00 from a CBK-licensed bank.",
      }),
    ).toBe("12 of 13 requirements are covered; the KSh 800,000 bid bond is missing.");
    expect(
      complianceFinding({
        met: 10,
        gaps: 3,
        missingText: "Must submit a Tender Security of KSh 500,000",
      }),
    ).toBe("10 of 13 requirements are covered; the KSh 500,000 bid bond and 2 others are missing.");
    expect(complianceFinding({ met: 0, gaps: 1, missingText: "Copy of the bid bond" })).toBe(
      "The requirement is not covered; the bid bond is missing.",
    );
    const long = "Provide a valid tax compliance certificate issued by the Kenya Revenue Authority for this tender";
    const named = complianceFinding({ met: 2, gaps: 1, missingText: long });
    expect(named.startsWith("2 of 3 requirements are covered;")).toBe(true);
    expect(named.endsWith("is missing.")).toBe(true);
    expect(named).toContain("…");
    expect(named.split(long).length).toBe(1);
  });

  it("states the county score as unpaid bills, not a payment date", () => {
    expect(commercialFinding(null)).toMatch(/No county payment score/);
    expect(commercialFinding({ county: "Nairobi", score: 76.5, bandLabel: "Severe" })).toBe(
      "Nairobi scores 76.5 out of 100, severe payment risk. This is the stock of unpaid bills, not a date the buyer will pay.",
    );
    expect(commercialFinding({ county: "Makueni", score: 2.6, bandLabel: "Low" })).toBe(
      "Makueni scores 2.6 out of 100, low payment risk. This is the stock of unpaid bills, not a date the buyer will pay.",
    );
  });

  it("gives bid preparation its own sentence and carries the previous stage", () => {
    expect(preparationFinding(0, 0)).toBe("Nothing to prepare from the extracted facts.");
    expect(preparationFinding(0, 8)).toBe("None of the 8 preparation items are marked done yet.");
    expect(preparationFinding(3, 8)).toBe("3 of 8 preparation items are marked done.");
    expect(preparationFinding(8, 8)).toBe("All 8 preparation items are marked done.");
    expect(carriedFrom("Interpretation", "Found 12 facts.")).toBe("Carried from Interpretation: Found 12 facts.");
  });
});

describe("recommendation because", () => {
  it("keeps one bullet from each source and quotes a clause once", () => {
    const bullets = becauseBullets({
      compliance: "12 of 13 requirements are covered; the KSh 800,000 bid bond is missing.",
      commercial: "Nairobi scores 76.5 (Severe), the stock of unpaid bills, not a date the buyer will pay.",
      open: [
        { label: "Closing date and time", status: "blank_in_source" },
        { label: "Bid security", status: "needs_human" },
        { label: "Evaluation criterion", status: "blank_in_source" },
      ],
      unresolved: unresolvedClause({ securityConflict: true, addendumConflicts: 1, closed: false }),
    });
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe(
      "Because 12 of 13 requirements are covered; the KSh 800,000 bid bond is missing.",
    );
    expect(bullets[1]).toMatch(/^Because Nairobi scores 76\.5/);
    expect(bullets[2]).toBe(
      "Because closing date and time is blank in the source, and 2 other open questions, and bid security amounts disagree, and an addendum conflicts with the main document.",
    );
    expect(bullets.join(" ").match(/KSh 800,000 bid bond/g)).toHaveLength(1);
  });

  it("shows Approved by only when that review is the latest", () => {
    const review = {
      reviewerName: "Amina",
      createdAt: "2026-11-12T20:20:00.000Z",
      action: "approve" as const,
    };
    expect(stageApprovalLine({ review: null, others: [] })).toBeNull();
    expect(stageApprovalLine({ review, others: [{ createdAt: "2026-11-13T08:00:00.000Z" }] })).toBeNull();
    expect(stageApprovalLine({ review, others: [{ createdAt: "2026-11-12T10:00:00.000Z" }] })).toMatch(
      /^Approved by Amina at 12 Nov.*23:20$/,
    );
    expect(
      stageApprovalLine({
        review: { ...review, action: "override" },
        others: [],
      }),
    ).toMatch(/^Overridden by Amina at /);
  });
});
