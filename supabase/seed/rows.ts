import type { CobDataQuality, RiskBand, RiskConfidence } from "@/lib/risk/county-score";

/**
 * Insert shapes for the tables the seed writes, mirroring supabase/migrations/0001_init.sql.
 * Replace with `supabase gen types` output once a project is linked.
 */

export type CapabilityKind = "service" | "tool" | "document" | "certification" | "experience" | "sector";

export const OPPORTUNITY_STATUSES = [
  "new",
  "verification_required",
  "potential",
  "positive",
  "discovery_scheduled",
  "qualified",
  "proposal",
  "awaiting_response",
  "on_hold",
  "not_qualified",
  "won",
  "lost",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export type FieldStatus = "source_confirmed" | "ai_inferred" | "blank_in_source" | "needs_human";

export interface CompanyRow {
  id: string;
  name: string;
  profile_json: Record<string, unknown>;
}

export interface CapabilityRow {
  id: string;
  company_id: string;
  kind: CapabilityKind;
  name: string;
  detail: string | null;
  evidence_ref: string;
  verified: boolean;
}

export interface OpportunityRow {
  id: string;
  company_id: string;
  type: "procurement" | "field";
  title: string;
  organization: string | null;
  location: string | null;
  sector: string | null;
  reference: string | null;
  deadline_at: string | null;
  submission_method: string | null;
  source_platform: string | null;
  source_url: string | null;
  retrieved_at: string | null;
  status: OpportunityStatus;
  owner: string | null;
  next_action: string | null;
  follow_up_on: string | null;
  readiness_pct: number | null;
  buyer_county: string | null;
}

export interface SourceRow {
  id: string;
  opportunity_id: string;
  kind: "pdf" | "text" | "image" | "audio" | "form" | "email";
  storage_path: string | null;
  original_name: string;
  sha256: string;
  raw_text: string;
}

export interface SourcePageRow {
  id: string;
  source_id: string;
  page_no: number;
  text: string;
  is_scanned: boolean;
}

export interface FieldRow {
  id: string;
  opportunity_id: string;
  key: string;
  value: string | null;
  source_id: string;
  page_no: number;
  quote: string | null;
  confidence: number;
  status: FieldStatus;
}

export interface CountyPendingBillsRow {
  id: string;
  county: string;
  report_date: string;
  pending_total_kes_m: number | null;
  budget_kes_m: number | null;
  age_under_1y_kes_m: number | null;
  age_1_2y_kes_m: number | null;
  age_2_3y_kes_m: number | null;
  age_over_3y_kes_m: number | null;
  ageing_total_kes_m: number | null;
  pct_over_2y: number | null;
  pct_over_3y: number | null;
  trend_pct: number | null;
  data_quality: CobDataQuality;
  data_notes: string | null;
  source: string;
  source_url: string;
  retrieved_at: string | null;
}

export interface CountyRiskRow {
  id: string;
  county: string;
  pending_bills_id: string;
  score: number | null;
  band: RiskBand;
  confidence: RiskConfidence;
  part_a: number | null;
  part_b: number | null;
  part_c: number | null;
  reason: string | null;
  as_of: string;
}

export interface SeedTables {
  companies: CompanyRow;
  capabilities: CapabilityRow;
  opportunities: OpportunityRow;
  sources: SourceRow;
  source_pages: SourcePageRow;
  fields: FieldRow;
  county_pending_bills: CountyPendingBillsRow;
  county_risk: CountyRiskRow;
}

export type SeedTable = keyof SeedTables;

/**
 * `refresh`: reference data, re-seeding updates it in place.
 * `insert_only`: records people edit; re-seeding never overwrites them.
 */
export type ConflictMode = "refresh" | "insert_only";

export type SeedStep = {
  [T in SeedTable]: { table: T; mode: ConflictMode; rows: SeedTables[T][] };
}[SeedTable];
