/**
 * The tender fields BidLens extracts. Each group is one LLM call over the pages BM25 finds
 * for its query (ARCHITECTURE §5.1), so a 200-page tender never goes to the model whole.
 */

export const SCALAR_FIELD_KEYS = [
  "buyer",
  "county",
  "reference_number",
  "title",
  "contact",
  "closing_datetime",
  "submission_method",
  "tender_validity",
  "bid_security",
  "performance_security",
  "payment_terms",
  "payment_days",
  "advance_payment",
  "late_payment_interest",
] as const;
export type ScalarFieldKey = (typeof SCALAR_FIELD_KEYS)[number];

export const LIST_FIELD_KEYS = [
  "eligibility",
  "mandatory_requirement",
  "technical_scope",
  "evaluation_criterion",
  "addendum_change",
] as const;
export type ListFieldKey = (typeof LIST_FIELD_KEYS)[number];

export type TenderFieldKey = ScalarFieldKey | ListFieldKey;

export interface FieldSpec {
  label: string;
  /** What to extract, as told to the model. */
  instruction: string;
}

export const FIELD_SPECS: Record<TenderFieldKey, FieldSpec> = {
  buyer: {
    label: "Buyer (procuring entity)",
    instruction: "The procuring entity issuing the tender, as named in the document.",
  },
  county: {
    label: "County",
    instruction: "The Kenyan county of the procuring entity, e.g. 'Nairobi' for Nairobi City County. Null if the buyer is not a county.",
  },
  reference_number: { label: "Tender reference", instruction: "The tender number / reference, exactly as written." },
  title: { label: "Tender title", instruction: "The tender name / subject of procurement." },
  contact: {
    label: "Contact for enquiries",
    instruction: "Who bidders contact for clarifications: office or person, email and/or phone, exactly as written. Never compose an email address.",
  },
  closing_datetime: {
    label: "Closing date and time",
    instruction: "The tender submission deadline (date and time) as written. If the deadline is left blank, value null.",
  },
  submission_method: {
    label: "Submission method",
    instruction: "How and where tenders are submitted (e.g. e-procurement portal, physical tender box, address).",
  },
  tender_validity: { label: "Tender validity", instruction: "How long tenders must remain valid, e.g. '120 days'." },
  bid_security: {
    label: "Bid security",
    instruction: "The tender (bid) security amount or percentage and its form. If the amount is left blank, value null.",
  },
  performance_security: {
    label: "Performance security",
    instruction: "The performance security the winner must provide (amount or %). If the amount is left blank, value null.",
  },
  payment_terms: {
    label: "Payment terms",
    instruction: "How and when the supplier is paid (milestones, on delivery, monthly, etc.).",
  },
  payment_days: {
    label: "Payment period",
    instruction: "The number of days within which the buyer must pay after invoice. If the number is left blank (e.g. 'within ____ days'), value null.",
  },
  advance_payment: {
    label: "Advance payment",
    instruction: "Any advance payment to the supplier (percentage or amount). If the amount is left blank, value null.",
  },
  late_payment_interest: {
    label: "Interest on late payment",
    instruction: "The interest rate the buyer pays on delayed payments (often in the Special Conditions of Contract). If the clause exists but the rate is blank (e.g. 'The interest rate is ____'), value null and quote the blank clause.",
  },
  eligibility: {
    label: "Eligibility",
    instruction: "Who may tender: eligibility conditions on the tenderer (registration, nationality, AGPO/youth/women reservation, not debarred, conflicts of interest). One item per condition.",
  },
  mandatory_requirement: {
    label: "Mandatory requirement",
    instruction: "Each mandatory document or requirement checked at preliminary examination / responsiveness (certificates, tax compliance, forms, securities, licences). One item per requirement, in document order, keeping its number if it has one.",
  },
  technical_scope: {
    label: "Technical scope",
    instruction: "The main deliverables and technical requirements of the work (what must be supplied, installed or delivered). One item per deliverable; at most 25 items.",
  },
  evaluation_criterion: {
    label: "Evaluation criterion",
    instruction: "How tenders are evaluated: stages, criteria, weights, pass marks and the award method (e.g. lowest evaluated price). One item per criterion.",
  },
  addendum_change: {
    label: "Addendum change",
    instruction: "Each change, deletion, extension or clarification this addendum makes to the original tender. value = one sentence saying what changes; affects = the field it changes.",
  },
};

export type FieldGroupKind = "scalar" | "list";

export interface FieldGroup {
  id: string;
  kind: FieldGroupKind;
  keys: readonly TenderFieldKey[];
  /** BM25 query: the words a tender uses for these fields. */
  query: string;
  /** Pages always sent when present (cover page and invitation to tender carry identity and dates). */
  pinnedPages: readonly number[];
  topK: number;
  /** Also send the page after each hit: requirement tables and lists run across page breaks. */
  withNextPage?: boolean;
}

export const MAIN_FIELD_GROUPS: readonly FieldGroup[] = [
  {
    id: "identity",
    kind: "scalar",
    keys: ["buyer", "county", "reference_number", "title", "contact"],
    query: "tender no reference invitation to tender procuring entity county government title supply clarification enquiries email telephone address",
    pinnedPages: [1, 2, 3],
    topK: 6,
  },
  {
    id: "submission",
    kind: "scalar",
    // Bid security sits here because the invitation to tender states it next to the deadline.
    keys: ["closing_datetime", "submission_method", "tender_validity", "bid_security"],
    query: "deadline submission closing date time tenders submitted opened address portal electronic tender box validity period days tender security accompanied ksh",
    pinnedPages: [1],
    topK: 8,
  },
  {
    id: "securities",
    kind: "scalar",
    keys: ["performance_security"],
    query: "performance security percentage contract price bank guarantee successful tenderer signing contract",
    pinnedPages: [],
    topK: 8,
  },
  {
    id: "payment",
    kind: "scalar",
    keys: ["payment_terms", "payment_days", "advance_payment", "late_payment_interest"],
    query: "payment terms invoice days advance payment interest rate delayed payment special conditions of contract SCC GCC milestones",
    pinnedPages: [],
    topK: 8,
  },
  {
    id: "eligibility",
    kind: "list",
    keys: ["eligibility"],
    query: "eligible tenderers eligibility nationality registered debarred conflict of interest youth women persons with disabilities AGPO",
    pinnedPages: [],
    topK: 5,
    withNextPage: true,
  },
  {
    id: "mandatory",
    kind: "list",
    keys: ["mandatory_requirement"],
    query: "mandatory requirements preliminary examination responsiveness certificate incorporation tax compliance KRA PIN form responsive non-responsive",
    pinnedPages: [],
    topK: 6,
    withNextPage: true,
  },
  {
    id: "scope",
    kind: "list",
    keys: ["technical_scope"],
    query: "scope of work technical specifications requirements deliverables supply installation configuration services schedule of requirements",
    pinnedPages: [],
    topK: 5,
    withNextPage: true,
  },
  {
    id: "evaluation",
    kind: "list",
    keys: ["evaluation_criterion"],
    query: "evaluation criteria technical evaluation financial evaluation marks score weight pass mark lowest evaluated award",
    pinnedPages: [],
    topK: 5,
    withNextPage: true,
  },
];

/** An addendum restates identity and may move dates, securities or payment; its changes are listed one by one. */
export const ADDENDUM_FIELD_GROUPS: readonly FieldGroup[] = [
  ...MAIN_FIELD_GROUPS.filter((g) => g.kind === "scalar"),
  {
    id: "addendum_changes",
    kind: "list",
    keys: ["addendum_change"],
    query: "addendum amendment change amended extended deleted replaced purge clarification not applicable revised",
    pinnedPages: [1, 2],
    topK: 8,
  },
];

/** Field keys an addendum change can point at (`other` when it changes something we don't extract). */
export const ADDENDUM_TARGET_KEYS = [
  ...SCALAR_FIELD_KEYS,
  "eligibility",
  "mandatory_requirement",
  "technical_scope",
  "evaluation_criterion",
  "other",
] as const;
export type AddendumTargetKey = (typeof ADDENDUM_TARGET_KEYS)[number];

export function isScalarKey(key: string): key is ScalarFieldKey {
  return (SCALAR_FIELD_KEYS as readonly string[]).includes(key);
}

export function fieldLabel(key: string): string {
  return key in FIELD_SPECS ? FIELD_SPECS[key as TenderFieldKey].label : key.replaceAll("_", " ");
}

/** Display order: identity first, lists last, as in the tables on the tender page. */
export const FIELD_DISPLAY_ORDER: readonly string[] = [...SCALAR_FIELD_KEYS, ...LIST_FIELD_KEYS];
