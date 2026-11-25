import { daysUntilClosing } from "@/lib/recommendation/deadline";

/**
 * The tender list, grouped by whether a bid can still be made.
 * Open: soonest closing first. Date not stated: as given (newest upload first). Closed: most recently closed first.
 */

export interface ClosingInput {
  closing: string | null;
  deadlineAt: string | null;
}

export type ClosingGroupId = "open" | "undated" | "closed";

export interface ClosingGroup<T> {
  id: ClosingGroupId;
  title: string;
  items: T[];
}

const TITLES: Record<ClosingGroupId, string> = {
  open: "Open for bids",
  undated: "Closing date not stated",
  closed: "Closed",
};

export function groupTendersByClosing<T extends ClosingInput>(items: readonly T[], asOf: Date): ClosingGroup<T>[] {
  const dated = items.map((item) => ({
    item,
    days: daysUntilClosing({ closingText: item.closing, deadlineAt: item.deadlineAt, asOf }),
  }));
  const open = dated
    .filter((row) => row.days !== null && row.days >= 0)
    .sort((a, b) => (a.days as number) - (b.days as number));
  const closed = dated
    .filter((row) => row.days !== null && row.days < 0)
    .sort((a, b) => (b.days as number) - (a.days as number));
  const undated = dated.filter((row) => row.days === null);

  const groups: ClosingGroup<T>[] = [
    { id: "open", title: TITLES.open, items: open.map((row) => row.item) },
    { id: "undated", title: TITLES.undated, items: undated.map((row) => row.item) },
    { id: "closed", title: TITLES.closed, items: closed.map((row) => row.item) },
  ];
  return groups.filter((group) => group.items.length > 0);
}
