import "server-only";

import type { ActionKind, SavedAction } from "@/lib/plan/build";
import type { ActionItemDraft } from "@/lib/plan/save";

import { getServiceClient } from "../supabase-server";
import { getDemoCompanyId } from "./tenders";

const KINDS = new Set<string>(["document", "question", "outline", "date"]);

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function asKind(value: string): ActionKind | null {
  return KINDS.has(value) ? (value as ActionKind) : null;
}

export async function listActionItems(tenderId: string): Promise<SavedAction[]> {
  const { data, error } = await getServiceClient()
    .from("action_items")
    .select("item_key, kind, owner_name, due_on, done")
    .eq("tender_id", tenderId);
  if (error) fail("load action plan", error);
  return data.flatMap((row) => {
    if (!asKind(row.kind)) return [];
    const due = row.due_on ? String(row.due_on).slice(0, 10) : null;
    return [{ itemKey: row.item_key, ownerName: row.owner_name, dueOn: due, done: row.done }];
  });
}

/** Saves the owner, due date and done tick. The plan text is rebuilt, not stored. */
export async function upsertActionItem(draft: ActionItemDraft): Promise<void> {
  const companyId = await getDemoCompanyId();
  const db = getServiceClient();
  const { data: tender, error: tenderError } = await db
    .from("opportunities")
    .select("id")
    .eq("id", draft.tenderId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (tenderError) fail("load tender for action plan", tenderError);
  if (!tender) throw new Error("That tender was not found.");

  const { error } = await db.from("action_items").upsert(
    {
      tender_id: draft.tenderId,
      item_key: draft.itemKey,
      kind: draft.kind,
      owner_name: draft.ownerName,
      due_on: draft.dueOn,
      done: draft.done,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tender_id,item_key" },
  );
  if (error) fail("save action plan", error);
}
