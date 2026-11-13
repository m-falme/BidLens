import { describe, expect, it } from "vitest";

import {
  commercialFinding,
  complianceFinding,
  formatReviewedAt,
  interpretationFinding,
  latestByStage,
  parseStageReview,
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
  it("summarises extracted facts without inventing a requirement", () => {
    expect(interpretationFinding({ facts: 0, needsHuman: 0 })).toMatch(/No key facts/);
    expect(interpretationFinding({ facts: 1, needsHuman: 0 })).toBe("Found 1 fact.");
    expect(interpretationFinding({ facts: 12, needsHuman: 2 })).toBe(
      "Found 12 facts. 2 still need a person to check.",
    );
    expect(interpretationFinding({ facts: 12, needsHuman: 1 })).toBe(
      "Found 12 facts. 1 still needs a person to check.",
    );
  });

  it("summarises readiness counts", () => {
    expect(complianceFinding({ met: 0, gaps: 0, couldDisqualify: 0, toPrepare: 0, total: 0 })).toMatch(
      /No mandatory requirements/,
    );
    expect(complianceFinding({ met: 3, gaps: 1, couldDisqualify: 1, toPrepare: 0, total: 4 })).toBe(
      "3 met, 1 gap, 1 could disqualify.",
    );
    expect(complianceFinding({ met: 5, gaps: 2, couldDisqualify: 1, toPrepare: 7, total: 14 })).toBe(
      "5 met, 2 gaps, 7 to prepare, 1 could disqualify.",
    );
  });

  it("states the county score as unpaid bills, not a payment date", () => {
    expect(commercialFinding(null)).toMatch(/No county payment score/);
    expect(commercialFinding({ county: "Nairobi", score: 76.5, bandLabel: "Severe" })).toBe(
      "Nairobi scores 76.5 (Severe). This is the stock of unpaid bills, not a date the buyer will pay.",
    );
  });
});
