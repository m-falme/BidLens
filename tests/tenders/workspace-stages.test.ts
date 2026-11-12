import { describe, expect, it } from "vitest";

import {
  approveToast,
  preparationToast,
  reviewPill,
  reviewStageNumber,
  stageMark,
  tabFromHash,
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

  it("keeps the old step hashes", () => {
    expect(tabFromHash("#can_bid")).toBe("interpretation");
    expect(tabFromHash("can_comply")).toBe("compliance");
    expect(tabFromHash("#should_bid")).toBe("commercial");
    expect(tabFromHash("#proceed")).toBe("preparation");
    expect(tabFromHash("#nope")).toBeNull();
  });

  it("names the next stage in the approve toast", () => {
    expect(approveToast("interpretation")).toBe("Interpretation approved. Next: Compliance.");
    expect(approveToast("commercial")).toBe("Commercial approved. Next: Recommendation.");
    expect(preparationToast(0, 0)).toBe("Bid preparation reviewed");
    expect(preparationToast(4, 4)).toBe("Bid preparation reviewed");
    expect(preparationToast(1, 6)).toBe("1 of 6 done");
  });
});
