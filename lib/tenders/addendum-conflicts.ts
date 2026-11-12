import { createBm25Index, tokenize } from "@/lib/retrieval/bm25";
import { normalizeForQuoteCheck } from "@/lib/verify/quote-check";

import { isScalarKey } from "./field-catalog";

/** The parts of a stored field the comparison needs. */
export interface ComparableField {
  id: string;
  key: string;
  value: string | null;
  quote: string | null;
  page_no: number | null;
  status: string;
  affects_key: string | null;
}

export type AddendumConflict =
  | {
      /** Main tender and addendum state different values for the same field. */
      kind: "value_differs";
      key: string;
      main: ComparableField;
      addendum: ComparableField;
    }
  | {
      /** The addendum states a value the main tender extraction does not have. */
      kind: "addendum_only";
      key: string;
      main: null;
      addendum: ComparableField;
    }
  | {
      /** The addendum changes something; `main` is the closest matching main-tender item, if any. */
      kind: "addendum_change";
      key: string;
      main: ComparableField | null;
      addendum: ComparableField;
    };

/** Tokens of a value with punctuation and case removed, for comparing restatements. */
function valueTokens(value: string): string[] {
  return tokenize(normalizeForQuoteCheck(value));
}

/**
 * Two statements of a field count as the same when one's words are (almost) all in the other,
 * so "Nairobi City County" and "NAIROBI CITY COUNTY GOVERNMENT" match, but "120 days" and
 * "150 days" do not. Anything else is shown to a human as a conflict.
 */
export function sameValue(a: string, b: string): boolean {
  const ta = new Set(valueTokens(a));
  const tb = new Set(valueTokens(b));
  if (ta.size === 0 || tb.size === 0) return normalizeForQuoteCheck(a) === normalizeForQuoteCheck(b);
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  // A changed amount, date or count is always a conflict, however similar the wording.
  if (![...small].filter((t) => /\d/.test(t)).every((t) => large.has(t))) return false;
  let shared = 0;
  for (const t of small) if (large.has(t)) shared++;
  return shared / small.size >= 0.8;
}

/**
 * An addendum change is linked to a main-tender item only on a clear BM25 winner; an ambiguous
 * match is left unlinked (shown with no main value) rather than pointing at the wrong item.
 */
const MIN_MATCH_SCORE = 1;
const MIN_LEAD_OVER_RUNNER_UP = 1.5;

/**
 * Every place the addendum differs from the main tender, for a human to resolve. Pure: nothing
 * is merged, overwritten or hidden; both values are returned side by side.
 */
export function findAddendumConflicts(
  mainFields: readonly ComparableField[],
  addendumFields: readonly ComparableField[],
): AddendumConflict[] {
  const conflicts: AddendumConflict[] = [];

  for (const added of addendumFields) {
    if (!isScalarKey(added.key) || added.value === null) continue;
    const main = mainFields.find((f) => f.key === added.key && f.value !== null);
    if (!main) conflicts.push({ kind: "addendum_only", key: added.key, main: null, addendum: added });
    else if (!sameValue(main.value!, added.value)) {
      conflicts.push({ kind: "value_differs", key: added.key, main, addendum: added });
    }
  }

  for (const change of addendumFields) {
    if (change.key !== "addendum_change") continue;
    const target = change.affects_key && change.affects_key !== "other" ? change.affects_key : null;
    const candidates = mainFields.filter((f) => (target ? f.key === target : true) && (f.value ?? f.quote));
    const index = createBm25Index(
      candidates.map((f, i) => ({ id: i, text: `${f.value ?? ""} ${f.quote ?? ""}` })),
    );
    const [best, runnerUp] = index.search(`${change.value ?? ""} ${change.quote ?? ""}`, 2);
    const clearWinner =
      best && best.score >= MIN_MATCH_SCORE && (!runnerUp || best.score >= MIN_LEAD_OVER_RUNNER_UP * runnerUp.score);
    const main = clearWinner ? candidates[best.id] : null;
    conflicts.push({ kind: "addendum_change", key: target ?? main?.key ?? "other", main, addendum: change });
  }

  return conflicts;
}
