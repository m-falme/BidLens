import { FIELD_STATUSES, type FieldStatus } from "@/lib/db/vocab";

import { findAddendumConflicts, type AddendumConflict, type ComparableField } from "./addendum-conflicts";

export interface ReviewField extends ComparableField {
  source_id: string | null;
  status: FieldStatus;
}

export interface ReviewSummary {
  total: number;
  byStatus: Record<FieldStatus, number>;
  conflicts: AddendumConflict[];
  /** What a human must look at: unverified fields plus every addendum conflict. */
  needsReview: number;
}

/**
 * Counts fields by status and compares each addendum with the main document. Fields are grouped
 * by source role; nothing is merged.
 */
export function summarizeReview(
  fields: readonly ReviewField[],
  sourceRoles: ReadonlyMap<string, "main" | "addendum">,
): ReviewSummary {
  const byStatus = Object.fromEntries(FIELD_STATUSES.map((s) => [s, 0])) as Record<FieldStatus, number>;
  for (const f of fields) byStatus[f.status]++;

  const main = fields.filter((f) => f.source_id && sourceRoles.get(f.source_id) === "main");
  const addendumSources = [...sourceRoles].filter(([, role]) => role === "addendum").map(([id]) => id);
  const conflicts = addendumSources.flatMap((sourceId) =>
    findAddendumConflicts(
      main,
      fields.filter((f) => f.source_id === sourceId),
    ),
  );

  return { total: fields.length, byStatus, conflicts, needsReview: byStatus.needs_human + conflicts.length };
}

/**
 * An empty tender cannot be approved. No source-confirmed fact, or no mandatory
 * requirement, means a person has to look before any stage is approved.
 */
export function needsHumanReview(input: { sourceConfirmed: number; mandatoryRequirements: number }): boolean {
  return input.sourceConfirmed === 0 || input.mandatoryRequirements === 0;
}
