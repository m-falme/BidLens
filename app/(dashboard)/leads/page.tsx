import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { NAV } from "@/components/app-shell/nav";
import { PageNav } from "@/components/app-shell/page-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { listFieldLeads } from "@/lib/db/queries/tenders";
import { presentLeadCopy } from "@/lib/leads/public-names";

export const metadata: Metadata = { title: NAV.leads.title };

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  verification_required: "Verification required",
  potential: "Potential",
  positive: "Positive",
  discovery_scheduled: "Discovery scheduled",
  qualified: "Qualified",
  proposal: "Proposal",
  awaiting_response: "Awaiting response",
  on_hold: "On hold",
  not_qualified: "Not qualified",
  won: "Won",
  lost: "Lost",
};

async function LeadList() {
  await connection();
  const leads = await listFieldLeads();
  if (leads.length === 0) {
    return <p className="text-muted-foreground">No field leads yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-lg border px-4">
      {leads.map((lead) => {
        const title = presentLeadCopy(lead.title) ?? lead.title;
        return (
          <li key={lead.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
            <div className="min-w-0">
              <Link href={`/tenders/${lead.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {[lead.location, lead.owner].filter(Boolean).join(" · ") || "Location not stated"}
              </p>
            </div>
            <span className="text-sm text-muted-foreground">{STATUS_LABEL[lead.status] ?? lead.status}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function LeadsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PageNav crumbs={[{ href: NAV.overview.href, label: NAV.overview.title }, { label: NAV.leads.title }]} />
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{NAV.leads.title}</h1>
        <p className="text-muted-foreground">Visits, notebooks and messages the team has captured.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LeadList />
      </Suspense>
    </div>
  );
}
