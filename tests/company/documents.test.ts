import { describe, expect, it } from "vitest";

import {
  COMPANY_PAPERS,
  documentFromRequirement,
  documentIsExpired,
} from "@/lib/company/papers";
import { isCompanyRecordName, matchRequirements, type ProfileCapability, type RequirementInput } from "@/lib/readiness/match";

function req(text: string): RequirementInput {
  return { text, category: "mandatory", pageNo: 5, quote: text };
}

const papers: ProfileCapability[] = COMPANY_PAPERS.map((paper) => ({
  id: paper.key,
  kind: paper.kind,
  name: paper.name,
  detail: null,
  evidenceRef: null,
  holding: paper.seedHolding,
  selfDeclared: paper.selfDeclared,
  expiresOn: null,
  neverExpires: paper.doesNotExpire === true,
}));

const bond = "Must submit a bid bond of Kshs. 100,000 from a CBK-licensed bank";

describe("optional expiry date", () => {
  it("ticks Does not expire for KRA PIN, incorporation and CR12", () => {
    expect(COMPANY_PAPERS.filter((paper) => paper.doesNotExpire).map((paper) => paper.key)).toEqual([
      "incorporation",
      "cr12",
      "kra-pin",
    ]);
  });

  it("keeps a Have with no date, including on a later day", () => {
    const result = matchRequirements([req("Copy of KRA Pin certificate")], papers, "2035-01-01");
    expect(result.items[0]).toMatchObject({ match: "met", capabilityId: "kra-pin" });
    expect(documentIsExpired(null, "2035-01-01")).toBe(false);
    expect(documentIsExpired(undefined, "2026-11-12")).toBe(false);
  });
});

describe("expiry check", () => {
  it("counts a document as expired only when the date is before today", () => {
    expect(documentIsExpired("2026-01-01", "2026-11-12")).toBe(true);
    expect(documentIsExpired("2026-11-12", "2026-11-12")).toBe(false);
    expect(documentIsExpired("2027-06-01", "2026-11-12")).toBe(false);

    const past = matchRequirements(
      [req("Copy of valid Tax Compliance Certificate")],
      papers.map((paper) =>
        paper.id === "tax-compliance" ? { ...paper, holding: "have" as const, expiresOn: "2026-01-01" } : paper,
      ),
      "2026-11-12",
    );
    expect(past.items[0]).toMatchObject({ match: "missing", unlisted: false });
    expect(past.items[0].rationale).toMatch(/Expired/);

    const future = matchRequirements(
      [req("Copy of valid Tax Compliance Certificate")],
      papers.map((paper) =>
        paper.id === "tax-compliance" ? { ...paper, holding: "have" as const, expiresOn: "2027-06-01" } : paper,
      ),
      "2026-11-12",
    );
    expect(future.items[0].match).toBe("met");
  });
});

describe("add a requirement that is not on the list", () => {
  it("flags a new requirement and does not use the tender line as the company record", () => {
    const before = matchRequirements([req(bond)], papers, "2026-11-12");
    expect(before.items[0]).toMatchObject({ match: "missing", unlisted: true, capabilityId: null });

    const added = documentFromRequirement(bond);
    expect(added).toMatchObject({ group: "other", holding: "dont_have", expiresOn: null, neverExpires: false });
    expect(bond.replace(/\s+/g, " ")).toContain(added.name);

    const listed: ProfileCapability = {
      id: "added-bond",
      kind: added.kind,
      name: added.name,
      detail: bond,
      evidenceRef: "Added from a tender requirement",
      holding: added.holding,
      selfDeclared: false,
      expiresOn: added.expiresOn,
      neverExpires: added.neverExpires,
    };
    expect(isCompanyRecordName(added.name)).toBe(false);
    const afterAdd = matchRequirements([req(bond)], [...papers, listed], "2026-11-12");
    expect(afterAdd.items[0].capabilityName).not.toBe(added.name);
    expect(afterAdd.items[0].rationale).not.toContain(added.name);

    const library: ProfileCapability = {
      ...listed,
      id: "library-bond",
      name: "Bid bond",
      holding: "have",
    };
    const held = matchRequirements([req(bond)], [...papers, library], "2026-11-12");
    expect(held.items[0]).toMatchObject({
      match: "met",
      capabilityId: "library-bond",
      capabilityName: "Bid bond",
      onChecklist: true,
      unlisted: false,
    });
    expect(held.items[0].rationale).not.toContain("Kshs");
  });

  it("does not treat a known paper or a form as a new document", () => {
    const nca = matchRequirements(
      [req("Provide certified valid National Construction Authority (NCA) licence")],
      papers,
      "2026-11-12",
    );
    expect(nca.items[0]).toMatchObject({ match: "missing", unlisted: false });
    const form = matchRequirements([req("Duly filled, signed and stamped form of tender")], papers, "2026-11-12");
    expect(form.items[0]).toMatchObject({ match: "to_prepare", unlisted: false });
  });
});
