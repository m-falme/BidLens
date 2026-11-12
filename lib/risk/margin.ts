/**
 * Margin after payment delay, ARCHITECTURE §5.3. Pure maths: the UI only displays results.
 * Input names match the `inputs_json` stored on `risk_assessments`.
 */

export interface MarginInputs {
  /** Contract value, KES. */
  V: number;
  /** Gross margin as a fraction of V, 0 ≤ m < 1. */
  m: number;
  /** Annual cost of financing the delivery (overdraft / loan rate), fraction. */
  r: number;
  /** Advance payment as a fraction of V. Default 0. */
  adv?: number;
  /** Share of the unfunded cost that is actually borrowed. Default 1. */
  f?: number;
  /** Other fixed costs of the bid (securities, fees), KES. Default 0. */
  s?: number;
  /** Annual late-payment interest the buyer pays on the financed amount, fraction. Default 0. */
  ir?: number;
}

export interface MarginScenario {
  days: number;
  profit: number;
  financing: number;
  recovered: number;
  net: number;
  /** net / V */
  margin: number;
}

/** Payment-delay scenarios shown on every risk card. */
export const PAYMENT_DELAY_SCENARIOS = [60, 180, 365, 730] as const;

const DAYS_PER_YEAR = 365;

type ResolvedInputs = Required<MarginInputs>;

function resolve(inputs: MarginInputs): ResolvedInputs {
  const resolved = { adv: 0, f: 1, s: 0, ir: 0, ...inputs };
  const { V, m, r, adv, f, s, ir } = resolved;
  const problems: string[] = [];
  if (!(V > 0)) problems.push("V must be > 0");
  if (!(m >= 0 && m < 1)) problems.push("m must be in [0, 1)");
  if (!(r >= 0)) problems.push("r must be ≥ 0");
  if (!(adv >= 0 && adv <= 1)) problems.push("adv must be in [0, 1]");
  if (!(f >= 0 && f <= 1)) problems.push("f must be in [0, 1]");
  if (!(s >= 0)) problems.push("s must be ≥ 0");
  if (!(ir >= 0)) problems.push("ir must be ≥ 0");
  if (problems.length > 0) throw new RangeError(`Invalid margin inputs: ${problems.join("; ")}`);
  return resolved;
}

/** F = max(0, C − adv·V)·f, the amount the supplier must fund until paid. */
export function financedAmount(inputs: MarginInputs): number {
  const { V, m, adv, f } = resolve(inputs);
  const cost = V * (1 - m);
  return Math.max(0, cost - adv * V) * f;
}

export function marginAtDelay(inputs: MarginInputs, days: number): MarginScenario {
  if (!(days >= 0)) throw new RangeError("days must be ≥ 0");
  const { V, m, r, s, ir } = resolve(inputs);
  const F = financedAmount(inputs);
  const profit = V * m;
  const financing = (F * r * days) / DAYS_PER_YEAR;
  const recovered = (F * ir * days) / DAYS_PER_YEAR;
  const net = profit - financing + recovered - s;
  return { days, profit, financing, recovered, net, margin: net / V };
}

export function marginScenarios(
  inputs: MarginInputs,
  days: readonly number[] = PAYMENT_DELAY_SCENARIOS,
): MarginScenario[] {
  return days.map((d) => marginAtDelay(inputs, d));
}

/**
 * Days of delay at which net profit reaches zero: (P − s) / (F·(r − ir)/365).
 * With ir = 0 this is the §5.3 formula (P − s) / (F·r/365); ir is netted so the result
 * agrees with `marginAtDelay`. null = financing never erodes the profit (no break-even).
 * 0 = the bid loses money even if paid on day 0.
 */
export function breakevenDays(inputs: MarginInputs): number | null {
  const { V, m, r, s, ir } = resolve(inputs);
  const dailyCost = (financedAmount(inputs) * (r - ir)) / DAYS_PER_YEAR;
  const headroom = V * m - s;
  if (headroom <= 0) return 0;
  if (dailyCost <= 0) return null;
  return headroom / dailyCost;
}

/**
 * Price that keeps margin m after `days` of delay, holding cost and financing fixed:
 * (C + financing − recovered + s) / (1 − m). With ir = 0 this is the §5.3 formula.
 */
export function priceToKeepMargin(inputs: MarginInputs, days: number): number {
  const { V, m, s } = resolve(inputs);
  const { financing, recovered } = marginAtDelay(inputs, days);
  return (V * (1 - m) + financing - recovered + s) / (1 - m);
}
