import { z } from "zod";

import type { ActionKind } from "./build";

export interface ActionItemDraft {
  tenderId: string;
  itemKey: string;
  kind: ActionKind;
  ownerName: string | null;
  dueOn: string | null;
  done: boolean;
}

const KINDS = ["document", "question", "outline", "date"] as const;

const actionItemSchema = z.object({
  tenderId: z.uuid(),
  itemKey: z.string().trim().min(1, "That plan item was not found.").max(200, "That plan item was not found."),
  kind: z.enum(KINDS),
  ownerName: z.string().trim().max(120, "Name is too long."),
  dueOn: z.string().trim(),
  done: z.boolean(),
});

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseActionItem(input: unknown): { ok: true; value: ActionItemDraft } | { ok: false; error: string } {
  const parsed = actionItemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "tenderId") return { ok: false, error: "That tender was not found." };
    if (issue?.path[0] === "kind") return { ok: false, error: "That plan item was not found." };
    return { ok: false, error: issue?.message ?? "Check the plan item and try again." };
  }
  if (parsed.data.dueOn.length > 0 && !isIsoDate(parsed.data.dueOn)) {
    return { ok: false, error: "Enter a due date as YYYY-MM-DD." };
  }
  return {
    ok: true,
    value: {
      tenderId: parsed.data.tenderId,
      itemKey: parsed.data.itemKey,
      kind: parsed.data.kind,
      ownerName: parsed.data.ownerName.length > 0 ? parsed.data.ownerName : null,
      dueOn: parsed.data.dueOn.length > 0 ? parsed.data.dueOn : null,
      done: parsed.data.done,
    },
  };
}
