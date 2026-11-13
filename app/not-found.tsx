import Link from "next/link";
import { Suspense } from "react";

import { BackArrow, BackArrowLabel } from "@/components/app-shell/back-arrow";
import { NAV } from "@/components/app-shell/nav";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col gap-8 p-6">
      <Suspense fallback={<BackArrowLabel />}>
        <BackArrow />
      </Suspense>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-lg text-muted-foreground">This page doesn&apos;t exist.</p>
        <Link href={NAV.overview.href} className={buttonVariants({ size: "lg" })}>
          Back to {NAV.overview.title}
        </Link>
      </div>
    </main>
  );
}
