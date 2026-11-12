import { readSheet } from "read-excel-file/node";

import type { OpportunityStatus } from "./rows";

export const ZANARI_WORKBOOK_FILE = "zanari_sample_data.xlsx";

/** Workbook header → field key. Order and spelling must match the sheet exactly. */
export const FIELD_LEAD_COLUMNS = [
  ["Lead Category", "lead_category"],
  ["Location", "location"],
  ["Date Captured", "date_captured"],
  ["Organization", "organization"],
  ["Industry", "industry"],
  ["Phone", "phone"],
  ["Email", "email"],
  ["Lead Status", "lead_status"],
  ["Initial Notes / Need", "initial_notes"],
  ["Next Action", "next_action"],
  ["Stage", "stage"],
  ["Lead Source", "lead_source"],
  ["Source Evidence / Reference", "source_evidence"],
  ["Assigned Owner", "owner"],
  ["Follow-up Date", "follow_up_date"],
  ["Decision Maker / Role", "decision_maker"],
  ["AI Confidence", "ai_confidence"],
  ["Human Verified", "human_verified"],
  ["Additional Questions", "additional_questions"],
] as const;

export const PROCUREMENT_LEAD_COLUMNS = [
  ["Lead Category", "lead_category"],
  ["Location", "location"],
  ["Date Captured", "date_captured"],
  ["Procuring Entity", "procuring_entity"],
  ["Sector", "sector"],
  ["Tender / Notice Reference", "reference"],
  ["Opportunity Title", "title"],
  ["Publication Date", "publication_date"],
  ["Submission Deadline", "submission_deadline"],
  ["Submission Method", "submission_method"],
  ["Source Platform", "source_platform"],
  ["Source URL (placeholder)", "source_url"],
  ["Lead Status", "lead_status"],
  ["Key Requirements Extracted", "key_requirements"],
  ["Eligibility Checks", "eligibility_checks"],
  ["Zanari Fit (initial)", "zanari_fit"],
  ["Bid / No-bid Flag", "bid_flag"],
  ["Next Action", "next_action"],
  ["Owner", "owner"],
  ["Human Verified", "human_verified"],
  ["Source Evidence / Notes", "source_notes"],
] as const;

type Columns = readonly (readonly [header: string, key: string])[];
export type FieldLeadKey = (typeof FIELD_LEAD_COLUMNS)[number][1];
export type ProcurementLeadKey = (typeof PROCUREMENT_LEAD_COLUMNS)[number][1];

export interface WorkbookRow<K extends string> {
  sheet: string;
  /** 1-based spreadsheet row number (header is row 1). */
  rowNumber: number;
  /** In sheet column order. */
  cells: { header: string; key: K; value: string | null }[];
  get(key: K): string | null;
}

export interface ZanariWorkbook {
  fieldLeads: WorkbookRow<FieldLeadKey>[];
  procurementLeads: WorkbookRow<ProcurementLeadKey>[];
}

function cellToText(cell: unknown): string | null {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  const text = String(cell).trim();
  return text === "" ? null : text;
}

async function readRows<K extends string>(
  file: Buffer,
  sheet: string,
  columns: Columns,
  expectedRows: number,
): Promise<WorkbookRow<K>[]> {
  const data = await readSheet(file, sheet);
  const [header, ...body] = data;
  const actual = (header ?? []).map(cellToText);
  const expected = columns.map(([h]) => h);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${ZANARI_WORKBOOK_FILE} sheet "${sheet}": header changed.\n  expected ${expected.join(" | ")}\n  actual   ${actual.join(" | ")}`);
  }
  const rows = body
    .map((cells, index) => ({ cells, rowNumber: index + 2 }))
    .filter(({ cells }) => cells.some((c) => cellToText(c) !== null))
    .map(({ cells, rowNumber }): WorkbookRow<K> => {
      const mapped = columns.map(([h, key], col) => ({ header: h, key: key as K, value: cellToText(cells[col]) }));
      return {
        sheet,
        rowNumber,
        cells: mapped,
        get: (key) => mapped.find((c) => c.key === key)?.value ?? null,
      };
    });
  if (rows.length !== expectedRows) {
    throw new Error(`${ZANARI_WORKBOOK_FILE} sheet "${sheet}": expected ${expectedRows} rows, found ${rows.length}`);
  }
  return rows;
}

export async function readZanariWorkbook(file: Buffer): Promise<ZanariWorkbook> {
  return {
    fieldLeads: await readRows<FieldLeadKey>(file, "Form1_Field_Leads", FIELD_LEAD_COLUMNS, 10),
    procurementLeads: await readRows<ProcurementLeadKey>(file, "Procurement_Leads", PROCUREMENT_LEAD_COLUMNS, 5),
  };
}

/**
 * Workbook "Lead Status" → Zanari glossary status. Two workbook values are not glossary
 * terms and are mapped to the closest one; the verbatim value is kept as the `lead_status`
 * field so nothing is lost.
 */
const LEAD_STATUS_MAP: Record<string, OpportunityStatus> = {
  New: "new",
  "New - verify notice": "new",
  "Verification required": "verification_required",
  Potential: "potential",
  Positive: "positive",
  "Discovery scheduled": "discovery_scheduled",
  Qualified: "qualified",
  Proposal: "proposal",
  "Awaiting response": "awaiting_response",
  "On hold": "on_hold",
  "Not qualified": "not_qualified",
  Won: "won",
  Lost: "lost",
  // Demo done, plant manager still checking data export: need/authority unconfirmed.
  "No decision yet": "potential",
};

export function mapLeadStatus(raw: string | null): OpportunityStatus {
  if (raw === null) return "new";
  const status = LEAD_STATUS_MAP[raw];
  if (!status) throw new Error(`Unknown workbook lead status "${raw}": add it to LEAD_STATUS_MAP`);
  return status;
}

/** "2026-11-28 10:00" (local Kenyan time in the workbook) → ISO timestamp in EAT. */
export function eatTimestamp(raw: string | null): string | null {
  if (raw === null) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(raw);
  if (!match) throw new Error(`Unrecognised deadline "${raw}": expected YYYY-MM-DD HH:MM`);
  return `${match[1]}T${match[2]}:00+03:00`;
}

export function isoDateOrNull(raw: string | null): string | null {
  if (raw === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`Unrecognised date "${raw}": expected YYYY-MM-DD`);
  return raw;
}
