import "server-only";

import { listActionItems } from "@/lib/db/queries/action-items";
import { getWorkspaceName } from "@/lib/db/queries/company";
import { listDemoCapabilities } from "@/lib/db/queries/readiness";
import { getTenderDetail } from "@/lib/db/queries/tenders";
import { FIELD_STATUSES, type FieldStatus } from "@/lib/db/vocab";
import { buildActionPlan, mergeSaved, planFinding, planProgress, type PlanField, type PlanRow } from "@/lib/plan/build";
import { isWithdrawnByAddendum, matchRequirements } from "@/lib/readiness/match";

const STATUSES = new Set<string>(FIELD_STATUSES);

export interface PrintablePlan {
  tenderId: string;
  title: string;
  organization: string | null;
  reference: string | null;
  rows: PlanRow[];
  finding: string;
  progressLabel: string;
}

function asStatus(value: string): FieldStatus {
  return STATUSES.has(value) ? (value as FieldStatus) : "needs_human";
}

/** The same plan as the tender page, without writing readiness back. */
export async function loadPrintablePlan(tenderId: string): Promise<PrintablePlan | null> {
  const [detail, workspaceName, saved, capabilities] = await Promise.all([
    getTenderDetail(tenderId),
    getWorkspaceName(),
    listActionItems(tenderId),
    listDemoCapabilities(),
  ]);
  if (!detail) return null;

  const roles = new Map(detail.sources.map((source) => [source.id, source.role]));
  const roleOf = (sourceId: string | null): "main" | "addendum" =>
    sourceId && roles.get(sourceId) === "addendum" ? "addendum" : "main";
  const fields: PlanField[] = detail.fields.map((field) => ({
    key: field.key,
    value: field.value,
    status: asStatus(field.status),
    pageNo: field.page_no,
    role: roleOf(field.source_id),
    ordinal: field.ordinal,
  }));
  const changes = detail.fields.flatMap((field) =>
    field.key === "addendum_change" && field.value ? [field.value] : [],
  );
  const readiness = matchRequirements(
    detail.fields.flatMap((field) => {
      if (field.key !== "mandatory_requirement" || !field.value || roleOf(field.source_id) !== "main") return [];
      if (isWithdrawnByAddendum(field.value, changes)) return [];
      return [{ text: field.value, category: "mandatory" as const, pageNo: field.page_no, quote: field.quote }];
    }),
    capabilities,
    undefined,
    workspaceName,
  );
  const plan = buildActionPlan({
    requirements: readiness.items.map((item) => ({
      text: item.text,
      pageNo: item.pageNo,
      match: item.match,
      expired: item.expired,
      documentName: item.capabilityName,
    })),
    fields,
    deadlineAt: detail.opportunity.deadline_at,
    asOf: new Date(),
  });
  const rows = mergeSaved(plan, saved);
  return {
    tenderId: detail.opportunity.id,
    title: detail.opportunity.title,
    organization: detail.opportunity.organization,
    reference: detail.opportunity.reference,
    rows,
    finding: planFinding(plan),
    progressLabel: planProgress(rows).label,
  };
}
