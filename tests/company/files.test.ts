import { describe, expect, it } from "vitest";

import {
  currentFiles,
  EVIDENCE_MAX_BYTES,
  evidenceExtension,
  evidenceFileProblem,
  evidenceTypeFromBytes,
  evidenceTypeFromName,
  fileSizeText,
} from "@/lib/company/files";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("evidence file rules", () => {
  it("accepts a PDF, PNG or JPG by name, in any case", () => {
    expect(evidenceTypeFromName("KRA tax compliance.PDF")).toBe("application/pdf");
    expect(evidenceTypeFromName("scan.png")).toBe("image/png");
    expect(evidenceTypeFromName("photo.JPEG")).toBe("image/jpeg");
    expect(evidenceTypeFromName("photo.jpg")).toBe("image/jpeg");
    expect(evidenceTypeFromName("notes.docx")).toBeNull();
    expect(evidenceTypeFromName("archive.pdf.exe")).toBeNull();
  });

  it("trusts the first bytes, not the name", () => {
    expect(evidenceTypeFromBytes(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe("application/pdf");
    expect(evidenceTypeFromBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(evidenceTypeFromBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(evidenceTypeFromBytes(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // a Windows program
    expect(evidenceTypeFromBytes(bytes())).toBeNull();
  });

  it("uses one extension per type, so a stored path says what the file is", () => {
    expect(evidenceExtension("application/pdf")).toBe("pdf");
    expect(evidenceExtension("image/png")).toBe("png");
    expect(evidenceExtension("image/jpeg")).toBe("jpg");
  });

  it("explains a refusal in plain words", () => {
    expect(evidenceFileProblem({ name: "a.pdf", size: 0 })).toBe("The file is empty.");
    expect(evidenceFileProblem({ name: "a.pdf", size: EVIDENCE_MAX_BYTES + 1 })).toBe("The file is larger than 10 MB.");
    expect(evidenceFileProblem({ name: "a.docx", size: 100 })).toBe("Upload a PDF, PNG or JPG file.");
    expect(evidenceFileProblem({ name: "a.pdf", size: EVIDENCE_MAX_BYTES })).toBeNull();
  });

  it("writes sizes people can read", () => {
    expect(fileSizeText(500)).toBe("1 KB");
    expect(fileSizeText(250 * 1024)).toBe("250 KB");
    expect(fileSizeText(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});

describe("which files still count after a removal", () => {
  const file = (id: string, capabilityId: string, createdAt: string) => ({ id, capabilityId, createdAt });

  it("shows every file, newest first, when nothing was removed", () => {
    const files = [file("a", "p1", "2026-11-01T10:00:00Z"), file("b", "p1", "2026-11-03T10:00:00Z")];
    expect(currentFiles(files, []).map((f) => f.id)).toEqual(["b", "a"]);
  });

  it("hides files uploaded before the latest removal, for that paper only", () => {
    const files = [
      file("old", "p1", "2026-11-01T10:00:00Z"),
      file("newer", "p1", "2026-11-02T10:00:00Z"),
      file("other", "p2", "2026-11-01T10:00:00Z"),
    ];
    const removals = [{ capabilityId: "p1", createdAt: "2026-11-03T10:00:00Z" }];
    expect(currentFiles(files, removals).map((f) => f.id)).toEqual(["other"]);
  });

  it("counts a file uploaded after the removal, and uses the latest of several removals", () => {
    const files = [
      file("before", "p1", "2026-11-01T10:00:00Z"),
      file("between", "p1", "2026-11-04T10:00:00Z"),
      file("after", "p1", "2026-11-09T10:00:00Z"),
    ];
    const removals = [
      { capabilityId: "p1", createdAt: "2026-11-03T10:00:00Z" },
      { capabilityId: "p1", createdAt: "2026-11-06T10:00:00Z" },
    ];
    expect(currentFiles(files, removals).map((f) => f.id)).toEqual(["after"]);
  });
});
