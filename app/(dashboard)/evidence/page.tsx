import type { Metadata } from "next";
import Link from "next/link";

import { NAV } from "@/components/app-shell/nav";

export const metadata: Metadata = { title: NAV.evidence.title };

export default function EvidencePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Workspace</p>
      <h1 className="font-heading text-3xl tracking-tight">{NAV.evidence.title}</h1>
      <p className="max-w-2xl text-muted-foreground">
        Company documents are listed on Company profile, with the status set for each one.
      </p>
      <Link href="/company" className="w-fit text-sm font-medium text-brand hover:underline">
        Open Company profile
      </Link>
    </div>
  );
}
