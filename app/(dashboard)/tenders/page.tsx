import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Upload } from "lucide-react";

import { NAV } from "@/components/app-shell/nav";
import { PageNav } from "@/components/app-shell/page-nav";
import { DecisionBadge, RiskBadge } from "@/components/tenders/markers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listTenders, type TenderListItem } from "@/lib/db/queries/tenders";
import { sentenceCase } from "@/lib/format/display";
import { presentLeadCopy } from "@/lib/leads/public-names";

export const metadata: Metadata = { title: NAV.tenders.title };

function TenderRows({ items }: { items: TenderListItem[] }) {
  if (items.length === 0) {
    return <p className="px-1 py-6 text-muted-foreground">None in this list.</p>;
  }
  return (
    <ul className="flex flex-col divide-y">
      {items.map((tender) => {
        const workbook = tender.pdfSources === 0;
        const stored = workbook ? (presentLeadCopy(tender.title) ?? tender.title) : tender.title;
        const title = sentenceCase(stored);
        const reference = workbook ? presentLeadCopy(tender.reference) : tender.reference;
        const organization = workbook ? presentLeadCopy(tender.organization) : tender.organization;
        return (
          <li key={tender.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0">
              <Link
                href={`/tenders/${tender.id}`}
                title={stored}
                className="line-clamp-2 font-medium text-primary underline-offset-4 hover:underline"
              >
                {title}
              </Link>
              <p className="mt-1 break-words text-muted-foreground">
                {[organization ? sentenceCase(organization) : null, reference].filter(Boolean).join(" · ") || "Buyer not stated"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tender.closing ? `Closes ${sentenceCase(tender.closing)}` : "Closing date not stated"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <DecisionBadge choice={tender.decision} />
              <RiskBadge band={tender.riskBand} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

async function TenderList() {
  await connection();
  const tenders = await listTenders();
  const uploaded = tenders.filter((tender) => tender.pdfSources > 0);
  const imported = tenders.filter((tender) => tender.pdfSources === 0);
  if (tenders.length === 0) {
    return <p className="p-6 text-muted-foreground">No tenders yet. Upload a tender PDF to start.</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Tenders</h2>
        <TenderRows items={uploaded} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Imported leads</h2>
        <TenderRows items={imported} />
      </section>
    </div>
  );
}

export default function TendersPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PageNav crumbs={[{ href: NAV.overview.href, label: NAV.overview.title }, { label: NAV.tenders.title }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{NAV.tenders.title}</h1>
          <p className="text-muted-foreground">{NAV.tenders.description}</p>
        </div>
        <Button size="lg" nativeButton={false} render={<Link href="/tenders/new" />}>
          <Upload aria-hidden /> Upload a tender
        </Button>
      </div>
      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <TenderList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
