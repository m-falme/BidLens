import { describe, expect, it } from "vitest";
import { z } from "zod";

import { addendumChangeItemSchema, evidenceItemSchema, groupOutputSchema } from "@/lib/ai/schemas";
import { ADDENDUM_FIELD_GROUPS, MAIN_FIELD_GROUPS } from "@/lib/tenders/field-catalog";

const item = { value: "120 days", page: 27, quote: "The Tender validity period shall be 120 days.", confidence: 0.9 };
const group = (id: string) => [...MAIN_FIELD_GROUPS, ...ADDENDUM_FIELD_GROUPS].find((g) => g.id === id)!;

describe("evidence item schema", () => {
  it("accepts a value with page, quote and confidence, and an all-null 'not found' item", () => {
    expect(evidenceItemSchema.parse(item)).toEqual(item);
    expect(evidenceItemSchema.safeParse({ value: null, page: null, quote: null, confidence: 0 }).success).toBe(true);
  });

  it("rejects out-of-range confidence, invalid pages and missing evidence keys", () => {
    expect(evidenceItemSchema.safeParse({ ...item, confidence: 1.2 }).success).toBe(false);
    expect(evidenceItemSchema.safeParse({ ...item, confidence: -0.1 }).success).toBe(false);
    expect(evidenceItemSchema.safeParse({ ...item, page: 0 }).success).toBe(false);
    expect(evidenceItemSchema.safeParse({ ...item, page: 2.5 }).success).toBe(false);
    const withoutQuote: Partial<typeof item> = { ...item };
    delete withoutQuote.quote;
    expect(evidenceItemSchema.safeParse(withoutQuote).success).toBe(false);
  });

  it("requires an addendum change to name the field it affects from the catalog", () => {
    expect(addendumChangeItemSchema.safeParse({ ...item, affects: "mandatory_requirement" }).success).toBe(true);
    expect(addendumChangeItemSchema.safeParse({ ...item, affects: "price" }).success).toBe(false);
  });
});

describe("group output schema", () => {
  it("has exactly one item per scalar key", () => {
    const schema = groupOutputSchema(group("submission"));
    const valid = { closing_datetime: item, submission_method: item, tender_validity: item, bid_security: item };
    expect(schema.safeParse(valid).success).toBe(true);
    const missingKey: Partial<typeof valid> = { ...valid };
    delete missingKey.tender_validity;
    expect(schema.safeParse(missingKey).success).toBe(false);
  });

  it("rejects keys outside the group, so the model cannot add fields or set a status", () => {
    const schema = groupOutputSchema(group("securities"));
    const valid = { performance_security: item };
    expect(schema.safeParse({ ...valid, unit_price: item }).success).toBe(false);
    const withStatus = { performance_security: { ...item, status: "source_confirmed" } };
    expect(schema.safeParse(withStatus).success).toBe(true);
    // A model-supplied status is stripped by zod's default object parsing, never passed through.
    const parsed = schema.parse(withStatus) as Record<string, Record<string, unknown>>;
    expect(parsed.performance_security).not.toHaveProperty("status");
  });

  it("takes a list per list key, empty allowed, without maxItems (Gemini rejects that keyword)", () => {
    const schema = groupOutputSchema(group("mandatory"));
    expect(schema.safeParse({ mandatory_requirement: [] }).success).toBe(true);
    expect(schema.safeParse({ mandatory_requirement: [item, item] }).success).toBe(true);
    expect(schema.safeParse({ mandatory_requirement: Array(61).fill(item) }).success).toBe(true);
    expect(schema.safeParse({ mandatory_requirement: item }).success).toBe(false);
    const json = JSON.stringify(z.toJSONSchema(schema));
    expect(json).not.toContain("maxItems");
    expect(json).toContain('"additionalProperties":false');
  });
});
