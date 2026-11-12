/**
 * Status vocabularies enforced by CHECK constraints in supabase/migrations. Generated types
 * see these columns as plain `text`, so code narrows them with these unions.
 */

export const FIELD_STATUSES = ["source_confirmed", "ai_inferred", "blank_in_source", "needs_human"] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

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

export type SourceKind = "pdf" | "text" | "image" | "audio" | "form" | "email";

export const SOURCE_ROLES = ["main", "addendum"] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

export type ExtractionRunStatus = "running" | "succeeded" | "failed";
