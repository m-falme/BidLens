import { describe, expect, it } from "vitest";

import { decideFieldStatus, hasBlankMarker, meaningfulValue } from "@/lib/verify/field-status";

// Shapes copied from the Nairobi SD-WAN tender (pages 27 and 134), as unpdf extracts them.
const page27 = "ITT 20.1 The Tender validity period shall be 120 days.\nITT 21.1 Tender Security shall be required.";
const page134 =
  "6.5.1 Payments shall be made within ____________________ days of receipt of the invoice.\n" +
  "The interest rate is ____________________.";

describe("decideFieldStatus", () => {
  it("confirms a value whose quote is on the cited page and contains it", () => {
    expect(
      decideFieldStatus({ value: "120 days", quote: "The Tender validity period shall be 120 days.", pageText: page27 }),
    ).toEqual({ status: "source_confirmed", reason: "quote_confirmed" });
  });

  it("marks a value that interprets a verified quote as ai_inferred, not confirmed", () => {
    expect(
      decideFieldStatus({ value: "Required", quote: "Tender Security shall be required.", pageText: page27 }).status,
    ).toBe("source_confirmed");
    expect(
      decideFieldStatus({ value: "Yes", quote: "Tender Security shall be required.", pageText: page27 }),
    ).toEqual({ status: "ai_inferred", reason: "value_interpreted" });
  });

  it("downgrades to needs_human when the quote is not on the cited page", () => {
    // A plausible but invented quote.
    expect(
      decideFieldStatus({ value: "150 days", quote: "The Tender validity period shall be 150 days.", pageText: page27 }),
    ).toEqual({ status: "needs_human", reason: "quote_not_on_page" });
    // A real quote cited against the wrong page.
    expect(
      decideFieldStatus({ value: "120 days", quote: "The Tender validity period shall be 120 days.", pageText: page134 }),
    ).toEqual({ status: "needs_human", reason: "quote_not_on_page" });
    // No page text at all (page out of range or a scanned page).
    expect(decideFieldStatus({ value: "120 days", quote: "120 days", pageText: null }).status).toBe("needs_human");
  });

  it("sends a value without a quote to a human", () => {
    expect(decideFieldStatus({ value: "120 days", quote: null, pageText: page27 })).toEqual({
      status: "needs_human",
      reason: "no_quote",
    });
  });

  it("keeps a blank clause blank_in_source and never fills it in", () => {
    expect(
      decideFieldStatus({ value: null, quote: "The interest rate is ____________________.", pageText: page134 }),
    ).toEqual({ status: "blank_in_source", reason: "blank_clause_confirmed" });
    // The model returning the blank itself as the value is still a blank.
    expect(
      decideFieldStatus({ value: "____", quote: "The interest rate is ____________________.", pageText: page134 })
        .status,
    ).toBe("blank_in_source");
  });

  it("does not accept a blank clause that isn't really on the page", () => {
    expect(
      decideFieldStatus({ value: null, quote: "The interest rate is ________.", pageText: page27 }),
    ).toEqual({ status: "needs_human", reason: "quote_not_on_page" });
  });

  it("marks a field the model did not find as needs_human with no value", () => {
    expect(decideFieldStatus({ value: null, quote: null, pageText: page27 })).toEqual({
      status: "needs_human",
      reason: "not_found",
    });
    expect(decideFieldStatus({ value: null, quote: "Tender Security shall be required.", pageText: page27 })).toEqual({
      status: "needs_human",
      reason: "no_value",
    });
  });
});

describe("helpers", () => {
  it("recognises template blanks", () => {
    expect(hasBlankMarker("within ______ days")).toBe(true);
    expect(hasBlankMarker("rate of .......... per cent")).toBe(true);
    expect(hasBlankMarker("[insert interest rate]")).toBe(true);
    expect(hasBlankMarker("(insert email address)")).toBe(true);
    expect(hasBlankMarker("The interest rate is 12%.")).toBe(false);
  });

  it("treats empty and blank-only values as no value", () => {
    expect(meaningfulValue("  ")).toBeNull();
    expect(meaningfulValue("___")).toBeNull();
    expect(meaningfulValue("—")).toBeNull();
    expect(meaningfulValue(" KSh 420,000 ")).toBe("KSh 420,000");
  });
});
