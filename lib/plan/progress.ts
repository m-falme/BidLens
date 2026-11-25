import "server-only";

import { loadPrintablePlan } from "@/lib/plan/load";
import { planState, type PlanState } from "@/lib/plan/state";

/**
 * Plan progress for several tenders, for the list pages. The plan is rebuilt from the extracted facts
 * and the company documents, so the total always matches the tender page. A tender whose plan cannot be
 * built is left out and its row simply shows no progress. The page never fails because of it.
 */
export async function loadPlanStates(tenderIds: readonly string[]): Promise<Map<string, PlanState>> {
  const entries = await Promise.all(
    tenderIds.map(async (id): Promise<[string, PlanState] | null> => {
      try {
        const plan = await loadPrintablePlan(id);
        return plan ? [id, planState(plan.rows)] : null;
      } catch (error) {
        console.error("plan progress", id, error);
        return null;
      }
    }),
  );
  return new Map(entries.flatMap((entry) => (entry ? [entry] : [])));
}
