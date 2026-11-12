import { describe, expect, it } from "vitest";

import type { BidSecurityConflict } from "@/lib/tenders/document-conflicts";
import { buildWhatMatters, MAX_MATTER_POINTS, type MatterField } from "@/lib/tenders/what-matters";

function field(partial: Partial<MatterField> & Pick<MatterField, "id" | "key">): MatterField {
  return {
    value: null,
    status: "source_confirmed",
    page_no: 1,
    role: "main",
    ...partial,
  };
}

const nairobiConflict: BidSecurityConflict = {
  kind: "bid_security_amounts_differ",
  amounts: [
    { pageNo: 7, amountKes: 420_000, quote: "Tender security of ksh. 420,000" },
    { pageNo: 30, amountKes: 500_000, quote: "Tender Security of Kenya Shillings 500,000" },
  ],
};

describe("buildWhatMatters", () => {
  it("gives Nairobi five points: close, the amount conflict, blanks, and the human count", () => {
    const points = buildWhatMatters({
      fields: [
        field({ id: "close", key: "closing_datetime", value: "20TH NOVEMBER, 2026 at 11:00 a.m.", page_no: 28 }),
        field({ id: "sec", key: "bid_security", value: "ksh. 420,000/- [Four hundred twenty thousand]", page_no: 7 }),
        field({
          id: "sec-list",
          key: "mandatory_requirement",
          value: "Must submit a Tender Security of Kenya Shillings 500,000",
          page_no: 30,
        }),
        field({ id: "adv", key: "advance_payment", status: "blank_in_source", page_no: 134 }),
        field({ id: "days", key: "payment_days", status: "blank_in_source", page_no: 134 }),
        field({ id: "ir", key: "late_payment_interest", status: "blank_in_source", page_no: 134 }),
        field({ id: "perf", key: "performance_security", status: "needs_human", page_no: 137 }),
      ],
      conflict: nairobiConflict,
      needsHuman: 3,
      addendumConflicts: 1,
    });

    expect(points).toHaveLength(MAX_MATTER_POINTS);
    expect(points.map((point) => point.id)).toEqual(["closing", "bid-security", "payment", "red-flags", "review"]);
    expect(points[0].text).toBe("Closing date: 20TH NOVEMBER, 2026 at 11:00 a.m.");
    expect(points[1].text).toContain("page 7 says KSh 420,000");
    expect(points[1].text).toContain("page 30 says KSh 500,000");
    expect(points[1].fieldIds).toEqual(["sec", "sec-list"]);
    expect(points[2].text).toContain("Advance payment is left blank");
    expect(points[2].text).toContain("Payment period is left blank");
    expect(points[3].text).toContain("Late-payment interest is left blank");
    expect(points[3].text).toContain("Performance security needs a human");
    expect(points[4].text).toBe(
      "3 extracted fields need a human to check, and 1 addendum conflict still needs a decision.",
    );
  });

  it("states Makueni's advance and payment period when the tender gives them, and does not invent a conflict", () => {
    const points = buildWhatMatters({
      fields: [
        field({ id: "close", key: "closing_datetime", value: "MONDAY 23RD NOVEMBER, 2026", page_no: 38 }),
        field({ id: "sec", key: "bid_security", value: "Kshs. 800,000(Eight Hundred thousand shillings only)", page_no: 38 }),
        field({ id: "adv", key: "advance_payment", value: "twenty percent (20%)", page_no: 181 }),
        field({ id: "days", key: "payment_days", value: "sixty (60)", page_no: 148 }),
        field({ id: "ir", key: "late_payment_interest", status: "blank_in_source", page_no: 183 }),
        field({ id: "perf", key: "performance_security", status: "blank_in_source", page_no: 207 }),
      ],
      conflict: null,
      needsHuman: 1,
      addendumConflicts: 0,
    });

    expect(points.map((point) => point.id)).toEqual(["closing", "bid-security", "payment", "red-flags", "review"]);
    expect(points[1].text).toContain("Kshs. 800,000");
    expect(points[1].text).not.toContain("disagrees");
    expect(points[2].text).toContain("twenty percent (20%)");
    expect(points[2].text).toContain("sixty (60)");
    expect(points[3].text).toContain("Performance security is left blank");
    expect(points[4].text).toBe("1 extracted field needs a human to check.");
  });

  it("never returns more than five points", () => {
    const points = buildWhatMatters({
      fields: [
        field({ id: "close", key: "closing_datetime", value: "Friday" }),
        field({ id: "sec", key: "bid_security", value: "KSh 1" }),
        field({ id: "adv", key: "advance_payment", value: "10%" }),
        field({ id: "days", key: "payment_days", value: "30 days" }),
        field({ id: "ir", key: "late_payment_interest", status: "blank_in_source" }),
        field({ id: "perf", key: "performance_security", status: "blank_in_source" }),
      ],
      conflict: nairobiConflict,
      needsHuman: 4,
      addendumConflicts: 2,
    });
    expect(points.length).toBeLessThanOrEqual(MAX_MATTER_POINTS);
  });

  it("prefers the main document when an addendum restates a field", () => {
    const points = buildWhatMatters({
      fields: [
        field({ id: "main-close", key: "closing_datetime", value: "20 November 2026", role: "main" }),
        field({ id: "add-close", key: "closing_datetime", value: "1 December 2026", role: "addendum" }),
      ],
      conflict: null,
      needsHuman: 0,
      addendumConflicts: 0,
    });
    expect(points).toEqual([{ id: "closing", text: "Closing date: 20 November 2026.", fieldIds: ["main-close"] }]);
  });
});
