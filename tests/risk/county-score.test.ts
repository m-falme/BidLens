import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  bandForScore,
  formatReportDate,
  scoreCounty,
  trendPart,
  type CountyScoreInput,
} from "@/lib/risk/county-score";
import { COB_2026_FILE, loadCob2026, toCountyScoreInput } from "@/supabase/seed/cob";
import { parseCsv } from "@/supabase/seed/csv";

const bills = loadCob2026(readFileSync(COB_2026_FILE, "utf8"));
const scores = new Map(bills.map((b) => [b.county, scoreCounty(toCountyScoreInput(b))]));
const score = (county: string) => {
  const s = scores.get(county);
  if (!s) throw new Error(`no county ${county}`);
  return s;
};

describe("scoreCounty: §5.3 expected values", () => {
  it("Nairobi is 76.5 Severe with HIGH confidence", () => {
    expect(score("Nairobi")).toMatchObject({
      score: 76.5,
      band: "severe",
      confidence: "high",
      partA: 36.5,
      partB: 30,
      partC: 10,
      reason: null,
    });
  });

  it("Mombasa is 64.3 High", () => {
    expect(score("Mombasa")).toMatchObject({ score: 64.3, band: "high", confidence: "high" });
  });

  it("Makueni is 2.6 Low with MEDIUM confidence because CoB flags its data", () => {
    expect(score("Makueni")).toMatchObject({
      score: 2.6,
      band: "low",
      confidence: "medium",
      reason: "CoB flags inconsistent data (asterisk)",
    });
  });

  it("Nandi (not reported) has no score, not 0", () => {
    expect(score("Nandi")).toMatchObject({
      score: null,
      band: "unknown",
      confidence: "unknown",
      partA: null,
      reason: "no trade-payables data reported to CoB for 30 Jun 2026",
    });
  });
});

describe("scoreCounty: cross-check against data/county_payment_risk_scores_demo.csv", () => {
  const demo = parseCsv(readFileSync("data/county_payment_risk_scores_demo.csv", "utf8"));
  const num = (v: string) => (v === "" ? null : Number(v));

  it("covers the same 47 counties", () => {
    expect(new Set(demo.map((d) => d.county))).toEqual(new Set(scores.keys()));
    expect(scores.size).toBe(47);
  });

  it("matches every band, confidence and reason exactly (demo writes UNKNOWN confidence as NONE)", () => {
    for (const d of demo) {
      const s = score(d.county);
      expect({ county: d.county, band: s.band, confidence: s.confidence, reason: s.reason ?? "" }).toEqual({
        county: d.county,
        band: d.band.toLowerCase(),
        confidence: d.confidence === "NONE" ? "unknown" : d.confidence.toLowerCase(),
        reason: d.reason,
      });
    }
  });

  it("matches every score and part within 0.1; the differences are rounding, listed here", () => {
    const differing: string[] = [];
    for (const d of demo) {
      const s = score(d.county);
      const pairs: [number | null, number | null][] = [
        [s.score, num(d.score)],
        [s.partA, num(d.A_ageing)],
        [s.partB, num(d.B_size)],
        [s.partC, num(d.C_trend)],
      ];
      for (const [ours, theirs] of pairs) {
        expect(ours === null).toBe(theirs === null);
        if (ours !== null && theirs !== null) expect(Math.abs(ours - theirs)).toBeLessThanOrEqual(0.1 + 1e-9);
      }
      if (s.score !== num(d.score)) differing.push(d.county);
    }
    // The demo CSV rounds each part (Python round-half-even on binary floats) and sums the
    // rounded parts; we round the exact sum once. Migori also has payables_to_budget_pct 8.82
    // in the CoB CSV while its own total / budget is 8.60%. No band changes.
    expect(differing).toEqual([
      "Bomet", "Bungoma", "Elgeyo-Marakwet", "Isiolo", "Kirinyaga", "Kisumu", "Kwale",
      "Machakos", "Migori", "Murang'a", "Nyamira", "Samburu", "Taita-Taveta", "Wajir",
    ]);
  });
});

describe("county score rules", () => {
  const clean: CountyScoreInput = {
    county: "Test",
    reportDate: "2026-06-30",
    dataQuality: "ok",
    dataNotes: null,
    pendingTotalKesM: 100,
    budgetKesM: 1000,
    pctOver2y: 20,
    ageUnder1yKesM: 50,
    ageingTotalKesM: 100,
    trendPct: 0,
  };

  it("caps the size part at 30", () => {
    expect(scoreCounty({ ...clean, pendingTotalKesM: 5000 }).partB).toBe(30);
  });

  it("scores trend 0 / 10 / 20 with ±10% inclusive boundaries", () => {
    expect([-10.01, -10, -9.99, 0, 9.99, 10, 150].map(trendPart)).toEqual([0, 0, 10, 10, 10, 20, 20]);
  });

  it("bands at 25 / 50 / 75", () => {
    expect([0, 24.9, 25, 49.9, 50, 74.9, 75, 100].map(bandForScore)).toEqual([
      "low", "low", "moderate", "moderate", "high", "high", "severe", "severe",
    ]);
  });

  it("lowers confidence when no bills under 1 year are reported", () => {
    expect(scoreCounty({ ...clean, ageUnder1yKesM: 0 })).toMatchObject({
      confidence: "medium",
      reason: "zero bills under 1 year reported: ageing may be incomplete",
    });
  });

  it("returns unknown, not a score, when the trend can't be computed", () => {
    expect(scoreCounty({ ...clean, trendPct: null })).toMatchObject({ score: null, band: "unknown" });
  });

  it("formats report dates without depending on locale", () => {
    expect(formatReportDate("2026-06-30")).toBe("30 Jun 2026");
  });
});
