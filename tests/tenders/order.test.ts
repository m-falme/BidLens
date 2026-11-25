import { describe, expect, it } from "vitest";

import { groupTendersByClosing } from "@/lib/tenders/order";

const AS_OF = new Date("2026-11-26T09:00:00+03:00");

function tender(id: string, closing: string | null, deadlineAt: string | null = null) {
  return { id, closing, deadlineAt };
}

describe("groupTendersByClosing", () => {
  const tenders = [
    tender("closed-old", "3rd November 2026 at 11:00 am"),
    tender("open-late", null, "2026-12-10T11:00:00+03:00"),
    tender("no-date", null),
    tender("closed-recent", "25th November 2026"),
    tender("open-soon", "30 November 2026 at 11:00 a.m."),
  ];
  const groups = groupTendersByClosing(tenders, AS_OF);

  it("puts open tenders first, then those with no date, then closed ones", () => {
    expect(groups.map((group) => group.id)).toEqual(["open", "undated", "closed"]);
    expect(groups.map((group) => group.title)).toEqual(["Open for bids", "Closing date not stated", "Closed"]);
  });

  it("orders open tenders by the soonest closing date", () => {
    expect(groups[0].items.map((item) => item.id)).toEqual(["open-soon", "open-late"]);
  });

  it("orders closed tenders with the most recently closed first", () => {
    expect(groups[2].items.map((item) => item.id)).toEqual(["closed-recent", "closed-old"]);
  });

  it("counts a tender closing today as open, and drops empty groups", () => {
    const today = groupTendersByClosing([tender("today", "26th November 2026")], AS_OF);
    expect(today.map((group) => group.id)).toEqual(["open"]);
    expect(groupTendersByClosing([], AS_OF)).toEqual([]);
  });

  it("does not change the list it is given", () => {
    expect(tenders.map((item) => item.id)).toEqual(["closed-old", "open-late", "no-date", "closed-recent", "open-soon"]);
  });
});
