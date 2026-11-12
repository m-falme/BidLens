import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilePlus2, ShieldAlert } from "lucide-react";
import { z } from "zod";

import { NAV } from "@/components/app-shell/nav";
import { PageNav } from "@/components/app-shell/page-nav";
import { STATUS_META } from "@/components/evidence/status-badge";
import { RiskBadge } from "@/components/tenders/markers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDemoCapabilities, replaceReadiness } from "@/lib/db/queries/readiness";
import {
  getLatestDecision,
  getTenderDetail,
  listCountyRisk,
  listSecurityPages,
  type CountyRiskListItem,
  type RunRecord,
} from "@/lib/db/queries/tenders";
import { closingLabel, confidenceLabel, DECISION_LABEL, formatWhen, matchCountyName, sentenceCase, type DecisionChoice } from "@/lib/format/display";
import { presentLeadCopy, sourceLabel } from "@/lib/leads/public-names";
import { FIELD_STATUSES } from "@/lib/db/vocab";
import { isWithdrawnByAddendum, matchRequirements } from "@/lib/readiness/match";
import type { GroupStats } from "@/lib/tenders/extract-pipeline";
import { findBidSecurityConflicts } from "@/lib/tenders/document-conflicts";
import { ADDENDUM_FIELD_GROUPS, MAIN_FIELD_GROUPS } from "@/lib/tenders/field-catalog";
import { summarizeReview } from "@/lib/tenders/review";
import { buildWhatMatters } from "@/lib/tenders/what-matters";
import { cn } from "@/lib/utils";

import { ExtractionStatus, type SourceStatus } from "./extraction-status";
import { ReadinessCard } from "./readiness-card";
import { FieldsView, type ViewField } from "./fields-view";
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
  const [detail, decision, counties] = await Promise.all([getTenderDetail(id), getLatestDecision(id), listCountyRisk()]);
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
  const matters = buildWhatMatters({
    fields: viewFields.map((field) => ({
      id: field.id,
      key: field.key,
      value: field.value,
      status: field.status,
      page_no: field.page_no,
      role: field.source_id ? (sourceRoles.get(field.source_id) ?? "main") : "main",
    })),
    conflict: findBidSecurityConflicts(securityPages.map((page) => ({ pageNo: page.page_no, text: page.text }))),
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
  );
  let readinessError: string | null = null;
  try {
    await replaceReadiness(opportunity.id, readiness.items, readiness.readinessPct);
  } catch (error) {
    readinessError = error instanceof Error ? error.message : "Readiness could not be saved.";
  }

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
  const heading = sentenceCase(displayTitle);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
      <PageNav
        crumbs={[
          { href: NAV.overview.href, label: NAV.overview.title },
          { href: NAV.tenders.href, label: NAV.tenders.title },
          { label: heading },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="line-clamp-2 text-3xl font-semibold tracking-tight" title={displayTitle}>
            {heading}
          </h1>
          <p className="break-words text-muted-foreground">
            {[
              displayOrganization ? sentenceCase(displayOrganization) : "Buyer not stated",
              countyLabel ? sentenceCase(countyLabel) : "County not stated",
              closing ? `Closes ${sentenceCase(closing)}` : "Closing date not stated",
            ].join(" · ")}
          </p>
          {displayReference && <p className="text-sm text-muted-foreground">{displayReference}</p>}
        </div>
        {hasMainPdf && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/tenders/new?addendum=${opportunity.id}`} />}>
            <FilePlus2 aria-hidden /> Upload an addendum
          </Button>
        )}
      </div>

      <DecisionCard choice={decision} />

      <FieldsView
        fields={displayFields}
        sources={sources.map((s) => ({
          id: s.id,
          name:
            s.kind === "form"
              ? sourceLabel({
                  kind: s.kind,
                  opportunityType: opportunity.type === "field" ? "field" : "procurement",
                })
              : s.original_name,
          role: s.role,
          fileUrl: fileUrls[s.id] ?? null,
        }))}
        conflicts={summary.conflicts}
        pageTexts={pageTexts}
        matters={matters}
      >
      <ReadinessCard
        result={readiness}
        withdrawn={withdrawn.map((field) => field.value!.replace(/\s+/g, " ").slice(0, 90))}
      />
      <PaymentCard risk={countyRisk} />
      {readinessError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800">{readinessError}</p>
      )}
      </FieldsView>

      {summary.total > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <ShieldAlert
                className={cn("size-9", summary.needsReview > 0 ? "text-red-600" : "text-green-600")}
                aria-hidden
              />
              <div>
                <div className="text-3xl font-semibold tabular-nums">{summary.needsReview}</div>
                <div className="text-muted-foreground">
                  need{summary.needsReview === 1 ? "s" : ""} human review
                  {summary.conflicts.length > 0 &&
                    ` (${summary.byStatus.needs_human} unverified field${summary.byStatus.needs_human === 1 ? "" : "s"} + ${summary.conflicts.length} addendum conflict${summary.conflicts.length === 1 ? "" : "s"})`}
                </div>
              </div>
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <dt className="text-sm text-muted-foreground">Fields</dt>
                <dd className="text-xl font-semibold tabular-nums">{summary.total}</dd>
              </div>
              {FIELD_STATUSES.map((s) => (
                <div key={s}>
                  <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} aria-hidden />
                    {STATUS_META[s].label}
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums">{summary.byStatus[s]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {pdfSources.length > 0 && <ExtractionStatus opportunityId={opportunity.id} sources={sourceStatuses} />}
    </div>
  );
}

function DecisionCard({ choice }: { choice: DecisionChoice | null }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <p className="text-sm text-muted-foreground">Decision</p>
        <CardTitle className="text-3xl">{choice ? DECISION_LABEL[choice] : "No decision recorded"}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          {choice
            ? "Recorded by the bid team."
            : "The bid team has not recorded Bid, Bid higher, Ask for advance, or Skip."}
        </p>
      </CardContent>
    </Card>
  );
}

function PaymentCard({ risk }: { risk: CountyRiskListItem | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Payment risk</CardTitle>
        <CardDescription>
          Unpaid bills for this buyer&apos;s county. This is not a forecast of when the buyer will pay.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {risk && risk.score !== null ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-2">
                <span className="font-medium">{risk.county}</span>
                <RiskBadge band={risk.band} />
              </div>
              <span className="text-3xl font-semibold tabular-nums">{risk.score.toFixed(1)}</span>
            </div>
            <p className="text-muted-foreground">
              Controller of Budget, as at {formatWhen(risk.asOf) ?? risk.asOf}. Confidence:{" "}
              {confidenceLabel(risk.confidence)}.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">No county score for this buyer.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenderPage(props: PageProps<"/tenders/[id]">) {
  return (
    <Suspense fallback={<TenderLoading />}>
      <TenderDetail params={props.params} />
    </Suspense>
  );
}
