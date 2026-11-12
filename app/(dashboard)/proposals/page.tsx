import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";
import { PageNav } from "@/components/app-shell/page-nav";

export const metadata: Metadata = { title: NAV.proposals.title };

export default function ProposalsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PageNav crumbs={[{ href: NAV.overview.href, label: NAV.overview.title }, { label: NAV.proposals.title }]} />
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{NAV.proposals.title}</h1>
        <p className="text-muted-foreground">No proposals yet.</p>
      </div>
    </div>
  );
}
