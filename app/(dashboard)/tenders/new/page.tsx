import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listAddendumTargets } from "@/lib/db/queries/tenders";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Upload a tender" };

// The register action downloads and parses the PDF (a 200-page tender takes a few seconds).
export const maxDuration = 60;

async function UploadFormLoader({ searchParams }: { searchParams: PageProps<"/tenders/new">["searchParams"] }) {
  await connection();
  const [targets, params] = await Promise.all([listAddendumTargets(), searchParams]);
  const addendumFor = typeof params.addendum === "string" ? params.addendum : null;
  return <UploadForm targets={targets} defaultAddendumFor={addendumFor} />;
}

export default function NewTenderPage(props: PageProps<"/tenders/new">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Upload a tender</h1>
        <p className="text-lg text-muted-foreground">
          BidLens reads every page, extracts the key requirements and checks each quote against the page it cites.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tender document</CardTitle>
          <CardDescription>The original file is stored unchanged and linked to every extracted field.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <UploadFormLoader searchParams={props.searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
