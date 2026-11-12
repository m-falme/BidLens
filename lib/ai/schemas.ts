import { z } from "zod";

import {
  ADDENDUM_TARGET_KEYS,
  FIELD_SPECS,
  type FieldGroup,
  type TenderFieldKey,
} from "@/lib/tenders/field-catalog";

/**
 * One extracted value with its evidence, as returned by the model. There is deliberately no
 * `status`: code decides it from the quote check (lib/verify/field-status.ts).
 */
export const evidenceItemSchema = z.object({
  value: z
    .string()
    .max(1000)
    .nullable()
    .describe("The value, copied from the page where possible. null if not stated or left blank."),
  page: z
    .int()
    .min(1)
    .nullable()
    .describe("The [p.N] page number the quote comes from. null if there is no quote."),
  quote: z
    .string()
    .max(1000)
    .nullable()
    .describe("A short verbatim span (under 300 characters) copied character-for-character from that page."),
  confidence: z.number().min(0).max(1).describe("0 to 1: how sure you are the value is correct."),
});
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const addendumChangeItemSchema = evidenceItemSchema.extend({
  affects: z.enum(ADDENDUM_TARGET_KEYS).describe("The tender field this change modifies, or 'other'."),
});
export type AddendumChangeItem = z.infer<typeof addendumChangeItemSchema>;

const MAX_LIST_ITEMS = 60;

function itemSchemaFor(key: TenderFieldKey) {
  return key === "addendum_change" ? addendumChangeItemSchema : evidenceItemSchema;
}

/**
 * The output schema for one field group: an evidence item per scalar key, or a list of items
 * per list key. Keys are fixed, so the model cannot invent fields.
 */
export function groupOutputSchema(group: FieldGroup) {
  const shape: Record<string, z.ZodType> = {};
  for (const key of group.keys) {
    const description = FIELD_SPECS[key].instruction;
    shape[key] =
      group.kind === "scalar"
        ? evidenceItemSchema.describe(description)
        : z.array(itemSchemaFor(key)).max(MAX_LIST_ITEMS).describe(description);
  }
  return z.strictObject(shape);
}

/** Parsed group output: each key maps to one item (scalar groups) or a list (list groups). */
export type GroupOutput = Record<string, EvidenceItem | Array<EvidenceItem | AddendumChangeItem>>;
