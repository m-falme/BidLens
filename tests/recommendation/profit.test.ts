import { describe, expect, it } from "vitest";

import {
  PROFIT_EMPTY,
  delayTable,
  profitIdleMessage,
  formatKes,
  formatMarginPct,
  parseKesInput,
  profitCopy,
  profitResult,
} from "@/lib/recommendation/profit";
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

  it("keeps the delivery-cost warning off the screen while an input is blank", () => {
    const warning = "Delivery cost is not below the contract value, so profit after a delay is not calculated.";
    expect(profitIdleMessage({ contractValue: "", deliveryCost: "", lateNote: warning })).toBe(PROFIT_EMPTY);
    expect(profitIdleMessage({ contractValue: "8000000", deliveryCost: "  ", lateNote: warning })).toBe(PROFIT_EMPTY);
    expect(profitIdleMessage({ contractValue: "8000000", deliveryCost: "9000000", lateNote: warning })).toBe(warning);
  });
});

describe("delay table", () => {
  it("is hidden until contract value and cost are both filled", () => {
    expect(delayTable({ contractValueKes: null, deliveryCostKes: cost, band: "low" })).toBeNull();
    expect(delayTable({ contractValueKes: contract, deliveryCostKes: null, band: "low" })).toBeNull();
    expect(
      delayTable({ contractValueKes: contract, deliveryCostKes: contract + 1, band: "high" }),
    ).toBeNull();
  });

  it("calls the margin function at 2, 6, 12 and 24 months and highlights the county band", () => {
    const rows = delayTable({ contractValueKes: contract, deliveryCostKes: cost, band: "moderate" });
    expect(rows?.map((row) => row.months)).toEqual([2, 6, 12, 24]);
    expect(rows?.map((row) => row.days)).toEqual([60, 180, 365, 730]);
    expect(rows?.map((row) => row.countyBand)).toEqual([false, true, false, false]);
    const six = marginAtDelay(margin, 180);
    expect(rows?.[1]?.financingKes).toBeCloseTo(six.financing, 6);
    expect(rows?.[1]?.profitKes).toBeCloseTo(six.net, 6);
    expect(rows?.[1]?.margin).toBeCloseTo(six.margin, 6);
    expect(rows?.[3]?.profitKes).toBeCloseTo(marginAtDelay(margin, 730).net, 6);
  });

  it("highlights no row when the county has no score", () => {
    const rows = delayTable({ contractValueKes: contract, deliveryCostKes: cost, band: null });
    expect(rows?.every((row) => !row.countyBand)).toBe(true);
  });

  it("formats the margin after finance", () => {
    expect(formatMarginPct(0.19)).toBe("19.0%");
    expect(formatMarginPct(-0.139)).toBe("-13.9%");
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
