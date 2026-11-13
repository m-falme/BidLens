"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Check, Gavel, PenLine } from "lucide-react";

import { sentenceCase } from "@/lib/format/display";
import { formatReviewedAt } from "@/lib/tenders/stage-review";
import { cn } from "@/lib/utils";

import type { WorkspaceTrailEntry } from "@/lib/db/queries/trail";

const KIND: Record<WorkspaceTrailEntry["kind"], { tag: string; className: string; hint: string }> = {
  review: {
    tag: "Stage review",
    className: "bg-confirmed/10 text-confirmed",
    hint: "A person marked this stage reviewed.",
  },
  approve: {
    tag: "Approved",
    className: "bg-confirmed/10 text-confirmed",
    hint: "A person approved the recommended label.",
  },
  override: {
    tag: "Override",
    className: "bg-warning/15 text-warning",
    hint: "A person chose a different label and gave a reason. The earlier recommendation is kept.",
  },
};

function KindIcon({ kind }: { kind: WorkspaceTrailEntry["kind"] }) {
  const Icon = kind === "review" ? Check : kind === "approve" ? Gavel : PenLine;
  return (
    <span
      className={cn(
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
        kind === "override" ? "bg-warning/15 text-warning" : "bg-confirmed/10 text-confirmed",
      )}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}

export function TrailList({
  entries,
  tenders,
  initialTender,
}: {
  entries: readonly WorkspaceTrailEntry[];
  tenders: readonly { id: string; title: string }[];
  initialTender: string | null;
}) {
  const [tender, setTender] = useState<string>(
    initialTender && tenders.some((item) => item.id === initialTender) ? initialTender : "all",
  );
  const [query, setQuery] = useState("");
  const id = useId();
  const needle = query.trim().toLowerCase();
  const shown = entries.filter((entry) => {
    if (tender !== "all" && entry.tenderId !== tender) return false;
    if (!needle) return true;
    return `${entry.what} ${entry.who} ${entry.note ?? ""} ${entry.tenderTitle}`.toLowerCase().includes(needle);
  });

  return (
    <>
      <div className="flex flex-wrap gap-3 border-b border-border px-5 py-4">
        <label htmlFor={`${id}-q`} className="sr-only">
          Search the trail
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search decisions, names and notes…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 sm:max-w-sm"
        />
        <label htmlFor={`${id}-t`} className="sr-only">
          Tender
        </label>
        <select
          id={`${id}-t`}
          value={tender}
          onChange={(event) => setTender(event.target.value)}
          className="h-10 max-w-full min-w-0 rounded-lg border border-input bg-background px-3 sm:max-w-md"
        >
          <option value="all">All tenders</option>
          {tenders.map((item) => (
            <option key={item.id} value={item.id}>
              {sentenceCase(item.title).slice(0, 90)}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-6 text-muted-foreground">
          {entries.length === 0
            ? "No reviews or decisions yet. They appear here when someone approves a stage or records a bid decision."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <ol>
          {shown.map((entry, index) => {
            const kind = KIND[entry.kind];
            return (
              <li
                key={`${entry.tenderId}-${entry.at}-${index}`}
                className="flex gap-3 border-b border-border/80 px-5 py-4 last:border-b-0"
              >
                <KindIcon kind={entry.kind} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{entry.what}</p>
                  <Link
                    href={`/tenders/${entry.tenderId}`}
                    className="line-clamp-2 text-sm font-medium break-words text-brand hover:underline"
                    title={entry.tenderTitle}
                  >
                    {sentenceCase(entry.tenderTitle)}
                  </Link>
                  {entry.note && <p className="mt-1 break-words whitespace-pre-line">{entry.note}</p>}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.who} · {formatReviewedAt(entry.at)} EAT
                  </p>
                </div>
                <span
                  className={cn("h-fit shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium", kind.className)}
                  title={kind.hint}
                >
                  {kind.tag}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {entries.length > 0 && (
        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
          {shown.length} of {entries.length} {entries.length === 1 ? "entry" : "entries"} · A human override needs a
          reason and never erases the earlier recommendation.
        </p>
      )}
    </>
  );
}
