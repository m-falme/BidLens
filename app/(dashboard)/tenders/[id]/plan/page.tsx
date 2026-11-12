import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { sentenceCase } from "@/lib/format/display";
import { loadPrintablePlan } from "@/lib/plan/load";

import { ActionPlan } from "../action-plan";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Action plan" };

async function PlanPage({ params }: { params: PageProps<"/tenders/[id]/plan">["params"] }) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const plan = await loadPrintablePlan(id);
  if (!plan) notFound();
  const heading = sentenceCase(plan.title);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-primary">How do we proceed?</p>
          <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground">
            {[plan.organization ? sentenceCase(plan.organization) : null, plan.reference].filter(Boolean).join(" · ") ||
              "Buyer not stated"}
          </p>
          <p>{plan.finding}</p>
          <p className="text-lg font-semibold tabular-nums">{plan.progressLabel}</p>
          <p className="text-muted-foreground">
            Built from the extracted tender and the company documents. This page does not submit a bid.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <ButtonLink href={`/tenders/${plan.tenderId}`} label="Back to tender" />
          <PrintButton />
        </div>
      </div>
      <ActionPlan tenderId={plan.tenderId} rows={plan.rows} editable={false} />
    </div>
  );
}

function ButtonLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
    >
      {label}
    </Link>
  );
}

export default function Page(props: PageProps<"/tenders/[id]/plan">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading the plan…</p>}>
      <PlanPage params={props.params} />
    </Suspense>
  );
}
