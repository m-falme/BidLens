import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { NAV } from "@/components/app-shell/nav";
import { PageHeading } from "@/components/app-shell/page-heading";
import { RiskBadge } from "@/components/tenders/markers";
import { Skeleton } from "@/components/ui/skeleton";
import { listCountyRisk } from "@/lib/db/queries/tenders";
import { confidenceLabel, formatWhen } from "@/lib/format/display";

export const metadata: Metadata = { title: NAV.counties.title };

async function CountyList() {
  await connection();
  const counties = await listCountyRisk();
  const asOf = formatWhen(counties.find((county) => county.asOf)?.asOf ?? null);
  if (counties.length === 0) {
    return <p className="text-muted-foreground">No county figures are loaded.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Controller of Budget{asOf ? `, as at ${asOf}` : ""}. This is the stock of unpaid bills. It does not say when a
        buyer will pay.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[36rem] text-left">
          <thead className="border-b text-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">County</th>
              <th className="px-4 py-3 font-medium">Band</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {counties.map((county) => (
              <tr key={county.county} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{county.county}</td>
                <td className="px-4 py-3">
                  <RiskBadge band={county.band} short />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {county.score === null ? "—" : county.score.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{confidenceLabel(county.confidence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CountiesPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeading eyebrow="Workspace" title={NAV.counties.title} description="Payment-risk bands for the 47 counties." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CountyList />
      </Suspense>
    </div>
  );
}
