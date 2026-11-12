/** Collapses whitespace and case so line breaks and capitalisation in extracted page text don't defeat a match. */
export function normalizeForQuoteCheck(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True only when the quote is non-empty and appears on the cited page after normalization. */
export function isQuoteOnPage(quote: string | null | undefined, pageText: string | null | undefined): boolean {
  if (!quote || !pageText) return false;
  const needle = normalizeForQuoteCheck(quote);
  return needle.length > 0 && normalizeForQuoteCheck(pageText).includes(needle);
}

/** The only way a field becomes `source_confirmed`. Anything unverifiable goes to a human. */
export function statusFromQuoteCheck(
  quote: string | null | undefined,
  pageText: string | null | undefined,
): "source_confirmed" | "needs_human" {
  return isQuoteOnPage(quote, pageText) ? "source_confirmed" : "needs_human";
}
