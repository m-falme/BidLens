import type { RiskBand } from "@/lib/risk/county-score";

export const DECISION_CHOICES = ["bid", "bid_higher", "ask_advance", "skip"] as const;
export type DecisionChoice = (typeof DECISION_CHOICES)[number];

export const DECISION_LABEL: Record<DecisionChoice, string> = {
  bid: "Bid",
  bid_higher: "Bid higher",
  ask_advance: "Ask for advance",
  skip: "Skip",
};

/** Status colour is meaning only: green good, amber caution, red risk, grey none. */
export const DECISION_CLASS: Record<DecisionChoice | "none", string> = {
  bid: "bg-green-100 text-green-800",
  bid_higher: "bg-amber-100 text-amber-950",
  ask_advance: "bg-amber-100 text-amber-950",
  skip: "bg-red-100 text-red-800",
  none: "bg-zinc-200 text-zinc-700",
};

export const RISK_LABEL: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
  unknown: "No score",
};

export const RISK_CLASS: Record<RiskBand, string> = {
  low: "bg-green-100 text-green-800",
  moderate: "bg-amber-100 text-amber-950",
  high: "bg-red-100 text-red-800",
  severe: "bg-red-100 text-red-800",
  unknown: "bg-zinc-200 text-zinc-700",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  unknown: "Not scored",
};

export function confidenceLabel(value: string | null): string {
  if (!value) return "Not scored";
  return CONFIDENCE_LABEL[value] ?? "Not scored";
}

export function asDecision(value: string | null | undefined): DecisionChoice | null {
  return DECISION_CHOICES.find((choice) => choice === value) ?? null;
}

/** A shouted title becomes one sentence. Mixed-case titles, and the stored quote, stay as written. */
export function sentenceCase(value: string): string {
  const letters = value.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return value;
  const upper = (value.match(/[A-Z]/g) ?? []).length;
  if (upper / letters.length < 0.7) return value;
  const text = value.toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

/** Prefer the date written in the tender. Otherwise the stored deadline, in Nairobi time. */
export function closingLabel(fieldValue: string | null, deadlineAt: string | null): string | null {
  const written = fieldValue?.trim();
  if (written) return written;
  return formatWhen(deadlineAt);
}

/** Match a buyer county to a Controller of Budget county name. No partial guesses. */
export function matchCountyName(label: string | null, counties: readonly string[]): string | null {
  if (!label) return null;
  const text = label.trim().toLowerCase();
  if (!text || text === "national") return null;
  const exact = counties.find((county) => county.toLowerCase() === text);
  if (exact) return exact;
  return counties.find((county) => text.includes(county.toLowerCase())) ?? null;
}
