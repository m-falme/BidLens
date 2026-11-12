/**
 * Shows what extraction would send to the model for a tender PDF, without calling it:
 * page count, pages needing OCR, and the pages BM25 picks for each field group.
 *
 *   npx tsx scripts/inspect-tender.mts data/tenders/<file>.pdf [--addendum]
 */
import { readFileSync } from "node:fs";

import { parsePdfPages } from "@/lib/pdf/parse";
import { fieldGroupsFor, selectPages } from "@/lib/tenders/extract-pipeline";

const file = process.argv[2];
if (!file) {
  console.error("usage: npx tsx scripts/inspect-tender.mts <file.pdf> [--addendum]");
  process.exit(1);
}
const role = process.argv.includes("--addendum") ? "addendum" : "main";
const pages = await parsePdfPages(new Uint8Array(readFileSync(file)));
const ocr = pages.filter((p) => p.needsOcr).map((p) => p.pageNo);
console.log(`${file}: ${pages.length} pages, needs OCR: ${ocr.length ? ocr.join(", ") : "none"}`);
for (const [group, picked] of selectPages(pages, fieldGroupsFor(role))) {
  const chars = picked.reduce((n, p) => n + pages[p - 1].text.length, 0);
  console.log(`  ${group.padEnd(17)} pages ${picked.join(", ")}  (${chars} chars)`);
}
