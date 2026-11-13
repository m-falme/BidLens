"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { StatusBadge } from "@/components/evidence/status-badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  complianceCountLine,
  complianceDisplayOrder,
  readinessLabel,
  type MatchedRequirement,
  type ReadinessMatch,
  type ReadinessResult,
} from "@/lib/readiness/match";
import { evidenceLibraryHref } from "@/lib/tenders/evidence-return";
import { cn } from "@/lib/utils";
import { findQuoteSpan } from "@/lib/verify/quote-check";

import { AddDocumentButton } from "./add-document-button";

const MATCH_CLASS: Record<ReadinessMatch, string> = {
  met: "bg-confirmed/10 text-confirmed",
  missing: "bg-blocker/12 text-blocker",
  unclear: "bg-blocker/12 text-blocker",
  to_prepare: "bg-muted text-muted-foreground",
};

function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function Assessment({ match, selfDeclared }: { match: ReadinessMatch; selfDeclared: boolean }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium", MATCH_CLASS[match])}>
      {readinessLabel({ match, selfDeclared })}
    </span>
  );
}

function RequirementSheet({
  item,
  pageText,
  fileUrl,
  onClose,
}: {
  item: MatchedRequirement | null;
  pageText: string | undefined;
  fileUrl: string | null;
  onClose: () => void;
}) {
  const markRef = useRef<HTMLElement>(null);
  const span = item ? findQuoteSpan(item.quote, pageText) : null;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [item?.text, item?.pageNo]);

  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        {item && (
          <>
            <SheetHeader className="gap-2 border-b pr-12">
              <SheetTitle className="text-xl">{item.text}</SheetTitle>
              <SheetDescription>{item.pageNo ? `Tender page ${item.pageNo}` : "Page not stated"}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Quote</span>
                {item.quote ? (
                  <blockquote className="border-l-4 border-primary/60 bg-muted/50 px-3 py-2 whitespace-pre-line">
                    “{item.quote}”
                  </blockquote>
                ) : (
                  <span className="text-muted-foreground italic">No quote</span>
                )}
              </div>
              {fileUrl && item.pageNo && (
                <a
                  href={`${fileUrl}#page=${item.pageNo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="size-4" aria-hidden /> Open the PDF at page {item.pageNo}
                </a>
              )}
              {pageText !== undefined && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Text of page {item.pageNo} {span ? "(quote highlighted)" : "(quote not found on this page)"}
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

export function ReadinessCard({
  tenderId,
  result,
  withdrawn,
  needsHumanTexts,
  fileUrl,
  mainSourceId,
  pageTexts,
}: {
  tenderId: string;
  result: ReadinessResult;
  /** Mandatory lines an addendum withdrew, so they are not counted as gaps. */
  withdrawn: readonly string[];
  /** Requirement text whose Interpretation field is needs-human. */
  needsHumanTexts: readonly string[];
  fileUrl: string | null;
  mainSourceId: string | null;
  /** `${source_id}:${page_no}` → page text. */
  pageTexts: Record<string, string>;
  companyName?: string;
}) {
  const [open, setOpen] = useState<MatchedRequirement | null>(null);
  const flagged = new Set(needsHumanTexts.map(norm));
  const items = complianceDisplayOrder(result.items);
  const pageText =
    open && mainSourceId && open.pageNo != null ? pageTexts[`${mainSourceId}:${open.pageNo}`] : undefined;

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {withdrawn.length > 0 && (
        <p className="text-muted-foreground">
          Not counted: the addendum removes {withdrawn.length} requirement{withdrawn.length === 1 ? "" : "s"}:{" "}
          {withdrawn.join("; ")}.
        </p>
      )}
      {result.items.length === 0 ? (
        <p className="text-muted-foreground">No mandatory requirements were extracted from this tender.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground">{complianceCountLine(result)}</p>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="w-[38%] px-2 py-2 font-medium">Requirement</th>
                  <th className="w-[16%] px-2 py-2 font-medium">Assessment</th>
                  <th className="w-[30%] px-2 py-2 font-medium">Evidence</th>
                  <th className="w-[16%] px-2 py-2 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const canOpen = Boolean(item.quote || item.pageNo);
                  return (
                    <tr key={`${item.pageNo ?? "x"}-${item.text}`} className="border-b border-border/80 align-top">
                      <td className="px-2 py-3 break-words">
                        <span className="font-semibold">{item.text}</span>
                        {flagged.has(norm(item.text)) && (
                          <span className="ml-2 inline-flex align-middle">
                            <StatusBadge status="needs_human" />
                          </span>
                        )}
                        {canOpen && (
                          <button
                            type="button"
                            onClick={() => setOpen(item)}
                            className="ml-2 rounded-sm font-medium text-brand hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {item.pageNo ? `p. ${item.pageNo}` : "Quote"}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <Assessment match={item.match} selfDeclared={item.selfDeclared} />
                      </td>
                      <td className="px-2 py-3 break-words">
                        {item.match === "met" && item.capabilityId && item.capabilityName ? (
                          <span className="flex flex-col gap-1">
                            <Link
                              href={evidenceLibraryHref(tenderId, "compliance", item.capabilityId)}
                              className="font-medium text-brand underline-offset-4 hover:underline"
                            >
                              Met: you have {item.capabilityName}
                            </Link>
                            {item.selfDeclared && (
                              <span className="text-muted-foreground">Marked by the team. The file was not checked.</span>
                            )}
                          </span>
                        ) : item.unlisted ? (
                          <span className="flex flex-col gap-2">
                            <span>New requirement: not in your documents yet</span>
                            <AddDocumentButton requirement={item.text} />
                          </span>
                        ) : item.match === "to_prepare" ? (
                          <span>To prepare. Not a gap.</span>
                        ) : (
                          <span>{item.rationale}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">Not assigned</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <RequirementSheet item={open} pageText={pageText} fileUrl={fileUrl} onClose={() => setOpen(null)} />
    </div>
  );
}
