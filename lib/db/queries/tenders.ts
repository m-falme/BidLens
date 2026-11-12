import "server-only";

import { DEMO_COMPANY_NAME } from "@/lib/app-config";
import { asDecision, closingLabel, matchCountyName, type DecisionChoice } from "@/lib/format/display";
import { asRecommendationLabel, type RecommendationLabel } from "@/lib/recommendation/labels";
import { latestLabelByTender } from "@/lib/recommendation/trail";
import { RISK_BANDS, type RiskBand } from "@/lib/risk/county-score";
import type { ExtractedField, GroupStats } from "@/lib/tenders/extract-pipeline";

import type { Database, Json } from "../database.types";
import { getServiceClient, SOURCES_BUCKET } from "../supabase-server";
import type { ExtractionRunStatus, FieldStatus, SourceRole } from "../vocab";

type Tables = Database["public"]["Tables"];
export type FieldRecord = Tables["fields"]["Row"] & { status: FieldStatus };
export type SourceRecord = Pick<
  Tables["sources"]["Row"],
  "id" | "created_at" | "kind" | "original_name" | "storage_path" | "sha256"
> & { role: SourceRole };
export type RunRecord = Pick<
  Tables["extraction_runs"]["Row"],
  "id" | "source_id" | "created_at" | "finished_at" | "error" | "model" | "provider" | "prompt_version" | "stats_json"
> & { status: ExtractionRunStatus };

/** A run left `running` longer than this crashed or timed out (the route's maxDuration is 300 s). */
const STALE_RUN_MS = 10 * 60 * 1000;
const INSERT_CHUNK = 200;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export async function getDemoCompanyId(): Promise<string> {
  const { data, error } = await getServiceClient().from("companies").select("id").eq("name", DEMO_COMPANY_NAME).single();
  if (error || !data) fail(`company "${DEMO_COMPANY_NAME}" was not found`, error);
  return data.id;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface TenderListItem {
  id: string;
  title: string;
  organization: string | null;
  reference: string | null;
  created_at: string;
  pdfSources: number;
  addenda: number;
  fieldCount: number;
  needsHuman: number;
  county: string | null;
  closing: string | null;
  finalLabel: RecommendationLabel | null;
  riskBand: RiskBand | null;
  riskScore: number | null;
}

function asBand(value: string | null): RiskBand | null {
  return RISK_BANDS.find((band) => band === value) ?? null;
}

function asKes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

function fieldValue(fields: readonly { key: string; value: string | null }[], key: string): string | null {
  return fields.find((field) => field.key === key && field.value)?.value ?? null;
}

export async function listTenders(): Promise<TenderListItem[]> {
  const db = getServiceClient();
  const [{ data, error }, risk, recorded] = await Promise.all([
    db
      .from("opportunities")
      .select(
        "id, title, organization, reference, created_at, deadline_at, buyer_county, sources(kind, role), fields(status, key, value)",
      )
      .eq("type", "procurement")
      .order("created_at", { ascending: false }),
    db.from("county_risk").select("county, band, score"),
    db.from("bid_decisions").select("tender_id, final_label, created_at"),
  ]);
  if (error) fail("list tenders", error);
  if (risk.error) fail("list county risk", risk.error);
  if (recorded.error) fail("list bid decisions", recorded.error);
  const labels = latestLabelByTender(
    recorded.data.flatMap((row) => {
      const finalLabel = asRecommendationLabel(row.final_label);
      if (!finalLabel) return [];
      return [{ tenderId: row.tender_id, finalLabel, createdAt: row.created_at }];
    }),
  );
  const counties = risk.data.map((row) => row.county);
  return data.map((o) => {
    const countyName = matchCountyName(fieldValue(o.fields, "county") ?? o.buyer_county, counties);
    const county = countyName ? risk.data.find((row) => row.county === countyName) : undefined;
    return {
      id: o.id,
      title: o.title,
      organization: o.organization,
      reference: o.reference,
      created_at: o.created_at,
      pdfSources: o.sources.filter((s) => s.kind === "pdf").length,
      addenda: o.sources.filter((s) => s.role === "addendum").length,
      fieldCount: o.fields.length,
      needsHuman: o.fields.filter((f) => f.status === "needs_human").length,
      county: countyName,
      closing: closingLabel(fieldValue(o.fields, "closing_datetime"), o.deadline_at),
      finalLabel: labels.get(o.id) ?? null,
      riskBand: asBand(county?.band ?? null),
      riskScore: county?.score === null || county?.score === undefined ? null : Number(county.score),
    };
  });
}

export interface FieldLeadListItem {
  id: string;
  title: string;
  location: string | null;
  status: string;
  owner: string | null;
}

export async function listFieldLeads(): Promise<FieldLeadListItem[]> {
  const { data, error } = await getServiceClient()
    .from("opportunities")
    .select("id, title, location, status, owner")
    .eq("type", "field")
    .order("created_at", { ascending: false });
  if (error) fail("list field leads", error);
  return data;
}

export interface CountyRiskListItem {
  county: string;
  band: RiskBand;
  score: number | null;
  confidence: string;
  asOf: string;
}

export async function getLatestDecision(opportunityId: string): Promise<DecisionChoice | null> {
  const { data, error } = await getServiceClient()
    .from("decisions")
    .select("choice, created_at")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail("load decision", error);
  return asDecision(data[0]?.choice);
}

export async function saveTenderFigures(input: {
  tenderId: string;
  contractValueKes: number | null;
  deliveryCostKes: number | null;
}): Promise<void> {
  const companyId = await getDemoCompanyId();
  const { data, error } = await getServiceClient()
    .from("opportunities")
    .update({
      contract_value_kes: input.contractValueKes,
      delivery_cost_kes: input.deliveryCostKes,
    })
    .eq("id", input.tenderId)
    .eq("company_id", companyId)
    .select("id");
  if (error) fail("save tender figures", error);
  if (!data || data.length === 0) throw new Error("That tender was not found.");
}

export async function listCountyRisk(): Promise<CountyRiskListItem[]> {
  const { data, error } = await getServiceClient()
    .from("county_risk")
    .select("county, band, score, confidence, as_of")
    .order("county");
  if (error) fail("list county risk", error);
  return data.flatMap((row) => {
    const band = asBand(row.band);
    if (!band) return [];
    return [
      {
        county: row.county,
        band,
        score: row.score === null ? null : Number(row.score),
        confidence: row.confidence,
        asOf: row.as_of,
      },
    ];
  });
}

export interface AddendumTarget {
  id: string;
  title: string;
  reference: string | null;
}

/** Tenders with an uploaded main PDF: the only valid parents for an addendum. */
export async function listAddendumTargets(): Promise<AddendumTarget[]> {
  const { data, error } = await getServiceClient()
    .from("opportunities")
    .select("id, title, reference, sources!inner(id)")
    .eq("type", "procurement")
    .eq("sources.kind", "pdf")
    .eq("sources.role", "main")
    .order("created_at", { ascending: false });
  if (error) fail("list addendum targets", error);
  return data.map(({ id, title, reference }) => ({ id, title, reference }));
}

export interface PageInfo {
  source_id: string;
  page_no: number;
  is_scanned: boolean;
}

export interface CitedPage {
  source_id: string;
  page_no: number;
  text: string;
}

export interface TenderDetail {
  opportunity: Pick<
    Tables["opportunities"]["Row"],
    | "id"
    | "title"
    | "organization"
    | "reference"
    | "buyer_county"
    | "type"
    | "created_at"
    | "deadline_at"
    | "contract_value_kes"
    | "delivery_cost_kes"
  >;
  sources: SourceRecord[];
  runs: RunRecord[];
  fields: FieldRecord[];
  pages: PageInfo[];
  /** Full text of every page a field cites, for the evidence panel. */
  citedPages: CitedPage[];
  /** Short-lived signed URLs to open the original PDFs. */
  fileUrls: Record<string, string>;
}

export async function getTenderDetail(opportunityId: string): Promise<TenderDetail | null> {
  const db = getServiceClient();
  const { data: opportunity, error } = await db
    .from("opportunities")
    .select(
      "id, title, organization, reference, buyer_county, type, created_at, deadline_at, contract_value_kes, delivery_cost_kes",
    )
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) fail("load tender", error);
  if (!opportunity) return null;

  const figures = {
    contract_value_kes: asKes(opportunity.contract_value_kes),
    delivery_cost_kes: asKes(opportunity.delivery_cost_kes),
  };

  const { data: sources, error: sourcesError } = await db
    .from("sources")
    .select("id, created_at, kind, original_name, storage_path, sha256, role")
    .eq("opportunity_id", opportunityId)
    .order("created_at");
  if (sourcesError) fail("load sources", sourcesError);
  const sourceIds = sources.map((s) => s.id);

  const [runs, fields, pages] = await Promise.all([
    db
      .from("extraction_runs")
      .select("id, source_id, created_at, finished_at, error, model, provider, prompt_version, stats_json, status")
      .in("source_id", sourceIds)
      .order("created_at", { ascending: false }),
    db.from("fields").select("*").eq("opportunity_id", opportunityId).order("key").order("ordinal"),
    db.from("source_pages").select("source_id, page_no, is_scanned").in("source_id", sourceIds).order("page_no"),
  ]);
  if (runs.error) fail("load extraction runs", runs.error);
  if (fields.error) fail("load fields", fields.error);
  if (pages.error) fail("load pages", pages.error);

  const cited = new Map<string, { source_id: string; page_no: number }>();
  for (const f of fields.data) {
    if (f.source_id && f.page_no) cited.set(`${f.source_id}:${f.page_no}`, { source_id: f.source_id, page_no: f.page_no });
  }
  const citedPages = await loadPages([...cited.values()]);

  const fileUrls: Record<string, string> = {};
  await Promise.all(
    sources
      .filter((s) => s.storage_path)
      .map(async (s) => {
        const { data } = await db.storage.from(SOURCES_BUCKET).createSignedUrl(s.storage_path!, 60 * 60);
        if (data) fileUrls[s.id] = data.signedUrl;
      }),
  );

  return {
    opportunity: { ...opportunity, ...figures },
    sources: sources as SourceRecord[],
    runs: runs.data as RunRecord[],
    fields: fields.data as FieldRecord[],
    pages: pages.data,
    citedPages,
    fileUrls,
  };
}

/**
 * Pages whose text mentions bid security, so an in-document amount conflict can be
 * found without loading a 200-page tender. The scan itself is pure (document-conflicts.ts).
 */
export async function listSecurityPages(sourceIds: readonly string[]): Promise<CitedPage[]> {
  if (sourceIds.length === 0) return [];
  const { data, error } = await getServiceClient()
    .from("source_pages")
    .select("source_id, page_no, text")
    .in("source_id", [...sourceIds])
    .or("text.ilike.%tender security%,text.ilike.%bid security%,text.ilike.%bid bond%")
    .order("page_no");
  if (error) fail("load security pages", error);
  return data;
}

async function loadPages(refs: readonly { source_id: string; page_no: number }[]): Promise<CitedPage[]> {
  const bySource = Map.groupBy(refs, (r) => r.source_id);
  const results = await Promise.all(
    [...bySource].map(async ([sourceId, list]) => {
      const { data, error } = await getServiceClient()
        .from("source_pages")
        .select("source_id, page_no, text")
        .eq("source_id", sourceId)
        .in(
          "page_no",
          list.map((r) => r.page_no),
        );
      if (error) fail("load cited pages", error);
      return data;
    }),
  );
  return results.flat();
}

export async function getSourcePages(sourceId: string) {
  const { data, error } = await getServiceClient()
    .from("source_pages")
    .select("page_no, text, is_scanned")
    .eq("source_id", sourceId)
    .order("page_no");
  if (error) fail("load source pages", error);
  return data;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function findSourceBySha256(sha256: string) {
  const { data, error } = await getServiceClient()
    .from("sources")
    .select("id, opportunity_id, original_name, role")
    .eq("sha256", sha256)
    .limit(1)
    .maybeSingle();
  if (error) fail("check duplicate upload", error);
  return data;
}

export async function getOpportunityForAddendum(opportunityId: string) {
  const { data, error } = await getServiceClient()
    .from("opportunities")
    .select("id, sources!inner(id)")
    .eq("id", opportunityId)
    .eq("sources.role", "main")
    .eq("sources.kind", "pdf")
    .maybeSingle();
  if (error) fail("load tender for addendum", error);
  return data;
}

export interface NewPdfSource {
  role: SourceRole;
  /** Required for an addendum; a main document creates its own opportunity. */
  opportunityId: string | null;
  storagePath: string;
  originalName: string;
  sha256: string;
  pages: readonly { pageNo: number; text: string; needsOcr: boolean }[];
}

/**
 * Records an uploaded PDF: a new procurement opportunity (main document) or the existing one
 * (addendum), the immutable source and its page text. supabase-js has no transactions, so a
 * failure removes what this call created; nothing that existed before is touched.
 */
export async function createPdfSource(input: NewPdfSource): Promise<{ opportunityId: string; sourceId: string }> {
  const db = getServiceClient();
  let createdOpportunityId: string | null = null;
  let opportunityId = input.opportunityId;

  if (input.role === "main") {
    const companyId = await getDemoCompanyId();
    const { data, error } = await db
      .from("opportunities")
      .insert({
        company_id: companyId,
        type: "procurement",
        title: input.originalName.replace(/\.pdf$/i, ""),
        source_platform: "upload",
        status: "new",
      })
      .select("id")
      .single();
    if (error) fail("create tender", error);
    opportunityId = createdOpportunityId = data.id;
  }
  if (!opportunityId) throw new Error("an addendum needs the tender it belongs to");

  const { data: source, error: sourceError } = await db
    .from("sources")
    .insert({
      opportunity_id: opportunityId,
      kind: "pdf",
      role: input.role,
      storage_path: input.storagePath,
      original_name: input.originalName,
      sha256: input.sha256,
      raw_text: input.pages.map((p) => p.text).join("\n\f\n"),
    })
    .select("id")
    .single();
  if (sourceError) {
    if (createdOpportunityId) await db.from("opportunities").delete().eq("id", createdOpportunityId);
    fail("save source", sourceError);
  }

  for (let i = 0; i < input.pages.length; i += INSERT_CHUNK) {
    const { error } = await db.from("source_pages").insert(
      input.pages.slice(i, i + INSERT_CHUNK).map((p) => ({
        source_id: source.id,
        page_no: p.pageNo,
        text: p.text,
        is_scanned: p.needsOcr,
      })),
    );
    if (error) {
      await db.from("sources").delete().eq("id", source.id);
      if (createdOpportunityId) await db.from("opportunities").delete().eq("id", createdOpportunityId);
      fail("save page text", error);
    }
  }
  return { opportunityId, sourceId: source.id };
}

// ---------------------------------------------------------------------------
// Extraction runs
// ---------------------------------------------------------------------------

export async function listPdfSources(opportunityId: string) {
  const { data, error } = await getServiceClient()
    .from("sources")
    .select("id, original_name, role, extraction_runs(id, status, created_at)")
    .eq("opportunity_id", opportunityId)
    .eq("kind", "pdf")
    .order("created_at");
  if (error) fail("load sources", error);
  return data.map((s) => ({ ...s, role: s.role as SourceRole }));
}

export async function failStaleRuns(sourceId: string): Promise<void> {
  const { error } = await getServiceClient()
    .from("extraction_runs")
    .update({ status: "failed", error: "Timed out: the run did not finish.", finished_at: new Date().toISOString() })
    .eq("source_id", sourceId)
    .eq("status", "running")
    .lt("created_at", new Date(Date.now() - STALE_RUN_MS).toISOString());
  if (error) fail("expire stale runs", error);
}

/** Starts a run, or returns null if one is already running or has succeeded for this source. */
export async function startExtractionRun(input: {
  sourceId: string;
  provider: string;
  model: string;
  promptVersion: string;
}): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from("extraction_runs")
    .insert({
      source_id: input.sourceId,
      provider: input.provider,
      model: input.model,
      prompt_version: input.promptVersion,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return null;
  if (error) fail("start extraction run", error);
  return data.id;
}

export async function failExtractionRun(runId: string, message: string, stats: Record<string, GroupStats> = {}) {
  const { error } = await getServiceClient()
    .from("extraction_runs")
    .update({
      status: "failed",
      error: message.slice(0, 2000),
      finished_at: new Date().toISOString(),
      stats_json: { groups: stats } as unknown as Json,
    })
    .eq("id", runId);
  if (error) fail("record failed run", error);
}

/** Saves the verified fields of a run, then marks it succeeded. */
export async function completeExtractionRun(input: {
  runId: string;
  opportunityId: string;
  sourceId: string;
  fields: readonly ExtractedField[];
  stats: Record<string, GroupStats>;
}): Promise<void> {
  const db = getServiceClient();
  const rows = input.fields.map((f) => ({
    opportunity_id: input.opportunityId,
    source_id: input.sourceId,
    extraction_run_id: input.runId,
    key: f.key,
    ordinal: f.ordinal,
    value: f.value,
    page_no: f.pageNo,
    quote: f.quote,
    confidence: f.confidence,
    status: f.status,
    affects_key: f.affectsKey,
  }));
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await db.from("fields").insert(rows.slice(i, i + INSERT_CHUNK));
    if (error) fail("save fields", error);
  }
  const { error } = await db
    .from("extraction_runs")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      stats_json: { groups: input.stats, fields: rows.length } as unknown as Json,
    })
    .eq("id", input.runId);
  if (error) fail("finish extraction run", error);
}

/** Fills the opportunity's headline columns from main-document fields that have a value. */
export async function updateOpportunityHeadline(
  opportunityId: string,
  fields: readonly ExtractedField[],
): Promise<void> {
  const value = (key: string) => {
    const f = fields.find((x) => x.key === key && x.value !== null && x.status !== "needs_human");
    return f?.value ?? undefined;
  };
  // Undefined keys are dropped from the JSON body, so a missing value never blanks a column.
  const patch: Tables["opportunities"]["Update"] = {
    title: value("title"),
    organization: value("buyer"),
    reference: value("reference_number"),
    buyer_county: value("county"),
  };
  if (Object.values(patch).every((v) => v === undefined)) return;
  const { error } = await getServiceClient().from("opportunities").update(patch).eq("id", opportunityId);
  if (error) fail("update tender headline", error);
}
