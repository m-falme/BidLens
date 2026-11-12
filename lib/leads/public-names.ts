/**
 * Public names for workbook leads. The stored row, quote and page stay as loaded.
 * Screens substitute these phrases so a made-up buyer never appears under a real
 * organisation's name, and never under a SIM- reference.
 * Longer phrases are replaced first so a shorter code cannot cut into a longer one.
 */
const LEAD_PUBLIC_NAMES: readonly [string, string][] = [
  ["Example County Referral Hospital", "Hillcrest County Referral Hospital"],
  ["Example Agricultural Research Agency", "Mlima Agricultural Research Institute"],
  ["Example Public Training Institute", "Savanna Public Training Institute"],
  ["Example Water Services Board", "Lakeview Water Services Board"],
  ["Example county procurement page", "County procurement notice"],
  ["Example public procurement portal", "Public procurement notice"],
  ["Example procurement body website", "Procurement notice"],
  ["Example Municipal Authority", "Stonebridge Municipal Authority"],
  ["Example agency tenders page", "Agency tenders notice"],
  ["Example e-GP listing", "Procurement listing"],
  ["SIM-TND-2026-001", "HCRH/ICT/011/2026-27"],
  ["SIM-RFP-2026-002", "LWSB/ICT/014/2026-27"],
  ["SIM-EOI-2026-003", "SPTI/ICT/008/2026-27"],
  ["SIM-TND-2026-004", "SMA/ERP/021/2026-27"],
  ["SIM-RFQ-2026-005", "MARI/RD/006/2026-27"],
  ["Demo feedback", "Follow-up meeting"],
];

export function presentLeadCopy(value: string | null): string | null {
  if (value == null || value === "") return value;
  let next = value;
  for (const [from, to] of LEAD_PUBLIC_NAMES) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

/** What a source is called on screen. The stored file name stays in the database. */
export function sourceLabel(input: { kind: string; opportunityType: "procurement" | "field" }): string {
  if (input.kind === "pdf") return "Uploaded PDF";
  if (input.opportunityType === "field") return "Field lead";
  return "Imported lead";
}
