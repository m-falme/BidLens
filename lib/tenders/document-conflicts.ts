/**
 * Amounts the same document states for bid security. Code only: stored page text, no LLM.
 * Two different amounts (Nairobi: KSh 420,000 on the invitation and KSh 500,000 in the
 * mandatory list) are a conflict for a human. The same amount restated is not.
 */

export interface SecurityMention {
  pageNo: number;
  amountKes: number;
  /** Excerpt copied from the page, from the security phrase through the amount. */
  quote: string;
}

export interface BidSecurityConflict {
  kind: "bid_security_amounts_differ";
  /** One mention per distinct amount, earliest page first. */
  amounts: SecurityMention[];
}

const PHRASE = /(?:tender|bid)\s+security|bid\s+bond/gi;
/** A shilling amount: prefixed (KSh, KES) or a comma-grouped number, at least 10,000. */
const MONEY =
  /(?:(?:kshs?|kes|kenya shillings)\.?\s*)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{5,}(?:\.\d+)?)|(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/gi;

const WINDOW_BEFORE = 20;
const WINDOW_AFTER = 180;

export function formatKes(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Parses "420,000" or "800000.00" into shillings. null when it is not a money amount. */
export function parseKesAmount(raw: string): number | null {
  const parsed = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 10_000) return null;
  return parsed;
}

export function valueHasAmount(value: string, amount: number): boolean {
  if (value.includes(formatKes(amount))) return true;
  return new RegExp(`\\b${amount}\\b`).test(value.replace(/,/g, ""));
}

function mentionQuote(text: string, phraseAt: number, amountAt: number, amountRaw: string): string {
  const end = Math.min(text.length, amountAt + amountRaw.length);
  return text.slice(phraseAt, end).replace(/\s+/g, " ").trim();
}

/** Every bid-security or bid-bond amount on one page. */
export function findSecurityAmounts(pageNo: number, text: string): SecurityMention[] {
  const mentions: SecurityMention[] = [];
  const seen = new Set<number>();
  for (const phrase of text.matchAll(PHRASE)) {
    const phraseAt = phrase.index ?? 0;
    const windowStart = Math.max(0, phraseAt - WINDOW_BEFORE);
    const windowEnd = Math.min(text.length, phraseAt + phrase[0].length + WINDOW_AFTER);
    const window = text.slice(windowStart, windowEnd);
    for (const money of window.matchAll(MONEY)) {
      const raw = money[1] ?? money[2];
      if (!raw) continue;
      const amountKes = parseKesAmount(raw);
      if (amountKes === null || seen.has(amountKes)) continue;
      seen.add(amountKes);
      const amountAt = windowStart + (money.index ?? 0) + money[0].length - raw.length;
      mentions.push({
        pageNo,
        amountKes,
        quote: mentionQuote(text, phraseAt, amountAt, raw),
      });
    }
  }
  return mentions;
}

/**
 * A conflict when one document states two different bid-security amounts.
 * Pages are one document; pass the main tender and an addendum separately.
 */
export function findBidSecurityConflicts(
  pages: readonly { pageNo: number; text: string }[],
): BidSecurityConflict | null {
  const mentions = pages
    .flatMap((page) => findSecurityAmounts(page.pageNo, page.text))
    .sort((a, b) => a.pageNo - b.pageNo || a.amountKes - b.amountKes);
  const byAmount = new Map<number, SecurityMention>();
  for (const mention of mentions) if (!byAmount.has(mention.amountKes)) byAmount.set(mention.amountKes, mention);
  if (byAmount.size < 2) return null;
  return {
    kind: "bid_security_amounts_differ",
    amounts: [...byAmount.values()].sort((a, b) => a.pageNo - b.pageNo),
  };
}
