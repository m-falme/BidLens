import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { extractTenderFields, selectPages, SMALL_DOCUMENT_CHARS, type PipelinePage } from "@/lib/tenders/extract-pipeline";
import { MAIN_FIELD_GROUPS } from "@/lib/tenders/field-catalog";

// A three-page tender with wording from the Nairobi SD-WAN document; page 3 is a scan.
const pages: PipelinePage[] = [
  {
    pageNo: 1,
    text:
      "TENDER NO: NCCG/IDE/T/039/2026-2027\nSUPPLY, INSTALLATION, CONFIGURATION, TESTING AND COMMISSIONING OF SD-WAN\n" +
      "Nairobi City County\nAll Tenders must be accompanied by Tender security of ksh. 420,000/- [Four hundred twenty thousand]\n" +
      "ITT 20.1 The Tender validity period shall be 120 days.",
    needsOcr: false,
  },
  {
    pageNo: 2,
    text:
      "6.5.1 Payments shall be made within ____________________ days of receipt of the invoice.\n" +
      "The interest rate is ____________________.\n" +
      "MANDATORY REQUIREMENTS 1 Copy of Certificate of Incorporation 2 Valid Tax Compliance Certificate",
    needsOcr: false,
  },
  { pageNo: 3, text: "", needsOcr: true },
];

const item = (value: string | null, page: number | null, quote: string | null, confidence = 0.9) => ({
  value,
  page,
  quote,
  confidence,
});
const none = item(null, null, null, 0);

/** Canned model answers per group, keyed by a field the group's prompt asks for. */
const answers: Record<string, unknown> = {
  "- buyer:": {
    buyer: item("Nairobi City County", 1, "Nairobi City County"),
    county: item("Nairobi", 1, "Nairobi City County"),
    reference_number: item("NCCG/IDE/T/039/2026-2027", 1, "TENDER NO: NCCG/IDE/T/039/2026-2027"),
    title: item("Supply of SD-WAN", 1, "SUPPLY, INSTALLATION, CONFIGURATION"),
    // Invented contact: the quote is nowhere in the document.
    contact: item("procurement@nairobi.go.ke", 1, "Email: procurement@nairobi.go.ke"),
  },
  "- closing_datetime:": {
    closing_datetime: none,
    submission_method: none,
    tender_validity: item("120 days", 1, "The Tender validity period shall be 120 days."),
    bid_security: item("ksh. 420,000/-", 1, "accompanied by Tender security of ksh. 420,000/-"),
  },
  "- performance_security:": {
    // Right quote, wrong page.
    performance_security: item("10%", 2, "Tender security of ksh. 420,000/-"),
  },
  "- payment_terms:": {
    payment_terms: none,
    payment_days: item(null, 2, "Payments shall be made within ____________________ days of receipt of the invoice."),
    advance_payment: none,
    late_payment_interest: item(null, 2, "The interest rate is ____________________."),
  },
  "- mandatory_requirement:": {
    mandatory_requirement: [
      item("Copy of Certificate of Incorporation", 2, "1 Copy of Certificate of Incorporation"),
      item("Valid Tax Compliance Certificate", 2, "2 Valid Tax Compliance Certificate"),
      none,
    ],
  },
  "- technical_scope:": { technical_scope: [item("SD-WAN", 1, "COMMISSIONING OF SD-WAN")] },
  "- evaluation_criterion:": { evaluation_criterion: [] },
};

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

function mockModel(overrides: Record<string, string[]> = {}) {
  const calls: Record<string, number> = {};
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const prompt = JSON.stringify(options.prompt);
      const marker = Object.keys({ ...answers, ...overrides, "- eligibility:": 1 }).find((m) =>
        prompt.includes(JSON.stringify(m).slice(1, -1)),
      )!;
      calls[marker] = (calls[marker] ?? 0) + 1;
      const scripted = overrides[marker];
      const text = scripted ? scripted[Math.min(calls[marker], scripted.length) - 1] : JSON.stringify(answers[marker]);
      return { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
    },
  });
  return { model, calls };
}

describe("extractTenderFields (mocked LLM)", () => {
  it("verifies every field in code: confirmed, inferred, blank and downgraded", async () => {
    const { model, calls } = mockModel({
      // Eligibility fails validation twice (confidence out of range), so it must become needs_human.
      "- eligibility:": ['{"eligibility":[{"value":"x","page":1,"quote":"x","confidence":7}]}'],
    });
    const result = await extractTenderFields({ pages, role: "main", documentLabel: "test.pdf", model });
    const byKey = (key: string) => result.fields.filter((f) => f.key === key);
    const one = (key: string) => byKey(key)[0];

    expect(one("reference_number")).toMatchObject({ status: "source_confirmed", pageNo: 1 });
    expect(one("tender_validity")).toMatchObject({ status: "source_confirmed", value: "120 days" });
    expect(one("bid_security").status).toBe("source_confirmed");
    // "Nairobi" is inside the quote "Nairobi City County": confirmed by code.
    expect(one("county").status).toBe("source_confirmed");
    // Paraphrased title: the quote is real but the value is the model's reading of it.
    expect(one("title")).toMatchObject({ status: "ai_inferred", reason: "value_interpreted" });

    // The invented contact and the wrong-page quote are downgraded, never kept as confirmed.
    expect(one("contact")).toMatchObject({ status: "needs_human", reason: "quote_not_on_page" });
    expect(one("performance_security")).toMatchObject({ status: "needs_human", reason: "quote_not_on_page" });

    // Blank clauses stay blank: no value is filled in.
    expect(one("late_payment_interest")).toMatchObject({ status: "blank_in_source", value: null, pageNo: 2 });
    expect(one("payment_days")).toMatchObject({ status: "blank_in_source", value: null });

    // Not found in the main tender: kept as a visible gap for a human.
    expect(one("closing_datetime")).toMatchObject({ status: "needs_human", reason: "not_found", value: null });

    // List items keep document order; the empty item is dropped.
    expect(byKey("mandatory_requirement").map((f) => [f.ordinal, f.status])).toEqual([
      [0, "source_confirmed"],
      [1, "source_confirmed"],
    ]);
    expect(byKey("evaluation_criterion")).toEqual([]);

    // Schema failure: one corrective retry, then needs_human, and the page still renders.
    expect(calls["- eligibility:"]).toBe(2);
    expect(result.groups.eligibility).toMatchObject({ ok: false, attempts: 2 });
    expect(byKey("eligibility")).toEqual([
      expect.objectContaining({ status: "needs_human", reason: "extraction_failed", value: null, confidence: 0 }),
    ]);

    // Scanned page 3 is never sent; every other group succeeded on the first attempt.
    expect(result.groups.identity).toMatchObject({ ok: true, attempts: 1, pages: [1, 2] });
    expect(result.promptVersion).toBe("extract-tender.v1");
  });

  it("recovers when the retry with the zod error succeeds", async () => {
    const { model, calls } = mockModel({
      "- evaluation_criterion:": ['{"evaluation_criterion":"not a list"}', '{"evaluation_criterion":[]}'],
    });
    const result = await extractTenderFields({ pages, role: "main", documentLabel: "test.pdf", model });
    expect(calls["- evaluation_criterion:"]).toBe(2);
    expect(result.groups.evaluation).toMatchObject({ ok: true, attempts: 2 });
    const retryPrompt = JSON.stringify(model.doGenerateCalls.at(-1)?.prompt ?? "");
    expect(model.doGenerateCalls.some((c) => JSON.stringify(c.prompt).includes("previous answer was rejected"))).toBe(true);
    expect(retryPrompt.length).toBeGreaterThan(0);
  });

  it("drops fields an addendum does not mention instead of reporting them as gaps", async () => {
    const { model } = mockModel({
      "- addendum_change:": [
        JSON.stringify({
          addendum_change: [
            {
              ...item("Tender validity confirmed", 1, "The Tender validity period shall be 120 days."),
              affects: "tender_validity",
            },
          ],
        }),
      ],
    });
    const result = await extractTenderFields({ pages, role: "addendum", documentLabel: "addendum.pdf", model });
    expect(result.fields.find((f) => f.key === "closing_datetime")).toBeUndefined();
    expect(result.fields.find((f) => f.key === "addendum_change")).toMatchObject({
      affectsKey: "tender_validity",
      status: "ai_inferred",
    });
  });
});

describe("selectPages", () => {
  it("sends a short document whole and a long one through BM25 plus pinned pages", () => {
    const short = selectPages(pages, MAIN_FIELD_GROUPS);
    expect(short.get("payment")).toEqual([1, 2]);

    const filler = "lorem ipsum dolor sit amet ".repeat(80);
    const long: PipelinePage[] = Array.from({ length: 60 }, (_, i) => ({
      pageNo: i + 1,
      text: i === 41 ? `${filler} The interest rate is ____. Payments within ____ days of invoice.` : filler,
      needsOcr: false,
    }));
    expect(long.reduce((n, p) => n + p.text.length, 0)).toBeGreaterThan(SMALL_DOCUMENT_CHARS);
    const selection = selectPages(long, MAIN_FIELD_GROUPS);
    expect(selection.get("payment")).toEqual([42]);
    expect(selection.get("identity")).toEqual([1, 2, 3]);
  });
});
