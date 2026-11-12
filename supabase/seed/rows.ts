import type { Database } from "@/lib/db/database.types";
import type { CapabilityKind, FieldStatus, OpportunityStatus, SourceKind } from "@/lib/db/vocab";
import type { CobDataQuality, RiskBand, RiskConfidence } from "@/lib/risk/county-score";

export { OPPORTUNITY_STATUSES } from "@/lib/db/vocab";
export type { CapabilityKind, FieldStatus, OpportunityStatus } from "@/lib/db/vocab";

type Tables = Database["public"]["Tables"];

type DbManaged = "created_at" | "updated_at";

/**
 * A table's generated row (`npx supabase gen types --remote`) minus timestamps and the columns
 * the seed leaves to their defaults, with CHECK-constrained text columns narrowed.
 */
type SeedRow<T extends keyof Tables, Narrowed = object, Defaulted extends string = never> = Omit<
  Tables[T]["Row"],
  DbManaged | Defaulted | keyof Narrowed
> &
  Narrowed;

export type CompanyRow = SeedRow<"companies", { profile_json: Record<string, unknown> }>;
export type CapabilityRow = SeedRow<"capabilities", { kind: CapabilityKind; evidence_ref: string }>;
export type OpportunityRow = SeedRow<
  "opportunities",
  { type: "procurement" | "field"; status: OpportunityStatus },
  "contract_value_kes" | "delivery_cost_kes"
>;
export type SourceRow = SeedRow<"sources", { opportunity_id: string; kind: SourceKind; raw_text: string }, "role">;
export type SourcePageRow = SeedRow<"source_pages">;
export type FieldRow = SeedRow<
  "fields",
  { source_id: string; page_no: number; status: FieldStatus },
  "original_value" | "edited_by" | "edited_at" | "extraction_run_id" | "ordinal" | "affects_key"
>;
export type CountyPendingBillsRow = SeedRow<"county_pending_bills", { data_quality: CobDataQuality }>;
export type CountyRiskRow = SeedRow<"county_risk", { band: RiskBand; confidence: RiskConfidence }>;

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
