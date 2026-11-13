import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Upload } from "lucide-react";

import { NAV } from "@/components/app-shell/nav";
import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { ClosedBadge, DecisionBadge, RiskBadge } from "@/components/tenders/markers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listFieldLeads, listTenders, type FieldLeadListItem, type TenderListItem } from "@/lib/db/queries/tenders";
import { sentenceCase } from "@/lib/format/display";
import { closingHasPassed } from "@/lib/recommendation/deadline";
import { presentLeadCopy } from "@/lib/leads/public-names";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: NAV.tenders.title };

type Tab = "tenders" | "leads";

const LEAD_STATUS_LABEL: Record<string, string> = {
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

function TenderRows({ items, empty, asOf }: { items: TenderListItem[]; empty: string; asOf: Date }) {
  if (items.length === 0) {
    return <p className="px-5 py-6 text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col">
      {items.map((tender) => {
        const workbook = tender.pdfSources === 0;
        const stored = workbook ? (presentLeadCopy(tender.title) ?? tender.title) : tender.title;
        const title = sentenceCase(stored);
        const reference = workbook ? presentLeadCopy(tender.reference) : tender.reference;
        const organization = workbook ? presentLeadCopy(tender.organization) : tender.organization;
        const closed = closingHasPassed({ closingText: tender.closing, deadlineAt: tender.deadlineAt, asOf });
        return (
          <li
            key={tender.id}
            className="grid gap-3 border-t border-border/80 px-5 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
          >
            <div className="min-w-0">
              <Link
                href={`/tenders/${tender.id}`}
                title={stored}
                className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
              >
                {title}
              </Link>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {[organization ? sentenceCase(organization) : null, reference].filter(Boolean).join(" · ") ||
                  "Buyer not stated"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tender.closing ? `Closes ${sentenceCase(tender.closing)}` : "Closing date not stated"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <DecisionBadge label={tender.finalLabel} />
              <RiskBadge band={tender.riskBand} />
              {closed && <ClosedBadge />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LeadRows({ leads }: { leads: FieldLeadListItem[] }) {
  if (leads.length === 0) {
    return <p className="px-5 py-6 text-muted-foreground">No field leads yet.</p>;
  }
  return (
    <ul className="flex flex-col">
      {leads.map((lead) => {
        const title = presentLeadCopy(lead.title) ?? lead.title;
        return (
          <li
            key={lead.id}
            className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border/80 px-5 py-4 first:border-t-0"
          >
            <div className="min-w-0">
              <Link href={`/tenders/${lead.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                {title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {[lead.location, lead.owner].filter(Boolean).join(" · ") || "Location not stated"}
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm text-muted-foreground">
              {LEAD_STATUS_LABEL[lead.status] ?? sentenceCase(lead.status.replace(/_/g, " "))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="px-5 pt-5 pb-2">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

async function TenderTabs({ searchParams }: { searchParams: PageProps<"/tenders">["searchParams"] }) {
  await connection();
  const [params, tenders, leads] = await Promise.all([searchParams, listTenders(), listFieldLeads()]);
  const asOf = new Date();
  const tab: Tab = params.tab === "leads" ? "leads" : "tenders";
  const uploaded = tenders.filter((tender) => tender.pdfSources > 0);
  const imported = tenders.filter((tender) => tender.pdfSources === 0);
  const tabs: { id: Tab; label: string; count: number; href: string }[] = [
    { id: "tenders", label: "Tenders", count: uploaded.length, href: "/tenders" },
    { id: "leads", label: "Leads", count: leads.length + imported.length, href: "/tenders?tab=leads" },
  ];

  return (
    <>
      <nav aria-label="Tender lists" className="flex gap-1 border-b border-border">
        {tabs.map((item) => {
          const active = item.id === tab;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 font-medium transition-colors",
                active
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums text-muted-foreground">
                {item.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {tab === "tenders" ? (
        <section className={CARD_CLASS}>
          <TenderRows items={uploaded} asOf={asOf} empty="No tenders uploaded yet. Add a tender PDF to start." />
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          <section className={CARD_CLASS}>
            <SectionHead title="Field leads" note="Visits, notebooks and messages the team has captured." />
            <LeadRows leads={leads} />
          </section>
          <section className={CARD_CLASS}>
            <SectionHead title="Imported leads" note="Tender notices imported from the pipeline sheet, with no PDF yet." />
            <TenderRows items={imported} asOf={asOf} empty="No imported leads." />
          </section>
        </div>
      )}
    </>
  );
}

export default function TendersPage(props: PageProps<"/tenders">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeading
        eyebrow="Workspace"
        title={NAV.tenders.title}
        description={NAV.tenders.description}
        actions={
          <Button size="lg" nativeButton={false} render={<Link href="/tenders/new" />}>
            <Upload aria-hidden /> Add tender
          </Button>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-11 w-64" />
            <Skeleton className="h-72 w-full" />
          </div>
        }
      >
        <TenderTabs searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
