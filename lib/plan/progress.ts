import "server-only";

import { getWorkspaceName } from "@/lib/db/queries/company";
import { listDemoCapabilities } from "@/lib/db/queries/readiness";
import { getServiceClient } from "@/lib/db/supabase-server";
import type { SavedAction } from "@/lib/plan/build";
import { planFromData, type PlanSourceField } from "@/lib/plan/load";
import { planState, type PlanState } from "@/lib/plan/state";

const KINDS = new Set(["document", "question", "outline", "date"]);

/**
 * Plan progress for several tenders, for the list pages. It loads what the plans need once (company papers, ticks,
 * sources, deadlines) and each tender's facts in parallel, then builds every plan with the same code as the tender
 * page, so the total always matches. It does not load pages or file links. A tender whose plan cannot be built is
 * left out and its row simply shows no progress. The page never fails because of it.
 */
export async function loadPlanStates(tenderIds: readonly string[]): Promise<Map<string, PlanState>> {
  const states = new Map<string, PlanState>();
  if (tenderIds.length === 0) return states;
  try {
    const db = getServiceClient();
    const ids = [...tenderIds];
    const [opportunities, sources, items, capabilities, workspaceName, fieldSets] = await Promise.all([
      db.from("opportunities").select("id, deadline_at").in("id", ids),
      db.from("sources").select("id, opportunity_id, role").in("opportunity_id", ids),
      db.from("action_items").select("tender_id, item_key, kind, owner_name, due_on, done").in("tender_id", ids),
      listDemoCapabilities(),
      getWorkspaceName(),
      // One query per tender keeps each answer well under the API's row limit.
      Promise.all(
        ids.map((id) =>
          db
            .from("fields")
            .select("opportunity_id, source_id, key, value, status, page_no, ordinal")
            .eq("opportunity_id", id)
            .order("key")
            .order("ordinal"),
        ),
      ),
    ]);
    if (opportunities.error) throw new Error(opportunities.error.message);
    if (sources.error) throw new Error(sources.error.message);
    if (items.error) throw new Error(items.error.message);
    for (const set of fieldSets) if (set.error) throw new Error(set.error.message);

    const deadlines = new Map(opportunities.data.map((row) => [row.id, row.deadline_at]));
    const roles = new Map<string, Map<string, string>>();
    for (const source of sources.data) {
      if (!source.opportunity_id) continue;
      const forTender = roles.get(source.opportunity_id) ?? new Map<string, string>();
      forTender.set(source.id, source.role);
      roles.set(source.opportunity_id, forTender);
    }
    const saved = new Map<string, SavedAction[]>();
    for (const row of items.data) {
      if (!KINDS.has(row.kind)) continue;
      const forTender = saved.get(row.tender_id) ?? [];
      forTender.push({
        itemKey: row.item_key,
        ownerName: row.owner_name,
        dueOn: row.due_on ? String(row.due_on).slice(0, 10) : null,
        done: row.done,
      });
      saved.set(row.tender_id, forTender);
    }

    ids.forEach((id, index) => {
      try {
        const fields: PlanSourceField[] = (fieldSets[index].data ?? []).map((field) => ({
          key: field.key,
          value: field.value,
          status: field.status,
          page_no: field.page_no,
          source_id: field.source_id,
          ordinal: field.ordinal,
        }));
        const { rows } = planFromData({
          fields,
          sourceRoles: roles.get(id) ?? new Map(),
          deadlineAt: deadlines.get(id) ?? null,
          saved: saved.get(id) ?? [],
          capabilities,
          workspaceName,
        });
        states.set(id, planState(rows));
      } catch (error) {
        console.error("plan progress", id, error);
      }
    });
  } catch (error) {
    console.error("plan progress", error);
  }
  return states;
}
