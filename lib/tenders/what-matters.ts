import type { FieldStatus } from "@/lib/db/vocab";
import { spelledCountWithUnit } from "@/lib/format/display";

import { formatKes, valueHasAmount, type BidSecurityConflict } from "./document-conflicts";

/** A stored field, enough to write a plain point and open its evidence. */
export interface MatterField {
  id: string;
  key: string;
  value: string | null;
  status: FieldStatus;
  page_no: number | null;
  role: "main" | "addendum";
}

export interface MatterPoint {
  id: string;
  /** One or two sentences, using the tender's own wording for amounts and dates. */
  text: string;
  fieldIds: string[];
}

export const MAX_MATTER_POINTS = 5;

const RED_FLAG_KEYS = ["late_payment_interest", "performance_security"] as const;

function preferMain(fields: readonly MatterField[], key: string): MatterField | undefined {
  const main = fields.filter((field) => field.key === key && field.role === "main");
  const pool = main.length > 0 ? main : fields.filter((field) => field.key === key);
  return pool.find((field) => field.value !== null) ?? pool[0];
}

function withStop(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function stated(field: MatterField | undefined, label: string): { sentence: string; blank: boolean } | null {
  if (!field) return null;
  if (field.value) return { sentence: withStop(`${label}: ${field.value}`), blank: false };
  if (field.status === "blank_in_source") return { sentence: `${label} is left blank in the tender.`, blank: true };
  if (field.status === "needs_human") return { sentence: `${label} needs a human to check.`, blank: true };
  return null;
}

function fieldIdsForConflict(fields: readonly MatterField[], conflict: BidSecurityConflict): string[] {
  const ids: string[] = [];
  const security = preferMain(fields, "bid_security");
  if (security) ids.push(security.id);
  for (const amount of conflict.amounts) {
    const hit = fields.find(
      (field) =>
        field.role === "main" &&
        field.value !== null &&
        valueHasAmount(field.value, amount.amountKes) &&
        !ids.includes(field.id),
    );
    if (hit) ids.push(hit.id);
  }
  return ids.slice(0, 3);
}

/**
 * At most five plain points for the top of a tender page: closing, bid security
 * (including an in-document amount conflict), advance and payment period, blank
 * payment clauses, and how many fields need a human. Built only from stored fields.
 */
export function buildWhatMatters(input: {
  fields: readonly MatterField[];
  conflict: BidSecurityConflict | null;
  needsHuman: number;
  addendumConflicts: number;
}): MatterPoint[] {
  const points: MatterPoint[] = [];
  const { fields } = input;

  const closing = stated(preferMain(fields, "closing_datetime"), "Closing date");
  if (closing) {
    const field = preferMain(fields, "closing_datetime")!;
    points.push({ id: "closing", text: closing.sentence, fieldIds: [field.id] });
  }

  if (input.conflict) {
    const sides = input.conflict.amounts.map(
      (amount) => `page ${amount.pageNo} says KSh ${formatKes(amount.amountKes)}`,
    );
    points.push({
      id: "bid-security",
      text: `Bid security disagrees inside this document: ${sides.join(", and ")}.`,
      fieldIds: fieldIdsForConflict(fields, input.conflict),
    });
  } else {
    const security = stated(preferMain(fields, "bid_security"), "Bid security");
    if (security) {
      const field = preferMain(fields, "bid_security")!;
      points.push({ id: "bid-security", text: security.sentence, fieldIds: [field.id] });
    }
  }

  const advance = stated(preferMain(fields, "advance_payment"), "Advance payment");
  const daysField = preferMain(fields, "payment_days");
  const days = stated(
    daysField?.value ? { ...daysField, value: spelledCountWithUnit(daysField.value, "days") } : daysField,
    "Payment period",
  );
  const paymentParts = [advance, days].filter((part) => part !== null);
  if (paymentParts.length > 0) {
    points.push({
      id: "payment",
      text: paymentParts.map((part) => part.sentence).join(" "),
      fieldIds: [preferMain(fields, "advance_payment"), preferMain(fields, "payment_days")]
        .filter((field) => field !== undefined)
        .map((field) => field.id),
    });
  }

  const redFlags = RED_FLAG_KEYS.map((key) => stated(preferMain(fields, key), labelFor(key))).filter(
    (part): part is { sentence: string; blank: boolean } => part !== null && part.blank,
  );
  if (redFlags.length > 0) {
    const interest = redFlags.find((part) => part.sentence.startsWith("Late-payment"));
    const lead = interest
      ? "Late-payment interest is left blank, so the tender does not say what the buyer pays if it pays late."
      : redFlags[0].sentence;
    const rest = redFlags
      .map((part) => part.sentence)
      .filter((sentence) => sentence !== interest?.sentence && sentence !== lead);
    points.push({
      id: "red-flags",
      text: [lead, ...rest].join(" "),
      fieldIds: RED_FLAG_KEYS.map((key) => preferMain(fields, key))
        .filter((field): field is MatterField => field !== undefined && field.value === null)
        .map((field) => field.id),
    });
  }

  const review: string[] = [];
  if (input.needsHuman > 0) {
    review.push(
      `${input.needsHuman} extracted field${input.needsHuman === 1 ? "" : "s"} need${input.needsHuman === 1 ? "s" : ""} a human to check`,
    );
  }
  if (input.addendumConflicts > 0) {
    const count = input.addendumConflicts;
    review.push(
      `${count} addendum conflict${count === 1 ? "" : "s"} still ${count === 1 ? "needs" : "need"} a decision`,
    );
  }
  if (review.length > 0) points.push({ id: "review", text: `${review.join(", and ")}.`, fieldIds: [] });

  return points.slice(0, MAX_MATTER_POINTS);
}

function labelFor(key: (typeof RED_FLAG_KEYS)[number]): string {
  return key === "late_payment_interest" ? "Late-payment interest" : "Performance security";
}
