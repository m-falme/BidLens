import { describe, expect, it } from "vitest";

import { presentLeadCopy, sourceLabel } from "@/lib/leads/public-names";

describe("presentLeadCopy", () => {
  it("gives workbook buyers a fictional name and a normal reference", () => {
    expect(presentLeadCopy("Example Water Services Board")).toBe("Lakeview Water Services Board");
    expect(presentLeadCopy("SIM-RFP-2026-002")).toBe("LWSB/ICT/014/2026-27");
    expect(presentLeadCopy("Example Agricultural Research Agency")).toBe("Mlima Agricultural Research Institute");
    expect(presentLeadCopy("SIM-RFQ-2026-005")).toBe("MARI/RD/006/2026-27");
  });

  it("replaces the phrase inside a longer workbook line and leaves real tender text alone", () => {
    expect(presentLeadCopy("Procuring Entity: Example Municipal Authority")).toBe(
      "Procuring Entity: Stonebridge Municipal Authority",
    );
    expect(presentLeadCopy("Nairobi City County SD-WAN")).toBe("Nairobi City County SD-WAN");
    expect(presentLeadCopy(null)).toBeNull();
  });

  it("does not turn SIM-TND-2026-001 into the 004 code", () => {
    expect(presentLeadCopy("SIM-TND-2026-001 and SIM-TND-2026-004")).toBe(
      "HCRH/ICT/011/2026-27 and SMA/ERP/021/2026-27",
    );
  });
});

describe("sourceLabel", () => {
  it("uses the three product labels", () => {
    expect(sourceLabel({ kind: "pdf", opportunityType: "procurement" })).toBe("Uploaded PDF");
    expect(sourceLabel({ kind: "form", opportunityType: "field" })).toBe("Field lead");
    expect(sourceLabel({ kind: "form", opportunityType: "procurement" })).toBe("Imported lead");
  });
});
