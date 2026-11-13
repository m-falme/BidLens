import type { ReviewStage } from "./stage-review";

/** Five tabs. Only the first three write `stage_reviews`. The address hash is the tab id. */
export const WORKSPACE_TABS = [
  { id: "interpretation", label: "Interpretation", review: "can_bid" },
  { id: "compliance", label: "Compliance", review: "can_comply" },
  { id: "commercial", label: "Commercial", review: "should_bid" },
  { id: "recommendation", label: "Recommendation", review: null },
  { id: "preparation", label: "Bid preparation", review: null },
] as const;

export type WorkspaceTabId = (typeof WORKSPACE_TABS)[number]["id"];

/** Old step hashes. They still open the stage, then the address is rewritten to the tab id. */
const LEGACY_HASHES: Record<string, WorkspaceTabId> = {
  can_bid: "interpretation",
  can_comply: "compliance",
  should_bid: "commercial",
  proceed: "preparation",
};

export function isLegacyHash(hash: string): boolean {
  const bare = hash.replace(/^#/, "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEGACY_HASHES, bare);
}

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

/** The open tab: "Stage 2 of 5 · Compliance". */
export function stageHeading(tab: WorkspaceTabId): string {
  const index = WORKSPACE_TABS.findIndex((item) => item.id === tab);
  const current = WORKSPACE_TABS[index] ?? WORKSPACE_TABS[0];
  const number = index === -1 ? 1 : index + 1;
  return `Stage ${number} of ${WORKSPACE_TABS.length} · ${current.label}`;
}

/** Shown beside the open tab once a bid decision exists. */
export function decisionHeading(decisionLabel: string | null): string | null {
  if (!decisionLabel) return null;
  return `Decided: ${decisionLabel}`;
}

export type StageMark = "done" | "current" | "waiting";

/** Done when approved. Current is the first tab that is not. The rest are waiting. */
export function stageMark(id: WorkspaceTabId, approval: WorkspaceApproval): StageMark {
  if (tabApproved(id, approval)) return "done";
  const first = WORKSPACE_TABS.find((tab) => !tabApproved(tab.id, approval));
  return first?.id === id ? "current" : "waiting";
}

export function tabFromHash(hash: string): WorkspaceTabId | null {
  const bare = hash.replace(/^#/, "").trim().toLowerCase();
  if (!bare || bare.length > 40) return null;
  const exact = WORKSPACE_TABS.find((tab) => tab.id === bare);
  if (exact) return exact.id;
  return LEGACY_HASHES[bare] ?? null;
}

/** `?stage=` on a tender. Accepts the tab id, the old hash, or the stage name. */
export function tabFromStage(value: string | null | undefined): WorkspaceTabId | null {
  if (!value) return null;
  const bare = value.trim().replace(/^#/, "");
  if (!bare || bare.length > 40) return null;
  const fromHash = tabFromHash(bare);
  if (fromHash) return fromHash;
  const lower = bare.toLowerCase();
  return WORKSPACE_TABS.find((tab) => tab.label.toLowerCase() === lower)?.id ?? null;
}

export function hashForTab(id: WorkspaceTabId): string {
  return id;
}

export function nextTab(id: WorkspaceTabId): WorkspaceTabId | null {
  const index = WORKSPACE_TABS.findIndex((tab) => tab.id === id);
  return WORKSPACE_TABS[index + 1]?.id ?? null;
}

export function previousTab(id: WorkspaceTabId): WorkspaceTabId | null {
  const index = WORKSPACE_TABS.findIndex((tab) => tab.id === id);
  if (index <= 0) return null;
  return WORKSPACE_TABS[index - 1]?.id ?? null;
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

/** Bid preparation does not write a stage. The toast is how many items the team has ticked. */
export function preparationToast(done: number, total: number): string {
  if (total === 0 || done === total) return "Bid preparation reviewed";
  return `${done} of ${total}`;
}
