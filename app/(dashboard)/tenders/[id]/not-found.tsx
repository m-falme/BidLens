import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function TenderNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3">
      <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Workspace</p>
      <h1 className="font-heading text-3xl tracking-tight">Tender not found</h1>
      <p className="text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <Link href="/tenders" className={buttonVariants({ variant: "outline", size: "lg" })}>
        Back to Tenders
      </Link>
    </div>
  );
}
