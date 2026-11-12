import type { ReviewStage } from "./stage-review";

/** Five tabs. Only the first three write `stage_reviews`. Hashes are the old step ids. */
export const WORKSPACE_TABS = [
  { id: "interpretation", hash: "can_bid", label: "Interpretation", review: "can_bid" },
  { id: "compliance", hash: "can_comply", label: "Compliance", review: "can_comply" },
  { id: "commercial", hash: "should_bid", label: "Commercial", review: "should_bid" },
  { id: "recommendation", hash: "recommendation", label: "Recommendation", review: null },
  { id: "preparation", hash: "proceed", label: "Bid preparation", review: null },
] as const;

export type WorkspaceTabId = (typeof WORKSPACE_TABS)[number]["id"];

export interface WorkspaceApproval {
  canBid: boolean;
  canComply: boolean;
  shouldBid: boolean;
  /** A bid decision row exists. */
  decision: boolean;
  /** Every action item is done, or the plan has no items. */
  preparation: boolean;
}

export function tabApproved(id: WorkspaceTabId, approval: WorkspaceApproval): boolean {
  switch (id) {
    case "interpretation":
      return approval.canBid;
    case "compliance":
      return approval.canComply;
    case "commercial":
      return approval.shouldBid;
    case "recommendation":
      return approval.decision;
    case "preparation":
      return approval.preparation;
  }
}

/** 1–5. The first tab that is not approved, or 5 when every tab is approved. */
export function reviewStageNumber(approval: WorkspaceApproval): number {
  const index = WORKSPACE_TABS.findIndex((tab) => !tabApproved(tab.id, approval));
  return index === -1 ? WORKSPACE_TABS.length : index + 1;
}

export function reviewPill(approval: WorkspaceApproval): string {
  return `IN REVIEW · STAGE ${reviewStageNumber(approval)} OF ${WORKSPACE_TABS.length}`;
}

export type StageMark = "done" | "current" | "waiting";

/** Done when approved. Current is the first tab that is not. The rest are waiting. */
export function stageMark(id: WorkspaceTabId, approval: WorkspaceApproval): StageMark {
  if (tabApproved(id, approval)) return "done";
  const first = WORKSPACE_TABS.find((tab) => !tabApproved(tab.id, approval));
  return first?.id === id ? "current" : "waiting";
}

export function tabFromHash(hash: string): WorkspaceTabId | null {
  const bare = hash.replace(/^#/, "");
  return WORKSPACE_TABS.find((tab) => tab.hash === bare)?.id ?? null;
}

export function hashForTab(id: WorkspaceTabId): string {
  const tab = WORKSPACE_TABS.find((item) => item.id === id);
  return tab?.hash ?? "can_bid";
}

export function nextTab(id: WorkspaceTabId): WorkspaceTabId | null {
  const index = WORKSPACE_TABS.findIndex((tab) => tab.id === id);
  return WORKSPACE_TABS[index + 1]?.id ?? null;
}

export function reviewStageForTab(id: WorkspaceTabId): ReviewStage | null {
  const tab = WORKSPACE_TABS.find((item) => item.id === id);
  return tab?.review ?? null;
}

export function tabLabel(id: WorkspaceTabId): string {
  return WORKSPACE_TABS.find((tab) => tab.id === id)?.label ?? id;
}

/** Toast after Approve on Interpretation, Compliance, or Commercial. */
export function approveToast(id: WorkspaceTabId): string {
  const next = nextTab(id);
  if (!next) return "Bid preparation reviewed";
  return `${tabLabel(id)} approved. Next: ${tabLabel(next)}.`;
}

/** Bid preparation does not write a stage. The toast is the plan progress. */
export function preparationToast(done: number, total: number): string {
  if (total === 0 || done === total) return "Bid preparation reviewed";
  return `${done} of ${total} done`;
}
