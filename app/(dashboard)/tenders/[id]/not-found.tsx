import { NAV } from "@/components/app-shell/nav";
import { PageNav } from "@/components/app-shell/page-nav";

export default function TenderNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-6">
      <PageNav
        crumbs={[
          { href: NAV.overview.href, label: NAV.overview.title },
          { href: NAV.tenders.href, label: NAV.tenders.title },
          { label: "Not found" },
        ]}
      />
      <h1 className="text-3xl font-semibold">Tender not found</h1>
      <p className="text-muted-foreground">It may have been removed, or the link is wrong.</p>
    </div>
  );
}
