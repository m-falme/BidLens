"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, GitCompareArrows } from "lucide-react";

import { EvidenceChip, StatusBadge } from "@/components/evidence/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FieldStatus, SourceRole } from "@/lib/db/vocab";
import type { AddendumConflict } from "@/lib/tenders/addendum-conflicts";
import { fieldLabel, LIST_FIELD_KEYS, SCALAR_FIELD_KEYS } from "@/lib/tenders/field-catalog";
import type { MatterPoint } from "@/lib/tenders/what-matters";
import { decideFieldStatus, STATUS_REASON_TEXT } from "@/lib/verify/field-status";
import { findQuoteSpan } from "@/lib/verify/quote-check";

export interface ViewField {
  id: string;
  key: string;
  ordinal: number;
  value: string | null;
  quote: string | null;
  page_no: number | null;
  confidence: number;
  status: FieldStatus;
  source_id: string | null;
  affects_key: string | null;
  /** The field's group failed validation twice (from the run's stats). */
  extractionFailed: boolean;
}

export interface ViewSource {
  id: string;
  name: string;
  role: SourceRole;
  fileUrl: string | null;
}

const LIST_TITLES: Record<string, string> = {
  eligibility: "Eligibility",
  mandatory_requirement: "Mandatory requirements",
  technical_scope: "Technical scope",
  evaluation_criterion: "Evaluation criteria",
  addendum_change: "Changes made by the addendum",
};

/** Long lists stay closed until someone asks for them. The count stays visible. */
const COLLAPSED_LISTS = new Set(["eligibility", "mandatory_requirement", "technical_scope"]);

function ValueText({ field }: { field: ViewField }) {
  if (field.value !== null) return <span className="whitespace-pre-line">{field.value}</span>;
  if (field.status === "blank_in_source") return <span className="text-muted-foreground italic">Left blank in the tender</span>;
  if (field.extractionFailed) return <span className="text-muted-foreground italic">Extraction failed: check the document</span>;
  return <span className="text-muted-foreground italic">Not found in the pages searched</span>;
}

function FieldTable({ fields, showKey, onOpen }: { fields: ViewField[]; showKey: boolean; onOpen: (f: ViewField) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showKey ? <TableHead className="w-56">Field</TableHead> : <TableHead className="w-12">#</TableHead>}
          <TableHead>Value</TableHead>
          <TableHead className="w-40">Status</TableHead>
          <TableHead className="w-28 text-right">Confidence</TableHead>
          <TableHead className="w-20 text-right">Page</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((f) => (
          <TableRow
            key={f.id}
            tabIndex={0}
            role="button"
            aria-label={`Show evidence for ${fieldLabel(f.key)}`}
            onClick={() => onOpen(f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(f);
              }
            }}
            className="cursor-pointer align-top focus-visible:bg-muted focus-visible:outline-none"
          >
            <TableCell className="font-medium whitespace-normal">
              {showKey ? fieldLabel(f.key) : f.ordinal + 1}
            </TableCell>
            <TableCell className="max-w-xl whitespace-normal">
              <ValueText field={f} />
              {f.affects_key && (
                <span className="mt-1 block text-sm text-muted-foreground">Affects: {fieldLabel(f.affects_key)}</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={f.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{Math.round(f.confidence * 100)}%</TableCell>
            <TableCell className="text-right tabular-nums">{f.page_no ? `p.${f.page_no}` : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FieldsForSource({ fields, onOpen }: { fields: ViewField[]; onOpen: (f: ViewField) => void }) {
  const scalar = SCALAR_FIELD_KEYS.flatMap((k) => fields.filter((f) => f.key === k));
  const lists = LIST_FIELD_KEYS.map((k) => [k, fields.filter((f) => f.key === k)] as const).filter(([, l]) => l.length > 0);
  return (
    <div className="flex flex-col gap-6">
      {scalar.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Key facts</h3>
          <FieldTable fields={scalar} showKey onOpen={onOpen} />
        </section>
      )}
      {lists.map(([key, list]) =>
        COLLAPSED_LISTS.has(key) ? (
          <details key={key} className="rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 text-lg font-semibold">
              {LIST_TITLES[key]} <span className="font-normal text-muted-foreground">({list.length})</span>
            </summary>
            <div className="px-2 pb-3">
              <FieldTable fields={list} showKey={false} onOpen={onOpen} />
            </div>
          </details>
        ) : (
          <section key={key} className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">
              {LIST_TITLES[key]} <span className="font-normal text-muted-foreground">({list.length})</span>
            </h3>
            <FieldTable fields={list} showKey={false} onOpen={onOpen} />
          </section>
        ),
      )}
    </div>
  );
}

function ConflictSide({
  title,
  field,
  onOpen,
}: {
  title: string;
  field: ViewField | undefined;
  onOpen: (f: ViewField) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
      {field ? (
        <>
          <span className="whitespace-pre-line">{field.value ?? <ValueText field={field} />}</span>
          <span>
            <EvidenceChip status={field.status} page={field.page_no} onClick={() => onOpen(field)} />
          </span>
        </>
      ) : (
        <span className="text-muted-foreground italic">No matching value found in the main document. Compare by hand.</span>
      )}
    </div>
  );
}

const CONFLICT_TITLE: Record<AddendumConflict["kind"], string> = {
  value_differs: "Values differ",
  addendum_only: "Only the addendum states this",
  addendum_change: "Changed by the addendum",
};

function EvidencePanel({
  field,
  source,
  pageText,
  onClose,
}: {
  field: ViewField | null;
  source: ViewSource | undefined;
  pageText: string | undefined;
  onClose: () => void;
}) {
  const markRef = useRef<HTMLElement>(null);
  const span = field ? findQuoteSpan(field.quote, pageText) : null;
  const reason = field
    ? field.extractionFailed
      ? "extraction_failed"
      : decideFieldStatus({ value: field.value, quote: field.quote, pageText }).reason
    : null;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [field?.id]);

  return (
    <Sheet open={field !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        {field && (
          <>
            <SheetHeader className="gap-2 border-b pr-12">
              <SheetTitle className="text-xl">{fieldLabel(field.key)}</SheetTitle>
              <SheetDescription>
                {source ? `${source.name} (${source.role === "addendum" ? "addendum" : "main document"})` : "Unknown source"}
                {field.page_no ? ` · PDF page ${field.page_no}` : ""} · confidence {Math.round(field.confidence * 100)}%
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-col gap-2">
                <StatusBadge status={field.status} />
                {reason && <p className="text-muted-foreground">{STATUS_REASON_TEXT[reason]}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Value</span>
                <ValueText field={field} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Quote</span>
                {field.quote ? (
                  <blockquote className="border-l-4 border-primary/60 bg-muted/50 px-3 py-2 whitespace-pre-line">
                    “{field.quote}”
                  </blockquote>
                ) : (
                  <span className="text-muted-foreground italic">No quote</span>
                )}
              </div>
              {source?.fileUrl && field.page_no && (
                <a
                  href={`${source.fileUrl}#page=${field.page_no}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="size-4" aria-hidden /> Open the PDF at page {field.page_no}
                </a>
              )}
              {pageText !== undefined && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Text of page {field.page_no} {span ? "(quote highlighted)" : "(quote not found on this page)"}
                  </span>
                  <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                    {span ? (
                      <>
                        {pageText.slice(0, span[0])}
                        <mark ref={markRef} className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-700">
                          {pageText.slice(span[0], span[1])}
                        </mark>
                        {pageText.slice(span[1])}
                      </>
                    ) : (
                      pageText
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function WhatMattersCard({
  points,
  fields,
  onOpen,
}: {
  points: MatterPoint[];
  fields: Map<string, ViewField>;
  onOpen: (field: ViewField) => void;
}) {
  if (points.length === 0) return null;
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-xl">What matters</CardTitle>
        <CardDescription>The facts that change a bid. Each chip opens the quote it comes from.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex list-none flex-col gap-3">
          {points.map((point, index) => (
            <li key={point.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
              <span className="font-semibold text-muted-foreground tabular-nums">{index + 1}.</span>
              <span>{point.text}</span>
              {point.fieldIds.map((id) => {
                const field = fields.get(id);
                if (!field) return null;
                return (
                  <EvidenceChip
                    key={id}
                    status={field.status}
                    page={field.page_no}
                    onClick={() => onOpen(field)}
                  />
                );
              })}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function FieldsView({
  fields,
  sources,
  conflicts,
  pageTexts,
  matters,
  children,
}: {
  fields: ViewField[];
  sources: ViewSource[];
  conflicts: AddendumConflict[];
  /** `${source_id}:${page_no}` → page text, for every cited page. */
  pageTexts: Record<string, string>;
  matters: MatterPoint[];
  children?: ReactNode;
}) {
  const [open, setOpen] = useState<ViewField | null>(null);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-8">
      <WhatMattersCard points={matters} fields={byId} onOpen={setOpen} />
      {children}
      {conflicts.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <GitCompareArrows className="size-5 text-amber-600" aria-hidden />
              Addendum conflicts ({conflicts.length})
            </CardTitle>
            <CardDescription>
              The addendum differs from the main tender here. Both values are kept; nothing was merged. A person decides
              which applies.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {conflicts.map((c) => (
              <div key={`${c.kind}-${c.addendum.id}`} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{fieldLabel(c.key)}</span>
                  <Badge variant="outline">{CONFLICT_TITLE[c.kind]}</Badge>
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">Needs a human decision</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ConflictSide title="Main tender says" field={c.main ? byId.get(c.main.id) : undefined} onOpen={setOpen} />
                  <ConflictSide title="Addendum says" field={byId.get(c.addendum.id)} onOpen={setOpen} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {sources.map((source) => {
        const own = fields.filter((f) => f.source_id === source.id);
        if (own.length === 0) return null;
        return (
          <Card key={source.id}>
            <CardHeader>
              <CardTitle className="text-xl">
                {source.role === "addendum" ? "Addendum" : "Extracted fields"}
                <span className="ml-2 text-base font-normal text-muted-foreground">{source.name}</span>
              </CardTitle>
              <CardDescription>Click any row to see its quote and the page it comes from.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldsForSource fields={own} onOpen={setOpen} />
            </CardContent>
          </Card>
        );
      })}

      <EvidencePanel
        field={open}
        source={open?.source_id ? sourceById.get(open.source_id) : undefined}
        pageText={open?.source_id && open.page_no ? pageTexts[`${open.source_id}:${open.page_no}`] : undefined}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
