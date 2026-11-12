import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { STATUS_META } from "@/components/evidence/status-badge";
import { RiskBadge } from "@/components/tenders/markers";
import { Button } from "@/components/ui/button";
import { getWorkspaceName } from "@/lib/db/queries/company";
import { listActionItems } from "@/lib/db/queries/action-items";
import { listBidDecisions } from "@/lib/db/queries/bid-decisions";
import { listDemoCapabilities, replaceReadiness } from "@/lib/db/queries/readiness";
import { listStageReviews } from "@/lib/db/queries/stage-reviews";
import {
  getTenderDetail,
  listCountyRisk,
  listSecurityPages,
  type CountyRiskListItem,
  type RunRecord,
} from "@/lib/db/queries/tenders";
import {
  closingLabel,
  confidenceLabel,
  countyScoreReason,
  formatWhen,
  matchCountyName,
  RISK_LABEL,
  sentenceCase,
} from "@/lib/format/display";
import { presentLeadCopy, sourceLabel } from "@/lib/leads/public-names";
import { buildActionPlan, mergeSaved, planProgress, type PlanField } from "@/lib/plan/build";
import { FIELD_STATUSES } from "@/lib/db/vocab";
import {
  FINANCING_RATE,
  PROFIT_EMPTY,
  delayTable,
  formatKes,
  profitResult,
  typicalDelayDays,
} from "@/lib/recommendation/profit";
import { isWithdrawnByAddendum, matchRequirements } from "@/lib/readiness/match";
import { daysUntilDeadline } from "@/lib/recommendation/deadline";
import { RECOMMENDATION_LABEL, RULE_TEXT } from "@/lib/recommendation/labels";
import { isClarificationKey, recommend } from "@/lib/recommendation/recommend";
import { decisionTrail, latestBidDecision } from "@/lib/recommendation/trail";
import type { GroupStats } from "@/lib/tenders/extract-pipeline";
import { findBidSecurityConflicts } from "@/lib/tenders/document-conflicts";
import type { WorkspaceTabId } from "@/lib/tenders/workspace-stages";
import { ADDENDUM_FIELD_GROUPS, FIELD_SPECS, MAIN_FIELD_GROUPS } from "@/lib/tenders/field-catalog";
import { summarizeReview } from "@/lib/tenders/review";
import { commercialFinding, complianceFinding, interpretationFinding, latestByStage } from "@/lib/tenders/stage-review";
import { buildWhatMatters } from "@/lib/tenders/what-matters";
import { ActionPlan } from "./action-plan";
import { DecisionTrail } from "./decision-trail";
import { ExtractionStatus, type SourceStatus } from "./extraction-status";
import { ProfitForm } from "./profit-form";
import { ReadinessCard } from "./readiness-card";
import { RecommendationCard } from "./recommendation-card";
import { FieldsView, type ViewField } from "./fields-view";
import { TenderWorkspace } from "./workspace";
import TenderLoading from "./loading";

export const metadata: Metadata = { title: "Tender" };

function runGroups(run: RunRecord | undefined): Record<string, GroupStats> {
  const stats = run?.stats_json as { groups?: Record<string, GroupStats> } | null;
  return stats?.groups ?? {};
}

/** Field keys whose group failed validation in the source's latest successful run. */
function failedKeys(run: RunRecord | undefined): Set<string> {
  const groups = [...MAIN_FIELD_GROUPS, ...ADDENDUM_FIELD_GROUPS];
  const failed = Object.entries(runGroups(run))
    .filter(([, g]) => !g.ok)
    .flatMap(([id]) => groups.find((g) => g.id === id)?.keys ?? []);
  return new Set(failed);
}

async function TenderDetail({ params }: { params: PageProps<"/tenders/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, counties, stageReviews, bidDecisions, workspaceName, savedActions] = await Promise.all([
    getTenderDetail(id),
    listCountyRisk(),
    listStageReviews(id),
    listBidDecisions(id),
    getWorkspaceName(),
    listActionItems(id),
  ]);
  if (!detail) notFound();

  const { opportunity, sources, runs, fields, pages, citedPages, fileUrls } = detail;
  const latestRun = new Map<string, RunRecord>();
  for (const run of runs) if (!latestRun.has(run.source_id)) latestRun.set(run.source_id, run);
  const succeededRun = (sourceId: string) => runs.find((r) => r.source_id === sourceId && r.status === "succeeded");

  const pdfSources = sources.filter((s) => s.kind === "pdf");
  const formSourceIds = new Set(sources.filter((s) => s.kind === "form").map((s) => s.id));
  const workbookLead = pdfSources.length === 0;
  const present = (value: string | null, sourceId: string | null) =>
    sourceId && formSourceIds.has(sourceId) ? presentLeadCopy(value) : value;
  const sourceStatuses: SourceStatus[] = pdfSources.map((s) => {
    const run = latestRun.get(s.id);
    const own = pages.filter((p) => p.source_id === s.id);
    return {
      id: s.id,
      name: s.original_name,
      role: s.role,
      pages: own.length,
      needsOcrPages: own.filter((p) => p.is_scanned).map((p) => p.page_no),
      run: run
        ? {
            status: run.status,
            error: run.error,
            seconds: run.finished_at
              ? Math.round((Date.parse(run.finished_at) - Date.parse(run.created_at)) / 1000)
              : null,
            facts: fields.filter((field) => field.source_id === s.id).length,
          }
        : null,
    };
  });

  const failedBySource = new Map(sources.map((s) => [s.id, failedKeys(succeededRun(s.id))]));
  const viewFields: ViewField[] = fields.map((f) => ({
    id: f.id,
    key: f.key,
    ordinal: f.ordinal,
    value: f.value,
    quote: f.quote,
    page_no: f.page_no,
    confidence: Number(f.confidence),
    status: f.status,
    source_id: f.source_id,
    affects_key: f.affects_key,
    extractionFailed:
      f.value === null && f.quote === null && !!f.source_id && !!failedBySource.get(f.source_id)?.has(f.key),
  }));

  const sourceRoles = new Map(sources.map((s) => [s.id, s.role]));
  const summary = summarizeReview(viewFields, sourceRoles);
  const mainSourceIds = sources.filter((s) => s.role === "main").map((s) => s.id);
  const securityPages = await listSecurityPages(mainSourceIds);
  const securityConflict = findBidSecurityConflicts(
    securityPages.map((page) => ({ pageNo: page.page_no, text: page.text })),
  );
  const matters = buildWhatMatters({
    fields: viewFields.map((field) => ({
      id: field.id,
      key: field.key,
      value: field.value,
      status: field.status,
      page_no: field.page_no,
      role: field.source_id ? (sourceRoles.get(field.source_id) ?? "main") : "main",
    })),
    conflict: securityConflict,
    needsHuman: summary.byStatus.needs_human,
    addendumConflicts: summary.conflicts.length,
  });
  const roleOf = (sourceId: string | null) => (sourceId ? (sourceRoles.get(sourceId) ?? "main") : "main");
  const changeTexts = viewFields.flatMap((field) =>
    field.key === "addendum_change" && field.value ? [field.value] : [],
  );
  const mandatory = viewFields.filter(
    (field) => field.key === "mandatory_requirement" && field.value && roleOf(field.source_id) === "main",
  );
  const withdrawn = mandatory.filter((field) => isWithdrawnByAddendum(field.value!, changeTexts));
  const readiness = matchRequirements(
    mandatory
      .filter((field) => !isWithdrawnByAddendum(field.value!, changeTexts))
      .map((field) => ({
        text: field.value!,
        category: "mandatory" as const,
        pageNo: field.page_no,
        quote: field.quote,
      })),
    await listDemoCapabilities(),
    undefined,
    workspaceName,
  );
  let readinessError: string | null = null;
  try {
    await replaceReadiness(opportunity.id, readiness.items, readiness.readinessPct);
  } catch (error) {
    readinessError = error instanceof Error ? error.message : "Readiness could not be saved.";
  }
  const planFields: PlanField[] = viewFields.map((field) => ({
    key: field.key,
    value: field.value,
    status: field.status,
    pageNo: field.page_no,
    role: roleOf(field.source_id),
    ordinal: field.ordinal,
  }));
  const actionPlan = buildActionPlan({
    requirements: readiness.items.map((item) => ({
      text: item.text,
      pageNo: item.pageNo,
      match: item.match,
      expired: item.expired,
      documentName: item.capabilityName,
    })),
    fields: planFields,
    deadlineAt: opportunity.deadline_at,
    asOf: new Date(),
  });
  const planRows = mergeSaved(actionPlan, savedActions);
  const plan = planProgress(planRows);

  const pageTexts = Object.fromEntries(
    citedPages.map((p) => [`${p.source_id}:${p.page_no}`, present(p.text, p.source_id) ?? p.text]),
  );
  const hasMainPdf = pdfSources.some((s) => s.role === "main");
  const displayTitle = workbookLead ? (presentLeadCopy(opportunity.title) ?? opportunity.title) : opportunity.title;
  const displayOrganization = workbookLead ? presentLeadCopy(opportunity.organization) : opportunity.organization;
  const displayReference = workbookLead ? presentLeadCopy(opportunity.reference) : opportunity.reference;
  const displayFields: ViewField[] = viewFields.map((field) => ({
    ...field,
    value: present(field.value, field.source_id),
    quote: present(field.quote, field.source_id),
  }));
  const countyText =
    viewFields.find((field) => field.key === "county" && field.value)?.value ?? opportunity.buyer_county;
  const countyLabel = workbookLead ? presentLeadCopy(countyText) : countyText;
  const matchedCounty = matchCountyName(countyLabel, counties.map((county) => county.county));
  const countyRisk = counties.find((county) => county.county === matchedCounty);
  const closingText = viewFields.find((field) => field.key === "closing_datetime" && field.value)?.value ?? null;
  const closing = closingLabel(workbookLead ? presentLeadCopy(closingText) : closingText, opportunity.deadline_at);
  const closingField = viewFields.find(
    (field) => field.key === "closing_datetime" && roleOf(field.source_id) === "main",
  );
  const closingUsable =
    closingField && (closingField.status === "source_confirmed" || closingField.status === "ai_inferred")
      ? closingField.value
      : null;
  const daysUntil = daysUntilDeadline({
    deadlineAt: opportunity.deadline_at,
    closingText: closingUsable,
    asOf: new Date(),
  });
  const facts = viewFields.flatMap((field) => {
    if (!isClarificationKey(field.key)) return [];
    const label = FIELD_SPECS[field.key].label;
    return [
      {
        key: field.key,
        status: field.status,
        label,
        item: field.value?.replace(/\s+/g, " ").trim() || label,
      },
    ];
  });
  const recommendation = recommend({
    readiness,
    facts,
    band: countyRisk?.band ?? null,
    contractValueKes: opportunity.contract_value_kes,
    daysUntilDeadline: daysUntil,
  });
  const latestDecision = latestBidDecision(bidDecisions);
  const trail = decisionTrail(stageReviews, bidDecisions);
  const heading = sentenceCase(displayTitle);
  const reviews = latestByStage(stageReviews);
  const commercial =
    countyRisk && countyRisk.score !== null
      ? commercialFinding({ county: countyRisk.county, score: countyRisk.score, bandLabel: RISK_LABEL[countyRisk.band] })
      : commercialFinding(null);
  const countLine =
    summary.total > 0
      ? ` ${summary.total} fields: ${FIELD_STATUSES.map((status) => `${summary.byStatus[status]} ${STATUS_META[status].label}`).join(", ")}.`
      : "";
  const heads: Record<WorkspaceTabId, { title: string; summary: string }> = {
    interpretation: {
      title: "Interpretation",
      summary: `${interpretationFinding({ facts: summary.total, needsHuman: summary.byStatus.needs_human })}${countLine}`,
    },
    compliance: {
      title: "Compliance",
      summary: complianceFinding({
        met: readiness.met,
        gaps: readiness.gaps,
        couldDisqualify: readiness.couldDisqualify,
        toPrepare: readiness.toPrepare,
        total: readiness.items.length,
      }),
    },
    commercial: { title: "Commercial", summary: commercial },
    recommendation: {
      title: "Recommendation",
      summary: `${RECOMMENDATION_LABEL[recommendation.label]}. ${RULE_TEXT[recommendation.rule]}.`,
    },
    preparation: { title: "Bid preparation", summary: plan.label },
  };
  const figures = {
    contractValueKes: opportunity.contract_value_kes,
    deliveryCostKes: opportunity.delivery_cost_kes,
    band: countyRisk?.band ?? null,
  };
  const profit = profitResult(figures);
  const delayRows = delayTable(figures);
  const bandDays = typicalDelayDays(figures.band);
  const bandWord = countyRisk && countyRisk.band !== "unknown" ? RISK_LABEL[countyRisk.band] : null;
  const mainPdf = pdfSources.find((source) => source.role === "main");
  const openHref = mainPdf ? (fileUrls[mainPdf.id] ?? null) : null;
  const viewSources = sources.map((source) => ({
    id: source.id,
    name:
      source.kind === "form"
        ? sourceLabel({
            kind: source.kind,
            opportunityType: opportunity.type === "field" ? "field" : "procurement",
          })
        : source.original_name,
    role: source.role,
    fileUrl: fileUrls[source.id] ?? null,
  }));

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Tender workspace</p>
          <h1 className="font-heading line-clamp-2 text-3xl tracking-tight" title={displayTitle}>
            {heading}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            A guided review from the uploaded tender to a recorded decision. Nothing is submitted.
          </p>
        </div>
        {openHref && (
          <Button variant="outline" size="lg" nativeButton={false} render={<a href={openHref} target="_blank" rel="noreferrer" />}>
            Open tender
          </Button>
        )}
      </div>

      <TenderWorkspace
        tenderId={opportunity.id}
        title={heading}
        buyer={displayOrganization ? sentenceCase(displayOrganization) : "Buyer not stated"}
        reference={displayReference ?? "Not stated"}
        closing={closing ? sentenceCase(closing) : "Not stated"}
        addendumHref={hasMainPdf ? `/tenders/new?addendum=${opportunity.id}` : "/tenders/new"}
        approval={{
          canBid: reviews.can_bid !== null,
          canComply: reviews.can_comply !== null,
          shouldBid: reviews.should_bid !== null,
          decision: latestDecision !== null,
          preparation: plan.total === 0 || plan.done === plan.total,
        }}
        heads={heads}
        recommendedLabel={recommendation.label}
        planDone={plan.done}
        planTotal={plan.total}
        interpretation={
          <>
            <FieldsView
              fields={displayFields}
              sources={viewSources}
              conflicts={summary.conflicts}
              pageTexts={pageTexts}
              matters={matters}
              securityConflict={securityConflict}
            />
            {pdfSources.length > 0 && <ExtractionStatus opportunityId={opportunity.id} sources={sourceStatuses} />}
          </>
        }
        compliance={
          <>
            <ReadinessCard
              result={readiness}
              withdrawn={withdrawn.map((field) => field.value!.replace(/\s+/g, " ").slice(0, 90))}
            />
            {readinessError && (
              <p className="mx-5 mb-4 rounded-lg border border-blocker/40 bg-blocker/10 px-4 py-3 text-blocker">
                {readinessError}
              </p>
            )}
          </>
        }
        commercial={
          <div className="flex flex-col gap-4 px-5 py-4">
            <PaymentCard risk={countyRisk} />
            <ProfitForm
              tenderId={opportunity.id}
              contractValue={kesInput(opportunity.contract_value_kes)}
              deliveryCost={kesInput(opportunity.delivery_cost_kes)}
              onTimeLabel={profit ? `If paid on time: ${formatKes(profit.onTimeKes)}` : null}
              rateNote={
                delayRows
                  ? `Loan rate ${Math.round(FINANCING_RATE * 100)}% a year. The company profile does not record a loan rate, so the margin calculation uses this rate.`
                  : null
              }
              bandNote={
                delayRows
                  ? bandDays && bandWord
                    ? `${bandDays} days is the scenario for the ${bandWord} band. The highlighted row is that band. This is the unpaid-bills band, not a date the county will pay.`
                    : "No county score, so no band row is highlighted."
                  : null
              }
              lateNote={profit?.lateNote ?? null}
              rows={delayRows}
              emptyMessage={PROFIT_EMPTY}
            />
          </div>
        }
        recommendation={<RecommendationCard recommendation={recommendation} decision={latestDecision} />}
        preparation={<ActionPlan tenderId={opportunity.id} rows={planRows} editable />}
      />

      <DecisionTrail entries={trail} />
    </div>
  );
}

function kesInput(value: number | null): string {
  if (value === null) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function PaymentCard({ risk }: { risk: CountyRiskListItem | undefined }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-4">
      <p className="text-muted-foreground">
        Unpaid bills for this buyer&apos;s county. This is not a forecast of when the buyer will pay.
      </p>
      {risk && risk.score !== null ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="font-medium">{risk.county}</span>
              <RiskBadge band={risk.band} />
            </div>
            <span className="font-heading text-3xl font-semibold tabular-nums">{risk.score.toFixed(1)}</span>
          </div>
          <p>{countyScoreReason(risk)}</p>
          <p className="text-muted-foreground">
            Controller of Budget, as at {formatWhen(risk.asOf) ?? risk.asOf}. Confidence: {confidenceLabel(risk.confidence)}.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">No county score for this buyer.</p>
      )}
      <Link href="/counties" className="w-fit text-sm font-medium text-brand hover:underline">
        See all counties
      </Link>
    </div>
  );
}


export default function TenderPage(props: PageProps<"/tenders/[id]">) {
  return (
    <Suspense fallback={<TenderLoading />}>
      <TenderDetail params={props.params} />
    </Suspense>
  );
}
