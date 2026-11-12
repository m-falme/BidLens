import { extractText, getDocumentProxy } from "unpdf";

/** A page with less text than this has no usable text layer (a scan or an image) and needs OCR. */
export const SCANNED_PAGE_MIN_CHARS = 40;

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export interface ParsedPage {
  /** 1-based physical page number in the PDF (not the printed folio, which may be "iv"). */
  pageNo: number;
  text: string;
  needsOcr: boolean;
}

/** True when the bytes start with the PDF magic number, whatever the file name or MIME type claim. */
export function isPdfBytes(bytes: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  return bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
}

/** Postgres text cannot hold NUL, and some PDFs emit it inside extracted strings. */
function cleanPageText(text: string): string {
  return text.replaceAll("\u0000", "").trim();
}

/** Extracts text page by page so every quote can be checked against the page it cites. */
export async function parsePdfPages(bytes: Uint8Array): Promise<ParsedPage[]> {
  // unpdf/pdf.js may detach the buffer it is given; keep the caller's bytes intact.
  const pdf = await getDocumentProxy(bytes.slice());
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((raw, index) => {
      const pageText = cleanPageText(raw);
      return { pageNo: index + 1, text: pageText, needsOcr: pageText.length < SCANNED_PAGE_MIN_CHARS };
    });
  } finally {
    await pdf.cleanup();
  }
}
