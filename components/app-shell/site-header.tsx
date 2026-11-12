"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { profileInitials } from "@/lib/overview/build";

import { shellCrumb } from "./nav";

function Crumb({ pathname }: { pathname: string | null }) {
  const crumb = shellCrumb(pathname ?? "/");
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm text-muted-foreground">
      {crumb.group}
      <span aria-hidden> / </span>
      <span className="font-semibold text-foreground">{crumb.page}</span>
    </nav>
  );
}

function LiveCrumb() {
  return <Crumb pathname={usePathname()} />;
}

export function SiteHeader({ companyName }: { companyName: string | null }) {
  const name = companyName ?? "Workspace";
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-8">
      <SidebarTrigger className="-ml-1" />
      <Suspense fallback={<Crumb pathname={null} />}>
        <LiveCrumb />
      </Suspense>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden max-w-56 truncate rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground sm:inline">
          {name}
        </span>
        <span
          className="flex size-9 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand"
          aria-hidden
        >
          {profileInitials(companyName ?? "")}
        </span>
      </div>
    </header>
  );
}
