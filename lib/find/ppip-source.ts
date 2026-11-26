import type { Tender, TenderSource } from "./source";

/**
 * STUB. A future live source for the Public Procurement Information Portal (PPIP / tenders.go.ke).
 * It is not wired up anywhere: nothing imports it, and it makes no network call.
 *
 * When it is built: respect the portal's rate limit (PPIP: at most 60 requests a minute), never scrape behind a
 * login or captcha, and keep the source URL and retrieval date on every tender it returns.
 */
export class PpipTenderSource implements TenderSource {
  describe(tenders: readonly Tender[]): string {
    return `PPIP (${tenders.length} tenders)`;
  }

  async fetchTenders(): Promise<Tender[]> {
    throw new Error("PpipTenderSource is not built yet. The Find agent reads the sample dataset today.");
  }
}
