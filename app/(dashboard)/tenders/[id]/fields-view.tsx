"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

import { StatusBadge } from "@/components/evidence/status-badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FieldStatus, SourceRole } from "@/lib/db/vocab";
import { spelledCountWithUnit } from "@/lib/format/display";
import type { AddendumConflict } from "@/lib/tenders/addendum-conflicts";
import type { BidSecurityConflict } from "@/lib/tenders/document-conflicts";
import { ADDENDUM_FIELD_GROUPS, MAIN_FIELD_GROUPS, fieldLabel } from "@/lib/tenders/field-catalog";
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

function shownValue(field: ViewField): string {
  if (field.key === "payment_days" && field.value) return spelledCountWithUnit(field.value, "days");
  return field.value ?? "";
}

function ValueText({ field }: { field: ViewField }) {
  if (field.value !== null) return <span className="whitespace-pre-line">{shownValue(field)}</span>;
  if (field.status === "blank_in_source") return <span className="text-muted-foreground italic">Left blank in the tender</span>;
  if (field.extractionFailed) return <span className="text-muted-foreground italic">Extraction failed: check the document</span>;
  return <span className="text-muted-foreground italic">Not found in the pages searched</span>;
}

function ConflictPill() {
  return (
    <span className="inline-flex rounded-full bg-warning/15 px-2.5 py-0.5 text-sm font-medium tracking-wide text-warning uppercase">
      Conflict found
    </span>
  );
}

function PageLink({ pageNo, onClick }: { pageNo: number | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm font-medium text-brand not-italic hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {pageNo ? `Page ${pageNo}` : "No page"} ↗
    </button>
  );
}

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

function QuoteLine({
  quote,
  pageNo,
  onOpen,
}: {
  quote: string | null;
  pageNo: number | null;
  onOpen: () => void;
}) {
  if (!quote && pageNo === null) return null;
  return (
    <p className="mt-2 text-muted-foreground">
      {quote && <em>“{quote}”</em>}
      {quote && " "}
      <PageLink pageNo={pageNo} onClick={onOpen} />
    </p>
  );
}

const KEY_FACT_KEYS = ["buyer", "closing_datetime", "bid_security", "tender_validity", "submission_method"];

const GROUP_LABEL: Record<string, string> = {
  identity: "Reference and contact",
  submission: "Submission",
  securities: "Performance security",
  payment: "Payment",
  eligibility: "Eligibility",
  mandatory: "Mandatory requirements",
  scope: "Technical scope",
  evaluation: "Evaluation",
  addendum_changes: "Addendum changes",
  other: "Other",
};

const KEY_GROUP = new Map<string, string>();
for (const group of [...MAIN_FIELD_GROUPS, ...ADDENDUM_FIELD_GROUPS]) {
  for (const key of group.keys) {
    if (!KEY_GROUP.has(key)) KEY_GROUP.set(key, group.id);
  }
}

function keyFactRank(key: string): number {
  const index = KEY_FACT_KEYS.indexOf(key);
  return index === -1 ? KEY_FACT_KEYS.length : index;
}

function isKeyFact(field: ViewField): boolean {
  return KEY_FACT_KEYS.includes(field.key) || field.status === "blank_in_source";
}

const CONFLICT_NOTE: Record<AddendumConflict["kind"], string> = {
  value_differs: "The addendum and the main tender state different values. Both are kept.",
  addendum_only: "Only the addendum states this. Nothing was merged.",
  addendum_change: "The addendum changes this. Both quotes stay until a person decides.",
};

function FieldArticle({ field, onOpen }: { field: ViewField; onOpen: (field: ViewField) => void }) {
  return (
    <article className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-semibold">
          {fieldLabel(field.key)}
          <StatusBadge status={field.status} />
        </div>
        <p className="mt-1">
          <ValueText field={field} />
        </p>
        {field.affects_key && <p className="mt-1 text-muted-foreground">Affects: {fieldLabel(field.affects_key)}</p>}
        <QuoteLine quote={field.quote} pageNo={field.page_no} onOpen={() => onOpen(field)} />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">{Math.round(field.confidence * 100)}%</p>
    </article>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="px-5 pt-4 text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">{children}</h2>
  );
}

export function FieldsView({
  fields,
  sources,
  conflicts,
  pageTexts,
  securityConflict,
  unreadNotice,
}: {
  fields: ViewField[];
  sources: ViewSource[];
  conflicts: AddendumConflict[];
  /** `${source_id}:${page_no}` → page text, for every cited page. */
  pageTexts: Record<string, string>;
  securityConflict: BidSecurityConflict | null;
  /** Pages with no text layer, already phrased. Null when every page could be read. */
  unreadNotice: string | null;
}) {
  const [open, setOpen] = useState<ViewField | null>(null);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const indexed = fields.map((field, index) => ({ field, index }));
  const keyFacts = indexed
    .filter(({ field }) => isKeyFact(field))
    .sort((a, b) => keyFactRank(a.field.key) - keyFactRank(b.field.key) || a.index - b.index)
    .map(({ field }) => field);
  const shown = new Set(keyFacts.map((field) => field.id));
  const needsHuman = fields.filter((field) => field.status === "needs_human" && !shown.has(field.id));
  for (const field of needsHuman) shown.add(field.id);
  const rest = fields.filter((field) => !shown.has(field.id));
  const grouped = new Map<string, ViewField[]>();
  for (const field of rest) {
    const id = KEY_GROUP.get(field.key) ?? "other";
    const list = grouped.get(id) ?? [];
    list.push(field);
    grouped.set(id, list);
  }
  const groupIds = [
    ...MAIN_FIELD_GROUPS.map((group) => group.id),
    "addendum_changes",
    "other",
  ].filter((id) => grouped.has(id));
  const empty = keyFacts.length === 0 && needsHuman.length === 0 && rest.length === 0 && !securityConflict && conflicts.length === 0;

  return (
    <div>
      {unreadNotice && <p className="px-5 pt-4 text-muted-foreground">{unreadNotice}</p>}
      {empty ? (
        <p className="px-5 py-4 text-muted-foreground">No key facts were extracted from this tender yet.</p>
      ) : (
        <>
          {keyFacts.length > 0 && (
            <section>
              <SectionHeading>Key facts</SectionHeading>
              {keyFacts.map((field) => (
                <FieldArticle key={field.id} field={field} onOpen={setOpen} />
              ))}
            </section>
          )}

          {needsHuman.length > 0 && (
            <section>
              <SectionHeading>Needs a person to check</SectionHeading>
              {needsHuman.map((field) => (
                <FieldArticle key={field.id} field={field} onOpen={setOpen} />
              ))}
            </section>
          )}

          {securityConflict && (
            <article className="border-b border-border px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                Bid security <ConflictPill />
              </div>
              <p className="mt-1">
                Two amounts appear in this tender. They are kept separate until a reviewer confirms which governs.
              </p>
              {securityConflict.amounts.map((amount) => {
                const field = fields.find((item) => item.page_no === amount.pageNo);
                const fileUrl = sources.find((source) => source.role === "main")?.fileUrl;
                return (
                  <p key={`${amount.pageNo}-${amount.amountKes}`} className="mt-2 text-muted-foreground">
                    <em>“{amount.quote}”</em>{" "}
                    {field ? (
                      <PageLink pageNo={amount.pageNo} onClick={() => setOpen(field)} />
                    ) : fileUrl ? (
                      <a
                        href={`${fileUrl}#page=${amount.pageNo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand not-italic hover:underline"
                      >
                        Page {amount.pageNo} ↗
                      </a>
                    ) : (
                      <span>Page {amount.pageNo}</span>
                    )}
                  </p>
                );
              })}
            </article>
          )}

          {conflicts.map((conflict) => {
            const addendum = byId.get(conflict.addendum.id);
            const main = conflict.main ? byId.get(conflict.main.id) : undefined;
            return (
              <article key={`${conflict.kind}-${conflict.addendum.id}`} className="border-b border-border px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {fieldLabel(conflict.key)} <ConflictPill />
                </div>
                <p className="mt-1">{CONFLICT_NOTE[conflict.kind]}</p>
                <p className="mt-2 text-sm text-muted-foreground">Main tender</p>
                {main ? (
                  <QuoteLine quote={main.quote ?? main.value} pageNo={main.page_no} onOpen={() => setOpen(main)} />
                ) : (
                  <p className="mt-1 text-muted-foreground italic">
                    No matching value found in the main document. Compare by hand.
                  </p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">Addendum</p>
                {addendum ? (
                  <QuoteLine
                    quote={addendum.quote ?? addendum.value}
                    pageNo={addendum.page_no}
                    onOpen={() => setOpen(addendum)}
                  />
                ) : (
                  <p className="mt-1 text-muted-foreground italic">Addendum value is not on a cited page.</p>
                )}
              </article>
            );
          })}

          {groupIds.map((id) => {
            const items = grouped.get(id) ?? [];
            return (
              <details key={id} className="border-b border-border">
                <summary className="cursor-pointer px-5 py-3 font-semibold">
                  {GROUP_LABEL[id] ?? id}
                  <span className="ml-2 font-normal text-muted-foreground">{items.length}</span>
                </summary>
                {items.map((field) => (
                  <FieldArticle key={field.id} field={field} onOpen={setOpen} />
                ))}
              </details>
            );
          })}
        </>
      )}

      <EvidencePanel
        field={open}
        source={open?.source_id ? sourceById.get(open.source_id) : undefined}
        pageText={open?.source_id && open.page_no ? pageTexts[`${open.source_id}:${open.page_no}`] : undefined}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
