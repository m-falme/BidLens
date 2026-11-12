import { describe, expect, it } from "vitest";

import {
  breakevenDays,
  financedAmount,
  marginAtDelay,
  marginScenarios,
  priceToKeepMargin,
  type MarginInputs,
} from "@/lib/risk/margin";
import { roundTo } from "@/lib/risk/round";

/** §5.3 test case: KES 8m contract, 14% margin, 16% financing, no advance. */
const base: MarginInputs = { V: 8_000_000, m: 0.14, r: 0.16 };

describe("margin after delay: §5.3 example", () => {
  it("net ≈ 939,047 at 60 days", () => {
    expect(marginAtDelay(base, 60).net).toBeCloseTo(939_046.58, 1);
    expect(Math.round(marginAtDelay(base, 60).net)).toBe(939_047);
  });

  it("net ≈ 19,200 at 365 days", () => {
    expect(marginAtDelay(base, 365).net).toBeCloseTo(19_200, 6);
  });

  it("net ≈ −1,081,600 at 730 days", () => {
    expect(marginAtDelay(base, 730).net).toBeCloseTo(-1_081_600, 6);
  });

  it("break-even ≈ 371 days", () => {
    expect(Math.round(breakevenDays(base)!)).toBe(371);
  });

  it("break-even ≈ 484 days with a 20% advance", () => {
    expect(Math.round(breakevenDays({ ...base, adv: 0.2 })!)).toBe(484);
  });

  it("price to keep 14% margin at 365 days ≈ 9,280,000", () => {
    expect(priceToKeepMargin(base, 365)).toBeCloseTo(9_280_000, 4);
  });

  it("returns the four standard scenarios by default", () => {
    const scenarios = marginScenarios(base);
    expect(scenarios.map((s) => s.days)).toEqual([60, 180, 365, 730]);
    expect(roundTo(scenarios[2].margin, 4)).toBe(0.0024);
  });
});

describe("margin rules", () => {
  it("net is exactly zero at the break-even day", () => {
    const inputs = { ...base, adv: 0.1, f: 0.8, s: 50_000, ir: 0.04 };
    expect(marginAtDelay(inputs, breakevenDays(inputs)!).net).toBeCloseTo(0, 6);
  });

  it("an advance covering the whole cost means nothing to finance and no break-even", () => {
    const inputs = { ...base, adv: 0.9 };
    expect(financedAmount(inputs)).toBe(0);
    expect(breakevenDays(inputs)).toBeNull();
    expect(marginAtDelay(inputs, 730).net).toBe(1_120_000);
  });

  it("break-even is 0 when fixed costs exceed the gross profit", () => {
    expect(breakevenDays({ ...base, s: 2_000_000 })).toBe(0);
  });

  it("late-payment interest offsets financing", () => {
    const withInterest = marginAtDelay({ ...base, ir: 0.16 }, 365);
    expect(withInterest.recovered).toBeCloseTo(withInterest.financing, 6);
    expect(withInterest.net).toBeCloseTo(1_120_000, 6);
  });

  it("rejects impossible inputs instead of returning nonsense", () => {
    expect(() => marginAtDelay({ ...base, m: 1 }, 60)).toThrow(RangeError);
    expect(() => marginAtDelay({ ...base, V: 0 }, 60)).toThrow(/V must be > 0/);
    expect(() => marginAtDelay(base, -1)).toThrow(RangeError);
  });
});

describe("roundTo", () => {
  it("rounds decimal halves up, unlike Math.round(x * 10) / 10", () => {
    expect([6.45, 36.45, 0.15].map((v) => roundTo(v, 1))).toEqual([6.5, 36.5, 0.2]);
    expect([2.475, 1.005].map((v) => roundTo(v, 2))).toEqual([2.48, 1.01]);
  });
});
