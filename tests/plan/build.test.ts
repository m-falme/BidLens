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
    field({ key: "tender_validity", status: "source_confirmed", value: "120 days", pageNo: 3 }),
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

  it("prepares forms and the response, and does not repeat the compliance list", () => {
    expect(plan.outline.map((item) => [item.title, item.pageNo, item.detail])).toEqual([
      ["Duly filled form of tender", 8, "Form"],
      ["Technical evaluation", 10, "Response"],
      ["Financial evaluation", 40, "Response"],
    ]);
    expect(plan.outline.map((item) => item.title)).not.toContain("Copy of valid Tax Compliance Certificate");
    expect(plan.outline.map((item) => item.title)).not.toContain("Certificate of incorporation");
  });

  it("shows the closing date and time, bid validity and bond validity", () => {
    expect(plan.dates.map((item) => item.title)).toEqual([
      "Closing date and time",
      "Bid validity",
      "Bond validity",
    ]);
    expect(plan.dates[0].detail).toBe("20 November 2026 at 11:00 a.m. 7 days left.");
    expect(plan.dates[0].pageNo).toBe(2);
    expect(plan.dates[1].detail).toBe("120 days.");
    expect(plan.dates[1].pageNo).toBe(3);
    expect(plan.dates[2].detail).toBe("Not stated in the extracted facts.");
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
    expect(onlyClosing.dates.map((item) => item.title)).toEqual([
      "Closing date and time",
      "Bid validity",
      "Bond validity",
    ]);
  });

  it("keeps an owner and a tick on the same item key", () => {
    const first = plan.items.map((item) => item.key);
    const second = buildActionPlan({ requirements, fields, deadlineAt: null, asOf: AS_OF }).items.map((item) => item.key);
    expect(second).toEqual(first);
    const rows = mergeSaved(plan, [
      { itemKey: plan.documents[1].key, ownerName: "Amina", dueOn: "2026-11-18", done: true },
      { itemKey: plan.documents[0].key, ownerName: "James", dueOn: null, done: true },
      { itemKey: "gone", ownerName: "James", dueOn: null, done: true },
    ]);
    expect(rows[1]).toMatchObject({ ownerName: "Amina", dueOn: "2026-11-18", done: true, missing: false });
    expect(rows[0]).toMatchObject({ ownerName: "James", done: false, missing: true });
    const progress = planProgress(rows);
    expect(progress.done).toBe(1);
    expect(progress.label).toBe(`1 of ${rows.length}`);
    expect(preparationIsDone(progress)).toBe(false);
    const marked = rows.map((row, index) => ({ ...row, done: index < 3 && !row.missing }));
    expect(planProgress(marked).label).toBe(`2 of ${marked.length}`);
    const nineteen = Array.from({ length: 20 }, (_, index) => ({ done: index < 19 }));
    expect(planProgress(nineteen)).toEqual({ done: 19, total: 20, missing: 0, label: "19 of 20" });
    const allDone = nineteen.map(() => ({ done: true }));
    expect(planProgress(allDone)).toEqual({ done: 20, total: 20, missing: 0, label: "20 of 20" });
    expect(preparationIsDone(planProgress(allDone))).toBe(true);
    expect(planProgress([{ done: true, missing: true }])).toEqual({
      done: 0,
      total: 1,
      missing: 1,
      label: "0 of 1",
    });
    expect(planProgress([])).toEqual({ done: 0, total: 0, missing: 0, label: "0 of 0" });
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

  it("keeps bid bond delivery steps in Get and the bond period on Key dates", () => {
    const text =
      "13. Attach a bid bond of Kshs. 800,000.00 from a CBK-licensed bank or IRA-regulated insurer and must remain valid for 170 days after the opening date of the tender. Note: A clear colored scanned copy must be uploaded into the IFMIS tender portal. Additionally, the original bid bond must be delivered physically to the office of the Chief Officer before closing.";
    const dated = buildActionPlan({
      requirements: [requirement({ text, match: "missing", pageNo: 13 })],
      fields: [],
      deadlineAt: null,
      asOf: AS_OF,
    });
    expect(dated.documents.map((item) => item.detail)).toEqual(["Missing.", "Bid bond delivery.", "Bid bond delivery."]);
    expect(dated.documents[1].title).toContain("uploaded into the IFMIS");
    expect(dated.documents[2].title).toContain("delivered physically");
    expect(dated.documents[0].missing).toBe(true);
    expect(dated.documents[1].missing).toBe(false);
    expect(dated.outline).toEqual([]);
    const bond = dated.dates.find((item) => item.title === "Bond validity");
    expect(bond?.detail).toBe("must remain valid for 170 days after the opening date of the tender.");
    expect(bond?.pageNo).toBe(13);
    expect(bond?.detail).not.toContain("IFMIS");
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
