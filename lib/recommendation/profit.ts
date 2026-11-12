import { marginAtDelay } from "@/lib/risk/margin";
import type { RiskBand } from "@/lib/risk/county-score";

/**
 * Profit from the saved contract value and delivery cost.
 * The loan rate is the rate already used by the margin calculation. The company profile
 * does not record one. Delay days follow the county band: Low 60, Moderate 180, High 365, Severe 730.
 */

/** Annual financing rate passed to `marginAtDelay` as `r`. */
export const FINANCING_RATE = 0.16;

export const TYPICAL_DELAY_DAYS = {
  low: 60,
  moderate: 180,
  high: 365,
  severe: 730,
} as const;

export const PROFIT_EMPTY = "Add contract value and cost to see profit.";

const BAND_WORD: Record<Exclude<RiskBand, "unknown">, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

export interface ProfitInput {
  contractValueKes: number | null;
  deliveryCostKes: number | null;
  band: RiskBand | null;
}

export interface ProfitResult {
  onTimeKes: number;
  lateKes: number | null;
  lateDays: number | null;
  rate: number;
  /** Why the late figure is absent. Null when `lateKes` is set. */
  lateNote: string | null;
}

export function typicalDelayDays(band: RiskBand | null): number | null {
  if (!band || band === "unknown") return null;
  return TYPICAL_DELAY_DAYS[band];
}

export function formatKes(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}KSh ${withCommas}`;
}

/** Sentences for the profit card. Null when either figure is still blank. */
export function profitCopy(input: ProfitInput): string[] | null {
  const result = profitResult(input);
  if (!result) return null;
  const lines = [`If paid on time: ${formatKes(result.onTimeKes)}`];
  if (result.lateKes !== null && result.lateDays !== null && input.band && input.band !== "unknown") {
    lines.push(`If paid after ${result.lateDays} days: ${formatKes(result.lateKes)}`);
    lines.push(
      `${result.lateDays} days is the scenario for the ${BAND_WORD[input.band]} band. This is the unpaid-bills band, not a date the county will pay.`,
    );
    lines.push(
      `Loan rate ${Math.round(result.rate * 100)}% a year. The company profile does not record a loan rate, so the margin calculation uses this rate.`,
    );
  } else if (result.lateNote) {
    lines.push(result.lateNote);
  }
  return lines;
}

/**
 * Null when either amount is missing. When both are present, on-time profit is the margin
 * at day 0 and late profit is the margin at the band's scenario delay.
 */
export function profitResult(input: ProfitInput): ProfitResult | null {
  const contract = input.contractValueKes;
  const cost = input.deliveryCostKes;
  if (contract === null || cost === null) return null;
  if (!Number.isFinite(contract) || !Number.isFinite(cost) || cost < 0) return null;

  const onTimeKes = contract - cost;
  const days = typicalDelayDays(input.band);
  if (!(contract > 0)) {
    return {
      onTimeKes,
      lateKes: null,
      lateDays: days,
      rate: FINANCING_RATE,
      lateNote: "Enter a contract value above zero to calculate profit after a delay.",
    };
  }

  const margin = (contract - cost) / contract;
  if (!(margin >= 0 && margin < 1)) {
    return {
      onTimeKes,
      lateKes: null,
      lateDays: days,
      rate: FINANCING_RATE,
      lateNote: "Delivery cost is not below the contract value, so profit after a delay is not calculated.",
    };
  }
  if (days === null) {
    return {
      onTimeKes: marginAtDelay({ V: contract, m: margin, r: FINANCING_RATE }, 0).net,
      lateKes: null,
      lateDays: null,
      rate: FINANCING_RATE,
      lateNote: "No county score, so the late-payment scenario is not shown.",
    };
  }

  const figures = { V: contract, m: margin, r: FINANCING_RATE };
  return {
    onTimeKes: marginAtDelay(figures, 0).net,
    lateKes: marginAtDelay(figures, days).net,
    lateDays: days,
    rate: FINANCING_RATE,
    lateNote: null,
  };
}

export function parseKesInput(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = raw.trim().replace(/,/g, "");
  if (text === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, error: "Enter an amount in KES, or leave the field blank." };
  }
  return { ok: true, value: Number(text) };
}

export function parseTenderFigures(
  input: unknown,
):
  | { ok: true; value: { tenderId: string; contractValueKes: number | null; deliveryCostKes: number | null } }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Those figures could not be read." };
  const record = input as Record<string, unknown>;
  const tenderId = record.tenderId;
  if (typeof tenderId !== "string" || !/^[0-9a-f-]{36}$/i.test(tenderId)) {
    return { ok: false, error: "That tender was not found." };
  }
  if (typeof record.contractValue !== "string" || typeof record.deliveryCost !== "string") {
    return { ok: false, error: "Those figures could not be read." };
  }
  const contract = parseKesInput(record.contractValue);
  if (!contract.ok) return contract;
  const cost = parseKesInput(record.deliveryCost);
  if (!cost.ok) return cost;
  return {
    ok: true,
    value: { tenderId, contractValueKes: contract.value, deliveryCostKes: cost.value },
  };
}
