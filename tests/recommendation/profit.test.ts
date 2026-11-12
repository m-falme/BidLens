import { describe, expect, it } from "vitest";

import { PROFIT_EMPTY, formatKes, parseKesInput, profitCopy, profitResult } from "@/lib/recommendation/profit";
import { marginAtDelay } from "@/lib/risk/margin";

const contract = 8_000_000;
const cost = 6_880_000;
const margin = { V: contract, m: 0.14, r: 0.16 };

describe("profit view", () => {
  it("asks for both figures until they are saved", () => {
    expect(profitResult({ contractValueKes: null, deliveryCostKes: cost, band: "severe" })).toBeNull();
    expect(profitResult({ contractValueKes: contract, deliveryCostKes: null, band: "severe" })).toBeNull();
    expect(profitCopy({ contractValueKes: null, deliveryCostKes: null, band: "low" })).toBeNull();
    expect(PROFIT_EMPTY).toBe("Add contract value and cost to see profit.");
  });

  it("uses the margin calculation for on-time profit and the Severe delay", () => {
    const result = profitResult({ contractValueKes: contract, deliveryCostKes: cost, band: "severe" });
    expect(result?.onTimeKes).toBeCloseTo(marginAtDelay(margin, 0).net, 6);
    expect(result?.onTimeKes).toBeCloseTo(1_120_000, 6);
    expect(result?.lateDays).toBe(730);
    expect(result?.lateKes).toBeCloseTo(marginAtDelay(margin, 730).net, 6);
    expect(result?.lateKes).toBeCloseTo(-1_081_600, 0);
    const lines = profitCopy({ contractValueKes: contract, deliveryCostKes: cost, band: "severe" });
    expect(lines?.[0]).toBe("If paid on time: KSh 1,120,000");
    expect(lines?.[1]).toBe("If paid after 730 days: -KSh 1,081,600");
    expect(lines?.some((line) => /16% a year/.test(line))).toBe(true);
  });

  it("uses 60 days for a Low band", () => {
    const result = profitResult({ contractValueKes: contract, deliveryCostKes: cost, band: "low" });
    expect(result?.lateDays).toBe(60);
    expect(result?.lateKes).toBeCloseTo(marginAtDelay(margin, 60).net, 6);
    expect(Math.round(result?.lateKes ?? 0)).toBe(939_047);
  });

  it("shows on-time profit without a late scenario when the county has no score", () => {
    const result = profitResult({ contractValueKes: contract, deliveryCostKes: cost, band: null });
    expect(result?.onTimeKes).toBeCloseTo(1_120_000, 6);
    expect(result?.lateKes).toBeNull();
    expect(result?.lateNote).toMatch(/No county score/);
  });

  it("does not run the delay calculation when cost is above the contract value", () => {
    const result = profitResult({
      contractValueKes: contract,
      deliveryCostKes: contract + 500_000,
      band: "high",
    });
    expect(result?.onTimeKes).toBe(-500_000);
    expect(result?.lateKes).toBeNull();
    expect(result?.lateNote).toMatch(/not below the contract value/);
  });
});

describe("formatKes", () => {
  it("groups thousands and keeps a minus", () => {
    expect(formatKes(1_120_000)).toBe("KSh 1,120,000");
    expect(formatKes(-1_081_600)).toBe("-KSh 1,081,600");
  });
});

describe("parseKesInput", () => {
  it("accepts a blank or a plain amount and rejects anything else", () => {
    expect(parseKesInput("  ")).toEqual({ ok: true, value: null });
    expect(parseKesInput("8,000,000")).toEqual({ ok: true, value: 8_000_000 });
    expect(parseKesInput("12.50")).toEqual({ ok: true, value: 12.5 });
    expect(parseKesInput("-5").ok).toBe(false);
    expect(parseKesInput("eight").ok).toBe(false);
  });
});
