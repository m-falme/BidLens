import { describe, expect, it } from "vitest";

import { needsHumanReview, summarizeReview, type ReviewField } from "@/lib/tenders/review";

let n = 0;
const f = (source: string, key: string, value: string | null, status: ReviewField["status"]): ReviewField => ({
  id: `f${++n}`,
  source_id: source,
  key,
  value,
  quote: value,
  page_no: 1,
  status,
  affects_key: null,
});

describe("summarizeReview", () => {
  it("counts needs_human fields plus addendum conflicts as items to review", () => {
    const roles = new Map([
      ["main", "main" as const],
      ["add", "addendum" as const],
    ]);
    const summary = summarizeReview(
      [
        f("main", "tender_validity", "120 days", "source_confirmed"),
        f("main", "contact", null, "needs_human"),
        f("main", "late_payment_interest", null, "blank_in_source"),
        f("main", "title", "SD-WAN", "ai_inferred"),
        f("add", "tender_validity", "150 days", "source_confirmed"),
      ],
      roles,
    );
    expect(summary.total).toBe(5);
    expect(summary.byStatus).toEqual({ source_confirmed: 2, ai_inferred: 1, blank_in_source: 1, needs_human: 1 });
    expect(summary.conflicts).toHaveLength(1);
    expect(summary.needsReview).toBe(2);
  });

  it("needs a person when nothing is source-confirmed or no mandatory requirement was extracted", () => {
    expect(needsHumanReview({ sourceConfirmed: 0, mandatoryRequirements: 4 })).toBe(true);
    expect(needsHumanReview({ sourceConfirmed: 12, mandatoryRequirements: 0 })).toBe(true);
    expect(needsHumanReview({ sourceConfirmed: 0, mandatoryRequirements: 0 })).toBe(true);
    expect(needsHumanReview({ sourceConfirmed: 3, mandatoryRequirements: 8 })).toBe(false);
  });

  it("has no conflicts without an addendum", () => {
    const summary = summarizeReview([f("main", "title", "x", "source_confirmed")], new Map([["main", "main" as const]]));
    expect(summary.conflicts).toEqual([]);
    expect(summary.needsReview).toBe(0);
  });
});
