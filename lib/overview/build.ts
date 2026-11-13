import { documentIsExpired } from "@/lib/company/papers";
import { sentenceCase } from "@/lib/format/display";
import { closingHasPassed, daysUntilDeadline } from "@/lib/recommendation/deadline";
import { RECOMMENDATION_LABEL, type RecommendationLabel } from "@/lib/recommendation/labels";
import type { ReviewStage } from "@/lib/tenders/stage-review";

/** Initials from the company name. There is no person on the profile. */
export function profileInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /[A-Za-z]/.test(word));
  const letter = (word: string) => word.match(/[A-Za-z]/)?.[0] ?? "";
  if (words.length === 0) return "BT";
  if (words.length === 1) {
    const letters = words[0].match(/[A-Za-z]/g) ?? [];
    return (letters[0] + (letters[1] ?? "")).toUpperCase();
  }
  return (letter(words[0]) + letter(words[1])).toUpperCase();
}

export function nairobiDate(asOf: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
}

export interface OverviewTender {
  id: string;
  title: string;
  buyer: string | null;
  reference: string | null;
  closing: string | null;
  deadlineAt: string | null;
  needsHuman: number;
  missingMandatory: number;
  addendumConflicts: number;
  finalLabel: RecommendationLabel | null;
  /** Stages that have at least one saved review. */
  reviewedStages: readonly ReviewStage[];
}

/** Uploaded tenders whose closing date is still today or ahead. A past date is not active. */
export function activeTenderStats(
  tenders: readonly OverviewTender[],
  asOf: Date,
): { total: number; unreviewed: number } {
  const open = tenders.filter(
    (tender) => !closingHasPassed({ closingText: tender.closing, deadlineAt: tender.deadlineAt, asOf }),
  );
  return {
    total: open.length,
    unreviewed: open.filter((tender) => tender.reviewedStages.length === 0).length,
  };
}

export function activeReviewNote(unreviewed: number, total: number): string {
  if (total === 0) return "No uploaded tenders";
  if (unreviewed === 0) return "Each one has a review";
  return `${unreviewed} with no review yet`;
}

export function awaitingDecisionNote(count: number): string {
  if (count === 0) return "Every uploaded tender has a decision";
  return "No bid decision recorded";
}

export interface EvidenceCounts {
  onFile: number;
  expired: number;
}

/** Have is on file. Expired is a Have whose date is before today, and not marked Does not expire. */
export function evidenceCounts(
  documents: readonly { holding: string; expiresOn: string | null; neverExpires: boolean }[],
  asOf: string,
): EvidenceCounts {
  const onFile = documents.filter((document) => document.holding === "have");
  const expired = onFile.filter(
    (document) => !document.neverExpires && documentIsExpired(document.expiresOn, asOf),
  ).length;
  return { onFile: onFile.length, expired };
}

export function evidenceNote(expired: number): string {
  if (expired === 0) return "None past the expiry date";
  return `${expired} past the expiry date`;
}

export interface DeadlineStat {
  value: string;
  note: string;
}

export function upcomingDeadline(tenders: readonly OverviewTender[], asOf: Date): DeadlineStat {
  const dated = tenders.flatMap((tender) => {
    const days = daysUntilDeadline({
      deadlineAt: tender.deadlineAt,
      closingText: tender.closing,
      asOf,
    });
    if (days === null) return [];
    return [{ tender, days }];
  });
  if (dated.length === 0) {
    return { value: "Not stated", note: "No uploaded tender states a closing date" };
  }
  const upcoming = dated.filter((row) => row.days >= 0).sort((a, b) => a.days - b.days);
  const chosen = upcoming[0] ?? [...dated].sort((a, b) => b.days - a.days)[0];
  const buyer = chosen.tender.buyer?.trim() ? sentenceCase(chosen.tender.buyer) : "Buyer not stated";
  const when = chosen.tender.closing?.trim() || "Date not stated";
  const note = `${buyer} · ${when}`;
  if (chosen.days < 0) return { value: "Closed", note };
  if (chosen.days === 0) return { value: "Today", note };
  return { value: `${chosen.days} ${chosen.days === 1 ? "day" : "days"}`, note };
}

export interface RowPill {
  label: string;
  tone: "confirmed" | "warning" | "blocker" | "neutral";
}

/** A saved decision, otherwise the first stage that has no review yet. */
export function rowPill(tender: OverviewTender): RowPill {
  if (tender.finalLabel === "proceed_to_preparation") {
    return { label: RECOMMENDATION_LABEL.proceed_to_preparation, tone: "confirmed" };
  }
  if (tender.finalLabel === "consider_declining") {
    return { label: RECOMMENDATION_LABEL.consider_declining, tone: "blocker" };
  }
  if (tender.finalLabel) {
    return { label: RECOMMENDATION_LABEL[tender.finalLabel], tone: "warning" };
  }
  if (!tender.reviewedStages.includes("can_bid")) return { label: "Interpretation", tone: "warning" };
  if (!tender.reviewedStages.includes("can_comply")) return { label: "Compliance", tone: "warning" };
  if (!tender.reviewedStages.includes("should_bid")) return { label: "Commercial", tone: "warning" };
  return { label: "Recommendation", tone: "neutral" };
}

export interface NextAction {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "warning" | "neutral";
}

const NEXT_ACTION_LIMIT = 8;

export function nextActions(tenders: readonly OverviewTender[]): { items: NextAction[]; more: number } {
  const items: NextAction[] = [];
  for (const tender of tenders) {
    const name = sentenceCase(tender.title);
    if (tender.addendumConflicts > 0) {
      const count = tender.addendumConflicts;
      items.push({
        id: `${tender.id}:conflict`,
        title: "Resolve an addendum conflict",
        detail: `${name} · ${count} conflict${count === 1 ? "" : "s"}`,
        href: `/tenders/${tender.id}#can_bid`,
        tone: "warning",
      });
    }
    if (tender.needsHuman > 0) {
      const count = tender.needsHuman;
      items.push({
        id: `${tender.id}:human`,
        title: "Check facts that need a person",
        detail: `${name} · ${count} fact${count === 1 ? "" : "s"}`,
        href: `/tenders/${tender.id}#can_bid`,
        tone: "warning",
      });
    }
    if (tender.missingMandatory > 0) {
      const count = tender.missingMandatory;
      items.push({
        id: `${tender.id}:docs`,
        title: "Missing mandatory documents",
        detail: `${name} · ${count} document${count === 1 ? "" : "s"}`,
        href: `/tenders/${tender.id}#can_comply`,
        tone: "warning",
      });
    }
    if (!tender.finalLabel) {
      items.push({
        id: `${tender.id}:decision`,
        title: "Record a bid decision",
        detail: name,
        href: `/tenders/${tender.id}#should_bid`,
        tone: "neutral",
      });
    }
  }
  return { items: items.slice(0, NEXT_ACTION_LIMIT), more: Math.max(0, items.length - NEXT_ACTION_LIMIT) };
}

export interface ActivityRow {
  id: string;
  at: string;
  what: string;
  detail: string;
  href: string;
}

const STAGE_REVIEWED: Record<ReviewStage, string> = {
  can_bid: "Interpretation reviewed",
  can_comply: "Compliance reviewed",
  should_bid: "Commercial reviewed",
};

export function teamActivity(input: {
  reviews: readonly { tenderId: string; stage: ReviewStage; reviewerName: string; createdAt: string }[];
  decisions: readonly {
    tenderId: string;
    action: "approve" | "override";
    finalLabel: RecommendationLabel;
    reviewerName: string;
    createdAt: string;
  }[];
  titles: ReadonlyMap<string, string>;
  when: (iso: string) => string;
}): ActivityRow[] {
  const rows: { at: string; row: ActivityRow }[] = [];
  for (const review of input.reviews) {
    const title = input.titles.get(review.tenderId);
    if (!title) continue;
    rows.push({
      at: review.createdAt,
      row: {
        id: `review:${review.tenderId}:${review.stage}:${review.createdAt}`,
        at: review.createdAt,
        what: STAGE_REVIEWED[review.stage],
        detail: `${sentenceCase(title)} · ${review.reviewerName} · ${input.when(review.createdAt)}`,
        href: `/tenders/${review.tenderId}`,
      },
    });
  }
  for (const decision of input.decisions) {
    const title = input.titles.get(decision.tenderId);
    if (!title) continue;
    const label = RECOMMENDATION_LABEL[decision.finalLabel];
    rows.push({
      at: decision.createdAt,
      row: {
        id: `decision:${decision.tenderId}:${decision.createdAt}`,
        at: decision.createdAt,
        what:
          decision.action === "approve"
            ? `Approved ${label}`
            : `Overrode the recommendation to ${label}`,
        detail: `${sentenceCase(title)} · ${decision.reviewerName} · ${input.when(decision.createdAt)}`,
        href: `/tenders/${decision.tenderId}`,
      },
    });
  }
  return rows
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 5)
    .map((entry) => entry.row);
}
