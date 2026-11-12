import { z } from "zod";

import type { CountyScoreInput } from "@/lib/risk/county-score";

import { parseCsv } from "./csv";
import { seedId } from "./ids";
import type { CountyPendingBillsRow } from "./rows";

/** Controller of Budget reports page; the CSVs cite table numbers in the `source` column. */
export const COB_SOURCE_URL = "https://cob.go.ke/reports/";
/** Date the CoB reports were retrieved. The figures themselves are as at each row's report_date. */
export const COB_RETRIEVED_AT = "2026-11-11";

export const COB_2026_FILE = "data/county_pending_bills_cob_47_jun2026.csv";
export const COB_2025_FILE = "data/county_pending_bills_cob_47_jun2025.csv";

const num = z.string().transform((value, ctx) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: "custom", message: `not a number: "${value}"` });
    return z.NEVER;
  }
  return parsed;
});
const text = z.string().transform((value) => (value.trim() === "" ? null : value.trim()));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const cob2026Schema = z.object({
  county: z.string().min(1),
  report_date: isoDate,
  source: z.string().min(1),
  trade_payables_total_kes_m: num,
  fy2025_26_budget_kes_m: num,
  exec_age_under1y_kes_m: num,
  exec_age_1_2y_kes_m: num,
  exec_age_2_3y_kes_m: num,
  exec_age_over3y_kes_m: num,
  exec_ageing_total_kes_m: num,
  pct_over_3y: num,
  pct_over_2y: num,
  data_status: z.enum(["OK", "FLAGGED", "NOT_DISCLOSED"]),
  data_notes: text,
  change_vs_jun2025_pct: num,
});

const cob2025Schema = z.object({
  county: z.string().min(1),
  report_date: isoDate,
  source_primary: z.string().min(1),
  pending_total_kes_m: num,
  fy2024_25_approved_budget_kes_m: num,
  age_under1y_kes_m: num,
  age_1_2y_kes_m: num,
  age_2_3y_kes_m: num,
  age_over3y_kes_m: num,
  ageing_total_kes_m: num,
  pct_over_3y: num,
  pct_over_2y: num,
  // MISSING = total reported but no ageing breakdown (Kakamega, Narok).
  ageing_data_quality: z.enum(["OK", "FLAG", "MISSING"]),
  data_quality_note: text,
});

function parseRows<T extends z.ZodType>(schema: T, csvText: string, file: string): z.infer<T>[] {
  return parseCsv(csvText).map((record, index) => {
    const result = schema.safeParse(record);
    if (!result.success) {
      throw new Error(`${file} row ${index + 2}: ${z.prettifyError(result.error)}`);
    }
    return result.data;
  });
}

function assert47Counties(rows: readonly CountyPendingBillsRow[], file: string): void {
  const counties = new Set(rows.map((r) => r.county));
  if (rows.length !== 47 || counties.size !== 47) {
    throw new Error(`${file}: expected 47 distinct counties, got ${rows.length} rows / ${counties.size} counties`);
  }
}

/** 30 Jun 2026 snapshot (CoB BIRR FY2025/26). Drives the current county_risk scores. */
export function loadCob2026(csvText: string): CountyPendingBillsRow[] {
  const rows = parseRows(cob2026Schema, csvText, COB_2026_FILE).map((r): CountyPendingBillsRow => {
    const notDisclosed = r.data_status === "NOT_DISCLOSED";
    return {
      id: seedId("county_pending_bills", r.county, r.report_date),
      county: r.county,
      report_date: r.report_date,
      // The CSV carries 0.0 for a county that did not report; store "unknown", not zero.
      pending_total_kes_m: notDisclosed ? null : r.trade_payables_total_kes_m,
      budget_kes_m: r.fy2025_26_budget_kes_m,
      age_under_1y_kes_m: r.exec_age_under1y_kes_m,
      age_1_2y_kes_m: r.exec_age_1_2y_kes_m,
      age_2_3y_kes_m: r.exec_age_2_3y_kes_m,
      age_over_3y_kes_m: r.exec_age_over3y_kes_m,
      ageing_total_kes_m: r.exec_ageing_total_kes_m,
      pct_over_2y: r.pct_over_2y,
      pct_over_3y: r.pct_over_3y,
      trend_pct: r.change_vs_jun2025_pct,
      data_quality: notDisclosed ? "not_disclosed" : r.data_status === "FLAGGED" ? "flagged" : "ok",
      data_notes: r.data_notes,
      source: r.source,
      source_url: COB_SOURCE_URL,
      retrieved_at: COB_RETRIEVED_AT,
    };
  });
  assert47Counties(rows, COB_2026_FILE);
  return rows;
}

/** 30 Jun 2025 snapshot (CoB BIRR FY2024/25). History only; no trend (no 2024 figure). */
export function loadCob2025(csvText: string): CountyPendingBillsRow[] {
  const rows = parseRows(cob2025Schema, csvText, COB_2025_FILE).map(
    (r): CountyPendingBillsRow => ({
      id: seedId("county_pending_bills", r.county, r.report_date),
      county: r.county,
      report_date: r.report_date,
      pending_total_kes_m: r.pending_total_kes_m,
      budget_kes_m: r.fy2024_25_approved_budget_kes_m,
      age_under_1y_kes_m: r.age_under1y_kes_m,
      age_1_2y_kes_m: r.age_1_2y_kes_m,
      age_2_3y_kes_m: r.age_2_3y_kes_m,
      age_over_3y_kes_m: r.age_over3y_kes_m,
      ageing_total_kes_m: r.ageing_total_kes_m,
      pct_over_2y: r.pct_over_2y,
      pct_over_3y: r.pct_over_3y,
      trend_pct: null,
      data_quality: r.ageing_data_quality === "OK" ? "ok" : "flagged",
      data_notes: r.data_quality_note,
      source: r.source_primary,
      source_url: COB_SOURCE_URL,
      retrieved_at: COB_RETRIEVED_AT,
    }),
  );
  assert47Counties(rows, COB_2025_FILE);
  return rows;
}

export function toCountyScoreInput(row: CountyPendingBillsRow): CountyScoreInput {
  return {
    county: row.county,
    reportDate: row.report_date,
    dataQuality: row.data_quality,
    dataNotes: row.data_notes,
    pendingTotalKesM: row.pending_total_kes_m,
    budgetKesM: row.budget_kes_m,
    pctOver2y: row.pct_over_2y,
    ageUnder1yKesM: row.age_under_1y_kes_m,
    ageingTotalKesM: row.ageing_total_kes_m,
    trendPct: row.trend_pct,
  };
}
