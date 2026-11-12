/**
 * Common Kenyan tender papers on the company checklist.
 * "Have (self-declared)" is the team's own mark. It is not a file BidLens has checked.
 * Industry licences stay "Don't have" until someone changes them.
 */

import type { DocumentHolding } from "@/lib/db/vocab";

export type { DocumentHolding } from "@/lib/db/vocab";

export type PaperGroup = "registration" | "licence";

export interface CompanyPaper {
  /** Stable key. Seed ids are derived from the name, so renaming a paper creates a new row. */
  key: string;
  name: string;
  kind: "document" | "certification";
  group: PaperGroup;
  /** Status written on the first seed. Later edits are kept. */
  seedHolding: DocumentHolding;
  /** True when Have was declared by the team, not read from a file. */
  selfDeclared: boolean;
  /** Tender wording this paper covers. */
  pattern: RegExp;
}

export const COMPANY_PAPERS: readonly CompanyPaper[] = [
  {
    key: "incorporation",
    name: "Certificate of incorporation",
    kind: "document",
    group: "registration",
    seedHolding: "have",
    selfDeclared: true,
    pattern: /certificate of (registration|incorporation)|incorporation or registration/i,
  },
  {
    key: "cr12",
    name: "CR12",
    kind: "document",
    group: "registration",
    seedHolding: "have",
    selfDeclared: true,
    pattern: /\bcr\s*1[23]\b/i,
  },
  {
    key: "kra-pin",
    name: "KRA PIN",
    kind: "document",
    group: "registration",
    seedHolding: "have",
    selfDeclared: true,
    pattern: /\bkra\b[\s\S]{0,40}\bpin\b|\bpin certificate\b/i,
  },
  {
    key: "tax-compliance",
    name: "Tax compliance certificate",
    kind: "document",
    group: "registration",
    seedHolding: "have",
    selfDeclared: true,
    pattern: /tax compliance/i,
  },
  {
    key: "business-permit",
    name: "Single business permit",
    kind: "document",
    group: "registration",
    seedHolding: "have",
    selfDeclared: true,
    pattern: /single business permit|\bbusiness permit\b/i,
  },
  {
    key: "agpo",
    name: "AGPO certificate",
    kind: "certification",
    group: "registration",
    seedHolding: "dont_have",
    selfDeclared: false,
    pattern: /\bagpo\b|access to government procurement opportunities/i,
  },
  {
    key: "audited-accounts",
    name: "Audited accounts",
    kind: "document",
    group: "registration",
    seedHolding: "dont_have",
    selfDeclared: false,
    pattern: /audited (accounts|financial statements)/i,
  },
  {
    key: "bank-reference",
    name: "Bank reference",
    kind: "document",
    group: "registration",
    seedHolding: "dont_have",
    selfDeclared: false,
    pattern: /bank reference|letter from [\s\S]{0,24}bank/i,
  },
  {
    key: "nca",
    name: "National Construction Authority (NCA) licence",
    kind: "certification",
    group: "licence",
    seedHolding: "dont_have",
    selfDeclared: false,
    pattern: /\bnca\b|national construction authority/i,
  },
  {
    key: "icta",
    name: "ICT Authority (ICTA) certification",
    kind: "certification",
    group: "licence",
    seedHolding: "dont_have",
    selfDeclared: false,
    pattern: /\bicta\b|ict authority/i,
  },
  {
    key: "ccie",
    name: "Cisco CCIE certification",
    kind: "certification",
    group: "licence",
    seedHolding: "dont_have",
    selfDeclared: false,
    pattern: /\bccie\b|cisco certified/i,
  },
  {
    key: "ca-licence",
    name: "Communications Authority licence",
    kind: "certification",
    group: "licence",
    seedHolding: "dont_have",
    selfDeclared: false,
    pattern: /communications authority|unified licen[cs]e/i,
  },
];

export const PAPER_GROUPS: readonly { id: PaperGroup; title: string }[] = [
  { id: "registration", title: "Registration and common papers" },
  { id: "licence", title: "Industry licences" },
];

/** The words shown on the checklist. */
export function holdingLabel(holding: DocumentHolding, selfDeclared: boolean): string {
  if (holding === "have" && selfDeclared) return "Have (self-declared)";
  if (holding === "have") return "Have";
  if (holding === "expired") return "Expired";
  return "Don't have";
}
