import { describe, expect, it } from "vitest";

import { findBidSecurityConflicts, findSecurityAmounts } from "@/lib/tenders/document-conflicts";

/** Wording from the Nairobi SD-WAN tender, pages 7 and 30. */
const NAIROBI_P7 =
  "5. All Tenders must be accompanied by Tender security of ksh. 420,000/- [Four hundred twenty thousand] 6. The Tenderer shall chronologically serialize all pages.";
const NAIROBI_P30 =
  "5. Must submit a Tender Security of Kenya Shillings 500,000 issued by a financial institution approved and licensed by the Central Bank of Kenya (CBK) valid beyond 30 days of the tender validity period";

describe("findBidSecurityConflicts", () => {
  it("flags Nairobi's 420,000 on page 7 against 500,000 on page 30", () => {
    const conflict = findBidSecurityConflicts([
      { pageNo: 7, text: NAIROBI_P7 },
      { pageNo: 30, text: NAIROBI_P30 },
    ]);
    expect(conflict?.amounts.map((amount) => [amount.pageNo, amount.amountKes])).toEqual([
      [7, 420_000],
      [30, 500_000],
    ]);
    expect(conflict?.amounts[0].quote).toContain("420,000");
    expect(conflict?.amounts[1].quote).toContain("500,000");
  });

  it("does not flag the same amount restated, including decimals", () => {
    const conflict = findBidSecurityConflicts([
      { pageNo: 38, text: "Tender security of Kshs. 800,000 (Eight Hundred thousand shillings only)" },
      { pageNo: 43, text: "Attach a bid bond of Kshs. 800,000.00 from a CBK-licensed bank" },
    ]);
    expect(conflict).toBeNull();
  });

  it("ignores day counts next to the security clause", () => {
    const mentions = findSecurityAmounts(30, NAIROBI_P30);
    expect(mentions.map((mention) => mention.amountKes)).toEqual([500_000]);
  });

  it("finds nothing when the page never states an amount", () => {
    expect(findSecurityAmounts(2, "Tender security shall be in the form prescribed in the tender data sheet.")).toEqual(
      [],
    );
  });
});
