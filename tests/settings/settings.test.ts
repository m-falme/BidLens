import { describe, expect, it } from "vitest";

import type { OverviewTender } from "@/lib/overview/build";
import { delayTable, FINANCING_RATE, profitResult } from "@/lib/recommendation/profit";
import { settingsAlerts } from "@/lib/settings/alerts";
import { stageReviewsMissing } from "@/lib/settings/gates";
import { DEFAULT_SETTINGS, parseSettings, ratePercentText } from "@/lib/settings/schema";

const VALID = {
  financingRatePercent: 16,
  requireStageReviews: false,
  autoStartAnalysis: true,
  alertClosing: true,
  alertClosingDays: 7,
  alertDocuments: true,
  alertDocumentsDays: 30,
};

describe("settings parsing", () => {
  it("defaults match today's behaviour: 16% rate, no extra gate, analysis starts on its own", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      financingRate: FINANCING_RATE,
      requireStageReviews: false,
      autoStartAnalysis: true,
    });
    expect(parseSettings(VALID)).toEqual({ ok: true, value: DEFAULT_SETTINGS });
  });

  it("turns a percentage into a fraction and back", () => {
    const parsed = parseSettings({ ...VALID, financingRatePercent: 14.5 });
    expect(parsed.ok && parsed.value.financingRate).toBe(0.145);
    expect(ratePercentText(0.145)).toBe("14.5");
    expect(ratePercentText(0.16)).toBe("16");
  });

  it("rejects values the app cannot use, with a plain message", () => {
    expect(parseSettings({ ...VALID, financingRatePercent: 120 })).toEqual({
      ok: false,
      error: "The loan rate must be between 0 and 100.",
    });
    expect(parseSettings({ ...VALID, financingRatePercent: Number.NaN }).ok).toBe(false);
    expect(parseSettings({ ...VALID, alertClosingDays: 0 })).toEqual({ ok: false, error: "Closing alert: enter 1 to 60 days." });
    expect(parseSettings({ ...VALID, alertDocumentsDays: 1.5 }).ok).toBe(false);
    expect(parseSettings(null).ok).toBe(false);
  });
});

describe("loan rate from settings", () => {
  const figures = { contractValueKes: 8_000_000, deliveryCostKes: 6_800_000, band: "high" as const };

  it("changes the delay table but leaves the default untouched", () => {
    const base = delayTable(figures);
    expect(base).toEqual(delayTable({ ...figures, rate: FINANCING_RATE }));
    const dearer = delayTable({ ...figures, rate: 0.3 });
    expect(dearer?.[2].financingKes).toBeGreaterThan(base?.[2].financingKes ?? 0);
    expect(dearer?.[2].profitKes).toBeLessThan(base?.[2].profitKes ?? 0);
    expect(profitResult({ ...figures, rate: 0.3 })?.rate).toBe(0.3);
    expect(profitResult(figures)?.rate).toBe(FINANCING_RATE);
  });
});

describe("review gate", () => {
  it("lists the stages still without a review", () => {
    expect(stageReviewsMissing([])).toEqual(["can_bid", "can_comply", "should_bid"]);
    expect(stageReviewsMissing(["can_bid", "should_bid"])).toEqual(["can_comply"]);
    expect(stageReviewsMissing(["can_bid", "can_comply", "should_bid"])).toEqual([]);
  });
});

describe("alerts", () => {
  const AS_OF = new Date("2026-11-20T09:00:00+03:00");
  const TODAY = "2026-11-20";

  function tender(id: string, deadlineAt: string | null, overrides: Partial<OverviewTender> = {}): OverviewTender {
    return {
      id,
      title: `TENDER ${id}`,
      buyer: null,
      reference: null,
      closing: null,
      deadlineAt,
      needsHuman: 0,
      missingMandatory: 0,
      addendumConflicts: 0,
      finalLabel: null,
      reviewedStages: [],
      ...overrides,
    };
  }

  const settings = { alertClosing: true, alertClosingDays: 7, alertDocuments: true, alertDocumentsDays: 30 };

  it("flags tenders closing inside the window, soonest first, and skips closed or declined ones", () => {
    const alerts = settingsAlerts({
      tenders: [
        tender("late", "2026-11-26T11:00:00+03:00"),
        tender("soon", "2026-11-21T11:00:00+03:00"),
        tender("far", "2026-12-30T11:00:00+03:00"),
        tender("closed", "2026-11-10T11:00:00+03:00"),
        tender("declined", "2026-11-22T11:00:00+03:00", { finalLabel: "consider_declining" }),
      ],
      documents: [],
      settings,
      asOf: AS_OF,
      today: TODAY,
    });
    expect(alerts.map((alert) => alert.title)).toEqual(["Closes in 1 day", "Closes in 6 days"]);
    expect(alerts[0].href).toBe("/tenders/soon");
  });

  it("flags documents that expire inside the window, not expired, not 'does not expire', not missing", () => {
    const alerts = settingsAlerts({
      tenders: [],
      documents: [
        { holding: "have", expiresOn: "2026-12-05", neverExpires: false },
        { holding: "have", expiresOn: "2026-11-01", neverExpires: false },
        { holding: "have", expiresOn: "2027-06-01", neverExpires: false },
        { holding: "have", expiresOn: null, neverExpires: true },
        { holding: "dont_have", expiresOn: "2026-12-01", neverExpires: false },
      ],
      settings,
      asOf: AS_OF,
      today: TODAY,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ title: "Company documents expire soon", detail: "1 document expires within 30 days" });
  });

  it("shows nothing when the switches are off", () => {
    expect(
      settingsAlerts({
        tenders: [tender("soon", "2026-11-21T11:00:00+03:00")],
        documents: [{ holding: "have", expiresOn: "2026-11-25", neverExpires: false }],
        settings: { ...settings, alertClosing: false, alertDocuments: false },
        asOf: AS_OF,
        today: TODAY,
      }),
    ).toEqual([]);
  });
});
