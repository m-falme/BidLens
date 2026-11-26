import { describe, expect, it } from "vitest";

import { readinessUnchanged, uniqueByTenderAndText, type StoredRequirementRow } from "@/lib/readiness/stored";

function row(text: string, match = "met"): StoredRequirementRow {
  return { text, category: "mandatory", page_no: 2, quote: text, match, capability_id: null, rationale: "r" };
}

describe("readinessUnchanged", () => {
  it("is true only for the same rows, in any order, each once", () => {
    expect(readinessUnchanged([row("A"), row("B")], [row("B"), row("A")])).toBe(true);
    expect(readinessUnchanged([row("A"), row("A")], [row("A")])).toBe(false);
    expect(readinessUnchanged([row("A"), row("B")], [row("A"), row("B", "missing")])).toBe(false);
    expect(readinessUnchanged([], [])).toBe(true);
  });
});

describe("uniqueByTenderAndText", () => {
  it("counts a requirement saved twice for a tender once", () => {
    const rows = [
      { opportunity_id: "t1", text: "Bid bond" },
      { opportunity_id: "t1", text: "Bid bond" },
      { opportunity_id: "t2", text: "Bid bond" },
    ];
    expect(uniqueByTenderAndText(rows)).toHaveLength(2);
  });
});
