import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

/** One tender notice, as the Find agent needs it. Extra columns in the source file are ignored. */
export const tenderSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  title: z.string().min(1),
  buyer: z.string().min(1),
  county: z.string().nullable(),
  location: z.string().nullable(),
  sector: z.string().nullable(),
  category: z.string().nullable(),
  procurement_method: z.string().nullable(),
  estimated_value_kes: z.number().nullable(),
  published_on: z.string().nullable(),
  closing_datetime: z.string().min(1),
  submission_method: z.string().nullable(),
  eligibility: z.array(z.string()),
  reserved_for_agpo: z.string().nullable(),
  description: z.string(),
});
export type Tender = z.infer<typeof tenderSchema>;

/** Where tenders come from. The ranking and the page only know this interface, so a source can be swapped. */
export interface TenderSource {
  /** Short text shown on screen, e.g. "sample dataset (60 tenders)". */
  describe(tenders: readonly Tender[]): string;
  fetchTenders(): Promise<Tender[]>;
}

export const SAMPLE_TENDERS_PATH = path.join("data", "sample-tenders", "tenders.json");

/** The 60 fictional notices in data/sample-tenders. */
export class SampleTenderSource implements TenderSource {
  constructor(private readonly file: string = path.join(process.cwd(), SAMPLE_TENDERS_PATH)) {}

  describe(tenders: readonly Tender[]): string {
    return `sample dataset (${tenders.length} tenders)`;
  }

  async fetchTenders(): Promise<Tender[]> {
    const text = (await readFile(this.file, "utf8")).replace(/^﻿/, "");
    return z.array(tenderSchema).parse(JSON.parse(text));
  }
}
