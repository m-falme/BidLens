import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BarChart3, FileSearch, ShieldCheck, type LucideIcon } from "lucide-react";

import { NAV } from "@/components/app-shell/nav";
import { DecisionBadge } from "@/components/tenders/markers";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listTenders } from "@/lib/db/queries/tenders";
import { sentenceCase } from "@/lib/format/display";

export const metadata: Metadata = { title: NAV.overview.title };

const HOME_ACTIONS: readonly { href: string; title: string; summary: string; icon: LucideIcon }[] = [
  {
    href: "/tenders/new",
    title: "Analyse Tender",
    summary: "Extracts and explains key tender requirements.",
    icon: FileSearch,
  },
  {
    href: "/company",
    title: "Check Compliance",
    summary: "Checks eligibility, highlights gaps and risks.",
    icon: ShieldCheck,
  },
  {
    href: "/counties",
    title: "Assess Viability",
    summary: "Assesses viability and potential financial strain, like delayed payments.",
    icon: BarChart3,
  },
];

async function OverviewBody() {
  await connection();
  const tenders = await listTenders();
  const uploaded = tenders.filter((tender) => tender.pdfSources > 0);
  const recommended = uploaded.filter(
    (tender) => tender.decision === "bid" || tender.decision === "bid_higher",
  ).length;
  const needsHuman = uploaded.reduce((sum, tender) => sum + tender.needsHuman, 0);
  const latest = uploaded.slice(0, 4);
  const stats = [
    { label: "Tenders reviewed", value: String(uploaded.length), note: "Uploaded tender documents" },
    { label: "Recommended to bid", value: String(recommended), note: "Recorded as Bid or Bid higher" },
    { label: "Value at risk", value: "Not stated", note: "No contract value is written on these tenders" },
    { label: "Needs a person", value: String(needsHuman), note: "Fields still to check" },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="gap-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Latest tenders</h2>
        {latest.length === 0 ? (
          <p className="text-muted-foreground">No tenders yet.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border px-4">
            {latest.map((tender) => {
              const title = sentenceCase(tender.title);
              return (
                <li key={tender.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <Link
                      href={`/tenders/${tender.id}`}
                      title={tender.title}
                      className="line-clamp-2 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {title}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tender.closing ? `Closes ${sentenceCase(tender.closing)}` : "Closing date not stated"}
                    </p>
                  </div>
                  <DecisionBadge choice={tender.decision} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default function OverviewPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="space-y-2">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
          Hello! How can I support your tender assessment today?
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {HOME_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <action.icon className="size-6" aria-hidden />
            </span>
            <span className="text-xl font-semibold">{action.title}</span>
            <span className="text-muted-foreground">{action.summary}</span>
          </Link>
        ))}
      </div>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        }
      >
        <OverviewBody />
      </Suspense>
    </div>
  );
}
