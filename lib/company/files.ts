/** Rules for the file a company uploads as evidence. Pure, so the browser and the server agree. */

export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export const EVIDENCE_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

const EXTENSION: Record<EvidenceType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

const BY_NAME: readonly [RegExp, EvidenceType][] = [
  [/\.pdf$/i, "application/pdf"],
  [/\.png$/i, "image/png"],
  [/\.(jpe?g)$/i, "image/jpeg"],
];

export const EVIDENCE_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
export const EVIDENCE_HELP = "PDF, PNG or JPG, up to 10 MB.";

export function evidenceExtension(type: EvidenceType): string {
  return EXTENSION[type];
}

/** The type named by the file name. The bytes are checked again after upload. */
export function evidenceTypeFromName(fileName: string): EvidenceType | null {
  return BY_NAME.find(([pattern]) => pattern.test(fileName))?.[1] ?? null;
}

/** The type the first bytes prove, whatever the file is called. */
export function evidenceTypeFromBytes(bytes: Uint8Array): EvidenceType | null {
  const starts = (magic: readonly number[]) => bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

/** A plain message, or null when the file can be uploaded. */
export function evidenceFileProblem(file: { name: string; size: number }): string | null {
  if (file.size <= 0) return "The file is empty.";
  if (file.size > EVIDENCE_MAX_BYTES) return `The file is larger than ${EVIDENCE_MAX_BYTES / 1024 / 1024} MB.`;
  if (!evidenceTypeFromName(file.name)) return "Upload a PDF, PNG or JPG file.";
  return null;
}

export function fileSizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The files that still count for a paper. A removal hides every file uploaded before it; a later upload counts
 * again. Nothing is deleted: the hidden files stay in Storage and in document_files as history.
 * Input order does not matter. Output is newest first.
 */
export function currentFiles<T extends { capabilityId: string; createdAt: string }>(
  files: readonly T[],
  removals: readonly { capabilityId: string; createdAt: string }[],
): T[] {
  const latestRemoval = new Map<string, string>();
  for (const removal of removals) {
    const seen = latestRemoval.get(removal.capabilityId);
    if (!seen || removal.createdAt > seen) latestRemoval.set(removal.capabilityId, removal.createdAt);
  }
  return files
    .filter((file) => {
      const removedAt = latestRemoval.get(file.capabilityId);
      return !removedAt || file.createdAt > removedAt;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
