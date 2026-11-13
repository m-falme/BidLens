import { describe, expect, it } from "vitest";

import { COMPANY_PAPERS, holdingLabel } from "@/lib/company/papers";
import {
  complianceCountLine,
  complianceDisplayOrder,
  readinessLabel,
  isWithdrawnByAddendum,
  matchRequirements,
  type ProfileCapability,
  type RequirementInput,
} from "@/lib/readiness/match";
import { zanariCapabilities } from "@/supabase/seed/zanari-profile";

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

  it("leaves a form to prepare, and does not count it as a gap or as met", () => {
    const result = matchRequirements(
      [req("Duly filled, signed and stamped certificate of independent tender determination form")],
      services,
    );
    expect(result.items[0]).toMatchObject({ match: "to_prepare", capabilityId: null, disqualifying: false });
    expect(readinessLabel(result.items[0])).toBe("To prepare");
    expect(result.gaps).toBe(0);
    expect(result.toPrepare).toBe(1);
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
    expect(result.items.map((item) => item.match)).toEqual(["missing", "missing", "missing", "missing", "to_prepare"]);
    expect(result.items.every((item) => item.capabilityId === null)).toBe(true);
    expect(result.met).toBe(0);
    expect(result.gaps).toBe(4);
    expect(result.toPrepare).toBe(1);
    expect(result.couldDisqualify).toBe(4);
    expect(result.readinessPct).toBe(0);
  });
});

const papers: ProfileCapability[] = COMPANY_PAPERS.map((paper) => ({
  id: paper.key,
  kind: paper.kind,
  name: paper.name,
  detail: null,
  evidenceRef: paper.selfDeclared ? "Company documents checklist, self-declared" : "Company documents checklist",
  holding: paper.seedHolding,
  selfDeclared: paper.selfDeclared,
  expiresOn: null,
}));

const profile: ProfileCapability[] = zanariCapabilities.map((capability, index) => ({
  id: `profile-${index}`,
  kind: capability.kind,
  name: capability.name,
  detail: capability.detail,
  evidenceRef: `zanari_company_profile.pdf p.${capability.page}`,
}));

describe("company documents", () => {
  it("labels a held registration paper Claimed, not verified and does not treat Don't have as met", () => {
    const result = matchRequirements(
      [
        req("2. Copy of valid Tax Compliance Certificate"),
        req("27 Provide certified valid National Construction Authority Certificate Category (NCA 1/2)"),
      ],
      papers,
      "2026-11-12",
    );
    expect(result.items[0]).toMatchObject({ match: "met", capabilityId: "tax-compliance", selfDeclared: true });
    expect(readinessLabel(result.items[0])).toBe("Claimed, not verified");
    expect(result.items[1]).toMatchObject({ match: "missing", capabilityId: null, disqualifying: true });
    expect(result.items[1].rationale).toMatch(/Don't have/);
    expect(holdingLabel("have", true)).toBe("Have (self-declared)");
  });

  it("does not mark an expired tax certificate met", () => {
    const result = matchRequirements(
      [req("Copy of valid Tax Compliance Certificate")],
      papers.map((paper) =>
        paper.id === "tax-compliance" ? { ...paper, holding: "have" as const, expiresOn: "2026-01-01" } : paper,
      ),
      "2026-11-12",
    );
    expect(result.items[0]).toMatchObject({ match: "missing", disqualifying: true });
    expect(result.items[0].rationale).toMatch(/Expired/);
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

const NAIROBI_NCA_CHANGE =
  "The requirement for a certified valid National Construction Authority (NCA) Certificate Category NCA 1/2 in Electrical Engineering Services is removed and will not be considered in the evaluation process.";

/** Mandatory lines extracted from the live Nairobi SD-WAN tender, in document order. */
const NAIROBI_MANDATORY = [
  "1. Copy of Certificate of registration/incorporation.",
  "2. Copy of valid Tax Compliance Certificate",
  "3. copy of current CR 12/13 (dated within the last 6 months)",
  "4. Duly filled, signed and stamped form of tender prepared in the bidder’s letterhead clearly showing the Tenderer's complete name and business address.",
  "5. Must submit a Tender Security of Kenya Shillings 500,000 issued by a financial institution approved and licensed by the Central Bank of Kenya (CBK) valid beyond 30 days of the tender validity period",
  "6. Duly filled, signed and stamped certificate of independent tender determination form",
  "7. Duly filled signed and stamped confidential business questionnaire form",
  "8. Duly filled, signed and stamped Self Declaration form SD1; that the person/tenderer is not debarred in the matter of the public procurement and asset disposal act 2015.",
  "9. Duly filled, signed and stamped Self Declaration form SD 2; that the tenderer will not engage in any corrupt or fraudulent practice",
  "10. Duly filled, signed and stamped declaration and commitment to the code of ethics form",
  "11. Duly filled signed and stamped Price Schedule form",
  "12. The Supplier MUST provide for connectivity and must be a tier 1 service provider with a Unified License and must be licensed by the Communications Authority of Kenya (CA) as “Public Data Network Operator” Attach copy of valid unified license",
  "13. The Provider core network must provide for adequate redundancy. The provider backbone network MUST be on full redundancy with at least 3 multiple networks for transmission well demonstrated",
  "14. Must Provide power of attorney for persons signing documents on behalf of the company",
  "15. Original and copy of Tender document which MUST be paginated/ serialized/ Numbered sequentially and initialed on all pages including all attachments in the form of 1,2,3…. !",
  "16. Provide Litigation History",
  "17. Submit audited accounts for the years; 2023, 2024 and 2025, with a turnover of KES 300M. The audited accounts must have an auditor’s opinion with clear valid membership with professional body ICPAK & signed and stamped.",
  "18. Relevant Evidence of at least four Engineers/technical personnel with Cisco CCIE certifications",
  "19. The solution must be supplied with 3 Year License Subscription",
  "20. The tenderer should provide warranty for the equipment. At least 2-year warranty for the terminal equipment",
  "21. Install, configure, test and commission the project within a maximum of four (4) weeks.",
  "22. The ISP should have a fully functional customer service center in Kenya and network operation center (NOC) operational 24Hours",
  "23. The Provider must provide the project plan for the proposed solution (Methodology, procedure deployment plan, migration strategy and project timeline)",
  "24 Provide certified valid ICT Authority (ICTA) certificates in Data Center Category ½ (Must be certified by Commissioner for Oaths)",
  "25 Provide certified valid ICT Authority (ICTA) certificates in ICT Networks Category 1/2 (Must be certified by Commissioner for Oaths)",
  "26 Provide certified valid ICT Authority (ICTA) certificates in Information Security Category 1/2(Must be certified by Commissioner for Oaths)",
  "27 Provide certified valid National Construction Authority Certificate Category (NCA 1/2) in Electrical Engineering Services (Must be certified by Commissioner for Oaths)",
];

/** Mandatory lines extracted from the live Makueni CRMIS tender, in document order. */
const MAKUENI_MANDATORY = [
  "1. Copy of Incorporation or Registration Certificate",
  "2. Copy of a current Single Business Permit from any county government in Kenya-for the year 2026 as professional or Technical service provider ICT services",
  "3. Copy of KRA Pin certificate",
  "4. Valid copy tax compliance certificate",
  "5. Attach Dully filled, signed and stamped form of tender with the Company’s letterhead in the format provided.",
  "6. Attach Dully filled, signed and stamped confidential Business Questionnaire in the format provided.",
  "7. Attach Dully filled, signed and stamped price schedule form in the format provided.",
  "8. Attach Dully filled, signed and stamped Certificate of independent tender determination in the format provided.",
  "9. Attach a Duly filled, Signed and Stamped Self Declaration Form (FORM SD1) in the format provided.",
  "10. Attach a Duly filled, Signed and Stamped Self Declaration Form (FORM SD2) in the format provided.",
  "11. Attach Dully filled, Signed and Stamped Declaration and Commitment to The Code of Ethics in the format provided.",
  "12. For limited liability companies: Attach CR12 and National ID /Passport Copies of directors certified by Commissioner of oaths (Advocate of the High Court) (The CR12 must have been issued in the last six months before the date of publication of the tender) a) For business names : Attach certified Copies of National IDs /Passports for proprietors certified Commissioner of oaths (Advocate of the High Court)",
  "13. Attach a bid bond of Kshs. 800,000.00 from a CBK-licensed bank or IRA-regulated insurer and must remain valid for 170 days after the opening date of the tender. Note: A clear colored scanned copy must be uploaded into the IFMIS tender portal. Additionally, the original bid bond must be delivered physically to the office of the Chief Officer- Planning, Budget, Revenue and M&E during work hours from 0800hrs to 1700hrs Monday to Friday on or before 23/11/2026 1000hrs.",
];

describe("Nairobi and Makueni against the seeded checklist", () => {
  const capabilities = [...profile, ...papers];

  it("counts Nairobi as 3 met, 13 gaps, 7 could disqualify, 10 to prepare, and drops the withdrawn NCA line", () => {
    const active = NAIROBI_MANDATORY.filter((text) => !isWithdrawnByAddendum(text, [NAIROBI_NCA_CHANGE]));
    expect(active).toHaveLength(26);
    const result = matchRequirements(active.map((text) => req(text)), capabilities, "2026-11-12");
    expect(result.items.map((item) => item.match)).toEqual([
      "met",
      "met",
      "met",
      "to_prepare",
      "missing",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "missing",
      "unclear",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "missing",
      "missing",
      "unclear",
      "unclear",
      "unclear",
      "unclear",
      "unclear",
      "missing",
      "missing",
      "missing",
    ]);
    expect(result.met).toBe(3);
    expect(result.gaps).toBe(13);
    expect(result.couldDisqualify).toBe(7);
    expect(result.toPrepare).toBe(10);
    expect(result.met + result.gaps + result.toPrepare).toBe(result.items.length);
    expect(complianceCountLine(result)).toBe(
      "26 requirements: 3 met, 13 gaps (7 could disqualify), 10 to prepare",
    );
    const ordered = complianceDisplayOrder(result.items).map((item) => item.match);
    expect(ordered.slice(0, result.gaps).every((match) => match === "missing" || match === "unclear")).toBe(true);
    expect(ordered.slice(result.gaps).every((match) => match === "met" || match === "to_prepare")).toBe(true);
    expect(result.items.filter((item) => item.match === "met").every((item) => item.selfDeclared)).toBe(true);
    expect(result.items[2].rationale).not.toMatch(/director ID/);
  });

  it("counts Makueni as 5 met, 1 gap, 1 could disqualify, 7 to prepare", () => {
    const result = matchRequirements(
      MAKUENI_MANDATORY.map((text) => req(text)),
      capabilities,
      "2026-11-12",
    );
    expect(result.items.map((item) => item.match)).toEqual([
      "met",
      "met",
      "met",
      "met",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "to_prepare",
      "met",
      "missing",
    ]);
    expect(result.met).toBe(5);
    expect(result.gaps).toBe(1);
    expect(result.couldDisqualify).toBe(1);
    expect(result.toPrepare).toBe(7);
    expect(result.items[11].rationale).toMatch(/director ID/);
    expect(result.items.filter((item) => item.match === "met").every((item) => item.selfDeclared)).toBe(true);
  });
});
