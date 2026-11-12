import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function TenderNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">Tender not found</h1>
      <p className="text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <Button render={<Link href="/tenders" />}>Back to tenders</Button>
    </div>
  );
}
