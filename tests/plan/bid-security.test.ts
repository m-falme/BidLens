import { describe, expect, it } from "vitest";

import {
  BID_SECURITY_PAID_KEY,
  buildActionPlan,
  mergeSaved,
  type PlanField,
  type PlanRequirement,
} from "@/lib/plan/build";
import { planDoneText, planState, preparationPill } from "@/lib/plan/state";
import { rowPill, type OverviewTender } from "@/lib/overview/build";

const AS_OF = new Date("2026-11-13T09:00:00.000Z");

function requirement(partial: Partial<PlanRequirement> & Pick<PlanRequirement, "text" | "match">): PlanRequirement {
  return { pageNo: 12, expired: false, documentName: null, ...partial };
}

function plan(requirements: PlanRequirement[], fields: PlanField[] = []) {
  return buildActionPlan({ requirements, fields, deadlineAt: null, asOf: AS_OF });
}

const BOND_MISSING = requirement({ text: "A bid bond of KSh 500,000 from a licensed bank", match: "missing" });
const OTHER_MISSING = requirement({ text: "Valid tax compliance certificate", match: "missing", pageNo: 13 });

describe("Bid security paid plan item", () => {
  it("sits right after the bid bond row, ahead of other documents, and is locked while the bond is missing", () => {
    const titles = plan([BOND_MISSING, OTHER_MISSING]).documents.map((item) => item.title);
    expect(titles).toEqual(["A bid bond of KSh 500,000 from a licensed bank", "Bid security paid", "Valid tax compliance certificate"]);
    const paid = plan([BOND_MISSING]).documents.find((item) => item.key === BID_SECURITY_PAID_KEY);
    expect(paid?.missing).toBe(true);
    expect(paid?.detail).toMatch(/Waiting for the bid bond/);
  });

  it("can be ticked once the bond is held", () => {
    const held = plan([requirement({ text: "A bid bond of KSh 500,000", match: "met" })]);
    const paid = held.documents.find((item) => item.key === BID_SECURITY_PAID_KEY);
    expect(paid?.missing).toBe(false);
    const rows = mergeSaved(held, [{ itemKey: BID_SECURITY_PAID_KEY, ownerName: null, dueOn: null, done: true }]);
    expect(planState(rows)).toMatchObject({ bidSecurityPaid: true });
  });

  it("ignores a saved tick while the bond is still missing", () => {
    const rows = mergeSaved(plan([BOND_MISSING]), [
      { itemKey: BID_SECURITY_PAID_KEY, ownerName: null, dueOn: null, done: true },
    ]);
    expect(planState(rows).bidSecurityPaid).toBe(false);
  });

  it("is absent when the tender asks for no bid security", () => {
    expect(plan([OTHER_MISSING]).items.some((item) => item.key === BID_SECURITY_PAID_KEY)).toBe(false);
    const none = plan([], [{ key: "bid_security", status: "source_confirmed", value: "Not required", pageNo: 7, role: "main", ordinal: 0 }]);
    expect(none.items.some((item) => item.key === BID_SECURITY_PAID_KEY)).toBe(false);
  });

  it("appears when only the bid security fact is stated", () => {
    const stated = plan([], [{ key: "bid_security", status: "source_confirmed", value: "KSh 420,000", pageNo: 7, role: "main", ordinal: 0 }]);
    const paid = stated.documents.find((item) => item.key === BID_SECURITY_PAID_KEY);
    expect(paid?.pageNo).toBe(7);
    expect(paid?.missing).toBe(false);
  });
});

describe("preparation progress on the list", () => {
  it("formats X of Y done and hides it for an empty plan", () => {
    expect(planDoneText({ done: 3, total: 8, bidSecurityPaid: false })).toBe("3 of 8 done");
    expect(planDoneText({ done: 0, total: 0, bidSecurityPaid: false })).toBeNull();
    expect(planDoneText(null)).toBeNull();
  });

  it("moves the pill forward only after Proceed to preparation was recorded", () => {
    const state = { done: 3, total: 8, bidSecurityPaid: true };
    expect(preparationPill("proceed_to_preparation", state)).toEqual({ label: "Preparing", ready: false });
    expect(preparationPill("proceed_to_preparation", { ...state, done: 8 })).toEqual({
      label: "Ready for final review",
      ready: true,
    });
    expect(preparationPill("seek_clarification", state)).toBeNull();
    expect(preparationPill(null, state)).toBeNull();
    expect(preparationPill("proceed_to_preparation", null)).toBeNull();
  });

  it("drives the Overview row pill", () => {
    const base: OverviewTender = {
      id: "t",
      title: "T",
      buyer: null,
      reference: null,
      closing: null,
      deadlineAt: null,
      needsHuman: 0,
      missingMandatory: 0,
      addendumConflicts: 0,
      finalLabel: "proceed_to_preparation",
      reviewedStages: [],
    };
    expect(rowPill(base).label).toBe("Proceed to preparation");
    expect(rowPill({ ...base, plan: { done: 3, total: 8, bidSecurityPaid: false } })).toEqual({
      label: "Preparing",
      tone: "warning",
    });
    expect(rowPill({ ...base, plan: { done: 8, total: 8, bidSecurityPaid: true } })).toEqual({
      label: "Ready for final review",
      tone: "confirmed",
    });
  });
});
