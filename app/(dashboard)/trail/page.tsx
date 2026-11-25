import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { NAV } from "@/components/app-shell/nav";
import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { loadWorkspaceTrail } from "@/lib/db/queries/trail";

import { TrailList } from "./trail-list";

export const metadata: Metadata = { title: NAV.trail.title };

async function TrailBody({ searchParams }: { searchParams: PageProps<"/trail">["searchParams"] }) {
  await connection();
  const [params, trail] = await Promise.all([searchParams, loadWorkspaceTrail()]);
  // Only a real id selects a tender. Anything else shows every tender.
  const tender = typeof params.tender === "string" && z.uuid().safeParse(params.tender).success ? params.tender : null;
  return (
    <section className={CARD_CLASS}>
      {/* Keyed so a different ?tender= starts fresh even if this page is still mounted from an earlier visit. */}
      <TrailList key={tender ?? "all"} entries={trail.entries} tenders={trail.tenders} initialTender={tender} />
    </section>
  );
}

export default function TrailPage(props: PageProps<"/trail">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeading eyebrow="Manage" title={NAV.trail.title} description={NAV.trail.description} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TrailBody searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
