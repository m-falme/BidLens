/** A short summary of a lead that has no tender PDF yet. Pure: the page only displays it. */

export const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "New",
  verification_required: "Verification required",
  potential: "Potential",
  positive: "Positive",
  discovery_scheduled: "Discovery scheduled",
  qualified: "Qualified",
  proposal: "Proposal",
  awaiting_response: "Awaiting response",
  on_hold: "On hold",
  not_qualified: "Not qualified",
  won: "Won",
  lost: "Lost",
};

export interface LeadFieldValue {
  key: string;
  value: string | null;
}

export interface LeadLine {
  label: string;
  value: string;
}

export interface LeadSummary {
  /** Short facts, in reading order. */
  facts: LeadLine[];
  /** Longer text: what the lead says it needs, and what to check. */
  notes: LeadLine[];
  nextAction: string | null;
  /** The sheet's "human verified" mark. Null when the sheet has none. */
  checkedByPerson: boolean | null;
}

const FACTS: readonly (readonly [string, string])[] = [
  ["procuring_entity", "Buyer"],
  ["organization", "Organisation"],
  ["reference", "Reference"],
  ["submission_deadline", "Closes"],
  ["publication_date", "Published"],
  ["location", "Location"],
  ["sector", "Sector"],
  ["industry", "Industry"],
  ["lead_source", "How it was found"],
  ["lead_category", "Lead category"],
  ["stage", "Stage"],
  ["owner", "Owner"],
  ["decision_maker", "Decision maker"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["date_captured", "Captured"],
  ["follow_up_date", "Follow up by"],
  ["zanari_fit", "Fit with your company"],
];

const NOTES: readonly (readonly [string, string])[] = [
  ["key_requirements", "Key requirements"],
  ["eligibility_checks", "Eligibility checks to make"],
  ["initial_notes", "Visit notes"],
  ["additional_questions", "Questions to ask"],
  ["submission_method", "How to submit"],
];

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

/**
 * Picks the useful fields of a lead. A field with no value is left out, and a second line that repeats an
 * earlier one (the same organisation named twice) is dropped.
 */
export function buildLeadSummary(fields: readonly LeadFieldValue[]): LeadSummary {
  const byKey = new Map<string, string>();
  for (const field of fields) {
    const value = clean(field.value);
    if (value && !byKey.has(field.key)) byKey.set(field.key, value);
  }

  const seen = new Set<string>();
  const pick = (list: readonly (readonly [string, string])[]): LeadLine[] =>
    list.flatMap(([key, label]) => {
      const value = byKey.get(key);
      if (!value || seen.has(value.toLowerCase())) return [];
      seen.add(value.toLowerCase());
      return [{ label, value }];
    });

  const verified = byKey.get("human_verified")?.toLowerCase();
  return {
    facts: pick(FACTS),
    notes: pick(NOTES),
    nextAction: byKey.get("next_action") ?? null,
    checkedByPerson: verified === "yes" ? true : verified === "no" ? false : null,
  };
}

export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABEL[status] ?? status.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}
