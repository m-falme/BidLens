import { roundTo } from "./round";

/**
 * County payment-risk score, ARCHITECTURE §5.3. 0–100, higher = riskier.
 * It describes the county's stock of unpaid bills at a CoB snapshot date. It is not a
 * prediction of when this supplier will be paid.
 */

export const RISK_BANDS = ["low", "moderate", "high", "severe", "unknown"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

export const RISK_CONFIDENCES = ["high", "medium", "unknown"] as const;
export type RiskConfidence = (typeof RISK_CONFIDENCES)[number];

export const COB_DATA_QUALITIES = ["ok", "flagged", "not_disclosed"] as const;
export type CobDataQuality = (typeof COB_DATA_QUALITIES)[number];

export interface CountyScoreInput {
  county: string;
  /** ISO date of the CoB snapshot, e.g. "2026-06-30". */
  reportDate: string;
  dataQuality: CobDataQuality;
  /** CoB caveats for this county (asterisks, subtotal mismatches), verbatim. */
  dataNotes: string | null;
  pendingTotalKesM: number | null;
  budgetKesM: number | null;
  /** Share of executive pending bills older than 2 years, 0–100. */
  pctOver2y: number | null;
  ageUnder1yKesM: number | null;
  ageingTotalKesM: number | null;
  /** Year-on-year change in pending bills, %. */
  trendPct: number | null;
}

export interface CountyScore {
  county: string;
  asOf: string;
  /** null when there is not enough data: show "no score", never 0. */
  score: number | null;
  band: RiskBand;
  confidence: RiskConfidence;
  partA: number | null;
  partB: number | null;
  partC: number | null;
  /** Why confidence is below HIGH, or why there is no score. null when the data is clean. */
  reason: string | null;
}

export const AGEING_WEIGHT = 0.5;
export const SIZE_WEIGHT = 0.75;
export const SIZE_CAP = 30;
export const TREND_THRESHOLD_PCT = 10;

/** A. Ageing (≤50): 0.5 × % of bills older than 2 years. */
export function ageingPart(pctOver2y: number): number {
  return AGEING_WEIGHT * pctOver2y;
}

/** B. Size (≤30): min(30, 0.75 × pending bills as % of budget). */
export function sizePart(pendingTotalKesM: number, budgetKesM: number): number {
  return Math.min(SIZE_CAP, SIZE_WEIGHT * ((pendingTotalKesM / budgetKesM) * 100));
}

/** C. Trend (≤20): 0 if pending bills fell ≥10% YoY, 20 if they rose ≥10%, else 10. */
export function trendPart(trendPct: number): 0 | 10 | 20 {
  if (trendPct <= -TREND_THRESHOLD_PCT) return 0;
  if (trendPct >= TREND_THRESHOLD_PCT) return 20;
  return 10;
}

/** Bands on the score as displayed (1 dp): <25 Low · 25–49 Moderate · 50–74 High · ≥75 Severe. */
export function bandForScore(score: number): Exclude<RiskBand, "unknown"> {
  if (score >= 75) return "severe";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06-30" → "30 Jun 2026", independent of the runtime locale. */
export function formatReportDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function scoreCounty(input: CountyScoreInput): CountyScore {
  const base = { county: input.county, asOf: input.reportDate };
  const { pctOver2y, pendingTotalKesM, budgetKesM, trendPct } = input;

  if (
    input.dataQuality === "not_disclosed" ||
    pctOver2y === null ||
    pendingTotalKesM === null ||
    budgetKesM === null ||
    budgetKesM <= 0 ||
    trendPct === null
  ) {
    const reason =
      input.dataQuality === "not_disclosed" || pendingTotalKesM === null
        ? `no trade-payables data reported to CoB for ${formatReportDate(input.reportDate)}`
        : trendPct === null
          ? "no prior-year figure to compute the trend"
          : "incomplete CoB data for this county";
    return {
      ...base,
      score: null,
      band: "unknown",
      confidence: "unknown",
      partA: null,
      partB: null,
      partC: null,
      reason,
    };
  }

  const a = ageingPart(pctOver2y);
  const b = sizePart(pendingTotalKesM, budgetKesM);
  const c = trendPart(trendPct);
  const score = roundTo(a + b + c, 1);

  const caveats: string[] = [];
  const notes = input.dataNotes?.trim();
  if (notes) caveats.push(notes);
  else if (input.dataQuality === "flagged") caveats.push("CoB flags inconsistent data");
  if (input.ageUnder1yKesM === 0 && (input.ageingTotalKesM ?? 0) > 0) {
    caveats.push("zero bills under 1 year reported: ageing may be incomplete");
  }
  return {
    ...base,
    score,
    band: bandForScore(score),
    confidence: caveats.length > 0 ? "medium" : "high",
    partA: roundTo(a, 1),
    partB: roundTo(b, 1),
    partC: c,
    reason: caveats.length > 0 ? caveats.join("; ") : null,
  };
}
