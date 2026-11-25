import { formatWhen } from "@/lib/format/display";
import { statusFromQuoteCheck } from "@/lib/verify";

import type { Tender } from "./source";

/** Stored on the lead so a second "Start this tender" finds it. */
export const SAMPLE_PLATFORM = "sample";

export interface LeadFieldDraft {
  key: string;
  value: string;
  quote: string;
  status: "source_confirmed" | "needs_human";
}

export interface LeadDraft {
  title: string;
  organization: string;
  location: string | null;
  sector: string | null;
  reference: string;
  deadlineAt: string;
  submissionMethod: string | null;
  buyerCounty: string | null;
  /** The notice as one page of text; every field quotes it. */
  pageText: string;
  fields: LeadFieldDraft[];
}

export interface StartDeps {
  /** The lead already created from this reference, if any. */
  findExisting(reference: string): Promise<string | null>;
  create(draft: LeadDraft): Promise<string>;
}

export type StartResult = { ok: true; leadId: string; alreadyStarted: boolean };

/** How the lead says it was found. Shown on the lead, so nobody mistakes it for a real notice. */
export const FOUND_VIA = "Find tenders agent (sample dataset, fictional notice)";

function closesText(tender: Tender): string {
  return formatWhen(tender.closing_datetime) ?? tender.closing_datetime;
}

function pageTextFor(tender: Tender): string {
  const lines: [string, string | null][] = [
    ["Reference", tender.reference],
    ["Title", tender.title],
    ["Buyer", tender.buyer],
    ["County", tender.county],
    ["Location", tender.location],
    ["Sector", tender.sector],
    ["Published", tender.published_on],
    ["Closes", closesText(tender)],
    ["How it was found", FOUND_VIA],
    ["Estimated value (KES)", tender.estimated_value_kes === null ? null : String(tender.estimated_value_kes)],
    ["Reserved for AGPO", tender.reserved_for_agpo],
    ["Eligibility", tender.eligibility.join(" | ")],
    ["Submission", tender.submission_method],
  ];
  return lines
    .filter((line): line is [string, string] => line[1] !== null && line[1] !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** The lead's fields, copied from the sample notice. The quote check runs in code, like every other field. */
export function buildLeadDraft(tender: Tender): LeadDraft {
  const pageText = pageTextFor(tender);
  const candidates: [string, string | null][] = [
    ["procuring_entity", tender.buyer],
    ["reference", tender.reference],
    ["submission_deadline", closesText(tender)],
    ["lead_source", FOUND_VIA],
    ["publication_date", tender.published_on],
    ["location", tender.location],
    ["sector", tender.sector],
    ["submission_method", tender.submission_method],
  ];
  const fields = candidates
    .filter((c): c is [string, string] => c[1] !== null && c[1] !== "")
    .map(([key, value]) => ({ key, value, quote: value, status: statusFromQuoteCheck(value, pageText) }));
  return {
    title: tender.title,
    organization: tender.buyer,
    location: tender.location,
    sector: tender.sector,
    reference: tender.reference,
    deadlineAt: tender.closing_datetime,
    submissionMethod: tender.submission_method,
    buyerCounty: tender.county,
    pageText,
    fields,
  };
}

/**
 * Creates a lead from a result, once. A second call for the same reference returns the lead already made. It never
 * records a decision. Two clicks at the same instant could still both insert (no unique index); the button is
 * disabled while the first is pending.
 */
export async function startTender(tender: Tender, deps: StartDeps): Promise<StartResult> {
  const existing = await deps.findExisting(tender.reference);
  if (existing) return { ok: true, leadId: existing, alreadyStarted: true };
  const leadId = await deps.create(buildLeadDraft(tender));
  return { ok: true, leadId, alreadyStarted: false };
}
