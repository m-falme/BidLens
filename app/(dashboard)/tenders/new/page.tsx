import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { listAddendumTargets } from "@/lib/db/queries/tenders";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Add tender" };

// The register action downloads and parses the PDF (a 200-page tender takes a few seconds).
export const maxDuration = 60;

async function UploadFormLoader({ searchParams }: { searchParams: PageProps<"/tenders/new">["searchParams"] }) {
  await connection();
  const [targets, params] = await Promise.all([listAddendumTargets(), searchParams]);
  const addendumFor = typeof params.addendum === "string" ? params.addendum : null;
  return <UploadForm targets={targets} defaultAddendumFor={addendumFor} />;
}

const STEPS: readonly string[] = [
  "The original PDF is stored unchanged.",
  "Every page's text is read and kept with the tender.",
  "Key facts are extracted, each with a quote and a page.",
  "Code checks each quote on its page. A fact is Confirmed only when the quote is found.",
];

export default function NewTenderPage(props: PageProps<"/tenders/new">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeading
        eyebrow="Workspace"
        title="Add tender"
        description="Upload a tender PDF, or an addendum to a tender you have already added."
        actions={
          <Link href="/tenders" className="text-sm font-medium text-brand hover:underline">
            All tenders
          </Link>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.7fr)]">
        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">Tender document</h2>
            <p className="text-sm text-muted-foreground">
              PDF only, up to 25 MB. The same file twice is reported, never merged.
            </p>
          </div>
          <div className="px-5 pt-2 pb-5">
            <Suspense fallback={<Skeleton className="h-72 w-full" />}>
              <UploadFormLoader searchParams={props.searchParams} />
            </Suspense>
          </div>
        </section>
        <section className={`${CARD_CLASS} px-5 py-4`}>
          <h2 className="font-heading text-lg font-semibold">What happens next</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {index + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
            Nothing is submitted to the buyer. You review each stage before a decision is recorded.
          </p>
        </section>
      </div>
    </div>
  );
}
