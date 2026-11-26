/**
 * The readiness rows saved for a tender are a cache of what the tender page computes. These helpers decide when the
 * cache needs rewriting, and read it without double counting. Pure, so they can be tested without a database.
 */

export interface StoredRequirementRow {
  text: string;
  category: string;
  page_no: number | null;
  quote: string | null;
  match: string;
  capability_id: string | null;
  rationale: string | null;
}

function rowKey(row: StoredRequirementRow): string {
  return JSON.stringify([
    row.text,
    row.category,
    row.page_no,
    row.quote,
    row.match,
    row.capability_id,
    row.rationale,
  ]);
}

/**
 * True when the stored rows are exactly the computed ones: same rows, none twice. Then nothing needs writing,
 * so opening a tender page does not touch the database.
 */
export function readinessUnchanged(
  stored: readonly StoredRequirementRow[],
  computed: readonly StoredRequirementRow[],
): boolean {
  if (stored.length !== computed.length) return false;
  const a = stored.map(rowKey).sort();
  const b = computed.map(rowKey).sort();
  return a.every((key, i) => key === b[i]);
}

/** One row per tender and requirement text. Older saves could leave a requirement twice. */
export function uniqueByTenderAndText<T extends { opportunity_id: string; text: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.opportunity_id}\u0000${row.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
