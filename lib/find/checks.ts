import { COMPANY_PAPERS } from "@/lib/company/papers";

import type { Tender } from "./source";

/** What the agent knows about the company. Built from the Company profile and Evidence library. */
export interface FindProfile {
  services: string[];
  tools: string[];
  sectors: string[];
  /** Papers marked Have. Self-declared counts as held here, as it does on the checklist. */
  heldPapers: string[];
}

export type Eligibility =
  /** Closing time has passed. Hidden unless "Show closed" is on. */
  | "closed"
  /** Open, but a reservation or a licence rules the company out unless it gets the paper. */
  | "blocked"
  | "open";

export interface PaperGap {
  name: string;
  /** A licence or certification (hard gate), as opposed to a common paper like audited accounts. */
  hard: boolean;
}

export interface HardChecks {
  eligibility: Eligibility;
  closed: boolean;
  /** Papers the tender asks for that the company does not hold. */
  gaps: PaperGap[];
  /** "youth", "women" or "PWD" when the notice is reserved and the company holds no AGPO certificate. */
  agpoBlock: string | null;
  /** Plain statements the code is sure of. The AI may reword them but never contradict them. */
  facts: string[];
}

const LICENCE_LINE = /\b(licen[cs]e|permit|insurance|authori[sz]ation|authorised dealer|registered with|accredit)/i;
const NOT_A_PAPER = /similar contracts|turnover|debarred|invitation letter|brief of|evidence of suitable/i;

function sameName(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isClosed(tender: Pick<Tender, "closing_datetime">, now: Date): boolean {
  const at = Date.parse(tender.closing_datetime);
  return Number.isFinite(at) && at < now.getTime();
}

/** Papers a notice asks for that the company does not hold. Lines that are not papers (past work, turnover) are skipped. */
export function paperGaps(tender: Pick<Tender, "eligibility">, heldPapers: readonly string[]): PaperGap[] {
  const gaps = new Map<string, PaperGap>();
  for (const line of tender.eligibility) {
    if (NOT_A_PAPER.test(line)) continue;
    const catalog = COMPANY_PAPERS.find((paper) => paper.pattern.test(line));
    if (catalog) {
      if (catalog.key === "agpo") continue; // handled by the reservation check
      if (!heldPapers.some((held) => sameName(held, catalog.name))) {
        gaps.set(catalog.key, { name: catalog.name, hard: catalog.group === "licence" });
      }
      continue;
    }
    if (LICENCE_LINE.test(line) && !heldPapers.some((held) => sameName(held, line))) {
      gaps.set(line, { name: line, hard: true });
    }
  }
  return [...gaps.values()];
}

export function hardChecks(tender: Tender, profile: FindProfile, now: Date): HardChecks {
  const closed = isClosed(tender, now);
  const gaps = paperGaps(tender, profile.heldPapers);
  const hasAgpo = profile.heldPapers.some((held) => sameName(held, "AGPO certificate"));
  const agpoBlock = tender.reserved_for_agpo && !hasAgpo ? tender.reserved_for_agpo : null;

  const facts: string[] = [];
  if (agpoBlock) facts.push(`Reserved for AGPO ${agpoBlock}. You hold no AGPO certificate.`);
  else if (tender.reserved_for_agpo) {
    facts.push(`Reserved for AGPO ${tender.reserved_for_agpo}. Check your certificate covers that group.`);
  }
  for (const gap of gaps) facts.push(`Needs ${gap.name}, which you don't have.`);

  const blocked = agpoBlock !== null || gaps.some((gap) => gap.hard);
  return {
    eligibility: closed ? "closed" : blocked ? "blocked" : "open",
    closed,
    gaps,
    agpoBlock,
    facts,
  };
}
