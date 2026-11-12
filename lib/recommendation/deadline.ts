/**
 * Days from today until the tender deadline, in the Nairobi calendar.
 * A stored timestamp wins. Otherwise the closing line is read when it contains a day, month and year.
 */

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function daysUntilDeadline(input: {
  deadlineAt: string | null;
  closingText: string | null;
  asOf: Date;
}): number | null {
  const instant = parseInstant(input.deadlineAt) ?? parseClosingText(input.closingText);
  if (!instant) return null;
  return nairobiDayNumber(instant) - nairobiDayNumber(input.asOf);
}

function parseInstant(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "20 November 2026", "20th November, 2026", "23RD NOVEMBER, 2026". */
export function parseClosingText(text: string | null): Date | null {
  if (!text) return null;
  const match = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/i);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (month === undefined || day < 1 || day > 31) return null;
  // Noon in Nairobi (UTC+3) so the calendar day does not slip.
  return new Date(Date.UTC(year, month, day, 9, 0, 0));
}

function nairobiDayNumber(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
