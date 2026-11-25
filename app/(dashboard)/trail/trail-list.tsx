"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Check, ChevronRight, Gavel, PenLine } from "lucide-react";

import { formatWhen, sentenceCase } from "@/lib/format/display";
import { RECOMMENDATION_CLASS, RECOMMENDATION_LABEL } from "@/lib/recommendation/labels";
import { groupTrailByTender } from "@/lib/recommendation/trail-groups";
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
  // A tender from the link stays selected even when it has no entries yet, so the page says so instead of showing everything.
  const [tender, setTender] = useState<string>(initialTender ?? "all");
  const [query, setQuery] = useState("");
  // A tender the person opened or closed by hand. Until then it follows the default below.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const id = useId();
  const needle = query.trim().toLowerCase();
  const noEntriesForTender = tender !== "all" && !tenders.some((item) => item.id === tender);

  // Groups come from every entry, so a header's latest decision and last activity stay true while a search narrows the list.
  const groups = useMemo(() => groupTrailByTender(entries), [entries]);
  const visible = groups.flatMap((group) => {
    if (tender !== "all" && group.tenderId !== tender) return [];
    const matching = needle
      ? group.entries.filter((entry) =>
          `${entry.what} ${entry.who} ${entry.note ?? ""} ${entry.tenderTitle}`.toLowerCase().includes(needle),
        )
      : group.entries;
    return matching.length > 0 ? [{ group, matching }] : [];
  });
  const shownEntries = visible.reduce((sum, item) => sum + item.matching.length, 0);
  // Collapsed by default. A search or a chosen tender means the person is looking for something, so those open.
  const openByDefault = needle !== "" || tender !== "all";

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
          className="h-10 w-full min-w-0 flex-1 rounded-lg border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-w-64 sm:max-w-sm"
        />
        <label htmlFor={`${id}-t`} className="sr-only">
          Tender
        </label>
        <select
          id={`${id}-t`}
          value={tender}
          onChange={(event) => setTender(event.target.value)}
          className="h-10 w-full shrink-0 rounded-lg border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-72"
        >
          <option value="all">All tenders</option>
          {noEntriesForTender && <option value={tender}>This tender (no entries yet)</option>}
          {tenders.map((item) => (
            <option key={item.id} value={item.id}>
              {sentenceCase(item.title).slice(0, 90)}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          <p className="text-muted-foreground">
            {noEntriesForTender
              ? "This tender has no reviews or decisions yet. They appear here when someone approves a stage or records a bid decision on it."
              : entries.length === 0
                ? "No reviews or decisions yet. They appear here when someone approves a stage or records a bid decision."
                : "Nothing matches this filter."}
          </p>
          {tender !== "all" && entries.length > 0 && (
            <button
              type="button"
              className="text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={() => setTender("all")}
            >
              Show all tenders
            </button>
          )}
        </div>
      ) : (
        <ul>
          {visible.map(({ group, matching }) => {
            const open = toggled[group.tenderId] ?? openByDefault;
            const panelId = `${id}-${group.tenderId}`;
            const decision = group.latestDecision;
            const count = matching.length === group.entries.length ? `${group.entries.length}` : `${matching.length} of ${group.entries.length}`;
            return (
              <li key={group.tenderId} className="border-b border-border/80 last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setToggled((current) => ({ ...current, [group.tenderId]: !open }))}
                  className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                >
                  <ChevronRight
                    className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium break-words" title={group.tenderTitle}>
                      {sentenceCase(group.tenderTitle)}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {count} {group.entries.length === 1 ? "entry" : "entries"} · Last activity{" "}
                      {formatWhen(group.lastAt) ?? "not dated"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "h-fit shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium",
                      decision ? RECOMMENDATION_CLASS[decision.label] : RECOMMENDATION_CLASS.none,
                    )}
                    title={decision ? `Latest decision, ${formatWhen(decision.at) ?? ""}` : "No bid decision recorded yet"}
                  >
                    {decision ? RECOMMENDATION_LABEL[decision.label] : "No decision yet"}
                  </span>
                </button>
                {open && (
                  <div id={panelId} className="border-t border-border/60 bg-muted/20">
                    <div className="px-5 pt-3 pb-1 pl-12">
                      <Link href={`/tenders/${group.tenderId}`} className="text-sm font-medium text-brand hover:underline">
                        Open tender
                      </Link>
                    </div>
                    <ol>
                      {matching.map((entry, index) => {
                        const kind = KIND[entry.kind];
                        return (
                          <li
                            key={`${entry.at}-${index}`}
                            className="flex gap-3 border-b border-border/60 py-4 pr-5 pl-12 last:border-b-0"
                          >
                            <KindIcon kind={entry.kind} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{entry.what}</p>
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
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {entries.length > 0 && (
        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
          {shownEntries} of {entries.length} {entries.length === 1 ? "entry" : "entries"} across {visible.length}{" "}
          {visible.length === 1 ? "tender" : "tenders"} · A human override needs a reason and never erases the earlier
          recommendation.
        </p>
      )}
    </>
  );
}
