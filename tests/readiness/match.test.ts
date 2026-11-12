import { describe, expect, it } from "vitest";

import { isWithdrawnByAddendum, matchRequirements, type ProfileCapability, type RequirementInput } from "@/lib/readiness/match";

const services: ProfileCapability[] = [
  {
    id: "svc-powerbi",
    kind: "service",
    name: "Microsoft Power BI implementation",
    detail: "Dashboards",
    evidenceRef: "zanari_company_profile.pdf p.7",
  },
  {
    id: "svc-analytics",
    kind: "service",
    name: "Data Analytics",
    detail: null,
    evidenceRef: "zanari_company_profile.pdf p.6",
  },
  {
    id: "sector-gov",
    kind: "sector",
    name: "Government and Public Sector",
    detail: null,
    evidenceRef: "zanari_company_profile.pdf p.14",
  },
];

function req(text: string, category: RequirementInput["category"] = "mandatory"): RequirementInput {
  return { text, category, pageNo: 30, quote: text };
}

describe("matchRequirements never invents proof", () => {
  it("does not mark a tax certificate met when the profile has no certification", () => {
    const result = matchRequirements([req("2. Copy of valid Tax Compliance Certificate")], services);
    expect(result.items[0]).toMatchObject({
      match: "missing",
      capabilityId: null,
      disqualifying: true,
    });
    expect(result.items[0].rationale).not.toMatch(/we have|zanari holds|zanari is certified/i);
  });

  it("does not treat a service with a similar name as the certificate", () => {
    const result = matchRequirements(
      [req("Copy of valid Tax Compliance Certificate")],
      [
        ...services,
        {
          id: "svc-tax",
          kind: "service",
          name: "Tax compliance certificate training",
          detail: null,
          evidenceRef: null,
        },
      ],
    );
    expect(result.items[0].match).toBe("missing");
    expect(result.items[0].capabilityId).toBeNull();
  });

  it("marks the same certificate met only when a certification record exists", () => {
    const result = matchRequirements(
      [req("Copy of valid Tax Compliance Certificate")],
      [
        ...services,
        {
          id: "cert-tax",
          kind: "certification",
          name: "Tax compliance certificate",
          detail: null,
          evidenceRef: "zanari_company_profile.pdf p.4",
        },
      ],
    );
    expect(result.items[0]).toMatchObject({
      match: "met",
      capabilityId: "cert-tax",
      disqualifying: false,
    });
  });

  it("does not invent experience or a client reference", () => {
    const result = matchRequirements(
      [req("Provide reference sites for at least three similar contracts in the last five years")],
      services,
    );
    expect(result.items[0]).toMatchObject({ match: "missing", capabilityId: null, disqualifying: true });
  });

  it("leaves a form for a person to confirm, and does not call it met", () => {
    const result = matchRequirements(
      [req("Duly filled, signed and stamped certificate of independent tender determination form")],
      services,
    );
    expect(result.items[0]).toMatchObject({ match: "unclear", capabilityId: null, disqualifying: false });
  });

  it("marks a service met only when the capability name is in the requirement", () => {
    const result = matchRequirements(
      [req("The supplier shall deliver Microsoft Power BI implementation for the finance team")],
      services,
    );
    expect(result.items[0]).toMatchObject({ match: "met", capabilityId: "svc-powerbi" });
    expect(result.met).toBe(1);
    expect(result.gaps).toBe(0);
    expect(result.couldDisqualify).toBe(0);
  });

  it("counts Nairobi-style gaps without claiming a licence", () => {
    const result = matchRequirements(
      [
        req("1. Copy of Certificate of registration/incorporation."),
        req("5. Must submit a Tender Security of Kenya Shillings 500,000"),
        req("24 Provide certified valid ICT Authority (ICTA) certificates in Data Center Category"),
        req("18. Relevant Evidence of at least four Engineers with Cisco CCIE certifications"),
        req("4. Duly filled, signed and stamped form of tender"),
      ],
      services,
    );
    expect(result.items.map((item) => item.match)).toEqual(["missing", "missing", "missing", "missing", "unclear"]);
    expect(result.items.every((item) => item.capabilityId === null)).toBe(true);
    expect(result.met).toBe(0);
    expect(result.gaps).toBe(5);
    expect(result.couldDisqualify).toBe(4);
    expect(result.readinessPct).toBe(0);
  });
});

describe("isWithdrawnByAddendum", () => {
  it("drops the NCA item the Nairobi addendum removes", () => {
    const change =
      "The requirement for a certified valid National Construction Authority (NCA) Certificate Category NCA 1/2 in Electrical Engineering Services is removed and will not be considered in the evaluation process.";
    const requirement =
      "27 Provide certified valid National Construction Authority Certificate Category (NCA 1/2) in Electrical Engineering Services";
    expect(isWithdrawnByAddendum(requirement, [change])).toBe(true);
    expect(isWithdrawnByAddendum("Copy of valid Tax Compliance Certificate", [change])).toBe(false);
    expect(
      isWithdrawnByAddendum(
        "Duly filled, signed and stamped Self Declaration form SD 2; that the tenderer will not engage in any corrupt or fraudulent practice",
        [change],
      ),
    ).toBe(false);
  });
});
