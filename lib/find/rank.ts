import { hardChecks, type Eligibility, type FindProfile, type HardChecks } from "./checks";
import type { Tender } from "./source";

export interface RankedTender {
  tender: Tender;
  eligibility: Eligibility;
  checks: HardChecks;
  /** 0–100. The code score, or the AI's score when it wrote one (never above the cap for a blocked tender). */
  fit: number;
  codeFit: number;
  /** 2–3 plain reasons. */
  reasons: string[];
  /** True when the AI wrote the reasons and score. */
  aiWritten: boolean;
}

const STOP = new Set(["and", "the", "for", "of", "to", "in", "a", "an", "with", "services", "service", "systems", "system"]);

function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    out.add(raw.length > 3 && raw.endsWith("s") ? raw.slice(0, -1) : raw);
  }
  return out;
}

/** A capability is a hit when at least half of its significant words appear in the notice. */
export function capabilityHits(names: readonly string[], haystack: string): string[] {
  const text = words(haystack);
  return names.filter((name) => {
    const need = [...words(name)];
    if (need.length === 0) return false;
    const found = need.filter((word) => text.has(word)).length;
    return found / need.length >= 0.5;
  });
}

/** Highest fit a tender that needs a paper or reservation the company lacks can show. */
export const BLOCKED_FIT_CAP = 25;

export function codeScore(tender: Tender, profile: FindProfile, checks: HardChecks): { fit: number; reasons: string[] } {
  const text = `${tender.title} ${tender.sector ?? ""} ${tender.description}`;
  const services = capabilityHits(profile.services, text);
  const tools = capabilityHits(profile.tools, text);
  const sectors = capabilityHits(profile.sectors, text);

  let fit = services.length + tools.length + sectors.length === 0 ? 10 : 20;
  fit += 25 * Math.min(services.length, 2) + 8 * Math.min(tools.length, 2) + 12 * Math.min(sectors.length, 1);
  fit -= 8 * checks.gaps.filter((gap) => !gap.hard).length;
  if (checks.eligibility === "blocked") fit = Math.min(fit, BLOCKED_FIT_CAP);
  fit = Math.max(0, Math.min(95, fit));

  const reasons: string[] = [];
  if (checks.agpoBlock) reasons.push(`Reserved for AGPO ${checks.agpoBlock}`);
  for (const gap of checks.gaps.filter((g) => g.hard).slice(0, 2)) reasons.push(`Needs ${gap.name}, which you don't have`);
  if (services[0]) reasons.push(`Matches your ${services[0]} service`);
  else if (sectors[0]) reasons.push(`In your ${sectors[0]} sector`);
  if (tools[0] && reasons.length < 3) reasons.push(`Uses a tool you work with: ${tools[0]}`);
  for (const gap of checks.gaps.filter((g) => !g.hard)) {
    if (reasons.length < 3) reasons.push(`Needs ${gap.name}, which you don't have`);
  }
  if (reasons.length === 0) reasons.push("No match with your services, tools or sectors");
  return { fit, reasons: reasons.slice(0, 3) };
}

const ORDER: Record<Eligibility, number> = { open: 0, blocked: 1, closed: 2 };

/** Open tenders first, then likely-not-eligible, then closed; best fit first inside each; closing date breaks ties. */
export function compareRanked(a: RankedTender, b: RankedTender): number {
  return (
    ORDER[a.eligibility] - ORDER[b.eligibility] ||
    b.fit - a.fit ||
    a.tender.closing_datetime.localeCompare(b.tender.closing_datetime)
  );
}

/** Rank by code only. Used on its own when the AI call fails. */
export function rankByCode(tenders: readonly Tender[], profile: FindProfile, now: Date): RankedTender[] {
  return tenders
    .map((tender): RankedTender => {
      const checks = hardChecks(tender, profile, now);
      const { fit, reasons } = codeScore(tender, profile, checks);
      return { tender, eligibility: checks.eligibility, checks, fit, codeFit: fit, reasons, aiWritten: false };
    })
    .sort(compareRanked);
}

export interface AiFit {
  id: string;
  fit: number;
  reasons: string[];
}

export const AI_TOP_N = 15;

/** The tenders the AI looks at: the best-scoring ones that are still open. */
export function topForAi(ranked: readonly RankedTender[]): RankedTender[] {
  return ranked.filter((r) => r.eligibility !== "closed").slice(0, AI_TOP_N);
}

/**
 * Applies the AI's words and score to the top tenders. Code stays in charge of eligibility: a blocked tender
 * can never score above the cap, and an AI result for an unknown id is ignored.
 */
export function applyAiFit(ranked: readonly RankedTender[], ai: readonly AiFit[]): RankedTender[] {
  const byId = new Map(ai.map((item) => [item.id, item]));
  return ranked
    .map((row): RankedTender => {
      const item = byId.get(row.tender.id);
      if (!item || item.reasons.length === 0) return row;
      const fit = Math.max(0, Math.min(100, Math.round(item.fit)));
      return {
        ...row,
        fit: row.eligibility === "blocked" ? Math.min(fit, BLOCKED_FIT_CAP) : fit,
        reasons: item.reasons.slice(0, 3),
        aiWritten: true,
      };
    })
    .sort(compareRanked);
}
