import type { LanguageModel } from "ai";

import { extractStructured } from "@/lib/ai/extract";
import {
  buildExtractTenderPrompt,
  EXTRACT_TENDER_INSTRUCTIONS,
  EXTRACT_TENDER_PROMPT_VERSION,
} from "@/lib/ai/prompts/extract-tender.v1";
import { groupOutputSchema, type AddendumChangeItem, type EvidenceItem, type GroupOutput } from "@/lib/ai/schemas";
import type { FieldStatus, SourceRole } from "@/lib/db/vocab";
import { createBm25Index } from "@/lib/retrieval/bm25";
import { decideFieldStatus, meaningfulValue, type StatusReason } from "@/lib/verify/field-status";

import { ADDENDUM_FIELD_GROUPS, MAIN_FIELD_GROUPS, type FieldGroup } from "./field-catalog";

/** Below this many characters the whole document fits comfortably in one call; no retrieval needed. */
export const SMALL_DOCUMENT_CHARS = 40_000;
/** A single dense page (big tables) is cut here so one page cannot crowd out the others. */
export const MAX_PAGE_CHARS = 12_000;
export const GROUP_CONCURRENCY = 3;

/**
 * The Invitation to Tender states most headline facts (reference, closing date, security,
 * address) wherever it sits in the document, so its pages go to every single-value group.
 */
const INVITATION_QUERY = "invitation to tender tender no closing date tender security accompanied submitted address";
const INVITATION_PAGES = 2;

export interface PipelinePage {
  pageNo: number;
  text: string;
  needsOcr: boolean;
}

export interface ExtractedField {
  key: string;
  groupId: string;
  /** Position within a list field; 0 for scalar fields. */
  ordinal: number;
  value: string | null;
  pageNo: number | null;
  quote: string | null;
  confidence: number;
  status: FieldStatus;
  reason: StatusReason;
  /** For addendum changes: the field key the change targets. */
  affectsKey: string | null;
}

export interface GroupStats {
  pages: number[];
  ok: boolean;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  attempts: number;
}

export interface PipelineResult {
  promptVersion: string;
  fields: ExtractedField[];
  groups: Record<string, GroupStats>;
}

export interface PipelineInput {
  pages: readonly PipelinePage[];
  role: SourceRole;
  documentLabel: string;
  model: LanguageModel;
  concurrency?: number;
}

export function fieldGroupsFor(role: SourceRole): readonly FieldGroup[] {
  return role === "addendum" ? ADDENDUM_FIELD_GROUPS : MAIN_FIELD_GROUPS;
}

/**
 * Pages to send for a group: everything for a short document; otherwise the group's pinned
 * pages plus the BM25 top-k for its query. Pages without a text layer are never sent.
 */
export function selectPages(pages: readonly PipelinePage[], groups: readonly FieldGroup[]): Map<string, number[]> {
  const textPages = pages.filter((p) => !p.needsOcr);
  const totalChars = textPages.reduce((sum, p) => sum + p.text.length, 0);
  const selection = new Map<string, number[]>();

  if (totalChars <= SMALL_DOCUMENT_CHARS) {
    for (const group of groups) selection.set(group.id, textPages.map((p) => p.pageNo));
    return selection;
  }

  const index = createBm25Index(textPages.map((p) => ({ id: p.pageNo, text: p.text })));
  const hasText = new Set(textPages.map((p) => p.pageNo));
  const invitationPages = index.search(INVITATION_QUERY, INVITATION_PAGES).map((hit) => hit.id);
  for (const group of groups) {
    const chosen = new Set(group.pinnedPages.filter((n) => hasText.has(n)));
    if (group.kind === "scalar") for (const n of invitationPages) chosen.add(n);
    for (const hit of index.search(group.query, group.topK)) {
      chosen.add(hit.id);
      if (group.withNextPage && hasText.has(hit.id + 1)) chosen.add(hit.id + 1);
    }
    selection.set(group.id, [...chosen].sort((a, b) => a - b));
  }
  return selection;
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function roundConfidence(confidence: number): number {
  return Math.round(Math.min(1, Math.max(0, confidence)) * 1000) / 1000;
}

/** Verifies one model item against the page text it cites. The model's own claims never set the status. */
function toField(
  key: string,
  groupId: string,
  ordinal: number,
  item: EvidenceItem | AddendumChangeItem,
  pageText: (pageNo: number) => string | undefined,
): ExtractedField {
  const pageNo = item.page !== null && pageText(item.page) !== undefined ? item.page : null;
  const quote = item.quote?.trim() || null;
  const decision = decideFieldStatus({ value: item.value, quote, pageText: pageNo === null ? null : pageText(pageNo) });
  return {
    key,
    groupId,
    ordinal,
    value: decision.status === "blank_in_source" ? null : meaningfulValue(item.value),
    pageNo,
    quote,
    confidence: roundConfidence(item.confidence),
    status: decision.status,
    reason: decision.reason,
    affectsKey: "affects" in item ? item.affects : null,
  };
}

function failedField(key: string, groupId: string): ExtractedField {
  return {
    key,
    groupId,
    ordinal: 0,
    value: null,
    pageNo: null,
    quote: null,
    confidence: 0,
    status: "needs_human",
    reason: "extraction_failed",
    affectsKey: null,
  };
}

/**
 * Extracts every field group of one document (main tender or addendum). Never throws on a model
 * failure: a group that fails validation twice becomes needs_human rows.
 */
export async function extractTenderFields(input: PipelineInput): Promise<PipelineResult> {
  const groups = fieldGroupsFor(input.role);
  const byPage = new Map(input.pages.map((p) => [p.pageNo, p]));
  const pageText = (pageNo: number) => byPage.get(pageNo)?.text;
  const selection = selectPages(input.pages, groups);

  const outcomes = await mapWithConcurrency(groups, input.concurrency ?? GROUP_CONCURRENCY, async (group) => {
    const pages = selection.get(group.id) ?? [];
    const stats: GroupStats = { pages, ok: false, inputTokens: 0, outputTokens: 0, latencyMs: 0, attempts: 0 };
    if (pages.length === 0) {
      return { group, stats: { ...stats, error: "no pages with a text layer" }, output: null };
    }
    const result = await extractStructured({
      model: input.model,
      schema: groupOutputSchema(group),
      instructions: EXTRACT_TENDER_INSTRUCTIONS,
      prompt: buildExtractTenderPrompt(
        group,
        input.documentLabel,
        pages.map((n) => ({ pageNo: n, text: (pageText(n) ?? "").slice(0, MAX_PAGE_CHARS) })),
      ),
      promptVersion: EXTRACT_TENDER_PROMPT_VERSION,
      label: `${group.id}@${input.documentLabel}`,
    });
    Object.assign(stats, result.usage, { ok: result.ok });
    if (!result.ok) return { group, stats: { ...stats, error: result.error }, output: null };
    return { group, stats, output: result.output as GroupOutput };
  });

  const fields: ExtractedField[] = [];
  const groupStats: Record<string, GroupStats> = {};
  for (const { group, stats, output } of outcomes) {
    groupStats[group.id] = stats;
    if (output === null) {
      for (const key of group.keys) fields.push(failedField(key, group.id));
      continue;
    }
    for (const key of group.keys) {
      const raw = output[key];
      const items = Array.isArray(raw) ? raw : [raw];
      let ordinal = 0;
      for (const item of items) {
        const field = toField(key, group.id, Array.isArray(raw) ? ordinal : 0, item, pageText);
        const empty = field.value === null && field.quote === null;
        // An empty list item is noise; an addendum not mentioning a field is not a gap in the addendum.
        if (empty && (Array.isArray(raw) || input.role === "addendum")) continue;
        fields.push(field);
        ordinal++;
      }
    }
  }

  return { promptVersion: EXTRACT_TENDER_PROMPT_VERSION, fields, groups: groupStats };
}
