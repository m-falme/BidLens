import { BID_SECURITY_PAID_KEY, planProgress } from "@/lib/plan/build";
import type { RecommendationLabel } from "@/lib/recommendation/labels";

/**
 * What the list pages show about bid preparation. Derived from saved ticks only:
 * nothing here is written to bid_decisions or opportunities.status.
 */
export interface PlanState {
  done: number;
  total: number;
  bidSecurityPaid: boolean;
}

export function planState(rows: readonly { key: string; done: boolean; missing?: boolean }[]): PlanState {
  const progress = planProgress(rows);
  return {
    done: progress.done,
    total: progress.total,
    bidSecurityPaid: rows.some((row) => row.key === BID_SECURITY_PAID_KEY && row.done && row.missing !== true),
  };
}

/** "3 of 8 done". Null when the tender has no plan items. */
export function planDoneText(state: PlanState | null | undefined): string | null {
  if (!state || state.total === 0) return null;
  return `${state.done} of ${state.total} done`;
}

export interface PreparationPill {
  label: string;
  /** true once every plan item is ticked. */
  ready: boolean;
}

/**
 * Replaces "Proceed to preparation" once a person has recorded that decision.
 * It never says submitted or sent: a person still reviews and submits outside BidLens.
 */
export function preparationPill(
  finalLabel: RecommendationLabel | null,
  state: PlanState | null | undefined,
): PreparationPill | null {
  if (finalLabel !== "proceed_to_preparation" || !state || state.total === 0) return null;
  if (state.done === state.total) return { label: "Ready for final review", ready: true };
  // The count sits next to the pill ("3 of 8 done"), so the pill does not repeat it.
  return { label: "Preparing", ready: false };
}
