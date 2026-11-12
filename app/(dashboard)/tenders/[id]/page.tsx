import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilePlus2, ShieldAlert } from "lucide-react";
import { z } from "zod";

import { STATUS_META } from "@/components/evidence/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTenderDetail, listSecurityPages, type RunRecord } from "@/lib/db/queries/tenders";
import { FIELD_STATUSES } from "@/lib/db/vocab";
import type { GroupStats } from "@/lib/tenders/extract-pipeline";
import { findBidSecurityConflicts } from "@/lib/tenders/document-conflicts";
import { ADDENDUM_FIELD_GROUPS, MAIN_FIELD_GROUPS } from "@/lib/tenders/field-catalog";
import { summarizeReview } from "@/lib/tenders/review";
import { buildWhatMatters } from "@/lib/tenders/what-matters";
import { cn } from "@/lib/utils";

import { ExtractionStatus, type SourceStatus } from "./extraction-status";
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
  const detail = await getTenderDetail(id);
  if (!detail) notFound();

  const { opportunity, sources, runs, fields, pages, citedPages, fileUrls } = detail;
  const latestRun = new Map<string, RunRecord>();
  for (const run of runs) if (!latestRun.has(run.source_id)) latestRun.set(run.source_id, run);
  const succeededRun = (sourceId: string) => runs.find((r) => r.source_id === sourceId && r.status === "succeeded");

  const pdfSources = sources.filter((s) => s.kind === "pdf");
  const sourceStatuses: SourceStatus[] = pdfSources.map((s) => {
    const run = latestRun.get(s.id);
    const own = pages.filter((p) => p.source_id === s.id);
    const groups = Object.values(runGroups(run));
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
            model: run.model,
            promptVersion: run.prompt_version,
            seconds: run.finished_at
              ? Math.round((Date.parse(run.finished_at) - Date.parse(run.created_at)) / 1000)
              : null,
            tokens: groups.length ? groups.reduce((n, g) => n + g.inputTokens + g.outputTokens, 0) : null,
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
  const pageTexts = Object.fromEntries(citedPages.map((p) => [`${p.source_id}:${p.page_no}`, p.text]));
  const hasMainPdf = pdfSources.some((s) => s.role === "main");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            {[opportunity.reference, opportunity.organization].filter(Boolean).join(" · ") || "Tender"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{opportunity.title}</h1>
        </div>
        {hasMainPdf && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/tenders/new?addendum=${opportunity.id}`} />}>
            <FilePlus2 aria-hidden /> Upload an addendum
          </Button>
        )}
      </div>

      <FieldsView
        fields={viewFields}
        sources={sources.map((s) => ({ id: s.id, name: s.original_name, role: s.role, fileUrl: fileUrls[s.id] ?? null }))}
        conflicts={summary.conflicts}
        pageTexts={pageTexts}
        matters={matters}
      >
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
      </FieldsView>
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
