import "server-only";

import { getConfiguredModel } from "@/lib/ai/client";
import { EXTRACT_TENDER_PROMPT_VERSION } from "@/lib/ai/prompts/extract-tender.v1";
import {
  completeExtractionRun,
  failExtractionRun,
  failStaleRuns,
  getSourcePages,
  listPdfSources,
  startExtractionRun,
  updateOpportunityHeadline,
} from "@/lib/db/queries/tenders";

import { extractTenderFields } from "./extract-pipeline";

export type SourceRunOutcome =
  | { sourceId: string; name: string; outcome: "extracted"; fields: number; failedGroups: string[] }
  | { sourceId: string; name: string; outcome: "skipped"; reason: string }
  | { sourceId: string; name: string; outcome: "failed"; error: string };

/**
 * Extracts every PDF source of a tender that has no running or successful run yet. Main
 * document and addenda run in parallel; each source's run is recorded whatever happens.
 */
export async function runTenderExtraction(opportunityId: string): Promise<SourceRunOutcome[]> {
  const sources = await listPdfSources(opportunityId);
  const configured = getConfiguredModel();

  return Promise.all(
    sources.map(async (source): Promise<SourceRunOutcome> => {
      const base = { sourceId: source.id, name: source.original_name };
      await failStaleRuns(source.id);
      const runId = await startExtractionRun({
        sourceId: source.id,
        provider: configured.provider,
        model: configured.modelId,
        promptVersion: EXTRACT_TENDER_PROMPT_VERSION,
      });
      if (!runId) return { ...base, outcome: "skipped", reason: "already extracted or in progress" };

      try {
        const pages = await getSourcePages(source.id);
        if (!pages.some((p) => !p.is_scanned)) {
          const error = "This PDF has no text layer (scanned pages). OCR is not available yet, so nothing was extracted.";
          await failExtractionRun(runId, error);
          return { ...base, outcome: "failed", error };
        }
        const result = await extractTenderFields({
          pages: pages.map((p) => ({ pageNo: p.page_no, text: p.text, needsOcr: p.is_scanned })),
          role: source.role,
          documentLabel: `${source.original_name} (${source.role === "addendum" ? "addendum" : "main tender document"})`,
          model: configured.model,
        });
        const failedGroups = Object.entries(result.groups)
          .filter(([, g]) => !g.ok)
          .map(([id]) => id);
        if (failedGroups.length === Object.keys(result.groups).length) {
          const firstError = Object.values(result.groups).find((g) => g.error)?.error ?? "unknown error";
          await failExtractionRun(runId, `Every field group failed. First error: ${firstError}`, result.groups);
          return { ...base, outcome: "failed", error: firstError };
        }
        await completeExtractionRun({
          runId,
          opportunityId,
          sourceId: source.id,
          fields: result.fields,
          stats: result.groups,
        });
        if (source.role === "main") await updateOpportunityHeadline(opportunityId, result.fields);
        return { ...base, outcome: "extracted", fields: result.fields.length, failedGroups };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await failExtractionRun(runId, message).catch(() => undefined);
        return { ...base, outcome: "failed", error: message };
      }
    }),
  );
}
