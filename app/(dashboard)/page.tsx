import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ClosedBadge } from "@/components/tenders/markers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV } from "@/components/app-shell/nav";
import { loadOverview } from "@/lib/db/queries/overview";
import { sentenceCase } from "@/lib/format/display";
import { closingHasPassed } from "@/lib/recommendation/deadline";
import {
  activeReviewNote,
  activeTenderStats,
  awaitingDecisionNote,
  evidenceCounts,
  evidenceNote,
  nairobiDate,
  nextActions,
  rowPill,
  teamActivity,
  upcomingDeadline,
  type RowPill,
} from "@/lib/overview/build";
import { formatReviewedAt } from "@/lib/tenders/stage-review";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: NAV.overview.title };

const PILL_CLASS: Record<RowPill["tone"], string> = {
  confirmed: "bg-confirmed/10 text-confirmed",
  warning: "bg-warning/15 text-warning",
  blocker: "bg-blocker/12 text-blocker",
  neutral: "bg-muted text-muted-foreground",
};

function Pill({ tone, children }: { tone: RowPill["tone"]; children: string }) {
  return (
    <span className={cn("inline-flex w-fit rounded-full px-2.5 py-0.5 text-sm font-medium", PILL_CLASS[tone])}>
      {children}
    </span>
  );
}

async function OverviewBody() {
  await connection();
  const snapshot = await loadOverview();
  const asOf = new Date();
  const uploaded = snapshot.uploaded;
  const active = activeTenderStats(uploaded, asOf);
  const awaiting = uploaded.filter((tender) => tender.finalLabel === null).length;
  const evidence = evidenceCounts(snapshot.documents, nairobiDate(asOf));
  const deadline = upcomingDeadline(uploaded, asOf);
  const actions = nextActions(uploaded);
  const activity = teamActivity({
    ...snapshot.activity,
    when: formatReviewedAt,
  });
  const stats = [
    {
      label: "Active tenders",
      value: String(active.total),
      note:
        active.total === 0 && uploaded.length > 0
          ? "None still open"
          : activeReviewNote(active.unreviewed, active.total),
    },
    { label: "Awaiting a decision", value: String(awaiting), note: awaitingDecisionNote(awaiting) },
    { label: "Evidence on file", value: String(evidence.onFile), note: evidenceNote(evidence.expired) },
    { label: "Upcoming deadline", value: deadline.value, note: deadline.note },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Workspace overview</p>
          <h1 className="font-heading text-3xl tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            A clear view of the tenders uploaded for {snapshot.companyName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/tenders/new" />}>
            Add tender
          </Button>
          <Button size="lg" nativeButton={false} render={<Link href="/tenders" />}>
            All tenders
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <section key={stat.label} className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_8px_28px_rgba(23,32,42,0.05)]">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="font-heading mt-2 text-3xl font-semibold tracking-tight">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.note}</p>
          </section>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="rounded-xl border border-border bg-card shadow-[0_8px_28px_rgba(23,32,42,0.05)]">
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
            <div>
              <h2 className="font-heading text-lg font-semibold">Active tenders</h2>
              <p className="text-sm text-muted-foreground">Latest uploaded documents</p>
            </div>
            <Link href="/tenders" className="text-sm font-medium text-brand hover:underline">
              All tenders
            </Link>
          </div>
          {uploaded.length === 0 ? (
            <p className="px-5 py-6 text-muted-foreground">No tenders uploaded yet.</p>
          ) : (
            <ul>
              {uploaded.slice(0, 6).map((tender) => {
                const pill = rowPill(tender);
                const buyer = tender.buyer?.trim() ? sentenceCase(tender.buyer) : "Buyer not stated";
                const meta = [buyer, tender.reference].filter(Boolean).join(" · ");
                const closed = closingHasPassed({
                  closingText: tender.closing,
                  deadlineAt: tender.deadlineAt,
                  asOf,
                });
                return (
                  <li key={tender.id} className="flex gap-3 border-t border-border/80 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tenders/${tender.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {sentenceCase(tender.title)}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Pill tone={pill.tone}>{pill.label}</Pill>
                        {closed && <ClosedBadge />}
                      </div>
                    </div>
                    <p className="max-w-40 shrink-0 text-right text-sm text-muted-foreground">
                      {tender.closing?.trim() || "Not stated"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_8px_28px_rgba(23,32,42,0.05)]">
            <h2 className="font-heading text-lg font-semibold">Your next actions</h2>
            {actions.items.length === 0 ? (
              <p className="mt-3 text-muted-foreground">Nothing is waiting.</p>
            ) : (
              <ul className="mt-2">
                {actions.items.map((action) => (
                  <li key={action.id} className="border-b border-border/70 py-3 last:border-b-0">
                    <Link href={action.href} className="block hover:underline">
                      <span className="font-medium">{action.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{action.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {actions.more > 0 && (
              <Link href="/tenders" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
                {actions.more} more on the tender list
              </Link>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_8px_28px_rgba(23,32,42,0.05)]">
            <h2 className="font-heading text-lg font-semibold">Team activity</h2>
            {activity.length === 0 ? (
              <p className="mt-3 text-muted-foreground">No reviews or decisions yet.</p>
            ) : (
              <ul className="mt-2">
                {activity.map((row) => (
                  <li key={row.id} className="border-b border-border/70 py-3 last:border-b-0">
                    <Link href={row.href} className="block hover:underline">
                      <span className="font-medium">{row.what}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{row.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <OverviewBody />
      </Suspense>
    </div>
  );
}
