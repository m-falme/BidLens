import type { CapabilityKind } from "@/lib/db/vocab";

/**
 * Match tender requirements to company capabilities. Code only.
 * A requirement is `met` only when it points at a capability in the list passed in.
 * Certificates, licences and past contracts are never marked met from a service or a tool.
 */

export interface ProfileCapability {
  id: string;
  kind: CapabilityKind;
  name: string;
  detail: string | null;
  evidenceRef: string | null;
}

export interface RequirementInput {
  text: string;
  /** Where the requirement was read. Kept so the UI can show the quote. */
  pageNo: number | null;
  quote: string | null;
  category: "mandatory" | "technical" | "financial" | "contractual";
}

export type ReadinessMatch = "met" | "missing" | "unclear";

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
  /** A missing mandatory proof. Counts as "could disqualify us". */
  disqualifying: boolean;
}

export interface ReadinessResult {
  items: MatchedRequirement[];
  met: number;
  /** Missing plus needs-human. */
  gaps: number;
  couldDisqualify: number;
  /** met / all items, 0–100. 0 when there is nothing to match. */
  readinessPct: number;
}

/** Forms the bidder fills in for this tender. They are not proof the company already holds something. */
const FILL_IN_FORM =
  /form of tender|confidential business questionnaire|price schedule|self[ -]?declaration|code of ethics|independent tender determination|form sd\s*[12]/i;

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

/** Best capability of the allowed kinds whose name is actually in the requirement. */
function findCapability(
  text: string,
  capabilities: readonly ProfileCapability[],
  kinds: ReadonlySet<string>,
): ProfileCapability | null {
  const allowed = capabilities.filter((capability) => kinds.has(capability.kind));
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
  const where = capability.evidenceRef ? ` (${capability.evidenceRef})` : "";
  return {
    text: requirement.text,
    category: requirement.category,
    pageNo: requirement.pageNo,
    quote: requirement.quote,
    match: "met",
    capabilityId: capability.id,
    capabilityName: capability.name,
    evidenceRef: capability.evidenceRef,
    rationale: `Matches "${capability.name}" in the Zanari profile${where}.`,
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
    rationale,
    disqualifying: false,
  };
}

function matchOne(requirement: RequirementInput, capabilities: readonly ProfileCapability[]): MatchedRequirement {
  const text = requirement.text;

  if (FILL_IN_FORM.test(text)) {
    return unclear(
      requirement,
      "This is a form to complete for this bid. A person has to confirm it will be attached. The profile does not prove that.",
    );
  }

  if (HELD_PROOF.test(text)) {
    const capability = findCapability(text, capabilities, PROOF_KINDS);
    if (capability) return met(requirement, capability);
    return missing(
      requirement,
      "The Zanari profile has no certificate, licence or document that covers this. It is not marked met.",
    );
  }

  if (EXPERIENCE.test(text)) {
    const capability = findCapability(text, capabilities, new Set(["experience"]));
    if (capability) return met(requirement, capability);
    return missing(
      requirement,
      "The Zanari profile has no experience record that covers this. It is not marked met.",
    );
  }

  const service = findCapability(text, capabilities, new Set(["service", "tool", "sector"]));
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
): ReadinessResult {
  const known = new Set(capabilities.map((capability) => capability.id));
  const items = requirements.map((requirement) => {
    const item = matchOne(requirement, capabilities);
    if (item.match !== "met") return item;
    const capability = capabilities.find((candidate) => candidate.id === item.capabilityId);
    const proofLine = HELD_PROOF.test(requirement.text) || EXPERIENCE.test(requirement.text);
    const wrongKind = proofLine && capability !== undefined && !PROOF_KINDS.has(capability.kind);
    if (!capability || !known.has(capability.id) || wrongKind) {
      return proofLine
        ? missing(requirement, "No capability in the profile covers this. It is not marked met.")
        : unclear(requirement, "Nothing in the Zanari profile clearly covers this. A person needs to decide.");
    }
    return item;
  });

  const metCount = items.filter((item) => item.match === "met").length;
  const couldDisqualify = items.filter((item) => item.disqualifying).length;
  return {
    items,
    met: metCount,
    gaps: items.length - metCount,
    couldDisqualify,
    readinessPct: items.length === 0 ? 0 : Math.round((metCount / items.length) * 100),
  };
}
