import { describe, expect, it } from "vitest";

import {
  approveToast,
  decisionHeading,
  hashForTab,
  isLegacyHash,
  preparationToast,
  reviewPill,
  stageHeading,
  reviewStageNumber,
  stageMark,
  tabFromHash,
  tabFromStage,
  type WorkspaceApproval,
} from "@/lib/tenders/workspace-stages";

const none: WorkspaceApproval = {
  canBid: false,
  canComply: false,
  shouldBid: false,
  decision: false,
  preparation: false,
};

describe("workspace stages", () => {
  it("starts at Interpretation when nothing is approved", () => {
    expect(reviewPill(none)).toBe("IN REVIEW · STAGE 1 OF 5");
    expect(stageMark("interpretation", none)).toBe("current");
    expect(stageMark("compliance", none)).toBe("waiting");
    expect(stageMark("preparation", none)).toBe("waiting");
  });

  it("treats a saved review as done and opens the next tab", () => {
    const approval: WorkspaceApproval = { ...none, canBid: true, canComply: true };
    expect(reviewStageNumber(approval)).toBe(3);
    expect(stageMark("interpretation", approval)).toBe("done");
    expect(stageMark("compliance", approval)).toBe("done");
    expect(stageMark("commercial", approval)).toBe("current");
    expect(stageMark("recommendation", approval)).toBe("waiting");
  });

  it("approves Recommendation from a decision and Bid preparation from the plan", () => {
    const approval: WorkspaceApproval = {
      canBid: true,
      canComply: true,
      shouldBid: true,
      decision: false,
      preparation: true,
    };
    expect(stageMark("recommendation", approval)).toBe("current");
    expect(stageMark("preparation", approval)).toBe("done");
    expect(reviewPill({ ...approval, decision: true })).toBe("IN REVIEW · STAGE 5 OF 5");
  });

  it("uses the stage id as the hash and still accepts the old step hashes", () => {
    expect(hashForTab("interpretation")).toBe("interpretation");
    expect(hashForTab("compliance")).toBe("compliance");
    expect(hashForTab("commercial")).toBe("commercial");
    expect(hashForTab("recommendation")).toBe("recommendation");
    expect(hashForTab("preparation")).toBe("preparation");
    expect(tabFromHash("#interpretation")).toBe("interpretation");
    expect(tabFromHash("#compliance")).toBe("compliance");
    expect(tabFromHash("#preparation")).toBe("preparation");
    expect(tabFromHash("#can_bid")).toBe("interpretation");
    expect(tabFromHash("can_comply")).toBe("compliance");
    expect(tabFromHash("#should_bid")).toBe("commercial");
    expect(tabFromHash("#proceed")).toBe("preparation");
    expect(tabFromHash("#nope")).toBeNull();
    expect(isLegacyHash("#can_bid")).toBe(true);
    expect(isLegacyHash("proceed")).toBe(true);
    expect(isLegacyHash("#compliance")).toBe(false);
  });

  it("reads ?stage= as a tab id, the old hash, or the stage name", () => {
    expect(tabFromStage("compliance")).toBe("compliance");
    expect(tabFromStage("can_comply")).toBe("compliance");
    expect(tabFromStage("#should_bid")).toBe("commercial");
    expect(tabFromStage("Bid preparation")).toBe("preparation");
    expect(tabFromStage("nope")).toBeNull();
    expect(tabFromStage("")).toBeNull();
    expect(tabFromStage(null)).toBeNull();
  });

  it("names the next stage in the approve toast", () => {
    expect(approveToast("interpretation")).toBe("Interpretation approved. Next: Compliance.");
    expect(approveToast("commercial")).toBe("Commercial approved. Next: Recommendation.");
    expect(preparationToast(0, 0)).toBe("Bid preparation reviewed");
    expect(preparationToast(4, 4)).toBe("Bid preparation reviewed");
    expect(preparationToast(19, 20)).toBe("19 of 20");
    expect(preparationToast(0, 8)).toBe("0 of 8");
  });

  it("names the open tab, and adds the decision once one is recorded", () => {
    expect(stageHeading("commercial")).toBe("Stage 3 of 5 · Commercial");
    expect(stageHeading("interpretation")).toBe("Stage 1 of 5 · Interpretation");
    expect(stageHeading("compliance")).toBe("Stage 2 of 5 · Compliance");
    expect(stageHeading("preparation")).toBe("Stage 5 of 5 · Bid preparation");
    expect(decisionHeading(null)).toBeNull();
    expect(decisionHeading("Proceed to preparation")).toBe("Decided: Proceed to preparation");
  });
});
