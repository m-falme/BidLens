import type { Metadata } from "next";
import Link from "next/link";

import { NAV } from "@/components/app-shell/nav";

export const metadata: Metadata = { title: NAV.trail.title };

export default function TrailPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Manage</p>
      <h1 className="font-heading text-3xl tracking-tight">{NAV.trail.title}</h1>
      <p className="max-w-2xl text-muted-foreground">
        Reviews and bid decisions are listed on each tender. Nothing is added from this page.
      </p>
      <Link href="/tenders" className="w-fit text-sm font-medium text-brand hover:underline">
        Open tenders
      </Link>
    </div>
  );
}
