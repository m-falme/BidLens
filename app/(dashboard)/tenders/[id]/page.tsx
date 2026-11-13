import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

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
  countyScoreLine,
  countyScoreReason,
  formatWhen,
  matchCountyName,
  RISK_LABEL,
  sentenceCase,
  spelledCountWithUnit,
} from "@/lib/format/display";
import { presentLeadCopy, sourceLabel } from "@/lib/leads/public-names";
import { buildActionPlan, mergeSaved, planProgress, preparationIsDone, type PlanField } from "@/lib/plan/build";
import {
  FINANCING_RATE,
  PROFIT_EMPTY,
  delayTable,
  formatKes,
  profitResult,
  typicalDelayDays,
} from "@/lib/recommendation/profit";
import { isWithdrawnByAddendum, matchRequirements } from "@/lib/readiness/match";
import { daysUntilClosing, preferredClosing } from "@/lib/recommendation/deadline";
import { RECOMMENDATION_LABEL } from "@/lib/recommendation/labels";
import { isClarificationKey, recommend } from "@/lib/recommendation/recommend";
import { decisionTrail, latestBidDecision } from "@/lib/recommendation/trail";
import type { GroupStats } from "@/lib/tenders/extract-pipeline";
import { findBidSecurityConflicts } from "@/lib/tenders/document-conflicts";
import type { WorkspaceTabId } from "@/lib/tenders/workspace-stages";
import { ADDENDUM_FIELD_GROUPS, FIELD_SPECS, MAIN_FIELD_GROUPS } from "@/lib/tenders/field-catalog";
import { needsHumanReview, summarizeReview } from "@/lib/tenders/review";
import { PARTS_ROUNDED_NOTE } from "@/lib/risk/county-score";
import {
  becauseBullets,
  carriedFrom,
  commercialFinding,
  complianceFinding,
  interpretationFinding,
  latestByStage,
  preparationFinding,
  stageApprovalLine,
  unreadPagesNotice,
  unresolvedClause,
} from "@/lib/tenders/stage-review";
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

async function TenderDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/tenders/[id]">["params"];
  searchParams: PageProps<"/tenders/[id]">["searchParams"];
}) {
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requestedStage = typeof query.stage === "string" ? query.stage : null;
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
  const roleOf = (sourceId: string | null) => (sourceId ? (sourceRoles.get(sourceId) ?? "main") : "main");
  const changeTexts = viewFields.flatMap((field) =>
    field.key === "addendum_change" && field.value ? [field.value] : [],
  );
  const mandatory = viewFields.filter(
    (field) => field.key === "mandatory_requirement" && field.value && roleOf(field.source_id) === "main",
  );
  const withdrawn = mandatory.filter((field) => isWithdrawnByAddendum(field.value!, changeTexts));
  const needsHumanTexts = mandatory.flatMap((field) =>
    field.status === "needs_human" && field.value && !isWithdrawnByAddendum(field.value, changeTexts)
      ? [field.value.replace(/\s+/g, " ").trim()]
      : [],
  );
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
  const closingField = preferredClosing(
    viewFields.map((field) => ({
      key: field.key,
      value: field.value,
      role: roleOf(field.source_id),
    })),
  );
  const closingText = closingField?.value ?? null;
  const closing = closingLabel(workbookLead ? presentLeadCopy(closingText) : closingText, opportunity.deadline_at);
  const daysUntil = daysUntilClosing({
    closingText,
    deadlineAt: opportunity.deadline_at,
    asOf: new Date(),
  });
  const closed = daysUntil !== null && daysUntil < 0;
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
    securityConflict: securityConflict !== null,
    addendumConflicts: summary.conflicts.length,
  });
  const latestDecision = latestBidDecision(bidDecisions);
  const trail = decisionTrail(stageReviews, bidDecisions);
  const heading = sentenceCase(displayTitle);
  const reviews = latestByStage(stageReviews);
  const commercial =
    countyRisk && countyRisk.score !== null
      ? commercialFinding({ county: countyRisk.county, score: countyRisk.score, bandLabel: RISK_LABEL[countyRisk.band] })
      : commercialFinding(null);
  const interpretationAnswer = interpretationFinding({
    facts: summary.total - summary.byStatus.blank_in_source,
    needsHuman: summary.byStatus.needs_human,
    unfilled: summary.byStatus.blank_in_source,
  });
  const unreadHit = sourceStatuses.filter((source) => source.needsOcrPages.length > 0);
  const unreadNotice =
    unreadHit.length === 0
      ? null
      : unreadHit.length === 1
        ? unreadPagesNotice(unreadHit[0].needsOcrPages)
        : unreadHit
            .flatMap((source) => {
              const line = unreadPagesNotice(source.needsOcrPages);
              return line ? [`${source.name}: ${line}`] : [];
            })
            .join(" ");
  const commercialFacts = (
    [
      ["bid_security", "Bid security"],
      ["advance_payment", "Advance payment"],
      ["payment_days", "Payment period"],
      ["late_payment_interest", "Late-payment interest"],
    ] as const
  ).map(([key, label]) => ({ label, ...commercialFactValue(displayFields, key, sourceRoles) }));
  const openGaps = readiness.items.filter((item) => item.match === "missing" || item.match === "unclear");
  const namedGap =
    openGaps.find((item) => /bid bond|tender security|bid security/i.test(item.text)) ??
    openGaps.find((item) => item.match === "missing") ??
    openGaps[0];
  const complianceAnswer = complianceFinding({
    met: readiness.met,
    gaps: readiness.gaps,
    missingText: namedGap?.text ?? null,
    unclear: openGaps.length > 0 && openGaps.every((item) => item.match === "unclear"),
  });
  const recommendationAnswer = `${RECOMMENDATION_LABEL[recommendation.label]}.`;
  const preparationAnswer = preparationFinding(plan.done, plan.total);
  const seenLabels = new Set<string>();
  const openQuestions = viewFields.flatMap((field) => {
    if (field.status !== "blank_in_source" && field.status !== "needs_human") return [];
    if (!(field.key in FIELD_SPECS)) return [];
    const label = FIELD_SPECS[field.key as keyof typeof FIELD_SPECS].label;
    if (seenLabels.has(label)) return [];
    seenLabels.add(label);
    return [{ label, status: field.status }];
  });
  const because = becauseBullets({
    compliance: complianceAnswer,
    commercial,
    open: openQuestions,
    unresolved: unresolvedClause({
      securityConflict: securityConflict !== null,
      addendumConflicts: summary.conflicts.length,
      closed,
    }),
  });
  const approvalLine = stageApprovalLine({
    review: latestDecision
      ? {
          reviewerName: latestDecision.reviewerName,
          createdAt: latestDecision.createdAt,
          action: latestDecision.action,
        }
      : null,
    others: stageReviews,
  });
  const heads: Record<WorkspaceTabId, { answer: string; carried: string | null }> = {
    interpretation: { answer: interpretationAnswer, carried: null },
    compliance: { answer: complianceAnswer, carried: carriedFrom("Interpretation", interpretationAnswer) },
    commercial: { answer: commercial, carried: carriedFrom("Compliance", complianceAnswer) },
    recommendation: { answer: recommendationAnswer, carried: carriedFrom("Commercial", commercial) },
    preparation: { answer: preparationAnswer, carried: carriedFrom("Recommendation", recommendationAnswer) },
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
          <h1 className="font-heading line-clamp-2 text-3xl tracking-tight break-words" title={displayTitle}>
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
        requestedStage={requestedStage}
        buyer={displayOrganization ? sentenceCase(displayOrganization) : "Buyer not stated"}
        reference={displayReference ?? "Not stated"}
        closing={closing ? sentenceCase(closing) : "Not stated"}
        closed={closed}
        decisionLabel={latestDecision ? RECOMMENDATION_LABEL[latestDecision.finalLabel] : null}
        needsHumanReview={needsHumanReview({
          sourceConfirmed: summary.byStatus.source_confirmed,
          mandatoryRequirements: readiness.items.length,
        })}
        addendumHref={hasMainPdf ? `/tenders/new?addendum=${opportunity.id}` : "/tenders/new"}
        approval={{
          canBid: reviews.can_bid !== null,
          canComply: reviews.can_comply !== null,
          shouldBid: reviews.should_bid !== null,
          decision: latestDecision !== null,
          preparation: preparationIsDone(plan),
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
              securityConflict={securityConflict}
              unreadNotice={unreadNotice}
            />
            {pdfSources.length > 0 && <ExtractionStatus opportunityId={opportunity.id} sources={sourceStatuses} />}
          </>
        }
        compliance={
          <>
            <ReadinessCard
              tenderId={opportunity.id}
              result={readiness}
              withdrawn={withdrawn.map((field) => field.value!.replace(/\s+/g, " ").slice(0, 90))}
              needsHumanTexts={needsHumanTexts}
              fileUrl={openHref}
              mainSourceId={mainPdf?.id ?? null}
              pageTexts={pageTexts}
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
            <dl className="grid gap-3 sm:grid-cols-2">
              {commercialFacts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="font-medium">
                    {fact.value}
                    {fact.page != null && <span className="ml-2 font-normal text-muted-foreground">p. {fact.page}</span>}
                  </dd>
                </div>
              ))}
            </dl>
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
                    ? `${bandDays} days is the scenario for the ${bandWord} band. The highlighted row is that band.`
                    : "No county score, so no band row is highlighted."
                  : null
              }
              lateNote={profit?.lateNote ?? null}
              rows={delayRows}
              emptyMessage={PROFIT_EMPTY}
            />
          </div>
        }
        recommendation={
          <RecommendationCard
            because={because}
            approval={approvalLine}
            reason={approvalLine ? (latestDecision?.reason ?? null) : null}
          />
        }
        preparation={<ActionPlan tenderId={opportunity.id} rows={planRows} editable />}
      />

      <DecisionTrail tenderId={opportunity.id} entries={trail} />
    </div>
  );
}

function kesInput(value: number | null): string {
  if (value === null) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function commercialFactValue(
  fields: readonly ViewField[],
  key: string,
  sourceRoles: ReadonlyMap<string, string>,
): { value: string; page: number | null } {
  const matches = fields.filter((field) => field.key === key);
  const main = matches.filter((field) => field.source_id && sourceRoles.get(field.source_id) === "main");
  const pool = main.length > 0 ? main : matches;
  const stated = pool.find((field) => field.value && field.value.trim());
  const page = (stated ?? pool[0])?.page_no ?? null;
  if (!stated?.value) return { value: "not stated", page };
  const value = key === "payment_days" ? spelledCountWithUnit(stated.value, "days") : stated.value;
  return { value, page };
}

function PaymentCard({ risk }: { risk: CountyRiskListItem | undefined }) {
  const hasParts = risk !== undefined && risk.partA !== null && risk.partB !== null && risk.partC !== null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-4">
      {risk && risk.score !== null ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{risk.county}</span>
            <RiskBadge band={risk.band} />
          </div>
          <p className="font-heading text-2xl">{countyScoreLine(risk.score, RISK_LABEL[risk.band])}</p>
          <p>{countyScoreReason(risk)}</p>
          {hasParts && <p className="text-muted-foreground">{PARTS_ROUNDED_NOTE}</p>}
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
      <TenderDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
