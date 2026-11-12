import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isPdfBytes, parsePdfPages } from "@/lib/pdf/parse";

const tender = (name: string) => new Uint8Array(readFileSync(`data/tenders/${name}`));

describe("parsePdfPages", () => {
  it("extracts text per page with 1-based page numbers", async () => {
    const pages = await parsePdfPages(tender("nairobi_nccg_ide_t_039_addendum1_2026-11-06.pdf"));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ pageNo: 1, needsOcr: false });
    expect(pages[0].text).toContain("NCCG/IDE/T/039/2026-2027");
  });

  it("marks pages with no text layer as needing OCR", async () => {
    const pages = await parsePdfPages(tender("nyamira_revenue_system_advert.pdf"));
    expect(pages.map((p) => p.needsOcr)).toEqual([true, true]);
  });

  it("recognises a PDF by its bytes, not its name", () => {
    expect(isPdfBytes(tender("nyamira_revenue_system_advert.pdf"))).toBe(true);
    expect(isPdfBytes(new TextEncoder().encode("<html>not a pdf</html>"))).toBe(false);
    expect(isPdfBytes(new Uint8Array())).toBe(false);
  });
});
