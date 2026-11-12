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

/**
 * Where the quote sits in the original page text ([start, end) offsets), matching the same way
 * as `isQuoteOnPage`, so the UI can highlight exactly what the check found. null if absent.
 */
export function findQuoteSpan(
  quote: string | null | undefined,
  pageText: string | null | undefined,
): [number, number] | null {
  if (!quote || !pageText) return null;
  const needle = normalizeForQuoteCheck(quote);
  if (!needle) return null;
  // Normalize the page while remembering each normalized character's original offset.
  let normalized = "";
  const offsets: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < pageText.length; i++) {
    const ch = pageText[i];
    if (/\s/.test(ch)) {
      pendingSpace = normalized.length > 0;
      continue;
    }
    if (pendingSpace) {
      normalized += " ";
      offsets.push(i);
      pendingSpace = false;
    }
    normalized += ch.toLowerCase();
    offsets.push(i);
  }
  const at = normalized.indexOf(needle);
  if (at < 0) return null;
  return [offsets[at], offsets[at + needle.length - 1] + 1];
}

/** The only way a field becomes `source_confirmed`. Anything unverifiable goes to a human. */
export function statusFromQuoteCheck(
  quote: string | null | undefined,
  pageText: string | null | undefined,
): "source_confirmed" | "needs_human" {
  return isQuoteOnPage(quote, pageText) ? "source_confirmed" : "needs_human";
}
