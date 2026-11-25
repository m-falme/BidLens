import { describe, expect, it } from "vitest";

import {
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
