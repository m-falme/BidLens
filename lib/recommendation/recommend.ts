import type { FieldStatus } from "@/lib/db/vocab";
import type { MatchedRequirement, ReadinessResult } from "@/lib/readiness/match";
import type { RiskBand } from "@/lib/risk/county-score";

import {
  type Recommendation,
  type RecommendationReason,
} from "./labels";

/**
 * Rule-based recommendation. No model call.
 * Rules are checked in order and the first match wins:
 * 1. Consider declining — a "could disqualify us" item cannot be fixed before the deadline,
 *    or payment risk is Severe and no contract value is recorded.
 * 2. Resolve blockers — a missing mandatory document or other gap can still be fixed.
 * 3. Seek clarification — deadline, security or evaluation is blank in the source or needs a person,
 *    or bid-security amounts disagree, or an addendum conflicts with the main document.
 * 4. Consider declining — the closing date has passed. This never returns Proceed.
 * 5. Proceed to preparation — none of the above.
 */

/** Deadline, security and evaluation. Other blanks do not fire the clarification rule. */
export const CLARIFICATION_KEYS = [
  "closing_datetime",
  "bid_security",
  "performance_security",
  "evaluation_criterion",
] as const;
export type ClarificationKey = (typeof CLARIFICATION_KEYS)[number];

const CLARIFICATION_KEY_SET = new Set<string>(CLARIFICATION_KEYS);

/**
 * A missing ordinary document (a bond, a tax paper) is treated as fixable when at least
 * this many days remain. Fewer days, or no confirmed deadline, is not enough time to show.
 */
export const FIXABLE_LEAD_DAYS = 7;

/**
 * A licence, certification, audited history or experience record the company does not hold
 * cannot be created for this bid, however many days remain.
 */
const SLOW_TO_OBTAIN =
  /\bnca\b|national construction authority|\bicta\b|ict authority|\bccie\b|cisco certified|communications authority|unified licen|audited (accounts|financial)|turnover of|similar (works|work|contracts|contract|projects|project)|years? of experience|reference sites?/i;

const BAND_WORD: Record<Exclude<RiskBand, "unknown">, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

export interface KeyFact {
  key: string;
  status: FieldStatus;
  /** Screen name, e.g. "Closing date and time". */
  label: string;
  /** The extracted line, or the label when the line is empty. */
  item: string;
}

export interface RecommendationInput {
  readiness: ReadinessResult;
  facts: readonly KeyFact[];
  band: RiskBand | null;
  /** Saved contract value. Null when the team has not entered one. */
  contractValueKes: number | null;
  /** Whole days until the deadline. Null when no deadline is confirmed. Negative when it has passed. */
  daysUntilDeadline: number | null;
  /** The main document states two different bid-security amounts. */
  securityConflict?: boolean;
  /** Addendum lines that disagree with the main document. */
  addendumConflicts?: number;
}

export function isClarificationKey(key: string): key is ClarificationKey {
  return CLARIFICATION_KEY_SET.has(key);
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 110) return flat;
  return `${flat.slice(0, 109)}…`;
}

function dayWord(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** A "could disqualify us" line that cannot be put right before the deadline. */
export function cannotFixBeforeDeadline(item: MatchedRequirement, daysUntilDeadline: number | null): boolean {
  if (!item.disqualifying) return false;
  if (SLOW_TO_OBTAIN.test(item.text)) return true;
  return daysUntilDeadline === null || daysUntilDeadline < FIXABLE_LEAD_DAYS;
}

function deadlineSentence(days: number | null): string {
  if (days === null) return "No closing date is confirmed, so there is no time shown to obtain it.";
  if (days < 0) return "The deadline has passed.";
  return `Only ${dayWord(days)} remain before the deadline.`;
}

function declining(blocked: readonly MatchedRequirement[], days: number | null): Recommendation {
  const reasons: RecommendationReason[] = blocked.slice(0, 3).map((item) => ({
    text: `${snippet(item.text)} could disqualify us and cannot be fixed before the deadline.`,
    item: item.text,
  }));
  const slow = blocked.find((item) => SLOW_TO_OBTAIN.test(item.text));
  if (reasons.length < 4 && slow && days !== null && days >= FIXABLE_LEAD_DAYS) {
    reasons.push({
      text: "A licence, certification or experience record cannot be obtained for this bid.",
      item: slow.text,
    });
  } else if (reasons.length < 4) {
    reasons.push({ text: deadlineSentence(days), item: "Closing date" });
  }
  return { label: "consider_declining", rule: "unfixable_disqualifier", reasons: reasons.slice(0, 4) };
}

function severeWithoutValue(): Recommendation {
  return {
    label: "consider_declining",
    rule: "severe_without_value",
    reasons: [
      { text: "Payment risk is Severe.", item: "Payment risk" },
      {
        text: "No contract value is recorded, so profit if payment is late cannot be measured.",
        item: "Contract value",
      },
    ],
  };
}

function blockers(gaps: readonly MatchedRequirement[], days: number | null): Recommendation {
  const reasons: RecommendationReason[] = gaps.slice(0, 3).map((item) => ({
    text:
      item.match === "unclear"
        ? `${snippet(item.text)} is not clearly covered and can be resolved before the deadline.`
        : `${snippet(item.text)} is missing and can be fixed before the deadline.`,
    item: item.text,
  }));
  if (reasons.length < 4 && days !== null && days >= FIXABLE_LEAD_DAYS) {
    reasons.push({
      text: `The deadline is ${dayWord(days)} away, so these can still be fixed.`,
      item: "Closing date",
    });
  }
  if (reasons.length < 2) {
    reasons.push({
      text: "This gap can be fixed before submission.",
      item: gaps[0]?.text ?? "Mandatory requirements",
    });
  }
  return { label: "resolve_blockers", rule: "fixable_gaps", reasons: reasons.slice(0, 4) };
}

function conflictReasons(input: RecommendationInput): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  if (input.securityConflict) {
    reasons.push({
      text: "Bid security amounts disagree in this tender.",
      item: "Bid security",
    });
  }
  const count = input.addendumConflicts ?? 0;
  if (count > 0) {
    reasons.push({
      text:
        count === 1
          ? "An addendum conflicts with the main document."
          : `${count} addendum conflicts still need a decision.`,
      item: "Addendum",
    });
  }
  return reasons;
}

function deadlinePassed(): Recommendation {
  return {
    label: "consider_declining",
    rule: "deadline_passed",
    reasons: [
      { text: "Closing date has passed.", item: "Closing date" },
      { text: "A closed tender is not taken forward to preparation.", item: "Closing date" },
    ],
  };
}

function clarification(facts: readonly KeyFact[]): Recommendation {
  const reasons: RecommendationReason[] = facts.slice(0, 4).map((fact) => ({
    text:
      fact.status === "blank_in_source"
        ? `${fact.label} is blank in the source.`
        : `${fact.label} needs a person to check.`,
    item: fact.item,
  }));
  if (reasons.length === 1 && facts[0]) {
    reasons.push({
      text: `Ask the buyer to confirm ${facts[0].label.toLowerCase()} before preparation.`,
      item: facts[0].item,
    });
  }
  return { label: "seek_clarification", rule: "unclear_key_facts", reasons: reasons.slice(0, 4) };
}

function proceed(input: RecommendationInput): Recommendation {
  const reasons: RecommendationReason[] = [
    {
      text: "Nothing on the mandatory list is marked could disqualify us.",
      item: "Mandatory requirements",
    },
    {
      text: "Deadline, security and evaluation are not blank and do not need a person to check.",
      item: "Closing date, bid security, evaluation",
    },
  ];
  if (input.band && input.band !== "unknown") {
    reasons.push({
      text:
        input.band === "severe"
          ? "Payment risk is Severe, and a contract value is recorded."
          : `Payment risk is ${BAND_WORD[input.band]}.`,
      item: "Payment risk",
    });
  }
  if (input.readiness.toPrepare > 0) {
    const count = input.readiness.toPrepare;
    reasons.push({
      text: `${count} form${count === 1 ? "" : "s"} still to fill in and sign before submission.`,
      item: "Forms to prepare",
    });
  }
  return { label: "proceed_to_preparation", rule: "clear", reasons: reasons.slice(0, 4) };
}

function isOpenGap(item: MatchedRequirement): boolean {
  return item.match === "missing" || item.match === "unclear";
}

export function recommend(input: RecommendationInput): Recommendation {
  const blocked = input.readiness.items.filter((item) => cannotFixBeforeDeadline(item, input.daysUntilDeadline));
  if (blocked.length > 0) return declining(blocked, input.daysUntilDeadline);

  const hasValue = input.contractValueKes !== null && input.contractValueKes > 0;
  if (input.band === "severe" && !hasValue) return severeWithoutValue();

  const gaps = input.readiness.items.filter(
    (item) => isOpenGap(item) && !cannotFixBeforeDeadline(item, input.daysUntilDeadline),
  );
  if (gaps.length > 0) return blockers(gaps, input.daysUntilDeadline);

  const unclear = input.facts.filter(
    (fact) =>
      isClarificationKey(fact.key) && (fact.status === "blank_in_source" || fact.status === "needs_human"),
  );
  const conflicts = conflictReasons(input);
  if (unclear.length > 0) {
    const result = clarification(unclear);
    return { ...result, reasons: [...result.reasons, ...conflicts].slice(0, 4) };
  }
  if (conflicts.length > 0) {
    return { label: "seek_clarification", rule: "document_conflict", reasons: conflicts.slice(0, 4) };
  }

  if (input.daysUntilDeadline !== null && input.daysUntilDeadline < 0) return deadlinePassed();

  return proceed(input);
}
