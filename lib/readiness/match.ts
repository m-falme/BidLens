import { COMPANY_PAPERS, type DocumentHolding } from "@/lib/company/papers";
import type { CapabilityKind } from "@/lib/db/vocab";

/**
 * Match tender requirements to company capabilities. Code only.
 * A requirement is `met` only when it points at a capability in the list passed in.
 * Certificates, licences and past contracts are never marked met from a service or a tool.
 * A paper marked Don't have or Expired is not met. Have (self-declared) is the team's mark,
 * not a file that was checked. Forms to fill and sign are `to_prepare`, not gaps.
 */

export interface ProfileCapability {
  id: string;
  kind: CapabilityKind;
  name: string;
  detail: string | null;
  evidenceRef: string | null;
  /** Null on services and tools. Papers use have / dont_have / expired. */
  holding?: DocumentHolding | null;
  /** True when Have was declared by the team, not read from a file. */
  selfDeclared?: boolean;
  /** ISO date. A Have whose date is before `asOf` is treated as expired. */
  expiresOn?: string | null;
}

export interface RequirementInput {
  text: string;
  /** Where the requirement was read. Kept so the UI can show the quote. */
  pageNo: number | null;
  quote: string | null;
  category: "mandatory" | "technical" | "financial" | "contractual";
}

export type ReadinessMatch = "met" | "missing" | "unclear" | "to_prepare";

export interface MatchedRequirement {
  text: string;
  category: RequirementInput["category"];
  pageNo: number | null;
  quote: string | null;
  match: ReadinessMatch;
  capabilityId: string | null;
  capabilityName: string | null;
  evidenceRef: string | null;
  rationale: string;
  /** The linked paper was marked Have by the team. The file was not checked. */
  selfDeclared: boolean;
  /** A missing mandatory proof. Counts as "could disqualify us". */
  disqualifying: boolean;
}

export interface ReadinessResult {
  items: MatchedRequirement[];
  met: number;
  /** Missing plus needs-human. Forms to prepare are not gaps. */
  gaps: number;
  /** Forms to fill in and sign for this bid. */
  toPrepare: number;
  couldDisqualify: number;
  /** met / (met + gaps), 0–100. Forms to prepare are left out. 0 when nothing is scored. */
  readinessPct: number;
}

/**
 * Forms and submission paperwork the bidder prepares for this tender.
 * Not proof the company already holds a licence or a registration paper.
 */
const PREPARE =
  /form of tender|confidential business questionnaire|price schedule|self[ -]?declaration|code of ethics|independent tender determination|\bsd\s*[12]\b|power of attorney|litigation history|paginated|serialized/i;

/** Badge text. A self-declared match is never shown as a checked document. */
export function readinessLabel(item: Pick<MatchedRequirement, "match" | "selfDeclared">): string {
  if (item.match === "met" && item.selfDeclared) return "Met (self-declared)";
  if (item.match === "met") return "Met";
  if (item.match === "to_prepare") return "To prepare";
  if (item.match === "missing") return "Missing";
  return "Needs human";
}

/**
 * Something the company must already hold. A service offering is not this.
 * Kept specific so "3 year licence subscription" (a deliverable) is not treated as a company licence.
 */
const HELD_PROOF =
  /certificate of (registration|incorporation)|incorporation or registration|tax compliance|kra\s*pin|\bcr\s*1[23]\b|business permit|audited accounts|tender security|bid bond|bid security|\bnca\b|national construction authority|\bicta\b|ict authority|\bccie\b|cisco certified|unified licen[cs]e|communications authority|turnover of/i;

const EXPERIENCE = /similar (works|work|contracts|contract|projects|project)|years? of experience|reference sites?/i;

const PROOF_KINDS = new Set<CapabilityKind>(["certification", "document", "experience"]);

const STOP = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "must",
  "shall",
  "provide",
  "copy",
  "valid",
  "certified",
  "duly",
  "filled",
  "signed",
  "stamped",
]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !STOP.has(token));
}

function phraseIn(haystack: string, name: string): boolean {
  const needle = name.toLowerCase().replace(/\s+/g, " ").trim();
  return needle.length >= 8 && haystack.toLowerCase().includes(needle);
}

/** A paper the team does not currently hold cannot satisfy a requirement. Null holding (services) can. */
function isHeld(capability: ProfileCapability, asOf: string): boolean {
  if (capability.holding === "dont_have" || capability.holding === "expired") return false;
  if (capability.expiresOn && capability.expiresOn < asOf) return false;
  return true;
}

function holdingWords(capability: ProfileCapability, asOf: string): "Expired" | "Don't have" {
  if (capability.holding === "expired" || (capability.expiresOn && capability.expiresOn < asOf)) return "Expired";
  return "Don't have";
}

/** Best held capability of the allowed kinds whose name is actually in the requirement. */
function findCapability(
  text: string,
  capabilities: readonly ProfileCapability[],
  kinds: ReadonlySet<string>,
  asOf: string,
): ProfileCapability | null {
  const allowed = capabilities.filter((capability) => kinds.has(capability.kind) && isHeld(capability, asOf));
  const phrase = allowed.find((capability) => phraseIn(text, capability.name));
  if (phrase) return phrase;

  let best: { capability: ProfileCapability; score: number } | null = null;
  const hay = new Set(tokens(text));
  for (const capability of allowed) {
    const nameTokens = tokens(capability.name);
    if (nameTokens.length < 2) continue;
    const shared = nameTokens.filter((token) => hay.has(token)).length;
    const score = shared / nameTokens.length;
    if (score >= 0.6 && shared >= 2 && (!best || score > best.score)) best = { capability, score };
  }
  return best?.capability ?? null;
}

function met(requirement: RequirementInput, capability: ProfileCapability): MatchedRequirement {
  const selfDeclared = capability.selfDeclared === true;
  const where = capability.evidenceRef ? ` (${capability.evidenceRef})` : "";
  const ids = /national id|passport/i.test(requirement.text)
    ? " This line also asks for director ID copies, which still have to be attached."
    : "";
  return {
    text: requirement.text,
    category: requirement.category,
    pageNo: requirement.pageNo,
    quote: requirement.quote,
    match: "met",
    capabilityId: capability.id,
    capabilityName: capability.name,
    evidenceRef: capability.evidenceRef,
    selfDeclared,
    rationale: selfDeclared
      ? `Zanari has marked "${capability.name}" as Have (self-declared). The file has not been checked.${ids}`
      : `Matches "${capability.name}" in the Zanari profile${where}.`,
    disqualifying: false,
  };
}

function missing(requirement: RequirementInput, rationale: string): MatchedRequirement {
  return {
    text: requirement.text,
    category: requirement.category,
    pageNo: requirement.pageNo,
    quote: requirement.quote,
    match: "missing",
    capabilityId: null,
    capabilityName: null,
    evidenceRef: null,
    rationale,
    selfDeclared: false,
    disqualifying: requirement.category === "mandatory",
  };
}

function unclear(requirement: RequirementInput, rationale: string): MatchedRequirement {
  return {
    text: requirement.text,
    category: requirement.category,
    pageNo: requirement.pageNo,
    quote: requirement.quote,
    match: "unclear",
    capabilityId: null,
    capabilityName: null,
    evidenceRef: null,
    selfDeclared: false,
    rationale,
    disqualifying: false,
  };
}

function toPrepare(requirement: RequirementInput, rationale: string): MatchedRequirement {
  return {
    text: requirement.text,
    category: requirement.category,
    pageNo: requirement.pageNo,
    quote: requirement.quote,
    match: "to_prepare",
    capabilityId: null,
    capabilityName: null,
    evidenceRef: null,
    selfDeclared: false,
    rationale,
    disqualifying: false,
  };
}

function matchOne(
  requirement: RequirementInput,
  capabilities: readonly ProfileCapability[],
  asOf: string,
): MatchedRequirement {
  const text = requirement.text;

  if (PREPARE.test(text)) {
    return toPrepare(
      requirement,
      "This is a form or submission paper to fill in and sign for this bid. It is to prepare, not a gap in the company papers.",
    );
  }

  const paper = COMPANY_PAPERS.find((item) => item.pattern.test(text));
  if (paper) {
    const capability = capabilities.find((item) => item.name === paper.name);
    if (capability && isHeld(capability, asOf)) return met(requirement, capability);
    if (capability) {
      return missing(
        requirement,
        `Zanari has marked "${capability.name}" as ${holdingWords(capability, asOf)}. It is not met.`,
      );
    }
  }

  if (HELD_PROOF.test(text)) {
    const capability = findCapability(text, capabilities, PROOF_KINDS, asOf);
    if (capability) return met(requirement, capability);
    return missing(
      requirement,
      "The Zanari profile has no certificate, licence or document that covers this. It is not marked met.",
    );
  }

  if (EXPERIENCE.test(text)) {
    const capability = findCapability(text, capabilities, new Set(["experience"]), asOf);
    if (capability) return met(requirement, capability);
    return missing(
      requirement,
      "The Zanari profile has no experience record that covers this. It is not marked met.",
    );
  }

  const service = findCapability(text, capabilities, new Set(["service", "tool", "sector"]), asOf);
  if (service) return met(requirement, service);
  return unclear(requirement, "Nothing in the Zanari profile clearly covers this. A person needs to decide.");
}

const WITHDRAWN = /remov|delet|will not be considered|not applicable/i;
const COMMON_CHANGE_WORDS = new Set([
  "requirement",
  "certificate",
  "certified",
  "valid",
  "category",
  "services",
  "service",
  "evaluation",
  "process",
  "considered",
  "removed",
  "tender",
]);

/**
 * True when an addendum withdraws this requirement, so it must not count as a gap.
 * Needs more than a shared generic word: a specific token such as "nca", or two rarer words.
 */
export function isWithdrawnByAddendum(requirementText: string, changes: readonly string[]): boolean {
  const hay = requirementText.toLowerCase();
  return changes.some((change) => {
    if (!WITHDRAWN.test(change)) return false;
    // Short words ("will", "not") appear in unrelated requirements. Require two longer words.
    const rare = tokens(change).filter((token) => token.length >= 5 && !COMMON_CHANGE_WORDS.has(token));
    const hits = rare.filter((token) => hay.includes(token));
    return hits.length >= 2;
  });
}

/**
 * Match every requirement. A `met` row always carries a capability id from `capabilities`.
 * Held-proof lines never link to a service, tool or sector.
 */
export function matchRequirements(
  requirements: readonly RequirementInput[],
  capabilities: readonly ProfileCapability[],
  asOf = new Date().toISOString().slice(0, 10),
): ReadinessResult {
  const known = new Set(capabilities.map((capability) => capability.id));
  const items = requirements.map((requirement) => {
    const item = matchOne(requirement, capabilities, asOf);
    if (item.match !== "met") return item;
    const capability = capabilities.find((candidate) => candidate.id === item.capabilityId);
    const proofLine = HELD_PROOF.test(requirement.text) || EXPERIENCE.test(requirement.text) || paperLine(requirement.text);
    const wrongKind = proofLine && capability !== undefined && !PROOF_KINDS.has(capability.kind);
    const notHeld = capability !== undefined && !isHeld(capability, asOf);
    if (!capability || !known.has(capability.id) || wrongKind || notHeld) {
      return proofLine
        ? missing(requirement, "No capability in the profile covers this. It is not marked met.")
        : unclear(requirement, "Nothing in the Zanari profile clearly covers this. A person needs to decide.");
    }
    return item;
  });

  const metCount = items.filter((item) => item.match === "met").length;
  const toPrepare = items.filter((item) => item.match === "to_prepare").length;
  const gaps = items.filter((item) => item.match === "missing" || item.match === "unclear").length;
  const couldDisqualify = items.filter((item) => item.disqualifying).length;
  const scored = metCount + gaps;
  return {
    items,
    met: metCount,
    gaps,
    toPrepare,
    couldDisqualify,
    readinessPct: scored === 0 ? 0 : Math.round((metCount / scored) * 100),
  };
}

function paperLine(text: string): boolean {
  return COMPANY_PAPERS.some((paper) => paper.pattern.test(text));
}
