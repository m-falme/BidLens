import { describe, expect, it } from "vitest";

import { isQuoteOnPage, statusFromQuoteCheck } from "@/lib/verify/quote-check";

const page = "The tender closes on\n  Friday, 28 November 2026 at 10:00 AM.\tLate bids are rejected.";

describe("quote check", () => {
  it("confirms a quote regardless of whitespace and case", () => {
    expect(isQuoteOnPage("friday, 28 november   2026 at 10:00 am", page)).toBe(true);
    expect(statusFromQuoteCheck("Late bids are rejected.", page)).toBe("source_confirmed");
  });

  it("sends a quote that isn't on the page to a human", () => {
    expect(statusFromQuoteCheck("closes on 30 November 2026", page)).toBe("needs_human");
  });

  it("never confirms an empty quote or missing page", () => {
    expect(isQuoteOnPage("", page)).toBe(false);
    expect(isQuoteOnPage("   ", page)).toBe(false);
    expect(isQuoteOnPage(null, page)).toBe(false);
    expect(isQuoteOnPage("tender", null)).toBe(false);
  });
});
