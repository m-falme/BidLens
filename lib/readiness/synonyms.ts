/**
 * Names a tender uses for the same company paper.
 * Matching is code: the model does not decide that two lines are one document.
 */

export const DOCUMENT_SYNONYM_GROUPS = [
  { id: "bid-security", phrases: ["tender security", "bid security", "bid bond"] },
  { id: "directors", phrases: ["list of directors", "cr12", "cr 12", "cr13", "cr 13"] },
  { id: "tax-compliance", phrases: ["kra compliance certificate", "tax compliance certificate", "tax compliance"] },
] as const;

export type DocumentSynonymGroup = (typeof DOCUMENT_SYNONYM_GROUPS)[number]["id"];

const PHRASES: readonly { id: DocumentSynonymGroup; phrase: string }[] = DOCUMENT_SYNONYM_GROUPS.flatMap((group) =>
  group.phrases.map((phrase) => ({ id: group.id, phrase: normalize(phrase) })),
).sort((a, b) => b.phrase.length - a.phrase.length);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** The synonym group for this wording, or null when none of the phrases appear. */
export function documentSynonym(text: string): DocumentSynonymGroup | null {
  const haystack = ` ${normalize(text)} `;
  for (const { id, phrase } of PHRASES) {
    if (haystack.includes(` ${phrase} `)) return id;
  }
  return null;
}

/** True when both texts name the same paper, such as bid bond and tender security. */
export function sameDocument(a: string, b: string): boolean {
  const group = documentSynonym(a);
  return group !== null && group === documentSynonym(b);
}
