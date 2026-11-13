import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { NAV } from "@/components/app-shell/nav";
import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { PAPER_GROUPS } from "@/lib/company/papers";
import { getDemoCompanyProfile } from "@/lib/db/queries/company";
import { nairobiDate } from "@/lib/overview/build";

import { EvidenceLibrary } from "./document-checklist";

export const metadata: Metadata = { title: NAV.evidence.title };

async function EvidenceBody() {
  await connection();
  const company = await getDemoCompanyProfile();
  const have = company.documents.filter((document) => document.holding === "have").length;
  const declared = company.documents.filter((document) => document.holding === "have" && document.selfDeclared).length;
  const notHeld = company.documents.length - have;
  const stats = [
    { label: "Have", value: have, note: `${declared} self-declared` },
    { label: "Don't have or expired", value: notHeld, note: "Gaps when a tender needs them" },
    {
      label: "Linked to a tender",
      value: company.documents.filter((document) => document.uses.length > 0).length,
      note: "Met at least one requirement",
    },
  ];

  return (
    <>
      <PageHeading eyebrow="Workspace" title={NAV.evidence.title} description={NAV.evidence.description} />
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <section key={stat.label} className={`${CARD_CLASS} px-5 py-4`}>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="font-heading mt-2 text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.note}</p>
          </section>
        ))}
      </div>
      <section className={CARD_CLASS}>
        <EvidenceLibrary documents={company.documents} groups={PAPER_GROUPS} today={nairobiDate(new Date())} />
      </section>
    </>
  );
}

export default function EvidencePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <EvidenceBody />
      </Suspense>
    </div>
  );
}
