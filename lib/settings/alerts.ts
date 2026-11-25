import { documentIsExpired } from "@/lib/company/papers";
import { sentenceCase } from "@/lib/format/display";
import type { NextAction, OverviewTender } from "@/lib/overview/build";
import { daysUntilDeadline } from "@/lib/recommendation/deadline";
import type { WorkspaceSettings } from "@/lib/settings/schema";

/**
 * Settings → Alerts. Shown in "Your next actions" on Overview. They are on-screen only:
 * BidLens never sends an email or a message.
 */

function isoDayNumber(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

export function closingSoonLabel(days: number): string {
  if (days === 0) return "Closes today";
  return `Closes in ${days} ${days === 1 ? "day" : "days"}`;
}

export function settingsAlerts(input: {
  tenders: readonly OverviewTender[];
  documents: readonly { holding: string; expiresOn: string | null; neverExpires: boolean }[];
  settings: Pick<
    WorkspaceSettings,
    "alertClosing" | "alertClosingDays" | "alertDocuments" | "alertDocumentsDays"
  >;
  asOf: Date;
  /** Today in Nairobi, YYYY-MM-DD. */
  today: string;
}): NextAction[] {
  const items: NextAction[] = [];
  const { settings } = input;

  if (settings.alertClosing) {
    const due = input.tenders
      .flatMap((tender) => {
        if (tender.finalLabel === "consider_declining") return [];
        const days = daysUntilDeadline({ deadlineAt: tender.deadlineAt, closingText: tender.closing, asOf: input.asOf });
        return days !== null && days >= 0 && days <= settings.alertClosingDays ? [{ tender, days }] : [];
      })
      .sort((a, b) => a.days - b.days);
    for (const { tender, days } of due) {
      items.push({
        id: `${tender.id}:closing`,
        title: closingSoonLabel(days),
        detail: sentenceCase(tender.title),
        href: `/tenders/${tender.id}`,
        tone: "warning",
      });
    }
  }

  if (settings.alertDocuments) {
    const today = isoDayNumber(input.today);
    const expiring =
      today === null
        ? 0
        : input.documents.filter((document) => {
            if (document.holding !== "have" || document.neverExpires || !document.expiresOn) return false;
            if (documentIsExpired(document.expiresOn, input.today)) return false;
            const day = isoDayNumber(document.expiresOn);
            return day !== null && day - today <= settings.alertDocumentsDays;
          }).length;
    if (expiring > 0) {
      items.push({
        id: "documents:expiring",
        title: "Company documents expire soon",
        detail: `${expiring} ${expiring === 1 ? "document expires" : "documents expire"} within ${settings.alertDocumentsDays} days`,
        href: "/evidence",
        tone: "warning",
      });
    }
  }

  return items;
}
