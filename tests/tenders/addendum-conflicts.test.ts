import { describe, expect, it } from "vitest";

import { findAddendumConflicts, sameValue, type ComparableField } from "@/lib/tenders/addendum-conflicts";

let nextId = 0;
function field(key: string, value: string | null, quote: string | null = value, affects: string | null = null): ComparableField {
  return { id: `f${++nextId}`, key, value, quote, page_no: 1, status: "source_confirmed", affects_key: affects };
}

// Wording from the Nairobi SD-WAN tender (p.31) and its Addendum 1 (6 Nov 2026).
const main = [
  field("reference_number", "NCCG/IDE/T/039/2026-2027"),
  field("tender_validity", "120 days"),
  field("buyer", "Nairobi City County"),
  field(
    "mandatory_requirement",
    "Provide certified valid ICT Authority (ICTA) certificates in Information Security Category 1/2 (Must be certified by Commissioner for Oaths)",
  ),
  field(
    "mandatory_requirement",
    "Provide certified valid National Construction Authority Certificate Category (NCA 1/2) in Electrical Engineering Services (Must be certified by Commissioner for Oaths)",
  ),
  field("mandatory_requirement", "Copy of Certificate of Incorporation"),
];

describe("sameValue", () => {
  it("treats restatements as the same and changed numbers as different", () => {
    expect(sameValue("Nairobi City County", "NAIROBI CITY COUNTY")).toBe(true);
    expect(sameValue("NCCG/IDE/T/039/2026-2027", "Tender No. NCCG/IDE/T/039/2026-2027")).toBe(true);
    expect(sameValue("120 days", "150 days")).toBe(false);
    expect(sameValue("Friday 20 November 2026 at 11:00 am", "Friday 27 November 2026 at 11:00 am")).toBe(false);
    expect(sameValue("KSh 420,000", "Kenya Shillings 500,000")).toBe(false);
  });
});

describe("findAddendumConflicts", () => {
  it("flags a changed value with both values, and ignores restatements", () => {
    const addendum = [field("reference_number", "Tender No. NCCG/IDE/T/039/2026-2027"), field("tender_validity", "150 days")];
    const conflicts = findAddendumConflicts(main, addendum);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: "value_differs",
      key: "tender_validity",
      main: { value: "120 days" },
      addendum: { value: "150 days" },
    });
  });

  it("flags a value only the addendum states", () => {
    const conflicts = findAddendumConflicts(main, [field("closing_datetime", "27 November 2026 at 11:00 am")]);
    expect(conflicts).toEqual([expect.objectContaining({ kind: "addendum_only", key: "closing_datetime", main: null })]);
  });

  it("links an addendum change to the main-tender requirement it removes (NCA, not ICTA)", () => {
    const change = field(
      "addendum_change",
      "Mandatory requirement No. 27 (NCA Category 1 or 2 certificate) is removed from preliminary evaluation.",
      "the eligibility criteria mandatory requirement No. 27 is not applicable for preliminary evaluation. Therefore, in view of the technical requirements, NCA Category 1 or 2 Registration Certificate is not applicable",
      "mandatory_requirement",
    );
    const [conflict] = findAddendumConflicts(main, [change]);
    expect(conflict.kind).toBe("addendum_change");
    expect(conflict.key).toBe("mandatory_requirement");
    expect(conflict.main?.value).toContain("National Construction Authority");
    expect(conflict.addendum).toBe(change);
  });

  it("still reports a change it cannot link, with no main value", () => {
    const change = field("addendum_change", "Site visit moved to Kasarani.", "site visit", "other");
    const [conflict] = findAddendumConflicts(main, [change]);
    expect(conflict).toMatchObject({ kind: "addendum_change", main: null, key: "other" });
  });
});
