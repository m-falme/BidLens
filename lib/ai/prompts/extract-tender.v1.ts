/**
 * Prompt: extract one field group from tender pages (ARCHITECTURE §6).
 * Versioned file: change the wording only by adding extract-tender.v2.ts, so every stored
 * extraction run can be traced to the exact prompt that produced it.
 */
import { FIELD_SPECS, type FieldGroup } from "@/lib/tenders/field-catalog";

export const EXTRACT_TENDER_PROMPT_VERSION = "extract-tender.v1";

export const EXTRACT_TENDER_INSTRUCTIONS = `You extract facts from Kenyan public tender documents for a bid analyst.

Rules:
- Use only the provided pages. Never use outside knowledge and never guess.
- If a value is not present in the pages, return value null, page null and quote null.
- If the document has a clause for the value but leaves it blank (for example "The interest rate is ____" or "within ______ days"), return value null and put the blank clause in quote, with its page.
- The quote must be copied verbatim from a single page: same words, same order, no paraphrase, no ellipsis, no added punctuation. Keep it short (one sentence or table row, under 300 characters) and make sure it contains the value.
- page is the number N from the [p.N] marker of the page the quote is copied from.
- value should be copied from the quote where possible; keep amounts, currencies, dates and numbers exactly as written.
- Never invent prices, dates, certifications, contacts or requirements.
- confidence is your probability (0 to 1) that value and page are correct.`;

export interface PromptPage {
  pageNo: number;
  text: string;
}

export function buildExtractTenderPrompt(group: FieldGroup, documentLabel: string, pages: readonly PromptPage[]): string {
  const fieldLines = group.keys.map((key) => `- ${key}: ${FIELD_SPECS[key].instruction}`).join("\n");
  const shape =
    group.kind === "scalar"
      ? "Return one item for each field."
      : "Return a list of items for each field (an empty list if none are stated).";
  const pageBlocks = pages.map((p) => `[p.${p.pageNo}]\n${p.text}`).join("\n\n");

  return `Document: ${documentLabel}
Pages provided: ${pages.map((p) => p.pageNo).join(", ")} (a subset of the document, chosen by keyword search).

Fields to extract:
${fieldLines}

${shape}

${pageBlocks}`;
}
