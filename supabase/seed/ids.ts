import { createHash } from "node:crypto";

/** Fixed namespace for BidLens seed ids. Changing it re-keys every seeded row. */
const SEED_NAMESPACE = "3c5e8a52-6f0b-4d7e-9a41-2b8f1c7d9e60";

/**
 * Deterministic RFC 4122 v5 UUID from natural-key parts, so re-running the seed
 * targets the same rows instead of creating duplicates.
 */
export function seedId(...parts: readonly string[]): string {
  const namespace = Buffer.from(SEED_NAMESPACE.replaceAll("-", ""), "hex");
  const hash = createHash("sha1").update(namespace).update(parts.join("\u001f")).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
