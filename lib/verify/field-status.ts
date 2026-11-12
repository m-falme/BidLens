import type { FieldStatus } from "@/lib/db/vocab";

import { isQuoteOnPage, normalizeForQuoteCheck } from "./quote-check";

/**
 * Template blanks a tender leaves unfilled: "____", ".......", "…", "[insert rate]", "(specify)".
 * A clause like "The interest rate is ____" is evidence the value is blank in the source.
 */
const BLANK_MARKER = /_{3,}|\.{5,}|…{2,}|\[\s*(?:insert|enter|specify|state)?[^\]]{0,40}\]|\((?:insert|enter|specify|state)\b[^)]*\)/i;

export function hasBlankMarker(text: string | null | undefined): boolean {
  return !!text && BLANK_MARKER.test(text);
}

/** "", whitespace, dashes or a bare template blank count as no value. */
export function meaningfulValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "" || /^[\s_.…\-–—]*$/.test(trimmed)) return null;
  return trimmed;
}

export type StatusReason =
  | "quote_confirmed"
  | "value_interpreted"
  | "blank_clause_confirmed"
  | "not_found"
  | "quote_not_on_page"
  | "no_quote"
  | "no_value"
  | "extraction_failed";

export interface FieldStatusDecision {
  status: FieldStatus;
  reason: StatusReason;
}

export const STATUS_REASON_TEXT: Record<StatusReason, string> = {
  quote_confirmed: "The quote was found on the cited page and contains the value.",
  value_interpreted: "The quote was found on the cited page, but the value is a reading of it, not a verbatim copy.",
  blank_clause_confirmed: "The document has this clause but leaves it blank. The blank clause was found on the cited page.",
  not_found: "This was not found in the pages that were read.",
  quote_not_on_page: "The quote was not found on the cited page, so the value is unverified.",
  no_quote: "A value was given without a quote, so it cannot be verified.",
  no_value: "The page was quoted, but no value was given and the clause is not blank.",
  extraction_failed:
    "Nothing was extracted. The reading failed twice, or no readable pages matched. Check this field in the document.",
};

/**
 * The only place a field's status is decided, from the quote check in code:
 * - quote on the cited page and the value inside it → source_confirmed
 * - quote on the page but the value is an interpretation → ai_inferred
 * - no value, and the quoted clause is on the page with a template blank → blank_in_source
 * - anything unverifiable → needs_human
 */
export function decideFieldStatus(input: {
  value: string | null | undefined;
  quote: string | null | undefined;
  pageText: string | null | undefined;
}): FieldStatusDecision {
  const value = meaningfulValue(input.value);
  const quote = input.quote?.trim() || null;
  const quoteOnPage = isQuoteOnPage(quote, input.pageText);

  if (value === null) {
    if (!quote) return { status: "needs_human", reason: "not_found" };
    if (!quoteOnPage) return { status: "needs_human", reason: "quote_not_on_page" };
    if (hasBlankMarker(quote)) return { status: "blank_in_source", reason: "blank_clause_confirmed" };
    return { status: "needs_human", reason: "no_value" };
  }

  if (!quote) return { status: "needs_human", reason: "no_quote" };
  if (!quoteOnPage) return { status: "needs_human", reason: "quote_not_on_page" };
  return normalizeForQuoteCheck(quote).includes(normalizeForQuoteCheck(value))
    ? { status: "source_confirmed", reason: "quote_confirmed" }
    : { status: "ai_inferred", reason: "value_interpreted" };
}
