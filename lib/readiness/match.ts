import { COMPANY_PAPERS, documentIsExpired, type DocumentHolding } from "@/lib/company/papers";
import type { CapabilityKind } from "@/lib/db/vocab";

import { documentSynonym } from "./synonyms";

/**
 * Match tender requirements to company capabilities. Code only.
 * A requirement is `met` only when it points at a capability in the list passed in.
 * Certificates, licences and past contracts are never marked met from a service or a tool.
 * A paper marked Don't have or Expired is not met. A Have with no date is still met.
 * A Have counts as expired only when its date is before today. Have (self-declared) is the
 * team's mark, not a file that was checked. Forms to fill and sign are `to_prepare`, not gaps.
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
  /** ISO date. A Have whose date is before `asOf` is treated as expired. No date is not expired. */
  expiresOn?: string | null;
  /** Ticked "Does not expire". A blank date is not an expiry. */
  neverExpires?: boolean;
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
  /** Met from a company document or certification, so the screen can link to it. */
  onChecklist: boolean;
  /** The tender asks for a document that is not on the company list yet. */
  unlisted: boolean;
  /** The company paper that would satisfy this line is expired. */
  expired: boolean;
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
  if (item.match === "met" && item.selfDeclared) return "Claimed, not verified";
  if (item.match === "met") return "Met";
  if (item.match === "to_prepare") return "To prepare";
  if (item.match === "missing") return "Missing";
  return "Needs human";
}

/**
 * Gaps first, then everything else. Order inside each group stays as extracted.
 * A could-disqualify row is a gap, so it sorts with the gaps.
 */
export function complianceDisplayOrder<T extends { match: ReadinessMatch }>(items: readonly T[]): T[] {
  const gap = (match: ReadinessMatch) => (match === "missing" || match === "unclear" ? 0 : 1);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => gap(a.item.match) - gap(b.item.match) || a.index - b.index)
    .map((row) => row.item);
}

/**
 * met + gaps + to prepare = the requirements on the table.
 * Could-disqualify is named inside the gap count, not added again.
 */
export function complianceCountLine(
  result: Pick<ReadinessResult, "met" | "gaps" | "toPrepare" | "couldDisqualify">,
): string {
  const total = result.met + result.gaps + result.toPrepare;
  const gaps = `${result.gaps} ${result.gaps === 1 ? "gap" : "gaps"}`;
  const qualify = result.couldDisqualify > 0 ? ` (${result.couldDisqualify} could disqualify)` : "";
  const noun = total === 1 ? "requirement" : "requirements";
  return `${total} ${noun}: ${result.met} met, ${gaps}${qualify}, ${result.toPrepare} to prepare`;
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

/**
 * A company record is a title from the evidence library.
 * A tender sentence (an instruction, or a line that states a shilling amount) is not one.
 */
const TENDER_REQUIREMENT_LINE =
  /\b(?:kshs?\.?|kes|kenya shillings)\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|^(?:\d+[\).\s]+)?(?:attach|must submit|must provide|shall submit|shall provide|submit a|provide certified)\b/i;

export function isCompanyRecordName(name: string): boolean {
  const text = name.replace(/\s+/g, " ").trim();
  return text.length > 0 && !TENDER_REQUIREMENT_LINE.test(text);
}

function phraseIn(haystack: string, name: string): boolean {
  const needle = name.toLowerCase().replace(/\s+/g, " ").trim();
  return needle.length >= 8 && haystack.toLowerCase().includes(needle);
}

/** A paper the team does not currently hold cannot satisfy a requirement. Null holding (services) can. */
function isHeld(capability: ProfileCapability, asOf: string): boolean {
  if (capability.holding === "dont_have" || capability.holding === "expired") return false;
  if (capability.neverExpires) return true;
  if (documentIsExpired(capability.expiresOn, asOf)) return false;
  return true;
}

function holdingWords(capability: ProfileCapability, asOf: string): "Expired" | "Don't have" {
  if (capability.holding === "expired" || documentIsExpired(capability.expiresOn, asOf)) return "Expired";
  return "Don't have";
}

/** Best held capability of the allowed kinds whose name is actually in the requirement. */
function findCapability(
  text: string,
  capabilities: readonly ProfileCapability[],
  kinds: ReadonlySet<string>,
  asOf: string,
  includeUnheld = false,
): ProfileCapability | null {
  const allowed = capabilities.filter(
    (capability) => kinds.has(capability.kind) && (includeUnheld || isHeld(capability, asOf)),
  );
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

interface CompanyVoice {
  actor: string;
  profile: string;
}

/** Wording for whichever company is signed in. Falls back to "your company". */
function companyVoice(companyName?: string | null): CompanyVoice {
  const name = companyName?.trim();
  if (!name || /^your company$/i.test(name)) {
    return { actor: "Your company", profile: "your company profile" };
  }
  return { actor: name, profile: `the ${name} profile` };
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function met(requirement: RequirementInput, capability: ProfileCapability, voice: CompanyVoice): MatchedRequirement {
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
      ? `${voice.actor} has marked "${capability.name}" as Have (self-declared). The file has not been checked.${ids}`
      : `Matches "${capability.name}" in ${voice.profile}${where}.`,
    disqualifying: false,
    onChecklist: capability.kind === "document" || capability.kind === "certification",
    unlisted: false,
    expired: false,
  };
}

function missing(
  requirement: RequirementInput,
  rationale: string,
  unlisted = false,
  expired = false,
  capabilityName: string | null = null,
): MatchedRequirement {
  return {
    text: requirement.text,
    category: requirement.category,
    pageNo: requirement.pageNo,
    quote: requirement.quote,
    match: "missing",
    capabilityId: null,
    capabilityName,
    evidenceRef: null,
    rationale,
    selfDeclared: false,
    disqualifying: requirement.category === "mandatory",
    onChecklist: false,
    unlisted,
    expired,
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
    onChecklist: false,
    unlisted: false,
    expired: false,
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
    onChecklist: false,
    unlisted: false,
    expired: false,
  };
}

/** A checklist paper, or another document that uses the same name for it. */
function paperFor(text: string): (typeof COMPANY_PAPERS)[number] | undefined {
  const byPattern = COMPANY_PAPERS.find((item) => item.pattern.test(text));
  if (byPattern) return byPattern;
  const group = documentSynonym(text);
  if (!group) return undefined;
  return COMPANY_PAPERS.find((item) => documentSynonym(item.name) === group);
}

/** Documents and certifications whose name is a synonym of this requirement. Services are ignored. */
function synonymDocuments(text: string, capabilities: readonly ProfileCapability[]): ProfileCapability[] {
  const group = documentSynonym(text);
  if (!group) return [];
  return capabilities.filter(
    (capability) =>
      (capability.kind === "document" || capability.kind === "certification") &&
      documentSynonym(capability.name) === group,
  );
}

function notHeld(
  requirement: RequirementInput,
  capability: ProfileCapability,
  asOf: string,
  voice: CompanyVoice,
): MatchedRequirement {
  const state = holdingWords(capability, asOf);
  return missing(
    requirement,
    `${voice.actor} has marked "${capability.name}" as ${state}. It is not met.`,
    false,
    state === "Expired",
    capability.name,
  );
}

/** Prefer a paper the company holds. A Don't have row is used only when nothing held shares the name. */
function paperCapability(
  paperName: string,
  text: string,
  capabilities: readonly ProfileCapability[],
  asOf: string,
): ProfileCapability | undefined {
  const named = capabilities.find((item) => item.name === paperName);
  const synonyms = synonymDocuments(text, capabilities);
  if (named && isHeld(named, asOf)) return named;
  const held = synonyms.find((item) => isHeld(item, asOf));
  return held ?? named ?? synonyms[0];
}

function matchOne(
  requirement: RequirementInput,
  capabilities: readonly ProfileCapability[],
  asOf: string,
  voice: CompanyVoice,
): MatchedRequirement {
  const text = requirement.text;

  if (PREPARE.test(text)) {
    return toPrepare(
      requirement,
      "This is a form or submission paper to fill in and sign for this bid. It is to prepare, not a gap in the company papers.",
    );
  }

  const paper = paperFor(text);
  if (paper) {
    const capability = paperCapability(paper.name, text, capabilities, asOf);
    if (capability && isHeld(capability, asOf)) return met(requirement, capability, voice);
    if (capability) return notHeld(requirement, capability, asOf, voice);
  }

  if (HELD_PROOF.test(text)) {
    const capability = findCapability(text, capabilities, PROOF_KINDS, asOf);
    if (capability) return met(requirement, capability, voice);
    const listed = findCapability(text, capabilities, new Set(["document", "certification"]), asOf, true);
    if (listed && isHeld(listed, asOf)) return met(requirement, listed, voice);
    if (listed) return notHeld(requirement, listed, asOf, voice);
    const synonyms = synonymDocuments(text, capabilities);
    const synonym = synonyms.find((item) => isHeld(item, asOf)) ?? synonyms[0];
    if (synonym && isHeld(synonym, asOf)) return met(requirement, synonym, voice);
    if (synonym) return notHeld(requirement, synonym, asOf, voice);
    const group = documentSynonym(text);
    const knownPaper = COMPANY_PAPERS.some(
      (item) => item.pattern.test(text) || (group !== null && documentSynonym(item.name) === group),
    );
    return missing(
      requirement,
      `${cap(voice.profile)} has no certificate, licence or document that covers this. It is not marked met.`,
      !knownPaper,
    );
  }

  const synonyms = synonymDocuments(text, capabilities);
  const synonym = synonyms.find((item) => isHeld(item, asOf)) ?? synonyms[0];
  if (synonym && isHeld(synonym, asOf)) return met(requirement, synonym, voice);
  if (synonym) return notHeld(requirement, synonym, asOf, voice);

  if (EXPERIENCE.test(text)) {
    const capability = findCapability(text, capabilities, new Set(["experience"]), asOf);
    if (capability) return met(requirement, capability, voice);
    return missing(
      requirement,
      `${cap(voice.profile)} has no experience record that covers this. It is not marked met.`,
    );
  }

  const service = findCapability(text, capabilities, new Set(["service", "tool", "sector"]), asOf);
  if (service) return met(requirement, service, voice);
  return unclear(requirement, `Nothing in ${voice.profile} clearly covers this. A person needs to decide.`);
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
  companyName?: string | null,
): ReadinessResult {
  const voice = companyVoice(companyName);
  const library = capabilities.filter((capability) => isCompanyRecordName(capability.name));
  const known = new Set(library.map((capability) => capability.id));
  const items = requirements.map((requirement) => {
    const item = matchOne(requirement, library, asOf, voice);
    if (item.match !== "met") return item;
    const capability = library.find((candidate) => candidate.id === item.capabilityId);
    const proofLine = HELD_PROOF.test(requirement.text) || EXPERIENCE.test(requirement.text) || paperLine(requirement.text);
    const wrongKind = proofLine && capability !== undefined && !PROOF_KINDS.has(capability.kind);
    const notHeld = capability !== undefined && !isHeld(capability, asOf);
    if (!capability || !known.has(capability.id) || wrongKind || notHeld) {
      return proofLine
        ? missing(requirement, "No capability in the profile covers this. It is not marked met.")
        : unclear(requirement, `Nothing in ${voice.profile} clearly covers this. A person needs to decide.`);
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
