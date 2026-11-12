import { describe, expect, it } from "vitest";

import { COMPANY_PAPERS } from "@/lib/company/papers";
import { matchRequirements, type ProfileCapability, type RequirementInput } from "@/lib/readiness/match";
import { documentSynonym, sameDocument } from "@/lib/readiness/synonyms";

function req(text: string): RequirementInput {
  return { text, category: "mandatory", pageNo: 30, quote: text };
}

function paper(partial: Partial<ProfileCapability> & Pick<ProfileCapability, "id" | "name" | "kind">): ProfileCapability {
  return {
    detail: null,
    evidenceRef: null,
    holding: "have",
    selfDeclared: false,
    expiresOn: null,
    neverExpires: false,
    ...partial,
  };
}

const checklist: ProfileCapability[] = COMPANY_PAPERS.map((item) => ({
  id: item.key,
  kind: item.kind,
  name: item.name,
  detail: null,
  evidenceRef: null,
  holding: item.seedHolding,
  selfDeclared: item.selfDeclared,
  expiresOn: null,
  neverExpires: item.doesNotExpire === true,
}));

describe("document synonyms", () => {
  it("treats bid bond, tender security and bid security as one paper", () => {
    expect(sameDocument("Bid bond", "Tender security")).toBe(true);
    expect(sameDocument("bid security", "Must submit a Tender Security of KSh 500,000")).toBe(true);
    expect(sameDocument("Bid bond", "Tax compliance certificate")).toBe(false);
    expect(documentSynonym("single business permit")).toBeNull();
  });

  it("treats CR12 and a list of directors as one paper", () => {
    expect(sameDocument("CR12", "list of directors")).toBe(true);
    expect(sameDocument("CR 12/13", "certified list of directors")).toBe(true);
  });

  it("treats tax compliance and a KRA compliance certificate as one paper", () => {
    expect(sameDocument("Tax compliance certificate", "KRA compliance certificate")).toBe(true);
    expect(sameDocument("valid tax compliance", "KRA compliance certificate")).toBe(true);
  });
});

describe("matching uses the synonym map", () => {
  const nairobiBond = "5. Must submit a Tender Security of Kenya Shillings 500,000 issued by a bank";

  it("matches Nairobi's tender security to an existing bid bond", () => {
    const result = matchRequirements(
      [req(nairobiBond)],
      [paper({ id: "bond", kind: "document", name: "Bid bond", holding: "have" })],
      "2026-11-13",
    );
    expect(result.items[0]).toMatchObject({
      match: "met",
      capabilityId: "bond",
      capabilityName: "Bid bond",
      unlisted: false,
    });
  });

  it("links a Don't have bid bond instead of calling the tender security a new document", () => {
    const result = matchRequirements(
      [req(nairobiBond)],
      [paper({ id: "bond", kind: "document", name: "Attach a bid bond of Kshs. 800,000.00", holding: "dont_have" })],
      "2026-11-13",
    );
    expect(result.items[0]).toMatchObject({ match: "missing", unlisted: false, capabilityId: null, expired: false });
    expect(result.items[0].rationale).toMatch(/bid bond/i);
    expect(result.items[0].rationale).toMatch(/Don't have/);
  });

  it("does not let a service named bid bond satisfy tender security", () => {
    const result = matchRequirements(
      [req(nairobiBond)],
      [paper({ id: "advice", kind: "service", name: "Bid bond advisory" })],
      "2026-11-13",
    );
    expect(result.items[0]).toMatchObject({ match: "missing", capabilityId: null, unlisted: true });
  });

  it("matches a list of directors to CR12 and a KRA compliance certificate to tax compliance", () => {
    const result = matchRequirements(
      [req("Attach a certified list of directors"), req("Copy of KRA compliance certificate")],
      checklist,
      "2026-11-13",
    );
    expect(result.items[0]).toMatchObject({ match: "met", capabilityId: "cr12" });
    expect(result.items[1]).toMatchObject({ match: "met", capabilityId: "tax-compliance" });
  });
});
