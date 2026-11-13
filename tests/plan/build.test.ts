import { describe, expect, it } from "vitest";

import {
  buildActionPlan,
  clarificationQuestion,
  daysLeftLabel,
  isDocumentToGet,
  mergeSaved,
  planProgress,
  preparationIsDone,
  type PlanField,
  type PlanRequirement,
} from "@/lib/plan/build";
import { parseActionItem } from "@/lib/plan/save";

const AS_OF = new Date("2026-11-13T09:00:00.000Z");
const TENDER = "11111111-1111-4111-8111-111111111111";

function requirement(partial: Partial<PlanRequirement> & Pick<PlanRequirement, "text" | "match">): PlanRequirement {
  return {
    pageNo: 12,
    expired: false,
    documentName: null,
    ...partial,
  };
}

function field(partial: Partial<PlanField> & Pick<PlanField, "key" | "status">): PlanField {
  return {
    value: null,
    pageNo: null,
    role: "main",
    ordinal: 0,
    ...partial,
  };
}

describe("clarification questions", () => {
  it("asks about a blank performance security with its page", () => {
    expect(
      clarificationQuestion({
        key: "performance_security",
        label: "Performance security",
        status: "blank_in_source",
        pageNo: 207,
      }),
    ).toBe("Please confirm the performance security amount (page 207 is blank).");
  });

  it("asks a person to check when the fact is not verified", () => {
    expect(
      clarificationQuestion({
        key: "performance_security",
        label: "Performance security",
        status: "needs_human",
        pageNo: 12,
      }),
    ).toBe("Please confirm the performance security amount (page 12 needs a person to check).");
  });
});

describe("buildActionPlan", () => {
  const requirements: PlanRequirement[] = [
    requirement({ text: "Copy of valid Tax Compliance Certificate", match: "missing", pageNo: 30 }),
    requirement({
      text: "Copy of the bid bond",
      match: "missing",
      expired: true,
      documentName: "Bid bond",
      pageNo: 7,
    }),
    requirement({ text: "Duly filled form of tender", match: "to_prepare", pageNo: 8 }),
    requirement({ text: "Certificate of incorporation", match: "met", pageNo: 9, documentName: "Certificate of incorporation" }),
    requirement({ text: "Provide reference sites for three similar contracts", match: "missing", pageNo: 15 }),
  ];

  const fields: PlanField[] = [
    field({
      key: "closing_datetime",
      status: "source_confirmed",
      value: "20 November 2026 at 11:00 a.m.",
      pageNo: 2,
    }),
    field({ key: "performance_security", status: "blank_in_source", pageNo: 207 }),
    field({ key: "bid_security", status: "source_confirmed", value: "KSh 500,000", pageNo: 2 }),
    field({ key: "late_payment_interest", status: "needs_human", pageNo: 180, label: "Interest on late payment" }),
    field({
      key: "evaluation_criterion",
      status: "source_confirmed",
      value: "Financial evaluation",
      pageNo: 40,
      ordinal: 2,
    }),
    field({
      key: "evaluation_criterion",
      status: "source_confirmed",
      value: "Technical evaluation",
      pageNo: 10,
      ordinal: 1,
    }),
    field({
      key: "eligibility",
      status: "source_confirmed",
      value: "Clarifications must be sought by 18 November 2026",
      pageNo: 4,
      ordinal: 1,
    }),
    field({
      key: "technical_scope",
      status: "source_confirmed",
      value: "A mandatory site visit will be held on 15 November 2026 at the depot.",
      pageNo: 6,
      ordinal: 1,
    }),
  ];

  const plan = buildActionPlan({ requirements, fields, deadlineAt: null, asOf: AS_OF });

  it("lists missing and expired documents with the requirement and page, and skips forms and experience", () => {
    expect(plan.documents.map((item) => item.title)).toEqual([
      "Copy of valid Tax Compliance Certificate",
      "Copy of the bid bond",
    ]);
    expect(plan.documents[0]).toMatchObject({ pageNo: 30, detail: "Missing." });
    expect(plan.documents[1].detail).toBe("Expired. Company record: Bid bond.");
    expect(plan.documents[1].pageNo).toBe(7);
    expect(isDocumentToGet({ match: "to_prepare", text: "Form of tender" })).toBe(false);
    expect(isDocumentToGet({ match: "missing", text: "reference sites for similar contracts" })).toBe(false);
  });

  it("writes one question per blank or needs-human key fact", () => {
    expect(plan.questions.map((item) => item.question)).toEqual([
      "Please confirm the performance security amount (page 207 is blank).",
      "Please confirm the late-payment interest rate (page 180 needs a person to check).",
    ]);
  });

  it("orders the outline as evaluation criteria, then mandatory requirements, each with its page", () => {
    expect(plan.outline.map((item) => [item.title, item.pageNo, item.detail])).toEqual([
      ["Technical evaluation", 10, "Evaluation criterion"],
      ["Financial evaluation", 40, "Evaluation criterion"],
      ["Copy of valid Tax Compliance Certificate", 30, "Mandatory requirement"],
      ["Copy of the bid bond", 7, "Mandatory requirement"],
      ["Duly filled form of tender", 8, "Mandatory requirement"],
      ["Certificate of incorporation", 9, "Mandatory requirement"],
      ["Provide reference sites for three similar contracts", 15, "Mandatory requirement"],
    ]);
  });

  it("shows the submission deadline, clarification deadline and site visit with days left", () => {
    expect(plan.dates.map((item) => item.title)).toEqual([
      "Submission deadline",
      "Clarification deadline",
      "Site visit",
    ]);
    expect(plan.dates[0].detail).toBe("20 November 2026 at 11:00 a.m. 7 days left.");
    expect(plan.dates[0].pageNo).toBe(2);
    expect(plan.dates[1].detail).toContain("5 days left.");
    expect(plan.dates[1].pageNo).toBe(4);
    expect(plan.dates[2].detail).toContain("2 days left.");
    expect(plan.dates[2].pageNo).toBe(6);
    expect(daysLeftLabel(1)).toBe("1 day left.");
    expect(daysLeftLabel(null)).toBe("Days left are not shown.");
  });

  it("does not treat a closing line that mentions clarifications as the clarification deadline", () => {
    const onlyClosing = buildActionPlan({
      requirements: [],
      fields: [
        field({
          key: "closing_datetime",
          status: "source_confirmed",
          value: "20 November 2026. Clarifications by email.",
          pageNo: 2,
        }),
      ],
      deadlineAt: null,
      asOf: AS_OF,
    });
    expect(onlyClosing.dates.map((item) => item.title)).toEqual(["Submission deadline"]);
  });

  it("keeps an owner and a tick on the same item key", () => {
    const first = plan.items.map((item) => item.key);
    const second = buildActionPlan({ requirements, fields, deadlineAt: null, asOf: AS_OF }).items.map((item) => item.key);
    expect(second).toEqual(first);
    const rows = mergeSaved(plan, [
      { itemKey: plan.documents[0].key, ownerName: "Amina", dueOn: "2026-11-18", done: true },
      { itemKey: "gone", ownerName: "James", dueOn: null, done: true },
    ]);
    expect(rows[0]).toMatchObject({ ownerName: "Amina", dueOn: "2026-11-18", done: true });
    expect(rows[1]).toMatchObject({ ownerName: "", dueOn: "", done: false });
    const progress = planProgress(rows);
    expect(progress.label).toBe(`1 of ${rows.length} · ${rows.length - 1} missing`);
    expect(preparationIsDone(progress)).toBe(false);
    const marked = rows.map((row, index) => ({ ...row, done: index < 3 }));
    expect(planProgress(marked).label).toBe(`3 of ${marked.length} · ${marked.length - 3} missing`);
    const nineteen = Array.from({ length: 20 }, (_, index) => ({ done: index < 19 }));
    expect(planProgress(nineteen)).toEqual({ done: 19, total: 20, missing: 1, label: "19 of 20 · 1 missing" });
    const allDone = nineteen.map(() => ({ done: true }));
    expect(planProgress(allDone)).toEqual({ done: 20, total: 20, missing: 0, label: "20 of 20 done" });
    expect(preparationIsDone(planProgress(allDone))).toBe(true);
  });

  it("uses the addendum closing date when one is present", () => {
    const dated = buildActionPlan({
      requirements: [],
      fields: [
        field({
          key: "closing_datetime",
          status: "source_confirmed",
          value: "20 November 2026",
          pageNo: 2,
          role: "main",
        }),
        field({
          key: "closing_datetime",
          status: "source_confirmed",
          value: "1 December 2026",
          pageNo: 3,
          role: "addendum",
        }),
      ],
      deadlineAt: "2026-11-20T08:00:00+03:00",
      asOf: AS_OF,
    });
    expect(dated.dates[0].detail).toContain("1 December 2026");
    expect(dated.dates[0].pageNo).toBe(3);
    expect(dated.dates[0].detail).not.toContain("20 November 2026");
  });

  it("does not show a tender requirement line as a company record", () => {
    const line = "Attach a bid bond of Kshs 800,000";
    const dated = buildActionPlan({
      requirements: [requirement({ text: line, match: "missing", documentName: line, pageNo: 13 })],
      fields: [],
      deadlineAt: null,
      asOf: AS_OF,
    });
    expect(dated.documents[0].detail).toBe("Missing.");
    expect(dated.documents[0].detail).not.toContain("Company record");
    expect(dated.documents[0].detail).not.toContain(line);
  });
});

describe("parseActionItem", () => {
  it("keeps a name, a date and a tick, and clears blanks", () => {
    expect(
      parseActionItem({
        tenderId: TENDER,
        itemKey: " document:30:tax ",
        kind: "document",
        ownerName: "  Amina  ",
        dueOn: "2026-11-18",
        done: true,
      }),
    ).toEqual({
      ok: true,
      value: {
        tenderId: TENDER,
        itemKey: "document:30:tax",
        kind: "document",
        ownerName: "Amina",
        dueOn: "2026-11-18",
        done: true,
      },
    });
    const cleared = parseActionItem({
      tenderId: TENDER,
      itemKey: "date:submission",
      kind: "date",
      ownerName: "   ",
      dueOn: "",
      done: false,
    });
    expect(cleared.ok && cleared.value.ownerName).toBeNull();
    expect(cleared.ok && cleared.value.dueOn).toBeNull();
  });

  it("rejects a bad date and an unknown tender", () => {
    expect(
      parseActionItem({
        tenderId: TENDER,
        itemKey: "date:submission",
        kind: "date",
        ownerName: "Amina",
        dueOn: "18/11/2026",
        done: false,
      }),
    ).toMatchObject({ ok: false, error: "Enter a due date as YYYY-MM-DD." });
    expect(
      parseActionItem({
        tenderId: "not-a-tender",
        itemKey: "date:submission",
        kind: "date",
        ownerName: "",
        dueOn: "",
        done: false,
      }),
    ).toMatchObject({ ok: false, error: "That tender was not found." });
  });
});
