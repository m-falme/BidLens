import { join } from "node:path";

import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it } from "vitest";

import { hardChecks, paperGaps, type FindProfile } from "@/lib/find/checks";
import { applyAiFit, BLOCKED_FIT_CAP, rankByCode } from "@/lib/find/rank";
import { clearFindCache, findTenders } from "@/lib/find/run";
import { SampleTenderSource, type Tender, type TenderSource } from "@/lib/find/source";
import { buildLeadDraft, startTender, type LeadDraft } from "@/lib/find/start";
import { PpipTenderSource } from "@/lib/find/ppip-source";

const USAGE = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};
const NOW = new Date("2026-11-26T09:00:00+03:00");

const PROFILE: FindProfile = {
  services: ["Data analytics", "Dashboards and business intelligence"],
  tools: ["Power BI"],
  sectors: ["Public finance"],
  heldPapers: ["Certificate of incorporation", "CR12", "KRA PIN", "Tax compliance certificate", "Single business permit"],
};

function tender(over: Partial<Tender> = {}): Tender {
  return {
    id: "T-1",
    reference: "REF/1",
    title: "Data analytics dashboard for revenue",
    buyer: "County Government of Test",
    county: "Kisumu",
    location: null,
    sector: "data/BI/analytics",
    category: "services",
    procurement_method: "RFP",
    estimated_value_kes: 1_000_000,
    published_on: "2026-11-01",
    closing_datetime: "2026-12-22T10:00:00+03:00",
    submission_method: null,
    eligibility: ["Certificate of incorporation", "KRA PIN"],
    reserved_for_agpo: null,
    description: "A fictional notice.",
    ...over,
  };
}

describe("SampleTenderSource", () => {
  it("reads the 60 sample tenders from data/sample-tenders/tenders.json", async () => {
    const tenders = await new SampleTenderSource().fetchTenders();
    expect(tenders).toHaveLength(60);
    expect(tenders[0]?.id).toBe("ST-001");
    expect(new SampleTenderSource().describe(tenders)).toBe("sample dataset (60 tenders)");
  });

  it("fails clearly when the file is missing", async () => {
    await expect(new SampleTenderSource(join("no", "such", "file.json")).fetchTenders()).rejects.toThrow();
  });

  it("keeps the web source unbuilt", async () => {
    await expect(new PpipTenderSource().fetchTenders()).rejects.toThrow(/not built/);
  });
});

describe("hard checks", () => {
  it("marks a past closing time as closed and an open one as open", () => {
    expect(hardChecks(tender({ closing_datetime: "2026-11-20T10:00:00+03:00" }), PROFILE, NOW).eligibility).toBe("closed");
    expect(hardChecks(tender(), PROFILE, NOW).eligibility).toBe("open");
  });

  it("blocks a notice reserved for AGPO when no AGPO certificate is held", () => {
    const checks = hardChecks(
      tender({ reserved_for_agpo: "youth", eligibility: ["KRA PIN", "AGPO certificate (youth)"] }),
      PROFILE,
      NOW,
    );
    expect(checks.eligibility).toBe("blocked");
    expect(checks.agpoBlock).toBe("youth");
    expect(checks.facts[0]).toContain("Reserved for AGPO youth");
  });

  it("does not block a reserved notice when an AGPO certificate is held, but says to check the group", () => {
    const held = { ...PROFILE, heldPapers: [...PROFILE.heldPapers, "AGPO certificate"] };
    const checks = hardChecks(tender({ reserved_for_agpo: "women" }), held, NOW);
    expect(checks.eligibility).toBe("open");
    expect(checks.facts[0]).toContain("Check your certificate");
  });

  it("blocks a notice that needs a licence the company lacks", () => {
    const checks = hardChecks(
      tender({ eligibility: ["KRA PIN", "ICT Authority (ICTA) certification in a relevant systems or software category"] }),
      PROFILE,
      NOW,
    );
    expect(checks.eligibility).toBe("blocked");
    expect(checks.gaps.map((g) => g.name)).toEqual(["ICT Authority (ICTA) certification"]);
    expect(checks.facts).toContain("Needs ICT Authority (ICTA) certification, which you don't have.");
  });

  it("treats a common missing paper as a gap, not a block, and skips lines that are not papers", () => {
    const gaps = paperGaps(
      { eligibility: ["Audited accounts for the last 3 years", "Evidence of at least 2 similar contracts in the last five years"] },
      PROFILE.heldPapers,
    );
    expect(gaps).toEqual([{ name: "Audited accounts", hard: false }]);
    expect(hardChecks(tender({ eligibility: ["Audited accounts for the last 3 years"] }), PROFILE, NOW).eligibility).toBe("open");
  });

  it("holds a paper only when it is marked Have", () => {
    expect(paperGaps({ eligibility: ["KRA PIN"] }, [])).toHaveLength(1);
    expect(paperGaps({ eligibility: ["KRA PIN"] }, ["KRA PIN"])).toHaveLength(0);
  });
});

describe("ranking", () => {
  it("puts open matches first, then blocked, then closed, with the best fit first", () => {
    const ranked = rankByCode(
      [
        tender({ id: "closed", closing_datetime: "2026-11-01T10:00:00+03:00" }),
        tender({ id: "blocked", reserved_for_agpo: "youth" }),
        tender({ id: "weak", title: "Supply of stationery", sector: "supplies/goods", description: "Pens." }),
        tender({ id: "strong" }),
      ],
      PROFILE,
      NOW,
    );
    expect(ranked.map((r) => r.tender.id)).toEqual(["strong", "weak", "blocked", "closed"]);
    expect(ranked[0]?.reasons[0]).toBe("Matches your Data analytics service");
    expect(ranked[2]?.fit).toBeLessThanOrEqual(BLOCKED_FIT_CAP);
  });

  it("never lets the AI lift a blocked tender above the cap, and ignores unknown ids", () => {
    const ranked = rankByCode([tender({ id: "a", reserved_for_agpo: "youth" }), tender({ id: "b" })], PROFILE, NOW);
    const out = applyAiFit(ranked, [
      { id: "a", fit: 95, reasons: ["Looks great"] },
      { id: "zzz", fit: 100, reasons: ["Not a tender"] },
    ]);
    expect(out.find((r) => r.tender.id === "a")?.fit).toBe(BLOCKED_FIT_CAP);
    expect(out.find((r) => r.tender.id === "b")?.aiWritten).toBe(false);
  });

  it("keeps a missing paper the code found when the AI reasons leave it out", () => {
    const ranked = rankByCode([tender({ id: "a", eligibility: ["Audited accounts for the last 3 years"] })], PROFILE, NOW);
    const out = applyAiFit(ranked, [{ id: "a", fit: 80, reasons: ["Matches your data analytics", "Fits your sector", "Good size"] }]);
    expect(out[0]?.reasons).toEqual(["Matches your data analytics", "Fits your sector", "Needs Audited accounts, which you don't have"]);
  });
});

describe("findTenders", () => {
  beforeEach(() => clearFindCache());

  const source: TenderSource = {
    describe: (t) => `test source (${t.length})`,
    fetchTenders: async () => [tender({ id: "a" }), tender({ id: "b", title: "Supply of pens", description: "Pens." })],
  };

  function modelAnswering(text: string) {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        return {
          content: [{ type: "text", text }],
          finishReason: { unified: "stop", raw: undefined },
          usage: USAGE,
          warnings: [],
        };
      },
    });
    return { model, calls: () => calls };
  }

  it("falls back to the code ranking when the AI call fails, and does not cache the failure", async () => {
    const bad = modelAnswering("not json");
    const first = await findTenders({ source, profile: PROFILE, model: bad.model, now: NOW });
    expect(first.aiStatus).toBe("failed");
    expect(first.ranked).toHaveLength(2);
    expect(first.ranked.every((r) => !r.aiWritten)).toBe(true);
    await findTenders({ source, profile: PROFILE, model: bad.model, now: NOW });
    expect(bad.calls()).toBeGreaterThan(2);
  });

  it("uses the AI words once and serves the second press from the cache", async () => {
    const ok = modelAnswering(
      JSON.stringify({ results: [{ id: "a", fit: 88, reasons: ["Matches your data analytics service", "Closes soon"] }] }),
    );
    const first = await findTenders({ source, profile: PROFILE, model: ok.model, now: NOW });
    expect(first.aiStatus).toBe("used");
    expect(first.ranked[0]?.reasons[0]).toBe("Matches your data analytics service");
    expect(first.ranked[0]?.fit).toBe(88);
    const calls = ok.calls();
    const second = await findTenders({ source, profile: PROFILE, model: ok.model, now: NOW });
    expect(second.cached).toBe(true);
    expect(ok.calls()).toBe(calls);
  });

  it("ranks by code when no model is configured", async () => {
    const result = await findTenders({ source, profile: PROFILE, model: null, now: NOW });
    expect(result.aiStatus).toBe("not_configured");
    expect(result.sourceLabel).toBe("test source (2)");
  });
});

describe("start this tender", () => {
  function store() {
    const leads = new Map<string, string>();
    const drafts: LeadDraft[] = [];
    return {
      drafts,
      deps: {
        findExisting: async (reference: string) => leads.get(reference) ?? null,
        create: async (draft: LeadDraft) => {
          drafts.push(draft);
          const id = `lead-${drafts.length}`;
          leads.set(draft.reference, id);
          return id;
        },
      },
    };
  }

  it("creates one lead and returns the same one when clicked twice", async () => {
    const { deps, drafts } = store();
    const first = await startTender(tender(), deps);
    const second = await startTender(tender(), deps);
    expect(first).toEqual({ ok: true, leadId: "lead-1", alreadyStarted: false });
    expect(second).toEqual({ ok: true, leadId: "lead-1", alreadyStarted: true });
    expect(drafts).toHaveLength(1);
  });

  it("copies the notice into quoted fields and says it is a fictional sample", () => {
    const draft = buildLeadDraft(tender());
    expect(draft.reference).toBe("REF/1");
    expect(draft.fields.map((f) => f.key)).toContain("procuring_entity");
    expect(draft.fields.every((f) => f.status === "source_confirmed" && draft.pageText.includes(f.quote))).toBe(true);
    expect(draft.fields.find((f) => f.key === "lead_source")?.value).toContain("fictional");
  });
});
