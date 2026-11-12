import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Upload } from "lucide-react";

import { NAV } from "@/components/app-shell/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTenders } from "@/lib/db/queries/tenders";
import { presentLeadCopy, sourceLabel } from "@/lib/leads/public-names";

export const metadata: Metadata = { title: NAV.tenders.title };

async function TenderList() {
  await connection();
  const tenders = await listTenders();
  if (tenders.length === 0) {
    return <p className="p-6 text-muted-foreground">No tenders yet. Upload a tender PDF to start.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tender</TableHead>
          <TableHead className="w-56">Buyer</TableHead>
          <TableHead className="w-44">Source</TableHead>
          <TableHead className="w-24 text-right">Fields</TableHead>
          <TableHead className="w-36 text-right">Needs review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenders.map((t) => {
          const workbook = t.pdfSources === 0;
          const title = workbook ? (presentLeadCopy(t.title) ?? t.title) : t.title;
          const reference = workbook ? presentLeadCopy(t.reference) : t.reference;
          const organization = workbook ? presentLeadCopy(t.organization) : t.organization;
          return (
            <TableRow key={t.id}>
              <TableCell className="max-w-md whitespace-normal">
                <Link href={`/tenders/${t.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {title}
                </Link>
                {reference && <span className="block text-sm text-muted-foreground">{reference}</span>}
              </TableCell>
              <TableCell className="whitespace-normal">{organization ?? "—"}</TableCell>
              <TableCell>
                {t.pdfSources > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{sourceLabel({ kind: "pdf", opportunityType: "procurement" })}</Badge>
                    {t.addenda > 0 && <Badge variant="outline">+{t.addenda} addendum</Badge>}
                  </span>
                ) : (
                  <Badge variant="outline">{sourceLabel({ kind: "form", opportunityType: "procurement" })}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{t.fieldCount}</TableCell>
              <TableCell className="text-right tabular-nums">
                {t.needsHuman > 0 ? <span className="font-semibold text-red-700">{t.needsHuman}</span> : 0}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function TendersPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{NAV.tenders.title}</h1>
          <p className="text-lg text-muted-foreground">{NAV.tenders.description}</p>
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
