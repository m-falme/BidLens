import { describe, expect, it } from "vitest";

import { parseCapability, parseLegalName, parseRemoval, sameName } from "@/lib/company/profile";

describe("company profile edits", () => {
  it("tidies a registered name and refuses an empty or very long one", () => {
    expect(parseLegalName({ name: "  Zanari   Analytics   Ltd " })).toEqual({ ok: true, value: "Zanari Analytics Ltd" });
    expect(parseLegalName({ name: " " })).toEqual({ ok: false, error: "Enter the registered name." });
    expect(parseLegalName({ name: "x".repeat(121) }).ok).toBe(false);
    expect(parseLegalName(null).ok).toBe(false);
  });

  it("accepts a service, tool or sector and refuses anything else", () => {
    expect(parseCapability({ kind: "service", name: "  Drone  survey mapping" })).toEqual({
      ok: true,
      value: { kind: "service", name: "Drone survey mapping" },
    });
    expect(parseCapability({ kind: "tool", name: "QGIS" }).ok).toBe(true);
    expect(parseCapability({ kind: "sector", name: "A" })).toEqual({ ok: false, error: "Enter at least two characters." });
    expect(parseCapability({ kind: "certification", name: "ISO 9001" })).toEqual({
      ok: false,
      error: "Choose services, tools or sectors.",
    });
    expect(parseCapability({ kind: "service", name: "y".repeat(121) }).ok).toBe(false);
  });

  it("treats names that differ only by case or spacing as the same", () => {
    expect(sameName("Data  Analytics", "data analytics")).toBe(true);
    expect(sameName("Data Analytics", "Data Science")).toBe(false);
  });

  it("only accepts a real id for a removal", () => {
    expect(parseRemoval({ id: "7d5f4f7e-1c1c-4f7e-8f4e-0a8a8a8a8a8a" }).ok).toBe(true);
    expect(parseRemoval({ id: "nope" }).ok).toBe(false);
  });
});
