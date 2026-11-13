import { describe, expect, it } from "vitest";

import { closingLabel, matchCountyName, riskChipLabel, sentenceCase, spelledCountWithUnit } from "@/lib/format/display";

describe("sentenceCase", () => {
  it("lowers a shouted title and keeps a normal one", () => {
    expect(sentenceCase("SUPPLY AND DELIVERY OF NETWORK EQUIPMENT FOR THE COUNTY")).toBe(
      "Supply and delivery of network equipment for the county",
    );
    expect(sentenceCase("Makueni county revenue system")).toBe("Makueni county revenue system");
    expect(sentenceCase("SD-WAN")).toBe("SD-WAN");
    expect(sentenceCase("MONDAY 23RD NOVEMBER, 2026")).toBe("Monday 23rd november, 2026");
    expect(sentenceCase("20TH NOVEMBER, 2026 at 11:00 a.m.")).toBe("20th november, 2026 at 11:00 a.m.");
    expect(sentenceCase("Nairobi City County")).toBe("Nairobi City County");
  });
});

describe("matchCountyName", () => {
  const counties = ["Nairobi", "Makueni", "Tana River"];

  it("matches the county named in the tender and ignores a national lead", () => {
    expect(matchCountyName("Nairobi City County", counties)).toBe("Nairobi");
    expect(matchCountyName("Makueni", counties)).toBe("Makueni");
    expect(matchCountyName("National", counties)).toBeNull();
    expect(matchCountyName(null, counties)).toBeNull();
  });
});

describe("risk chip and spelled counts", () => {
  it("names the county payment-risk band", () => {
    expect(riskChipLabel("severe")).toBe("County payment risk: Severe");
    expect(riskChipLabel("low")).toBe("County payment risk: Low");
    expect(riskChipLabel(null)).toBe("County payment risk: No score");
    expect(riskChipLabel("unknown")).toBe("County payment risk: No score");
  });

  it("renders a spelled count with its unit", () => {
    expect(spelledCountWithUnit("sixty (60)", "days")).toBe("60 days");
    expect(spelledCountWithUnit("one (1)", "days")).toBe("1 day");
    expect(spelledCountWithUnit("twenty percent (20%)", "days")).toBe("twenty percent (20%)");
    expect(spelledCountWithUnit("30 days", "days")).toBe("30 days");
  });
});

describe("closingLabel", () => {
  it("keeps the date written in the tender", () => {
    expect(closingLabel("11 November 2026 at 11:00 am", "2026-11-11T08:00:00Z")).toBe(
      "11 November 2026 at 11:00 am",
    );
    expect(closingLabel(null, "2026-11-28T10:00:00+03:00")).toBe("28 Nov 2026");
  });
});
