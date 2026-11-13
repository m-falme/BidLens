import { describe, expect, it } from "vitest";

import { evidenceLibraryHref, tenderReturnFromParam } from "@/lib/tenders/evidence-return";

const TENDER = "4a6d7a39-7a24-45ba-b5dc-bf855f5eac67";
const DOC = "11111111-1111-4111-8111-111111111111";

describe("evidence return links", () => {
  it("keeps the tender and stage inside from, and the document in the hash", () => {
    const href = evidenceLibraryHref(TENDER, "compliance", DOC);
    const url = new URL(href, "http://bidlens.local");
    expect(url.pathname).toBe("/evidence");
    expect(url.hash).toBe(`#doc-${DOC}`);
    expect(url.searchParams.get("stage")).toBeNull();
    expect(tenderReturnFromParam(url.searchParams.get("from"))).toEqual({
      href: `/tenders/${TENDER}?stage=compliance`,
      tenderId: TENDER,
      stage: "compliance",
    });
  });

  it("omits the document hash when the link is the stage evidence button", () => {
    const href = evidenceLibraryHref(TENDER, "commercial");
    const url = new URL(href, "http://bidlens.local");
    expect(url.hash).toBe("");
    expect(tenderReturnFromParam(url.searchParams.get("from"))?.stage).toBe("commercial");
  });

  it("accepts a tender path and keeps only the stage query", () => {
    expect(tenderReturnFromParam(`/tenders/${TENDER}?stage=can_comply&next=https://evil.test`)?.href).toBe(
      `/tenders/${TENDER}?stage=compliance`,
    );
    expect(tenderReturnFromParam(`/tenders/${TENDER}/plan?stage=Bid%20preparation`)).toEqual({
      href: `/tenders/${TENDER}/plan?stage=preparation`,
      tenderId: TENDER,
      stage: "preparation",
    });
  });

  it("ignores anything that is not an internal tender path", () => {
    const rejected = [
      null,
      "",
      "/evidence",
      "/tenders",
      "/tenders/new",
      "https://evil.test/tenders/" + TENDER,
      "//evil.test/tenders/" + TENDER,
      `/tenders/../evidence`,
      `/tenders/${TENDER}/../../evidence`,
      `\\tenders\\${TENDER}`,
      `/tenders/${TENDER}\n`,
      "javascript:alert(1)",
    ];
    for (const value of rejected) {
      expect(tenderReturnFromParam(value)).toBeNull();
    }
  });
});
