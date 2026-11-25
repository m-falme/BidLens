import "server-only";

import { listActionItems } from "@/lib/db/queries/action-items";
import { getWorkspaceName } from "@/lib/db/queries/company";
import { listDemoCapabilities } from "@/lib/db/queries/readiness";
import { getTenderDetail } from "@/lib/db/queries/tenders";
import { FIELD_STATUSES, type FieldStatus } from "@/lib/db/vocab";
import {
  buildActionPlan,
  mergeSaved,
  planFinding,
  planProgress,
  type PlanField,
  type PlanRow,
  type SavedAction,
} from "@/lib/plan/build";
import { isWithdrawnByAddendum, matchRequirements, type ProfileCapability } from "@/lib/readiness/match";

const STATUSES = new Set<string>(FIELD_STATUSES);

function asStatus(value: string): FieldStatus {
  return STATUSES.has(value) ? (value as FieldStatus) : "needs_human";
}

export interface PlanSourceField {
  key: string;
  value: string | null;
  status: string;
  page_no: number | null;
  source_id: string | null;
  ordinal: number;
}

/**
 * The plan for one tender, built from data that is already loaded. The tender page, the printable plan and the
 * list pages all use this, so "X of Y done" is the same number everywhere. Nothing is written.
 */
export function planFromData(input: {
  fields: readonly PlanSourceField[];
  sourceRoles: ReadonlyMap<string, string>;
  deadlineAt: string | null;
  saved: readonly SavedAction[];
  capabilities: readonly ProfileCapability[];
  workspaceName: string;
}): { rows: PlanRow[]; finding: string } {
  const roleOf = (sourceId: string | null): "main" | "addendum" =>
    sourceId && input.sourceRoles.get(sourceId) === "addendum" ? "addendum" : "main";
  const fields: PlanField[] = input.fields.map((field) => ({
    key: field.key,
    value: field.value,
    status: asStatus(field.status),
    pageNo: field.page_no,
    role: roleOf(field.source_id),
    ordinal: field.ordinal,
  }));
  const changes = input.fields.flatMap((field) =>
    field.key === "addendum_change" && field.value ? [field.value] : [],
  );
  const readiness = matchRequirements(
    input.fields.flatMap((field) => {
      if (field.key !== "mandatory_requirement" || !field.value || roleOf(field.source_id) !== "main") return [];
      if (isWithdrawnByAddendum(field.value, changes)) return [];
      return [{ text: field.value, category: "mandatory" as const, pageNo: field.page_no, quote: null }];
    }),
    input.capabilities,
    undefined,
    input.workspaceName,
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
    deadlineAt: input.deadlineAt,
    asOf: new Date(),
  });
  return { rows: mergeSaved(plan, input.saved), finding: planFinding(plan) };
}

export interface PrintablePlan {
  tenderId: string;
  title: string;
  organization: string | null;
  reference: string | null;
  rows: PlanRow[];
  finding: string;
  progressLabel: string;
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

  const { rows, finding } = planFromData({
    fields: detail.fields,
    sourceRoles: new Map(detail.sources.map((source) => [source.id, source.role])),
    deadlineAt: detail.opportunity.deadline_at,
    saved,
    capabilities,
    workspaceName,
  });
  return {
    tenderId: detail.opportunity.id,
    title: detail.opportunity.title,
    organization: detail.opportunity.organization,
    reference: detail.opportunity.reference,
    rows,
    finding,
    progressLabel: planProgress(rows).label,
  };
}
