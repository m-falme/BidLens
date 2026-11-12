import { readFile } from "node:fs/promises";
import path from "node:path";

import { scoreCounty } from "@/lib/risk/county-score";
import { statusFromQuoteCheck } from "@/lib/verify/quote-check";

import { COB_2025_FILE, COB_2026_FILE, loadCob2025, loadCob2026, toCountyScoreInput } from "./cob";
import { seedId, sha256Hex } from "./ids";
import type {
  CapabilityRow,
  CompanyRow,
  CountyRiskRow,
  FieldRow,
  OpportunityRow,
  SeedStep,
  SourcePageRow,
  SourceRow,
} from "./rows";
import {
  eatTimestamp,
  isoDateOrNull,
  mapLeadStatus,
  readZanariWorkbook,
  ZANARI_WORKBOOK_FILE,
  type WorkbookRow,
} from "./workbook";
import { COMPANY_PAPERS } from "@/lib/company/papers";

import { ZANARI_PROFILE_FILE, zanariCapabilities, zanariCompany } from "./zanari-profile";

const WORKBOOK_PATH = path.join("data", "zanari", ZANARI_WORKBOOK_FILE);

interface LeadRecords {
  opportunity: OpportunityRow;
  source: SourceRow;
  page: SourcePageRow;
  fields: FieldRow[];
}

/** One workbook row becomes one source with a single page, so every field cites (source, page 1, quote). */
function leadRecords<K extends string>(
  row: WorkbookRow<K>,
  opportunity: OpportunityRow,
  workbookSha256: string,
  confidence: number,
): LeadRecords {
  const pageText = [
    `Sheet: ${row.sheet}, row ${row.rowNumber}`,
    ...row.cells.map((c) => `${c.header}: ${c.value ?? ""}`),
  ].join("\n");
  const sourceId = seedId("source", opportunity.id);

  return {
    opportunity,
    source: {
      id: sourceId,
      opportunity_id: opportunity.id,
      kind: "form",
      storage_path: null,
      original_name: ZANARI_WORKBOOK_FILE,
      sha256: workbookSha256,
      raw_text: pageText,
    },
    page: { id: seedId("source_page", sourceId, "1"), source_id: sourceId, page_no: 1, text: pageText, is_scanned: false },
    fields: row.cells.map(
      (cell): FieldRow => ({
        id: seedId("field", opportunity.id, cell.key),
        opportunity_id: opportunity.id,
        key: cell.key,
        value: cell.value,
        source_id: sourceId,
        page_no: 1,
        quote: cell.value,
        confidence,
        status: cell.value === null ? "blank_in_source" : statusFromQuoteCheck(cell.value, pageText),
      }),
    ),
  };
}

/** The workbook's per-lead "AI Confidence" when present and valid; 1 for values copied verbatim by code. */
function rowConfidence(raw: string | null): number {
  const parsed = raw === null ? Number.NaN : Number(raw);
  return parsed >= 0 && parsed <= 1 ? parsed : 1;
}

export interface SeedPlan {
  steps: SeedStep[];
  countyRisk: CountyRiskRow[];
}

/** Reads data/ under `rootDir` and returns every row to write, in foreign-key order. No I/O beyond reading files. */
export async function buildSeedPlan(rootDir: string): Promise<SeedPlan> {
  const [workbookFile, cob2026Text, cob2025Text] = await Promise.all([
    readFile(path.join(rootDir, WORKBOOK_PATH)),
    readFile(path.join(rootDir, COB_2026_FILE), "utf8"),
    readFile(path.join(rootDir, COB_2025_FILE), "utf8"),
  ]);
  const workbook = await readZanariWorkbook(workbookFile);
  const workbookSha256 = sha256Hex(workbookFile);

  const company: CompanyRow = {
    id: seedId("company", zanariCompany.name),
    name: zanariCompany.name,
    profile_json: zanariCompany.profile,
  };

  const profileCapabilities = zanariCapabilities.map(
    (c): CapabilityRow => ({
      id: seedId("capability", company.id, c.kind, c.name),
      company_id: company.id,
      kind: c.kind,
      name: c.name,
      detail: c.detail,
      evidence_ref: `${ZANARI_PROFILE_FILE} p.${c.page}`,
      verified: true,
      holding: null,
      expires_on: null,
      self_declared: false,
      original_holding: null,
    }),
  );

  // Insert-only: a person can change Have / Don't have / Expired, and a re-seed must not put it back.
  const documentCapabilities = COMPANY_PAPERS.map(
    (paper): CapabilityRow => ({
      id: seedId("capability", company.id, paper.kind, paper.name),
      company_id: company.id,
      kind: paper.kind,
      name: paper.name,
      detail: paper.selfDeclared
        ? "The team marked this Have. The file has not been checked."
        : "Marked Don't have. The company profile does not include it.",
      evidence_ref: paper.selfDeclared ? "Company documents checklist, self-declared" : "Company documents checklist",
      verified: false,
      holding: paper.seedHolding,
      expires_on: null,
      self_declared: paper.selfDeclared,
      original_holding: null,
    }),
  );

  const fieldLeads = workbook.fieldLeads.map((row) => {
    const organization = row.get("organization");
    if (!organization) throw new Error(`${row.sheet} row ${row.rowNumber}: Organization is required`);
    return leadRecords(
      row,
      {
        id: seedId("opportunity", "field", organization),
        company_id: company.id,
        type: "field",
        title: organization,
        organization,
        location: row.get("location"),
        sector: row.get("industry"),
        reference: null,
        deadline_at: null,
        submission_method: null,
        source_platform: row.get("lead_source"),
        source_url: null,
        retrieved_at: null,
        status: mapLeadStatus(row.get("lead_status")),
        owner: row.get("owner"),
        next_action: row.get("next_action"),
        follow_up_on: isoDateOrNull(row.get("follow_up_date")),
        readiness_pct: null,
        buyer_county: null,
      },
      workbookSha256,
      rowConfidence(row.get("ai_confidence")),
    );
  });

  const procurementLeads = workbook.procurementLeads.map((row) => {
    const reference = row.get("reference");
    const title = row.get("title");
    if (!reference || !title) throw new Error(`${row.sheet} row ${row.rowNumber}: reference and title are required`);
    return leadRecords(
      row,
      {
        id: seedId("opportunity", "procurement", reference),
        company_id: company.id,
        type: "procurement",
        title,
        organization: row.get("procuring_entity"),
        location: row.get("location"),
        sector: row.get("sector"),
        reference,
        deadline_at: eatTimestamp(row.get("submission_deadline")),
        submission_method: row.get("submission_method"),
        source_platform: row.get("source_platform"),
        source_url: row.get("source_url"),
        retrieved_at: null,
        status: mapLeadStatus(row.get("lead_status")),
        owner: row.get("owner"),
        next_action: row.get("next_action"),
        follow_up_on: null,
        readiness_pct: null,
        buyer_county: null,
      },
      workbookSha256,
      1,
    );
  });

  const leads = [...fieldLeads, ...procurementLeads];

  const bills2026 = loadCob2026(cob2026Text);
  const bills2025 = loadCob2025(cob2025Text);
  const countyRisk = bills2026.map((bill): CountyRiskRow => {
    const s = scoreCounty(toCountyScoreInput(bill));
    return {
      id: seedId("county_risk", s.county, s.asOf),
      county: s.county,
      pending_bills_id: bill.id,
      score: s.score,
      band: s.band,
      confidence: s.confidence,
      part_a: s.partA,
      part_b: s.partB,
      part_c: s.partC,
      reason: s.reason,
      as_of: s.asOf,
    };
  });

  return {
    countyRisk,
    steps: [
      { table: "companies", mode: "refresh", rows: [company] },
      { table: "capabilities", mode: "refresh", rows: profileCapabilities },
      { table: "capabilities", mode: "insert_only", rows: documentCapabilities },
      { table: "opportunities", mode: "insert_only", rows: leads.map((l) => l.opportunity) },
      { table: "sources", mode: "insert_only", rows: leads.map((l) => l.source) },
      { table: "source_pages", mode: "insert_only", rows: leads.map((l) => l.page) },
      { table: "fields", mode: "insert_only", rows: leads.flatMap((l) => l.fields) },
      { table: "county_pending_bills", mode: "refresh", rows: [...bills2025, ...bills2026] },
      { table: "county_risk", mode: "refresh", rows: countyRisk },
    ],
  };
}
