import { z } from "zod";

import { FINANCING_RATE } from "@/lib/recommendation/profit";

/** The Settings page. Each value here changes behaviour somewhere in the app; nothing is decorative. */
export interface WorkspaceSettings {
  /** Annual loan rate as a fraction (0.16 = 16%). Used by the profit and delay scenarios. */
  financingRate: number;
  /** A bid decision can be recorded only after Interpretation, Compliance and Commercial are reviewed. */
  requireStageReviews: boolean;
  /** Start reading a tender as soon as its page opens. */
  autoStartAnalysis: boolean;
  alertClosing: boolean;
  alertClosingDays: number;
  alertDocuments: boolean;
  alertDocumentsDays: number;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  financingRate: FINANCING_RATE,
  requireStageReviews: false,
  autoStartAnalysis: true,
  alertClosing: true,
  alertClosingDays: 7,
  alertDocuments: true,
  alertDocumentsDays: 30,
};

/** 0.145 → "14.5". Whole numbers stay whole. */
export function ratePercentText(rate: number): string {
  return String(Math.round(rate * 10000) / 100);
}

const days = (max: number, message: string) => z.number().int(message).min(1, message).max(max, message);

const settingsSchema = z.object({
  financingRatePercent: z
    .number({ message: "Enter the loan rate as a percentage, for example 16." })
    .min(0, "The loan rate must be between 0 and 100.")
    .max(100, "The loan rate must be between 0 and 100."),
  requireStageReviews: z.boolean(),
  autoStartAnalysis: z.boolean(),
  alertClosing: z.boolean(),
  alertClosingDays: days(60, "Closing alert: enter 1 to 60 days."),
  alertDocuments: z.boolean(),
  alertDocumentsDays: days(365, "Document alert: enter 1 to 365 days."),
});

export function parseSettings(
  input: unknown,
): { ok: true; value: WorkspaceSettings } | { ok: false; error: string } {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the settings and try again." };
  const data = parsed.data;
  return {
    ok: true,
    value: {
      financingRate: Math.round(data.financingRatePercent * 100) / 10000,
      requireStageReviews: data.requireStageReviews,
      autoStartAnalysis: data.autoStartAnalysis,
      alertClosing: data.alertClosing,
      alertClosingDays: data.alertClosingDays,
      alertDocuments: data.alertDocuments,
      alertDocumentsDays: data.alertDocumentsDays,
    },
  };
}
