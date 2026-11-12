import { describe, expect, it } from "vitest";

import type { MatchedRequirement, ReadinessResult } from "@/lib/readiness/match";
import { recommend, type KeyFact, type RecommendationInput } from "@/lib/recommendation/recommend";

function item(
  partial: Partial<MatchedRequirement> & Pick<MatchedRequirement, "text" | "match">,
): MatchedRequirement {
  return {
    category: "mandatory",
    pageNo: 4,
    quote: null,
    capabilityId: null,
    capabilityName: null,
    evidenceRef: null,
    rationale: "",
    selfDeclared: false,
    disqualifying: partial.match === "missing",
    ...partial,
  };
}

function readiness(items: MatchedRequirement[]): ReadinessResult {
  const met = items.filter((row) => row.match === "met").length;
  const toPrepare = items.filter((row) => row.match === "to_prepare").length;
  const gaps = items.filter((row) => row.match === "missing" || row.match === "unclear").length;
  const scored = met + gaps;
  return {
    items,
    met,
    gaps,
    toPrepare,
    couldDisqualify: items.filter((row) => row.disqualifying).length,
    readinessPct: scored === 0 ? 0 : Math.round((met / scored) * 100),
  };
}

function input(partial: Partial<RecommendationInput> & Pick<RecommendationInput, "readiness">): RecommendationInput {
  return {
    facts: [],
    band: "low",
    contractValueKes: 1_000_000,
    daysUntilDeadline: 30,
    ...partial,
  };
}

function fact(partial: Partial<KeyFact> & Pick<KeyFact, "key" | "status">): KeyFact {
  return {
    label: partial.key,
    item: partial.key,
    ...partial,
  };
}

function expectReasons(result: { reasons: { text: string; item: string }[] }) {
  expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  expect(result.reasons.length).toBeLessThanOrEqual(4);
  for (const reason of result.reasons) {
    expect(reason.text.length).toBeGreaterThan(0);
    expect(reason.item.length).toBeGreaterThan(0);
  }
}

describe("recommend", () => {
  it("considers declining when a licence could disqualify us and cannot be obtained in time", () => {
    const text = "Valid NCA category 1 or 2 certificate";
    const result = recommend(
      input({
        readiness: readiness([item({ text, match: "missing", disqualifying: true })]),
        daysUntilDeadline: 30,
        band: "severe",
        contractValueKes: null,
      }),
    );
    expect(result.label).toBe("consider_declining");
    expect(result.rule).toBe("unfixable_disqualifier");
    expect(result.reasons.some((reason) => reason.item === text)).toBe(true);
    expect(result.reasons.some((reason) => /cannot be obtained/i.test(reason.text))).toBe(true);
    expectReasons(result);
  });

  it("considers declining when a missing document has no time left before the deadline", () => {
    const text = "Tender security of KSh 500,000";
    const result = recommend(
      input({
        readiness: readiness([item({ text, match: "missing", disqualifying: true })]),
        daysUntilDeadline: 2,
      }),
    );
    expect(result.label).toBe("consider_declining");
    expect(result.rule).toBe("unfixable_disqualifier");
    expect(result.reasons.some((reason) => reason.item === "Closing date" && /2 days/.test(reason.text))).toBe(true);
    expectReasons(result);
  });

  it("considers declining when payment risk is Severe and no contract value is recorded", () => {
    const result = recommend(
      input({
        readiness: readiness([]),
        band: "severe",
        contractValueKes: null,
      }),
    );
    expect(result.label).toBe("consider_declining");
    expect(result.rule).toBe("severe_without_value");
    expect(result.reasons.map((reason) => reason.item)).toEqual(["Payment risk", "Contract value"]);
    expectReasons(result);
  });

  it("treats an unfixable disqualifier as the first match, ahead of Severe payment risk", () => {
    const result = recommend(
      input({
        readiness: readiness([item({ text: "ICTA certification", match: "missing", disqualifying: true })]),
        band: "severe",
        contractValueKes: null,
        daysUntilDeadline: 40,
      }),
    );
    expect(result.rule).toBe("unfixable_disqualifier");
  });

  it("asks to resolve blockers when a missing document can still be obtained", () => {
    const text = "Bid bond from a bank licensed in Kenya";
    const result = recommend(
      input({
        readiness: readiness([item({ text, match: "missing", disqualifying: true })]),
        daysUntilDeadline: 21,
        facts: [fact({ key: "closing_datetime", status: "blank_in_source", label: "Closing date and time" })],
      }),
    );
    expect(result.label).toBe("resolve_blockers");
    expect(result.rule).toBe("fixable_gaps");
    expect(result.reasons.some((reason) => reason.item === text)).toBe(true);
    expect(result.reasons.some((reason) => reason.item === "Closing date")).toBe(true);
    expectReasons(result);
  });

  it("asks to resolve blockers for a gap that is not a disqualifier", () => {
    const text = "Proof of similar software rollout";
    const result = recommend(
      input({
        readiness: readiness([item({ text, match: "unclear", disqualifying: false })]),
        daysUntilDeadline: null,
      }),
    );
    expect(result.label).toBe("resolve_blockers");
    expect(result.rule).toBe("fixable_gaps");
    expect(result.reasons.some((reason) => reason.item === text && /resolved/i.test(reason.text))).toBe(true);
    expectReasons(result);
  });

  it("seeks clarification when deadline, security or evaluation is blank or needs a person", () => {
    const result = recommend(
      input({
        readiness: readiness([item({ text: "Form of tender", match: "to_prepare", disqualifying: false })]),
        facts: [
          fact({ key: "closing_datetime", status: "blank_in_source", label: "Closing date and time", item: "Closing date and time" }),
          fact({ key: "bid_security", status: "needs_human", label: "Bid security", item: "KSh ____" }),
          fact({ key: "payment_days", status: "blank_in_source", label: "Payment period", item: "within ____ days" }),
          fact({ key: "evaluation_criterion", status: "source_confirmed", label: "Evaluation criterion", item: "Lowest evaluated price" }),
        ],
      }),
    );
    expect(result.label).toBe("seek_clarification");
    expect(result.rule).toBe("unclear_key_facts");
    expect(result.reasons.map((reason) => reason.item)).toEqual(["Closing date and time", "KSh ____"]);
    expect(result.reasons.some((reason) => /blank in the source/.test(reason.text))).toBe(true);
    expect(result.reasons.some((reason) => /needs a person/.test(reason.text))).toBe(true);
    expectReasons(result);
  });

  it("gives two reasons when only one key fact needs clarification", () => {
    const result = recommend(
      input({
        readiness: readiness([]),
        facts: [fact({ key: "evaluation_criterion", status: "needs_human", label: "Evaluation criterion", item: "Pass mark" })],
      }),
    );
    expect(result.label).toBe("seek_clarification");
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[1]?.text).toMatch(/Ask the buyer to confirm evaluation criterion/);
  });

  it("proceeds to preparation when no decline, blocker or clarification rule matches", () => {
    const result = recommend(
      input({
        readiness: readiness([
          item({ text: "Certificate of incorporation", match: "met", disqualifying: false }),
          item({ text: "Form of tender", match: "to_prepare", disqualifying: false }),
        ]),
        band: "moderate",
        facts: [
          fact({ key: "closing_datetime", status: "source_confirmed", label: "Closing date and time" }),
          fact({ key: "bid_security", status: "ai_inferred", label: "Bid security" }),
        ],
      }),
    );
    expect(result.label).toBe("proceed_to_preparation");
    expect(result.rule).toBe("clear");
    expect(result.reasons.some((reason) => reason.item === "Mandatory requirements")).toBe(true);
    expect(result.reasons.some((reason) => /Moderate/.test(reason.text))).toBe(true);
    expect(result.reasons.some((reason) => reason.item === "Forms to prepare")).toBe(true);
    expectReasons(result);
  });

  it("caps a long list of reasons at four", () => {
    const items = [1, 2, 3, 4, 5].map((n) =>
      item({ text: `National Construction Authority licence ${n}`, match: "missing", disqualifying: true }),
    );
    const result = recommend(input({ readiness: readiness(items), daysUntilDeadline: 40 }));
    expect(result.reasons).toHaveLength(4);
  });
});
